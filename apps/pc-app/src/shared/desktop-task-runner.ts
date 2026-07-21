import type {
  DesktopExecutionLogEntry,
  DesktopKnowledgeSourceSummary,
  DesktopTaskDetail,
  ModelProfile,
  RolePackageManifest,
  ToolManifest
} from './desktop-contract.js';
import type {
  DesktopModelChatMessage,
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopToolInvocationAction,
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult
} from './desktop-api.js';

export type DesktopModelInvoker = (
  request: DesktopModelChatRequest
) => Promise<DesktopModelChatResponse>;

export type DesktopToolInvoker = (
  request: DesktopToolInvocationRequest
) => Promise<DesktopToolInvocationResult>;

export interface RunDesktopTaskInput {
  task: DesktopTaskDetail;
  workspaceId?: string;
  rolePackage?: RolePackageManifest;
  modelProfiles: ModelProfile[];
  tools: ToolManifest[];
  knowledgeSources?: DesktopKnowledgeSourceSummary[];
  enabledModelProfileIds: string[];
  enabledToolIds: string[];
  enabledKnowledgeBindingIds: string[];
  modelInvoker?: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  completedAt?: string;
}

export interface RunDesktopTaskResult {
  task: DesktopTaskDetail;
  usedToolIds: string[];
}

interface ResolvedRuntimeBinding {
  modelProfiles: ModelProfile[];
  availableTools: ToolManifest[];
  availableKnowledgeSources: DesktopKnowledgeSourceSummary[];
  missingToolIds: string[];
  missingKnowledgeBindingIds: string[];
  unconfiguredKnowledgeBindingIds: string[];
}

interface ModelInvocationSuccess {
  ok: true;
  profile: ModelProfile;
  response: DesktopModelChatResponse;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}

interface ModelInvocationFailure {
  ok: false;
  message: string;
  logs: DesktopExecutionLogEntry[];
}

type ModelInvocationResult = ModelInvocationSuccess | ModelInvocationFailure;

interface DesktopToolCallInstruction {
  toolId: string;
  action: DesktopToolInvocationAction;
  input: Record<string, unknown>;
}

const toolCallMarker = 'QIUAI_DESKTOP_TOOL_CALL:';
const supportedToolActions: DesktopToolInvocationAction[] = [
  'filesystem.write_text_file',
  'filesystem.read_text_file',
  'filesystem.list_directory'
];

export async function runDesktopTask(input: RunDesktopTaskInput): Promise<RunDesktopTaskResult> {
  const completedAt = input.completedAt ?? new Date().toISOString();
  const context = input.task.executionContext ?? buildContextFromRolePackage(input.rolePackage);

  if (!context) {
    return {
      task: failTask(input.task, completedAt, 'Task has no execution context. Configure role models and tools first.'),
      usedToolIds: []
    };
  }

  const binding = resolveRuntimeBinding({
    context,
    modelProfiles: input.modelProfiles,
    tools: input.tools,
    knowledgeSources: input.knowledgeSources ?? [],
    enabledModelProfileIds: input.enabledModelProfileIds,
    enabledToolIds: input.enabledToolIds,
    enabledKnowledgeBindingIds: input.enabledKnowledgeBindingIds
  });

  if (binding.modelProfiles.length === 0) {
    return {
      task: failTask(
        input.task,
        completedAt,
        'No enabled model profile is available for this task. Enable a model profile before running it.'
      ),
      usedToolIds: []
    };
  }

  if (!input.modelInvoker) {
    return {
      task: failTask(
        input.task,
        completedAt,
        'Desktop model bridge is unavailable. Run the desktop app with the Electron bridge enabled.'
      ),
      usedToolIds: []
    };
  }

  const configuredModelProfiles = binding.modelProfiles.filter(isModelApiConfigured);

  if (configuredModelProfiles.length === 0) {
    return {
      task: failTask(
        input.task,
        completedAt,
        'No configured model API profile is available for this task. Add API Base URL and API Key before running it.',
        buildModelConfigWarningLogs(input.task, binding.modelProfiles, completedAt)
      ),
      usedToolIds: []
    };
  }

  const invocation = await invokeConfiguredModel({
    task: input.task,
    binding,
    profiles: configuredModelProfiles,
    modelInvoker: input.modelInvoker,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: completedAt
  });

  if (!invocation.ok) {
    return {
      task: failTask(input.task, completedAt, invocation.message, invocation.logs),
      usedToolIds: []
    };
  }

  return {
    task: completeTask(input.task, completedAt, binding, invocation),
    usedToolIds: invocation.usedToolIds
  };
}

function buildContextFromRolePackage(rolePackage?: RolePackageManifest) {
  if (!rolePackage) {
    return undefined;
  }

  return {
    modelProfileIds: [...rolePackage.modelProfileIds],
    toolIds: [...rolePackage.toolIds],
    knowledgeBindingIds: rolePackage.requiredKnowledgeSources.map((source) => source)
  };
}

function resolveRuntimeBinding(input: {
  context: NonNullable<DesktopTaskDetail['executionContext']>;
  modelProfiles: ModelProfile[];
  tools: ToolManifest[];
  knowledgeSources: DesktopKnowledgeSourceSummary[];
  enabledModelProfileIds: string[];
  enabledToolIds: string[];
  enabledKnowledgeBindingIds: string[];
}): ResolvedRuntimeBinding {
  const enabledModelIds = new Set(input.enabledModelProfileIds);
  const enabledToolIds = new Set(input.enabledToolIds);
  const enabledKnowledgeIds = new Set(input.enabledKnowledgeBindingIds);
  const modelProfilesById = new Map(input.modelProfiles.map((profile) => [profile.id, profile]));
  const toolsById = new Map(input.tools.map((tool) => [tool.id, tool]));
  const knowledgeSourcesById = new Map(input.knowledgeSources.map((source) => [source.id, source]));

  const modelProfiles = input.context.modelProfileIds.flatMap((profileId) => {
    const profile = modelProfilesById.get(profileId);
    return profile && enabledModelIds.has(profileId) ? [profile] : [];
  });
  const availableTools = input.context.toolIds.flatMap((toolId) => {
    const tool = toolsById.get(toolId);
    return tool && enabledToolIds.has(toolId) ? [tool] : [];
  });
  const missingToolIds = input.context.toolIds.filter((toolId) => !enabledToolIds.has(toolId));
  const missingKnowledgeBindingIds = input.context.knowledgeBindingIds.filter(
    (bindingId) => !enabledKnowledgeIds.has(bindingId)
  );
  const availableKnowledgeSources = input.context.knowledgeBindingIds.flatMap((bindingId) => {
    const source = knowledgeSourcesById.get(bindingId);
    return source && source.enabled && enabledKnowledgeIds.has(bindingId) ? [source] : [];
  });
  const unconfiguredKnowledgeBindingIds = input.context.knowledgeBindingIds.filter(
    (bindingId) => enabledKnowledgeIds.has(bindingId) && !knowledgeSourcesById.has(bindingId)
  );

  return {
    modelProfiles,
    availableTools,
    availableKnowledgeSources,
    missingToolIds,
    missingKnowledgeBindingIds,
    unconfiguredKnowledgeBindingIds
  };
}

function completeTask(
  task: DesktopTaskDetail,
  completedAt: string,
  binding: ResolvedRuntimeBinding,
  invocation: ModelInvocationSuccess
): DesktopTaskDetail {
  const primaryModel = invocation.profile;
  const inputTokens = invocation.response.inputTokens ?? estimateInputTokens(task);
  const outputTokens = invocation.response.outputTokens ?? estimateOutputTokens(task);
  const costCents = estimateCostCents(inputTokens, outputTokens, binding.modelProfiles);
  const artifact = {
    id: `${task.taskId}-artifact-${Date.parse(completedAt) || Date.now()}`,
    type: 'report' as const,
    title: `${task.title} - Model execution report`,
    content: buildArtifactContent(task, binding, invocation.response),
    createdAt: completedAt
  };
  const executionLogs = [
    ...task.executionLogs,
    createLog(task.taskId, 'info', 'LOCAL_RUN_STARTED', 'Local desktop runner started the task.', completedAt),
    ...buildWarningLogs(task, binding, completedAt),
    ...buildModelConfigWarningLogs(
      task,
      binding.modelProfiles.filter((profile) => !isModelApiConfigured(profile)),
      completedAt
    ),
    createLog(
      task.taskId,
      'info',
      'MODEL_SELECTED',
      `Primary model: ${primaryModel.providerName} / ${primaryModel.modelName}.`,
      completedAt
    ),
    ...invocation.logs,
    createLog(task.taskId, 'info', 'MODEL_RESPONSE_RECEIVED', 'Model response was received.', completedAt),
    createLog(task.taskId, 'info', 'ARTIFACT_CREATED', 'Local execution report was created.', completedAt),
    createLog(task.taskId, 'info', 'TASK_COMPLETED', 'Task completed by local desktop runner.', completedAt)
  ];

  return {
    ...task,
    state: 'completed',
    updatedAt: completedAt,
    artifactCount: task.artifacts.length + 1,
    costCents: (task.costCents ?? 0) + costCents,
    artifacts: [...task.artifacts, artifact],
    executionLogs,
    costRecords: [
      ...task.costRecords,
      {
        id: `${task.taskId}-cost-${Date.parse(completedAt) || Date.now()}`,
        provider: primaryModel.providerName,
        modelName: primaryModel.modelName,
        inputTokens,
        outputTokens,
        costCents,
        currency: 'CNY',
        createdAt: completedAt
      }
    ],
    currentRun: {
      id: task.currentRun?.id ?? `${task.taskId}-run-1`,
      taskId: task.taskId,
      status: 'completed',
      startedAt: task.currentRun?.startedAt ?? task.createdAt,
      finishedAt: completedAt
    }
  };
}

function failTask(
  task: DesktopTaskDetail,
  failedAt: string,
  message: string,
  logs: DesktopExecutionLogEntry[] = []
): DesktopTaskDetail {
  return {
    ...task,
    state: 'failed',
    updatedAt: failedAt,
    executionLogs: [
      ...task.executionLogs,
      ...logs,
      createLog(task.taskId, 'error', 'LOCAL_RUN_FAILED', message, failedAt)
    ],
    currentRun: {
      id: task.currentRun?.id ?? `${task.taskId}-run-1`,
      taskId: task.taskId,
      status: 'failed',
      startedAt: task.currentRun?.startedAt ?? task.createdAt,
      finishedAt: failedAt
    }
  };
}

function buildWarningLogs(
  task: DesktopTaskDetail,
  binding: ResolvedRuntimeBinding,
  createdAt: string
): DesktopExecutionLogEntry[] {
  const logs: DesktopExecutionLogEntry[] = [];

  if (binding.missingToolIds.length > 0) {
    logs.push(
      createLog(
        task.taskId,
        'warning',
        'TOOL_BINDING_SKIPPED',
        `Disabled or unavailable tools were skipped: ${binding.missingToolIds.join(', ')}.`,
        createdAt
      )
    );
  }

  if (binding.missingKnowledgeBindingIds.length > 0) {
    logs.push(
      createLog(
        task.taskId,
        'warning',
        'KNOWLEDGE_BINDING_MISSING',
        `Knowledge bindings are not enabled: ${binding.missingKnowledgeBindingIds.join(', ')}.`,
        createdAt
      )
    );
  }

  if (binding.unconfiguredKnowledgeBindingIds.length > 0) {
    logs.push(
      createLog(
        task.taskId,
        'warning',
        'KNOWLEDGE_SOURCE_UNCONFIGURED',
        `Knowledge bindings are enabled but not configured: ${binding.unconfiguredKnowledgeBindingIds.join(', ')}.`,
        createdAt
      )
    );
  }

  return logs;
}

async function invokeConfiguredModel(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
}): Promise<ModelInvocationResult> {
  const logs: DesktopExecutionLogEntry[] = [];
  const messages = buildModelMessages(input.task, input.binding);

  for (const profile of input.profiles) {
    logs.push(
      createLog(
        input.task.taskId,
        'info',
        'MODEL_REQUEST_STARTED',
        `Invoking model: ${profile.providerName} / ${profile.modelName}.`,
        input.createdAt,
        profile.id
      )
    );

    try {
      const response = await input.modelInvoker({
        profile,
        messages,
        timeoutMs: 45_000
      });
      const toolExecution = await maybeExecuteDesktopToolCall({
        task: input.task,
        binding: input.binding,
        profile,
        response,
        messages,
        modelInvoker: input.modelInvoker,
        desktopToolInvoker: input.desktopToolInvoker,
        workspaceId: input.workspaceId,
        createdAt: input.createdAt
      });

      logs.push(...toolExecution.logs);

      return {
        ok: true,
        profile,
        response: toolExecution.response,
        logs,
        usedToolIds: toolExecution.usedToolIds
      };
    } catch (error) {
      logs.push(
        createLog(
          input.task.taskId,
          'warning',
          'MODEL_REQUEST_FAILED',
          `Model failed: ${profile.providerName} / ${profile.modelName}. ${readErrorMessage(error)}`,
          input.createdAt,
          profile.id
        )
      );
    }
  }

  return {
    ok: false,
    message: 'All configured model API profiles failed. Check API Base URL, API Key, model name, and network access.',
    logs
  };
}

async function maybeExecuteDesktopToolCall(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  profile: ModelProfile;
  response: DesktopModelChatResponse;
  messages: DesktopModelChatMessage[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
}): Promise<{
  response: DesktopModelChatResponse;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}> {
  const logs: DesktopExecutionLogEntry[] = [];
  const toolCall = parseDesktopToolCall(input.response.content);

  if (!toolCall) {
    return {
      response: input.response,
      logs,
      usedToolIds: []
    };
  }

  logs.push(
    createLog(
      input.task.taskId,
      'info',
      'TOOL_CALL_DETECTED',
      `Model requested desktop tool action: ${toolCall.toolId}/${toolCall.action}.`,
      input.createdAt
    )
  );

  const availableTool = input.binding.availableTools.find((tool) => tool.id === toolCall.toolId);
  if (!availableTool) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_REJECTED',
        `Requested tool is not enabled for this task: ${toolCall.toolId}.`,
        input.createdAt
      )
    );
    return {
      response: {
        ...input.response,
        content: removeToolCallBlock(input.response.content)
      },
      logs,
      usedToolIds: []
    };
  }

  if (!input.desktopToolInvoker || !input.workspaceId) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_SKIPPED',
        'Desktop tool bridge or workspace ID is unavailable.',
        input.createdAt
      )
    );
    return {
      response: {
        ...input.response,
        content: removeToolCallBlock(input.response.content)
      },
      logs,
      usedToolIds: []
    };
  }

  let toolResult: DesktopToolInvocationResult;
  try {
    toolResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: toolCall.toolId,
      action: toolCall.action,
      input: toolCall.input,
      allowedRootPaths: input.binding.availableKnowledgeSources.flatMap((source) =>
        source.localPath ? [source.localPath] : []
      )
    });
  } catch (error) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_FAILED',
        error instanceof Error ? error.message : `Desktop tool failed: ${toolCall.toolId}/${toolCall.action}.`,
        input.createdAt
      )
    );
    return {
      response: {
        ...input.response,
        content: removeToolCallBlock(input.response.content)
      },
      logs,
      usedToolIds: []
    };
  }

  if (!toolResult.ok) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_FAILED',
        toolResult.message ?? `Desktop tool failed: ${toolCall.toolId}/${toolCall.action}.`,
        input.createdAt
      )
    );
    return {
      response: {
        ...input.response,
        content: removeToolCallBlock(input.response.content)
      },
      logs,
      usedToolIds: []
    };
  }

  logs.push(
    createLog(
      input.task.taskId,
      'info',
      'TOOL_INVOKED',
      `Desktop tool executed: ${availableTool.name} / ${toolCall.action}.`,
      input.createdAt
    )
  );

  let finalResponse: DesktopModelChatResponse;
  try {
    finalResponse = await input.modelInvoker({
      profile: input.profile,
      timeoutMs: 45_000,
      messages: [
        ...input.messages,
        {
          role: 'assistant',
          content: input.response.content
        },
        {
          role: 'user',
          content: [
            'Desktop tool result:',
            JSON.stringify(toolResult, null, 2),
            '',
            'Now produce the final Chinese task result. Mention generated local paths when they are relevant.'
          ].join('\n')
        }
      ]
    });
  } catch (error) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'TOOL_RESULT_FINALIZATION_FAILED',
        error instanceof Error ? error.message : 'Model failed after desktop tool execution.',
        input.createdAt
      )
    );
    return {
      response: {
        ...input.response,
        content: [
          removeToolCallBlock(input.response.content),
          '',
          'Desktop tool result:',
          JSON.stringify(toolResult, null, 2)
        ].join('\n').trim()
      },
      logs,
      usedToolIds: [toolCall.toolId]
    };
  }

  logs.push(
    createLog(
      input.task.taskId,
      'info',
      'TOOL_RESULT_RETURNED_TO_MODEL',
      `Desktop tool result was returned to model: ${toolCall.toolId}.`,
      input.createdAt
    )
  );

  return {
    response: {
      ...finalResponse,
      inputTokens: sumOptionalTokenCounts(input.response.inputTokens, finalResponse.inputTokens),
      outputTokens: sumOptionalTokenCounts(input.response.outputTokens, finalResponse.outputTokens)
    },
    logs,
    usedToolIds: [toolCall.toolId]
  };
}

function buildModelConfigWarningLogs(
  task: DesktopTaskDetail,
  modelProfiles: ModelProfile[],
  createdAt: string
): DesktopExecutionLogEntry[] {
  const unconfiguredProfiles = modelProfiles.filter(
    (profile) => !profile.apiBaseUrl || !profile.apiKey
  );
  if (unconfiguredProfiles.length === 0) {
    return [];
  }

  return [
    createLog(
      task.taskId,
      'warning',
      'MODEL_API_CONFIG_MISSING',
      `Model API config is incomplete for: ${unconfiguredProfiles.map((profile) => profile.id).join(', ')}.`,
      createdAt
    )
  ];
}

function buildModelMessages(
  task: DesktopTaskDetail,
  binding: ResolvedRuntimeBinding
): DesktopModelChatMessage[] {
  const tools = binding.availableTools.map((tool) => `${tool.name} (${tool.capabilities.join(', ')})`);
  const knowledgeContext = binding.availableKnowledgeSources
    .map((source) => formatKnowledgeSourceForPrompt(source))
    .join('\n---\n');

  return [
    {
      role: 'system',
      content: [
        'You are a QiuAI WorkOS desktop digital employee.',
        `Role: ${task.roleName}`,
        `Task type: ${task.taskType}`,
        'Use the provided task input and local runtime context.',
        'Do not claim that files or external tools were changed unless a tool result is provided.',
        `When a local desktop tool is needed, output exactly one line starting with ${toolCallMarker} followed by compact JSON: {"toolId":"local-filesystem","action":"filesystem.write_text_file","input":{"folder":"reports","fileName":"result","content":"..."}}.`,
        'Only request a desktop tool when it is necessary; otherwise produce the final answer directly.',
        'Return a practical Chinese work result with next actions when appropriate.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Task title: ${task.title}`,
        `Task input: ${task.input}`,
        `Available tools: ${tools.length > 0 ? tools.join('; ') : 'none'}`,
        `Knowledge context:\n${knowledgeContext || 'none'}`,
        `Missing knowledge bindings: ${binding.missingKnowledgeBindingIds.join(', ') || 'none'}`
      ].join('\n')
    }
  ];
}

function parseDesktopToolCall(content: string): DesktopToolCallInstruction | undefined {
  const markerIndex = content.indexOf(toolCallMarker);
  if (markerIndex < 0) {
    return undefined;
  }

  const jsonText = extractFirstJsonObject(content.slice(markerIndex + toolCallMarker.length));
  if (!jsonText) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(jsonText) as Partial<DesktopToolCallInstruction>;
    if (
      typeof parsed.toolId === 'string' &&
      isDesktopToolInvocationAction(parsed.action) &&
      parsed.input &&
      typeof parsed.input === 'object' &&
      !Array.isArray(parsed.input)
    ) {
      return {
        toolId: parsed.toolId,
        action: parsed.action,
        input: parsed.input as Record<string, unknown>
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function extractFirstJsonObject(value: string): string | undefined {
  const start = value.indexOf('{');
  if (start < 0) {
    return undefined;
  }

  let depth = 0;
  let isInString = false;
  let isEscaped = false;

  for (let index = start; index < value.length; index += 1) {
    const character = value[index];

    if (isEscaped) {
      isEscaped = false;
      continue;
    }

    if (character === '\\') {
      isEscaped = true;
      continue;
    }

    if (character === '"') {
      isInString = !isInString;
      continue;
    }

    if (isInString) {
      continue;
    }

    if (character === '{') {
      depth += 1;
    }

    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function removeToolCallBlock(content: string): string {
  const markerIndex = content.indexOf(toolCallMarker);
  if (markerIndex < 0) {
    return content;
  }

  const beforeMarker = content.slice(0, markerIndex).trim();
  return beforeMarker || 'Model requested a desktop tool, but the tool call was not executed.';
}

function isDesktopToolInvocationAction(value: unknown): value is DesktopToolInvocationAction {
  return typeof value === 'string' && supportedToolActions.includes(value as DesktopToolInvocationAction);
}

function sumOptionalTokenCounts(left: number | undefined, right: number | undefined): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }

  return (left ?? 0) + (right ?? 0);
}

function buildArtifactContent(
  task: DesktopTaskDetail,
  binding: ResolvedRuntimeBinding,
  response: DesktopModelChatResponse
): string {
  const models = binding.modelProfiles
    .map((profile) => `${profile.providerName}/${profile.modelName}`)
    .join(', ');
  const tools = binding.availableTools.map((tool) => tool.name).join(', ') || 'No enabled tools';
  const configuredModelCount = binding.modelProfiles.filter(
    isModelApiConfigured
  ).length;
  const knowledgeSources = binding.availableKnowledgeSources
    .map((source) => source.label)
    .join(', ') || 'No configured knowledge sources';

  return [
    `Task: ${task.title}`,
    `Role: ${task.roleName}`,
    `Input: ${task.input}`,
    `Models: ${models}`,
    `Configured model connections: ${configuredModelCount}/${binding.modelProfiles.length}`,
    `Tools: ${tools}`,
    `Knowledge sources: ${knowledgeSources}`,
    `Missing knowledge bindings: ${binding.missingKnowledgeBindingIds.length}`,
    `Unconfigured knowledge bindings: ${binding.unconfiguredKnowledgeBindingIds.length}`,
    '',
    'Model output:',
    response.content
  ].join('\n');
}

function formatKnowledgeSourceForPrompt(source: DesktopKnowledgeSourceSummary): string {
  return [
    `Source: ${source.label}`,
    `Type: ${source.source}`,
    `Path: ${source.localPath ?? 'none'}`,
    `Indexed at: ${source.lastIndexedAt ?? 'not indexed'}`,
    `Summary: ${truncateForPrompt(source.summary ?? 'No summary available.', 2_000)}`
  ].join('\n');
}

function truncateForPrompt(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength)}...`;
}

function createLog(
  taskId: string,
  level: DesktopExecutionLogEntry['level'],
  eventType: string,
  message: string,
  createdAt: string,
  suffix?: string
): DesktopExecutionLogEntry {
  const suffixPart = suffix ? `-${suffix}` : '';
  return {
    id: `${taskId}-log-${eventType.toLowerCase()}${suffixPart}-${Date.parse(createdAt) || Date.now()}`,
    level,
    eventType,
    message,
    createdAt
  };
}

function isModelApiConfigured(profile: ModelProfile): boolean {
  return Boolean(profile.apiBaseUrl?.trim() && profile.apiKey?.trim());
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown model API error';
}

function estimateInputTokens(task: DesktopTaskDetail): number {
  return Math.max(100, (task.title.length + task.input.length) * 6);
}

function estimateOutputTokens(task: DesktopTaskDetail): number {
  return Math.max(120, task.title.length * 20);
}

function estimateCostCents(inputTokens: number, outputTokens: number, modelProfiles: ModelProfile[]): number {
  const profileMultiplier = Math.max(1, modelProfiles.length);
  return Math.max(20, Math.ceil((inputTokens + outputTokens) / 100) * profileMultiplier);
}
