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

const writeResult = await invokeDesktopTool(tempDir, {
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

const readResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.read_text_file',
  input: {
    path: sourceFilePath
  }
});

assert.equal(readResult.ok, true);
assert.equal(readResult.output?.content, 'local source text');

const allowedReadResult = await invokeDesktopTool(tempDir, {
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

const blockedReadResult = await invokeDesktopTool(tempDir, {
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

const listResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'local-filesystem',
  action: 'filesystem.list_directory',
  input: {
    path: tempDir
  }
});

assert.equal(listResult.ok, true);
assert.ok(Array.isArray(listResult.output?.entries));

const documentResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'office.write_markdown_document',
  input: {
    title: 'Customer Follow-up Plan',
    folder: 'documents',
    fileName: 'follow-up-plan',
    content: '## Next actions\n\n- Call customer owner'
  }
});

assert.equal(documentResult.ok, true);
assert.equal(typeof documentResult.output?.localPath, 'string');
assert.ok(existsSync(String(documentResult.output?.localPath)));

const spreadsheetResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'spreadsheet.write_csv',
  input: {
    folder: 'sheets',
    fileName: 'lead-score',
    rows: [
      ['name', 'score'],
      ['Acme', 92]
    ]
  }
});

assert.equal(spreadsheetResult.ok, true);
assert.equal(typeof spreadsheetResult.output?.localPath, 'string');
assert.ok(existsSync(String(spreadsheetResult.output?.localPath)));

const blockedWebResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'web-search',
  action: 'web.fetch_url',
  input: {
    url: 'http://127.0.0.1:4100/api/v1/health'
  }
});

assert.equal(blockedWebResult.ok, false);
assert.match(blockedWebResult.message ?? '', /private network URLs are blocked/);

const unsupported = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'unknown-tool',
  action: 'filesystem.list_directory',
  input: {
    path: tempDir
  }
});

assert.equal(unsupported.ok, false);

console.log('Desktop local filesystem tool passed.');
