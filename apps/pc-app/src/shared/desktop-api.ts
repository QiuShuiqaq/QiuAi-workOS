import type {
  DesktopRuntimeSnapshot,
  DesktopArtifactSummary,
  DesktopKnowledgeSourceSummary,
  KnowledgeBindingSource,
  LocalRuntimeContract,
  ModelProfile,
  RolePackageManifest,
  ToolManifest,
  DesktopTaskDetail
} from './desktop-contract.js';

export type DesktopConnectionState = 'unchecked' | 'online' | 'offline';

export interface DesktopAppInfo {
  appName: string;
  appVersion: string;
  platform: NodeJS.Platform;
  arch: string;
  deviceName: string;
  userDataPath: string;
  serverBaseUrl: string;
  isPackaged: boolean;
}

export interface DesktopServerConnectionStatus {
  state: DesktopConnectionState;
  serverBaseUrl: string;
  checkedAt: string;
  latencyMs?: number;
  service?: string;
  message?: string;
}

export interface DesktopRuntimeState {
  app: DesktopAppInfo;
  localRuntime: LocalRuntimeContract;
  runtimeSnapshot: DesktopRuntimeSnapshot;
  rolePackages: RolePackageManifest[];
  modelProfiles: ModelProfile[];
  tools: ToolManifest[];
  knowledgeSources: DesktopKnowledgeSourceSummary[];
  taskDetails?: DesktopTaskDetail[];
  serverConnection: DesktopServerConnectionStatus;
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
}

export interface DesktopModelChatResponse {
  provider: string;
  modelName: string;
  content: string;
  inputTokens?: number;
  outputTokens?: number;
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

export type DesktopToolInvocationAction =
  | 'filesystem.write_text_file'
  | 'filesystem.read_text_file'
  | 'filesystem.list_directory';

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

export interface QiuDesktopBridge {
  getAppInfo(): Promise<DesktopAppInfo>;
  getRuntimeState(): Promise<DesktopRuntimeState>;
  checkServerConnection(): Promise<DesktopServerConnectionStatus>;
  saveRuntimeState(state: DesktopRuntimeState): Promise<void>;
  listWorkspaceBackups(): Promise<DesktopBackupSummary[]>;
  createWorkspaceBackup(state: DesktopRuntimeState): Promise<DesktopBackupSummary>;
  restoreWorkspaceBackup(bundlePath: string): Promise<DesktopBackupSummary>;
  invokeModelChat(request: DesktopModelChatRequest): Promise<DesktopModelChatResponse>;
  selectKnowledgeSourcePath(source: KnowledgeBindingSource): Promise<DesktopKnowledgeSourcePathResult>;
  writeTaskArtifact(request: DesktopTaskArtifactWriteRequest): Promise<DesktopTaskArtifactWriteResult>;
  invokeDesktopTool(request: DesktopToolInvocationRequest): Promise<DesktopToolInvocationResult>;
  openLocalPath(path: string): Promise<void>;
}

declare global {
  interface Window {
    qiuDesktop?: QiuDesktopBridge;
  }
}
