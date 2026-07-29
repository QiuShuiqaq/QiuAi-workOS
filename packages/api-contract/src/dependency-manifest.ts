import type { RoleWorkflowGraphArtifactType, RoleWorkflowGraphNodeType, RoleWorkflowGraphVariableType } from './workflow-graph';

export interface RoleTemplateDependencyVariable {
  key: string;
  name?: string;
  valueType?: RoleWorkflowGraphVariableType | string;
  required: boolean;
  nodeIds: string[];
}

export interface RoleTemplateDependencyModelAsset {
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
  required: boolean;
  nodeIds: string[];
}

export interface RoleTemplateDependencyToolAction {
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
  maturity?: 'stable' | 'experimental' | string;
  required: boolean;
  nodeIds: string[];
}

export interface RoleTemplateDependencyArtifactTemplate {
  key: string;
  name?: string;
  artifactType?: RoleWorkflowGraphArtifactType | string;
  toolActionId?: string;
  fileNamePattern?: string;
  inputVariables: string[];
  nodeIds: string[];
}

export interface RoleTemplateDependencyNodeTemplate {
  key: string;
  name?: string;
  nodeType?: RoleWorkflowGraphNodeType | string;
  inputVariables: string[];
  outputVariables: string[];
  nodeIds: string[];
}

export interface RoleTemplateDependencyManifest {
  version: '1.0.0';
  generatedAt: string;
  variables: RoleTemplateDependencyVariable[];
  modelAssets: RoleTemplateDependencyModelAsset[];
  toolActions: RoleTemplateDependencyToolAction[];
  artifactTemplates: RoleTemplateDependencyArtifactTemplate[];
  nodeTemplates: RoleTemplateDependencyNodeTemplate[];
  warnings: string[];
}
