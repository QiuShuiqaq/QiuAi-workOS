export type KnowledgeBindingSource =
  | 'local_folder'
  | 'local_file'
  | 'workspace_library'
  | 'server_summary';

export type ModelPurpose = 'general' | 'reasoning' | 'vision' | 'embeddings' | 'document' | 'audio';

export type ModelCapability =
  | 'text'
  | 'reasoning_text'
  | 'vision_text'
  | 'video_text'
  | 'embedding'
  | 'rerank'
  | 'long_context'
  | 'image_understanding'
  | 'vision_understanding'
  | 'video_understanding'
  | 'text_to_image'
  | 'image_to_image'
  | 'image_editing'
  | 'image_generation'
  | 'video_generation'
  | 'text_to_video'
  | 'image_to_video'
  | 'audio_to_text'
  | 'text_to_audio';

export type ModelCapabilitySource =
  | 'official_catalog'
  | 'provider'
  | 'name_inferred'
  | 'manual'
  | 'verified'
  | 'unknown';

export type ModelCapabilityConfidence =
  | 'verified'
  | 'high'
  | 'medium'
  | 'low'
  | 'unknown';

export interface ModelCapabilityMetadata {
  source: ModelCapabilitySource;
  confidence: ModelCapabilityConfidence;
  verifiedAt?: string;
  note?: string;
}

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

export type DesktopTaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export type FactoryArtifactPreviewItemStatus = 'queued' | 'running' | 'completed' | 'failed' | 'retrying';

export interface FactoryArtifactPreviewItem {
  id: string;
  order: number;
  sku: string;
  sourceName?: string;
  packageKey: string;
  packageLabel: string;
  status: FactoryArtifactPreviewItemStatus;
  remoteUrl?: string;
  localPath?: string;
  thumbnailPath?: string;
  sourceImagePath?: string;
  prompt?: string;
  error?: string;
  errorType?: 'configuration' | 'quota' | 'rate_limit' | 'timeout' | 'network' | 'provider' | 'unknown';
  attempts?: number;
  providerJobId?: string;
  providerStatus?: string;
  createdAt: string;
}

export interface FactoryArtifactPreview {
  kind: 'digital_factory_image_batch';
  title: string;
  platformLabel?: string;
  concurrency: number;
  total: number;
  completed: number;
  failed: number;
  items: FactoryArtifactPreviewItem[];
}

export type FactoryOutputItemKind = 'video' | 'image' | 'document' | 'table' | 'record' | 'folder' | 'artifact';

export type FactoryOutputItemStatus =
  | 'qualified'
  | 'rejected'
  | 'review_required'
  | 'processing_error'
  | 'excluded';

export interface FactoryOutputItemAuditEntry {
  id: string;
  action: 'status_changed' | 'excluded' | 'restored';
  fromStatus?: FactoryOutputItemStatus;
  toStatus?: FactoryOutputItemStatus;
  reason?: string;
  createdAt: string;
}

export interface FactoryOutputItem {
  id: string;
  factoryKind: string;
  kind: FactoryOutputItemKind;
  title: string;
  status: FactoryOutputItemStatus;
  originalStatus: FactoryOutputItemStatus;
  sourcePath?: string;
  sourceUrl?: string;
  outputPath?: string;
  outputUrl?: string;
  thumbnailPath?: string;
  score?: number;
  grade?: string;
  summary?: string;
  reason?: string;
  risks?: string[];
  transcript?: string;
  metadata?: Record<string, unknown>;
  auditTrail?: FactoryOutputItemAuditEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface DesktopArtifactSummary {
  id: string;
  type: 'text' | 'report' | 'video' | 'image' | 'file';
  title: string;
  content: string;
  createdAt: string;
  remoteUrl?: string;
  localPath?: string;
  format?: string;
  mimeType?: string;
  editable?: boolean;
  sourcePayloadPath?: string;
  revision?: number;
  factoryPreview?: FactoryArtifactPreview;
}

export interface DesktopExecutionLogEntry {
  id: string;
  level: 'info' | 'warning' | 'error';
  eventType: string;
  message: string;
  createdAt: string;
  details?: Record<string, unknown>;
}

export interface DesktopCostRecordSummary {
  id: string;
  provider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  currency: string;
  createdAt: string;
}

export interface DesktopExecutionRunSummary {
  id: string;
  taskId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
}

export interface DesktopTaskExecutionContext {
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeBindingIds: string[];
  useKnowledge?: boolean;
  attachmentPaths?: string[];
}

export interface ModelProfile {
  id: string;
  providerId: string;
  providerName: string;
  modelName: string;
  purpose: ModelPurpose;
  billingMode?: 'user_api_key' | 'official_points';
  officialRouteKey?: string;
  capabilities?: ModelCapability[];
  capabilityMetadata?: ModelCapabilityMetadata;
  verifiedCapabilities?: ModelCapability[];
  /**
   * @deprecated API keys are moving to local model credentials. This field is
   * kept for older local data and will be used only as a compatibility fallback.
   */
  apiBaseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackProfileId?: string;
  monthlyBudgetCents?: number;
}

export interface ModelCatalogEntry {
  id: string;
  label?: string;
  ownedBy?: string;
  source?: 'provider' | 'built_in' | 'manual';
  capabilities: ModelCapability[];
  capabilityMetadata?: ModelCapabilityMetadata;
  verifiedCapabilities?: ModelCapability[];
}

export interface ModelProviderCatalog {
  providerId: string;
  providerName: string;
  apiBaseUrl?: string;
  fetchedAt: string;
  models: ModelCatalogEntry[];
}

export interface ModelCredential {
  id: string;
  providerId: string;
  providerName: string;
  label: string;
  apiBaseUrl?: string;
  apiKey: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ModelCredentialBindingMode = 'provider_default' | 'credential_ref' | 'inline';

export interface RoleModelCredentialBinding {
  roleCode: string;
  modelProfileId: string;
  runtimeModelProfileId?: string;
  mode: ModelCredentialBindingMode;
  credentialId?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  updatedAt: string;
}

export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  scope: ToolScope;
  entryPoint: ToolEntryPoint;
  capabilities: ToolCapability[];
  requiresApproval: boolean;
  actions?: ToolManifestAction[];
}

export interface ToolManifestAction {
  action: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  category?: string;
  inputTypes?: string[];
  outputTypes?: string[];
  requiredConfig?: string[];
  requiredDependencies?: string[];
  maturity?: 'stable' | 'experimental';
  artifactFormat?: string;
  requiresApproval?: boolean;
}

export type ServerToolValueType =
  | 'text'
  | 'json'
  | 'table'
  | 'file'
  | 'files'
  | 'image'
  | 'images'
  | 'video'
  | 'videos'
  | 'artifact'
  | 'artifact[]'
  | 'number'
  | 'boolean';

export interface DesktopServerToolPackageDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface DesktopServerToolActionDefinition {
  packageId: string;
  actionId: string;
  name: string;
  category: string;
  description: string;
  input: Array<{ key: string; label: string; type: ServerToolValueType; required?: boolean; description?: string }>;
  output: Array<{ key: string; label: string; type: ServerToolValueType; required?: boolean; description?: string }>;
  defaultInput: Record<string, unknown>;
  uiFields: Array<{
    key: string;
    label: string;
    placeholder?: string;
    type?: 'text' | 'number' | 'textarea' | 'boolean';
    format?: 'text' | 'json';
  }>;
  requiredConfig: string[];
  requiredDependencies: string[];
  artifactFormat?: string;
  maturity: 'stable' | 'experimental';
}

export interface DesktopServerToolActionCatalog {
  packages: DesktopServerToolPackageDefinition[];
  actions: DesktopServerToolActionDefinition[];
}

export interface ListDesktopServerToolActionCatalogResponse {
  data: DesktopServerToolActionCatalog;
}

export type DesktopToolActionStatus =
  | 'ready'
  | 'disabled'
  | 'missing_config'
  | 'missing_dependency'
  | 'unavailable'
  | 'experimental';

export interface DesktopToolActionHealthSummary {
  toolId: string;
  actionId: string;
  name: string;
  category?: string;
  status: DesktopToolActionStatus;
  inputTypes?: string[];
  outputTypes?: string[];
  requiredConfig?: string[];
  missingConfig?: string[];
  requiredDependencies?: string[];
  missingDependencies?: string[];
  message?: string;
  checkedAt?: string;
}

export interface DesktopRoleSkillSummary {
  code: string;
  name: string;
  summary: string;
}

export type DesktopRoleWorkflowStepType =
  | 'input'
  | 'llm'
  | 'knowledge'
  | 'tool'
  | 'approval'
  | 'output';

export interface DesktopRoleWorkflowStep {
  id: string;
  order: number;
  type: DesktopRoleWorkflowStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

export interface RoleTemplateDependencyVariable {
  key: string;
  name?: string;
  valueType?: string;
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
  artifactType?: string;
  toolActionId?: string;
  fileNamePattern?: string;
  inputVariables: string[];
  nodeIds: string[];
}

export interface RoleTemplateDependencyNodeTemplate {
  key: string;
  name?: string;
  nodeType?: string;
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

export interface RolePackageManifest {
  roleCode: string;
  applicationType?: 'digital_employee' | 'digital_factory';
  name: string;
  version: string;
  summary?: string;
  templateId?: string;
  templateVersion?: string;
  skills?: DesktopRoleSkillSummary[];
  workflowSteps?: DesktopRoleWorkflowStep[];
  workflowGraph?: unknown;
  dependencyManifest?: RoleTemplateDependencyManifest;
  executionProfile?: RoleTemplateExecutionProfile;
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

export type DesktopPlatform = 'windows' | 'macos' | 'linux';

export type DesktopRolePackageState = 'installed' | 'running' | 'paused' | 'error' | 'deleted';

export type DesktopTaskState =
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DesktopRolePackageSummary {
  roleCode: string;
  version: string;
  state: DesktopRolePackageState;
  installedAt: string;
  lastRunAt?: string;
  taskCount?: number;
  templateId?: string;
  templateVersion?: string;
  skills?: DesktopRoleSkillSummary[];
}

export interface DesktopToolSummary {
  toolId: string;
  enabled: boolean;
  lastUsedAt?: string;
}

export interface DesktopKnowledgeSourceSummary {
  id: string;
  source: KnowledgeBindingSource;
  label: string;
  enabled: boolean;
  createdAt: string;
  localPath?: string;
  lastIndexedAt?: string;
  summary?: string;
}

export interface DesktopTaskSummary {
  taskId: string;
  roleCode: string;
  title: string;
  state: DesktopTaskState;
  updatedAt: string;
  artifactCount?: number;
  costCents?: number;
  executionContext?: DesktopTaskExecutionContext;
}

export interface DesktopTaskDetail {
  taskId: string;
  roleCode: string;
  roleName: string;
  title: string;
  taskType: string;
  input: string;
  priority: DesktopTaskPriority;
  state: DesktopTaskState;
  createdAt: string;
  updatedAt: string;
  artifactCount?: number;
  costCents?: number;
  artifacts: DesktopArtifactSummary[];
  executionLogs: DesktopExecutionLogEntry[];
  costRecords: DesktopCostRecordSummary[];
  currentRun?: DesktopExecutionRunSummary;
  executionContext?: DesktopTaskExecutionContext;
  factoryOutputs?: FactoryOutputItem[];
}

export interface DesktopRuntimeSnapshot {
  runtimeId: string;
  deviceId: string;
  deviceName: string;
  platform: DesktopPlatform;
  workspaceId: string;
  appVersion: string;
  lastSyncedAt?: string;
  rolePackages: DesktopRolePackageSummary[];
  tools: DesktopToolSummary[];
  toolActions?: DesktopToolActionHealthSummary[];
  tasks: DesktopTaskSummary[];
}
