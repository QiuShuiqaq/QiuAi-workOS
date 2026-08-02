import assert from 'node:assert/strict';

import {
  createPlaceholderModelProfile,
  ensureModelProfilesForRolePackage,
  findFirstUnconfiguredRequiredModelProfileId,
  findFirstUnreadyRequiredModelProfileId,
  getRoleModelRequirementStatuses,
  getRoleModelRuntimeRequirementStatuses,
  readRequiredModelProfileIdsForRolePackage,
  readWorkflowRequiredModelProfileIds
} from './desktop-role-requirements.js';
import type { ModelProfile, RolePackageManifest } from './desktop-contract.js';

const rolePackage: RolePackageManifest = {
  roleCode: 'ai-test-role',
  name: 'AI Test Role',
  version: '1.0.0',
  workflowGraph: {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'classify',
        type: 'llm',
        name: 'Classify request',
        modelProfileId: 'deepseek-v4-flash'
      },
      {
        id: 'draft',
        type: 'llm',
        name: 'Draft result',
        modelProfileId: 'openai-gpt-5.6-terra'
      }
    ],
    edges: [
      {
        id: 'start-classify',
        sourceNodeId: 'start',
        targetNodeId: 'classify',
        condition: { type: 'always' }
      },
      {
        id: 'classify-draft',
        sourceNodeId: 'classify',
        targetNodeId: 'draft',
        condition: { type: 'always' }
      }
    ]
  },
  modelProfileIds: ['qiu-general-default'],
  toolIds: [],
  requiredKnowledgeSources: [],
  defaultTaskTypes: ['test'],
  syncPolicy: 'summary_only'
};

const existingProfiles: ModelProfile[] = [
  {
    id: 'qiu-general-default',
    providerId: 'provider-local',
    providerName: 'Local Provider',
    modelName: 'general-chat',
    purpose: 'general',
    apiBaseUrl: 'https://model.example/v1',
    apiKey: 'test-key'
  }
];

assert.deepEqual(readWorkflowRequiredModelProfileIds(rolePackage.workflowGraph), [
  'qiu-general-default'
]);

const videoFactoryWorkflowGraph = {
  version: '1.0.0',
  entryNodeId: 'start',
  nodes: [
    { id: 'start', type: 'start', name: 'Start' },
    {
      id: 'screen_score_and_edit',
      type: 'llm',
      name: 'Screen videos',
      modelProfileId: 'qiu-general-default',
      config: {
        requiredModelProfileIds: ['qiu-asr-default']
      }
    }
  ],
  edges: [
    {
      id: 'start-screen',
      sourceNodeId: 'start',
      targetNodeId: 'screen_score_and_edit',
      condition: { type: 'always' }
    }
  ]
} satisfies RolePackageManifest['workflowGraph'];
assert.deepEqual(readWorkflowRequiredModelProfileIds(videoFactoryWorkflowGraph), [
  'qiu-general-default',
  'qiu-asr-default'
]);

const asrProfile = createPlaceholderModelProfile('qiu-asr-default');
assert.equal(asrProfile.purpose, 'audio');
assert.ok(asrProfile.capabilities?.includes('audio_to_text'));

assert.deepEqual(readRequiredModelProfileIdsForRolePackage(rolePackage), [
  'qiu-general-default'
]);

const manifestDrivenRolePackage: RolePackageManifest = {
  ...rolePackage,
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-07-29T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'deepseek-v4-pro',
        name: 'DeepSeek V4 Pro',
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        modelId: 'deepseek-v4-pro',
        modelProfileId: 'deepseek-v4-pro',
        capabilities: ['reasoning', 'text'],
        inputTypes: ['text'],
        outputTypes: ['text'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['classify']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  }
};
assert.deepEqual(readRequiredModelProfileIdsForRolePackage(manifestDrivenRolePackage), [
  'qiu-general-default'
]);
assert.deepEqual(
  getRoleModelRequirementStatuses(
    [createPlaceholderModelProfile('qiu-general-default')],
    manifestDrivenRolePackage
  )[0]?.requiredByNodeIds,
  ['classify']
);

const imageManifestDrivenRolePackage: RolePackageManifest = {
  ...rolePackage,
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-07-29T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'openai-gpt-image-2',
        name: 'OpenAI GPT Image 2',
        providerId: 'openai',
        providerName: 'OpenAI',
        modelId: 'gpt-image-2',
        modelProfileId: 'openai-gpt-image-2',
        capabilities: ['image_generation', 'image_editing'],
        inputTypes: ['text', 'image'],
        outputTypes: ['image'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['generate_images']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  }
};
assert.deepEqual(readRequiredModelProfileIdsForRolePackage(imageManifestDrivenRolePackage), [
  'qiu-image-editing-default'
]);

const moonshotProfile = createPlaceholderModelProfile('moonshot-v1-32k');
assert.equal(moonshotProfile.providerId, 'moonshot');
assert.equal(moonshotProfile.modelName, 'moonshot-v1-32k');
assert.equal(moonshotProfile.purpose, 'document');

const ensuredProfiles = ensureModelProfilesForRolePackage(existingProfiles, rolePackage);
assert.ok(ensuredProfiles.some((profile) => profile.id === 'qiu-general-default'));
assert.equal(findFirstUnconfiguredRequiredModelProfileId(ensuredProfiles, rolePackage), undefined);

const configuredProfiles = ensuredProfiles;
const statuses = getRoleModelRequirementStatuses(configuredProfiles, rolePackage);
assert.equal(statuses.every((status) => status.configured), true);
assert.equal(findFirstUnconfiguredRequiredModelProfileId(configuredProfiles, rolePackage), undefined);

const credentialManagedProfiles = configuredProfiles.map((profile) => ({
  ...profile,
  apiKey: undefined
})).concat([
  {
    id: 'deepseek-v4-flash',
    providerId: 'deepseek',
    providerName: 'DeepSeek',
    modelName: 'deepseek-v4-flash',
    purpose: 'general',
    capabilities: ['text'],
    apiBaseUrl: 'https://api.deepseek.com',
    apiKey: undefined
  }
]);
const credentialManagedStatuses = getRoleModelRequirementStatuses(
  credentialManagedProfiles,
  rolePackage,
  {
    credentials: [
      {
        id: 'credential-default-deepseek',
        providerId: 'deepseek',
        providerName: 'DeepSeek',
        label: 'DeepSeek default',
        apiBaseUrl: 'https://api.deepseek.com',
        apiKey: 'deepseek-key',
        isDefault: true,
        createdAt: '2026-07-27T00:00:00.000Z',
        updatedAt: '2026-07-27T00:00:00.000Z'
      },
      {
        id: 'credential-default-openai',
        providerId: 'openai',
        providerName: 'OpenAI',
        label: 'OpenAI default',
        apiBaseUrl: 'https://api.openai.com/v1',
        apiKey: 'openai-key',
        isDefault: true,
        createdAt: '2026-07-27T00:00:00.000Z',
        updatedAt: '2026-07-27T00:00:00.000Z'
      }
    ]
  }
);
assert.equal(
  credentialManagedStatuses.find((status) => status.profile.id === 'qiu-general-default')?.configured,
  true
);

const runtimeStatuses = getRoleModelRuntimeRequirementStatuses(configuredProfiles, [
  'qiu-general-default'
], rolePackage);
assert.equal(
  runtimeStatuses.find((status) => status.profile.id === 'qiu-general-default')?.ready,
  true
);
assert.equal(
  findFirstUnreadyRequiredModelProfileId(configuredProfiles, [
    'qiu-general-default'
  ], rolePackage),
  undefined
);
assert.equal(
  findFirstUnreadyRequiredModelProfileId(configuredProfiles, [
    'qiu-general-default'
  ], rolePackage),
  undefined
);

console.log('Desktop role requirements passed.');
