import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'node:fs';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
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
import { loadPdfParse } from './pdf-parse-loader.js';

const localFilesystemToolId = 'local-filesystem';
const webSearchToolId = 'web-search';
const officeDocumentToolId = 'office-document';
const browserAutomationToolId = 'browser-automation';
const httpRequestToolId = 'http-request';
const mcpToolId = 'mcp';
const videoProcessingToolId = 'video-processing';
const maxReadBytes = 64 * 1024;
const maxDirectoryEntries = 100;
const maxWebTextChars = 24_000;
const maxBrowserTextChars = 50_000;
const maxBrowserSteps = 30;
const maxExtractedDocumentChars = 30_000;
const maxRemoteToolAssetBytes = 500 * 1024 * 1024;
const webFetchTimeoutMs = 15_000;
const browserLoadTimeoutMs = 30_000;
const builtInWebSearchBingEndpoint = 'https://cn.bing.com/search';
const builtInWebSearchHtmlEndpoint = 'https://html.duckduckgo.com/html/';
const builtInWebSearchInstantEndpoint = 'https://api.duckduckgo.com/';
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

export async function invokeDesktopTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const runtimeState = await loadDesktopRuntimeState(userDataPath, request.workspaceId);
  const webSearchSettings = runtimeState?.localRuntime.toolSettings?.webSearch;

  try {
    if (request.toolId === localFilesystemToolId) {
      return await invokeLocalFilesystemTool(userDataPath, request);
    }

    if (request.toolId === webSearchToolId) {
      return await invokeWebSearchTool(request, webSearchSettings);
    }

    if (request.toolId === officeDocumentToolId) {
      return await invokeOfficeDocumentTool(userDataPath, request);
    }

    if (request.toolId === browserAutomationToolId) {
      return await invokeBrowserAutomationTool(userDataPath, request);
    }

    if (request.toolId === httpRequestToolId) {
      return await invokeHttpRequestTool(request);
    }

    if (request.toolId === mcpToolId) {
      return await invokeMcpTool(request);
    }

    if (request.toolId === videoProcessingToolId) {
      return await invokeVideoProcessingTool(userDataPath, request);
    }

    return fail(request, `Unsupported desktop tool: ${request.toolId}`);
  } catch (error) {
    return fail(request, error instanceof Error ? error.message : 'Desktop tool invocation failed.');
  }
}

async function invokeLocalFilesystemTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  switch (request.action) {
    case 'filesystem.write_text_file':
      return writeTextFile(userDataPath, request);
    case 'filesystem.read_text_file':
      return readTextFile(request);
    case 'filesystem.list_directory':
      return listDirectory(request);
    case 'filesystem.download_remote_file':
      return await downloadRemoteFile(userDataPath, request);
    case 'filesystem.package_zip':
      return await packageZipFile(userDataPath, request);
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
    case 'spreadsheet.read_xlsx':
      return await readSpreadsheetXlsx(request);
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

async function invokeBrowserAutomationTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  switch (request.action) {
    case 'browser.open_url':
      return await openBrowserAutomationUrl(userDataPath, request, false);
    case 'browser.extract_text':
      return await openBrowserAutomationUrl(userDataPath, request, true);
    case 'browser.run_steps':
      return await runBrowserAutomationSteps(userDataPath, request);
    default:
      return fail(request, `Unsupported browser automation action: ${request.action}`);
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

async function openBrowserAutomationUrl(
  userDataPath: string,
  request: DesktopToolInvocationRequest,
  extractText: boolean
): Promise<DesktopToolInvocationResult> {
  const url = normalizePublicHttpUrl(
    readRequiredString(request.input.url, 'url'),
    request.input.allowPrivateNetwork === true
  );
  const window = await createRpaBrowserWindow(userDataPath, request);
  await loadRpaBrowserUrl(window, url.toString(), readOptionalPositiveInteger(request.input.timeoutMs, browserLoadTimeoutMs));
  const waitForUserSeconds = Math.min(readOptionalPositiveInteger(request.input.waitForUserSeconds, 1), 600);
  if (waitForUserSeconds > 1) {
    await delay(waitForUserSeconds * 1000);
  }

  const snapshot = extractText
    ? await extractRpaBrowserSnapshot(
        window,
        Math.min(readOptionalPositiveInteger(request.input.maxChars, maxBrowserTextChars), 120_000)
      )
    : undefined;
  const currentUrl = await readRpaBrowserUrl(window);
  const currentTitle = await readRpaBrowserTitle(window);
  const windowId = typeof window.id === 'number' ? window.id : undefined;

  if (request.input.closeAfter === true) {
    window.close();
  }

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      url: currentUrl,
      title: currentTitle,
      windowId,
      manualLoginSupported: true,
      ...(snapshot ?? {})
    }
  };
}

async function runBrowserAutomationSteps(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const steps = normalizeBrowserAutomationSteps(request.input.steps);
  if (steps.length === 0) {
    return fail(request, 'Tool input steps must contain at least one browser automation step.');
  }

  const window = await createRpaBrowserWindow(userDataPath, request);
  const outputs: Array<Record<string, unknown>> = [];
  const timeoutMs = readOptionalPositiveInteger(request.input.timeoutMs, browserLoadTimeoutMs);
  const maxChars = Math.min(readOptionalPositiveInteger(request.input.maxChars, maxBrowserTextChars), 120_000);

  for (const [index, step] of steps.entries()) {
    const type = readString(step.type, '');
    if (type === 'navigate') {
      const url = normalizePublicHttpUrl(readRequiredString(step.url, `steps[${index}].url`), step.allowPrivateNetwork === true);
      await loadRpaBrowserUrl(window, url.toString(), timeoutMs);
      outputs.push({ index, type, ok: true, url: await readRpaBrowserUrl(window) });
      continue;
    }

    if (type === 'wait') {
      const milliseconds = Math.min(readOptionalPositiveInteger(step.ms ?? step.timeoutMs, 1000), 120_000);
      await delay(milliseconds);
      outputs.push({ index, type, ok: true, ms: milliseconds });
      continue;
    }

    if (type === 'fill') {
      const selector = readRequiredString(step.selector, `steps[${index}].selector`);
      const value = readString(step.value, '');
      const ok = await executeRpaBrowserBoolean(
        window,
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.focus?.();
          el.value = ${JSON.stringify(value)};
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        })()`
      );
      outputs.push({ index, type, ok, selector });
      if (!ok && step.optional !== true) {
        return fail(request, `Browser automation step ${index + 1} failed: selector not found (${selector}).`);
      }
      continue;
    }

    if (type === 'click') {
      const selector = readRequiredString(step.selector, `steps[${index}].selector`);
      const ok = await executeRpaBrowserBoolean(
        window,
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (!el) return false;
          el.scrollIntoView?.({ block: 'center', inline: 'center' });
          el.click();
          return true;
        })()`
      );
      outputs.push({ index, type, ok, selector });
      if (!ok && step.optional !== true) {
        return fail(request, `Browser automation step ${index + 1} failed: selector not found (${selector}).`);
      }
      continue;
    }

    if (type === 'extract_text') {
      const snapshot = await extractRpaBrowserSnapshot(window, maxChars);
      outputs.push({ index, type, ok: true, ...snapshot });
      continue;
    }

    return fail(request, `Unsupported browser automation step type: ${type || '(empty)'}.`);
  }

  const currentUrl = await readRpaBrowserUrl(window);
  const currentTitle = await readRpaBrowserTitle(window);

  if (request.input.closeAfter === true) {
    window.close();
  }

  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      url: currentUrl,
      title: currentTitle,
      outputs
    }
  };
}

async function invokeVideoProcessingTool(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  switch (request.action) {
    case 'video.probe':
      return await probeVideo(request);
    case 'video.extract_audio':
      return await extractVideoAudio(userDataPath, request);
    case 'video.compose_clips':
    case 'video.export_mp4':
      return await composeVideoClips(userDataPath, request);
    case 'video.extract_frames':
      return await extractVideoFrames(userDataPath, request);
    default:
      return fail(request, `Unsupported video processing action: ${request.action}`);
  }
}

async function extractVideoAudio(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const videoPath = readVideoInputPath(request);
  assertReadPathAllowed(request, videoPath);
  if (!existsSync(videoPath) || !statSync(videoPath).isFile()) {
    return fail(request, `Video file does not exist: ${videoPath}`);
  }

  const extension = path.extname(videoPath).toLowerCase();
  if (!isVideoFileExtension(extension)) {
    return fail(request, `Unsupported video extension: ${extension || 'unknown'}.`);
  }

  const audioFormat = readAudioOutputFormat(request.input.audioFormat);
  const ffmpegPath = resolveFfmpegPath(request.input.ffmpegPath);
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);
  const folder = readString(request.input.folder, 'audios');
  const fileName = normalizePathSegment(
    readString(request.input.fileName, `${path.basename(videoPath, path.extname(videoPath))}-audio`)
  );
  const outputFolderPath = path.join(layout.assetsPath, 'tools', normalizePathSegment(folder));
  const outputPath = path.join(outputFolderPath, `${fileName}.${audioFormat}`);
  mkdirSync(outputFolderPath, { recursive: true });

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i',
        videoPath,
        '-vn',
        '-ac',
        '1',
        '-ar',
        '16000',
        '-b:a',
        '64k',
        outputPath
      ],
      { windowsHide: true, timeout: readOptionalPositiveInteger(request.input.timeoutMs, 180_000) }
    );
    const outputStats = statSync(outputPath);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: outputPath,
        fileName: path.basename(outputPath),
        sizeBytes: outputStats.size,
        sourceVideoPath: videoPath,
        audioFormat
      }
    };
  } catch (error) {
    return fail(
      request,
      [
        'Video audio extraction failed. Install FFmpeg or set QIUAI_FFMPEG_PATH to ffmpeg.exe, then retry.',
        error instanceof Error ? error.message : ''
      ]
        .filter(Boolean)
        .join(' ')
    );
  }
}

async function probeVideo(request: DesktopToolInvocationRequest): Promise<DesktopToolInvocationResult> {
  const videoPath = readVideoInputPath(request);
  assertReadPathAllowed(request, videoPath);
  const stats = statSync(videoPath);

  if (!stats.isFile()) {
    return fail(request, `Path is not a file: ${videoPath}`);
  }

  const extension = path.extname(videoPath).toLowerCase();
  if (!isVideoFileExtension(extension)) {
    return fail(request, `Unsupported video extension: ${extension || 'unknown'}.`);
  }

  const baseOutput = {
    localPath: videoPath,
    fileName: path.basename(videoPath),
    extension,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString()
  };
  const ffprobePath = resolveFfprobePath(request.input.ffprobePath);

  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      [
        '-v',
        'error',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        videoPath
      ],
      { windowsHide: true, timeout: readOptionalPositiveInteger(request.input.timeoutMs, 60_000) }
    );
    const metadata = normalizeFfprobeVideoMetadata(parseJson(stdout));

    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        ...baseOutput,
        ...metadata,
        probeAvailable: true
      }
    };
  } catch (error) {
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        ...baseOutput,
        probeAvailable: false,
        probeWarning: [
          'ffprobe unavailable or failed; only basic file metadata is available.',
          error instanceof Error ? error.message : ''
        ].filter(Boolean).join(' ')
      }
    };
  }
}

function normalizeFfprobeVideoMetadata(value: unknown): Record<string, unknown> {
  const record = isRecord(value) ? value : {};
  const streams = Array.isArray(record.streams) ? record.streams.filter(isRecord) : [];
  const format = isRecord(record.format) ? record.format : {};
  const videoStream = streams.find((stream) => stream.codec_type === 'video');
  const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
  const width = readPositiveNumber(videoStream?.width);
  const height = readPositiveNumber(videoStream?.height);
  const durationSeconds = readPositiveNumber(format.duration) ?? readPositiveNumber(videoStream?.duration);
  const frameRate = readFrameRate(videoStream?.avg_frame_rate) ?? readFrameRate(videoStream?.r_frame_rate);
  const aspectRatio = width && height ? `${width}:${height}` : undefined;

  return {
    width,
    height,
    durationSeconds,
    frameRate,
    aspectRatio,
    orientation: width && height ? width > height ? 'landscape' : width < height ? 'portrait' : 'square' : undefined,
    hasVideo: Boolean(videoStream),
    hasAudio: audioStreams.length > 0,
    videoCodec: readOptionalString(videoStream?.codec_name),
    audioCodec: readOptionalString(audioStreams[0]?.codec_name),
    audioStreamCount: audioStreams.length,
    bitRate: readPositiveNumber(format.bit_rate),
    formatName: readOptionalString(format.format_name)
  };
}

function readFrameRate(value: unknown): number | undefined {
  if (typeof value !== 'string' || !value.trim() || value === '0/0') {
    return undefined;
  }

  const [left, right] = value.split('/').map((item) => Number(item));
  if (right && Number.isFinite(left) && Number.isFinite(right)) {
    return Math.round((left / right) * 1000) / 1000;
  }

  const directValue = Number(value);
  return Number.isFinite(directValue) && directValue > 0 ? directValue : undefined;
}

function readPositiveNumber(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue * 1000) / 1000 : undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveFfmpegPath(value: unknown): string {
  return readString(
    value,
    process.env.QIUAI_FFMPEG_PATH?.trim() ||
      resolveInstallerBinaryPath('@ffmpeg-installer/ffmpeg') ||
      'ffmpeg'
  );
}

function resolveFfprobePath(value: unknown): string {
  return readString(
    value,
    process.env.QIUAI_FFPROBE_PATH?.trim() ||
      resolveInstallerBinaryPath('@ffprobe-installer/ffprobe') ||
      'ffprobe'
  );
}

function resolveInstallerBinaryPath(packageName: string): string | undefined {
  try {
    const packageExports = require(packageName) as unknown;
    const binaryPath = isRecord(packageExports) ? readString(packageExports.path, '') : '';
    return binaryPath && existsSync(binaryPath) ? binaryPath : undefined;
  } catch {
    return undefined;
  }
}

async function composeVideoClips(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const videoPaths = readVideoInputPaths(request);
  for (const videoPath of videoPaths) {
    assertReadPathAllowed(request, videoPath);
    if (!existsSync(videoPath) || !statSync(videoPath).isFile()) {
      return fail(request, `Video file does not exist: ${videoPath}`);
    }
  }

  const segments = readVideoCutPlan(request.input.cutPlan ?? request.input.segments);
  if (segments.length === 0) {
    return fail(request, 'Video cut plan must contain at least one segment with start and end seconds.');
  }

  const ffmpegPath = resolveFfmpegPath(request.input.ffmpegPath);
  const ffprobePath = resolveFfprobePath(request.input.ffprobePath);
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);
  const folder = readString(request.input.folder, 'videos');
  const primaryVideoPath = videoPaths[0]!;
  const fileName = normalizePathSegment(
    readString(request.input.fileName, `${path.basename(primaryVideoPath, path.extname(primaryVideoPath))}-edited`)
  );
  const outputFolderPath = path.join(layout.assetsPath, 'tools', normalizePathSegment(folder));
  const workingFolderPath = path.join(outputFolderPath, `.qiuai-video-${Date.now()}`);
  mkdirSync(workingFolderPath, { recursive: true });

  const renderSize = readVideoRenderSize(
    request.input.outputRatio ?? request.input.ratio ?? request.input.aspectRatio ?? request.input.videoRatio,
    request.input.outputResolution ?? request.input.resolution
  );
  const introPath = readOptionalExistingToolPath(request, request.input.introPath);
  const outroPath = readOptionalExistingToolPath(request, request.input.outroPath);
  const coverPath = readOptionalExistingToolPath(request, request.input.coverPath);
  const watermarkPath = readOptionalExistingToolPath(request, request.input.watermarkPath);
  const musicPath = readOptionalExistingToolPath(request, request.input.musicPath);
  const rawSegmentAudioPaths = Array.isArray(request.input.segmentAudioPaths)
    ? request.input.segmentAudioPaths
    : [];
  const segmentAudioPaths = rawSegmentAudioPaths.flatMap((value) => {
    const filePath = readString(value, '');
    return filePath ? [readOptionalExistingToolPath(request, filePath)!] : [];
  });
  const legacyVoiceoverPath = readOptionalExistingToolPath(
    request,
    request.input.voiceoverPath ?? request.input.voiceAudioPath
  );
  const preserveBaseAudio = request.input.preserveOriginalAudio === true;
  const hasLegacyVoiceover = Boolean(legacyVoiceoverPath) && segmentAudioPaths.length === 0 && !musicPath;
  const shouldMixBaseAudio = preserveBaseAudio && hasLegacyVoiceover;
  const shouldStripOriginalAudio =
    (segmentAudioPaths.length > 0 || Boolean(musicPath) || hasLegacyVoiceover) &&
    !shouldMixBaseAudio;
  const transitionEffect = readVideoTransitionEffect(request.input.transitionEffect);
  const clipTimeoutMs = readOptionalPositiveInteger(request.input.timeoutMs, 180_000);
  const clipEntries: Array<{ path: string; segmentAudioPath?: string }> = [];
  try {
    if (coverPath) {
      const coverClipPath = path.join(workingFolderPath, `clip-${clipEntries.length + 1}-cover.mp4`);
      await normalizeImageCoverClip({
        ffmpegPath,
        inputPath: coverPath,
        outputPath: coverClipPath,
        renderSize,
        durationSeconds: 1.5,
        timeoutMs: clipTimeoutMs
      });
      clipEntries.push({ path: coverClipPath });
    }

    if (introPath) {
      const introClipPath = path.join(workingFolderPath, `clip-${clipEntries.length + 1}-intro.mp4`);
      await normalizeVideoSourceClip({
        ffmpegPath,
        inputPath: introPath,
        outputPath: introClipPath,
        renderSize,
        includeAudio: preserveBaseAudio,
        timeoutMs: clipTimeoutMs
      });
      clipEntries.push({ path: introClipPath });
    }

    const indexedSegments = segments.map((segment, index) => ({ segment, index }));
    for (const [videoIndex, sourceVideoPath] of videoPaths.entries()) {
      const sourceSegments = indexedSegments.filter(({ segment }) => segment.sourceIndex === videoIndex + 1);
      const segmentsForVideo = videoPaths.length === 1 && sourceSegments.length === 0
        ? indexedSegments
        : sourceSegments;
      const renderSegments = segmentsForVideo.length > 0 ? segmentsForVideo : [{ segment: undefined, index: -1 }];

      for (const [segmentIndex, segmentEntry] of renderSegments.entries()) {
        const clipPath = path.join(
          workingFolderPath,
          `clip-${clipEntries.length + 1}-${videoIndex + 1}-${segmentIndex + 1}.mp4`
        );
        await normalizeVideoSourceClip({
          ffmpegPath,
          inputPath: sourceVideoPath,
          outputPath: clipPath,
          renderSize,
          segment: segmentEntry.segment,
          includeAudio: !shouldStripOriginalAudio,
          timeoutMs: clipTimeoutMs
        });
        clipEntries.push({
          path: clipPath,
          ...(segmentEntry.index >= 0 && segmentAudioPaths[segmentEntry.index]
            ? { segmentAudioPath: segmentAudioPaths[segmentEntry.index] }
            : {})
        });
      }
    }

    if (outroPath) {
      const outroClipPath = path.join(workingFolderPath, `clip-${clipEntries.length + 1}-outro.mp4`);
      await normalizeVideoSourceClip({
        ffmpegPath,
        inputPath: outroPath,
        outputPath: outroClipPath,
        renderSize,
        includeAudio: !shouldStripOriginalAudio,
        timeoutMs: clipTimeoutMs
      });
      clipEntries.push({ path: outroClipPath });
    }

    const clipPaths = clipEntries.map((entry) => entry.path);
    const clipDurations = await Promise.all(
      clipPaths.map((clipPath) => probeVideoDurationSeconds(ffprobePath, clipPath, clipTimeoutMs))
    );
    const concatListPath = path.join(workingFolderPath, 'concat.txt');
    writeFileSync(
      concatListPath,
      clipPaths.map((clipPath) => `file '${clipPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
      'utf8'
    );

    const outputPath = path.join(outputFolderPath, `${fileName}.mp4`);
    const hasAudioReplacement = segmentAudioPaths.length > 0 || Boolean(musicPath);
    const requiresPostProcessing =
      shouldStripOriginalAudio ||
      shouldMixBaseAudio ||
      Boolean(watermarkPath);
    const positiveClipDurations = clipDurations.filter(
      (duration): duration is number => typeof duration === 'number' && duration > 0
    );
    const transitionDuration = positiveClipDurations.length > 0
      ? Math.min(0.35, Math.max(0.05, Math.min(...positiveClipDurations) * 0.4))
      : 0;
    const canRenderTransitions =
      transitionEffect !== 'none' &&
      clipPaths.length > 1 &&
      transitionDuration > 0 &&
      clipDurations.every((duration) => typeof duration === 'number' && duration > transitionDuration) &&
      !preserveBaseAudio;
    const baseOutputPath = requiresPostProcessing || canRenderTransitions
      ? path.join(workingFolderPath, 'base-concat.mp4')
      : outputPath;
    if (canRenderTransitions) {
      await renderVideoWithTransitions({
        ffmpegPath,
        clipPaths,
        durations: clipDurations.map((duration) => duration ?? 0),
        transitionEffect,
        transitionDuration,
        outputPath: baseOutputPath,
        timeoutMs: Math.max(clipTimeoutMs, 300_000)
      });
    } else {
      await execFileAsync(
        ffmpegPath,
        ['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', baseOutputPath],
        { windowsHide: true, timeout: clipTimeoutMs }
      );
    }

    if (requiresPostProcessing) {
      const transitionOverlapSeconds = canRenderTransitions
        ? Math.max(0, (clipPaths.length - 1) * transitionDuration)
        : 0;
      let elapsedSeconds = 0;
      const segmentAudioTracks = clipEntries.flatMap((entry, index) => {
        const delaySeconds = Math.max(0, elapsedSeconds);
        elapsedSeconds += clipDurations[index] ?? 0;
        if (canRenderTransitions && index < clipEntries.length - 1) {
          elapsedSeconds = Math.max(0, elapsedSeconds - transitionDuration);
        }
        return entry.segmentAudioPath
          ? [{ path: entry.segmentAudioPath, delaySeconds }]
          : [];
      });
      const baseDurationSeconds = canRenderTransitions
        ? Math.max(
            0.1,
            clipDurations.reduce<number>((sum, value) => sum + (value ?? 0), 0) - transitionOverlapSeconds
          )
        : await probeVideoDurationSeconds(ffprobePath, baseOutputPath, clipTimeoutMs);
      await applyVideoPostProcessing({
        ffmpegPath,
        baseVideoPath: baseOutputPath,
        outputPath,
        renderSize,
        segmentAudioTracks,
        voiceoverPath: hasLegacyVoiceover ? legacyVoiceoverPath : undefined,
        musicPath,
        watermarkPath,
        preserveBaseAudio: shouldMixBaseAudio || (!shouldStripOriginalAudio && !hasAudioReplacement),
        durationSeconds: baseDurationSeconds,
        timeoutMs: Math.max(clipTimeoutMs, 300_000)
      });
    }

    const outputStats = statSync(outputPath);
    rmSync(workingFolderPath, { recursive: true, force: true });
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: outputPath,
        fileName: path.basename(outputPath),
        sizeBytes: outputStats.size,
        videoPaths,
        segments,
        outputRatio: `${renderSize.width}:${renderSize.height}`,
        outputResolution: `${renderSize.width}x${renderSize.height}`,
        coverPath,
        introPath,
        outroPath,
        transitionEffect,
        watermarkPath,
        musicPath,
        segmentAudioPaths,
        voiceoverPath: hasLegacyVoiceover ? legacyVoiceoverPath : undefined
      }
    };
  } catch (error) {
    rmSync(workingFolderPath, { recursive: true, force: true });
    return fail(
      request,
      [
        'Video export failed. Install FFmpeg or set QIUAI_FFMPEG_PATH to ffmpeg.exe, then retry.',
        error instanceof Error ? error.message : ''
      ]
        .filter(Boolean)
        .join(' ')
    );
  }
}

interface VideoRenderSize {
  width: number;
  height: number;
}

function readVideoRenderSize(ratioValue: unknown, resolutionValue: unknown): VideoRenderSize {
  const ratio = readString(ratioValue, '16:9').replace(/\s+/g, '');
  const resolution = readString(resolutionValue, '1080p').toLowerCase();
  const longSide = resolution === '2k' || resolution === '1440p'
    ? 2560
    : resolution === '720p'
      ? 1280
      : 1920;

  if (ratio === '9:16') {
    return { width: Math.round((longSide * 9) / 16), height: longSide };
  }
  if (ratio === '1:1') {
    const side = resolution === '2k' || resolution === '1440p' ? 1440 : resolution === '720p' ? 720 : 1080;
    return { width: side, height: side };
  }

  return { width: longSide, height: Math.round((longSide * 9) / 16) };
}

function readOptionalExistingToolPath(
  request: DesktopToolInvocationRequest,
  value: unknown
): string | undefined {
  const filePath = readString(value, '');
  if (!filePath) {
    return undefined;
  }
  assertReadPathAllowed(request, filePath);
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    throw new Error(`Optional media file does not exist: ${filePath}`);
  }
  return filePath;
}

async function normalizeVideoSourceClip(input: {
  ffmpegPath: string;
  inputPath: string;
  outputPath: string;
  renderSize: VideoRenderSize;
  segment?: { start: number; end: number };
  includeAudio?: boolean;
  timeoutMs: number;
}): Promise<void> {
  const args = ['-y'];
  if (input.segment) {
    args.push('-ss', String(input.segment.start), '-to', String(input.segment.end));
  }
  args.push(
    '-i',
    input.inputPath,
    '-map',
    '0:v:0',
    '-vf',
    buildVideoScalePadFilter(input.renderSize),
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20'
  );
  if (input.includeAudio) {
    args.push('-map', '0:a?', '-c:a', 'aac', '-b:a', '160k');
  } else {
    args.push('-an');
  }
  args.push('-movflags', '+faststart', input.outputPath);
  await execFileAsync(input.ffmpegPath, args, { windowsHide: true, timeout: input.timeoutMs });
}

async function normalizeImageCoverClip(input: {
  ffmpegPath: string;
  inputPath: string;
  outputPath: string;
  renderSize: VideoRenderSize;
  durationSeconds: number;
  timeoutMs: number;
}): Promise<void> {
  const durationSeconds = Math.max(0.5, Math.min(input.durationSeconds, 5));
  const args = [
    '-y',
    '-loop',
    '1',
    '-t',
    String(durationSeconds),
    '-i',
    input.inputPath,
    '-f',
    'lavfi',
    '-t',
    String(durationSeconds),
    '-i',
    'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
    '-vf',
    buildVideoScalePadFilter(input.renderSize),
    '-r',
    '30',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-shortest',
    '-movflags',
    '+faststart',
    input.outputPath
  ];
  await execFileAsync(input.ffmpegPath, args, { windowsHide: true, timeout: input.timeoutMs });
}

function buildVideoScalePadFilter(size: VideoRenderSize): string {
  return [
    `scale=${size.width}:${size.height}:force_original_aspect_ratio=decrease`,
    `pad=${size.width}:${size.height}:(ow-iw)/2:(oh-ih)/2`,
    'setsar=1',
    'format=yuv420p'
  ].join(',');
}

function readVideoTransitionEffect(value: unknown): 'none' | 'fade' | 'black_fade' | 'white_fade' {
  const normalized = readString(value, 'none').toLowerCase();
  return normalized === 'none' || normalized === 'black_fade' || normalized === 'white_fade'
    ? normalized
    : 'fade';
}

async function renderVideoWithTransitions(input: {
  ffmpegPath: string;
  clipPaths: string[];
  durations: number[];
  transitionEffect: 'none' | 'fade' | 'black_fade' | 'white_fade';
  transitionDuration: number;
  outputPath: string;
  timeoutMs: number;
}): Promise<void> {
  const transitionName = input.transitionEffect === 'black_fade'
    ? 'fadeblack'
    : input.transitionEffect === 'white_fade'
      ? 'fadewhite'
      : 'fade';
  const args = ['-y'];
  for (const clipPath of input.clipPaths) {
    args.push('-i', clipPath);
  }

  const filterParts = input.clipPaths.map(
    (_, index) => `[${index}:v]settb=AVTB,fps=30,format=yuv420p[v${index}]`
  );
  let currentLabel = 'v0';
  let currentDuration = input.durations[0] ?? 0;
  for (let index = 1; index < input.clipPaths.length; index += 1) {
    const nextLabel = `v${index}`;
    const outputLabel = `vx${index}`;
    const offset = Math.max(0, currentDuration - input.transitionDuration);
    filterParts.push(
      `[${currentLabel}][${nextLabel}]xfade=transition=${transitionName}:duration=${input.transitionDuration}:offset=${offset}[${outputLabel}]`
    );
    currentLabel = outputLabel;
    currentDuration = Math.max(
      0.1,
      currentDuration + (input.durations[index] ?? 0) - input.transitionDuration
    );
  }

  args.push(
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    `[${currentLabel}]`,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    input.outputPath
  );
  await execFileAsync(input.ffmpegPath, args, { windowsHide: true, timeout: input.timeoutMs });
}

async function applyVideoPostProcessing(input: {
  ffmpegPath: string;
  baseVideoPath: string;
  outputPath: string;
  renderSize: VideoRenderSize;
  segmentAudioTracks?: Array<{ path: string; delaySeconds: number }>;
  voiceoverPath?: string;
  musicPath?: string;
  watermarkPath?: string;
  preserveBaseAudio?: boolean;
  durationSeconds?: number;
  timeoutMs: number;
}): Promise<void> {
  const args = ['-y', '-i', input.baseVideoPath];
  let nextInputIndex = 1;
  const segmentAudioInputIndexes: Array<{ index: number; delaySeconds: number }> = [];
  for (const track of input.segmentAudioTracks ?? []) {
    const index = nextInputIndex;
    nextInputIndex += 1;
    segmentAudioInputIndexes.push({ index, delaySeconds: track.delaySeconds });
    args.push('-i', track.path);
  }
  if (input.voiceoverPath && segmentAudioInputIndexes.length === 0) {
    segmentAudioInputIndexes.push({ index: nextInputIndex, delaySeconds: 0 });
    args.push('-i', input.voiceoverPath);
    nextInputIndex += 1;
  }
  let musicInputIndex: number | undefined;
  if (input.musicPath) {
    musicInputIndex = nextInputIndex;
    nextInputIndex += 1;
    args.push('-stream_loop', '-1', '-i', input.musicPath);
  }
  let watermarkInputIndex: number | undefined;
  if (input.watermarkPath) {
    watermarkInputIndex = nextInputIndex;
    args.push('-i', input.watermarkPath);
  }

  const filterComplexParts: string[] = [];
  let videoMap = '0:v:0';
  if (watermarkInputIndex !== undefined) {
    const watermarkWidth = Math.max(96, Math.min(240, Math.round(input.renderSize.width * 0.14)));
    filterComplexParts.push(
      `[${watermarkInputIndex}:v]scale=${watermarkWidth}:-1[wm]`,
      `[0:v][wm]overlay=W-w-24:H-h-24[video]`
    );
    videoMap = '[video]';
  }

  let audioMap: string | undefined;
  const narrationLabels: string[] = [];
  for (const [trackIndex, track] of segmentAudioInputIndexes.entries()) {
    const label = `narration_${trackIndex}`;
    const delayMs = Math.max(0, Math.round(track.delaySeconds * 1000));
    filterComplexParts.push(
      `[${track.index}:a:0]adelay=${delayMs}|${delayMs},volume=1.0[${label}]`
    );
    narrationLabels.push(`[${label}]`);
  }

  if (narrationLabels.length > 0) {
    const narrationLabel = 'narration_mix';
    filterComplexParts.push(
      `${narrationLabels.join('')}amix=inputs=${narrationLabels.length}:duration=longest:dropout_transition=0:normalize=0[${narrationLabel}]`
    );
    audioMap = `[${narrationLabel}]`;
    if (input.preserveBaseAudio) {
      const mixedLabel = 'narration_with_base';
      filterComplexParts.push(
        `[0:a:0]volume=0.22[base_audio];${audioMap}[base_audio]amix=inputs=2:duration=longest:dropout_transition=2:normalize=0[${mixedLabel}]`
      );
      audioMap = `[${mixedLabel}]`;
    }
  }

  if (musicInputIndex !== undefined) {
    const musicLabel = 'music_mix';
    const musicDuration = input.durationSeconds && Number.isFinite(input.durationSeconds)
      ? Math.max(0.1, input.durationSeconds)
      : undefined;
    filterComplexParts.push(
      `[${musicInputIndex}:a:0]volume=0.16${musicDuration ? `,atrim=duration=${musicDuration}` : ''},asetpts=N/SR/TB[${musicLabel}]`
    );
    if (audioMap) {
      const combinedLabel = 'final_audio';
      filterComplexParts.push(
        `${audioMap}[${musicLabel}]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0[${combinedLabel}]`
      );
      audioMap = `[${combinedLabel}]`;
    } else {
      audioMap = `[${musicLabel}]`;
    }
  }

  if (!audioMap && input.preserveBaseAudio) {
    audioMap = '0:a?';
  } else if (audioMap && input.durationSeconds && Number.isFinite(input.durationSeconds)) {
    const paddedLabel = 'final_audio_padded';
    filterComplexParts.push(
      `${audioMap}apad,atrim=duration=${Math.max(0.1, input.durationSeconds)}[${paddedLabel}]`
    );
    audioMap = `[${paddedLabel}]`;
  }

  if (input.durationSeconds && Number.isFinite(input.durationSeconds)) {
    args.push('-t', String(Math.round(Math.max(0.1, input.durationSeconds) * 1000) / 1000));
  }

  if (filterComplexParts.length > 0) {
    args.push('-filter_complex', filterComplexParts.join(';'));
  }
  args.push('-map', videoMap);
  if (audioMap) {
    args.push('-map', audioMap);
  } else {
    args.push('-an');
  }

  args.push(
    '-c:v',
    'libx264',
    '-preset',
    'veryfast',
    '-crf',
    '20',
    ...(audioMap ? ['-c:a', 'aac', '-b:a', '160k'] : []),
    '-movflags',
    '+faststart',
    input.outputPath
  );
  await execFileAsync(input.ffmpegPath, args, { windowsHide: true, timeout: input.timeoutMs });
}

async function probeVideoDurationSeconds(
  ffprobePath: string,
  videoPath: string,
  timeoutMs: number
): Promise<number | undefined> {
  try {
    const { stdout } = await execFileAsync(
      ffprobePath,
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', videoPath],
      { windowsHide: true, timeout: Math.min(timeoutMs, 60_000) }
    );
    const durationSeconds = Number(stdout.trim());
    return Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined;
  } catch {
    return undefined;
  }
}

async function extractVideoFrames(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const videoPath = readVideoInputPath(request);
  assertReadPathAllowed(request, videoPath);
  if (!existsSync(videoPath) || !statSync(videoPath).isFile()) {
    return fail(request, `Video file does not exist: ${videoPath}`);
  }

  const extension = path.extname(videoPath).toLowerCase();
  if (!isVideoFileExtension(extension)) {
    return fail(request, `Unsupported video extension: ${extension || 'unknown'}.`);
  }

  const ffmpegPath = resolveFfmpegPath(request.input.ffmpegPath);
  const frameIntervalSeconds = readOptionalPositiveNumber(request.input.frameIntervalSeconds, 5);
  const maxFrames = Math.min(readOptionalPositiveInteger(request.input.maxFrames, 12), 60);
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);
  const folder = readString(request.input.folder, 'frames');
  const fileName = normalizePathSegment(
    readString(request.input.fileName, `${path.basename(videoPath, path.extname(videoPath))}-frames`)
  );
  const outputFolderPath = path.join(layout.assetsPath, 'tools', normalizePathSegment(folder), fileName);
  const framePattern = path.join(outputFolderPath, 'frame-%03d.jpg');

  mkdirSync(outputFolderPath, { recursive: true });

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-i',
        videoPath,
        '-vf',
        `fps=1/${frameIntervalSeconds}`,
        '-frames:v',
        String(maxFrames),
        '-q:v',
        '2',
        framePattern
      ],
      { windowsHide: true, timeout: readOptionalPositiveInteger(request.input.timeoutMs, 180_000) }
    );

    const framePaths = readdirSync(outputFolderPath)
      .filter((entry) => /^frame-\d+\.jpg$/i.test(entry))
      .sort((left, right) => left.localeCompare(right))
      .map((entry) => path.join(outputFolderPath, entry));

    if (framePaths.length === 0) {
      return fail(request, 'Video frame extraction completed but no frame files were generated.');
    }

    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: outputFolderPath,
        directoryPath: outputFolderPath,
        framePaths,
        frameCount: framePaths.length,
        sourceVideoPath: videoPath,
        frameIntervalSeconds,
        maxFrames
      }
    };
  } catch (error) {
    return fail(
      request,
      [
        'Video frame extraction failed. Install FFmpeg or set QIUAI_FFMPEG_PATH to ffmpeg.exe, then retry.',
        error instanceof Error ? error.message : ''
      ]
        .filter(Boolean)
        .join(' ')
    );
  }
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
    text = await extractPdfText(filePath);
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

async function readSpreadsheetXlsx(request: DesktopToolInvocationRequest): Promise<DesktopToolInvocationResult> {
  const filePath = readRequiredString(request.input.path, 'path');
  assertReadPathAllowed(request, filePath);
  const stats = statSync(filePath);

  if (!stats.isFile() || path.extname(filePath).toLowerCase() !== '.xlsx') {
    return fail(request, `Path is not an XLSX file: ${filePath}`);
  }

  const sheets = await extractXlsxSheets(filePath);
  return {
    toolId: request.toolId,
    action: request.action,
    ok: true,
    output: {
      path: filePath,
      fileName: path.basename(filePath),
      sheets
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
  const outputPath = path.join(outputFolderPath, normalizeOutputFileName(fileName, 'md'));

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

async function downloadRemoteFile(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const remoteUrl = normalizeRemoteDownloadUrl(readRequiredString(request.input.url ?? request.input.remoteUrl, 'url'));
  const folder = readString(request.input.folder, 'remote-assets');
  const mediaKind = readRemoteDownloadMediaKind(request.input.mediaKind ?? request.input.kind);
  const requestedFileName = readString(
    request.input.fileName,
    getRemoteDownloadFallbackFileName(remoteUrl, mediaKind)
  );
  const timeoutMs = Math.min(
    readOptionalPositiveInteger(request.input.timeoutMs, 300_000),
    30 * 60 * 1000
  );

  const response = await fetch(remoteUrl, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    return fail(request, `Remote file download failed: HTTP ${response.status}.`);
  }

  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxRemoteToolAssetBytes) {
    return fail(request, 'Remote file is too large to store locally.');
  }

  const contentType = response.headers.get('content-type') ?? undefined;
  const extension = inferRemoteDownloadExtension({
    requestedFileName,
    remoteUrl,
    contentType,
    mediaKind
  });
  const baseFileName = normalizePathSegment(stripRemoteDownloadExtension(requestedFileName) || 'remote-file');
  const outputFolderPath = path.join(
    layout.assetsPath,
    'tools',
    'remote-assets',
    normalizePathSegment(folder)
  );
  mkdirSync(outputFolderPath, { recursive: true });

  const fileName = createUniqueRemoteDownloadFileName(outputFolderPath, baseFileName, extension);
  const outputPath = path.join(outputFolderPath, fileName);
  const tempPath = `${outputPath}.${Date.now()}.download`;

  try {
    if (response.body) {
      await pipeline(
        Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
        createByteLimitTransform(maxRemoteToolAssetBytes),
        createWriteStream(tempPath)
      );
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength > maxRemoteToolAssetBytes) {
        throw new Error('Remote file is too large to store locally.');
      }
      writeFileSync(tempPath, buffer);
    }

    const stats = statSync(tempPath);
    renameSync(tempPath, outputPath);

    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: outputPath,
        path: outputPath,
        fileName,
        bytes: stats.size,
        sizeBytes: stats.size,
        sourceUrl: remoteUrl,
        contentType,
        mediaKind
      }
    };
  } catch (error) {
    rmSync(tempPath, { force: true });
    return fail(request, error instanceof Error ? error.message : 'Remote file download failed.');
  }
}

async function packageZipFile(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<DesktopToolInvocationResult> {
  const layout = getDesktopStorageLayout(userDataPath, request.workspaceId);
  ensureDesktopStorageLayout(layout);

  const folder = readString(request.input.folder, 'packages');
  const fileName = readString(request.input.fileName, 'artifact-package');
  const zip = new JSZip();
  const entries = readZipFileEntries(request.input.files);

  for (const entry of entries) {
    const sourcePath = entry.localPath;
    if (!existsSync(sourcePath)) {
      continue;
    }

    const stats = statSync(sourcePath);
    if (!stats.isFile()) {
      continue;
    }

    if (!isPathInsideRoot(sourcePath, layout.assetsPath)) {
      assertReadPathAllowed(request, sourcePath);
    }

    zip.file(entry.archivePath ?? path.basename(sourcePath), readFileSync(sourcePath));
  }

  const manifest = request.input.manifest;
  if (manifest !== undefined) {
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  }

  zip.file(
    'README.txt',
    [
      'QiuAI WorkOS artifact package',
      `Created at: ${new Date().toISOString()}`,
      `File count: ${entries.length}`
    ].join('\n')
  );

  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  return writeToolAssetBinaryFile(userDataPath, request, {
    category: 'packages',
    folder,
    fileName,
    extension: 'zip',
    content: buffer
  });
}

function readZipFileEntries(value: unknown): Array<{ localPath: string; archivePath?: string }> {
  const rawValue = typeof value === 'string' && value.trim().startsWith('[')
    ? parseJson(value)
    : value;
  const values = Array.isArray(rawValue)
    ? rawValue
    : isRecord(rawValue) && Array.isArray(rawValue.files)
      ? rawValue.files
      : [];
  const usedArchivePaths = new Set<string>();

  return values.flatMap((item, index) => {
    const entry = readZipFileEntry(item, index);
    if (!entry) {
      return [];
    }

    const archivePath = makeUniqueArchivePath(
      entry.archivePath ?? path.basename(entry.localPath),
      usedArchivePaths
    );
    return [{ ...entry, archivePath }];
  });
}

function readZipFileEntry(
  value: unknown,
  index: number
): { localPath: string; archivePath?: string } | undefined {
  if (typeof value === 'string') {
    const localPath = value.trim();
    return localPath ? { localPath } : undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const localPath = readString(
    value.localPath ?? value.path ?? value.filePath ?? value.outputPath,
    ''
  );
  if (!localPath) {
    return undefined;
  }

  const archivePath = normalizeZipArchivePath(
    readString(
      value.archivePath ?? value.relativePath ?? value.fileName ?? value.name,
      `file-${index + 1}${path.extname(localPath)}`
    )
  );

  return {
    localPath,
    archivePath
  };
}

function normalizeZipArchivePath(value: string): string | undefined {
  const segments = value
    .replace(/\\/g, '/')
    .split('/')
    .map((segment) => normalizePathSegment(segment))
    .filter(Boolean);

  return segments.length ? segments.join('/') : undefined;
}

function makeUniqueArchivePath(value: string, usedArchivePaths: Set<string>): string {
  const normalized = normalizeZipArchivePath(value) ?? 'file';
  if (!usedArchivePaths.has(normalized)) {
    usedArchivePaths.add(normalized);
    return normalized;
  }

  const extension = path.extname(normalized);
  const baseName = extension ? normalized.slice(0, -extension.length) : normalized;
  let suffix = 2;
  while (usedArchivePaths.has(`${baseName}-${suffix}${extension}`)) {
    suffix += 1;
  }
  const next = `${baseName}-${suffix}${extension}`;
  usedArchivePaths.add(next);
  return next;
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
    return searchBuiltInWeb(request, query, maxResults);
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

async function searchBuiltInWeb(
  request: DesktopToolInvocationRequest,
  query: string,
  maxResults: number
): Promise<DesktopToolInvocationResult> {
  const errors: string[] = [];

  const bingSearchUrl = new URL(builtInWebSearchBingEndpoint);
  bingSearchUrl.searchParams.set('q', query);
  bingSearchUrl.searchParams.set('count', String(maxResults));
  bingSearchUrl.searchParams.set('mkt', 'zh-CN');

  try {
    const response = await fetch(bingSearchUrl.toString(), {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'QiuAI-WorkOS-Desktop/1.0'
      },
      signal: AbortSignal.timeout(webFetchTimeoutMs)
    });
    const bodyText = await response.text();

    if (response.ok) {
      const results = normalizeBingHtmlResults(bodyText).slice(0, maxResults);
      if (results.length > 0) {
        return {
          toolId: request.toolId,
          action: request.action,
          ok: true,
          output: {
            query,
            provider: 'builtin-bing',
            results
          }
        };
      }
    } else {
      errors.push(`Bing search returned HTTP ${response.status}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Bing search failed');
  }

  const htmlSearchUrl = new URL(builtInWebSearchHtmlEndpoint);
  htmlSearchUrl.searchParams.set('q', query);
  htmlSearchUrl.searchParams.set('kl', 'cn-zh');

  try {
    const response = await fetch(htmlSearchUrl.toString(), {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'QiuAI-WorkOS-Desktop/1.0'
      },
      signal: AbortSignal.timeout(webFetchTimeoutMs)
    });
    const bodyText = await response.text();

    if (response.ok) {
      const results = normalizeDuckDuckGoHtmlResults(bodyText).slice(0, maxResults);
      if (results.length > 0) {
        return {
          toolId: request.toolId,
          action: request.action,
          ok: true,
          output: {
            query,
            provider: 'builtin-duckduckgo-html',
            results
          }
        };
      }
    } else {
      errors.push(`HTML search returned HTTP ${response.status}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'HTML search failed');
  }

  const instantSearchUrl = new URL(builtInWebSearchInstantEndpoint);
  instantSearchUrl.searchParams.set('q', query);
  instantSearchUrl.searchParams.set('format', 'json');
  instantSearchUrl.searchParams.set('no_html', '1');
  instantSearchUrl.searchParams.set('skip_disambig', '1');

  try {
    const response = await fetch(instantSearchUrl.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'QiuAI-WorkOS-Desktop/1.0'
      },
      signal: AbortSignal.timeout(webFetchTimeoutMs)
    });
    const bodyText = await response.text();

    if (response.ok) {
      const results = normalizeDuckDuckGoInstantResults(bodyText).slice(0, maxResults);
      if (results.length > 0) {
        return {
          toolId: request.toolId,
          action: request.action,
          ok: true,
          output: {
            query,
            provider: 'builtin-duckduckgo-instant',
            results
          }
        };
      }

      errors.push('Built-in search returned no results');
    } else {
      errors.push(`Instant search returned HTTP ${response.status}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Instant search failed');
  }

  return fail(
    request,
    `Built-in web search failed. Check network access, or configure a custom search service in Tool Center. ${errors.join('; ')}`
  );
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
  const document = normalizeOfficeDocumentPayload(request.input, title, content);
  const buffer = await buildDocxBuffer(document);

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
  const title = readString(request.input.title, readString(request.input.fileName, 'Sheet1'));
  const folder = readString(request.input.folder, 'spreadsheets');
  const fileName = readString(request.input.fileName, 'sheet');
  const sheets = normalizeSpreadsheetWorkbookSheets(request.input, title);
  const buffer = await buildXlsxBuffer(sheets);

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
    normalizeOutputFileName(input.fileName, input.extension)
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
    normalizeOutputFileName(input.fileName, input.extension)
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

function normalizeOutputFileName(fileName: string, extension: string): string {
  const normalizedFileName = normalizePathSegment(fileName);
  const normalizedExtension = extension.replace(/^\.+/, '').trim().toLowerCase();
  if (!normalizedExtension) {
    return normalizedFileName;
  }

  return normalizedFileName.toLowerCase().endsWith(`.${normalizedExtension}`)
    ? normalizedFileName
    : `${normalizedFileName}.${normalizedExtension}`;
}

interface OfficeDocumentPayload {
  title: string;
  sections: OfficeDocumentSection[];
}

interface OfficeDocumentSection {
  heading?: string;
  paragraphs: string[];
  bullets: string[];
  tables: SpreadsheetTable[];
}

interface SpreadsheetTable {
  headers: string[];
  rows: string[][];
}

interface SpreadsheetWorkbookSheet {
  name: string;
  rows: string[][];
}

function normalizeOfficeDocumentPayload(
  input: Record<string, unknown>,
  title: string,
  content: string
): OfficeDocumentPayload {
  const documentFromInput = normalizeOfficeDocumentRecord(input.document, title);
  if (documentFromInput) {
    return documentFromInput;
  }

  const sectionsFromInput = normalizeOfficeDocumentSections(input.sections);
  if (sectionsFromInput.length > 0) {
    return {
      title,
      sections: sectionsFromInput
    };
  }

  return parseOfficeDocumentFromContent(title, content);
}

function normalizeOfficeDocumentRecord(value: unknown, fallbackTitle: string): OfficeDocumentPayload | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const title = readString(record.title, fallbackTitle);
  const sections = normalizeOfficeDocumentSections(record.sections);
  if (sections.length === 0) {
    return undefined;
  }

  return { title, sections };
}

function normalizeOfficeDocumentSections(value: unknown): OfficeDocumentSection[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const sections: OfficeDocumentSection[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      const paragraph = sanitizeOfficeArtifactContent(item).trim();
      if (paragraph) {
        sections.push({ paragraphs: [paragraph], bullets: [], tables: [] });
      }
      continue;
    }

    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const paragraphs = normalizeStringArray(record.paragraphs ?? record.content);
    const bullets = normalizeStringArray(record.bullets);
    const table = normalizeSpreadsheetTable(record.table);
    const tables = Array.isArray(record.tables)
      ? record.tables.map(normalizeSpreadsheetTable).filter((entry): entry is SpreadsheetTable => Boolean(entry))
      : [];

    if (table) {
      tables.unshift(table);
    }

    if (!record.heading && paragraphs.length === 0 && bullets.length === 0 && tables.length === 0) {
      continue;
    }

    sections.push({
      heading: typeof record.heading === 'string' ? stripMarkdownDecorations(record.heading).trim() : undefined,
      paragraphs,
      bullets,
      tables
    });
  }

  return sections.filter(
    (section) => section.heading || section.paragraphs.length > 0 || section.bullets.length > 0 || section.tables.length > 0
  );
}

function parseOfficeDocumentFromContent(title: string, content: string): OfficeDocumentPayload {
  const normalizedContent = sanitizeOfficeArtifactContent(content);
  const lines = normalizedContent.split('\n');
  const sections: OfficeDocumentSection[] = [];
  let current: OfficeDocumentSection = { paragraphs: [], bullets: [], tables: [] };

  const flushCurrent = () => {
    if (current.heading || current.paragraphs.length > 0 || current.bullets.length > 0 || current.tables.length > 0) {
      sections.push(current);
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    if (/^#{1,6}\s+/.test(trimmed)) {
      flushCurrent();
      current = {
        heading: stripMarkdownDecorations(trimmed),
        paragraphs: [],
        bullets: [],
        tables: []
      };
      continue;
    }

    const table = parseMarkdownTableAt(lines, index);
    if (table) {
      current.tables.push({ headers: table.headers, rows: table.rows });
      index = table.nextIndex - 1;
      continue;
    }

    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
      current.bullets.push(stripMarkdownDecorations(line));
      continue;
    }

    current.paragraphs.push(stripMarkdownDecorations(line));
  }

  flushCurrent();

  return {
    title,
    sections: sections.length > 0
      ? sections
      : [{ paragraphs: [normalizedContent.trim() || '任务已完成，但没有可写入的正文。'], bullets: [], tables: [] }]
  };
}

async function buildDocxBuffer(document: OfficeDocumentPayload): Promise<Buffer> {
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
  zip.file('word/document.xml', buildDocxDocumentXml(document));

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function buildDocxDocumentXml(document: OfficeDocumentPayload): string {
  const body = [
    formatDocxParagraph(document.title, { bold: true }),
    '<w:p/>',
    ...document.sections.flatMap((section) => formatDocxSection(section))
  ].join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '<w:body>',
    body,
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
    '</w:body>',
    '</w:document>'
  ].join('');
}

function formatDocxSection(section: OfficeDocumentSection): string[] {
  return [
    section.heading ? formatDocxParagraph(section.heading, { bold: true }) : '',
    ...section.paragraphs.map((paragraph) => formatDocxParagraph(paragraph)),
    ...section.bullets.map((bullet) => formatDocxParagraph(`- ${bullet}`)),
    ...section.tables.map(formatDocxTable),
    '<w:p/>'
  ].filter(Boolean);
}

function formatDocxParagraph(text: string, options?: { bold?: boolean }): string {
  if (!text.trim()) {
    return '<w:p/>';
  }

  const runProperties = options?.bold ? '<w:rPr><w:b/></w:rPr>' : '';
  return `<w:p><w:r>${runProperties}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function formatDocxTable(table: SpreadsheetTable): string {
  const rows = table.headers.length > 0 ? [table.headers, ...table.rows] : table.rows;
  if (rows.length === 0) {
    return '';
  }

  const tableRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell) => [
          '<w:tc>',
          '<w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>',
          formatDocxParagraph(cell, { bold: rowIndex === 0 && table.headers.length > 0 }),
          '</w:tc>'
        ].join(''))
        .join('');
      return `<w:tr>${cells}</w:tr>`;
    })
    .join('');

  return [
    '<w:tbl>',
    '<w:tblPr><w:tblBorders>',
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>',
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>',
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>',
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>',
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>',
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>',
    '</w:tblBorders></w:tblPr>',
    tableRows,
    '</w:tbl>'
  ].join('');
}

function normalizeSpreadsheetWorkbookSheets(
  input: Record<string, unknown>,
  title: string
): SpreadsheetWorkbookSheet[] {
  const sheets = normalizeSpreadsheetSheets(input.sheets);
  if (sheets.length > 0) {
    return normalizeSpreadsheetSheetNames(sheets);
  }

  if (Array.isArray(input.rows)) {
    return normalizeSpreadsheetSheetNames([{ name: 'Sheet1', rows: normalizeSpreadsheetRows(input.rows) }]);
  }

  const content = sanitizeOfficeArtifactContent(readString(input.content, ''));
  const jsonSheets = parseSpreadsheetSheetsFromJsonContent(content);
  if (jsonSheets.length > 0) {
    return normalizeSpreadsheetSheetNames(jsonSheets);
  }

  return normalizeSpreadsheetSheetNames(parseSpreadsheetSheetsFromContent(title, content));
}

function normalizeSpreadsheetSheets(value: unknown): SpreadsheetWorkbookSheet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      if (Array.isArray(item)) {
        return {
          name: `Sheet ${index + 1}`,
          rows: normalizeSpreadsheetRows(item)
        };
      }

      if (!item || typeof item !== 'object') {
        return undefined;
      }

      const record = item as Record<string, unknown>;
      const rows = Array.isArray(record.rows) ? normalizeSpreadsheetRows(record.rows) : [];
      if (rows.length === 0) {
        return undefined;
      }

      return {
        name: readString(record.name, `Sheet ${index + 1}`),
        rows
      };
    })
    .filter((sheet): sheet is SpreadsheetWorkbookSheet => Boolean(sheet));
}

function parseSpreadsheetSheetsFromJsonContent(content: string): SpreadsheetWorkbookSheet[] {
  const parsed = parseJson(stripMarkdownCodeFence(content.trim()));
  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  if (Array.isArray(parsed)) {
    return [{ name: 'Sheet1', rows: normalizeSpreadsheetRows(parsed) }];
  }

  const record = parsed as Record<string, unknown>;
  const sheets = normalizeSpreadsheetSheets(record.sheets);
  if (sheets.length > 0) {
    return sheets;
  }

  if (Array.isArray(record.rows)) {
    return [{ name: readString(record.name, 'Sheet1'), rows: normalizeSpreadsheetRows(record.rows) }];
  }

  return [];
}

function parseSpreadsheetSheetsFromContent(title: string, content: string): SpreadsheetWorkbookSheet[] {
  const lines = content.split('\n');
  const sheets: SpreadsheetWorkbookSheet[] = [];
  let currentHeading = title;

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index]?.trim() ?? '';
    if (/^#{1,6}\s+/.test(trimmed)) {
      currentHeading = stripMarkdownDecorations(trimmed);
      continue;
    }

    const table = parseMarkdownTableAt(lines, index);
    if (!table) {
      continue;
    }

    sheets.push({
      name: currentHeading || `表格 ${sheets.length + 1}`,
      rows: [table.headers, ...table.rows]
    });
    index = table.nextIndex - 1;
  }

  if (sheets.length > 0) {
    return sheets;
  }

  return [
    {
      name: '内容摘要',
      rows: buildSpreadsheetRowsFromText(title, content)
    }
  ];
}

function buildSpreadsheetRowsFromText(title: string, content: string): string[][] {
  const rows: string[][] = [['章节', '类型', '内容']];
  let section = title || '正文';

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      section = stripMarkdownDecorations(line);
      continue;
    }

    if (/^\s*(?:[-*+]|\d+\.)\s+/.test(rawLine)) {
      rows.push([section, '要点', stripMarkdownDecorations(rawLine)]);
      continue;
    }

    rows.push([section, '正文', stripMarkdownDecorations(rawLine)]);
  }

  return rows.length > 1 ? rows : [['标题', '内容'], [title, content.trim() || '任务已完成，但没有可写入的正文。']];
}

async function buildXlsxBuffer(sheets: SpreadsheetWorkbookSheet[]): Promise<Buffer> {
  const normalizedSheets = normalizeSpreadsheetSheetNames(sheets);
  const zip = new JSZip();
  const worksheetOverrides = normalizedSheets
    .map((_sheet, index) => {
      const sheetNumber = index + 1;
      return `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    })
    .join('');
  zip.file(
    '[Content_Types].xml',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      worksheetOverrides,
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
      '<sheets>',
      normalizedSheets
        .map((sheet, index) => {
          const sheetNumber = index + 1;
          return `<sheet name="${escapeXml(sheet.name)}" sheetId="${sheetNumber}" r:id="rId${sheetNumber}"/>`;
        })
        .join(''),
      '</sheets>',
      '</workbook>'
    ].join('')
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      normalizedSheets
        .map((_sheet, index) => {
          const sheetNumber = index + 1;
          return `<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`;
        })
        .join(''),
      '</Relationships>'
    ].join('')
  );
  normalizedSheets.forEach((sheet, index) => {
    zip.file(`xl/worksheets/sheet${index + 1}.xml`, buildXlsxWorksheetXml(sheet.rows));
  });

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}

function normalizeSpreadsheetRows(rows: unknown[]): string[][] {
  if (rows.every((row) => row && typeof row === 'object' && !Array.isArray(row))) {
    const records = rows as Array<Record<string, unknown>>;
    const headers = [...new Set(records.flatMap((record) => Object.keys(record)))];
    if (headers.length > 0) {
      return [
        headers,
        ...records.map((record) => headers.map((header) => formatSpreadsheetCellValue(record[header])))
      ];
    }
  }

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

function normalizeSpreadsheetSheetNames(sheets: SpreadsheetWorkbookSheet[]): SpreadsheetWorkbookSheet[] {
  const sourceSheets = sheets.length > 0 ? sheets : [{ name: 'Sheet1', rows: [['Content'], ['']] }];
  const usedNames = new Set<string>();

  return sourceSheets.map((sheet, index) => ({
    name: normalizeSpreadsheetSheetName(sheet.name, index, usedNames),
    rows: sheet.rows.length > 0 ? sheet.rows : [['Content'], ['']]
  }));
}

function normalizeSpreadsheetSheetName(name: string, index: number, usedNames: Set<string>): string {
  const baseName = name
    .replace(/[\[\]:*?/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31) || `Sheet ${index + 1}`;
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    const suffixText = ` ${suffix}`;
    candidate = `${baseName.slice(0, Math.max(1, 31 - suffixText.length))}${suffixText}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
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
    return sanitizeOfficeArtifactContent(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return JSON.stringify(value);
}

function normalizeStringArray(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/\r?\n/) : [];
  return values
    .map((item) => sanitizeOfficeArtifactContent(String(item)).trim())
    .filter(Boolean)
    .map(stripMarkdownDecorations);
}

function normalizeSpreadsheetTable(value: unknown): SpreadsheetTable | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const headers = normalizeStringArray(record.headers);
  const rows = Array.isArray(record.rows) ? normalizeSpreadsheetRows(record.rows) : [];
  if (headers.length === 0 && rows.length === 0) {
    return undefined;
  }

  return { headers, rows };
}

function parseMarkdownTableAt(
  lines: string[],
  startIndex: number
): { headers: string[]; rows: string[][]; nextIndex: number } | undefined {
  const headerLine = lines[startIndex] ?? '';
  const separatorLine = lines[startIndex + 1] ?? '';
  if (!isMarkdownTableRow(headerLine) || !isMarkdownTableSeparator(separatorLine)) {
    return undefined;
  }

  const headers = parseMarkdownTableRow(headerLine);
  const rows: string[][] = [];
  let nextIndex = startIndex + 2;

  while (nextIndex < lines.length && isMarkdownTableRow(lines[nextIndex] ?? '')) {
    const row = parseMarkdownTableRow(lines[nextIndex] ?? '');
    if (row.length > 0) {
      rows.push(row);
    }
    nextIndex += 1;
  }

  if (headers.length === 0 || rows.length === 0) {
    return undefined;
  }

  return { headers, rows, nextIndex };
}

function isMarkdownTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.includes('|') && !isMarkdownTableSeparator(trimmed);
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = parseMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function parseMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed
    .split('|')
    .map((cell) => stripMarkdownDecorations(cell).trim())
    .filter((cell, index, cells) => cell.length > 0 || index < cells.length - 1);
}

function sanitizeOfficeArtifactContent(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => !/^Variable:\s*[a-zA-Z0-9_.-]+\s*$/.test(line.trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMarkdownCodeFence(value: string): string {
  return value
    .replace(/^```(?:json|JSON)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
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

function stripMarkdownDecorations(value: string): string {
  return stripMarkdownPrefix(value)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
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
  const sheets = await extractXlsxSheets(filePath);
  return sheets
    .map((sheet) => {
      const rows = sheet.rows.map((row) => row.join(' | ')).join('\n');
      return rows ? `${sheet.name}\n${rows}` : '';
    })
    .filter(Boolean)
    .join('\n\n');
}

async function extractXlsxSheets(filePath: string): Promise<SpreadsheetWorkbookSheet[]> {
  const zip = await JSZip.loadAsync(readFileSync(filePath));
  const sharedStringXml = zip.file('xl/sharedStrings.xml');
  const sharedStrings = sharedStringXml
    ? parseXlsxSharedStrings(await sharedStringXml.async('string'))
    : [];
  const worksheetEntries = Object.values(zip.files)
    .filter((file) => !file.dir && /^xl\/worksheets\/sheet\d+\.xml$/.test(file.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }));
  const workbookXml = zip.file('xl/workbook.xml');
  const sheetNames = workbookXml
    ? parseXlsxSheetNames(await workbookXml.async('string'))
    : [];

  const sheets = await Promise.all(
    worksheetEntries.map(async (file, index) => ({
      name: sheetNames[index] ?? `Sheet ${index + 1}`,
      rows: parseXlsxWorksheetRows(await file.async('string'), sharedStrings)
    }))
  );

  return sheets.length > 0
    ? sheets
    : [{ name: 'Sheet1', rows: [['Content'], ['']] }];
}

function parseXlsxSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    decodeHtmlEntities(
      [...(match[1] ?? '').matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)]
        .map((textMatch) => textMatch[1] ?? '')
        .join('')
        .replace(/<[^>]+>/g, '')
    )
  );
}

function parseXlsxSheetNames(xml: string): string[] {
  return [...xml.matchAll(/<sheet\b[^>]*\bname="([^"]+)"/g)].map((match) =>
    decodeHtmlEntities(match[1] ?? '')
  );
}

function parseXlsxWorksheetRows(xml: string, sharedStrings: string[]): string[][] {
  const rows = [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map((rowMatch) => {
    const cells = new Map<number, string>();

    for (const cellMatch of (rowMatch[1] ?? '').matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attributes = cellMatch[1] ?? '';
      const body = cellMatch[2] ?? '';
      const reference = attributes.match(/\br="([A-Z]+)\d+"/)?.[1];
      const columnIndex = reference ? spreadsheetColumnIndex(reference) : cells.size;
      const type = attributes.match(/\bt="([^"]+)"/)?.[1];
      const value = body.match(/<v[^>]*>([\s\S]*?)<\/v>/)?.[1]
        ?? body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]
        ?? '';

      if (type === 's') {
        cells.set(columnIndex, sharedStrings[Number(value)] ?? '');
      } else {
        cells.set(columnIndex, decodeHtmlEntities(value));
      }
    }

    const width = cells.size > 0 ? Math.max(...cells.keys()) + 1 : 0;
    return Array.from({ length: width }, (_, index) => cells.get(index) ?? '');
  });

  return rows.length > 0 ? rows : [['Content'], ['']];
}

function spreadsheetColumnIndex(columnName: string): number {
  return [...columnName].reduce((result, character) => result * 26 + character.charCodeAt(0) - 64, 0) - 1;
}

async function extractPdfText(filePath: string): Promise<string> {
  const pdfParse = loadPdfParse();
  const parsed = await pdfParse(readFileSync(filePath));
  return parsed.text;
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

type RpaBrowserWindow = {
  id?: number;
  loadURL(url: string): Promise<void>;
  close(): void;
  webContents: {
    executeJavaScript(script: string): Promise<unknown>;
    getURL(): string;
    getTitle(): string;
    once(eventName: string, listener: (...args: unknown[]) => void): void;
    removeListener(eventName: string, listener: (...args: unknown[]) => void): void;
  };
};

async function createRpaBrowserWindow(
  userDataPath: string,
  request: DesktopToolInvocationRequest
): Promise<RpaBrowserWindow> {
  let electronModule: unknown;
  try {
    electronModule = await import('electron');
  } catch {
    throw new Error('Browser automation is only available inside the desktop app runtime.');
  }

  const BrowserWindowValue = isRecord(electronModule) ? electronModule.BrowserWindow : undefined;
  if (typeof BrowserWindowValue !== 'function') {
    throw new Error('Electron BrowserWindow is not available for browser automation.');
  }
  const BrowserWindow = BrowserWindowValue as new (options: Record<string, unknown>) => RpaBrowserWindow;

  const workspaceSegment = normalizePathSegment(request.workspaceId || 'workspace');
  const partition = readString(request.input.partition, `persist:qiuai-rpa-${workspaceSegment}`);
  const width = Math.min(readOptionalPositiveInteger(request.input.width, 1280), 3840);
  const height = Math.min(readOptionalPositiveInteger(request.input.height, 860), 2160);

  return new BrowserWindow({
    width,
    height,
    show: request.input.show !== false,
    title: 'QiuAI RPA Browser',
    webPreferences: {
      partition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  }) as RpaBrowserWindow;
}

async function loadRpaBrowserUrl(
  window: RpaBrowserWindow,
  url: string,
  timeoutMs: number
): Promise<void> {
  const loadPromise = new Promise<void>((resolve, reject) => {
    const finish = () => {
      cleanup();
      resolve();
    };
    const failLoad = (_event: unknown, errorCode: unknown, errorDescription: unknown) => {
      cleanup();
      reject(new Error(`Browser failed to load page: ${String(errorDescription || errorCode || 'unknown error')}`));
    };
    const cleanup = () => {
      window.webContents.removeListener('did-finish-load', finish);
      window.webContents.removeListener('did-fail-load', failLoad);
    };
    window.webContents.once('did-finish-load', finish);
    window.webContents.once('did-fail-load', failLoad);
  });

  await window.loadURL(url);
  await Promise.race([
    loadPromise,
    delay(timeoutMs).then(() => {
      throw new Error(`Browser page load timed out after ${timeoutMs}ms.`);
    })
  ]);
}

async function extractRpaBrowserSnapshot(
  window: RpaBrowserWindow,
  maxChars: number
): Promise<Record<string, unknown>> {
  const snapshot = await window.webContents.executeJavaScript(`(() => {
    const links = Array.from(document.querySelectorAll('a'))
      .slice(0, 80)
      .map((link) => ({
        text: (link.innerText || link.textContent || '').trim().slice(0, 160),
        href: link.href
      }))
      .filter((link) => link.text || link.href);
    return {
      title: document.title,
      url: location.href,
      text: (document.body?.innerText || '').replace(/\\n{3,}/g, '\\n\\n').trim(),
      links
    };
  })()`);

  const record = isRecord(snapshot) ? snapshot : {};
  const text = typeof record.text === 'string' ? truncate(record.text, maxChars) : '';
  return {
    title: typeof record.title === 'string' ? record.title : await readRpaBrowserTitle(window),
    url: typeof record.url === 'string' ? record.url : await readRpaBrowserUrl(window),
    text,
    links: Array.isArray(record.links) ? record.links : [],
    truncated: typeof record.text === 'string' && record.text.length > text.length
  };
}

async function executeRpaBrowserBoolean(window: RpaBrowserWindow, script: string): Promise<boolean> {
  const result = await window.webContents.executeJavaScript(script);
  return result === true;
}

async function readRpaBrowserTitle(window: RpaBrowserWindow): Promise<string> {
  return window.webContents.getTitle();
}

async function readRpaBrowserUrl(window: RpaBrowserWindow): Promise<string> {
  return window.webContents.getURL();
}

function normalizeBrowserAutomationSteps(value: unknown): Array<Record<string, unknown>> {
  const rawSteps = typeof value === 'string' ? parseJson(value) : value;
  if (!Array.isArray(rawSteps)) {
    return [];
  }

  return rawSteps.filter(isRecord).slice(0, maxBrowserSteps);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
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

function readVideoInputPath(request: DesktopToolInvocationRequest): string {
  return readRequiredString(request.input.videoPath ?? request.input.path ?? request.input.localPath, 'videoPath');
}

function readVideoInputPaths(request: DesktopToolInvocationRequest): string[] {
  const rawPaths = Array.isArray(request.input.videoPaths)
    ? request.input.videoPaths
    : [request.input.videoPath ?? request.input.path ?? request.input.localPath];
  const paths = rawPaths.flatMap((value) => {
    const filePath = readString(value, '');
    return filePath ? [filePath] : [];
  });
  if (paths.length === 0) {
    throw new Error('Tool input videoPath or videoPaths is required.');
  }
  return paths;
}

function readAudioOutputFormat(value: unknown): 'm4a' | 'mp3' | 'wav' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase().replace(/^\./, '') : '';
  return normalized === 'mp3' || normalized === 'wav' || normalized === 'm4a' ? normalized : 'm4a';
}

function readVideoCutPlan(value: unknown): Array<{ start: number; end: number; sourceIndex?: number }> {
  const rawPlan = typeof value === 'string' ? parseJson(value) : value;
  if (!Array.isArray(rawPlan)) {
    return [];
  }

  return rawPlan.flatMap((item) => {
    if (!isRecord(item)) {
      return [];
    }

    const start = readSeconds(item.start);
    const end = readSeconds(item.end);
    if (start === undefined || end === undefined || end <= start) {
      return [];
    }

    const sourceIndex = readSeconds(item.sourceIndex);
    return [{
      start,
      end,
      ...(sourceIndex !== undefined && sourceIndex >= 1 ? { sourceIndex: Math.floor(sourceIndex) } : {})
    }];
  });
}

function readSeconds(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue * 1000) / 1000 : undefined;
}

function isVideoFileExtension(extension: string): boolean {
  return ['.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'].includes(extension.toLowerCase());
}

function readRemoteDownloadMediaKind(value: unknown): 'image' | 'video' | 'file' {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'image' || normalized === 'video') {
    return normalized;
  }

  return 'file';
}

function normalizeRemoteDownloadUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Remote file URL is invalid.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS remote files can be downloaded.');
  }

  return url.toString();
}

function getRemoteDownloadFallbackFileName(remoteUrl: string, mediaKind: 'image' | 'video' | 'file'): string {
  try {
    const url = new URL(remoteUrl);
    const fileName = decodeURIComponent(path.posix.basename(url.pathname)).trim();
    if (fileName) {
      return fileName;
    }
  } catch {
    // Fall through to media-specific defaults.
  }

  return mediaKind === 'image'
    ? 'generated-image.png'
    : mediaKind === 'video'
      ? 'generated-video.mp4'
      : 'remote-file';
}

function inferRemoteDownloadExtension(input: {
  requestedFileName: string;
  remoteUrl: string;
  contentType?: string;
  mediaKind: 'image' | 'video' | 'file';
}): string {
  return normalizeFileExtension(path.extname(input.requestedFileName)) ??
    normalizeFileExtension(path.extname(getRemoteDownloadFallbackFileName(input.remoteUrl, input.mediaKind))) ??
    getRemoteDownloadExtensionFromContentType(input.contentType) ??
    (input.mediaKind === 'image' ? 'png' : input.mediaKind === 'video' ? 'mp4' : 'bin');
}

function stripRemoteDownloadExtension(fileName: string): string {
  const extension = path.extname(fileName);
  return extension ? fileName.slice(0, -extension.length) : fileName;
}

function normalizeFileExtension(extension: string): string | undefined {
  const normalized = extension.trim().toLowerCase().replace(/^\./, '');
  if (!normalized || normalized.length > 10 || /[^a-z0-9]/.test(normalized)) {
    return undefined;
  }

  return normalized === 'jpeg' ? 'jpg' : normalized;
}

function getRemoteDownloadExtensionFromContentType(contentType: string | undefined): string | undefined {
  const normalized = contentType?.split(';')[0]?.trim().toLowerCase();
  switch (normalized) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    case 'video/mp4':
      return 'mp4';
    case 'video/webm':
      return 'webm';
    case 'video/quicktime':
      return 'mov';
    default:
      return undefined;
  }
}

function createUniqueRemoteDownloadFileName(
  outputFolderPath: string,
  baseFileName: string,
  extension: string
): string {
  let fileName = `${baseFileName}.${extension}`;
  let index = 2;
  while (existsSync(path.join(outputFolderPath, fileName))) {
    fileName = `${baseFileName}-${index}.${extension}`;
    index += 1;
  }

  return fileName;
}

function createByteLimitTransform(limitBytes: number): Transform {
  let totalBytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      totalBytes += chunk.byteLength;
      if (totalBytes > limitBytes) {
        callback(new Error('Remote file is too large to store locally.'));
        return;
      }

      callback(null, chunk);
    }
  });
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

function readOptionalPositiveNumber(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error('Tool input must be a positive number.');
  }

  return Math.round(value * 1000) / 1000;
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
  const host = normalizeHostnameForNetworkPolicy(hostname);
  if (!host) {
    return true;
  }

  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }

  const ipv4 = parseIPv4Address(host);
  if (ipv4) {
    return isPrivateIPv4Address(ipv4);
  }

  return isPrivateIPv6Address(host);
}

function normalizeHostnameForNetworkPolicy(hostname: string): string {
  return hostname
    .trim()
    .toLowerCase()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/\.$/, '');
}

function parseIPv4Address(host: string): [number, number, number, number] | undefined {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) {
    return undefined;
  }

  const parts = host.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => part < 0 || part > 255)) {
    return undefined;
  }

  return parts as [number, number, number, number];
}

function isPrivateIPv4Address([first, second]: [number, number, number, number]): boolean {
  if (first === 0 || first === 10 || first === 127) {
    return true;
  }

  if (first === 100 && second >= 64 && second <= 127) {
    return true;
  }

  if (first === 169 && second === 254) {
    return true;
  }

  if (first === 172 && second >= 16 && second <= 31) {
    return true;
  }

  if (first === 192 && (second === 0 || second === 168)) {
    return true;
  }

  if (first === 198 && (second === 18 || second === 19)) {
    return true;
  }

  return first >= 224;
}

function isPrivateIPv6Address(host: string): boolean {
  if (host === '::' || host === '::1' || host.startsWith('::ffff:')) {
    return true;
  }

  const firstSegment = host.split(':')[0];
  if (!firstSegment || !/^[0-9a-f]{1,4}$/.test(firstSegment)) {
    return false;
  }

  const firstValue = Number.parseInt(firstSegment, 16);
  return (
    (firstValue >= 0xfc00 && firstValue <= 0xfdff) ||
    (firstValue >= 0xfe80 && firstValue <= 0xfebf) ||
    (firstValue >= 0xff00 && firstValue <= 0xffff)
  );
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
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number.parseInt(code, 10);
      return isValidCodePoint(value) ? String.fromCodePoint(value) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const value = Number.parseInt(code, 16);
      return isValidCodePoint(value) ? String.fromCodePoint(value) : _;
    });
}

function isValidCodePoint(value: number): boolean {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
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

function normalizeBingHtmlResults(bodyText: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const itemPattern = /<li\b[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][^>]*>([\s\S]*?)<\/li>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemPattern.exec(bodyText)) && results.length < 20) {
    const itemHtml = match[1] ?? '';
    const linkMatch = itemHtml.match(/<h2[^>]*>\s*<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/h2>/i);
    if (!linkMatch) {
      continue;
    }

    const title = extractReadableTextFromHtml(linkMatch[2] ?? '');
    const url = normalizeSearchUrl(linkMatch[1] ?? '');
    const snippetMatch = itemHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const snippet = snippetMatch?.[1]
      ? truncate(extractReadableTextFromHtml(snippetMatch[1]), 500)
      : undefined;

    if (title || url || snippet) {
      results.push({ title, url, snippet });
    }
  }

  return results;
}

function normalizeDuckDuckGoHtmlResults(bodyText: string): Array<Record<string, unknown>> {
  const results: Array<Record<string, unknown>> = [];
  const resultPattern =
    /<a\b[^>]*class=["'][^"']*\bresult__a\b[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = resultPattern.exec(bodyText)) && results.length < 20) {
    const title = extractReadableTextFromHtml(match[2] ?? '');
    const url = normalizeDuckDuckGoResultUrl(match[1] ?? '');
    if (!title && !url) {
      continue;
    }

    results.push({
      title,
      url,
      snippet: readNearestDuckDuckGoSnippet(bodyText, match.index)
    });
  }

  return results;
}

function normalizeDuckDuckGoInstantResults(bodyText: string): Array<Record<string, unknown>> {
  const parsed = parseJson(bodyText);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return [];
  }

  const record = parsed as Record<string, unknown>;
  const results: Array<Record<string, unknown>> = [];
  const abstractText = readSearchString(record.AbstractText);
  const abstractUrl = readSearchString(record.AbstractURL);
  const heading = readSearchString(record.Heading);

  if (abstractText || abstractUrl) {
    results.push({
      title: heading ?? abstractUrl ?? 'DuckDuckGo result',
      url: abstractUrl,
      snippet: abstractText
    });
  }

  collectDuckDuckGoRelatedTopics(record.RelatedTopics, results);
  return results;
}

function collectDuckDuckGoRelatedTopics(value: unknown, results: Array<Record<string, unknown>>): void {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    if (results.length >= 20 || typeof item !== 'object' || item === null || Array.isArray(item)) {
      continue;
    }

    const record = item as Record<string, unknown>;
    if (Array.isArray(record.Topics)) {
      collectDuckDuckGoRelatedTopics(record.Topics, results);
      continue;
    }

    const text = readSearchString(record.Text);
    const url = readSearchString(record.FirstURL);
    if (text || url) {
      results.push({
        title: text ? truncate(text, 120) : url,
        url,
        snippet: text
      });
    }
  }
}

function readNearestDuckDuckGoSnippet(bodyText: string, startIndex: number): string | undefined {
  const windowText = bodyText.slice(startIndex, startIndex + 2500);
  const snippetMatch = windowText.match(
    /<a\b[^>]*class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/a>/i
  ) ?? windowText.match(/<div\b[^>]*class=["'][^"']*\bresult__snippet\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);

  return snippetMatch?.[1]
    ? truncate(extractReadableTextFromHtml(snippetMatch[1]), 500)
    : undefined;
}

function normalizeSearchUrl(value: string): string | undefined {
  const decodedValue = decodeHtmlEntities(value).trim();
  return decodedValue ? decodedValue : undefined;
}

function normalizeDuckDuckGoResultUrl(value: string): string | undefined {
  const decodedValue = decodeHtmlEntities(value).trim();
  if (!decodedValue) {
    return undefined;
  }

  const absoluteValue = decodedValue.startsWith('//')
    ? `https:${decodedValue}`
    : decodedValue.startsWith('/')
      ? `https://duckduckgo.com${decodedValue}`
      : decodedValue;

  try {
    const url = new URL(absoluteValue);
    const redirectedUrl = url.searchParams.get('uddg');
    return redirectedUrl ? decodeURIComponent(redirectedUrl) : url.toString();
  } catch {
    return absoluteValue;
  }
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
