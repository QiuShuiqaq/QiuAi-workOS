import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  invokeOpenAiCompatibleModelChat,
  listOpenAiCompatibleModels,
  testDesktopModelConnection
} from './model-chat.js';

const originalFetch = globalThis.fetch;
let capturedUrl = '';
let capturedAuthorization = '';

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  capturedUrl = String(input);
  const headers = new Headers(init?.headers);
  capturedAuthorization = headers.get('authorization') ?? '';

  return new Response(
    JSON.stringify({
      data: [
        { id: 'deepseek-v4-flash', owned_by: 'deepseek' },
        { id: 'deepseek-v4-pro', owned_by: 'deepseek' },
        { id: 'text-embedding-3-large', owned_by: 'openai' },
        { id: 'mystery-2026', owned_by: 'unknown-provider' }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const catalog = await listOpenAiCompatibleModels({
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    apiBaseUrl: 'https://api.deepseek.com/',
    apiKey: 'test-key'
  });

  assert.equal(capturedUrl, 'https://api.deepseek.com/models');
  assert.equal(capturedAuthorization, 'Bearer test-key');
  assert.equal(catalog.providerId, 'deepseek');
  assert.equal(catalog.models.length, 4);
  assert.deepEqual(
    catalog.models.find((model) => model.id === 'deepseek-v4-pro')?.capabilities,
    ['reasoning_text']
  );
  assert.deepEqual(
    catalog.models.find((model) => model.id === 'text-embedding-3-large')?.capabilities,
    ['embedding']
  );
  assert.deepEqual(catalog.models.find((model) => model.id === 'mystery-2026')?.capabilities, []);
  assert.equal(
    catalog.models.find((model) => model.id === 'mystery-2026')?.capabilityMetadata?.source,
    'unknown'
  );
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = (async () => {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: '',
            reasoning_content: 'Reasoning-only compatible response.'
          }
        }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'reasoning-profile',
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      modelName: 'qwen3-reasoning',
      purpose: 'reasoning',
      capabilities: ['reasoning_text', 'text'],
      apiBaseUrl: 'https://api.example.test/v1',
      apiKey: 'reasoning-key'
    },
    messages: [{ role: 'user', content: 'Analyze this page.' }]
  });

  assert.equal(response.content, 'Reasoning-only compatible response.');
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = (async () => {
  return new Response(
    JSON.stringify({
      choices: [
        {
          message: {
            content: [
              { type: 'text', text: 'Array content response.' }
            ]
          }
        }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'array-content-profile',
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      modelName: 'array-content-model',
      purpose: 'general',
      capabilities: ['text'],
      apiBaseUrl: 'https://api.example.test/v1',
      apiKey: 'array-key'
    },
    messages: [{ role: 'user', content: 'Reply with array content.' }]
  });

  assert.equal(response.content, 'Array content response.');
} finally {
  globalThis.fetch = originalFetch;
}

let capturedVisionBody: Record<string, unknown> | undefined;
const visionTempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-vision-chat-'));
const visionImagePath = path.join(visionTempDir, 'source.png');
writeFileSync(visionImagePath, Buffer.from([1, 2, 3]));
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  capturedVisionBody = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;

  return new Response(
    JSON.stringify({
      choices: [{ message: { content: 'Vision input accepted.' } }]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'vision-profile',
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      modelName: 'qwen-vl-max',
      purpose: 'vision',
      capabilities: ['image_understanding', 'vision_text'],
      apiBaseUrl: 'https://api.example.test/v1',
      apiKey: 'vision-key'
    },
    messages: [{ role: 'user', content: 'Describe this image.' }],
    visionInputs: [{ imagePath: visionImagePath, mimeType: 'image/png' }]
  });

  const messages = capturedVisionBody?.messages as Array<{ content: unknown }> | undefined;
  const content = messages?.[0]?.content;
  assert.equal(response.content, 'Vision input accepted.');
  assert.ok(Array.isArray(content));
  assert.deepEqual(content[0], { type: 'text', text: 'Describe this image.' });
  assert.deepEqual(content[1], {
    type: 'image_url',
    image_url: { url: 'data:image/png;base64,AQID' }
  });
} finally {
  globalThis.fetch = originalFetch;
  rmSync(visionTempDir, { recursive: true, force: true });
}

let capturedImageUrl = '';
let capturedImageBody: Record<string, unknown> | undefined;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  capturedImageUrl = String(input);
  capturedImageBody = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : undefined;

  return new Response(
    JSON.stringify({
      data: [
        {
          url: 'https://cdn.example.test/generated/product-main.png'
        }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'image-profile',
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation'],
      apiBaseUrl: 'https://api.example.test/v1',
      apiKey: 'image-key'
    },
    taskKind: 'image_generation',
    imageGeneration: {
      prompt: 'Generate a marketplace product main image.',
      responseFormat: 'url'
    },
    messages: [{ role: 'user', content: 'Generate image.' }]
  });

  assert.equal(capturedImageUrl, 'https://api.example.test/v1/images/generations');
  assert.equal(capturedImageBody?.model, 'gpt-image-2');
  assert.equal(capturedImageBody?.response_format, 'url');
  assert.equal(response.artifacts?.[0]?.remoteUrl, 'https://cdn.example.test/generated/product-main.png');
  assert.match(response.content, /product-main\.png/);
} finally {
  globalThis.fetch = originalFetch;
}

const capturedImageTestUrls: string[] = [];
let capturedImageTestBody: Record<string, unknown> | undefined;
const capturedImageTestTimeouts: number[] = [];
const originalAbortSignalTimeout = AbortSignal.timeout.bind(AbortSignal);
Object.defineProperty(AbortSignal, 'timeout', {
  configurable: true,
  value: (milliseconds: number) => {
    capturedImageTestTimeouts.push(milliseconds);
    return originalAbortSignalTimeout(milliseconds);
  }
});
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  capturedImageTestUrls.push(url);
  if (init?.body) {
    capturedImageTestBody = JSON.parse(String(init.body)) as Record<string, unknown>;
  }

  if (url.includes('/api/result')) {
    return new Response(
      JSON.stringify({
        id: 'grsai-test-job',
        status: 'succeeded',
        results: ['https://cdn.example.test/generated/model-test.png']
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }

  return new Response(
    JSON.stringify({
      id: 'grsai-test-job',
      status: 'pending'
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await testDesktopModelConnection({
    profile: {
      id: 'image-profile',
      providerId: 'grsai',
      providerName: 'GrsAI',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation', 'text_to_image'],
      apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
      apiKey: 'image-key'
    },
    timeoutMs: 6_000
  });

  assert.deepEqual(capturedImageTestUrls, [
    'https://grsai.dakka.com.cn/v1/api/generate',
    'https://grsai.dakka.com.cn/v1/api/result?id=grsai-test-job'
  ]);
  assert.equal(capturedImageTestBody?.model, 'gpt-image-2');
  assert.equal(capturedImageTestBody?.replyType, 'json');
  assert.equal(capturedImageTestTimeouts[0], 120_000);
  assert.equal(capturedImageTestTimeouts[1], 30_000);
  assert.equal(response.ok, true);
  assert.equal(response.checks?.[0]?.id, 'image_generation');
  assert.equal(response.checks?.[0]?.status, 'passed');
  assert.ok(response.verifiedCapabilities?.includes('image_generation'));
  assert.equal(response.capabilityMetadata?.source, 'verified');
} finally {
  globalThis.fetch = originalFetch;
  Object.defineProperty(AbortSignal, 'timeout', {
    configurable: true,
    value: originalAbortSignalTimeout
  });
}

const grsaiModelListUrls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  grsaiModelListUrls.push(String(input));
  return new Response(JSON.stringify({ error: { message: 'not found' } }), {
    status: 404,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const catalog = await listOpenAiCompatibleModels({
    providerId: 'custom',
    providerName: 'GrsAI',
    apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
    apiKey: 'grsai-key',
    modelName: 'gpt-image-2',
    capabilities: ['image_generation']
  });

  assert.deepEqual(grsaiModelListUrls, ['https://grsai.dakka.com.cn/v1/models']);
  assert.ok(catalog.models.some((model) => model.id === 'gpt-image-2'));
  assert.equal(catalog.models.find((model) => model.id === 'gpt-image-2')?.source, 'built_in');
  assert.ok(catalog.models.some((model) => model.id === 'nano-banana-2'));
} finally {
  globalThis.fetch = originalFetch;
}

let capturedMiniMaxModelListUrl = '';
globalThis.fetch = (async (input: RequestInfo | URL) => {
  capturedMiniMaxModelListUrl = String(input);
  return new Response(
    JSON.stringify({
      data: [
        { id: 'MiniMax-M2', owned_by: 'minimax' },
        { id: 'MiniMax-M3', owned_by: 'minimax' }
      ]
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const catalog = await listOpenAiCompatibleModels({
    providerId: 'minimax',
    providerName: 'MiniMax',
    apiBaseUrl: 'https://api.minimax.io/v1',
    apiKey: 'minimax-key',
    modelName: 'MiniMax-M2',
    capabilities: ['text']
  });

  assert.equal(capturedMiniMaxModelListUrl, 'https://api.minimax.io/v1/models');
  assert.ok(catalog.models.some((model) => model.id === 'MiniMax-M2'));
  assert.ok(catalog.models.some((model) => model.id === 'MiniMax-Hailuo-2.3-Fast'));
  assert.ok(catalog.models.some((model) => model.id === 'MiniMax-Hailuo-02'));
  assert.deepEqual(
    catalog.models.find((model) => model.id === 'MiniMax-Hailuo-02')?.capabilities,
    ['video_generation', 'text_to_video', 'image_to_video']
  );
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = (async () => {
  return new Response(JSON.stringify({ error: { message: 'invalid api key (2049)' } }), {
    status: 401,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  await assert.rejects(
    () =>
      listOpenAiCompatibleModels({
        providerId: 'minimax',
        providerName: 'MiniMax',
        apiBaseUrl: 'https://api.minimax.io/v1',
        apiKey: 'invalid-minimax-key',
        modelName: 'MiniMax-Hailuo-2.3-Fast',
        capabilities: ['video_generation']
      }),
    /invalid api key/
  );

  const response = await testDesktopModelConnection({
    profile: {
      id: 'minimax-invalid-key',
      providerId: 'minimax',
      providerName: 'MiniMax',
      modelName: 'MiniMax-Hailuo-2.3-Fast',
      purpose: 'vision',
      capabilities: ['video_generation', 'image_to_video'],
      apiBaseUrl: 'https://api.minimax.io/v1',
      apiKey: 'invalid-minimax-key'
    }
  });
  assert.equal(response.ok, false);
  assert.equal(response.checks?.[0]?.status, 'failed');
  assert.match(response.checks?.[0]?.message ?? '', /invalid api key/);
} finally {
  globalThis.fetch = originalFetch;
}

globalThis.fetch = (async () => {
  throw new TypeError('fetch failed');
}) as typeof fetch;

try {
  const catalog = await listOpenAiCompatibleModels({
    providerId: 'custom-provider',
    providerName: 'Custom Provider',
    apiBaseUrl: 'https://api.minimax.io/v1',
    apiKey: 'minimax-key',
    modelName: 'MiniMax-Hailuo-02',
    capabilities: ['video_generation']
  });

  assert.ok(catalog.models.some((model) => model.id === 'MiniMax-Hailuo-2.3-Fast'));
  assert.ok(catalog.models.some((model) => model.id === 'MiniMax-Hailuo-02'));
} finally {
  globalThis.fetch = originalFetch;
}

const minimaxVideoUrls: string[] = [];
let capturedMiniMaxVideoBody: Record<string, unknown> | undefined;
const originalSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) =>
  originalSetTimeout(handler, 0, ...args)) as typeof setTimeout;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  minimaxVideoUrls.push(url);
  const headers = new Headers(init?.headers);
  assert.equal(headers.get('authorization'), 'Bearer minimax-key');

  if (url.endsWith('/video_generation')) {
    capturedMiniMaxVideoBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ task_id: 'minimax-video-task-001', status: 'processing' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (url.includes('/query/video_generation')) {
    return new Response(JSON.stringify({ task_id: 'minimax-video-task-001', status: 'Success', file_id: 'file-001' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ file: { download_url: 'https://cdn.example.test/minimax/video.mp4' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'minimax-video',
      providerId: 'minimax',
      providerName: 'MiniMax',
      modelName: 'MiniMax-Hailuo-02',
      purpose: 'vision',
      capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
      apiBaseUrl: 'https://api.minimax.io/v1',
      apiKey: 'minimax-key'
    },
    taskKind: 'video_generation',
    videoGeneration: {
      prompt: 'Create a short ecommerce product video.',
      responseFormat: 'url'
    },
    messages: [{ role: 'user', content: 'Create product video.' }],
    timeoutMs: 60_000
  });

  assert.deepEqual(minimaxVideoUrls, [
    'https://api.minimax.io/v1/video_generation',
    'https://api.minimax.io/v1/query/video_generation?task_id=minimax-video-task-001',
    'https://api.minimax.io/v1/files/retrieve?file_id=file-001'
  ]);
  assert.equal(capturedMiniMaxVideoBody?.model, 'MiniMax-Hailuo-02');
  assert.equal(capturedMiniMaxVideoBody?.prompt, 'Create a short ecommerce product video.');
  assert.equal(capturedMiniMaxVideoBody?.prompt_optimizer, true);
  assert.equal(response.artifacts?.[0]?.remoteUrl, 'https://cdn.example.test/minimax/video.mp4');
  assert.equal(response.artifacts?.[0]?.providerJobId, 'minimax-video-task-001');
  assert.equal(response.artifacts?.[0]?.providerStatus, 'success');
} finally {
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
}

const minimaxEndpointBaseUrls: string[] = [];
let capturedMiniMaxEndpointBaseBody: Record<string, unknown> | undefined;
const minimaxEndpointBaseTempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-minimax-video-'));
const minimaxEndpointBaseImagePath = path.join(minimaxEndpointBaseTempDir, 'source.png');
writeFileSync(
  minimaxEndpointBaseImagePath,
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=', 'base64')
);
globalThis.setTimeout = ((handler: TimerHandler, _timeout?: number, ...args: unknown[]) =>
  originalSetTimeout(handler, 0, ...args)) as typeof setTimeout;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  minimaxEndpointBaseUrls.push(url);

  if (url.endsWith('/video_generation')) {
    capturedMiniMaxEndpointBaseBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ task_id: 'minimax-video-task-002', status: 'Processing' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  if (url.includes('/query/video_generation')) {
    return new Response(JSON.stringify({ task_id: 'minimax-video-task-002', status: 'Success', file_id: 'file-002' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ file: { download_url: 'www.cdn.example.test/minimax/video.mp4' } }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'minimax-video-endpoint-base',
      providerId: 'minimax',
      providerName: 'MiniMax',
      modelName: 'MiniMax-Hailuo-2.3-Fast',
      purpose: 'vision',
      capabilities: ['video_generation', 'image_to_video'],
      apiBaseUrl: 'https://api.minimaxi.com/v1/video_generation',
      apiKey: 'minimax-key'
    },
    taskKind: 'video_generation',
    videoGeneration: {
      prompt: 'Create a short ecommerce product video from the product image.',
      sourceImagePath: minimaxEndpointBaseImagePath,
      durationSeconds: 8,
      responseFormat: 'url'
    },
    messages: [{ role: 'user', content: 'Create product video.' }],
    timeoutMs: 60_000
  });

  assert.deepEqual(minimaxEndpointBaseUrls, [
    'https://api.minimaxi.com/v1/video_generation',
    'https://api.minimaxi.com/v1/query/video_generation?task_id=minimax-video-task-002',
    'https://api.minimaxi.com/v1/files/retrieve?file_id=file-002'
  ]);
  assert.equal(capturedMiniMaxEndpointBaseBody?.model, 'MiniMax-Hailuo-2.3-Fast');
  assert.equal(capturedMiniMaxEndpointBaseBody?.duration, 6);
  assert.match(String(capturedMiniMaxEndpointBaseBody?.first_frame_image), /^data:image\/png;base64,/);
  assert.equal(response.artifacts?.[0]?.remoteUrl, 'https://www.cdn.example.test/minimax/video.mp4');
} finally {
  rmSync(minimaxEndpointBaseTempDir, { recursive: true, force: true });
  globalThis.fetch = originalFetch;
  globalThis.setTimeout = originalSetTimeout;
}

let capturedMiniMaxVideoProbeUrl = '';
globalThis.fetch = (async (input: RequestInfo | URL) => {
  capturedMiniMaxVideoProbeUrl = String(input);
  return new Response(JSON.stringify({ data: [{ id: 'MiniMax-M2', owned_by: 'minimax' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const response = await testDesktopModelConnection({
    profile: {
      id: 'minimax-video-probe',
      providerId: 'minimax',
      providerName: 'MiniMax',
      modelName: 'MiniMax-Hailuo-02',
      purpose: 'vision',
      capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
      apiBaseUrl: 'https://api.minimax.io/v1',
      apiKey: 'minimax-key'
    }
  });

  assert.equal(capturedMiniMaxVideoProbeUrl, 'https://api.minimax.io/v1/models');
  assert.equal(response.ok, true);
  assert.equal(response.checks?.[0]?.id, 'minimax_video_probe');
  assert.equal(response.checks?.[0]?.status, 'passed');
  assert.ok(response.verifiedCapabilities?.includes('video_generation'));
} finally {
  globalThis.fetch = originalFetch;
}

let capturedTranscriptionUrl = '';
let capturedTranscriptionAuthorization = '';
const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-model-chat-'));
const sampleAudioPath = path.join(tempDir, 'sample.mp4');
writeFileSync(sampleAudioPath, Buffer.from('fake-video-audio'));
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  capturedTranscriptionUrl = String(input);
  const headers = new Headers(init?.headers);
  capturedTranscriptionAuthorization = headers.get('authorization') ?? '';
  assert.ok(init?.body instanceof FormData);

  return new Response(
    JSON.stringify({
      text: '使用前疼痛明显，使用后行动改善，晚上休息也更好了。'
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'asr-profile',
      providerId: 'openai-compatible-asr',
      providerName: 'OpenAI Compatible ASR',
      modelName: '16k_zh_dialect',
      purpose: 'general',
      capabilities: ['audio_to_text'],
      apiBaseUrl: 'https://asr.example.test/v1',
      apiKey: 'asr-key'
    },
    taskKind: 'audio_transcription',
    audioTranscription: {
      audioPath: sampleAudioPath,
      language: 'zh',
      dialect: 'auto'
    },
    messages: [{ role: 'user', content: '请转写音频。' }]
  });

  assert.equal(capturedTranscriptionUrl, 'https://asr.example.test/v1/audio/transcriptions');
  assert.equal(capturedTranscriptionAuthorization, 'Bearer asr-key');
  assert.match(response.content, /使用前疼痛明显/);
} finally {
  globalThis.fetch = originalFetch;
}

let capturedAliyunCompatibleAudioUrl = '';
let capturedAliyunCompatibleAudioBody: Record<string, unknown> | undefined;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  capturedAliyunCompatibleAudioUrl = String(input);
  capturedAliyunCompatibleAudioBody = JSON.parse(String(init?.body)) as Record<string, unknown>;

  return new Response(JSON.stringify({ choices: [{ message: { content: '阿里云短音频转写成功。' } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'aliyun-qwen3-asr-flash',
      providerId: 'aliyun-bailian',
      providerName: '阿里云',
      modelName: 'qwen3-asr-flash',
      purpose: 'audio',
      capabilities: ['audio_to_text'],
      apiKey: 'aliyun-key'
    },
    taskKind: 'audio_transcription',
    audioTranscription: {
      audioPath: sampleAudioPath
    },
    messages: [{ role: 'user', content: '请转写。' }]
  });

  assert.equal(
    capturedAliyunCompatibleAudioUrl,
    'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  );
  assert.equal(capturedAliyunCompatibleAudioBody?.model, 'qwen3-asr-flash');
  assert.equal(capturedAliyunCompatibleAudioBody?.stream, false);
  assert.match(response.content, /短音频转写成功/);
} finally {
  globalThis.fetch = originalFetch;
}

const capturedAliyunListUrls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  capturedAliyunListUrls.push(url);
  if (url.endsWith('/models')) {
    return new Response(JSON.stringify({ data: [{ id: 'qwen-plus', owned_by: 'aliyun-provider' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  return new Response(JSON.stringify({ code: 'TaskNotFound', message: 'task not found' }), {
    status: 404,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const catalog = await listOpenAiCompatibleModels({
    providerId: 'aliyun-bailian',
    providerName: '阿里云',
    apiKey: 'aliyun-key',
    modelName: 'fun-asr',
    capabilities: ['audio_to_text']
  });

  assert.deepEqual(capturedAliyunListUrls, [
    'https://dashscope.aliyuncs.com/api/v1/tasks/qiuai-connection-test',
    'https://dashscope.aliyuncs.com/compatible-mode/v1/models'
  ]);
  assert.equal(catalog.providerId, 'aliyun-bailian');
  assert.ok(catalog.models.some((model) => model.id === 'qwen-plus'));
  assert.ok(catalog.models.some((model) => model.id === 'qwen-vl-max'));
  assert.ok(catalog.models.some((model) => model.id === 'fun-asr'));
  assert.deepEqual(catalog.models.find((model) => model.id === 'qwen-plus')?.capabilities, ['text']);
  assert.equal(catalog.models.find((model) => model.id === 'qwen-plus')?.source, 'provider');
  assert.equal(
    catalog.models.find((model) => model.id === 'qwen-plus')?.capabilityMetadata?.source,
    'official_catalog'
  );
  assert.ok(catalog.models.find((model) => model.id === 'fun-asr')?.capabilities.includes('audio_to_text'));
  assert.equal(catalog.models.find((model) => model.id === 'fun-asr')?.source, 'built_in');
} finally {
  globalThis.fetch = originalFetch;
}

let capturedAliyunTextTestUrl = '';
globalThis.fetch = (async (input: RequestInfo | URL) => {
  capturedAliyunTextTestUrl = String(input);
  return new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const response = await testDesktopModelConnection({
    profile: {
      id: 'aliyun-qwen-plus',
      providerId: 'aliyun-bailian',
      providerName: '阿里云',
      modelName: 'qwen-plus',
      purpose: 'general',
      capabilities: ['text'],
      apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'aliyun-key'
    }
  });

  assert.equal(capturedAliyunTextTestUrl, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'openai_compatible');
} finally {
  globalThis.fetch = originalFetch;
}

let capturedTencentAction = '';
let capturedTencentAuthorization = '';
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  const headers = new Headers(init?.headers);
  capturedTencentAction = headers.get('x-tc-action') ?? '';
  capturedTencentAuthorization = headers.get('authorization') ?? '';
  return new Response(
    JSON.stringify({
      Response: {
        Error: {
          Code: 'ResourceNotFound.Task',
          Message: 'task not found'
        },
        RequestId: 'req-test'
      }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await testDesktopModelConnection({
    profile: {
      id: 'qiu-asr-default',
      providerId: 'tencent-cloud',
      providerName: '腾讯云',
      modelName: '16k_zh_dialect',
      purpose: 'audio',
      capabilities: ['audio_to_text'],
      apiBaseUrl: 'https://asr.tencentcloudapi.com?region=ap-shanghai',
      apiKey: 'secret-id:secret-key'
    }
  });

  assert.equal(capturedTencentAction, 'DescribeTaskStatus');
  assert.match(capturedTencentAuthorization, /^TC3-HMAC-SHA256 Credential=secret-id/);
  assert.equal(response.ok, true);
  assert.equal(response.mode, 'tencent_cloud');
} finally {
  globalThis.fetch = originalFetch;
}

const aliyunCalls: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  aliyunCalls.push(url);
  const headers = new Headers(init?.headers);
  if (url.endsWith('/services/audio/asr/transcription')) {
    assert.equal(headers.get('authorization'), 'Bearer aliyun-key');
    assert.equal(headers.get('x-dashscope-async'), 'enable');
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    assert.equal(body.model, 'fun-asr');
    return new Response(JSON.stringify({ output: { task_id: 'task-aliyun-001' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (url.endsWith('/tasks/task-aliyun-001')) {
    return new Response(
      JSON.stringify({
        output: {
          task_status: 'SUCCEEDED',
          results: [{ transcription_url: 'https://cdn.example.test/asr-result.json' }]
        }
      }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    );
  }

  assert.equal(url, 'https://cdn.example.test/asr-result.json');
  return new Response(JSON.stringify({ transcripts: [{ text: '使用前疼痛明显，使用后改善清楚。' }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' }
  });
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'aliyun-fun-asr',
      providerId: 'aliyun-bailian',
      providerName: '阿里云',
      modelName: 'fun-asr',
      purpose: 'audio',
      capabilities: ['audio_to_text'],
      apiKey: 'aliyun-key'
    },
    taskKind: 'audio_transcription',
    audioTranscription: {
      audioPath: 'https://oss.example.test/case-video.mp4',
      language: 'zh',
      dialect: 'shanghai'
    },
    messages: [{ role: 'user', content: '请转写。' }]
  });

  assert.deepEqual(aliyunCalls, [
    'https://dashscope.aliyuncs.com/api/v1/services/audio/asr/transcription',
    'https://dashscope.aliyuncs.com/api/v1/tasks/task-aliyun-001',
    'https://cdn.example.test/asr-result.json'
  ]);
  assert.match(response.content, /使用前疼痛明显/);
} finally {
  globalThis.fetch = originalFetch;
}

let tencentCreatePayload: Record<string, unknown> | undefined;
let tencentCallCount = 0;
globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
  tencentCallCount += 1;
  const headers = new Headers(init?.headers);
  assert.match(headers.get('authorization') ?? '', /^TC3-HMAC-SHA256 Credential=secret-id/);
  const action = headers.get('x-tc-action');
  const body = JSON.parse(String(init?.body)) as Record<string, unknown>;

  if (action === 'CreateRecTask') {
    tencentCreatePayload = body;
    return new Response(JSON.stringify({ Response: { Data: { TaskId: 12345 }, RequestId: 'req-create' } }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }

  assert.equal(action, 'DescribeTaskStatus');
  return new Response(
    JSON.stringify({
      Response: {
        Data: {
          Status: 2,
          Result: '[0.00, 2.40] 使用前咳嗽不舒服，[2.40, 5.60] 使用后缓解明显。',
          ResultDetail: [
            { FinalSentence: '使用前咳嗽不舒服。' },
            { FinalSentence: '使用后缓解明显。' }
          ]
        },
        RequestId: 'req-describe'
      }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}) as typeof fetch;

try {
  const response = await invokeOpenAiCompatibleModelChat({
    profile: {
      id: 'tencent-asr',
      providerId: 'tencent-cloud',
      providerName: '腾讯云',
      modelName: '16k_zh_dialect',
      purpose: 'audio',
      capabilities: ['audio_to_text'],
      apiBaseUrl: 'https://asr.tencentcloudapi.com?region=ap-shanghai',
      apiKey: 'secret-id:secret-key'
    },
    taskKind: 'audio_transcription',
    audioTranscription: {
      audioPath: sampleAudioPath,
      language: 'zh',
      dialect: 'auto'
    },
    messages: [{ role: 'user', content: '请转写。' }]
  });

  assert.equal(tencentCallCount, 2);
  assert.equal(tencentCreatePayload?.EngineModelType, '16k_zh_dialect');
  assert.equal(tencentCreatePayload?.SourceType, 1);
  assert.equal(typeof tencentCreatePayload?.Data, 'string');
  assert.match(response.content, /使用前咳嗽/);
  assert.doesNotMatch(response.content, /\[0\.00, 2\.40\]/);
} finally {
  globalThis.fetch = originalFetch;
}

console.log('Desktop model list API passed.');
