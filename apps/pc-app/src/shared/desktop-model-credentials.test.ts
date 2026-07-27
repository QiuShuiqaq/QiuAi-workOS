import assert from 'node:assert/strict';

import {
  migrateLegacyModelProfileCredentials,
  resolveModelProfileCredential
} from './desktop-model-credentials.js';
import type {
  ModelCredential,
  ModelProfile,
  RoleModelCredentialBinding
} from './desktop-contract.js';

const profile: ModelProfile = {
  id: 'deepseek-v4-flash',
  providerId: 'deepseek',
  providerName: 'DeepSeek',
  modelName: 'deepseek-v4-flash',
  purpose: 'general',
  apiBaseUrl: 'https://api.deepseek.com'
};

const defaultCredential: ModelCredential = {
  id: 'credential-default-deepseek',
  providerId: 'deepseek',
  providerName: 'DeepSeek',
  label: 'DeepSeek 默认 Key',
  apiBaseUrl: 'https://api.deepseek.com',
  apiKey: 'default-key',
  isDefault: true,
  createdAt: '2026-07-27T00:00:00.000Z',
  updatedAt: '2026-07-27T00:00:00.000Z'
};

assert.equal(
  resolveModelProfileCredential({
    profile,
    credentials: [defaultCredential]
  }).profile.apiKey,
  'default-key'
);

const inlineBinding: RoleModelCredentialBinding = {
  roleCode: 'sales-agent',
  modelProfileId: 'deepseek-v4-flash',
  mode: 'inline',
  apiKey: 'inline-key',
  updatedAt: '2026-07-27T00:01:00.000Z'
};

assert.equal(
  resolveModelProfileCredential({
    profile,
    roleCode: 'sales-agent',
    credentials: [defaultCredential],
    roleBindings: [inlineBinding]
  }).profile.apiKey,
  'inline-key'
);

const namedCredential: ModelCredential = {
  ...defaultCredential,
  id: 'credential-deepseek-sales',
  label: '销售员工专用 Key',
  apiKey: 'named-key',
  isDefault: false
};
const refBinding: RoleModelCredentialBinding = {
  roleCode: 'sales-agent',
  modelProfileId: 'deepseek-v4-flash',
  mode: 'credential_ref',
  credentialId: 'credential-deepseek-sales',
  updatedAt: '2026-07-27T00:02:00.000Z'
};

assert.equal(
  resolveModelProfileCredential({
    profile,
    roleCode: 'sales-agent',
    credentials: [defaultCredential, namedCredential],
    roleBindings: [refBinding]
  }).profile.apiKey,
  'named-key'
);

const legacyCredentials = migrateLegacyModelProfileCredentials({
  modelProfiles: [
    {
      ...profile,
      apiKey: 'legacy-key'
    }
  ]
});

assert.equal(legacyCredentials.length, 1);
assert.equal(legacyCredentials[0]?.apiKey, 'legacy-key');

console.log('Desktop model credentials passed.');
