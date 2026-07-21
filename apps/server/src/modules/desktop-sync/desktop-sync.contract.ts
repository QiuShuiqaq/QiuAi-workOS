export interface DesktopRuntimeSyncRequest {
  data: DesktopRuntimeSnapshot;
}

export interface DesktopRuntimeSyncResponse {
  data: {
    accepted: true;
    syncedAt: string;
    nextSyncAt?: string;
  };
}

export interface DesktopRuntimeSnapshot {
  runtimeId: string;
  deviceId: string;
  deviceName: string;
  platform: 'windows' | 'macos' | 'linux';
  workspaceId: string;
  appVersion: string;
  lastSyncedAt?: string;
  rolePackages: DesktopRolePackageSummary[];
  tools: DesktopToolSummary[];
  tasks: DesktopTaskSummary[];
}

export interface DesktopRolePackageSummary {
  roleCode: string;
  version: string;
  state: 'installed' | 'running' | 'paused' | 'error';
  installedAt: string;
  lastRunAt?: string;
  taskCount?: number;
  templateId?: string;
  templateVersion?: string;
  skills?: DesktopRoleSkillSummary[];
}

export interface DesktopRoleSkillSummary {
  code: string;
  name: string;
  summary: string;
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
  state: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  updatedAt: string;
  artifactCount?: number;
  costCents?: number;
  executionContext?: DesktopTaskExecutionContext;
}

export interface DesktopTaskExecutionContext {
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeBindingIds: string[];
}

export function parseDesktopRuntimeSyncRequest(input: unknown): DesktopRuntimeSyncRequest {
  const record = requireRecord(input, 'desktop runtime sync request');
  return {
    data: parseDesktopRuntimeSnapshot(record.data)
  };
}

function parseDesktopRuntimeSnapshot(input: unknown): DesktopRuntimeSnapshot {
  const record = requireRecord(input, 'desktop runtime snapshot');
  return {
    runtimeId: requireString(record.runtimeId, 'desktopRuntimeSnapshot.runtimeId'),
    deviceId: requireString(record.deviceId, 'desktopRuntimeSnapshot.deviceId'),
    deviceName: requireString(record.deviceName, 'desktopRuntimeSnapshot.deviceName'),
    platform: requireEnum(record.platform, 'desktopRuntimeSnapshot.platform', ['windows', 'macos', 'linux']),
    workspaceId: requireString(record.workspaceId, 'desktopRuntimeSnapshot.workspaceId'),
    appVersion: requireString(record.appVersion, 'desktopRuntimeSnapshot.appVersion'),
    lastSyncedAt: optionalString(record.lastSyncedAt, 'desktopRuntimeSnapshot.lastSyncedAt'),
    rolePackages: parseRolePackageSummaries(record.rolePackages),
    tools: parseToolSummaries(record.tools),
    tasks: parseTaskSummaries(record.tasks)
  };
}

function parseRolePackageSummaries(input: unknown): DesktopRuntimeSnapshot['rolePackages'] {
  if (!Array.isArray(input)) {
    throw new Error('desktopRuntimeSnapshot.rolePackages must be an array.');
  }

  return input.map((item, index) => {
    const record = requireRecord(item, `desktopRuntimeSnapshot.rolePackages[${index}]`);
    return {
      roleCode: requireString(record.roleCode, `desktopRuntimeSnapshot.rolePackages[${index}].roleCode`),
      version: requireString(record.version, `desktopRuntimeSnapshot.rolePackages[${index}].version`),
      state: requireEnum(
        record.state,
        `desktopRuntimeSnapshot.rolePackages[${index}].state`,
        ['installed', 'running', 'paused', 'error']
      ),
      installedAt: requireString(
        record.installedAt,
        `desktopRuntimeSnapshot.rolePackages[${index}].installedAt`
      ),
      lastRunAt: optionalString(record.lastRunAt, `desktopRuntimeSnapshot.rolePackages[${index}].lastRunAt`),
      taskCount: optionalNonNegativeInteger(
        record.taskCount,
        `desktopRuntimeSnapshot.rolePackages[${index}].taskCount`
      ),
      templateId: optionalString(
        record.templateId,
        `desktopRuntimeSnapshot.rolePackages[${index}].templateId`
      ),
      templateVersion: optionalString(
        record.templateVersion,
        `desktopRuntimeSnapshot.rolePackages[${index}].templateVersion`
      ),
      skills: Array.isArray(record.skills)
        ? record.skills.map((item, skillIndex) =>
            parseDesktopRoleSkillSummary(
              item,
              `desktopRuntimeSnapshot.rolePackages[${index}].skills[${skillIndex}]`
            )
          )
        : undefined
    };
  });
}

function parseDesktopRoleSkillSummary(
  input: unknown,
  labelPrefix: string
): DesktopRoleSkillSummary {
  const record = requireRecord(input, labelPrefix);
  return {
    code: requireString(record.code, `${labelPrefix}.code`),
    name: requireString(record.name, `${labelPrefix}.name`),
    summary: requireString(record.summary, `${labelPrefix}.summary`)
  };
}

function parseToolSummaries(input: unknown): DesktopRuntimeSnapshot['tools'] {
  if (!Array.isArray(input)) {
    throw new Error('desktopRuntimeSnapshot.tools must be an array.');
  }

  return input.map((item, index) => {
    const record = requireRecord(item, `desktopRuntimeSnapshot.tools[${index}]`);
    return {
      toolId: requireString(record.toolId, `desktopRuntimeSnapshot.tools[${index}].toolId`),
      enabled: requireBoolean(record.enabled, `desktopRuntimeSnapshot.tools[${index}].enabled`),
      lastUsedAt: optionalString(record.lastUsedAt, `desktopRuntimeSnapshot.tools[${index}].lastUsedAt`)
    };
  });
}

function parseTaskSummaries(input: unknown): DesktopRuntimeSnapshot['tasks'] {
  if (!Array.isArray(input)) {
    throw new Error('desktopRuntimeSnapshot.tasks must be an array.');
  }

  return input.map((item, index) => {
    const record = requireRecord(item, `desktopRuntimeSnapshot.tasks[${index}]`);
    return {
      taskId: requireString(record.taskId, `desktopRuntimeSnapshot.tasks[${index}].taskId`),
      roleCode: requireString(record.roleCode, `desktopRuntimeSnapshot.tasks[${index}].roleCode`),
      title: requireString(record.title, `desktopRuntimeSnapshot.tasks[${index}].title`),
      state: requireEnum(
        record.state,
        `desktopRuntimeSnapshot.tasks[${index}].state`,
        ['queued', 'running', 'waiting_approval', 'completed', 'failed', 'cancelled']
      ),
      updatedAt: requireString(record.updatedAt, `desktopRuntimeSnapshot.tasks[${index}].updatedAt`),
      artifactCount: optionalNonNegativeInteger(
        record.artifactCount,
        `desktopRuntimeSnapshot.tasks[${index}].artifactCount`
      ),
      costCents: optionalNonNegativeInteger(
        record.costCents,
        `desktopRuntimeSnapshot.tasks[${index}].costCents`
      ),
      executionContext: record.executionContext
        ? parseDesktopTaskExecutionContext(
            record.executionContext,
            `desktopRuntimeSnapshot.tasks[${index}].executionContext`
          )
        : undefined
    };
  });
}

function parseDesktopTaskExecutionContext(
  input: unknown,
  labelPrefix: string
): DesktopTaskExecutionContext {
  const record = requireRecord(input, labelPrefix);
  return {
    modelProfileIds: requireStringArray(
      record.modelProfileIds,
      `${labelPrefix}.modelProfileIds`
    ),
    toolIds: requireStringArray(record.toolIds, `${labelPrefix}.toolIds`),
    knowledgeBindingIds: requireStringArray(
      record.knowledgeBindingIds,
      `${labelPrefix}.knowledgeBindingIds`
    )
  };
}

function requireRecord(input: unknown, label: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error(`${label} must be an object.`);
  }

  return input as Record<string, unknown>;
}

function requireString(value: unknown, fieldName: string): string {
  const normalized = optionalString(value, fieldName);
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

function requireStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} must be an array of strings.`);
  }

  return value.map((item, index) => requireString(item, `${fieldName}[${index}]`));
}

function optionalNonNegativeInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
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
