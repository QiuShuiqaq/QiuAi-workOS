import type {
  DesktopAppInfo,
  DesktopBackupSummary,
  DesktopRuntimeState,
  DesktopServerConnectionStatus,
  QiuDesktopBridge
} from '../shared/desktop-api.js';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const channels = {
  getAppInfo: 'qiuai:desktop:get-app-info',
  getRuntimeState: 'qiuai:desktop:get-runtime-state',
  checkServerConnection: 'qiuai:desktop:check-server-connection',
  saveRuntimeState: 'qiuai:desktop:save-runtime-state',
  listWorkspaceBackups: 'qiuai:desktop:list-workspace-backups',
  createWorkspaceBackup: 'qiuai:desktop:create-workspace-backup',
  restoreWorkspaceBackup: 'qiuai:desktop:restore-workspace-backup'
} as const;

const bridge: QiuDesktopBridge = {
  getAppInfo: () => ipcRenderer.invoke(channels.getAppInfo) as Promise<DesktopAppInfo>,
  getRuntimeState: () => ipcRenderer.invoke(channels.getRuntimeState) as Promise<DesktopRuntimeState>,
  checkServerConnection: () =>
    ipcRenderer.invoke(channels.checkServerConnection) as Promise<DesktopServerConnectionStatus>,
  saveRuntimeState: (state: DesktopRuntimeState) =>
    ipcRenderer.invoke(channels.saveRuntimeState, state) as Promise<void>,
  listWorkspaceBackups: () =>
    ipcRenderer.invoke(channels.listWorkspaceBackups) as Promise<DesktopBackupSummary[]>,
  createWorkspaceBackup: (state: DesktopRuntimeState) =>
    ipcRenderer.invoke(channels.createWorkspaceBackup, state) as Promise<DesktopBackupSummary>,
  restoreWorkspaceBackup: (bundlePath: string) =>
    ipcRenderer.invoke(channels.restoreWorkspaceBackup, bundlePath) as Promise<DesktopBackupSummary>
};

contextBridge.exposeInMainWorld('qiuDesktop', bridge);
