import type {
  DesktopModelListRequest,
  DesktopModelListResponse,
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopModelTestRequest,
  DesktopModelTestResponse
} from '../shared/desktop-api.js';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ModelCapability, ModelCatalogEntry } from '../shared/desktop-contract.js';
import {
  classifyModelCapabilitiesFromName,
  createModelCapabilityMetadata,
  normalizeExplicitModelCapabilities,
  readModelProfileCapabilities
} from '../shared/desktop-model-capabilities.js';
import {
  detectModelProviderMode,
  invokeNativeAudioTranscription,
  listNativeProviderModels,
  testNativeModelConnection
} from './model-provider-native.js';

interface OpenAiCompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
      reasoning_content?: unknown;
    };
    delta?: {
      content?: unknown;
    };
    text?: unknown;
  }>;
  output?: unknown;
  output_text?: unknown;
  text?: unknown;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
  error?: {
    message?: unknown;
  };
}

interface OpenAiCompatibleModelListResponse {
  data?: Array<{
    id?: unknown;
    owned_by?: unknown;
    capabilities?: unknown;
  }>;
  error?: {
    message?: unknown;
  };
}

interface OpenAiCompatibleImageResponse {
  data?: Array<{
    url?: unknown;
    video_url?: unknown;
    b64_json?: unknown;
    revised_prompt?: unknown;
  }>;
  error?: {
    message?: unknown;
  };
}

interface OpenAiCompatibleTranscriptionResponse {
  text?: unknown;
  result?: unknown;
  transcript?: unknown;
  error?: {
    message?: unknown;
  };
}

const defaultTimeoutMs = 45_000;
const imageGenerationTestTimeoutMs = 180_000;
const videoGenerationTestTimeoutMs = 240_000;
const grsaiImageSubmitTimeoutMs = 120_000;
const grsaiImagePollInitialIntervalMs = 3_000;
const grsaiImagePollMaxIntervalMs = 15_000;
const grsaiImagePollRequestTimeoutMs = 30_000;
const lightweightPngBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

type ModelTestCheck = NonNullable<DesktopModelTestResponse['checks']>[number];

export async function invokeOpenAiCompatibleModelChat(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse> {
  const apiKey = request.profile.apiKey?.trim();
  const modelName = request.profile.modelName.trim();

  if (!apiKey) {
    throw new Error('Model API Key is missing.');
  }

  if (!modelName) {
    throw new Error('Model name is missing.');
  }

  if (request.messages.length === 0) {
    throw new Error('Model chat request must include at least one message.');
  }

  if (request.taskKind === 'image_generation' || request.imageGeneration) {
    const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
    return invokeOpenAiCompatibleImageGeneration({
      request,
      apiBaseUrl,
      apiKey,
      modelName
    });
  }

  if (request.taskKind === 'video_generation' || request.videoGeneration) {
    const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
    return invokeOpenAiCompatibleVideoGeneration({
      request,
      apiBaseUrl,
      apiKey,
      modelName
    });
  }

  if (request.taskKind === 'audio_transcription' || request.audioTranscription) {
    const nativeResponse = await invokeNativeAudioTranscription(request);
    if (nativeResponse) {
      return nativeResponse;
    }

    const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
    return invokeOpenAiCompatibleAudioTranscription({
      request,
      apiBaseUrl,
      apiKey,
      modelName
    });
  }

  const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  const chatEndpoint = `${apiBaseUrl}/chat/completions`;
  const messages = buildOpenAiCompatibleChatMessagesWithVisionInputs(request);
  const response = await fetchModelApi(chatEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages,
      temperature: request.profile.temperature,
      max_tokens: request.profile.maxTokens
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? defaultTimeoutMs)
  }, 'Model chat');

  const bodyText = await response.text();
  const body = parseJsonBody(bodyText);

  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`Model API returned HTTP ${response.status}: ${errorMessage}`);
  }

  const content = readAssistantContent(body);
  if (!content) {
    throw new Error('Model API response did not include assistant content.');
  }

  return {
    provider: request.profile.providerName,
    modelName,
    content,
    inputTokens: readTokenCount(body?.usage?.prompt_tokens),
    outputTokens: readTokenCount(body?.usage?.completion_tokens)
  };
}

async function invokeOpenAiCompatibleImageGeneration(input: {
  request: DesktopModelChatRequest;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
}): Promise<DesktopModelChatResponse> {
  const prompt = buildImageGenerationPrompt(input.request);
  const sourceImagePath = input.request.imageGeneration?.sourceImagePath?.trim();
  const timeoutMs = input.request.timeoutMs ?? 180_000;
  if (sourceImagePath && !existsSync(sourceImagePath)) {
    throw new Error(`Source image file does not exist: ${sourceImagePath}`);
  }

  if (isGrsaiProvider({
    providerId: input.request.profile.providerId,
    providerName: input.request.profile.providerName,
    apiBaseUrl: input.apiBaseUrl
  })) {
    return invokeGrsaiAsyncImageGeneration({
      request: input.request,
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      modelName: input.modelName,
      prompt,
      sourceImagePath,
      timeoutMs
    });
  }

  const imageEndpoint = sourceImagePath
    ? `${input.apiBaseUrl}/images/edits`
    : `${input.apiBaseUrl}/images/generations`;
  const response = sourceImagePath
    ? await fetchModelApi(imageEndpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.apiKey}`
        },
        body: buildImageEditFormData(input.modelName, prompt, sourceImagePath, input.request.imageGeneration?.size),
        signal: AbortSignal.timeout(timeoutMs)
      }, 'Image edit')
    : await fetchModelApi(imageEndpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: input.modelName,
          prompt,
          n: 1,
          size: input.request.imageGeneration?.size,
          response_format: input.request.imageGeneration?.responseFormat ?? 'url'
        }),
        signal: AbortSignal.timeout(timeoutMs)
      }, 'Image generation');
  const bodyText = await response.text();
  const body = parseImageGenerationJsonBody(bodyText);

  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`Image model API returned HTTP ${response.status}: ${errorMessage}`);
  }

  const remoteUrl = readImageResponseUrl(body);
  if (!remoteUrl) {
    if (readImageResponseBase64(body)) {
      throw new Error('Image model API returned base64 image data. Configure the provider to return URL results.');
    }

    throw new Error('Image model API response did not include an image URL.');
  }

  const content = JSON.stringify({ remoteUrl });
  return {
    provider: input.request.profile.providerName,
    modelName: input.modelName,
    content,
    artifacts: [
      {
        type: 'image',
        remoteUrl,
        thumbnailPath: remoteUrl
      }
    ]
  };
}

async function invokeOpenAiCompatibleVideoGeneration(input: {
  request: DesktopModelChatRequest;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
}): Promise<DesktopModelChatResponse> {
  const prompt = buildVideoGenerationPrompt(input.request);
  const sourceImagePath = input.request.videoGeneration?.sourceImagePath?.trim();
  const timeoutMs = input.request.timeoutMs ?? videoGenerationTestTimeoutMs;
  if (sourceImagePath && !existsSync(sourceImagePath)) {
    throw new Error(`Source image file does not exist: ${sourceImagePath}`);
  }

  if (isGrsaiProvider({
    providerId: input.request.profile.providerId,
    providerName: input.request.profile.providerName,
    apiBaseUrl: input.apiBaseUrl
  })) {
    return invokeGrsaiAsyncVideoGeneration({
      request: input.request,
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      modelName: input.modelName,
      prompt,
      sourceImagePath,
      timeoutMs
    });
  }

  const videoEndpoint = `${input.apiBaseUrl}/videos/generations`;
  const body: Record<string, unknown> = {
    model: input.modelName,
    prompt,
    n: 1,
    response_format: input.request.videoGeneration?.responseFormat ?? 'url'
  };
  if (sourceImagePath) {
    body.image = buildLocalImageDataUrl(sourceImagePath);
    body.source_image = body.image;
  }
  if (input.request.videoGeneration?.durationSeconds) {
    body.duration = input.request.videoGeneration.durationSeconds;
    body.duration_seconds = input.request.videoGeneration.durationSeconds;
  }
  if (input.request.videoGeneration?.aspectRatio?.trim()) {
    body.aspect_ratio = input.request.videoGeneration.aspectRatio.trim();
    body.aspectRatio = input.request.videoGeneration.aspectRatio.trim();
  }

  const response = await fetchModelApi(videoEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  }, 'Video generation');
  const bodyText = await response.text();
  const parsedBody = parseJsonObject(bodyText);

  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(parsedBody) ?? bodyText.slice(0, 500);
    throw new Error(`Video model API returned HTTP ${response.status}: ${errorMessage}`);
  }

  const remoteUrl = readVideoUrlFromUnknown(parsedBody);
  if (!remoteUrl) {
    throw new Error('Video model API response did not include a video URL.');
  }

  return buildVideoGenerationResponse({
    provider: input.request.profile.providerName,
    modelName: input.modelName,
    remoteUrl
  });
}

async function invokeGrsaiAsyncImageGeneration(input: {
  request: DesktopModelChatRequest;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  prompt: string;
  sourceImagePath?: string;
  timeoutMs: number;
}): Promise<DesktopModelChatResponse> {
  const asyncMode = input.request.imageGeneration?.asyncMode ?? 'wait';
  if (asyncMode === 'poll_once') {
    const providerJobId = input.request.imageGeneration?.providerJobId?.trim();
    if (!providerJobId) {
      throw new Error('GrsAI image poll request did not include a task id.');
    }

    const pollResult = await queryGrsaiImageGenerationResult({
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      providerJobId,
      timeoutMs: input.timeoutMs
    });
    if (!pollResult.remoteUrl) {
      return buildPendingImageGenerationResponse({
        provider: input.request.profile.providerName,
        modelName: input.modelName,
        providerJobId,
        providerStatus: pollResult.providerStatus
      });
    }

    return buildImageGenerationResponse({
      provider: input.request.profile.providerName,
      modelName: input.modelName,
      remoteUrl: pollResult.remoteUrl,
      providerJobId,
      providerStatus: pollResult.providerStatus,
      asyncMode: true
    });
  }

  const submitEndpoint = `${input.apiBaseUrl}/api/generate`;
  const response = await fetchModelApi(submitEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(buildGrsaiImageGenerationPayload(input)),
    signal: AbortSignal.timeout(Math.min(input.timeoutMs, grsaiImageSubmitTimeoutMs))
  }, 'GrsAI image task submit');

  const bodyText = await response.text();
  const body = parseJsonObject(bodyText);
  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? readGrsaiErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`GrsAI image task submit returned HTTP ${response.status}: ${errorMessage}`);
  }

  const submittedUrl = readImageUrlFromUnknown(body);
  const providerJobId = readGrsaiJobId(body);
  const submittedStatus = readGrsaiJobStatus(body);
  if (submittedUrl) {
    return buildImageGenerationResponse({
      provider: input.request.profile.providerName,
      modelName: input.modelName,
      remoteUrl: submittedUrl,
      providerJobId,
      providerStatus: submittedStatus,
      asyncMode: Boolean(providerJobId)
    });
  }

  if (!providerJobId) {
    throw new Error('GrsAI image task response did not include an image URL or task id.');
  }

  if (asyncMode === 'submit_only') {
    return buildPendingImageGenerationResponse({
      provider: input.request.profile.providerName,
      modelName: input.modelName,
      providerJobId,
      providerStatus: submittedStatus
    });
  }

  const pollResult = await pollGrsaiImageGenerationResult({
    apiBaseUrl: input.apiBaseUrl,
    apiKey: input.apiKey,
    providerJobId,
    timeoutMs: input.timeoutMs,
    startedAt: Date.now()
  });

  return buildImageGenerationResponse({
    provider: input.request.profile.providerName,
    modelName: input.modelName,
    remoteUrl: pollResult.remoteUrl,
    providerJobId,
    providerStatus: pollResult.providerStatus,
    asyncMode: true
  });
}

function buildGrsaiImageGenerationPayload(input: {
  request: DesktopModelChatRequest;
  modelName: string;
  prompt: string;
  sourceImagePath?: string;
}): Record<string, unknown> {
  const images = input.sourceImagePath
    ? [buildLocalImageDataUrl(input.sourceImagePath)]
    : [];
  const aspectRatio = inferImageAspectRatioFromSize(input.request.imageGeneration?.size);
  return {
    model: input.modelName,
    prompt: input.prompt,
    images,
    aspectRatio,
    replyType: 'json'
  };
}

async function pollGrsaiImageGenerationResult(input: {
  apiBaseUrl: string;
  apiKey: string;
  providerJobId: string;
  timeoutMs: number;
  startedAt: number;
}): Promise<{ remoteUrl: string; providerStatus?: string }> {
  let lastStatus: string | undefined;
  let pollIntervalMs = grsaiImagePollInitialIntervalMs;
  while (Date.now() - input.startedAt < input.timeoutMs) {
    await sleep(pollIntervalMs);
    const remainingMs = Math.max(1, input.timeoutMs - (Date.now() - input.startedAt));
    const result = await queryGrsaiImageGenerationResult({
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      providerJobId: input.providerJobId,
      timeoutMs: Math.min(grsaiImagePollRequestTimeoutMs, remainingMs)
    });
    lastStatus = result.providerStatus ?? lastStatus;
    if (result.remoteUrl) {
      return { remoteUrl: result.remoteUrl, providerStatus: lastStatus };
    }

    pollIntervalMs = Math.min(grsaiImagePollMaxIntervalMs, Math.ceil(pollIntervalMs * 1.5));
  }

  throw new Error(
    `GrsAI image task timed out while polling result. taskId=${input.providerJobId}${lastStatus ? `, status=${lastStatus}` : ''}`
  );
}

async function queryGrsaiImageGenerationResult(input: {
  apiBaseUrl: string;
  apiKey: string;
  providerJobId: string;
  timeoutMs: number;
}): Promise<{ remoteUrl?: string; providerStatus?: string }> {
  const resultEndpoint = `${input.apiBaseUrl}/api/result?id=${encodeURIComponent(input.providerJobId)}`;
  const response = await fetchModelApi(resultEndpoint, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${input.apiKey}`
    },
    signal: AbortSignal.timeout(Math.min(grsaiImagePollRequestTimeoutMs, Math.max(1, input.timeoutMs)))
  }, 'GrsAI image task result');
  const bodyText = await response.text();
  const body = parseJsonObject(bodyText);
  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? readGrsaiErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`GrsAI image task result returned HTTP ${response.status}: ${errorMessage}`);
  }

  const providerStatus = readGrsaiJobStatus(body);
  if (isGrsaiFailedStatus(providerStatus)) {
    const errorMessage = readGrsaiErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`GrsAI image task failed: ${errorMessage || providerStatus}`);
  }

  const remoteUrl = readImageUrlFromUnknown(body);
  if (remoteUrl && (!providerStatus || !isGrsaiPendingStatus(providerStatus))) {
    return { remoteUrl, providerStatus };
  }

  return { providerStatus };
}

async function invokeGrsaiAsyncVideoGeneration(input: {
  request: DesktopModelChatRequest;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
  prompt: string;
  sourceImagePath?: string;
  timeoutMs: number;
}): Promise<DesktopModelChatResponse> {
  const submitEndpoint = `${input.apiBaseUrl}/api/generate`;
  const startedAt = Date.now();
  const response = await fetchModelApi(submitEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify(buildGrsaiVideoGenerationPayload(input)),
    signal: AbortSignal.timeout(input.timeoutMs)
  }, 'GrsAI video task submit');

  const bodyText = await response.text();
  const body = parseJsonObject(bodyText);
  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? readGrsaiErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`GrsAI video task submit returned HTTP ${response.status}: ${errorMessage}`);
  }

  const submittedUrl = readVideoUrlFromUnknown(body);
  const providerJobId = readGrsaiJobId(body);
  const submittedStatus = readGrsaiJobStatus(body);
  if (submittedUrl) {
    return buildVideoGenerationResponse({
      provider: input.request.profile.providerName,
      modelName: input.modelName,
      remoteUrl: submittedUrl,
      providerJobId,
      providerStatus: submittedStatus,
      asyncMode: Boolean(providerJobId)
    });
  }

  if (!providerJobId) {
    throw new Error('GrsAI video task response did not include a video URL or task id.');
  }

  const pollResult = await pollGrsaiVideoGenerationResult({
    apiBaseUrl: input.apiBaseUrl,
    apiKey: input.apiKey,
    providerJobId,
    timeoutMs: input.timeoutMs,
    startedAt
  });

  return buildVideoGenerationResponse({
    provider: input.request.profile.providerName,
    modelName: input.modelName,
    remoteUrl: pollResult.remoteUrl,
    providerJobId,
    providerStatus: pollResult.providerStatus,
    asyncMode: true
  });
}

function buildGrsaiVideoGenerationPayload(input: {
  request: DesktopModelChatRequest;
  modelName: string;
  prompt: string;
  sourceImagePath?: string;
}): Record<string, unknown> {
  const images = input.sourceImagePath
    ? [buildLocalImageDataUrl(input.sourceImagePath)]
    : [];
  return {
    model: input.modelName,
    prompt: input.prompt,
    images,
    aspectRatio: input.request.videoGeneration?.aspectRatio,
    duration: input.request.videoGeneration?.durationSeconds,
    durationSeconds: input.request.videoGeneration?.durationSeconds,
    replyType: 'json'
  };
}

async function pollGrsaiVideoGenerationResult(input: {
  apiBaseUrl: string;
  apiKey: string;
  providerJobId: string;
  timeoutMs: number;
  startedAt: number;
}): Promise<{ remoteUrl: string; providerStatus?: string }> {
  const resultEndpoint = `${input.apiBaseUrl}/api/result?id=${encodeURIComponent(input.providerJobId)}`;
  let lastStatus: string | undefined;
  let lastBodyText = '';
  while (Date.now() - input.startedAt < input.timeoutMs) {
    await sleep(grsaiImagePollInitialIntervalMs);
    const response = await fetchModelApi(resultEndpoint, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${input.apiKey}`
      },
      signal: AbortSignal.timeout(Math.min(grsaiImagePollRequestTimeoutMs, input.timeoutMs))
    }, 'GrsAI video task result');
    lastBodyText = await response.text();
    const body = parseJsonObject(lastBodyText);
    if (!response.ok) {
      const errorMessage = readProviderErrorMessage(body) ?? readGrsaiErrorMessage(body) ?? lastBodyText.slice(0, 500);
      throw new Error(`GrsAI video task result returned HTTP ${response.status}: ${errorMessage}`);
    }

    const remoteUrl = readVideoUrlFromUnknown(body);
    lastStatus = readGrsaiJobStatus(body) ?? lastStatus;
    if (remoteUrl && (!lastStatus || !isGrsaiPendingStatus(lastStatus))) {
      return { remoteUrl, providerStatus: lastStatus };
    }

    if (isGrsaiFailedStatus(lastStatus)) {
      const errorMessage = readGrsaiErrorMessage(body) ?? lastBodyText.slice(0, 500);
      throw new Error(`GrsAI video task failed: ${errorMessage || lastStatus}`);
    }
  }

  throw new Error(
    `GrsAI video task timed out while polling result. taskId=${input.providerJobId}${lastStatus ? `, status=${lastStatus}` : ''}`
  );
}

async function invokeOpenAiCompatibleAudioTranscription(input: {
  request: DesktopModelChatRequest;
  apiBaseUrl: string;
  apiKey: string;
  modelName: string;
}): Promise<DesktopModelChatResponse> {
  const audioPath = input.request.audioTranscription?.audioPath?.trim();
  if (!audioPath) {
    throw new Error('Audio transcription path is missing.');
  }

  if (!existsSync(audioPath)) {
    throw new Error(`Audio file does not exist: ${audioPath}`);
  }

  const transcriptionEndpoint = `${input.apiBaseUrl}/audio/transcriptions`;
  const response = await fetchModelApi(transcriptionEndpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.apiKey}`
    },
    body: buildAudioTranscriptionFormData(input.modelName, audioPath, input.request.audioTranscription),
    signal: AbortSignal.timeout(input.request.timeoutMs ?? 180_000)
  }, 'Audio transcription');
  const bodyText = await response.text();
  const body = parseTranscriptionJsonBody(bodyText);

  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`Audio transcription API returned HTTP ${response.status}: ${errorMessage}`);
  }

  const content = readTranscriptionText(body) ?? bodyText.trim();
  if (!content) {
    throw new Error('Audio transcription API response did not include transcript text.');
  }

  return {
    provider: input.request.profile.providerName,
    modelName: input.modelName,
    content
  };
}

export async function listOpenAiCompatibleModels(
  request: DesktopModelListRequest
): Promise<DesktopModelListResponse> {
  const nativeCatalog = await listNativeProviderModels(request);
  if (nativeCatalog) {
    return nativeCatalog;
  }

  const apiBaseUrl = normalizeApiBaseUrl(request.apiBaseUrl);
  const apiKey = request.apiKey?.trim();

  if (!apiBaseUrl) {
    throw new Error('Model API Base URL is missing.');
  }

  if (!apiKey) {
    throw new Error('Model API Key is missing.');
  }

  const builtInModels = listBuiltInCompatibleProviderModels(request);
  let providerModels: ModelCatalogEntry[] = [];
  try {
    providerModels = await fetchOpenAiCompatibleProviderModels({
      apiBaseUrl,
      apiKey,
      timeoutMs: request.timeoutMs
    });
  } catch (error) {
    if (builtInModels.length === 0) {
      throw error;
    }
  }

  return {
    providerId: request.providerId.trim(),
    providerName: request.providerName.trim(),
    apiBaseUrl,
    fetchedAt: new Date().toISOString(),
    models: mergeModelCatalogEntries(providerModels, builtInModels)
  };
}

export async function testDesktopModelConnection(
  request: DesktopModelTestRequest
): Promise<DesktopModelTestResponse> {
  const nativeResult = await testNativeModelConnection(request);
  if (nativeResult) {
    return nativeResult;
  }

  const checks = await runOpenAiCompatibleModelTestChecks(request);
  const failedChecks = checks.filter((check) => check.status === 'failed');
  const passedChecks = checks.filter((check) => check.status === 'passed');
  const ok = failedChecks.length === 0 && passedChecks.length > 0;
  const checkedAt = new Date().toISOString();
  const verifiedCapabilities = readVerifiedCapabilitiesFromChecks(checks);
  return {
    providerId: request.profile.providerId,
    providerName: request.profile.providerName,
    modelName: request.profile.modelName,
    ok,
    checkedAt,
    mode: detectModelProviderMode({
      providerId: request.profile.providerId,
      providerName: request.profile.providerName,
      modelName: request.profile.modelName,
      capabilities: request.profile.capabilities
    }),
    verifiedCapabilities,
    capabilityMetadata: ok && verifiedCapabilities.length > 0
      ? createModelCapabilityMetadata({
          source: 'verified',
          confidence: 'verified',
          verifiedAt: checkedAt,
          note: '模型连接测试已验证这些能力。'
        })
      : undefined,
    message: ok
      ? `Model checks passed: ${passedChecks.length} passed${checks.length > passedChecks.length ? `, ${checks.length - passedChecks.length} skipped` : ''}.`
      : `Model checks did not fully pass: ${failedChecks.length} failed, ${passedChecks.length} passed.`,
    checks
  };
}

async function fetchOpenAiCompatibleProviderModels(input: {
  apiBaseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}): Promise<ModelCatalogEntry[]> {
  const modelsEndpoint = `${input.apiBaseUrl}/models`;
  const response = await fetchModelApi(modelsEndpoint, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${input.apiKey}`
    },
    signal: AbortSignal.timeout(input.timeoutMs ?? 20_000)
  }, 'Model list');

  const bodyText = await response.text();
  const body = parseModelListJsonBody(bodyText);

  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`Model list API returned HTTP ${response.status}: ${errorMessage}`);
  }

  if (!Array.isArray(body?.data)) {
    throw new Error('Model list API response did not include a data array.');
  }

  return body.data.flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id) {
      return [];
    }
    const declaredCapabilities = readDeclaredModelCapabilities(item.capabilities);
    const classification = declaredCapabilities.length > 0
      ? {
          capabilities: declaredCapabilities,
          metadata: createModelCapabilityMetadata({
            source: 'provider',
            confidence: 'high',
            note: '供应商模型列表声明了能力。'
          })
        }
      : classifyModelCapabilitiesFromName(id, 'general');

    return [
      {
        id,
        label: id,
        ownedBy: typeof item.owned_by === 'string' ? item.owned_by : undefined,
        source: 'provider' as const,
        capabilities: classification.capabilities,
        capabilityMetadata: classification.metadata
      }
    ];
  });
}

async function fetchModelApi(endpoint: string, init: RequestInit, label: string): Promise<Response> {
  try {
    return await fetch(endpoint, init);
  } catch (error) {
    throw new Error(`${label} request failed: ${readFetchFailureMessage(error)}. Endpoint: ${endpoint}`);
  }
}

function readFetchFailureMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const causeMessage =
      cause instanceof Error
        ? `${cause.name}: ${cause.message}`
        : typeof cause === 'string'
          ? cause
          : '';
    return causeMessage
      ? `${error.name}: ${error.message}; cause: ${causeMessage}`
      : `${error.name}: ${error.message}`;
  }

  return String(error);
}

async function runOpenAiCompatibleModelTestChecks(
  request: DesktopModelTestRequest
): Promise<ModelTestCheck[]> {
  const capabilities = readModelProfileCapabilities(request.profile);
  const checks: ModelTestCheck[] = [];

  if (capabilities.includes('audio_to_text')) {
    checks.push(await runModelTestCheck({
      id: 'audio_probe',
      label: '语音转文字探测',
      capabilities: ['audio_to_text'],
      endpoint: `${normalizeApiBaseUrl(request.profile.apiBaseUrl) ?? ''}/models`,
      action: async () => {
        const catalog = await listOpenAiCompatibleModels({
          providerId: request.profile.providerId,
          providerName: request.profile.providerName,
          apiBaseUrl: request.profile.apiBaseUrl,
          apiKey: request.profile.apiKey ?? '',
          modelName: request.profile.modelName,
          capabilities,
          timeoutMs: request.timeoutMs ?? 20_000
        });
        return `API Key 可用，供应商返回/内置 ${catalog.models.length} 个模型。真实 ASR 需在任务中使用音频文件测试。`;
      }
    }));
    return checks;
  }

  if (hasAnyCapability(capabilities, ['image_generation', 'text_to_image'])) {
    checks.push(await runImageGenerationTestCheck(request));
  }

  if (hasAnyCapability(capabilities, ['image_to_image', 'image_editing'])) {
    checks.push(await runImageEditingTestCheck(request));
  }

  if (hasAnyCapability(capabilities, ['vision_text', 'image_understanding', 'vision_understanding'])) {
    checks.push(await runVisionUnderstandingTestCheck(request));
  }

  if (capabilities.includes('embedding')) {
    checks.push(await runEmbeddingTestCheck(request));
  }

  if (capabilities.includes('rerank')) {
    checks.push({
      id: 'rerank',
      label: '重排模型',
      status: 'skipped',
      message: '重排模型没有统一 OpenAI 兼容协议，需要按供应商适配器测试。'
    });
  }

  if (hasAnyCapability(capabilities, ['video_generation', 'text_to_video', 'image_to_video'])) {
    checks.push({
      id: 'video_generation',
      label: '视频生成',
      status: 'skipped',
      message: '视频生成通常是异步供应商协议，需要专门适配器；当前测试不会产生视频费用。',
      capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
      costWarning: true
    });
  }

  if (hasAnyCapability(capabilities, ['video_text', 'video_understanding'])) {
    checks.push({
      id: 'video_understanding',
      label: '视频理解',
      status: 'skipped',
      message: '视频理解需要真实视频样本和供应商专用输入协议，当前仅在工作流运行中测试。',
      capabilities: ['video_understanding', 'video_text']
    });
  }

  if (checks.length === 0 || capabilities.includes('text') || capabilities.includes('reasoning_text') || capabilities.includes('long_context')) {
    checks.push(await runTextChatTestCheck(request));
  }

  return checks;
}

async function runTextChatTestCheck(request: DesktopModelTestRequest): Promise<ModelTestCheck> {
  const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  return runModelTestCheck({
    id: 'text_chat',
    label: '文本对话',
    capabilities: ['text'],
    endpoint: `${apiBaseUrl}/chat/completions`,
    action: async () => {
      const profile = {
        ...request.profile,
        maxTokens: Math.min(request.profile.maxTokens ?? 256, 512)
      };
      const response = await invokeOpenAiCompatibleModelChat({
        profile,
        timeoutMs: request.timeoutMs ?? 20_000,
        messages: buildOpenAiCompatibleModelTestMessages(profile.capabilities)
      });
      return `返回文本正常：${response.provider}/${response.modelName}`;
    }
  });
}

async function runImageGenerationTestCheck(request: DesktopModelTestRequest): Promise<ModelTestCheck> {
  const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  return runModelTestCheck({
    id: 'image_generation',
    label: '文生图',
    capabilities: ['image_generation', 'text_to_image'],
    endpoint: `${apiBaseUrl}/images/generations`,
    costWarning: true,
    action: async () => {
      const response = await invokeOpenAiCompatibleModelChat({
        profile: request.profile,
        taskKind: 'image_generation',
        timeoutMs: Math.max(request.timeoutMs ?? imageGenerationTestTimeoutMs, imageGenerationTestTimeoutMs),
        imageGeneration: {
          prompt: 'Generate one minimal product icon on a plain white background. No text.',
          size: '1024x1024',
          responseFormat: 'url'
        },
        messages: [{ role: 'user', content: 'Generate one minimal product icon.' }]
      });
      const url = response.artifacts?.[0]?.remoteUrl;
      return url ? `返回图片 URL：${url}` : '返回图片结果正常。';
    }
  });
}

async function runImageEditingTestCheck(request: DesktopModelTestRequest): Promise<ModelTestCheck> {
  const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-model-image-edit-'));
  const imagePath = path.join(tempDir, 'source.png');
  writeFileSync(imagePath, lightweightPngBytes);

  try {
    return await runModelTestCheck({
      id: 'image_editing',
      label: '参考图编辑',
      capabilities: ['image_generation', 'image_to_image', 'image_editing'],
      endpoint: `${apiBaseUrl}/images/edits`,
      costWarning: true,
      action: async () => {
        const response = await invokeOpenAiCompatibleModelChat({
          profile: request.profile,
          taskKind: 'image_generation',
          timeoutMs: Math.max(request.timeoutMs ?? imageGenerationTestTimeoutMs, imageGenerationTestTimeoutMs),
          imageGeneration: {
            prompt: 'Keep the reference image simple and place it on a white ecommerce background.',
            sourceImagePath: imagePath,
            size: '1024x1024',
            responseFormat: 'url'
          },
          messages: [{ role: 'user', content: 'Edit the reference image.' }]
        });
        const url = response.artifacts?.[0]?.remoteUrl;
        return url ? `返回编辑图片 URL：${url}` : '返回参考图编辑结果正常。';
      }
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function runVisionUnderstandingTestCheck(request: DesktopModelTestRequest): Promise<ModelTestCheck> {
  const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  return runModelTestCheck({
    id: 'vision_understanding',
    label: '图片理解',
    capabilities: ['image_understanding', 'vision_understanding', 'vision_text'],
    endpoint: `${apiBaseUrl}/chat/completions`,
    action: async () => {
      const endpoint = `${apiBaseUrl}/chat/completions`;
      const response = await fetchModelApi(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${requireModelApiKey(request.profile.apiKey)}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: request.profile.modelName,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: '请用一句中文描述这张测试图。' },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/png;base64,${lightweightPngBytes.toString('base64')}`
                  }
                }
              ]
            }
          ],
          max_tokens: 128
        }),
        signal: AbortSignal.timeout(request.timeoutMs ?? 30_000)
      }, 'Vision understanding');
      const bodyText = await response.text();
      const body = parseJsonBody(bodyText);
      if (!response.ok) {
        throw new Error(readProviderErrorMessage(body) ?? bodyText.slice(0, 500));
      }
      const content = readAssistantContent(body);
      if (!content) {
        throw new Error('Vision model response did not include assistant content.');
      }
      return '图片输入返回文本正常。';
    }
  });
}

async function runEmbeddingTestCheck(request: DesktopModelTestRequest): Promise<ModelTestCheck> {
  const apiBaseUrl = requireOpenAiCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  return runModelTestCheck({
    id: 'embedding',
    label: '文本向量',
    capabilities: ['embedding'],
    endpoint: `${apiBaseUrl}/embeddings`,
    action: async () => {
      const endpoint = `${apiBaseUrl}/embeddings`;
      const response = await fetchModelApi(endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${requireModelApiKey(request.profile.apiKey)}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: request.profile.modelName,
          input: 'QiuAI WorkOS model test'
        }),
        signal: AbortSignal.timeout(request.timeoutMs ?? 20_000)
      }, 'Embedding');
      const bodyText = await response.text();
      const body = parseJsonObject(bodyText);
      if (!response.ok) {
        throw new Error(readProviderErrorMessage(body) ?? bodyText.slice(0, 500));
      }
      const firstEmbedding = readNestedUnknown(body, ['data', '0', 'embedding']);
      if (!Array.isArray(firstEmbedding)) {
        throw new Error('Embedding response did not include data[0].embedding.');
      }
      return `返回向量正常，维度 ${firstEmbedding.length}。`;
    }
  });
}

async function runModelTestCheck(input: {
  id: string;
  label: string;
  capabilities?: ModelCapability[];
  endpoint?: string;
  costWarning?: boolean;
  action: () => Promise<string>;
}): Promise<ModelTestCheck> {
  const startedAt = Date.now();
  try {
    const message = await input.action();
    return {
      id: input.id,
      label: input.label,
      status: 'passed',
      message,
      capabilities: input.capabilities,
      endpoint: input.endpoint,
      elapsedMs: Date.now() - startedAt,
      costWarning: input.costWarning
    };
  } catch (error) {
    return {
      id: input.id,
      label: input.label,
      status: 'failed',
      message: error instanceof Error ? error.message : 'unknown error',
      capabilities: input.capabilities,
      endpoint: input.endpoint,
      elapsedMs: Date.now() - startedAt,
      costWarning: input.costWarning
    };
  }
}

function listBuiltInCompatibleProviderModels(request: DesktopModelListRequest): ModelCatalogEntry[] {
  if (isGrsaiProvider(request)) {
    return [
      builtInModelCatalogEntry('gpt-image-2', 'gpt-image-2 / 文生图', ['image_generation', 'text_to_image']),
      builtInModelCatalogEntry('gpt-image-2-vip', 'gpt-image-2-vip / 高优先生图', ['image_generation', 'text_to_image']),
      builtInModelCatalogEntry('nano-banana', 'nano-banana / 生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-fast', 'nano-banana-fast / 快速生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-2', 'nano-banana-2 / 生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-2-cl', 'nano-banana-2-cl / 生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-2-2k-cl', 'nano-banana-2 2K / 生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-2-4k-cl', 'nano-banana-2 4K / 生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-pro', 'nano-banana-pro / 高质量生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('nano-banana-pro-vip', 'nano-banana-pro-vip / 高优先生图编辑', ['image_generation', 'text_to_image', 'image_to_image', 'image_editing']),
      builtInModelCatalogEntry('veo-3', 'veo-3 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('kling-2.1', 'kling-2.1 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('hailuo-2.3', 'hailuo-2.3 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('runway-gen-4', 'runway-gen-4 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('seedance-2.0', 'seedance-2.0 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('sora-2', 'sora-2 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('pika-2.2', 'pika-2.2 / 生视频', ['video_generation', 'text_to_video', 'image_to_video']),
      builtInModelCatalogEntry('wanx2.1-i2v-turbo', 'wanx2.1-i2v-turbo / 图生视频', ['video_generation', 'image_to_video']),
      builtInModelCatalogEntry('wanx2.1-t2v-turbo', 'wanx2.1-t2v-turbo / 文生视频', ['video_generation', 'text_to_video'])
    ];
  }

  return [];
}

function builtInModelCatalogEntry(
  id: string,
  label: string,
  capabilities: ModelCapability[]
): ModelCatalogEntry {
  return {
    id,
    label,
    source: 'built_in',
    capabilities,
    capabilityMetadata: createModelCapabilityMetadata({
      source: 'official_catalog',
      confidence: 'high',
      note: '来自 QiuAI 内置供应商模型目录。'
    })
  };
}

function mergeModelCatalogEntries(
  providerModels: ModelCatalogEntry[],
  builtInModels: ModelCatalogEntry[]
): ModelCatalogEntry[] {
  const merged = new Map<string, ModelCatalogEntry>();
  for (const model of builtInModels) {
    merged.set(model.id, model);
  }
  for (const model of providerModels) {
    merged.set(model.id, mergeProviderModelWithBuiltInModel(model, merged.get(model.id)));
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function mergeProviderModelWithBuiltInModel(
  providerModel: ModelCatalogEntry,
  builtInModel: ModelCatalogEntry | undefined
): ModelCatalogEntry {
  if (!builtInModel) {
    return providerModel;
  }

  const providerCapabilities = normalizeExplicitModelCapabilities(providerModel.capabilities);
  const providerHasReliableCapabilities =
    providerCapabilities.length > 0 &&
    providerModel.capabilityMetadata?.confidence !== 'unknown' &&
    providerModel.capabilityMetadata?.source !== 'name_inferred';

  if (providerHasReliableCapabilities) {
    return {
      ...builtInModel,
      ...providerModel,
      capabilities: providerCapabilities
    };
  }

  return {
    ...builtInModel,
    ...providerModel,
    label: providerModel.label ?? builtInModel.label,
    source: providerModel.source,
    capabilities: normalizeExplicitModelCapabilities(builtInModel.capabilities),
    capabilityMetadata: builtInModel.capabilityMetadata
  };
}

function readDeclaredModelCapabilities(value: unknown): ModelCapability[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeExplicitModelCapabilities(
    value.filter((item): item is ModelCapability => typeof item === 'string') as ModelCapability[]
  );
}

function hasAnyCapability(capabilities: ModelCapability[], candidates: ModelCapability[]): boolean {
  return candidates.some((capability) => capabilities.includes(capability));
}

function readVerifiedCapabilitiesFromChecks(checks: ModelTestCheck[]): ModelCapability[] {
  return normalizeExplicitModelCapabilities(
    checks
      .filter((check) => check.status === 'passed')
      .flatMap((check) => check.capabilities ?? [])
  );
}

function requireModelApiKey(value: string | undefined): string {
  const apiKey = value?.trim();
  if (!apiKey) {
    throw new Error('Model API Key is missing.');
  }
  return apiKey;
}

function isGrsaiProvider(request: {
  providerId?: string;
  providerName?: string;
  apiBaseUrl?: string;
}): boolean {
  const text = [request.providerId, request.providerName, request.apiBaseUrl]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return text.includes('grsai') || text.includes('grsaiapi.com') || text.includes('grsai.dakka.com.cn');
}

function buildAudioTranscriptionFormData(
  modelName: string,
  audioPath: string,
  options: DesktopModelChatRequest['audioTranscription']
): FormData {
  const form = new FormData();
  const audioBuffer = readFileSync(audioPath);
  const audioBytes = new Uint8Array(audioBuffer);
  const audioBlob = new Blob([audioBytes], { type: inferAudioMimeType(audioPath) });

  form.set('model', modelName);
  form.set('file', audioBlob, path.basename(audioPath));
  form.set('response_format', options?.responseFormat ?? 'json');
  if (options?.language?.trim()) {
    form.set('language', options.language.trim());
  }
  if (options?.dialect?.trim()) {
    form.set('dialect', options.dialect.trim());
  }
  if (options?.prompt?.trim()) {
    form.set('prompt', options.prompt.trim());
  }

  return form;
}

function buildOpenAiCompatibleModelTestMessages(
  capabilities: DesktopModelChatRequest['profile']['capabilities']
): DesktopModelChatRequest['messages'] {
  if (capabilities?.includes('audio_to_text')) {
    return [
      {
        role: 'system',
        content: 'You are a connection test assistant. Reply briefly in Chinese.'
      },
      {
        role: 'user',
        content: '请回复“连接正常”，并说明当前语音模型配置已可被 QiuAI WorkOS 识别。'
      }
    ];
  }

  return [
    {
      role: 'system',
      content: 'You are a connection test assistant. Reply briefly in Chinese.'
    },
    {
      role: 'user',
      content: '请回复“连接正常”，并说明当前模型可用于 QiuAI WorkOS 桌面端。'
    }
  ];
}

function buildImageGenerationPrompt(request: DesktopModelChatRequest): string {
  const directPrompt = request.imageGeneration?.prompt?.trim();
  const negativePrompt = request.imageGeneration?.negativePrompt?.trim();
  const prompt = directPrompt
    ?? request.messages.map((message) => message.content).filter(Boolean).join('\n\n').trim();
  if (!prompt) {
    throw new Error('Image generation prompt is missing.');
  }

  return negativePrompt
    ? `${prompt}\n\nNegative prompt:\n${negativePrompt}`
    : prompt;
}

function buildVideoGenerationPrompt(request: DesktopModelChatRequest): string {
  const directPrompt = request.videoGeneration?.prompt?.trim();
  const negativePrompt = request.videoGeneration?.negativePrompt?.trim();
  const prompt = directPrompt
    ?? request.messages.map((message) => message.content).filter(Boolean).join('\n\n').trim();
  if (!prompt) {
    throw new Error('Video generation prompt is missing.');
  }

  return negativePrompt
    ? `${prompt}\n\nNegative prompt:\n${negativePrompt}`
    : prompt;
}

type OpenAiCompatibleChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

type OpenAiCompatibleChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | OpenAiCompatibleChatContentPart[];
};

function buildOpenAiCompatibleChatMessagesWithVisionInputs(
  request: DesktopModelChatRequest
): OpenAiCompatibleChatMessage[] {
  const messages: OpenAiCompatibleChatMessage[] = request.messages.map((message) => ({
    role: message.role,
    content: message.content
  }));
  const imageParts = (request.visionInputs ?? [])
    .slice(0, 8)
    .flatMap((input) => {
      const imagePath = input.imagePath.trim();
      if (!imagePath || !existsSync(imagePath)) {
        return [];
      }

      const mimeType = input.mimeType?.trim() || inferImageMimeType(imagePath);
      const base64 = readFileSync(imagePath).toString('base64');
      return [
        {
          type: 'image_url' as const,
          image_url: {
            url: `data:${mimeType};base64,${base64}`
          }
        }
      ];
    });
  if (imageParts.length === 0) {
    return messages;
  }

  let lastUserIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'user') {
      lastUserIndex = index;
      break;
    }
  }
  if (lastUserIndex < 0) {
    return messages;
  }

  const currentMessage = messages[lastUserIndex]!;
  const text = typeof currentMessage.content === 'string'
    ? currentMessage.content
    : currentMessage.content
        .flatMap((part) => (part.type === 'text' ? [part.text] : []))
        .join('\n');
  messages[lastUserIndex] = {
    ...currentMessage,
    content: [
      { type: 'text', text },
      ...imageParts
    ]
  };

  return messages;
}

function buildImageEditFormData(
  modelName: string,
  prompt: string,
  sourceImagePath: string,
  size: string | undefined
): FormData {
  const form = new FormData();
  const sourceBuffer = readFileSync(sourceImagePath);
  const sourceBytes = new Uint8Array(sourceBuffer);
  const sourceBlob = new Blob([sourceBytes], { type: inferImageMimeType(sourceImagePath) });

  form.set('model', modelName);
  form.set('prompt', prompt);
  form.set('n', '1');
  form.set('response_format', 'url');
  if (size?.trim()) {
    form.set('size', size.trim());
  }
  form.set('image', sourceBlob, path.basename(sourceImagePath));

  return form;
}

function normalizeApiBaseUrl(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\/+$/, '');
  return normalized || undefined;
}

function requireOpenAiCompatibleApiBaseUrl(value: string | undefined): string {
  const apiBaseUrl = normalizeApiBaseUrl(value);
  if (!apiBaseUrl) {
    throw new Error('Model API Base URL is missing.');
  }

  return apiBaseUrl;
}

function parseJsonBody(bodyText: string): OpenAiCompatibleChatResponse | undefined {
  if (!bodyText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText) as OpenAiCompatibleChatResponse;
  } catch {
    return undefined;
  }
}

function parseModelListJsonBody(bodyText: string): OpenAiCompatibleModelListResponse | undefined {
  if (!bodyText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText) as OpenAiCompatibleModelListResponse;
  } catch {
    return undefined;
  }
}

function parseImageGenerationJsonBody(bodyText: string): OpenAiCompatibleImageResponse | undefined {
  if (!bodyText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText) as OpenAiCompatibleImageResponse;
  } catch {
    return undefined;
  }
}

function parseTranscriptionJsonBody(bodyText: string): OpenAiCompatibleTranscriptionResponse | undefined {
  if (!bodyText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(bodyText) as OpenAiCompatibleTranscriptionResponse;
  } catch {
    return undefined;
  }
}

function parseJsonObject(bodyText: string): Record<string, unknown> | undefined {
  if (!bodyText.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(bodyText) as unknown;
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function readNestedUnknown(record: Record<string, unknown> | undefined, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)];
      continue;
    }
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function readProviderErrorMessage(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }

  const error = (body as Record<string, unknown>).error;
  if (typeof error !== 'object' || error === null || Array.isArray(error)) {
    return undefined;
  }

  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' ? message : undefined;
}

function readTranscriptionText(body: OpenAiCompatibleTranscriptionResponse | undefined): string | undefined {
  for (const value of [body?.text, body?.result, body?.transcript]) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function readImageResponseUrl(body: OpenAiCompatibleImageResponse | undefined): string | undefined {
  const url = body?.data?.find((item) => typeof item.url === 'string' && item.url.trim())?.url;
  return typeof url === 'string' ? url.trim() : undefined;
}

function readVideoResponseUrl(body: OpenAiCompatibleImageResponse | undefined): string | undefined {
  const item = body?.data?.find((entry) =>
    (typeof entry.video_url === 'string' && entry.video_url.trim()) ||
    (typeof entry.url === 'string' && entry.url.trim())
  );
  const url = typeof item?.video_url === 'string' && item.video_url.trim()
    ? item.video_url
    : item?.url;
  return typeof url === 'string' ? url.trim() : undefined;
}

function readImageResponseBase64(body: OpenAiCompatibleImageResponse | undefined): string | undefined {
  const value = body?.data?.find((item) => typeof item.b64_json === 'string' && item.b64_json.trim())?.b64_json;
  return typeof value === 'string' ? value.trim() : undefined;
}

function buildImageGenerationResponse(input: {
  provider: string;
  modelName: string;
  remoteUrl: string;
  providerJobId?: string;
  providerStatus?: string;
  asyncMode?: boolean;
}): DesktopModelChatResponse {
  const content = JSON.stringify({
    remoteUrl: input.remoteUrl,
    providerJobId: input.providerJobId,
    providerStatus: input.providerStatus,
    asyncMode: input.asyncMode === true
  });
  return {
    provider: input.provider,
    modelName: input.modelName,
    content,
    artifacts: [
      {
        type: 'image',
        remoteUrl: input.remoteUrl,
        thumbnailPath: input.remoteUrl,
        providerJobId: input.providerJobId,
        providerStatus: input.providerStatus,
        metadata: {
          asyncMode: input.asyncMode === true
        }
      }
    ]
  };
}

function buildPendingImageGenerationResponse(input: {
  provider: string;
  modelName: string;
  providerJobId: string;
  providerStatus?: string;
}): DesktopModelChatResponse {
  const content = JSON.stringify({
    pending: true,
    providerJobId: input.providerJobId,
    providerStatus: input.providerStatus,
    asyncMode: true
  });
  return {
    provider: input.provider,
    modelName: input.modelName,
    content,
    artifacts: [
      {
        type: 'image',
        providerJobId: input.providerJobId,
        providerStatus: input.providerStatus,
        metadata: {
          asyncMode: true,
          pending: true
        }
      }
    ]
  };
}

function buildVideoGenerationResponse(input: {
  provider: string;
  modelName: string;
  remoteUrl: string;
  providerJobId?: string;
  providerStatus?: string;
  asyncMode?: boolean;
}): DesktopModelChatResponse {
  const content = JSON.stringify({
    remoteUrl: input.remoteUrl,
    videoUrl: input.remoteUrl,
    providerJobId: input.providerJobId,
    providerStatus: input.providerStatus,
    asyncMode: input.asyncMode === true
  });
  return {
    provider: input.provider,
    modelName: input.modelName,
    content,
    artifacts: [
      {
        type: 'video',
        remoteUrl: input.remoteUrl,
        thumbnailPath: input.remoteUrl,
        providerJobId: input.providerJobId,
        providerStatus: input.providerStatus,
        metadata: {
          asyncMode: input.asyncMode === true
        }
      }
    ]
  };
}

function readGrsaiJobId(body: Record<string, unknown> | undefined): string | undefined {
  return readStringFromUnknownPath(body, ['id'])
    ?? readStringFromUnknownPath(body, ['taskId'])
    ?? readStringFromUnknownPath(body, ['task_id'])
    ?? readStringFromUnknownPath(body, ['jobId'])
    ?? readStringFromUnknownPath(body, ['data', 'id'])
    ?? readStringFromUnknownPath(body, ['data', 'taskId'])
    ?? readStringFromUnknownPath(body, ['result', 'id']);
}

function readGrsaiJobStatus(body: Record<string, unknown> | undefined): string | undefined {
  return normalizeProviderStatus(
    readStringFromUnknownPath(body, ['status'])
    ?? readStringFromUnknownPath(body, ['state'])
    ?? readStringFromUnknownPath(body, ['data', 'status'])
    ?? readStringFromUnknownPath(body, ['data', 'state'])
    ?? readStringFromUnknownPath(body, ['result', 'status'])
    ?? readStringFromUnknownPath(body, ['output', 'status'])
  );
}

function readGrsaiErrorMessage(body: Record<string, unknown> | undefined): string | undefined {
  return readStringFromUnknownPath(body, ['message'])
    ?? readStringFromUnknownPath(body, ['error'])
    ?? readStringFromUnknownPath(body, ['errorMessage'])
    ?? readStringFromUnknownPath(body, ['data', 'message'])
    ?? readStringFromUnknownPath(body, ['result', 'message']);
}

function readImageUrlFromUnknown(value: unknown, depth = 0): string | undefined {
  if (depth > 6) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = readImageUrlFromUnknown(item, depth + 1);
      if (url) {
        return url;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of [
    'remoteUrl',
    'url',
    'imageUrl',
    'image_url',
    'videoUrl',
    'video_url',
    'outputUrl',
    'output_url',
    'thumbnailPath',
    'thumbnailUrl'
  ]) {
    const url = readImageUrlFromUnknown(record[key], depth + 1);
    if (url) {
      return url;
    }
  }

  for (const key of ['results', 'images', 'data', 'result', 'output', 'artifacts', 'artifact']) {
    const url = readImageUrlFromUnknown(record[key], depth + 1);
    if (url) {
      return url;
    }
  }

  return undefined;
}

function readVideoUrlFromUnknown(value: unknown, depth = 0): string | undefined {
  if (depth > 6) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const url = readVideoUrlFromUnknown(item, depth + 1);
      if (url) {
        return url;
      }
    }
    return undefined;
  }

  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of [
    'remoteUrl',
    'url',
    'videoUrl',
    'video_url',
    'outputUrl',
    'output_url',
    'fileUrl',
    'file_url'
  ]) {
    const url = readVideoUrlFromUnknown(record[key], depth + 1);
    if (url) {
      return url;
    }
  }

  const openAiUrl = readVideoResponseUrl(record as OpenAiCompatibleImageResponse);
  if (openAiUrl) {
    return openAiUrl;
  }

  for (const key of ['results', 'videos', 'data', 'result', 'output', 'artifacts', 'artifact']) {
    const url = readVideoUrlFromUnknown(record[key], depth + 1);
    if (url) {
      return url;
    }
  }

  return undefined;
}

function readStringFromUnknownPath(value: unknown, pathItems: string[]): string | undefined {
  const valueAtPath = typeof value === 'object' && value !== null
    ? readNestedUnknown(value as Record<string, unknown>, pathItems)
    : undefined;
  return typeof valueAtPath === 'string' && valueAtPath.trim() ? valueAtPath.trim() : undefined;
}

function normalizeProviderStatus(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

function isGrsaiPendingStatus(value: string | undefined): boolean {
  if (!value) {
    return true;
  }

  return ['pending', 'queued', 'running', 'processing', 'submitted', 'created', 'starting'].includes(value);
}

function isGrsaiFailedStatus(value: string | undefined): boolean {
  return Boolean(value && ['failed', 'error', 'cancelled', 'canceled', 'timeout', 'rejected'].includes(value));
}

function buildLocalImageDataUrl(filePath: string): string {
  return `data:${inferImageMimeType(filePath)};base64,${readFileSync(filePath).toString('base64')}`;
}

function inferImageAspectRatioFromSize(size: string | undefined): string | undefined {
  const match = size?.trim().match(/^(\d+)\s*x\s*(\d+)$/i);
  if (!match) {
    return undefined;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }

  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(Math.round(left));
  let b = Math.abs(Math.round(right));
  while (b > 0) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function sleep(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.max(0, delayMs));
  });
}

function inferImageMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/png';
}

function inferAudioMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.mp3') return 'audio/mpeg';
  if (extension === '.wav') return 'audio/wav';
  if (extension === '.m4a') return 'audio/mp4';
  if (extension === '.aac') return 'audio/aac';
  if (extension === '.ogg') return 'audio/ogg';
  if (extension === '.webm') return 'audio/webm';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

function readAssistantContent(body: OpenAiCompatibleChatResponse | undefined): string | undefined {
  const contentCandidates: unknown[] = [];
  for (const choice of body?.choices ?? []) {
    contentCandidates.push(choice.message?.content);
    contentCandidates.push(choice.message?.reasoning_content);
    contentCandidates.push(choice.delta?.content);
    contentCandidates.push(choice.text);
  }

  contentCandidates.push(body?.output_text);
  contentCandidates.push(body?.text);
  contentCandidates.push(readResponsesApiOutputText(body?.output));

  return contentCandidates.map(readTextFromModelContent).find((content): content is string => Boolean(content));
}

function readResponsesApiOutputText(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    return value.map(readResponsesApiOutputText).filter(Boolean).join('\n').trim() || undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const directText = readTextFromModelContent(record.text ?? record.content);
  if (directText) {
    return directText;
  }

  return readResponsesApiOutputText(record.output ?? record.message ?? record.data);
}

function readTextFromModelContent(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  if (Array.isArray(value)) {
    const text = value.map(readTextFromModelContent).filter(Boolean).join('\n').trim();
    return text || undefined;
  }

  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  for (const key of ['text', 'content', 'output_text', 'reasoning_content']) {
    const text = readTextFromModelContent(record[key]);
    if (text) {
      return text;
    }
  }

  return undefined;
}

function readTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}
