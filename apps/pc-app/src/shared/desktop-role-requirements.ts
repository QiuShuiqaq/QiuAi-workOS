import type {
  ModelCredential,
  ModelProfile,
  RoleModelCredentialBinding,
  RolePackageManifest
} from './desktop-contract.js';
import { isModelProfileConfiguredByCredentials } from './desktop-model-credentials.js';
import {
  inferModelCapabilitiesFromName,
  modelProfileSupportsRequiredCapabilities
} from './desktop-model-capabilities.js';
import { parseWorkflowGraph, type WorkflowGraphNode } from './desktop-workflow-graph.js';

export interface RoleModelRequirementStatus {
  profile: ModelProfile;
  requiredByNodeIds: string[];
  configured: boolean;
  known: boolean;
}

export type RoleModelRuntimeIssue = 'missing' | 'disabled' | 'unconfigured' | 'incompatible';

export interface RoleModelRuntimeRequirementStatus extends RoleModelRequirementStatus {
  enabled: boolean;
  ready: boolean;
  issue?: RoleModelRuntimeIssue;
  runtimeProfileId?: string;
  runtimeProfile?: ModelProfile;
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
        .flatMap((node) => {
          const requiredModelProfileIds = Array.isArray(node.config?.requiredModelProfileIds)
            ? node.config.requiredModelProfileIds
                .map((profileId) => (typeof profileId === 'string' ? profileId.trim() : ''))
                .filter(Boolean)
            : [];
          const semanticProfileId = node.type === 'llm' ? getSemanticModelProfileIdForWorkflowNode(node) : undefined;
          return node.type === 'llm' && !isOptionalWorkflowModelNode(node)
            ? [semanticProfileId, ...requiredModelProfileIds.map(mapModelProfileIdToSemanticDefault)]
            : requiredModelProfileIds;
        })
        .filter((modelProfileId): modelProfileId is string => Boolean(modelProfileId))
    )
  ];
}

export function readRequiredModelProfileIdsForRolePackage(
  rolePackage: Pick<RolePackageManifest, 'modelProfileIds' | 'workflowGraph' | 'dependencyManifest'>
): string[] {
  return readWorkflowRequiredModelProfileIds(rolePackage.workflowGraph);
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
    const configuredProfile = knownProfilesById.get(profileId);
    const requirementProfile = createPlaceholderModelProfile(profileId);
    const directProfile = configuredProfile ?? requirementProfile;
    const requiredCapabilities = getRequiredCapabilitiesForSemanticProfileId(requirementProfile.id);
    const directCompatible =
      requiredCapabilities.length === 0 ||
      modelProfileSupportsAnyCapability(directProfile, requiredCapabilities);
    const configured = directCompatible && hasConfiguredModelApi(directProfile, {
      roleCode: credentialContext.roleCode ?? rolePackage.roleCode,
      credentials: credentialContext.credentials,
      roleBindings: credentialContext.roleBindings
    });
    const compatibleConfiguredProfile = configured
      ? undefined
      : findConfiguredCompatibleModelProfile(modelProfiles, profileId, {
          roleCode: credentialContext.roleCode ?? rolePackage.roleCode,
          credentials: credentialContext.credentials,
          roleBindings: credentialContext.roleBindings
        });
    return {
      profile: requirementProfile,
      requiredByNodeIds: nodeIdsByModelId.get(profileId) ?? [],
      configured: configured || Boolean(compatibleConfiguredProfile),
      known: Boolean(configuredProfile || compatibleConfiguredProfile || isSemanticModelProfileId(profileId))
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
  const modelProfileById = new Map(modelProfiles.map((profile) => [profile.id, profile]));

  return getRoleModelRequirementStatuses(modelProfiles, rolePackage, credentialContext).map((requirement) => {
    const runtimeProfileId = findRuntimeModelProfileIdForRequirement(
      credentialContext.roleBindings ?? [],
      credentialContext.roleCode ?? rolePackage.roleCode,
      requirement.profile.id
    );
    const directRuntimeProfile = runtimeProfileId
      ? modelProfileById.get(runtimeProfileId)
      : modelProfileById.get(requirement.profile.id);
    const runtimeOverrideSelected = Boolean(
      runtimeProfileId &&
      runtimeProfileId !== requirement.profile.id
    );
    const requiredCapabilities = getRequiredCapabilitiesForSemanticProfileId(requirement.profile.id);
    const directRuntimeCompatible =
      !directRuntimeProfile ||
      requiredCapabilities.length === 0 ||
      modelProfileSupportsAnyCapability(directRuntimeProfile, requiredCapabilities);
    const directRuntimeConfigured = directRuntimeProfile
      ? hasConfiguredModelApi(directRuntimeProfile, credentialContext)
      : false;
    const compatibleConfiguredRuntimeProfile =
      runtimeOverrideSelected || (directRuntimeCompatible && directRuntimeConfigured)
        ? undefined
        : findConfiguredCompatibleModelProfile(modelProfiles, requirement.profile.id, credentialContext);
    const runtimeProfile = compatibleConfiguredRuntimeProfile ?? directRuntimeProfile;
    const selectedRuntimeProfile = runtimeProfile ?? requirement.profile;
    const runtimeCompatible =
      !selectedRuntimeProfile ||
      requiredCapabilities.length === 0 ||
      modelProfileSupportsAnyCapability(selectedRuntimeProfile, requiredCapabilities);
    const known = runtimeOverrideSelected ? Boolean(runtimeProfile) : requirement.known;
    const configured = runtimeProfile
      ? hasConfiguredModelApi(runtimeProfile, credentialContext)
      : requirement.configured;
    const enabledProfileId = runtimeProfile?.id ?? requirement.profile.id;
    const enabled = known && Boolean(enabledProfileId && enabledIds.has(enabledProfileId));
    const ready = known && runtimeCompatible && enabled && configured;

    return {
      ...requirement,
      known,
      configured,
      enabled,
      ready,
      runtimeProfileId,
      runtimeProfile,
      issue: ready
        ? undefined
        : !known
          ? 'missing'
          : !runtimeCompatible
            ? 'incompatible'
          : !enabled
            ? 'disabled'
            : 'unconfigured'
    };
  });
}

function isSemanticModelProfileId(profileId: string): boolean {
  return [
    'qiu-general-default',
    'qiu-reasoning-default',
    'qiu-vision-default',
    'qiu-image-generation-default',
    'qiu-image-editing-default',
    'qiu-video-generation-default',
    'qiu-asr-default',
    'qiu-audio-generation-default',
    'qiu-embedding-default',
    'qiu-rerank-default'
  ].includes(profileId.trim());
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
  const firstUnreadyRequirement = getRoleModelRuntimeRequirementStatuses(
    modelProfiles,
    enabledModelProfileIds,
    rolePackage,
    credentialContext
  ).find((requirement) => !requirement.ready);

  return firstUnreadyRequirement?.runtimeProfileId ?? firstUnreadyRequirement?.profile.id;
}

function findRuntimeModelProfileIdForRequirement(
  roleBindings: RoleModelCredentialBinding[],
  roleCode: string,
  modelProfileId: string
): string | undefined {
  return roleBindings.find(
    (binding) =>
      binding.roleCode === roleCode &&
      binding.modelProfileId === modelProfileId &&
      binding.runtimeModelProfileId?.trim()
  )?.runtimeModelProfileId?.trim();
}

function findConfiguredCompatibleModelProfile(
  modelProfiles: ModelProfile[],
  requirementProfileId: string,
  credentialContext: RoleModelCredentialContext
): ModelProfile | undefined {
  const requiredCapabilities = getRequiredCapabilitiesForSemanticProfileId(requirementProfileId);
  if (requiredCapabilities.length === 0) {
    return undefined;
  }

  return modelProfiles.find(
    (profile) =>
      profile.id !== requirementProfileId &&
      modelProfileSupportsAnyCapability(profile, requiredCapabilities) &&
      hasConfiguredModelApi(profile, credentialContext)
  );
}

export function getRequiredCapabilitiesForSemanticProfileId(profileId: string): string[] {
  if (profileId === 'qiu-vision-default') return ['image_understanding', 'vision_understanding', 'vision_text'];
  if (profileId === 'qiu-image-generation-default') return ['text_to_image', 'image_generation'];
  if (profileId === 'qiu-image-editing-default') return ['image_editing', 'image_to_image'];
  if (profileId === 'qiu-video-generation-default') return ['video_generation', 'text_to_video', 'image_to_video'];
  if (profileId === 'qiu-asr-default') return ['audio_to_text'];
  if (profileId === 'qiu-audio-generation-default') return ['text_to_audio'];
  if (profileId === 'qiu-embedding-default') return ['embedding'];
  if (profileId === 'qiu-rerank-default') return ['rerank'];
  if (profileId === 'qiu-reasoning-default') return ['reasoning_text', 'text'];
  if (profileId === 'qiu-general-default') return ['text'];
  return [];
}

function modelProfileSupportsAnyCapability(profile: ModelProfile, capabilities: string[]): boolean {
  return modelProfileSupportsRequiredCapabilities(profile, capabilities);
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
    const nodeProfileIds =
      node.type === 'llm'
        ? [getSemanticModelProfileIdForWorkflowNode(node)]
        : [];
    const requiredModelProfileIds = Array.isArray(node.config?.requiredModelProfileIds)
      ? node.config.requiredModelProfileIds
          .map((profileId) => (typeof profileId === 'string' ? profileId.trim() : ''))
          .filter(Boolean)
      : [];

    for (const modelProfileId of [...nodeProfileIds, ...requiredModelProfileIds.map(mapModelProfileIdToSemanticDefault)]) {
      if (!modelProfileId) {
        continue;
      }
      result.set(modelProfileId, [...(result.get(modelProfileId) ?? []), node.id]);
    }
  }

  return result;
}

function readModelNodeIdsByModelProfileId(
  rolePackage: Pick<RolePackageManifest, 'workflowGraph' | 'dependencyManifest'>
): Map<string, string[]> {
  return readWorkflowModelNodeIdsByModelProfileId(rolePackage.workflowGraph);
}

function readConfigString(config: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getSemanticModelProfileIdForWorkflowNode(node: WorkflowGraphNode): string {
  return getSemanticModelProfileIdForTaskType(getWorkflowEffectiveModelTaskType(node)) ?? 'qiu-general-default';
}

function isOptionalWorkflowModelNode(node: WorkflowGraphNode): boolean {
  return node.config?.optionalModel === true;
}

function getSemanticModelProfileIdForTaskType(taskType: string | undefined): string | undefined {
  if (taskType === 'ai_video_production') return 'qiu-asr-default';
  if (taskType === 'vision') return 'qiu-vision-default';
  if (taskType === 'reasoning') return 'qiu-reasoning-default';
  if (taskType === 'audio_transcription') return 'qiu-asr-default';
  if (taskType === 'audio_generation') return 'qiu-audio-generation-default';
  if (taskType === 'image_generation') return 'qiu-image-generation-default';
  if (taskType === 'image_editing') return 'qiu-image-editing-default';
  if (taskType === 'video_generation') return 'qiu-video-generation-default';
  if (taskType === 'video_understanding') return 'qiu-vision-default';
  if (taskType === 'embedding') return 'qiu-embedding-default';
  if (taskType === 'rerank') return 'qiu-rerank-default';
  return 'qiu-general-default';
}

function getWorkflowEffectiveModelTaskType(node: WorkflowGraphNode): string | undefined {
  const taskType = readConfigString(node.config, 'llmTaskType') ?? 'text';
  if (taskType === 'image_generation' && workflowNodeUsesReferenceImage(node)) {
    return 'image_editing';
  }

  return taskType;
}

function workflowNodeUsesReferenceImage(node: WorkflowGraphNode): boolean {
  return [
    ...(node.inputVariables ?? []),
    readConfigString(node.config, 'sourceImageVariable') ?? '',
    readConfigString(node.config, 'referenceImageVariable') ?? ''
  ].some((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized === 'start.images' ||
      normalized === 'start.files' ||
      normalized === 'factory_items' ||
      normalized.includes('referenceimage') ||
      normalized.includes('sourceimage') ||
      normalized.includes('source_image');
  });
}

function mapModelProfileIdToSemanticDefault(profileId: string): string {
  const normalized = profileId.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('qiu-')) return profileId.trim();
  if (normalized.includes('text_to_audio') || normalized.includes('tts') || normalized.includes('text-to-speech') || normalized.includes('speech_generation')) return 'qiu-audio-generation-default';
  if (normalized.includes('asr') || normalized.includes('speech_to_text') || normalized.includes('speech-to-text') || normalized.includes('audio_to_text') || normalized.includes('transcription')) return 'qiu-asr-default';
  if (
    normalized.includes('reason') ||
    normalized.includes('reasoner') ||
    normalized.includes('thinking') ||
    normalized.includes('deepseek-r1') ||
    normalized.includes('deepseek-v4-pro') ||
    normalized.includes('r1')
  ) {
    return 'qiu-reasoning-default';
  }
  if (
    normalized.includes('veo') ||
    normalized.includes('kling') ||
    normalized.includes('pika') ||
    normalized.includes('hailuo') ||
    normalized.includes('runway') ||
    normalized.includes('sora') ||
    normalized.includes('seedance') ||
    normalized.includes('text-to-video') ||
    normalized.includes('image-to-video') ||
    normalized.includes('t2v') ||
    normalized.includes('i2v') ||
    normalized.includes('wanx-video')
  ) {
    return 'qiu-video-generation-default';
  }
  if (normalized.includes('gpt-image') || normalized.includes('img2img') || normalized.includes('image-edit')) {
    return 'qiu-image-editing-default';
  }
  if (normalized.includes('image') || normalized.includes('vision') || normalized.includes('vl') || normalized.includes('gpt-4o')) {
    return 'qiu-vision-default';
  }
  if (normalized.includes('embedding') || normalized.includes('embed')) return 'qiu-embedding-default';
  if (normalized.includes('rerank')) return 'qiu-rerank-default';
  return 'qiu-general-default';
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

  if (
    normalized.includes('audio-generation') ||
    normalized.includes('audio_generation') ||
    normalized.includes('text-to-audio') ||
    normalized.includes('text_to_audio') ||
    normalized.includes('text-to-speech') ||
    normalized.includes('text_to_speech') ||
    normalized.includes('speech-generation') ||
    normalized.includes('speech_generation') ||
    normalized.includes('tts')
  ) {
    return {
      providerId: 'provider-pending',
      providerName: 'Pending Audio Provider',
      modelName: 'text-to-speech',
      temperature: 0.2,
      maxTokens: 4096
    };
  }

  if (normalized.includes('asr') || normalized.includes('speech') || normalized.includes('audio')) {
    return {
      providerId: 'provider-pending',
      providerName: '待配置语音模型供应商',
      modelName: 'speech-to-text',
      temperature: 0.2,
      maxTokens: 4096
    };
  }

  if (
    normalized.includes('video-generation') ||
    normalized.includes('text-to-video') ||
    normalized.includes('image-to-video') ||
    normalized.includes('qiu-video')
  ) {
    return {
      providerId: 'provider-pending',
      providerName: '待配置生视频模型供应商',
      modelName: 'text-image-to-video',
      temperature: 0.2,
      maxTokens: 4096
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

  if (
    normalized.includes('video-generation') ||
    normalized.includes('text-to-video') ||
    normalized.includes('image-to-video') ||
    normalized.includes('qiu-video')
  ) {
    return 'vision';
  }

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
