import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Response as InjectResponse } from 'light-my-request';

import { createApplication } from './main';

type ProtectedRequest = {
  method: 'GET' | 'POST';
  url: string;
  payload?: Record<string, string>;
};

test('server application initializes without parser registration conflicts', async () => {
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  await app.close();

  assert.ok(true);
});

test('workspace APIs require an authenticated workspace session', async () => {
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  try {
    const protectedRequests: ProtectedRequest[] = [
      {
        method: 'GET',
        url: '/api/v1/workspaces/enterprise/overview'
      },
      {
        method: 'GET',
        url: '/api/v1/workspaces/enterprise/billing/overview'
      },
      {
        method: 'GET',
        url: '/api/v1/workspaces/enterprise/organization/overview'
      },
      {
        method: 'GET',
        url: '/api/v1/workspaces/enterprise/roles/templates'
      },
      {
        method: 'GET',
        url: '/api/v1/workspaces/enterprise/roles'
      },
      {
        method: 'GET',
        url: '/api/v1/workspaces/enterprise/tasks'
      },
      {
        method: 'POST',
        url: '/api/v1/entitlements/check',
        payload: {
          workspaceId: 'enterprise',
          featureKey: 'canCreateDepartment'
        }
      }
    ];

    for (const request of protectedRequests) {
      const unauthenticatedResponse: InjectResponse = await app.inject({
        method: request.method,
        url: request.url,
        headers: request.payload ? { 'content-type': 'application/json' } : undefined,
        payload: request.payload
      });

      assert.equal(
        unauthenticatedResponse.statusCode,
        401,
        `${request.method} ${request.url} should require authentication`
      );
    }

    const loginResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        email: 'admin@qiuai.local',
        password: process.env.WORKOS_MOCK_ADMIN_PASSWORD ?? 'qiuai-demo'
      }
    });

    assert.equal(loginResponse.statusCode, 201);
    const setCookie = loginResponse.headers['set-cookie'];
    const sessionCookie: string | undefined = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    assert.ok(sessionCookie);

    for (const request of protectedRequests) {
      const authenticatedResponse: InjectResponse = await app.inject({
        method: request.method,
        url: request.url,
        headers: {
          cookie: sessionCookie.split(';')[0],
          ...(request.payload ? { 'content-type': 'application/json' } : {})
        },
        payload: request.payload
      });

      assert.equal(
        authenticatedResponse.statusCode,
        200,
        `${request.method} ${request.url} should allow an authenticated workspace member`
      );
    }
  } finally {
    await app.close();
  }
});
