import {
  closeSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

export type DesktopStorageMode = 'follow_install_dir' | 'fallback_user_dir';

export interface DesktopStoragePathInfo {
  installPath?: string;
  dataPath: string;
  storageMode: DesktopStorageMode;
}

const appDataFolderName = 'QiuAI WorkOS';
const storageLocationFileName = 'storage-location.json';
const preservedRootEntries = [
  'runtime-identity.json',
  'runtime-state.json',
  'agreement-acceptances.json',
  'Local Storage',
  'Session Storage',
  'IndexedDB'
];
const preservedWorkspaceEntries = ['state', 'db', 'secrets'];

interface StoredStorageLocation {
  schemaVersion: 1;
  dataPath: string;
  installPath?: string;
  updatedAt: string;
}

export function resolveDesktopStoragePathInfo(input: {
  isPackaged: boolean;
  processExecPath: string;
  homeDir: string;
  appDataPath?: string;
}): DesktopStoragePathInfo {
  if (!input.isPackaged) {
    const devDataPath = process.env.QIUAI_PC_DEV_USER_DATA_DIR?.trim();

    return {
      dataPath: devDataPath ? path.resolve(devDataPath) : path.resolve(process.cwd(), '.local', 'user-data'),
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

export function prepareDesktopStoragePathInfo(input: {
  isPackaged: boolean;
  processExecPath: string;
  homeDir: string;
  appDataPath?: string;
}): DesktopStoragePathInfo {
  const storagePathInfo = resolveDesktopStoragePathInfo(input);

  if (!input.isPackaged) {
    return storagePathInfo;
  }

  try {
    migratePreviousDesktopConfiguration(input, storagePathInfo);
  } catch {
    // Storage migration is best-effort and must never block desktop startup.
  }

  try {
    writeStorageLocation(input, storagePathInfo);
  } catch {
    // The app can still run without the upgrade pointer.
  }

  return storagePathInfo;
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

function migratePreviousDesktopConfiguration(
  input: {
    homeDir: string;
    appDataPath?: string;
  },
  storagePathInfo: DesktopStoragePathInfo
): void {
  if (hasMeaningfulDesktopData(storagePathInfo.dataPath)) {
    return;
  }

  const previousLocation = readStorageLocation(input);
  if (!previousLocation || !previousLocation.dataPath.trim()) {
    return;
  }

  const previousDataPath = path.resolve(previousLocation.dataPath);
  const targetDataPath = path.resolve(storagePathInfo.dataPath);
  if (isSamePath(previousDataPath, targetDataPath) || !hasMeaningfulDesktopData(previousDataPath)) {
    return;
  }

  copyDesktopConfigurationData(previousDataPath, targetDataPath);
}

function hasMeaningfulDesktopData(dataPath: string): boolean {
  const resolvedDataPath = path.resolve(dataPath);
  return (
    existsSync(path.join(resolvedDataPath, 'runtime-identity.json')) ||
    existsSync(path.join(resolvedDataPath, 'runtime-state.json')) ||
    existsSync(path.join(resolvedDataPath, 'agreement-acceptances.json')) ||
    existsSync(path.join(resolvedDataPath, 'Local Storage')) ||
    hasWorkspaceState(resolvedDataPath)
  );
}

function hasWorkspaceState(dataPath: string): boolean {
  const workspacesPath = path.join(dataPath, 'workspaces');
  if (!existsSync(workspacesPath)) {
    return false;
  }

  try {
    return readdirSync(workspacesPath).some((workspaceName) => {
      const workspacePath = path.join(workspacesPath, workspaceName);
      if (!statSync(workspacePath).isDirectory()) {
        return false;
      }

      return preservedWorkspaceEntries.some((entryName) => existsSync(path.join(workspacePath, entryName)));
    });
  } catch {
    return false;
  }
}

function copyDesktopConfigurationData(sourceRoot: string, targetRoot: string): void {
  mkdirSync(targetRoot, { recursive: true });

  for (const entryName of preservedRootEntries) {
    copyPathIfMissing(path.join(sourceRoot, entryName), path.join(targetRoot, entryName));
  }

  const sourceWorkspacesPath = path.join(sourceRoot, 'workspaces');
  if (!existsSync(sourceWorkspacesPath)) {
    return;
  }

  for (const workspaceName of readdirSync(sourceWorkspacesPath)) {
    const sourceWorkspacePath = path.join(sourceWorkspacesPath, workspaceName);
    if (!statSync(sourceWorkspacePath).isDirectory()) {
      continue;
    }

    const targetWorkspacePath = path.join(targetRoot, 'workspaces', workspaceName);
    for (const entryName of preservedWorkspaceEntries) {
      copyPathIfMissing(path.join(sourceWorkspacePath, entryName), path.join(targetWorkspacePath, entryName));
    }
  }
}

function copyPathIfMissing(sourcePath: string, targetPath: string): boolean {
  if (!existsSync(sourcePath) || existsSync(targetPath)) {
    return false;
  }

  const sourceStat = statSync(sourcePath);
  if (sourceStat.isDirectory()) {
    mkdirSync(targetPath, { recursive: true });
    for (const childName of readdirSync(sourcePath)) {
      copyPathIfMissing(path.join(sourcePath, childName), path.join(targetPath, childName));
    }
    return true;
  }

  mkdirSync(path.dirname(targetPath), { recursive: true });
  copyFileSync(sourcePath, targetPath);
  return true;
}

function readStorageLocation(input: {
  homeDir: string;
  appDataPath?: string;
}): StoredStorageLocation | undefined {
  const filePath = getStorageLocationPath(input);
  if (!existsSync(filePath)) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as Partial<StoredStorageLocation>;
    if (parsed.schemaVersion === 1 && typeof parsed.dataPath === 'string' && typeof parsed.updatedAt === 'string') {
      return {
        schemaVersion: 1,
        dataPath: parsed.dataPath,
        installPath: typeof parsed.installPath === 'string' ? parsed.installPath : undefined,
        updatedAt: parsed.updatedAt
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function writeStorageLocation(
  input: {
    homeDir: string;
    appDataPath?: string;
  },
  storagePathInfo: DesktopStoragePathInfo
): void {
  const filePath = getStorageLocationPath(input);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(
    filePath,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        dataPath: path.resolve(storagePathInfo.dataPath),
        installPath: storagePathInfo.installPath ? path.resolve(storagePathInfo.installPath) : undefined,
        updatedAt: new Date().toISOString()
      } satisfies StoredStorageLocation,
      null,
      2
    )}\n`,
    { encoding: 'utf8' }
  );
}

function getStorageLocationPath(input: {
  homeDir: string;
  appDataPath?: string;
}): string {
  return path.join(getRoamingDataRoot(input), appDataFolderName, storageLocationFileName);
}

function getRoamingDataRoot(input: {
  homeDir: string;
  appDataPath?: string;
}): string {
  return input.appDataPath?.trim() || process.env.APPDATA?.trim() || path.join(input.homeDir, 'AppData', 'Roaming');
}

function isSamePath(left: string, right: string): boolean {
  const resolvedLeft = path.resolve(left);
  const resolvedRight = path.resolve(right);
  return process.platform === 'win32'
    ? resolvedLeft.toLowerCase() === resolvedRight.toLowerCase()
    : resolvedLeft === resolvedRight;
}
