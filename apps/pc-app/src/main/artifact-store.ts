import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

import type {
  DesktopArtifactSaveAsRequest,
  DesktopArtifactSaveAsResult,
  DesktopTaskArtifactWriteRequest,
  DesktopTaskArtifactWriteResult
} from '../shared/desktop-api.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizePathSegment
} from './storage-layout.js';

const artifactCacheRetentionMs = 30 * 24 * 60 * 60 * 1000;

export function writeTaskArtifactFile(
  userDataPath: string,
  request: DesktopTaskArtifactWriteRequest
): DesktopTaskArtifactWriteResult {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const taskFolderName = normalizePathSegment(request.taskId);
  const artifactFileName = `${normalizePathSegment(request.artifact.id)}-${normalizePathSegment(request.artifact.title).slice(0, 60)}.md`;
  const artifactFolderPath = path.join(layout.assetsPath, 'tasks', taskFolderName);
  const artifactPath = path.join(artifactFolderPath, artifactFileName);

  mkdirSync(artifactFolderPath, { recursive: true });
  writeFileSync(artifactPath, renderArtifactMarkdown(request), { encoding: 'utf8' });

  return {
    artifactId: request.artifact.id,
    localPath: artifactPath
  };
}

export function saveArtifactFileAs(
  request: DesktopArtifactSaveAsRequest,
  destinationPath: string
): DesktopArtifactSaveAsResult {
  const sourcePath = normalizeRequiredLocalPath(request.sourcePath, 'Source artifact path');
  const normalizedDestinationPath = resolveArtifactSaveDestinationPath(
    destinationPath,
    request.suggestedFileName,
    sourcePath
  );

  if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
    throw new Error('Artifact file no longer exists in the local cache.');
  }

  ensureParentDirectory(normalizedDestinationPath);
  copyFileSync(sourcePath, normalizedDestinationPath);

  return {
    canceled: false,
    savedPath: normalizedDestinationPath
  };
}

export function cleanupExpiredArtifactCache(
  userDataPath: string,
  nowMs = Date.now()
): { deletedFiles: number; deletedBytes: number } {
  const rootLayout = getDesktopStorageLayout(userDataPath);
  const workspacesRootPath = rootLayout.workspacesRootPath;
  if (!existsSync(workspacesRootPath)) {
    return { deletedFiles: 0, deletedBytes: 0 };
  }

  const cutoffMs = nowMs - artifactCacheRetentionMs;
  let deletedFiles = 0;
  let deletedBytes = 0;

  for (const workspaceEntry of readdirSync(workspacesRootPath, { withFileTypes: true })) {
    if (!workspaceEntry.isDirectory()) {
      continue;
    }

    const workspaceLayout = getDesktopStorageLayout(userDataPath, workspaceEntry.name);
    for (const cacheFolder of [
      path.join(workspaceLayout.assetsPath, 'tasks'),
      path.join(workspaceLayout.assetsPath, 'tools')
    ]) {
      const result = cleanupExpiredFilesInDirectory(cacheFolder, cutoffMs);
      deletedFiles += result.deletedFiles;
      deletedBytes += result.deletedBytes;
    }
  }

  return { deletedFiles, deletedBytes };
}

function cleanupExpiredFilesInDirectory(
  directoryPath: string,
  cutoffMs: number
): { deletedFiles: number; deletedBytes: number } {
  if (!existsSync(directoryPath)) {
    return { deletedFiles: 0, deletedBytes: 0 };
  }

  let deletedFiles = 0;
  let deletedBytes = 0;

  for (const entry of readdirSync(directoryPath, { withFileTypes: true })) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      const result = cleanupExpiredFilesInDirectory(entryPath, cutoffMs);
      deletedFiles += result.deletedFiles;
      deletedBytes += result.deletedBytes;
      removeDirectoryIfEmpty(entryPath);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const stats = statSync(entryPath);
    if (stats.mtimeMs >= cutoffMs) {
      continue;
    }

    rmSync(entryPath, { force: true });
    deletedFiles += 1;
    deletedBytes += stats.size;
  }

  return { deletedFiles, deletedBytes };
}

function removeDirectoryIfEmpty(directoryPath: string): void {
  try {
    if (readdirSync(directoryPath).length === 0) {
      rmSync(directoryPath, { force: true, recursive: true });
    }
  } catch {
    // Best-effort cleanup; stale cache directories are harmless.
  }
}

function renderArtifactMarkdown(request: DesktopTaskArtifactWriteRequest): string {
  return [
    `# ${request.artifact.title}`,
    '',
    `- Artifact ID: ${request.artifact.id}`,
    `- Task ID: ${request.taskId}`,
    `- Type: ${request.artifact.type}`,
    `- Created At: ${request.artifact.createdAt}`,
    '',
    '## Content',
    '',
    request.artifact.content,
    ''
  ].join('\n');
}

function normalizeRequiredLocalPath(value: string, fieldName: string): string {
  const normalizedPath = typeof value === 'string' ? value.trim() : '';
  if (!normalizedPath) {
    throw new Error(`${fieldName} is required.`);
  }

  return path.resolve(normalizedPath);
}

function resolveArtifactSaveDestinationPath(
  destinationPath: string,
  suggestedFileName: string | undefined,
  sourcePath: string
): string {
  const normalizedDestinationPath = normalizeRequiredLocalPath(destinationPath, 'Destination path');
  if (isDirectoryLikePath(normalizedDestinationPath)) {
    return path.join(
      normalizedDestinationPath,
      normalizeSuggestedFileName(suggestedFileName, sourcePath)
    );
  }

  return normalizedDestinationPath;
}

function normalizeSuggestedFileName(value: string | undefined, sourcePath: string): string {
  const fallbackName = path.basename(sourcePath) || 'qiuai-result.md';
  const suggestedName = typeof value === 'string' ? path.basename(value.trim()) : '';
  return suggestedName || fallbackName;
}

function isDirectoryLikePath(targetPath: string): boolean {
  const parsedPath = path.parse(targetPath);
  if (targetPath === parsedPath.root) {
    return true;
  }

  if (!existsSync(targetPath)) {
    return false;
  }

  return statSync(targetPath).isDirectory();
}

function ensureParentDirectory(filePath: string): void {
  const parentPath = path.dirname(filePath);
  if (!parentPath || parentPath === path.parse(parentPath).root) {
    return;
  }

  mkdirSync(parentPath, { recursive: true });
}
