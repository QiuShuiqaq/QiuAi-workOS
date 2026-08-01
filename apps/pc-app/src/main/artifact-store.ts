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
  DesktopLocalFileExportRequest,
  DesktopLocalFileExportResult,
  DesktopRemoteFileSaveAsRequest,
  DesktopRemoteFileSaveAsResult,
  DesktopTaskArtifactWriteRequest,
  DesktopTaskArtifactWriteResult
} from '../shared/desktop-api.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizePathSegment
} from './storage-layout.js';

const artifactCacheRetentionMs = 30 * 24 * 60 * 60 * 1000;
const maxRemoteArtifactBytes = 100 * 1024 * 1024;

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

export function exportLocalFilesToDirectory(
  request: DesktopLocalFileExportRequest,
  destinationDirectoryPath: string
): DesktopLocalFileExportResult {
  const files = request.files
    .map((file) => ({
      sourcePath: normalizeRequiredLocalPath(file.sourcePath, 'Source file path'),
      suggestedFileName: file.suggestedFileName
    }))
    .filter((file) => file.sourcePath);

  if (files.length === 0) {
    throw new Error('At least one local file is required.');
  }

  const normalizedDestinationDirectoryPath = normalizeRequiredLocalPath(
    destinationDirectoryPath,
    'Destination directory path'
  );
  const exportDirectoryPath = request.targetFolderName
    ? path.join(normalizedDestinationDirectoryPath, normalizePathSegment(request.targetFolderName))
    : normalizedDestinationDirectoryPath;

  if (existsSync(exportDirectoryPath) && !statSync(exportDirectoryPath).isDirectory()) {
    throw new Error('Destination path must be a directory.');
  }
  if (!existsSync(exportDirectoryPath)) {
    mkdirSync(exportDirectoryPath, { recursive: true });
  }

  const usedFileNames = new Set<string>();
  const exportedFiles: DesktopLocalFileExportResult['exportedFiles'] = [];
  for (const file of files) {
    if (!existsSync(file.sourcePath) || !statSync(file.sourcePath).isFile()) {
      throw new Error(`Local file no longer exists: ${file.sourcePath}`);
    }

    const fileName = createUniqueExportFileName(
      normalizeSuggestedFileName(file.suggestedFileName, file.sourcePath),
      usedFileNames
    );
    const savedPath = path.join(exportDirectoryPath, fileName);
    copyFileSync(file.sourcePath, savedPath);
    exportedFiles.push({
      sourcePath: file.sourcePath,
      savedPath
    });
  }

  return {
    canceled: false,
    exportDirectoryPath,
    exportedFiles
  };
}

export async function saveRemoteFileAs(
  request: DesktopRemoteFileSaveAsRequest,
  destinationPath: string
): Promise<DesktopRemoteFileSaveAsResult> {
  const remoteUrl = normalizeRemoteFileUrl(request.url);
  const normalizedDestinationPath = resolveRemoteSaveDestinationPath(
    destinationPath,
    request.suggestedFileName,
    remoteUrl
  );

  const response = await fetch(remoteUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(180_000)
  });

  if (!response.ok) {
    throw new Error(`Remote file download failed: HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxRemoteArtifactBytes) {
    throw new Error('Remote file is too large to save.');
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > maxRemoteArtifactBytes) {
    throw new Error('Remote file is too large to save.');
  }

  ensureParentDirectory(normalizedDestinationPath);
  writeFileSync(normalizedDestinationPath, buffer);

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

function resolveRemoteSaveDestinationPath(
  destinationPath: string,
  suggestedFileName: string | undefined,
  remoteUrl: string
): string {
  const normalizedDestinationPath = normalizeRequiredLocalPath(destinationPath, 'Destination path');
  if (isDirectoryLikePath(normalizedDestinationPath)) {
    return path.join(
      normalizedDestinationPath,
      normalizeSuggestedFileName(suggestedFileName, getRemoteUrlFallbackPath(remoteUrl))
    );
  }

  return normalizedDestinationPath;
}

function normalizeSuggestedFileName(value: string | undefined, sourcePath: string): string {
  const fallbackName = path.basename(sourcePath) || 'qiuai-result.md';
  const suggestedName = typeof value === 'string' ? path.basename(value.trim()) : '';
  return suggestedName || fallbackName;
}

function createUniqueExportFileName(fileName: string, usedFileNames: Set<string>): string {
  const normalizedFileName = normalizePathSegment(fileName);
  const extension = path.extname(normalizedFileName);
  const baseName = extension
    ? normalizedFileName.slice(0, -extension.length)
    : normalizedFileName;
  let candidate = normalizedFileName;
  let index = 2;

  while (usedFileNames.has(candidate.toLowerCase())) {
    candidate = `${baseName}-${index}${extension}`;
    index += 1;
  }

  usedFileNames.add(candidate.toLowerCase());
  return candidate;
}

function normalizeRemoteFileUrl(value: string): string {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  if (!normalizedValue) {
    throw new Error('Remote file URL is required.');
  }

  let url: URL;
  try {
    url = new URL(normalizedValue);
  } catch {
    throw new Error('Remote file URL is invalid.');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Only HTTP and HTTPS remote files can be saved.');
  }

  return url.toString();
}

function getRemoteUrlFallbackPath(remoteUrl: string): string {
  try {
    const url = new URL(remoteUrl);
    const fileName = decodeURIComponent(path.posix.basename(url.pathname));
    return fileName ? path.join(path.sep, fileName) : path.join(path.sep, 'qiuai-image.png');
  } catch {
    return path.join(path.sep, 'qiuai-image.png');
  }
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
