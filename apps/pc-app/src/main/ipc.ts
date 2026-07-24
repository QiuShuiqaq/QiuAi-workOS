import * as electron from 'electron';
import {
  bindDesktopDevice,
  checkServerConnection,
  getDesktopAppInfo,
  getDesktopRuntimeState,
  listAuthorizedRoleTemplates,
  syncDesktopRuntimeState
} from './runtime-state.js';
import { saveDesktopRuntimeState } from './runtime-store.js';
import { invokeOpenAiCompatibleModelChat } from './model-chat.js';
import { selectKnowledgeSourcePath } from './knowledge-source.js';
import { writeTaskArtifactFile } from './artifact-store.js';
import { invokeDesktopTool } from './desktop-tool.js';
import {
  createWorkspaceBackupBundle,
  listWorkspaceBackupBundles,
  restoreWorkspaceBackupBundle
} from './workspace-backup.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { BrowserWindow, ipcMain, shell } = electronApi;

const channels = {
  getAppInfo: 'qiuai:desktop:get-app-info',
  getRuntimeState: 'qiuai:desktop:get-runtime-state',
  bindDesktopDevice: 'qiuai:desktop:bind-desktop-device',
  checkServerConnection: 'qiuai:desktop:check-server-connection',
  listAuthorizedRoleTemplates: 'qiuai:desktop:list-authorized-role-templates',
  syncRuntimeState: 'qiuai:desktop:sync-runtime-state',
  saveRuntimeState: 'qiuai:desktop:save-runtime-state',
  listWorkspaceBackups: 'qiuai:desktop:list-workspace-backups',
  createWorkspaceBackup: 'qiuai:desktop:create-workspace-backup',
  restoreWorkspaceBackup: 'qiuai:desktop:restore-workspace-backup',
  invokeModelChat: 'qiuai:desktop:invoke-model-chat',
  selectKnowledgeSourcePath: 'qiuai:desktop:select-knowledge-source-path',
  writeTaskArtifact: 'qiuai:desktop:write-task-artifact',
  invokeDesktopTool: 'qiuai:desktop:invoke-desktop-tool',
  openLocalPath: 'qiuai:desktop:open-local-path',
  controlWindow: 'qiuai:desktop:control-window'
} as const;

export function registerDesktopIpc() {
  ipcMain.handle(channels.getAppInfo, () => getDesktopAppInfo());
  ipcMain.handle(channels.getRuntimeState, () => getDesktopRuntimeState());
  ipcMain.handle(channels.bindDesktopDevice, async (_, bindingCode: string) => {
    return bindDesktopDevice(bindingCode);
  });
  ipcMain.handle(channels.checkServerConnection, () => checkServerConnection());
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
  ipcMain.handle(channels.selectKnowledgeSourcePath, async (_, source) => {
    return selectKnowledgeSourcePath(source);
  });
  ipcMain.handle(channels.writeTaskArtifact, async (_, request) => {
    return writeTaskArtifactFile(getDesktopAppInfo().userDataPath, request);
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
}
