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
  DesktopUpdateInstallResult,
  DesktopUpdateReleaseSummary
} from '../shared/desktop-api.js';
import { checkForDesktopUpdates, getDesktopAppInfo } from './runtime-state.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { app, shell } = electronApi;

const allowedInstallerExtensions = new Set(['.exe', '.msi', '.zip']);

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

function createHashingTransform() {
  const hash = createHash('sha256');
  let bytesWritten = 0;

  const stream = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      bytesWritten += buffer.length;
      hash.update(buffer);
      callback(null, buffer);
    }
  });

  return {
    stream,
    getDigest: () => hash.digest('hex'),
    getBytesWritten: () => bytesWritten
  };
}

async function downloadReleaseInstaller(release: DesktopUpdateReleaseSummary) {
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
  const hashing = createHashingTransform();

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

  return {
    downloadUrl,
    installerPath,
    fileSizeBytes: fileStat.size,
    checksumSha256: digest
  };
}

async function launchInstaller(installerPath: string) {
  const extension = path.extname(installerPath).toLowerCase();

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

export async function downloadAndInstallDesktopUpdate(): Promise<DesktopUpdateInstallResult> {
  const update = await checkForDesktopUpdates();
  const release = update.latestRelease;

  if (!update.updateAvailable || !release) {
    throw new Error('No desktop update is available.');
  }

  const installer = await downloadReleaseInstaller(release);
  const shouldQuit = await launchInstaller(installer.installerPath);

  if (shouldQuit) {
    setTimeout(() => {
      app.quit();
    }, 1200);
  }

  return {
    releaseVersion: release.version,
    installerPath: installer.installerPath,
    downloadUrl: installer.downloadUrl,
    fileSizeBytes: installer.fileSizeBytes,
    checksumSha256: installer.checksumSha256,
    launchedAt: new Date().toISOString(),
    willQuit: shouldQuit
  };
}
