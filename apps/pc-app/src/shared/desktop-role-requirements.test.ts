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
import type { ModelCredential, ModelProfile, RoleModelCredentialBinding, RolePackageManifest } from './desktop-contract.js';

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

const legacyVideoFactoryManifestRolePackage: RolePackageManifest = {
  ...rolePackage,
  roleCode: 'legacy-video-factory',
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-07-29T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'qiu-asr-default',
        name: 'Legacy ASR Slot',
        providerId: 'provider-pending',
        providerName: 'Pending',
        modelId: 'qiu-asr-default',
        modelProfileId: 'qiu-asr-default',
        capabilities: ['text'],
        inputTypes: ['text'],
        outputTypes: ['text'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['screen_score_and_edit']
      },
      {
        key: 'qiu-general-default',
        name: 'Text Slot',
        providerId: 'provider-pending',
        providerName: 'Pending',
        modelId: 'qiu-general-default',
        modelProfileId: 'qiu-general-default',
        capabilities: ['text'],
        inputTypes: ['text'],
        outputTypes: ['text', 'json'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['screen_score_and_edit']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  }
};
assert.deepEqual(readRequiredModelProfileIdsForRolePackage(legacyVideoFactoryManifestRolePackage), [
  'qiu-general-default'
]);

const asrProfile = createPlaceholderModelProfile('qiu-asr-default');
assert.equal(asrProfile.purpose, 'audio');
assert.ok(asrProfile.capabilities?.includes('audio_to_text'));

assert.deepEqual(readRequiredModelProfileIdsForRolePackage(rolePackage), [
  'qiu-general-default'
]);

const explicitTextWorkflowWithStaleVideoManifestRolePackage: RolePackageManifest = {
  ...rolePackage,
  roleCode: 'ai-translation-polish',
  workflowGraph: {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'extract_parameters',
        type: 'llm',
        name: 'Extract parameters',
        config: { llmTaskType: 'structured_extraction' }
      },
      {
        id: 'analyze_work',
        type: 'llm',
        name: 'Analyze work',
        config: { llmTaskType: 'reasoning' }
      },
      {
        id: 'draft_deliverable',
        type: 'llm',
        name: 'Draft deliverable',
        config: { llmTaskType: 'text' }
      },
      {
        id: 'write_artifact',
        type: 'artifact',
        name: 'Write Word',
        artifactType: 'docx'
      }
    ],
    edges: []
  },
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-08-10T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'qiu-video-generation-default',
        name: 'Stale Video Slot',
        providerId: 'provider-pending',
        providerName: 'Pending',
        modelId: 'qiu-video-generation-default',
        modelProfileId: 'qiu-video-generation-default',
        capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
        inputTypes: ['text', 'image'],
        outputTypes: ['video'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['generate_videos']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  }
};
const explicitTextModelProfileIds = readRequiredModelProfileIdsForRolePackage(
  explicitTextWorkflowWithStaleVideoManifestRolePackage
);
assert.deepEqual(explicitTextModelProfileIds, [
  'qiu-general-default',
  'qiu-reasoning-default'
]);
assert.equal(explicitTextModelProfileIds.includes('qiu-video-generation-default'), false);
assert.equal(
  getRoleModelRequirementStatuses(
    [
      createPlaceholderModelProfile('qiu-general-default'),
      createPlaceholderModelProfile('qiu-reasoning-default'),
      createPlaceholderModelProfile('qiu-video-generation-default')
    ],
    explicitTextWorkflowWithStaleVideoManifestRolePackage
  ).some((status) => status.profile.id === 'qiu-video-generation-default'),
  false
);
const pollutedReasoningProfile: ModelProfile = {
  id: 'qiu-reasoning-default',
  providerId: 'minimax',
  providerName: 'MiniMax',
  modelName: 'MiniMax-Hailuo-2.3-Fast',
  purpose: 'vision',
  capabilities: ['video_generation', 'image_to_video'],
  apiBaseUrl: 'https://api.minimaxi.com/v1'
};
const pollutedReasoningStatuses = getRoleModelRuntimeRequirementStatuses(
  [
    createPlaceholderModelProfile('qiu-general-default'),
    pollutedReasoningProfile
  ],
  ['qiu-general-default', 'qiu-reasoning-default'],
  explicitTextWorkflowWithStaleVideoManifestRolePackage
);
const pollutedReasoningRequirement = pollutedReasoningStatuses.find(
  (status) => status.profile.id === 'qiu-reasoning-default'
);
assert.ok(pollutedReasoningRequirement);
assert.deepEqual(pollutedReasoningRequirement.profile.capabilities, [
  'reasoning_text'
]);
assert.equal(
  pollutedReasoningRequirement.profile.capabilities?.includes('video_generation'),
  false
);
assert.equal(pollutedReasoningRequirement.runtimeProfile?.id, 'qiu-reasoning-default');
assert.equal(pollutedReasoningRequirement.issue, 'incompatible');
const compatibleTextRuntimeProfile: ModelProfile = {
  id: 'deepseek-v4-flash',
  providerId: 'deepseek',
  providerName: 'DeepSeek',
  modelName: 'deepseek-v4-flash',
  purpose: 'general',
  capabilities: ['text'],
  apiBaseUrl: 'https://api.deepseek.com'
};
const fallbackReasoningStatuses = getRoleModelRuntimeRequirementStatuses(
  [
    createPlaceholderModelProfile('qiu-general-default'),
    pollutedReasoningProfile,
    compatibleTextRuntimeProfile
  ],
  ['qiu-general-default', 'qiu-reasoning-default', compatibleTextRuntimeProfile.id],
  explicitTextWorkflowWithStaleVideoManifestRolePackage,
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
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z'
      }
    ]
  }
);
const fallbackReasoningRequirement = fallbackReasoningStatuses.find(
  (status) => status.profile.id === 'qiu-reasoning-default'
);
assert.ok(fallbackReasoningRequirement);
assert.deepEqual(fallbackReasoningRequirement.profile.capabilities, [
  'reasoning_text'
]);
assert.equal(fallbackReasoningRequirement.runtimeProfile?.id, compatibleTextRuntimeProfile.id);
assert.equal(fallbackReasoningRequirement.ready, true);

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
const manifestDrivenRequirementStatus = getRoleModelRequirementStatuses(
  [createPlaceholderModelProfile('qiu-general-default')],
  manifestDrivenRolePackage
)[0];
assert.equal(
  manifestDrivenRequirementStatus?.profile.id,
  'qiu-general-default'
);
assert.deepEqual(
  manifestDrivenRequirementStatus?.requiredByNodeIds,
  ['classify', 'draft']
);

const visionManifestDrivenRolePackage: RolePackageManifest = {
  ...rolePackage,
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-07-29T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'openai-gpt-4o',
        name: 'OpenAI GPT-4o',
        providerId: 'openai',
        providerName: 'OpenAI',
        modelId: 'gpt-4o',
        modelProfileId: 'openai-gpt-4o',
        capabilities: ['vision_text', 'image_understanding', 'text'],
        inputTypes: ['text', 'image'],
        outputTypes: ['text', 'json'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['describe_image']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  }
};
assert.deepEqual(readRequiredModelProfileIdsForRolePackage(visionManifestDrivenRolePackage), [
  'qiu-general-default'
]);

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
  'qiu-general-default'
]);

const videoGenerationManifestDrivenRolePackage: RolePackageManifest = {
  ...rolePackage,
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-07-29T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'grsai-seedance-2.0',
        name: 'Seedance 2.0',
        providerId: 'grsai',
        providerName: 'GrsAI',
        modelId: 'seedance-2.0',
        modelProfileId: 'grsai-seedance-2.0',
        capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
        inputTypes: ['text', 'image'],
        outputTypes: ['video'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['generate_videos']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  }
};
assert.deepEqual(readRequiredModelProfileIdsForRolePackage(videoGenerationManifestDrivenRolePackage), [
  'qiu-general-default'
]);
const videoGenerationProfile = createPlaceholderModelProfile('qiu-video-generation-default');
assert.equal(videoGenerationProfile.purpose, 'vision');
assert.ok(videoGenerationProfile.capabilities?.includes('video_generation'));

const moonshotProfile = createPlaceholderModelProfile('moonshot-v1-32k');
assert.equal(moonshotProfile.providerId, 'moonshot');
assert.equal(moonshotProfile.modelName, 'moonshot-v1-32k');
assert.equal(moonshotProfile.purpose, 'document');

const ensuredProfiles = ensureModelProfilesForRolePackage(existingProfiles, rolePackage);
assert.ok(ensuredProfiles.some((profile) => profile.id === 'qiu-general-default'));
assert.equal(findFirstUnconfiguredRequiredModelProfileId(ensuredProfiles, rolePackage), 'qiu-general-default');

const configuredProfiles = ensuredProfiles;
const localProviderCredential: ModelCredential = {
  id: 'credential-default-provider-local',
  providerId: 'provider-local',
  providerName: 'Local Provider',
  label: 'Local Provider default',
  apiBaseUrl: 'https://model.example/v1',
  apiKey: 'test-key',
  isDefault: true,
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z'
};
const statuses = getRoleModelRequirementStatuses(configuredProfiles, rolePackage, {
  credentials: [localProviderCredential]
});
assert.equal(statuses.every((status) => status.configured), true);
assert.equal(
  findFirstUnconfiguredRequiredModelProfileId(configuredProfiles, rolePackage, {
    credentials: [localProviderCredential]
  }),
  undefined
);

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
], rolePackage, {
  credentials: [localProviderCredential]
});
assert.equal(
  runtimeStatuses.find((status) => status.profile.id === 'qiu-general-default')?.ready,
  true
);
assert.equal(
  findFirstUnreadyRequiredModelProfileId(configuredProfiles, [
    'qiu-general-default'
  ], rolePackage, {
    credentials: [localProviderCredential]
  }),
  undefined
);
assert.equal(
  findFirstUnreadyRequiredModelProfileId(configuredProfiles, [
    'qiu-general-default'
  ], rolePackage, {
    credentials: [localProviderCredential]
  }),
  undefined
);

const imageFactoryRolePackage: RolePackageManifest = {
  ...imageManifestDrivenRolePackage,
  roleCode: 'cross-border-image-factory',
  workflowGraph: {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'generate_images',
        type: 'llm',
        name: 'Generate images',
        inputVariables: ['start.images'],
        config: {
          llmTaskType: 'image_generation'
        }
      }
    ],
    edges: [
      {
        id: 'start-generate',
        sourceNodeId: 'start',
        targetNodeId: 'generate_images',
        condition: { type: 'always' }
      }
    ]
  },
  modelProfileIds: ['qiu-image-editing-default']
};
const imageEditingSlotProfile = createPlaceholderModelProfile('qiu-image-editing-default');
const grsaiImageProfile: ModelProfile = {
  id: 'custom-grsai-gpt-image-2-vision',
  providerId: 'custom-grsai',
  providerName: 'GrsAI',
  modelName: 'gpt-image-2',
  purpose: 'vision',
  capabilities: ['image_generation', 'image_to_image', 'image_editing'],
  apiBaseUrl: 'https://grsai.example/v1'
};
const grsaiDefaultCredential: ModelCredential = {
  id: 'credential-default-custom-grsai',
  providerId: 'custom-grsai',
  providerName: 'GrsAI',
  label: 'GrsAI default',
  apiBaseUrl: 'https://grsai.example/v1',
  apiKey: 'grsai-key',
  isDefault: true,
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z'
};
const grsaiRuntimeBinding: RoleModelCredentialBinding = {
  roleCode: imageFactoryRolePackage.roleCode,
  modelProfileId: 'qiu-image-editing-default',
  runtimeModelProfileId: grsaiImageProfile.id,
  mode: 'provider_default',
  updatedAt: '2026-07-27T00:00:00.000Z'
};
const imageFactoryRuntimeStatuses = getRoleModelRuntimeRequirementStatuses(
  [imageEditingSlotProfile, grsaiImageProfile],
  ['qiu-image-editing-default', grsaiImageProfile.id],
  imageFactoryRolePackage,
  {
    roleCode: imageFactoryRolePackage.roleCode,
    credentials: [grsaiDefaultCredential],
    roleBindings: [grsaiRuntimeBinding]
  }
);
const imageEditingStatus = imageFactoryRuntimeStatuses.find(
  (status) => status.profile.id === 'qiu-image-editing-default'
);
assert.equal(imageEditingStatus?.runtimeProfile?.id, grsaiImageProfile.id);
assert.equal(imageEditingStatus?.configured, true);
assert.equal(imageEditingStatus?.enabled, true);
assert.equal(imageEditingStatus?.ready, true);

const disabledRuntimeImageModel = findFirstUnreadyRequiredModelProfileId(
  [imageEditingSlotProfile, grsaiImageProfile],
  ['qiu-image-editing-default'],
  imageFactoryRolePackage,
  {
    roleCode: imageFactoryRolePackage.roleCode,
    credentials: [grsaiDefaultCredential],
    roleBindings: [grsaiRuntimeBinding]
  }
);
assert.equal(disabledRuntimeImageModel, grsaiImageProfile.id);

const incompatibleRuntimeBinding: RoleModelCredentialBinding = {
  ...grsaiRuntimeBinding,
  runtimeModelProfileId: 'deepseek-v4-flash'
};
const incompatibleRuntimeStatuses = getRoleModelRuntimeRequirementStatuses(
  [
    imageEditingSlotProfile,
    {
      id: 'deepseek-v4-flash',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-v4-flash',
      purpose: 'general',
      capabilities: ['text'],
      apiBaseUrl: 'https://api.deepseek.com',
      apiKey: 'deepseek-key'
    }
  ],
  ['qiu-image-editing-default', 'deepseek-v4-flash'],
  imageFactoryRolePackage,
  {
    roleCode: imageFactoryRolePackage.roleCode,
    roleBindings: [incompatibleRuntimeBinding]
  }
);
const incompatibleImageEditingStatus = incompatibleRuntimeStatuses.find(
  (status) => status.profile.id === 'qiu-image-editing-default'
);
assert.equal(incompatibleImageEditingStatus?.ready, false);
assert.equal(incompatibleImageEditingStatus?.issue, 'incompatible');

const misconfiguredVisionSlotProfile: ModelProfile = {
  ...createPlaceholderModelProfile('qiu-vision-default'),
  providerId: 'aliyun-bailian',
  providerName: '阿里云百炼',
  modelName: 'qwen3-asr-flash',
  capabilities: ['image_understanding', 'vision_text'],
  apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
};
const misconfiguredVisionStatuses = getRoleModelRuntimeRequirementStatuses(
  [misconfiguredVisionSlotProfile],
  ['qiu-vision-default'],
  {
    ...visionManifestDrivenRolePackage,
    roleCode: 'vision-slot-misconfigured',
    modelProfileIds: ['qiu-vision-default'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'describe_image',
          type: 'llm',
          name: 'Describe image',
          inputVariables: ['start.images'],
          config: {
            llmTaskType: 'vision'
          }
        }
      ],
      edges: [
        {
          id: 'start-describe',
          sourceNodeId: 'start',
          targetNodeId: 'describe_image',
          condition: { type: 'always' }
        }
      ]
    }
  },
  {
    roleCode: 'vision-slot-misconfigured'
  }
);
const misconfiguredVisionStatus = misconfiguredVisionStatuses.find(
  (status) => status.profile.id === 'qiu-vision-default'
);
assert.equal(misconfiguredVisionStatus?.ready, false);
assert.equal(misconfiguredVisionStatus?.issue, 'incompatible');

console.log('Desktop role requirements passed.');
