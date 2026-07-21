import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type {
  DesktopTaskArtifactWriteRequest,
  DesktopTaskArtifactWriteResult
} from '../shared/desktop-api.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizePathSegment
} from './storage-layout.js';

export function writeTaskArtifactFile(
  userDataPath: string,
  request: DesktopTaskArtifactWriteRequest
): DesktopTaskArtifactWriteResult {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const taskFolderName = normalizePathSegment(request.taskId);
  const artifactFileName = `${normalizePathSegment(request.artifact.id)}-${normalizePathSegment(request.artifact.title).slice(0, 60)}.md`;
  const artifactFolderPath = path.join(layout.assetsPath, 'tasks', taskFolderName);
  const artifactPath = path.join(artifactFolderPath, artifactFileName);

  mkdirSync(artifactFolderPath, { recursive: true });
  writeFileSync(artifactPath, renderArtifactMarkdown(request), { encoding: 'utf8' });

  return {
    artifactId: request.artifact.id,
    localPath: artifactPath
  };
}

function renderArtifactMarkdown(request: DesktopTaskArtifactWriteRequest): string {
  return [
    `# ${request.artifact.title}`,
    '',
    `- Artifact ID: ${request.artifact.id}`,
    `- Task ID: ${request.taskId}`,
    `- Type: ${request.artifact.type}`,
    `- Created At: ${request.artifact.createdAt}`,
    '',
    '## Content',
    '',
    request.artifact.content,
    ''
  ].join('\n');
}
