import type {
  DesktopModelListRequest,
  DesktopModelListResponse,
  DesktopModelChatRequest,
  DesktopModelChatResponse
} from '../shared/desktop-api.js';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { inferModelCapabilitiesFromName } from '../shared/desktop-model-capabilities.js';

interface OpenAiCompatibleChatResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
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
  }>;
  error?: {
    message?: unknown;
  };
}

interface OpenAiCompatibleImageResponse {
  data?: Array<{
    url?: unknown;
    b64_json?: unknown;
    revised_prompt?: unknown;
  }>;
  error?: {
    message?: unknown;
  };
}

const defaultTimeoutMs = 45_000;

export async function invokeOpenAiCompatibleModelChat(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse> {
  const apiBaseUrl = normalizeApiBaseUrl(request.profile.apiBaseUrl);
  const apiKey = request.profile.apiKey?.trim();
  const modelName = request.profile.modelName.trim();

  if (!apiBaseUrl) {
    throw new Error('Model API Base URL is missing.');
  }

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
    return invokeOpenAiCompatibleImageGeneration({
      request,
      apiBaseUrl,
      apiKey,
      modelName
    });
  }

  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages: request.messages,
      temperature: request.profile.temperature,
      max_tokens: request.profile.maxTokens
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? defaultTimeoutMs)
  });

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

  const response = sourceImagePath
    ? await fetch(`${input.apiBaseUrl}/images/edits`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.apiKey}`
        },
        body: buildImageEditFormData(input.modelName, prompt, sourceImagePath, input.request.imageGeneration?.size),
        signal: AbortSignal.timeout(timeoutMs)
      })
    : await fetch(`${input.apiBaseUrl}/images/generations`, {
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
      });
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

export async function listOpenAiCompatibleModels(
  request: DesktopModelListRequest
): Promise<DesktopModelListResponse> {
  const apiBaseUrl = normalizeApiBaseUrl(request.apiBaseUrl);
  const apiKey = request.apiKey?.trim();

  if (!apiBaseUrl) {
    throw new Error('Model API Base URL is missing.');
  }

  if (!apiKey) {
    throw new Error('Model API Key is missing.');
  }

  const response = await fetch(`${apiBaseUrl}/models`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(request.timeoutMs ?? 20_000)
  });

  const bodyText = await response.text();
  const body = parseModelListJsonBody(bodyText);

  if (!response.ok) {
    const errorMessage = readProviderErrorMessage(body) ?? bodyText.slice(0, 500);
    throw new Error(`Model list API returned HTTP ${response.status}: ${errorMessage}`);
  }

  if (!Array.isArray(body?.data)) {
    throw new Error('Model list API response did not include a data array.');
  }

  const models = body.data.flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id.trim() : '';
    if (!id) {
      return [];
    }

    return [
      {
        id,
        label: id,
        ownedBy: typeof item.owned_by === 'string' ? item.owned_by : undefined,
        capabilities: inferModelCapabilitiesFromName(id)
      }
    ];
  });

  return {
    providerId: request.providerId.trim(),
    providerName: request.providerName.trim(),
    apiBaseUrl,
    fetchedAt: new Date().toISOString(),
    models
  };
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

function readProviderErrorMessage(
  body: { error?: { message?: unknown } } | undefined
): string | undefined {
  return typeof body?.error?.message === 'string' ? body.error.message : undefined;
}

function readImageResponseUrl(body: OpenAiCompatibleImageResponse | undefined): string | undefined {
  const url = body?.data?.find((item) => typeof item.url === 'string' && item.url.trim())?.url;
  return typeof url === 'string' ? url.trim() : undefined;
}

function readImageResponseBase64(body: OpenAiCompatibleImageResponse | undefined): string | undefined {
  const value = body?.data?.find((item) => typeof item.b64_json === 'string' && item.b64_json.trim())?.b64_json;
  return typeof value === 'string' ? value.trim() : undefined;
}

function inferImageMimeType(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  return 'image/png';
}

function readAssistantContent(body: OpenAiCompatibleChatResponse | undefined): string | undefined {
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    const normalized = content.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  return undefined;
}

function readTokenCount(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : undefined;
}
