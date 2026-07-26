export type RoleWorkflowGraphNodeType =
  | 'start'
  | 'input'
  | 'knowledge'
  | 'reasoning'
  | 'llm'
  | 'assign'
  | 'template'
  | 'tool'
  | 'condition'
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
  | 'csv'
  | 'zip';

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
