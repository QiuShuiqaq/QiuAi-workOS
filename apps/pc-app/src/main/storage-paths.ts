import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
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
const legacyElectronAppDataFolderNames = ['qiuai-workos-pc-installer-app'];
const installerDataBackupFolderName = 'install-data-backup';
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

function migratePreviousDesktopConfiguration(
  input: {
    homeDir: string;
    appDataPath?: string;
  },
  storagePathInfo: DesktopStoragePathInfo
): void {
  const previousDataPath = findBestPreviousDesktopDataPath(input, storagePathInfo);
  if (!previousDataPath) {
    return;
  }

  const targetDataPath = path.resolve(storagePathInfo.dataPath);
  if (isSamePath(previousDataPath, targetDataPath)) {
    return;
  }

  const targetHasMeaningfulData = hasMeaningfulDesktopData(targetDataPath);
  const sourceHasAuthenticatedIdentity = hasAuthenticatedRuntimeIdentity(previousDataPath);
  if (
    targetHasMeaningfulData &&
    (hasAuthenticatedRuntimeIdentity(targetDataPath) || !sourceHasAuthenticatedIdentity)
  ) {
    return;
  }

  copyDesktopConfigurationData(previousDataPath, targetDataPath);
}

function findBestPreviousDesktopDataPath(
  input: {
    homeDir: string;
    appDataPath?: string;
  },
  storagePathInfo: DesktopStoragePathInfo
): string | undefined {
  const targetDataPath = path.resolve(storagePathInfo.dataPath);
  const candidates = collectPreviousDesktopDataPathCandidates(input, storagePathInfo)
    .map((candidatePath) => path.resolve(candidatePath))
    .filter((candidatePath, index, values) =>
      !isSamePath(candidatePath, targetDataPath) &&
      values.findIndex((value) => isSamePath(value, candidatePath)) === index &&
      hasMeaningfulDesktopData(candidatePath)
    );

  if (candidates.length === 0) {
    return undefined;
  }

  return candidates
    .map((candidatePath) => ({
      path: candidatePath,
      score: scorePreviousDesktopDataPath(candidatePath)
    }))
    .sort((left, right) => right.score - left.score)[0]?.path;
}

function collectPreviousDesktopDataPathCandidates(
  input: {
    homeDir: string;
    appDataPath?: string;
  },
  storagePathInfo: DesktopStoragePathInfo
): string[] {
  const roamingRoot = getRoamingDataRoot(input);
  const previousLocation = readStorageLocation(input);
  return [
    previousLocation?.dataPath,
    storagePathInfo.installPath ? path.join(storagePathInfo.installPath, 'data') : undefined,
    path.join(roamingRoot, appDataFolderName, installerDataBackupFolderName),
    ...legacyElectronAppDataFolderNames.map((folderName) => path.join(roamingRoot, folderName))
  ].filter((candidatePath): candidatePath is string => Boolean(candidatePath?.trim()));
}

function scorePreviousDesktopDataPath(dataPath: string): number {
  let score = 0;
  if (hasAuthenticatedRuntimeIdentity(dataPath)) {
    score += 1_000_000;
  }

  const latestTimestamp = readLatestDesktopDataTimestamp(dataPath);
  if (latestTimestamp > 0) {
    score += Math.floor(latestTimestamp / 1_000);
  }

  return score;
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

  if (hasAuthenticatedRuntimeIdentity(sourceRoot) && !hasAuthenticatedRuntimeIdentity(targetRoot)) {
    copyFileSync(path.join(sourceRoot, 'runtime-identity.json'), path.join(targetRoot, 'runtime-identity.json'));
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

function hasAuthenticatedRuntimeIdentity(dataPath: string): boolean {
  try {
    const parsed = JSON.parse(readFileSync(path.join(dataPath, 'runtime-identity.json'), 'utf8')) as {
      deviceToken?: unknown;
      workspaceId?: unknown;
    };
    return typeof parsed.deviceToken === 'string' &&
      parsed.deviceToken.trim().length > 0 &&
      typeof parsed.workspaceId === 'string' &&
      parsed.workspaceId.trim().length > 0 &&
      parsed.workspaceId !== 'workspace_pending_login';
  } catch {
    return false;
  }
}

function readLatestDesktopDataTimestamp(dataPath: string): number {
  if (!existsSync(dataPath)) {
    return 0;
  }

  try {
    let latestTimestamp = statSync(dataPath).mtimeMs;
    for (const entryName of preservedRootEntries) {
      const entryPath = path.join(dataPath, entryName);
      if (existsSync(entryPath)) {
        latestTimestamp = Math.max(latestTimestamp, statSync(entryPath).mtimeMs);
      }
    }
    return latestTimestamp;
  } catch {
    return 0;
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
