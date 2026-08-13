import assert from 'node:assert/strict';

import {
  createCustomCompatibleModelProfile,
  selectModelProfileForPreset
} from './desktop-model-presets.js';
import {
  inferModelCapabilitiesFromName,
  readModelCatalogEntryEffectiveCapabilities,
  modelProfileSupportsRequiredCapabilities
} from './desktop-model-capabilities.js';
import type { ModelProfile } from './desktop-contract.js';
import type { ModelProviderPreset } from './desktop-model-presets.js';

const deepSeekPreset: ModelProviderPreset = {
  id: 'deepseek',
  name: 'DeepSeek',
  summary: 'DeepSeek compatible endpoint.',
  apiBaseUrl: 'https://api.deepseek.com',
  models: [
    {
      label: 'DeepSeek V4 Flash',
      modelName: 'deepseek-v4-flash',
      purpose: 'general',
      temperature: 0.4,
      maxTokens: 4096
    },
    {
      label: 'DeepSeek V4 Pro',
      modelName: 'deepseek-v4-pro',
      purpose: 'reasoning',
      temperature: 0.2,
      maxTokens: 8192
    }
  ]
};

const openAiPreset: ModelProviderPreset = {
  id: 'openai',
  name: 'OpenAI',
  summary: 'OpenAI endpoint.',
  apiBaseUrl: 'https://api.openai.com/v1',
  models: [
    {
      label: 'GPT general',
      modelName: 'gpt-5.6-terra',
      purpose: 'general',
      temperature: 0.3,
      maxTokens: 4096
    }
  ]
};

const pendingGeneralProfile: ModelProfile = {
  id: 'qiu-general-default',
  providerId: 'provider-pending',
  providerName: 'Pending Model Provider',
  modelName: 'general-chat',
  purpose: 'general'
};

const firstSelection = selectModelProfileForPreset(
  [pendingGeneralProfile],
  deepSeekPreset,
  deepSeekPreset.models[0]
);

assert.ok(firstSelection);
assert.equal(firstSelection.profile.id, 'qiu-general-default');
assert.equal(firstSelection.profile.providerId, 'deepseek');
assert.equal(firstSelection.profile.modelName, 'deepseek-v4-flash');
assert.equal(firstSelection.profile.apiKey, undefined);

const configuredDeepSeekProfiles = firstSelection.modelProfiles.map((profile) =>
  profile.id === 'qiu-general-default' ? { ...profile, apiKey: 'deepseek-key' } : profile
);

const sameModelSelection = selectModelProfileForPreset(
  configuredDeepSeekProfiles,
  deepSeekPreset,
  deepSeekPreset.models[0]
);

assert.ok(sameModelSelection);
assert.equal(sameModelSelection.profile.id, 'qiu-general-default');
assert.equal(sameModelSelection.profile.apiKey, 'deepseek-key');
assert.equal(sameModelSelection.apiKeyPreserved, true);

const credentialManagedDeepSeekProfiles = firstSelection.modelProfiles.map((profile) =>
  profile.id === 'qiu-general-default' ? { ...profile, apiKey: undefined } : profile
);

const deepSeekProSelection = selectModelProfileForPreset(
  [
    ...credentialManagedDeepSeekProfiles,
    {
      id: 'qiu-reasoning-default',
      providerId: 'provider-pending',
      providerName: 'Pending Model Provider',
      modelName: 'reasoning-core',
      purpose: 'reasoning'
    }
  ],
  deepSeekPreset,
  deepSeekPreset.models[1]
);

assert.ok(deepSeekProSelection);
assert.equal(deepSeekProSelection.profile.id, 'qiu-reasoning-default');
assert.equal(deepSeekProSelection.profile.providerId, 'deepseek');
assert.equal(deepSeekProSelection.profile.modelName, 'deepseek-v4-pro');
assert.deepEqual(deepSeekProSelection.profile.capabilities, ['reasoning_text']);
assert.equal(
  deepSeekProSelection.modelProfiles.find((profile) => profile.id === 'qiu-general-default')?.modelName,
  'deepseek-v4-flash'
);

const preferredReasoningSelection = selectModelProfileForPreset(
  [
    {
      id: 'custom-reasoning-placeholder',
      providerId: 'provider-pending',
      providerName: 'Pending Model Provider',
      modelName: 'custom-reasoning',
      purpose: 'reasoning'
    },
    {
      id: 'qiu-reasoning-default',
      providerId: 'provider-pending',
      providerName: 'Pending Model Provider',
      modelName: 'reasoning-core',
      purpose: 'reasoning'
    }
  ],
  deepSeekPreset,
  deepSeekPreset.models[1],
  { preferredProfileId: 'qiu-reasoning-default' }
);

assert.ok(preferredReasoningSelection);
assert.equal(preferredReasoningSelection.profile.id, 'qiu-reasoning-default');
assert.equal(
  preferredReasoningSelection.modelProfiles.find((profile) => profile.id === 'custom-reasoning-placeholder')
    ?.providerId,
  'provider-pending'
);

const preferredReasoningWithExistingExactSelection = selectModelProfileForPreset(
  [
    {
      id: 'deepseek-deepseek-v4-pro-reasoning',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-v4-pro',
      purpose: 'reasoning',
      apiBaseUrl: 'https://api.deepseek.com'
    },
    {
      id: 'qiu-reasoning-default',
      providerId: 'provider-pending',
      providerName: 'Pending Model Provider',
      modelName: 'reasoning-core',
      purpose: 'reasoning'
    }
  ],
  deepSeekPreset,
  deepSeekPreset.models[1],
  { preferredProfileId: 'qiu-reasoning-default' }
);

assert.ok(preferredReasoningWithExistingExactSelection);
assert.equal(preferredReasoningWithExistingExactSelection.profile.id, 'qiu-reasoning-default');
assert.equal(preferredReasoningWithExistingExactSelection.profile.providerId, 'deepseek');
assert.equal(preferredReasoningWithExistingExactSelection.profile.modelName, 'deepseek-v4-pro');

const differentProviderSelection = selectModelProfileForPreset(
  configuredDeepSeekProfiles,
  openAiPreset,
  openAiPreset.models[0]
);

assert.ok(differentProviderSelection);
assert.notEqual(differentProviderSelection.profile.id, 'qiu-general-default');
assert.equal(differentProviderSelection.profile.providerId, 'openai');
assert.equal(differentProviderSelection.profile.apiKey, undefined);
assert.equal(
  differentProviderSelection.modelProfiles.find((profile) => profile.id === 'qiu-general-default')?.apiKey,
  'deepseek-key'
);

const differentProviderWithCredentialStoreSelection = selectModelProfileForPreset(
  credentialManagedDeepSeekProfiles,
  openAiPreset,
  openAiPreset.models[0]
);

assert.ok(differentProviderWithCredentialStoreSelection);
assert.notEqual(
  differentProviderWithCredentialStoreSelection.profile.id,
  'qiu-general-default'
);
assert.equal(
  differentProviderWithCredentialStoreSelection.modelProfiles.find(
    (profile) => profile.id === 'qiu-general-default'
  )?.providerId,
  'deepseek'
);

const firstCustomProfile = createCustomCompatibleModelProfile([], {
  providerName: 'GrsAI',
  modelName: 'gpt-image-2',
  purpose: 'vision',
  capabilities: ['text_to_image']
});
const secondCustomProfile = createCustomCompatibleModelProfile([firstCustomProfile], {
  providerName: 'GrsAI',
  modelName: 'nano-banana-2',
  purpose: 'vision',
  capabilities: ['image_to_image']
});

assert.equal(firstCustomProfile.providerName, 'GrsAI');
assert.equal(firstCustomProfile.modelName, 'gpt-image-2');
assert.deepEqual(firstCustomProfile.capabilities, ['image_generation']);
assert.equal(firstCustomProfile.providerId, 'custom-grsai');
assert.deepEqual(secondCustomProfile.capabilities, ['image_editing']);
assert.equal(secondCustomProfile.providerId, 'custom-grsai-2');
assert.notEqual(firstCustomProfile.id, secondCustomProfile.id);

const customReplacementSelection = selectModelProfileForPreset(
  [
    {
      ...firstCustomProfile,
      apiBaseUrl: 'https://grsai.example/v1'
    }
  ],
  {
    id: firstCustomProfile.providerId,
    name: 'GrsAI',
    summary: 'Custom compatible endpoint.',
    apiBaseUrl: 'https://grsai.example/v1',
    models: []
  },
  {
    label: 'nano-banana-2',
    modelName: 'nano-banana-2',
    purpose: 'vision',
    capabilities: ['image_to_image'],
    temperature: 0.4,
    maxTokens: 4096
  },
  { replaceProfileId: firstCustomProfile.id }
);

assert.ok(customReplacementSelection);
assert.equal(customReplacementSelection.modelProfiles.length, 1);
assert.equal(customReplacementSelection.profile.id, firstCustomProfile.id);
assert.equal(customReplacementSelection.profile.providerId, firstCustomProfile.providerId);
assert.equal(customReplacementSelection.profile.providerName, 'GrsAI');
assert.equal(customReplacementSelection.profile.modelName, 'nano-banana-2');
assert.deepEqual(customReplacementSelection.profile.capabilities, ['image_editing']);

assert.equal(
  modelProfileSupportsRequiredCapabilities(
    {
      id: 'deepseek-v4-flash',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-v4-flash',
      purpose: 'general',
      capabilities: ['text'],
      apiBaseUrl: 'https://api.deepseek.com',
      apiKey: 'deepseek-key'
    },
    ['image_understanding', 'vision_text', 'text']
  ),
  false
);
assert.equal(
  modelProfileSupportsRequiredCapabilities(firstCustomProfile, ['image_editing', 'image_to_image']),
  false
);
assert.equal(
  modelProfileSupportsRequiredCapabilities(secondCustomProfile, ['image_editing', 'image_to_image']),
  true
);

const aliyunAsrProfile: ModelProfile = {
  id: 'aliyun-qwen3-asr-flash-audio',
  providerId: 'aliyun-bailian',
  providerName: '阿里云百炼',
  modelName: 'qwen3-asr-flash',
  purpose: 'audio',
  capabilities: ['audio_to_text', 'text']
};

assert.equal(
  modelProfileSupportsRequiredCapabilities(aliyunAsrProfile, ['audio_to_text']),
  true
);
assert.equal(
  modelProfileSupportsRequiredCapabilities(aliyunAsrProfile, ['text']),
  false
);
assert.equal(
  modelProfileSupportsRequiredCapabilities(aliyunAsrProfile, ['reasoning_text', 'text']),
  false
);

assert.deepEqual(
  readModelCatalogEntryEffectiveCapabilities({
    id: 'mystery-2026',
    source: 'provider',
    capabilities: [],
    capabilityMetadata: { source: 'unknown', confidence: 'unknown' }
  }),
  []
);
assert.deepEqual(inferModelCapabilitiesFromName('mystery-2026', 'general'), ['text']);

console.log('Desktop model preset selection passed.');
