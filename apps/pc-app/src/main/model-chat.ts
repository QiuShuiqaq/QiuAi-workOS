import type {
  DesktopModelListRequest,
  DesktopModelListResponse,
  DesktopModelChatRequest,
  DesktopModelChatResponse
} from '../shared/desktop-api.js';
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

function readProviderErrorMessage(body: OpenAiCompatibleChatResponse | undefined): string | undefined {
  return typeof body?.error?.message === 'string' ? body.error.message : undefined;
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
