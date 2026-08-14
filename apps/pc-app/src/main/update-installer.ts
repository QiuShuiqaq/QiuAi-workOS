import * as electron from 'electron';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rename, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import type { ReadableStream } from 'node:stream/web';
import { pipeline } from 'node:stream/promises';

import type {
  DesktopUpdateDownloadProgress,
  DesktopUpdateDownloadResult,
  DesktopUpdateInstallResult,
  DesktopUpdateLaunchRequest,
  DesktopUpdateLaunchResult,
  DesktopUpdateReleaseSummary
} from '../shared/desktop-api.js';
import { checkForDesktopUpdates, getDesktopAppInfo } from './runtime-state.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { app, shell } = electronApi;

const allowedInstallerExtensions = new Set(['.exe', '.msi', '.zip']);

type DesktopUpdateDownloadProgressCallback = (progress: DesktopUpdateDownloadProgress) => void;

function resolveDownloadUrl(downloadUrl: string, serverBaseUrl: string) {
  if (/^https?:\/\//i.test(downloadUrl)) {
    const parsed = new URL(downloadUrl);
    if (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') {
      const publicBaseUrl = new URL(serverBaseUrl);
      parsed.protocol = publicBaseUrl.protocol;
      parsed.host = publicBaseUrl.host;
    }

    return parsed.toString();
  }

  return new URL(downloadUrl.startsWith('/') ? downloadUrl : `/${downloadUrl}`, serverBaseUrl).toString();
}

function inferInstallerFileName(downloadUrl: string, version: string) {
  let rawName = '';

  try {
    const url = /^https?:\/\//i.test(downloadUrl) ? new URL(downloadUrl) : new URL(downloadUrl, 'https://qiuai.local');
    rawName = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '');
  } catch {
    rawName = '';
  }

  const fallback = `QiuAI-WorkOS-Setup-${version}.exe`;
  const safeName = (rawName || fallback)
    .split(/[\\/]/)
    .pop()
    ?.replace(/[^a-zA-Z0-9._-]+/g, '-') || fallback;
  const extension = path.extname(safeName).toLowerCase();

  return allowedInstallerExtensions.has(extension) ? safeName : fallback;
}

function createHashingTransform(options: {
  releaseVersion: string;
  totalBytes?: number;
  onProgress?: DesktopUpdateDownloadProgressCallback;
}) {
  const hash = createHash('sha256');
  let bytesWritten = 0;
  let lastProgressAt = 0;

  const emitProgress = (status: DesktopUpdateDownloadProgress['status']) => {
    if (!options.onProgress) {
      return;
    }

    const now = Date.now();
    if (status === 'downloading' && now - lastProgressAt < 180) {
      return;
    }

    lastProgressAt = now;
    const percent =
      options.totalBytes && options.totalBytes > 0
        ? Math.min(99, Math.max(0, Math.floor((bytesWritten / options.totalBytes) * 100)))
        : undefined;
    options.onProgress({
      releaseVersion: options.releaseVersion,
      status,
      receivedBytes: bytesWritten,
      totalBytes: options.totalBytes,
      percent,
      updatedAt: new Date().toISOString()
    });
  };

  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesWritten += buffer.length;
      hash.update(buffer);
      emitProgress('downloading');
      callback(null, buffer);
    }
  });

  return {
    stream,
    getDigest: () => hash.digest('hex'),
    getBytesWritten: () => bytesWritten
  };
}

async function downloadReleaseInstaller(
  release: DesktopUpdateReleaseSummary,
  onProgress?: DesktopUpdateDownloadProgressCallback
) {
  const appInfo = getDesktopAppInfo();
  const downloadUrl = resolveDownloadUrl(release.downloadUrl, appInfo.serverBaseUrl);
  const response = await fetch(downloadUrl, {
    headers: {
      accept: 'application/octet-stream'
    }
  });

  if (!response.ok) {
    throw new Error(`Installer download failed: HTTP ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Installer download did not return a response body.');
  }

  const updateDir = path.join(appInfo.userDataPath, 'updates');
  await mkdir(updateDir, { recursive: true });

  const fileName = inferInstallerFileName(downloadUrl, release.version);
  const installerPath = path.join(updateDir, fileName);
  const temporaryPath = `${installerPath}.download`;
  const contentLength = Number.parseInt(response.headers.get('content-length') ?? '', 10);
  const totalBytes = Number.isFinite(contentLength) && contentLength > 0
    ? contentLength
    : release.fileSizeBytes;
  const hashing = createHashingTransform({
    releaseVersion: release.version,
    totalBytes,
    onProgress
  });

  onProgress?.({
    releaseVersion: release.version,
    status: 'started',
    receivedBytes: 0,
    totalBytes,
    percent: totalBytes ? 0 : undefined,
    updatedAt: new Date().toISOString()
  });

  try {
    await unlink(temporaryPath);
  } catch {
    // Nothing to clean up.
  }

  await pipeline(
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>),
    hashing.stream,
    createWriteStream(temporaryPath, { mode: 0o644 })
  );

  const digest = hashing.getDigest();
  const bytesWritten = hashing.getBytesWritten();

  if (release.fileSizeBytes !== undefined && bytesWritten !== release.fileSizeBytes) {
    await unlink(temporaryPath).catch(() => undefined);
    throw new Error(`Installer size mismatch: expected ${release.fileSizeBytes}, got ${bytesWritten}.`);
  }

  if (release.checksumSha256 && digest.toLowerCase() !== release.checksumSha256.toLowerCase()) {
    await unlink(temporaryPath).catch(() => undefined);
    throw new Error('Installer checksum verification failed.');
  }

  await rename(temporaryPath, installerPath);
  const fileStat = await stat(installerPath);
  const installerDirectoryPath = path.dirname(installerPath);

  onProgress?.({
    releaseVersion: release.version,
    status: 'completed',
    receivedBytes: fileStat.size,
    totalBytes: totalBytes ?? fileStat.size,
    percent: 100,
    installerPath,
    installerDirectoryPath,
    updatedAt: new Date().toISOString()
  });

  return {
    downloadUrl,
    installerPath,
    installerDirectoryPath,
    fileSizeBytes: fileStat.size,
    checksumSha256: digest
  };
}

async function launchInstaller(installerPath: string, options: { quitBeforeLaunch?: boolean } = {}) {
  const extension = path.extname(installerPath).toLowerCase();

  if (options.quitBeforeLaunch && (extension === '.exe' || extension === '.msi')) {
    scheduleInstallerLaunchAfterQuit(installerPath, extension, process.pid);
    setTimeout(() => {
      app.quit();
      setTimeout(() => {
        app.exit(0);
      }, 1800);
    }, 250);
    return true;
  }

  if (extension === '.msi') {
    const child = spawn('msiexec.exe', ['/i', installerPath], {
      detached: true,
      stdio: 'ignore'
    });
    child.unref();
    return true;
  }

  if (extension === '.zip') {
    const openError = await shell.openPath(installerPath);
    if (openError) {
      throw new Error(openError);
    }
    return false;
  }

  const child = spawn(installerPath, [], {
    detached: true,
    stdio: 'ignore'
  });
  child.unref();
  return true;
}

function scheduleInstallerLaunchAfterQuit(installerPath: string, extension: string, appProcessId: number) {
  const escapedInstallerPath = toPowerShellSingleQuotedString(installerPath);
  const waitForQuitCommand = [
    `$installerPath = ${escapedInstallerPath};`,
    `$appProcessId = ${appProcessId};`,
    '$deadline = (Get-Date).AddSeconds(45);',
    'while ((Get-Date) -lt $deadline) {',
    '  $runningProcess = Get-Process -Id $appProcessId -ErrorAction SilentlyContinue;',
    '  if ($null -eq $runningProcess) { break; }',
    '  Start-Sleep -Milliseconds 500;',
    '}',
    'Start-Sleep -Milliseconds 600;'
  ].join(' ');
  const command =
    extension === '.msi'
      ? [
          waitForQuitCommand,
          "Start-Process -FilePath 'msiexec.exe' -ArgumentList @('/i', $installerPath)"
        ].join(' ')
      : [
          waitForQuitCommand,
          'Start-Process -FilePath $installerPath'
        ].join(' ');
  const child = spawn('powershell.exe', [
    '-NoProfile',
    '-WindowStyle',
    'Hidden',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    command
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();
}

function toPowerShellSingleQuotedString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function validateDownloadedInstallerPath(installerPath: string) {
  const appInfo = getDesktopAppInfo();
  const updateDir = path.resolve(appInfo.userDataPath, 'updates');
  const resolvedInstallerPath = path.resolve(installerPath);
  const relativePath = path.relative(updateDir, resolvedInstallerPath);

  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Installer path is outside the trusted update directory.');
  }

  const extension = path.extname(resolvedInstallerPath).toLowerCase();
  if (!allowedInstallerExtensions.has(extension)) {
    throw new Error('Unsupported installer file type.');
  }

  await stat(resolvedInstallerPath);
  return resolvedInstallerPath;
}

export async function downloadDesktopUpdateInstaller(
  onProgress?: DesktopUpdateDownloadProgressCallback
): Promise<DesktopUpdateDownloadResult> {
  const update = await checkForDesktopUpdates();
  const release = update.latestRelease;

  if (!update.updateAvailable || !release) {
    throw new Error('No desktop update is available.');
  }

  const installer = await downloadReleaseInstaller(release, onProgress);

  return {
    releaseVersion: release.version,
    installerPath: installer.installerPath,
    installerDirectoryPath: installer.installerDirectoryPath,
    downloadUrl: installer.downloadUrl,
    fileSizeBytes: installer.fileSizeBytes,
    checksumSha256: installer.checksumSha256,
    downloadedAt: new Date().toISOString()
  };
}

export async function installDownloadedDesktopUpdate(
  request: DesktopUpdateLaunchRequest
): Promise<DesktopUpdateLaunchResult> {
  const installerPath = await validateDownloadedInstallerPath(request.installerPath);
  const shouldQuit = await launchInstaller(installerPath, { quitBeforeLaunch: true });

  return {
    releaseVersion: request.releaseVersion,
    installerPath,
    launchedAt: new Date().toISOString(),
    willQuit: shouldQuit
  };
}

export async function downloadAndInstallDesktopUpdate(
  onProgress?: DesktopUpdateDownloadProgressCallback
): Promise<DesktopUpdateInstallResult> {
  const update = await checkForDesktopUpdates();
  const release = update.latestRelease;

  if (!update.updateAvailable || !release) {
    throw new Error('No desktop update is available.');
  }

  const installer = await downloadReleaseInstaller(release, onProgress);
  const shouldQuit = await launchInstaller(installer.installerPath, { quitBeforeLaunch: true });

  return {
    releaseVersion: release.version,
    installerPath: installer.installerPath,
    installerDirectoryPath: installer.installerDirectoryPath,
    downloadUrl: installer.downloadUrl,
    fileSizeBytes: installer.fileSizeBytes,
    checksumSha256: installer.checksumSha256,
    launchedAt: new Date().toISOString(),
    willQuit: shouldQuit
  };
}
