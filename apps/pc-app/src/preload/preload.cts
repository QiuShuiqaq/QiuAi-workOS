import type {
  DesktopAppInfo,
  DesktopBackupSummary,
  DesktopKnowledgeSourcePathResult,
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopRuntimeState,
  DesktopServerConnectionStatus,
  DesktopTaskArtifactWriteRequest,
  DesktopTaskArtifactWriteResult,
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult,
  QiuDesktopBridge
} from '../shared/desktop-api.js';
import type { KnowledgeBindingSource } from '../shared/desktop-contract.js';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const channels = {
  getAppInfo: 'qiuai:desktop:get-app-info',
  getRuntimeState: 'qiuai:desktop:get-runtime-state',
  checkServerConnection: 'qiuai:desktop:check-server-connection',
  saveRuntimeState: 'qiuai:desktop:save-runtime-state',
  listWorkspaceBackups: 'qiuai:desktop:list-workspace-backups',
  createWorkspaceBackup: 'qiuai:desktop:create-workspace-backup',
  restoreWorkspaceBackup: 'qiuai:desktop:restore-workspace-backup',
  invokeModelChat: 'qiuai:desktop:invoke-model-chat',
  selectKnowledgeSourcePath: 'qiuai:desktop:select-knowledge-source-path',
  writeTaskArtifact: 'qiuai:desktop:write-task-artifact',
  invokeDesktopTool: 'qiuai:desktop:invoke-desktop-tool',
  openLocalPath: 'qiuai:desktop:open-local-path'
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
    ipcRenderer.invoke(channels.restoreWorkspaceBackup, bundlePath) as Promise<DesktopBackupSummary>,
  invokeModelChat: (request: DesktopModelChatRequest) =>
    ipcRenderer.invoke(channels.invokeModelChat, request) as Promise<DesktopModelChatResponse>,
  selectKnowledgeSourcePath: (source: KnowledgeBindingSource) =>
    ipcRenderer.invoke(channels.selectKnowledgeSourcePath, source) as Promise<DesktopKnowledgeSourcePathResult>,
  writeTaskArtifact: (request: DesktopTaskArtifactWriteRequest) =>
    ipcRenderer.invoke(channels.writeTaskArtifact, request) as Promise<DesktopTaskArtifactWriteResult>,
  invokeDesktopTool: (request: DesktopToolInvocationRequest) =>
    ipcRenderer.invoke(channels.invokeDesktopTool, request) as Promise<DesktopToolInvocationResult>,
  openLocalPath: (path: string) =>
    ipcRenderer.invoke(channels.openLocalPath, path) as Promise<void>
};

contextBridge.exposeInMainWorld('qiuDesktop', bridge);
