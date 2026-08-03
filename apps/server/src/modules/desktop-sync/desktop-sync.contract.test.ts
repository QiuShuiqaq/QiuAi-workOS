import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  parseCreateDesktopBindingCodeRequest,
  parseCreateDesktopIssueReportRequest,
  parseDesktopRuntimeSyncRequest,
  parseRedeemDesktopBindingCodeRequest
} from './desktop-sync.contract';

describe('desktop runtime sync contract', () => {
  test('parses a valid runtime snapshot payload', () => {
    const request = parseDesktopRuntimeSyncRequest({
      data: {
        runtimeId: 'runtime-001',
        deviceId: 'device-001',
        deviceName: 'qiuai-pc',
        platform: 'windows',
        workspaceId: 'workspace-001',
        appVersion: '0.1.0',
        lastSyncedAt: '2026-07-20T01:00:00.000Z',
        rolePackages: [
          {
            roleCode: 'ai-ops',
            version: '1.0.0',
            state: 'running',
            installedAt: '2026-07-20T00:00:00.000Z',
            taskCount: 1,
            templateId: 'template_case_ops',
            templateVersion: '1.0.0',
            skills: [
              {
                code: 'case_screening',
                name: 'Case Screening',
                summary: 'Screen case materials.'
              }
            ]
          }
        ],
        tools: [
          {
            toolId: 'web-search',
            enabled: true
          }
        ],
        tasks: [
          {
            taskId: 'task-001',
            roleCode: 'ai-ops',
            title: '内容筛选',
            state: 'completed',
            updatedAt: '2026-07-20T01:00:00.000Z',
            artifactCount: 1,
            costCents: 320,
            executionContext: {
              modelProfileIds: ['qiu-general-default'],
              toolIds: ['web-search'],
              knowledgeBindingIds: ['kb-local-folder'],
              useKnowledge: false
            }
          }
        ]
      }
    });

    assert.equal(request.data.runtimeId, 'runtime-001');
    assert.equal(request.data.rolePackages[0].skills?.[0].code, 'case_screening');
    assert.equal(request.data.tools[0].enabled, true);
    assert.equal(request.data.tasks[0].state, 'completed');
    assert.equal(request.data.tasks[0].executionContext?.toolIds.length, 1);
    assert.equal(request.data.tasks[0].executionContext?.useKnowledge, false);
  });

  test('rejects malformed runtime snapshot payloads', () => {
    assert.throws(
      () =>
        parseDesktopRuntimeSyncRequest({
          data: {
            runtimeId: 'runtime-001'
          }
        }),
      /desktopRuntimeSnapshot\.deviceId/
    );
  });

  test('parses desktop binding code requests', () => {
    assert.deepEqual(parseCreateDesktopBindingCodeRequest({}), {});
    assert.deepEqual(parseCreateDesktopBindingCodeRequest({ expiresInMinutes: 10 }), {
      expiresInMinutes: 10
    });
    assert.deepEqual(parseCreateDesktopBindingCodeRequest({ label: '财务电脑', expiresInMinutes: 1440 }), {
      label: '财务电脑',
      expiresInMinutes: 1440
    });
  });

  test('parses desktop binding redeem requests', () => {
    const request = parseRedeemDesktopBindingCodeRequest({
      bindingCode: 'QIU-ABCD-EFGH',
      runtimeId: 'runtime-001',
      deviceId: 'device-001',
      deviceName: 'desktop-001',
      platform: 'windows',
      appVersion: '1.0.0'
    });

    assert.equal(request.bindingCode, 'QIU-ABCD-EFGH');
    assert.equal(request.platform, 'windows');
  });

  test('parses desktop issue reports and enforces field limits', () => {
    const request = parseCreateDesktopIssueReportRequest({
      category: 'BUG',
      severity: 'BLOCKING',
      title: '任务运行失败',
      description: '提交任务后服务端返回错误。',
      diagnostics: {
        connectionState: 'online',
        logs: [{ level: 'error', message: 'failed' }]
      }
    });

    assert.equal(request.category, 'BUG');
    assert.equal(request.severity, 'BLOCKING');
    assert.equal(request.diagnostics?.connectionState, 'online');
    assert.throws(
      () =>
        parseCreateDesktopIssueReportRequest({
          category: 'BUG',
          severity: 'NORMAL',
          title: 'x'.repeat(121),
          description: 'description'
        }),
      /desktopIssueReport\.title/
    );
  });
});
