import type { RoleWorkflowGraph } from './workflow-graph';

const workflowGraphVariableTypes = [
  'text',
  'number',
  'boolean',
  'json',
  'asset',
  'asset[]',
  'table',
  'artifact'
] as const;

export type KnowledgeBindingSource =
  | 'local_folder'
  | 'local_file'
  | 'workspace_library'
  | 'server_summary';

export type ModelPurpose = 'general' | 'reasoning' | 'vision' | 'embeddings' | 'document';

export type ModelCapability =
  | 'text'
  | 'reasoning_text'
  | 'vision_text'
  | 'video_text'
  | 'embedding'
  | 'rerank'
  | 'text_to_image'
  | 'image_to_image'
  | 'audio_to_text'
  | 'text_to_audio';

export type ToolScope = 'desktop' | 'server' | 'hybrid';

export type ToolEntryPoint = 'native' | 'bridge' | 'api' | 'mcp';

export type ToolCapability =
  | 'web_search'
  | 'document_extract'
  | 'document_edit'
  | 'presentation_edit'
  | 'spreadsheet_edit'
  | 'video_processing'
  | 'image_processing'
  | 'audio_processing'
  | 'filesystem'
  | 'browser_automation'
  | 'custom_api'
  | 'mcp';

export type SyncPolicy = 'summary_only' | 'summary_plus_metadata';

export interface DesktopWebSearchToolSettings {
  endpoint?: string;
  apiKey?: string;
  allowPrivateNetwork?: boolean;
}

export interface DesktopToolSettings {
  webSearch?: DesktopWebSearchToolSettings;
}

export interface ModelProfile {
  id: string;
  providerId: string;
  providerName: string;
  modelName: string;
  purpose: ModelPurpose;
  capabilities?: ModelCapability[];
  apiBaseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackProfileId?: string;
  monthlyBudgetCents?: number;
}

export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  scope: ToolScope;
  entryPoint: ToolEntryPoint;
  capabilities: ToolCapability[];
  requiresApproval: boolean;
  actions?: Array<{
    action: string;
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    requiresApproval?: boolean;
  }>;
}

export type RoleWorkflowStepType =
  | 'input'
  | 'reasoning'
  | 'knowledge'
  | 'tool'
  | 'approval'
  | 'output';

export interface RoleWorkflowStep {
  id: string;
  order: number;
  type: RoleWorkflowStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

export interface RolePackageManifest {
  roleCode: string;
  name: string;
  version: string;
  summary?: string;
  templateId?: string;
  templateVersion?: string;
  skills?: Array<{
    code: string;
    name: string;
    summary: string;
  }>;
  workflowSteps?: RoleWorkflowStep[];
  workflowGraph?: RoleWorkflowGraph;
  dependencyManifest?: Record<string, unknown>;
  sampleInputs?: string[];
  outputFormat?: string;
  modelProfileIds: string[];
  toolIds: string[];
  requiredKnowledgeSources: KnowledgeBindingSource[];
  defaultTaskTypes: string[];
  syncPolicy: SyncPolicy;
}

export interface LocalRuntimeContract {
  runtimeId: string;
  deviceId: string;
  workspaceId: string;
  appVersion: string;
  installedRoleCodes: string[];
  activeRoleCode?: string;
  enabledToolIds: string[];
  enabledModelProfileIds: string[];
  knowledgeBindingIds: string[];
  syncPolicy: SyncPolicy;
  toolSettings?: DesktopToolSettings;
  lastSyncedAt?: string;
}

export function validateModelProfile(input: unknown): ModelProfile {
  const record = requireRecord(input, 'model profile');

  return {
    id: requireString(record.id, 'modelProfile.id'),
    providerId: requireString(record.providerId, 'modelProfile.providerId'),
    providerName: requireString(record.providerName, 'modelProfile.providerName'),
    modelName: requireString(record.modelName, 'modelProfile.modelName'),
    purpose: requireEnum(record.purpose, 'modelProfile.purpose', [
      'general',
      'reasoning',
      'vision',
      'embeddings',
      'document'
    ]),
    capabilities: requireStringEnumArray(record.capabilities, 'modelProfile.capabilities', [
      'text',
      'reasoning_text',
      'vision_text',
      'video_text',
      'embedding',
      'rerank',
      'text_to_image',
      'image_to_image',
      'audio_to_text',
      'text_to_audio'
    ]) as ModelCapability[],
    apiBaseUrl: optionalString(record.apiBaseUrl, 'modelProfile.apiBaseUrl'),
    apiKey: optionalString(record.apiKey, 'modelProfile.apiKey'),
    temperature: optionalNumber(record.temperature, 'modelProfile.temperature'),
    maxTokens: optionalPositiveInteger(record.maxTokens, 'modelProfile.maxTokens'),
    fallbackProfileId: optionalString(record.fallbackProfileId, 'modelProfile.fallbackProfileId'),
    monthlyBudgetCents: optionalPositiveInteger(
      record.monthlyBudgetCents,
      'modelProfile.monthlyBudgetCents'
    )
  };
}

export function validateToolManifest(input: unknown): ToolManifest {
  const record = requireRecord(input, 'tool manifest');

  return {
    id: requireString(record.id, 'toolManifest.id'),
    name: requireString(record.name, 'toolManifest.name'),
    version: requireString(record.version, 'toolManifest.version'),
    scope: requireEnum(record.scope, 'toolManifest.scope', ['desktop', 'server', 'hybrid']),
    entryPoint: requireEnum(record.entryPoint, 'toolManifest.entryPoint', [
      'native',
      'bridge',
      'api',
      'mcp'
    ]),
    capabilities: requireStringEnumArray(
      record.capabilities,
      'toolManifest.capabilities',
      ['web_search', 'document_extract', 'document_edit', 'presentation_edit', 'spreadsheet_edit', 'video_processing', 'image_processing', 'audio_processing', 'filesystem', 'browser_automation', 'custom_api', 'mcp']
    ),
    requiresApproval: optionalBoolean(record.requiresApproval, 'toolManifest.requiresApproval'),
    actions: Array.isArray(record.actions)
      ? record.actions.map((action, index) =>
          validateToolManifestAction(action, `toolManifest.actions[${index}]`)
        )
      : undefined
  };
}

function validateToolManifestAction(
  input: unknown,
  fieldName: string
): NonNullable<ToolManifest['actions']>[number] {
  const record = requireRecord(input, fieldName);

  return {
    action: requireString(record.action, `${fieldName}.action`),
    name: requireString(record.name, `${fieldName}.name`),
    description: optionalString(record.description, `${fieldName}.description`),
    inputSchema: optionalRecord(record.inputSchema, `${fieldName}.inputSchema`),
    outputSchema: optionalRecord(record.outputSchema, `${fieldName}.outputSchema`),
    requiresApproval:
      record.requiresApproval === undefined
        ? undefined
        : optionalBoolean(record.requiresApproval, `${fieldName}.requiresApproval`)
  };
}

export function validateRolePackageManifest(input: unknown): RolePackageManifest {
  const record = requireRecord(input, 'role package manifest');
  const modelProfileIds = requireStringArray(record.modelProfileIds, 'rolePackage.modelProfileIds');
  const toolIds = requireStringArray(record.toolIds, 'rolePackage.toolIds');
  const requiredKnowledgeSources = requireStringEnumArray(
    record.requiredKnowledgeSources,
    'rolePackage.requiredKnowledgeSources',
    ['local_folder', 'local_file', 'workspace_library', 'server_summary']
  );
  const defaultTaskTypes = requireStringArray(record.defaultTaskTypes, 'rolePackage.defaultTaskTypes');

  if (modelProfileIds.length === 0) {
    throw new Error('rolePackage.modelProfileIds must contain at least one model profile id.');
  }

  if (defaultTaskTypes.length === 0) {
    throw new Error('rolePackage.defaultTaskTypes must contain at least one task type.');
  }

  return {
    roleCode: requireString(record.roleCode, 'rolePackage.roleCode'),
    name: requireString(record.name, 'rolePackage.name'),
    version: requireString(record.version, 'rolePackage.version'),
    summary: optionalString(record.summary, 'rolePackage.summary'),
    templateId: optionalString(record.templateId, 'rolePackage.templateId'),
    templateVersion: optionalString(record.templateVersion, 'rolePackage.templateVersion'),
    skills: Array.isArray(record.skills)
      ? record.skills.map(validateRoleSkill)
      : undefined,
    workflowSteps: Array.isArray(record.workflowSteps)
      ? record.workflowSteps.map(validateRoleWorkflowStep)
      : undefined,
    workflowGraph:
      record.workflowGraph === undefined
        ? undefined
        : validateRoleWorkflowGraph(record.workflowGraph, 'rolePackage.workflowGraph'),
    dependencyManifest: optionalRecord(record.dependencyManifest, 'rolePackage.dependencyManifest'),
    sampleInputs: requireStringArray(record.sampleInputs, 'rolePackage.sampleInputs'),
    outputFormat: optionalString(record.outputFormat, 'rolePackage.outputFormat'),
    modelProfileIds,
    toolIds,
    requiredKnowledgeSources,
    defaultTaskTypes,
    syncPolicy: requireEnum(record.syncPolicy, 'rolePackage.syncPolicy', [
      'summary_only',
      'summary_plus_metadata'
    ])
  };
}

function validateRoleSkill(input: unknown): NonNullable<RolePackageManifest['skills']>[number] {
  const record = requireRecord(input, 'role skill');

  return {
    code: requireString(record.code, 'roleSkill.code'),
    name: requireString(record.name, 'roleSkill.name'),
    summary: requireString(record.summary, 'roleSkill.summary')
  };
}

function validateRoleWorkflowStep(input: unknown): RoleWorkflowStep {
  const record = requireRecord(input, 'role workflow step');

  return {
    id: requireString(record.id, 'roleWorkflowStep.id'),
    order: requirePositiveInteger(record.order, 'roleWorkflowStep.order'),
    type: requireEnum(record.type, 'roleWorkflowStep.type', [
      'input',
      'reasoning',
      'knowledge',
      'tool',
      'approval',
      'output'
    ]),
    name: requireString(record.name, 'roleWorkflowStep.name'),
    instruction: requireString(record.instruction, 'roleWorkflowStep.instruction'),
    toolIds: requireStringArray(record.toolIds, 'roleWorkflowStep.toolIds'),
    requiresApproval: optionalBoolean(record.requiresApproval, 'roleWorkflowStep.requiresApproval')
  };
}

function validateRoleWorkflowGraph(input: unknown, fieldName: string): RoleWorkflowGraph {
  const record = requireRecord(input, fieldName);
  const version = requireEnum(record.version, `${fieldName}.version`, ['1.0.0']);
  const nodes = requireWorkflowGraphNodes(record.nodes, `${fieldName}.nodes`);
  const edges = requireWorkflowGraphEdges(record.edges, `${fieldName}.edges`);
  const entryNodeId = requireString(record.entryNodeId, `${fieldName}.entryNodeId`);
  const nodeIds = new Set(nodes.map((node) => node.id));

  if (!nodeIds.has(entryNodeId)) {
    throw new Error(`${fieldName}.entryNodeId must reference an existing node.`);
  }

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      throw new Error(`${fieldName}.edges must reference existing nodes.`);
    }
  }

  return {
    version,
    nodes,
    edges,
    entryNodeId,
    variables: Array.isArray(record.variables)
      ? record.variables.map((item, index) =>
          validateWorkflowGraphVariable(item, `${fieldName}.variables[${index}]`)
        )
      : undefined,
    runtimePolicy: validateWorkflowGraphRuntimePolicy(
      record.runtimePolicy,
      `${fieldName}.runtimePolicy`
    )
  };
}

function requireWorkflowGraphNodes(value: unknown, fieldName: string): RoleWorkflowGraph['nodes'] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must contain at least one node.`);
  }

  const nodeIds = new Set<string>();
  return value.map((item, index) => {
    const record = requireRecord(item, `${fieldName}[${index}]`);
    const id = requireString(record.id, `${fieldName}[${index}].id`);
    const artifactType =
      record.artifactType === undefined || record.artifactType === null
        ? undefined
        : requireEnum(record.artifactType, `${fieldName}[${index}].artifactType`, [
            'markdown',
            'docx',
            'xlsx',
            'pptx',
            'pdf',
            'png',
            'jpg',
            'mp4',
            'csv',
            'zip'
          ]) as RoleWorkflowGraph['nodes'][number]['artifactType'];
    if (nodeIds.has(id)) {
      throw new Error(`${fieldName} ids must be unique.`);
    }
    nodeIds.add(id);

    return {
      id,
      type: requireEnum(record.type, `${fieldName}[${index}].type`, [
        'start',
        'input',
        'parameter_extractor',
        'list',
        'knowledge',
        'reasoning',
        'llm',
        'assign',
        'template',
        'tool',
        'condition',
        'iteration',
        'loop',
        'aggregator',
        'artifact',
        'approval',
        'output'
      ]),
      name: requireString(record.name, `${fieldName}[${index}].name`),
      description: optionalString(record.description, `${fieldName}[${index}].description`),
      instruction: optionalString(record.instruction, `${fieldName}[${index}].instruction`),
      modelProfileId: optionalString(record.modelProfileId, `${fieldName}[${index}].modelProfileId`),
      toolId: optionalString(record.toolId, `${fieldName}[${index}].toolId`),
      artifactType,
      inputVariables: requireStringArray(record.inputVariables, `${fieldName}[${index}].inputVariables`),
      outputVariables: requireStringArray(record.outputVariables, `${fieldName}[${index}].outputVariables`),
      requiresApproval: optionalBoolean(record.requiresApproval, `${fieldName}[${index}].requiresApproval`),
      config: optionalRecord(record.config, `${fieldName}[${index}].config`)
    };
  });
}

function requireWorkflowGraphEdges(value: unknown, fieldName: string): RoleWorkflowGraph['edges'] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  const edgeIds = new Set<string>();
  return value.map((item, index) => {
    const record = requireRecord(item, `${fieldName}[${index}]`);
    const id = requireString(record.id, `${fieldName}[${index}].id`);
    if (edgeIds.has(id)) {
      throw new Error(`${fieldName} ids must be unique.`);
    }
    edgeIds.add(id);

    return {
      id,
      sourceNodeId: requireString(record.sourceNodeId, `${fieldName}[${index}].sourceNodeId`),
      targetNodeId: requireString(record.targetNodeId, `${fieldName}[${index}].targetNodeId`),
      condition: validateWorkflowGraphEdgeCondition(
        record.condition,
        `${fieldName}[${index}].condition`
      )
    };
  });
}

function validateWorkflowGraphEdgeCondition(
  value: unknown,
  fieldName: string
): RoleWorkflowGraph['edges'][number]['condition'] {
  if (value === undefined || value === null) {
    return undefined;
  }

  const record = requireRecord(value, fieldName);
  return {
    type: requireEnum(record.type, `${fieldName}.type`, [
      'always',
      'equals',
      'contains',
      'exists',
      'expression'
    ]),
    variable: optionalString(record.variable, `${fieldName}.variable`),
    value: record.value,
    expression: optionalString(record.expression, `${fieldName}.expression`)
  };
}

function validateWorkflowGraphVariable(
  value: unknown,
  fieldName: string
): NonNullable<RoleWorkflowGraph['variables']>[number] {
  const record = requireRecord(value, fieldName);

  return {
    name: requireString(record.name, `${fieldName}.name`),
    type:
      record.type === undefined || record.type === null
        ? undefined
        : requireEnum(record.type, `${fieldName}.type`, workflowGraphVariableTypes),
    description: optionalString(record.description, `${fieldName}.description`),
    required: optionalBoolean(record.required, `${fieldName}.required`),
    defaultValue: record.defaultValue
  };
}

function validateWorkflowGraphRuntimePolicy(
  value: unknown,
  fieldName: string
): RoleWorkflowGraph['runtimePolicy'] {
  if (value === undefined || value === null) {
    return undefined;
  }

  const record = requireRecord(value, fieldName);
  return {
    maxNodeExecutions: optionalPositiveInteger(record.maxNodeExecutions, `${fieldName}.maxNodeExecutions`),
    maxLoopIterations: optionalPositiveInteger(record.maxLoopIterations, `${fieldName}.maxLoopIterations`),
    requireApprovalBeforeTools: optionalBoolean(
      record.requireApprovalBeforeTools,
      `${fieldName}.requireApprovalBeforeTools`
    )
  };
}

export function validateLocalRuntimeContract(input: unknown): LocalRuntimeContract {
  const record = requireRecord(input, 'local runtime contract');

  return {
    runtimeId: requireString(record.runtimeId, 'localRuntime.runtimeId'),
    deviceId: requireString(record.deviceId, 'localRuntime.deviceId'),
    workspaceId: requireString(record.workspaceId, 'localRuntime.workspaceId'),
    appVersion: requireString(record.appVersion, 'localRuntime.appVersion'),
    installedRoleCodes: requireStringArray(record.installedRoleCodes, 'localRuntime.installedRoleCodes'),
    activeRoleCode: optionalString(record.activeRoleCode, 'localRuntime.activeRoleCode'),
    enabledToolIds: requireStringArray(record.enabledToolIds, 'localRuntime.enabledToolIds'),
    enabledModelProfileIds: requireStringArray(
      record.enabledModelProfileIds,
      'localRuntime.enabledModelProfileIds'
    ),
    knowledgeBindingIds: requireStringArray(
      record.knowledgeBindingIds,
      'localRuntime.knowledgeBindingIds'
    ),
    syncPolicy: requireEnum(record.syncPolicy, 'localRuntime.syncPolicy', [
      'summary_only',
      'summary_plus_metadata'
    ]),
    toolSettings: optionalToolSettings(record.toolSettings, 'localRuntime.toolSettings'),
    lastSyncedAt: optionalString(record.lastSyncedAt, 'localRuntime.lastSyncedAt')
  };
}

function requireRecord(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`${label} must be an object.`);
  }

  return input as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  const normalized = optionalString(value, fieldName);
  if (!normalized) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return normalized;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function optionalBoolean(value: unknown, fieldName: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean.`);
  }

  return value;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return value;
}

function optionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function requirePositiveInteger(value: unknown, fieldName: string): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return value;
}

function optionalToolSettings(
  value: unknown,
  fieldName: string
): DesktopToolSettings | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const webSearch = record.webSearch;

  if (webSearch === undefined || webSearch === null) {
    return {};
  }

  if (typeof webSearch !== 'object' || webSearch === null || Array.isArray(webSearch)) {
    throw new Error(`${fieldName}.webSearch must be an object.`);
  }

  const webSearchRecord = webSearch as Record<string, unknown>;

  return {
    webSearch: {
      endpoint: optionalString(webSearchRecord.endpoint, `${fieldName}.webSearch.endpoint`),
      apiKey: optionalString(webSearchRecord.apiKey, `${fieldName}.webSearch.apiKey`),
      allowPrivateNetwork: optionalBoolean(
        webSearchRecord.allowPrivateNetwork,
        `${fieldName}.webSearch.allowPrivateNetwork`
      )
    }
  };
}

function optionalRecord(value: unknown, fieldName: string): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }

  return uniqueStrings(
    value.map((item, index) => requireString(item, `${fieldName}[${index}]`))
  );
}

function requireStringEnumArray<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return uniqueStrings(
    value.map((item, index) => requireEnum(item, `${fieldName}[${index}]`, allowed))
  ) as T[];
}

function requireEnum<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (!allowed.includes(normalized as T)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}.`);
  }

  return normalized as T;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}
