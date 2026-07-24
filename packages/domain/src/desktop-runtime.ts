export type KnowledgeBindingSource =
  | 'local_folder'
  | 'local_file'
  | 'workspace_library'
  | 'server_summary';

export type ModelPurpose = 'general' | 'reasoning' | 'vision' | 'embeddings' | 'document';

export type ToolScope = 'desktop' | 'server' | 'hybrid';

export type ToolEntryPoint = 'native' | 'bridge' | 'api' | 'mcp';

export type ToolCapability =
  | 'web_search'
  | 'document_edit'
  | 'presentation_edit'
  | 'spreadsheet_edit'
  | 'filesystem'
  | 'browser_automation'
  | 'custom_api'
  | 'mcp';

export type SyncPolicy = 'summary_only' | 'summary_plus_metadata';

export interface DesktopWebSearchToolSettings {
  endpoint?: string;
  apiKey?: string;
  allowPrivateNetwork?: boolean;
}

export interface DesktopToolSettings {
  webSearch?: DesktopWebSearchToolSettings;
}

export interface ModelProfile {
  id: string;
  providerId: string;
  providerName: string;
  modelName: string;
  purpose: ModelPurpose;
  apiBaseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  fallbackProfileId?: string;
  monthlyBudgetCents?: number;
}

export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  scope: ToolScope;
  entryPoint: ToolEntryPoint;
  capabilities: ToolCapability[];
  requiresApproval: boolean;
}

export interface RolePackageManifest {
  roleCode: string;
  name: string;
  version: string;
  summary?: string;
  modelProfileIds: string[];
  toolIds: string[];
  requiredKnowledgeSources: KnowledgeBindingSource[];
  defaultTaskTypes: string[];
  syncPolicy: SyncPolicy;
}

export interface LocalRuntimeContract {
  runtimeId: string;
  deviceId: string;
  workspaceId: string;
  appVersion: string;
  installedRoleCodes: string[];
  activeRoleCode?: string;
  enabledToolIds: string[];
  enabledModelProfileIds: string[];
  knowledgeBindingIds: string[];
  syncPolicy: SyncPolicy;
  toolSettings?: DesktopToolSettings;
  lastSyncedAt?: string;
}

export function validateModelProfile(input: unknown): ModelProfile {
  const record = requireRecord(input, 'model profile');

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
    apiBaseUrl: optionalString(record.apiBaseUrl, 'modelProfile.apiBaseUrl'),
    apiKey: optionalString(record.apiKey, 'modelProfile.apiKey'),
    temperature: optionalNumber(record.temperature, 'modelProfile.temperature'),
    maxTokens: optionalPositiveInteger(record.maxTokens, 'modelProfile.maxTokens'),
    fallbackProfileId: optionalString(record.fallbackProfileId, 'modelProfile.fallbackProfileId'),
    monthlyBudgetCents: optionalPositiveInteger(
      record.monthlyBudgetCents,
      'modelProfile.monthlyBudgetCents'
    )
  };
}

export function validateToolManifest(input: unknown): ToolManifest {
  const record = requireRecord(input, 'tool manifest');

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
      ['web_search', 'document_edit', 'presentation_edit', 'spreadsheet_edit', 'filesystem', 'browser_automation', 'custom_api', 'mcp']
    ),
    requiresApproval: optionalBoolean(record.requiresApproval, 'toolManifest.requiresApproval')
  };
}

export function validateRolePackageManifest(input: unknown): RolePackageManifest {
  const record = requireRecord(input, 'role package manifest');
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

export function validateLocalRuntimeContract(input: unknown): LocalRuntimeContract {
  const record = requireRecord(input, 'local runtime contract');

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
    toolSettings: optionalToolSettings(record.toolSettings, 'localRuntime.toolSettings'),
    lastSyncedAt: optionalString(record.lastSyncedAt, 'localRuntime.lastSyncedAt')
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

function optionalBoolean(value: unknown, fieldName: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`${fieldName} must be a boolean.`);
  }

  return value;
}

function optionalNumber(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`${fieldName} must be a number.`);
  }

  return value;
}

function optionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return value;
}

function optionalToolSettings(
  value: unknown,
  fieldName: string
): DesktopToolSettings | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object.`);
  }

  const record = value as Record<string, unknown>;
  const webSearch = record.webSearch;

  if (webSearch === undefined || webSearch === null) {
    return {};
  }

  if (typeof webSearch !== 'object' || webSearch === null || Array.isArray(webSearch)) {
    throw new Error(`${fieldName}.webSearch must be an object.`);
  }

  const webSearchRecord = webSearch as Record<string, unknown>;

  return {
    webSearch: {
      endpoint: optionalString(webSearchRecord.endpoint, `${fieldName}.webSearch.endpoint`),
      apiKey: optionalString(webSearchRecord.apiKey, `${fieldName}.webSearch.apiKey`),
      allowPrivateNetwork: optionalBoolean(
        webSearchRecord.allowPrivateNetwork,
        `${fieldName}.webSearch.allowPrivateNetwork`
      )
    }
  };
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

function requireStringEnumArray<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T[] {
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
