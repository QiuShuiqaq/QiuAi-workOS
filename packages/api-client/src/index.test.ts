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

test('posts registration requests to the auth register endpoint', async () => {
  let called = false;

  globalThis.fetch = function (
    this: unknown,
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) {
    called = true;
    assert.equal(this, globalThis);
    assert.equal(String(input), '/api/v1/auth/register');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      email: 'founder@example.com',
      password: 'password-123',
      workspaceName: '秋 AI 科技',
      acceptedTerms: true
    });

    return Promise.resolve(
      new Response(
        JSON.stringify({
          authenticated: true,
          persistenceMode: 'database',
          account: {
            id: 'account_1',
            primaryEmail: 'founder@example.com',
            status: 'active'
          },
          workspaces: [
            {
              id: 'workspace_1',
              tenantId: 'tenant_1',
              workspaceType: 'enterprise',
              name: '秋 AI 科技',
              ownerAccountId: 'account_1',
              status: 'active',
              planCode: 'PERSONAL_FREE'
            }
          ],
          activeWorkspaceId: 'workspace_1',
          expiresAt: '2026-08-03T00:00:00.000Z'
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
  const response = await client.register({
    email: 'founder@example.com',
    password: 'password-123',
    workspaceName: '秋 AI 科技',
    acceptedTerms: true
  });

  assert.equal(called, true);
  assert.equal(response.authenticated, true);
  assert.equal(response.activeWorkspaceId, 'workspace_1');
});
