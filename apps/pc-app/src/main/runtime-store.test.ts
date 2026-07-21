import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDesktopRuntimePreviewState } from '../shared/desktop-state.js';
import { loadDesktopRuntimeState, saveDesktopRuntimeState } from './runtime-store.js';
import { getDesktopStorageLayout } from './storage-layout.js';
import {
  readWorkspaceSnapshotBundle,
  readWorkspaceToolRegistry
} from './workspace-sqlite-store.js';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-runtime-'));
const initialState = createDesktopRuntimePreviewState();
initialState.localRuntime.lastSyncedAt = '2026-07-20T01:00:00.000Z';
initialState.runtimeSnapshot.lastSyncedAt = '2026-07-20T01:00:00.000Z';
initialState.modelProfiles[0].apiBaseUrl = 'https://api.example.com/v1';
initialState.modelProfiles[0].apiKey = 'local-test-key';
initialState.knowledgeSources = [
  {
    id: 'kb-local-folder',
    source: 'local_folder',
    label: 'Customer Docs',
    enabled: true,
    createdAt: '2026-07-20T01:00:00.000Z',
    localPath: 'C:\\QiuAI\\CustomerDocs',
    summary: 'Local customer documentation folder'
  }
];
const layout = getDesktopStorageLayout(tempDir, initialState.localRuntime.workspaceId);

await saveDesktopRuntimeState(tempDir, initialState);

assert.ok(existsSync(layout.workspaceDatabasePath));
const storedBundle = await readWorkspaceSnapshotBundle(
  layout,
  initialState.localRuntime.workspaceId
);
const loadedState = await loadDesktopRuntimeState(tempDir, initialState.localRuntime.workspaceId);
const toolRegistry = await readWorkspaceToolRegistry(layout, initialState.localRuntime.workspaceId);

assert.equal(storedBundle?.profile?.schemaVersion, 1);
assert.equal(storedBundle?.catalog?.schemaVersion, 1);
assert.equal(storedBundle?.runtime?.schemaVersion, 1);
assert.equal((storedBundle?.runtime?.knowledgeSources as unknown[])?.length, 1);
const storedTaskDetails = storedBundle?.runtime?.taskDetails;
assert.ok(Array.isArray(storedTaskDetails));
assert.equal(storedTaskDetails.length, initialState.taskDetails?.length);
const storedRuntimeSnapshot = storedBundle?.runtime?.runtimeSnapshot as
  | { tasks?: Array<{ executionContext?: unknown }> }
  | undefined;
assert.ok(Array.isArray(storedRuntimeSnapshot?.tasks));
assert.ok(storedRuntimeSnapshot?.tasks?.[0].executionContext);
assert.equal(toolRegistry.length, initialState.tools.length);
assert.equal(
  toolRegistry.find((tool) => tool.toolId === 'office-document')?.enabled,
  false
);
assert.equal(loadedState?.localRuntime.lastSyncedAt, '2026-07-20T01:00:00.000Z');
assert.equal(loadedState?.runtimeSnapshot.tasks.length, initialState.runtimeSnapshot.tasks.length);
assert.ok(loadedState?.runtimeSnapshot.tasks[0].executionContext);
assert.equal(loadedState?.rolePackages.length, initialState.rolePackages.length);
assert.equal(loadedState?.modelProfiles[0].apiBaseUrl, 'https://api.example.com/v1');
assert.equal(loadedState?.modelProfiles[0].apiKey, 'local-test-key');
assert.equal(loadedState?.knowledgeSources[0]?.localPath, 'C:\\QiuAI\\CustomerDocs');
assert.equal(loadedState?.taskDetails?.length, initialState.taskDetails?.length);
assert.ok(loadedState?.taskDetails?.[0].executionContext);
assert.equal(loadedState?.taskDetails?.[0].executionContext?.toolIds.length, 3);

const legacyTempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-runtime-legacy-'));
const legacyState = createDesktopRuntimePreviewState();
const legacyLayout = getDesktopStorageLayout(legacyTempDir, legacyState.localRuntime.workspaceId);
writeFileSync(
  path.join(legacyTempDir, 'runtime-state.json'),
  `${JSON.stringify({
    schemaVersion: 1,
    savedAt: '2026-07-20T00:00:00.000Z',
    state: legacyState
  }, null, 2)}\n`,
  { encoding: 'utf8' }
);

const migratedState = await loadDesktopRuntimeState(
  legacyTempDir,
  legacyState.localRuntime.workspaceId
);
const migratedBundle = await readWorkspaceSnapshotBundle(
  legacyLayout,
  legacyState.localRuntime.workspaceId
);

assert.ok(migratedBundle);
assert.equal(migratedState?.localRuntime.workspaceId, legacyState.localRuntime.workspaceId);
assert.deepEqual(migratedState?.knowledgeSources, []);
assert.equal(migratedState?.taskDetails?.length, legacyState.taskDetails?.length);
assert.ok(existsSync(legacyLayout.workspaceDatabasePath));

console.log('Desktop runtime state persistence roundtrip passed.');
