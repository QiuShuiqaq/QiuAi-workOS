import * as electron from 'electron';
import os from 'node:os';
import path from 'node:path';
import { createInitialDesktopRuntimeState } from '../shared/desktop-state.js';
import {
  checkDesktopUpdate as fetchDesktopUpdate,
  fetchEnterpriseKnowledgeRuntimeContext,
  fetchPublicDesktopToolActionCatalog,
  fetchWorkspaceDesktopToolActionCatalog,
  listAuthorizedRoleTemplates as fetchAuthorizedRoleTemplates,
  listPublicFreeRoleTemplates as fetchPublicFreeRoleTemplates,
  redeemDesktopBindingCode,
  submitDesktopIssueReport,
  syncDesktopRuntimeSnapshot
} from '../shared/desktop-sync-client.js';
import { createTaskDetailFromSummary } from '../shared/workbench-data.js';
import {
  migrateLegacyModelProfileCredentials,
  migrateMiniMaxChinaApiBaseUrls,
  normalizeRoleModelCredentialBindings
} from '../shared/desktop-model-credentials.js';
import type {
  DesktopAppInfo,
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopAuthorizedRoleTemplateSummary,
  DesktopRuntimeState,
  DesktopServerConnectionStatus,
  DesktopIssueReportSubmitRequest,
  DesktopIssueReportSubmitResult,
  DesktopUpdateCheckResult
} from '../shared/desktop-api.js';
import {
  loadDesktopRuntimeState,
  loadRuntimeIdentity,
  saveDesktopRuntimeState,
  updateRuntimeIdentity
} from './runtime-store.js';
import { buildDesktopToolStateFromServerCatalog } from './desktop-tool-catalog.js';
import { preserveCachedToolCatalogOnSyncFailure } from './runtime-tool-catalog-fallback.js';
import type { DesktopKnowledgeSourceSummary } from '../shared/desktop-contract.js';
import {
  enterpriseKnowledgeBindingId,
  knowledgeBindingSourceFromId,
  normalizeKnowledgeBindingId
} from '../shared/knowledge-bindings.js';
import { resolveDesktopStoragePathInfo } from './storage-paths.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { app } = electronApi;

const defaultServerBaseUrl = 'https://workos.qiuaihub.com';
const storagePathInfo = resolveDesktopStoragePathInfo({
  isPackaged: app.isPackaged,
  processExecPath: process.execPath,
  homeDir: os.homedir(),
  appDataPath: process.env.APPDATA
});

export function configureUserDataPath() {
  app.setPath('userData', storagePathInfo.dataPath);
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
    installPath: storagePathInfo.installPath,
    userDataPath: app.getPath('userData'),
    serverBaseUrl: getServerBaseUrl(),
    isPackaged: app.isPackaged,
    storageMode: storagePathInfo.storageMode
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
    const serverDefinedState = await applyServerDefinedKnowledgeSources(
      await applyServerDefinedToolCatalog(initialState, identity.deviceToken),
      identity.deviceToken
    );
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

  const serverDefinedState = await applyServerDefinedKnowledgeSources(
    await applyServerDefinedToolCatalog(mergedState, identity.deviceToken),
    identity.deviceToken
  );
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

  const serverDefinedState = await applyServerDefinedKnowledgeSources(
    await applyServerDefinedToolCatalog(state, identity.deviceToken),
    identity.deviceToken
  );
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

export async function submitDesktopIssueReportFromRenderer(
  request: DesktopIssueReportSubmitRequest
): Promise<DesktopIssueReportSubmitResult> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);

  return submitDesktopIssueReport(appInfo.serverBaseUrl, {
    ...request,
    workspaceId: identity.deviceToken ? identity.workspaceId : request.workspaceId,
    runtimeId: request.runtimeId ?? identity.runtimeId,
    deviceId: request.deviceId ?? identity.deviceId,
    deviceName: request.deviceName ?? appInfo.deviceName,
    appVersion: request.appVersion ?? appInfo.appVersion,
    platform: request.platform ?? appInfo.platform,
    deviceToken: identity.deviceToken
  });
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
    return preserveCachedToolCatalogOnSyncFailure(state);
  }
}

async function applyServerDefinedKnowledgeSources(
  state: DesktopRuntimeState,
  deviceToken?: string
): Promise<DesktopRuntimeState> {
  if (!deviceToken || state.localRuntime.workspaceId === 'workspace_pending_login') {
    return state;
  }

  try {
    const response = await fetchEnterpriseKnowledgeRuntimeContext(
      state.app.serverBaseUrl,
      state.localRuntime.workspaceId,
      deviceToken
    );
    const context = response.data;
    const existingSource = state.knowledgeSources.find(
      (source) => normalizeKnowledgeBindingId(source.id) === enterpriseKnowledgeBindingId
    );
    const enabled = context.enabled && context.contextText.trim().length > 0;
    const source: DesktopKnowledgeSourceSummary = {
      id: enterpriseKnowledgeBindingId,
      source: 'workspace_library',
      label: '企业知识库',
      enabled,
      createdAt: existingSource?.createdAt ?? context.updatedAt,
      lastIndexedAt: context.updatedAt,
      summary: buildEnterpriseKnowledgeRuntimeSummary(context)
    };
    const knowledgeSources = [
      ...state.knowledgeSources.filter(
        (item) => normalizeKnowledgeBindingId(item.id) !== enterpriseKnowledgeBindingId
      ),
      source
    ];
    const knowledgeBindingIds = [
      ...new Set([
        ...state.localRuntime.knowledgeBindingIds.map(normalizeKnowledgeBindingId),
        ...(enabled ? [enterpriseKnowledgeBindingId] : [])
      ])
    ];

    return {
      ...state,
      knowledgeSources,
      localRuntime: {
        ...state.localRuntime,
        knowledgeBindingIds
      }
    };
  } catch {
    return state;
  }
}

function buildEnterpriseKnowledgeRuntimeSummary(input: {
  enabled: boolean;
  versionNumber?: number;
  title?: string;
  fileName?: string;
  contextText: string;
}): string {
  const header = [
    '企业知识库同步内容',
    input.enabled ? '状态：已启用' : '状态：未启用',
    input.versionNumber ? `版本：V${input.versionNumber}` : undefined,
    input.title ? `标题：${input.title}` : undefined,
    input.fileName ? `文件：${input.fileName}` : undefined
  ].filter(Boolean);

  return [header.join('\n'), input.contextText].filter(Boolean).join('\n\n');
}

function readAuthorizedRoleTemplateApplicationType(
  template: DesktopAuthorizedRoleTemplateSummary
): 'digital_employee' | 'digital_factory' {
  const applicationType = template.applicationType ?? template.dependencyManifest?.applicationType;
  return applicationType === 'digital_factory' ? 'digital_factory' : 'digital_employee';
}

function formatAuthorizedRoleTemplateSyncMessage(
  templates: DesktopAuthorizedRoleTemplateSummary[]
): string {
  const counts = templates.reduce(
    (result, template) => {
      result[readAuthorizedRoleTemplateApplicationType(template)] += 1;
      return result;
    },
    {
      digital_employee: 0,
      digital_factory: 0
    }
  );
  const segments = [
    counts.digital_employee ? `${counts.digital_employee} 个数字员工` : '',
    counts.digital_factory ? `${counts.digital_factory} 个数字工厂` : ''
  ].filter(Boolean);

  return segments.length > 0
    ? `已同步 ${segments.join('、')}。`
    : '暂未同步到可用的数字员工或数字工厂。';
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
        message: formatAuthorizedRoleTemplateSyncMessage(response.data)
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
  const migratedModelState = migrateMiniMaxChinaApiBaseUrls({
    modelProfiles: state.modelProfiles,
    credentials: modelCredentials,
    modelCatalogs: state.modelCatalogs ?? [],
    roleModelCredentialBindings: state.roleModelCredentialBindings
  });
  const validRoleCodes = new Set(state.rolePackages.map((rolePackage) => rolePackage.roleCode));
  const validModelProfileIds = new Set(migratedModelState.modelProfiles.map((profile) => profile.id));
  const normalizedState = {
    ...state,
    localRuntime: {
      ...state.localRuntime,
      knowledgeBindingIds: [
        ...new Set((state.localRuntime.knowledgeBindingIds ?? []).map(normalizeKnowledgeBindingId))
      ]
    },
    knowledgeSources: normalizePersistedKnowledgeSources(state.knowledgeSources ?? []),
    modelProfiles: migratedModelState.modelProfiles,
    modelCredentials: migratedModelState.modelCredentials,
    modelCatalogs: migratedModelState.modelCatalogs,
    roleModelCredentialBindings: normalizeRoleModelCredentialBindings(
      migratedModelState.roleModelCredentialBindings,
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

function normalizePersistedKnowledgeSources(
  sources: DesktopKnowledgeSourceSummary[]
): DesktopKnowledgeSourceSummary[] {
  const deduped = new Map<string, DesktopKnowledgeSourceSummary>();
  for (const source of sources) {
    const id = normalizeKnowledgeBindingId(source.id);
    deduped.set(id, {
      ...source,
      id,
      source: knowledgeBindingSourceFromId(id)
    });
  }

  return [...deduped.values()];
}

function resolveRoleName(rolePackages: DesktopRuntimeState['rolePackages'], roleCode: string): string {
  return rolePackages.find((rolePackage) => rolePackage.roleCode === roleCode)?.name ?? roleCode;
}

function mapPlatform(platform: NodeJS.Platform): DesktopRuntimeState['runtimeSnapshot']['platform'] {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  return 'linux';
}
