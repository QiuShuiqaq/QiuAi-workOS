import type { ModelCapability, ModelProfile } from './desktop-contract.js';
import {
  defaultCapabilitiesForPurpose,
  normalizeModelCapabilities,
  purposeForModelCapabilities
} from './desktop-model-capabilities.js';

export interface ModelProviderPreset {
  id: string;
  name: string;
  summary: string;
  apiBaseUrl?: string;
  models: Array<{
    label: string;
    modelName: string;
    purpose: ModelProfile['purpose'];
    capabilities?: ModelCapability[];
    temperature?: number;
    maxTokens?: number;
  }>;
}

export type ModelProviderPresetModel = ModelProviderPreset['models'][number];

export interface ModelProviderPresetSelection {
  modelProfiles: ModelProfile[];
  profile: ModelProfile;
  apiKeyPreserved: boolean;
}

export interface ModelProviderPresetSelectionOptions {
  preferredProfileId?: string;
  replaceProfileId?: string;
}

export interface CustomCompatibleModelProfileOptions {
  providerName?: string;
  modelName?: string;
  purpose?: ModelProfile['purpose'];
  capabilities?: ModelCapability[];
  apiBaseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export function selectModelProfileForPreset(
  modelProfiles: ModelProfile[],
  preset: ModelProviderPreset,
  model: ModelProviderPresetModel,
  options: ModelProviderPresetSelectionOptions = {}
): ModelProviderPresetSelection | undefined {
  const replaceProfile = options.replaceProfileId
    ? modelProfiles.find((profile) => profile.id === options.replaceProfileId)
    : undefined;
  if (replaceProfile) {
    const updatedProfile = applyPresetToProfile(replaceProfile, preset, model);

    return {
      modelProfiles: modelProfiles.map((profile) =>
        profile.id === replaceProfile.id ? updatedProfile : profile
      ),
      profile: updatedProfile,
      apiKeyPreserved: false
    };
  }

  const preferredReusableProfile = findPreferredReusableProfile(
    modelProfiles,
    model,
    options.preferredProfileId
  );
  if (preferredReusableProfile) {
    const updatedProfile = applyPresetToProfile(preferredReusableProfile, preset, model);

    return {
      modelProfiles: modelProfiles.map((profile) =>
        profile.id === preferredReusableProfile.id ? updatedProfile : profile
      ),
      profile: updatedProfile,
      apiKeyPreserved: false
    };
  }

  const exactProfile = modelProfiles.find((profile) =>
    matchesPresetModel(profile, preset, model)
  );

  if (exactProfile) {
    return {
      modelProfiles,
      profile: exactProfile,
      apiKeyPreserved: Boolean(exactProfile.apiKey?.trim())
    };
  }

  const reusableProfile = modelProfiles.find(
    (profile) =>
      profile.purpose === model.purpose &&
      !hasConfiguredModelApi(profile) &&
      isPendingProviderProfile(profile)
  );

  if (reusableProfile) {
    const updatedProfile = applyPresetToProfile(reusableProfile, preset, model);

    return {
      modelProfiles: modelProfiles.map((profile) =>
        profile.id === reusableProfile.id ? updatedProfile : profile
      ),
      profile: updatedProfile,
      apiKeyPreserved: false
    };
  }

  const createdProfile = createModelProfileFromPreset(
    createUniquePresetProfileId(modelProfiles, preset, model),
    preset,
    model
  );

  return {
    modelProfiles: [...modelProfiles, createdProfile],
    profile: createdProfile,
    apiKeyPreserved: false
  };
}

export function createCustomCompatibleModelProfile(
  modelProfiles: ModelProfile[],
  options: CustomCompatibleModelProfileOptions = {}
): ModelProfile {
  const providerId = createUniqueCustomProviderId(modelProfiles, options.providerName);
  const modelName = options.modelName?.trim() || 'custom-model';
  const fallbackPurpose = options.purpose ?? 'general';
  const capabilities = normalizeModelCapabilities(
    options.capabilities ?? defaultCapabilitiesForPurpose(fallbackPurpose),
    fallbackPurpose
  );
  const purpose = purposeForModelCapabilities(capabilities, fallbackPurpose);

  return {
    id: createUniqueProfileId(modelProfiles, `${providerId}-${slugifyModelName(modelName)}-${purpose}`),
    providerId,
    providerName: options.providerName?.trim() ?? '',
    modelName,
    purpose,
    capabilities,
    apiBaseUrl: options.apiBaseUrl?.trim() || undefined,
    temperature: options.temperature ?? (purpose === 'reasoning' ? 0.2 : 0.4),
    maxTokens: options.maxTokens ?? (purpose === 'reasoning' ? 8192 : 4096),
    monthlyBudgetCents: 0
  };
}

function findPreferredReusableProfile(
  modelProfiles: ModelProfile[],
  model: ModelProviderPresetModel,
  preferredProfileId?: string
): ModelProfile | undefined {
  if (!preferredProfileId?.trim()) {
    return undefined;
  }

  const preferredProfile = modelProfiles.find((profile) => profile.id === preferredProfileId);
  if (
    preferredProfile?.purpose === model.purpose &&
    !hasConfiguredModelApi(preferredProfile) &&
    isPendingProviderProfile(preferredProfile)
  ) {
    return preferredProfile;
  }

  return undefined;
}

export function matchesPresetModel(
  profile: ModelProfile,
  preset: ModelProviderPreset,
  model: ModelProviderPresetModel
): boolean {
  const providerMatches =
    profile.providerId === preset.id ||
    normalizeText(profile.providerName) === normalizeText(preset.name);

  return (
    providerMatches &&
    normalizeText(profile.modelName) === normalizeText(model.modelName) &&
    normalizeUrl(profile.apiBaseUrl) === normalizeUrl(preset.apiBaseUrl)
  );
}

function applyPresetToProfile(
  profile: ModelProfile,
  preset: ModelProviderPreset,
  model: ModelProviderPresetModel
): ModelProfile {
  return {
    ...profile,
    providerId: preset.id,
    providerName: preset.name,
    modelName: model.modelName,
    purpose: model.purpose,
    capabilities: normalizeModelCapabilities(model.capabilities, model.purpose),
    apiBaseUrl: preset.apiBaseUrl,
    apiKey: undefined,
    temperature: model.temperature,
    maxTokens: model.maxTokens
  };
}

function createModelProfileFromPreset(
  id: string,
  preset: ModelProviderPreset,
  model: ModelProviderPresetModel
): ModelProfile {
  return {
    id,
    providerId: preset.id,
    providerName: preset.name,
    modelName: model.modelName,
    purpose: model.purpose,
    capabilities: normalizeModelCapabilities(
      model.capabilities ?? defaultCapabilitiesForPurpose(model.purpose),
      model.purpose
    ),
    apiBaseUrl: preset.apiBaseUrl,
    temperature: model.temperature,
    maxTokens: model.maxTokens,
    monthlyBudgetCents: 0
  };
}

function createUniquePresetProfileId(
  modelProfiles: ModelProfile[],
  preset: ModelProviderPreset,
  model: ModelProviderPresetModel
): string {
  const baseId = `${preset.id}-${slugifyModelName(model.modelName)}-${model.purpose}`;
  return createUniqueProfileId(modelProfiles, baseId);
}

function createUniqueCustomProviderId(
  modelProfiles: ModelProfile[],
  providerName: string | undefined
): string {
  const baseId = `custom-${slugifyModelName(providerName || 'provider')}`;
  const existingProviderIds = new Set(modelProfiles.map((profile) => profile.providerId));

  if (!existingProviderIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index += 1) {
    const nextId = `${baseId}-${index}`;
    if (!existingProviderIds.has(nextId)) {
      return nextId;
    }
  }

  return `${baseId}-${Date.now()}`;
}

function createUniqueProfileId(
  modelProfiles: ModelProfile[],
  baseId: string
): string {
  const existingIds = new Set(modelProfiles.map((profile) => profile.id));

  if (!existingIds.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index += 1) {
    const nextId = `${baseId}-${index}`;
    if (!existingIds.has(nextId)) {
      return nextId;
    }
  }

  return `${baseId}-${Date.now()}`;
}

function isPendingProviderProfile(profile: ModelProfile): boolean {
  return (
    profile.providerId === 'provider-pending' ||
    profile.providerId === 'provider-local'
  );
}

function hasConfiguredModelApi(profile: ModelProfile): boolean {
  return Boolean(profile.apiBaseUrl?.trim() && profile.apiKey?.trim());
}

function slugifyModelName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'model'
  );
}

function normalizeText(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function normalizeUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, '').toLowerCase() ?? '';
}
