import type {
  DesktopAppInfo,
  DesktopBackupSummary,
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopKnowledgeSourcePathResult,
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopModelListRequest,
  DesktopModelListResponse,
  DesktopRuntimeState,
  DesktopRuntimeSyncResponse,
  DesktopServerConnectionStatus,
  DesktopArtifactSaveAsRequest,
  DesktopArtifactSaveAsResult,
  DesktopTaskArtifactWriteRequest,
  DesktopTaskArtifactWriteResult,
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult,
  DesktopUpdateCheckResult,
  DesktopWindowControlAction,
  QiuDesktopBridge
} from '../shared/desktop-api.js';
import type { KnowledgeBindingSource } from '../shared/desktop-contract.js';

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

const channels = {
  getAppInfo: 'qiuai:desktop:get-app-info',
  getRuntimeState: 'qiuai:desktop:get-runtime-state',
  bindDesktopDevice: 'qiuai:desktop:bind-desktop-device',
  unbindDesktopDevice: 'qiuai:desktop:unbind-desktop-device',
  checkServerConnection: 'qiuai:desktop:check-server-connection',
  checkForUpdates: 'qiuai:desktop:check-for-updates',
  listAuthorizedRoleTemplates: 'qiuai:desktop:list-authorized-role-templates',
  syncRuntimeState: 'qiuai:desktop:sync-runtime-state',
  saveRuntimeState: 'qiuai:desktop:save-runtime-state',
  listWorkspaceBackups: 'qiuai:desktop:list-workspace-backups',
  createWorkspaceBackup: 'qiuai:desktop:create-workspace-backup',
  restoreWorkspaceBackup: 'qiuai:desktop:restore-workspace-backup',
  invokeModelChat: 'qiuai:desktop:invoke-model-chat',
  listProviderModels: 'qiuai:desktop:list-provider-models',
  selectKnowledgeSourcePath: 'qiuai:desktop:select-knowledge-source-path',
  writeTaskArtifact: 'qiuai:desktop:write-task-artifact',
  saveArtifactAs: 'qiuai:desktop:save-artifact-as',
  invokeDesktopTool: 'qiuai:desktop:invoke-desktop-tool',
  openLocalPath: 'qiuai:desktop:open-local-path',
  openExternalUrl: 'qiuai:desktop:open-external-url',
  controlWindow: 'qiuai:desktop:control-window'
} as const;

const bridge: QiuDesktopBridge = {
  getAppInfo: () => ipcRenderer.invoke(channels.getAppInfo) as Promise<DesktopAppInfo>,
  getRuntimeState: () => ipcRenderer.invoke(channels.getRuntimeState) as Promise<DesktopRuntimeState>,
  bindDesktopDevice: (bindingCode: string) =>
    ipcRenderer.invoke(channels.bindDesktopDevice, bindingCode) as Promise<DesktopRuntimeState>,
  unbindDesktopDevice: () =>
    ipcRenderer.invoke(channels.unbindDesktopDevice) as Promise<DesktopRuntimeState>,
  checkServerConnection: () =>
    ipcRenderer.invoke(channels.checkServerConnection) as Promise<DesktopServerConnectionStatus>,
  checkForUpdates: () =>
    ipcRenderer.invoke(channels.checkForUpdates) as Promise<DesktopUpdateCheckResult>,
  listAuthorizedRoleTemplates: () =>
    ipcRenderer.invoke(channels.listAuthorizedRoleTemplates) as Promise<DesktopAuthorizedRoleTemplateCatalog>,
  syncRuntimeState: (state: DesktopRuntimeState) =>
    ipcRenderer.invoke(channels.syncRuntimeState, state) as Promise<DesktopRuntimeSyncResponse>,
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
  listProviderModels: (request: DesktopModelListRequest) =>
    ipcRenderer.invoke(channels.listProviderModels, request) as Promise<DesktopModelListResponse>,
  selectKnowledgeSourcePath: (source: KnowledgeBindingSource) =>
    ipcRenderer.invoke(channels.selectKnowledgeSourcePath, source) as Promise<DesktopKnowledgeSourcePathResult>,
  writeTaskArtifact: (request: DesktopTaskArtifactWriteRequest) =>
    ipcRenderer.invoke(channels.writeTaskArtifact, request) as Promise<DesktopTaskArtifactWriteResult>,
  saveArtifactAs: (request: DesktopArtifactSaveAsRequest) =>
    ipcRenderer.invoke(channels.saveArtifactAs, request) as Promise<DesktopArtifactSaveAsResult>,
  invokeDesktopTool: (request: DesktopToolInvocationRequest) =>
    ipcRenderer.invoke(channels.invokeDesktopTool, request) as Promise<DesktopToolInvocationResult>,
  openLocalPath: (path: string) =>
    ipcRenderer.invoke(channels.openLocalPath, path) as Promise<void>,
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke(channels.openExternalUrl, url) as Promise<void>,
  controlWindow: (action: DesktopWindowControlAction) =>
    ipcRenderer.invoke(channels.controlWindow, action) as Promise<boolean>
};

contextBridge.exposeInMainWorld('qiuDesktop', bridge);
