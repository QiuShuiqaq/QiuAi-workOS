import type {
  DesktopRuntimeSnapshot,
  LocalRuntimeContract,
  ModelProfile,
  RolePackageManifest,
  ToolManifest,
  DesktopTaskSummary
} from './desktop-contract.js';
import type {
  DesktopAppInfo,
  DesktopRuntimeState,
  DesktopServerConnectionStatus
} from './desktop-api.js';
import { createDesktopPreviewTaskDetails, toDesktopTaskSummary } from './workbench-data.js';

export interface CreateDesktopRuntimeStateInput {
  app: DesktopAppInfo;
  runtimeId: string;
  deviceId: string;
  workspaceId: string;
  lastSyncedAt?: string;
  serverConnection?: DesktopServerConnectionStatus;
}

const initialRolePackages: RolePackageManifest[] = [
  {
    roleCode: 'ai-operations-specialist',
    name: 'AI Operations Specialist',
    version: '0.1.0',
    summary: 'Handles content review, title generation, publication prep, and daily reports.',
    modelProfileIds: ['qiu-general-default', 'qiu-vision-default'],
    toolIds: ['web-search', 'office-document', 'local-filesystem'],
    requiredKnowledgeSources: ['local_folder', 'server_summary'],
    defaultTaskTypes: ['content_review', 'publish_plan', 'daily_report'],
    syncPolicy: 'summary_only'
  }
];

const initialModelProfiles: ModelProfile[] = [
  {
    id: 'qiu-general-default',
    providerId: 'provider-pending',
    providerName: 'Pending Model Provider',
    modelName: 'general-chat',
    purpose: 'general',
    temperature: 0.4,
    maxTokens: 4096,
    monthlyBudgetCents: 0
  },
  {
    id: 'qiu-reasoning-default',
    providerId: 'provider-pending',
    providerName: 'Pending Model Provider',
    modelName: 'reasoning-core',
    purpose: 'reasoning',
    temperature: 0.2,
    maxTokens: 8192,
    fallbackProfileId: 'qiu-general-default',
    monthlyBudgetCents: 0
  },
  {
    id: 'qiu-vision-default',
    providerId: 'provider-pending',
    providerName: 'Pending Model Provider',
    modelName: 'vision-review',
    purpose: 'vision',
    temperature: 0.2,
    maxTokens: 4096,
    fallbackProfileId: 'qiu-general-default',
    monthlyBudgetCents: 0
  }
];

const initialTools: ToolManifest[] = [
  {
    id: 'web-search',
    name: 'Web Search',
    version: '0.1.0',
    scope: 'hybrid',
    entryPoint: 'api',
    capabilities: ['web_search'],
    requiresApproval: false
  },
  {
    id: 'office-document',
    name: 'Office Document Handling',
    version: '0.1.0',
    scope: 'desktop',
    entryPoint: 'bridge',
    capabilities: ['document_edit', 'presentation_edit', 'spreadsheet_edit'],
    requiresApproval: true
  },
  {
    id: 'local-filesystem',
    name: 'Local Filesystem',
    version: '0.1.0',
    scope: 'desktop',
    entryPoint: 'native',
    capabilities: ['filesystem'],
    requiresApproval: true
  }
];

export function createInitialDesktopRuntimeState(
  input: CreateDesktopRuntimeStateInput
): DesktopRuntimeState {
  const installedRoleCodes = initialRolePackages.map((rolePackage) => rolePackage.roleCode);
  const taskDetails = createDesktopPreviewTaskDetails();
  const runtimeTasks = taskDetails.map(toDesktopTaskSummary);
  const taskCountByRole = countTasksByRole(runtimeTasks);
  const lastTaskAtByRole = lastTaskAtMap(runtimeTasks);
  const enabledToolIds = initialTools
    .filter((tool) => tool.id !== 'office-document')
    .map((tool) => tool.id);
  const enabledModelProfileIds = initialModelProfiles
    .filter((modelProfile) => modelProfile.purpose !== 'reasoning')
    .map((modelProfile) => modelProfile.id);
  const installedAt = input.lastSyncedAt ?? new Date().toISOString();

  const localRuntime: LocalRuntimeContract = {
    runtimeId: input.runtimeId,
    deviceId: input.deviceId,
    workspaceId: input.workspaceId,
    appVersion: input.app.appVersion,
    installedRoleCodes,
    activeRoleCode: installedRoleCodes[0],
    enabledToolIds,
    enabledModelProfileIds,
    knowledgeBindingIds: [],
    syncPolicy: 'summary_only',
    lastSyncedAt: input.lastSyncedAt
  };

  const runtimeSnapshot: DesktopRuntimeSnapshot = {
    runtimeId: localRuntime.runtimeId,
    deviceId: localRuntime.deviceId,
    deviceName: input.app.deviceName,
    platform: mapPlatform(input.app.platform),
    workspaceId: localRuntime.workspaceId,
    appVersion: localRuntime.appVersion,
    lastSyncedAt: localRuntime.lastSyncedAt,
    rolePackages: initialRolePackages.map((rolePackage) => ({
      roleCode: rolePackage.roleCode,
      version: rolePackage.version,
      state: rolePackage.roleCode === localRuntime.activeRoleCode ? 'running' : 'installed',
      installedAt,
      lastRunAt: lastTaskAtByRole.get(rolePackage.roleCode),
      taskCount: taskCountByRole.get(rolePackage.roleCode) ?? 0
    })),
    tools: initialTools.map((tool) => ({
      toolId: tool.id,
      enabled: enabledToolIds.includes(tool.id)
    })),
    tasks: runtimeTasks
  };

  return {
    app: input.app,
    localRuntime,
    runtimeSnapshot,
    rolePackages: initialRolePackages,
    modelProfiles: initialModelProfiles,
    tools: initialTools,
    knowledgeSources: [],
    taskDetails,
    serverConnection:
      input.serverConnection ??
      {
        state: 'unchecked',
        serverBaseUrl: input.app.serverBaseUrl,
        checkedAt: new Date().toISOString()
      }
  };
}

export function createDesktopRuntimePreviewState(): DesktopRuntimeState {
  const app: DesktopAppInfo = {
    appName: 'QiuAI WorkOS',
    appVersion: '0.0.0',
    platform: 'win32',
    arch: 'x64',
    deviceName: 'preview-device',
    userDataPath: 'apps/pc-app/.local/user-data',
    serverBaseUrl: 'https://workos.qiuaihub.com',
    isPackaged: false
  };

  return createInitialDesktopRuntimeState({
    app,
    runtimeId: 'runtime-preview',
    deviceId: 'device-preview',
    workspaceId: 'workspace-preview'
  });
}

function mapPlatform(platform: NodeJS.Platform): DesktopRuntimeSnapshot['platform'] {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}

function countTasksByRole(tasks: DesktopTaskSummary[]) {
  const counts = new Map<string, number>();
  for (const task of tasks) {
    counts.set(task.roleCode, (counts.get(task.roleCode) ?? 0) + 1);
  }

  return counts;
}

function lastTaskAtMap(tasks: DesktopTaskSummary[]) {
  const timestamps = new Map<string, string>();
  for (const task of tasks) {
    const current = timestamps.get(task.roleCode);
    if (!current || task.updatedAt > current) {
      timestamps.set(task.roleCode, task.updatedAt);
    }
  }

  return timestamps;
}
