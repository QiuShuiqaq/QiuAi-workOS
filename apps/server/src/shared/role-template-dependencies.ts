import { getServerToolAction } from './tool-action-catalog';
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
        warnings
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
    warnings: [...warnings].sort()
  };
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
  warnings: Set<string>
) {
  const explicitAssetKey = readConfigString(node.config, 'modelAssetKey');
  const modelProfileId = node.modelProfileId?.trim();
  const asset = explicitAssetKey
    ? readExplicitAsset(assetByTypeAndKey, 'MODEL', explicitAssetKey, node.id, warnings)
    : findAssetByKeyOrSchemaValue(assetByTypeAndKey, 'MODEL', modelProfileId, 'modelId');
  const resolvedModelProfileId =
    readSchemaString(asset, 'modelProfileId') ??
    readSchemaString(asset, 'modelId') ??
    modelProfileId ??
    explicitAssetKey ??
    'qiu-general-default';
  const key = asset?.key ?? explicitAssetKey ?? resolvedModelProfileId;
  const current = modelAssets.get(key);

  modelAssets.set(key, {
    key,
    name: current?.name ?? asset?.name,
    providerId: current?.providerId ?? readSchemaString(asset, 'providerId') ?? asset?.category,
    providerName: current?.providerName ?? readSchemaString(asset, 'providerName') ?? readSchemaString(asset, 'providerId'),
    modelId: current?.modelId ?? readSchemaString(asset, 'modelId') ?? resolvedModelProfileId,
    modelProfileId: current?.modelProfileId ?? resolvedModelProfileId,
    capabilities: uniqueStrings([
      ...(current?.capabilities ?? []),
      ...readSchemaStringArray(asset, 'capabilities')
    ]),
    inputTypes: uniqueStrings([
      ...(current?.inputTypes ?? []),
      ...readSchemaStringArray(asset, 'inputTypes')
    ]),
    outputTypes: uniqueStrings([
      ...(current?.outputTypes ?? []),
      ...readSchemaStringArray(asset, 'outputTypes')
    ]),
    credentialFields: uniqueStrings([
      ...(current?.credentialFields ?? []),
      ...readSchemaStringArray(asset, 'credentialFields')
    ]),
    apiStyle: current?.apiStyle ?? readSchemaString(asset, 'apiStyle'),
    availabilityStatus: current?.availabilityStatus ?? readSchemaString(asset, 'availabilityStatus'),
    supportsModelList: current?.supportsModelList ?? readSchemaBoolean(asset, 'supportsModelList'),
    required: true,
    nodeIds: uniqueStrings([...(current?.nodeIds ?? []), node.id])
  });
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
