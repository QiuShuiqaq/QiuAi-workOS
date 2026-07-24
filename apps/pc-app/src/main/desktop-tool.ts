import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';

import type {
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult
} from '../shared/desktop-api.js';
import {
  ensureDesktopStorageLayout,
  getDesktopStorageLayout,
  normalizePathSegment
} from './storage-layout.js';
import { loadDesktopRuntimeState } from './runtime-store.js';

const localFilesystemToolId = 'local-filesystem';
const webSearchToolId = 'web-search';
const officeDocumentToolId = 'office-document';
const maxReadBytes = 64 * 1024;
const maxDirectoryEntries = 100;
const maxWebTextChars = 24_000;
const webFetchTimeoutMs = 15_000;

export async function invokeDesktopTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const runtimeState = await loadDesktopRuntimeState(userDataPath, request.workspaceId);
  const webSearchSettings = runtimeState?.localRuntime.toolSettings?.webSearch;

  try {
    if (request.toolId === localFilesystemToolId) {
      return invokeLocalFilesystemTool(userDataPath, request);
    }

    if (request.toolId === webSearchToolId) {
      return await invokeWebSearchTool(request, webSearchSettings);
    }

    if (request.toolId === officeDocumentToolId) {
      return invokeOfficeDocumentTool(userDataPath, request);
    }

    return fail(request, `Unsupported desktop tool: ${request.toolId}`);
  } catch (error) {
    return fail(request, error instanceof Error ? error.message : 'Desktop tool invocation failed.');
  }
}

function invokeLocalFilesystemTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  switch (request.action) {
    case 'filesystem.write_text_file':
      return writeTextFile(userDataPath, request);
    case 'filesystem.read_text_file':
      return readTextFile(request);
    case 'filesystem.list_directory':
      return listDirectory(request);
    default:
      return fail(request, `Unsupported local filesystem action: ${request.action}`);
  }
}

async function invokeWebSearchTool(
  request: DesktopToolInvocationRequest,
  settings?: {
    endpoint?: string;
    apiKey?: string;
    allowPrivateNetwork?: boolean;
  }
): Promise<DesktopToolInvocationResult> {
  switch (request.action) {
    case 'web.fetch_url':
      return fetchUrl(request, settings);
    case 'web.search':
      return searchWeb(request, settings);
    default:
      return fail(request, `Unsupported web search action: ${request.action}`);
  }
}

function invokeOfficeDocumentTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  switch (request.action) {
    case 'office.write_markdown_document':
      return writeOfficeMarkdownDocument(userDataPath, request);
    case 'spreadsheet.write_csv':
      return writeSpreadsheetCsv(userDataPath, request);
    case 'presentation.write_outline_markdown':
      return writePresentationOutline(userDataPath, request);
    default:
      return fail(request, `Unsupported office document action: ${request.action}`);
  }
}

function writeTextFile(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const fileName = readString(request.input.fileName, 'tool-output.md');
  const content = readString(request.input.content, '');
  const folder = readString(request.input.folder, 'general');
  const outputFolderPath = path.join(layout.assetsPath, 'tools', normalizePathSegment(folder));
  const outputPath = path.join(outputFolderPath, `${normalizePathSegment(fileName)}.md`);

  mkdirSync(outputFolderPath, { recursive: true });
  writeFileSync(outputPath, content, { encoding: 'utf8' });

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      localPath: outputPath,
      bytes: Buffer.byteLength(content, 'utf8')
    }
  };
}

function readTextFile(request: DesktopToolInvocationRequest): DesktopToolInvocationResult {
  const filePath = readRequiredString(request.input.path, 'path');
  assertReadPathAllowed(request, filePath);
  const stats = statSync(filePath);

  if (!stats.isFile()) {
    return fail(request, `Path is not a file: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf8').slice(0, maxReadBytes);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      path: filePath,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      truncated: stats.size > maxReadBytes,
      content
    }
  };
}

function listDirectory(request: DesktopToolInvocationRequest): DesktopToolInvocationResult {
  const directoryPath = readRequiredString(request.input.path, 'path');
  assertReadPathAllowed(request, directoryPath);
  const stats = statSync(directoryPath);

  if (!stats.isDirectory()) {
    return fail(request, `Path is not a directory: ${directoryPath}`);
  }

  const entries = readdirSync(directoryPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .slice(0, maxDirectoryEntries)
    .map((entry) => {
      const entryPath = path.join(directoryPath, entry.name);
      const entryStats = existsSync(entryPath) ? statSync(entryPath) : undefined;

      return {
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        sizeBytes: entryStats?.isFile() ? entryStats.size : undefined,
        modifiedAt: entryStats?.mtime.toISOString()
      };
    });

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      path: directoryPath,
      entries,
      truncated: readdirSync(directoryPath).length > maxDirectoryEntries
    }
  };
}

async function fetchUrl(
  request: DesktopToolInvocationRequest,
  settings?: {
    endpoint?: string;
    apiKey?: string;
    allowPrivateNetwork?: boolean;
  }
): Promise<DesktopToolInvocationResult> {
  const allowPrivateNetwork =
    settings?.allowPrivateNetwork ?? process.env.QIUAI_DESKTOP_ALLOW_PRIVATE_WEB_TOOL === 'true';
  const url = normalizePublicHttpUrl(readRequiredString(request.input.url, 'url'), allowPrivateNetwork);
  const maxChars = readOptionalPositiveInteger(request.input.maxChars, maxWebTextChars);
  const response = await fetch(url.toString(), {
    headers: {
      accept: 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'user-agent': 'QiuAI-WorkOS-Desktop/1.0'
    },
    signal: AbortSignal.timeout(webFetchTimeoutMs)
  });
  const contentType = response.headers.get('content-type') ?? '';
  const bodyText = await response.text();

  if (!response.ok) {
    return fail(request, `Web fetch returned HTTP ${response.status}.`);
  }

  const normalizedText = contentType.includes('html')
    ? extractReadableTextFromHtml(bodyText)
    : bodyText;
  const text = truncate(normalizedText, maxChars);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      url: url.toString(),
      status: response.status,
      contentType,
      title: contentType.includes('html') ? extractHtmlTitle(bodyText) : undefined,
      text,
      truncated: normalizedText.length > text.length
    }
  };
}

async function searchWeb(
  request: DesktopToolInvocationRequest,
  settings?: {
    endpoint?: string;
    apiKey?: string;
    allowPrivateNetwork?: boolean;
  }
): Promise<DesktopToolInvocationResult> {
  const query = readRequiredString(request.input.query, 'query');
  const maxResults = Math.min(readOptionalPositiveInteger(request.input.maxResults, 5), 10);
  const endpoint = normalizeConfiguredString(settings?.endpoint) ?? process.env.QIUAI_WEB_SEARCH_ENDPOINT?.trim();
  const allowPrivateNetwork =
    settings?.allowPrivateNetwork ?? process.env.QIUAI_DESKTOP_ALLOW_PRIVATE_WEB_TOOL === 'true';

  if (!endpoint) {
    return {
      toolId: request.toolId,
      action: request.action,
      ok: false,
      message:
        'Web search endpoint is not configured. Set it in the Tool Center, or provide QIUAI_WEB_SEARCH_ENDPOINT for development.'
    };
  }

  const endpointUrl = normalizePublicHttpUrl(endpoint, allowPrivateNetwork);
  endpointUrl.searchParams.set('q', query);
  endpointUrl.searchParams.set('count', String(maxResults));

  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'QiuAI-WorkOS-Desktop/1.0'
  };
  const apiKey = normalizeConfiguredString(settings?.apiKey) ?? process.env.QIUAI_WEB_SEARCH_API_KEY?.trim();
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(endpointUrl.toString(), {
    headers,
    signal: AbortSignal.timeout(webFetchTimeoutMs)
  });
  const bodyText = await response.text();

  if (!response.ok) {
    return fail(request, `Web search returned HTTP ${response.status}.`);
  }

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      query,
      results: normalizeSearchResults(bodyText).slice(0, maxResults)
    }
  };
}

function writeOfficeMarkdownDocument(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  const title = readString(request.input.title, 'document');
  const content = readString(request.input.content, '');
  const folder = readString(request.input.folder, 'documents');
  const fileName = readString(request.input.fileName, title);
  return writeToolAssetFile(userDataPath, request, {
    category: 'office',
    folder,
    fileName,
    extension: 'md',
    content: `# ${title}\n\n${content.trim()}\n`
  });
}

function writeSpreadsheetCsv(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  const folder = readString(request.input.folder, 'spreadsheets');
  const fileName = readString(request.input.fileName, 'sheet');
  const content = Array.isArray(request.input.rows)
    ? csvFromRows(request.input.rows)
    : readString(request.input.content, '');

  return writeToolAssetFile(userDataPath, request, {
    category: 'office',
    folder,
    fileName,
    extension: 'csv',
    content
  });
}

function writePresentationOutline(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): DesktopToolInvocationResult {
  const title = readString(request.input.title, 'presentation');
  const folder = readString(request.input.folder, 'presentations');
  const fileName = readString(request.input.fileName, title);
  const slides = Array.isArray(request.input.slides)
    ? request.input.slides.map(formatSlideOutline).filter(Boolean).join('\n\n')
    : readString(request.input.content, '');

  return writeToolAssetFile(userDataPath, request, {
    category: 'office',
    folder,
    fileName,
    extension: 'md',
    content: `# ${title}\n\n${slides.trim()}\n`
  });
}

function writeToolAssetFile(
  userDataPath: string,
  request: DesktopToolInvocationRequest,
  input: {
    category: string;
    folder: string;
    fileName: string;
    extension: string;
    content: string;
  }
): DesktopToolInvocationResult {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const outputFolderPath = path.join(
    layout.assetsPath,
    'tools',
    normalizePathSegment(input.category),
    normalizePathSegment(input.folder)
  );
  const outputPath = path.join(
    outputFolderPath,
    `${normalizePathSegment(input.fileName)}.${input.extension}`
  );

  mkdirSync(outputFolderPath, { recursive: true });
  writeFileSync(outputPath, input.content, { encoding: 'utf8' });

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      localPath: outputPath,
      bytes: Buffer.byteLength(input.content, 'utf8')
    }
  };
}

function fail(
  request: DesktopToolInvocationRequest,
  message: string
): DesktopToolInvocationResult {
  return {
    toolId: request.toolId,
    action: request.action,
    ok: false,
    message
  };
}

function readRequiredString(value: unknown, fieldName: string): string {
  const text = readString(value, '');
  if (!text) {
    throw new Error(`Tool input ${fieldName} is required.`);
  }

  return text;
}

function readOptionalPositiveInteger(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error('Tool input must be a positive integer.');
  }

  return value;
}

function normalizePublicHttpUrl(value: string, allowPrivateNetwork = false): URL {
  const url = new URL(value);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are supported.');
  }

  if (!allowPrivateNetwork && isLikelyPrivateHost(url.hostname)) {
    throw new Error('Localhost and private network URLs are blocked by default for web tools.');
  }

  return url;
}

function assertReadPathAllowed(request: DesktopToolInvocationRequest, targetPath: string): void {
  if (!request.allowedRootPaths) {
    return;
  }

  const allowedRootPaths = request.allowedRootPaths
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedRootPaths.length === 0) {
    throw new Error('No allowed local read roots are configured for this task.');
  }

  if (!allowedRootPaths.some((rootPath) => isPathInsideRoot(targetPath, rootPath))) {
    throw new Error('Path is outside the allowed local knowledge roots.');
  }
}

function isPathInsideRoot(targetPath: string, rootPath: string): boolean {
  const resolvedTargetPath = path.resolve(targetPath);
  const resolvedRootPath = path.resolve(rootPath);
  const relativePath = path.relative(resolvedRootPath, resolvedTargetPath);

  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function readString(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function isLikelyPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost')) {
    return true;
  }

  if (host === '0.0.0.0' || host.startsWith('127.')) {
    return true;
  }

  if (host.startsWith('10.') || host.startsWith('192.168.')) {
    return true;
  }

  const parts = host.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length === 4 && parts.every((part) => Number.isInteger(part))) {
    const [first, second] = parts;
    return first === 172 && second !== undefined && second >= 16 && second <= 31;
  }

  return false;
}

function normalizeConfiguredString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function extractHtmlTitle(html: string): string | undefined {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtmlEntities(match[1]).replace(/\s+/g, ' ').trim() : undefined;
}

function extractReadableTextFromHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function normalizeSearchResults(bodyText: string): Array<Record<string, unknown>> {
  const parsed = parseJson(bodyText);
  if (!parsed) {
    return [];
  }

  if (Array.isArray(parsed)) {
    return parsed.map(normalizeSearchResult).filter(Boolean) as Array<Record<string, unknown>>;
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const record = parsed as Record<string, unknown>;
    const candidates = [record.results, record.items, record.webPages];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeSearchResult).filter(Boolean) as Array<Record<string, unknown>>;
      }

      if (
        typeof candidate === 'object' &&
        candidate !== null &&
        Array.isArray((candidate as Record<string, unknown>).value)
      ) {
        return ((candidate as Record<string, unknown>).value as unknown[])
          .map(normalizeSearchResult)
          .filter(Boolean) as Array<Record<string, unknown>>;
      }
    }
  }

  return [];
}

function normalizeSearchResult(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const title = readSearchString(record.title) ?? readSearchString(record.name);
  const url = readSearchString(record.url) ?? readSearchString(record.link);
  const snippet = readSearchString(record.snippet) ?? readSearchString(record.description);

  if (!title && !url && !snippet) {
    return undefined;
  }

  return { title, url, snippet };
}

function readSearchString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function csvFromRows(rows: unknown[]): string {
  return rows.map((row) => {
    if (Array.isArray(row)) {
      return row.map(csvCell).join(',');
    }

    if (typeof row === 'object' && row !== null) {
      return Object.values(row).map(csvCell).join(',');
    }

    return csvCell(row);
  }).join('\n');
}

function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function formatSlideOutline(value: unknown, index: number): string {
  if (typeof value === 'string') {
    return `## ${index + 1}. ${value.trim()}`;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return '';
  }

  const record = value as Record<string, unknown>;
  const title = readString(record.title, `Slide ${index + 1}`);
  const bullets = Array.isArray(record.bullets)
    ? record.bullets.map((bullet) => `- ${String(bullet)}`).join('\n')
    : readString(record.content, '');

  return [`## ${index + 1}. ${title}`, bullets].filter(Boolean).join('\n');
}
