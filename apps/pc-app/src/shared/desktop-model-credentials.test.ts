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

const runtimeOverrideBinding: RoleModelCredentialBinding = {
  roleCode: 'image-factory',
  modelProfileId: 'qiu-image-editing-default',
  runtimeModelProfileId: 'deepseek-v4-flash',
  mode: 'inline',
  apiBaseUrl: 'https://runtime.example/v1',
  apiKey: 'runtime-inline-key',
  updatedAt: '2026-07-27T00:03:00.000Z'
};

const runtimeResolution = resolveModelProfileCredential({
  profile,
  roleCode: 'image-factory',
  credentials: [defaultCredential],
  roleBindings: [runtimeOverrideBinding]
});
assert.equal(runtimeResolution.profile.apiBaseUrl, 'https://runtime.example/v1');
assert.equal(runtimeResolution.profile.apiKey, 'runtime-inline-key');

const qwenProfile: ModelProfile = {
  id: 'dashscope-qwen-vl-max-vision',
  providerId: 'dashscope',
  providerName: '通义千问',
  modelName: 'qwen-vl-max',
  purpose: 'vision',
  capabilities: ['image_understanding', 'vision_text'],
  apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
};
const aliyunCredential: ModelCredential = {
  id: 'credential-default-aliyun-bailian',
  providerId: 'aliyun-bailian',
  providerName: '阿里云',
  label: '阿里云默认 Key',
  apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: 'aliyun-key',
  isDefault: true,
  createdAt: '2026-07-27T00:04:00.000Z',
  updatedAt: '2026-07-27T00:04:00.000Z'
};

const qwenAliyunResolution = resolveModelProfileCredential({
  profile: qwenProfile,
  credentials: [aliyunCredential]
});
assert.equal(qwenAliyunResolution.profile.apiKey, 'aliyun-key');
assert.equal(qwenAliyunResolution.credential?.providerId, 'aliyun-bailian');

assert.equal(
  resolveModelProfileCredential({
    profile: {
      ...qwenProfile,
      apiKey: 'legacy-shadow-key'
    },
    credentials: []
  }).configured,
  false
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

const aliasedLegacyCredentials = migrateLegacyModelProfileCredentials({
  modelProfiles: [
    {
      id: 'aliyun-qwen3-asr-flash-audio',
      providerId: 'aliyun-bailian',
      providerName: '阿里云',
      modelName: 'qwen3-asr-flash',
      purpose: 'audio',
      apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'aliyun-legacy-key'
    },
    {
      ...qwenProfile,
      apiKey: 'qwen-legacy-key'
    }
  ]
});

assert.equal(aliasedLegacyCredentials.length, 1);
assert.equal(aliasedLegacyCredentials[0]?.providerId, 'aliyun-bailian');

console.log('Desktop model credentials passed.');
