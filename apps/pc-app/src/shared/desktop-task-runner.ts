import type {
  DesktopArtifactSummary,
  DesktopExecutionLogEntry,
  DesktopKnowledgeSourceSummary,
  DesktopTaskDetail,
  ModelCredential,
  ModelProfile,
  RoleModelCredentialBinding,
  RolePackageManifest,
  ToolManifest
} from './desktop-contract.js';
import { resolveModelProfileCredential } from './desktop-model-credentials.js';
import type {
  DesktopModelChatMessage,
  DesktopModelChatRequest,
  DesktopModelChatResponse,
  DesktopToolInvocationAction,
  DesktopToolInvocationRequest,
  DesktopToolInvocationResult
} from './desktop-api.js';
import {
  augmentExecutionContextWithWorkflowPlan,
  buildWorkflowExecutionPlan,
  parseWorkflowGraph,
  type WorkflowGraph,
  type WorkflowGraphEdge,
  type WorkflowGraphEdgeCondition,
  type WorkflowGraphNode,
  type WorkflowExecutionNodeSummary,
  type WorkflowExecutionPlan
} from './desktop-workflow-graph.js';
import {
  WorkflowVariablePool,
  createWorkflowNodeTrace,
  createWorkflowVariablePoolFromTask,
  formatWorkflowTraceForReport,
  getWorkflowRuntimeValueType,
  isWorkflowFileValue,
  previewWorkflowRuntimeValue,
  renderWorkflowVariableRefsForArtifact,
  renderWorkflowVariableRefsForPrompt,
  resolveWorkflowVariableRefs,
  writeWorkflowNodeOutputs,
  type WorkflowFileValue,
  type WorkflowNodeExecutionTrace,
  type WorkflowRuntimeNodeStatus,
  type WorkflowRuntimeValue,
  type WorkflowRuntimeVariableSnapshot
} from './workflow-runtime.js';

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
  modelCredentials?: ModelCredential[];
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  missingModelProfileIds: string[];
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
  workflowRuntimeTraces?: WorkflowNodeExecutionTrace[];
  workflowRuntimeVariables?: WorkflowRuntimeVariableSnapshot[];
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
const maxKnowledgeRetrievalSources = 4;
const maxKnowledgeRetrievalFiles = 4;
const maxKnowledgeRetrievalChars = 30_000;
type WorkflowRuntimeModelOutputMode = 'text' | 'json';
const supportedToolActions: DesktopToolInvocationAction[] = [
  'filesystem.write_text_file',
  'filesystem.read_text_file',
  'filesystem.list_directory',
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
  'video.extract_frames',
  'video.compose_clips',
  'video.export_mp4'
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
  const workflowPlan = buildWorkflowExecutionPlan({
    task: input.task,
    rolePackage: input.rolePackage,
    createdAt: completedAt
  });
  const context = augmentExecutionContextWithWorkflowPlan(
    input.task.executionContext ?? buildContextFromRolePackage(input.rolePackage),
    workflowPlan
  );

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
  const credentialedBinding: ResolvedRuntimeBinding = {
    ...binding,
    modelProfiles: binding.modelProfiles.map(
      (profile) =>
        resolveModelProfileCredential({
          profile,
          roleCode: input.task.roleCode,
          credentials: input.modelCredentials,
          roleBindings: input.roleModelCredentialBindings
        }).profile
    )
  };

  if (credentialedBinding.modelProfiles.length === 0) {
    const failedTask = failTask(
      input.task,
      completedAt,
      'No enabled model profile is available for this task. Enable a model profile before running it.',
      buildWarningLogs(input.task, credentialedBinding, completedAt)
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

  const configuredModelProfiles = credentialedBinding.modelProfiles.filter(isModelApiConfigured);

  if (configuredModelProfiles.length === 0) {
    const failedTask = failTask(
      input.task,
      completedAt,
      'No configured model API profile is available for this task. Add API Base URL and API Key before running it.',
      [
        ...buildWarningLogs(input.task, credentialedBinding, completedAt),
        ...buildModelConfigWarningLogs(input.task, credentialedBinding.modelProfiles, completedAt)
      ]
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
    binding: credentialedBinding,
    workflowPlan,
    rolePackage: input.rolePackage,
    profiles: configuredModelProfiles,
    modelInvoker: input.modelInvoker,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: completedAt,
    onProgress: input.onProgress
  });

  if (!invocation.ok) {
    const failedTask = failTask(input.task, completedAt, invocation.message, [
      ...buildWarningLogs(input.task, credentialedBinding, completedAt),
      ...invocation.logs
    ]);
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

  const completedTask = completeTask(input.task, completedAt, credentialedBinding, invocation, workflowPlan);
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
  const missingModelProfileIds = input.context.modelProfileIds.filter(
    (profileId) => !modelProfilesById.has(profileId) || !enabledModelIds.has(profileId)
  );
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
    missingModelProfileIds,
    missingToolIds,
    missingKnowledgeBindingIds,
    unconfiguredKnowledgeBindingIds
  };
}

function completeTask(
  task: DesktopTaskDetail,
  completedAt: string,
  binding: ResolvedRuntimeBinding,
  invocation: ModelInvocationSuccess,
  workflowPlan: WorkflowExecutionPlan
): DesktopTaskDetail {
  const primaryModel = invocation.profile;
  const inputTokens = invocation.response.inputTokens ?? estimateInputTokens(task);
  const outputTokens = invocation.response.outputTokens ?? estimateOutputTokens(task);
  const costCents = estimateCostCents(inputTokens, outputTokens, binding.modelProfiles);
  const reportArtifact = {
    id: `${task.taskId}-artifact-${Date.parse(completedAt) || Date.now()}`,
    type: 'report' as const,
    title: `${task.title} - Model execution report`,
    content: buildArtifactContent(
      task,
      binding,
      invocation.response,
      workflowPlan,
      invocation.usedToolIds,
      invocation.workflowRuntimeTraces ?? [],
      invocation.workflowRuntimeVariables ?? []
    ),
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

  if (binding.missingModelProfileIds.length > 0) {
    logs.push(
      createLog(
        task.taskId,
        'warning',
        'MODEL_PROFILE_BINDING_MISSING',
        `Model profiles are unavailable or disabled: ${binding.missingModelProfileIds.join(', ')}.`,
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

function buildWorkflowNodeRunLogs(
  taskId: string,
  workflowPlan: WorkflowExecutionPlan,
  createdAt: string,
  state: 'started' | 'completed' | 'failed',
  usedToolIds: string[] = []
): DesktopExecutionLogEntry[] {
  if (!workflowPlan.enabled) {
    return [];
  }

  const usedToolIdSet = new Set(usedToolIds);
  return getRunnableWorkflowNodes(workflowPlan).map((node, index) => {
    const sequence = index + 1;
    const missingToolIds =
      state === 'completed'
        ? node.toolIds.filter((toolId) => !usedToolIdSet.has(toolId))
        : [];
    const eventType =
      state === 'started'
        ? 'WORKFLOW_NODE_STARTED'
        : state === 'completed'
          ? 'WORKFLOW_NODE_COMPLETED'
          : 'WORKFLOW_NODE_FAILED';
    const message =
      state === 'started'
        ? `${sequence}. ${node.name} (${node.type}) started.`
        : state === 'completed'
          ? missingToolIds.length > 0
            ? `${sequence}. ${node.name} (${node.type}) completed in the desktop run, but required tool(s) were not used: ${missingToolIds.join(', ')}.`
            : `${sequence}. ${node.name} (${node.type}) completed in the desktop run.`
          : `${sequence}. ${node.name} (${node.type}) did not complete because the model run failed.`;

    return createLog(
      taskId,
      state === 'failed' || missingToolIds.length > 0 ? 'warning' : 'info',
      eventType,
      message,
      createdAt,
      sanitizeLogSuffix(`${state}-${sequence}-${node.id}`)
    );
  });
}

function getRunnableWorkflowNodes(workflowPlan: WorkflowExecutionPlan): WorkflowExecutionNodeSummary[] {
  return workflowPlan.orderedNodeSummaries.filter((node) => node.type !== 'start');
}

async function invokeConfiguredModel(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  workflowPlan: WorkflowExecutionPlan;
  rolePackage?: RolePackageManifest;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  onProgress?: DesktopTaskProgressCallback;
}): Promise<ModelInvocationResult> {
  const workflowRuntimeInvocation = await tryInvokeWorkflowRuntime(input);
  if (workflowRuntimeInvocation) {
    return workflowRuntimeInvocation;
  }

  const logs: DesktopExecutionLogEntry[] = [...input.workflowPlan.logs];
  let progressTask = input.task;
  if (input.workflowPlan.logs.length > 0) {
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: input.workflowPlan.logs,
      state: 'running',
      currentRunStatus: 'running'
    });
  }

  const workflowNodeStartedLogs = buildWorkflowNodeRunLogs(
    input.task.taskId,
    input.workflowPlan,
    input.createdAt,
    'started'
  );
  logs.push(...workflowNodeStartedLogs);
  if (workflowNodeStartedLogs.length > 0) {
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: workflowNodeStartedLogs,
      state: 'running',
      currentRunStatus: 'running'
    });
  }

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
  const messages = buildModelMessages(
    input.task,
    input.binding,
    attachmentContext.context,
    input.workflowPlan
  );

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

      const fallbackArtifactExecution = await maybeGenerateWorkflowFallbackArtifact({
        task: input.task,
        binding: input.binding,
        workflowPlan: input.workflowPlan,
        response: toolExecution.response,
        desktopToolInvoker: input.desktopToolInvoker,
        workspaceId: input.workspaceId,
        createdAt: input.createdAt,
        onProgress: input.onProgress,
        progressTask,
        existingGeneratedArtifacts: toolExecution.generatedArtifacts
      });
      logs.push(...fallbackArtifactExecution.logs);
      progressTask = fallbackArtifactExecution.progressTask;

      const usedToolIds = [
        ...new Set([
          ...attachmentContext.usedToolIds,
          ...toolExecution.usedToolIds,
          ...fallbackArtifactExecution.usedToolIds
        ])
      ];
      const workflowNodeCompletedLogs = buildWorkflowNodeRunLogs(
        input.task.taskId,
        input.workflowPlan,
        input.createdAt,
        'completed',
        usedToolIds
      );
      logs.push(...workflowNodeCompletedLogs);
      if (workflowNodeCompletedLogs.length > 0) {
        progressTask = await emitTaskProgress({
          onProgress: input.onProgress,
          task: progressTask,
          updatedAt: input.createdAt,
          executionLogs: workflowNodeCompletedLogs,
          state: 'running',
          currentRunStatus: 'running'
        });
      }

      return {
        ok: true,
        profile,
        response: toolExecution.response,
        logs,
        usedToolIds,
        generatedArtifacts: [
          ...toolExecution.generatedArtifacts,
          ...fallbackArtifactExecution.generatedArtifacts
        ]
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

  const workflowNodeFailedLogs = buildWorkflowNodeRunLogs(
    input.task.taskId,
    input.workflowPlan,
    input.createdAt,
    'failed'
  );
  logs.push(...workflowNodeFailedLogs);
  if (workflowNodeFailedLogs.length > 0) {
    await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: workflowNodeFailedLogs,
      state: 'running',
      currentRunStatus: 'running'
    });
  }

  return {
    ok: false,
    message: 'All configured model API profiles failed. Check API Base URL, API Key, model name, and network access.',
    logs
  };
}

async function tryInvokeWorkflowRuntime(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  workflowPlan: WorkflowExecutionPlan;
  rolePackage?: RolePackageManifest;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  onProgress?: DesktopTaskProgressCallback;
}): Promise<ModelInvocationResult | undefined> {
  if (!input.workflowPlan.enabled || input.rolePackage?.workflowGraph === undefined) {
    return undefined;
  }

  const graph = parseWorkflowGraph(input.rolePackage.workflowGraph);
  if (!graph) {
    return undefined;
  }

  return runWorkflowRuntime({
    ...input,
    graph
  });
}

async function runWorkflowRuntime(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  workflowPlan: WorkflowExecutionPlan;
  rolePackage?: RolePackageManifest;
  graph: WorkflowGraph;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  onProgress?: DesktopTaskProgressCallback;
}): Promise<ModelInvocationResult> {
  const pool = createWorkflowVariablePoolFromTask(input.task);
  const nodesById = new Map(input.graph.nodes.map((node) => [node.id, node]));
  const edgesBySource = groupWorkflowRuntimeEdgesBySource(input.graph.edges);
  const maxNodeExecutions = clampWorkflowRuntimeLimit(input.graph.runtimePolicy?.maxNodeExecutions, 64, 1, 128);
  const maxLoopIterations = clampWorkflowRuntimeLimit(input.graph.runtimePolicy?.maxLoopIterations, 8, 1, 32);
  const visitCounts = new Map<string, number>();
  const logs: DesktopExecutionLogEntry[] = [...input.workflowPlan.logs];
  const traces: WorkflowNodeExecutionTrace[] = [];
  const usedToolIds: string[] = [];
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  let progressTask = input.task;
  let primaryProfile = input.profiles[0];
  let currentResponse: DesktopModelChatResponse = {
    provider: primaryProfile?.providerName ?? 'unknown',
    modelName: primaryProfile?.modelName ?? 'unknown',
    content: ''
  };

  if (input.workflowPlan.logs.length > 0) {
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: input.workflowPlan.logs,
      state: 'running',
      currentRunStatus: 'running'
    });
  }

  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_STARTED',
    `Workflow runtime started: ${input.graph.nodes.length} node(s), entry=${input.graph.entryNodeId}.`,
    input.createdAt
  );
  logs.push(startedLog);
  progressTask = await emitTaskProgress({
    onProgress: input.onProgress,
    task: progressTask,
    updatedAt: input.createdAt,
    executionLogs: [startedLog],
    state: 'running',
    currentRunStatus: 'running'
  });

  const fileContext = await prepareWorkflowRuntimeFileContext({
    task: input.task,
    pool,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: input.createdAt
  });
  usedToolIds.push(...fileContext.usedToolIds);
  logs.push(...fileContext.logs);
  if (fileContext.logs.length > 0) {
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: fileContext.logs,
      state: 'running',
      currentRunStatus: 'running'
    });
  }

  let currentNode = nodesById.get(input.graph.entryNodeId);
  let executedNodeCount = 0;

  while (currentNode && executedNodeCount < maxNodeExecutions) {
    executedNodeCount += 1;
    visitCounts.set(currentNode.id, (visitCounts.get(currentNode.id) ?? 0) + 1);

    const nodeStartedLog = createLog(
      input.task.taskId,
      'info',
      'WORKFLOW_RUNTIME_NODE_STARTED',
      `${executedNodeCount}. ${currentNode.name} (${currentNode.type}) started.`,
      input.createdAt,
      sanitizeLogSuffix(currentNode.id),
      buildWorkflowRuntimeNodeLogDetails({
        node: currentNode,
        status: 'running',
        pool,
        inputVariables: currentNode.inputVariables ?? [],
        outputVariables: [],
        message: 'Node started.'
      })
    );
    logs.push(nodeStartedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [nodeStartedLog],
      state: 'running',
      currentRunStatus: 'running'
    });

    try {
      const nodeResult = await executeWorkflowRuntimeNode({
        task: input.task,
        node: currentNode,
        pool,
        binding: input.binding,
        rolePackage: input.rolePackage,
        profiles: input.profiles,
        modelInvoker: input.modelInvoker,
        desktopToolInvoker: input.desktopToolInvoker,
        workspaceId: input.workspaceId,
        createdAt: input.createdAt,
        currentResponse,
        primaryProfile
      });

      primaryProfile = nodeResult.primaryProfile;
      currentResponse = nodeResult.response;
      usedToolIds.push(...nodeResult.usedToolIds);
      generatedArtifacts.push(...nodeResult.generatedArtifacts);

      const trace = createWorkflowNodeTrace({
        node: currentNode,
        status: 'completed',
        startedAt: input.createdAt,
        finishedAt: input.createdAt,
        inputVariables: nodeResult.inputVariables,
        outputVariables: nodeResult.outputVariables,
        message: nodeResult.message,
        artifactPath: nodeResult.generatedArtifacts[0]?.localPath
      });
      traces.push(trace);

      const nodeCompletedLog = createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_NODE_COMPLETED',
        `${executedNodeCount}. ${currentNode.name} (${currentNode.type}) completed. Outputs: ${nodeResult.outputVariables.join(', ') || 'none'}.`,
        input.createdAt,
        sanitizeLogSuffix(currentNode.id),
        buildWorkflowRuntimeNodeLogDetails({
          node: currentNode,
          status: 'completed',
          pool,
          inputVariables: nodeResult.inputVariables,
          outputVariables: nodeResult.outputVariables,
          message: nodeResult.message,
          artifactPath: nodeResult.generatedArtifacts[0]?.localPath
        })
      );
      logs.push(...nodeResult.logs, nodeCompletedLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [...nodeResult.logs, nodeCompletedLog],
        artifacts: nodeResult.generatedArtifacts.length > 0
          ? [...progressTask.artifacts, ...nodeResult.generatedArtifacts]
          : progressTask.artifacts,
        state: 'running',
        currentRunStatus: 'running'
      });
    } catch (error) {
      const failedMessage = readErrorMessage(error);
      const failedTrace = createWorkflowNodeTrace({
        node: currentNode,
        status: 'failed',
        startedAt: input.createdAt,
        finishedAt: input.createdAt,
        inputVariables: currentNode.inputVariables ?? [],
        message: failedMessage
      });
      const nodeFailedLog = createLog(
        input.task.taskId,
        'error',
        'WORKFLOW_RUNTIME_NODE_FAILED',
        `${currentNode.name} (${currentNode.type}) failed: ${failedMessage}`,
        input.createdAt,
        sanitizeLogSuffix(currentNode.id),
        buildWorkflowRuntimeNodeLogDetails({
          node: currentNode,
          status: 'failed',
          pool,
          inputVariables: currentNode.inputVariables ?? [],
          outputVariables: [],
          message: failedMessage
        })
      );
      traces.push(failedTrace);
      logs.push(nodeFailedLog);
      await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [nodeFailedLog],
        state: 'running',
        currentRunStatus: 'running'
      });

      return {
        ok: false,
        message: failedMessage,
        logs
      };
    }

    const nextEdgeSelection = selectNextWorkflowRuntimeEdge(
      edgesBySource.get(currentNode.id) ?? [],
      pool
    );
    if (nextEdgeSelection.log) {
      logs.push(
        createLog(
          input.task.taskId,
          nextEdgeSelection.log.level,
          nextEdgeSelection.log.eventType,
          nextEdgeSelection.log.message,
          input.createdAt,
          sanitizeLogSuffix(nextEdgeSelection.log.suffix)
        )
      );
    }

    if (!nextEdgeSelection.edge) {
      break;
    }

    const nextNode = nodesById.get(nextEdgeSelection.edge.targetNodeId);
    if (!nextNode) {
      break;
    }

    if ((visitCounts.get(nextNode.id) ?? 0) >= maxLoopIterations) {
      const loopLog = createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_LOOP_LIMIT_REACHED',
        `Workflow runtime loop limit reached before node: ${nextNode.name}.`,
        input.createdAt,
        sanitizeLogSuffix(nextNode.id)
      );
      logs.push(loopLog);
      progressTask = await emitTaskProgress({
        onProgress: input.onProgress,
        task: progressTask,
        updatedAt: input.createdAt,
        executionLogs: [loopLog],
        state: 'running',
        currentRunStatus: 'running'
      });
      break;
    }

    currentNode = nextNode;
  }

  if (executedNodeCount >= maxNodeExecutions) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_NODE_LIMIT_REACHED',
        `Workflow runtime node execution limit reached: ${maxNodeExecutions}.`,
        input.createdAt
      )
    );
  }

  const completedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_COMPLETED',
    `Workflow runtime completed: ${traces.length} node(s), variables=${pool.snapshot().length}.`,
    input.createdAt
  );
  logs.push(completedLog);
  await emitTaskProgress({
    onProgress: input.onProgress,
    task: progressTask,
    updatedAt: input.createdAt,
    executionLogs: [completedLog],
    state: 'running',
    currentRunStatus: 'running'
  });

  return {
    ok: true,
    profile: primaryProfile,
    response: currentResponse,
    logs,
    usedToolIds: [...new Set(usedToolIds)],
    generatedArtifacts,
    workflowRuntimeTraces: traces,
    workflowRuntimeVariables: pool.snapshot()
  };
}

async function prepareWorkflowRuntimeFileContext(input: {
  task: DesktopTaskDetail;
  pool: WorkflowVariablePool;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
}): Promise<{
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}> {
  const files = readWorkflowRuntimeFiles(input.pool.get('start.files')).slice(0, maxAttachmentContextFiles);
  if (files.length === 0) {
    return { logs: [], usedToolIds: [] };
  }

  const extractionTool =
    input.binding.availableTools.find((tool) => tool.id === 'office-document') ??
    input.binding.availableTools.find((tool) => tool.id === 'local-filesystem');
  if (!input.desktopToolInvoker || !input.workspaceId || !extractionTool) {
    return {
      logs: [
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_FILE_CONTEXT_SKIPPED',
          'Attached files were provided, but no enabled desktop extraction tool is available.',
          input.createdAt
        )
      ],
      usedToolIds: []
    };
  }

  const logs: DesktopExecutionLogEntry[] = [];
  const usedToolIds: string[] = [];
  const extractedFiles: WorkflowFileValue[] = [];

  for (const [fileIndex, file] of files.entries()) {
    const action: DesktopToolInvocationAction =
      extractionTool.id === 'office-document' ? 'document.extract_text' : 'filesystem.read_text_file';

    try {
      const result = await input.desktopToolInvoker({
        workspaceId: input.workspaceId,
        toolId: extractionTool.id,
        action,
        input: {
          path: file.localPath,
          maxChars: Math.ceil(maxAttachmentContextChars / files.length)
        },
        allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
      });

      if (!result.ok) {
        logs.push(
          createLog(
            input.task.taskId,
            'warning',
            'WORKFLOW_RUNTIME_FILE_CONTEXT_FAILED',
            result.message ?? `Failed to extract workflow file context: ${file.localPath}.`,
            input.createdAt,
            `file-${fileIndex + 1}`
          )
        );
        extractedFiles.push(file);
        continue;
      }

      const extractedText = readToolTextOutput(result.output);
      extractedFiles.push({
        ...file,
        extractedText: extractedText
          ? truncateForPrompt(extractedText, Math.ceil(maxAttachmentContextChars / files.length))
          : file.extractedText
      });
      usedToolIds.push(extractionTool.id);
      logs.push(
        createLog(
          input.task.taskId,
          'info',
          'WORKFLOW_RUNTIME_FILE_CONTEXT_EXTRACTED',
          `Workflow file context extracted: ${file.localPath}.`,
          input.createdAt,
          `file-${fileIndex + 1}`
        )
      );
    } catch (error) {
      logs.push(
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_FILE_CONTEXT_FAILED',
          error instanceof Error ? error.message : `Failed to extract workflow file context: ${file.localPath}.`,
          input.createdAt,
          `file-${fileIndex + 1}`
        )
      );
      extractedFiles.push(file);
    }
  }

  const mergedFiles = [
    ...extractedFiles,
    ...readWorkflowRuntimeFiles(input.pool.get('start.files')).slice(maxAttachmentContextFiles)
  ];
  input.pool.set('start.files', mergedFiles);
  input.pool.set('start.images', mergedFiles.filter((file) => file.kind === 'image'));
  input.pool.set('start.videos', mergedFiles.filter((file) => file.kind === 'video'));
  input.pool.set('start.audio', mergedFiles.filter((file) => file.kind === 'audio'));
  input.pool.set('start.documents', mergedFiles.filter((file) => ['document', 'pdf', 'text'].includes(file.kind)));
  input.pool.set('start.spreadsheets', mergedFiles.filter((file) => file.kind === 'spreadsheet'));
  input.pool.set('start.presentations', mergedFiles.filter((file) => file.kind === 'presentation'));

  return {
    logs,
    usedToolIds: [...new Set(usedToolIds)]
  };
}

function readWorkflowRuntimeFiles(value: WorkflowRuntimeValue | undefined): WorkflowFileValue[] {
  if (Array.isArray(value)) {
    return (value as unknown[]).filter(isWorkflowFileValue);
  }

  return isWorkflowFileValue(value) ? [value] : [];
}

async function executeWorkflowRuntimeNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  binding: ResolvedRuntimeBinding;
  rolePackage?: RolePackageManifest;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message?: string;
}> {
  switch (input.node.type) {
    case 'start':
    case 'input':
      return completeWorkflowRuntimeInputNode(input);
    case 'list':
      return completeWorkflowRuntimeListNode(input);
    case 'knowledge':
      return completeWorkflowRuntimeKnowledgeNode(input);
    case 'data':
      return completeWorkflowRuntimeDataNode(input);
    case 'iteration':
      return completeWorkflowRuntimeIterationNode(input);
    case 'loop':
      return completeWorkflowRuntimeLoopNode(input);
    case 'aggregator':
      return completeWorkflowRuntimeAggregatorNode(input);
    case 'llm':
    case 'output':
      return invokeWorkflowRuntimeModelNode(input);
    case 'tool':
      return invokeWorkflowRuntimeToolNode(input);
    case 'artifact':
      return invokeWorkflowRuntimeArtifactNode(input);
    case 'condition':
      return completeWorkflowRuntimeConditionNode(input);
    case 'approval':
      return completeWorkflowRuntimeApprovalNode(input);
    default:
      return invokeWorkflowRuntimeModelNode(input);
  }
}

function completeWorkflowRuntimeDataNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const mode = readWorkflowRuntimeDataMode(input.node);
  if (mode === 'template') {
    return completeWorkflowRuntimeTemplateNode(input);
  }
  if (mode === 'code') {
    return completeWorkflowRuntimeCodeNode(input);
  }
  return completeWorkflowRuntimeAssignNode(input);
}

function completeWorkflowRuntimeInputNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: input.task.input,
    result: {
      title: input.task.title,
      input: input.task.input,
      files: input.pool.get('start.files') ?? []
    }
  });
  input.pool.set('runtime.previous_text', input.task.input);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || input.task.input
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: ['start.text'],
    outputVariables,
    message: 'Task input initialized.'
  });
}

function completeWorkflowRuntimeListNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const sourceRef = readWorkflowRuntimeString(input.node.config?.sourceRef);
  const inputVariables = sourceRef ? [sourceRef] : input.node.inputVariables ?? ['start.files'];
  const values = resolveWorkflowVariableRefs(input.pool, inputVariables, ['start.files']);
  const items = values.flatMap((variable) => toWorkflowRuntimeArray(variable.value));
  const kind = readWorkflowRuntimeString(input.node.config?.kind);
  const contains = readWorkflowRuntimeString(input.node.config?.contains)?.toLowerCase();
  const limit = readWorkflowRuntimeNumber(input.node.config?.limit, items.length || 100);
  const filteredItems = items
    .filter((item) => {
      if (!kind) {
        return true;
      }

      return isWorkflowFileValue(item) ? item.kind === kind : getWorkflowRuntimeValueType(item as WorkflowRuntimeValue) === kind;
    })
    .filter((item) => {
      if (!contains) {
        return true;
      }

      return previewWorkflowRuntimeValue(item as WorkflowRuntimeValue, 2_000).toLowerCase().includes(contains);
    })
    .slice(0, Math.max(0, limit));
  const text = `List prepared: ${filteredItems.length}/${items.length} item(s).`;
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text,
    result: filteredItems as WorkflowRuntimeValue
  });
  input.pool.set(`${input.node.id}.items`, filteredItems as WorkflowRuntimeValue);
  input.pool.set(`${input.node.id}.count`, filteredItems.length);
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || text
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: values.map((variable) => variable.ref),
    outputVariables: [...new Set([...outputVariables, `${input.node.id}.items`, `${input.node.id}.count`])],
    message: text
  });
}

async function completeWorkflowRuntimeKnowledgeNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const retrievedKnowledge = await retrieveWorkflowRuntimeKnowledgeContext(input);
  const knowledgeContext = input.binding.availableKnowledgeSources
    .map((source) => formatKnowledgeSourceForPrompt(source))
    .join('\n---\n');
  const content = [
    input.node.instruction ?? '',
    knowledgeContext || 'No configured knowledge source matched this node.',
    retrievedKnowledge.context ? `Retrieved local knowledge:\n${retrievedKnowledge.context}` : '',
    renderWorkflowVariableRefsForPrompt(resolveWorkflowVariableRefs(input.pool, input.node.inputVariables, []), 8_000)
  ]
    .filter((part) => part.trim().length > 0 && part !== 'none')
    .join('\n\n');
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: content
  });
  input.pool.set('runtime.previous_text', content);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: content || input.currentResponse.content
    },
    primaryProfile: input.primaryProfile,
    logs: retrievedKnowledge.logs,
    usedToolIds: retrievedKnowledge.usedToolIds,
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables,
    message: retrievedKnowledge.context
      ? `Knowledge context prepared with ${retrievedKnowledge.snippetCount} local snippet(s).`
      : 'Knowledge context prepared.'
  });
}

async function retrieveWorkflowRuntimeKnowledgeContext(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
}): Promise<{
  context: string;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  snippetCount: number;
}> {
  const localSources = input.binding.availableKnowledgeSources
    .filter((source) => source.enabled && source.localPath?.trim())
    .slice(0, maxKnowledgeRetrievalSources);
  if (localSources.length === 0) {
    return { context: '', logs: [], usedToolIds: [], snippetCount: 0 };
  }

  if (!input.desktopToolInvoker || !input.workspaceId) {
    return {
      context: '',
      usedToolIds: [],
      snippetCount: 0,
      logs: [
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVAL_SKIPPED',
          'Local knowledge retrieval skipped because desktop tool bridge or workspace ID is unavailable.',
          input.createdAt
        )
      ]
    };
  }

  const desktopToolInvoker = input.desktopToolInvoker;
  const workspaceId = input.workspaceId;
  const snippets: string[] = [];
  const logs: DesktopExecutionLogEntry[] = [];
  const usedToolIds: string[] = [];
  const allowedRootPaths = buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext);

  for (const source of localSources) {
    const localPath = source.localPath?.trim();
    if (!localPath) {
      continue;
    }

    if (source.source === 'local_folder') {
      if (!input.binding.availableTools.some((tool) => tool.id === 'local-filesystem')) {
        logs.push(
          createLog(
            input.task.taskId,
            'warning',
            'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVAL_SKIPPED',
            `Knowledge folder was skipped because local-filesystem is not enabled: ${source.label}.`,
            input.createdAt,
            sanitizeLogSuffix(source.id)
          )
        );
        continue;
      }

      const listResult = await desktopToolInvoker({
        workspaceId,
        toolId: 'local-filesystem',
        action: 'filesystem.list_directory',
        input: { path: localPath },
        allowedRootPaths
      });
      usedToolIds.push('local-filesystem');

      if (!listResult.ok) {
        logs.push(
          createLog(
            input.task.taskId,
            'warning',
            'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVAL_FAILED',
            `Knowledge folder could not be listed: ${source.label}. ${listResult.message ?? ''}`.trim(),
            input.createdAt,
            sanitizeLogSuffix(source.id)
          )
        );
        continue;
      }

      const entryPaths = readKnowledgeDirectoryFilePaths(localPath, listResult.output)
        .slice(0, maxKnowledgeRetrievalFiles);
      for (const entryPath of entryPaths) {
        const snippet = await readWorkflowRuntimeKnowledgeFile({
          ...input,
          desktopToolInvoker,
          workspaceId,
          sourceLabel: source.label,
          filePath: entryPath,
          allowedRootPaths
        });
        usedToolIds.push(...snippet.usedToolIds);
        logs.push(...snippet.logs);
        if (snippet.text) {
          snippets.push(snippet.text);
        }
      }
      continue;
    }

    if (source.source === 'local_file') {
      const snippet = await readWorkflowRuntimeKnowledgeFile({
        ...input,
        desktopToolInvoker,
        workspaceId,
        sourceLabel: source.label,
        filePath: localPath,
        allowedRootPaths
      });
      usedToolIds.push(...snippet.usedToolIds);
      logs.push(...snippet.logs);
      if (snippet.text) {
        snippets.push(snippet.text);
      }
    }
  }

  const context = truncateForPrompt(snippets.join('\n\n---\n\n'), maxKnowledgeRetrievalChars);
  if (snippets.length > 0) {
    logs.push(
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVED',
        `Local knowledge snippets retrieved: ${snippets.length}.`,
        input.createdAt
      )
    );
  }

  return {
    context,
    logs,
    usedToolIds: [...new Set(usedToolIds)],
    snippetCount: snippets.length
  };
}

async function readWorkflowRuntimeKnowledgeFile(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker: DesktopToolInvoker;
  workspaceId: string;
  createdAt: string;
  sourceLabel: string;
  filePath: string;
  allowedRootPaths: string[];
}): Promise<{
  text: string;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}> {
  const reader = selectKnowledgeReaderTool(input.binding.availableTools, input.filePath);
  if (!reader) {
    return { text: '', logs: [], usedToolIds: [] };
  }

  const result = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: reader.toolId,
    action: reader.action,
    input: {
      path: input.filePath,
      maxChars: 8_000
    },
    allowedRootPaths: input.allowedRootPaths
  });

  if (!result.ok) {
    return {
      text: '',
      usedToolIds: [reader.toolId],
      logs: [
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVAL_FAILED',
          `Knowledge file could not be read: ${input.filePath}. ${result.message ?? ''}`.trim(),
          input.createdAt,
          sanitizeLogSuffix(input.filePath)
        )
      ]
    };
  }

  const text = readToolTextOutput(result.output);
  if (!text?.trim()) {
    return { text: '', logs: [], usedToolIds: [reader.toolId] };
  }

  return {
    text: [`Source: ${input.sourceLabel}`, `Path: ${input.filePath}`, truncateForPrompt(text, 8_000)].join('\n'),
    logs: [],
    usedToolIds: [reader.toolId]
  };
}

function selectKnowledgeReaderTool(
  tools: ToolManifest[],
  filePath: string
): { toolId: string; action: DesktopToolInvocationAction } | undefined {
  const toolIds = new Set(tools.map((tool) => tool.id));
  const extension = filePath.split('.').at(-1)?.trim().toLowerCase() ?? '';
  const officeExtensions = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'docx', 'pptx', 'xlsx']);

  if (toolIds.has('office-document') && officeExtensions.has(extension)) {
    return {
      toolId: 'office-document',
      action: 'document.extract_text'
    };
  }

  if (toolIds.has('local-filesystem')) {
    return {
      toolId: 'local-filesystem',
      action: 'filesystem.read_text_file'
    };
  }

  return undefined;
}

function readKnowledgeDirectoryFilePaths(
  folderPath: string,
  output: Record<string, unknown> | undefined
): string[] {
  const entries = Array.isArray(output?.entries) ? output.entries : [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }

    const record = entry as Record<string, unknown>;
    if (record.type !== 'file' || typeof record.name !== 'string' || !record.name.trim()) {
      return [];
    }

    return [joinLocalPath(folderPath, record.name.trim())];
  });
}

function joinLocalPath(folderPath: string, fileName: string): string {
  const separator = folderPath.includes('\\') ? '\\' : '/';
  return `${folderPath.replace(/[\\/]+$/, '')}${separator}${fileName.replace(/^[\\/]+/, '')}`;
}

function completeWorkflowRuntimeAssignNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const assignments = readWorkflowRuntimeAssignments(input.node, input.pool);
  const assignedValues: Record<string, unknown> = {};
  const outputVariables: string[] = [];

  for (const assignment of assignments) {
    input.pool.set(assignment.name, assignment.value as WorkflowRuntimeValue);
    assignedValues[assignment.name] = assignment.value;
    outputVariables.push(assignment.name);
  }

  const text = JSON.stringify(assignedValues, null, 2);
  input.pool.set(`${input.node.id}.text`, text);
  input.pool.set(`${input.node.id}.json`, assignedValues as WorkflowRuntimeValue);
  input.pool.set(`${input.node.id}.result`, assignedValues as WorkflowRuntimeValue);
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || text
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables: [...new Set([...outputVariables, `${input.node.id}.text`, `${input.node.id}.json`, `${input.node.id}.result`])],
    message: `Assigned ${assignments.length} variable(s).`
  });
}

function completeWorkflowRuntimeTemplateNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const template = typeof input.node.config?.template === 'string'
    ? input.node.config.template
    : input.node.instruction ?? '{{runtime.previous_text}}';
  const text = String(resolveWorkflowRuntimeConfigValue(template, input.pool) ?? '');
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text
  });
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: text || input.currentResponse.content
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? getWorkflowRuntimeFallbackInputRefs(input.pool),
    outputVariables,
    message: `Template rendered (${text.length} chars).`
  });
}

function completeWorkflowRuntimeIterationNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const sourceRef = readWorkflowRuntimeString(input.node.config?.sourceRef);
  const inputVariables = sourceRef ? [sourceRef] : input.node.inputVariables ?? ['start.files'];
  const variables = resolveWorkflowVariableRefs(input.pool, inputVariables, ['start.files']);
  const items = variables.flatMap((variable) => toWorkflowRuntimeArray(variable.value));
  const indexRef = `${input.node.id}.index`;
  const previousIndex = typeof input.pool.get(indexRef) === 'number' ? Number(input.pool.get(indexRef)) : -1;
  const nextIndex = previousIndex + 1;
  const currentItem = items[nextIndex];
  const hasCurrent = currentItem !== undefined;
  const hasNext = nextIndex + 1 < items.length;
  const result = {
    index: nextIndex,
    count: items.length,
    hasCurrent,
    hasNext,
    current: currentItem ?? null
  };
  input.pool.set(indexRef, nextIndex);
  input.pool.set(`${input.node.id}.count`, items.length);
  input.pool.set(`${input.node.id}.hasCurrent`, hasCurrent);
  input.pool.set(`${input.node.id}.hasNext`, hasNext);
  if (hasCurrent) {
    input.pool.set(`${input.node.id}.current`, currentItem as WorkflowRuntimeValue);
    input.pool.set('runtime.current_item', currentItem as WorkflowRuntimeValue);
  }

  const text = hasCurrent
    ? `Iteration item ${nextIndex + 1}/${items.length} prepared.`
    : `Iteration finished: ${items.length} item(s).`;
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text,
    json: result,
    result: result as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || text
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables: [
      ...new Set([
        ...outputVariables,
        indexRef,
        `${input.node.id}.count`,
        `${input.node.id}.hasCurrent`,
        `${input.node.id}.hasNext`,
        hasCurrent ? `${input.node.id}.current` : ''
      ].filter(Boolean))
    ],
    message: text
  });
}

function completeWorkflowRuntimeLoopNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const countRef = `${input.node.id}.count`;
  const previousCount = typeof input.pool.get(countRef) === 'number' ? Number(input.pool.get(countRef)) : 0;
  const count = previousCount + 1;
  const max = readWorkflowRuntimeNumber(input.node.config?.maxIterations, 3);
  const shouldContinue = count < max;
  const result = { count, max, shouldContinue };
  input.pool.set(countRef, count);
  input.pool.set(`${input.node.id}.shouldContinue`, shouldContinue);
  const text = `Loop checkpoint ${count}/${max}.`;
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text,
    json: result,
    result: result as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || text
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables: [...new Set([...outputVariables, countRef, `${input.node.id}.shouldContinue`])],
    message: text
  });
}

function completeWorkflowRuntimeAggregatorNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const variables = resolveWorkflowVariableRefs(input.pool, input.node.inputVariables, getWorkflowRuntimeFallbackInputRefs(input.pool));
  const mode = readWorkflowRuntimeString(input.node.config?.mode) ?? 'object';
  const result = mode === 'array'
    ? variables.map((variable) => variable.value)
    : Object.fromEntries(variables.map((variable) => [variable.ref, variable.value]));
  const text = renderWorkflowVariableRefsForPrompt(variables, 40_000);
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text,
    json: result,
    result: result as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: text || input.currentResponse.content
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables,
    message: `Aggregated ${variables.length} variable(s).`
  });
}

async function completeWorkflowRuntimeCodeNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const variables = resolveWorkflowVariableRefs(
    input.pool,
    input.node.inputVariables,
    getWorkflowRuntimeFallbackInputRefs(input.pool)
  );
  const code = readWorkflowRuntimeString(input.node.config?.code) ?? '';
  const outputVariable = readWorkflowRuntimeString(input.node.config?.outputVariable)
    ?? input.node.outputVariables?.[0]
    ?? `${input.node.id}.json`;
  const codeInput = buildWorkflowRuntimeCodeInput(variables);
  const timeoutMs = normalizeWorkflowRuntimeCodeTimeout(input.node.config?.timeoutMs);
  const result = await executeRestrictedWorkflowRuntimeCode(code, codeInput, timeoutMs);
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);

  input.pool.set(outputVariable, result as WorkflowRuntimeValue);
  input.pool.set(`${input.node.id}.text`, text);
  input.pool.set(`${input.node.id}.json`, result as WorkflowRuntimeValue);
  input.pool.set(`${input.node.id}.result`, result as WorkflowRuntimeValue);
  input.pool.set('runtime.previous_text', text);

  return Promise.resolve({
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || text
    },
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables: [...new Set([outputVariable, `${input.node.id}.text`, `${input.node.id}.json`, `${input.node.id}.result`])],
    message: `Code transform completed with ${variables.length} input variable(s), timeout=${timeoutMs}ms.`
  });
}

function buildWorkflowRuntimeCodeInput(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    variables: {}
  };
  const variablesByRef = input.variables as Record<string, unknown>;

  for (const variable of variables) {
    variablesByRef[variable.ref] = variable.value;
    writeWorkflowRuntimeCodeInputPath(input, variable.ref, variable.value);

    const alias = variable.ref.split('.').map((part) => part.trim()).filter(Boolean).at(-1);
    if (alias && input[alias] === undefined) {
      input[alias] = variable.value;
    }
  }

  return input;
}

function writeWorkflowRuntimeCodeInputPath(
  target: Record<string, unknown>,
  ref: string,
  value: WorkflowRuntimeValue
): void {
  const parts = ref.split('.').map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]!] = value;
}

const restrictedWorkflowCodeForbiddenPattern =
  /\b(?:async|await|eval|Function|import|require|process|globalThis|window|document|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator|electron|setTimeout|setInterval)\b|__proto__|prototype|constructor/;

async function executeRestrictedWorkflowRuntimeCode(
  code: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<WorkflowRuntimeValue> {
  const source = code.trim();
  if (!source) {
    throw new Error('Code node script is empty.');
  }
  if (source.length > 12_000) {
    throw new Error('Code node script is too long. Keep it under 12000 characters.');
  }

  const forbiddenMatch = source.match(restrictedWorkflowCodeForbiddenPattern);
  if (forbiddenMatch) {
    throw new Error(`Code node script uses a blocked token: ${forbiddenMatch[0]}.`);
  }

  const serializableInput = ensureWorkflowRuntimeJsonSerializable(input) as Record<string, unknown>;
  if (canUseWorkflowRuntimeBrowserWorker()) {
    return executeRestrictedWorkflowRuntimeCodeInBrowserWorker(source, serializableInput, timeoutMs);
  }
  if (canUseWorkflowRuntimeNodeWorker()) {
    return executeRestrictedWorkflowRuntimeCodeInNodeWorker(source, serializableInput, timeoutMs);
  }

  throw new Error('Code node isolated runner is unavailable in this desktop environment.');
}

function normalizeWorkflowRuntimeCodeTimeout(value: unknown): number {
  const timeoutMs = readWorkflowRuntimeNumber(value, 2_000);
  return Math.min(10_000, Math.max(100, Math.round(timeoutMs)));
}

type WorkflowRuntimeBrowserWorker = {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message?: string; error?: unknown }) => void) | null;
};

function canUseWorkflowRuntimeBrowserWorker(): boolean {
  const globalRecord = globalThis as unknown as Record<string, unknown>;
  const urlRecord = globalRecord.URL as { createObjectURL?: unknown; revokeObjectURL?: unknown } | undefined;
  return (
    typeof globalRecord.Worker === 'function' &&
    typeof globalRecord.Blob === 'function' &&
    typeof urlRecord?.createObjectURL === 'function' &&
    typeof urlRecord?.revokeObjectURL === 'function'
  );
}

function canUseWorkflowRuntimeNodeWorker(): boolean {
  const globalRecord = globalThis as unknown as { process?: { versions?: { node?: string } } };
  return Boolean(globalRecord.process?.versions?.node);
}

function executeRestrictedWorkflowRuntimeCodeInBrowserWorker(
  source: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<WorkflowRuntimeValue> {
  const globalRecord = globalThis as unknown as Record<string, unknown>;
  const WorkerConstructor = globalRecord.Worker as new (url: string) => WorkflowRuntimeBrowserWorker;
  const BlobConstructor = globalRecord.Blob as new (parts: string[], options?: { type?: string }) => object;
  const urlRecord = globalRecord.URL as {
    createObjectURL(blob: object): string;
    revokeObjectURL(url: string): void;
  };
  const workerUrl = urlRecord.createObjectURL(
    new BlobConstructor([createWorkflowRuntimeCodeBrowserWorkerSource()], { type: 'text/javascript' })
  );
  const worker = new WorkerConstructor(workerUrl);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      urlRecord.revokeObjectURL(workerUrl);
      reject(new Error(`Code node script exceeded timeout ${timeoutMs}ms.`));
    }, timeoutMs);

    worker.onmessage = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      urlRecord.revokeObjectURL(workerUrl);
      handleWorkflowRuntimeCodeWorkerMessage(event.data, resolve, reject);
    };
    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      urlRecord.revokeObjectURL(workerUrl);
      reject(new Error(event.message || readErrorMessage(event.error)));
    };
    worker.postMessage({ source, input });
  });
}

async function executeRestrictedWorkflowRuntimeCodeInNodeWorker(
  source: string,
  input: Record<string, unknown>,
  timeoutMs: number
): Promise<WorkflowRuntimeValue> {
  const importer = new Function('specifier', 'return import(specifier)') as (
    specifier: string
  ) => Promise<{ Worker: new (filename: string, options: Record<string, unknown>) => WorkflowRuntimeNodeWorker }>;
  const { Worker } = await importer('node:worker_threads');
  const worker = new Worker(createWorkflowRuntimeCodeNodeWorkerSource(), {
    eval: true,
    workerData: { source, input }
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      reject(new Error(`Code node script exceeded timeout ${timeoutMs}ms.`));
    }, timeoutMs);

    worker.once('message', (message: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      handleWorkflowRuntimeCodeWorkerMessage(message, resolve, reject);
    });
    worker.once('error', (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      reject(new Error(readErrorMessage(error)));
    });
    worker.once('exit', (code: number) => {
      if (settled || code === 0) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Code node worker exited with code ${code}.`));
    });
  });
}

type WorkflowRuntimeNodeWorker = {
  once(eventName: 'message', listener: (message: unknown) => void): void;
  once(eventName: 'error', listener: (error: unknown) => void): void;
  once(eventName: 'exit', listener: (code: number) => void): void;
  terminate(): Promise<number>;
};

function handleWorkflowRuntimeCodeWorkerMessage(
  message: unknown,
  resolve: (value: WorkflowRuntimeValue) => void,
  reject: (reason: Error) => void
) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    reject(new Error('Code node worker returned an invalid message.'));
    return;
  }

  const record = message as Record<string, unknown>;
  if (record.ok === true) {
    resolve(ensureWorkflowRuntimeJsonSerializable(record.result));
    return;
  }

  reject(new Error(readWorkflowRuntimeString(record.error) ?? 'Code node worker failed.'));
}

function createWorkflowRuntimeCodeBrowserWorkerSource(): string {
  return [
    createWorkflowRuntimeCodeWorkerSharedSource(),
    'self.onmessage = function(event) {',
    '  try {',
    '    const result = executeQiuWorkflowCode(event.data.source, event.data.input);',
    '    self.postMessage({ ok: true, result });',
    '  } catch (error) {',
    '    self.postMessage({ ok: false, error: error && error.message ? error.message : String(error) });',
    '  }',
    '};'
  ].join('\n');
}

function createWorkflowRuntimeCodeNodeWorkerSource(): string {
  return [
    "const { parentPort, workerData } = require('node:worker_threads');",
    createWorkflowRuntimeCodeWorkerSharedSource(),
    'try {',
    '  const result = executeQiuWorkflowCode(workerData.source, workerData.input);',
    '  parentPort.postMessage({ ok: true, result });',
    '} catch (error) {',
    '  parentPort.postMessage({ ok: false, error: error && error.message ? error.message : String(error) });',
    '}'
  ].join('\n');
}

function createWorkflowRuntimeCodeWorkerSharedSource(): string {
  return `
function readColumn(value, path) {
  const segments = String(path || '').split('.').map((segment) => segment.trim()).filter(Boolean);
  let currentValue = value;
  for (const segment of segments) {
    if (currentValue === undefined || currentValue === null) return '';
    if (Array.isArray(currentValue)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= currentValue.length) return '';
      currentValue = currentValue[index];
      continue;
    }
    if (typeof currentValue === 'object') {
      currentValue = currentValue[segment];
      continue;
    }
    return '';
  }
  return currentValue === undefined || currentValue === null ? '' : currentValue;
}
function formatCell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
function normalizeRows(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['rows', 'items', 'results', 'data', 'records']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [value];
}
function readColumnConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const path = typeof value.path === 'string' ? value.path.trim() : '';
  const header = typeof value.header === 'string' && value.header.trim() ? value.header.trim() : path;
  return path && header ? [{ header, path }] : [];
}
function ensureSerializable(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('Code node result must be JSON serializable.');
  return JSON.parse(serialized);
}
function createHelpers() {
  return {
    pick(value, path) {
      return readColumn(value, path);
    },
    toRows(items, columns) {
      const sourceRows = normalizeRows(items);
      const normalizedColumns = Array.isArray(columns) ? columns.flatMap(readColumnConfig) : [];
      if (normalizedColumns.length === 0) return sourceRows;
      return [
        normalizedColumns.map((column) => column.header),
        ...sourceRows.map((item) => normalizedColumns.map((column) => formatCell(readColumn(item, column.path))))
      ];
    }
  };
}
function executeQiuWorkflowCode(source, input) {
  const runner = new Function('input', 'helpers', [
    '"use strict";',
    'const require = undefined;',
    'const process = undefined;',
    'const window = undefined;',
    'const document = undefined;',
    'const fetch = undefined;',
    source
  ].join('\\n'));
  const result = runner(ensureSerializable(input), createHelpers());
  if (result === undefined) throw new Error('Code node script must return a JSON value.');
  if (result && typeof result === 'object' && typeof result.then === 'function') {
    throw new Error('Code node script must be synchronous.');
  }
  return ensureSerializable(result);
}
`;
}

function createWorkflowRuntimeCodeHelpers() {
  return {
    pick(value: unknown, path: string) {
      return readWorkflowRuntimeTableColumnValue(value, path);
    },
    toRows(items: unknown, columns: unknown) {
      const sourceRows = normalizeWorkflowRuntimeTableSourceRows(items);
      const normalizedColumns = Array.isArray(columns)
        ? columns.flatMap(readWorkflowRuntimeTableColumn)
        : [];
      if (normalizedColumns.length === 0) {
        return sourceRows;
      }

      return [
        normalizedColumns.map((column) => column.header),
        ...sourceRows.map((item) =>
          normalizedColumns.map((column) =>
            formatWorkflowRuntimeTableCell(readWorkflowRuntimeTableColumnValue(item, column.path))
          )
        )
      ];
    }
  };
}

function ensureWorkflowRuntimeJsonSerializable(value: unknown): WorkflowRuntimeValue {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error('Code node result must be JSON serializable.');
  }
  return JSON.parse(serialized) as WorkflowRuntimeValue;
}

function readWorkflowRuntimeAssignments(
  node: WorkflowGraphNode,
  pool: WorkflowVariablePool
): Array<{ name: string; value: unknown }> {
  const tableAssignment = readWorkflowRuntimeTableMappingAssignment(node, pool);
  const assignments = Array.isArray(node.config?.assignments)
    ? node.config.assignments.flatMap((item) => readWorkflowRuntimeAssignment(item, pool))
    : [];
  const values = node.config?.values && typeof node.config.values === 'object' && !Array.isArray(node.config.values)
    ? Object.entries(node.config.values as Record<string, unknown>).flatMap(([name, value]) =>
        name.trim()
          ? [
              {
                name: name.trim(),
                value: resolveWorkflowRuntimeConfigValue(value, pool)
              }
            ]
          : []
      )
    : [];

  if (tableAssignment || assignments.length > 0 || values.length > 0) {
    return [...(tableAssignment ? [tableAssignment] : []), ...assignments, ...values];
  }

  const fallbackValue = resolveWorkflowRuntimeConfigValue(
    node.config?.value ?? node.config?.template ?? '$runtime.previous_text',
    pool
  );
  return (node.outputVariables ?? []).map((name) => ({ name, value: fallbackValue }));
}

function readWorkflowRuntimeTableMappingAssignment(
  node: WorkflowGraphNode,
  pool: WorkflowVariablePool
): { name: string; value: unknown } | undefined {
  const mapping = node.config?.tableMapping;
  if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) {
    return undefined;
  }

  const record = mapping as Record<string, unknown>;
  const sourceRef = typeof record.sourceRef === 'string' ? record.sourceRef.trim() : '';
  const outputVariable = typeof record.outputVariable === 'string' && record.outputVariable.trim()
    ? record.outputVariable.trim()
    : node.outputVariables?.[0] ?? `${node.id}.rows`;
  const columns = Array.isArray(record.columns)
    ? record.columns.flatMap(readWorkflowRuntimeTableColumn)
    : [];

  if (!sourceRef || !outputVariable || columns.length === 0) {
    return undefined;
  }

  const sourceValue = pool.get(sourceRef);
  const sourceRows = normalizeWorkflowRuntimeTableSourceRows(sourceValue);
  const rows = sourceRows.length > 0 && sourceRows.every(Array.isArray)
    ? sourceRows as unknown[][]
    : [
        columns.map((column) => column.header),
        ...sourceRows.map((item) =>
          columns.map((column) => formatWorkflowRuntimeTableCell(readWorkflowRuntimeTableColumnValue(item, column.path)))
        )
      ];

  return {
    name: outputVariable,
    value: rows
  };
}

function readWorkflowRuntimeTableColumn(value: unknown): Array<{ header: string; path: string }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const path = typeof record.path === 'string' ? record.path.trim() : '';
  const header = typeof record.header === 'string' && record.header.trim()
    ? record.header.trim()
    : path;

  return path && header ? [{ header, path }] : [];
}

function normalizeWorkflowRuntimeTableSourceRows(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  for (const key of ['rows', 'items', 'results', 'data', 'records']) {
    const nestedValue = record[key];
    if (Array.isArray(nestedValue)) {
      return nestedValue;
    }
  }

  return [record];
}

function readWorkflowRuntimeTableColumnValue(value: unknown, path: string): unknown {
  const segments = path.split('.').map((segment) => segment.trim()).filter(Boolean);
  let currentValue = value;

  for (const segment of segments) {
    if (currentValue === undefined || currentValue === null) {
      return '';
    }

    if (Array.isArray(currentValue)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= currentValue.length) {
        return '';
      }
      currentValue = currentValue[index];
      continue;
    }

    if (typeof currentValue === 'object') {
      currentValue = (currentValue as Record<string, unknown>)[segment];
      continue;
    }

    return '';
  }

  return currentValue ?? '';
}

function formatWorkflowRuntimeTableCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function readWorkflowRuntimeAssignment(
  value: unknown,
  pool: WorkflowVariablePool
): Array<{ name: string; value: unknown }> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name) {
    return [];
  }

  if (typeof record.from === 'string' && record.from.trim()) {
    return [{ name, value: pool.get(record.from.trim()) ?? '' }];
  }

  if (Object.prototype.hasOwnProperty.call(record, 'value')) {
    return [{ name, value: resolveWorkflowRuntimeConfigValue(record.value, pool) }];
  }

  return [{ name, value: '' }];
}

async function invokeWorkflowRuntimeModelNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  binding: ResolvedRuntimeBinding;
  rolePackage?: RolePackageManifest;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const profile = selectWorkflowRuntimeModelProfile(input.node, input.profiles, input.rolePackage);
  const variables = appendWorkflowOutputAssistantMessageVariable(
    input.node,
    input.pool,
    resolveWorkflowVariableRefs(input.pool, input.node.inputVariables, getWorkflowRuntimeFallbackInputRefs(input.pool))
  );
  const outputMode = readWorkflowRuntimeModelOutputMode(input.node);
  const messages = buildWorkflowRuntimeModelMessages({
    task: input.task,
    node: input.node,
    variables,
    knowledgeSources: input.binding.availableKnowledgeSources,
    outputMode,
    schema: readWorkflowRuntimeModelSchema(input.node)
  });
  const response = await input.modelInvoker({
    profile,
    messages,
    timeoutMs: readWorkflowRuntimeModelTimeoutMs(input.node.config?.timeoutMs)
  });
  const parsedJson = parseWorkflowRuntimeJson(response.content);
  if (outputMode === 'json' && parsedJson === undefined) {
    throw new Error(`Model node "${input.node.name}" expected JSON output, but the response could not be parsed.`);
  }
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: response.content,
    json: parsedJson,
    result: outputMode === 'json' ? (parsedJson as WorkflowRuntimeValue) : response.content,
    ...(outputMode === 'json' ? { outputValue: parsedJson as WorkflowRuntimeValue } : {})
  });
  input.pool.set('runtime.previous_text', response.content);
  input.pool.set('runtime.last_model_node', input.node.id);

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, response),
    primaryProfile: profile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_MODEL_INVOKED',
        `Workflow model node invoked: ${input.node.name} via ${profile.providerName}/${profile.modelName}.`,
        input.createdAt,
        sanitizeLogSuffix(input.node.id)
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables,
    message: `Model response saved (${response.content.length} chars).`
  };
}

function appendWorkflowOutputAssistantMessageVariable(
  node: WorkflowGraphNode,
  pool: WorkflowVariablePool,
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>
): Array<{ ref: string; value: WorkflowRuntimeValue }> {
  if (node.type !== 'output' || variables.some((variable) => variable.ref === 'runtime.artifact_assistant_message')) {
    return variables;
  }

  const assistantMessage = pool.get('runtime.artifact_assistant_message');
  return typeof assistantMessage === 'string' && assistantMessage.trim()
    ? [...variables, { ref: 'runtime.artifact_assistant_message', value: assistantMessage }]
    : variables;
}

async function invokeWorkflowRuntimeToolNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const toolRequest = buildWorkflowRuntimeToolRequest(input.node, input.pool);
  const inputVariables = input.node.inputVariables ?? getWorkflowRuntimeFallbackInputRefs(input.pool);

  if (!toolRequest) {
    const message = `Tool node has no executable action: ${input.node.name}.`;
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: message
    });
    return {
      response: {
        ...input.currentResponse,
        content: input.currentResponse.content || message
      },
      primaryProfile: input.primaryProfile,
      logs: [
        createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_TOOL_SKIPPED', message, input.createdAt, input.node.id)
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables,
      outputVariables,
      message
    };
  }

  const availableTool = input.binding.availableTools.find((tool) => tool.id === toolRequest.toolId);
  if (!availableTool) {
    const message = `Workflow tool is not enabled: ${toolRequest.toolId}.`;
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: message
    });
    return {
      response: {
        ...input.currentResponse,
        content: input.currentResponse.content || message
      },
      primaryProfile: input.primaryProfile,
      logs: [
        createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_TOOL_SKIPPED', message, input.createdAt, input.node.id)
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables,
      outputVariables,
      message
    };
  }

  if (!isToolActionEnabledForManifest(availableTool, toolRequest.action)) {
    const message = `Workflow tool action is not enabled by server catalog: ${toolRequest.toolId}/${toolRequest.action}.`;
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: message
    });
    return {
      response: {
        ...input.currentResponse,
        content: input.currentResponse.content || message
      },
      primaryProfile: input.primaryProfile,
      logs: [
        createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_TOOL_SKIPPED', message, input.createdAt, input.node.id)
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables,
      outputVariables,
      message
    };
  }

  if (!input.desktopToolInvoker || !input.workspaceId) {
    const message = 'Workflow tool skipped because desktop tool bridge or workspace ID is unavailable.';
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: message
    });
    return {
      response: {
        ...input.currentResponse,
        content: input.currentResponse.content || message
      },
      primaryProfile: input.primaryProfile,
      logs: [
        createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_TOOL_SKIPPED', message, input.createdAt, input.node.id)
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables,
      outputVariables,
      message
    };
  }

  const toolResult = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: toolRequest.toolId,
    action: toolRequest.action,
    input: toolRequest.input,
    allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
  });

  if (!toolResult.ok) {
    throw new Error(toolResult.message ?? `Workflow tool failed: ${toolRequest.toolId}/${toolRequest.action}.`);
  }

  const textOutput = readToolTextOutput(toolResult.output) ?? JSON.stringify(toolResult.output ?? {}, null, 2);
  const generatedArtifact = buildGeneratedArtifactFromToolResult({
    taskId: input.task.taskId,
    toolId: toolRequest.toolId,
    action: toolRequest.action,
    output: toolResult.output,
    createdAt: input.createdAt,
    sequence: 1
  });
  const file = generatedArtifact?.localPath
    ? buildWorkflowRuntimeFileValueFromArtifact(input.node.id, generatedArtifact)
    : undefined;
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: textOutput,
    result: toolResult.output ?? {},
    file
  });
  input.pool.set('runtime.previous_text', textOutput);

  return {
    response: {
      ...input.currentResponse,
      content: textOutput || input.currentResponse.content
    },
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_TOOL_INVOKED',
        `Workflow tool executed: ${availableTool.name} / ${toolRequest.action}.`,
        input.createdAt,
        sanitizeLogSuffix(input.node.id)
      )
    ],
    usedToolIds: [toolRequest.toolId],
    generatedArtifacts: generatedArtifact ? [generatedArtifact] : [],
    inputVariables,
    outputVariables,
    message: `Tool result saved (${getWorkflowRuntimeValueType(toolResult.output ?? {})}).`
  };
}

async function invokeWorkflowRuntimeArtifactNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  binding: ResolvedRuntimeBinding;
  profiles: ModelProfile[];
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const explicitInputVariables = (input.node.inputVariables ?? []).length > 0;
  const artifactInputVariables = resolveWorkflowVariableRefs(
    input.pool,
    input.node.inputVariables,
    getWorkflowRuntimeFallbackInputRefs(input.pool)
  );
  const modelResult = explicitInputVariables && artifactInputVariables.length > 0
    ? createWorkflowRuntimeArtifactContentResult(input, artifactInputVariables)
    : await invokeWorkflowRuntimeModelNode(input);
  const artifactPayload = buildWorkflowArtifactPayload({
    task: input.task,
    node: input.node,
    variables: explicitInputVariables ? artifactInputVariables : undefined,
    rawContent: modelResult.response.content
  });
  writeWorkflowArtifactAssistantMessage(input.pool, input.node, artifactPayload.assistantMessage);
  const availableToolIds = new Set(input.binding.availableTools.map((tool) => tool.id));
  const configuredToolRequest = buildWorkflowRuntimeToolRequest(input.node, input.pool);
  const configuredToolRequestIsUsable =
    configuredToolRequest &&
    availableToolIds.has(configuredToolRequest.toolId) &&
    isWorkflowArtifactToolRequestCompatible(input.node.artifactType, configuredToolRequest);
  const artifactNode: WorkflowExecutionNodeSummary = {
    id: input.node.id,
    type: input.node.type,
    name: input.node.name,
    instruction: input.node.instruction,
    toolIds: input.node.toolId ? [input.node.toolId] : [],
    artifactType: input.node.artifactType,
    requiresApproval: input.node.requiresApproval
  };
  const toolRequest = normalizeWorkflowArtifactToolRequest({
    task: input.task,
    artifactNode,
    payload: artifactPayload,
    request: configuredToolRequestIsUsable
      ? configuredToolRequest
      : buildWorkflowFallbackArtifactToolRequest({
        task: input.task,
        artifactNode,
        payload: artifactPayload,
        availableToolIds
      })
  });

  if (!toolRequest || !input.desktopToolInvoker || !input.workspaceId) {
    return {
      ...modelResult,
      message: input.node.artifactType
        ? `Artifact content generated, but no local writer is available for ${input.node.artifactType}.`
        : 'Artifact content generated without a requested file type.'
    };
  }

  const toolResult = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: toolRequest.toolId,
    action: toolRequest.action,
    input: toolRequest.input,
    allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
  });

  if (!toolResult.ok) {
    throw new Error(toolResult.message ?? `Workflow artifact writer failed: ${toolRequest.toolId}/${toolRequest.action}.`);
  }

  const generatedArtifact = buildGeneratedArtifactFromToolResult({
    taskId: input.task.taskId,
    toolId: toolRequest.toolId,
    action: toolRequest.action,
    output: toolResult.output,
    createdAt: input.createdAt,
    sequence: 1
  });
  const file = generatedArtifact?.localPath
    ? buildWorkflowRuntimeFileValueFromArtifact(input.node.id, generatedArtifact)
    : undefined;
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: artifactPayload.content,
    result: toolResult.output ?? {},
    file
  });

  return {
    ...modelResult,
    response: {
      ...modelResult.response,
      content: artifactPayload.assistantMessage ?? modelResult.response.content
    },
    logs: [
      ...modelResult.logs,
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_ARTIFACT_WRITTEN',
        generatedArtifact?.localPath
          ? `Workflow artifact file was created: ${generatedArtifact.localPath}.`
          : `Workflow artifact writer completed: ${toolRequest.toolId}/${toolRequest.action}.`,
        input.createdAt,
        sanitizeLogSuffix(input.node.id)
      )
    ],
    usedToolIds: [...modelResult.usedToolIds, toolRequest.toolId],
    generatedArtifacts: generatedArtifact ? [...modelResult.generatedArtifacts, generatedArtifact] : modelResult.generatedArtifacts,
    outputVariables,
    message: generatedArtifact?.localPath
      ? `Artifact file created: ${generatedArtifact.localPath}.`
      : 'Artifact writer completed.'
  };
}

function createWorkflowRuntimeArtifactContentResult(
  input: {
    task: DesktopTaskDetail;
    node: WorkflowGraphNode;
    pool: WorkflowVariablePool;
    currentResponse: DesktopModelChatResponse;
    primaryProfile: ModelProfile;
    createdAt: string;
  },
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>
): {
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
} {
  const payload = buildWorkflowArtifactPayload({
    task: input.task,
    node: input.node,
    variables
  });
  writeWorkflowArtifactAssistantMessage(input.pool, input.node, payload.assistantMessage);
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: payload.content
  });
  input.pool.set('runtime.previous_text', payload.content);

  return {
    response: {
      ...input.currentResponse,
      content: payload.assistantMessage ?? payload.content
    },
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_ARTIFACT_INPUT_RESOLVED',
        `Artifact node consumed upstream variable(s): ${variables.map((variable) => variable.ref).join(', ')}.`,
        input.createdAt,
        sanitizeLogSuffix(input.node.id)
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables,
    message: 'Artifact content resolved from upstream variables.'
  };
}

function renderWorkflowArtifactContentFromVariables(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>,
  task?: DesktopTaskDetail,
  node?: WorkflowGraphNode
): string {
  const preferredValue = selectPreferredWorkflowArtifactContentValue(variables, task, node);
  if (preferredValue !== undefined) {
    return normalizeWorkflowArtifactContent(workflowRuntimeValueToArtifactText(preferredValue), task, node);
  }

  if (variables.length === 1) {
    const value = variables[0]?.value;
    if (typeof value === 'string') {
      return normalizeWorkflowArtifactContent(value, task, node);
    }

    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return String(value);
    }
  }

  return normalizeWorkflowArtifactContent(renderWorkflowVariableRefsForArtifact(variables, 80_000), task, node);
}

interface WorkflowArtifactPayload {
  content: string;
  title?: string;
  fileName?: string;
  assistantMessage?: string;
}

function buildWorkflowArtifactPayload(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  variables?: Array<{ ref: string; value: WorkflowRuntimeValue }>;
  rawContent?: string;
}): WorkflowArtifactPayload {
  const structuredPayload =
    readWorkflowArtifactPayloadFromVariables(input.variables ?? []) ??
    readWorkflowArtifactPayloadFromText(input.rawContent ?? '');
  const rawContent =
    structuredPayload?.content ??
    (input.variables && input.variables.length > 0
      ? renderWorkflowArtifactContentFromVariables(input.variables, input.task, input.node)
      : input.rawContent ?? '');
  const content = normalizeWorkflowArtifactContent(rawContent, input.task, input.node);
  const assistantMessage =
    structuredPayload?.assistantMessage ??
    extractWorkflowArtifactAssistantMessage(rawContent, input.task, input.node);
  const title =
    structuredPayload?.title ??
    extractWorkflowArtifactTitle(content, input.task) ??
    extractWorkflowArtifactTitle(input.rawContent ?? '', input.task);
  const fileName =
    stripWorkflowArtifactExtension(structuredPayload?.fileName) ??
    buildWorkflowArtifactFileNameFromPayload({
      task: input.task,
      node: input.node,
      title
    });

  return {
    content,
    title,
    fileName,
    assistantMessage
  };
}

function readWorkflowArtifactPayloadFromVariables(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>
): WorkflowArtifactPayload | undefined {
  for (const variable of variables) {
    const payload = readWorkflowArtifactPayloadFromValue(variable.value);
    if (payload?.content) {
      return payload;
    }
  }

  return undefined;
}

function readWorkflowArtifactPayloadFromValue(value: WorkflowRuntimeValue): WorkflowArtifactPayload | undefined {
  if (typeof value === 'string') {
    return readWorkflowArtifactPayloadFromText(value);
  }

  if (!value || typeof value !== 'object' || Array.isArray(value) || isWorkflowFileValue(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const content = readFirstWorkflowRuntimeString(record, [
    'artifactBody',
    'artifactContent',
    'documentBody',
    'documentContent',
    'deliverableBody',
    'deliverableContent',
    'body',
    'content',
    'markdown',
    'text'
  ]);

  if (!content) {
    return undefined;
  }

  return {
    content,
    title: readFirstWorkflowRuntimeString(record, ['documentTitle', 'artifactTitle', 'title']),
    fileName: readFirstWorkflowRuntimeString(record, ['fileName', 'filename', 'artifactFileName']),
    assistantMessage: readFirstWorkflowRuntimeString(record, [
      'assistantMessage',
      'userMessage',
      'reply',
      'summary',
      'notes'
    ])
  };
}

function readWorkflowArtifactPayloadFromText(value: string): WorkflowArtifactPayload | undefined {
  const parsed = parseWorkflowRuntimeJson(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return undefined;
  }

  return readWorkflowArtifactPayloadFromValue(parsed as WorkflowRuntimeValue);
}

function selectPreferredWorkflowArtifactContentValue(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>,
  task?: DesktopTaskDetail,
  node?: WorkflowGraphNode
): WorkflowRuntimeValue | undefined {
  if (!shouldStripWorkflowArtifactAssistantNotes(task, node)) {
    return undefined;
  }

  const preferred = variables.find((variable) => isPreferredWorkflowArtifactContentRef(variable.ref));
  if (preferred) {
    return preferred.value;
  }

  const nonReviewVariable = variables.find((variable) => !isWorkflowArtifactReviewRef(variable.ref));
  return nonReviewVariable?.value;
}

function isPreferredWorkflowArtifactContentRef(ref: string): boolean {
  const normalized = ref.toLocaleLowerCase();
  return [
    'artifactbody',
    'artifact_body',
    'artifactcontent',
    'artifact_content',
    'documentbody',
    'document_body',
    'documentcontent',
    'document_content',
    'deliverable_content',
    'deliverablecontent',
    'deliverable_body',
    'draft_text',
    'draft',
    'body',
    'content'
  ].some((keyword) => normalized.includes(keyword));
}

function isWorkflowArtifactReviewRef(ref: string): boolean {
  const normalized = ref.toLocaleLowerCase();
  return ['quality', 'review', 'assistantmessage', 'assistant_message', 'final_answer', 'final'].some((keyword) =>
    normalized.includes(keyword)
  );
}

function workflowRuntimeValueToArtifactText(value: WorkflowRuntimeValue): string {
  const payload = readWorkflowArtifactPayloadFromValue(value);
  if (payload?.content) {
    return payload.content;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return String(value);
  }

  return renderWorkflowVariableRefsForArtifact([{ ref: 'value', value }], 80_000);
}

function normalizeWorkflowArtifactContent(
  value: string,
  task?: DesktopTaskDetail,
  node?: WorkflowGraphNode
): string {
  const withoutTaskTitle = stripLeadingWorkflowTaskTitle(value, task?.title);
  const withoutAssistantNotes = shouldStripWorkflowArtifactAssistantNotes(task, node)
    ? stripTrailingWorkflowArtifactAssistantNotes(withoutTaskTitle)
    : withoutTaskTitle;

  return withoutAssistantNotes
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripLeadingWorkflowTaskTitle(value: string, taskTitle: string | undefined): string {
  const title = taskTitle?.trim();
  if (!title) {
    return value.trim();
  }

  const lines = value.replace(/\r\n/g, '\n').split('\n');
  while (lines.length > 0 && !lines[0]?.trim()) {
    lines.shift();
  }

  const firstLine = lines[0]?.trim();
  if (firstLine && areWorkflowTitleLinesEquivalent(firstLine, title)) {
    lines.shift();
    while (lines.length > 0 && !lines[0]?.trim()) {
      lines.shift();
    }
  }

  return lines.join('\n').trim();
}

function areWorkflowTitleLinesEquivalent(left: string, right: string): boolean {
  const normalizedLeft = normalizeWorkflowTitleLine(left);
  const normalizedRight = normalizeWorkflowTitleLine(right);
  return Boolean(
    normalizedLeft &&
      normalizedRight &&
      (normalizedLeft === normalizedRight ||
        normalizedLeft.startsWith(normalizedRight) ||
        normalizedRight.startsWith(normalizedLeft))
  );
}

function normalizeWorkflowTitleLine(value: string): string {
  return value
    .replace(/^#+\s*/, '')
    .replace(/[.。…]+$/g, '')
    .replace(/\s+/g, '')
    .trim()
    .toLocaleLowerCase();
}

function shouldStripWorkflowArtifactAssistantNotes(
  task: DesktopTaskDetail | undefined,
  node: WorkflowGraphNode | undefined
): boolean {
  const text = [task?.title, task?.input, node?.name, node?.instruction].filter(Boolean).join(' ');
  const isDocumentArtifact =
    ['docx', 'markdown', 'pdf'].includes(node?.artifactType ?? '') || /文档|Word|docx|markdown|PDF/i.test(text);
  return isDocumentArtifact && /文档|Word|docx|整理|简洁|正式|保留核心|摘要|归纳|提炼/i.test(text);
}

function stripTrailingWorkflowArtifactAssistantNotes(value: string): string {
  return splitTrailingWorkflowArtifactAssistantNotes(value).content;
}

function extractWorkflowArtifactAssistantMessage(
  value: string,
  task: DesktopTaskDetail,
  node: WorkflowGraphNode
): string | undefined {
  if (!shouldStripWorkflowArtifactAssistantNotes(task, node)) {
    return undefined;
  }

  return splitTrailingWorkflowArtifactAssistantNotes(stripLeadingWorkflowTaskTitle(value, task.title)).assistantMessage;
}

function splitTrailingWorkflowArtifactAssistantNotes(value: string): {
  content: string;
  assistantMessage?: string;
} {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const cutIndex = lines.findIndex((line, index) => {
    if (index < 3) {
      return false;
    }

    const normalized = line.trim().replace(/^#+\s*/, '').replace(/^\d+[.、]\s*/, '');
    return /^(后续建议|需补充信息|补充信息|待补充信息|处理建议|给用户的建议)[:：]?$/.test(normalized);
  });

  if (cutIndex < 0) {
    return { content: value.trim() };
  }

  const content = lines.slice(0, cutIndex).join('\n').replace(/[-_\s\n]+$/g, '').trim();
  const assistantMessage = lines
    .slice(cutIndex)
    .join('\n')
    .replace(/^#+\s*/gm, '')
    .replace(/^\d+[.、]\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    content,
    assistantMessage: assistantMessage || undefined
  };
}

function extractWorkflowArtifactTitle(content: string, task: DesktopTaskDetail): string | undefined {
  const contentWithoutTaskTitle = stripLeadingWorkflowTaskTitle(content, task.title);
  const line = contentWithoutTaskTitle
    .split(/\r?\n/)
    .map((item) => item.trim())
    .find(Boolean);
  const title = line
    ?.replace(/^#+\s*/, '')
    .replace(/^\d+[.、]\s*/, '')
    .trim();

  if (!title || title.length > 80 || /^(摘要|概述|正文|任务结果|处理结果|后续建议)$/i.test(title)) {
    return undefined;
  }

  if (/^请|^帮我|^把这个|^将这个/.test(title)) {
    return undefined;
  }

  return title;
}

function buildWorkflowArtifactFileNameFromPayload(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  title?: string;
}): string {
  const title = input.title?.trim();
  const suffix = shouldStripWorkflowArtifactAssistantNotes(input.task, input.node) ? '整理版' : input.node.name;

  if (title) {
    return buildWorkflowArtifactFileName(title, suffix);
  }

  return buildWorkflowArtifactFileName(input.task.title, input.node.name);
}

function stripWorkflowArtifactExtension(fileName: string | undefined): string | undefined {
  const value = fileName?.trim();
  if (!value) {
    return undefined;
  }

  return value.replace(/\.(docx|xlsx|csv|pptx|md|markdown|pdf|png|jpe?g|mp4)$/i, '').trim() || undefined;
}

function readFirstWorkflowRuntimeString(
  record: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = readWorkflowRuntimeString(record[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function writeWorkflowArtifactAssistantMessage(
  pool: WorkflowVariablePool,
  node: WorkflowGraphNode,
  assistantMessage: string | undefined
): void {
  const message = assistantMessage?.trim();
  if (!message) {
    return;
  }

  pool.set(`${node.id}.assistantMessage`, message);
  pool.set('runtime.artifact_assistant_message', message);
}

function completeWorkflowRuntimeConditionNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: input.node.instruction ?? 'Condition node evaluated through outgoing edge rules.'
  });

  return Promise.resolve({
    response: input.currentResponse,
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables,
    message: 'Branch selection will use outgoing edge conditions.'
  });
}

function completeWorkflowRuntimeApprovalNode(input: {
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const message = input.node.instruction ?? 'Approval checkpoint recorded. Desktop runtime continues in local mode.';
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: message
  });

  return Promise.resolve({
    response: input.currentResponse,
    primaryProfile: input.primaryProfile,
    logs: [],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables,
    message: 'Approval checkpoint recorded.'
  });
}

function buildWorkflowRuntimeModelMessages(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>;
  knowledgeSources: DesktopKnowledgeSourceSummary[];
  outputMode: WorkflowRuntimeModelOutputMode;
  schema?: unknown;
}): DesktopModelChatMessage[] {
  const knowledgeContext = input.knowledgeSources
    .map((source) => formatKnowledgeSourceForPrompt(source))
    .join('\n---\n');
  const schemaText = input.schema === undefined || input.schema === null
    ? ''
    : JSON.stringify(input.schema, null, 2);
  const outputInstruction = input.outputMode === 'json'
    ? [
        'Return valid JSON only.',
        'Do not add markdown fences, comments, explanations, or prose outside JSON.',
        schemaText ? `Expected JSON shape:\n${schemaText}` : 'Use a stable JSON object or array that matches the node instruction.'
      ].join('\n')
    : 'Return the node output directly in Chinese unless the node instruction asks for structured JSON.';

  return [
    {
      role: 'system',
      content: [
        'You are a QiuAI WorkOS workflow node executor.',
        `Role: ${input.task.roleName}`,
        `Node: ${input.node.name} (${input.node.type})`,
        'Execute only this node. Do not invent completed tool or file operations.',
        outputInstruction
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Task title: ${input.task.title}`,
        `Task input: ${input.task.input}`,
        `Node instruction: ${input.node.instruction ?? 'Use the task input and produce the next useful result.'}`,
        `Input variables:\n${renderWorkflowVariableRefsForPrompt(input.variables)}`,
        `Knowledge context:\n${knowledgeContext || 'none'}`,
        input.outputMode === 'json' ? `JSON output requirement:\n${outputInstruction}` : ''
      ].join('\n\n')
    }
  ];
}

function readWorkflowRuntimeModelOutputMode(node: WorkflowGraphNode): WorkflowRuntimeModelOutputMode {
  if (readWorkflowRuntimeString(node.config?.llmTaskType) === 'structured_extraction') return 'json';
  return node.config?.outputMode === 'json' || node.config?.responseFormat === 'json' ? 'json' : 'text';
}

function readWorkflowRuntimeModelSchema(node: WorkflowGraphNode): unknown {
  return node.config?.schema ?? node.config?.jsonSchema ?? node.config?.parameters;
}

function readWorkflowRuntimeDataMode(node: WorkflowGraphNode): 'assign' | 'template' | 'code' {
  const mode = readWorkflowRuntimeString(node.config?.dataMode);
  return mode === 'template' || mode === 'code' ? mode : 'assign';
}

function buildWorkflowRuntimeToolRequest(
  node: WorkflowGraphNode,
  pool: WorkflowVariablePool
): DesktopToolCallInstruction | undefined {
  const config = node.config ?? {};
  const toolId = readWorkflowRuntimeToolId(node);
  if (!toolId) {
    return undefined;
  }

  const configuredAction = typeof config.action === 'string' && isDesktopToolInvocationAction(config.action)
    ? config.action
    : undefined;
  const configuredInput = config.input && typeof config.input === 'object' && !Array.isArray(config.input)
    ? resolveWorkflowRuntimeConfigValue(config.input as Record<string, unknown>, pool)
    : undefined;

  if (configuredAction && configuredInput && typeof configuredInput === 'object' && !Array.isArray(configuredInput)) {
    return {
      toolId,
      action: configuredAction,
      input: configuredInput as Record<string, unknown>
    };
  }

  const variables = resolveWorkflowVariableRefs(pool, node.inputVariables, getWorkflowRuntimeFallbackInputRefs(pool));
  const query = variables.map((variable) => previewWorkflowRuntimeValue(variable.value, 1_000)).join('\n\n').trim();

  if (toolId === 'web-search') {
    return {
      toolId,
      action: 'web.search',
      input: {
        query: query || String(pool.get('start.text') ?? ''),
        maxResults: readWorkflowRuntimeNumber(config.maxResults, 5)
      }
    };
  }

  if (toolId === 'office-document') {
    const file = findFirstWorkflowRuntimeFile(variables) ?? findFirstWorkflowRuntimeFile([
      { ref: 'start.files', value: pool.get('start.files') ?? [] }
    ]);
    if (file) {
      return {
        toolId,
        action: 'document.extract_text',
        input: {
          path: file.localPath,
          maxChars: readWorkflowRuntimeNumber(config.maxChars, 30_000)
        }
      };
    }
  }

  if (toolId === 'local-filesystem' && typeof config.path === 'string') {
    return {
      toolId,
      action: 'filesystem.read_text_file',
      input: {
        path: String(resolveWorkflowRuntimeConfigValue(config.path, pool)),
        maxChars: readWorkflowRuntimeNumber(config.maxChars, 30_000)
      }
    };
  }

  if (toolId === 'http-request' && typeof config.url === 'string') {
    return {
      toolId,
      action: 'http.request',
      input: resolveWorkflowRuntimeConfigValue(
        {
          method: config.method ?? 'GET',
          url: config.url,
          headers: config.headers ?? {},
          body: config.body,
          maxChars: config.maxChars ?? 24_000,
          timeoutMs: config.timeoutMs,
          allowPrivateNetwork: config.allowPrivateNetwork === true
        },
        pool
      ) as Record<string, unknown>
    };
  }

  if (toolId === 'mcp' && typeof config.endpoint === 'string' && typeof config.toolName === 'string') {
    return {
      toolId,
      action: 'mcp.call',
      input: resolveWorkflowRuntimeConfigValue(
        {
          endpoint: config.endpoint,
          toolName: config.toolName,
          arguments: config.arguments ?? {},
          headers: config.headers ?? {},
          timeoutMs: config.timeoutMs,
          allowPrivateNetwork: config.allowPrivateNetwork === true
        },
        pool
      ) as Record<string, unknown>
    };
  }

  if (toolId === 'video-processing') {
    const file = findFirstWorkflowRuntimeFile(variables) ?? findFirstWorkflowRuntimeFile([
      { ref: 'start.files', value: pool.get('start.files') ?? [] }
    ]);
    const videoPath =
      typeof config.videoPath === 'string'
        ? String(resolveWorkflowRuntimeConfigValue(config.videoPath, pool))
        : file?.localPath;
    if (!videoPath) {
      return undefined;
    }

    return {
      toolId,
      action: 'video.probe',
      input: {
        videoPath
      }
    };
  }

  return undefined;
}

function selectWorkflowRuntimeModelProfile(
  node: WorkflowGraphNode,
  profiles: ModelProfile[],
  rolePackage?: RolePackageManifest
): ModelProfile {
  const requiredModelProfileId = readDependencyManifestModelProfileIdForNode(rolePackage, node) ?? node.modelProfileId;
  if (requiredModelProfileId) {
    const selected = profiles.find((profile) => profile.id === requiredModelProfileId);
    if (selected) {
      return selected;
    }

    throw new Error(
      `Workflow node "${node.name}" requires model profile "${requiredModelProfileId}", but it is not configured or enabled on this PC.`
    );
  }

  return profiles[0]!;
}

function readDependencyManifestModelProfileIdForNode(
  rolePackage: RolePackageManifest | undefined,
  node: WorkflowGraphNode
): string | undefined {
  const modelAssets = rolePackage?.dependencyManifest?.modelAssets;
  if (!modelAssets?.length) {
    return undefined;
  }

  const modelAssetKey =
    typeof node.config?.modelAssetKey === 'string' && node.config.modelAssetKey.trim()
      ? node.config.modelAssetKey.trim()
      : undefined;
  const asset = modelAssetKey
    ? modelAssets.find((item) => item.key === modelAssetKey)
    : modelAssets.find((item) => item.nodeIds.includes(node.id));
  const profileId = asset?.modelProfileId || asset?.modelId || asset?.key;

  return profileId?.trim() || undefined;
}

function mergeWorkflowRuntimeResponses(
  currentResponse: DesktopModelChatResponse,
  nextResponse: DesktopModelChatResponse
): DesktopModelChatResponse {
  return {
    ...nextResponse,
    inputTokens: sumOptionalTokenCounts(currentResponse.inputTokens, nextResponse.inputTokens),
    outputTokens: sumOptionalTokenCounts(currentResponse.outputTokens, nextResponse.outputTokens)
  };
}

function groupWorkflowRuntimeEdgesBySource(edges: WorkflowGraphEdge[]): Map<string, WorkflowGraphEdge[]> {
  const result = new Map<string, WorkflowGraphEdge[]>();
  for (const edge of edges) {
    result.set(edge.sourceNodeId, [...(result.get(edge.sourceNodeId) ?? []), edge]);
  }

  return result;
}

function selectNextWorkflowRuntimeEdge(
  edges: WorkflowGraphEdge[],
  pool: WorkflowVariablePool
): {
  edge?: WorkflowGraphEdge;
  log?: { level: DesktopExecutionLogEntry['level']; eventType: string; message: string; suffix: string };
} {
  if (edges.length === 0) {
    return {};
  }

  for (const edge of edges) {
    const result = evaluateWorkflowRuntimeCondition(edge.condition, pool);
    if (result === 'matched') {
      return { edge };
    }

    if (result === 'deferred') {
      return {
        edge,
        log: {
          level: 'warning',
          eventType: 'WORKFLOW_RUNTIME_CONDITION_DEFERRED',
          message: `Expression condition is not locally executable and was routed through edge: ${edge.id}.`,
          suffix: edge.id
        }
      };
    }
  }

  return {};
}

function evaluateWorkflowRuntimeCondition(
  condition: WorkflowGraphEdgeCondition | undefined,
  pool: WorkflowVariablePool
): 'matched' | 'skipped' | 'deferred' {
  if (!condition || condition.type === 'always') {
    return 'matched';
  }

  if (condition.type === 'expression') {
    return 'deferred';
  }

  const value = condition.variable ? pool.get(condition.variable) : pool.get('start.text');
  if (condition.type === 'exists') {
    return isWorkflowRuntimeValuePresent(value) ? 'matched' : 'skipped';
  }

  if (condition.type === 'equals') {
    return normalizeWorkflowRuntimeComparisonValue(value) === normalizeWorkflowRuntimeComparisonValue(condition.value)
      ? 'matched'
      : 'skipped';
  }

  if (condition.type === 'contains') {
    const actual = normalizeWorkflowRuntimeComparisonValue(value);
    const expected = normalizeWorkflowRuntimeComparisonValue(condition.value);
    return expected && actual.includes(expected) ? 'matched' : 'skipped';
  }

  return 'skipped';
}

function getWorkflowRuntimeFallbackInputRefs(pool: WorkflowVariablePool): string[] {
  return pool.has('runtime.previous_text') ? ['runtime.previous_text', 'start.text'] : ['start.text'];
}

function readWorkflowRuntimeToolId(node: WorkflowGraphNode): string | undefined {
  if (node.toolId) {
    return node.toolId;
  }

  const toolIds = Array.isArray(node.config?.toolIds)
    ? node.config.toolIds.filter((toolId): toolId is string => typeof toolId === 'string' && toolId.trim().length > 0)
    : [];
  return toolIds[0]?.trim();
}

function resolveWorkflowRuntimeConfigValue(value: unknown, pool: WorkflowVariablePool): unknown {
  if (typeof value === 'string') {
    const variableOnly = value.match(/^\$([a-zA-Z0-9_.-]+)$/);
    if (variableOnly) {
      return pool.get(variableOnly[1]) ?? '';
    }

    return value
      .replace(/\{\{#?([a-zA-Z0-9_.-]+)#?\}\}/g, (_match, ref: string) =>
        previewWorkflowRuntimeValue((pool.get(ref) ?? '') as WorkflowRuntimeValue, 8_000)
      );
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveWorkflowRuntimeConfigValue(item, pool));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        resolveWorkflowRuntimeConfigValue(item, pool)
      ])
    );
  }

  return value;
}

function findFirstWorkflowRuntimeFile(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue | undefined }>
): WorkflowFileValue | undefined {
  for (const variable of variables) {
    if (isWorkflowFileValue(variable.value)) {
      return variable.value;
    }

    if (Array.isArray(variable.value)) {
      const file = (variable.value as unknown[]).find(isWorkflowFileValue);
      if (file) {
        return file;
      }
    }
  }

  return undefined;
}

function buildWorkflowRuntimeFileValueFromArtifact(
  nodeId: string,
  artifact: DesktopArtifactSummary
): WorkflowFileValue {
  const localPath = artifact.localPath ?? artifact.title;
  return {
    id: `${nodeId}-file`,
    name: getPathFileName(localPath) ?? artifact.title,
    kind: inferWorkflowRuntimeFileKind(localPath),
    localPath,
    extractedText: artifact.content
  };
}

function inferWorkflowRuntimeFileKind(localPath: string): WorkflowFileValue['kind'] {
  const extension = localPath.split('.').at(-1)?.trim().toLocaleLowerCase();
  if (['doc', 'docx'].includes(extension ?? '')) return 'document';
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(extension ?? '')) return 'spreadsheet';
  if (['ppt', 'pptx'].includes(extension ?? '')) return 'presentation';
  if (['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(extension ?? '')) return 'video';
  if (['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'].includes(extension ?? '')) return 'audio';
  if (extension === 'pdf') return 'pdf';
  if (['txt', 'md', 'json'].includes(extension ?? '')) return 'text';
  return 'other';
}

function parseWorkflowRuntimeJson(value: string): unknown | undefined {
  const candidates = [
    value.trim(),
    ...extractFencedJsonBlocks(value).map((block) => block.trim()),
    extractFirstJsonValue(value)
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    const result = parseWorkflowRuntimeJsonCandidate(candidate);
    if (result.ok) {
      return result.value;
    }
  }

  return undefined;
}

function parseWorkflowRuntimeJsonCandidate(value: string): { ok: true; value: unknown } | { ok: false } {
  if (!value.startsWith('{') && !value.startsWith('[')) {
    return { ok: false };
  }

  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

function extractFirstJsonValue(value: string): string | undefined {
  const start = value.search(/[\[{]/);
  if (start < 0) {
    return undefined;
  }

  const stack: string[] = [];
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
      stack.push('}');
      continue;
    }

    if (character === '[') {
      stack.push(']');
      continue;
    }

    if ((character === '}' || character === ']') && stack.at(-1) === character) {
      stack.pop();
      if (stack.length === 0) {
        return value.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function readWorkflowRuntimeNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readWorkflowRuntimeModelTimeoutMs(value: unknown): number {
  const timeoutMs = readWorkflowRuntimeNumber(value, 45_000);
  return Math.min(180_000, Math.max(10_000, Math.round(timeoutMs)));
}

function readWorkflowRuntimeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toWorkflowRuntimeArray(value: WorkflowRuntimeValue | undefined): WorkflowRuntimeValue[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? (value as WorkflowRuntimeValue[]) : [value];
}

function clampWorkflowRuntimeLimit(
  value: number | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

function normalizeWorkflowRuntimeComparisonValue(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim().toLocaleLowerCase();
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).toLocaleLowerCase();
  }

  return JSON.stringify(value).toLocaleLowerCase();
}

function isWorkflowRuntimeValuePresent(value: unknown): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  return true;
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

    if (!isToolActionEnabledForManifest(availableTool, toolCall.action)) {
      const toolRejectedLog = createLog(
        input.task.taskId,
        'warning',
        'TOOL_CALL_REJECTED',
        `Requested tool action is not enabled by server catalog: ${toolCall.toolId}/${toolCall.action}.`,
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

async function maybeGenerateWorkflowFallbackArtifact(input: {
  task: DesktopTaskDetail;
  binding: ResolvedRuntimeBinding;
  workflowPlan: WorkflowExecutionPlan;
  response: DesktopModelChatResponse;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  onProgress?: DesktopTaskProgressCallback;
  progressTask: DesktopTaskDetail;
  existingGeneratedArtifacts: DesktopArtifactSummary[];
}): Promise<{
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  progressTask: DesktopTaskDetail;
}> {
  const logs: DesktopExecutionLogEntry[] = [];
  const usedToolIds: string[] = [];
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  let progressTask = input.progressTask;

  if (!input.workflowPlan.enabled || input.existingGeneratedArtifacts.length > 0) {
    return {
      logs,
      usedToolIds,
      generatedArtifacts,
      progressTask
    };
  }

  const artifactNode = getRunnableWorkflowNodes(input.workflowPlan).find((node) => node.artifactType);
  if (!artifactNode?.artifactType) {
    return {
      logs,
      usedToolIds,
      generatedArtifacts,
      progressTask
    };
  }

  const availableToolIds = new Set(input.binding.availableTools.map((tool) => tool.id));
  const payload = buildWorkflowArtifactPayload({
    task: input.task,
    node: workflowExecutionSummaryToGraphNode(artifactNode),
    rawContent: input.response.content
  });
  const toolRequest = normalizeWorkflowArtifactToolRequest({
    task: input.task,
    artifactNode,
    payload,
    request: buildWorkflowFallbackArtifactToolRequest({
      task: input.task,
      artifactNode,
      payload,
      availableToolIds
    })
  });

  if (!toolRequest) {
    const skippedLog = createLog(
      input.task.taskId,
      'warning',
      'WORKFLOW_ARTIFACT_FALLBACK_SKIPPED',
      `Workflow expected ${artifactNode.artifactType}, but no enabled local writer tool is available.`,
      input.createdAt,
      sanitizeLogSuffix(artifactNode.id)
    );
    logs.push(skippedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [skippedLog],
      state: 'running',
      currentRunStatus: 'running'
    });
    return {
      logs,
      usedToolIds,
      generatedArtifacts,
      progressTask
    };
  }

  if (!input.desktopToolInvoker || !input.workspaceId) {
    const skippedLog = createLog(
      input.task.taskId,
      'warning',
      'WORKFLOW_ARTIFACT_FALLBACK_SKIPPED',
      'Workflow artifact writer skipped because desktop tool bridge or workspace ID is unavailable.',
      input.createdAt,
      sanitizeLogSuffix(artifactNode.id)
    );
    logs.push(skippedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [skippedLog],
      state: 'running',
      currentRunStatus: 'running'
    });
    return {
      logs,
      usedToolIds,
      generatedArtifacts,
      progressTask
    };
  }

  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_ARTIFACT_FALLBACK_STARTED',
    `Writing workflow artifact via ${toolRequest.toolId}/${toolRequest.action}.`,
    input.createdAt,
    sanitizeLogSuffix(artifactNode.id)
  );
  logs.push(startedLog);
  progressTask = await emitTaskProgress({
    onProgress: input.onProgress,
    task: progressTask,
    updatedAt: input.createdAt,
    executionLogs: [startedLog],
    state: 'running',
    currentRunStatus: 'running'
  });

  let toolResult: DesktopToolInvocationResult;
  try {
    toolResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: toolRequest.toolId,
      action: toolRequest.action,
      input: toolRequest.input,
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
  } catch (error) {
    toolResult = {
      toolId: toolRequest.toolId,
      action: toolRequest.action,
      ok: false,
      message: error instanceof Error ? error.message : 'Workflow artifact writer failed.'
    };
  }

  if (!toolResult.ok) {
    const failedLog = createLog(
      input.task.taskId,
      'warning',
      'WORKFLOW_ARTIFACT_FALLBACK_FAILED',
      toolResult.message ?? `Workflow artifact writer failed: ${toolRequest.toolId}/${toolRequest.action}.`,
      input.createdAt,
      sanitizeLogSuffix(artifactNode.id)
    );
    logs.push(failedLog);
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: input.createdAt,
      executionLogs: [failedLog],
      state: 'running',
      currentRunStatus: 'running'
    });
    return {
      logs,
      usedToolIds,
      generatedArtifacts,
      progressTask
    };
  }

  usedToolIds.push(toolRequest.toolId);
  const generatedArtifact = buildGeneratedArtifactFromToolResult({
    taskId: input.task.taskId,
    toolId: toolRequest.toolId,
    action: toolRequest.action,
    output: toolResult.output,
    createdAt: input.createdAt,
    sequence: input.existingGeneratedArtifacts.length + 1
  });
  if (generatedArtifact) {
    generatedArtifacts.push(generatedArtifact);
  }

  const completedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_ARTIFACT_FALLBACK_CREATED',
    generatedArtifact?.localPath
      ? `Workflow artifact file was created: ${generatedArtifact.localPath}.`
      : `Workflow artifact writer completed: ${toolRequest.toolId}/${toolRequest.action}.`,
    input.createdAt,
    sanitizeLogSuffix(artifactNode.id)
  );
  logs.push(completedLog);
  progressTask = await emitTaskProgress({
    onProgress: input.onProgress,
    task: progressTask,
    updatedAt: input.createdAt,
    executionLogs: [completedLog],
    artifacts: generatedArtifact ? [...progressTask.artifacts, generatedArtifact] : progressTask.artifacts,
    state: 'running',
    currentRunStatus: 'running'
  });

  return {
    logs,
    usedToolIds,
    generatedArtifacts,
    progressTask
  };
}

function buildWorkflowFallbackArtifactToolRequest(input: {
  task: DesktopTaskDetail;
  artifactNode: WorkflowExecutionNodeSummary;
  payload: WorkflowArtifactPayload;
  availableToolIds: Set<string>;
}): { toolId: string; action: DesktopToolInvocationAction; input: Record<string, unknown> } | undefined {
  const title = input.payload.title || `${input.task.title} - ${input.artifactNode.name}`;
  const fileName = input.payload.fileName || buildWorkflowArtifactFileName(input.task.title, input.artifactNode.name);
  const content = input.payload.content.trim() || '任务已完成，但模型没有返回可写入的正文。';

  if (input.artifactNode.artifactType === 'pptx' && input.availableToolIds.has('office-document')) {
    return {
      toolId: 'office-document',
      action: 'presentation.write_pptx',
      input: {
        title,
        folder: 'presentations',
        fileName,
        content
      }
    };
  }

  if (input.artifactNode.artifactType === 'xlsx' && input.availableToolIds.has('office-document')) {
    return {
      toolId: 'office-document',
      action: 'spreadsheet.write_xlsx',
      input: {
        title,
        folder: 'spreadsheets',
        fileName,
        content
      }
    };
  }

  if (input.artifactNode.artifactType === 'csv' && input.availableToolIds.has('office-document')) {
    return {
      toolId: 'office-document',
      action: 'spreadsheet.write_csv',
      input: {
        folder: 'spreadsheets',
        fileName,
        rows: [['标题', '内容'], [input.task.title, content]]
      }
    };
  }

  if (input.artifactNode.artifactType === 'docx' && input.availableToolIds.has('office-document')) {
    return {
      toolId: 'office-document',
      action: 'office.write_docx_document',
      input: {
        title,
        folder: 'documents',
        fileName,
        content
      }
    };
  }

  if (
    input.artifactNode.artifactType === 'markdown' &&
    input.availableToolIds.has('office-document')
  ) {
    return {
      toolId: 'office-document',
      action: 'office.write_markdown_document',
      input: {
        title,
        folder: 'documents',
        fileName,
        content
      }
    };
  }

  if (input.artifactNode.artifactType === 'markdown' && input.availableToolIds.has('local-filesystem')) {
    return {
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'reports',
        fileName,
        content
      }
    };
  }

  if (input.artifactNode.artifactType === 'mp4' && input.availableToolIds.has('video-processing')) {
    const videoPath = findFirstVideoAttachmentPath(input.task.executionContext?.attachmentPaths ?? []);
    const cutPlan = readWorkflowArtifactCutPlan(content);
    if (!videoPath || cutPlan.length === 0) {
      return undefined;
    }

    return {
      toolId: 'video-processing',
      action: 'video.compose_clips',
      input: {
        videoPath,
        cutPlan,
        folder: 'videos',
        fileName
      }
    };
  }

  return undefined;
}

function normalizeWorkflowArtifactToolRequest(input: {
  task: DesktopTaskDetail;
  artifactNode: WorkflowExecutionNodeSummary;
  payload: WorkflowArtifactPayload;
  request: { toolId: string; action: DesktopToolInvocationAction; input: Record<string, unknown> } | undefined;
}): { toolId: string; action: DesktopToolInvocationAction; input: Record<string, unknown> } | undefined {
  if (!input.request) {
    return undefined;
  }

  const requestInput = { ...input.request.input };
  const existingFolder = readWorkflowRuntimeString(requestInput.folder);
  if (!existingFolder) {
    requestInput.folder = defaultWorkflowArtifactFolder(input.artifactNode.artifactType);
  }

  const existingContent = readWorkflowRuntimeString(requestInput.content);
  if (existingContent || input.payload.content) {
    requestInput.content = normalizeWorkflowArtifactContent(
      existingContent ?? input.payload.content,
      input.task,
      workflowExecutionSummaryToGraphNode(input.artifactNode)
    );
  }

  const existingTitle = readWorkflowRuntimeString(requestInput.title);
  if (!existingTitle || isWorkflowTaskDerivedLabel(existingTitle, input.task.title)) {
    requestInput.title = input.payload.title ?? existingTitle ?? input.task.title;
  }

  const existingFileName = stripWorkflowArtifactExtension(readWorkflowRuntimeString(requestInput.fileName));
  if (!existingFileName || isWorkflowTaskDerivedLabel(existingFileName, input.task.title)) {
    requestInput.fileName =
      input.payload.fileName ?? existingFileName ?? buildWorkflowArtifactFileName(input.task.title, input.artifactNode.name);
  } else {
    requestInput.fileName = existingFileName;
  }

  return {
    ...input.request,
    input: requestInput
  };
}

function isWorkflowArtifactToolRequestCompatible(
  artifactType: WorkflowExecutionNodeSummary['artifactType'],
  request: { toolId: string; action: DesktopToolInvocationAction }
): boolean {
  if (!artifactType) {
    return true;
  }

  return workflowArtifactTypeForToolRequest(request) === artifactType;
}

function workflowArtifactTypeForToolRequest(
  request: { toolId: string; action: DesktopToolInvocationAction }
): WorkflowExecutionNodeSummary['artifactType'] | undefined {
  if (request.toolId === 'office-document' && request.action === 'office.write_docx_document') return 'docx';
  if (request.toolId === 'office-document' && request.action === 'office.write_markdown_document') return 'markdown';
  if (request.toolId === 'office-document' && request.action === 'spreadsheet.write_xlsx') return 'xlsx';
  if (request.toolId === 'office-document' && request.action === 'spreadsheet.write_csv') return 'csv';
  if (request.toolId === 'office-document' && request.action === 'presentation.write_pptx') return 'pptx';
  if (request.toolId === 'local-filesystem' && request.action === 'filesystem.write_text_file') return 'markdown';
  if (request.toolId === 'video-processing' && ['video.compose_clips', 'video.export_mp4'].includes(request.action)) {
    return 'mp4';
  }
  return undefined;
}

function defaultWorkflowArtifactFolder(
  artifactType: WorkflowExecutionNodeSummary['artifactType']
): string {
  if (artifactType === 'xlsx' || artifactType === 'csv') return 'spreadsheets';
  if (artifactType === 'pptx') return 'presentations';
  if (artifactType === 'mp4') return 'videos';
  return 'documents';
}

function isWorkflowTaskDerivedLabel(value: string, taskTitle: string): boolean {
  return areWorkflowTitleLinesEquivalent(value, taskTitle) || normalizeWorkflowTitleLine(value).startsWith('word-');
}

function workflowExecutionSummaryToGraphNode(node: WorkflowExecutionNodeSummary): WorkflowGraphNode {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    instruction: node.instruction,
    toolId: node.toolIds[0],
    artifactType: node.artifactType,
    requiresApproval: node.requiresApproval
  };
}

function findFirstVideoAttachmentPath(paths: string[]): string | undefined {
  return paths.find((attachmentPath) => {
    const extension = attachmentPath.split('.').at(-1)?.trim().toLowerCase();
    return ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(extension ?? '');
  });
}

function readWorkflowArtifactCutPlan(content: string): Array<{ start: number; end: number }> {
  const parsed = parseWorkflowRuntimeJson(content);
  const candidate = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>).cut_plan ??
        (parsed as Record<string, unknown>).cutPlan ??
        (parsed as Record<string, unknown>).segments
      : undefined;

  if (!Array.isArray(candidate)) {
    return [];
  }

  return candidate.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const start = readWorkflowRuntimeSeconds(record.start);
    const end = readWorkflowRuntimeSeconds(record.end);
    return start !== undefined && end !== undefined && end > start ? [{ start, end }] : [];
  });
}

function readWorkflowRuntimeSeconds(value: unknown): number | undefined {
  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue * 1000) / 1000 : undefined;
}

function buildWorkflowArtifactFileName(taskTitle: string, nodeName: string): string {
  const baseName = `${taskTitle}-${nodeName}`
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return baseName || 'workflow-artifact';
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
  const artifactType = inferGeneratedArtifactType(localPath);

  return {
    id: `${input.taskId}-tool-artifact-${input.sequence}-${Date.parse(input.createdAt) || Date.now()}`,
    type: artifactType,
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

function inferGeneratedArtifactType(localPath: string): DesktopArtifactSummary['type'] {
  const extension = localPath.split('.').at(-1)?.trim().toLowerCase();
  if (['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'].includes(extension ?? '')) {
    return 'video';
  }

  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension ?? '')) {
    return 'image';
  }

  return 'file';
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
  attachmentContext = '',
  workflowPlan: WorkflowExecutionPlan
): DesktopModelChatMessage[] {
  const tools = binding.availableTools.map((tool) => `${tool.name} (${tool.capabilities.join(', ')})`);
  const toolInstructions = buildToolInstructions(binding.availableTools);
  const workflowToolInstructions = buildWorkflowToolExecutionInstructions(workflowPlan, binding.availableTools);
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
        workflowToolInstructions
          ? `Workflow tool execution rules:\n${workflowToolInstructions}`
          : '',
        verificationToolInstruction,
        workflowPlan.promptContext
          ? 'Follow the workflow graph execution path provided in the user message.'
          : '',
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
        `Workflow plan:\n${workflowPlan.promptContext || 'none'}`,
        `Knowledge context:\n${knowledgeContext || 'none'}`,
        `Missing knowledge bindings: ${binding.missingKnowledgeBindingIds.join(', ') || 'none'}`
      ].join('\n')
    }
  ];
}

function buildWorkflowToolExecutionInstructions(
  workflowPlan: WorkflowExecutionPlan,
  availableTools: ToolManifest[]
): string {
  if (!workflowPlan.enabled) {
    return '';
  }

  const availableToolIds = new Set(availableTools.map((tool) => tool.id));
  const lines: string[] = [];

  for (const node of getRunnableWorkflowNodes(workflowPlan)) {
    const enabledToolIds = node.toolIds.filter((toolId) => availableToolIds.has(toolId));
    if (enabledToolIds.length > 0) {
      lines.push(
        `- Node "${node.name}" requires enabled tool(s): ${enabledToolIds.join(', ')}. Request the matching ${toolCallMarker} tool call before finalizing that node, unless the task input makes the tool clearly unnecessary; if skipped, explain why.`
      );
    }

    if (node.artifactType) {
      const actionHint = buildArtifactToolActionHint(node.artifactType, availableTools);
      lines.push(
        actionHint
          ? `- Node "${node.name}" expects ${node.artifactType}. Prefer ${actionHint} and include the generated local path in the final answer.`
          : `- Node "${node.name}" expects ${node.artifactType}. If no matching writer tool is enabled, return structured content that can be copied into that format.`
      );
    }
  }

  return lines.join('\n');
}

function buildArtifactToolActionHint(
  artifactType: WorkflowExecutionNodeSummary['artifactType'],
  availableTools: ToolManifest[]
): string | undefined {
  if (!artifactType) {
    return undefined;
  }

  const hasAction = (toolId: string, action: DesktopToolInvocationAction) => {
    const tool = availableTools.find((item) => item.id === toolId);
    return tool ? isToolActionEnabledForManifest(tool, action) : false;
  };

  if (artifactType === 'pptx' && hasAction('office-document', 'presentation.write_pptx')) {
    return 'office-document/presentation.write_pptx';
  }

  if (artifactType === 'xlsx' && hasAction('office-document', 'spreadsheet.write_xlsx')) {
    return 'office-document/spreadsheet.write_xlsx';
  }

  if (artifactType === 'csv' && hasAction('office-document', 'spreadsheet.write_csv')) {
    return 'office-document/spreadsheet.write_csv';
  }

  if (artifactType === 'docx' && hasAction('office-document', 'office.write_docx_document')) {
    return 'office-document/office.write_docx_document';
  }

  if (artifactType === 'markdown' && hasAction('office-document', 'office.write_markdown_document')) {
    return 'office-document/office.write_markdown_document';
  }

  if (artifactType === 'markdown' && hasAction('local-filesystem', 'filesystem.write_text_file')) {
    return 'local-filesystem/filesystem.write_text_file';
  }

  if (artifactType === 'mp4' && hasAction('video-processing', 'video.compose_clips')) {
    return 'video-processing/video.compose_clips';
  }

  return undefined;
}

function buildToolInstructions(tools: ToolManifest[]): string {
  return tools
    .flatMap((tool) => {
      return (tool.actions ?? []).map((action) => {
        const inputTypes = action.inputTypes?.length ? ` inputTypes=${action.inputTypes.join('|')}` : '';
        const outputTypes = action.outputTypes?.length ? ` outputTypes=${action.outputTypes.join('|')}` : '';
        return `- ${tool.id}/${action.action}${inputTypes}${outputTypes}`;
      });
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

function isToolActionEnabledForManifest(tool: ToolManifest, action: DesktopToolInvocationAction): boolean {
  return Boolean(tool.actions?.some((item) => item.action === action));
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
  response: DesktopModelChatResponse,
  workflowPlan: WorkflowExecutionPlan,
  usedToolIds: string[],
  workflowRuntimeTraces: WorkflowNodeExecutionTrace[] = [],
  workflowRuntimeVariables: WorkflowRuntimeVariableSnapshot[] = []
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
  const workflowNodes = workflowRuntimeTraces.length > 0
    ? workflowRuntimeTraces.map(formatWorkflowExecutedNodeReportLine).join('\n')
    : workflowPlan.enabled
      ? getRunnableWorkflowNodes(workflowPlan)
          .map((node, index) => formatWorkflowNodeReportLine(node, index, usedToolIds))
          .join('\n')
      : 'No workflow graph used';
  const workflowRuntimeTrace = formatWorkflowTraceForReport(workflowRuntimeTraces);
  const workflowRuntimeVariablesText =
    workflowRuntimeVariables.length > 0
      ? workflowRuntimeVariables
          .map((variable) => `- ${variable.name} (${variable.valueType}): ${variable.preview}`)
          .join('\n')
      : 'No runtime variable snapshot';

  return [
    `Task: ${task.title}`,
    `Role: ${task.roleName}`,
    `Input: ${task.input}`,
    `Attached files: ${attachmentPaths}`,
    `Models: ${models}`,
    `Configured model connections: ${configuredModelCount}/${binding.modelProfiles.length}`,
    `Tools: ${tools}`,
    `Knowledge sources: ${knowledgeSources}`,
    `Workflow graph: ${workflowPlan.enabled ? 'enabled' : 'none'}`,
    `Workflow nodes:\n${workflowNodes || 'No executable workflow nodes'}`,
    `Workflow runtime trace:\n${workflowRuntimeTrace}`,
    `Workflow runtime variables:\n${workflowRuntimeVariablesText}`,
    `Missing knowledge bindings: ${binding.missingKnowledgeBindingIds.length}`,
    `Unconfigured knowledge bindings: ${binding.unconfiguredKnowledgeBindingIds.length}`,
    '',
    'Model output:',
    response.content
  ].join('\n');
}

function formatWorkflowNodeReportLine(
  node: WorkflowExecutionNodeSummary,
  index: number,
  usedToolIds: string[]
): string {
  const usedToolIdSet = new Set(usedToolIds);
  const missingToolIds = node.toolIds.filter((toolId) => !usedToolIdSet.has(toolId));
  const metadata = [
    node.toolIds.length > 0 ? `tools=${node.toolIds.join(',')}` : undefined,
    missingToolIds.length > 0 ? `tools_not_used=${missingToolIds.join(',')}` : undefined,
    node.artifactType ? `artifact=${node.artifactType}` : undefined,
    node.requiresApproval ? 'approval=required' : undefined
  ].filter(Boolean);

  return `${index + 1}. ${node.name} (${node.type}) - completed${
    metadata.length > 0 ? ` [${metadata.join('; ')}]` : ''
  }`;
}

function formatWorkflowExecutedNodeReportLine(trace: WorkflowNodeExecutionTrace, index: number): string {
  const metadata = [
    trace.modelProfileId ? `model=${trace.modelProfileId}` : undefined,
    trace.toolId ? `tool=${trace.toolId}` : undefined,
    trace.artifactType ? `artifact=${trace.artifactType}` : undefined,
    trace.artifactPath ? `file=${trace.artifactPath}` : undefined
  ].filter(Boolean);

  return `${index + 1}. ${trace.nodeName} (${trace.nodeType}) - ${trace.status}${
    metadata.length > 0 ? ` [${metadata.join('; ')}]` : ''
  }`;
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

function buildWorkflowRuntimeNodeLogDetails(input: {
  node: WorkflowGraphNode;
  status: WorkflowRuntimeNodeStatus;
  pool: WorkflowVariablePool;
  inputVariables: string[];
  outputVariables: string[];
  message?: string;
  artifactPath?: string;
}): Record<string, unknown> {
  return {
    workflowNode: {
      id: input.node.id,
      type: input.node.type,
      name: input.node.name,
      status: input.status,
      message: input.message,
      modelProfileId: input.node.modelProfileId,
      toolId: input.node.toolId,
      artifactType: input.node.artifactType,
      artifactPath: input.artifactPath,
      inputs: snapshotWorkflowRuntimeRefs(
        input.pool,
        input.inputVariables.length > 0 ? input.inputVariables : getWorkflowRuntimeDefaultInputRefs(input.node)
      ),
      outputs: snapshotWorkflowRuntimeRefs(input.pool, input.outputVariables)
    }
  };
}

function snapshotWorkflowRuntimeRefs(
  pool: WorkflowVariablePool,
  refs: string[]
): WorkflowRuntimeVariableSnapshot[] {
  return [...new Set(refs.map((ref) => ref.trim()).filter(Boolean))]
    .slice(0, 12)
    .map((ref) => {
      const value = pool.get(ref);
      if (value === undefined) {
        return {
          name: ref,
          valueType: 'missing',
          preview: 'No value resolved.'
        };
      }

      return {
        name: ref,
        valueType: getWorkflowRuntimeValueType(value),
        preview: previewWorkflowRuntimeValue(value, 220)
      };
    });
}

function getWorkflowRuntimeDefaultInputRefs(node: WorkflowGraphNode): string[] {
  if (node.type === 'start' || node.type === 'input') {
    return ['start.text', 'start.files'];
  }

  return [];
}

function createLog(
  taskId: string,
  level: DesktopExecutionLogEntry['level'],
  eventType: string,
  message: string,
  createdAt: string,
  suffix?: string,
  details?: Record<string, unknown>
): DesktopExecutionLogEntry {
  const suffixPart = suffix ? `-${suffix}` : '';
  return {
    id: `${taskId}-log-${eventType.toLowerCase()}${suffixPart}-${Date.parse(createdAt) || Date.now()}`,
    level,
    eventType,
    message,
    createdAt,
    details
  };
}

function sanitizeLogSuffix(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
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
