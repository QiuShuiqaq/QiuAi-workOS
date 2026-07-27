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
  'deepseek-v4-flash',
  'openai-gpt-5.6-terra'
]);
assert.deepEqual(readRequiredModelProfileIdsForRolePackage(rolePackage), [
  'qiu-general-default',
  'deepseek-v4-flash',
  'openai-gpt-5.6-terra'
]);

const moonshotProfile = createPlaceholderModelProfile('moonshot-v1-32k');
assert.equal(moonshotProfile.providerId, 'moonshot');
assert.equal(moonshotProfile.modelName, 'moonshot-v1-32k');
assert.equal(moonshotProfile.purpose, 'document');

const ensuredProfiles = ensureModelProfilesForRolePackage(existingProfiles, rolePackage);
assert.ok(ensuredProfiles.some((profile) => profile.id === 'deepseek-v4-flash'));
assert.ok(ensuredProfiles.some((profile) => profile.id === 'openai-gpt-5.6-terra'));
assert.equal(
  ensuredProfiles.find((profile) => profile.id === 'deepseek-v4-flash')?.providerName,
  'DeepSeek'
);
assert.equal(
  ensuredProfiles.find((profile) => profile.id === 'openai-gpt-5.6-terra')?.providerName,
  'OpenAI'
);
assert.equal(
  findFirstUnconfiguredRequiredModelProfileId(ensuredProfiles, rolePackage),
  'deepseek-v4-flash'
);

const configuredProfiles = ensuredProfiles.map((profile) =>
  profile.id === 'deepseek-v4-flash' || profile.id === 'openai-gpt-5.6-terra'
    ? { ...profile, apiKey: 'configured-key' }
    : profile
);
const statuses = getRoleModelRequirementStatuses(configuredProfiles, rolePackage);
assert.equal(statuses.every((status) => status.configured), true);
assert.equal(findFirstUnconfiguredRequiredModelProfileId(configuredProfiles, rolePackage), undefined);

const credentialManagedProfiles = configuredProfiles.map((profile) => ({
  ...profile,
  apiKey: undefined
}));
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
  credentialManagedStatuses.find((status) => status.profile.id === 'deepseek-v4-flash')?.configured,
  true
);
assert.equal(
  credentialManagedStatuses.find((status) => status.profile.id === 'openai-gpt-5.6-terra')?.configured,
  true
);

const runtimeStatuses = getRoleModelRuntimeRequirementStatuses(configuredProfiles, [
  'qiu-general-default',
  'deepseek-v4-flash'
], rolePackage);
assert.equal(
  runtimeStatuses.find((status) => status.profile.id === 'deepseek-v4-flash')?.ready,
  true
);
assert.equal(
  runtimeStatuses.find((status) => status.profile.id === 'openai-gpt-5.6-terra')?.issue,
  'disabled'
);
assert.equal(
  findFirstUnreadyRequiredModelProfileId(configuredProfiles, [
    'qiu-general-default',
    'deepseek-v4-flash'
  ], rolePackage),
  'openai-gpt-5.6-terra'
);
assert.equal(
  findFirstUnreadyRequiredModelProfileId(configuredProfiles, [
    'qiu-general-default',
    'deepseek-v4-flash',
    'openai-gpt-5.6-terra'
  ], rolePackage),
  undefined
);

console.log('Desktop role requirements passed.');
