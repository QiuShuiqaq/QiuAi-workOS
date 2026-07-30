import type {
  ModelCredential,
  ModelProfile,
  RoleModelCredentialBinding,
  RolePackageManifest
} from './desktop-contract.js';
import { isModelProfileConfiguredByCredentials } from './desktop-model-credentials.js';
import { inferModelCapabilitiesFromName } from './desktop-model-capabilities.js';
import { parseWorkflowGraph } from './desktop-workflow-graph.js';

export interface RoleModelRequirementStatus {
  profile: ModelProfile;
  requiredByNodeIds: string[];
  configured: boolean;
  known: boolean;
}

export type RoleModelRuntimeIssue = 'missing' | 'disabled' | 'unconfigured';

export interface RoleModelRuntimeRequirementStatus extends RoleModelRequirementStatus {
  enabled: boolean;
  ready: boolean;
  issue?: RoleModelRuntimeIssue;
}

export interface RoleModelCredentialContext {
  roleCode?: string;
  credentials?: ModelCredential[];
  roleBindings?: RoleModelCredentialBinding[];
}

export function readWorkflowRequiredModelProfileIds(workflowGraph: unknown): string[] {
  const graph = parseWorkflowGraph(workflowGraph);
  if (!graph) {
    return [];
  }

  return [
    ...new Set(
      graph.nodes
        .filter((node) => node.type === 'llm')
        .map((node) => node.modelProfileId?.trim())
        .filter((modelProfileId): modelProfileId is string => Boolean(modelProfileId))
    )
  ];
}

export function readRequiredModelProfileIdsForRolePackage(
  rolePackage: Pick<RolePackageManifest, 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>
): string[] {
  const manifestModelProfileIds = readDependencyManifestModelProfileIds(rolePackage.dependencyManifest);
  if (manifestModelProfileIds.length > 0) {
    return manifestModelProfileIds;
  }

  const declaredModelProfileIds = rolePackage.modelProfileIds
    .map((profileId) => profileId.trim())
    .filter(Boolean);
  const workflowModelProfileIds = readWorkflowRequiredModelProfileIds(rolePackage.workflowGraph);

  return mergeUniqueStrings(
    declaredModelProfileIds.length > 0 ? declaredModelProfileIds : ['qiu-general-default'],
    workflowModelProfileIds
  );
}

export function ensureModelProfilesForRolePackage(
  modelProfiles: ModelProfile[],
  rolePackage: Pick<RolePackageManifest, 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>
): ModelProfile[] {
  const existingIds = new Set(modelProfiles.map((profile) => profile.id));
  const requiredProfiles = readRequiredModelProfileIdsForRolePackage(rolePackage)
    .filter((profileId) => !existingIds.has(profileId))
    .map(createPlaceholderModelProfile);

  return [...modelProfiles, ...requiredProfiles];
}

export function getRoleModelRequirementStatuses(
  modelProfiles: ModelProfile[],
  rolePackage: Pick<RolePackageManifest, 'roleCode' | 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>,
  credentialContext: RoleModelCredentialContext = {}
): RoleModelRequirementStatus[] {
  const knownProfilesById = new Map(modelProfiles.map((profile) => [profile.id, profile]));
  const nodeIdsByModelId = readModelNodeIdsByModelProfileId(rolePackage);

  return readRequiredModelProfileIdsForRolePackage(rolePackage).map((profileId) => {
    const profile = knownProfilesById.get(profileId);
    const normalizedProfile = profile ?? createPlaceholderModelProfile(profileId);

    return {
      profile: normalizedProfile,
      requiredByNodeIds: nodeIdsByModelId.get(profileId) ?? [],
      configured: hasConfiguredModelApi(normalizedProfile, {
        roleCode: credentialContext.roleCode ?? rolePackage.roleCode,
        credentials: credentialContext.credentials,
        roleBindings: credentialContext.roleBindings
      }),
      known: Boolean(profile)
    };
  });
}

export function getRoleModelRuntimeRequirementStatuses(
  modelProfiles: ModelProfile[],
  enabledModelProfileIds: string[],
  rolePackage: Pick<RolePackageManifest, 'roleCode' | 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>,
  credentialContext: RoleModelCredentialContext = {}
): RoleModelRuntimeRequirementStatus[] {
  const enabledIds = new Set(enabledModelProfileIds);

  return getRoleModelRequirementStatuses(modelProfiles, rolePackage, credentialContext).map((requirement) => {
    const enabled = requirement.known && enabledIds.has(requirement.profile.id);
    const ready = requirement.known && enabled && requirement.configured;

    return {
      ...requirement,
      enabled,
      ready,
      issue: ready
        ? undefined
        : !requirement.known
          ? 'missing'
          : !enabled
            ? 'disabled'
            : 'unconfigured'
    };
  });
}

export function findFirstUnconfiguredRequiredModelProfileId(
  modelProfiles: ModelProfile[],
  rolePackage: Pick<RolePackageManifest, 'roleCode' | 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>,
  credentialContext: RoleModelCredentialContext = {}
): string | undefined {
  return getRoleModelRequirementStatuses(modelProfiles, rolePackage, credentialContext).find(
    (requirement) => !requirement.configured
  )?.profile.id;
}

export function findFirstUnreadyRequiredModelProfileId(
  modelProfiles: ModelProfile[],
  enabledModelProfileIds: string[],
  rolePackage: Pick<RolePackageManifest, 'roleCode' | 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>,
  credentialContext: RoleModelCredentialContext = {}
): string | undefined {
  return getRoleModelRuntimeRequirementStatuses(
    modelProfiles,
    enabledModelProfileIds,
    rolePackage,
    credentialContext
  ).find((requirement) => !requirement.ready)?.profile.id;
}

export function createPlaceholderModelProfile(profileId: string): ModelProfile {
  const normalizedProfileId = profileId.trim() || 'qiu-general-default';
  const provider = inferModelProviderFromProfileId(normalizedProfileId);
  const purpose = inferModelPurposeFromProfileId(normalizedProfileId);

  return {
    id: normalizedProfileId,
    providerId: provider.providerId,
    providerName: provider.providerName,
    modelName: provider.modelName,
    purpose,
    capabilities: inferModelCapabilitiesFromName(provider.modelName, purpose),
    apiBaseUrl: provider.apiBaseUrl,
    temperature: provider.temperature,
    maxTokens: provider.maxTokens,
    monthlyBudgetCents: 0
  };
}

function readWorkflowModelNodeIdsByModelProfileId(workflowGraph: unknown): Map<string, string[]> {
  const graph = parseWorkflowGraph(workflowGraph);
  const result = new Map<string, string[]>();
  if (!graph) {
    return result;
  }

  for (const node of graph.nodes) {
    if (node.type !== 'llm' || !node.modelProfileId?.trim()) {
      continue;
    }

    const modelProfileId = node.modelProfileId.trim();
    result.set(modelProfileId, [...(result.get(modelProfileId) ?? []), node.id]);
  }

  return result;
}

function readModelNodeIdsByModelProfileId(
  rolePackage: Pick<RolePackageManifest, 'workflowGraph' | 'dependencyManifest'>
): Map<string, string[]> {
  const manifestNodeIds = readDependencyManifestModelNodeIdsByModelProfileId(rolePackage.dependencyManifest);
  return manifestNodeIds.size > 0 ? manifestNodeIds : readWorkflowModelNodeIdsByModelProfileId(rolePackage.workflowGraph);
}

function readDependencyManifestModelProfileIds(
  manifest: RolePackageManifest['dependencyManifest']
): string[] {
  if (!manifest?.modelAssets?.length) {
    return [];
  }

  return mergeUniqueStrings(
    manifest.modelAssets
      .map((asset) => asset.modelProfileId || asset.modelId || asset.key)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    []
  );
}

function readDependencyManifestModelNodeIdsByModelProfileId(
  manifest: RolePackageManifest['dependencyManifest']
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  if (!manifest?.modelAssets?.length) {
    return result;
  }

  for (const asset of manifest.modelAssets) {
    const profileId = (asset.modelProfileId || asset.modelId || asset.key).trim();
    if (!profileId) {
      continue;
    }

    result.set(profileId, mergeUniqueStrings(result.get(profileId) ?? [], asset.nodeIds ?? []));
  }

  return result;
}

function inferModelProviderFromProfileId(profileId: string): {
  providerId: string;
  providerName: string;
  modelName: string;
  apiBaseUrl?: string;
  temperature?: number;
  maxTokens?: number;
} {
  const normalized = profileId.toLowerCase();

  if (normalized.includes('deepseek')) {
    return {
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: profileId.replace(/^deepseek[-_]/i, 'deepseek-'),
      apiBaseUrl: 'https://api.deepseek.com',
      temperature: normalized.includes('reason') || normalized.includes('pro') ? 0.2 : 0.4,
      maxTokens: normalized.includes('reason') || normalized.includes('pro') ? 8192 : 4096
    };
  }

  if (normalized.includes('openai') || normalized.includes('gpt')) {
    return {
      providerId: 'openai',
      providerName: 'OpenAI',
      modelName: profileId.replace(/^openai[-_]/i, ''),
      apiBaseUrl: 'https://api.openai.com/v1',
      temperature: 0.3,
      maxTokens: normalized.includes('reason') ? 8192 : 4096
    };
  }

  if (normalized.includes('qwen') || normalized.includes('dashscope')) {
    return {
      providerId: 'dashscope',
      providerName: '通义千问',
      modelName: profileId.replace(/^dashscope[-_]/i, ''),
      apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      temperature: 0.4,
      maxTokens: 4096
    };
  }

  if (normalized.includes('kimi') || normalized.includes('moonshot')) {
    return {
      providerId: 'moonshot',
      providerName: 'Kimi / Moonshot',
      modelName: profileId,
      apiBaseUrl: 'https://api.moonshot.cn/v1',
      temperature: 0.4,
      maxTokens: 4096
    };
  }

  if (normalized.includes('ollama') || normalized.includes('local')) {
    return {
      providerId: 'ollama',
      providerName: 'Ollama 本地模型',
      modelName: profileId.replace(/^ollama[-_]/i, ''),
      apiBaseUrl: 'http://127.0.0.1:11434/v1',
      temperature: 0.4,
      maxTokens: 4096
    };
  }

  return {
    providerId: 'provider-pending',
    providerName: '待配置模型供应商',
    modelName: profileId,
    temperature: 0.4,
    maxTokens: 4096
  };
}

function inferModelPurposeFromProfileId(profileId: string): ModelProfile['purpose'] {
  const normalized = profileId.toLowerCase();

  if (normalized.includes('vision') || normalized.includes('image') || normalized.includes('vl')) {
    return 'vision';
  }

  if (normalized.includes('asr') || normalized.includes('audio') || normalized.includes('speech') || normalized.includes('transcribe')) {
    return 'audio';
  }

  if (normalized.includes('embedding') || normalized.includes('embed')) {
    return 'embeddings';
  }

  if (
    normalized.includes('document') ||
    normalized.includes('doc') ||
    normalized.includes('32k') ||
    normalized.includes('128k')
  ) {
    return 'document';
  }

  if (normalized.includes('reason') || normalized.includes('r1') || normalized.includes('pro')) {
    return 'reasoning';
  }

  return 'general';
}

function hasConfiguredModelApi(
  profile: ModelProfile,
  credentialContext: RoleModelCredentialContext = {}
): boolean {
  return isModelProfileConfiguredByCredentials({
    profile,
    roleCode: credentialContext.roleCode,
    credentials: credentialContext.credentials,
    roleBindings: credentialContext.roleBindings
  });
}

function mergeUniqueStrings(left: string[], right: string[]): string[] {
  return [...new Set([...left, ...right].map((value) => value.trim()).filter(Boolean))];
}
