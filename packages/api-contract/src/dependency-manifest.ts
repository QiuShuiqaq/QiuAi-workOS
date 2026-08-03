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
  apiStyle?: 'openai_compatible' | 'provider_native' | 'azure_openai' | 'custom' | string;
  availabilityStatus?: 'verified' | 'provider_documented' | 'requires_manual_model_id' | 'experimental' | 'deprecated' | 'placeholder' | string;
  supportsModelList?: boolean;
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

export type RoleTemplateExecutionMode = 'conversation' | 'watch' | 'hybrid';

export type RoleTemplateTriggerMode =
  | 'manual'
  | 'scheduled'
  | 'event'
  | 'folder_watch'
  | 'platform_watch';

export type RoleTemplateInputSource =
  | 'chat'
  | 'uploaded_files'
  | 'local_folder'
  | 'enterprise_knowledge'
  | 'web'
  | 'external_platform';

export type RoleTemplateExecutionToolCapability =
  | 'llm'
  | 'knowledge'
  | 'office'
  | 'web_search'
  | 'browser_automation'
  | 'external_api'
  | 'mcp'
  | 'local_files'
  | 'approval_queue';

export type RoleTemplateOutputTarget =
  | 'chat_response'
  | 'artifact'
  | 'task_queue'
  | 'approval_queue'
  | 'daily_report'
  | 'external_platform';

export type RoleTemplateDataBoundary = 'local_first' | 'summary_sync' | 'workspace_sync';

export type RoleTemplateExternalConnectorType = 'browser' | 'api' | 'mcp' | 'manual';

export type RoleTemplateExternalConnectorStatus = 'supported' | 'requires_setup' | 'planned';

export interface RoleTemplateExternalConnector {
  key: string;
  name: string;
  type: RoleTemplateExternalConnectorType;
  status: RoleTemplateExternalConnectorStatus;
}

export interface RoleTemplateExecutionProfile {
  mode: RoleTemplateExecutionMode;
  summary: string;
  triggerModes: RoleTemplateTriggerMode[];
  inputSources: RoleTemplateInputSource[];
  toolCapabilities: RoleTemplateExecutionToolCapability[];
  outputTargets: RoleTemplateOutputTarget[];
  approval: {
    required: boolean;
    requiredActions: string[];
  };
  dataBoundary: RoleTemplateDataBoundary;
  externalConnectors?: RoleTemplateExternalConnector[];
  rolloutPhase?: 'ready' | 'foundation' | 'planned';
  notes?: string[];
}

export interface RoleTemplateDependencyManifest {
  version: '1.0.0';
  applicationType?: 'digital_employee' | 'digital_factory';
  generatedAt: string;
  variables: RoleTemplateDependencyVariable[];
  modelAssets: RoleTemplateDependencyModelAsset[];
  toolActions: RoleTemplateDependencyToolAction[];
  artifactTemplates: RoleTemplateDependencyArtifactTemplate[];
  nodeTemplates: RoleTemplateDependencyNodeTemplate[];
  executionProfile?: RoleTemplateExecutionProfile;
  factory?: unknown;
  warnings: string[];
}
