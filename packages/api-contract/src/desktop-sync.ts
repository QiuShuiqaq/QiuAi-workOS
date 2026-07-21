export type DesktopPlatform = 'windows' | 'macos' | 'linux';

export type DesktopRolePackageState = 'installed' | 'running' | 'paused' | 'error';

export type DesktopTaskState = 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';

export interface DesktopRoleSkillSummary {
  code: string;
  name: string;
  summary: string;
}

export interface DesktopTaskExecutionContext {
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeBindingIds: string[];
}

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

export interface SyncDesktopRuntimeRequest {
  data: DesktopRuntimeSnapshot;
}

export interface SyncDesktopRuntimeResponse {
  data: {
    accepted: true;
    syncedAt: string;
    nextSyncAt?: string;
  };
}
