import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createDesktopRuntimePreviewState } from '../shared/desktop-state.js';
import {
  createMockTaskDetail,
  toDesktopTaskSummary
} from '../shared/workbench-data.js';
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
  taskId: 'task-backup-fixture',
  artifact: {
    id: 'artifact-backup-test',
    type: 'report',
    title: 'Backup Artifact',
    content: 'Artifact content that must be copied into the backup.',
    createdAt: '2026-07-20T02:01:00.000Z'
  }
});
const backupTask = createMockTaskDetail({
  taskId: 'task-backup-fixture',
  roleCode: 'ai-backup-fixture',
  roleName: 'Backup Fixture',
  title: 'Backup fixture task',
  taskType: 'general_assist',
  state: 'completed',
  updatedAt: '2026-07-20T02:01:00.000Z',
  artifactCount: 1,
  costCents: 100,
  executionContext: {
    modelProfileIds: ['qiu-general-default'],
    toolIds: ['office-document'],
    knowledgeBindingIds: ['kb-local-file', 'kb-server-summary']
  }
});
backupTask.artifacts = [
  {
    id: 'artifact-backup-test',
    type: 'report',
    title: 'Backup Artifact',
    content: 'Artifact content that must be copied into the backup.',
    createdAt: '2026-07-20T02:01:00.000Z',
    localPath: artifactWriteResult.localPath
  }
];
backupTask.factoryOutputs = [
  {
    id: 'factory-output-backup-video-1',
    factoryKind: 'medical_case_video_screening_factory',
    kind: 'video',
    title: 'case-video.mp4',
    status: 'qualified',
    originalStatus: 'review_required',
    sourcePath: 'C:\\QiuAI\\factory\\case-video.mp4',
    outputPath: 'C:\\QiuAI\\factory\\case-video-cut.mp4',
    score: 88,
    grade: 'A',
    summary: '人工复核后设为合格。',
    risks: ['发布前复核合规风险'],
    metadata: { order: 1 },
    auditTrail: [
      {
        id: 'factory-output-backup-audit-1',
        action: 'status_changed',
        fromStatus: 'review_required',
        toStatus: 'qualified',
        reason: '测试备份恢复',
        createdAt: '2026-07-20T02:01:30.000Z'
      }
    ],
    createdAt: '2026-07-20T02:01:00.000Z',
    updatedAt: '2026-07-20T02:01:30.000Z'
  }
];
initialState.taskDetails = [backupTask];
initialState.runtimeSnapshot.tasks = [toDesktopTaskSummary(backupTask)];

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
assert.equal(restoredState?.taskDetails?.[0].factoryOutputs?.[0]?.status, 'qualified');
assert.equal(restoredState?.taskDetails?.[0].factoryOutputs?.[0]?.auditTrail?.[0]?.toStatus, 'qualified');

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
