import type {
  DesktopAppInfo,
  DesktopAgreementAcceptRequest,
  DesktopAgreementStatus,
  DesktopIssueReportSubmitRequest,
  DesktopIssueReportSubmitResult,
  DesktopBackupSummary,
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopKnowledgeSourcePathResult,
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopModelListRequest,
  DesktopModelListResponse,
  DesktopModelTestRequest,
  DesktopModelTestResponse,
  DesktopRuntimeState,
  DesktopRuntimeSyncResponse,
  DesktopServerConnectionStatus,
  DesktopUpdateDownloadProgress,
  DesktopUpdateDownloadResult,
  DesktopArtifactSaveAsRequest,
  DesktopArtifactSaveAsResult,
  DesktopAiPointOverview,
  DesktopLocalFileExportRequest,
  DesktopLocalFileExportResult,
  DesktopRemoteFileSaveAsRequest,
  DesktopRemoteFileSaveAsResult,
  DesktopTaskArtifactWriteRequest,
  DesktopTaskArtifactWriteResult,
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult,
  DesktopUpdateCheckResult,
  DesktopUpdateInstallResult,
  DesktopUpdateLaunchRequest,
  DesktopUpdateLaunchResult,
  DesktopWindowControlAction,
  QiuDesktopBridge
} from '../shared/desktop-api.js';
import type { KnowledgeBindingSource } from '../shared/desktop-contract.js';

const { contextBridge, ipcRenderer, webUtils } = require('electron') as typeof import('electron');

const channels = {
  getAppInfo: 'qiuai:desktop:get-app-info',
  getRuntimeState: 'qiuai:desktop:get-runtime-state',
  getUserAgreementStatus: 'qiuai:desktop:get-user-agreement-status',
  acceptUserAgreement: 'qiuai:desktop:accept-user-agreement',
  submitIssueReport: 'qiuai:desktop:submit-issue-report',
  bindDesktopDevice: 'qiuai:desktop:bind-desktop-device',
  unbindDesktopDevice: 'qiuai:desktop:unbind-desktop-device',
  checkServerConnection: 'qiuai:desktop:check-server-connection',
  checkForUpdates: 'qiuai:desktop:check-for-updates',
  downloadDesktopUpdate: 'qiuai:desktop:download-desktop-update',
  installDesktopUpdate: 'qiuai:desktop:install-desktop-update',
  downloadAndInstallUpdate: 'qiuai:desktop:download-and-install-update',
  updateDownloadProgress: 'qiuai:desktop:update-download-progress',
  listAuthorizedRoleTemplates: 'qiuai:desktop:list-authorized-role-templates',
  syncRuntimeState: 'qiuai:desktop:sync-runtime-state',
  getAiPointOverview: 'qiuai:desktop:get-ai-point-overview',
  saveRuntimeState: 'qiuai:desktop:save-runtime-state',
  listWorkspaceBackups: 'qiuai:desktop:list-workspace-backups',
  createWorkspaceBackup: 'qiuai:desktop:create-workspace-backup',
  restoreWorkspaceBackup: 'qiuai:desktop:restore-workspace-backup',
  invokeModelChat: 'qiuai:desktop:invoke-model-chat',
  testModelConnection: 'qiuai:desktop:test-model-connection',
  listProviderModels: 'qiuai:desktop:list-provider-models',
  selectKnowledgeSourcePath: 'qiuai:desktop:select-knowledge-source-path',
  writeTaskArtifact: 'qiuai:desktop:write-task-artifact',
  saveArtifactAs: 'qiuai:desktop:save-artifact-as',
  exportLocalFiles: 'qiuai:desktop:export-local-files',
  saveRemoteFileAs: 'qiuai:desktop:save-remote-file-as',
  invokeDesktopTool: 'qiuai:desktop:invoke-desktop-tool',
  getArtifactPreviewUrl: 'qiuai:desktop:get-artifact-preview-url',
  openLocalPath: 'qiuai:desktop:open-local-path',
  openExternalUrl: 'qiuai:desktop:open-external-url',
  controlWindow: 'qiuai:desktop:control-window'
} as const;

const bridge: QiuDesktopBridge = {
  getAppInfo: () => ipcRenderer.invoke(channels.getAppInfo) as Promise<DesktopAppInfo>,
  getRuntimeState: () => ipcRenderer.invoke(channels.getRuntimeState) as Promise<DesktopRuntimeState>,
  getUserAgreementStatus: () =>
    ipcRenderer.invoke(channels.getUserAgreementStatus) as Promise<DesktopAgreementStatus>,
  acceptUserAgreement: (request: DesktopAgreementAcceptRequest) =>
    ipcRenderer.invoke(channels.acceptUserAgreement, request) as Promise<DesktopAgreementStatus>,
  submitIssueReport: (request: DesktopIssueReportSubmitRequest) =>
    ipcRenderer.invoke(channels.submitIssueReport, request) as Promise<DesktopIssueReportSubmitResult>,
  bindDesktopDevice: (bindingCode: string) =>
    ipcRenderer.invoke(channels.bindDesktopDevice, bindingCode) as Promise<DesktopRuntimeState>,
  unbindDesktopDevice: () =>
    ipcRenderer.invoke(channels.unbindDesktopDevice) as Promise<DesktopRuntimeState>,
  checkServerConnection: () =>
    ipcRenderer.invoke(channels.checkServerConnection) as Promise<DesktopServerConnectionStatus>,
  checkForUpdates: () =>
    ipcRenderer.invoke(channels.checkForUpdates) as Promise<DesktopUpdateCheckResult>,
  downloadDesktopUpdate: () =>
    ipcRenderer.invoke(channels.downloadDesktopUpdate) as Promise<DesktopUpdateDownloadResult>,
  installDesktopUpdate: (request: DesktopUpdateLaunchRequest) =>
    ipcRenderer.invoke(channels.installDesktopUpdate, request) as Promise<DesktopUpdateLaunchResult>,
  downloadAndInstallUpdate: () =>
    ipcRenderer.invoke(channels.downloadAndInstallUpdate) as Promise<DesktopUpdateInstallResult>,
  onUpdateDownloadProgress: (listener: (progress: DesktopUpdateDownloadProgress) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: DesktopUpdateDownloadProgress) => {
      listener(progress);
    };
    ipcRenderer.on(channels.updateDownloadProgress, handler);
    return () => ipcRenderer.removeListener(channels.updateDownloadProgress, handler);
  },
  listAuthorizedRoleTemplates: () =>
    ipcRenderer.invoke(channels.listAuthorizedRoleTemplates) as Promise<DesktopAuthorizedRoleTemplateCatalog>,
  syncRuntimeState: (state: DesktopRuntimeState) =>
    ipcRenderer.invoke(channels.syncRuntimeState, state) as Promise<DesktopRuntimeSyncResponse>,
  getAiPointOverview: () =>
    ipcRenderer.invoke(channels.getAiPointOverview) as Promise<DesktopAiPointOverview>,
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
  testModelConnection: (request: DesktopModelTestRequest) =>
    ipcRenderer.invoke(channels.testModelConnection, request) as Promise<DesktopModelTestResponse>,
  listProviderModels: (request: DesktopModelListRequest) =>
    ipcRenderer.invoke(channels.listProviderModels, request) as Promise<DesktopModelListResponse>,
  selectKnowledgeSourcePath: (source: KnowledgeBindingSource) =>
    ipcRenderer.invoke(channels.selectKnowledgeSourcePath, source) as Promise<DesktopKnowledgeSourcePathResult>,
  writeTaskArtifact: (request: DesktopTaskArtifactWriteRequest) =>
    ipcRenderer.invoke(channels.writeTaskArtifact, request) as Promise<DesktopTaskArtifactWriteResult>,
  saveArtifactAs: (request: DesktopArtifactSaveAsRequest) =>
    ipcRenderer.invoke(channels.saveArtifactAs, request) as Promise<DesktopArtifactSaveAsResult>,
  exportLocalFiles: (request: DesktopLocalFileExportRequest) =>
    ipcRenderer.invoke(channels.exportLocalFiles, request) as Promise<DesktopLocalFileExportResult>,
  saveRemoteFileAs: (request: DesktopRemoteFileSaveAsRequest) =>
    ipcRenderer.invoke(channels.saveRemoteFileAs, request) as Promise<DesktopRemoteFileSaveAsResult>,
  invokeDesktopTool: (request: DesktopToolInvocationRequest) =>
    ipcRenderer.invoke(channels.invokeDesktopTool, request) as Promise<DesktopToolInvocationResult>,
  getArtifactPreviewUrl: (path: string) =>
    ipcRenderer.invoke(channels.getArtifactPreviewUrl, path) as Promise<string>,
  getPathForFile: (file: unknown) => {
    try {
      const path = webUtils.getPathForFile(file as Parameters<typeof webUtils.getPathForFile>[0]);
      return path.trim() ? path : undefined;
    } catch {
      return undefined;
    }
  },
  openLocalPath: (path: string) =>
    ipcRenderer.invoke(channels.openLocalPath, path) as Promise<void>,
  openExternalUrl: (url: string) =>
    ipcRenderer.invoke(channels.openExternalUrl, url) as Promise<void>,
  controlWindow: (action: DesktopWindowControlAction) =>
    ipcRenderer.invoke(channels.controlWindow, action) as Promise<boolean>
};

contextBridge.exposeInMainWorld('qiuDesktop', bridge);
