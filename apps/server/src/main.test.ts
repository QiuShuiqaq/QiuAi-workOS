import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { Response as InjectResponse } from 'light-my-request';

import { createApplication } from './main';
import { MockPlatformStore } from './shared/mock/mock-platform-store.service';
import { retiredServerRoleTemplateIds } from './shared/role-template-catalog';

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

test('auth register creates an authenticated free enterprise workspace session', async () => {
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  try {
    const registerResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/register',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        email: `founder-${Date.now()}@example.com`,
        password: 'password-123',
        workspaceName: '秋 AI 科技',
        acceptedTerms: true
      }
    });

    assert.equal(registerResponse.statusCode, 201);
    const body = JSON.parse(registerResponse.body);
    assert.equal(body.authenticated, true);
    assert.equal(body.account.status, 'active');
    assert.equal(body.workspaces.length, 1);
    assert.equal(body.workspaces[0].workspaceType, 'enterprise');
    assert.equal(body.workspaces[0].planCode, 'PERSONAL_FREE');

    const setCookie = registerResponse.headers['set-cookie'];
    const sessionCookie: string | undefined = Array.isArray(setCookie) ? setCookie[0] : setCookie;
    assert.ok(sessionCookie);

    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/session',
      headers: {
        cookie: sessionCookie.split(';')[0]
      }
    });

    assert.equal(sessionResponse.statusCode, 200);
    const sessionBody = JSON.parse(sessionResponse.body);
    assert.equal(sessionBody.authenticated, true);
    assert.equal(sessionBody.activeWorkspaceId, body.activeWorkspaceId);
  } finally {
    await app.close();
  }
});

test('auth login applies rate limiting to repeated attempts', async () => {
  const previousLimit = process.env.WORKOS_AUTH_LOGIN_IP_LIMIT;
  const previousEmailLimit = process.env.WORKOS_AUTH_LOGIN_EMAIL_LIMIT;
  const previousWindow = process.env.WORKOS_AUTH_LOGIN_WINDOW_SECONDS;

  process.env.WORKOS_AUTH_LOGIN_IP_LIMIT = '2';
  process.env.WORKOS_AUTH_LOGIN_EMAIL_LIMIT = '2';
  process.env.WORKOS_AUTH_LOGIN_WINDOW_SECONDS = '60';

  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  try {
    for (let index = 0; index < 2; index += 1) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '203.0.113.42'
        },
        payload: {
          email: 'admin@qiuai.local',
          password: 'wrong-password'
        }
      });
      assert.equal(response.statusCode, 401);
    }

    const limitedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': '203.0.113.42'
      },
      payload: {
        email: 'admin@qiuai.local',
        password: 'wrong-password'
      }
    });

    assert.equal(limitedResponse.statusCode, 429);
    assert.equal(JSON.parse(limitedResponse.body).error.code, 'RATE_LIMITED');
  } finally {
    await app.close();
    if (previousLimit === undefined) {
      delete process.env.WORKOS_AUTH_LOGIN_IP_LIMIT;
    } else {
      process.env.WORKOS_AUTH_LOGIN_IP_LIMIT = previousLimit;
    }
    if (previousEmailLimit === undefined) {
      delete process.env.WORKOS_AUTH_LOGIN_EMAIL_LIMIT;
    } else {
      process.env.WORKOS_AUTH_LOGIN_EMAIL_LIMIT = previousEmailLimit;
    }
    if (previousWindow === undefined) {
      delete process.env.WORKOS_AUTH_LOGIN_WINDOW_SECONDS;
    } else {
      process.env.WORKOS_AUTH_LOGIN_WINDOW_SECONDS = previousWindow;
    }
  }
});

test('desktop agreement acceptance records device consent', async () => {
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  try {
    const query = new URLSearchParams({
      agreementKey: 'qiuai_workos_user_agreement',
      agreementVersion: 'v1.0',
      contentHash: 'sha256:test-user-agreement',
      runtimeId: 'runtime-test-agreement',
      deviceId: 'device-test-agreement'
    });

    const initialStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/desktop/agreement-acceptances/status?${query.toString()}`
    });
    assert.equal(initialStatusResponse.statusCode, 200);
    assert.equal(JSON.parse(initialStatusResponse.body).data.accepted, false);

    const tooFastResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/desktop/agreement-acceptances',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'QiuAI WorkOS Test',
        'x-forwarded-for': '203.0.113.10'
      },
      payload: {
        agreementKey: 'qiuai_workos_user_agreement',
        agreementVersion: 'v1.0',
        contentHash: 'sha256:test-user-agreement',
        runtimeId: 'runtime-test-agreement',
        deviceId: 'device-test-agreement',
        workspaceId: 'workspace_pending_login',
        deviceName: 'test-device',
        platform: 'windows',
        appVersion: '1.0.0',
        consentMethod: 'pc_first_launch_countdown_10s',
        minimumReadSeconds: 10,
        actualReadSeconds: 3
      }
    });
    assert.equal(tooFastResponse.statusCode, 400);

    const acceptResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/desktop/agreement-acceptances',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'QiuAI WorkOS Test',
        'x-forwarded-for': '203.0.113.10'
      },
      payload: {
        agreementKey: 'qiuai_workos_user_agreement',
        agreementVersion: 'v1.0',
        contentHash: 'sha256:test-user-agreement',
        runtimeId: 'runtime-test-agreement',
        deviceId: 'device-test-agreement',
        workspaceId: 'workspace_pending_login',
        deviceName: 'test-device',
        platform: 'windows',
        appVersion: '1.0.0',
        consentMethod: 'pc_first_launch_countdown_10s',
        minimumReadSeconds: 10,
        actualReadSeconds: 10
      }
    });
    assert.equal(acceptResponse.statusCode, 201);
    const acceptance = JSON.parse(acceptResponse.body).data;
    assert.equal(acceptance.agreementKey, 'qiuai_workos_user_agreement');
    assert.equal(acceptance.runtimeId, 'runtime-test-agreement');
    assert.equal(acceptance.deviceId, 'device-test-agreement');
    assert.equal(acceptance.actualReadSeconds, 10);

    const acceptedStatusResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/desktop/agreement-acceptances/status?${query.toString()}`
    });
    assert.equal(acceptedStatusResponse.statusCode, 200);
    const acceptedStatus = JSON.parse(acceptedStatusResponse.body).data;
    assert.equal(acceptedStatus.accepted, true);
    assert.equal(acceptedStatus.acceptance.contentHash, 'sha256:test-user-agreement');
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

    const factoryQuotaAllowedResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/entitlements/check',
      headers,
      payload: {
        workspaceId: 'enterprise',
        featureKey: 'maxDigitalFactories',
        requestedAmount: 1
      }
    });
    assert.equal(factoryQuotaAllowedResponse.statusCode, 200);
    assert.equal(JSON.parse(factoryQuotaAllowedResponse.body).allowed, true);

    const factoryQuotaExceededResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/entitlements/check',
      headers,
      payload: {
        workspaceId: 'enterprise',
        featureKey: 'maxDigitalFactories',
        requestedAmount: 2
      }
    });
    assert.equal(factoryQuotaExceededResponse.statusCode, 200);
    const factoryQuotaExceeded = JSON.parse(factoryQuotaExceededResponse.body);
    assert.equal(factoryQuotaExceeded.allowed, false);
    assert.equal(factoryQuotaExceeded.reason, 'quota_exceeded');
    assert.equal(factoryQuotaExceeded.requiredPlan, 'ENTERPRISE_STANDARD_MONTHLY');

    const seededTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/role-templates',
      headers: {
        cookie
      }
    });
    assert.equal(seededTemplatesResponse.statusCode, 200);
    const seededTemplates = JSON.parse(seededTemplatesResponse.body).data as Array<{
      id: string;
      applicationType?: string;
      status?: string;
    }>;
    for (const factoryTemplateId of [
      'factory_cross_border_product_images_v1',
      'factory_medical_case_video_screening_v1'
    ]) {
      const seededFactory = seededTemplates.find((template) => template.id === factoryTemplateId);
      assert.ok(seededFactory, `${factoryTemplateId} must be available in the admin catalog`);
      assert.equal(seededFactory.applicationType, 'digital_factory');
      assert.equal(seededFactory.status, 'PUBLISHED');
    }

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
        tools: ['office-document'],
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
        workflowGraph: {
          version: '1.0.0',
          entryNodeId: 'start',
          nodes: [
            {
              id: 'start',
              type: 'start',
              name: 'Start',
              inputVariables: ['start.text', 'start.files'],
              outputVariables: ['start.text']
            },
            {
              id: 'receive_input',
              type: 'input',
              name: 'Receive Input',
              instruction: 'Confirm the requested template factory smoke test scope.',
              inputVariables: ['start.text', 'start.files'],
              outputVariables: ['task_brief']
            },
            {
              id: 'draft_result',
              type: 'llm',
              name: 'Draft Result',
              instruction: 'Return a concise validation result for the operator.',
              modelProfileId: 'qiu-general-default',
              inputVariables: ['task_brief'],
              outputVariables: ['draft_result.text']
            },
            {
              id: 'write_artifact',
              type: 'artifact',
              name: 'Write Deliverable',
              instruction: 'Write the final validation report as Markdown.',
              toolId: 'office-document',
              artifactType: 'markdown',
              inputVariables: ['draft_result.text'],
              outputVariables: ['deliverable_file'],
              config: {
                action: 'office.write_markdown_document',
                input: {
                  title: '{{start.text}}',
                  folder: 'documents',
                  fileName: 'template-factory-flow',
                  content: '{{draft_result.text}}'
                }
              }
            },
            {
              id: 'final_output',
              type: 'output',
              name: 'Final Output',
              instruction: 'Return the validation summary and generated artifact link.',
              inputVariables: ['draft_result.text', 'deliverable_file'],
              outputVariables: ['final_answer']
            }
          ],
          edges: [
            {
              id: 'start__receive_input',
              sourceNodeId: 'start',
              targetNodeId: 'receive_input',
              condition: { type: 'always' }
            },
            {
              id: 'receive_input__draft_result',
              sourceNodeId: 'receive_input',
              targetNodeId: 'draft_result',
              condition: { type: 'always' }
            },
            {
              id: 'draft_result__write_artifact',
              sourceNodeId: 'draft_result',
              targetNodeId: 'write_artifact',
              condition: { type: 'always' }
            },
            {
              id: 'write_artifact__final_output',
              sourceNodeId: 'write_artifact',
              targetNodeId: 'final_output',
              condition: { type: 'always' }
            }
          ]
        },
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

    const deletableTemplateId = `${templateId}_delete`;
    const createDeletableResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/role-templates',
      headers,
      payload: {
        id: deletableTemplateId,
        version: '1.0.0',
        name: 'AI Deletable Flow Tester',
        industry: 'Operations',
        scenario: 'Template deletion smoke test',
        description: 'Verifies unused templates can be removed from the platform catalog.',
        recommendedPlanCode: 'PERSONAL_FREE',
        businessGoal: 'Verify role template deletion before catalog cleanup.',
        knowledgeSources: [],
        tools: [],
        skills: [
          {
            code: 'deletable_flow_check',
            name: 'Deletable Flow Check',
            summary: 'Checks unused template deletion behavior.'
          }
        ],
        workflowSteps: [
          {
            id: 'receive_input',
            order: 1,
            type: 'input',
            name: 'Receive Input',
            instruction: 'Confirm the deletion smoke test scope.'
          },
          {
            id: 'deliver_output',
            order: 2,
            type: 'output',
            name: 'Deliver Output',
            instruction: 'Return a concise deletion validation result.'
          }
        ],
        sampleInputs: ['Please verify unused template deletion.'],
        outputFormat: 'Markdown checklist with deletion validation result.',
        approvalPolicy: 'Manual review is required before customer-facing output.',
        allowedPlanCodes: ['PERSONAL_FREE'],
        visibleWorkspaceIds: []
      }
    });
    assert.equal(createDeletableResponse.statusCode, 201);
    assert.deepEqual(
      JSON.parse(createDeletableResponse.body).data.allowedPlanCodes,
      [
        'PERSONAL_FREE',
        'ENTERPRISE_BASIC_MONTHLY',
        'ENTERPRISE_BASIC_ANNUAL',
        'ENTERPRISE_STANDARD_MONTHLY',
        'ENTERPRISE_STANDARD_ANNUAL',
        'ENTERPRISE_PRO_MONTHLY',
        'ENTERPRISE_PRO_ANNUAL',
        'ENTERPRISE_MONTHLY',
        'ENTERPRISE_ANNUAL',
        'ENTERPRISE_CUSTOM'
      ]
    );

    const deleteDeletableResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(deletableTemplateId)}`,
      headers: {
        cookie
      }
    });
    assert.equal(deleteDeletableResponse.statusCode, 200);
    assert.equal(JSON.parse(deleteDeletableResponse.body).data.id, deletableTemplateId);

    const deletedTemplateResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(deletableTemplateId)}`,
      headers: {
        cookie
      }
    });
    assert.equal(deletedTemplateResponse.statusCode, 404);

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
    assert.deepEqual(testResponseData.requiredToolActions, ['office.write_markdown_document']);
    assert.ok(testResponseData.graphTrace);
    assert.equal(testResponseData.graphTrace.pcCompatibility.status, 'passed');
    assert.ok(testResponseData.graphTrace.nodes.length >= 2);
    assert.ok(
      testResponseData.graphTrace.nodes.some(
        (node: { nodeId: string; inputPreview: string; outputPreview: string }) =>
          node.nodeId === 'receive_input' &&
          node.inputPreview.includes('Please verify the template factory flow.') &&
          node.outputPreview.length > 0
      )
    );
    assert.ok(
      testResponseData.graphTrace.nodes.some(
        (node: {
          nodeId: string;
          resolvedToolInput?: { action?: string; input?: Record<string, unknown> };
          toolCompatibility?: { status: string };
        }) =>
          node.nodeId === 'write_artifact' &&
          node.resolvedToolInput?.action === 'office.write_markdown_document' &&
          node.resolvedToolInput.input?.content &&
          node.toolCompatibility?.status === 'passed'
      )
    );

    const xlsxContentOnlyTemplateId = `${templateId}_xlsx_content_only`;
    const createBadXlsxResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/role-templates',
      headers,
      payload: {
        id: xlsxContentOnlyTemplateId,
        version: '1.0.0',
        name: 'AI Bad XLSX Tester',
        industry: 'Operations',
        scenario: 'Spreadsheet compatibility smoke test',
        description: 'Verifies spreadsheet artifact validation rejects content-only xlsx payloads.',
        recommendedPlanCode: 'PERSONAL_FREE',
        businessGoal: 'Catch spreadsheet templates that would generate bad PC artifacts.',
        knowledgeSources: [],
        tools: ['office-document'],
        skills: [
          {
            code: 'xlsx_contract_check',
            name: 'XLSX Contract Check',
            summary: 'Checks xlsx writer input contract.'
          }
        ],
        workflowSteps: [
          {
            id: 'receive_input',
            order: 1,
            type: 'input',
            name: 'Receive Input',
            instruction: 'Receive spreadsheet test input.'
          },
          {
            id: 'deliver_output',
            order: 2,
            type: 'output',
            name: 'Deliver Output',
            instruction: 'Return spreadsheet test output.'
          }
        ],
        workflowGraph: {
          version: '1.0.0',
          entryNodeId: 'start',
          nodes: [
            { id: 'start', type: 'start', name: 'Start' },
            {
              id: 'draft_table',
              type: 'llm',
              name: 'Draft Table',
              instruction: 'Return table text.',
              outputVariables: ['draft_text']
            },
            {
              id: 'write_xlsx',
              type: 'artifact',
              name: 'Write XLSX',
              toolId: 'office-document',
              artifactType: 'xlsx',
              inputVariables: ['draft_text'],
              outputVariables: ['deliverable_file'],
              config: {
                action: 'spreadsheet.write_xlsx',
                input: {
                  title: '{{task.title}}',
                  folder: 'spreadsheets',
                  fileName: 'bad-xlsx',
                  content: '{{draft_text}}'
                }
              }
            }
          ],
          edges: [
            { id: 'start__draft_table', sourceNodeId: 'start', targetNodeId: 'draft_table', condition: { type: 'always' } },
            { id: 'draft_table__write_xlsx', sourceNodeId: 'draft_table', targetNodeId: 'write_xlsx', condition: { type: 'always' } }
          ]
        },
        sampleInputs: ['Extract product name and price.'],
        outputFormat: 'XLSX table.',
        approvalPolicy: 'No approval required for smoke test.',
        allowedPlanCodes: ['PERSONAL_FREE'],
        visibleWorkspaceIds: []
      }
    });
    assert.equal(createBadXlsxResponse.statusCode, 201);

    const badXlsxTestResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(xlsxContentOnlyTemplateId)}/test`,
      headers,
      payload: {
        sampleInput: '整理商品名称和价格。'
      }
    });
    assert.equal(badXlsxTestResponse.statusCode, 201);
    const badXlsxTestData = JSON.parse(badXlsxTestResponse.body).data;
    assert.equal(badXlsxTestData.valid, false);
    assert.equal(badXlsxTestData.graphTrace.pcCompatibility.status, 'failed');
    assert.ok(
      badXlsxTestData.graphTrace.nodes.some(
        (node: { nodeId: string; toolCompatibility?: { status: string; message: string } }) =>
          node.nodeId === 'write_xlsx' &&
          node.toolCompatibility?.status === 'failed' &&
          node.toolCompatibility.message.includes('rows/sheets')
      )
    );

    const invalidFactoryTemplateId = `${templateId}_invalid_factory`;
    const createInvalidFactoryResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/role-templates',
      headers,
      payload: {
        id: invalidFactoryTemplateId,
        version: '1.0.0',
        applicationType: 'digital_factory',
        name: 'Invalid Product Image Factory',
        industry: 'Cross-border Ecommerce',
        scenario: 'Invalid factory publish smoke test',
        description: 'Verifies that digital factories cannot publish invalid package manifests.',
        recommendedPlanCode: 'PERSONAL_FREE',
        businessGoal: 'Validate digital factory publish guardrails.',
        knowledgeSources: [],
        tools: ['local-filesystem'],
        skills: [
          {
            code: 'invalid_factory_check',
            name: 'Invalid Factory Check',
            summary: 'Checks digital factory validation.'
          }
        ],
        workflowSteps: [
          {
            id: 'factory_input',
            order: 1,
            type: 'input',
            name: 'Factory Input',
            instruction: 'Receive factory request.'
          },
          {
            id: 'factory_output',
            order: 2,
            type: 'output',
            name: 'Factory Output',
            instruction: 'Return factory output.'
          }
        ],
        workflowGraph: {
          version: '1.0.0',
          entryNodeId: 'start',
          nodes: [
            { id: 'start', type: 'start', name: 'Start' },
            {
              id: 'factory_input',
              type: 'input',
              name: 'Factory Input',
              instruction: 'Receive factory request.',
              outputVariables: ['factory_request']
            },
            {
              id: 'factory_output',
              type: 'output',
              name: 'Factory Output',
              instruction: 'Return factory output.',
              inputVariables: ['factory_request'],
              outputVariables: ['final_answer']
            }
          ],
          edges: [
            { id: 'start__factory_input', sourceNodeId: 'start', targetNodeId: 'factory_input', condition: { type: 'always' } },
            { id: 'factory_input__factory_output', sourceNodeId: 'factory_input', targetNodeId: 'factory_output', condition: { type: 'always' } }
          ]
        },
        sampleInputs: ['Generate product images.'],
        outputFormat: 'ZIP image package.',
        approvalPolicy: 'No approval required for validation test.',
        allowedPlanCodes: ['PERSONAL_FREE'],
        visibleWorkspaceIds: [],
        dependencyManifest: {
          version: '1.0.0',
          applicationType: 'digital_factory',
          generatedAt: new Date().toISOString(),
          variables: [],
          modelAssets: [],
          toolActions: [],
          artifactTemplates: [],
          nodeTemplates: [],
          factory: {
            kind: 'cross_border_product_image_factory',
            batch: {
              maxItems: 51
            },
            packages: [
              {
                key: 'unsupported_package',
                label: 'Unsupported Package',
                outputType: 'image'
              }
            ]
          },
          warnings: []
        }
      }
    });
    assert.equal(createInvalidFactoryResponse.statusCode, 201);

    const invalidFactoryPublishResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(invalidFactoryTemplateId)}/publish`,
      headers,
      payload: {}
    });
    assert.equal(invalidFactoryPublishResponse.statusCode, 400);
    const invalidFactoryPublishData = JSON.parse(invalidFactoryPublishResponse.body);
    assert.equal(invalidFactoryPublishData.error.code, 'VALIDATION_ERROR');
    assert.ok(
      invalidFactoryPublishData.error.details.issues.some((issue: string) =>
        issue.includes('batch.maxItems')
      )
    );
    assert.ok(
      invalidFactoryPublishData.error.details.issues.some((issue: string) =>
        issue.includes('package key is invalid')
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
    const proOnlyDesktopTemplate = JSON.parse(proOnlyDesktopTemplatesResponse.body).data.find(
      (template: { id: string }) => template.id === templateId
    );
    assert.ok(proOnlyDesktopTemplate);
    assert.equal(proOnlyDesktopTemplate.canInstall, true);
    assert.ok(proOnlyDesktopTemplate.allowedPlanCodes.includes('PERSONAL_FREE'));

    const proOnlyPublicFreeTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });
    assert.equal(proOnlyPublicFreeTemplatesResponse.statusCode, 200);
    const proOnlyPublicTemplate = JSON.parse(proOnlyPublicFreeTemplatesResponse.body).data.find(
      (template: { id: string }) => template.id === templateId
    );
    assert.ok(proOnlyPublicTemplate);
    assert.equal(proOnlyPublicTemplate.canInstall, true);

    const privateFreeUpdateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}`,
      headers,
      payload: {
        recommendedPlanCode: 'PERSONAL_FREE',
        allowedPlanCodes: ['PERSONAL_FREE'],
        visibleWorkspaceIds: ['enterprise']
      }
    });
    assert.equal(privateFreeUpdateResponse.statusCode, 200);

    const privateFreeTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });
    assert.equal(privateFreeTemplatesResponse.statusCode, 200);
    assert.equal(
      JSON.parse(privateFreeTemplatesResponse.body).data.some(
        (template: { id: string }) => template.id === templateId
      ),
      false
    );

    const publicFreeUpdateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}`,
      headers,
      payload: {
        visibleWorkspaceIds: []
      }
    });
    assert.equal(publicFreeUpdateResponse.statusCode, 200);

    const publicFreeTemplatesResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });
    assert.equal(publicFreeTemplatesResponse.statusCode, 200);
    const publicFreeTemplate = JSON.parse(publicFreeTemplatesResponse.body).data.find(
      (template: { id: string }) => template.id === templateId
    );
    assert.ok(publicFreeTemplate);
    assert.equal(publicFreeTemplate.canInstall, true);
    assert.ok(publicFreeTemplate.allowedPlanCodes.includes('PERSONAL_FREE'));
    assert.ok(publicFreeTemplate.allowedPlanCodes.includes('ENTERPRISE_PRO_MONTHLY'));

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
    const desktopTemplate = JSON.parse(desktopTemplatesResponse.body).data.find(
      (template: { id: string }) => template.id === templateId
    );
    assert.equal(desktopTemplate?.workflowSteps.length, 2);
    assert.equal(desktopTemplate?.canInstall, true);

    const capacityFactoryTemplateIds = [
      'factory_cross_border_product_images_v1',
      'factory_medical_case_video_screening_v1'
    ];
    for (const factoryTemplateId of capacityFactoryTemplateIds) {
      const allowBasicFactoryResponse = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/role-templates/${encodeURIComponent(factoryTemplateId)}`,
        headers,
        payload: {
          recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
          allowedPlanCodes: ['ENTERPRISE_BASIC_MONTHLY']
        }
      });
      assert.equal(allowBasicFactoryResponse.statusCode, 200);
    }

    const factoryCapacityCatalogResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/workspaces/enterprise/desktop/role-templates',
      headers: {
        'x-qiuai-device-token': deviceToken
      }
    });
    assert.equal(factoryCapacityCatalogResponse.statusCode, 200);
    const factoryCapacityCatalog = JSON.parse(factoryCapacityCatalogResponse.body) as {
      data: Array<{ id: string; canInstall?: boolean }>;
      deviceCapacity?: { maxDigitalFactories?: number };
    };
    assert.equal(factoryCapacityCatalog.deviceCapacity?.maxDigitalFactories, 1);
    for (const factoryTemplateId of capacityFactoryTemplateIds) {
      assert.equal(
        factoryCapacityCatalog.data.find((template) => template.id === factoryTemplateId)?.canInstall,
        true
      );
    }

    const overFactoryCapacitySyncResponse = await app.inject({
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
              roleCode: 'factory-cross-border-product-images',
              version: '1.0.0',
              state: 'installed',
              installedAt: '2026-07-20T00:00:00.000Z',
              templateId: capacityFactoryTemplateIds[0],
              templateVersion: '1.0.0'
            },
            {
              roleCode: 'factory-medical-case-video-screening',
              version: '1.0.0',
              state: 'installed',
              installedAt: '2026-07-20T00:00:01.000Z',
              templateId: capacityFactoryTemplateIds[1],
              templateVersion: '1.0.0'
            }
          ],
          tools: [],
          tasks: [
            {
              taskId: 'task-factory-capacity-kept',
              roleCode: 'factory-cross-border-product-images',
              title: 'Factory capacity kept',
              state: 'completed',
              updatedAt: '2026-07-20T01:00:00.000Z'
            },
            {
              taskId: 'task-factory-capacity-filtered',
              roleCode: 'factory-medical-case-video-screening',
              title: 'Factory capacity filtered',
              state: 'completed',
              updatedAt: '2026-07-20T01:01:00.000Z'
            }
          ]
        }
      }
    });
    assert.equal(overFactoryCapacitySyncResponse.statusCode, 201);
    const overFactoryCapacitySync = store.getDesktopRuntimeSync(redeemedDevice.runtimeId);
    const overFactoryCapacitySnapshot = overFactoryCapacitySync?.runtimeSnapshot as
      | { rolePackages: Array<{ templateId?: string }>; tasks: Array<{ taskId: string }> }
      | undefined;
    assert.ok(overFactoryCapacitySnapshot);
    assert.deepEqual(
      overFactoryCapacitySnapshot.rolePackages.map((rolePackage) => rolePackage.templateId),
      [capacityFactoryTemplateIds[0], capacityFactoryTemplateIds[1]]
    );
    assert.equal(
      overFactoryCapacitySnapshot.tasks.some((task) => task.taskId === 'task-factory-capacity-kept'),
      true
    );
    assert.equal(
      overFactoryCapacitySnapshot.tasks.some((task) => task.taskId === 'task-factory-capacity-filtered'),
      true
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
    const downgradedDesktopTemplate = downgradedDesktopTemplates.find(
      (template: { id: string }) => template.id === templateId
    );
    assert.ok(downgradedDesktopTemplate);
    assert.equal(downgradedDesktopTemplate.canInstall, true);
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
      true
    );
    assert.equal(
      downgradedSnapshot.tasks.some((task) => task.taskId === 'task-downgraded-paid-role'),
      true
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

    const deleteInstalledTemplateResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/role-templates/${encodeURIComponent(templateId)}`,
      headers: {
        cookie
      }
    });
    assert.equal(deleteInstalledTemplateResponse.statusCode, 200);
    assert.equal(JSON.parse(deleteInstalledTemplateResponse.body).data.id, templateId);

    const templatesAfterDeleteResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/role-templates',
      headers: {
        cookie
      }
    });
    assert.equal(templatesAfterDeleteResponse.statusCode, 200);
    assert.equal(
      JSON.parse(templatesAfterDeleteResponse.body).data.some(
        (template: { id: string }) => template.id === templateId
      ),
      false
    );

    const desktopDeletedTemplateMarkersResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/workspaces/enterprise/desktop/role-templates?installedTemplateIds=${encodeURIComponent(templateId)}`,
      headers: {
        'x-qiuai-device-token': deviceToken
      }
    });
    assert.equal(desktopDeletedTemplateMarkersResponse.statusCode, 200);
    assert.deepEqual(
      JSON.parse(desktopDeletedTemplateMarkersResponse.body).deletedTemplateIds,
      [templateId]
    );
  } finally {
    await app.close();
  }
});

test('admin asset center manages standard asset definitions', async () => {
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

    const headers = {
      cookie: sessionCookie.split(';')[0],
      'content-type': 'application/json'
    };

    const listResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/assets?type=VARIABLE',
      headers
    });
    assert.equal(listResponse.statusCode, 200);
    const listedAssets = JSON.parse(listResponse.body).data;
    assert.ok(listedAssets.some((asset: { key: string }) => asset.key === 'task_text'));

    const assetKey = `custom_variable_${Date.now()}`;
    const createResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/assets',
      headers,
      payload: {
        type: 'VARIABLE',
        key: assetKey,
        name: 'Custom Variable',
        description: 'Custom variable for asset center smoke tests.',
        category: 'custom',
        schema: {
          valueType: 'text',
          usableIn: ['llm']
        },
        defaults: {},
        tags: ['custom'],
        sortOrder: 1999
      }
    });
    assert.equal(createResponse.statusCode, 201);
    const createdAsset = JSON.parse(createResponse.body).data;
    assert.equal(createdAsset.key, assetKey);
    assert.equal(createdAsset.status, 'ACTIVE');

    const updateResponse = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/assets/${encodeURIComponent(createdAsset.id)}`,
      headers,
      payload: {
        name: 'Updated Custom Variable',
        tags: ['custom', 'updated']
      }
    });
    assert.equal(updateResponse.statusCode, 200);
    const updatedAsset = JSON.parse(updateResponse.body).data;
    assert.equal(updatedAsset.name, 'Updated Custom Variable');
    assert.deepEqual(updatedAsset.tags, ['custom', 'updated']);

    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/api/v1/admin/assets/${encodeURIComponent(createdAsset.id)}`,
      headers: {
        cookie: headers.cookie
      }
    });
    assert.equal(deleteResponse.statusCode, 200);
    assert.equal(JSON.parse(deleteResponse.body).data.deleted, true);
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

test('desktop template authorization requires an explicit loopback local-development switch', async () => {
  const previousEnvironment = {
    persistenceMode: process.env.WORKOS_PERSISTENCE_MODE,
    deployTarget: process.env.WORKOS_DEPLOY_TARGET,
    appEnvironment: process.env.APP_ENV,
    nodeEnvironment: process.env.NODE_ENV,
    serverHost: process.env.SERVER_HOST,
    localUnlimited: process.env.WORKOS_LOCAL_DEV_UNLIMITED
  };

  process.env.WORKOS_PERSISTENCE_MODE = 'mock';
  process.env.WORKOS_DEPLOY_TARGET = 'local';
  process.env.APP_ENV = 'local';
  process.env.NODE_ENV = 'development';
  process.env.SERVER_HOST = '127.0.0.1';
  delete process.env.WORKOS_LOCAL_DEV_UNLIMITED;

  const app = await createApplication();
  app.useLogger(false);

  try {
    await app.init();
    const store = app.get(MockPlatformStore);
    const retiredTemplateId = retiredServerRoleTemplateIds[0];
    assert.ok(retiredTemplateId);
    const legacyTemplateSource = store.listRoleTemplates()[0];
    assert.ok(legacyTemplateSource);
    assert.ok(
      store.createRoleTemplate({
        ...legacyTemplateSource,
        id: retiredTemplateId,
        name: '退役测试数字员工',
        status: 'PUBLISHED',
        applicationType: 'DIGITAL_EMPLOYEE',
        allowedPlanCodes: ['PERSONAL_FREE'],
        visibleWorkspaceIds: [],
        publishedAt: new Date().toISOString()
      })
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });

    assert.equal(response.statusCode, 200);
    const freeCatalog = JSON.parse(response.body) as {
      data: Array<{ id: string; canInstall?: boolean }>;
    };
    assert.equal(freeCatalog.data.some((template) => template.id === retiredTemplateId), false);
    const retiredDeletedIdsResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/desktop/role-templates/free?installedTemplateIds=${encodeURIComponent(retiredTemplateId)}`
    });
    assert.equal(retiredDeletedIdsResponse.statusCode, 200);
    assert.ok(
      (JSON.parse(retiredDeletedIdsResponse.body).deletedTemplateIds as string[]).includes(
        retiredTemplateId
      )
    );
    const enterpriseFactory = freeCatalog.data.find(
      (template: { id: string }) => template.id === 'factory_cross_border_product_images_v1'
    );

    assert.ok(enterpriseFactory);
    assert.equal(enterpriseFactory.canInstall, false);

    process.env.WORKOS_LOCAL_DEV_UNLIMITED = 'true';
    process.env.SERVER_HOST = '0.0.0.0';
    const nonLoopbackResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });
    assert.equal(nonLoopbackResponse.statusCode, 200);
    assert.equal(
      (JSON.parse(nonLoopbackResponse.body).data as Array<{ id: string }>).some(
        (template) => template.id === retiredTemplateId
      ),
      false
    );
    assert.equal(
      JSON.parse(nonLoopbackResponse.body).data.find(
        (template: { id: string }) => template.id === 'factory_cross_border_product_images_v1'
      )?.canInstall,
      false
    );

    process.env.SERVER_HOST = '127.0.0.1';
    const unlimitedResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });
    assert.equal(unlimitedResponse.statusCode, 200);
    const unlimitedCatalog = JSON.parse(unlimitedResponse.body) as {
      data: Array<{ id: string; canInstall?: boolean }>;
      deviceCapacity?: unknown;
    };
    assert.equal(unlimitedCatalog.data.some((template) => template.id === retiredTemplateId), true);
    assert.equal(
      unlimitedCatalog.data.find(
        (template) => template.id === 'factory_cross_border_product_images_v1'
      )?.canInstall,
      true
    );
    assert.equal(unlimitedCatalog.deviceCapacity, undefined);

    const localBindingCodeResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/enterprise/desktop/binding-codes',
      headers: {
        cookie: 'mock-session=enterprise'
      },
      payload: {}
    });
    assert.equal(localBindingCodeResponse.statusCode, 201);
    const localBindingCode = JSON.parse(localBindingCodeResponse.body).data.bindingCode as string;

    const localRedeemResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/desktop/bindings/redeem',
      payload: {
        bindingCode: localBindingCode,
        runtimeId: 'local-unlimited-runtime',
        deviceId: 'local-unlimited-device',
        deviceName: 'Local Unlimited Desktop',
        platform: 'windows',
        appVersion: '1.1.0'
      }
    });
    assert.equal(localRedeemResponse.statusCode, 201);
    const localDeviceToken = JSON.parse(localRedeemResponse.body).data.deviceToken as string;

    const localSyncResponse = await app.inject({
      method: 'POST',
      url: '/api/v1/workspaces/enterprise/desktop/runtimes/sync',
      headers: {
        'content-type': 'application/json',
        'x-qiuai-device-token': localDeviceToken
      },
      payload: {
        data: {
          runtimeId: 'local-unlimited-runtime',
          deviceId: 'local-unlimited-device',
          deviceName: 'Local Unlimited Desktop',
          platform: 'windows',
          workspaceId: 'enterprise',
          appVersion: '1.1.0',
          rolePackages: [
            {
              roleCode: 'local-factory-a',
              templateId: 'factory_cross_border_product_images_v1',
              version: '1.0.0',
              state: 'running',
              installedAt: '2026-08-10T00:00:00.000Z',
              taskCount: 0
            },
            {
              roleCode: 'local-factory-b',
              templateId: 'factory_medical_case_video_screening_v1',
              version: '1.0.0',
              state: 'running',
              installedAt: '2026-08-10T00:00:00.000Z',
              taskCount: 0
            }
          ],
          tools: [],
          tasks: []
        }
      }
    });
    assert.equal(localSyncResponse.statusCode, 201);

    process.env.NODE_ENV = 'production';
    const productionResponse = await app.inject({
      method: 'GET',
      url: '/api/v1/desktop/role-templates/free'
    });
    assert.equal(productionResponse.statusCode, 200);
    assert.equal(
      JSON.parse(productionResponse.body).data.find(
        (template: { id: string }) => template.id === 'factory_cross_border_product_images_v1'
      )?.canInstall,
      false
    );
  } finally {
    await app.close();

    if (previousEnvironment.persistenceMode === undefined) {
      delete process.env.WORKOS_PERSISTENCE_MODE;
    } else {
      process.env.WORKOS_PERSISTENCE_MODE = previousEnvironment.persistenceMode;
    }

    if (previousEnvironment.deployTarget === undefined) {
      delete process.env.WORKOS_DEPLOY_TARGET;
    } else {
      process.env.WORKOS_DEPLOY_TARGET = previousEnvironment.deployTarget;
    }

    if (previousEnvironment.appEnvironment === undefined) {
      delete process.env.APP_ENV;
    } else {
      process.env.APP_ENV = previousEnvironment.appEnvironment;
    }

    if (previousEnvironment.nodeEnvironment === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousEnvironment.nodeEnvironment;
    }

    if (previousEnvironment.serverHost === undefined) {
      delete process.env.SERVER_HOST;
    } else {
      process.env.SERVER_HOST = previousEnvironment.serverHost;
    }

    if (previousEnvironment.localUnlimited === undefined) {
      delete process.env.WORKOS_LOCAL_DEV_UNLIMITED;
    } else {
      process.env.WORKOS_LOCAL_DEV_UNLIMITED = previousEnvironment.localUnlimited;
    }
  }
});
