import { createHash, createHmac } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';

import type {
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopModelListRequest,
  DesktopModelListResponse,
  DesktopModelTestRequest,
  DesktopModelTestResponse
} from '../shared/desktop-api.js';
import type { ModelCapability, ModelCatalogEntry, ModelPurpose } from '../shared/desktop-contract.js';
import { inferModelCapabilitiesFromName } from '../shared/desktop-model-capabilities.js';

export type NativeProviderMode = 'openai_compatible' | 'aliyun_bailian' | 'tencent_cloud';

type JsonRecord = Record<string, unknown>;

const aliyunDefaultApiBaseUrl = 'https://dashscope.aliyuncs.com/api/v1';
const aliyunCompatibleDefaultApiBaseUrl = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
const tencentDefaultEndpoint = 'https://asr.tencentcloudapi.com?region=ap-shanghai';
const tencentAsrService = 'asr';
const tencentAsrVersion = '2019-06-14';
const tencentLocalAudioMaxBytes = 5 * 1024 * 1024;
const aliyunCompatibleLocalAudioMaxBytes = 10 * 1024 * 1024;

const aliyunNativeAsrModels = [
  modelCatalogEntry('qwen3-asr-flash', 'qwen3-asr-flash / 短音频转写'),
  modelCatalogEntry('qwen3-asr-flash-filetrans', 'qwen3-asr-flash-filetrans / 异步文件转写'),
  modelCatalogEntry('qwen-audio-3.0-asr-flash-filetrans', 'qwen-audio-3.0-asr-flash-filetrans / 异步文件转写'),
  modelCatalogEntry('fun-asr', 'fun-asr / 中文方言与噪声场景'),
  modelCatalogEntry('fun-asr-flash', 'fun-asr-flash / 快速中文语音识别'),
  modelCatalogEntry('fun-asr-mtl', 'fun-asr-mtl / 多语种语音识别'),
  modelCatalogEntry('paraformer-v2', 'paraformer-v2 / 中文语音识别')
];

const aliyunPlatformModels = [
  modelCatalogEntry('qwen-plus', 'Qwen Plus / 通用文本', 'general'),
  modelCatalogEntry('qwen-max', 'Qwen Max / 高质量推理', 'reasoning'),
  modelCatalogEntry('qwen-turbo', 'Qwen Turbo / 快速低成本', 'general'),
  modelCatalogEntry('qwen-long', 'Qwen Long / 长文档', 'document'),
  modelCatalogEntry('qwen2.5-72b-instruct', 'Qwen2.5 72B / 通用文本', 'general'),
  modelCatalogEntry('qwen2.5-32b-instruct', 'Qwen2.5 32B / 通用文本', 'general'),
  modelCatalogEntry('qwen2.5-14b-instruct', 'Qwen2.5 14B / 通用文本', 'general'),
  modelCatalogEntry('qwen2.5-7b-instruct', 'Qwen2.5 7B / 快速低成本', 'general'),
  modelCatalogEntry('qwen3-235b-a22b', 'Qwen3 235B A22B / 高质量推理', 'reasoning'),
  modelCatalogEntry('qwen3-32b', 'Qwen3 32B / 推理文本', 'reasoning'),
  modelCatalogEntry('qwen3-14b', 'Qwen3 14B / 通用推理', 'reasoning'),
  modelCatalogEntry('qwen3-8b', 'Qwen3 8B / 快速推理', 'reasoning'),
  modelCatalogEntry('qwen-vl-max', 'Qwen VL Max / 图片理解', 'vision'),
  modelCatalogEntry('qwen-vl-plus', 'Qwen VL Plus / 图片理解', 'vision'),
  modelCatalogEntry('qwen2.5-vl-72b-instruct', 'Qwen2.5 VL 72B / 图片理解', 'vision'),
  modelCatalogEntry('qwen2.5-vl-32b-instruct', 'Qwen2.5 VL 32B / 图片理解', 'vision'),
  modelCatalogEntry('qwen2.5-vl-7b-instruct', 'Qwen2.5 VL 7B / 图片理解', 'vision'),
  modelCatalogEntry('text-embedding-v4', 'Text Embedding V4 / 文本向量', 'embeddings'),
  modelCatalogEntry('text-embedding-v3', 'Text Embedding V3 / 文本向量', 'embeddings'),
  modelCatalogEntry('gte-rerank-v2', 'GTE Rerank V2 / 重排', 'general'),
  modelCatalogEntry('wanx2.1-t2i-turbo', '通义万相 2.1 Turbo / 文生图', 'vision'),
  modelCatalogEntry('wanx2.1-t2i-plus', '通义万相 2.1 Plus / 文生图', 'vision'),
  modelCatalogEntry('wanx2.1-i2v-turbo', '通义万相 2.1 / 图生视频', 'vision'),
  ...aliyunNativeAsrModels
];

const tencentNativeAsrModels = [
  modelCatalogEntry('16k_zh', '16k_zh / 中文普通话'),
  modelCatalogEntry('16k_zh_en', '16k_zh_en / 中英混合'),
  modelCatalogEntry('16k_zh_en_2.0', '16k_zh_en_2.0 / 中英及多方言'),
  modelCatalogEntry('16k_zh_dialect', '16k_zh_dialect / 中文多方言'),
  modelCatalogEntry('16k_zh_medical', '16k_zh_medical / 中文医疗'),
  modelCatalogEntry('16k_yue', '16k_yue / 粤语'),
  modelCatalogEntry('16k_en', '16k_en / 英语')
];

export function detectModelProviderMode(input: {
  providerId?: string;
  providerName?: string;
  modelName?: string;
  capabilities?: string[];
  taskKind?: string;
}): NativeProviderMode {
  const providerId = normalizeComparable(input.providerId);
  const providerName = normalizeComparable(input.providerName);
  const modelName = normalizeComparable(input.modelName);
  const capabilities = input.capabilities ?? [];
  const isAudioTask = input.taskKind === 'audio_transcription' || capabilities.includes('audio_to_text');

  if (isAudioTask && isTencentPlatformProvider(providerId, providerName)) {
    return 'tencent_cloud';
  }

  if (isAliyunNativeAsrModel(modelName) || (isAudioTask && isAliyunPlatformProvider(providerId, providerName))) {
    return 'aliyun_bailian';
  }

  return 'openai_compatible';
}

export async function invokeNativeAudioTranscription(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse | undefined> {
  const mode = detectModelProviderMode({
    providerId: request.profile.providerId,
    providerName: request.profile.providerName,
    modelName: request.profile.modelName,
    capabilities: request.profile.capabilities,
    taskKind: request.taskKind
  });

  if (mode === 'aliyun_bailian') {
    if (isAliyunCompatibleAudioTranscriptionModel(request.profile.modelName)) {
      return invokeAliyunCompatibleAudioTranscription(request);
    }

    if (isAliyunAsyncAudioTranscriptionModel(request.profile.modelName)) {
      return invokeAliyunBailianAudioTranscription(request);
    }

    return undefined;
  }

  if (mode === 'tencent_cloud') {
    return invokeTencentCloudAudioTranscription(request);
  }

  return undefined;
}

export async function listNativeProviderModels(
  request: DesktopModelListRequest
): Promise<DesktopModelListResponse | undefined> {
  if (isAliyunPlatformProvider(request.providerId, request.providerName, request.apiBaseUrl)) {
    await probeAliyunBailianConnection({
      apiBaseUrl: request.apiBaseUrl,
      apiKey: request.apiKey,
      timeoutMs: request.timeoutMs
    });
    const providerModels = await listAliyunCompatibleProviderModels(request).catch(() => []);
    return {
      providerId: request.providerId.trim(),
      providerName: request.providerName.trim(),
      apiBaseUrl: request.apiBaseUrl?.trim() || aliyunCompatibleDefaultApiBaseUrl,
      fetchedAt: new Date().toISOString(),
      models: mergeModelCatalogEntries(providerModels, aliyunPlatformModels)
    };
  }

  const mode = detectModelProviderMode({
    providerId: request.providerId,
    providerName: request.providerName,
    modelName: request.modelName,
    capabilities: request.capabilities
  });

  if (mode === 'aliyun_bailian') {
    await probeAliyunBailianConnection({
      apiBaseUrl: request.apiBaseUrl,
      apiKey: request.apiKey,
      timeoutMs: request.timeoutMs
    });
    return {
      providerId: request.providerId.trim(),
      providerName: request.providerName.trim(),
      apiBaseUrl: request.apiBaseUrl?.trim() || normalizeAliyunApiBaseUrl(request.apiBaseUrl),
      fetchedAt: new Date().toISOString(),
      models: aliyunNativeAsrModels
    };
  }

  if (mode === 'tencent_cloud') {
    await probeTencentCloudConnection({
      apiBaseUrl: request.apiBaseUrl,
      apiKey: request.apiKey,
      timeoutMs: request.timeoutMs
    });
    return {
      providerId: request.providerId.trim(),
      providerName: request.providerName.trim(),
      apiBaseUrl: normalizeTencentApiBaseUrl(request.apiBaseUrl).raw,
      fetchedAt: new Date().toISOString(),
      models: tencentNativeAsrModels
    };
  }

  return undefined;
}

export async function testNativeModelConnection(
  request: DesktopModelTestRequest
): Promise<DesktopModelTestResponse | undefined> {
  const mode = detectModelProviderMode({
    providerId: request.profile.providerId,
    providerName: request.profile.providerName,
    modelName: request.profile.modelName,
    capabilities: request.profile.capabilities
  });

  if (mode === 'aliyun_bailian') {
    await probeAliyunBailianConnection({
      apiBaseUrl: request.profile.apiBaseUrl,
      apiKey: request.profile.apiKey,
      timeoutMs: request.timeoutMs
    });
    return {
      providerId: request.profile.providerId,
      providerName: request.profile.providerName,
      modelName: request.profile.modelName,
      ok: true,
      checkedAt: new Date().toISOString(),
      mode,
      message: '阿里云百炼 API Key 和任务查询端点可访问；Fun-ASR 异步转写将在运行时提交真实文件 URL。'
    };
  }

  if (mode === 'tencent_cloud') {
    await probeTencentCloudConnection({
      apiBaseUrl: request.profile.apiBaseUrl,
      apiKey: request.profile.apiKey,
      timeoutMs: request.timeoutMs
    });
    return {
      providerId: request.profile.providerId,
      providerName: request.profile.providerName,
      modelName: request.profile.modelName,
      ok: true,
      checkedAt: new Date().toISOString(),
      mode,
      message: '腾讯云 SecretId/SecretKey 签名和鉴权可用；运行时会按原生录音文件识别接口提交任务。'
    };
  }

  return undefined;
}

async function invokeAliyunBailianAudioTranscription(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse> {
  const apiKey = requireText(request.profile.apiKey, '阿里云百炼 API Key is missing.');
  const modelName = requireText(request.profile.modelName, '阿里云百炼模型名称不能为空。');
  const fileUrl = resolveRemoteAudioUrl(request);
  if (!fileUrl) {
    throw new Error(
      '阿里云 Fun-ASR 异步转写需要可访问的 http/https/oss 文件 URL。当前只有本地路径，不能直接提交给百炼；请先把音视频上传到 OSS/COS/可访问 URL，或改用支持本地小文件上传的供应商。'
    );
  }

  const apiBaseUrl = normalizeAliyunApiBaseUrl(request.profile.apiBaseUrl);
  const submitBody = buildAliyunTranscriptionSubmitBody(modelName, fileUrl, request);
  const submitResponse = await fetch(`${apiBaseUrl}/services/audio/asr/transcription`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
      'x-dashscope-async': 'enable',
      ...(fileUrl.startsWith('oss://') ? { 'x-dashscope-ossresource-resolve': 'enable' } : {})
    },
    body: JSON.stringify(submitBody),
    signal: AbortSignal.timeout(request.timeoutMs ?? 180_000)
  });
  const submitBodyText = await submitResponse.text();
  const submitJson = parseJsonObject(submitBodyText);
  if (!submitResponse.ok) {
    throw new Error(
      `阿里云百炼 ASR 提交失败 HTTP ${submitResponse.status}: ${readProviderMessage(submitJson) ?? submitBodyText.slice(0, 500)}`
    );
  }

  const taskId = readNestedString(submitJson, ['output', 'task_id']) ?? readNestedString(submitJson, ['task_id']);
  if (!taskId) {
    throw new Error('阿里云百炼 ASR 提交响应没有返回 task_id。');
  }

  const taskResult = await pollAliyunTask({
    apiBaseUrl,
    apiKey,
    taskId,
    timeoutMs: request.timeoutMs ?? 180_000
  });
  const transcriptUrl = readAliyunTranscriptionUrl(taskResult);
  const transcript = transcriptUrl
    ? await fetchAliyunTranscriptionResult(transcriptUrl, request.timeoutMs ?? 180_000)
    : readTranscriptText(taskResult);

  if (!transcript) {
    throw new Error('阿里云百炼 ASR 任务已完成，但没有解析到转写文本。');
  }

  return {
    provider: request.profile.providerName,
    modelName,
    content: transcript
  };
}

async function invokeAliyunCompatibleAudioTranscription(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse> {
  const apiKey = requireText(request.profile.apiKey, '阿里云百炼 API Key is missing.');
  const modelName = requireText(request.profile.modelName, '阿里云百炼模型名称不能为空。');
  const inputAudio = resolveAliyunCompatibleInputAudio(request);
  const apiBaseUrl = normalizeAliyunCompatibleApiBaseUrl(request.profile.apiBaseUrl);
  const response = await fetch(`${apiBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'input_audio',
              input_audio: {
                data: inputAudio
              }
            }
          ]
        }
      ],
      stream: false,
      asr_options: buildAliyunCompatibleAsrOptions(request)
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 180_000)
  });
  const bodyText = await response.text();
  const body = parseJsonObject(bodyText);

  if (!response.ok) {
    throw new Error(
      `阿里云百炼 Qwen-ASR 转写失败 HTTP ${response.status}: ${readProviderMessage(body) ?? bodyText.slice(0, 500)}`
    );
  }

  const transcript = readChatCompletionContent(body) ?? readTranscriptText(body) ?? bodyText.trim();
  if (!transcript) {
    throw new Error('阿里云百炼 Qwen-ASR 响应没有返回转写文本。');
  }

  return {
    provider: request.profile.providerName,
    modelName,
    content: transcript
  };
}

async function invokeTencentCloudAudioTranscription(
  request: DesktopModelChatRequest
): Promise<DesktopModelChatResponse> {
  const modelName = requireText(request.profile.modelName, '腾讯云 ASR EngineModelType 不能为空。');
  const source = buildTencentRecTaskSource(request);
  const payload: JsonRecord = {
    EngineModelType: modelName,
    ChannelNum: 1,
    ResTextFormat: 0,
    SourceType: source.sourceType,
    ...source.payload
  };

  const createResponse = await invokeTencentCloudAction({
    apiBaseUrl: request.profile.apiBaseUrl,
    apiKey: request.profile.apiKey,
    action: 'CreateRecTask',
    payload,
    timeoutMs: request.timeoutMs
  });
  const taskId = readTencentTaskId(createResponse);
  if (!taskId) {
    throw new Error('腾讯云 ASR 创建任务响应没有返回 TaskId。');
  }

  const taskResult = await pollTencentTask({
    apiBaseUrl: request.profile.apiBaseUrl,
    apiKey: request.profile.apiKey,
    taskId,
    timeoutMs: request.timeoutMs ?? 180_000
  });
  const transcript = readTencentTranscript(taskResult);
  if (!transcript) {
    throw new Error('腾讯云 ASR 任务已完成，但没有解析到转写文本。');
  }

  return {
    provider: request.profile.providerName,
    modelName,
    content: transcript
  };
}

async function probeAliyunBailianConnection(input: {
  apiBaseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<void> {
  const apiKey = requireText(input.apiKey, '阿里云百炼 API Key is missing.');
  const apiBaseUrl = normalizeAliyunApiBaseUrl(input.apiBaseUrl);
  const response = await fetch(`${apiBaseUrl}/tasks/qiuai-connection-test`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${apiKey}`
    },
    signal: AbortSignal.timeout(input.timeoutMs ?? 15_000)
  });
  const bodyText = await response.text();
  const body = parseJsonObject(bodyText);
  const message = readProviderMessage(body) ?? bodyText.slice(0, 500);

  if (response.status === 401 || response.status === 403 || /api[-_ ]?key|unauthorized|forbidden/i.test(message)) {
    throw new Error(`阿里云百炼鉴权失败：${message || `HTTP ${response.status}`}`);
  }
}

async function probeTencentCloudConnection(input: {
  apiBaseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}): Promise<void> {
  const response = await invokeTencentCloudActionRaw({
    apiBaseUrl: input.apiBaseUrl,
    apiKey: input.apiKey,
    action: 'DescribeTaskStatus',
    payload: { TaskId: 1 },
    timeoutMs: input.timeoutMs
  });
  const error = readTencentResponseError(response.body);
  if (error && isTencentAuthError(error.code)) {
    throw new Error(`腾讯云鉴权失败：${error.code} ${error.message}`);
  }
}

async function listAliyunCompatibleProviderModels(
  request: DesktopModelListRequest
): Promise<ModelCatalogEntry[]> {
  const apiBaseUrl = normalizeAliyunCompatibleApiBaseUrl(request.apiBaseUrl);
  const response = await fetch(`${apiBaseUrl}/models`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${requireText(request.apiKey, 'Aliyun Bailian API Key is missing.')}`
    },
    signal: AbortSignal.timeout(Math.min(request.timeoutMs ?? 20_000, 20_000))
  });

  const bodyText = await response.text();
  const body = parseJsonObject(bodyText);
  if (!response.ok || !Array.isArray(body?.data)) {
    return [];
  }

  return body.data.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const id = readString(item.id);
    if (!id) {
      return [];
    }

    return [{
      id,
      label: id,
      ownedBy: readString(item.owned_by),
      source: 'provider' as const,
      capabilities: inferModelCapabilitiesFromName(id)
    }];
  });
}

async function pollAliyunTask(input: {
  apiBaseUrl: string;
  apiKey: string;
  taskId: string;
  timeoutMs: number;
}): Promise<JsonRecord> {
  const startedAt = Date.now();
  let lastBody: JsonRecord | undefined;

  while (Date.now() - startedAt < input.timeoutMs) {
    const response = await fetch(`${input.apiBaseUrl}/tasks/${encodeURIComponent(input.taskId)}`, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${input.apiKey}`
      },
      signal: AbortSignal.timeout(Math.min(input.timeoutMs, 20_000))
    });
    const bodyText = await response.text();
    const body = parseJsonObject(bodyText);
    lastBody = body;

    if (!response.ok) {
      throw new Error(
        `阿里云百炼 ASR 任务查询失败 HTTP ${response.status}: ${readProviderMessage(body) ?? bodyText.slice(0, 500)}`
      );
    }

    const status = (
      readNestedString(body, ['output', 'task_status']) ??
      readNestedString(body, ['task_status']) ??
      ''
    ).toUpperCase();
    if (status === 'SUCCEEDED') {
      if (!body) {
        throw new Error('阿里云百炼 ASR 任务查询响应为空。');
      }
      return body;
    }
    if (status === 'FAILED' || status === 'CANCELED' || status === 'UNKNOWN') {
      throw new Error(`阿里云百炼 ASR 任务失败：${readProviderMessage(body) ?? status}`);
    }

    await sleep(2000);
  }

  throw new Error(`阿里云百炼 ASR 任务等待超时：${readProviderMessage(lastBody) ?? input.taskId}`);
}

async function fetchAliyunTranscriptionResult(url: string, timeoutMs: number): Promise<string | undefined> {
  const response = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(Math.min(timeoutMs, 60_000))
  });
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`阿里云百炼 ASR 结果下载失败 HTTP ${response.status}: ${bodyText.slice(0, 500)}`);
  }

  const body = parseJsonObject(bodyText);
  return readTranscriptText(body) ?? bodyText.trim();
}

async function pollTencentTask(input: {
  apiBaseUrl?: string;
  apiKey?: string;
  taskId: number;
  timeoutMs: number;
}): Promise<JsonRecord> {
  const startedAt = Date.now();
  let lastBody: JsonRecord | undefined;

  while (Date.now() - startedAt < input.timeoutMs) {
    const response = await invokeTencentCloudAction({
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      action: 'DescribeTaskStatus',
      payload: { TaskId: input.taskId },
      timeoutMs: Math.min(input.timeoutMs, 20_000)
    });
    lastBody = response;
    const data = readTencentTaskData(response);
    const status = readNumber(data?.Status);
    const statusText = readString(data?.StatusStr)?.toLowerCase() ?? '';

    if (status === 2 || statusText.includes('success')) {
      return response;
    }
    if (status === 3 || statusText.includes('fail')) {
      throw new Error(`腾讯云 ASR 任务失败：${readString(data?.ErrorMsg) ?? statusText}`);
    }

    await sleep(2000);
  }

  throw new Error(`腾讯云 ASR 任务等待超时：TaskId ${input.taskId}${lastBody ? '' : ' 未返回状态'}`);
}

async function invokeTencentCloudAction(input: {
  apiBaseUrl?: string;
  apiKey?: string;
  action: string;
  payload: JsonRecord;
  timeoutMs?: number;
}): Promise<JsonRecord> {
  const response = await invokeTencentCloudActionRaw(input);
  const error = readTencentResponseError(response.body);
  if (error) {
    throw new Error(`腾讯云 ${input.action} 失败：${error.code} ${error.message}`);
  }

  if (!response.ok) {
    throw new Error(`腾讯云 ${input.action} 返回 HTTP ${response.status}: ${JSON.stringify(response.body).slice(0, 500)}`);
  }

  return response.body;
}

async function invokeTencentCloudActionRaw(input: {
  apiBaseUrl?: string;
  apiKey?: string;
  action: string;
  payload: JsonRecord;
  timeoutMs?: number;
}): Promise<{ ok: boolean; status: number; body: JsonRecord }> {
  const credentials = parseTencentCredentials(input.apiKey);
  const endpoint = normalizeTencentApiBaseUrl(input.apiBaseUrl);
  const payloadText = JSON.stringify(input.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const hashedPayload = sha256Hex(payloadText);
  const canonicalHeaders = [
    'content-type:application/json; charset=utf-8',
    `host:${endpoint.host}`,
    `x-tc-action:${input.action.toLowerCase()}`
  ].join('\n') + '\n';
  const signedHeaders = 'content-type;host;x-tc-action';
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    hashedPayload
  ].join('\n');
  const credentialScope = `${date}/${tencentAsrService}/tc3_request`;
  const stringToSign = [
    'TC3-HMAC-SHA256',
    String(timestamp),
    credentialScope,
    sha256Hex(canonicalRequest)
  ].join('\n');
  const signingKey = hmac(
    hmac(hmac(`TC3${credentials.secretKey}`, date), tencentAsrService),
    'tc3_request'
  );
  const signature = hmacHex(signingKey, stringToSign);
  const authorization = [
    `TC3-HMAC-SHA256 Credential=${credentials.secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`
  ].join(', ');

  const response = await fetch(endpoint.url, {
    method: 'POST',
    headers: {
      authorization,
      'content-type': 'application/json; charset=utf-8',
      host: endpoint.host,
      'x-tc-action': input.action,
      'x-tc-region': endpoint.region,
      'x-tc-timestamp': String(timestamp),
      'x-tc-version': tencentAsrVersion,
      ...(credentials.token ? { 'x-tc-token': credentials.token } : {})
    },
    body: payloadText,
    signal: AbortSignal.timeout(input.timeoutMs ?? 20_000)
  });
  const bodyText = await response.text();
  const body = parseJsonObject(bodyText) ?? {};
  return { ok: response.ok, status: response.status, body };
}

function buildAliyunTranscriptionSubmitBody(
  modelName: string,
  fileUrl: string,
  request: DesktopModelChatRequest
): JsonRecord {
  const language = request.audioTranscription?.language?.trim();
  const dialect = request.audioTranscription?.dialect?.trim();
  const prompt = request.audioTranscription?.prompt?.trim();
  const parameters: JsonRecord = {};

  if (language && language !== 'auto') {
    parameters.language_hints = [language];
  }
  if (dialect && dialect !== 'auto') {
    parameters.dialect = dialect;
  }
  if (prompt) {
    parameters.hot_words = [{ text: prompt, weight: 4 }];
  }

  if (modelName.toLowerCase().includes('filetrans')) {
    return {
      model: modelName,
      input: {
        file_url: fileUrl
      },
      parameters
    };
  }

  return {
    model: modelName,
    input: {
      file_urls: [fileUrl]
    },
    parameters
  };
}

function buildTencentRecTaskSource(request: DesktopModelChatRequest): {
  sourceType: 0 | 1;
  payload: JsonRecord;
} {
  const remoteUrl = resolveRemoteAudioUrl(request);
  if (remoteUrl) {
    return {
      sourceType: 0,
      payload: {
        Url: remoteUrl
      }
    };
  }

  const audioPath = request.audioTranscription?.audioPath?.trim();
  if (!audioPath) {
    throw new Error('腾讯云 ASR 需要音频/视频本地路径或可访问 URL。');
  }
  if (!existsSync(audioPath)) {
    throw new Error(`音频/视频文件不存在：${audioPath}`);
  }

  const size = statSync(audioPath).size;
  if (size > tencentLocalAudioMaxBytes) {
    throw new Error('腾讯云 ASR 本地文件直传限制为 5MB。当前文件较大，请先上传到 COS/可访问 URL 后再转写。');
  }

  return {
    sourceType: 1,
    payload: {
      Data: readFileSync(audioPath).toString('base64'),
      DataLen: size
    }
  };
}

function resolveRemoteAudioUrl(request: DesktopModelChatRequest): string | undefined {
  const value = request.audioTranscription?.audioUrl?.trim() || request.audioTranscription?.audioPath?.trim();
  if (!value) {
    return undefined;
  }

  return /^(https?:\/\/|oss:\/\/)/i.test(value) ? value : undefined;
}

function resolveAliyunCompatibleInputAudio(request: DesktopModelChatRequest): string {
  const remoteUrl = resolveRemoteAudioUrl(request);
  if (remoteUrl) {
    return remoteUrl;
  }

  const audioPath = request.audioTranscription?.audioPath?.trim();
  if (!audioPath) {
    throw new Error('阿里云百炼 Qwen-ASR 需要音频本地路径或可访问 URL。');
  }
  if (!existsSync(audioPath)) {
    throw new Error(`音频文件不存在：${audioPath}`);
  }

  const size = statSync(audioPath).size;
  if (size > aliyunCompatibleLocalAudioMaxBytes) {
    throw new Error('阿里云百炼 qwen3-asr-flash 本地直传限制为 10MB。当前文件较大，请改用文件转写模型并提供可访问 URL。');
  }

  return `data:${inferAliyunCompatibleAudioMimeType(audioPath)};base64,${readFileSync(audioPath).toString('base64')}`;
}

function buildAliyunCompatibleAsrOptions(request: DesktopModelChatRequest): JsonRecord {
  const language = request.audioTranscription?.language?.trim();
  const dialect = request.audioTranscription?.dialect?.trim();
  const options: JsonRecord = { enable_itn: false };
  const resolvedLanguage =
    dialect === 'cantonese'
      ? 'yue'
      : language && language !== 'auto'
        ? language
        : undefined;

  if (resolvedLanguage) {
    options.language = resolvedLanguage;
  }

  return options;
}

function normalizeAliyunApiBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return aliyunDefaultApiBaseUrl;
  }

  if (trimmed.includes('/compatible-mode/v1')) {
    return `${new URL(trimmed).origin}/api/v1`;
  }

  if (trimmed.endsWith('/api/v1')) {
    return trimmed;
  }

  return `${trimmed}/api/v1`;
}

function normalizeAliyunCompatibleApiBaseUrl(value: string | undefined): string {
  const trimmed = value?.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return aliyunCompatibleDefaultApiBaseUrl;
  }

  if (trimmed.endsWith('/compatible-mode/v1')) {
    return trimmed;
  }

  if (trimmed.endsWith('/api/v1')) {
    return `${new URL(trimmed).origin}/compatible-mode/v1`;
  }

  return `${trimmed}/compatible-mode/v1`;
}

function normalizeTencentApiBaseUrl(value: string | undefined): {
  raw: string;
  url: string;
  host: string;
  region: string;
} {
  const raw = value?.trim() || tencentDefaultEndpoint;
  const parsed = new URL(raw);
  const region = parsed.searchParams.get('region')?.trim() || 'ap-shanghai';
  parsed.search = '';
  parsed.pathname = '/';

  return {
    raw,
    url: parsed.toString(),
    host: parsed.host,
    region
  };
}

function parseTencentCredentials(value: string | undefined): {
  secretId: string;
  secretKey: string;
  token?: string;
} {
  const apiKey = requireText(value, '腾讯云 SecretId/SecretKey is missing.');
  if (apiKey.startsWith('{')) {
    const parsed = JSON.parse(apiKey) as JsonRecord;
    return {
      secretId: requireText(readString(parsed.secretId ?? parsed.SecretId), '腾讯云 SecretId is missing.'),
      secretKey: requireText(readString(parsed.secretKey ?? parsed.SecretKey), '腾讯云 SecretKey is missing.'),
      token: readString(parsed.token ?? parsed.Token)
    };
  }

  const separator = apiKey.includes('|') ? '|' : ':';
  const index = apiKey.indexOf(separator);
  if (index < 1) {
    throw new Error('腾讯云 API Key 请按 SecretId:SecretKey 填写，或填写 JSON：{"secretId":"...","secretKey":"..."}。');
  }

  return {
    secretId: apiKey.slice(0, index).trim(),
    secretKey: apiKey.slice(index + 1).trim()
  };
}

function readAliyunTranscriptionUrl(body: JsonRecord): string | undefined {
  const direct =
    readNestedString(body, ['output', 'results', '0', 'transcription_url']) ??
    readNestedString(body, ['output', 'result', 'transcription_url']) ??
    readNestedString(body, ['results', '0', 'transcription_url']) ??
    readNestedString(body, ['transcription_url']);
  if (direct) {
    return direct;
  }

  const results = readNestedArray(body, ['output', 'results']) ?? readNestedArray(body, ['results']);
  for (const item of results ?? []) {
    const url = isRecord(item) ? readString(item.transcription_url) : undefined;
    if (url) return url;
  }

  return undefined;
}

function readTencentTaskId(body: JsonRecord): number | undefined {
  return (
    readNumber(readNestedUnknown(body, ['Response', 'Data', 'TaskId'])) ??
    readNumber(readNestedUnknown(body, ['Response', 'TaskId'])) ??
    readNumber(readNestedUnknown(body, ['TaskId']))
  );
}

function readTencentTaskData(body: JsonRecord): JsonRecord | undefined {
  const data =
    readNestedUnknown(body, ['Response', 'Data']) ??
    readNestedUnknown(body, ['Response']) ??
    body;
  return isRecord(data) ? data : undefined;
}

function readTencentTranscript(body: JsonRecord): string | undefined {
  const data = readTencentTaskData(body);
  const details = Array.isArray(data?.ResultDetail) ? data.ResultDetail : [];
  const sentences = details.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }
    return readString(item.FinalSentence) ?? readString(item.Sentence) ?? readString(item.Text) ?? [];
  });
  const text = sentences.join('\n').trim();
  if (text) {
    return text;
  }

  const direct = readString(data?.Result);
  return direct?.trim() || readTranscriptText(body);
}

function readTencentResponseError(body: JsonRecord): { code: string; message: string } | undefined {
  const error = readNestedUnknown(body, ['Response', 'Error']);
  if (!isRecord(error)) {
    return undefined;
  }

  return {
    code: readString(error.Code) ?? 'UNKNOWN',
    message: readString(error.Message) ?? ''
  };
}

function isTencentAuthError(code: string): boolean {
  return /auth|unauthorized|secret|signature|token/i.test(code);
}

function readProviderMessage(body: JsonRecord | undefined): string | undefined {
  if (!body) return undefined;
  return (
    readNestedString(body, ['message']) ??
    readNestedString(body, ['Message']) ??
    readNestedString(body, ['error', 'message']) ??
    readNestedString(body, ['output', 'message']) ??
    readNestedString(body, ['code'])
  );
}

function readTranscriptText(value: unknown): string | undefined {
  const directKeys = ['text', 'transcript', 'sentence', 'FinalSentence', 'Sentence', 'Result'];
  if (typeof value === 'string') {
    const text = value.trim();
    return text || undefined;
  }

  if (Array.isArray(value)) {
    const text = value.map(readTranscriptText).filter(Boolean).join('\n').trim();
    return text || undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of directKeys) {
    const item = value[key];
    if (typeof item === 'string' && item.trim()) {
      return item.trim();
    }
  }

  for (const key of ['transcripts', 'sentences', 'sentence_list', 'paragraphs', 'ResultDetail', 'results']) {
    const item = value[key];
    const text = readTranscriptText(item);
    if (text) {
      return text;
    }
  }

  return undefined;
}

function readChatCompletionContent(body: JsonRecord | undefined): string | undefined {
  const choices = Array.isArray(body?.choices) ? body.choices : [];
  for (const choice of choices) {
    if (!isRecord(choice)) {
      continue;
    }
    const message = isRecord(choice.message) ? choice.message : undefined;
    const content = readString(message?.content);
    if (content) {
      return content;
    }
  }

  return undefined;
}

function parseJsonObject(value: string): JsonRecord | undefined {
  if (!value.trim()) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function readNestedString(record: JsonRecord | undefined, path: string[]): string | undefined {
  const value = readNestedUnknown(record, path);
  return readString(value);
}

function readNestedArray(record: JsonRecord | undefined, path: string[]): unknown[] | undefined {
  const value = readNestedUnknown(record, path);
  return Array.isArray(value) ? value : undefined;
}

function readNestedUnknown(record: JsonRecord | undefined, path: string[]): unknown {
  let current: unknown = record;
  for (const key of path) {
    if (Array.isArray(current) && /^\d+$/.test(key)) {
      current = current[Number(key)];
      continue;
    }
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[key];
  }

  return current;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function requireText(value: string | undefined, message: string): string {
  const text = value?.trim();
  if (!text) {
    throw new Error(message);
  }
  return text;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function modelCatalogEntry(id: string, label: string, fallbackPurpose: ModelPurpose = 'audio'): ModelCatalogEntry {
  return {
    id,
    label,
    source: 'built_in',
    capabilities: inferModelCapabilitiesFromName(id, fallbackPurpose) as ModelCapability[]
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
    merged.set(model.id, model);
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function isTencentPlatformProvider(providerId?: string, providerName?: string): boolean {
  const normalizedProviderId = normalizeComparable(providerId);
  const normalizedProviderName = normalizeComparable(providerName);

  return (
    normalizedProviderId === 'tencent-cloud' ||
    normalizedProviderId === 'tencent-asr-compatible' ||
    normalizedProviderId.includes('tencent') ||
    normalizedProviderName.includes('腾讯') ||
    normalizedProviderName.includes('tencent')
  );
}

function isAliyunPlatformProvider(providerId?: string, providerName?: string, apiBaseUrl?: string): boolean {
  const normalizedProviderId = normalizeComparable(providerId);
  const normalizedProviderName = normalizeComparable(providerName);
  const normalizedApiBaseUrl = normalizeComparable(apiBaseUrl);

  return (
    normalizedProviderId === 'aliyun' ||
    normalizedProviderId === 'aliyun-bailian' ||
    normalizedProviderId === 'aliyun-asr-compatible' ||
    normalizedProviderId === 'dashscope' ||
    normalizedProviderId.includes('aliyun') ||
    normalizedProviderId.includes('dashscope') ||
    normalizedProviderName.includes('阿里云') ||
    normalizedProviderName.includes('百炼') ||
    normalizedProviderName.includes('aliyun') ||
    normalizedProviderName.includes('dashscope') ||
    normalizedApiBaseUrl.includes('dashscope.aliyuncs.com')
  );
}

function isAliyunNativeAsrModel(value: string): boolean {
  return /(^|[-_])(fun-asr|paraformer|qwen3-asr|qwen-audio.*asr)/i.test(value);
}

function isAliyunCompatibleAudioTranscriptionModel(value: string): boolean {
  return value.trim().toLowerCase() === 'qwen3-asr-flash';
}

function isAliyunAsyncAudioTranscriptionModel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized.includes('filetrans') ||
    normalized === 'fun-asr' ||
    normalized === 'fun-asr-mtl' ||
    normalized.startsWith('paraformer')
  );
}

function inferAliyunCompatibleAudioMimeType(value: string): string {
  const extension = value.split('.').pop()?.trim().toLowerCase() ?? '';
  if (extension === 'mp3') return 'audio/mpeg';
  if (extension === 'wav') return 'audio/wav';
  if (extension === 'm4a') return 'audio/mp4';
  if (extension === 'mp4') return 'audio/mp4';
  if (extension === 'flac') return 'audio/flac';
  if (extension === 'ogg') return 'audio/ogg';
  if (extension === 'webm') return 'audio/webm';
  return 'application/octet-stream';
}

function normalizeComparable(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac('sha256', key).update(value, 'utf8').digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac('sha256', key).update(value, 'utf8').digest('hex');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
