export type ServerRoleWorkflowGraphNodeType =
  | 'start'
  | 'input'
  | 'list'
  | 'knowledge'
  | 'llm'
  | 'data'
  | 'tool'
  | 'condition'
  | 'iteration'
  | 'loop'
  | 'aggregator'
  | 'artifact'
  | 'approval'
  | 'output';

export type ServerRoleWorkflowGraphArtifactType =
  | 'markdown'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'pdf'
  | 'png'
  | 'jpg'
  | 'mp4'
  | 'csv'
  | 'zip';

export type ServerRoleWorkflowGraphVariableType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'json'
  | 'asset'
  | 'asset[]'
  | 'table'
  | 'artifact';

export type ServerRoleWorkflowGraphEdgeConditionType =
  | 'always'
  | 'equals'
  | 'contains'
  | 'exists'
  | 'expression';

export interface ServerRoleWorkflowGraphNode {
  id: string;
  type: ServerRoleWorkflowGraphNodeType;
  name: string;
  description?: string;
  instruction?: string;
  modelProfileId?: string;
  toolId?: string;
  artifactType?: ServerRoleWorkflowGraphArtifactType;
  inputVariables?: string[];
  outputVariables?: string[];
  requiresApproval?: boolean;
  config?: Record<string, unknown>;
}

export interface ServerRoleWorkflowGraphEdgeCondition {
  type: ServerRoleWorkflowGraphEdgeConditionType;
  variable?: string;
  value?: unknown;
  expression?: string;
}

export interface ServerRoleWorkflowGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: ServerRoleWorkflowGraphEdgeCondition;
}

export interface ServerRoleWorkflowGraphVariable {
  name: string;
  type?: ServerRoleWorkflowGraphVariableType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface ServerRoleWorkflowGraphRuntimePolicy {
  maxNodeExecutions?: number;
  maxLoopIterations?: number;
  requireApprovalBeforeTools?: boolean;
}

export interface ServerRoleWorkflowGraph {
  version: '1.0.0';
  nodes: ServerRoleWorkflowGraphNode[];
  edges: ServerRoleWorkflowGraphEdge[];
  entryNodeId: string;
  variables?: ServerRoleWorkflowGraphVariable[];
  runtimePolicy?: ServerRoleWorkflowGraphRuntimePolicy;
}

export interface WorkflowStepLike {
  id: string;
  order: number;
  type: 'input' | 'llm' | 'knowledge' | 'tool' | 'approval' | 'output';
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

const nodeTypes = new Set<string>([
  'start',
  'input',
  'list',
  'knowledge',
  'llm',
  'data',
  'tool',
  'condition',
  'iteration',
  'loop',
  'aggregator',
  'artifact',
  'approval',
  'output'
]);

const artifactTypes = new Set<string>([
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
]);

const variableTypes = new Set<string>([
  'text',
  'number',
  'boolean',
  'json',
  'asset',
  'asset[]',
  'table',
  'artifact'
]);

const conditionTypes = new Set<string>([
  'always',
  'equals',
  'contains',
  'exists',
  'expression'
]);

export function buildWorkflowGraphFromSteps(steps: WorkflowStepLike[]): ServerRoleWorkflowGraph {
  const orderedSteps = [...steps].sort((left, right) => left.order - right.order);
  const toolIds = [...new Set(orderedSteps.flatMap((step) => step.toolIds ?? []))];
  const hasKnowledge = orderedSteps.some((step) => step.type === 'knowledge');
  const hasWebSearch = toolIds.includes('web-search');
  const artifactType = inferArtifactTypeFromSteps(orderedSteps);
  const sourceInstruction = orderedSteps
    .map((step) => `${step.order}. ${step.name}: ${step.instruction}`)
    .join('\n');
  const nodes: ServerRoleWorkflowGraphNode[] = [
    {
      id: 'start',
      type: 'start',
      name: 'Start',
      description: 'Workflow entry node.'
    },
    {
      id: 'receive_input',
      type: 'input',
      name: 'Receive task',
      instruction: 'Normalize the user task, attached files, goal, constraints, and expected deliverable.',
      inputVariables: ['start.text', 'start.files'],
      outputVariables: ['task_brief'],
      config: {
        source: 'workflow_steps_fallback'
      }
    },
    ...(hasKnowledge
      ? [
          {
            id: 'gather_context',
            type: 'knowledge' as const,
            name: 'Gather context',
            instruction: 'Read available enterprise and local knowledge context before drafting.',
            inputVariables: ['start.text'],
            outputVariables: ['knowledge_context']
          }
        ]
      : []),
    ...(hasWebSearch
      ? [
          {
            id: 'web_research',
            type: 'tool' as const,
            name: 'Web research',
            instruction: 'Search web context when the task needs external or fresh information.',
            toolId: 'web-search',
            inputVariables: ['start.text'],
            outputVariables: ['web_context'],
            config: {
              action: 'web.search',
              input: {
                query: '{{start.text}}',
                maxResults: 5
              }
            }
          }
        ]
      : []),
    {
      id: 'draft_result',
      type: 'llm',
      name: 'Draft result',
      instruction:
        sourceInstruction ||
        'Complete the digital employee task and produce a practical business-ready result.',
      inputVariables: [
        'start.text',
        hasKnowledge ? 'gather_context.text' : undefined,
        hasWebSearch ? 'web_research.text' : undefined
      ].filter((value): value is string => Boolean(value)),
      outputVariables: ['draft_text']
    },
    {
      id: 'write_artifact',
      type: 'artifact',
      name: 'Write deliverable',
      instruction: `Write the final deliverable as ${artifactType}.`,
      toolId: artifactType === 'mp4' ? 'video-processing' : 'office-document',
      artifactType,
      inputVariables: ['draft_result.text'],
      outputVariables: ['deliverable_file']
    },
    {
      id: 'final_output',
      type: 'output',
      name: 'Final response',
      instruction: 'Summarize the completed work, mention generated local file paths, and list next actions.',
      inputVariables: ['draft_result.text', 'write_artifact.file'],
      outputVariables: ['final_answer']
    }
  ];
  const edges: ServerRoleWorkflowGraphEdge[] = [];
  let previousNodeId = 'start';

  for (const node of nodes.filter((node) => node.id !== 'start')) {
    edges.push({
      id: `${previousNodeId}__${node.id}`,
      sourceNodeId: previousNodeId,
      targetNodeId: node.id,
      condition: {
        type: 'always'
      }
    });
    previousNodeId = node.id;
  }

  return {
    version: '1.0.0',
    nodes,
    edges,
    entryNodeId: 'start',
    runtimePolicy: defaultRuntimePolicy()
  };
}

function inferArtifactTypeFromSteps(
  steps: WorkflowStepLike[]
): NonNullable<ServerRoleWorkflowGraphNode['artifactType']> {
  const text = steps
    .flatMap((step) => [step.id, step.name, step.instruction, ...(step.toolIds ?? [])])
    .join(' ')
    .toLowerCase();

  if (/\b(ppt|pptx|slides?|presentation)\b/.test(text)) {
    return 'pptx';
  }

  if (/\b(video|mp4|clip|trim|ffmpeg|cut_plan)\b/.test(text)) {
    return 'mp4';
  }

  if (/\b(xlsx?|spreadsheet|csv|excel|finance|invoice|reimbursement|inventory|metrics?|dashboard|quote)\b/.test(text)) {
    return 'xlsx';
  }

  return 'docx';
}

export function normalizeWorkflowGraph(
  value: unknown,
  fallbackSteps: WorkflowStepLike[] = []
): ServerRoleWorkflowGraph {
  if (!isRecord(value) || Object.keys(value).length === 0) {
    return buildWorkflowGraphFromSteps(fallbackSteps);
  }

  if (value.version !== '1.0.0') {
    throw new Error('Workflow graph version must be 1.0.0.');
  }

  const nodes = normalizeNodes(value.nodes);
  const nodeIds = new Set(nodes.map((node) => node.id));
  const entryNodeId = requireText(value.entryNodeId, 'Workflow graph entry node id cannot be empty.');
  if (!nodeIds.has(entryNodeId)) {
    throw new Error('Workflow graph entry node must reference an existing node.');
  }

  const edges = normalizeEdges(value.edges, nodeIds);

  return {
    version: '1.0.0',
    nodes,
    edges,
    entryNodeId,
    variables: normalizeVariables(value.variables),
    runtimePolicy: normalizeRuntimePolicy(value.runtimePolicy)
  };
}

export function normalizeWorkflowGraphOrFallback(
  value: unknown,
  fallbackSteps: WorkflowStepLike[] = []
): ServerRoleWorkflowGraph {
  try {
    return normalizeWorkflowGraph(value, fallbackSteps);
  } catch {
    return buildWorkflowGraphFromSteps(fallbackSteps);
  }
}

function normalizeNodes(value: unknown): ServerRoleWorkflowGraphNode[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Workflow graph must contain at least one node.');
  }

  const nodeIds = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error('Workflow graph node must be an object.');
    }

    const id = requireText(item.id, 'Workflow graph node id cannot be empty.');
    if (nodeIds.has(id)) {
      throw new Error(`Workflow graph node id must be unique: ${id}.`);
    }
    nodeIds.add(id);

    const type = requireText(item.type, `Workflow graph node type cannot be empty: ${id}.`);
    if (!nodeTypes.has(type)) {
      throw new Error(`Workflow graph node type is invalid: ${type}.`);
    }
    const config = normalizeNodeConfig(type, optionalRecord(item.config));

    const artifactType = optionalText(item.artifactType);
    if (artifactType && !artifactTypes.has(artifactType)) {
      throw new Error(`Workflow graph artifact type is invalid: ${artifactType}.`);
    }

    return {
      id,
      type: type as ServerRoleWorkflowGraphNodeType,
      name: requireText(item.name, `Workflow graph node name cannot be empty: ${id}.`),
      description: optionalText(item.description),
      instruction: optionalText(item.instruction),
      modelProfileId: optionalText(item.modelProfileId),
      toolId: optionalText(item.toolId),
      artifactType: artifactType as ServerRoleWorkflowGraphArtifactType | undefined,
      inputVariables: normalizeStringArray(item.inputVariables),
      outputVariables: normalizeStringArray(item.outputVariables),
      requiresApproval: optionalBoolean(item.requiresApproval),
      config
    };
  });
}

function normalizeNodeConfig(
  type: string,
  config: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const nextConfig = { ...(config ?? {}) };

  if (type === 'data') {
    return {
      ...nextConfig,
      dataMode: readDataMode(nextConfig.dataMode)
    };
  }

  if (type === 'llm') {
    return {
      ...nextConfig,
      llmTaskType: readConfigString(nextConfig.llmTaskType) ?? 'text',
      outputMode: readConfigString(nextConfig.outputMode) ?? 'text'
    };
  }

  return config;
}

function normalizeEdges(
  value: unknown,
  nodeIds: Set<string>
): ServerRoleWorkflowGraphEdge[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Workflow graph edges must be an array.');
  }

  const edgeIds = new Set<string>();
  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error('Workflow graph edge must be an object.');
    }

    const id = requireText(item.id, 'Workflow graph edge id cannot be empty.');
    if (edgeIds.has(id)) {
      throw new Error(`Workflow graph edge id must be unique: ${id}.`);
    }
    edgeIds.add(id);

    const sourceNodeId = requireText(item.sourceNodeId, `Workflow graph edge source cannot be empty: ${id}.`);
    const targetNodeId = requireText(item.targetNodeId, `Workflow graph edge target cannot be empty: ${id}.`);
    if (!nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
      throw new Error(`Workflow graph edge must reference existing nodes: ${id}.`);
    }

    return {
      id,
      sourceNodeId,
      targetNodeId,
      condition: normalizeCondition(item.condition)
    };
  });
}

function normalizeCondition(value: unknown): ServerRoleWorkflowGraphEdgeCondition | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error('Workflow graph edge condition must be an object.');
  }

  const type = requireText(value.type, 'Workflow graph edge condition type cannot be empty.');
  if (!conditionTypes.has(type)) {
    throw new Error(`Workflow graph edge condition type is invalid: ${type}.`);
  }

  return {
    type: type as ServerRoleWorkflowGraphEdgeConditionType,
    variable: optionalText(value.variable),
    value: value.value,
    expression: optionalText(value.expression)
  };
}

function readDataMode(value: unknown): 'assign' | 'template' | 'code' {
  const mode = readConfigString(value);
  return mode === 'template' || mode === 'code' ? mode : 'assign';
}

function readConfigString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function normalizeVariables(value: unknown): ServerRoleWorkflowGraphVariable[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error('Workflow graph variables must be an array.');
  }

  return value.map((item) => {
    if (!isRecord(item)) {
      throw new Error('Workflow graph variable must be an object.');
    }

    return {
      name: requireText(item.name, 'Workflow graph variable name cannot be empty.'),
      type: normalizeVariableType(item.type),
      description: optionalText(item.description),
      required: optionalBoolean(item.required),
      defaultValue: item.defaultValue
    };
  });
}

function normalizeVariableType(value: unknown): ServerRoleWorkflowGraphVariableType | undefined {
  const type = optionalText(value);
  if (!type) {
    return undefined;
  }

  if (!variableTypes.has(type)) {
    throw new Error(`Workflow graph variable type is invalid: ${type}.`);
  }

  return type as ServerRoleWorkflowGraphVariableType;
}

function normalizeRuntimePolicy(value: unknown): ServerRoleWorkflowGraphRuntimePolicy {
  if (value === undefined || value === null) {
    return defaultRuntimePolicy();
  }

  if (!isRecord(value)) {
    throw new Error('Workflow graph runtime policy must be an object.');
  }

  return {
    maxNodeExecutions: optionalNonNegativeInteger(value.maxNodeExecutions) ?? 64,
    maxLoopIterations: optionalNonNegativeInteger(value.maxLoopIterations) ?? 8,
    requireApprovalBeforeTools: optionalBoolean(value.requireApprovalBeforeTools)
  };
}

function defaultRuntimePolicy(): ServerRoleWorkflowGraphRuntimePolicy {
  return {
    maxNodeExecutions: 64,
    maxLoopIterations: 8,
    requireApprovalBeforeTools: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireText(value: unknown, message: string): string {
  const normalized = optionalText(value);
  if (!normalized) {
    throw new Error(message);
  }

  return normalized;
}

function optionalText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error('Workflow graph text field must be a string.');
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function optionalBoolean(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw new Error('Workflow graph boolean field must be a boolean.');
  }

  return value;
}

function optionalNonNegativeInteger(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error('Workflow graph numeric field must be a non-negative integer.');
  }

  return value;
}

function optionalRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error('Workflow graph config field must be an object.');
  }

  return value;
}

function normalizeStringArray(value: unknown): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error('Workflow graph string array field must be an array.');
  }

  return [
    ...new Set(
      value.map((item) => requireText(item, 'Workflow graph string array item cannot be empty.'))
    )
  ];
}
