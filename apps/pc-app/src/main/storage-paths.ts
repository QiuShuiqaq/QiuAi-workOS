import { mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import path from 'node:path';

export type DesktopStorageMode = 'follow_install_dir' | 'fallback_user_dir';

export interface DesktopStoragePathInfo {
  installPath?: string;
  dataPath: string;
  storageMode: DesktopStorageMode;
}

const appDataFolderName = 'QiuAI WorkOS';

export function resolveDesktopStoragePathInfo(input: {
  isPackaged: boolean;
  processExecPath: string;
  homeDir: string;
  appDataPath?: string;
}): DesktopStoragePathInfo {
  if (!input.isPackaged) {
    return {
      dataPath: path.resolve(process.cwd(), '.local', 'user-data'),
      storageMode: 'fallback_user_dir'
    };
  }

  const installPath = path.dirname(path.resolve(input.processExecPath));
  const preferredDataPath = path.join(installPath, 'data');
  if (isDirectoryWritable(preferredDataPath)) {
    return {
      installPath,
      dataPath: preferredDataPath,
      storageMode: 'follow_install_dir'
    };
  }

  const roamingRoot = input.appDataPath?.trim() || process.env.APPDATA?.trim() || path.join(input.homeDir, 'AppData', 'Roaming');

  return {
    installPath,
    dataPath: path.join(roamingRoot, appDataFolderName),
    storageMode: 'fallback_user_dir'
  };
}

function isDirectoryWritable(directoryPath: string): boolean {
  try {
    mkdirSync(directoryPath, { recursive: true });
    const probePath = path.join(directoryPath, `.write-test-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`);
    const fd = openSync(probePath, 'w');
    closeSync(fd);
    unlinkSync(probePath);
    return true;
  } catch {
    return false;
  }
}
