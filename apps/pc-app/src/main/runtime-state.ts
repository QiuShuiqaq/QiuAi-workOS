import { app } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { createInitialDesktopRuntimeState } from '../shared/desktop-state.js';
import { createTaskDetailFromSummary } from '../shared/workbench-data.js';
import type {
  DesktopAppInfo,
  DesktopRuntimeState,
  DesktopServerConnectionStatus
} from '../shared/desktop-api.js';
import { loadDesktopRuntimeState, loadRuntimeIdentity, saveDesktopRuntimeState } from './runtime-store.js';

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
  const persistedState = await loadDesktopRuntimeState(appInfo.userDataPath, identity.workspaceId);
  const serverConnection = await checkServerConnection();

  const initialState = createInitialDesktopRuntimeState({
    app: appInfo,
    runtimeId: identity.runtimeId,
    deviceId: identity.deviceId,
    workspaceId: identity.workspaceId,
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
      workspaceId: identity.workspaceId,
      lastSyncedAt: hydratedPersistedState.localRuntime.lastSyncedAt ?? identity.lastSyncedAt
    },
    runtimeSnapshot: {
      ...hydratedPersistedState.runtimeSnapshot,
      runtimeId: identity.runtimeId,
      deviceId: identity.deviceId,
      workspaceId: identity.workspaceId,
      appVersion: appInfo.appVersion,
      lastSyncedAt:
        hydratedPersistedState.runtimeSnapshot.lastSyncedAt ??
        hydratedPersistedState.localRuntime.lastSyncedAt ??
        identity.lastSyncedAt
    },
    serverConnection
  };
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
  if (state.taskDetails && state.taskDetails.length > 0) {
    return state;
  }

  const taskDetails = state.runtimeSnapshot.tasks.map((task) =>
    createTaskDetailFromSummary(task, resolveRoleName(state.rolePackages, task.roleCode))
  );

  return {
    ...state,
    taskDetails
  };
}

function resolveRoleName(rolePackages: DesktopRuntimeState['rolePackages'], roleCode: string): string {
  return rolePackages.find((rolePackage) => rolePackage.roleCode === roleCode)?.name ?? roleCode;
}
