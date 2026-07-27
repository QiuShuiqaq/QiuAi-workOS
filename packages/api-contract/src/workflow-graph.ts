export type RoleWorkflowGraphNodeType =
  | 'start'
  | 'input'
  | 'parameter_extractor'
  | 'list'
  | 'knowledge'
  | 'reasoning'
  | 'llm'
  | 'assign'
  | 'template'
  | 'tool'
  | 'condition'
  | 'iteration'
  | 'loop'
  | 'aggregator'
  | 'artifact'
  | 'approval'
  | 'output';

export type RoleWorkflowGraphArtifactType =
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

export type RoleWorkflowGraphVariableType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'json'
  | 'asset'
  | 'asset[]'
  | 'table'
  | 'artifact';

export type RoleWorkflowGraphEdgeConditionType =
  | 'always'
  | 'equals'
  | 'contains'
  | 'exists'
  | 'expression';

export interface RoleWorkflowGraphNode {
  id: string;
  type: RoleWorkflowGraphNodeType;
  name: string;
  description?: string;
  instruction?: string;
  modelProfileId?: string;
  toolId?: string;
  artifactType?: RoleWorkflowGraphArtifactType;
  inputVariables?: string[];
  outputVariables?: string[];
  requiresApproval?: boolean;
  config?: Record<string, unknown>;
}

export interface RoleWorkflowGraphEdgeCondition {
  type: RoleWorkflowGraphEdgeConditionType;
  variable?: string;
  value?: unknown;
  expression?: string;
}

export interface RoleWorkflowGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  condition?: RoleWorkflowGraphEdgeCondition;
}

export interface RoleWorkflowGraphVariable {
  name: string;
  type?: RoleWorkflowGraphVariableType;
  description?: string;
  required?: boolean;
  defaultValue?: unknown;
}

export interface RoleWorkflowGraphRuntimePolicy {
  maxNodeExecutions?: number;
  maxLoopIterations?: number;
  requireApprovalBeforeTools?: boolean;
}

export interface RoleWorkflowGraph {
  version: '1.0.0';
  nodes: RoleWorkflowGraphNode[];
  edges: RoleWorkflowGraphEdge[];
  entryNodeId: string;
  variables?: RoleWorkflowGraphVariable[];
  runtimePolicy?: RoleWorkflowGraphRuntimePolicy;
}

export interface RoleWorkflowGraphSourceStep {
  id: string;
  order: number;
  type: 'input' | 'reasoning' | 'knowledge' | 'tool' | 'approval' | 'output';
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

export function buildRoleWorkflowGraphFromSteps(
  steps: RoleWorkflowGraphSourceStep[],
  options?: {
    entryNodeId?: string;
    runtimePolicy?: RoleWorkflowGraphRuntimePolicy;
  }
): RoleWorkflowGraph {
  const entryNodeId = options?.entryNodeId ?? 'start';
  const orderedSteps = [...steps].sort((left, right) => left.order - right.order);
  const toolIds = [...new Set(orderedSteps.flatMap((step) => step.toolIds ?? []))];
  const hasKnowledge = orderedSteps.some((step) => step.type === 'knowledge');
  const hasWebSearch = toolIds.includes('web-search');
  const artifactType = inferRoleWorkflowGraphArtifactTypeFromSteps(orderedSteps);
  const sourceInstruction = orderedSteps
    .map((step) => `${step.order}. ${step.name}: ${step.instruction}`)
    .join('\n');
  const nodes: RoleWorkflowGraphNode[] = [
    {
      id: entryNodeId,
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

  const edges: RoleWorkflowGraphEdge[] = [];
  let previousNodeId = entryNodeId;
  for (const node of nodes.filter((node) => node.id !== entryNodeId)) {
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
    entryNodeId,
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false,
      ...options?.runtimePolicy
    }
  };
}

function inferRoleWorkflowGraphArtifactTypeFromSteps(
  steps: RoleWorkflowGraphSourceStep[]
): NonNullable<RoleWorkflowGraphNode['artifactType']> {
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
