import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { writeTaskArtifactFile } from './artifact-store.js';
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

console.log('Desktop artifact store passed.');
