import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync
} from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';

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
const httpRequestToolId = 'http-request';
const mcpToolId = 'mcp';
const maxReadBytes = 64 * 1024;
const maxDirectoryEntries = 100;
const maxWebTextChars = 24_000;
const maxExtractedDocumentChars = 30_000;
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
      return await invokeOfficeDocumentTool(userDataPath, request);
    }

    if (request.toolId === httpRequestToolId) {
      return await invokeHttpRequestTool(request);
    }

    if (request.toolId === mcpToolId) {
      return await invokeMcpTool(request);
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

async function invokeOfficeDocumentTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  switch (request.action) {
    case 'document.extract_text':
      return extractDocumentText(request);
    case 'office.write_markdown_document':
      return writeOfficeMarkdownDocument(userDataPath, request);
    case 'office.write_docx_document':
      return await writeOfficeDocxDocument(userDataPath, request);
    case 'spreadsheet.write_csv':
      return writeSpreadsheetCsv(userDataPath, request);
    case 'spreadsheet.write_xlsx':
      return await writeSpreadsheetXlsx(userDataPath, request);
    case 'presentation.write_pptx':
      return await writePresentationPptx(userDataPath, request);
    case 'presentation.write_outline_markdown':
      return writePresentationOutline(userDataPath, request);
    default:
      return fail(request, `Unsupported office document action: ${request.action}`);
  }
}

async function invokeHttpRequestTool(
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  if (request.action !== 'http.request') {
    return fail(request, `Unsupported HTTP action: ${request.action}`);
  }

  const allowPrivateNetwork =
    request.input.allowPrivateNetwork === true ||
    process.env.QIUAI_DESKTOP_ALLOW_PRIVATE_HTTP_TOOL === 'true';
  const url = normalizePublicHttpUrl(readRequiredString(request.input.url, 'url'), allowPrivateNetwork);
  const method = readHttpMethod(request.input.method);
  const headers = readStringRecord(request.input.headers);
  const body = readHttpRequestBody(request.input.body, headers);
  const maxChars = Math.min(readOptionalPositiveInteger(request.input.maxChars, maxWebTextChars), 80_000);
  const response = await fetch(url.toString(), {
    method,
    headers: {
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'QiuAI-WorkOS-Desktop/1.0',
      ...headers
    },
    body,
    signal: AbortSignal.timeout(readOptionalPositiveInteger(request.input.timeoutMs, webFetchTimeoutMs))
  });
  const bodyText = await response.text();
  const text = truncate(bodyText, maxChars);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: response.ok,
    output: {
      url: url.toString(),
      method,
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type') ?? undefined,
      text,
      json: parseJson(text),
      truncated: bodyText.length > text.length
    },
    message: response.ok ? undefined : `HTTP request returned ${response.status}.`
  };
}

async function invokeMcpTool(
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  if (request.action !== 'mcp.call') {
    return fail(request, `Unsupported MCP action: ${request.action}`);
  }

  const allowPrivateNetwork =
    request.input.allowPrivateNetwork === true ||
    process.env.QIUAI_DESKTOP_ALLOW_PRIVATE_MCP_TOOL === 'true';
  const endpoint = normalizePublicHttpUrl(
    readRequiredString(request.input.endpoint, 'endpoint'),
    allowPrivateNetwork
  );
  const toolName = readRequiredString(request.input.toolName ?? request.input.name, 'toolName');
  const args = isRecord(request.input.arguments) ? request.input.arguments : {};
  const requestId = readString(request.input.id, `qiuai-${Date.now()}`);
  const payload = {
    jsonrpc: '2.0',
    id: requestId,
    method: readString(request.input.method, 'tools/call'),
    params: {
      name: toolName,
      arguments: args
    }
  };
  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'user-agent': 'QiuAI-WorkOS-Desktop/1.0',
      ...readStringRecord(request.input.headers)
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(readOptionalPositiveInteger(request.input.timeoutMs, webFetchTimeoutMs))
  });
  const bodyText = await response.text();
  const parsed = parseJson(bodyText);
  const errorMessage = readMcpErrorMessage(parsed);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: response.ok && !errorMessage,
    output: {
      endpoint: endpoint.toString(),
      toolName,
      response: parsed ?? bodyText,
      text: extractMcpTextContent(parsed) ?? truncate(bodyText, maxWebTextChars)
    },
    message: errorMessage ?? (response.ok ? undefined : `MCP gateway returned HTTP ${response.status}.`)
  };
}

async function extractDocumentText(request: DesktopToolInvocationRequest): Promise<DesktopToolInvocationResult> {
  const filePath = readRequiredString(request.input.path, 'path');
  assertReadPathAllowed(request, filePath);
  const stats = statSync(filePath);

  if (!stats.isFile()) {
    return fail(request, `Path is not a file: ${filePath}`);
  }

  const maxChars = readOptionalPositiveInteger(request.input.maxChars, maxExtractedDocumentChars);
  const extension = path.extname(filePath).toLowerCase();
  let text: string;

  if (isPlainTextDocumentExtension(extension)) {
    const rawText = readFileSync(filePath, 'utf8');
    text = extension === '.html' || extension === '.htm'
      ? extractReadableTextFromHtml(rawText)
      : rawText;
  } else if (extension === '.docx') {
    text = await extractDocxText(filePath);
  } else if (extension === '.pptx') {
    text = await extractPptxText(filePath);
  } else if (extension === '.xlsx') {
    text = await extractXlsxText(filePath);
  } else if (extension === '.pdf') {
    return fail(request, 'PDF text extraction is not supported yet. Convert the PDF to text or Word for this version.');
  } else {
    return fail(request, `Unsupported document extension for text extraction: ${extension || 'unknown'}.`);
  }

  const normalizedText = normalizeExtractedText(text);
  const truncatedText = truncate(normalizedText, maxChars);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      path: filePath,
      fileName: path.basename(filePath),
      extension: extension || undefined,
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      text: truncatedText,
      truncated: normalizedText.length > truncatedText.length
    }
  };
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

async function writeOfficeDocxDocument(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const title = readString(request.input.title, 'document');
  const content = readString(request.input.content, '');
  const folder = readString(request.input.folder, 'documents');
  const fileName = readString(request.input.fileName, title);
  const buffer = await buildDocxBuffer(title, content);

  return writeToolAssetBinaryFile(userDataPath, request, {
    category: 'office',
    folder,
    fileName,
    extension: 'docx',
    content: buffer
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

async function writeSpreadsheetXlsx(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const folder = readString(request.input.folder, 'spreadsheets');
  const fileName = readString(request.input.fileName, 'sheet');
  const rows = Array.isArray(request.input.rows)
    ? request.input.rows
    : [['Content'], [readString(request.input.content, '')]];
  const buffer = await buildXlsxBuffer(rows);

  return writeToolAssetBinaryFile(userDataPath, request, {
    category: 'office',
    folder,
    fileName,
    extension: 'xlsx',
    content: buffer
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

async function writePresentationPptx(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const title = readString(request.input.title, 'presentation');
  const folder = readString(request.input.folder, 'presentations');
  const fileName = readString(request.input.fileName, title);
  const slides = normalizePresentationSlides(request.input.slides, readString(request.input.content, ''));
  const buffer = await buildPptxBuffer(title, slides);

  return writeToolAssetBinaryFile(userDataPath, request, {
    category: 'office',
    folder,
    fileName,
    extension: 'pptx',
    content: buffer
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

function writeToolAssetBinaryFile(
  userDataPath: string,
  request: DesktopToolInvocationRequest,
  input: {
    category: string;
    folder: string;
    fileName: string;
    extension: string;
    content: Buffer;
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
  writeFileSync(outputPath, input.content);

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      localPath: outputPath,
      bytes: input.content.byteLength
    }
  };
}

async function buildDocxBuffer(title: string, content: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
      '</Types>'
    ].join('')
  );
  zip.file(
    '_rels/.rels',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
      '</Relationships>'
    ].join('')
  );
  zip.file('word/document.xml', buildDocxDocumentXml(title, content));

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function buildDocxDocumentXml(title: string, content: string): string {
  const paragraphs = [title, '', ...content.replace(/\r\n/g, '\n').split('\n')]
    .map((line) => formatDocxParagraph(stripMarkdownPrefix(line)))
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    paragraphs,
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
    '</w:body>',
    '</w:document>'
  ].join('');
}

function formatDocxParagraph(text: string): string {
  if (!text.trim()) {
    return '<w:p/>';
  }

  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

async function buildXlsxBuffer(rows: unknown[]): Promise<Buffer> {
  const normalizedRows = normalizeSpreadsheetRows(rows);
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
      '</Types>'
    ].join('')
  );
  zip.file(
    '_rels/.rels',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      '</Relationships>'
    ].join('')
  );
  zip.file(
    'xl/workbook.xml',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets>',
      '</workbook>'
    ].join('')
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
      '</Relationships>'
    ].join('')
  );
  zip.file('xl/worksheets/sheet1.xml', buildXlsxWorksheetXml(normalizedRows));

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function normalizeSpreadsheetRows(rows: unknown[]): string[][] {
  const normalizedRows = rows
    .map((row) => {
      if (Array.isArray(row)) {
        return row.map((cell) => formatSpreadsheetCellValue(cell));
      }

      return [formatSpreadsheetCellValue(row)];
    })
    .filter((row) => row.length > 0);

  return normalizedRows.length > 0 ? normalizedRows : [['Content'], ['']];
}

function buildXlsxWorksheetXml(rows: string[][]): string {
  const sheetData = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((cell, columnIndex) => {
          const cellRef = `${toSpreadsheetColumnName(columnIndex + 1)}${rowNumber}`;
          return `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(cell)}</t></is></c>`;
        })
        .join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    `<sheetData>${sheetData}</sheetData>`,
    '</worksheet>'
  ].join('');
}

function toSpreadsheetColumnName(columnNumber: number): string {
  let value = columnNumber;
  let columnName = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    columnName = String.fromCharCode(65 + remainder) + columnName;
    value = Math.floor((value - remainder - 1) / 26);
  }

  return columnName;
}

function formatSpreadsheetCellValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

interface PresentationSlide {
  title: string;
  bullets: string[];
}

async function buildPptxBuffer(title: string, slides: PresentationSlide[]): Promise<Buffer> {
  const normalizedSlides = slides.length > 0 ? slides : [{ title, bullets: [''] }];
  const zip = new JSZip();
  zip.file('[Content_Types].xml', buildPptxContentTypesXml(normalizedSlides.length));
  zip.file('_rels/.rels', buildPptxPackageRelationshipsXml());
  zip.file('docProps/core.xml', buildPptxCorePropertiesXml(title));
  zip.file('docProps/app.xml', buildPptxAppPropertiesXml(normalizedSlides.length));
  zip.file('ppt/presentation.xml', buildPptxPresentationXml(normalizedSlides.length));
  zip.file('ppt/_rels/presentation.xml.rels', buildPptxPresentationRelationshipsXml(normalizedSlides.length));
  zip.file('ppt/slideMasters/slideMaster1.xml', buildPptxSlideMasterXml());
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', buildPptxSlideMasterRelationshipsXml());
  zip.file('ppt/slideLayouts/slideLayout1.xml', buildPptxSlideLayoutXml());
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', buildPptxSlideLayoutRelationshipsXml());
  zip.file('ppt/theme/theme1.xml', buildPptxThemeXml());

  normalizedSlides.forEach((slide, index) => {
    const slideNumber = index + 1;
    zip.file(`ppt/slides/slide${slideNumber}.xml`, buildPptxSlideXml(slide, slideNumber));
    zip.file(`ppt/slides/_rels/slide${slideNumber}.xml.rels`, buildPptxSlideRelationshipsXml());
  });

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function normalizePresentationSlides(slidesInput: unknown, content: string): PresentationSlide[] {
  if (Array.isArray(slidesInput)) {
    const slides = slidesInput
      .map(normalizePresentationSlide)
      .filter((slide): slide is PresentationSlide => Boolean(slide));
    if (slides.length > 0) {
      return slides;
    }
  }

  const slidesFromContent = parsePresentationSlidesFromMarkdown(content);
  return slidesFromContent.length > 0 ? slidesFromContent : [{ title: 'Result', bullets: [content || ''] }];
}

function normalizePresentationSlide(value: unknown, index: number): PresentationSlide | undefined {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? { title: `Slide ${index + 1}`, bullets: [text] } : undefined;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const title = readString(record.title, `Slide ${index + 1}`);
  const bullets = Array.isArray(record.bullets)
    ? record.bullets.map((bullet) => String(bullet).trim()).filter(Boolean)
    : splitPresentationBulletText(readString(record.content, ''));

  return {
    title,
    bullets: bullets.length > 0 ? bullets : ['']
  };
}

function parsePresentationSlidesFromMarkdown(content: string): PresentationSlide[] {
  const normalizedContent = content.replace(/\r\n/g, '\n').trim();
  if (!normalizedContent) {
    return [];
  }

  const sections = normalizedContent
    .split(/\n(?=#{1,3}\s+)/)
    .map((section) => section.trim())
    .filter(Boolean);

  if (sections.length <= 1) {
    return [
      {
        title: readFirstMeaningfulLine(normalizedContent) ?? 'Result',
        bullets: splitPresentationBulletText(normalizedContent).slice(0, 8)
      }
    ];
  }

  return sections.map((section, index) => {
    const lines = section.split('\n').map((line) => line.trim()).filter(Boolean);
    const title = stripMarkdownPrefix(lines[0] ?? `Slide ${index + 1}`);
    return {
      title: title || `Slide ${index + 1}`,
      bullets: splitPresentationBulletText(lines.slice(1).join('\n')).slice(0, 8)
    };
  });
}

function splitPresentationBulletText(value: string): string[] {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => stripMarkdownPrefix(line).trim())
    .filter(Boolean)
    .slice(0, 8);
}

function readFirstMeaningfulLine(value: string): string | undefined {
  return value
    .split(/\r?\n/)
    .map((line) => stripMarkdownPrefix(line).trim())
    .find(Boolean);
}

function buildPptxContentTypesXml(slideCount: number): string {
  const slideOverrides = Array.from({ length: slideCount }, (_, index) => {
    const slideNumber = index + 1;
    return `<Override PartName="/ppt/slides/slide${slideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`;
  }).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>',
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>',
    '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>',
    '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>',
    '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>',
    '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>',
    slideOverrides,
    '</Types>'
  ].join('');
}

function buildPptxPackageRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>',
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>',
    '</Relationships>'
  ].join('');
}

function buildPptxCorePropertiesXml(title: string): string {
  const createdAt = new Date().toISOString();
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">',
    `<dc:title>${escapeXml(title)}</dc:title>`,
    '<dc:creator>QiuAI WorkOS</dc:creator>',
    `<dcterms:created xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:created>`,
    `<dcterms:modified xsi:type="dcterms:W3CDTF">${createdAt}</dcterms:modified>`,
    '</cp:coreProperties>'
  ].join('');
}

function buildPptxAppPropertiesXml(slideCount: number): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">',
    '<Application>QiuAI WorkOS</Application>',
    `<Slides>${slideCount}</Slides>`,
    '</Properties>'
  ].join('');
}

function buildPptxPresentationXml(slideCount: number): string {
  const slideIds = Array.from({ length: slideCount }, (_, index) => {
    const slideNumber = index + 1;
    return `<p:sldId id="${255 + slideNumber}" r:id="rId${slideNumber}"/>`;
  }).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    `<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId${slideCount + 1}"/></p:sldMasterIdLst>`,
    `<p:sldIdLst>${slideIds}</p:sldIdLst>`,
    '<p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>',
    '<p:notesSz cx="6858000" cy="9144000"/>',
    '</p:presentation>'
  ].join('');
}

function buildPptxPresentationRelationshipsXml(slideCount: number): string {
  const slideRelationships = Array.from({ length: slideCount }, (_, index) => {
    const slideNumber = index + 1;
    return `<Relationship Id="rId${slideNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNumber}.xml"/>`;
  }).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    slideRelationships,
    `<Relationship Id="rId${slideCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>`,
    '</Relationships>'
  ].join('');
}

function buildPptxSlideXml(slide: PresentationSlide, index: number): string {
  const bulletParagraphs = slide.bullets
    .slice(0, 8)
    .map((bullet) => buildPptxTextParagraph(bullet, 0))
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '<p:cSld>',
    '<p:spTree>',
    buildPptxShapeTreeProperties(),
    buildPptxTextBox(2, `Title ${index}`, slide.title, 700000, 450000, 10800000, 900000, 3600, true),
    buildPptxTextBox(3, `Body ${index}`, bulletParagraphs, 950000, 1550000, 10300000, 4200000, 2200, false),
    '</p:spTree>',
    '</p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:sld>'
  ].join('');
}

function buildPptxTextBox(
  id: number,
  name: string,
  textOrParagraphs: string,
  x: number,
  y: number,
  cx: number,
  cy: number,
  fontSize: number,
  isPlainText: boolean
): string {
  const paragraphs = isPlainText ? buildPptxTextParagraph(textOrParagraphs, fontSize) : textOrParagraphs;

  return [
    '<p:sp>',
    `<p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>`,
    `<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln><a:noFill/></a:ln></p:spPr>`,
    '<p:txBody><a:bodyPr wrap="square" rtlCol="0"/><a:lstStyle/>',
    paragraphs || '<a:p/>',
    '</p:txBody>',
    '</p:sp>'
  ].join('');
}

function buildPptxTextParagraph(text: string, fontSize: number): string {
  const runProperties = fontSize > 0 ? `<a:rPr lang="zh-CN" sz="${fontSize}"/>` : '<a:rPr lang="zh-CN"/>';
  return `<a:p><a:r>${runProperties}<a:t>${escapeXml(text)}</a:t></a:r></a:p>`;
}

function buildPptxShapeTreeProperties(): string {
  return [
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
    '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
  ].join('');
}

function buildPptxSlideRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
    '</Relationships>'
  ].join('');
}

function buildPptxSlideMasterXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">',
    '<p:cSld><p:spTree>',
    buildPptxShapeTreeProperties(),
    '</p:spTree></p:cSld>',
    '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>',
    '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>',
    '<p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles>',
    '</p:sldMaster>'
  ].join('');
}

function buildPptxSlideMasterRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>',
    '</Relationships>'
  ].join('');
}

function buildPptxSlideLayoutXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1">',
    '<p:cSld name="Blank"><p:spTree>',
    buildPptxShapeTreeProperties(),
    '</p:spTree></p:cSld>',
    '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>',
    '</p:sldLayout>'
  ].join('');
}

function buildPptxSlideLayoutRelationshipsXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>',
    '</Relationships>'
  ].join('');
}

function buildPptxThemeXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="QiuAI">',
    '<a:themeElements>',
    '<a:clrScheme name="QiuAI"><a:dk1><a:srgbClr val="111827"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F9FAFB"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="059669"/></a:accent2><a:accent3><a:srgbClr val="D97706"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="DC2626"/></a:accent5><a:accent6><a:srgbClr val="0891B2"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme>',
    '<a:fontScheme name="QiuAI"><a:majorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Microsoft YaHei"/></a:majorFont><a:minorFont><a:latin typeface="Microsoft YaHei"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Microsoft YaHei"/></a:minorFont></a:fontScheme>',
    '<a:fmtScheme name="QiuAI"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme>',
    '</a:themeElements>',
    '</a:theme>'
  ].join('');
}

function stripMarkdownPrefix(line: string): string {
  return line.replace(/^\s{0,3}(#{1,6}|[-*+]|\d+\.)\s+/, '').trimEnd();
}

function escapeXml(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isPlainTextDocumentExtension(extension: string): boolean {
  return [
    '.txt',
    '.md',
    '.markdown',
    '.csv',
    '.tsv',
    '.json',
    '.jsonl',
    '.log',
    '.xml',
    '.html',
    '.htm'
  ].includes(extension);
}

async function extractDocxText(filePath: string): Promise<string> {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const xmlFiles = await readZipXmlFiles(zip, /^word\/(?:document|footnotes|endnotes|comments|header\d+|footer\d+)\.xml$/);
  return xmlFiles.map(extractTextFromXml).filter(Boolean).join('\n\n');
}

async function extractPptxText(filePath: string): Promise<string> {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const slideFiles = await readZipXmlFiles(zip, /^ppt\/slides\/slide\d+\.xml$/);
  return slideFiles
    .map((xml, index) => {
      const text = extractTextFromXml(xml);
      return text ? `Slide ${index + 1}\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

async function extractXlsxText(filePath: string): Promise<string> {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const sharedStrings = await readZipXmlFiles(zip, /^xl\/sharedStrings\.xml$/);
  const worksheets = await readZipXmlFiles(zip, /^xl\/worksheets\/sheet\d+\.xml$/);
  const sharedText = sharedStrings.map(extractTextFromXml).filter(Boolean).join('\n');
  const worksheetText = worksheets
    .map((xml, index) => {
      const text = extractTextFromXml(xml);
      return text ? `Sheet ${index + 1}\n${text}` : '';
    })
    .filter(Boolean)
    .join('\n\n');

  return [sharedText, worksheetText].filter(Boolean).join('\n\n');
}

async function readZipXmlFiles(zip: JSZip, pattern: RegExp): Promise<string[]> {
  const files = Object.values(zip.files)
    .filter((file) => !file.dir && pattern.test(file.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));

  return Promise.all(files.map((file) => file.async('string')));
}

function extractTextFromXml(xml: string): string {
  return decodeHtmlEntities(
    xml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

function normalizeExtractedText(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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

function readHttpMethod(value: unknown): string {
  const method = readString(value, 'GET').toUpperCase();
  if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    throw new Error(`Unsupported HTTP method: ${method}.`);
  }

  return method;
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      .map(([key, entryValue]) => [key, entryValue])
  );
}

function readHttpRequestBody(
  value: unknown,
  headers: Record<string, string>
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (isRecord(value) || Array.isArray(value)) {
    if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
      headers['content-type'] = 'application/json';
    }
    return JSON.stringify(value);
  }

  throw new Error('Unsupported HTTP request body type.');
}

function readMcpErrorMessage(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.error)) {
    return undefined;
  }

  const message = value.error.message;
  return typeof message === 'string' && message.trim() ? message.trim() : 'MCP gateway returned an error.';
}

function extractMcpTextContent(value: unknown): string | undefined {
  if (!isRecord(value) || !isRecord(value.result)) {
    return undefined;
  }

  const content = value.result.content;
  if (!Array.isArray(content)) {
    return undefined;
  }

  const text = content
    .flatMap((item) => {
      if (!isRecord(item) || item.type !== 'text' || typeof item.text !== 'string') {
        return [];
      }

      return [item.text];
    })
    .join('\n')
    .trim();

  return text || undefined;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
