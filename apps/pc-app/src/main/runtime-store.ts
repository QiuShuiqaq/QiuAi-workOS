import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { DesktopRuntimeState } from '../shared/desktop-api.js';
import type {
  DesktopKnowledgeSourceSummary,
  DesktopRuntimeSnapshot,
  ModelProfile,
  RolePackageManifest,
  ToolManifest
} from '../shared/desktop-contract.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizeWorkspaceId
} from './storage-layout.js';
import {
  readWorkspaceSnapshotBundle,
  writeWorkspaceSnapshotBundle
} from './workspace-sqlite-store.js';

export interface StoredRuntimeIdentity {
  runtimeId: string;
  deviceId: string;
  workspaceId: string;
  createdAt: string;
  lastSyncedAt?: string;
}

interface StoredDesktopRuntimeState {
  schemaVersion: 1;
  savedAt: string;
  state: DesktopRuntimeState;
}

interface StoredDesktopWorkspaceProfile {
  schemaVersion: 1;
  savedAt: string;
  app: DesktopRuntimeState['app'];
  localRuntime: DesktopRuntimeState['localRuntime'];
  serverConnection: DesktopRuntimeState['serverConnection'];
}

interface StoredDesktopWorkspaceCatalog {
  schemaVersion: 1;
  savedAt: string;
  rolePackages: RolePackageManifest[];
  modelProfiles: ModelProfile[];
  tools: ToolManifest[];
}

interface StoredDesktopWorkspaceRuntime {
  schemaVersion: 1;
  savedAt: string;
  runtimeSnapshot: DesktopRuntimeSnapshot;
  knowledgeSources: DesktopKnowledgeSourceSummary[];
  taskDetails?: DesktopRuntimeState['taskDetails'];
}

const identityFileName = 'runtime-identity.json';

export function loadRuntimeIdentity(userDataPath: string): StoredRuntimeIdentity {
  mkdirSync(userDataPath, { recursive: true });

  const filePath = path.join(userDataPath, identityFileName);
  const existing = readRuntimeIdentity(filePath);
  if (existing) {
    return existing;
  }

  const identity: StoredRuntimeIdentity = {
    runtimeId: `runtime_${randomUUID()}`,
    deviceId: `device_${randomUUID()}`,
    workspaceId: process.env.QIUAI_WORKSPACE_ID ?? 'workspace_pending_login',
    createdAt: new Date().toISOString()
  };

  writeFileSync(filePath, `${JSON.stringify(identity, null, 2)}\n`, { encoding: 'utf8' });
  return identity;
}

export async function loadDesktopRuntimeState(
  userDataPath: string,
  workspaceId?: string
): Promise<DesktopRuntimeState | undefined> {
  const requestedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const layout = getDesktopStorageLayout(userDataPath, requestedWorkspaceId);
  ensureDesktopStorageLayout(layout);

  const databaseSnapshot = await readWorkspaceSnapshotBundle(layout, requestedWorkspaceId);
  const databaseState = databaseSnapshot ? readPersistedDesktopRuntimeState(databaseSnapshot) : undefined;
  if (databaseState) {
    return databaseState;
  }

  const persistedState = readSplitDesktopRuntimeState(layout);
  if (persistedState) {
    await saveDesktopRuntimeState(userDataPath, persistedState);
    return persistedState;
  }

  const legacyState = readDesktopRuntimeState(layout.legacyRuntimeStatePath);
  if (!legacyState) {
    return undefined;
  }

  const legacyWorkspaceId = normalizeWorkspaceId(
    legacyState.localRuntime.workspaceId ?? legacyState.runtimeSnapshot.workspaceId
  );
  if (workspaceId !== undefined && legacyWorkspaceId !== requestedWorkspaceId) {
    return undefined;
  }

  const normalizedLegacyState = {
    ...legacyState,
    knowledgeSources: legacyState.knowledgeSources ?? []
  };

  await saveDesktopRuntimeState(userDataPath, normalizedLegacyState);
  return normalizedLegacyState;
}

export async function saveDesktopRuntimeState(
  userDataPath: string,
  state: DesktopRuntimeState
): Promise<void> {
  const workspaceId = normalizeWorkspaceId(
    state.localRuntime.workspaceId || state.runtimeSnapshot.workspaceId
  );
  const layout = getDesktopStorageLayout(userDataPath, workspaceId);
  ensureDesktopStorageLayout(layout);
  await writeWorkspaceSnapshotBundle(layout, workspaceId, state);

  const identity = loadRuntimeIdentity(userDataPath);
  const updatedIdentity: StoredRuntimeIdentity = {
    ...identity,
    runtimeId: state.localRuntime.runtimeId,
    deviceId: state.localRuntime.deviceId,
    workspaceId,
    lastSyncedAt:
      state.localRuntime.lastSyncedAt ??
      state.runtimeSnapshot.lastSyncedAt ??
      identity.lastSyncedAt
  };

  writeRuntimeIdentity(layout.runtimeIdentityPath, updatedIdentity);
}

function readRuntimeIdentity(filePath: string): StoredRuntimeIdentity | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoredRuntimeIdentity>;
    if (
      typeof parsed.runtimeId === 'string' &&
      typeof parsed.deviceId === 'string' &&
      typeof parsed.workspaceId === 'string' &&
      typeof parsed.createdAt === 'string'
    ) {
      return {
        runtimeId: parsed.runtimeId,
        deviceId: parsed.deviceId,
        workspaceId: parsed.workspaceId,
        createdAt: parsed.createdAt,
        lastSyncedAt:
          typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function writeRuntimeIdentity(filePath: string, identity: StoredRuntimeIdentity): void {
  writeFileSync(filePath, `${JSON.stringify(identity, null, 2)}\n`, { encoding: 'utf8' });
}

function writeJsonFile<T>(filePath: string, value: T): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8' });
}

function readSplitDesktopRuntimeState(
  layout: ReturnType<typeof getDesktopStorageLayout>
): DesktopRuntimeState | undefined {
  const profile = readWorkspaceProfile(layout.workspaceProfilePath);
  const catalog = readWorkspaceCatalog(layout.workspaceCatalogPath);
  const runtime = readWorkspaceRuntime(layout.workspaceRuntimePath);

  if (!profile || !catalog || !runtime) {
    return undefined;
  }

  return {
    app: profile.app,
    localRuntime: profile.localRuntime,
    runtimeSnapshot: runtime.runtimeSnapshot,
    rolePackages: catalog.rolePackages,
    modelProfiles: catalog.modelProfiles,
    tools: catalog.tools,
    knowledgeSources: runtime.knowledgeSources,
    taskDetails: runtime.taskDetails,
    serverConnection: profile.serverConnection
  };
}

function readPersistedDesktopRuntimeState(snapshot: {
  profile?: unknown;
  catalog?: unknown;
  runtime?: unknown;
}): DesktopRuntimeState | undefined {
  const profile = readWorkspaceProfileRecord(snapshot.profile);
  const catalog = readWorkspaceCatalogRecord(snapshot.catalog);
  const runtime = readWorkspaceRuntimeRecord(snapshot.runtime);

  if (!profile || !catalog || !runtime) {
    return undefined;
  }

  return {
    app: profile.app,
    localRuntime: profile.localRuntime,
    runtimeSnapshot: runtime.runtimeSnapshot,
    rolePackages: catalog.rolePackages,
    modelProfiles: catalog.modelProfiles,
    tools: catalog.tools,
    knowledgeSources: runtime.knowledgeSources,
    taskDetails: runtime.taskDetails,
    serverConnection: profile.serverConnection
  };
}

function readWorkspaceProfile(filePath: string): StoredDesktopWorkspaceProfile | undefined {
  const parsed = readJsonFile<StoredDesktopWorkspaceProfile>(filePath);
  return readWorkspaceProfileRecord(parsed);
}

function readWorkspaceProfileRecord(
  parsed: unknown
): StoredDesktopWorkspaceProfile | undefined {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.savedAt !== 'string') {
    return undefined;
  }

  if (
    !isDesktopAppInfo(record.app) ||
    !isLocalRuntimeContract(record.localRuntime) ||
    !isDesktopServerConnectionStatus(record.serverConnection)
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    savedAt: record.savedAt,
    app: record.app,
    localRuntime: record.localRuntime,
    serverConnection: record.serverConnection
  };
}

function readWorkspaceCatalog(filePath: string): StoredDesktopWorkspaceCatalog | undefined {
  const parsed = readJsonFile<StoredDesktopWorkspaceCatalog>(filePath);
  return readWorkspaceCatalogRecord(parsed);
}

function readWorkspaceCatalogRecord(
  parsed: unknown
): StoredDesktopWorkspaceCatalog | undefined {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.savedAt !== 'string') {
    return undefined;
  }

  if (
    !Array.isArray(record.rolePackages) ||
    !Array.isArray(record.modelProfiles) ||
    !Array.isArray(record.tools)
  ) {
    return undefined;
  }

  if (
    !record.rolePackages.every(isRolePackageManifest) ||
    !record.modelProfiles.every(isModelProfile) ||
    !record.tools.every(isToolManifest)
  ) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    savedAt: record.savedAt,
    rolePackages: record.rolePackages,
    modelProfiles: record.modelProfiles,
    tools: record.tools
  };
}

function readWorkspaceRuntime(filePath: string): StoredDesktopWorkspaceRuntime | undefined {
  const parsed = readJsonFile<StoredDesktopWorkspaceRuntime>(filePath);
  return readWorkspaceRuntimeRecord(parsed);
}

function readWorkspaceRuntimeRecord(
  parsed: unknown
): StoredDesktopWorkspaceRuntime | undefined {
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  if (record.schemaVersion !== 1 || typeof record.savedAt !== 'string') {
    return undefined;
  }

  if (!isDesktopRuntimeSnapshot(record.runtimeSnapshot)) {
    return undefined;
  }

  return {
    schemaVersion: 1,
    savedAt: record.savedAt,
    runtimeSnapshot: record.runtimeSnapshot,
    knowledgeSources: readKnowledgeSourcesRecord(record.knowledgeSources),
    taskDetails: readTaskDetailsRecord(record.taskDetails)
  };
}

function readJsonFile<T>(filePath: string): T | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

function readDesktopRuntimeState(filePath: string): DesktopRuntimeState | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoredDesktopRuntimeState>;
    if (parsed.schemaVersion !== 1 || !parsed.state || !isDesktopRuntimeState(parsed.state)) {
      return undefined;
    }

    return parsed.state;
  } catch {
    return undefined;
  }
}

function isDesktopAppInfo(value: unknown): value is DesktopRuntimeState['app'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.appName === 'string' &&
    typeof record.appVersion === 'string' &&
    typeof record.platform === 'string' &&
    typeof record.arch === 'string' &&
    typeof record.deviceName === 'string' &&
    typeof record.userDataPath === 'string' &&
    typeof record.serverBaseUrl === 'string' &&
    typeof record.isPackaged === 'boolean'
  );
}

function isDesktopServerConnectionStatus(
  value: unknown
): value is DesktopRuntimeState['serverConnection'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.state === 'unchecked' || record.state === 'online' || record.state === 'offline') &&
    typeof record.serverBaseUrl === 'string' &&
    typeof record.checkedAt === 'string' &&
    (record.latencyMs === undefined ||
      (typeof record.latencyMs === 'number' && Number.isFinite(record.latencyMs))) &&
    (record.service === undefined || typeof record.service === 'string') &&
    (record.message === undefined || typeof record.message === 'string')
  );
}

function isLocalRuntimeContract(value: unknown): value is DesktopRuntimeState['localRuntime'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.runtimeId === 'string' &&
    typeof record.deviceId === 'string' &&
    typeof record.workspaceId === 'string' &&
    typeof record.appVersion === 'string' &&
    Array.isArray(record.installedRoleCodes) &&
    Array.isArray(record.enabledToolIds) &&
    Array.isArray(record.enabledModelProfileIds) &&
    Array.isArray(record.knowledgeBindingIds) &&
    (record.activeRoleCode === undefined || typeof record.activeRoleCode === 'string') &&
    (record.lastSyncedAt === undefined || typeof record.lastSyncedAt === 'string') &&
    (record.syncPolicy === 'summary_only' || record.syncPolicy === 'summary_plus_metadata')
  );
}

function isRolePackageManifest(value: unknown): value is RolePackageManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.roleCode === 'string' &&
    typeof record.name === 'string' &&
    typeof record.version === 'string' &&
    (record.summary === undefined || typeof record.summary === 'string') &&
    Array.isArray(record.modelProfileIds) &&
    record.modelProfileIds.every((item) => typeof item === 'string') &&
    Array.isArray(record.toolIds) &&
    record.toolIds.every((item) => typeof item === 'string') &&
    Array.isArray(record.requiredKnowledgeSources) &&
    record.requiredKnowledgeSources.every((item) => typeof item === 'string') &&
    Array.isArray(record.defaultTaskTypes) &&
    record.defaultTaskTypes.every((item) => typeof item === 'string') &&
    (record.syncPolicy === 'summary_only' || record.syncPolicy === 'summary_plus_metadata')
  );
}

function isModelProfile(value: unknown): value is ModelProfile {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.providerId === 'string' &&
    typeof record.providerName === 'string' &&
    typeof record.modelName === 'string' &&
    (record.purpose === 'general' ||
      record.purpose === 'reasoning' ||
      record.purpose === 'vision' ||
      record.purpose === 'embeddings' ||
      record.purpose === 'document') &&
    (record.apiBaseUrl === undefined || typeof record.apiBaseUrl === 'string') &&
    (record.apiKey === undefined || typeof record.apiKey === 'string') &&
    (record.temperature === undefined || typeof record.temperature === 'number') &&
    (record.maxTokens === undefined || typeof record.maxTokens === 'number') &&
    (record.fallbackProfileId === undefined || typeof record.fallbackProfileId === 'string') &&
    (record.monthlyBudgetCents === undefined || typeof record.monthlyBudgetCents === 'number')
  );
}

function isToolManifest(value: unknown): value is ToolManifest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.version === 'string' &&
    (record.scope === 'desktop' || record.scope === 'server' || record.scope === 'hybrid') &&
    (record.entryPoint === 'native' ||
      record.entryPoint === 'bridge' ||
      record.entryPoint === 'api' ||
      record.entryPoint === 'mcp') &&
    Array.isArray(record.capabilities) &&
    record.capabilities.every((item) => typeof item === 'string') &&
    typeof record.requiresApproval === 'boolean'
  );
}

function isDesktopRuntimeSnapshot(value: unknown): value is DesktopRuntimeSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.runtimeId === 'string' &&
    typeof record.deviceId === 'string' &&
    typeof record.deviceName === 'string' &&
    (record.platform === 'windows' || record.platform === 'macos' || record.platform === 'linux') &&
    typeof record.workspaceId === 'string' &&
    typeof record.appVersion === 'string' &&
    (record.lastSyncedAt === undefined || typeof record.lastSyncedAt === 'string') &&
    Array.isArray(record.rolePackages) &&
    Array.isArray(record.tools) &&
    Array.isArray(record.tasks)
  );
}

function isDesktopRuntimeState(value: unknown): value is DesktopRuntimeState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.app === 'object' &&
    record.app !== null &&
    typeof record.localRuntime === 'object' &&
    record.localRuntime !== null &&
    typeof record.runtimeSnapshot === 'object' &&
    record.runtimeSnapshot !== null &&
    Array.isArray(record.rolePackages) &&
    Array.isArray(record.modelProfiles) &&
    Array.isArray(record.tools) &&
    (record.knowledgeSources === undefined || Array.isArray(record.knowledgeSources)) &&
    (record.taskDetails === undefined || Array.isArray(record.taskDetails)) &&
    typeof record.serverConnection === 'object' &&
    record.serverConnection !== null
  );
}

function readKnowledgeSourcesRecord(value: unknown): DesktopKnowledgeSourceSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isDesktopKnowledgeSourceSummary);
}

function isDesktopKnowledgeSourceSummary(value: unknown): value is DesktopKnowledgeSourceSummary {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    (record.source === 'local_folder' ||
      record.source === 'local_file' ||
      record.source === 'workspace_library' ||
      record.source === 'server_summary') &&
    typeof record.label === 'string' &&
    typeof record.enabled === 'boolean' &&
    typeof record.createdAt === 'string' &&
    (record.localPath === undefined || typeof record.localPath === 'string') &&
    (record.lastIndexedAt === undefined || typeof record.lastIndexedAt === 'string') &&
    (record.summary === undefined || typeof record.summary === 'string')
  );
}

function readTaskDetailsRecord(value: unknown): DesktopRuntimeState['taskDetails'] {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const details = value.filter(isDesktopTaskDetail);
  return details.length > 0 ? details : [];
}

function isDesktopTaskDetail(value: unknown): value is NonNullable<DesktopRuntimeState['taskDetails']>[number] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.taskId === 'string' &&
    typeof record.roleCode === 'string' &&
    typeof record.roleName === 'string' &&
    typeof record.title === 'string' &&
    typeof record.taskType === 'string' &&
    typeof record.input === 'string' &&
    (record.priority === 'low' ||
      record.priority === 'normal' ||
      record.priority === 'high' ||
      record.priority === 'urgent') &&
    (record.state === 'queued' ||
      record.state === 'running' ||
      record.state === 'waiting_approval' ||
      record.state === 'completed' ||
      record.state === 'failed' ||
      record.state === 'cancelled') &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string' &&
    Array.isArray(record.artifacts) &&
    Array.isArray(record.executionLogs) &&
    Array.isArray(record.costRecords)
  );
}
