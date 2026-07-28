import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { invokeDesktopTool } from './desktop-tool.js';

const tempDir = mkdtempSync(path.join(os.tmpdir(), 'qiuai-workos-tool-'));
const workspaceId = 'workspace-tool-test';
const sourceFilePath = path.join(tempDir, 'source.txt');
const allowedRootPath = path.join(tempDir, 'allowed-root');
const allowedFilePath = path.join(allowedRootPath, 'allowed.txt');
const allowedVideoPath = path.join(allowedRootPath, 'demo.mp4');
mkdirSync(allowedRootPath, { recursive: true });
writeFileSync(sourceFilePath, 'local source text', { encoding: 'utf8' });
writeFileSync(allowedFilePath, 'allowed local source text', { encoding: 'utf8' });
writeFileSync(allowedVideoPath, Buffer.from('fake-mp4'));

const server = createServer((request, response) => {
  const chunks: Buffer[] = [];
  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => {
    const bodyText = Buffer.concat(chunks).toString('utf8');
    response.setHeader('content-type', 'application/json');

    if (request.url === '/api') {
      response.end(JSON.stringify({ ok: true, method: request.method, body: bodyText ? JSON.parse(bodyText) : null }));
      return;
    }

    if (request.url === '/mcp') {
      const body = bodyText ? JSON.parse(bodyText) : {};
      response.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: {
            content: [
              {
                type: 'text',
                text: `MCP echo: ${body.params?.arguments?.text ?? ''}`
              }
            ]
          }
        })
      );
      return;
    }

    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false }));
  });
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const serverAddress = server.address();
assert.ok(serverAddress && typeof serverAddress === 'object');
const localServerBaseUrl = `http://127.0.0.1:${serverAddress.port}`;

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

const documentExtractResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'document.extract_text',
  input: {
    path: allowedFilePath
  },
  allowedRootPaths: [allowedRootPath]
});

assert.equal(documentExtractResult.ok, true);
assert.equal(documentExtractResult.output?.text, 'allowed local source text');

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

const docxResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'office.write_docx_document',
  input: {
    title: 'Customer Follow-up Plan',
    folder: 'documents',
    fileName: 'follow-up-plan-docx',
    content: 'Next actions\nCall customer owner'
  }
});

assert.equal(docxResult.ok, true);
assert.equal(typeof docxResult.output?.localPath, 'string');
assert.ok(String(docxResult.output?.localPath).endsWith('.docx'));
assert.ok(existsSync(String(docxResult.output?.localPath)));

const docxExtractResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'document.extract_text',
  input: {
    path: String(docxResult.output?.localPath)
  }
});

assert.equal(docxExtractResult.ok, true);
assert.match(String(docxExtractResult.output?.text), /Customer Follow-up Plan/);
assert.match(String(docxExtractResult.output?.text), /Call customer owner/);

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

const xlsxResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'spreadsheet.write_xlsx',
  input: {
    folder: 'sheets',
    fileName: 'lead-score-xlsx',
    rows: [
      ['name', 'score'],
      ['Acme', 92]
    ]
  }
});

assert.equal(xlsxResult.ok, true);
assert.equal(typeof xlsxResult.output?.localPath, 'string');
assert.ok(String(xlsxResult.output?.localPath).endsWith('.xlsx'));
assert.ok(existsSync(String(xlsxResult.output?.localPath)));

const xlsxExtractResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'document.extract_text',
  input: {
    path: String(xlsxResult.output?.localPath)
  }
});

assert.equal(xlsxExtractResult.ok, true);
assert.match(String(xlsxExtractResult.output?.text), /Acme/);
assert.match(String(xlsxExtractResult.output?.text), /92/);

const pptxResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'presentation.write_pptx',
  input: {
    title: 'Enterprise AI Pilot Plan',
    folder: 'presentations',
    fileName: 'enterprise-ai-pilot',
    slides: [
      {
        title: 'Pilot Goals',
        bullets: ['Reduce repetitive work', 'Create measurable delivery outcomes']
      },
      {
        title: 'Next Actions',
        bullets: ['Confirm pilot team', 'Start with one digital employee']
      }
    ]
  }
});

assert.equal(pptxResult.ok, true);
assert.equal(typeof pptxResult.output?.localPath, 'string');
assert.ok(String(pptxResult.output?.localPath).endsWith('.pptx'));
assert.ok(existsSync(String(pptxResult.output?.localPath)));

const pptxExtractResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'office-document',
  action: 'document.extract_text',
  input: {
    path: String(pptxResult.output?.localPath)
  }
});

assert.equal(pptxExtractResult.ok, true);
assert.match(String(pptxExtractResult.output?.text), /Pilot Goals/);
assert.match(String(pptxExtractResult.output?.text), /Reduce repetitive work/);
assert.match(String(pptxExtractResult.output?.text), /Next Actions/);

const originalFetch = globalThis.fetch;
let builtInSearchResult: Awaited<ReturnType<typeof invokeDesktopTool>> | undefined;
try {
  globalThis.fetch = (async () =>
    new Response(
      [
        '<html><body>',
        '<a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fai-research">AI enterprise research</a>',
        '<a class="result__snippet">Practical enterprise research workflow.</a>',
        '</body></html>'
      ].join(''),
      {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      }
    )) as typeof fetch;

  builtInSearchResult = await invokeDesktopTool(tempDir, {
    workspaceId,
    toolId: 'web-search',
    action: 'web.search',
    input: {
      query: 'enterprise ai research',
      maxResults: 3
    }
  });
} finally {
  globalThis.fetch = originalFetch;
}

assert.ok(builtInSearchResult);
assert.equal(builtInSearchResult.ok, true);
assert.equal(builtInSearchResult.output?.provider, 'builtin-duckduckgo-html');
assert.deepEqual(builtInSearchResult.output?.results, [
  {
    title: 'AI enterprise research',
    url: 'https://example.com/ai-research',
    snippet: 'Practical enterprise research workflow.'
  }
]);

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

const blockedHttpResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'http-request',
  action: 'http.request',
  input: {
    url: `${localServerBaseUrl}/api`
  }
});

assert.equal(blockedHttpResult.ok, false);
assert.match(blockedHttpResult.message ?? '', /private network URLs are blocked/);

const httpResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'http-request',
  action: 'http.request',
  input: {
    method: 'POST',
    url: `${localServerBaseUrl}/api`,
    body: {
      message: 'hello'
    },
    allowPrivateNetwork: true
  }
});

assert.equal(httpResult.ok, true);
assert.equal((httpResult.output?.json as { ok?: boolean }).ok, true);
assert.equal((httpResult.output?.json as { body?: { message?: string } }).body?.message, 'hello');

const mcpResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'mcp',
  action: 'mcp.call',
  input: {
    endpoint: `${localServerBaseUrl}/mcp`,
    toolName: 'echo',
    arguments: {
      text: 'hello'
    },
    allowPrivateNetwork: true
  }
});

assert.equal(mcpResult.ok, true);
assert.equal(mcpResult.output?.text, 'MCP echo: hello');

const videoProbeResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'video-processing',
  action: 'video.probe',
  input: {
    videoPath: allowedVideoPath
  },
  allowedRootPaths: [allowedRootPath]
});

assert.equal(videoProbeResult.ok, true);
assert.equal(videoProbeResult.output?.localPath, allowedVideoPath);

const videoComposeWithoutFfmpegResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'video-processing',
  action: 'video.compose_clips',
  input: {
    videoPath: allowedVideoPath,
    cutPlan: [{ start: 0, end: 15 }],
    ffmpegPath: '__qiuai_missing_ffmpeg__'
  },
  allowedRootPaths: [allowedRootPath]
});

assert.equal(videoComposeWithoutFfmpegResult.ok, false);
assert.match(videoComposeWithoutFfmpegResult.message ?? '', /FFmpeg/);

const videoFramesWithoutFfmpegResult = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'video-processing',
  action: 'video.extract_frames',
  input: {
    videoPath: allowedVideoPath,
    frameIntervalSeconds: 5,
    maxFrames: 3,
    ffmpegPath: '__qiuai_missing_ffmpeg__'
  },
  allowedRootPaths: [allowedRootPath]
});

assert.equal(videoFramesWithoutFfmpegResult.ok, false);
assert.match(videoFramesWithoutFfmpegResult.message ?? '', /FFmpeg/);

const unsupported = await invokeDesktopTool(tempDir, {
  workspaceId,
  toolId: 'unknown-tool',
  action: 'filesystem.list_directory',
  input: {
    path: tempDir
  }
});

assert.equal(unsupported.ok, false);

await new Promise<void>((resolve, reject) => {
  server.close((error) => {
    if (error) {
      reject(error);
      return;
    }

    resolve();
  });
});

console.log('Desktop local filesystem tool passed.');
