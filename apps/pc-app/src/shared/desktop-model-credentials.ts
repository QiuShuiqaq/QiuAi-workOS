import type {
  ModelCredential,
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
  source: 'role_inline' | 'credential_ref' | 'provider_default' | 'legacy_profile' | 'missing';
  credential?: ModelCredential;
  binding?: RoleModelCredentialBinding;
  configured: boolean;
}

export function resolveModelProfileCredential(
  input: ModelCredentialResolutionInput
): ModelCredentialResolution {
  const credentials = input.credentials ?? [];
  const roleBindings = input.roleBindings ?? [];
  const roleBinding = input.roleCode
    ? roleBindings.find(
        (binding) =>
          binding.roleCode === input.roleCode &&
          binding.modelProfileId === input.profile.id
      )
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
        item.providerId === input.profile.providerId &&
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

  if (input.profile.apiBaseUrl?.trim() && input.profile.apiKey?.trim()) {
    return {
      profile: input.profile,
      source: 'legacy_profile',
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

export function isModelProfileConfiguredByCredentials(
  input: ModelCredentialResolutionInput
): boolean {
  return resolveModelProfileCredential(input).configured;
}

export function findDefaultModelCredential(
  credentials: ModelCredential[],
  providerId: string
): ModelCredential | undefined {
  return credentials.find(
    (credential) =>
      credential.providerId === providerId &&
      credential.isDefault &&
      credential.apiKey.trim()
  );
}

export function listProviderModelCredentials(
  credentials: ModelCredential[],
  providerId: string
): ModelCredential[] {
  return credentials.filter(
    (credential) => credential.providerId === providerId && credential.apiKey.trim()
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
    if (!apiKey || defaultProviderIds.has(profile.providerId)) {
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
  const existing = input.credentials.find(
    (credential) => credential.providerId === input.profile.providerId && credential.isDefault
  );

  if (!apiKey) {
    return input.credentials;
  }

  const nextCredential: ModelCredential = {
    id: existing?.id ?? createDefaultCredentialId(input.profile.providerId),
    providerId: input.profile.providerId,
    providerName: input.profile.providerName,
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
