import type {
  DesktopExecutionLogEntry,
  DesktopTaskDetail,
  RolePackageManifest
} from './desktop-contract.js';

export type WorkflowGraphNodeType =
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

export type WorkflowGraphArtifactType =
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

export type WorkflowGraphVariableType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'json'
  | 'asset'
  | 'asset[]'
  | 'table'
  | 'artifact';

export type WorkflowGraphEdgeConditionType =
  | 'always'
  | 'equals'
  | 'contains'
  | 'exists'
  | 'expression';

export interface WorkflowGraphNode {
  id: string;
  type: WorkflowGraphNodeType;
  name: string;
  description?: string;
  instruction?: string;
  modelProfileId?: string;
  toolId?: string;
  artifactType?: WorkflowGraphArtifactType;
  inputVariables?: string[];
  outputVariables?: string[];
  requiresApproval?: boolean;
  config?: Record<string, unknown>;
}

export interface WorkflowGraphEdgeCondition {
  type: WorkflowGraphEdgeConditionType;
  variable?: string;
  value?: unknown;
  expression?: string;
}

export interface WorkflowGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: WorkflowGraphEdgeCondition;
}

export interface WorkflowGraphVariable {
  name: string;
  type?: WorkflowGraphVariableType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface WorkflowGraphRuntimePolicy {
  maxNodeExecutions?: number;
  maxLoopIterations?: number;
  requireApprovalBeforeTools?: boolean;
}

export interface WorkflowGraph {
  version: '1.0.0';
  nodes: WorkflowGraphNode[];
  edges: WorkflowGraphEdge[];
  entryNodeId: string;
  variables?: WorkflowGraphVariable[];
  runtimePolicy?: WorkflowGraphRuntimePolicy;
}

export interface WorkflowExecutionPlan {
  enabled: boolean;
  orderedNodes: WorkflowGraphNode[];
  orderedNodeSummaries: WorkflowExecutionNodeSummary[];
  logs: DesktopExecutionLogEntry[];
  promptContext: string;
  preferredModelProfileId?: string;
  requiredModelProfileIds: string[];
  requiredToolIds: string[];
}

export interface WorkflowExecutionNodeSummary {
  id: string;
  type: WorkflowGraphNodeType;
  name: string;
  instruction?: string;
  toolIds: string[];
  artifactType?: WorkflowGraphArtifactType;
  requiresApproval?: boolean;
}

const maxWorkflowPromptNodes = 24;
const workflowGraphNodeTypes: WorkflowGraphNodeType[] = [
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
];
const workflowGraphArtifactTypes: WorkflowGraphArtifactType[] = [
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
];
const workflowGraphVariableTypes: WorkflowGraphVariableType[] = [
  'text',
  'number',
  'boolean',
  'json',
  'asset',
  'asset[]',
  'table',
  'artifact'
];
const workflowGraphEdgeConditionTypes: WorkflowGraphEdgeConditionType[] = [
  'always',
  'equals',
  'contains',
  'exists',
  'expression'
];

export function augmentExecutionContextWithWorkflowPlan(
  context: DesktopTaskDetail['executionContext'] | undefined,
  workflowPlan: WorkflowExecutionPlan
): DesktopTaskDetail['executionContext'] | undefined {
  if (!context || !workflowPlan.enabled) {
    return context;
  }

  const contextModelProfileIds = uniqueStrings(
    context.modelProfileIds.map(mapModelProfileIdToSemanticDefault)
  );

  return {
    ...context,
    modelProfileIds: workflowPlan.preferredModelProfileId
      ? [
          workflowPlan.preferredModelProfileId,
          ...workflowPlan.requiredModelProfileIds.filter((profileId) => profileId !== workflowPlan.preferredModelProfileId),
          ...contextModelProfileIds.filter(
            (profileId) =>
              profileId !== workflowPlan.preferredModelProfileId &&
              !workflowPlan.requiredModelProfileIds.includes(profileId)
          )
        ]
      : [...new Set([...workflowPlan.requiredModelProfileIds, ...contextModelProfileIds])],
    toolIds: [...new Set([...context.toolIds, ...workflowPlan.requiredToolIds])],
    knowledgeBindingIds: [...context.knowledgeBindingIds],
    useKnowledge: context.useKnowledge,
    attachmentPaths: context.attachmentPaths ? [...context.attachmentPaths] : undefined
  };
}

export function buildWorkflowExecutionPlan(input: {
  task: DesktopTaskDetail;
  rolePackage?: RolePackageManifest;
  createdAt: string;
}): WorkflowExecutionPlan {
  const emptyPlan = createEmptyWorkflowExecutionPlan();

  if (input.rolePackage?.workflowGraph === undefined) {
    return emptyPlan;
  }

  const graph = parseWorkflowGraph(input.rolePackage.workflowGraph);
  if (!graph) {
    return {
      ...emptyPlan,
      logs: [
        createWorkflowLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_GRAPH_SKIPPED',
          'Role workflow graph is invalid, so the desktop runner fell back to the standard prompt.',
          input.createdAt
        )
      ]
    };
  }

  const selection = selectWorkflowGraphNodes({
    graph,
    task: input.task,
    createdAt: input.createdAt
  });
  const graphRequiredModelProfileIds = uniqueStrings(
    selection.orderedNodes.flatMap((node) => readWorkflowNodeSemanticModelProfileIds(node))
  );
  const manifestModelProfileIds = readDependencyManifestModelProfileIds(input.rolePackage.dependencyManifest);
  const requiredModelProfileIds =
    manifestModelProfileIds.length > 0 ? manifestModelProfileIds : graphRequiredModelProfileIds;
  const manifestToolIds = readDependencyManifestToolIds(input.rolePackage.dependencyManifest);
  const requiredToolIds =
    manifestToolIds.length > 0
      ? manifestToolIds
      : [...new Set(graph.nodes.flatMap((node) => readWorkflowNodeToolIds(node)))];
  const orderedNodeSummaries = selection.orderedNodes.map(toWorkflowExecutionNodeSummary);
  const firstExplicitModelProfileId = selection.orderedNodes.flatMap(readWorkflowNodeSemanticModelProfileIds)[0];
  const preferredModelProfileId =
    firstExplicitModelProfileId ?? requiredModelProfileIds[0];
  const promptContext = buildWorkflowPromptContext({
    graph,
    orderedNodes: selection.orderedNodes,
    conditionNotes: selection.conditionNotes
  });
  const nodeLogs = selection.orderedNodes
    .filter((node) => node.type !== 'start')
    .map((node, index) =>
      createWorkflowLog(
        input.task.taskId,
        'info',
        'WORKFLOW_GRAPH_NODE_PLANNED',
        `${index + 1}. ${node.name} (${node.type}) was included in the desktop execution plan.`,
        input.createdAt,
        sanitizeLogSuffix(`node-${index + 1}-${node.id}`)
      )
    );

  return {
    enabled: true,
    orderedNodes: selection.orderedNodes,
    orderedNodeSummaries,
    logs: [
      createWorkflowLog(
        input.task.taskId,
        'info',
        'WORKFLOW_GRAPH_LOADED',
        `Workflow graph loaded: ${selection.orderedNodes.length} node(s) planned.`,
        input.createdAt
      ),
      ...selection.logs,
      ...nodeLogs
    ],
    promptContext,
    preferredModelProfileId,
    requiredModelProfileIds,
    requiredToolIds
  };
}

function createEmptyWorkflowExecutionPlan(): WorkflowExecutionPlan {
  return {
    enabled: false,
    orderedNodes: [],
    orderedNodeSummaries: [],
    logs: [],
    promptContext: '',
    requiredModelProfileIds: [],
    requiredToolIds: []
  };
}

function toWorkflowExecutionNodeSummary(node: WorkflowGraphNode): WorkflowExecutionNodeSummary {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    instruction: node.instruction,
    toolIds: readWorkflowNodeToolIds(node),
    artifactType: node.artifactType,
    requiresApproval: node.requiresApproval
  };
}

function selectWorkflowGraphNodes(input: {
  graph: WorkflowGraph;
  task: DesktopTaskDetail;
  createdAt: string;
}): {
  orderedNodes: WorkflowGraphNode[];
  logs: DesktopExecutionLogEntry[];
  conditionNotes: string[];
} {
  const maxNodeExecutions = readWorkflowPolicyLimit(
    input.graph.runtimePolicy?.maxNodeExecutions,
    64,
    1,
    128
  );
  const maxLoopIterations = readWorkflowPolicyLimit(
    input.graph.runtimePolicy?.maxLoopIterations,
    8,
    1,
    32
  );
  const nodesById = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const edgesBySource = new Map<string, WorkflowGraphEdge[]>();
  for (const edge of input.graph.edges) {
    edgesBySource.set(edge.sourceNodeId, [...(edgesBySource.get(edge.sourceNodeId) ?? []), edge]);
  }

  const orderedNodes: WorkflowGraphNode[] = [];
  const logs: DesktopExecutionLogEntry[] = [];
  const conditionNotes: string[] = [];
  const variableValues = buildWorkflowVariableValues(input.graph, input.task);
  const visitCounts = new Map<string, number>();
  let currentNode = nodesById.get(input.graph.entryNodeId);

  while (currentNode && orderedNodes.length < maxNodeExecutions) {
    orderedNodes.push(currentNode);
    visitCounts.set(currentNode.id, (visitCounts.get(currentNode.id) ?? 0) + 1);

    const outgoingEdges = edgesBySource.get(currentNode.id) ?? [];
    if (outgoingEdges.length === 0) {
      break;
    }

    const edgeSelection = selectWorkflowGraphEdge(outgoingEdges, variableValues, input.task);
    if (!edgeSelection) {
      break;
    }

    const conditionNote = formatWorkflowEdgeConditionNote(edgeSelection.edge);
    if (conditionNote) {
      conditionNotes.push(conditionNote);
    }

    if (edgeSelection.deferredExpression) {
      logs.push(
        createWorkflowLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_GRAPH_CONDITION_DEFERRED',
          `Expression condition was included as a model-side instruction: ${edgeSelection.edge.id}.`,
          input.createdAt,
          sanitizeLogSuffix(edgeSelection.edge.id)
        )
      );
    }

    const nextNode = nodesById.get(edgeSelection.edge.targetNodeId);
    if (!nextNode) {
      break;
    }

    if ((visitCounts.get(nextNode.id) ?? 0) >= maxLoopIterations) {
      logs.push(
        createWorkflowLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_GRAPH_LOOP_LIMIT_REACHED',
          `Workflow loop limit reached before node: ${nextNode.name}.`,
          input.createdAt,
          sanitizeLogSuffix(nextNode.id)
        )
      );
      break;
    }

    currentNode = nextNode;
  }

  if (currentNode && orderedNodes.length >= maxNodeExecutions) {
    logs.push(
      createWorkflowLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_GRAPH_NODE_LIMIT_REACHED',
        `Workflow node execution limit reached: ${maxNodeExecutions}.`,
        input.createdAt
      )
    );
  }

  return {
    orderedNodes,
    logs,
    conditionNotes
  };
}

function selectWorkflowGraphEdge(
  edges: WorkflowGraphEdge[],
  variableValues: Map<string, unknown>,
  task: DesktopTaskDetail
): { edge: WorkflowGraphEdge; deferredExpression: boolean } | undefined {
  for (const edge of edges) {
    const result = evaluateWorkflowEdgeCondition(edge.condition, variableValues, task);
    if (result === 'matched') {
      return { edge, deferredExpression: false };
    }
  }

  const deferredExpressionEdge = edges.find((edge) => edge.condition?.type === 'expression');
  return deferredExpressionEdge ? { edge: deferredExpressionEdge, deferredExpression: true } : undefined;
}

function evaluateWorkflowEdgeCondition(
  condition: WorkflowGraphEdgeCondition | undefined,
  variableValues: Map<string, unknown>,
  task: DesktopTaskDetail
): 'matched' | 'skipped' | 'deferred' {
  if (!condition || condition.type === 'always') {
    return 'matched';
  }

  if (condition.type === 'expression') {
    return 'deferred';
  }

  const variableValue = readWorkflowConditionVariableValue(condition.variable, variableValues, task);

  if (condition.type === 'exists') {
    return isWorkflowValuePresent(variableValue) ? 'matched' : 'skipped';
  }

  if (condition.type === 'equals') {
    return normalizeWorkflowComparisonValue(variableValue) ===
      normalizeWorkflowComparisonValue(condition.value)
      ? 'matched'
      : 'skipped';
  }

  if (condition.type === 'contains') {
    const actualValue = normalizeWorkflowComparisonValue(variableValue);
    const expectedValue = normalizeWorkflowComparisonValue(condition.value);
    return expectedValue && actualValue.includes(expectedValue) ? 'matched' : 'skipped';
  }

  return 'skipped';
}

function readWorkflowConditionVariableValue(
  variableName: string | undefined,
  variableValues: Map<string, unknown>,
  task: DesktopTaskDetail
): unknown {
  if (!variableName) {
    return task.input;
  }

  return variableValues.get(variableName);
}

function buildWorkflowVariableValues(graph: WorkflowGraph, task: DesktopTaskDetail): Map<string, unknown> {
  const values = new Map<string, unknown>();

  for (const variable of graph.variables ?? []) {
    if (variable.defaultValue !== undefined) {
      values.set(variable.name, variable.defaultValue);
    }
  }

  values.set('input', task.input);
  values.set('title', task.title);
  values.set('task.input', task.input);
  values.set('task.title', task.title);
  values.set('task.type', task.taskType);
  values.set('task.roleCode', task.roleCode);
  values.set('task.roleName', task.roleName);

  const inputObject = parseWorkflowTaskInputObject(task.input);
  if (inputObject) {
    for (const [key, value] of Object.entries(inputObject)) {
      values.set(key, value);
      values.set(`input.${key}`, value);
    }
  }

  return values;
}

function buildWorkflowPromptContext(input: {
  graph: WorkflowGraph;
  orderedNodes: WorkflowGraphNode[];
  conditionNotes: string[];
}): string {
  if (input.orderedNodes.length === 0) {
    return '';
  }

  const promptNodes = input.orderedNodes.slice(0, maxWorkflowPromptNodes);
  const requiredToolIds = [...new Set(input.orderedNodes.flatMap((node) => readWorkflowNodeToolIds(node)))];
  const requiredModelProfileIds = uniqueStrings(
    input.orderedNodes.flatMap((node) => readWorkflowNodeSemanticModelProfileIds(node))
  );
  const artifactTypes = [
    ...new Set(input.orderedNodes.flatMap((node) => (node.artifactType ? [node.artifactType] : [])))
  ];
  const lines = [
    'Workflow graph selected execution path:',
    `Graph version: ${input.graph.version}`,
    `Entry node: ${input.graph.entryNodeId}`,
    `Runtime policy: maxNodeExecutions=${input.graph.runtimePolicy?.maxNodeExecutions ?? 64}; maxLoopIterations=${input.graph.runtimePolicy?.maxLoopIterations ?? 8}; requireApprovalBeforeTools=${input.graph.runtimePolicy?.requireApprovalBeforeTools ?? false}`,
    requiredModelProfileIds.length > 0 ? `Required workflow models: ${requiredModelProfileIds.join(', ')}` : '',
    requiredToolIds.length > 0 ? `Required workflow tools: ${requiredToolIds.join(', ')}` : '',
    artifactTypes.length > 0 ? `Expected artifact types: ${artifactTypes.join(', ')}` : '',
    input.graph.variables && input.graph.variables.length > 0
      ? `Declared variables: ${input.graph.variables
          .map((variable) => `${variable.name}${variable.required ? ' (required)' : ''}`)
          .join(', ')}`
      : '',
    input.conditionNotes.length > 0 ? `Selected branch notes:\n${input.conditionNotes.join('\n')}` : '',
    'Selected nodes:',
    ...promptNodes.map((node, index) => formatWorkflowNodeForPrompt(node, index)),
    input.orderedNodes.length > promptNodes.length
      ? `... ${input.orderedNodes.length - promptNodes.length} more workflow node(s) omitted from prompt.`
      : '',
    'Follow the selected nodes in order. Treat each node instruction as part of the task checklist. Use desktop tools only through explicit tool calls.'
  ];

  return lines.filter(Boolean).join('\n');
}

function formatWorkflowNodeForPrompt(node: WorkflowGraphNode, index: number): string {
  const nodeToolIds = readWorkflowNodeToolIds(node);
  const lines = [`${index + 1}. ${node.name} [${node.type}] (id: ${node.id})`];

  if (node.description) {
    lines.push(`Description: ${node.description}`);
  }

  if (node.instruction) {
    lines.push(`Instruction: ${node.instruction}`);
  }

  const semanticModelProfileIds = readWorkflowNodeSemanticModelProfileIds(node);
  if (semanticModelProfileIds.length > 0) {
    lines.push(`Required model capability profile: ${semanticModelProfileIds.join(', ')}`);
  }

  if (nodeToolIds.length > 0) {
    lines.push(`Required tool ids: ${nodeToolIds.join(', ')}`);
  }

  if (node.artifactType) {
    lines.push(`Expected artifact type: ${node.artifactType}`);
  }

  if (node.inputVariables && node.inputVariables.length > 0) {
    lines.push(`Input variables: ${node.inputVariables.join(', ')}`);
  }

  if (node.outputVariables && node.outputVariables.length > 0) {
    lines.push(`Output variables: ${node.outputVariables.join(', ')}`);
  }

  if (node.requiresApproval) {
    lines.push('Requires approval before irreversible action.');
  }

  if (node.config && Object.keys(node.config).length > 0) {
    lines.push(`Config keys: ${Object.keys(node.config).join(', ')}`);
  }

  return lines.join('\n   ');
}

function readWorkflowNodeToolIds(node: WorkflowGraphNode): string[] {
  const configToolIds = Array.isArray(node.config?.toolIds)
    ? node.config.toolIds.filter(
        (toolId): toolId is string => typeof toolId === 'string' && toolId.trim().length > 0
      )
    : [];

  return [
    ...new Set([
      ...(node.toolId ? [node.toolId] : []),
      ...configToolIds.map((toolId) => toolId.trim())
    ])
  ];
}

function readDependencyManifestModelProfileIds(
  manifest: RolePackageManifest['dependencyManifest']
): string[] {
  if (!manifest?.modelAssets?.length) {
    return [];
  }

  return uniqueStrings(
    manifest.modelAssets.map((asset) => readDependencyManifestSemanticModelProfileId(asset))
  );
}

function readWorkflowNodeSemanticModelProfileIds(node: WorkflowGraphNode): string[] {
  if (node.type !== 'llm') {
    return [];
  }

  return [getSemanticModelProfileIdForTaskType(getWorkflowEffectiveModelTaskType(node))];
}

function readDependencyManifestSemanticModelProfileId(
  asset: NonNullable<RolePackageManifest['dependencyManifest']>['modelAssets'][number]
): string {
  return getSemanticModelProfileIdForCapabilities({
    capabilities: asset.capabilities,
    inputTypes: asset.inputTypes,
    outputTypes: asset.outputTypes
  }) ?? mapModelProfileIdToSemanticDefault(asset.modelProfileId || asset.modelId || asset.key);
}

function getSemanticModelProfileIdForTaskType(taskType: string | undefined): string {
  if (taskType === 'vision') return 'qiu-vision-default';
  if (taskType === 'reasoning') return 'qiu-reasoning-default';
  if (taskType === 'audio_transcription') return 'qiu-asr-default';
  if (taskType === 'image_generation') return 'qiu-image-generation-default';
  if (taskType === 'image_editing') return 'qiu-image-editing-default';
  if (taskType === 'video_understanding' || taskType === 'video_generation') return 'qiu-vision-default';
  if (taskType === 'embedding') return 'qiu-embedding-default';
  if (taskType === 'rerank') return 'qiu-rerank-default';
  return 'qiu-general-default';
}

function getSemanticModelProfileIdForCapabilities(input: {
  capabilities?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
}): string | undefined {
  const capabilities = new Set((input.capabilities ?? []).map(normalizeModelRequirementToken));
  const inputTypes = new Set((input.inputTypes ?? []).map(normalizeModelRequirementToken));
  const outputTypes = new Set((input.outputTypes ?? []).map(normalizeModelRequirementToken));

  if (capabilities.has('audio_to_text')) return 'qiu-asr-default';
  if (capabilities.has('embedding') || outputTypes.has('embedding')) return 'qiu-embedding-default';
  if (capabilities.has('rerank') || outputTypes.has('scores')) return 'qiu-rerank-default';
  if (
    capabilities.has('image_editing') ||
    capabilities.has('image_to_image') ||
    (inputTypes.has('image') && outputTypes.has('image'))
  ) {
    return 'qiu-image-editing-default';
  }
  if (capabilities.has('text_to_image') || (outputTypes.has('image') && !inputTypes.has('image'))) {
    return 'qiu-image-generation-default';
  }
  if (
    capabilities.has('image_understanding') ||
    capabilities.has('vision_understanding') ||
    capabilities.has('vision_text') ||
    (inputTypes.has('image') && (outputTypes.has('text') || outputTypes.has('json')))
  ) {
    return 'qiu-vision-default';
  }
  if (capabilities.has('video_generation') || outputTypes.has('video')) return 'qiu-vision-default';
  if (capabilities.has('video_understanding') || inputTypes.has('video')) return 'qiu-vision-default';
  if (capabilities.has('reasoning') || capabilities.has('reasoning_text')) {
    return 'qiu-reasoning-default';
  }
  if (capabilities.has('text')) {
    return 'qiu-general-default';
  }

  return undefined;
}

function getWorkflowEffectiveModelTaskType(node: WorkflowGraphNode): string | undefined {
  const taskType = readTrimmedString(node.config?.llmTaskType) ?? 'text';
  if (taskType === 'image_generation' && workflowNodeUsesReferenceImage(node)) {
    return 'image_editing';
  }

  return taskType;
}

function workflowNodeUsesReferenceImage(node: WorkflowGraphNode): boolean {
  return [
    ...(node.inputVariables ?? []),
    readTrimmedString(node.config?.sourceImageVariable) ?? '',
    readTrimmedString(node.config?.referenceImageVariable) ?? ''
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
  if (normalized.includes('asr') || normalized.includes('speech') || normalized.includes('audio')) return 'qiu-asr-default';
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

function normalizeModelRequirementToken(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function readDependencyManifestToolIds(manifest: RolePackageManifest['dependencyManifest']): string[] {
  if (!manifest?.toolActions?.length) {
    return [];
  }

  return uniqueStrings(manifest.toolActions.map((action) => action.packageId));
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function formatWorkflowEdgeConditionNote(edge: WorkflowGraphEdge): string | undefined {
  const condition = edge.condition;
  if (!condition || condition.type === 'always') {
    return undefined;
  }

  if (condition.type === 'expression') {
    return `- ${edge.id}: expression condition deferred to model: ${condition.expression ?? 'none'}`;
  }

  return `- ${edge.id}: ${condition.type} ${condition.variable ?? 'task.input'} ${JSON.stringify(condition.value)}`;
}

export function parseWorkflowGraph(value: unknown): WorkflowGraph | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  const nodesValue = record.nodes;
  const edgesValue = record.edges;
  const entryNodeId = readTrimmedString(record.entryNodeId);

  if (!Array.isArray(nodesValue) || !Array.isArray(edgesValue) || !entryNodeId) {
    return undefined;
  }

  const nodes = nodesValue.map(parseWorkflowGraphNode);
  const edges = edgesValue.map(parseWorkflowGraphEdge);
  if (nodes.some((node) => !node) || edges.some((edge) => !edge)) {
    return undefined;
  }

  const parsedNodes = nodes as WorkflowGraphNode[];
  const parsedEdges = edges as WorkflowGraphEdge[];
  const nodeIds = new Set(parsedNodes.map((node) => node.id));
  if (nodeIds.size !== parsedNodes.length || !nodeIds.has(entryNodeId)) {
    return undefined;
  }

  if (
    parsedEdges.some(
      (edge) => !nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)
    )
  ) {
    return undefined;
  }

  const variablesValue = record.variables;
  const variables = Array.isArray(variablesValue)
    ? variablesValue.map(parseWorkflowGraphVariable).filter(isDefined)
    : undefined;

  return {
    version: '1.0.0',
    nodes: parsedNodes,
    edges: parsedEdges,
    entryNodeId,
    variables,
    runtimePolicy: parseWorkflowGraphRuntimePolicy(record.runtimePolicy)
  };
}

function parseWorkflowGraphNode(value: unknown): WorkflowGraphNode | undefined {
  const record = readRecord(value);
  const id = readTrimmedString(record?.id);
  const type = readWorkflowGraphNodeType(record?.type);
  if (!record || !id || !type) {
    return undefined;
  }
  const config = normalizeWorkflowGraphNodeConfig(type, readRecord(record.config));

  return {
    id,
    type,
    name: readTrimmedString(record.name) ?? id,
    description: readTrimmedString(record.description),
    instruction: readTrimmedString(record.instruction),
    modelProfileId: readTrimmedString(record.modelProfileId),
    toolId: readTrimmedString(record.toolId),
    artifactType: readWorkflowGraphArtifactType(record.artifactType),
    inputVariables: readStringArray(record.inputVariables),
    outputVariables: readStringArray(record.outputVariables),
    requiresApproval: typeof record.requiresApproval === 'boolean' ? record.requiresApproval : undefined,
    config
  };
}

function normalizeWorkflowGraphNodeConfig(
  type: WorkflowGraphNodeType,
  config: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  const nextConfig = { ...(config ?? {}) };

  if (type === 'data') {
    return {
      ...nextConfig,
      dataMode: readWorkflowDataMode(nextConfig.dataMode)
    };
  }

  if (type === 'llm') {
    return {
      ...nextConfig,
      llmTaskType: readTrimmedString(nextConfig.llmTaskType) ?? 'text',
      outputMode: readTrimmedString(nextConfig.outputMode) ?? 'text'
    };
  }

  return config;
}

function parseWorkflowGraphEdge(value: unknown): WorkflowGraphEdge | undefined {
  const record = readRecord(value);
  const id = readTrimmedString(record?.id);
  const sourceNodeId = readTrimmedString(record?.sourceNodeId);
  const targetNodeId = readTrimmedString(record?.targetNodeId);
  if (!record || !id || !sourceNodeId || !targetNodeId) {
    return undefined;
  }

  const condition = parseWorkflowGraphEdgeCondition(record.condition);
  if (record.condition !== undefined && !condition) {
    return undefined;
  }

  return {
    id,
    sourceNodeId,
    targetNodeId,
    condition
  };
}

function parseWorkflowGraphEdgeCondition(value: unknown): WorkflowGraphEdgeCondition | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = readRecord(value);
  const type = readWorkflowGraphEdgeConditionType(record?.type);
  if (!record || !type) {
    return undefined;
  }

  return {
    type,
    variable: readTrimmedString(record.variable),
    value: record.value,
    expression: readTrimmedString(record.expression)
  };
}

function parseWorkflowGraphVariable(value: unknown): WorkflowGraphVariable | undefined {
  const record = readRecord(value);
  const name = readTrimmedString(record?.name);
  if (!record || !name) {
    return undefined;
  }

  return {
    name,
    type: readWorkflowGraphVariableType(record.type),
    description: readTrimmedString(record.description),
    required: typeof record.required === 'boolean' ? record.required : undefined,
    defaultValue: record.defaultValue
  };
}

function parseWorkflowGraphRuntimePolicy(value: unknown): WorkflowGraphRuntimePolicy | undefined {
  const record = readRecord(value);
  if (!record) {
    return undefined;
  }

  return {
    maxNodeExecutions: readOptionalNumber(record.maxNodeExecutions),
    maxLoopIterations: readOptionalNumber(record.maxLoopIterations),
    requireApprovalBeforeTools:
      typeof record.requireApprovalBeforeTools === 'boolean'
        ? record.requireApprovalBeforeTools
        : undefined
  };
}

function readWorkflowPolicyLimit(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function readWorkflowGraphNodeType(value: unknown): WorkflowGraphNodeType | undefined {
  return typeof value === 'string' && workflowGraphNodeTypes.includes(value as WorkflowGraphNodeType)
    ? (value as WorkflowGraphNodeType)
    : undefined;
}

function readWorkflowDataMode(value: unknown): 'assign' | 'template' | 'code' {
  const mode = readTrimmedString(value);
  return mode === 'template' || mode === 'code' ? mode : 'assign';
}

function readWorkflowGraphArtifactType(value: unknown): WorkflowGraphArtifactType | undefined {
  return typeof value === 'string' && workflowGraphArtifactTypes.includes(value as WorkflowGraphArtifactType)
    ? (value as WorkflowGraphArtifactType)
    : undefined;
}

function readWorkflowGraphVariableType(value: unknown): WorkflowGraphVariableType | undefined {
  return typeof value === 'string' && workflowGraphVariableTypes.includes(value as WorkflowGraphVariableType)
    ? (value as WorkflowGraphVariableType)
    : undefined;
}

function readWorkflowGraphEdgeConditionType(value: unknown): WorkflowGraphEdgeConditionType | undefined {
  return typeof value === 'string' &&
    workflowGraphEdgeConditionTypes.includes(value as WorkflowGraphEdgeConditionType)
    ? (value as WorkflowGraphEdgeConditionType)
    : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .map((item) => readTrimmedString(item))
    .filter(isDefined);
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function parseWorkflowTaskInputObject(input: string): Record<string, unknown> | undefined {
  try {
    return readRecord(JSON.parse(input));
  } catch {
    return undefined;
  }
}

function normalizeWorkflowComparisonValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim().toLocaleLowerCase();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLocaleLowerCase();
  }

  return JSON.stringify(value).toLocaleLowerCase();
}

function isWorkflowValuePresent(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
}

function createWorkflowLog(
  taskId: string,
  level: DesktopExecutionLogEntry['level'],
  eventType: string,
  message: string,
  createdAt: string,
  suffix?: string
): DesktopExecutionLogEntry {
  const suffixPart = suffix ? `-${suffix}` : '';
  return {
    id: `${taskId}-log-${eventType.toLowerCase()}${suffixPart}-${Date.parse(createdAt) || Date.now()}`,
    level,
    eventType,
    message,
    createdAt
  };
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function sanitizeLogSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}
