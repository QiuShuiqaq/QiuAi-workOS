import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDesktopRuntimePreviewState } from '../shared/desktop-state.js';
import { loadDesktopRuntimeState, saveDesktopRuntimeState } from './runtime-store.js';
import { getDesktopStorageLayout } from './storage-layout.js';
import { writeTaskArtifactFile } from './artifact-store.js';
import {
  createWorkspaceBackupBundle,
  listWorkspaceBackupBundles,
  restoreWorkspaceBackupBundle
} from './workspace-backup.js';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-backup-'));
const initialState = createDesktopRuntimePreviewState();
initialState.app.userDataPath = tempDir;
initialState.localRuntime.lastSyncedAt = '2026-07-20T02:00:00.000Z';
initialState.runtimeSnapshot.lastSyncedAt = '2026-07-20T02:00:00.000Z';
initialState.modelProfiles[0].apiBaseUrl = 'https://api.example.com/v1';
initialState.modelProfiles[0].apiKey = 'backup-test-key';
initialState.knowledgeSources = [
  {
    id: 'kb-local-file',
    source: 'local_file',
    label: 'Sales SOP',
    enabled: true,
    createdAt: '2026-07-20T02:00:00.000Z',
    localPath: 'C:\\QiuAI\\SalesSOP.docx',
    summary: 'Local sales SOP file'
  }
];
const artifactWriteResult = writeTaskArtifactFile(tempDir, {
  workspaceId: initialState.localRuntime.workspaceId,
  taskId: 'task-preview-case-review',
  artifact: {
    id: 'artifact-backup-test',
    type: 'report',
    title: 'Backup Artifact',
    content: 'Artifact content that must be copied into the backup.',
    createdAt: '2026-07-20T02:01:00.000Z'
  }
});
initialState.taskDetails = initialState.taskDetails?.map((task) =>
  task.taskId === 'task-preview-case-review'
    ? {
        ...task,
        artifacts: [
          {
            id: 'artifact-backup-test',
            type: 'report',
            title: 'Backup Artifact',
            content: 'Artifact content that must be copied into the backup.',
            createdAt: '2026-07-20T02:01:00.000Z',
            localPath: artifactWriteResult.localPath
          }
        ]
      }
    : task
);

await saveDesktopRuntimeState(tempDir, initialState);

const layout = getDesktopStorageLayout(tempDir, initialState.localRuntime.workspaceId);
const createdBackup = await createWorkspaceBackupBundle(initialState);
const backupList = await listWorkspaceBackupBundles(tempDir, initialState.localRuntime.workspaceId);

assert.equal(backupList.length, 1);
assert.equal(backupList[0].bundleId, createdBackup.bundleId);
assert.equal(backupList[0].workspaceId, initialState.localRuntime.workspaceId);
assert.ok(existsSync(path.join(createdBackup.bundlePath, 'manifest.json')));
assert.ok(existsSync(path.join(createdBackup.bundlePath, 'desktop-runtime-state.json')));
assert.ok(existsSync(path.join(createdBackup.bundlePath, 'assets')));

rmSync(layout.workspaceDatabasePath, { force: true });
rmSync(layout.runtimeIdentityPath, { force: true });

const restoredBackup = await restoreWorkspaceBackupBundle(tempDir, createdBackup.bundlePath);
const restoredState = await loadDesktopRuntimeState(tempDir, initialState.localRuntime.workspaceId);

assert.equal(restoredBackup.bundleId, createdBackup.bundleId);
assert.equal(restoredState?.localRuntime.workspaceId, initialState.localRuntime.workspaceId);
assert.equal(restoredState?.localRuntime.runtimeId, initialState.localRuntime.runtimeId);
assert.equal(restoredState?.runtimeSnapshot.tasks.length, initialState.runtimeSnapshot.tasks.length);
assert.ok(restoredState?.runtimeSnapshot.tasks[0].executionContext);
assert.equal(restoredState?.taskDetails?.length, initialState.taskDetails?.length);
assert.equal(restoredState?.modelProfiles[0].apiBaseUrl, 'https://api.example.com/v1');
assert.equal(restoredState?.modelProfiles[0].apiKey, 'backup-test-key');
assert.equal(restoredState?.knowledgeSources[0]?.localPath, 'C:\\QiuAI\\SalesSOP.docx');
assert.equal(restoredState?.tools.length, initialState.tools.length);
assert.ok(restoredState?.taskDetails?.[0].executionContext);
assert.equal(restoredState?.taskDetails?.[0].executionContext?.knowledgeBindingIds.length, 2);

const restoredTempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-backup-restore-'));
await restoreWorkspaceBackupBundle(restoredTempDir, createdBackup.bundlePath);
const restoredMovedState = await loadDesktopRuntimeState(
  restoredTempDir,
  initialState.localRuntime.workspaceId
);
const restoredArtifactPath = restoredMovedState?.taskDetails?.[0]?.artifacts[0]?.localPath;

assert.ok(restoredArtifactPath?.startsWith(restoredTempDir));
assert.ok(restoredArtifactPath ? existsSync(restoredArtifactPath) : false);

console.log('Desktop workspace backup restore roundtrip passed.');
