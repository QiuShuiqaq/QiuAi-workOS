import { ipcMain } from 'electron';
import {
  checkServerConnection,
  getDesktopAppInfo,
  getDesktopRuntimeState
} from './runtime-state.js';
import { saveDesktopRuntimeState } from './runtime-store.js';
import {
  createWorkspaceBackupBundle,
  listWorkspaceBackupBundles,
  restoreWorkspaceBackupBundle
} from './workspace-backup.js';

const channels = {
  getAppInfo: 'qiuai:desktop:get-app-info',
  getRuntimeState: 'qiuai:desktop:get-runtime-state',
  checkServerConnection: 'qiuai:desktop:check-server-connection',
  saveRuntimeState: 'qiuai:desktop:save-runtime-state',
  listWorkspaceBackups: 'qiuai:desktop:list-workspace-backups',
  createWorkspaceBackup: 'qiuai:desktop:create-workspace-backup',
  restoreWorkspaceBackup: 'qiuai:desktop:restore-workspace-backup'
} as const;

export function registerDesktopIpc() {
  ipcMain.handle(channels.getAppInfo, () => getDesktopAppInfo());
  ipcMain.handle(channels.getRuntimeState, () => getDesktopRuntimeState());
  ipcMain.handle(channels.checkServerConnection, () => checkServerConnection());
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
}
