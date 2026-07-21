import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

import type {
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult
} from '../shared/desktop-api.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizePathSegment
} from './storage-layout.js';

const localFilesystemToolId = 'local-filesystem';
const maxReadBytes = 64 * 1024;
const maxDirectoryEntries = 100;

export function invokeDesktopTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  if (request.toolId !== localFilesystemToolId) {
    return fail(request, `Unsupported desktop tool: ${request.toolId}`);
  }

  try {
    switch (request.action) {
      case 'filesystem.write_text_file':
        return writeTextFile(userDataPath, request);
      case 'filesystem.read_text_file':
        return readTextFile(request);
      case 'filesystem.list_directory':
        return listDirectory(request);
      default:
        return fail(request, `Unsupported tool action: ${request.action}`);
    }
  } catch (error) {
    return fail(request, error instanceof Error ? error.message : 'Desktop tool invocation failed.');
  }
}

function writeTextFile(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const fileName = readString(request.input.fileName, 'tool-output.md');
  const content = readString(request.input.content, '');
  const folder = readString(request.input.folder, 'general');
  const outputFolderPath = path.join(layout.assetsPath, 'tools', normalizePathSegment(folder));
  const outputPath = path.join(outputFolderPath, `${normalizePathSegment(fileName)}.md`);

  mkdirSync(outputFolderPath, { recursive: true });
  writeFileSync(outputPath, content, { encoding: 'utf8' });

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      localPath: outputPath,
      bytes: Buffer.byteLength(content, 'utf8')
    }
  };
}

function readTextFile(request: DesktopToolInvocationRequest): DesktopToolInvocationResult {
  const filePath = readRequiredString(request.input.path, 'path');
  assertReadPathAllowed(request, filePath);
  const stats = statSync(filePath);

  if (!stats.isFile()) {
    return fail(request, `Path is not a file: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8').slice(0, maxReadBytes);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      path: filePath,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      truncated: stats.size > maxReadBytes,
      content
    }
  };
}

function listDirectory(request: DesktopToolInvocationRequest): DesktopToolInvocationResult {
  const directoryPath = readRequiredString(request.input.path, 'path');
  assertReadPathAllowed(request, directoryPath);
  const stats = statSync(directoryPath);

  if (!stats.isDirectory()) {
    return fail(request, `Path is not a directory: ${directoryPath}`);
  }

  const entries = readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, maxDirectoryEntries)
    .map((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      const entryStats = existsSync(entryPath) ? statSync(entryPath) : undefined;

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        sizeBytes: entryStats?.isFile() ? entryStats.size : undefined,
        modifiedAt: entryStats?.mtime.toISOString()
      };
    });

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      path: directoryPath,
      entries,
      truncated: readdirSync(directoryPath).length > maxDirectoryEntries
    }
  };
}

function fail(
  request: DesktopToolInvocationRequest,
  message: string
): DesktopToolInvocationResult {
  return {
    toolId: request.toolId,
    action: request.action,
    ok: false,
    message
  };
}

function readRequiredString(value: unknown, fieldName: string): string {
  const text = readString(value, '');
  if (!text) {
    throw new Error(`Tool input ${fieldName} is required.`);
  }

  return text;
}

function assertReadPathAllowed(request: DesktopToolInvocationRequest, targetPath: string): void {
  if (!request.allowedRootPaths) {
    return;
  }

  const allowedRootPaths = request.allowedRootPaths
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedRootPaths.length === 0) {
    throw new Error('No allowed local read roots are configured for this task.');
  }

  if (!allowedRootPaths.some((rootPath) => isPathInsideRoot(targetPath, rootPath))) {
    throw new Error('Path is outside the allowed local knowledge roots.');
  }
}

function isPathInsideRoot(targetPath: string, rootPath: string): boolean {
  const resolvedTargetPath = path.resolve(targetPath);
  const resolvedRootPath = path.resolve(rootPath);
  const relativePath = path.relative(resolvedRootPath, resolvedTargetPath);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function readString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}
