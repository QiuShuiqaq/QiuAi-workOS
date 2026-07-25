import type {
  DesktopArtifactSummary,
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

export type DesktopTaskProgressCallback = (
  task: DesktopTaskDetail
) => void | Promise<void>;

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
  onProgress?: DesktopTaskProgressCallback;
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
  generatedArtifacts: DesktopArtifactSummary[];
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

interface AttachmentContextPreparation {
  context: string;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}

const toolCallMarker = 'QIUAI_DESKTOP_TOOL_CALL:';
const maxDesktopToolTurns = 3;
const maxAttachmentContextFiles = 5;
const maxAttachmentContextChars = 40_000;
const supportedToolActions: DesktopToolInvocationAction[] = [
  'filesystem.write_text_file',
  'filesystem.read_text_file',
  'filesystem.list_directory',
  'document.extract_text',
  'web.fetch_url',
  'web.search',
  'office.write_markdown_document',
  'spreadsheet.write_csv',
  'presentation.write_outline_markdown'
];

async function emitTaskProgress(input: {
  onProgress?: DesktopTaskProgressCallback;
  task: DesktopTaskDetail;
  updatedAt: string;
  executionLogs?: DesktopExecutionLogEntry[];
  artifacts?: DesktopArtifactSummary[];
  state?: DesktopTaskDetail['state'];
  currentRunStatus?: NonNullable<DesktopTaskDetail['currentRun']>['status'];
}): Promise<DesktopTaskDetail> {
  const snapshot: DesktopTaskDetail = {
    ...input.task,
    state: input.state ?? input.task.state,
    updatedAt: input.updatedAt,
    artifactCount: input.artifacts ? input.artifacts.length : input.task.artifactCount,
    artifacts: input.artifacts ?? input.task.artifacts,
    executionLogs: [...input.task.executionLogs, ...(input.executionLogs ?? [])],
    currentRun: input.task.currentRun
      ? {
          ...input.task.currentRun,
          status: input.currentRunStatus ?? input.task.currentRun.status,
          finishedAt:
            input.currentRunStatus && input.currentRunStatus !== 'running'
              ? input.updatedAt
              : input.task.currentRun.finishedAt
        }
      : input.task.currentRun
  };

  if (!input.onProgress) {
    return snapshot;
  }

  await input.onProgress(snapshot);
  return snapshot;
}

export async function runDesktopTask(input: RunDesktopTaskInput): Promise<RunDesktopTaskResult> {
  const completedAt = input.completedAt ?? new Date().toISOString();
  const context = input.task.executionContext ?? buildContextFromRolePackage(input.rolePackage);

  if (!context) {
    const failedTask = failTask(
      input.task,
      completedAt,
      'Task has no execution context. Configure role models and tools first.'
    );
    await emitTaskProgress({
      onProgress: input.onProgress,
      task: failedTask,
      updatedAt: completedAt,
      state: 'failed',
      currentRunStatus: 'failed'
    });
    return {
      task: failedTask,
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
    const failedTask = failTask(
      input.task,
      completedAt,
      'No enabled model profile is available for this task. Enable a model profile before running it.'
    );
    await emitTaskProgress({
      onProgress: input.onProgress,
      task: failedTask,
      updatedAt: completedAt,
      state: 'failed',
      currentRunStatus: 'failed'
    });
    return {
      task: failedTask,
      usedToolIds: []
    };
  }

  if (!input.modelInvoker) {
    const failedTask = failTask(
      input.task,
      completedAt,
      'Desktop model bridge is unavailable. Run the desktop app with the Electron bridge enabled.'
    );
    await emitTaskProgress({
      onProgress: input.onProgress,
      task: failedTask,
      updatedAt: completedAt,
      state: 'failed',
      currentRunStatus: 'failed'
    });
    return {
      task: failedTask,
      usedToolIds: []
    };
  }

  const configuredModelProfiles = binding.modelProfiles.filter(isModelApiConfigured);

  if (configuredModelProfiles.length === 0) {
    const failedTask = failTask(
      input.task,
      completedAt,
      'No configured model API profile is available for this task. Add API Base URL and API Key before running it.',
      buildModelConfigWarningLogs(input.task, binding.modelProfiles, completedAt)
    );
    await emitTaskProgress({
      onProgress: input.onProgress,
      task: failedTask,
      updatedAt: completedAt,
      state: 'failed',
      currentRunStatus: 'failed'
    });
    return {
      task: failedTask,
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
    createdAt: completedAt,
    onProgress: input.onProgress
  });

  if (!invocation.ok) {
    const failedTask = failTask(input.task, completedAt, invocation.message, invocation.logs);
    await emitTaskProgress({
      onProgress: input.onProgress,
      task: failedTask,
      updatedAt: completedAt,
      state: 'failed',
      currentRunStatus: 'failed'
    });
    return {
      task: failedTask,
      usedToolIds: []
    };
  }

  const completedTask = completeTask(input.task, completedAt, binding, invocation);
  await emitTaskProgress({
    onProgress: input.onProgress,
    task: completedTask,
    updatedAt: completedAt,
    artifacts: completedTask.artifacts,
    state: 'completed',
    currentRunStatus: 'completed'
  });
  return {
    task: completedTask,
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
  const reportArtifact = {
    id: `${task.taskId}-artifact-${Date.parse(completedAt) || Date.now()}`,
    type: 'report' as const,
    title: `${task.title} - Model execution report`,
    content: buildArtifactContent(task, binding, invocation.response),
    createdAt: completedAt
  };
  const userArtifacts = [...task.artifacts, ...invocation.generatedArtifacts].filter(
    isUserDeliverableArtifact
  );
  const finalAnswerArtifact =
    userArtifacts.length > 0
      ? undefined
      : buildFinalAnswerArtifact(task, invocation.response, completedAt);
  const artifacts = [
    ...task.artifacts,
    ...invocation.generatedArtifacts,
    ...(finalAnswerArtifact ? [finalAnswerArtifact] : []),
    reportArtifact
  ];
  const userArtifactCount = artifacts.filter(isUserDeliverableArtifact).length;
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
    createLog(
      task.taskId,
      'info',
      'ARTIFACT_CREATED',
      `Task deliverables were prepared: ${userArtifactCount}.`,
      completedAt
    ),
    createLog(task.taskId, 'info', 'TASK_COMPLETED', 'Task completed by local desktop runner.', completedAt)
  ];

  return {
    ...task,
    state: 'completed',
    updatedAt: completedAt,
    artifactCount: userArtifactCount,
    costCents: (task.costCents ?? 0) + costCents,
    artifacts,
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
  onProgress?: DesktopTaskProgressCallback;
}): Promise<ModelInvocationResult> {
  const logs: DesktopExecutionLogEntry[] = [];
  let progressTask = input.task;
  const attachmentContext = await prepareAttachmentContext({
    task: input.task,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: input.createdAt
  });
  logs.push(...attachmentContext.logs);
  if (attachmentContext.logs.length > 0) {
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: attachmentContext.logs,
      state: 'running',
      currentRunStatus: 'running'
    });
  }
  const messages = buildModelMessages(input.task, input.binding, attachmentContext.context);

  for (const profile of input.profiles) {
    const modelRequestLog = createLog(
      input.task.taskId,
      'info',
      'MODEL_REQUEST_STARTED',
      `Invoking model: ${profile.providerName} / ${profile.modelName}.`,
      input.createdAt,
      profile.id
    );
    logs.push(modelRequestLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [modelRequestLog],
      state: 'running',
      currentRunStatus: 'running'
    });

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
        createdAt: input.createdAt,
        onProgress: input.onProgress,
        progressTask
      });

      logs.push(...toolExecution.logs);
      if (toolExecution.progressTask) {
        progressTask = toolExecution.progressTask;
      }

      return {
        ok: true,
        profile,
        response: toolExecution.response,
        logs,
        usedToolIds: [...new Set([...attachmentContext.usedToolIds, ...toolExecution.usedToolIds])],
        generatedArtifacts: toolExecution.generatedArtifacts
      };
    } catch (error) {
      const modelFailureLog = createLog(
        input.task.taskId,
        'warning',
        'MODEL_REQUEST_FAILED',
        `Model failed: ${profile.providerName} / ${profile.modelName}. ${readErrorMessage(error)}`,
        input.createdAt,
        profile.id
      );
      logs.push(modelFailureLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [modelFailureLog],
        state: 'running',
        currentRunStatus: 'running'
      });
    }
  }

  return {
    ok: false,
    message: 'All configured model API profiles failed. Check API Base URL, API Key, model name, and network access.',
    logs
  };
}

async function prepareAttachmentContext(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
}): Promise<AttachmentContextPreparation> {
  const attachmentPaths = (input.task.executionContext?.attachmentPaths ?? [])
    .map((attachmentPath) => attachmentPath.trim())
    .filter(Boolean)
    .slice(0, maxAttachmentContextFiles);

  if (attachmentPaths.length === 0) {
    return { context: '', logs: [], usedToolIds: [] };
  }

  const logs: DesktopExecutionLogEntry[] = [];
  const contextBlocks: string[] = [];
  const usedToolIds: string[] = [];
  const extractionTool =
    input.binding.availableTools.find((tool) => tool.id === 'office-document') ??
    input.binding.availableTools.find((tool) => tool.id === 'local-filesystem');

  if (!input.desktopToolInvoker || !input.workspaceId || !extractionTool) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'ATTACHMENT_CONTEXT_SKIPPED',
        'Attached files were provided, but no enabled desktop document extraction tool is available.',
        input.createdAt
      )
    );
    return { context: '', logs, usedToolIds };
  }

  for (const [attachmentIndex, attachmentPath] of attachmentPaths.entries()) {
    const logSuffix = `attachment-${attachmentIndex + 1}`;
    const action: DesktopToolInvocationAction =
      extractionTool.id === 'office-document' ? 'document.extract_text' : 'filesystem.read_text_file';

    try {
      const result = await input.desktopToolInvoker({
        workspaceId: input.workspaceId,
        toolId: extractionTool.id,
        action,
        input: {
          path: attachmentPath,
          maxChars: Math.ceil(maxAttachmentContextChars / attachmentPaths.length)
        },
        allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
      });

      if (!result.ok) {
        logs.push(
          createLog(
            input.task.taskId,
            'warning',
            'ATTACHMENT_CONTEXT_FAILED',
            result.message ?? `Failed to extract attached file: ${attachmentPath}.`,
            input.createdAt,
            logSuffix
          )
        );
        continue;
      }

      const extractedText = readToolTextOutput(result.output);
      if (!extractedText) {
        logs.push(
          createLog(
            input.task.taskId,
            'warning',
            'ATTACHMENT_CONTEXT_EMPTY',
            `Attached file did not produce readable text: ${attachmentPath}.`,
            input.createdAt,
            logSuffix
          )
        );
        continue;
      }

      usedToolIds.push(extractionTool.id);
      contextBlocks.push(
        [
          `Attachment: ${attachmentPath}`,
          `Extraction tool: ${extractionTool.id}/${action}`,
          'Content:',
          truncateForPrompt(extractedText, Math.ceil(maxAttachmentContextChars / attachmentPaths.length))
        ].join('\n')
      );
      logs.push(
        createLog(
          input.task.taskId,
          'info',
          'ATTACHMENT_CONTEXT_EXTRACTED',
          `Attached file text extracted: ${attachmentPath}.`,
          input.createdAt,
          logSuffix
        )
      );
    } catch (error) {
      logs.push(
        createLog(
          input.task.taskId,
          'warning',
          'ATTACHMENT_CONTEXT_FAILED',
          error instanceof Error ? error.message : `Failed to extract attached file: ${attachmentPath}.`,
          input.createdAt,
          logSuffix
        )
      );
    }
  }

  return {
    context: truncateForPrompt(contextBlocks.join('\n\n---\n\n'), maxAttachmentContextChars),
    logs,
    usedToolIds: [...new Set(usedToolIds)]
  };
}

function readToolTextOutput(output: Record<string, unknown> | undefined): string | undefined {
  const text = output?.text ?? output?.content;
  if (typeof text !== 'string') {
    return undefined;
  }

  const normalized = text.trim();
  return normalized ? normalized : undefined;
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
  onProgress?: DesktopTaskProgressCallback;
  progressTask: DesktopTaskDetail;
}): Promise<{
  response: DesktopModelChatResponse;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  progressTask: DesktopTaskDetail;
}> {
  const logs: DesktopExecutionLogEntry[] = [];
  const usedToolIds: string[] = [];
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  let currentResponse = input.response;
  let currentMessages = input.messages;
  let progressTask = input.progressTask;

  for (let turnIndex = 0; turnIndex < maxDesktopToolTurns; turnIndex += 1) {
    const toolCall = parseDesktopToolCall(currentResponse.content);

    if (!toolCall) {
      return {
        response: currentResponse,
        logs,
        usedToolIds,
        generatedArtifacts,
        progressTask
      };
    }

    const toolCallDetectedLog = createLog(
      input.task.taskId,
      'info',
      'TOOL_CALL_DETECTED',
      `Model requested desktop tool action: ${toolCall.toolId}/${toolCall.action}.`,
      input.createdAt,
      `turn-${turnIndex + 1}`
    );
    logs.push(toolCallDetectedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [toolCallDetectedLog],
      state: 'running',
      currentRunStatus: 'running'
    });

    const availableTool = input.binding.availableTools.find((tool) => tool.id === toolCall.toolId);
    if (!availableTool) {
      const toolRejectedLog = createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_REJECTED',
        `Requested tool is not enabled for this task: ${toolCall.toolId}.`,
        input.createdAt,
        `turn-${turnIndex + 1}`
      );
      logs.push(toolRejectedLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [toolRejectedLog],
        state: 'running',
        currentRunStatus: 'running'
      });
      return {
        response: {
          ...currentResponse,
          content: removeToolCallBlock(currentResponse.content)
        },
        logs,
        usedToolIds,
        generatedArtifacts,
        progressTask
      };
    }

    if (!input.desktopToolInvoker || !input.workspaceId) {
      const toolSkippedLog = createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_SKIPPED',
        'Desktop tool bridge or workspace ID is unavailable.',
        input.createdAt,
        `turn-${turnIndex + 1}`
      );
      logs.push(toolSkippedLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [toolSkippedLog],
        state: 'running',
        currentRunStatus: 'running'
      });
      return {
        response: {
          ...currentResponse,
          content: removeToolCallBlock(currentResponse.content)
        },
        logs,
        usedToolIds,
        generatedArtifacts,
        progressTask
      };
    }

    let toolResult: DesktopToolInvocationResult;
    try {
      toolResult = await input.desktopToolInvoker({
        workspaceId: input.workspaceId,
        toolId: toolCall.toolId,
        action: toolCall.action,
        input: toolCall.input,
        allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
      });
    } catch (error) {
      const toolFailedLog = createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_FAILED',
        error instanceof Error ? error.message : `Desktop tool failed: ${toolCall.toolId}/${toolCall.action}.`,
        input.createdAt,
        `turn-${turnIndex + 1}`
      );
      logs.push(toolFailedLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [toolFailedLog],
        state: 'running',
        currentRunStatus: 'running'
      });
      return {
        response: {
          ...currentResponse,
          content: removeToolCallBlock(currentResponse.content)
        },
        logs,
        usedToolIds,
        generatedArtifacts,
        progressTask
      };
    }

    if (!toolResult.ok) {
      const toolFailedLog = createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_FAILED',
        toolResult.message ?? `Desktop tool failed: ${toolCall.toolId}/${toolCall.action}.`,
        input.createdAt,
        `turn-${turnIndex + 1}`
      );
      logs.push(toolFailedLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [toolFailedLog],
        state: 'running',
        currentRunStatus: 'running'
      });
      return {
        response: {
          ...currentResponse,
          content: removeToolCallBlock(currentResponse.content)
        },
        logs,
        usedToolIds,
        generatedArtifacts,
        progressTask
      };
    }

    usedToolIds.push(toolCall.toolId);
    const generatedArtifact = buildGeneratedArtifactFromToolResult({
      taskId: input.task.taskId,
      toolId: toolCall.toolId,
      action: toolCall.action,
      output: toolResult.output,
      createdAt: input.createdAt,
      sequence: generatedArtifacts.length + 1
    });
    if (generatedArtifact) {
      generatedArtifacts.push(generatedArtifact);
    }

    const toolInvokedLog = createLog(
      input.task.taskId,
      'info',
      'TOOL_INVOKED',
      `Desktop tool executed: ${availableTool.name} / ${toolCall.action}.`,
      input.createdAt,
      `turn-${turnIndex + 1}`
    );
    logs.push(toolInvokedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [toolInvokedLog],
      artifacts: generatedArtifact ? [...progressTask.artifacts, generatedArtifact] : progressTask.artifacts,
      state: 'running',
      currentRunStatus: 'running'
    });

    const nextMessages: DesktopModelChatMessage[] = [
      ...currentMessages,
      {
        role: 'assistant',
        content: currentResponse.content
      },
      {
        role: 'user',
        content: buildToolResultPrompt(toolResult, turnIndex + 1)
      }
    ];

    let nextResponse: DesktopModelChatResponse;
    try {
      nextResponse = await input.modelInvoker({
        profile: input.profile,
        timeoutMs: 45_000,
        messages: nextMessages
      });
    } catch (error) {
      const finalizationFailedLog = createLog(
        input.task.taskId,
        'warning',
        'TOOL_RESULT_FINALIZATION_FAILED',
        error instanceof Error ? error.message : 'Model failed after desktop tool execution.',
        input.createdAt,
        `turn-${turnIndex + 1}`
      );
      logs.push(finalizationFailedLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [finalizationFailedLog],
        state: 'running',
        currentRunStatus: 'running'
      });
      return {
        response: {
          ...currentResponse,
          content: [
            removeToolCallBlock(currentResponse.content),
            '',
            'Desktop tool result:',
            JSON.stringify(toolResult, null, 2)
          ].join('\n').trim()
        },
        logs,
        usedToolIds,
        generatedArtifacts,
        progressTask
      };
    }

    const toolResultReturnedLog = createLog(
      input.task.taskId,
      'info',
      'TOOL_RESULT_RETURNED_TO_MODEL',
      `Desktop tool result was returned to model: ${toolCall.toolId}.`,
      input.createdAt,
      `turn-${turnIndex + 1}`
    );
    logs.push(toolResultReturnedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [toolResultReturnedLog],
      state: 'running',
      currentRunStatus: 'running'
    });

    currentMessages = nextMessages;
    currentResponse = {
      ...nextResponse,
      inputTokens: sumOptionalTokenCounts(currentResponse.inputTokens, nextResponse.inputTokens),
      outputTokens: sumOptionalTokenCounts(currentResponse.outputTokens, nextResponse.outputTokens)
    };
  }

  const limitReachedLog = createLog(
    input.task.taskId,
    'warning',
    'TOOL_CALL_LIMIT_REACHED',
    `Desktop tool call limit reached: ${maxDesktopToolTurns}.`,
    input.createdAt
  );
  logs.push(limitReachedLog);
  progressTask = await emitTaskProgress({
    onProgress: input.onProgress,
    task: progressTask,
    updatedAt: input.createdAt,
    executionLogs: [limitReachedLog],
    state: 'running',
    currentRunStatus: 'running'
  });

  return {
    response: {
      ...currentResponse,
      content: removeToolCallBlock(currentResponse.content)
    },
    logs,
    usedToolIds,
    generatedArtifacts,
    progressTask
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

function buildGeneratedArtifactFromToolResult(input: {
  taskId: string;
  toolId: string;
  action: DesktopToolInvocationAction;
  output: Record<string, unknown> | undefined;
  createdAt: string;
  sequence: number;
}): DesktopArtifactSummary | undefined {
  const localPath = readLocalPath(input.output);
  if (!localPath) {
    return undefined;
  }

  const fileName = getPathFileName(localPath) ?? `${input.toolId}-output`;

  return {
    id: `${input.taskId}-tool-artifact-${input.sequence}-${Date.parse(input.createdAt) || Date.now()}`,
    type: 'file',
    title: fileName,
    content: [
      `工具：${input.toolId}`,
      `动作：${input.action}`,
      `本地文件：${localPath}`
    ].join('\n'),
    localPath,
    createdAt: input.createdAt
  };
}

function buildFinalAnswerArtifact(
  task: DesktopTaskDetail,
  response: DesktopModelChatResponse,
  createdAt: string
): DesktopArtifactSummary {
  const content = response.content.trim() || '模型已完成任务，但没有返回可展示的文本结果。';

  return {
    id: `${task.taskId}-result-${Date.parse(createdAt) || Date.now()}`,
    type: 'text',
    title: `${task.title} - 任务结果`,
    content,
    createdAt
  };
}

function isUserDeliverableArtifact(artifact: DesktopArtifactSummary) {
  return artifact.type !== 'report';
}

function readLocalPath(output: Record<string, unknown> | undefined): string | undefined {
  const localPath = output?.localPath;
  return typeof localPath === 'string' && localPath.trim() ? localPath.trim() : undefined;
}

function getPathFileName(localPath: string): string | undefined {
  const normalizedPath = localPath.replace(/\\/g, '/');
  const fileName = normalizedPath.split('/').filter(Boolean).at(-1);
  return fileName?.trim() || undefined;
}

function buildModelMessages(
  task: DesktopTaskDetail,
  binding: ResolvedRuntimeBinding,
  attachmentContext = ''
): DesktopModelChatMessage[] {
  const tools = binding.availableTools.map((tool) => `${tool.name} (${tool.capabilities.join(', ')})`);
  const toolInstructions = buildToolInstructions(binding.availableTools);
  const attachmentPaths = task.executionContext?.attachmentPaths ?? [];
  const verificationToolInstruction =
    task.taskType === 'desktop_runtime_verification'
      ? 'This is a desktop runtime verification task. If office-document or local-filesystem is available, request exactly one write tool before the final answer to prove local artifact generation.'
      : '';
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
        `Allowed desktop tool actions:\n${toolInstructions || 'none'}`,
        verificationToolInstruction,
        'Only request a desktop tool when it is necessary; otherwise produce the final answer directly.',
        'Return a practical Chinese work result with next actions when appropriate.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Task title: ${task.title}`,
        `Task input: ${task.input}`,
        `Attached files: ${attachmentPaths.length > 0 ? attachmentPaths.join('; ') : 'none'}`,
        `Attached file text context:\n${attachmentContext || 'none'}`,
        `Available tools: ${tools.length > 0 ? tools.join('; ') : 'none'}`,
        `Knowledge context:\n${knowledgeContext || 'none'}`,
        `Missing knowledge bindings: ${binding.missingKnowledgeBindingIds.join(', ') || 'none'}`
      ].join('\n')
    }
  ];
}

function buildToolInstructions(tools: ToolManifest[]): string {
  return tools
    .flatMap((tool) => {
      if (tool.id === 'local-filesystem') {
        return [
          '- local-filesystem/filesystem.write_text_file input: {"folder":"reports","fileName":"result","content":"markdown text"}',
          '- local-filesystem/filesystem.read_text_file input: {"path":"absolute allowed local file path"}',
          '- local-filesystem/filesystem.list_directory input: {"path":"absolute allowed local folder path"}'
        ];
      }

      if (tool.id === 'web-search') {
        return [
          '- web-search/web.fetch_url input: {"url":"https://example.com","maxChars":12000}',
          '- web-search/web.search input: {"query":"search terms","maxResults":5}'
        ];
      }

      if (tool.id === 'office-document') {
        return [
          '- office-document/document.extract_text input: {"path":"absolute allowed local document path","maxChars":30000}',
          '- office-document/office.write_markdown_document input: {"title":"title","folder":"documents","fileName":"file-name","content":"markdown text"}',
          '- office-document/spreadsheet.write_csv input: {"folder":"spreadsheets","fileName":"file-name","rows":[["name","value"],["A","1"]]}',
          '- office-document/presentation.write_outline_markdown input: {"title":"title","folder":"presentations","fileName":"file-name","slides":[{"title":"slide","bullets":["point"]}]}'
        ];
      }

      return [];
    })
    .join('\n');
}

function buildAllowedRootPaths(
  knowledgeSources: DesktopKnowledgeSourceSummary[],
  executionContext?: DesktopTaskDetail['executionContext']
): string[] {
  const allowedRoots = knowledgeSources.flatMap((source) =>
    source.localPath ? getAllowedRootPathsForLocalSource(source.localPath) : []
  );
  const attachmentRoots = (executionContext?.attachmentPaths ?? []).flatMap((attachmentPath) =>
    getAllowedRootPathsForLocalSource(attachmentPath)
  );

  return [...new Set([...allowedRoots, ...attachmentRoots])];
}

function getAllowedRootPathsForLocalSource(localPath: string): string[] {
  const parentPath = getParentPath(localPath);
  return parentPath === localPath ? [localPath] : [localPath, parentPath];
}

function getParentPath(localPath: string): string {
  const normalizedPath = localPath.replace(/\\/g, '/');
  const separatorIndex = normalizedPath.lastIndexOf('/');
  if (separatorIndex <= 0) {
    return localPath;
  }

  return localPath.slice(0, separatorIndex);
}

function buildToolResultPrompt(toolResult: DesktopToolInvocationResult, toolTurn: number): string {
  return [
    `Desktop tool result for turn ${toolTurn}:`,
    JSON.stringify(toolResult, null, 2),
    '',
    toolTurn < maxDesktopToolTurns
      ? 'If another desktop tool is strictly needed, request exactly one next tool call. Otherwise produce the final Chinese task result and mention generated local paths when relevant.'
      : 'Now produce the final Chinese task result. Mention generated local paths when they are relevant.'
  ].join('\n');
}

function parseDesktopToolCall(content: string): DesktopToolCallInstruction | undefined {
  const markerIndex = content.indexOf(toolCallMarker);
  if (markerIndex >= 0) {
    const jsonText = extractFirstJsonObject(content.slice(markerIndex + toolCallMarker.length));
    const markerToolCall = parseDesktopToolCallJson(jsonText);
    if (markerToolCall) {
      return markerToolCall;
    }
  }

  for (const fencedJsonText of extractFencedJsonBlocks(content)) {
    const fencedToolCall = parseDesktopToolCallJson(extractFirstJsonObject(fencedJsonText));
    if (fencedToolCall) {
      return fencedToolCall;
    }
  }

  return parseDesktopToolCallJson(extractFirstJsonObject(content));
}

function parseDesktopToolCallJson(jsonText: string | undefined): DesktopToolCallInstruction | undefined {
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

function extractFencedJsonBlocks(value: string): string[] {
  const blocks: string[] = [];
  const pattern = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match = pattern.exec(value);

  while (match) {
    if (match[1]) {
      blocks.push(match[1]);
    }
    match = pattern.exec(value);
  }

  return blocks;
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
    const trimmedContent = content.trim();
    const rawJsonToolCall = parseDesktopToolCallJson(extractFirstJsonObject(trimmedContent));
    return rawJsonToolCall
      ? 'Model requested a desktop tool, but the tool call was not executed.'
      : content;
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
  const attachmentPaths = task.executionContext?.attachmentPaths?.join(', ') || 'No attached files';

  return [
    `Task: ${task.title}`,
    `Role: ${task.roleName}`,
    `Input: ${task.input}`,
    `Attached files: ${attachmentPaths}`,
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
