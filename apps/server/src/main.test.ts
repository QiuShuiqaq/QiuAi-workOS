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

test('admin role template factory governs publication and workspace visibility', async () => {
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  try {
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

    const cookie = sessionCookie.split(';')[0];
    const templateId = `template_factory_${Date.now()}`;
    const headers = {
      cookie,
      'content-type': 'application/json'
    };

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/role-templates',
      headers,
      payload: {
        id: templateId,
        version: '1.0.0',
        name: 'AI Factory Flow Tester',
        industry: 'Operations',
        scenario: 'Template governance smoke test',
        description: 'Verifies template creation, publication, visibility, and installation.',
        recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
        businessGoal: 'Verify role template factory governance before enterprise rollout.',
        knowledgeSources: ['workspace_library'],
        tools: ['web-search'],
        skills: [
          {
            code: 'factory_flow_check',
            name: 'Factory Flow Check',
            summary: 'Checks template factory publication and visibility behavior.'
          }
        ],
        approvalPolicy: 'Manual review is required before customer-facing output.',
        allowedPlanCodes: ['ENTERPRISE_PRO_MONTHLY'],
        visibleWorkspaceIds: []
      }
    });
    assert.equal(createResponse.statusCode, 201);
    assert.equal(JSON.parse(createResponse.body).data.status, 'DRAFT');

    const testResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}/test`,
      headers,
      payload: {
        sampleInput: 'Please verify the template factory flow.'
      }
    });
    assert.equal(testResponse.statusCode, 201);
    assert.equal(JSON.parse(testResponse.body).data.valid, true);

    const publishResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}/publish`,
      headers,
      payload: {}
    });
    assert.equal(publishResponse.statusCode, 201);
    assert.equal(JSON.parse(publishResponse.body).data.status, 'PUBLISHED');

    const proOnlyTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/roles/templates',
      headers: {
        cookie
      }
    });
    assert.equal(proOnlyTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(proOnlyTemplatesResponse.body).data.some(
        (template: { id: string }) => template.id === templateId
      ),
      false
    );

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}`,
      headers,
      payload: {
        recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
        allowedPlanCodes: ['ENTERPRISE_BASIC_MONTHLY']
      }
    });
    assert.equal(updateResponse.statusCode, 200);

    const visibleTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/roles/templates',
      headers: {
        cookie
      }
    });
    assert.equal(visibleTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(visibleTemplatesResponse.body).data.some(
        (template: { id: string }) => template.id === templateId
      ),
      true
    );

    const desktopTemplatesWithoutTokenResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/desktop/role-templates'
    });
    assert.equal(desktopTemplatesWithoutTokenResponse.statusCode, 401);

    const bindingCodeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/enterprise/desktop/binding-codes',
      headers,
      payload: {
        expiresInMinutes: 10
      }
    });
    assert.equal(bindingCodeResponse.statusCode, 201);
    const bindingCode = JSON.parse(bindingCodeResponse.body).data.bindingCode as string;

    const redeemResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/desktop/bindings/redeem',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        bindingCode,
        runtimeId: `runtime-${Date.now()}`,
        deviceId: `device-${Date.now()}`,
        deviceName: 'Desktop Device',
        platform: 'windows',
        appVersion: '1.0.0'
      }
    });
    assert.equal(redeemResponse.statusCode, 201);
    const deviceToken = JSON.parse(redeemResponse.body).data.deviceToken as string;

    const desktopTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/desktop/role-templates',
      headers: {
        'x-qiuai-device-token': deviceToken
      }
    });
    assert.equal(desktopTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(desktopTemplatesResponse.body).data.some(
        (template: { id: string }) => template.id === templateId
      ),
      true
    );

    const installResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/enterprise/roles/install',
      headers,
      payload: {
        templateId,
        name: 'AI Factory Flow Tester'
      }
    });
    assert.equal(installResponse.statusCode, 201);
    assert.equal(JSON.parse(installResponse.body).data.templateId, templateId);

    const archiveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}/archive`,
      headers,
      payload: {}
    });
    assert.equal(archiveResponse.statusCode, 201);
    assert.equal(JSON.parse(archiveResponse.body).data.status, 'ARCHIVED');

    const archivedTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/roles/templates',
      headers: {
        cookie
      }
    });
    assert.equal(archivedTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(archivedTemplatesResponse.body).data.some(
        (template: { id: string }) => template.id === templateId
      ),
      false
    );
  } finally {
    await app.close();
  }
});
