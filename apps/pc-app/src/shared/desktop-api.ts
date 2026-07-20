import type {
  DesktopRuntimeSnapshot,
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

export interface QiuDesktopBridge {
  getAppInfo(): Promise<DesktopAppInfo>;
  getRuntimeState(): Promise<DesktopRuntimeState>;
  checkServerConnection(): Promise<DesktopServerConnectionStatus>;
  saveRuntimeState(state: DesktopRuntimeState): Promise<void>;
  listWorkspaceBackups(): Promise<DesktopBackupSummary[]>;
  createWorkspaceBackup(state: DesktopRuntimeState): Promise<DesktopBackupSummary>;
  restoreWorkspaceBackup(bundlePath: string): Promise<DesktopBackupSummary>;
}

declare global {
  interface Window {
    qiuDesktop?: QiuDesktopBridge;
  }
}
