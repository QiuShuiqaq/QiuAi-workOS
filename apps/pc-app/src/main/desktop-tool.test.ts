import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { invokeDesktopTool } from './desktop-tool.js';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-tool-'));
const workspaceId = 'workspace-tool-test';
const sourceFilePath = path.join(tempDir, 'source.txt');
const allowedRootPath = path.join(tempDir, 'allowed-root');
const allowedFilePath = path.join(allowedRootPath, 'allowed.txt');
mkdirSync(allowedRootPath, { recursive: true });
writeFileSync(sourceFilePath, 'local source text', { encoding: 'utf8' });
writeFileSync(allowedFilePath, 'allowed local source text', { encoding: 'utf8' });

const writeResult = invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.write_text_file',
  input: {
    folder: 'reports',
    fileName: 'result',
    content: 'generated report'
  }
});

assert.equal(writeResult.ok, true);
assert.equal(typeof writeResult.output?.localPath, 'string');
assert.ok(existsSync(String(writeResult.output?.localPath)));

const readResult = invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.read_text_file',
  input: {
    path: sourceFilePath
  }
});

assert.equal(readResult.ok, true);
assert.equal(readResult.output?.content, 'local source text');

const allowedReadResult = invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.read_text_file',
  input: {
    path: allowedFilePath
  },
  allowedRootPaths: [allowedRootPath]
});

assert.equal(allowedReadResult.ok, true);
assert.equal(allowedReadResult.output?.content, 'allowed local source text');

const blockedReadResult = invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.read_text_file',
  input: {
    path: sourceFilePath
  },
  allowedRootPaths: [allowedRootPath]
});

assert.equal(blockedReadResult.ok, false);
assert.match(blockedReadResult.message ?? '', /outside the allowed local knowledge roots/);

const listResult = invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.list_directory',
  input: {
    path: tempDir
  }
});

assert.equal(listResult.ok, true);
assert.ok(Array.isArray(listResult.output?.entries));

const unsupported = invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'unknown-tool',
  action: 'filesystem.list_directory',
  input: {
    path: tempDir
  }
});

assert.equal(unsupported.ok, false);

console.log('Desktop local filesystem tool passed.');
