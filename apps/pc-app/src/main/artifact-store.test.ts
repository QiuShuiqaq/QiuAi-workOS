import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  utimesSync,
  writeFileSync
} from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

import {
  cleanupExpiredArtifactCache,
  saveArtifactFileAs,
  saveRemoteFileAs,
  writeTaskArtifactFile
} from './artifact-store.js';
import { getDesktopStorageLayout } from './storage-layout.js';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-artifact-'));
const workspaceId = 'workspace-artifact-test';
const result = writeTaskArtifactFile(tempDir, {
  workspaceId,
  taskId: 'task-001',
  artifact: {
    id: 'artifact-001',
    type: 'report',
    title: 'Weekly Customer Report',
    content: 'Customer report content.',
    createdAt: '2026-07-20T03:00:00.000Z'
  }
});
const layout = getDesktopStorageLayout(tempDir, workspaceId);

assert.ok(result.localPath.startsWith(path.join(layout.assetsPath, 'tasks')));
assert.ok(existsSync(result.localPath));
assert.match(readFileSync(result.localPath, 'utf8'), /Customer report content/);

const savedCopyPath = path.join(tempDir, 'exports', 'weekly-customer-report.md');
const saveResult = saveArtifactFileAs(
  {
    sourcePath: result.localPath,
    suggestedFileName: 'weekly-customer-report.md'
  },
  savedCopyPath
);

assert.equal(saveResult.canceled, false);
assert.equal(saveResult.savedPath, savedCopyPath);
assert.ok(existsSync(savedCopyPath));
assert.match(readFileSync(savedCopyPath, 'utf8'), /Customer report content/);

const directorySaveResult = saveArtifactFileAs(
  {
    sourcePath: result.localPath,
    suggestedFileName: 'directory-save-report.md'
  },
  tempDir
);
const directorySavedCopyPath = path.join(tempDir, 'directory-save-report.md');
assert.equal(directorySaveResult.canceled, false);
assert.equal(directorySaveResult.savedPath, directorySavedCopyPath);
assert.ok(existsSync(directorySavedCopyPath));
assert.match(readFileSync(directorySavedCopyPath, 'utf8'), /Customer report content/);

const remoteFileServer = http.createServer((request, response) => {
  if (request.url !== '/generated/product-main.png') {
    response.writeHead(404);
    response.end('not found');
    return;
  }

  response.writeHead(200, {
    'content-type': 'image/png',
    'content-length': '10'
  });
  response.end(Buffer.from('image-data'));
});
await new Promise<void>((resolve) => remoteFileServer.listen(0, '127.0.0.1', resolve));
try {
  const address = remoteFileServer.address();
  assert.ok(address && typeof address === 'object');
  const remoteSaveResult = await saveRemoteFileAs(
    {
      url: `http://127.0.0.1:${address.port}/generated/product-main.png`,
      suggestedFileName: 'factory-main-image.png'
    },
    tempDir
  );
  const remoteSavedPath = path.join(tempDir, 'factory-main-image.png');
  assert.equal(remoteSaveResult.canceled, false);
  assert.equal(remoteSaveResult.savedPath, remoteSavedPath);
  assert.equal(readFileSync(remoteSavedPath, 'utf8'), 'image-data');
} finally {
  await new Promise<void>((resolve, reject) => {
    remoteFileServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

const oldToolArtifactPath = path.join(layout.assetsPath, 'tools', 'office', 'documents', 'expired.docx');
const freshToolArtifactPath = path.join(layout.assetsPath, 'tools', 'office', 'documents', 'fresh.docx');
mkdirSync(path.dirname(oldToolArtifactPath), { recursive: true });
writeFileSync(oldToolArtifactPath, 'old artifact');
writeFileSync(freshToolArtifactPath, 'fresh artifact');
const nowMs = Date.parse('2026-07-28T00:00:00.000Z');
const oldDate = new Date(nowMs - 31 * 24 * 60 * 60 * 1000);
const freshDate = new Date(nowMs - 2 * 24 * 60 * 60 * 1000);
utimesSync(oldToolArtifactPath, oldDate, oldDate);
utimesSync(freshToolArtifactPath, freshDate, freshDate);

const cleanupResult = cleanupExpiredArtifactCache(tempDir, nowMs);

assert.equal(cleanupResult.deletedFiles, 1);
assert.ok(cleanupResult.deletedBytes > 0);
assert.equal(existsSync(oldToolArtifactPath), false);
assert.equal(existsSync(freshToolArtifactPath), true);
assert.equal(existsSync(savedCopyPath), true);
assert.equal(existsSync(directorySavedCopyPath), true);

console.log('Desktop artifact store passed.');
