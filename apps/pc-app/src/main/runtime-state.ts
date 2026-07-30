import * as electron from 'electron';
import os from 'node:os';
import path from 'node:path';
import { createInitialDesktopRuntimeState } from '../shared/desktop-state.js';
import {
  checkDesktopUpdate as fetchDesktopUpdate,
  fetchPublicDesktopToolActionCatalog,
  fetchWorkspaceDesktopToolActionCatalog,
  listAuthorizedRoleTemplates as fetchAuthorizedRoleTemplates,
  listPublicFreeRoleTemplates as fetchPublicFreeRoleTemplates,
  redeemDesktopBindingCode,
  syncDesktopRuntimeSnapshot
} from '../shared/desktop-sync-client.js';
import { createTaskDetailFromSummary } from '../shared/workbench-data.js';
import {
  migrateLegacyModelProfileCredentials,
  normalizeRoleModelCredentialBindings
} from '../shared/desktop-model-credentials.js';
import type {
  DesktopAppInfo,
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopRuntimeState,
  DesktopServerConnectionStatus,
  DesktopUpdateCheckResult
} from '../shared/desktop-api.js';
import {
  loadDesktopRuntimeState,
  loadRuntimeIdentity,
  saveDesktopRuntimeState,
  updateRuntimeIdentity
} from './runtime-store.js';
import { buildDesktopToolStateFromServerCatalog } from './desktop-tool-catalog.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { app } = electronApi;

const defaultServerBaseUrl = 'https://workos.qiuaihub.com';

export function configureUserDataPath() {
  if (app.isPackaged) {
    return;
  }

  app.setPath('userData', path.resolve(process.cwd(), '.local', 'user-data'));
}

export function getServerBaseUrl(): string {
  return (
    process.env.WORKOS_PUBLIC_BASE_URL ??
    process.env.SERVER_API_BASE_URL ??
    defaultServerBaseUrl
  ).replace(/\/$/, '');
}

export function getDesktopAppInfo(): DesktopAppInfo {
  return {
    appName: app.getName(),
    appVersion: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    deviceName: os.hostname(),
    userDataPath: app.getPath('userData'),
    serverBaseUrl: getServerBaseUrl(),
    isPackaged: app.isPackaged
  };
}

export async function getDesktopRuntimeState(): Promise<DesktopRuntimeState> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  const workspaceId = identity.deviceToken ? identity.workspaceId : 'workspace_pending_login';
  const persistedState = await loadDesktopRuntimeState(appInfo.userDataPath, workspaceId);
  const serverConnection = await checkServerConnection();

  const initialState = createInitialDesktopRuntimeState({
    app: appInfo,
    runtimeId: identity.runtimeId,
    deviceId: identity.deviceId,
    workspaceId,
    lastSyncedAt: persistedState?.localRuntime.lastSyncedAt ?? identity.lastSyncedAt,
    serverConnection
  });

  if (!persistedState) {
    const serverDefinedState = await applyServerDefinedToolCatalog(initialState, identity.deviceToken);
    await saveDesktopRuntimeState(appInfo.userDataPath, serverDefinedState);
    return serverDefinedState;
  }

  const hydratedPersistedState = hydratePersistedRuntimeState(persistedState);
  if (hydratedPersistedState !== persistedState) {
    await saveDesktopRuntimeState(appInfo.userDataPath, hydratedPersistedState);
  }

  const mergedState = {
    ...initialState,
    ...hydratedPersistedState,
    app: appInfo,
    localRuntime: {
      ...hydratedPersistedState.localRuntime,
      runtimeId: identity.runtimeId,
      deviceId: identity.deviceId,
      workspaceId,
      lastSyncedAt: hydratedPersistedState.localRuntime.lastSyncedAt ?? identity.lastSyncedAt
    },
    runtimeSnapshot: {
      ...hydratedPersistedState.runtimeSnapshot,
      runtimeId: identity.runtimeId,
      deviceId: identity.deviceId,
      workspaceId,
      appVersion: appInfo.appVersion,
      lastSyncedAt:
        hydratedPersistedState.runtimeSnapshot.lastSyncedAt ??
        hydratedPersistedState.localRuntime.lastSyncedAt ??
        identity.lastSyncedAt
    },
    serverConnection
  };

  const serverDefinedState = await applyServerDefinedToolCatalog(mergedState, identity.deviceToken);
  if (serverDefinedState !== mergedState) {
    await saveDesktopRuntimeState(appInfo.userDataPath, serverDefinedState);
  }

  return serverDefinedState;
}

export async function bindDesktopDevice(bindingCode: string): Promise<DesktopRuntimeState> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  const response = await redeemDesktopBindingCode(appInfo.serverBaseUrl, {
    bindingCode,
    runtimeId: identity.runtimeId,
    deviceId: identity.deviceId,
    deviceName: appInfo.deviceName,
    platform: mapPlatform(appInfo.platform),
    appVersion: appInfo.appVersion
  });

  const currentState = await getDesktopRuntimeState();
  const boundState: DesktopRuntimeState = {
    ...currentState,
    app: appInfo,
    localRuntime: {
      ...currentState.localRuntime,
      runtimeId: identity.runtimeId,
      deviceId: identity.deviceId,
      workspaceId: response.data.workspaceId,
      appVersion: appInfo.appVersion
    },
    runtimeSnapshot: {
      ...currentState.runtimeSnapshot,
      runtimeId: identity.runtimeId,
      deviceId: identity.deviceId,
      workspaceId: response.data.workspaceId,
      deviceName: appInfo.deviceName,
      platform: mapPlatform(appInfo.platform),
      appVersion: appInfo.appVersion
    }
  };

  updateRuntimeIdentity(appInfo.userDataPath, {
    workspaceId: response.data.workspaceId,
    deviceToken: response.data.deviceToken
  });

  await saveDesktopRuntimeState(appInfo.userDataPath, boundState);
  return getDesktopRuntimeState();
}

export async function unbindDesktopDevice(): Promise<DesktopRuntimeState> {
  const appInfo = getDesktopAppInfo();
  updateRuntimeIdentity(appInfo.userDataPath, {
    workspaceId: 'workspace_pending_login',
    deviceToken: undefined,
    lastSyncedAt: undefined
  });

  return getDesktopRuntimeState();
}

export async function syncDesktopRuntimeState(state: DesktopRuntimeState) {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);

  if (!identity.deviceToken) {
    throw new Error('Desktop device token is missing. Bind the device first.');
  }

  const serverDefinedState = await applyServerDefinedToolCatalog(state, identity.deviceToken);
  const result = await syncDesktopRuntimeSnapshot(
    appInfo.serverBaseUrl,
    serverDefinedState.localRuntime.workspaceId,
    serverDefinedState.runtimeSnapshot,
    identity.deviceToken
  );

  updateRuntimeIdentity(appInfo.userDataPath, {
    workspaceId: serverDefinedState.localRuntime.workspaceId,
    lastSyncedAt: result.data.syncedAt
  });

  await saveDesktopRuntimeState(appInfo.userDataPath, {
    ...serverDefinedState,
    localRuntime: {
      ...serverDefinedState.localRuntime,
      lastSyncedAt: result.data.syncedAt
    },
    runtimeSnapshot: {
      ...serverDefinedState.runtimeSnapshot,
      lastSyncedAt: result.data.syncedAt
    }
  });

  return result;
}

async function applyServerDefinedToolCatalog(
  state: DesktopRuntimeState,
  deviceToken?: string
): Promise<DesktopRuntimeState> {
  const appInfo = getDesktopAppInfo();
  try {
    const catalogResponse = deviceToken
      ? await fetchWorkspaceDesktopToolActionCatalog(
          appInfo.serverBaseUrl,
          state.localRuntime.workspaceId,
          deviceToken
        )
      : await fetchPublicDesktopToolActionCatalog(appInfo.serverBaseUrl);
    const toolState = await buildDesktopToolStateFromServerCatalog({
      catalog: catalogResponse.data,
      enabledToolIds: state.localRuntime.enabledToolIds
    });

    return {
      ...state,
      tools: toolState.tools,
      localRuntime: {
        ...state.localRuntime,
        enabledToolIds: toolState.enabledToolIds
      },
      runtimeSnapshot: {
        ...state.runtimeSnapshot,
        tools: toolState.toolSummaries,
        toolActions: toolState.toolActions
      }
    };
  } catch {
    return {
      ...state,
      tools: [],
      localRuntime: {
        ...state.localRuntime,
        enabledToolIds: []
      },
      runtimeSnapshot: {
        ...state.runtimeSnapshot,
        tools: [],
        toolActions: []
      }
    };
  }
}

export async function listAuthorizedRoleTemplates(): Promise<DesktopAuthorizedRoleTemplateCatalog> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  const workspaceId = identity.deviceToken ? identity.workspaceId : 'workspace_pending_login';
  const persistedState = await loadDesktopRuntimeState(appInfo.userDataPath, workspaceId);
  const installedTemplateIds = readInstalledTemplateIds(persistedState);

  if (!identity.deviceToken) {
    try {
      const response = await fetchPublicFreeRoleTemplates(appInfo.serverBaseUrl, installedTemplateIds);
      return {
        source: 'server',
        workspaceId,
        loadedAt: new Date().toISOString(),
        templates: response.data,
        deviceCapacity: response.deviceCapacity,
        deletedTemplateIds: response.deletedTemplateIds,
        message: `已同步 ${response.data.length} 个免费数字员工。`
      };
    } catch (error) {
      return {
        source: 'local_fallback',
        workspaceId,
        loadedAt: new Date().toISOString(),
        templates: [],
        message: error instanceof Error
          ? `免费数字员工目录加载失败：${error.message}`
          : '免费数字员工目录加载失败。'
      };
    }
  }

  try {
    const response = await fetchAuthorizedRoleTemplates(
      appInfo.serverBaseUrl,
      workspaceId,
      identity.deviceToken,
      installedTemplateIds
    );

    return {
      source: 'server',
      workspaceId,
      loadedAt: new Date().toISOString(),
      templates: response.data,
      deviceCapacity: response.deviceCapacity,
      deletedTemplateIds: response.deletedTemplateIds
    };
  } catch (error) {
    return {
      source: 'local_fallback',
      workspaceId,
      loadedAt: new Date().toISOString(),
      templates: [],
      message: error instanceof Error ? error.message : '授权模板目录加载失败。'
    };
  }
}

function readInstalledTemplateIds(state: DesktopRuntimeState | undefined): string[] {
  if (!state) {
    return [];
  }

  return [
    ...new Set(
      state.rolePackages
        .map((rolePackage) => rolePackage.templateId?.trim())
        .filter((templateId): templateId is string => Boolean(templateId))
    )
  ];
}

export async function checkForDesktopUpdates(): Promise<DesktopUpdateCheckResult> {
  const appInfo = getDesktopAppInfo();
  const response = await fetchDesktopUpdate(appInfo.serverBaseUrl, {
    currentVersion: appInfo.appVersion,
    platform: 'windows',
    channel: 'stable'
  });

  return response.data;
}

export async function checkServerConnection(): Promise<DesktopServerConnectionStatus> {
  const serverBaseUrl = getServerBaseUrl();
  const checkedAt = new Date().toISOString();
  const startedAt = Date.now();

  try {
    const response = await fetch(`${serverBaseUrl}/api/v1/health`, {
      signal: AbortSignal.timeout(3500)
    });

    if (!response.ok) {
      return {
        state: 'offline',
        serverBaseUrl,
        checkedAt,
        latencyMs: Date.now() - startedAt,
        message: `HTTP ${response.status}`
      };
    }

    const body = (await response.json()) as { service?: string };
    return {
      state: 'online',
      serverBaseUrl,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      service: body.service
    };
  } catch (error) {
    return {
      state: 'offline',
      serverBaseUrl,
      checkedAt,
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Unknown connection error'
    };
  }
}

function hydratePersistedRuntimeState(state: DesktopRuntimeState): DesktopRuntimeState {
  const modelCredentials = migrateLegacyModelProfileCredentials({
    modelProfiles: state.modelProfiles,
    credentials: state.modelCredentials
  });
  const validRoleCodes = new Set(state.rolePackages.map((rolePackage) => rolePackage.roleCode));
  const validModelProfileIds = new Set(state.modelProfiles.map((profile) => profile.id));
  const normalizedState = {
    ...state,
    knowledgeSources: state.knowledgeSources ?? [],
    modelCredentials,
    modelCatalogs: state.modelCatalogs ?? [],
    roleModelCredentialBindings: normalizeRoleModelCredentialBindings(
      state.roleModelCredentialBindings,
      validRoleCodes,
      validModelProfileIds
    )
  };

  if (normalizedState.taskDetails && normalizedState.taskDetails.length > 0) {
    return normalizedState;
  }

  const taskDetails = normalizedState.runtimeSnapshot.tasks.map((task) =>
    createTaskDetailFromSummary(task, resolveRoleName(normalizedState.rolePackages, task.roleCode))
  );

  return {
    ...normalizedState,
    taskDetails
  };
}

function resolveRoleName(rolePackages: DesktopRuntimeState['rolePackages'], roleCode: string): string {
  return rolePackages.find((rolePackage) => rolePackage.roleCode === roleCode)?.name ?? roleCode;
}

function mapPlatform(platform: NodeJS.Platform): DesktopRuntimeState['runtimeSnapshot']['platform'] {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}
