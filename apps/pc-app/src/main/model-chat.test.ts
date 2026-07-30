import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { invokeOpenAiCompatibleModelChat, listOpenAiCompatibleModels } from './model-chat.js';

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
        { id: 'text-embedding-3-large', owned_by: 'openai' }
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
  assert.equal(catalog.models.length, 3);
  assert.deepEqual(
    catalog.models.find((model) => model.id === 'deepseek-v4-pro')?.capabilities,
    ['reasoning_text', 'text']
  );
  assert.deepEqual(
    catalog.models.find((model) => model.id === 'text-embedding-3-large')?.capabilities,
    ['embedding']
  );
} finally {
  globalThis.fetch = originalFetch;
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
      providerId: 'tencent-asr-compatible',
      providerName: '腾讯云 ASR 兼容网关',
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

console.log('Desktop model list API passed.');
