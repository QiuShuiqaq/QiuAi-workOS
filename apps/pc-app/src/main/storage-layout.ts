import { mkdirSync } from 'node:fs';
import path from 'node:path';

export interface DesktopStorageLayout {
  rootPath: string;
  workspacesRootPath: string;
  workspaceId: string;
  workspaceFolderName: string;
  workspaceRootPath: string;
  statePath: string;
  dbPath: string;
  workspaceDatabasePath: string;
  assetsPath: string;
  indexesPath: string;
  logsPath: string;
  secretsPath: string;
  cachePath: string;
  backupsPath: string;
  workspaceProfilePath: string;
  workspaceCatalogPath: string;
  workspaceRuntimePath: string;
  runtimeStatePath: string;
  legacyRuntimeStatePath: string;
  runtimeIdentityPath: string;
}

const defaultWorkspaceId = 'workspace_pending_login';

export function getDesktopStorageLayout(userDataPath: string, workspaceId?: string): DesktopStorageLayout {
  const normalizedWorkspaceId = normalizeWorkspaceId(workspaceId);
  const workspaceFolderName = normalizePathSegment(normalizedWorkspaceId);
  const rootPath = path.resolve(userDataPath);
  const workspacesRootPath = path.join(rootPath, 'workspaces');
  const workspaceRootPath = path.join(workspacesRootPath, workspaceFolderName);
  const statePath = path.join(workspaceRootPath, 'state');
  const dbPath = path.join(workspaceRootPath, 'db');
  const assetsPath = path.join(workspaceRootPath, 'assets');
  const indexesPath = path.join(workspaceRootPath, 'indexes');
  const logsPath = path.join(workspaceRootPath, 'logs');
  const secretsPath = path.join(workspaceRootPath, 'secrets');
  const cachePath = path.join(workspaceRootPath, 'cache');
  const backupsPath = path.join(workspaceRootPath, 'backups');

  return {
    rootPath,
    workspacesRootPath,
    workspaceId: normalizedWorkspaceId,
    workspaceFolderName,
    workspaceRootPath,
    statePath,
    dbPath,
    workspaceDatabasePath: path.join(dbPath, 'workbench.sqlite'),
    assetsPath,
    indexesPath,
    logsPath,
    secretsPath,
    cachePath,
    backupsPath,
    workspaceProfilePath: path.join(statePath, 'workspace-profile.json'),
    workspaceCatalogPath: path.join(statePath, 'workspace-catalog.json'),
    workspaceRuntimePath: path.join(statePath, 'workspace-runtime.json'),
    runtimeStatePath: path.join(statePath, 'runtime-state.json'),
    legacyRuntimeStatePath: path.join(rootPath, 'runtime-state.json'),
    runtimeIdentityPath: path.join(rootPath, 'runtime-identity.json')
  };
}

export function ensureDesktopStorageLayout(layout: DesktopStorageLayout): void {
  mkdirSync(layout.rootPath, { recursive: true });
  mkdirSync(layout.workspacesRootPath, { recursive: true });
  mkdirSync(layout.workspaceRootPath, { recursive: true });
  mkdirSync(layout.statePath, { recursive: true });
  mkdirSync(layout.dbPath, { recursive: true });
  mkdirSync(layout.assetsPath, { recursive: true });
  mkdirSync(layout.indexesPath, { recursive: true });
  mkdirSync(layout.logsPath, { recursive: true });
  mkdirSync(layout.secretsPath, { recursive: true });
  mkdirSync(layout.cachePath, { recursive: true });
  mkdirSync(layout.backupsPath, { recursive: true });
}

export function normalizeWorkspaceId(workspaceId?: string): string {
  const value = workspaceId?.trim();
  if (!value) {
    return defaultWorkspaceId;
  }

  return value;
}

export function normalizePathSegment(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '_');
  return normalized.length > 0 ? normalized : defaultWorkspaceId;
}
