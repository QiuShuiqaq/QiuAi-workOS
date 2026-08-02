import type {
  DesktopRuntimeSnapshot,
  LocalRuntimeContract,
  ModelProfile,
  RolePackageManifest,
  DesktopTaskSummary
} from './desktop-contract.js';
import type {
  DesktopAppInfo,
  DesktopRuntimeState,
  DesktopServerConnectionStatus
} from './desktop-api.js';

export interface CreateDesktopRuntimeStateInput {
  app: DesktopAppInfo;
  runtimeId: string;
  deviceId: string;
  workspaceId: string;
  lastSyncedAt?: string;
  serverConnection?: DesktopServerConnectionStatus;
}

const initialRolePackages: RolePackageManifest[] = [];

const initialModelProfiles: ModelProfile[] = [
  {
    id: 'qiu-general-default',
    providerId: 'provider-pending',
    providerName: 'Pending Model Provider',
    modelName: 'general-chat',
    purpose: 'general',
    capabilities: ['text'],
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
    capabilities: ['reasoning_text', 'text'],
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
    capabilities: ['image_understanding', 'vision_text', 'text'],
    temperature: 0.2,
    maxTokens: 4096,
    fallbackProfileId: 'qiu-general-default',
    monthlyBudgetCents: 0
  },
  {
    id: 'qiu-image-generation-default',
    providerId: 'provider-pending',
    providerName: 'Pending Model Provider',
    modelName: 'text-to-image',
    purpose: 'vision',
    capabilities: ['image_generation', 'text_to_image'],
    temperature: 0.2,
    maxTokens: 4096,
    monthlyBudgetCents: 0
  },
  {
    id: 'qiu-image-editing-default',
    providerId: 'provider-pending',
    providerName: 'Pending Model Provider',
    modelName: 'reference-image-editing',
    purpose: 'vision',
    capabilities: ['image_generation', 'image_to_image', 'image_editing'],
    temperature: 0.2,
    maxTokens: 4096,
    monthlyBudgetCents: 0
  },
  {
    id: 'qiu-asr-default',
    providerId: 'provider-pending',
    providerName: '待配置语音模型供应商',
    modelName: 'speech-to-text',
    purpose: 'audio',
    capabilities: ['audio_to_text'],
    temperature: 0.2,
    maxTokens: 4096,
    monthlyBudgetCents: 0
  }
];


export function createInitialDesktopRuntimeState(
  input: CreateDesktopRuntimeStateInput
): DesktopRuntimeState {
  const installedRoleCodes = initialRolePackages.map((rolePackage) => rolePackage.roleCode);
  const taskDetails: NonNullable<DesktopRuntimeState['taskDetails']> = [];
  const runtimeTasks: DesktopTaskSummary[] = [];
  const taskCountByRole = countTasksByRole(runtimeTasks);
  const lastTaskAtByRole = lastTaskAtMap(runtimeTasks);
  const enabledToolIds: string[] = [];
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
    toolSettings: buildInitialToolSettings(),
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
    tools: [],
    toolActions: [],
    tasks: runtimeTasks
  };

  return {
    app: input.app,
    localRuntime,
    runtimeSnapshot,
    rolePackages: initialRolePackages,
    modelProfiles: initialModelProfiles,
    modelCredentials: [],
    modelCatalogs: [],
    roleModelCredentialBindings: [],
    tools: [],
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

function buildInitialToolSettings(): LocalRuntimeContract['toolSettings'] {
  const env = readProcessEnv();

  return {
    webSearch: {
      endpoint: normalizeEnvValue(env.QIUAI_WEB_SEARCH_ENDPOINT),
      apiKey: normalizeEnvValue(env.QIUAI_WEB_SEARCH_API_KEY),
      allowPrivateNetwork: env.QIUAI_DESKTOP_ALLOW_PRIVATE_WEB_TOOL === 'true'
    }
  };
}

function readProcessEnv(): Record<string, string | undefined> {
  const processLike = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;

  return processLike?.env ?? {};
}

function normalizeEnvValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
