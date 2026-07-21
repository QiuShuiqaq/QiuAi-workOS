import * as electron from 'electron';
import {
  readFileSync,
  readdirSync,
  statSync
} from 'node:fs';
import path from 'node:path';

import type {
  DesktopKnowledgeSourcePathResult
} from '../shared/desktop-api.js';
import type { KnowledgeBindingSource } from '../shared/desktop-contract.js';

const electronApi = (electron as typeof electron & { default?: typeof electron }).default ?? electron;
const { dialog } = electronApi;

const maxFolderEntries = 200;
const maxFolderDepth = 2;
const maxTextPreviewBytes = 64 * 1024;
const maxTextPreviewChars = 1_200;
const ignoredFolderNames = new Set(['.git', '.next', 'dist', 'node_modules']);
const textPreviewExtensions = new Set([
  '.csv',
  '.json',
  '.log',
  '.md',
  '.markdown',
  '.txt',
  '.xml',
  '.yaml',
  '.yml'
]);

interface LocalKnowledgeSummary {
  label: string;
  summary: string;
  lastIndexedAt: string;
}

interface FolderSummaryAggregate {
  scannedEntries: number;
  fileCount: number;
  folderCount: number;
  totalBytes: number;
  truncated: boolean;
  extensionCounts: Map<string, number>;
  samplePaths: string[];
}

export async function selectKnowledgeSourcePath(
  source: KnowledgeBindingSource
): Promise<DesktopKnowledgeSourcePathResult> {
  if (source !== 'local_folder' && source !== 'local_file') {
    return {
      canceled: true,
      source
    };
  }

  const result = await dialog.showOpenDialog({
    title: source === 'local_folder' ? 'Select local knowledge folder' : 'Select local knowledge file',
    properties: [source === 'local_folder' ? 'openDirectory' : 'openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return {
      canceled: true,
      source
    };
  }

  const selectedPath = result.filePaths[0];
  const localSummary = summarizeLocalKnowledgeSource(source, selectedPath);

  return {
    canceled: false,
    source,
    path: selectedPath,
    label: localSummary.label,
    summary: localSummary.summary,
    lastIndexedAt: localSummary.lastIndexedAt
  };
}

export function summarizeLocalKnowledgeSource(
  source: KnowledgeBindingSource,
  selectedPath: string,
  indexedAt = new Date().toISOString()
): LocalKnowledgeSummary {
  if (source === 'local_file') {
    return summarizeLocalFile(selectedPath, indexedAt);
  }

  if (source === 'local_folder') {
    return summarizeLocalFolder(selectedPath, indexedAt);
  }

  return {
    label: path.basename(selectedPath),
    summary: `Unsupported local summary source: ${source}`,
    lastIndexedAt: indexedAt
  };
}

function summarizeLocalFile(filePath: string, indexedAt: string): LocalKnowledgeSummary {
  const stats = statSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const lines = [
    `Local file: ${path.basename(filePath)}`,
    `Path: ${filePath}`,
    `Size: ${formatBytes(stats.size)}`,
    `Modified: ${stats.mtime.toISOString()}`,
    `Extension: ${extension || 'none'}`
  ];

  if (isTextPreviewEligible(extension, stats.size)) {
    const preview = readFileSync(filePath, 'utf8')
      .slice(0, maxTextPreviewChars)
      .replace(/\s+/g, ' ')
      .trim();

    if (preview) {
      lines.push(`Preview: ${preview}`);
    }
  }

  return {
    label: path.basename(filePath),
    summary: lines.join('\n'),
    lastIndexedAt: indexedAt
  };
}

function summarizeLocalFolder(folderPath: string, indexedAt: string): LocalKnowledgeSummary {
  const stats = statSync(folderPath);
  const aggregate = collectFolderSummary(folderPath);
  const topExtensions = [...aggregate.extensionCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([extension, count]) => `${extension || 'no-ext'}:${count}`)
    .join(', ');

  const lines = [
    `Local folder: ${path.basename(folderPath)}`,
    `Path: ${folderPath}`,
    `Modified: ${stats.mtime.toISOString()}`,
    `Scanned entries: ${aggregate.scannedEntries}`,
    `Files: ${aggregate.fileCount}`,
    `Folders: ${aggregate.folderCount}`,
    `Estimated size: ${formatBytes(aggregate.totalBytes)}`,
    `Top extensions: ${topExtensions || 'none'}`
  ];

  if (aggregate.samplePaths.length > 0) {
    lines.push(`Samples: ${aggregate.samplePaths.join('; ')}`);
  }

  if (aggregate.truncated) {
    lines.push(`Note: scan was limited to ${maxFolderEntries} entries and depth ${maxFolderDepth}.`);
  }

  return {
    label: path.basename(folderPath),
    summary: lines.join('\n'),
    lastIndexedAt: indexedAt
  };
}

function collectFolderSummary(rootPath: string) {
  const aggregate: FolderSummaryAggregate = {
    scannedEntries: 0,
    fileCount: 0,
    folderCount: 0,
    totalBytes: 0,
    truncated: false,
    extensionCounts: new Map<string, number>(),
    samplePaths: [] as string[]
  };

  walkFolder(rootPath, rootPath, 0, aggregate);
  return aggregate;
}

function walkFolder(
  rootPath: string,
  currentPath: string,
  depth: number,
  aggregate: FolderSummaryAggregate
): void {
  if (aggregate.scannedEntries >= maxFolderEntries) {
    aggregate.truncated = true;
    return;
  }

  let entries;
  try {
    entries = readdirSync(currentPath, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    return;
  }

  for (const entry of entries) {
    if (aggregate.scannedEntries >= maxFolderEntries) {
      aggregate.truncated = true;
      return;
    }

    if (entry.isDirectory() && ignoredFolderNames.has(entry.name)) {
      continue;
    }

    const entryPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, entryPath);
    aggregate.scannedEntries += 1;

    if (entry.isDirectory()) {
      aggregate.folderCount += 1;
      if (aggregate.samplePaths.length < 12) {
        aggregate.samplePaths.push(`${relativePath}/`);
      }
      if (depth + 1 < maxFolderDepth) {
        walkFolder(rootPath, entryPath, depth + 1, aggregate);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    aggregate.fileCount += 1;

    try {
      const stats = statSync(entryPath);
      aggregate.totalBytes += stats.size;
    } catch {
      // Ignore files that disappear during the lightweight scan.
    }

    const extension = path.extname(entry.name).toLowerCase();
    aggregate.extensionCounts.set(extension, (aggregate.extensionCounts.get(extension) ?? 0) + 1);

    if (aggregate.samplePaths.length < 12) {
      aggregate.samplePaths.push(relativePath);
    }
  }
}

function isTextPreviewEligible(extension: string, size: number): boolean {
  return size <= maxTextPreviewBytes && textPreviewExtensions.has(extension);
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
