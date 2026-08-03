export interface DesktopRuntimeSyncRequest {
  data: DesktopRuntimeSnapshot;
}

export interface CreateDesktopBindingCodeRequest {
  label?: string;
  expiresInMinutes?: number;
}

export interface UpdateDesktopBindingCodeRequest {
  label?: string;
}

export interface RedeemDesktopBindingCodeRequest {
  bindingCode: string;
  runtimeId: string;
  deviceId: string;
  deviceName: string;
  platform: DesktopRuntimeSnapshot['platform'];
  appVersion: string;
}

export interface DesktopAgreementAcceptanceStatusQuery {
  agreementKey: string;
  agreementVersion: string;
  contentHash: string;
  runtimeId: string;
  deviceId: string;
}

export interface AcceptDesktopAgreementRequest extends DesktopAgreementAcceptanceStatusQuery {
  workspaceId?: string;
  deviceName?: string;
  platform?: DesktopRuntimeSnapshot['platform'];
  appVersion?: string;
  consentMethod: string;
  minimumReadSeconds?: number;
  actualReadSeconds?: number;
}

export type DesktopIssueCategory = 'BUG' | 'USAGE' | 'FEATURE_REQUEST' | 'BAD_OUTPUT' | 'OTHER';
export type DesktopIssueSeverity = 'NORMAL' | 'IMPACTING' | 'BLOCKING';

export interface CreateDesktopIssueReportRequest {
  category: DesktopIssueCategory;
  severity: DesktopIssueSeverity;
  title: string;
  description: string;
  contact?: string;
  workspaceId?: string;
  workspaceName?: string;
  runtimeId?: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  diagnostics?: Record<string, unknown>;
}

export interface DesktopAgreementAcceptanceSummary {
  id: string;
  agreementKey: string;
  agreementVersion: string;
  contentHash: string;
  runtimeId: string;
  deviceId: string;
  workspaceId?: string;
  acceptedAt: string;
  consentMethod: string;
  minimumReadSeconds?: number;
  actualReadSeconds?: number;
}

export interface DesktopAgreementAcceptanceStatusResponse {
  data: {
    accepted: boolean;
    acceptance?: DesktopAgreementAcceptanceSummary;
  };
}

export interface AcceptDesktopAgreementResponse {
  data: DesktopAgreementAcceptanceSummary;
}

export interface DesktopIssueReportSummary {
  id: string;
  issueNo: string;
  category: DesktopIssueCategory;
  severity: DesktopIssueSeverity;
  status: 'NEW' | 'VIEWED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'CLOSED';
  title: string;
  description: string;
  contact?: string;
  workspaceId?: string;
  runtimeId?: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  diagnostics?: Record<string, unknown>;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesktopIssueReportResponse {
  data: DesktopIssueReportSummary;
}

export interface DesktopDeviceSummary {
  id: string;
  workspaceId: string;
  runtimeId: string;
  deviceId: string;
  deviceName: string;
  platform: DesktopRuntimeSnapshot['platform'];
  appVersion: string;
  status: 'ACTIVE' | 'REVOKED';
  boundAt: string;
  lastSeenAt?: string;
  lastSyncedAt?: string;
}

export interface CreateDesktopBindingCodeResponse {
  data: {
    id: string;
    workspaceId: string;
    label?: string;
    status: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
    expiresAt?: string;
    createdAt: string;
    redeemedAt?: string;
    bindingCode: string;
  };
}

export interface ListDesktopBindingCodesResponse {
  data: Array<{
    id: string;
    workspaceId: string;
    label?: string;
    status: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
    expiresAt?: string;
    createdAt: string;
    redeemedAt?: string;
  }>;
}

export interface UpdateDesktopBindingCodeResponse {
  data: ListDesktopBindingCodesResponse['data'][number];
}

export interface CancelDesktopBindingCodeResponse {
  data: ListDesktopBindingCodesResponse['data'][number];
}

export interface ListDesktopDevicesResponse {
  data: DesktopDeviceSummary[];
}

export interface RedeemDesktopBindingCodeResponse {
  data: {
    workspaceId: string;
    deviceToken: string;
    device: DesktopDeviceSummary;
  };
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
  toolActions?: DesktopToolActionHealthSummary[];
  tasks: DesktopTaskSummary[];
}

export interface DesktopRolePackageSummary {
  roleCode: string;
  version: string;
  state: 'installed' | 'running' | 'paused' | 'error' | 'deleted';
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

export interface DesktopToolActionHealthSummary {
  toolId: string;
  actionId: string;
  name: string;
  category?: string;
  status: 'ready' | 'disabled' | 'missing_config' | 'missing_dependency' | 'unavailable' | 'experimental';
  inputTypes?: string[];
  outputTypes?: string[];
  requiredConfig?: string[];
  missingConfig?: string[];
  requiredDependencies?: string[];
  missingDependencies?: string[];
  message?: string;
  checkedAt?: string;
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
  useKnowledge?: boolean;
}

export function parseDesktopRuntimeSyncRequest(input: unknown): DesktopRuntimeSyncRequest {
  const record = requireRecord(input, 'desktop runtime sync request');
  return {
    data: parseDesktopRuntimeSnapshot(record.data)
  };
}

export function parseCreateDesktopBindingCodeRequest(input: unknown): CreateDesktopBindingCodeRequest {
  if (input === undefined || input === null) {
    return {};
  }

  const record = requireRecord(input, 'desktop binding code request');
  const label = optionalString(record.label, 'desktopBindingCode.label');
  const expiresInMinutes = optionalBoundedInteger(
    record.expiresInMinutes,
    'desktopBindingCode.expiresInMinutes',
    1,
    10080
  );

  return {
    ...(label === undefined ? {} : { label }),
    ...(expiresInMinutes === undefined ? {} : { expiresInMinutes })
  };
}

export function parseUpdateDesktopBindingCodeRequest(input: unknown): UpdateDesktopBindingCodeRequest {
  const record = requireRecord(input, 'desktop binding code update request');
  return {
    label: optionalString(record.label, 'desktopBindingCode.label')
  };
}

export function parseRedeemDesktopBindingCodeRequest(input: unknown): RedeemDesktopBindingCodeRequest {
  const record = requireRecord(input, 'desktop binding redeem request');
  return {
    bindingCode: requireString(record.bindingCode, 'desktopBindingRedeem.bindingCode'),
    runtimeId: requireString(record.runtimeId, 'desktopBindingRedeem.runtimeId'),
    deviceId: requireString(record.deviceId, 'desktopBindingRedeem.deviceId'),
    deviceName: requireString(record.deviceName, 'desktopBindingRedeem.deviceName'),
    platform: requireEnum(record.platform, 'desktopBindingRedeem.platform', ['windows', 'macos', 'linux']),
    appVersion: requireString(record.appVersion, 'desktopBindingRedeem.appVersion')
  };
}

export function parseAgreementAcceptanceStatusQuery(
  input: Record<string, unknown>
): DesktopAgreementAcceptanceStatusQuery {
  return {
    agreementKey: requireString(input.agreementKey, 'agreementAcceptance.agreementKey'),
    agreementVersion: requireString(input.agreementVersion, 'agreementAcceptance.agreementVersion'),
    contentHash: requireString(input.contentHash, 'agreementAcceptance.contentHash'),
    runtimeId: requireString(input.runtimeId, 'agreementAcceptance.runtimeId'),
    deviceId: requireString(input.deviceId, 'agreementAcceptance.deviceId')
  };
}

export function parseAcceptDesktopAgreementRequest(input: unknown): AcceptDesktopAgreementRequest {
  const record = requireRecord(input, 'desktop agreement acceptance request');
  const platform = record.platform === undefined || record.platform === null
    ? undefined
    : (requireEnum(
        record.platform,
        'agreementAcceptance.platform',
        ['windows', 'macos', 'linux']
      ) as DesktopRuntimeSnapshot['platform']);

  return {
    agreementKey: requireString(record.agreementKey, 'agreementAcceptance.agreementKey'),
    agreementVersion: requireString(record.agreementVersion, 'agreementAcceptance.agreementVersion'),
    contentHash: requireString(record.contentHash, 'agreementAcceptance.contentHash'),
    runtimeId: requireString(record.runtimeId, 'agreementAcceptance.runtimeId'),
    deviceId: requireString(record.deviceId, 'agreementAcceptance.deviceId'),
    workspaceId: optionalString(record.workspaceId, 'agreementAcceptance.workspaceId'),
    deviceName: optionalString(record.deviceName, 'agreementAcceptance.deviceName'),
    platform,
    appVersion: optionalString(record.appVersion, 'agreementAcceptance.appVersion'),
    consentMethod: requireString(record.consentMethod, 'agreementAcceptance.consentMethod'),
    minimumReadSeconds: optionalBoundedInteger(
      record.minimumReadSeconds,
      'agreementAcceptance.minimumReadSeconds',
      0,
      3600
    ),
    actualReadSeconds: optionalBoundedInteger(
      record.actualReadSeconds,
      'agreementAcceptance.actualReadSeconds',
      0,
      86400
    )
  };
}

export function parseCreateDesktopIssueReportRequest(input: unknown): CreateDesktopIssueReportRequest {
  const record = requireRecord(input, 'desktop issue report request');
  const diagnostics = record.diagnostics === undefined || record.diagnostics === null
    ? undefined
    : requireRecord(record.diagnostics, 'desktopIssueReport.diagnostics');

  return {
    category: requireEnum(
      record.category,
      'desktopIssueReport.category',
      ['BUG', 'USAGE', 'FEATURE_REQUEST', 'BAD_OUTPUT', 'OTHER']
    ),
    severity: requireEnum(
      record.severity,
      'desktopIssueReport.severity',
      ['NORMAL', 'IMPACTING', 'BLOCKING']
    ),
    title: requireStringWithMaxLength(record.title, 'desktopIssueReport.title', 120),
    description: requireStringWithMaxLength(
      record.description,
      'desktopIssueReport.description',
      4000
    ),
    contact: optionalStringWithMaxLength(record.contact, 'desktopIssueReport.contact', 120),
    workspaceId: optionalStringWithMaxLength(record.workspaceId, 'desktopIssueReport.workspaceId', 80),
    runtimeId: optionalStringWithMaxLength(record.runtimeId, 'desktopIssueReport.runtimeId', 160),
    deviceId: optionalStringWithMaxLength(record.deviceId, 'desktopIssueReport.deviceId', 160),
    deviceName: optionalStringWithMaxLength(record.deviceName, 'desktopIssueReport.deviceName', 160),
    appVersion: optionalStringWithMaxLength(record.appVersion, 'desktopIssueReport.appVersion', 80),
    platform: optionalStringWithMaxLength(record.platform, 'desktopIssueReport.platform', 40),
    diagnostics
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
    toolActions: parseToolActionHealthSummaries(record.toolActions),
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
        ['installed', 'running', 'paused', 'error', 'deleted']
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

function parseToolActionHealthSummaries(input: unknown): DesktopRuntimeSnapshot['toolActions'] {
  if (input === undefined) {
    return undefined;
  }

  if (!Array.isArray(input)) {
    throw new Error('desktopRuntimeSnapshot.toolActions must be an array.');
  }

  return input.map((item, index) => {
    const record = requireRecord(item, `desktopRuntimeSnapshot.toolActions[${index}]`);
    return {
      toolId: requireString(record.toolId, `desktopRuntimeSnapshot.toolActions[${index}].toolId`),
      actionId: requireString(record.actionId, `desktopRuntimeSnapshot.toolActions[${index}].actionId`),
      name: requireString(record.name, `desktopRuntimeSnapshot.toolActions[${index}].name`),
      category: optionalString(record.category, `desktopRuntimeSnapshot.toolActions[${index}].category`),
      status: requireEnum(
        record.status,
        `desktopRuntimeSnapshot.toolActions[${index}].status`,
        ['ready', 'disabled', 'missing_config', 'missing_dependency', 'unavailable', 'experimental']
      ),
      inputTypes: optionalStringArray(record.inputTypes, `desktopRuntimeSnapshot.toolActions[${index}].inputTypes`),
      outputTypes: optionalStringArray(record.outputTypes, `desktopRuntimeSnapshot.toolActions[${index}].outputTypes`),
      requiredConfig: optionalStringArray(
        record.requiredConfig,
        `desktopRuntimeSnapshot.toolActions[${index}].requiredConfig`
      ),
      missingConfig: optionalStringArray(
        record.missingConfig,
        `desktopRuntimeSnapshot.toolActions[${index}].missingConfig`
      ),
      requiredDependencies: optionalStringArray(
        record.requiredDependencies,
        `desktopRuntimeSnapshot.toolActions[${index}].requiredDependencies`
      ),
      missingDependencies: optionalStringArray(
        record.missingDependencies,
        `desktopRuntimeSnapshot.toolActions[${index}].missingDependencies`
      ),
      message: optionalString(record.message, `desktopRuntimeSnapshot.toolActions[${index}].message`),
      checkedAt: optionalString(record.checkedAt, `desktopRuntimeSnapshot.toolActions[${index}].checkedAt`)
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
    ),
    useKnowledge:
      record.useKnowledge === undefined
        ? undefined
        : requireBoolean(record.useKnowledge, `${labelPrefix}.useKnowledge`)
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

function requireStringWithMaxLength(value: unknown, fieldName: string, maxLength: number): string {
  const normalized = requireString(value, fieldName);
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters.`);
  }

  return normalized;
}

function optionalStringWithMaxLength(
  value: unknown,
  fieldName: string,
  maxLength: number
): string | undefined {
  const normalized = optionalString(value, fieldName);
  if (normalized !== undefined && normalized.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters.`);
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

function optionalStringArray(value: unknown, fieldName: string): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireStringArray(value, fieldName);
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

function optionalBoundedInteger(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${fieldName} must be an integer between ${min} and ${max}.`);
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
