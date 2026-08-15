import type { ListSoftwareCopilotsResponse } from '@qiuai/api-contract/software-copilot';

export type { ListSoftwareCopilotsResponse };
import type {
  DesktopRuntimeSnapshot,
  DesktopArtifactSummary,
  DesktopKnowledgeSourceSummary,
  KnowledgeBindingSource,
  LocalRuntimeContract,
  ModelCapability,
  ModelCapabilityMetadata,
  ModelCatalogEntry,
  ModelCredential,
  ModelProfile,
  ModelProviderCatalog,
  RoleModelCredentialBinding,
  RoleTemplateDependencyManifest,
  RolePackageManifest,
  ToolManifest,
  DesktopTaskDetail
} from './desktop-contract.js';

export type DesktopConnectionState = 'unchecked' | 'online' | 'offline';

export type DesktopStorageMode = 'follow_install_dir' | 'fallback_user_dir';

export interface DesktopAppInfo {
  appName: string;
  appVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  deviceName: string;
  installPath?: string;
  userDataPath: string;
  serverBaseUrl: string;
  isPackaged: boolean;
  storageMode?: DesktopStorageMode;
}

export interface DesktopServerConnectionStatus {
  state: DesktopConnectionState;
  serverBaseUrl: string;
  checkedAt: string;
  latencyMs?: number;
  service?: string;
  message?: string;
}

export interface DesktopUpdateReleaseSummary {
  id: string;
  version: string;
  platform: 'windows';
  channel: 'stable';
  downloadUrl: string;
  releaseNotes?: string;
  checksumSha256?: string;
  fileSizeBytes?: number;
  forceUpdate: boolean;
  minimumSupportedVersion?: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesktopUpdateCheckResult {
  currentVersion?: string;
  updateAvailable: boolean;
  forceUpdate: boolean;
  latestRelease?: DesktopUpdateReleaseSummary;
}

export interface DesktopUpdateInstallResult {
  releaseVersion: string;
  installerPath: string;
  installerDirectoryPath?: string;
  downloadUrl: string;
  fileSizeBytes: number;
  checksumSha256: string;
  launchedAt: string;
  willQuit: boolean;
}

export interface DesktopUpdateDownloadProgress {
  releaseVersion: string;
  status: 'started' | 'downloading' | 'completed';
  receivedBytes: number;
  totalBytes?: number;
  percent?: number;
  installerPath?: string;
  installerDirectoryPath?: string;
  updatedAt: string;
}

export interface DesktopUpdateDownloadResult {
  releaseVersion: string;
  installerPath: string;
  installerDirectoryPath: string;
  downloadUrl: string;
  fileSizeBytes: number;
  checksumSha256: string;
  downloadedAt: string;
}

export interface DesktopUpdateLaunchRequest {
  installerPath: string;
  releaseVersion?: string;
}

export interface DesktopUpdateLaunchResult {
  releaseVersion?: string;
  installerPath: string;
  launchedAt: string;
  willQuit: boolean;
}

export interface DesktopAgreementDocumentSummary {
  agreementKey: string;
  agreementVersion: string;
  contentHash: string;
  title: string;
  effectiveDate: string;
  requiredReadSeconds: number;
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

export interface DesktopAgreementStatus {
  agreement: DesktopAgreementDocumentSummary;
  accepted: boolean;
  cloudSynced: boolean;
  acceptance?: DesktopAgreementAcceptanceSummary;
  message?: string;
}

export interface DesktopAgreementAcceptRequest {
  actualReadSeconds: number;
}

export type DesktopIssueCategory = 'BUG' | 'USAGE' | 'FEATURE_REQUEST' | 'BAD_OUTPUT' | 'OTHER';
export type DesktopIssueSeverity = 'NORMAL' | 'IMPACTING' | 'BLOCKING';

export interface DesktopIssueReportSubmitRequest {
  category: DesktopIssueCategory;
  severity: DesktopIssueSeverity;
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
}

export interface DesktopIssueReportSubmitResult {
  data: {
    id: string;
    issueNo: string;
    category: DesktopIssueCategory;
    severity: DesktopIssueSeverity;
    status: string;
    title: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface DesktopRuntimeSyncResponse {
  data: {
    accepted: true;
    syncedAt: string;
    nextSyncAt?: string;
  };
}

export interface DesktopAiPointOverview {
  wallet: {
    workspaceId: string;
    balancePoints: number;
    reservedPoints: number;
    availablePoints: number;
    updatedAt: string;
  };
  deviceQuota?: {
    desktopDeviceId: string;
    period: string;
    monthlyLimitPoints?: number;
    usedPointsThisMonth: number;
    reservedPoints: number;
    availablePoints?: number;
    status: 'active' | 'disabled';
  };
  routes: Array<{
    routeKey: string;
    displayName: string;
    capability: 'text' | 'reasoning' | 'image' | 'video';
    status: 'active' | 'disabled';
    pointPrice: number;
    sortOrder: number;
  }>;
}

export interface DesktopReferralOverview {
  workspaceId: string;
  accountStatus: 'unregistered' | 'free' | 'member' | 'enterprise';
  canInvite: boolean;
  referralCode?: string;
  invitedPaidCount: number;
  earnedPoints: number;
  policy: {
    inviteeRewardPoints: number;
    inviterRewardPoints: number;
    rewardExpiresInDays: number;
  };
}

export type DesktopRoleWatchStatus = 'idle' | 'running' | 'completed' | 'failed' | 'paused';
export type DesktopRoleWatchApprovalMode = 'readonly' | 'draft' | 'manual_submit';

export interface DesktopRoleWatchConfig {
  id: string;
  roleCode: string;
  enabled: boolean;
  sourceUrls: string[];
  intervalMinutes: number;
  rules: string;
  approvalMode: DesktopRoleWatchApprovalMode;
  useKnowledge?: boolean;
  sourceCursor?: number;
  seenFingerprints?: string[];
  lastFingerprint?: string;
  lastTaskId?: string;
  lastRunAt?: string;
  nextRunAt?: string;
  lastStatus?: DesktopRoleWatchStatus;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DesktopRoleWatchRun {
  id: string;
  configId: string;
  roleCode: string;
  sourceUrl: string;
  taskId?: string;
  status: DesktopRoleWatchStatus;
  startedAt: string;
  finishedAt?: string;
  message?: string;
  fingerprint?: string;
}

export interface DesktopRuntimeState {
  app: DesktopAppInfo;
  localRuntime: LocalRuntimeContract;
  runtimeSnapshot: DesktopRuntimeSnapshot;
  rolePackages: RolePackageManifest[];
  modelProfiles: ModelProfile[];
  modelCredentials: ModelCredential[];
  modelCatalogs: ModelProviderCatalog[];
  roleModelCredentialBindings: RoleModelCredentialBinding[];
  tools: ToolManifest[];
  knowledgeSources: DesktopKnowledgeSourceSummary[];
  taskDetails?: DesktopTaskDetail[];
  watchConfigs?: DesktopRoleWatchConfig[];
  watchRuns?: DesktopRoleWatchRun[];
  serverConnection: DesktopServerConnectionStatus;
}

export interface DesktopAuthorizedRoleSkillSummary {
  code: string;
  name: string;
  summary: string;
}

export type DesktopAuthorizedRoleTemplateStepType =
  | 'input'
  | 'llm'
  | 'knowledge'
  | 'tool'
  | 'approval'
  | 'output';

export interface DesktopAuthorizedRoleTemplateWorkflowStep {
  id: string;
  order: number;
  type: DesktopAuthorizedRoleTemplateStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

export interface DesktopAuthorizedRoleTemplateSummary {
  id: string;
  applicationType?: 'digital_employee' | 'digital_factory';
  outputCategory?: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  allowedPlanCodes?: string[];
  canInstall?: boolean;
  accessLabel?: string;
  accessReason?: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  skills: DesktopAuthorizedRoleSkillSummary[];
  workflowSteps: DesktopAuthorizedRoleTemplateWorkflowStep[];
  workflowGraph?: unknown;
  dependencyManifest?: RoleTemplateDependencyManifest;
  executionProfile?: RoleTemplateDependencyManifest['executionProfile'];
  sampleInputs: string[];
  outputFormat: string;
  approvalPolicy: string;
}

export interface DesktopDeviceCapacitySummary {
  planCode: string;
  maxDesktopDevices?: number;
  maxRoleInstances?: number;
  maxDigitalFactories?: number;
}

export interface DesktopAuthorizedRoleTemplateCatalog {
  source: 'server' | 'local_fallback';
  workspaceId: string;
  loadedAt: string;
  templates: DesktopAuthorizedRoleTemplateSummary[];
  deviceCapacity?: DesktopDeviceCapacitySummary;
  deletedTemplateIds?: string[];
  message?: string;
}

export interface DesktopBackupSummary {
  bundleId: string;
  workspaceId: string;
  bundlePath: string;
  createdAt: string;
  appVersion: string;
}

export interface DesktopModelChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface DesktopModelChatRequest {
  profile: ModelProfile;
  messages: DesktopModelChatMessage[];
  timeoutMs?: number;
  taskKind?: 'chat' | 'image_generation' | 'video_generation' | 'audio_transcription';
  visionInputs?: Array<{
    imagePath: string;
    mimeType?: string;
  }>;
  imageGeneration?: {
    prompt: string;
    negativePrompt?: string;
    sourceImagePath?: string;
    size?: string;
    aspectRatio?: string;
    responseFormat?: 'url';
    asyncMode?: 'wait' | 'submit_only' | 'poll_once';
    providerJobId?: string;
  };
  videoGeneration?: {
    prompt: string;
    negativePrompt?: string;
    sourceImagePath?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    responseFormat?: 'url';
  };
  audioTranscription?: {
    audioPath: string;
    audioUrl?: string;
    language?: string;
    dialect?: string;
    prompt?: string;
    responseFormat?: 'json' | 'text';
  };
}

export interface DesktopModelTestRequest {
  profile: ModelProfile;
  timeoutMs?: number;
}

export interface DesktopModelTestCheck {
  id: string;
  label: string;
  status: 'passed' | 'failed' | 'skipped';
  message: string;
  capabilities?: ModelCapability[];
  endpoint?: string;
  elapsedMs?: number;
  costWarning?: boolean;
}

export interface DesktopModelTestResponse {
  providerId: string;
  providerName: string;
  modelName: string;
  ok: boolean;
  message: string;
  checkedAt: string;
  mode: 'openai_compatible' | 'aliyun_bailian' | 'tencent_cloud';
  verifiedCapabilities?: ModelCapability[];
  capabilityMetadata?: ModelCapabilityMetadata;
  checks?: DesktopModelTestCheck[];
}

export interface DesktopModelChatResponse {
  provider: string;
  modelName: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  artifacts?: Array<{
    type: 'image' | 'video' | 'file';
    title?: string;
    remoteUrl?: string;
    localPath?: string;
    thumbnailPath?: string;
    mimeType?: string;
    providerJobId?: string;
    providerStatus?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface DesktopModelListRequest {
  providerId: string;
  providerName: string;
  apiBaseUrl?: string;
  apiKey: string;
  modelName?: string;
  capabilities?: string[];
  timeoutMs?: number;
}

export interface DesktopModelListResponse {
  providerId: string;
  providerName: string;
  apiBaseUrl?: string;
  fetchedAt: string;
  models: ModelCatalogEntry[];
}

export interface DesktopKnowledgeSourcePathResult {
  canceled: boolean;
  source: KnowledgeBindingSource;
  path?: string;
  label?: string;
  summary?: string;
  lastIndexedAt?: string;
}

export interface DesktopTaskArtifactWriteRequest {
  workspaceId: string;
  taskId: string;
  artifact: DesktopArtifactSummary;
}

export interface DesktopTaskArtifactWriteResult {
  artifactId: string;
  localPath: string;
}

export interface DesktopArtifactSaveAsRequest {
  sourcePath: string;
  suggestedFileName?: string;
}

export interface DesktopArtifactSaveAsResult {
  canceled: boolean;
  savedPath?: string;
}

export interface DesktopLocalFileExportRequest {
  files: Array<{
    sourcePath: string;
    suggestedFileName?: string;
  }>;
  targetFolderName?: string;
}

export interface DesktopLocalFileExportResult {
  canceled: boolean;
  exportDirectoryPath?: string;
  exportedFiles: Array<{
    sourcePath: string;
    savedPath: string;
  }>;
}

export interface DesktopRemoteFileSaveAsRequest {
  url: string;
  suggestedFileName?: string;
}

export type DesktopRemoteFileSaveAsResult = DesktopArtifactSaveAsResult;

export type DesktopToolInvocationAction =
  | 'filesystem.write_text_file'
  | 'filesystem.read_text_file'
  | 'filesystem.list_directory'
  | 'filesystem.download_remote_file'
  | 'filesystem.package_zip'
  | 'document.extract_text'
  | 'spreadsheet.read_xlsx'
  | 'web.fetch_url'
  | 'web.search'
  | 'browser.open_url'
  | 'browser.extract_text'
  | 'browser.run_steps'
  | 'http.request'
  | 'mcp.call'
  | 'office.write_markdown_document'
  | 'office.write_docx_document'
  | 'spreadsheet.write_csv'
  | 'spreadsheet.write_xlsx'
  | 'presentation.write_pptx'
  | 'presentation.write_outline_markdown'
  | 'video.probe'
  | 'video.extract_audio'
  | 'video.extract_frames'
  | 'video.compose_clips'
  | 'video.export_mp4';

export interface DesktopToolInvocationRequest {
  workspaceId: string;
  toolId: string;
  action: DesktopToolInvocationAction;
  input: Record<string, unknown>;
  allowedRootPaths?: string[];
}

export interface DesktopToolInvocationResult {
  toolId: string;
  action: DesktopToolInvocationAction;
  ok: boolean;
  output?: Record<string, unknown>;
  message?: string;
}

export type DesktopWindowControlAction = 'minimize' | 'toggle-maximize' | 'close';

export interface QiuDesktopBridge {
  getAppInfo(): Promise<DesktopAppInfo>;
  getRuntimeState(): Promise<DesktopRuntimeState>;
  getUserAgreementStatus(): Promise<DesktopAgreementStatus>;
  acceptUserAgreement(request: DesktopAgreementAcceptRequest): Promise<DesktopAgreementStatus>;
  submitIssueReport(request: DesktopIssueReportSubmitRequest): Promise<DesktopIssueReportSubmitResult>;
  bindDesktopDevice(bindingCode: string): Promise<DesktopRuntimeState>;
  unbindDesktopDevice(): Promise<DesktopRuntimeState>;
  checkServerConnection(): Promise<DesktopServerConnectionStatus>;
  checkForUpdates(): Promise<DesktopUpdateCheckResult>;
  downloadDesktopUpdate(): Promise<DesktopUpdateDownloadResult>;
  installDesktopUpdate(request: DesktopUpdateLaunchRequest): Promise<DesktopUpdateLaunchResult>;
  downloadAndInstallUpdate(): Promise<DesktopUpdateInstallResult>;
  onUpdateDownloadProgress(listener: (progress: DesktopUpdateDownloadProgress) => void): () => void;
  listAuthorizedRoleTemplates(): Promise<DesktopAuthorizedRoleTemplateCatalog>;
  syncRuntimeState(state: DesktopRuntimeState): Promise<DesktopRuntimeSyncResponse>;
  getAiPointOverview(): Promise<DesktopAiPointOverview>;
  getReferralOverview(): Promise<DesktopReferralOverview>;
  listSoftwareCopilots(): Promise<ListSoftwareCopilotsResponse>;
  saveRuntimeState(state: DesktopRuntimeState): Promise<void>;
  listWorkspaceBackups(): Promise<DesktopBackupSummary[]>;
  createWorkspaceBackup(state: DesktopRuntimeState): Promise<DesktopBackupSummary>;
  restoreWorkspaceBackup(bundlePath: string): Promise<DesktopBackupSummary>;
  invokeModelChat(request: DesktopModelChatRequest): Promise<DesktopModelChatResponse>;
  testModelConnection(request: DesktopModelTestRequest): Promise<DesktopModelTestResponse>;
  listProviderModels(request: DesktopModelListRequest): Promise<DesktopModelListResponse>;
  selectKnowledgeSourcePath(source: KnowledgeBindingSource): Promise<DesktopKnowledgeSourcePathResult>;
  writeTaskArtifact(request: DesktopTaskArtifactWriteRequest): Promise<DesktopTaskArtifactWriteResult>;
  saveArtifactAs(request: DesktopArtifactSaveAsRequest): Promise<DesktopArtifactSaveAsResult>;
  exportLocalFiles(request: DesktopLocalFileExportRequest): Promise<DesktopLocalFileExportResult>;
  saveRemoteFileAs(request: DesktopRemoteFileSaveAsRequest): Promise<DesktopRemoteFileSaveAsResult>;
  invokeDesktopTool(request: DesktopToolInvocationRequest): Promise<DesktopToolInvocationResult>;
  getArtifactPreviewUrl(path: string): Promise<string>;
  getPathForFile(file: unknown): string | undefined;
  openLocalPath(path: string): Promise<void>;
  openExternalUrl(url: string): Promise<void>;
  controlWindow(action: DesktopWindowControlAction): Promise<boolean>;
}

declare global {
  interface Window {
    qiuDesktop?: QiuDesktopBridge;
  }
}
