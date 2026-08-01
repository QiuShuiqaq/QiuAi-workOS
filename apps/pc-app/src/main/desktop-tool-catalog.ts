import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type {
  DesktopServerToolActionCatalog,
  DesktopToolActionHealthSummary,
  DesktopToolSummary,
  ToolCapability,
  ToolEntryPoint,
  ToolManifest,
  ToolScope
} from '../shared/desktop-contract.js';

const execFileAsync = promisify(execFile);

const localAdapterActionIds = new Set([
  'filesystem.write_text_file',
  'filesystem.read_text_file',
  'filesystem.list_directory',
  'filesystem.package_zip',
  'document.extract_text',
  'web.fetch_url',
  'web.search',
  'http.request',
  'mcp.call',
  'office.write_markdown_document',
  'office.write_docx_document',
  'spreadsheet.write_csv',
  'spreadsheet.write_xlsx',
  'presentation.write_pptx',
  'presentation.write_outline_markdown',
  'video.probe',
  'video.extract_audio',
  'video.extract_frames',
  'video.compose_clips',
  'video.export_mp4'
]);

const dependencyCommandById: Record<string, string> = {
  ffmpeg: 'ffmpeg',
  ffprobe: 'ffprobe'
};

export async function buildDesktopToolStateFromServerCatalog(input: {
  catalog: DesktopServerToolActionCatalog;
  enabledToolIds?: string[];
  checkedAt?: string;
}): Promise<{
  tools: ToolManifest[];
  toolSummaries: DesktopToolSummary[];
  toolActions: DesktopToolActionHealthSummary[];
  enabledToolIds: string[];
}> {
  const checkedAt = input.checkedAt ?? new Date().toISOString();
  const serverToolIds = input.catalog.packages.map((toolPackage) => toolPackage.id);
  const enabledToolIdSet =
    input.enabledToolIds && input.enabledToolIds.length > 0
      ? new Set(input.enabledToolIds.filter((toolId) => serverToolIds.includes(toolId)))
      : new Set(serverToolIds);
  const dependencyStatus = await checkRequiredDependencies(input.catalog);
  const tools = input.catalog.packages.map<ToolManifest>((toolPackage) => {
    const actions = input.catalog.actions.filter((action) => action.packageId === toolPackage.id);
    return {
      id: toolPackage.id,
      name: toolPackage.name,
      version: 'server-defined',
      scope: resolveToolScope(toolPackage.category),
      entryPoint: resolveToolEntryPoint(toolPackage.id),
      capabilities: resolveToolCapabilities(toolPackage.category),
      requiresApproval: false,
      actions: actions.map((action) => ({
        action: action.actionId,
        name: action.name,
        description: action.description,
        category: action.category,
        inputTypes: action.input.map((port) => port.type),
        outputTypes: action.output.map((port) => port.type),
        requiredConfig: action.requiredConfig,
        requiredDependencies: action.requiredDependencies,
        maturity: action.maturity,
        artifactFormat: action.artifactFormat
      }))
    };
  });

  const toolActions = input.catalog.actions.map<DesktopToolActionHealthSummary>((action) => {
    const missingDependencies = action.requiredDependencies.filter(
      (dependency) => dependencyStatus.get(dependency) === false
    );
    const packageEnabled = enabledToolIdSet.has(action.packageId);
    const adapterAvailable = localAdapterActionIds.has(action.actionId);
    const status: DesktopToolActionHealthSummary['status'] = !packageEnabled
      ? 'disabled'
      : !adapterAvailable
        ? 'unavailable'
        : missingDependencies.length > 0
          ? 'missing_dependency'
          : action.maturity === 'experimental'
            ? 'experimental'
            : 'ready';

    return {
      toolId: action.packageId,
      actionId: action.actionId,
      name: action.name,
      category: action.category,
      status,
      inputTypes: action.input.map((port) => port.type),
      outputTypes: action.output.map((port) => port.type),
      requiredConfig: action.requiredConfig,
      missingConfig: [],
      requiredDependencies: action.requiredDependencies,
      missingDependencies,
      message: buildToolActionHealthMessage(status, missingDependencies),
      checkedAt
    };
  });

  const toolSummaries = tools.map((tool) => ({
    toolId: tool.id,
    enabled: enabledToolIdSet.has(tool.id)
  }));

  return {
    tools,
    toolSummaries,
    toolActions,
    enabledToolIds: [...enabledToolIdSet]
  };
}

function resolveToolScope(category: string): ToolScope {
  if (category === 'web') return 'hybrid';
  return 'desktop';
}

function resolveToolEntryPoint(toolId: string): ToolEntryPoint {
  if (toolId === 'mcp') return 'mcp';
  if (toolId === 'local-filesystem' || toolId === 'video-processing') return 'native';
  return 'bridge';
}

function resolveToolCapabilities(category: string): ToolCapability[] {
  switch (category) {
    case 'web':
      return ['web_search'];
    case 'document':
      return ['document_extract', 'document_edit', 'presentation_edit', 'spreadsheet_edit'];
    case 'file':
      return ['filesystem'];
    case 'video':
      return ['video_processing'];
    case 'integration':
      return ['custom_api', 'mcp'];
    default:
      return ['custom_api'];
  }
}

async function checkRequiredDependencies(catalog: DesktopServerToolActionCatalog): Promise<Map<string, boolean>> {
  const dependencies = [
    ...new Set(catalog.actions.flatMap((action) => action.requiredDependencies))
  ];
  const checks = await Promise.all(
    dependencies.map(async (dependency) => [dependency, await isDependencyAvailable(dependency)] as const)
  );

  return new Map(checks);
}

async function isDependencyAvailable(dependency: string): Promise<boolean> {
  const command = dependencyCommandById[dependency];
  if (!command) {
    return false;
  }

  try {
    await execFileAsync(command, ['-version'], {
      timeout: 1500,
      windowsHide: true
    });
    return true;
  } catch {
    return false;
  }
}

function buildToolActionHealthMessage(
  status: DesktopToolActionHealthSummary['status'],
  missingDependencies: string[]
): string | undefined {
  if (status === 'missing_dependency') {
    return `缺少依赖：${missingDependencies.join('、')}`;
  }
  if (status === 'unavailable') {
    return '当前客户端没有这个服务端工具 action 的本地执行适配器。';
  }
  if (status === 'experimental') {
    return '实验能力，可以测试使用。';
  }
  if (status === 'disabled') {
    return '这个服务端工具包当前未在本机启用。';
  }

  return undefined;
}
