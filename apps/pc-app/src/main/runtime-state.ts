import * as electron from 'electron';
import os from 'node:os';
import path from 'node:path';
import { createInitialDesktopRuntimeState } from '../shared/desktop-state.js';
import {
  listAuthorizedRoleTemplates as fetchAuthorizedRoleTemplates,
  redeemDesktopBindingCode,
  syncDesktopRuntimeSnapshot
} from '../shared/desktop-sync-client.js';
import { createTaskDetailFromSummary } from '../shared/workbench-data.js';
import type {
  DesktopAppInfo,
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopRuntimeState,
  DesktopServerConnectionStatus
} from '../shared/desktop-api.js';
import {
  loadDesktopRuntimeState,
  loadRuntimeIdentity,
  saveDesktopRuntimeState,
  updateRuntimeIdentity
} from './runtime-store.js';

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
    await saveDesktopRuntimeState(appInfo.userDataPath, initialState);
    return initialState;
  }

  const hydratedPersistedState = hydratePersistedRuntimeState(persistedState);
  if (hydratedPersistedState !== persistedState) {
    await saveDesktopRuntimeState(appInfo.userDataPath, hydratedPersistedState);
  }

  return {
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

  await saveDesktopRuntimeState(appInfo.userDataPath, boundState);
  updateRuntimeIdentity(appInfo.userDataPath, {
    workspaceId: response.data.workspaceId,
    deviceToken: response.data.deviceToken
  });

  return boundState;
}

export async function syncDesktopRuntimeState(state: DesktopRuntimeState) {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);

  if (!identity.deviceToken) {
    throw new Error('Desktop device token is missing. Bind the device first.');
  }

  const result = await syncDesktopRuntimeSnapshot(
    appInfo.serverBaseUrl,
    state.localRuntime.workspaceId,
    state.runtimeSnapshot,
    identity.deviceToken
  );

  updateRuntimeIdentity(appInfo.userDataPath, {
    workspaceId: state.localRuntime.workspaceId,
    lastSyncedAt: result.data.syncedAt
  });

  return result;
}

export async function listAuthorizedRoleTemplates(): Promise<DesktopAuthorizedRoleTemplateCatalog> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  const workspaceId = identity.deviceToken ? identity.workspaceId : 'workspace_pending_login';

  if (!identity.deviceToken) {
    return {
      source: 'local_fallback',
      workspaceId,
      loadedAt: new Date().toISOString(),
      templates: toFallbackRoleTemplates(),
      message: '桌面端尚未绑定企业工作区。'
    };
  }

  try {
    const response = await fetchAuthorizedRoleTemplates(
      appInfo.serverBaseUrl,
      workspaceId,
      identity.deviceToken
    );

    return {
      source: 'server',
      workspaceId,
      loadedAt: new Date().toISOString(),
      templates: response.data
    };
  } catch (error) {
    return {
      source: 'local_fallback',
      workspaceId,
      loadedAt: new Date().toISOString(),
      templates: toFallbackRoleTemplates(),
      message: error instanceof Error ? error.message : '授权模板目录加载失败。'
    };
  }
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
  const normalizedState = {
    ...state,
    knowledgeSources: state.knowledgeSources ?? []
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

function toFallbackRoleTemplates(): DesktopAuthorizedRoleTemplateCatalog['templates'] {
  return [];
}
