import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  utimesSync,
  writeFileSync
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  cleanupExpiredArtifactCache,
  saveArtifactFileAs,
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
