export type KnowledgeBindingSource =
  | 'local_folder'
  | 'local_file'
  | 'workspace_library'
  | 'server_summary';

export type ModelPurpose = 'general' | 'reasoning' | 'vision' | 'embeddings' | 'document';

export type ToolScope = 'desktop' | 'server' | 'hybrid';

export type ToolEntryPoint = 'native' | 'bridge' | 'api' | 'mcp';

export type ToolCapability =
  | 'web_search'
  | 'document_edit'
  | 'presentation_edit'
  | 'spreadsheet_edit'
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

export interface DesktopArtifactSummary {
  id: string;
  type: 'text' | 'report' | 'video' | 'image' | 'file';
  title: string;
  content: string;
  createdAt: string;
  localPath?: string;
}

export interface DesktopExecutionLogEntry {
  id: string;
  level: 'info' | 'warning' | 'error';
  eventType: string;
  message: string;
  createdAt: string;
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
}

export interface ModelProfile {
  id: string;
  providerId: string;
  providerName: string;
  modelName: string;
  purpose: ModelPurpose;
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
}

export interface DesktopRoleSkillSummary {
  code: string;
  name: string;
  summary: string;
}

export interface RolePackageManifest {
  roleCode: string;
  name: string;
  version: string;
  summary?: string;
  templateId?: string;
  templateVersion?: string;
  skills?: DesktopRoleSkillSummary[];
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

export type DesktopRolePackageState = 'installed' | 'running' | 'paused' | 'error';

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
  tasks: DesktopTaskSummary[];
}
