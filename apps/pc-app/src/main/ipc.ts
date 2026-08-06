import * as electron from 'electron';
import path from 'node:path';
import {
  bindDesktopDevice,
  checkForDesktopUpdates,
  checkServerConnection,
  getDesktopAppInfo,
  getDesktopRuntimeState,
  listAuthorizedRoleTemplates,
  submitDesktopIssueReportFromRenderer,
  syncDesktopRuntimeState,
  unbindDesktopDevice
} from './runtime-state.js';
import {
  downloadAndInstallDesktopUpdate,
  downloadDesktopUpdateInstaller,
  installDownloadedDesktopUpdate
} from './update-installer.js';
import {
  acceptUserAgreement,
  getUserAgreementStatus
} from './agreement-state.js';
import { saveDesktopRuntimeState } from './runtime-store.js';
import {
  invokeOpenAiCompatibleModelChat,
  listOpenAiCompatibleModels,
  testDesktopModelConnection
} from './model-chat.js';
import { selectKnowledgeSourcePath } from './knowledge-source.js';
import {
  cleanupExpiredArtifactCache,
  exportLocalFilesToDirectory,
  saveArtifactFileAs,
  saveRemoteFileAs,
  writeTaskArtifactFile
} from './artifact-store.js';
import { invokeDesktopTool } from './desktop-tool.js';
import {
  createWorkspaceBackupBundle,
  listWorkspaceBackupBundles,
  restoreWorkspaceBackupBundle
} from './workspace-backup.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { BrowserWindow, dialog, ipcMain, shell, app } = electronApi;

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
  openLocalPath: 'qiuai:desktop:open-local-path',
  openExternalUrl: 'qiuai:desktop:open-external-url',
  controlWindow: 'qiuai:desktop:control-window'
} as const;

export function registerDesktopIpc() {
  ipcMain.handle(channels.getAppInfo, () => getDesktopAppInfo());
  ipcMain.handle(channels.getRuntimeState, () => getDesktopRuntimeState());
  ipcMain.handle(channels.getUserAgreementStatus, () => getUserAgreementStatus());
  ipcMain.handle(channels.acceptUserAgreement, async (_, request) => {
    return acceptUserAgreement(request);
  });
  ipcMain.handle(channels.submitIssueReport, async (_, request) => {
    return submitDesktopIssueReportFromRenderer(request);
  });
  ipcMain.handle(channels.bindDesktopDevice, async (_, bindingCode: string) => {
    return bindDesktopDevice(bindingCode);
  });
  ipcMain.handle(channels.unbindDesktopDevice, () => unbindDesktopDevice());
  ipcMain.handle(channels.checkServerConnection, () => checkServerConnection());
  ipcMain.handle(channels.checkForUpdates, () => checkForDesktopUpdates());
  ipcMain.handle(channels.downloadDesktopUpdate, (event) =>
    downloadDesktopUpdateInstaller((progress) => {
      event.sender.send(channels.updateDownloadProgress, progress);
    })
  );
  ipcMain.handle(channels.installDesktopUpdate, async (_, request) => installDownloadedDesktopUpdate(request));
  ipcMain.handle(channels.downloadAndInstallUpdate, () => downloadAndInstallDesktopUpdate());
  ipcMain.handle(channels.listAuthorizedRoleTemplates, () => listAuthorizedRoleTemplates());
  ipcMain.handle(channels.syncRuntimeState, async (_, state) => {
    return syncDesktopRuntimeState(state);
  });
  ipcMain.handle(channels.saveRuntimeState, async (_, state) => {
    await saveDesktopRuntimeState(getDesktopAppInfo().userDataPath, state);
    return true;
  });
  ipcMain.handle(channels.listWorkspaceBackups, async () => {
    const runtimeState = await getDesktopRuntimeState();
    return listWorkspaceBackupBundles(
      getDesktopAppInfo().userDataPath,
      runtimeState.localRuntime.workspaceId
    );
  });
  ipcMain.handle(channels.createWorkspaceBackup, async (_, state) => {
    return createWorkspaceBackupBundle(state);
  });
  ipcMain.handle(channels.restoreWorkspaceBackup, async (_, bundlePath: string) => {
    return restoreWorkspaceBackupBundle(getDesktopAppInfo().userDataPath, bundlePath);
  });
  ipcMain.handle(channels.invokeModelChat, async (_, request) => {
    return invokeOpenAiCompatibleModelChat(request);
  });
  ipcMain.handle(channels.testModelConnection, async (_, request) => {
    return testDesktopModelConnection(request);
  });
  ipcMain.handle(channels.listProviderModels, async (_, request) => {
    return listOpenAiCompatibleModels(request);
  });
  ipcMain.handle(channels.selectKnowledgeSourcePath, async (_, source) => {
    return selectKnowledgeSourcePath(source);
  });
  ipcMain.handle(channels.writeTaskArtifact, async (_, request) => {
    return writeTaskArtifactFile(getDesktopAppInfo().userDataPath, request);
  });
  ipcMain.handle(channels.saveArtifactAs, async (event, request) => {
    const sourcePath = typeof request?.sourcePath === 'string' ? request.sourcePath.trim() : '';
    if (!sourcePath) {
      throw new Error('Artifact source path is required.');
    }

    const suggestedFileName = typeof request?.suggestedFileName === 'string' && request.suggestedFileName.trim()
      ? request.suggestedFileName.trim()
      : path.basename(sourcePath);
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    const saveDialogOptions = {
      title: '保存结果文件',
      defaultPath: path.join(getPreferredArtifactExportDirectoryPath(), suggestedFileName),
      buttonLabel: '保存'
    };
    saveDialogOptions.title = '保存结果文件';
    saveDialogOptions.buttonLabel = '保存';
    const result = currentWindow
      ? await dialog.showSaveDialog(currentWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    return saveArtifactFileAs({ sourcePath, suggestedFileName }, result.filePath);
  });
  ipcMain.handle(channels.exportLocalFiles, async (_, request) => {
    const files = Array.isArray(request?.files) ? request.files : [];
    if (files.length === 0) {
      throw new Error('At least one local file is required.');
    }

    const result = await dialog.showOpenDialog({
      title: '选择导出文件夹',
      properties: ['openDirectory'],
      buttonLabel: '导出到这里'
    });

    if (result.canceled || !result.filePaths[0]) {
      return {
        canceled: true,
        exportedFiles: []
      };
    }

    return exportLocalFilesToDirectory(request, result.filePaths[0]);
  });
  ipcMain.handle(channels.saveRemoteFileAs, async (event, request) => {
    const remoteUrl = typeof request?.url === 'string' ? request.url.trim() : '';
    if (!remoteUrl) {
      throw new Error('Remote file URL is required.');
    }

    const suggestedFileName = typeof request?.suggestedFileName === 'string' && request.suggestedFileName.trim()
      ? request.suggestedFileName.trim()
      : getRemoteFileNameFromUrl(remoteUrl);
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    const saveDialogOptions = {
      title: '保存图片',
      defaultPath: path.join(getPreferredArtifactExportDirectoryPath(), suggestedFileName),
      buttonLabel: '保存'
    };
    const result = currentWindow
      ? await dialog.showSaveDialog(currentWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    return saveRemoteFileAs({ url: remoteUrl, suggestedFileName }, result.filePath);
  });
  ipcMain.handle(channels.invokeDesktopTool, async (_, request) => {
    return invokeDesktopTool(getDesktopAppInfo().userDataPath, request);
  });
  ipcMain.handle(channels.openLocalPath, async (_, targetPath: string) => {
    const normalizedPath = typeof targetPath === 'string' ? targetPath.trim() : '';
    if (!normalizedPath) {
      throw new Error('Local path is required.');
    }

    const errorMessage = await shell.openPath(normalizedPath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }
  });
  ipcMain.handle(channels.openExternalUrl, async (_, targetUrl: string) => {
    const normalizedUrl = typeof targetUrl === 'string' ? targetUrl.trim() : '';
    if (!normalizedUrl) {
      throw new Error('URL is required.');
    }

    const url = new URL(normalizedUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Only HTTP and HTTPS URLs can be opened.');
    }

    await shell.openExternal(url.toString());
  });
  ipcMain.handle(channels.controlWindow, (event, action: string) => {
    const currentWindow = BrowserWindow.fromWebContents(event.sender);
    if (!currentWindow) {
      return false;
    }

    if (action === 'minimize') {
      currentWindow.minimize();
      return true;
    }

    if (action === 'toggle-maximize') {
      if (currentWindow.isMaximized()) {
        currentWindow.unmaximize();
      } else {
        currentWindow.maximize();
      }
      return true;
    }

    if (action === 'close') {
      currentWindow.close();
      return true;
    }

    throw new Error(`Unsupported window action: ${action}`);
  });

  cleanupLocalArtifactCache();
}

function cleanupLocalArtifactCache(): void {
  try {
    cleanupExpiredArtifactCache(getDesktopAppInfo().userDataPath);
  } catch {
    // Cache cleanup must never block desktop startup.
  }
}

function getPreferredArtifactExportDirectoryPath(): string {
  try {
    return app.getPath('downloads');
  } catch {
    return process.cwd();
  }
}

function getRemoteFileNameFromUrl(remoteUrl: string): string {
  try {
    const url = new URL(remoteUrl);
    const fileName = decodeURIComponent(path.posix.basename(url.pathname));
    return fileName || 'qiuai-image.png';
  } catch {
    return 'qiuai-image.png';
  }
}
