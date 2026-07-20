import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDesktopRuntimePreviewState } from '../shared/desktop-state.js';
import { loadDesktopRuntimeState, saveDesktopRuntimeState } from './runtime-store.js';
import { getDesktopStorageLayout } from './storage-layout.js';
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

await saveDesktopRuntimeState(tempDir, initialState);

const layout = getDesktopStorageLayout(tempDir, initialState.localRuntime.workspaceId);
const createdBackup = await createWorkspaceBackupBundle(initialState);
const backupList = await listWorkspaceBackupBundles(tempDir, initialState.localRuntime.workspaceId);

assert.equal(backupList.length, 1);
assert.equal(backupList[0].bundleId, createdBackup.bundleId);
assert.equal(backupList[0].workspaceId, initialState.localRuntime.workspaceId);
assert.ok(existsSync(path.join(createdBackup.bundlePath, 'manifest.json')));
assert.ok(existsSync(path.join(createdBackup.bundlePath, 'desktop-runtime-state.json')));

rmSync(layout.workspaceDatabasePath, { force: true });
rmSync(layout.runtimeIdentityPath, { force: true });

const restoredBackup = await restoreWorkspaceBackupBundle(tempDir, createdBackup.bundlePath);
const restoredState = await loadDesktopRuntimeState(tempDir, initialState.localRuntime.workspaceId);

assert.equal(restoredBackup.bundleId, createdBackup.bundleId);
assert.equal(restoredState?.localRuntime.workspaceId, initialState.localRuntime.workspaceId);
assert.equal(restoredState?.localRuntime.runtimeId, initialState.localRuntime.runtimeId);
assert.equal(restoredState?.runtimeSnapshot.tasks.length, initialState.runtimeSnapshot.tasks.length);
assert.equal(restoredState?.taskDetails?.length, initialState.taskDetails?.length);
assert.equal(restoredState?.tools.length, initialState.tools.length);

console.log('Desktop workspace backup restore roundtrip passed.');
