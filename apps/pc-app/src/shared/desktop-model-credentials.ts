import type {
  ModelCredential,
  ModelProviderCatalog,
  ModelProfile,
  RoleModelCredentialBinding
} from './desktop-contract.js';

export interface ModelCredentialResolutionInput {
  profile: ModelProfile;
  roleCode?: string;
  credentials?: ModelCredential[];
  roleBindings?: RoleModelCredentialBinding[];
}

export interface ModelCredentialResolution {
  profile: ModelProfile;
  source: 'official_points' | 'role_inline' | 'credential_ref' | 'provider_default' | 'missing';
  credential?: ModelCredential;
  binding?: RoleModelCredentialBinding;
  configured: boolean;
}

const providerCredentialAliasGroups = [
  ['aliyun-bailian', 'aliyun-asr-compatible', 'dashscope'],
  ['tencent-cloud', 'tencent-asr-compatible']
];
const minimaxLegacyApiHost = 'api.minimax.io';
const minimaxChinaApiBaseUrl = 'https://api.minimaxi.com/v1';

export function resolveModelProfileCredential(
  input: ModelCredentialResolutionInput
): ModelCredentialResolution {
  if (isOfficialPointsModelProfile(input.profile)) {
    return {
      profile: input.profile,
      source: 'official_points',
      configured: true
    };
  }

  const credentials = input.credentials ?? [];
  const roleBindings = input.roleBindings ?? [];
  const roleBinding = input.roleCode
    ? findRoleBindingForModelProfile(roleBindings, input.roleCode, input.profile.id)
    : undefined;

  if (roleBinding?.mode === 'inline' && roleBinding.apiKey?.trim()) {
    return {
      profile: applyCredentialFields(input.profile, {
        apiBaseUrl: roleBinding.apiBaseUrl,
        apiKey: roleBinding.apiKey
      }),
      source: 'role_inline',
      binding: roleBinding,
      configured: true
    };
  }

  if (roleBinding?.mode === 'credential_ref' && roleBinding.credentialId) {
    const credential = credentials.find(
      (item) =>
        item.id === roleBinding.credentialId &&
        providerIdsShareCredentialScope(item.providerId, input.profile.providerId) &&
        item.apiKey.trim()
    );

    if (credential) {
      return {
        profile: applyCredentialFields(input.profile, credential),
        source: 'credential_ref',
        credential,
        binding: roleBinding,
        configured: true
      };
    }
  }

  const defaultCredential = findDefaultModelCredential(
    credentials,
    input.profile.providerId
  );

  if (defaultCredential) {
    return {
      profile: applyCredentialFields(input.profile, defaultCredential),
      source: 'provider_default',
      credential: defaultCredential,
      binding: roleBinding,
      configured: true
    };
  }

  return {
    profile: input.profile,
    source: 'missing',
    binding: roleBinding,
    configured: false
  };
}

export function isOfficialPointsModelProfile(profile: ModelProfile): boolean {
  return profile.billingMode === 'official_points' && Boolean(profile.officialRouteKey?.trim());
}

function findRoleBindingForModelProfile(
  roleBindings: RoleModelCredentialBinding[],
  roleCode: string,
  profileId: string
): RoleModelCredentialBinding | undefined {
  const directBinding = roleBindings.find(
    (binding) =>
      binding.roleCode === roleCode &&
      binding.modelProfileId === profileId
  );
  if (directBinding) {
    return directBinding;
  }

  return roleBindings.find(
    (binding) =>
      binding.roleCode === roleCode &&
      binding.runtimeModelProfileId === profileId
  );
}

export function isModelProfileConfiguredByCredentials(
  input: ModelCredentialResolutionInput
): boolean {
  return resolveModelProfileCredential(input).configured;
}

export function findDefaultModelCredential(
  credentials: ModelCredential[],
  providerId: string
): ModelCredential | undefined {
  const exactCredential = credentials.find(
    (credential) =>
      credential.providerId === providerId &&
      credential.isDefault &&
      credential.apiKey.trim()
  );
  if (exactCredential) {
    return exactCredential;
  }

  return credentials.find(
    (credential) =>
      providerIdsShareCredentialScope(credential.providerId, providerId) &&
      credential.isDefault &&
      credential.apiKey.trim()
  );
}

export function listProviderModelCredentials(
  credentials: ModelCredential[],
  providerId: string
): ModelCredential[] {
  return credentials.filter(
    (credential) => providerIdsShareCredentialScope(credential.providerId, providerId) && credential.apiKey.trim()
  );
}

export function createDefaultCredentialId(providerId: string): string {
  return `credential-default-${slugifyCredentialId(providerId)}`;
}

export function createCredentialId(providerId: string): string {
  return `credential-${slugifyCredentialId(providerId)}-${Date.now()}`;
}

export function migrateLegacyModelProfileCredentials(input: {
  modelProfiles: ModelProfile[];
  credentials?: ModelCredential[];
}): ModelCredential[] {
  const credentials = [...(input.credentials ?? [])];
  const defaultProviderIds = new Set(
    credentials
      .filter((credential) => credential.isDefault)
      .map((credential) => credential.providerId)
  );

  for (const profile of input.modelProfiles) {
    const apiKey = profile.apiKey?.trim();
    if (
      !apiKey ||
      [...defaultProviderIds].some((providerId) =>
        providerIdsShareCredentialScope(providerId, profile.providerId)
      )
    ) {
      continue;
    }

    const now = new Date().toISOString();
    credentials.push({
      id: createDefaultCredentialId(profile.providerId),
      providerId: profile.providerId,
      providerName: profile.providerName,
      label: `${profile.providerName} 默认 Key`,
      apiBaseUrl: profile.apiBaseUrl,
      apiKey,
      isDefault: true,
      createdAt: now,
      updatedAt: now
    });
    defaultProviderIds.add(profile.providerId);
  }

  return credentials;
}

export function migrateMiniMaxChinaApiBaseUrls(input: {
  modelProfiles: ModelProfile[];
  credentials?: ModelCredential[];
  modelCatalogs?: ModelProviderCatalog[];
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
  now?: string;
}): {
  modelProfiles: ModelProfile[];
  modelCredentials: ModelCredential[];
  modelCatalogs: ModelProviderCatalog[];
  roleModelCredentialBindings: RoleModelCredentialBinding[];
} {
  const now = input.now ?? new Date().toISOString();
  return {
    modelProfiles: input.modelProfiles.map((profile) => {
      const apiBaseUrl = migrateMiniMaxApiBaseUrl(profile.apiBaseUrl);
      return apiBaseUrl === profile.apiBaseUrl ? profile : { ...profile, apiBaseUrl };
    }),
    modelCredentials: (input.credentials ?? []).map((credential) => {
      const apiBaseUrl = migrateMiniMaxApiBaseUrl(credential.apiBaseUrl);
      return apiBaseUrl === credential.apiBaseUrl
        ? credential
        : { ...credential, apiBaseUrl, updatedAt: now };
    }),
    modelCatalogs: (input.modelCatalogs ?? []).map((catalog) => {
      const apiBaseUrl = migrateMiniMaxApiBaseUrl(catalog.apiBaseUrl);
      return apiBaseUrl === catalog.apiBaseUrl ? catalog : { ...catalog, apiBaseUrl };
    }),
    roleModelCredentialBindings: (input.roleModelCredentialBindings ?? []).map((binding) => {
      const apiBaseUrl = migrateMiniMaxApiBaseUrl(binding.apiBaseUrl);
      return apiBaseUrl === binding.apiBaseUrl
        ? binding
        : { ...binding, apiBaseUrl, updatedAt: now };
    })
  };
}

export function upsertDefaultModelCredential(input: {
  credentials: ModelCredential[];
  profile: ModelProfile;
  apiKey?: string;
  apiBaseUrl?: string;
  now?: string;
}): ModelCredential[] {
  const apiKey = input.apiKey?.trim();
  const apiBaseUrl = input.apiBaseUrl?.trim() || input.profile.apiBaseUrl;
  const now = input.now ?? new Date().toISOString();
  const existing =
    input.credentials.find(
      (credential) => credential.providerId === input.profile.providerId && credential.isDefault
    ) ??
    input.credentials.find(
      (credential) =>
        providerIdsShareCredentialScope(credential.providerId, input.profile.providerId) &&
        credential.isDefault
    );

  if (!apiKey) {
    return input.credentials;
  }

  const nextCredential: ModelCredential = {
    id: existing?.id ?? createDefaultCredentialId(input.profile.providerId),
    providerId: existing?.providerId ?? input.profile.providerId,
    providerName: existing?.providerName ?? input.profile.providerName,
    label: existing?.label ?? `${input.profile.providerName} 默认 Key`,
    apiBaseUrl,
    apiKey,
    isDefault: true,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  return existing
    ? input.credentials.map((credential) =>
        credential.id === existing.id ? nextCredential : credential
      )
    : [...input.credentials, nextCredential];
}

export function normalizeRoleModelCredentialBindings(
  bindings: RoleModelCredentialBinding[] | undefined,
  validRoleCodes: Set<string>,
  validModelProfileIds: Set<string>
): RoleModelCredentialBinding[] {
  return (bindings ?? []).filter(
    (binding) =>
      validRoleCodes.has(binding.roleCode) &&
      validModelProfileIds.has(binding.modelProfileId) &&
      (!binding.runtimeModelProfileId || validModelProfileIds.has(binding.runtimeModelProfileId)) &&
      (binding.mode === 'provider_default' ||
        binding.mode === 'credential_ref' ||
        binding.mode === 'inline')
  );
}

function providerIdsShareCredentialScope(left: string, right: string): boolean {
  const normalizedLeft = normalizeProviderCredentialId(left);
  const normalizedRight = normalizeProviderCredentialId(right);
  if (normalizedLeft === normalizedRight) {
    return true;
  }

  return providerCredentialAliasGroups.some(
    (group) => group.includes(normalizedLeft) && group.includes(normalizedRight)
  );
}

function normalizeProviderCredentialId(providerId: string): string {
  return providerId.trim().toLowerCase();
}

function migrateMiniMaxApiBaseUrl(apiBaseUrl: string | undefined): string | undefined {
  if (!apiBaseUrl?.trim()) {
    return apiBaseUrl;
  }

  try {
    const url = new URL(apiBaseUrl.trim());
    if (url.hostname.trim().toLowerCase() !== minimaxLegacyApiHost) {
      return apiBaseUrl;
    }

    url.hostname = 'api.minimaxi.com';
    url.pathname = url.pathname.replace(/\/+$/g, '') || '/v1';
    if (url.pathname === '/') {
      url.pathname = '/v1';
    }
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/g, '');
  } catch {
    const normalized = apiBaseUrl.trim().replace(/\/+$/g, '');
    return normalized === `https://${minimaxLegacyApiHost}` ||
      normalized === `https://${minimaxLegacyApiHost}/v1`
      ? minimaxChinaApiBaseUrl
      : apiBaseUrl;
  }
}

function applyCredentialFields(
  profile: ModelProfile,
  credential: Pick<ModelCredential, 'apiBaseUrl' | 'apiKey'>
): ModelProfile {
  return {
    ...profile,
    apiBaseUrl: credential.apiBaseUrl?.trim() || profile.apiBaseUrl,
    apiKey: credential.apiKey.trim()
  };
}

function slugifyCredentialId(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'provider'
  );
}
