import { getServerToolAction } from './tool-action-catalog';
import type { ServerRoleTemplateExecutionProfile } from './role-template-execution-profile';
import type { ServerRoleWorkflowGraph, ServerRoleWorkflowGraphNode } from './workflow-graph';

export interface ServerRoleTemplateDependencyManifest {
  version: '1.0.0';
  applicationType?: 'digital_employee' | 'digital_factory';
  generatedAt: string;
  variables: Array<{
    key: string;
    name?: string;
    valueType?: string;
    required: boolean;
    nodeIds: string[];
  }>;
  modelAssets: Array<{
    key: string;
    name?: string;
    providerId?: string;
    providerName?: string;
    modelId?: string;
    modelProfileId: string;
    capabilities: string[];
    inputTypes: string[];
    outputTypes: string[];
    credentialFields: string[];
    apiStyle?: string;
    availabilityStatus?: string;
    supportsModelList?: boolean;
    required: boolean;
    nodeIds: string[];
  }>;
  toolActions: Array<{
    key: string;
    name?: string;
    packageId: string;
    actionId: string;
    category?: string;
    inputTypes: string[];
    outputTypes: string[];
    requiredConfig: string[];
    requiredDependencies: string[];
    artifactFormat?: string;
    maturity?: string;
    required: boolean;
    nodeIds: string[];
  }>;
  artifactTemplates: Array<{
    key: string;
    name?: string;
    artifactType?: string;
    toolActionId?: string;
    fileNamePattern?: string;
    inputVariables: string[];
    nodeIds: string[];
  }>;
  nodeTemplates: Array<{
    key: string;
    name?: string;
    nodeType?: string;
    inputVariables: string[];
    outputVariables: string[];
    nodeIds: string[];
  }>;
  executionProfile?: ServerRoleTemplateExecutionProfile;
  factory?: unknown;
  warnings: string[];
}

export interface RoleTemplateDependencyAsset {
  type: string;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  status?: string;
  version?: string;
  schema?: unknown;
  defaults?: unknown;
  tags?: unknown;
}

const variableAliasByRuntimeRef: Record<string, string> = {
  'start.text': 'task_text',
  'start.files': 'input_files',
  'start.files.0': 'input_file',
  'runtime.previous_text': 'final_content',
  'runtime.current_item': 'input_file'
};

export function buildRoleTemplateDependencyManifest(input: {
  workflowGraph: ServerRoleWorkflowGraph;
  assets?: RoleTemplateDependencyAsset[];
  generatedAt?: Date | string;
  executionProfile?: ServerRoleTemplateExecutionProfile;
}): ServerRoleTemplateDependencyManifest {
  const assets = input.assets ?? [];
  const assetByTypeAndKey = new Map(
    assets.map((asset) => [`${asset.type}:${asset.key}`, asset] as const)
  );
  const variables = new Map<string, ServerRoleTemplateDependencyManifest['variables'][number]>();
  const modelAssets = new Map<string, ServerRoleTemplateDependencyManifest['modelAssets'][number]>();
  const toolActions = new Map<string, ServerRoleTemplateDependencyManifest['toolActions'][number]>();
  const artifactTemplates = new Map<string, ServerRoleTemplateDependencyManifest['artifactTemplates'][number]>();
  const nodeTemplates = new Map<string, ServerRoleTemplateDependencyManifest['nodeTemplates'][number]>();
  const warnings = new Set<string>();
  const generatedAt =
    input.generatedAt instanceof Date
      ? input.generatedAt.toISOString()
      : input.generatedAt ?? new Date().toISOString();

  for (const variable of input.workflowGraph.variables ?? []) {
    upsertVariable(variables, {
      key: variable.name,
      name: readVariableAssetName(assetByTypeAndKey, variable.name) ?? variable.description,
      valueType: variable.type,
      required: Boolean(variable.required),
      nodeId: undefined
    });
  }

  for (const node of input.workflowGraph.nodes) {
    for (const variable of [
      ...(node.inputVariables ?? []),
      ...(node.outputVariables ?? []),
      ...readConfigStringArray(node.config, 'variableRefs')
    ]) {
      const asset = findVariableAsset(assetByTypeAndKey, variable);
      upsertVariable(variables, {
        key: variable,
        name: asset?.name,
        valueType: readSchemaString(asset, 'valueType'),
        required: Boolean((node.inputVariables ?? []).includes(variable)),
        nodeId: node.id
      });
    }

    upsertNodeTemplate(nodeTemplates, node, assetByTypeAndKey, warnings);

    if (isModelNode(node)) {
      upsertModelAsset(modelAssets, node, assetByTypeAndKey, warnings);
    }

    for (const modelProfileId of readConfigStringArray(node.config, 'requiredModelProfileIds')) {
      upsertModelAsset(
        modelAssets,
        {
          ...node,
          modelProfileId
        },
        assetByTypeAndKey,
        warnings,
        {
          semanticModelProfileId: mapModelProfileIdToSemanticDefault(modelProfileId)
        }
      );
    }

    if (node.type === 'tool' || node.type === 'artifact') {
      upsertToolAction(toolActions, node, assetByTypeAndKey, warnings);
    }

    for (const requiredToolAction of readConfigToolActions(node.config)) {
      upsertToolAction(
        toolActions,
        {
          ...node,
          type: 'tool',
          toolId: requiredToolAction.toolId,
          config: {
            action: requiredToolAction.action,
            ...(requiredToolAction.assetKey ? { toolActionAssetKey: requiredToolAction.assetKey } : {})
          }
        },
        assetByTypeAndKey,
        warnings
      );
    }

    if (node.type === 'artifact') {
      upsertArtifactTemplate(artifactTemplates, node, assetByTypeAndKey, warnings);
    }
  }

  return {
    version: '1.0.0',
    generatedAt,
    variables: sortByKey([...variables.values()]),
    modelAssets: sortByKey([...modelAssets.values()]),
    toolActions: sortByKey([...toolActions.values()]),
    artifactTemplates: sortByKey([...artifactTemplates.values()]),
    nodeTemplates: sortByKey([...nodeTemplates.values()]),
    ...(input.executionProfile === undefined ? {} : { executionProfile: input.executionProfile }),
    warnings: [...warnings].sort()
  };
}

export function readWorkflowModelContractProfileIds(
  workflowGraph: ServerRoleWorkflowGraph
): string[] {
  return buildRoleTemplateDependencyManifest({ workflowGraph }).modelAssets
    .map((asset) => asset.modelProfileId)
    .filter(Boolean);
}

export function validateRoleTemplateModelContracts(input: {
  workflowGraph: ServerRoleWorkflowGraph;
  dependencyManifest?: unknown;
}): string[] {
  const issues: string[] = [];
  const expectedProfileIds = new Set(
    readWorkflowModelContractProfileIds(input.workflowGraph)
  );

  for (const node of input.workflowGraph.nodes) {
    if (!isModelNode(node)) {
      continue;
    }

    const expectedProfileId = getSemanticModelProfileIdForNode(node);
    const declaredProfileId = node.modelProfileId?.trim();
    if (declaredProfileId && declaredProfileId !== expectedProfileId) {
      issues.push(
        `LLM node ${node.id} declares ${declaredProfileId}, but llmTaskType requires ${expectedProfileId}.`
      );
    }
  }

  const manifestRecord = readRecord(input.dependencyManifest);
  const manifestAssets = Array.isArray(manifestRecord?.modelAssets)
    ? manifestRecord.modelAssets
        .map((asset) => {
          const record = readRecord(asset);
          const profileId = record?.modelProfileId ?? record?.modelId ?? record?.key;
          return typeof profileId === 'string'
            ? mapModelProfileIdToSemanticDefault(profileId)
            : '';
        })
        .filter((profileId): profileId is string => Boolean(profileId))
    : [];
  const actualProfileIds = new Set(manifestAssets);

  for (const profileId of expectedProfileIds) {
    if (!actualProfileIds.has(profileId)) {
      issues.push(`Dependency manifest is missing model contract ${profileId}.`);
    }
  }
  for (const profileId of actualProfileIds) {
    if (!expectedProfileIds.has(profileId)) {
      issues.push(`Dependency manifest contains stale model contract ${profileId}.`);
    }
  }

  return [...new Set(issues)];
}

function upsertVariable(
  variables: Map<string, ServerRoleTemplateDependencyManifest['variables'][number]>,
  input: {
    key: string;
    name?: string;
    valueType?: string;
    required: boolean;
    nodeId?: string;
  }
) {
  const key = input.key.trim();
  if (!key) return;
  const current = variables.get(key);
  const nodeIds = input.nodeId ? [input.nodeId] : [];
  variables.set(key, {
    key,
    name: current?.name ?? input.name,
    valueType: current?.valueType ?? input.valueType,
    required: Boolean(current?.required || input.required),
    nodeIds: uniqueStrings([...(current?.nodeIds ?? []), ...nodeIds])
  });
}

function upsertModelAsset(
  modelAssets: Map<string, ServerRoleTemplateDependencyManifest['modelAssets'][number]>,
  node: ServerRoleWorkflowGraphNode,
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  warnings: Set<string>,
  options: {
    semanticModelProfileId?: string;
  } = {}
) {
  const explicitAssetKey = readConfigString(node.config, 'modelAssetKey');
  const modelProfileId = node.modelProfileId?.trim();
  const asset = explicitAssetKey
    ? readExplicitAsset(assetByTypeAndKey, 'MODEL', explicitAssetKey, node.id, warnings)
    : findAssetByKeyOrSchemaValue(assetByTypeAndKey, 'MODEL', modelProfileId, 'modelId');
  const semanticModelProfileId =
    options.semanticModelProfileId ?? getSemanticModelProfileIdForNode(node);
  const resolvedModelProfileId =
    semanticModelProfileId ??
    mapModelProfileIdToSemanticDefault(readSchemaString(asset, 'modelProfileId') ?? readSchemaString(asset, 'modelId') ?? modelProfileId ?? explicitAssetKey ?? '') ??
    'qiu-general-default';
  const key = semanticModelProfileId ?? asset?.key ?? explicitAssetKey ?? resolvedModelProfileId;
  const current = modelAssets.get(key);
  const inferredRequirement = inferModelRequirementFromNode(node, semanticModelProfileId);
  const required = !readConfigBoolean(node.config, 'optionalModel');

  modelAssets.set(key, {
    key,
    name: current?.name ?? asset?.name ?? inferredRequirement.name,
    providerId: current?.providerId ?? readSchemaString(asset, 'providerId') ?? asset?.category,
    providerName: current?.providerName ?? readSchemaString(asset, 'providerName') ?? readSchemaString(asset, 'providerId'),
    modelId: current?.modelId ?? readSchemaString(asset, 'modelId') ?? resolvedModelProfileId,
    modelProfileId: current?.modelProfileId ?? resolvedModelProfileId,
    capabilities: uniqueStrings([
      ...(current?.capabilities ?? []),
      ...inferredRequirement.capabilities,
      ...readSchemaStringArray(asset, 'capabilities')
    ]),
    inputTypes: uniqueStrings([
      ...(current?.inputTypes ?? []),
      ...inferredRequirement.inputTypes,
      ...readSchemaStringArray(asset, 'inputTypes')
    ]),
    outputTypes: uniqueStrings([
      ...(current?.outputTypes ?? []),
      ...inferredRequirement.outputTypes,
      ...readSchemaStringArray(asset, 'outputTypes')
    ]),
    credentialFields: uniqueStrings([
      ...(current?.credentialFields ?? []),
      ...readSchemaStringArray(asset, 'credentialFields')
    ]),
    apiStyle: current?.apiStyle ?? readSchemaString(asset, 'apiStyle'),
    availabilityStatus: current?.availabilityStatus ?? readSchemaString(asset, 'availabilityStatus'),
    supportsModelList: current?.supportsModelList ?? readSchemaBoolean(asset, 'supportsModelList'),
    required: Boolean(current?.required || required),
    nodeIds: uniqueStrings([...(current?.nodeIds ?? []), node.id])
  });
}

function inferModelRequirementFromNode(node: ServerRoleWorkflowGraphNode, semanticModelProfileId?: string): {
  name: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
} {
  const semanticRequirement = semanticModelProfileId
    ? inferModelRequirementFromSemanticProfileId(semanticModelProfileId)
    : undefined;
  if (semanticRequirement) {
    return semanticRequirement;
  }

  const taskType = getEffectiveModelTaskTypeForNode(node);

  if (taskType === 'vision') {
    return {
      name: '图片理解模型',
      capabilities: ['image_understanding', 'vision_understanding', 'vision_text'],
      inputTypes: ['image', 'text'],
      outputTypes: ['text', 'json']
    };
  }

  if (taskType === 'image_generation') {
    return {
      name: '生图模型',
      capabilities: ['image_generation', 'text_to_image'],
      inputTypes: ['text'],
      outputTypes: ['image']
    };
  }

  if (taskType === 'image_editing') {
    return {
      name: '参考图编辑模型',
      capabilities: ['image_editing', 'image_to_image'],
      inputTypes: ['image', 'text'],
      outputTypes: ['image']
    };
  }

  if (taskType === 'audio_transcription') {
    return {
      name: '语音识别模型',
      capabilities: ['audio_to_text'],
      inputTypes: ['audio', 'video'],
      outputTypes: ['text', 'json']
    };
  }

  if (taskType === 'video_understanding') {
    return {
      name: '视频理解模型',
      capabilities: ['video_understanding', 'video_text'],
      inputTypes: ['video', 'text'],
      outputTypes: ['text', 'json']
    };
  }

  if (taskType === 'video_generation') {
    return {
      name: '生视频模型',
      capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
      inputTypes: ['text', 'image'],
      outputTypes: ['video']
    };
  }

  if (taskType === 'embedding') {
    return {
      name: '向量模型',
      capabilities: ['embedding'],
      inputTypes: ['text'],
      outputTypes: ['embedding']
    };
  }

  if (taskType === 'rerank') {
    return {
      name: '重排模型',
      capabilities: ['rerank'],
      inputTypes: ['text'],
      outputTypes: ['scores']
    };
  }

  return {
    name: taskType === 'reasoning' ? '推理文本模型' : '文本模型',
    capabilities: taskType === 'reasoning' ? ['reasoning_text', 'text'] : ['text'],
    inputTypes: ['text'],
    outputTypes: ['text', 'json']
  };
}

function inferModelRequirementFromSemanticProfileId(profileId: string): {
  name: string;
  capabilities: string[];
  inputTypes: string[];
  outputTypes: string[];
} | undefined {
  if (profileId === 'qiu-vision-default') {
    return {
      name: '图片理解模型',
      capabilities: ['image_understanding', 'vision_understanding', 'vision_text'],
      inputTypes: ['image', 'text'],
      outputTypes: ['text', 'json']
    };
  }

  if (profileId === 'qiu-image-generation-default') {
    return {
      name: '生图模型',
      capabilities: ['image_generation', 'text_to_image'],
      inputTypes: ['text'],
      outputTypes: ['image']
    };
  }

  if (profileId === 'qiu-image-editing-default') {
    return {
      name: '参考图编辑模型',
      capabilities: ['image_editing', 'image_to_image'],
      inputTypes: ['image', 'text'],
      outputTypes: ['image']
    };
  }

  if (profileId === 'qiu-video-generation-default') {
    return {
      name: '生视频模型',
      capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
      inputTypes: ['text', 'image'],
      outputTypes: ['video']
    };
  }

  if (profileId === 'qiu-asr-default') {
    return {
      name: '语音识别模型',
      capabilities: ['audio_to_text'],
      inputTypes: ['audio', 'video'],
      outputTypes: ['text', 'json']
    };
  }

  if (profileId === 'qiu-audio-generation-default') {
    return {
      name: '口播模型',
      capabilities: ['text_to_audio'],
      inputTypes: ['text'],
      outputTypes: ['audio']
    };
  }

  if (profileId === 'qiu-embedding-default') {
    return {
      name: '向量模型',
      capabilities: ['embedding'],
      inputTypes: ['text'],
      outputTypes: ['embedding']
    };
  }

  if (profileId === 'qiu-rerank-default') {
    return {
      name: '重排模型',
      capabilities: ['rerank'],
      inputTypes: ['text'],
      outputTypes: ['scores']
    };
  }

  if (profileId === 'qiu-reasoning-default') {
    return {
      name: '推理文本模型',
      capabilities: ['reasoning_text', 'text'],
      inputTypes: ['text'],
      outputTypes: ['text', 'json']
    };
  }

  if (profileId === 'qiu-general-default') {
    return {
      name: '文本模型',
      capabilities: ['text'],
      inputTypes: ['text'],
      outputTypes: ['text', 'json']
    };
  }

  return undefined;
}

function getSemanticModelProfileIdForNode(node: ServerRoleWorkflowGraphNode): string | undefined {
  const taskType = getEffectiveModelTaskTypeForNode(node);
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

function getEffectiveModelTaskTypeForNode(node: ServerRoleWorkflowGraphNode): string {
  const taskType = readConfigString(node.config, 'llmTaskType') ?? 'text';
  if (taskType === 'image_generation' && workflowNodeUsesReferenceImage(node)) {
    return 'image_editing';
  }

  return taskType;
}

function workflowNodeUsesReferenceImage(node: ServerRoleWorkflowGraphNode): boolean {
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

function mapModelProfileIdToSemanticDefault(profileId: string): string | undefined {
  const normalized = profileId.trim().toLowerCase();
  if (!normalized) return undefined;
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

function upsertToolAction(
  toolActions: Map<string, ServerRoleTemplateDependencyManifest['toolActions'][number]>,
  node: ServerRoleWorkflowGraphNode,
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  warnings: Set<string>
) {
  const explicitAssetKey = readConfigString(node.config, 'toolActionAssetKey');
  const configuredActionId = readConfigString(node.config, 'action');
  const asset = explicitAssetKey
    ? readExplicitAsset(assetByTypeAndKey, 'TOOL', explicitAssetKey, node.id, warnings)
    : findAssetByKeyOrSchemaValue(assetByTypeAndKey, 'TOOL', configuredActionId, 'actionId');
  const actionId = readSchemaString(asset, 'actionId') ?? configuredActionId ?? asset?.key;
  if (!actionId) return;

  const catalogAction = getServerToolAction(actionId);
  const packageId =
    readSchemaString(asset, 'packageId') ??
    catalogAction?.packageId ??
    node.toolId?.trim() ??
    'unknown-tool';
  const key = asset?.key ?? explicitAssetKey ?? actionId;
  const current = toolActions.get(key);

  toolActions.set(key, {
    key,
    name: current?.name ?? asset?.name ?? catalogAction?.name,
    packageId: current?.packageId ?? packageId,
    actionId: current?.actionId ?? actionId,
    category: current?.category ?? asset?.category ?? catalogAction?.category,
    inputTypes: uniqueStrings([
      ...(current?.inputTypes ?? []),
      ...readToolPortTypes(asset, 'input'),
      ...(catalogAction?.input.map((port) => port.type) ?? [])
    ]),
    outputTypes: uniqueStrings([
      ...(current?.outputTypes ?? []),
      ...readToolPortTypes(asset, 'output'),
      ...(catalogAction?.output.map((port) => port.type) ?? [])
    ]),
    requiredConfig: uniqueStrings([
      ...(current?.requiredConfig ?? []),
      ...readSchemaStringArray(asset, 'requiredConfig'),
      ...(catalogAction?.requiredConfig ?? [])
    ]),
    requiredDependencies: uniqueStrings([
      ...(current?.requiredDependencies ?? []),
      ...readSchemaStringArray(asset, 'requiredDependencies'),
      ...(catalogAction?.requiredDependencies ?? [])
    ]),
    artifactFormat: current?.artifactFormat ?? readSchemaString(asset, 'artifactFormat') ?? catalogAction?.artifactFormat,
    maturity: current?.maturity ?? readSchemaString(asset, 'maturity') ?? catalogAction?.maturity,
    required: true,
    nodeIds: uniqueStrings([...(current?.nodeIds ?? []), node.id])
  });
}

function upsertArtifactTemplate(
  artifactTemplates: Map<string, ServerRoleTemplateDependencyManifest['artifactTemplates'][number]>,
  node: ServerRoleWorkflowGraphNode,
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  warnings: Set<string>
) {
  const explicitAssetKey = readConfigString(node.config, 'artifactTemplateAssetKey');
  const actionId = readConfigString(node.config, 'action');
  const artifactType = node.artifactType?.trim();
  const asset = explicitAssetKey
    ? readExplicitAsset(assetByTypeAndKey, 'ARTIFACT_TEMPLATE', explicitAssetKey, node.id, warnings)
    : findAssetByKeyOrSchemaValue(assetByTypeAndKey, 'ARTIFACT_TEMPLATE', actionId, 'toolActionId') ??
      findAssetByKeyOrSchemaValue(assetByTypeAndKey, 'ARTIFACT_TEMPLATE', artifactType, 'artifactType');
  const key = asset?.key ?? explicitAssetKey ?? `${artifactType ?? 'artifact'}:${actionId ?? node.id}`;
  const current = artifactTemplates.get(key);

  artifactTemplates.set(key, {
    key,
    name: current?.name ?? asset?.name,
    artifactType: current?.artifactType ?? readSchemaString(asset, 'artifactType') ?? artifactType,
    toolActionId: current?.toolActionId ?? readSchemaString(asset, 'toolActionId') ?? actionId,
    fileNamePattern: current?.fileNamePattern ?? readSchemaString(asset, 'fileNamePattern'),
    inputVariables: uniqueStrings([
      ...(current?.inputVariables ?? []),
      ...readSchemaStringArray(asset, 'inputVariables'),
      ...(node.inputVariables ?? [])
    ]),
    nodeIds: uniqueStrings([...(current?.nodeIds ?? []), node.id])
  });
}

function upsertNodeTemplate(
  nodeTemplates: Map<string, ServerRoleTemplateDependencyManifest['nodeTemplates'][number]>,
  node: ServerRoleWorkflowGraphNode,
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  warnings: Set<string>
) {
  const explicitAssetKey = readConfigString(node.config, 'nodeTemplateAssetKey');
  if (!explicitAssetKey) return;

  const asset = readExplicitAsset(assetByTypeAndKey, 'NODE_TEMPLATE', explicitAssetKey, node.id, warnings);
  const key = asset?.key ?? explicitAssetKey;
  const current = nodeTemplates.get(key);
  nodeTemplates.set(key, {
    key,
    name: current?.name ?? asset?.name,
    nodeType: current?.nodeType ?? readSchemaString(asset, 'nodeType') ?? node.type,
    inputVariables: uniqueStrings([
      ...(current?.inputVariables ?? []),
      ...readSchemaStringArray(asset, 'inputVariables'),
      ...(node.inputVariables ?? [])
    ]),
    outputVariables: uniqueStrings([
      ...(current?.outputVariables ?? []),
      ...readSchemaStringArray(asset, 'outputVariables'),
      ...(node.outputVariables ?? [])
    ]),
    nodeIds: uniqueStrings([...(current?.nodeIds ?? []), node.id])
  });
}

function isModelNode(node: ServerRoleWorkflowGraphNode): boolean {
  return node.type === 'llm';
}

function readVariableAssetName(
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  variableName: string
): string | undefined {
  return findVariableAsset(assetByTypeAndKey, variableName)?.name;
}

function findVariableAsset(
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  variableName: string
): RoleTemplateDependencyAsset | undefined {
  return (
    assetByTypeAndKey.get(`VARIABLE:${variableName}`) ??
    assetByTypeAndKey.get(`VARIABLE:${variableAliasByRuntimeRef[variableName]}`)
  );
}

function readExplicitAsset(
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  type: string,
  key: string,
  nodeId: string,
  warnings: Set<string>
): RoleTemplateDependencyAsset | undefined {
  const asset = assetByTypeAndKey.get(`${type}:${key}`);
  if (!asset) {
    warnings.add(`节点 ${nodeId} 引用了不存在的 ${type} 资产：${key}`);
    return undefined;
  }
  if (asset.status === 'ARCHIVED') {
    warnings.add(`节点 ${nodeId} 引用了已归档的 ${type} 资产：${key}`);
  }
  if (asset.status === 'DISABLED') {
    warnings.add(`节点 ${nodeId} 引用了已停用的 ${type} 资产：${key}`);
  }
  return asset;
}

function findAssetByKeyOrSchemaValue(
  assetByTypeAndKey: Map<string, RoleTemplateDependencyAsset>,
  type: string,
  value: string | undefined,
  schemaField: string
): RoleTemplateDependencyAsset | undefined {
  if (!value) return undefined;
  const direct = assetByTypeAndKey.get(`${type}:${value}`);
  if (direct) return direct;

  for (const [assetKey, asset] of assetByTypeAndKey) {
    if (!assetKey.startsWith(`${type}:`)) continue;
    if (readSchemaString(asset, schemaField) === value) {
      return asset;
    }
  }

  return undefined;
}

function readSchemaString(asset: RoleTemplateDependencyAsset | undefined, key: string): string | undefined {
  const schema = readRecord(asset?.schema);
  const value = schema?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readSchemaStringArray(asset: RoleTemplateDependencyAsset | undefined, key: string): string[] {
  const schema = readRecord(asset?.schema);
  const value = schema?.[key];
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((item): item is string => typeof item === 'string'));
}

function readSchemaBoolean(asset: RoleTemplateDependencyAsset | undefined, key: string): boolean | undefined {
  const schema = readRecord(asset?.schema);
  const value = schema?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function readToolPortTypes(asset: RoleTemplateDependencyAsset | undefined, key: 'input' | 'output'): string[] {
  const schema = readRecord(asset?.schema);
  const ports = schema?.[key];
  if (!Array.isArray(ports)) return [];
  return uniqueStrings(
    ports.flatMap((port) => {
      const record = readRecord(port);
      const type = record?.type;
      return typeof type === 'string' ? [type] : [];
    })
  );
}

function readConfigString(config: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readConfigBoolean(config: Record<string, unknown> | undefined, key: string): boolean {
  return config?.[key] === true;
}

function readConfigStringArray(config: Record<string, unknown> | undefined, key: string): string[] {
  const value = config?.[key];
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.filter((item): item is string => typeof item === 'string'));
}

function readConfigToolActions(
  config: Record<string, unknown> | undefined
): Array<{ toolId: string; action: string; assetKey?: string }> {
  const value = config?.requiredToolActions;
  if (!Array.isArray(value)) return [];

  return value.flatMap((item) => {
    const record = readRecord(item);
    const toolId = typeof record?.toolId === 'string' ? record.toolId.trim() : '';
    const action = typeof record?.action === 'string' ? record.action.trim() : '';
    const assetKey = typeof record?.assetKey === 'string' ? record.assetKey.trim() : '';
    if (!toolId || !action) {
      return [];
    }
    return [{ toolId, action, ...(assetKey ? { assetKey } : {}) }];
  });
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sortByKey<T extends { key: string }>(values: T[]): T[] {
  return values.sort((left, right) => left.key.localeCompare(right.key));
}
