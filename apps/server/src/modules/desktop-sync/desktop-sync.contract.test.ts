import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { parseDesktopRuntimeSyncRequest } from './desktop-sync.contract';

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
              knowledgeBindingIds: ['kb-local-folder']
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
});
