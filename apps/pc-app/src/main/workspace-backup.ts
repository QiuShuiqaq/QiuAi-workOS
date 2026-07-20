import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

import {
  type DesktopRuntimeState
} from '../shared/desktop-api.js';
import type {
  DesktopPlatform,
  DesktopRolePackageState,
  DesktopRuntimeSnapshot,
  DesktopTaskState,
  DesktopTaskSummary,
  DesktopToolSummary,
  LocalRuntimeContract,
  ModelProfile,
  RolePackageManifest,
  ToolManifest
} from '../shared/desktop-contract.js';
import { saveDesktopRuntimeState } from './runtime-store.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizeWorkspaceId,
  normalizePathSegment,
  type DesktopStorageLayout
} from './storage-layout.js';

const backupSchemaVersion = 1;
const backupBundleType = 'desktop-runtime-state-backup';
const backupManifestFileName = 'manifest.json';
const backupStateFileName = 'desktop-runtime-state.json';

export interface WorkspaceBackupManifest {
  schemaVersion: 1;
  bundleType: typeof backupBundleType;
  bundleId: string;
  workspaceId: string;
  createdAt: string;
  appVersion: string;
  stateFileName: typeof backupStateFileName;
}

export interface WorkspaceBackupSummary {
  bundleId: string;
  workspaceId: string;
  bundlePath: string;
  createdAt: string;
  appVersion: string;
}

export async function createWorkspaceBackupBundle(
  state: DesktopRuntimeState
): Promise<WorkspaceBackupSummary> {
  const validatedState = validateDesktopRuntimeState(state);
  const workspaceId = normalizeWorkspaceId(
    validatedState.localRuntime.workspaceId || validatedState.runtimeSnapshot.workspaceId
  );
  const layout = getDesktopStorageLayout(validatedState.app.userDataPath, workspaceId);
  ensureDesktopStorageLayout(layout);

  const createdAt = new Date().toISOString();
  const bundleId = buildBackupBundleId(workspaceId, createdAt);
  const finalBundlePath = path.join(layout.backupsPath, bundleId);
  const tempBundlePath = `${finalBundlePath}.tmp`;

  rmSync(tempBundlePath, { recursive: true, force: true });
  mkdirSync(tempBundlePath, { recursive: true });

  const manifest: WorkspaceBackupManifest = {
    schemaVersion: backupSchemaVersion,
    bundleType: backupBundleType,
    bundleId,
    workspaceId,
    createdAt,
    appVersion: validatedState.app.appVersion,
    stateFileName: backupStateFileName
  };

  try {
    writeJsonFile(path.join(tempBundlePath, backupManifestFileName), manifest);
    writeJsonFile(path.join(tempBundlePath, backupStateFileName), validatedState);
    renameSync(tempBundlePath, finalBundlePath);
  } catch (error) {
    rmSync(tempBundlePath, { recursive: true, force: true });
    throw error;
  }

  return {
    bundleId,
    workspaceId,
    bundlePath: finalBundlePath,
    createdAt,
    appVersion: validatedState.app.appVersion
  };
}

export async function listWorkspaceBackupBundles(
  userDataPath: string,
  workspaceId: string
): Promise<WorkspaceBackupSummary[]> {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const layout = getDesktopStorageLayout(userDataPath, normalizedWorkspaceId);
  ensureDesktopStorageLayout(layout);

  const entries = readdirSync(layout.backupsPath, { withFileTypes: true });
  const summaries: WorkspaceBackupSummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.endsWith('.tmp')) {
      continue;
    }

    const bundlePath = path.join(layout.backupsPath, entry.name);
    const manifest = readBackupManifest(bundlePath);
    if (!manifest || manifest.workspaceId !== normalizedWorkspaceId) {
      continue;
    }

    summaries.push({
      bundleId: manifest.bundleId,
      workspaceId: manifest.workspaceId,
      bundlePath,
      createdAt: manifest.createdAt,
      appVersion: manifest.appVersion
    });
  }

  return summaries.sort((left, right) => {
    const createdAtOrder = right.createdAt.localeCompare(left.createdAt);
    return createdAtOrder !== 0 ? createdAtOrder : right.bundleId.localeCompare(left.bundleId);
  });
}

export async function restoreWorkspaceBackupBundle(
  userDataPath: string,
  bundlePath: string
): Promise<WorkspaceBackupSummary> {
  const normalizedBundlePath = path.resolve(bundlePath);
  const manifest = readBackupManifest(normalizedBundlePath);
  if (!manifest) {
    throw new Error(`Invalid workspace backup bundle: ${normalizedBundlePath}`);
  }

  const statePath = path.join(normalizedBundlePath, manifest.stateFileName);
  if (!existsSync(statePath)) {
    throw new Error(`Workspace backup state file is missing: ${statePath}`);
  }

  const state = validateDesktopRuntimeState(readJsonFile(statePath));
  const stateWorkspaceId = normalizeWorkspaceId(
    state.localRuntime.workspaceId || state.runtimeSnapshot.workspaceId
  );
  if (stateWorkspaceId !== manifest.workspaceId) {
    throw new Error(
      `Workspace backup bundle does not match its manifest workspace id: ${manifest.workspaceId}`
    );
  }

  await saveDesktopRuntimeState(userDataPath, state);

  return {
    bundleId: manifest.bundleId,
    workspaceId: manifest.workspaceId,
    bundlePath: normalizedBundlePath,
    createdAt: manifest.createdAt,
    appVersion: manifest.appVersion
  };
}

function buildBackupBundleId(workspaceId: string, createdAt: string): string {
  const timestamp = createdAt
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/T/, 'T');
  const suffix = randomUUID().slice(0, 8);
  return `backup_${normalizePathSegment(workspaceId)}_${timestamp}_${suffix}`;
}

function readBackupManifest(bundlePath: string): WorkspaceBackupManifest | undefined {
  const manifestPath = path.join(bundlePath, backupManifestFileName);
  if (!existsSync(manifestPath)) {
    return undefined;
  }

  const parsed = readJsonFile(manifestPath);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion !== backupSchemaVersion ||
    record.bundleType !== backupBundleType ||
    typeof record.bundleId !== 'string' ||
    typeof record.workspaceId !== 'string' ||
    typeof record.createdAt !== 'string' ||
    typeof record.appVersion !== 'string' ||
    record.stateFileName !== backupStateFileName
  ) {
    return undefined;
  }

  return {
    schemaVersion: backupSchemaVersion,
    bundleType: backupBundleType,
    bundleId: record.bundleId,
    workspaceId: record.workspaceId,
    createdAt: record.createdAt,
    appVersion: record.appVersion,
    stateFileName: backupStateFileName
  };
}

function validateDesktopRuntimeState(input: unknown): DesktopRuntimeState {
  const record = requireRecord(input, 'desktop runtime state');

  return {
    app: validateDesktopAppInfo(record.app),
    localRuntime: validateLocalRuntimeContract(record.localRuntime),
    runtimeSnapshot: validateDesktopRuntimeSnapshot(record.runtimeSnapshot),
    taskDetails: Array.isArray(record.taskDetails)
      ? record.taskDetails.map(validateDesktopTaskDetail)
      : undefined,
    rolePackages: requireArray(record.rolePackages, 'desktopRuntimeState.rolePackages').map(
      validateRolePackageManifest
    ),
    modelProfiles: requireArray(record.modelProfiles, 'desktopRuntimeState.modelProfiles').map(
      validateModelProfile
    ),
    tools: requireArray(record.tools, 'desktopRuntimeState.tools').map(validateToolManifest),
    serverConnection: validateDesktopServerConnectionStatus(record.serverConnection)
  };
}

function validateDesktopAppInfo(value: unknown): DesktopRuntimeState['app'] {
  const record = requireRecord(value, 'desktop app info');
  return {
    appName: requireString(record.appName, 'desktopAppInfo.appName'),
    appVersion: requireString(record.appVersion, 'desktopAppInfo.appVersion'),
    platform: requireEnum(record.platform, 'desktopAppInfo.platform', [
      'aix',
      'darwin',
      'freebsd',
      'linux',
      'openbsd',
      'sunos',
      'win32'
    ]) as NodeJS.Platform,
    arch: requireString(record.arch, 'desktopAppInfo.arch'),
    deviceName: requireString(record.deviceName, 'desktopAppInfo.deviceName'),
    userDataPath: requireString(record.userDataPath, 'desktopAppInfo.userDataPath'),
    serverBaseUrl: requireString(record.serverBaseUrl, 'desktopAppInfo.serverBaseUrl'),
    isPackaged: requireBoolean(record.isPackaged, 'desktopAppInfo.isPackaged')
  };
}

function validateDesktopServerConnectionStatus(
  value: unknown
): DesktopRuntimeState['serverConnection'] {
  const record = requireRecord(value, 'desktop server connection status');
  const state = requireEnum(record.state, 'serverConnection.state', [
    'unchecked',
    'online',
    'offline'
  ]);

  return {
    state,
    serverBaseUrl: requireString(record.serverBaseUrl, 'serverConnection.serverBaseUrl'),
    checkedAt: requireString(record.checkedAt, 'serverConnection.checkedAt'),
    latencyMs: optionalNumber(record.latencyMs, 'serverConnection.latencyMs'),
    service: optionalString(record.service, 'serverConnection.service'),
    message: optionalString(record.message, 'serverConnection.message')
  };
}

function validateDesktopRuntimeSnapshot(value: unknown): DesktopRuntimeSnapshot {
  const record = requireRecord(value, 'desktop runtime snapshot');
  return {
    runtimeId: requireString(record.runtimeId, 'runtimeSnapshot.runtimeId'),
    deviceId: requireString(record.deviceId, 'runtimeSnapshot.deviceId'),
    deviceName: requireString(record.deviceName, 'runtimeSnapshot.deviceName'),
    platform: requireEnum(record.platform, 'runtimeSnapshot.platform', [
      'windows',
      'macos',
      'linux'
    ]) as DesktopPlatform,
    workspaceId: requireString(record.workspaceId, 'runtimeSnapshot.workspaceId'),
    appVersion: requireString(record.appVersion, 'runtimeSnapshot.appVersion'),
    lastSyncedAt: optionalString(record.lastSyncedAt, 'runtimeSnapshot.lastSyncedAt'),
    rolePackages: requireArray(record.rolePackages, 'runtimeSnapshot.rolePackages').map(
      validateDesktopRolePackageSummary
    ),
    tools: requireArray(record.tools, 'runtimeSnapshot.tools').map(validateDesktopToolSummary),
    tasks: requireArray(record.tasks, 'runtimeSnapshot.tasks').map(validateDesktopTaskSummary)
  };
}

function validateDesktopRolePackageSummary(value: unknown): DesktopRuntimeState['runtimeSnapshot']['rolePackages'][number] {
  const record = requireRecord(value, 'desktop role package summary');
  return {
    roleCode: requireString(record.roleCode, 'rolePackageSummary.roleCode'),
    version: requireString(record.version, 'rolePackageSummary.version'),
    state: requireEnum(record.state, 'rolePackageSummary.state', [
      'installed',
      'running',
      'paused',
      'error'
    ]) as DesktopRolePackageState,
    installedAt: requireString(record.installedAt, 'rolePackageSummary.installedAt'),
    lastRunAt: optionalString(record.lastRunAt, 'rolePackageSummary.lastRunAt'),
    taskCount: optionalInteger(record.taskCount, 'rolePackageSummary.taskCount')
  };
}

function validateDesktopToolSummary(value: unknown): DesktopToolSummary {
  const record = requireRecord(value, 'desktop tool summary');
  return {
    toolId: requireString(record.toolId, 'toolSummary.toolId'),
    enabled: requireBoolean(record.enabled, 'toolSummary.enabled'),
    lastUsedAt: optionalString(record.lastUsedAt, 'toolSummary.lastUsedAt')
  };
}

function validateDesktopTaskSummary(value: unknown): DesktopTaskSummary {
  const record = requireRecord(value, 'desktop task summary');
  return {
    taskId: requireString(record.taskId, 'taskSummary.taskId'),
    roleCode: requireString(record.roleCode, 'taskSummary.roleCode'),
    title: requireString(record.title, 'taskSummary.title'),
    state: requireEnum(record.state, 'taskSummary.state', [
      'queued',
      'running',
      'waiting_approval',
      'completed',
      'failed',
      'cancelled'
    ]) as DesktopTaskState,
    updatedAt: requireString(record.updatedAt, 'taskSummary.updatedAt'),
    artifactCount: optionalInteger(record.artifactCount, 'taskSummary.artifactCount'),
    costCents: optionalInteger(record.costCents, 'taskSummary.costCents')
  };
}

function validateDesktopTaskDetail(
  value: unknown
): NonNullable<DesktopRuntimeState['taskDetails']>[number] {
  const record = requireRecord(value, 'desktop task detail');
  return {
    taskId: requireString(record.taskId, 'taskDetail.taskId'),
    roleCode: requireString(record.roleCode, 'taskDetail.roleCode'),
    roleName: requireString(record.roleName, 'taskDetail.roleName'),
    title: requireString(record.title, 'taskDetail.title'),
    taskType: requireString(record.taskType, 'taskDetail.taskType'),
    input: requireString(record.input, 'taskDetail.input'),
    priority: requireEnum(record.priority, 'taskDetail.priority', ['low', 'normal', 'high', 'urgent']),
    state: requireEnum(record.state, 'taskDetail.state', [
      'queued',
      'running',
      'waiting_approval',
      'completed',
      'failed',
      'cancelled'
    ]) as DesktopTaskState,
    createdAt: requireString(record.createdAt, 'taskDetail.createdAt'),
    updatedAt: requireString(record.updatedAt, 'taskDetail.updatedAt'),
    artifactCount: optionalInteger(record.artifactCount, 'taskDetail.artifactCount'),
    costCents: optionalInteger(record.costCents, 'taskDetail.costCents'),
    artifacts: requireArray(record.artifacts, 'taskDetail.artifacts').map(validateDesktopArtifactSummary),
    executionLogs: requireArray(record.executionLogs, 'taskDetail.executionLogs').map(
      validateDesktopExecutionLogEntry
    ),
    costRecords: requireArray(record.costRecords, 'taskDetail.costRecords').map(
      validateDesktopCostRecordSummary
    ),
    currentRun: record.currentRun ? validateDesktopExecutionRunSummary(record.currentRun) : undefined
  };
}

function validateDesktopArtifactSummary(
  value: unknown
): NonNullable<DesktopRuntimeState['taskDetails']>[number]['artifacts'][number] {
  const record = requireRecord(value, 'desktop artifact summary');
  return {
    id: requireString(record.id, 'artifact.id'),
    type: requireEnum(record.type, 'artifact.type', ['text', 'report', 'video', 'image', 'file']),
    title: requireString(record.title, 'artifact.title'),
    content: requireString(record.content, 'artifact.content'),
    createdAt: requireString(record.createdAt, 'artifact.createdAt')
  };
}

function validateDesktopExecutionLogEntry(
  value: unknown
): NonNullable<DesktopRuntimeState['taskDetails']>[number]['executionLogs'][number] {
  const record = requireRecord(value, 'desktop execution log entry');
  return {
    id: requireString(record.id, 'executionLog.id'),
    level: requireEnum(record.level, 'executionLog.level', ['info', 'warning', 'error']),
    eventType: requireString(record.eventType, 'executionLog.eventType'),
    message: requireString(record.message, 'executionLog.message'),
    createdAt: requireString(record.createdAt, 'executionLog.createdAt')
  };
}

function validateDesktopCostRecordSummary(
  value: unknown
): NonNullable<DesktopRuntimeState['taskDetails']>[number]['costRecords'][number] {
  const record = requireRecord(value, 'desktop cost record summary');
  return {
    id: requireString(record.id, 'costRecord.id'),
    provider: requireString(record.provider, 'costRecord.provider'),
    modelName: requireString(record.modelName, 'costRecord.modelName'),
    inputTokens: requireInteger(record.inputTokens, 'costRecord.inputTokens'),
    outputTokens: requireInteger(record.outputTokens, 'costRecord.outputTokens'),
    costCents: requireInteger(record.costCents, 'costRecord.costCents'),
    currency: requireString(record.currency, 'costRecord.currency'),
    createdAt: requireString(record.createdAt, 'costRecord.createdAt')
  };
}

function validateDesktopExecutionRunSummary(
  value: unknown
): NonNullable<DesktopRuntimeState['taskDetails']>[number]['currentRun'] {
  const record = requireRecord(value, 'desktop execution run summary');
  return {
    id: requireString(record.id, 'executionRun.id'),
    taskId: requireString(record.taskId, 'executionRun.taskId'),
    status: requireEnum(record.status, 'executionRun.status', [
      'queued',
      'running',
      'completed',
      'failed',
      'cancelled'
    ]),
    startedAt: optionalString(record.startedAt, 'executionRun.startedAt'),
    finishedAt: optionalString(record.finishedAt, 'executionRun.finishedAt')
  };
}

function validateLocalRuntimeContract(value: unknown): LocalRuntimeContract {
  const record = requireRecord(value, 'local runtime contract');
  return {
    runtimeId: requireString(record.runtimeId, 'localRuntime.runtimeId'),
    deviceId: requireString(record.deviceId, 'localRuntime.deviceId'),
    workspaceId: requireString(record.workspaceId, 'localRuntime.workspaceId'),
    appVersion: requireString(record.appVersion, 'localRuntime.appVersion'),
    installedRoleCodes: requireStringArray(record.installedRoleCodes, 'localRuntime.installedRoleCodes'),
    activeRoleCode: optionalString(record.activeRoleCode, 'localRuntime.activeRoleCode'),
    enabledToolIds: requireStringArray(record.enabledToolIds, 'localRuntime.enabledToolIds'),
    enabledModelProfileIds: requireStringArray(
      record.enabledModelProfileIds,
      'localRuntime.enabledModelProfileIds'
    ),
    knowledgeBindingIds: requireStringArray(
      record.knowledgeBindingIds,
      'localRuntime.knowledgeBindingIds'
    ),
    syncPolicy: requireEnum(record.syncPolicy, 'localRuntime.syncPolicy', [
      'summary_only',
      'summary_plus_metadata'
    ]),
    lastSyncedAt: optionalString(record.lastSyncedAt, 'localRuntime.lastSyncedAt')
  };
}

function validateModelProfile(value: unknown): ModelProfile {
  const record = requireRecord(value, 'model profile');
  return {
    id: requireString(record.id, 'modelProfile.id'),
    providerId: requireString(record.providerId, 'modelProfile.providerId'),
    providerName: requireString(record.providerName, 'modelProfile.providerName'),
    modelName: requireString(record.modelName, 'modelProfile.modelName'),
    purpose: requireEnum(record.purpose, 'modelProfile.purpose', [
      'general',
      'reasoning',
      'vision',
      'embeddings',
      'document'
    ]),
    temperature: optionalNumber(record.temperature, 'modelProfile.temperature'),
    maxTokens: optionalInteger(record.maxTokens, 'modelProfile.maxTokens'),
    fallbackProfileId: optionalString(record.fallbackProfileId, 'modelProfile.fallbackProfileId'),
    monthlyBudgetCents: optionalInteger(
      record.monthlyBudgetCents,
      'modelProfile.monthlyBudgetCents'
    )
  };
}

function validateToolManifest(value: unknown): ToolManifest {
  const record = requireRecord(value, 'tool manifest');
  return {
    id: requireString(record.id, 'toolManifest.id'),
    name: requireString(record.name, 'toolManifest.name'),
    version: requireString(record.version, 'toolManifest.version'),
    scope: requireEnum(record.scope, 'toolManifest.scope', ['desktop', 'server', 'hybrid']),
    entryPoint: requireEnum(record.entryPoint, 'toolManifest.entryPoint', [
      'native',
      'bridge',
      'api',
      'mcp'
    ]),
    capabilities: requireStringEnumArray(
      record.capabilities,
      'toolManifest.capabilities',
      [
        'web_search',
        'document_edit',
        'presentation_edit',
        'spreadsheet_edit',
        'filesystem',
        'browser_automation',
        'custom_api',
        'mcp'
      ]
    ),
    requiresApproval: optionalBoolean(record.requiresApproval, 'toolManifest.requiresApproval')
  };
}

function validateRolePackageManifest(value: unknown): RolePackageManifest {
  const record = requireRecord(value, 'role package manifest');
  const modelProfileIds = requireStringArray(record.modelProfileIds, 'rolePackage.modelProfileIds');
  const toolIds = requireStringArray(record.toolIds, 'rolePackage.toolIds');
  const requiredKnowledgeSources = requireStringEnumArray(
    record.requiredKnowledgeSources,
    'rolePackage.requiredKnowledgeSources',
    ['local_folder', 'local_file', 'workspace_library', 'server_summary']
  );
  const defaultTaskTypes = requireStringArray(record.defaultTaskTypes, 'rolePackage.defaultTaskTypes');

  if (modelProfileIds.length === 0) {
    throw new Error('rolePackage.modelProfileIds must contain at least one model profile id.');
  }

  if (defaultTaskTypes.length === 0) {
    throw new Error('rolePackage.defaultTaskTypes must contain at least one task type.');
  }

  return {
    roleCode: requireString(record.roleCode, 'rolePackage.roleCode'),
    name: requireString(record.name, 'rolePackage.name'),
    version: requireString(record.version, 'rolePackage.version'),
    summary: optionalString(record.summary, 'rolePackage.summary'),
    modelProfileIds,
    toolIds,
    requiredKnowledgeSources,
    defaultTaskTypes,
    syncPolicy: requireEnum(record.syncPolicy, 'rolePackage.syncPolicy', [
      'summary_only',
      'summary_plus_metadata'
    ])
  };
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return value;
}

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }

  return uniqueStrings(
    value.map((item, index) => requireString(item, `${fieldName}[${index}]`))
  );
}

function requireStringEnumArray<T extends string>(
  value: unknown,
  fieldName: string,
  allowed: readonly T[]
): T[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array.`);
  }

  return uniqueStrings(
    value.map((item, index) => requireEnum(item, `${fieldName}[${index}]`, allowed))
  ) as T[];
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return normalized;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function requireBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean.`);
  }

  return value;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${fieldName} must be a finite number.`);
  }

  return value;
}

function optionalBoolean(value: unknown, fieldName: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean.`);
  }

  return value;
}

function optionalInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function requireInteger(value: unknown, fieldName: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${fieldName} must be an integer.`);
  }

  return value;
}

function requireEnum<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T {
  if (typeof value !== 'string') {
    throw new Error(`${fieldName} must be a string.`);
  }

  const normalized = value.trim();
  if (!allowed.includes(normalized as T)) {
    throw new Error(`${fieldName} must be one of: ${allowed.join(', ')}.`);
  }

  return normalized as T;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function readJsonFile(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function writeJsonFile(filePath: string, value: unknown): void {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8' });
}
