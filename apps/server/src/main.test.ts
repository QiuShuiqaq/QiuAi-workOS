import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Response as InjectResponse } from 'light-my-request';

import { createApplication } from './main';
import { MockPlatformStore } from './shared/mock/mock-platform-store.service';

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
    const store = app.get(MockPlatformStore);
    assert.ok(
      store.updateSubscription('enterprise', {
        status: 'active',
        currentPeriodEnd: '2999-01-01T00:00:00.000Z'
      })
    );

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
        workflowSteps: [
          {
            id: 'receive_input',
            order: 1,
            type: 'input',
            name: 'Receive Input',
            instruction: 'Confirm the requested template factory smoke test scope.'
          },
          {
            id: 'deliver_output',
            order: 2,
            type: 'output',
            name: 'Deliver Output',
            instruction: 'Return a concise validation result for the operator.'
          }
        ],
        sampleInputs: ['Please verify the template factory flow.'],
        outputFormat: 'Markdown checklist with validation result and risks.',
        approvalPolicy: 'Manual review is required before customer-facing output.',
        allowedPlanCodes: ['ENTERPRISE_PRO_MONTHLY'],
        visibleWorkspaceIds: []
      }
    });
    assert.equal(createResponse.statusCode, 201);
    const createdTemplate = JSON.parse(createResponse.body).data;
    assert.equal(createdTemplate.status, 'DRAFT');
    assert.equal(createdTemplate.workflowSteps.length, 2);

    const testResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}/test`,
      headers,
      payload: {
        sampleInput: 'Please verify the template factory flow.'
      }
    });
    assert.equal(testResponse.statusCode, 201);
    const testResponseData = JSON.parse(testResponse.body).data;
    assert.equal(testResponseData.valid, true);
    assert.ok(testResponseData.graphTrace);
    assert.ok(testResponseData.graphTrace.nodes.length >= 2);
    assert.ok(
      testResponseData.graphTrace.nodes.some(
        (node: { nodeId: string; inputPreview: string; outputPreview: string }) =>
          node.nodeId === 'receive_input' &&
          node.inputPreview.includes('Please verify the template factory flow.') &&
          node.outputPreview.length > 0
      )
    );

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
    const redeemedBinding = JSON.parse(redeemResponse.body).data;
    const deviceToken = redeemedBinding.deviceToken as string;
    const redeemedDevice = redeemedBinding.device as {
      runtimeId: string;
      deviceId: string;
      deviceName: string;
      platform: 'windows';
      appVersion: string;
    };

    const proOnlyDesktopTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/desktop/role-templates',
      headers: {
        'x-qiuai-device-token': deviceToken
      }
    });
    assert.equal(proOnlyDesktopTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(proOnlyDesktopTemplatesResponse.body).data.some(
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
      JSON.parse(visibleTemplatesResponse.body).data.find(
        (template: { id: string }) => template.id === templateId
      )?.workflowSteps.length,
      2
    );

    const desktopTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/desktop/role-templates',
      headers: {
        'x-qiuai-device-token': deviceToken
      }
    });
    assert.equal(desktopTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(desktopTemplatesResponse.body).data.find(
        (template: { id: string }) => template.id === templateId
      )?.workflowSteps.length,
      2
    );

    assert.ok(
      store.updateSubscription('enterprise', {
        status: 'expired',
        currentPeriodEnd: '2000-01-01T00:00:00.000Z'
      })
    );
    const downgradedDesktopTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/desktop/role-templates',
      headers: {
        'x-qiuai-device-token': deviceToken
      }
    });
    assert.equal(downgradedDesktopTemplatesResponse.statusCode, 200);
    const downgradedDesktopTemplates = JSON.parse(downgradedDesktopTemplatesResponse.body).data;
    assert.equal(
      downgradedDesktopTemplates.some((template: { id: string }) => template.id === templateId),
      false
    );
    assert.equal(
      downgradedDesktopTemplates.some(
        (template: { recommendedPlanCode: string }) =>
          template.recommendedPlanCode === 'PERSONAL_FREE'
      ),
      true
    );

    const downgradedSyncResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/enterprise/desktop/runtimes/sync',
      headers: {
        'content-type': 'application/json',
        'x-qiuai-device-token': deviceToken
      },
      payload: {
        data: {
          runtimeId: redeemedDevice.runtimeId,
          deviceId: redeemedDevice.deviceId,
          deviceName: redeemedDevice.deviceName,
          platform: redeemedDevice.platform,
          workspaceId: 'enterprise',
          appVersion: redeemedDevice.appVersion,
          rolePackages: [
            {
              roleCode: 'ai-factory-flow-tester',
              version: '1.0.0',
              state: 'running',
              installedAt: '2026-07-20T00:00:00.000Z',
              templateId,
              templateVersion: '1.0.0'
            }
          ],
          tools: [],
          tasks: [
            {
              taskId: 'task-downgraded-paid-role',
              roleCode: 'ai-factory-flow-tester',
              title: 'Should not be persisted after downgrade',
              state: 'completed',
              updatedAt: '2026-07-20T01:00:00.000Z'
            }
          ]
        }
      }
    });
    assert.equal(downgradedSyncResponse.statusCode, 201);
    const downgradedSync = store.getDesktopRuntimeSync(redeemedDevice.runtimeId);
    const downgradedSnapshot = downgradedSync?.runtimeSnapshot as
      | { rolePackages: Array<{ templateId?: string }>; tasks: Array<{ taskId: string }> }
      | undefined;
    assert.ok(downgradedSnapshot);
    assert.equal(
      downgradedSnapshot.rolePackages.some((rolePackage) => rolePackage.templateId === templateId),
      false
    );
    assert.equal(
      downgradedSnapshot.tasks.some((task) => task.taskId === 'task-downgraded-paid-role'),
      false
    );
    assert.ok(
      store.updateSubscription('enterprise', {
        status: 'active',
        currentPeriodEnd: '2999-01-01T00:00:00.000Z'
      })
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

test('desktop release publishing drives public update checks', async () => {
  const originalUploadDir = process.env.WORKOS_DESKTOP_RELEASE_UPLOAD_DIR;
  const uploadDir = mkdtempSync(join(tmpdir(), 'qiuai-desktop-release-'));
  process.env.WORKOS_DESKTOP_RELEASE_UPLOAD_DIR = uploadDir;
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  try {
    const noReleaseResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/releases/latest?currentVersion=1.0.0'
    });
    assert.equal(noReleaseResponse.statusCode, 200);
    assert.equal(JSON.parse(noReleaseResponse.body).data.updateAvailable, false);

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
    const headers = {
      cookie,
      'content-type': 'application/json'
    };
    const version = `1.0.${Date.now()}`;
    const installerPayload = Buffer.from(`qiuai desktop installer ${version}`);
    const installerChecksum = createHash('sha256').update(installerPayload).digest('hex');

    const uploadResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/desktop-release-assets',
      headers: {
        cookie,
        'content-type': 'application/octet-stream',
        'x-qiuai-file-name': encodeURIComponent(`QiuAI-WorkOS-${version}.exe`)
      },
      payload: installerPayload
    });
    assert.equal(uploadResponse.statusCode, 201);
    const uploadedAsset = JSON.parse(uploadResponse.body).data as {
      downloadUrl: string;
      checksumSha256: string;
      fileSizeBytes: number;
    };
    assert.equal(uploadedAsset.checksumSha256, installerChecksum);
    assert.equal(uploadedAsset.fileSizeBytes, installerPayload.length);
    assert.match(uploadedAsset.downloadUrl, /\/api\/v1\/desktop\/releases\/downloads\//);

    const downloadPath = uploadedAsset.downloadUrl.startsWith('http')
      ? new URL(uploadedAsset.downloadUrl).pathname
      : uploadedAsset.downloadUrl;
    const downloadResponse = await app.inject({
      method: 'GET',
      url: downloadPath
    });
    assert.equal(downloadResponse.statusCode, 200);
    assert.equal(downloadResponse.headers['content-length'], String(installerPayload.length));
    assert.equal(downloadResponse.rawPayload.toString('utf8'), installerPayload.toString('utf8'));

    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/desktop-releases',
      headers,
      payload: {
        version,
        downloadUrl: uploadedAsset.downloadUrl,
        releaseNotes: 'Desktop release smoke test.',
        checksumSha256: uploadedAsset.checksumSha256,
        fileSizeBytes: uploadedAsset.fileSizeBytes,
        forceUpdate: true,
        minimumSupportedVersion: '1.0.0'
      }
    });
    assert.equal(createResponse.statusCode, 201);
    const release = JSON.parse(createResponse.body).data as { id: string; status: string };
    assert.equal(release.status, 'DRAFT');

    const unpublishedCheckResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/releases/latest?currentVersion=1.0.0'
    });
    assert.equal(unpublishedCheckResponse.statusCode, 200);
    assert.equal(JSON.parse(unpublishedCheckResponse.body).data.updateAvailable, false);

    const publishResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/desktop-releases/${encodeURIComponent(release.id)}/publish`,
      headers,
      payload: {}
    });
    assert.equal(publishResponse.statusCode, 201);
    assert.equal(JSON.parse(publishResponse.body).data.status, 'PUBLISHED');

    const updateCheckResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/releases/latest?currentVersion=1.0.0'
    });
    assert.equal(updateCheckResponse.statusCode, 200);
    const updateCheck = JSON.parse(updateCheckResponse.body).data;
    assert.equal(updateCheck.updateAvailable, true);
    assert.equal(updateCheck.forceUpdate, true);
    assert.equal(updateCheck.latestRelease.version, version);

    const archiveResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/desktop-releases/${encodeURIComponent(release.id)}/archive`,
      headers,
      payload: {}
    });
    assert.equal(archiveResponse.statusCode, 201);
    assert.equal(JSON.parse(archiveResponse.body).data.status, 'ARCHIVED');

    const archivedCheckResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/releases/latest?currentVersion=1.0.0'
    });
    assert.equal(archivedCheckResponse.statusCode, 200);
    assert.equal(JSON.parse(archivedCheckResponse.body).data.updateAvailable, false);
  } finally {
    await app.close();
    if (originalUploadDir === undefined) {
      delete process.env.WORKOS_DESKTOP_RELEASE_UPLOAD_DIR;
    } else {
      process.env.WORKOS_DESKTOP_RELEASE_UPLOAD_DIR = originalUploadDir;
    }
    rmSync(uploadDir, { recursive: true, force: true });
  }
});
