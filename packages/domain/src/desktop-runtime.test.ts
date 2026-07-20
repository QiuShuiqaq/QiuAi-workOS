import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  validateLocalRuntimeContract,
  validateModelProfile,
  validateRolePackageManifest,
  validateToolManifest
} from './desktop-runtime';

describe('desktop runtime contracts', () => {
  test('validates a role package manifest', () => {
    const manifest = validateRolePackageManifest({
      roleCode: 'ai-ops-specialist',
      name: 'AI 运营专员',
      version: '1.0.0',
      summary: 'Handles content screening and publishing support.',
      modelProfileIds: ['general-cn', 'reasoning-cn'],
      toolIds: ['web-search', 'doc-editor'],
      requiredKnowledgeSources: ['local_folder', 'workspace_library'],
      defaultTaskTypes: ['content_screening', 'publish_review'],
      syncPolicy: 'summary_plus_metadata'
    });

    assert.deepEqual(manifest.modelProfileIds, ['general-cn', 'reasoning-cn']);
    assert.equal(manifest.syncPolicy, 'summary_plus_metadata');
  });

  test('rejects role packages without model profiles', () => {
    assert.throws(
      () =>
        validateRolePackageManifest({
          roleCode: 'ai-ops-specialist',
          name: 'AI 运营专员',
          version: '1.0.0',
          modelProfileIds: [],
          toolIds: ['web-search'],
          requiredKnowledgeSources: ['local_folder'],
          defaultTaskTypes: ['content_screening'],
          syncPolicy: 'summary_only'
        }),
      /must contain at least one model profile id/
    );
  });

  test('validates tool manifests', () => {
    const tool = validateToolManifest({
      id: 'web-search',
      name: '网页搜索',
      version: '1.0.0',
      scope: 'desktop',
      entryPoint: 'bridge',
      capabilities: ['web_search', 'browser_automation'],
      requiresApproval: true
    });

    assert.equal(tool.scope, 'desktop');
    assert.deepEqual(tool.capabilities, ['web_search', 'browser_automation']);
  });

  test('validates model profiles and local runtime contracts', () => {
    const modelProfile = validateModelProfile({
      id: 'general-cn',
      providerId: 'openai',
      providerName: 'OpenAI',
      modelName: 'gpt-4.1-mini',
      purpose: 'general',
      temperature: 0.3,
      maxTokens: 4096
    });

    const runtime = validateLocalRuntimeContract({
      runtimeId: 'runtime-001',
      deviceId: 'device-001',
      workspaceId: 'workspace-001',
      appVersion: '0.1.0',
      installedRoleCodes: ['ai-ops-specialist'],
      activeRoleCode: 'ai-ops-specialist',
      enabledToolIds: ['web-search'],
      enabledModelProfileIds: [modelProfile.id],
      knowledgeBindingIds: ['kb-local-001'],
      syncPolicy: 'summary_only'
    });

    assert.equal(modelProfile.modelName, 'gpt-4.1-mini');
    assert.equal(runtime.workspaceId, 'workspace-001');
  });
});
