import assert from 'node:assert/strict';

import { selectModelProfileForPreset } from './desktop-model-presets.js';
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
assert.deepEqual(deepSeekProSelection.profile.capabilities, ['reasoning_text', 'text']);
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

console.log('Desktop model preset selection passed.');
