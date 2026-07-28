import assert from 'node:assert/strict';

import { listOpenAiCompatibleModels } from './model-chat.js';

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

console.log('Desktop model list API passed.');
