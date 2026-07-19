import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { QiuApiClient } from './index';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('binds the default fetch implementation to globalThis', async () => {
  let called = false;

  globalThis.fetch = function (
    this: unknown,
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) {
    called = true;
    assert.equal(this, globalThis);
    assert.equal(String(input), '/api/v1/auth/session');
    assert.equal(init?.credentials, 'same-origin');

    return Promise.resolve(
      new Response(
        JSON.stringify({
          authenticated: false,
          persistenceMode: 'database'
        }),
        {
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
  } as typeof fetch;

  const client = new QiuApiClient({ baseUrl: '' });
  const session = await client.getAuthSession();

  assert.equal(called, true);
  assert.deepEqual(session, {
    authenticated: false,
    persistenceMode: 'database'
  });
});
