import { createHash, randomBytes } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Readable } from 'node:stream';

import { BadRequestException, NotFoundException } from '@nestjs/common';

const DEFAULT_MAX_UPLOAD_BYTES = 300 * 1024 * 1024;
const ALLOWED_INSTALLER_EXTENSIONS = new Set(['.exe', '.msi', '.zip']);

export interface UploadedDesktopReleaseAsset {
  fileName: string;
  originalFileName: string;
  downloadUrl: string;
  checksumSha256: string;
  fileSizeBytes: number;
  contentType: string;
}

export interface DesktopReleaseAssetDownload {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
  stream: Readable;
}

export interface DesktopReleaseAssetMetadata {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export function getDesktopReleaseUploadMaxBytes(): number {
  const configured = Number(process.env.WORKOS_DESKTOP_RELEASE_UPLOAD_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_UPLOAD_BYTES;
}

export async function saveDesktopReleaseAsset(input: {
  fileName: string;
  contentType?: string;
  body: Buffer;
}): Promise<UploadedDesktopReleaseAsset> {
  const maxBytes = getDesktopReleaseUploadMaxBytes();
  if (!Buffer.isBuffer(input.body) || input.body.length === 0) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_RELEASE_ASSET',
        message: 'Please upload a non-empty desktop installer file.'
      }
    });
  }

  if (input.body.length > maxBytes) {
    throw new BadRequestException({
      error: {
        code: 'RELEASE_ASSET_TOO_LARGE',
        message: `Desktop installer cannot exceed ${Math.round(maxBytes / 1024 / 1024)} MB.`
      }
    });
  }

  const originalFileName = decodeHeaderFileName(input.fileName);
  const safeOriginalName = sanitizeInstallerFileName(originalFileName);
  const extension = safeOriginalName.slice(safeOriginalName.lastIndexOf('.')).toLowerCase();
  const storedFileName = `${Date.now()}-${randomBytes(4).toString('hex')}-${safeOriginalName}`;
  const directory = getDesktopReleaseAssetDirectory();
  const fullPath = join(directory, storedFileName);

  await mkdir(directory, { recursive: true });
  await writeFile(fullPath, input.body, { flag: 'wx', mode: 0o644 });

  const checksumSha256 = createHash('sha256').update(input.body).digest('hex');

  return {
    fileName: storedFileName,
    originalFileName: safeOriginalName,
    downloadUrl: buildDesktopReleaseAssetUrl(storedFileName),
    checksumSha256,
    fileSizeBytes: input.body.length,
    contentType: normalizeInstallerContentType(extension, input.contentType)
  };
}

export async function getDesktopReleaseAssetMetadata(
  fileName: string
): Promise<DesktopReleaseAssetMetadata> {
  const safeFileName = sanitizeStoredAssetFileName(fileName);
  const fullPath = getDesktopReleaseAssetPath(safeFileName);
  let fileStat;

  try {
    fileStat = await stat(fullPath);
  } catch {
    throw new NotFoundException({
      error: {
        code: 'RELEASE_ASSET_NOT_FOUND',
        message: 'Desktop release installer was not found.'
      }
    });
  }

  if (!fileStat.isFile()) {
    throw new NotFoundException({
      error: {
        code: 'RELEASE_ASSET_NOT_FOUND',
        message: 'Desktop release installer was not found.'
      }
    });
  }

  const extension = safeFileName.slice(safeFileName.lastIndexOf('.')).toLowerCase();
  return {
    fileName: safeFileName,
    contentType: normalizeInstallerContentType(extension),
    fileSizeBytes: fileStat.size
  };
}

export async function openDesktopReleaseAsset(fileName: string): Promise<DesktopReleaseAssetDownload> {
  const metadata = await getDesktopReleaseAssetMetadata(fileName);

  return {
    ...metadata,
    stream: createReadStream(getDesktopReleaseAssetPath(metadata.fileName))
  };
}

function getDesktopReleaseAssetDirectory(): string {
  return process.env.WORKOS_DESKTOP_RELEASE_UPLOAD_DIR?.trim() || join(process.cwd(), 'storage', 'desktop-releases');
}

function getDesktopReleaseAssetPath(fileName: string): string {
  return join(getDesktopReleaseAssetDirectory(), fileName);
}

function buildDesktopReleaseAssetUrl(fileName: string): string {
  const path = `/api/v1/desktop/releases/downloads/${encodeURIComponent(fileName)}`;
  const publicBaseUrl = process.env.WORKOS_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  return publicBaseUrl ? `${publicBaseUrl}${path}` : path;
}

function decodeHeaderFileName(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function sanitizeInstallerFileName(value: string): string {
  const rawName = value.split(/[\\/]/).pop()?.trim() || 'QiuAI-WorkOS-Setup.exe';
  const safeName = rawName.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  const normalized = safeName || 'QiuAI-WorkOS-Setup.exe';
  const extension = normalized.includes('.')
    ? normalized.slice(normalized.lastIndexOf('.')).toLowerCase()
    : '';

  if (!ALLOWED_INSTALLER_EXTENSIONS.has(extension)) {
    throw new BadRequestException({
      error: {
        code: 'UNSUPPORTED_RELEASE_ASSET_TYPE',
        message: 'Only .exe, .msi, and .zip desktop installer files are supported.'
      }
    });
  }

  return normalized;
}

function sanitizeStoredAssetFileName(value: string): string {
  const safeName = value.split(/[\\/]/).pop()?.trim() || '';
  if (!safeName || safeName.includes('..')) {
    throw new BadRequestException({
      error: {
        code: 'INVALID_RELEASE_ASSET',
        message: 'Invalid desktop release asset file name.'
      }
    });
  }

  return sanitizeInstallerFileName(safeName);
}

function normalizeInstallerContentType(extension: string, fallback?: string): string {
  if (extension === '.exe') return 'application/vnd.microsoft.portable-executable';
  if (extension === '.msi') return 'application/octet-stream';
  if (extension === '.zip') return 'application/zip';
  return fallback?.trim() || 'application/octet-stream';
}
