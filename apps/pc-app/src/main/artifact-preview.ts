import * as electron from 'electron';
import { existsSync, statSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { net, protocol } = electronApi;
const artifactPreviewScheme = 'qiuai-artifact';
const previewTokenTtlMs = 6 * 60 * 60 * 1000;
const previewFiles = new Map<string, { filePath: string; lastAccessedAt: number }>();

export function registerArtifactPreviewScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: artifactPreviewScheme,
      privileges: {
        secure: true,
        standard: true,
        supportFetchAPI: true,
        stream: true
      }
    }
  ]);
}

export function registerArtifactPreviewProtocol() {
  protocol.handle(artifactPreviewScheme, async (request) => {
    const token = new URL(request.url).pathname.replace(/^\/+/, '');
    const entry = previewFiles.get(token);
    if (!entry || !existsSync(entry.filePath) || !statSync(entry.filePath).isFile()) {
      return new Response('Artifact preview file not found.', { status: 404 });
    }

    entry.lastAccessedAt = Date.now();
    return net.fetch(pathToFileURL(entry.filePath).toString(), {
      method: request.method,
      headers: request.headers
    });
  });
}

export function createArtifactPreviewUrl(filePath: string): string {
  const normalizedPath = filePath.trim();
  if (!normalizedPath || !existsSync(normalizedPath) || !statSync(normalizedPath).isFile()) {
    throw new Error('Artifact preview file does not exist.');
  }

  cleanupExpiredPreviewTokens();
  const token = randomUUID();
  previewFiles.set(token, {
    filePath: normalizedPath,
    lastAccessedAt: Date.now()
  });
  return `${artifactPreviewScheme}://preview/${token}`;
}

function cleanupExpiredPreviewTokens() {
  const cutoff = Date.now() - previewTokenTtlMs;
  for (const [token, entry] of previewFiles.entries()) {
    if (entry.lastAccessedAt < cutoff) {
      previewFiles.delete(token);
    }
  }
}
