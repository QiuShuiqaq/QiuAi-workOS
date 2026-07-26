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

console.log('Desktop model preset selection passed.');
