import type {
  DesktopArtifactSummary,
  DesktopExecutionLogEntry,
  FactoryArtifactPreviewItem,
  FactoryOutputItem,
  FactoryOutputItemStatus,
  DesktopKnowledgeSourceSummary,
  DesktopTaskDetail,
  ModelCredential,
  ModelProfile,
  RoleModelCredentialBinding,
  RolePackageManifest,
  ToolManifest
} from './desktop-contract.js';
import { normalizeKnowledgeBindingId } from './knowledge-bindings.js';
import { resolveModelProfileCredential } from './desktop-model-credentials.js';
import {
  modelProfileSupportsRequiredCapabilities,
  readModelProfileCapabilities
} from './desktop-model-capabilities.js';
import { readRequiredModelProfileIdsForRolePackage } from './desktop-role-requirements.js';
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

interface FactoryRuntimeItem {
  sku: string;
  image: WorkflowFileValue;
  sourceName?: string;
  order: number;
}

interface FactoryRuntimePackage {
  key: string;
  label: string;
  description?: string;
}

interface FactoryRuntimePlatform {
  key?: string;
  label?: string;
  imageRatio?: string;
  notes?: string;
}

interface FactoryRuntimePackageInstruction {
  sku?: string;
  packageKey?: string;
  prompt: string;
  negativePrompt?: string;
  referenceImagePath?: string;
}

interface FactoryImageGenerationTask {
  id: string;
  order: number;
  sku: string;
  sourceName?: string;
  sourceImage: WorkflowFileValue;
  packageKey: string;
  packageLabel: string;
  packageDescription?: string;
  prompt: string;
  negativePrompt?: string;
  targetPlatform: FactoryRuntimePlatform;
  createdAt: string;
}

type FactoryImageGenerationResult = FactoryArtifactPreviewItem;

interface FactoryVideoScreeningRule {
  metric: string;
  operator: '>=' | '<=' | '>' | '<' | 'equals' | 'notEquals' | 'between';
  value: unknown;
  failReason: string;
}

interface FactoryVideoScreeningGate {
  id: string;
  name: string;
  rules: FactoryVideoScreeningRule[];
}

interface FactoryVideoRuntimeItem {
  id: string;
  order: number;
  name: string;
  localPath: string;
  size?: number;
  type?: string;
}

interface FactoryVideoScreeningResult {
  id: string;
  order: number;
  name: string;
  localPath: string;
  status: 'rejected' | 'scored' | 'edited' | 'review_required' | 'processing_error';
  rejectedGate?: string;
  rejectedReason?: string;
  score?: number;
  grade?: 'A' | 'B' | 'C' | 'D';
  shouldEdit: boolean;
  transcript?: string;
  summary?: string;
  risks: string[];
  metrics: Record<string, unknown>;
  editPlan?: Array<{ start: number; end: number; label?: string; reason?: string }>;
  editedVideoPath?: string;
}

interface FactoryVideoAsrAttemptResult {
  transcript: string;
  audioPath: string;
  attempts: number;
  error?: unknown;
}

interface FactoryVideoPreparedAudioResult {
  audioPath?: string;
  error?: string;
  risks: string[];
}

interface ModelInvocationSuccess {
  ok: true;
  profile: ModelProfile;
  response: DesktopModelChatResponse;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  factoryOutputs?: FactoryOutputItem[];
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
const maxKnowledgeSourceSummaryChars = 20_000;
type WorkflowRuntimeModelOutputMode = 'text' | 'json';
const supportedToolActions: DesktopToolInvocationAction[] = [
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
    roleModelCredentialBindings: input.roleModelCredentialBindings,
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
    modelProfileIds: readRequiredModelProfileIdsForRolePackage(rolePackage),
    toolIds: [...rolePackage.toolIds],
    knowledgeBindingIds: rolePackage.requiredKnowledgeSources.map((source) => normalizeKnowledgeBindingId(source))
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
  const enabledKnowledgeIds = new Set(input.enabledKnowledgeBindingIds.map(normalizeKnowledgeBindingId));
  const modelProfilesById = new Map(input.modelProfiles.map((profile) => [profile.id, profile]));
  const toolsById = new Map(input.tools.map((tool) => [tool.id, tool]));
  const knowledgeSourcesById = new Map(
    input.knowledgeSources.map((source) => [normalizeKnowledgeBindingId(source.id), source])
  );
  const requiredKnowledgeBindingIds = mergeUniqueStrings(
    input.context.knowledgeBindingIds.map(normalizeKnowledgeBindingId)
  );

  const requiredModelProfileIds = mergeUniqueStrings(
    input.context.modelProfileIds.map(normalizeRuntimeRequirementModelProfileId)
  );
  const candidateModelProfileIds = mergeUniqueStrings([
    ...requiredModelProfileIds,
    ...input.enabledModelProfileIds
  ]);
  const modelProfiles = candidateModelProfileIds.flatMap((profileId) => {
    const profile = modelProfilesById.get(profileId);
    return profile && enabledModelIds.has(profileId) ? [profile] : [];
  });
  const missingModelProfileIds = requiredModelProfileIds.filter(
    (profileId) => !modelProfilesById.has(profileId) || !enabledModelIds.has(profileId)
  );
  const availableTools = input.context.toolIds.flatMap((toolId) => {
    const tool = toolsById.get(toolId);
    return tool && enabledToolIds.has(toolId) ? [tool] : [];
  });
  const missingToolIds = input.context.toolIds.filter((toolId) => !enabledToolIds.has(toolId));
  const missingKnowledgeBindingIds = requiredKnowledgeBindingIds.filter(
    (bindingId) => !enabledKnowledgeIds.has(bindingId)
  );
  const availableKnowledgeSources = requiredKnowledgeBindingIds.flatMap((bindingId) => {
    const source = knowledgeSourcesById.get(bindingId);
    return source && source.enabled && enabledKnowledgeIds.has(bindingId) ? [source] : [];
  });
  const unconfiguredKnowledgeBindingIds = requiredKnowledgeBindingIds.filter(
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
    factoryOutputs: invocation.factoryOutputs ?? task.factoryOutputs,
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
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  const factoryOutputs: FactoryOutputItem[] = [];
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
        roleModelCredentialBindings: input.roleModelCredentialBindings,
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
      if (nodeResult.factoryOutputs?.length) {
        factoryOutputs.push(...nodeResult.factoryOutputs);
      }

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
    factoryOutputs,
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
  const sourceFiles = readWorkflowRuntimeFiles(input.pool.get('start.files')).slice(0, maxAttachmentContextFiles);
  const files = sourceFiles.filter(isWorkflowRuntimeTextExtractableFile);
  if (sourceFiles.length === 0 || files.length === 0) {
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
  const extractedFilesById = new Map<string, WorkflowFileValue>();

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
        extractedFilesById.set(file.id, file);
        continue;
      }

      const extractedText = readToolTextOutput(result.output);
      extractedFilesById.set(file.id, {
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
      extractedFilesById.set(file.id, file);
    }
  }

  const mergedFiles = [
    ...sourceFiles.map((file) => extractedFilesById.get(file.id) ?? file),
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
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  factoryOutputs?: FactoryOutputItem[];
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
  factoryOutputs?: FactoryOutputItem[];
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
  factoryOutputs?: FactoryOutputItem[];
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
  const officeExtensions = new Set(['txt', 'md', 'markdown', 'csv', 'json', 'docx', 'pptx', 'xlsx', 'pdf']);

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
  const resultObject = readWorkflowRuntimeObjectValue(result);
  const outputValue =
    resultObject && Object.prototype.hasOwnProperty.call(resultObject, outputVariable)
      ? resultObject[outputVariable]
      : result;
  const text = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  const outputVariables = new Set<string>();

  input.pool.set(outputVariable, outputValue as WorkflowRuntimeValue);
  outputVariables.add(outputVariable);
  if (resultObject) {
    for (const outputRef of input.node.outputVariables ?? []) {
      const normalizedOutputRef = outputRef.trim();
      if (!normalizedOutputRef) {
        continue;
      }

      const leafKey = normalizedOutputRef.split('.').map((part) => part.trim()).filter(Boolean).at(-1);
      const value =
        Object.prototype.hasOwnProperty.call(resultObject, normalizedOutputRef)
          ? resultObject[normalizedOutputRef]
          : leafKey && Object.prototype.hasOwnProperty.call(resultObject, leafKey)
            ? resultObject[leafKey]
            : undefined;
      if (value === undefined) {
        continue;
      }

      input.pool.set(normalizedOutputRef, value as WorkflowRuntimeValue);
      outputVariables.add(normalizedOutputRef);
      if (!normalizedOutputRef.includes('.')) {
        input.pool.set(`${input.node.id}.${normalizedOutputRef}`, value as WorkflowRuntimeValue);
        outputVariables.add(`${input.node.id}.${normalizedOutputRef}`);
      }
    }
  }
  input.pool.set(`${input.node.id}.text`, text);
  outputVariables.add(`${input.node.id}.text`);
  input.pool.set(`${input.node.id}.json`, result as WorkflowRuntimeValue);
  outputVariables.add(`${input.node.id}.json`);
  input.pool.set(`${input.node.id}.result`, result as WorkflowRuntimeValue);
  outputVariables.add(`${input.node.id}.result`);
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
    outputVariables: [...outputVariables],
    message: `Code transform completed with ${variables.length} input variable(s), timeout=${timeoutMs}ms.`
  });
}

function readWorkflowRuntimeObjectValue(value: WorkflowRuntimeValue): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
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
    if (input[variable.ref] === undefined) {
      input[variable.ref] = variable.value;
    }
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
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  const profile = selectWorkflowRuntimeModelProfile(
    input.node,
    input.profiles,
    input.rolePackage,
    input.task.roleCode,
    input.roleModelCredentialBindings
  );
  if (input.node.type === 'output') {
    const factoryOutputResult = completeWorkflowRuntimeFactoryVideoOutputNode(input);
    if (factoryOutputResult) {
      return factoryOutputResult;
    }
  }

  if (readWorkflowRuntimeString(input.node.config?.llmTaskType) === 'video_screening_batch') {
    const videoFactoryResult = await invokeWorkflowRuntimeFactoryVideoScreeningNode({
      ...input,
      profile
    });
    if (videoFactoryResult) {
      return videoFactoryResult;
    }
  }

  if (['image_generation', 'image_editing'].includes(readWorkflowRuntimeString(input.node.config?.llmTaskType) ?? '')) {
    const factoryResult = await invokeWorkflowRuntimeFactoryImageGenerationNode({
      ...input,
      profile
    });
    if (factoryResult) {
      return factoryResult;
    }
  }

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

async function invokeWorkflowRuntimeFactoryVideoScreeningNode(input: {
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
  profile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  factoryOutputs?: FactoryOutputItem[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
} | undefined> {
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'medical_case_video_screening_factory') {
    return undefined;
  }

  const videos = readFactoryVideoRuntimeItems(factoryRequest, input.pool.get('start.files'));
  if (videos.length === 0) {
    return undefined;
  }

  const gates = readFactoryVideoScreeningGates(factoryRequest);
  const asrProfile = selectFactoryAsrProfile(input.profiles, factoryRequest);
  const editEnabled = readFactoryRuntimeBoolean(factoryRequest?.editEnabled);
  const editTargetSeconds = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(factoryRequest?.editTargetSeconds),
    30,
    10,
    90
  );
  const concurrency = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.concurrency ?? factoryRequest?.concurrency),
    3,
    1,
    8
  );
  const editOutputFolder = `video-cuts-${buildWorkflowArtifactFileName(input.task.title, '初剪视频合集')}`;
  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_VIDEO_FACTORY_STARTED',
    `Video screening factory started: ${videos.length} video(s), concurrency=${concurrency}.`,
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  const results = await runWorkflowRuntimeConcurrent(videos, concurrency, (video) =>
    runFactoryVideoScreeningItem({
      task: input.task,
      video,
      gates,
      asrProfile,
      scoringProfile: input.profile,
      modelInvoker: input.modelInvoker,
      desktopToolInvoker: input.desktopToolInvoker,
      workspaceId: input.workspaceId,
      binding: input.binding,
      factoryRequest,
      editEnabled,
      editTargetSeconds,
      editOutputFolder,
      createdAt: input.createdAt
    })
  );
  const rejected = results.filter((item) => item.status === 'rejected').length;
  const processingError = results.filter((item) => item.status === 'processing_error').length;
  const edited = results.filter((item) => item.status === 'edited').length;
  const scored = results.filter((item) => item.status === 'scored' || item.status === 'edited').length;
  const reviewRequired = results.filter((item) => item.status === 'review_required').length;
  const qualifiedResults = results.filter(isQualifiedFactoryVideoResult);
  const editedResults = results.filter((item) => item.editedVideoPath);
  const editedVideoFolderPath = readCommonPathDirectory(editedResults.map((item) => item.editedVideoPath));
  const rows = buildFactoryVideoScreeningRows(results);
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  const usedToolIds = new Set<string>();
  const extraLogs: DesktopExecutionLogEntry[] = [];
  if (hasFactoryToolAction(input.binding, 'video-processing', 'video.probe')) {
    usedToolIds.add('video-processing');
  }
  if (input.desktopToolInvoker && input.workspaceId && hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.write_text_file')) {
    const qualifiedListResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'qualified-videos',
        fileName: buildWorkflowArtifactFileName(input.task.title, '合格视频地址清单'),
        content: buildFactoryQualifiedVideoAddressListContent({
          taskTitle: input.task.title,
          results,
          qualifiedResults,
          editedVideoFolderPath,
          editEnabled,
          createdAt: input.createdAt
        })
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (qualifiedListResult.ok) {
      const artifact = buildGeneratedArtifactFromToolResult({
        taskId: input.task.taskId,
        toolId: 'local-filesystem',
        action: 'filesystem.write_text_file',
        output: qualifiedListResult.output,
        createdAt: input.createdAt,
        sequence: 1
      });
      if (artifact) {
        generatedArtifacts.push({
          ...artifact,
          title: '合格视频地址清单.md'
        });
      }
    } else {
      extraLogs.push(
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_VIDEO_FACTORY_QUALIFIED_LIST_FAILED',
          `Qualified video address list could not be written: ${qualifiedListResult.message ?? 'unknown error'}.`,
          input.createdAt,
          sanitizeLogSuffix(`${input.node.id}-qualified-list`)
        )
      );
    }
  }
  if (!hasFactoryToolAction(input.binding, 'office-document', 'spreadsheet.write_xlsx')) {
    extraLogs.push(
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_VIDEO_FACTORY_XLSX_UNAVAILABLE',
        'Screening spreadsheet was not written because office-document/spreadsheet.write_xlsx is not available in the current desktop tool binding.',
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-xlsx-unavailable`)
      )
    );
  } else if (input.desktopToolInvoker && input.workspaceId) {
    const toolResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'office-document',
      action: 'spreadsheet.write_xlsx',
      input: {
        title: '视频筛选评分结果',
        folder: 'spreadsheets',
        fileName: `${buildWorkflowArtifactFileName(input.task.title, '筛选评分结果')}`,
        sheets: [
          {
            name: '筛选评分',
            rows
          }
        ]
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('office-document');
    if (toolResult.ok) {
      const artifact = buildGeneratedArtifactFromToolResult({
        taskId: input.task.taskId,
        toolId: 'office-document',
        action: 'spreadsheet.write_xlsx',
        output: toolResult.output,
        createdAt: input.createdAt,
        sequence: 2
      });
      if (artifact) {
        generatedArtifacts.push(artifact);
      } else {
        extraLogs.push(
          createLog(
            input.task.taskId,
            'warning',
            'WORKFLOW_RUNTIME_VIDEO_FACTORY_XLSX_ARTIFACT_MISSING',
            'Screening spreadsheet tool completed but did not return a local file path.',
            input.createdAt,
            sanitizeLogSuffix(`${input.node.id}-xlsx-artifact-missing`)
          )
        );
      }
    } else {
      extraLogs.push(
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_VIDEO_FACTORY_XLSX_FAILED',
          `Screening spreadsheet could not be written: ${toolResult.message ?? 'unknown error'}.`,
          input.createdAt,
          sanitizeLogSuffix(`${input.node.id}-xlsx-failed`)
        )
      );
    }
  } else {
    extraLogs.push(
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_VIDEO_FACTORY_XLSX_SKIPPED',
        'Screening spreadsheet was not written because the desktop tool runtime is unavailable.',
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-xlsx-skipped`)
      )
    );
  }
  if (editedResults.length > 0) {
    usedToolIds.add('video-processing');
    for (const [index, result] of editedResults.entries()) {
      generatedArtifacts.push({
        id: `${input.task.taskId}-edited-video-${index + 1}-${Date.parse(input.createdAt) || Date.now()}`,
        type: 'video',
        title: getPathFileName(result.editedVideoPath!) ?? `${result.name}-初剪视频.mp4`,
        content: `初剪视频：${result.editedVideoPath}`,
        localPath: result.editedVideoPath,
        createdAt: input.createdAt
      });
    }
  }
  const factoryOutputs = buildFactoryVideoOutputItems({
    taskId: input.task.taskId,
    factoryKind: 'medical_case_video_screening_factory',
    results,
    createdAt: input.createdAt
  });

  const summaryContent = [
    `视频筛选完成：共 ${results.length} 个视频`,
    `筛掉：${rejected}`,
    `合格视频：${qualifiedResults.length}`,
    `进入评分：${scored}`,
    `需人工复核：${reviewRequired}`,
    `处理异常：${processingError}`,
    `已生成初剪：${edited}`,
    editedVideoFolderPath ? `初剪视频文件夹：${editedVideoFolderPath}` : '',
    asrProfile
      ? `语音转文字：${asrProfile.providerName}/${asrProfile.modelName}`
      : '语音转文字：未配置，语音识别关卡会拦截视频'
  ].filter(Boolean).join('\n');
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: summaryContent,
    json: results,
    result: results,
    outputValue: results
  });
  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);
  input.pool.set('video_screening_results', results as unknown as WorkflowRuntimeValue);
  input.pool.set('screening_summary', summaryContent);
  input.pool.set('qualified_video_results', qualifiedResults as unknown as WorkflowRuntimeValue);
  input.pool.set('qualified_video_paths', qualifiedResults.map((item) => item.localPath) as unknown as WorkflowRuntimeValue);
  if (editedVideoFolderPath) {
    input.pool.set('edited_video_folder', editedVideoFolderPath);
  }

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.profile.providerName,
      modelName: input.profile.modelName,
      content: summaryContent
    }),
    primaryProfile: input.profile,
    logs: [
      startedLog,
      ...extraLogs,
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_VIDEO_FACTORY_COMPLETED',
        `Video screening factory completed: rejected=${rejected}, scored=${scored}, review=${reviewRequired}, error=${processingError}, edited=${edited}, total=${results.length}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-video-factory`),
        { rejected, scored, edited, reviewRequired, processingError, total: results.length }
      )
    ],
    usedToolIds: [...usedToolIds],
    generatedArtifacts,
    factoryOutputs,
    inputVariables: ['factory_request', 'start.files'],
    outputVariables: [
      ...new Set([
        ...outputVariables,
        'qualified_video_results',
        'qualified_video_paths',
        editedVideoFolderPath ? 'edited_video_folder' : ''
      ].filter(Boolean))
    ],
    message: `Video screening finished: rejected=${rejected}, scored=${scored}, review=${reviewRequired}, error=${processingError}, edited=${edited}.`
  };
}

function completeWorkflowRuntimeFactoryVideoOutputNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): {
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
} | undefined {
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'medical_case_video_screening_factory') {
    return undefined;
  }

  const summary = readWorkflowRuntimeString(input.pool.get('screening_summary'));
  const results = input.pool.get('video_screening_results');
  if (!summary || results === undefined) {
    return undefined;
  }

  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: summary,
    result: results,
    outputValue: summary
  });
  input.pool.set('runtime.previous_text', summary);

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.primaryProfile.providerName,
      modelName: input.primaryProfile.modelName,
      content: summary
    }),
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_FACTORY_OUTPUT_COMPLETED',
        'Video factory output returned without an extra model call.',
        input.createdAt,
        sanitizeLogSuffix(input.node.id)
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? ['screening_summary', 'video_screening_results'],
    outputVariables,
    message: 'Video factory output returned without an extra model call.'
  };
}

async function invokeWorkflowRuntimeFactoryImageGenerationNode(input: {
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
  profile: ModelProfile;
}): Promise<{
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
} | undefined> {
  const items = readFactoryRuntimeItems(input.pool.get('factory_items'));
  const packages = readFactoryRuntimePackages(input.pool.get('selected_packages'));
  if (items.length === 0 || packages.length === 0) {
    return undefined;
  }

  const targetPlatform = readFactoryRuntimePlatform(input.pool.get('target_platform'));
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  const packageInstructions = readFactoryRuntimePackageInstructions(input.pool.get('package_instructions'));
  const concurrency = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.concurrency ?? factoryRequest?.concurrency),
    8,
    1,
    16
  );
  const maxRetries = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.maxRetries ?? factoryRequest?.maxRetries),
    2,
    0,
    5
  );
  const batchTasks = createFactoryImageGenerationTasks({
    items,
    packages,
    targetPlatform,
    packageInstructions,
    createdAt: input.createdAt
  });

  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_FACTORY_BATCH_STARTED',
    `Factory image batch started: ${batchTasks.length} image task(s), concurrency=${concurrency}.`,
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  const results = await runWorkflowRuntimeConcurrent(batchTasks, concurrency, (task) =>
    runFactoryImageGenerationTask({
      task,
      node: input.node,
      profile: input.profile,
      modelInvoker: input.modelInvoker,
      maxRetries
    })
  );
  const completed = results.filter((item) => item.status === 'completed').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const generatedImages = results.map((item) => ({
    id: item.id,
    name: `${item.sku}-${item.packageLabel}`,
    kind: 'image',
    uri: item.localPath ? `local://${item.localPath}` : item.remoteUrl,
    mimeType: 'image/png',
    remoteUrl: item.remoteUrl,
    localPath: item.localPath,
    thumbnailPath: item.thumbnailPath,
    sourceImagePath: item.sourceImagePath,
    sku: item.sku,
    packageKey: item.packageKey,
    packageLabel: item.packageLabel,
    status: item.status,
    error: item.error
  }));
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: JSON.stringify(results, null, 2),
    json: results,
    result: results,
    outputValue: generatedImages
  });
  const summaryContent = [
    `数字工厂图片批次完成：${completed}/${batchTasks.length}`,
    failed > 0 ? `失败：${failed}` : '失败：0',
    `并发数：${concurrency}`,
    targetPlatform.label ? `平台：${targetPlatform.label}` : undefined
  ].filter(Boolean).join('\n');
  const preview = {
    kind: 'digital_factory_image_batch' as const,
    title: input.task.title,
    platformLabel: targetPlatform.label,
    concurrency,
    total: batchTasks.length,
    completed,
    failed,
    items: results
  };
  const artifact: DesktopArtifactSummary = {
    id: `${input.task.taskId}-factory-preview-${Date.parse(input.createdAt) || Date.now()}`,
    type: 'image',
    title: `${input.task.title} 图片结果`,
    content: summaryContent,
    createdAt: input.createdAt,
    remoteUrl: results.find((item) => item.remoteUrl)?.remoteUrl,
    localPath: results.find((item) => item.localPath)?.localPath,
    factoryPreview: preview
  };
  const completedLog = createLog(
    input.task.taskId,
    failed > 0 ? 'warning' : 'info',
    'WORKFLOW_RUNTIME_FACTORY_BATCH_COMPLETED',
    `Factory image batch completed: completed=${completed}, failed=${failed}, total=${batchTasks.length}.`,
    input.createdAt,
    sanitizeLogSuffix(`${input.node.id}-factory-batch`),
    {
      concurrency,
      completed,
      failed,
      total: batchTasks.length,
      failedItems: results.filter((item) => item.status === 'failed').map((item) => ({
        sku: item.sku,
        packageKey: item.packageKey,
        error: item.error
      }))
    }
  );

  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.profile.providerName,
      modelName: input.profile.modelName,
      content: summaryContent
    }),
    primaryProfile: input.profile,
    logs: [startedLog, completedLog],
    usedToolIds: [],
    generatedArtifacts: [artifact],
    inputVariables: ['factory_request', 'factory_items', 'selected_packages', 'target_platform', 'package_instructions'],
    outputVariables,
    message: `Factory image generation finished: ${completed}/${batchTasks.length}, concurrency=${concurrency}.`
  };
}

function readFactoryRuntimeItems(value: WorkflowRuntimeValue | undefined): FactoryRuntimeItem[] {
  const normalizedValue = readFactoryRuntimeJsonValue(value);
  const rawItems = Array.isArray(normalizedValue)
    ? normalizedValue
    : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.items)
      ? normalizedValue.items
      : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.files)
        ? normalizedValue.files
        : [];

  return rawItems.flatMap((item, index) => {
    const image = readFactoryRuntimeItemImage(item);
    if (!image) {
      return [];
    }

    const record = isWorkflowRuntimeRecord(item) ? item : {};
    const sku = readWorkflowRuntimeString(record.sku)
      ?? readWorkflowRuntimeString(record.code)
      ?? readWorkflowRuntimeString(record.id)
      ?? `SKU-${index + 1}`;
    const sourceName = readWorkflowRuntimeString(record.sourceName)
      ?? readWorkflowRuntimeString(record.name)
      ?? image.name;

    return [
      {
        sku,
        image,
        sourceName,
        order: index + 1
      }
    ];
  });
}

function readFactoryRuntimeItemImage(value: unknown): WorkflowFileValue | undefined {
  if (isWorkflowFileValue(value)) {
    return value;
  }

  if (!isWorkflowRuntimeRecord(value)) {
    return undefined;
  }

  const imageValue = value.image ?? value.file ?? value.sourceImage ?? value.referenceImage;
  if (isWorkflowFileValue(imageValue)) {
    return imageValue;
  }

  const localPath = readWorkflowRuntimeString(imageValue)
    ?? readWorkflowRuntimeString(value.localPath)
    ?? readWorkflowRuntimeString(value.path)
    ?? readWorkflowRuntimeString(value.filePath);
  if (!localPath) {
    return undefined;
  }

  const name = readWorkflowRuntimeString(value.name)
    ?? readWorkflowRuntimeString(value.sourceName)
    ?? getPathFileName(localPath)
    ?? 'source-image';

  return {
    id: readWorkflowRuntimeString(value.id) ?? `factory-image-${sanitizeLogSuffix(name)}`,
    name,
    kind: 'image',
    uri: localPath.startsWith('http://') || localPath.startsWith('https://') ? localPath : `local://${localPath}`,
    localPath,
    mimeType: readWorkflowRuntimeString(value.mimeType) ?? inferFactoryImageMimeType(name)
  };
}

function readFactoryRuntimePackages(value: WorkflowRuntimeValue | undefined): FactoryRuntimePackage[] {
  const normalizedValue = readFactoryRuntimeJsonValue(value);
  const rawPackages = Array.isArray(normalizedValue)
    ? normalizedValue
    : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.packages)
      ? normalizedValue.packages
      : [];
  const packages: FactoryRuntimePackage[] = [];
  const seenKeys = new Set<string>();

  for (const [index, item] of rawPackages.entries()) {
    const packageItem = readFactoryRuntimePackage(item, index);
    if (!packageItem || seenKeys.has(packageItem.key)) {
      continue;
    }

    seenKeys.add(packageItem.key);
    packages.push(packageItem);
  }

  return packages;
}

function readFactoryRuntimePackage(value: unknown, index: number): FactoryRuntimePackage | undefined {
  if (typeof value === 'string') {
    const key = value.trim();
    return key ? { key, label: key } : undefined;
  }

  if (!isWorkflowRuntimeRecord(value)) {
    return undefined;
  }

  const key = readWorkflowRuntimeString(value.key)
    ?? readWorkflowRuntimeString(value.packageKey)
    ?? readWorkflowRuntimeString(value.id)
    ?? `package-${index + 1}`;
  const label = readWorkflowRuntimeString(value.label)
    ?? readWorkflowRuntimeString(value.name)
    ?? key;

  return {
    key,
    label,
    description: readWorkflowRuntimeString(value.description)
  };
}

function readFactoryRuntimePlatform(value: WorkflowRuntimeValue | undefined): FactoryRuntimePlatform {
  const normalizedValue = readFactoryRuntimeJsonValue(value);
  if (typeof normalizedValue === 'string') {
    const label = normalizedValue.trim();
    return label ? { key: label, label } : {};
  }

  if (!isWorkflowRuntimeRecord(normalizedValue)) {
    return {};
  }

  return {
    key: readWorkflowRuntimeString(normalizedValue.key),
    label: readWorkflowRuntimeString(normalizedValue.label) ?? readWorkflowRuntimeString(normalizedValue.name),
    imageRatio: readWorkflowRuntimeString(normalizedValue.imageRatio),
    notes: readWorkflowRuntimeString(normalizedValue.notes)
  };
}

function readFactoryRuntimeObject(value: WorkflowRuntimeValue | undefined): Record<string, unknown> | undefined {
  const normalizedValue = readFactoryRuntimeJsonValue(value);
  return isWorkflowRuntimeRecord(normalizedValue) ? normalizedValue : undefined;
}

function readFactoryVideoRuntimeItems(
  factoryRequest: Record<string, unknown> | undefined,
  startFiles: WorkflowRuntimeValue | undefined
): FactoryVideoRuntimeItem[] {
  const requestAttachments = Array.isArray(factoryRequest?.attachments) ? factoryRequest.attachments : [];
  const rawFiles = requestAttachments.length > 0 ? requestAttachments : readWorkflowRuntimeFiles(startFiles);
  return rawFiles.flatMap((item, index) => {
    if (!isWorkflowRuntimeRecord(item) && !isWorkflowFileValue(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const localPath = readWorkflowRuntimeString(record.localPath)
      ?? readWorkflowRuntimeString(record.path)
      ?? readWorkflowRuntimeString(record.filePath);
    if (!localPath || !isFactoryVideoPath(localPath, readWorkflowRuntimeString(record.name))) {
      return [];
    }

    const name = readWorkflowRuntimeString(record.name)
      ?? getPathFileName(localPath)
      ?? `video-${index + 1}`;
    return [
      {
        id: readWorkflowRuntimeString(record.id) ?? `factory-video-${index + 1}-${sanitizeLogSuffix(name)}`,
        order: index + 1,
        name,
        localPath,
        size: readFactoryRuntimeNumber(record.size),
        type: readWorkflowRuntimeString(record.type)
      }
    ];
  });
}

function isFactoryVideoPath(localPath: string, name?: string): boolean {
  const target = name || localPath;
  const extension = target.split('.').at(-1)?.trim().toLowerCase();
  return ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v'].includes(extension ?? '');
}

function readFactoryVideoScreeningGates(factoryRequest: Record<string, unknown> | undefined): FactoryVideoScreeningGate[] {
  const profile = isWorkflowRuntimeRecord(factoryRequest?.screeningProfile)
    ? factoryRequest.screeningProfile
    : isWorkflowRuntimeRecord(factoryRequest?.screeningRules)
      ? factoryRequest.screeningRules
      : undefined;
  const rawGates = isWorkflowRuntimeRecord(profile) && Array.isArray(profile.gates)
    ? profile.gates
    : Array.isArray(factoryRequest?.gates)
      ? factoryRequest.gates
      : [];
  const gates = rawGates.flatMap((item) => readFactoryVideoScreeningGate(item));
  return gates.length > 0 ? gates : defaultFactoryVideoScreeningGates();
}

function readFactoryVideoScreeningGate(value: unknown): FactoryVideoScreeningGate[] {
  if (!isWorkflowRuntimeRecord(value)) {
    return [];
  }

  const id = readWorkflowRuntimeString(value.id);
  const name = readWorkflowRuntimeString(value.name) ?? id;
  const rules = Array.isArray(value.rules)
    ? value.rules.flatMap((item) => readFactoryVideoScreeningRule(item))
    : [];
  return id && name && rules.length > 0 ? [{ id, name, rules }] : [];
}

function readFactoryVideoScreeningRule(value: unknown): FactoryVideoScreeningRule[] {
  if (!isWorkflowRuntimeRecord(value)) {
    return [];
  }

  const metric = readWorkflowRuntimeString(value.metric);
  const operator = readFactoryVideoScreeningOperator(value.operator);
  const failReason = readWorkflowRuntimeString(value.failReason)
    ?? readWorkflowRuntimeString(value.message)
    ?? '未达到筛选标准';
  if (!metric || !operator) {
    return [];
  }

  return [
    {
      metric,
      operator,
      value: value.value,
      failReason
    }
  ];
}

function readFactoryVideoScreeningOperator(value: unknown): FactoryVideoScreeningRule['operator'] | undefined {
  return value === '>=' ||
    value === '<=' ||
    value === '>' ||
    value === '<' ||
    value === 'equals' ||
    value === 'notEquals' ||
    value === 'between'
    ? value
    : undefined;
}

function defaultFactoryVideoScreeningGates(): FactoryVideoScreeningGate[] {
  return [
    {
      id: 'video_spec',
      name: '视频规格',
      rules: [
        { metric: 'portraitRatio', operator: '<', value: 1, failReason: '视频为竖屏或非横屏比例，不符合横屏要求' },
        { metric: 'durationSeconds', operator: '>=', value: 20, failReason: '视频时长小于 20 秒' },
        { metric: 'hasAudio', operator: 'equals', value: true, failReason: '视频缺少可识别音轨' }
      ]
    },
    {
      id: 'asr_quality',
      name: '语音识别',
      rules: [
        { metric: 'transcriptChars', operator: '>=', value: 80, failReason: '识别文本过短，说话内容不足' },
        { metric: 'unclearTokenRatio', operator: '<=', value: 0.25, failReason: '语音含糊或识别失败比例过高' }
      ]
    },
    {
      id: 'content_minimum',
      name: '内容完整性提醒',
      rules: [
        { metric: 'beforeAfterCompleteness', operator: '>=', value: 0.6, failReason: '使用前/使用后改善表述较简略，建议人工确认是否可用' }
      ]
    }
  ];
}

function selectFactoryAsrProfile(
  profiles: ModelProfile[],
  factoryRequest: Record<string, unknown> | undefined
): ModelProfile | undefined {
  const asr = isWorkflowRuntimeRecord(factoryRequest?.asr) ? factoryRequest.asr : undefined;
  const requestedProfileId = readWorkflowRuntimeString(asr?.modelProfileId);
  if (requestedProfileId) {
    return profiles.find(
      (profile) => profile.id === requestedProfileId && modelProfileSupportsAnyCapability(profile, ['audio_to_text'])
    );
  }

  return profiles.find((profile) => modelProfileSupportsAnyCapability(profile, ['audio_to_text']));
}

function hasFactoryToolAction(
  binding: ResolvedRuntimeBinding,
  toolId: string,
  action: DesktopToolInvocationAction
): boolean {
  const tool = binding.availableTools.find((item) => item.id === toolId);
  return tool ? isToolActionEnabledForManifest(tool, action) : false;
}

async function runFactoryVideoScreeningItem(input: {
  task: DesktopTaskDetail;
  video: FactoryVideoRuntimeItem;
  gates: FactoryVideoScreeningGate[];
  asrProfile?: ModelProfile;
  scoringProfile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  binding: ResolvedRuntimeBinding;
  factoryRequest?: Record<string, unknown>;
  editEnabled: boolean;
  editTargetSeconds: number;
  editOutputFolder: string;
  createdAt: string;
}): Promise<FactoryVideoScreeningResult> {
  const metrics: Record<string, unknown> = {};
  const risks: string[] = [];
  const videoSpecGate = input.gates.find((gate) => gate.id === 'video_spec');
  const asrGate = input.gates.find((gate) => gate.id === 'asr_quality');
  const contentGate = input.gates.find((gate) => gate.id === 'content_minimum');

  if (!input.desktopToolInvoker || !input.workspaceId || !hasFactoryToolAction(input.binding, 'video-processing', 'video.probe')) {
    return rejectFactoryVideo(input.video, metrics, '视频规格', '视频处理工具不可用，无法检查比例、时长和音轨');
  }

  const probeResult = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: 'video-processing',
    action: 'video.probe',
    input: {
      videoPath: input.video.localPath
    },
    allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
  });
  if (!probeResult.ok) {
    return rejectFactoryVideo(input.video, metrics, '视频规格', probeResult.message ?? '视频基础信息读取失败');
  }
  Object.assign(metrics, normalizeFactoryVideoProbeMetrics(probeResult.output));
  const videoSpecFailure = videoSpecGate ? evaluateFactoryVideoGate(videoSpecGate, metrics) : undefined;
  if (videoSpecFailure) {
    return rejectFactoryVideo(input.video, metrics, videoSpecGate?.name ?? '视频规格', videoSpecFailure);
  }

  if (!input.asrProfile) {
    return errorFactoryVideo(input.video, metrics, asrGate?.name ?? '语音识别', '未配置支持语音转文字的模型，无法自动判断语音质量', undefined, [
      '请先配置并启用语音转文字模型，再重新运行本批次。'
    ]);
  }

  const preparedAudio = await prepareFactoryVideoAudioPath(input, metrics);
  if (!preparedAudio.audioPath) {
    return errorFactoryVideo(
      input.video,
      metrics,
      asrGate?.name ?? '语音识别',
      preparedAudio.error ?? '音频抽取失败，无法提交语音转文字模型',
      undefined,
      preparedAudio.risks.length > 0 ? preparedAudio.risks : ['请检查 FFmpeg 或视频处理工具配置后重试。']
    );
  }
  const asr = isWorkflowRuntimeRecord(input.factoryRequest?.asr)
    ? input.factoryRequest.asr
    : {};
  const asrResult = await transcribeFactoryVideoWithRetry({
    video: input.video,
    audioPath: preparedAudio.audioPath,
    asrProfile: input.asrProfile,
    asr,
    modelInvoker: input.modelInvoker
  });
  metrics.asrAttempts = asrResult.attempts;
  metrics.asrAudioPath = asrResult.audioPath;
  if (!asrResult.transcript) {
    return errorFactoryVideo(
      input.video,
      metrics,
      asrGate?.name ?? '语音识别',
      'ASR 服务调用失败，已标记为处理异常，建议检查配置后重试',
      undefined,
      [classifyFactoryAsrFailure(asrResult.error)]
    );
  }
  const transcript = asrResult.transcript;

  metrics.transcriptChars = transcript.length;
  metrics.unclearTokenRatio = estimateUnclearTokenRatio(transcript);
  const asrFailure = asrGate ? evaluateFactoryVideoGate(asrGate, metrics) : undefined;
  if (asrFailure) {
    return rejectFactoryVideo(input.video, metrics, asrGate?.name ?? '语音识别', asrFailure, transcript);
  }

  const analysis = shouldUseFactoryVideoLlmScoring(input.factoryRequest)
    ? await analyzeFactoryVideoTranscript({
        video: input.video,
        transcript,
        metrics,
        profile: input.scoringProfile,
        modelInvoker: input.modelInvoker,
        editTargetSeconds: input.editTargetSeconds
      })
    : analyzeFactoryVideoTranscriptByRules({
        transcript,
        metrics,
        editTargetSeconds: input.editTargetSeconds
      });
  metrics.beforeAfterCompleteness = analysis.beforeAfterCompleteness;
  const contentFailure = contentGate ? evaluateFactoryVideoGate(contentGate, metrics) : undefined;
  if (contentFailure) {
    risks.push(contentFailure);
  }

  risks.push(...analysis.risks);
  const score = clampWorkflowRuntimeLimit(analysis.score, estimateFactoryVideoScore(transcript, metrics), 0, 100);
  const grade = score >= 85 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D';
  let editPlan = analysis.editPlan;
  const shouldEdit = input.editEnabled && score >= 75 && grade !== 'C' && grade !== 'D';
  let editedVideoPath: string | undefined;
  if (shouldEdit && input.desktopToolInvoker && input.workspaceId && hasFactoryToolAction(input.binding, 'video-processing', 'video.compose_clips')) {
    editPlan = editPlan.length > 0
      ? editPlan
      : buildFallbackFactoryVideoEditPlan(metrics, input.editTargetSeconds);
    if (editPlan.length > 0) {
      const editResult = await input.desktopToolInvoker({
        workspaceId: input.workspaceId,
        toolId: 'video-processing',
        action: 'video.compose_clips',
        input: {
          videoPath: input.video.localPath,
          cutPlan: editPlan,
          folder: input.editOutputFolder,
          fileName: `${input.video.name.replace(/\.[^.]+$/, '')}-初剪`
        },
        allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
      });
      if (editResult.ok) {
        editedVideoPath = readWorkflowRuntimeString(editResult.output?.localPath);
      } else {
        risks.push(`剪辑失败：${editResult.message ?? '未知错误'}`);
      }
    }
  }
  const finalStatus = editedVideoPath
    ? 'edited'
    : score >= 75
      ? 'scored'
      : score >= 60
        ? 'review_required'
        : 'rejected';

  return {
    id: input.video.id,
    order: input.video.order,
    name: input.video.name,
    localPath: input.video.localPath,
    status: finalStatus,
    rejectedGate: finalStatus === 'rejected' ? '表达质量评分' : finalStatus === 'review_required' ? '人工复核边界' : undefined,
    rejectedReason: finalStatus === 'rejected'
      ? `规则评分低于 60：${score}`
      : finalStatus === 'review_required'
        ? `规则评分处于复核区间：${score}`
        : undefined,
    score,
    grade,
    shouldEdit,
    transcript,
    summary: analysis.summary,
    risks,
    metrics,
    editPlan,
    editedVideoPath
  };
}

function normalizeFactoryVideoProbeMetrics(output: Record<string, unknown> | undefined): Record<string, unknown> {
  const width = readFactoryRuntimeNumber(output?.width);
  const height = readFactoryRuntimeNumber(output?.height);
  return {
    probeAvailable: output?.probeAvailable === true,
    width,
    height,
    durationSeconds: readFactoryRuntimeNumber(output?.durationSeconds),
    hasAudio: output?.hasAudio === true,
    hasVideo: output?.hasVideo === true || Boolean(width && height),
    portraitRatio: width && height ? Math.round((height / width) * 1000) / 1000 : undefined,
    orientation: readWorkflowRuntimeString(output?.orientation),
    audioStreamCount: readFactoryRuntimeNumber(output?.audioStreamCount),
    probeWarning: readWorkflowRuntimeString(output?.probeWarning)
  };
}

function evaluateFactoryVideoGate(
  gate: FactoryVideoScreeningGate,
  metrics: Record<string, unknown>
): string | undefined {
  for (const rule of gate.rules) {
    if (!evaluateFactoryVideoRule(rule, metrics[rule.metric])) {
      return rule.failReason;
    }
  }

  return undefined;
}

function evaluateFactoryVideoRule(rule: FactoryVideoScreeningRule, actual: unknown): boolean {
  if (actual === undefined || actual === null || actual === '') {
    return false;
  }

  if (rule.operator === 'equals') {
    return actual === rule.value;
  }

  if (rule.operator === 'notEquals') {
    return actual !== rule.value;
  }

  const actualNumber = typeof actual === 'number' ? actual : typeof actual === 'string' ? Number(actual) : NaN;
  if (!Number.isFinite(actualNumber)) {
    return false;
  }

  if (rule.operator === 'between') {
    const bounds = Array.isArray(rule.value) ? rule.value.map((item) => Number(item)) : [];
    return bounds.length >= 2 &&
      Number.isFinite(bounds[0]) &&
      Number.isFinite(bounds[1]) &&
      actualNumber >= bounds[0]! &&
      actualNumber <= bounds[1]!;
  }

  const expectedNumber = typeof rule.value === 'number' ? rule.value : typeof rule.value === 'string' ? Number(rule.value) : NaN;
  if (!Number.isFinite(expectedNumber)) {
    return false;
  }

  if (rule.operator === '>=') return actualNumber >= expectedNumber;
  if (rule.operator === '<=') return actualNumber <= expectedNumber;
  if (rule.operator === '>') return actualNumber > expectedNumber;
  if (rule.operator === '<') return actualNumber < expectedNumber;
  return false;
}

function rejectFactoryVideo(
  video: FactoryVideoRuntimeItem,
  metrics: Record<string, unknown>,
  gate: string,
  reason: string,
  transcript?: string
): FactoryVideoScreeningResult {
  return {
    id: video.id,
    order: video.order,
    name: video.name,
    localPath: video.localPath,
    status: 'rejected',
    rejectedGate: gate,
    rejectedReason: reason,
    shouldEdit: false,
    transcript,
    risks: [],
    metrics
  };
}

function reviewFactoryVideo(
  video: FactoryVideoRuntimeItem,
  metrics: Record<string, unknown>,
  gate: string,
  reason: string,
  transcript?: string,
  risks: string[] = []
): FactoryVideoScreeningResult {
  return {
    id: video.id,
    order: video.order,
    name: video.name,
    localPath: video.localPath,
    status: 'review_required',
    rejectedGate: gate,
    rejectedReason: reason,
    shouldEdit: false,
    transcript,
    risks,
    metrics
  };
}

function errorFactoryVideo(
  video: FactoryVideoRuntimeItem,
  metrics: Record<string, unknown>,
  gate: string,
  reason: string,
  transcript?: string,
  risks: string[] = []
): FactoryVideoScreeningResult {
  return {
    id: video.id,
    order: video.order,
    name: video.name,
    localPath: video.localPath,
    status: 'processing_error',
    rejectedGate: gate,
    rejectedReason: reason,
    shouldEdit: false,
    transcript,
    risks,
    metrics
  };
}

async function prepareFactoryVideoAudioPath(
  input: {
    task: DesktopTaskDetail;
    video: FactoryVideoRuntimeItem;
    desktopToolInvoker?: DesktopToolInvoker;
    workspaceId?: string;
    binding: ResolvedRuntimeBinding;
    factoryRequest?: Record<string, unknown>;
  },
  metrics: Record<string, unknown>
): Promise<FactoryVideoPreparedAudioResult> {
  if (
    !input.desktopToolInvoker ||
    !input.workspaceId ||
    !hasFactoryToolAction(input.binding, 'video-processing', 'video.extract_audio')
  ) {
    metrics.audioExtraction = 'unavailable';
    return {
      error: '视频处理工具缺少音频抽取能力，无法把视频提交给语音转文字模型',
      risks: ['请先启用视频处理工具的音频抽取能力，或安装可用的 FFmpeg 后重试。']
    };
  }

  let result: DesktopToolInvocationResult;
  try {
    result = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'video-processing',
      action: 'video.extract_audio',
      input: {
        videoPath: input.video.localPath,
        audioFormat: readFactoryRuntimeAudioFormat(input.factoryRequest?.audioFormat),
        folder: 'asr-audio',
        fileName: `${input.video.order}-${sanitizeLogSuffix(input.video.name)}-audio`
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
  } catch (error) {
    const message = stripDesktopInvocationNoise(readErrorMessage(error));
    metrics.audioExtraction = 'failed';
    metrics.audioExtractionWarning = message;
    return {
      error: '音频抽取工具调用失败，无法提交语音转文字模型',
      risks: [`请检查 FFmpeg 或视频处理工具配置后重试：${message}`]
    };
  }

  if (result.ok) {
    const localPath = readWorkflowRuntimeString(result.output?.localPath);
    if (localPath) {
      metrics.audioExtraction = 'ok';
      return {
        audioPath: localPath,
        risks: []
      };
    }
  }

  const message = result.message ?? '音频抽取未返回有效路径。';
  metrics.audioExtraction = 'failed';
  metrics.audioExtractionWarning = message;
  return {
    error: '音频抽取失败，无法提交语音转文字模型',
    risks: [`请检查 FFmpeg 或视频处理工具配置后重试：${message}`]
  };
}

async function transcribeFactoryVideoWithRetry(input: {
  video: FactoryVideoRuntimeItem;
  audioPath: string;
  asrProfile: ModelProfile;
  asr: Record<string, unknown>;
  modelInvoker: DesktopModelInvoker;
}): Promise<FactoryVideoAsrAttemptResult> {
  const retryDelays = readFactoryAsrRetryDelays(input.asr);
  let lastError: unknown;

  for (let attemptIndex = 0; attemptIndex <= retryDelays.length; attemptIndex += 1) {
    try {
      const asrResponse = await input.modelInvoker({
        profile: input.asrProfile,
        taskKind: 'audio_transcription',
        audioTranscription: {
          audioPath: input.audioPath,
          language: readWorkflowRuntimeString(input.asr.language) ?? 'zh',
          dialect: readWorkflowRuntimeString(input.asr.dialect) ?? 'auto',
          prompt: '请转写医疗案例视频中的人物口述内容，保留使用前、使用后、症状变化等关键信息。'
        },
        messages: [{ role: 'user', content: `请转写视频音频：${input.video.name}` }],
        timeoutMs: 180_000
      });
      return {
        transcript: asrResponse.content.trim(),
        audioPath: input.audioPath,
        attempts: attemptIndex + 1
      };
    } catch (error) {
      lastError = error;
      if (!isFactoryAsrRetryableFailure(error)) {
        return {
          transcript: '',
          audioPath: input.audioPath,
          attempts: attemptIndex + 1,
          error
        };
      }
      const retryDelay = retryDelays[attemptIndex];
      if (retryDelay !== undefined && retryDelay > 0) {
        await sleepFactoryRuntime(retryDelay);
      }
    }
  }

  return {
    transcript: '',
    audioPath: input.audioPath,
    attempts: retryDelays.length + 1,
    error: lastError
  };
}

function readFactoryAsrRetryDelays(asr: Record<string, unknown>): number[] {
  if (Array.isArray(asr.retryDelaysMs)) {
    return asr.retryDelaysMs
      .map((item) => readFactoryRuntimeNumber(item))
      .filter((item): item is number => item !== undefined && item >= 0)
      .slice(0, 3);
  }

  return [2000, 5000];
}

function sleepFactoryRuntime(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function readFactoryRuntimeAudioFormat(value: unknown): 'm4a' | 'mp3' | 'wav' {
  const normalized = readWorkflowRuntimeString(value)?.toLowerCase().replace(/^\./, '');
  return normalized === 'mp3' || normalized === 'wav' || normalized === 'm4a' ? normalized : 'mp3';
}

function shouldUseFactoryVideoLlmScoring(factoryRequest: Record<string, unknown> | undefined): boolean {
  const scoring = isWorkflowRuntimeRecord(factoryRequest?.scoring)
    ? factoryRequest.scoring
    : {};
  const mode = readWorkflowRuntimeString(scoring.mode ?? factoryRequest?.scoringMode)?.toLowerCase();
  return mode === 'llm' || mode === 'smart' || mode === 'model';
}

function isFactoryAsrRetryableFailure(error: unknown): boolean {
  const message = stripDesktopInvocationNoise(readErrorMessage(error));
  const normalized = message.toLowerCase();
  return (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('等待超时') ||
    normalized.includes('rate limit') ||
    normalized.includes('too many') ||
    normalized.includes('限流') ||
    normalized.includes('econnreset') ||
    normalized.includes('socket hang up') ||
    normalized.includes('network') ||
    normalized.includes('temporarily unavailable') ||
    normalized.includes('service unavailable')
  );
}

function classifyFactoryAsrFailure(error: unknown): string {
  const message = stripDesktopInvocationNoise(readErrorMessage(error));
  const normalized = message.toLowerCase();

  if (normalized.includes('api key') || normalized.includes('apikey') || normalized.includes('unauthorized')) {
    return 'ASR API Key 未配置或鉴权失败，请检查模型配置后重试。';
  }

  if (normalized.includes('timeout') || normalized.includes('timed out') || normalized.includes('等待超时')) {
    return 'ASR 服务响应超时，建议稍后重试或换用响应更稳定的语音模型。';
  }

  if (normalized.includes('rate limit') || normalized.includes('too many') || normalized.includes('限流')) {
    return 'ASR 上游限流，建议稍后重试或降低批量并发。';
  }

  if (normalized.includes('http/https') || normalized.includes('oss') || normalized.includes('cos') || normalized.includes('可访问 url')) {
    return '当前 ASR 模型需要公网、OSS 或 COS 文件 URL，PC 本地文件不能直接提交；请换用支持本地音频上传的模型，或先配置文件上传链路。';
  }

  if (normalized.includes('10mb') || normalized.includes('5mb') || normalized.includes('直传限制') || normalized.includes('file too large')) {
    return '音频文件超过当前 ASR 本地直传限制，建议使用文件转写模型或进一步压缩音频。';
  }

  if (normalized.includes('does not support this input') || normalized.includes('invalidparameter')) {
    return '当前 ASR 模型不支持这个输入格式；建议先抽取音频后转写，或换用支持该格式的语音模型。';
  }

  return `ASR 服务调用失败，建议检查配置后重试：${message || '未知错误'}`;
}

function stripDesktopInvocationNoise(message: string): string {
  return message
    .replace(/^Error invoking remote method 'qiuai:desktop:invoke-model-chat':\s*/i, '')
    .replace(/^Error:\s*/i, '')
    .trim();
}

function estimateUnclearTokenRatio(transcript: string): number {
  const normalized = transcript.trim();
  if (!normalized) {
    return 1;
  }

  const unclearMatches = normalized.match(/听不清|无法识别|不清楚|\?{2,}|-{3,}|\[.*?不.*?清.*?\]/g) ?? [];
  return Math.min(1, Math.round((unclearMatches.length / Math.max(normalized.length / 40, 1)) * 1000) / 1000);
}

async function analyzeFactoryVideoTranscript(input: {
  video: FactoryVideoRuntimeItem;
  transcript: string;
  metrics: Record<string, unknown>;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  editTargetSeconds: number;
}): Promise<{
  score: number;
  beforeAfterCompleteness: number;
  summary: string;
  risks: string[];
  editPlan: Array<{ start: number; end: number; label?: string; reason?: string }>;
}> {
  try {
    const response = await input.modelInvoker({
      profile: input.profile,
      messages: buildFactoryVideoScoringMessages(input.video, input.transcript, input.metrics, input.editTargetSeconds),
      timeoutMs: 60_000
    });
    const parsed = parseWorkflowRuntimeJson(response.content);
    const record = isWorkflowRuntimeRecord(parsed) ? parsed : {};
    return {
      score: clampWorkflowRuntimeLimit(readFactoryRuntimeNumber(record.score), estimateFactoryVideoScore(input.transcript, input.metrics), 0, 100),
      beforeAfterCompleteness: Math.max(0, Math.min(readFactoryRuntimeNumber(record.beforeAfterCompleteness) ?? estimateBeforeAfterCompleteness(input.transcript), 1)),
      summary: readWorkflowRuntimeString(record.summary) ?? buildFactoryVideoTranscriptSummary(input.transcript),
      risks: Array.isArray(record.risks)
        ? record.risks.flatMap((item) => readWorkflowRuntimeString(item) ? [readWorkflowRuntimeString(item)!] : [])
        : [],
      editPlan: readFactoryVideoEditPlan(record.editPlan ?? record.segments)
    };
  } catch (error) {
    return {
      score: estimateFactoryVideoScore(input.transcript, input.metrics),
      beforeAfterCompleteness: estimateBeforeAfterCompleteness(input.transcript),
      summary: buildFactoryVideoTranscriptSummary(input.transcript),
      risks: [`评分模型调用失败，已使用规则估算：${readErrorMessage(error)}`],
      editPlan: []
    };
  }
}

function analyzeFactoryVideoTranscriptByRules(input: {
  transcript: string;
  metrics: Record<string, unknown>;
  editTargetSeconds: number;
}): {
  score: number;
  beforeAfterCompleteness: number;
  summary: string;
  risks: string[];
  editPlan: Array<{ start: number; end: number; label?: string; reason?: string }>;
} {
  const beforeAfterCompleteness = estimateBeforeAfterCompleteness(input.transcript);
  const risks: string[] = [];
  const transcriptChars = readFactoryRuntimeNumber(input.metrics.transcriptChars) ?? input.transcript.length;
  const unclearTokenRatio = readFactoryRuntimeNumber(input.metrics.unclearTokenRatio) ?? 0;

  if (beforeAfterCompleteness < 0.6) {
    risks.push('使用前/使用后改善表述较简略，建议人工确认是否可用');
  }
  if (transcriptChars < 160) {
    risks.push('转写文本较短，表达信息量偏少');
  }
  if (unclearTokenRatio > 0.15) {
    risks.push('转写中存在较多听不清内容');
  }

  return {
    score: estimateFactoryVideoScore(input.transcript, input.metrics),
    beforeAfterCompleteness,
    summary: buildFactoryVideoTranscriptSummary(input.transcript),
    risks,
    editPlan: buildFallbackFactoryVideoEditPlan(input.metrics, input.editTargetSeconds)
  };
}

function buildFactoryVideoScoringMessages(
  video: FactoryVideoRuntimeItem,
  transcript: string,
  metrics: Record<string, unknown>,
  editTargetSeconds: number
): DesktopModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        '你是 QiuAI WorkOS 的案例视频素材质检员。',
        '只评价素材质量、表达完整度、剪辑价值和合规风险，不判断药物疗效真假，不输出医疗建议。',
        '必须返回 JSON，不要 markdown。'
      ].join('\n')
    },
    {
      role: 'user',
      content: JSON.stringify({
        videoName: video.name,
        metrics,
        transcript,
        scoringRules: {
          expressionClarity: 20,
          beforeAfterCompleteness: 25,
          improvementSpecificity: 25,
          naturalness: 15,
          editPotential: 15
        },
        requiredOutput: {
          score: '0-100 number',
          beforeAfterCompleteness: '0-1 number',
          summary: 'short Chinese summary',
          risks: 'string[]; include privacy, medical advertising, exaggerated claim, unclear expression risks',
          editPlan: `optional segments for about ${editTargetSeconds}s: [{"start":0,"end":8,"label":"使用前症状","reason":"..."}]`
        }
      })
    }
  ];
}

function estimateBeforeAfterCompleteness(transcript: string): number {
  const before = /(使用前|之前|原来|以前|一开始|症状|疼|痛|不舒服|病症|问题)/.test(transcript);
  const after = /(使用后|之后|后来|现在|改善|缓解|好了|减轻|恢复|变化)/.test(transcript);
  const process = /(使用|服用|用了|吃了|产品|药|疗程|坚持)/.test(transcript);
  return Math.round(([before, after, process].filter(Boolean).length / 3) * 1000) / 1000;
}

function estimateFactoryVideoScore(transcript: string, metrics: Record<string, unknown>): number {
  const completeness = estimateBeforeAfterCompleteness(transcript);
  const transcriptChars = readFactoryRuntimeNumber(metrics.transcriptChars) ?? transcript.length;
  const lengthScore = Math.min(1, transcriptChars / 220);
  const unclearPenalty = readFactoryRuntimeNumber(metrics.unclearTokenRatio) ?? 0;
  const score = 45 + completeness * 35 + lengthScore * 20 - unclearPenalty * 40;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildFactoryVideoTranscriptSummary(transcript: string): string {
  return transcript.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function readFactoryVideoEditPlan(value: unknown): Array<{ start: number; end: number; label?: string; reason?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isWorkflowRuntimeRecord(item)) {
      return [];
    }

    const start = readFactoryRuntimeNumber(item.start);
    const end = readFactoryRuntimeNumber(item.end);
    if (start === undefined || end === undefined || end <= start) {
      return [];
    }

    return [{
      start,
      end,
      label: readWorkflowRuntimeString(item.label),
      reason: readWorkflowRuntimeString(item.reason)
    }];
  }).slice(0, 6);
}

function buildFallbackFactoryVideoEditPlan(
  metrics: Record<string, unknown>,
  targetSeconds: number
): Array<{ start: number; end: number; label: string; reason: string }> {
  const duration = readFactoryRuntimeNumber(metrics.durationSeconds);
  if (!duration || duration < 20) {
    return [];
  }

  const segmentLength = Math.max(5, Math.min(12, Math.round(targetSeconds / 3)));
  const middleStart = Math.max(0, Math.round(duration / 2 - segmentLength / 2));
  const tailStart = Math.max(0, Math.round(duration - segmentLength - 2));
  return [
    { start: 0, end: Math.min(segmentLength, duration), label: '开场', reason: '保留开头上下文' },
    { start: middleStart, end: Math.min(middleStart + segmentLength, duration), label: '中段', reason: '保留使用过程或核心说明' },
    { start: tailStart, end: Math.min(tailStart + segmentLength, duration), label: '结尾', reason: '保留改善结果表达' }
  ];
}

function buildFactoryVideoOutputItems(input: {
  taskId: string;
  factoryKind: string;
  results: FactoryVideoScreeningResult[];
  createdAt: string;
}): FactoryOutputItem[] {
  return input.results.map((result) => {
    const status = mapFactoryVideoResultStatusToOutputStatus(result.status);
    return {
      id: `${input.taskId}-video-output-${result.order}`,
      factoryKind: input.factoryKind,
      kind: 'video',
      title: result.name,
      status,
      originalStatus: status,
      sourcePath: result.localPath,
      outputPath: result.editedVideoPath,
      score: result.score,
      grade: result.grade,
      summary: result.summary,
      reason: result.rejectedReason,
      risks: result.risks,
      transcript: result.transcript,
      metadata: {
        order: result.order,
        gate: result.rejectedGate,
        shouldEdit: result.shouldEdit,
        editPlan: result.editPlan,
        metrics: result.metrics
      },
      auditTrail: [],
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  });
}

function mapFactoryVideoResultStatusToOutputStatus(
  status: FactoryVideoScreeningResult['status']
): FactoryOutputItemStatus {
  if (status === 'scored' || status === 'edited') return 'qualified';
  if (status === 'review_required') return 'review_required';
  if (status === 'processing_error') return 'processing_error';
  return 'rejected';
}

function buildFactoryVideoScreeningRows(results: FactoryVideoScreeningResult[]): string[][] {
  return [
    ['序号', '文件名', '状态', '关卡/异常类型', '原因/说明', '总分', '等级', '建议剪辑', '摘要', '风险提示', '转写文本', '本地路径', '初剪路径'],
    ...results.map((item) => [
      String(item.order),
      item.name,
      formatFactoryVideoStatus(item.status),
      item.rejectedGate ?? '',
      item.rejectedReason ?? '',
      item.score === undefined ? '' : String(item.score),
      item.grade ?? '',
      item.shouldEdit ? '是' : '否',
      item.summary ?? '',
      item.risks.join('；'),
      item.transcript ?? '',
      item.localPath,
      item.editedVideoPath ?? ''
    ])
  ];
}

function isQualifiedFactoryVideoResult(item: FactoryVideoScreeningResult): boolean {
  return item.status === 'scored' || item.status === 'edited';
}

function buildFactoryQualifiedVideoAddressListContent(input: {
  taskTitle: string;
  results: FactoryVideoScreeningResult[];
  qualifiedResults: FactoryVideoScreeningResult[];
  editedVideoFolderPath?: string;
  editEnabled: boolean;
  createdAt: string;
}): string {
  const rejected = input.results.filter((item) => item.status === 'rejected').length;
  const reviewRequired = input.results.filter((item) => item.status === 'review_required').length;
  const processingError = input.results.filter((item) => item.status === 'processing_error').length;
  const edited = input.qualifiedResults.filter((item) => item.editedVideoPath).length;
  const tableRows = input.qualifiedResults.map((item) =>
    [
      String(item.order),
      escapeMarkdownTableCell(item.name),
      item.grade ?? '',
      item.score === undefined ? '' : String(item.score),
      escapeMarkdownTableCell(item.localPath),
      escapeMarkdownTableCell(item.editedVideoPath ?? ''),
      escapeMarkdownTableCell(item.summary ?? '')
    ].join(' | ')
  );

  const lines: Array<string | undefined> = [
    `# ${input.taskTitle} - 合格视频地址清单`,
    '',
    `生成时间：${input.createdAt}`,
    '',
    '## 汇总',
    '',
    `- 视频总数：${input.results.length}`,
    `- 合格视频：${input.qualifiedResults.length}`,
    `- 筛掉视频：${rejected}`,
    `- 需人工复核：${reviewRequired}`,
    `- 处理异常：${processingError}`,
    `- 已生成初剪：${edited}`,
    `- 初剪开关：${input.editEnabled ? '开启' : '关闭'}`,
    input.editedVideoFolderPath ? `- 初剪视频文件夹：${input.editedVideoFolderPath}` : undefined,
    '',
    '## 合格视频',
    '',
    input.qualifiedResults.length > 0
      ? ['序号 | 文件名 | 等级 | 分数 | 原视频地址 | 初剪地址 | 摘要', '--- | --- | --- | --- | --- | --- | ---', ...tableRows].join('\n')
      : '本批次没有自动判定为合格的视频。',
    '',
    '## 说明',
    '',
    '- 合格视频指通过硬性筛选并完成评分，且未进入“需人工复核”的视频。',
    '- 医疗健康相关素材发布前仍需要人工复核合规风险。',
    '- 初剪视频只在用户开启初剪且 PC 端 FFmpeg 可用时生成。'
  ];

  return lines.filter((line): line is string => line !== undefined).join('\n');
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
}

function formatFactoryVideoStatus(status: FactoryVideoScreeningResult['status']): string {
  if (status === 'rejected') return '已筛掉';
  if (status === 'edited') return '已剪辑';
  if (status === 'review_required') return '需人工复核';
  if (status === 'processing_error') return '处理异常';
  return '已评分';
}

function readFactoryRuntimeNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readFactoryRuntimeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on', '开启', '是'].includes(value.trim().toLowerCase());
  }

  return false;
}

function readFactoryRuntimePackageInstructions(
  value: WorkflowRuntimeValue | undefined
): FactoryRuntimePackageInstruction[] {
  const normalizedValue = readFactoryRuntimeJsonValue(value);
  const items = Array.isArray(normalizedValue)
    ? normalizedValue
    : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.items)
      ? normalizedValue.items
      : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.instructions)
        ? normalizedValue.instructions
        : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.packages)
          ? [normalizedValue]
          : [];

  return items.flatMap((item) => readFactoryRuntimeInstructionItem(item));
}

function readFactoryRuntimeInstructionItem(value: unknown): FactoryRuntimePackageInstruction[] {
  if (!isWorkflowRuntimeRecord(value)) {
    return [];
  }

  const sku = readWorkflowRuntimeString(value.sku) ?? readWorkflowRuntimeString(value.itemSku);
  const packages = Array.isArray(value.packages)
    ? value.packages
    : Array.isArray(value.packagePrompts)
      ? value.packagePrompts
      : undefined;

  if (packages) {
    return packages.flatMap((item) => {
      const instruction = readFactoryRuntimePackageInstruction(item, sku);
      return instruction ? [instruction] : [];
    });
  }

  const directInstruction = readFactoryRuntimePackageInstruction(value, sku);
  return directInstruction ? [directInstruction] : [];
}

function readFactoryRuntimePackageInstruction(
  value: unknown,
  sku?: string
): FactoryRuntimePackageInstruction | undefined {
  if (!isWorkflowRuntimeRecord(value)) {
    return undefined;
  }

  const prompt = readWorkflowRuntimeString(value.prompt)
    ?? readWorkflowRuntimeString(value.instruction)
    ?? readWorkflowRuntimeString(value.text);
  if (!prompt) {
    return undefined;
  }

  return {
    sku: sku ?? readWorkflowRuntimeString(value.sku) ?? readWorkflowRuntimeString(value.itemSku),
    packageKey: readWorkflowRuntimeString(value.key)
      ?? readWorkflowRuntimeString(value.packageKey)
      ?? readWorkflowRuntimeString(value.id),
    prompt,
    negativePrompt: readWorkflowRuntimeString(value.negativePrompt),
    referenceImagePath: readWorkflowRuntimeString(value.referenceImagePath)
  };
}

function createFactoryImageGenerationTasks(input: {
  items: FactoryRuntimeItem[];
  packages: FactoryRuntimePackage[];
  targetPlatform: FactoryRuntimePlatform;
  packageInstructions: FactoryRuntimePackageInstruction[];
  createdAt: string;
}): FactoryImageGenerationTask[] {
  const instructions = new Map<string, FactoryRuntimePackageInstruction>();
  for (const instruction of input.packageInstructions) {
    if (!instruction.packageKey) {
      continue;
    }

    if (instruction.sku) {
      instructions.set(`${instruction.sku}::${instruction.packageKey}`, instruction);
    }
    instructions.set(`*::${instruction.packageKey}`, instruction);
  }

  const tasks: FactoryImageGenerationTask[] = [];
  for (const item of input.items) {
    for (const packageItem of input.packages) {
      const order = tasks.length + 1;
      const instruction =
        instructions.get(`${item.sku}::${packageItem.key}`) ?? instructions.get(`*::${packageItem.key}`);
      tasks.push({
        id: `factory-image-${order}-${sanitizeLogSuffix(item.sku)}-${sanitizeLogSuffix(packageItem.key)}`,
        order,
        sku: item.sku,
        sourceName: item.sourceName,
        sourceImage: item.image,
        packageKey: packageItem.key,
        packageLabel: packageItem.label,
        packageDescription: packageItem.description,
        prompt: instruction?.prompt ?? buildFactoryImageGenerationFallbackPrompt(item, packageItem, input.targetPlatform),
        negativePrompt: instruction?.negativePrompt,
        targetPlatform: input.targetPlatform,
        createdAt: input.createdAt
      });
    }
  }

  return tasks;
}

async function runWorkflowRuntimeConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(items[currentIndex]!, currentIndex);
      }
    })
  );

  return results;
}

async function runFactoryImageGenerationTask(input: {
  task: FactoryImageGenerationTask;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  maxRetries: number;
}): Promise<FactoryImageGenerationResult> {
  let lastError = '';
  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    try {
      const response = await input.modelInvoker({
        profile: input.profile,
        taskKind: 'image_generation',
        imageGeneration: {
          prompt: input.task.prompt,
          negativePrompt: input.task.negativePrompt,
          sourceImagePath: input.task.sourceImage.localPath,
          responseFormat: 'url'
        },
        messages: buildFactoryImageGenerationMessages(input.task),
        timeoutMs: readWorkflowRuntimeModelTimeoutMs(input.node.config?.timeoutMs ?? 180_000)
      });
      const imageResult = readFactoryImageGenerationResponse(response);
      if (!imageResult.remoteUrl && !imageResult.localPath) {
        throw new Error('Image generation response did not include a remoteUrl or localPath.');
      }

      return {
        id: input.task.id,
        order: input.task.order,
        sku: input.task.sku,
        packageKey: input.task.packageKey,
        packageLabel: input.task.packageLabel,
        status: 'completed',
        remoteUrl: imageResult.remoteUrl,
        localPath: imageResult.localPath,
        thumbnailPath: imageResult.thumbnailPath,
        sourceImagePath: input.task.sourceImage.localPath,
        prompt: input.task.prompt,
        createdAt: input.task.createdAt
      };
    } catch (error) {
      lastError = readErrorMessage(error);
    }
  }

  return {
    id: input.task.id,
    order: input.task.order,
    sku: input.task.sku,
    packageKey: input.task.packageKey,
    packageLabel: input.task.packageLabel,
    status: 'failed',
    sourceImagePath: input.task.sourceImage.localPath,
    prompt: input.task.prompt,
    error: lastError || 'Image generation failed.',
    createdAt: input.task.createdAt
  };
}

function buildFactoryImageGenerationMessages(task: FactoryImageGenerationTask): DesktopModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are a QiuAI WorkOS digital factory image generation executor.',
        'Generate exactly one image for the requested SKU and package.',
        'Return JSON only: {"remoteUrl":"https://...","thumbnailPath":"https://..."} or {"localPath":"C:\\\\...\\\\image.png"}.',
        'Do not return image binary data, base64, or markdown.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `SKU: ${task.sku}`,
        task.sourceName ? `Source name: ${task.sourceName}` : undefined,
        `Source image local path: ${task.sourceImage.localPath}`,
        task.sourceImage.uri ? `Source image URI: ${task.sourceImage.uri}` : undefined,
        `Package: ${task.packageLabel} (${task.packageKey})`,
        task.packageDescription ? `Package description: ${task.packageDescription}` : undefined,
        task.targetPlatform.label ? `Target platform: ${task.targetPlatform.label}` : undefined,
        task.targetPlatform.imageRatio ? `Platform image ratio: ${task.targetPlatform.imageRatio}` : undefined,
        task.targetPlatform.notes ? `Platform notes: ${task.targetPlatform.notes}` : undefined,
        'Prompt:',
        task.prompt,
        task.negativePrompt ? `Negative prompt: ${task.negativePrompt}` : undefined
      ].filter(Boolean).join('\n')
    }
  ];
}

function readFactoryImageGenerationResponse(
  response: DesktopModelChatResponse
): { remoteUrl?: string; localPath?: string; thumbnailPath?: string } {
  const artifact = response.artifacts?.find((item) => item.remoteUrl || item.localPath);
  if (artifact) {
    return {
      remoteUrl: readWorkflowRuntimeString(artifact.remoteUrl),
      localPath: readWorkflowRuntimeString(artifact.localPath),
      thumbnailPath: readWorkflowRuntimeString(artifact.thumbnailPath)
    };
  }

  const parsed = parseWorkflowRuntimeJson(response.content);
  const fromJson = readFactoryImageResultFromValue(parsed);
  if (fromJson.remoteUrl || fromJson.localPath) {
    return fromJson;
  }

  return {
    remoteUrl: extractFirstHttpUrl(response.content)
  };
}

function readFactoryImageResultFromValue(value: unknown): {
  remoteUrl?: string;
  localPath?: string;
  thumbnailPath?: string;
} {
  if (typeof value === 'string') {
    return value.startsWith('http://') || value.startsWith('https://')
      ? { remoteUrl: value }
      : { localPath: value };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = readFactoryImageResultFromValue(item);
      if (result.remoteUrl || result.localPath) {
        return result;
      }
    }
    return {};
  }

  if (!isWorkflowRuntimeRecord(value)) {
    return {};
  }

  const directRemoteUrl =
    readWorkflowRuntimeString(value.remoteUrl)
    ?? readWorkflowRuntimeString(value.url)
    ?? readWorkflowRuntimeString(value.imageUrl)
    ?? readWorkflowRuntimeString(value.outputUrl);
  const directLocalPath =
    readWorkflowRuntimeString(value.localPath)
    ?? readWorkflowRuntimeString(value.path)
    ?? readWorkflowRuntimeString(value.filePath);
  if (directRemoteUrl || directLocalPath) {
    return {
      remoteUrl: directRemoteUrl,
      localPath: directLocalPath,
      thumbnailPath: readWorkflowRuntimeString(value.thumbnailPath)
        ?? readWorkflowRuntimeString(value.thumbnailUrl)
    };
  }

  for (const key of ['image', 'images', 'artifact', 'artifacts', 'data', 'result', 'output']) {
    const nested = readFactoryImageResultFromValue(value[key]);
    if (nested.remoteUrl || nested.localPath) {
      return nested;
    }
  }

  return {};
}

function buildFactoryImageGenerationFallbackPrompt(
  item: FactoryRuntimeItem,
  packageItem: FactoryRuntimePackage,
  platform: FactoryRuntimePlatform
): string {
  return [
    `Use the source product image ${item.image.localPath} as the reference.`,
    `Create a ${packageItem.label} image for SKU ${item.sku}.`,
    packageItem.description ? `Package requirement: ${packageItem.description}.` : undefined,
    platform.label ? `Target platform: ${platform.label}.` : undefined,
    platform.imageRatio ? `Required ratio: ${platform.imageRatio}.` : undefined,
    platform.notes ? `Platform notes: ${platform.notes}.` : undefined,
    'Preserve the product identity, shape, color, material, logo, and important details.'
  ].filter(Boolean).join('\n')
}

function readFactoryRuntimeJsonValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return parseWorkflowRuntimeJson(value) ?? value;
  }

  return value;
}

function isWorkflowRuntimeRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function inferFactoryImageMimeType(fileName: string): string | undefined {
  const extension = fileName.split('.').at(-1)?.trim().toLocaleLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'png') return 'image/png';
  return undefined;
}

function extractFirstHttpUrl(value: string): string | undefined {
  return value.match(/https?:\/\/[^\s"'<>，。)）\]]+/)?.[0];
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
  rolePackage?: RolePackageManifest,
  roleCode?: string,
  roleModelCredentialBindings: RoleModelCredentialBinding[] = []
): ModelProfile {
  const preferredModelProfileId = readDependencyManifestModelProfileIdForNode(rolePackage, node) ?? node.modelProfileId;
  const requiredCapabilities = getWorkflowModelRequiredCapabilities(node);
  const compatibleProfiles = profiles.filter((profile) =>
    modelProfileSupportsAnyCapability(profile, requiredCapabilities)
  );
  const semanticDefaultProfileId = getWorkflowSemanticDefaultProfileId(node);
  const runtimeOverrideProfileId = roleCode && semanticDefaultProfileId
    ? roleModelCredentialBindings.find(
        (binding) =>
          binding.roleCode === roleCode &&
          binding.modelProfileId === semanticDefaultProfileId &&
          binding.runtimeModelProfileId
      )?.runtimeModelProfileId
    : undefined;
  const runtimeOverrideProfile = runtimeOverrideProfileId
    ? compatibleProfiles.find((profile) => profile.id === runtimeOverrideProfileId)
    : undefined;
  if (runtimeOverrideProfile) {
    return runtimeOverrideProfile;
  }

  const preferredProfile = preferredModelProfileId && preferredModelProfileId.toLowerCase().startsWith('qiu-')
    ? compatibleProfiles.find((profile) => profile.id === preferredModelProfileId)
    : undefined;
  if (preferredProfile) {
    return preferredProfile;
  }

  const semanticDefaultProfile = semanticDefaultProfileId
    ? compatibleProfiles.find((profile) => profile.id === semanticDefaultProfileId)
    : undefined;
  if (semanticDefaultProfile) {
    return semanticDefaultProfile;
  }

  const configuredProviderProfile =
    compatibleProfiles.find((profile) => profile.providerId !== 'provider-pending') ??
    compatibleProfiles[0];
  if (configuredProviderProfile) {
    return configuredProviderProfile;
  }

  const capabilityLabel = requiredCapabilities.join('/');
  throw new Error(
    `Workflow node "${node.name}" requires a compatible model capability (${capabilityLabel}), but no enabled and configured model on this PC matches it.`
  );
}

function isWorkflowTextModelProfile(profile: ModelProfile): boolean {
  const capabilities = readModelProfileCapabilities(profile);
  return capabilities.some((capability) =>
    [
      'text',
      'reasoning_text',
      'vision_text',
      'video_text',
      'long_context',
      'image_understanding',
      'vision_understanding',
      'video_understanding'
    ].includes(capability)
  );
}

function getWorkflowModelRequiredCapabilities(node: WorkflowGraphNode): string[] {
  const taskType = getWorkflowEffectiveModelTaskType(node);

  if (taskType === 'reasoning') {
    return ['reasoning_text', 'text'];
  }

  if (taskType === 'structured_extraction') {
    return ['text', 'reasoning_text', 'long_context'];
  }

  if (taskType === 'long_document') {
    return ['long_context', 'text'];
  }

  if (taskType === 'vision') {
    return ['image_understanding', 'vision_understanding', 'vision_text'];
  }

  if (taskType === 'video_understanding') {
    return ['video_understanding', 'video_text'];
  }

  if (taskType === 'audio_transcription') {
    return ['audio_to_text'];
  }

  if (taskType === 'video_screening_batch') {
    return ['text', 'reasoning_text'];
  }

  if (taskType === 'image_generation') {
    return ['text_to_image', 'image_generation'];
  }

  if (taskType === 'image_editing') {
    return ['image_editing', 'image_to_image'];
  }

  if (taskType === 'video_generation') {
    return ['video_generation', 'text_to_video', 'image_to_video'];
  }

  if (taskType === 'embedding') {
    return ['embedding'];
  }

  if (taskType === 'rerank') {
    return ['rerank'];
  }

  return ['text'];
}

function getWorkflowSemanticDefaultProfileId(node: WorkflowGraphNode): string | undefined {
  const taskType = getWorkflowEffectiveModelTaskType(node);

  if (taskType === 'vision') return 'qiu-vision-default';
  if (taskType === 'reasoning') return 'qiu-reasoning-default';
  if (taskType === 'audio_transcription') return 'qiu-asr-default';
  if (taskType === 'image_generation') return 'qiu-image-generation-default';
  if (taskType === 'image_editing') return 'qiu-image-editing-default';
  if (taskType === 'video_understanding' || taskType === 'video_generation') return 'qiu-vision-default';
  return 'qiu-general-default';
}

function modelProfileSupportsAnyCapability(profile: ModelProfile, capabilities: string[]): boolean {
  return modelProfileSupportsRequiredCapabilities(profile, capabilities);
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
  const profileId = asset
    ? readDependencyManifestSemanticModelProfileId(asset)
    : undefined;

  return profileId?.trim() || undefined;
}

function getWorkflowEffectiveModelTaskType(node: WorkflowGraphNode): string {
  const taskType = readWorkflowRuntimeString(node.config?.llmTaskType) ?? 'text';
  if (taskType === 'image_generation' && workflowNodeUsesReferenceImage(node)) {
    return 'image_editing';
  }

  return taskType;
}

function workflowNodeUsesReferenceImage(node: WorkflowGraphNode): boolean {
  return [
    ...(node.inputVariables ?? []),
    readWorkflowRuntimeString(node.config?.sourceImageVariable) ?? '',
    readWorkflowRuntimeString(node.config?.referenceImageVariable) ?? ''
  ].some((value) => {
    const normalized = value.trim().toLowerCase();
    return normalized === 'start.images' ||
      normalized === 'start.files' ||
      normalized === 'factory_items' ||
      normalized.includes('referenceimage') ||
      normalized.includes('sourceimage') ||
      normalized.includes('source_image');
  });
}

function readDependencyManifestSemanticModelProfileId(
  asset: NonNullable<RolePackageManifest['dependencyManifest']>['modelAssets'][number]
): string {
  return getSemanticModelProfileIdForAssetCapabilities({
    capabilities: asset.capabilities,
    inputTypes: asset.inputTypes,
    outputTypes: asset.outputTypes
  }) ?? normalizeRuntimeRequirementModelProfileId(asset.modelProfileId || asset.modelId || asset.key);
}

function getSemanticModelProfileIdForAssetCapabilities(input: {
  capabilities?: string[];
  inputTypes?: string[];
  outputTypes?: string[];
}): string | undefined {
  const capabilities = new Set((input.capabilities ?? []).map(normalizeWorkflowModelToken));
  const inputTypes = new Set((input.inputTypes ?? []).map(normalizeWorkflowModelToken));
  const outputTypes = new Set((input.outputTypes ?? []).map(normalizeWorkflowModelToken));

  if (capabilities.has('audio_to_text')) return 'qiu-asr-default';
  if (capabilities.has('embedding') || outputTypes.has('embedding')) return 'qiu-embedding-default';
  if (capabilities.has('rerank') || outputTypes.has('scores')) return 'qiu-rerank-default';
  if (
    capabilities.has('image_editing') ||
    capabilities.has('image_to_image') ||
    (inputTypes.has('image') && outputTypes.has('image'))
  ) {
    return 'qiu-image-editing-default';
  }
  if (capabilities.has('text_to_image') || (outputTypes.has('image') && !inputTypes.has('image'))) {
    return 'qiu-image-generation-default';
  }
  if (
    capabilities.has('image_understanding') ||
    capabilities.has('vision_understanding') ||
    capabilities.has('vision_text') ||
    (inputTypes.has('image') && (outputTypes.has('text') || outputTypes.has('json')))
  ) {
    return 'qiu-vision-default';
  }
  if (capabilities.has('video_generation') || outputTypes.has('video')) return 'qiu-vision-default';
  if (capabilities.has('video_understanding') || inputTypes.has('video')) return 'qiu-vision-default';
  if (capabilities.has('reasoning') || capabilities.has('reasoning_text')) {
    return 'qiu-reasoning-default';
  }
  if (capabilities.has('text')) {
    return 'qiu-general-default';
  }

  return undefined;
}

function normalizeWorkflowModelToken(value: string): string {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
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

function isWorkflowRuntimeTextExtractableFile(file: WorkflowFileValue): boolean {
  return ['document', 'pdf', 'text', 'spreadsheet', 'presentation'].includes(file.kind);
}

function isWorkflowRuntimeTextExtractablePath(localPath: string): boolean {
  return isWorkflowRuntimeTextExtractableFile({
    id: 'path-check',
    name: getPathFileName(localPath) ?? localPath,
    kind: inferWorkflowRuntimeFileKind(localPath),
    localPath
  });
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
    .filter(isWorkflowRuntimeTextExtractablePath)
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

  if (input.artifactNode.artifactType === 'zip' && input.availableToolIds.has('local-filesystem')) {
    return {
      toolId: 'local-filesystem',
      action: 'filesystem.package_zip',
      input: {
        folder: 'packages',
        fileName,
        files: [],
        manifest: {
          title,
          note: content
        }
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
  if (request.toolId === 'local-filesystem' && request.action === 'filesystem.package_zip') return 'zip';
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
  if (artifactType === 'zip') return 'packages';
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

function getPathDirectory(localPath: string): string | undefined {
  const trimmedPath = localPath.trim();
  const separatorIndex = Math.max(trimmedPath.lastIndexOf('/'), trimmedPath.lastIndexOf('\\'));
  return separatorIndex > 0 ? trimmedPath.slice(0, separatorIndex) : undefined;
}

function readCommonPathDirectory(paths: Array<string | undefined>): string | undefined {
  const directories = paths.flatMap((localPath) => {
    if (!localPath?.trim()) {
      return [];
    }
    const directory = getPathDirectory(localPath);
    return directory ? [directory] : [];
  });
  if (directories.length === 0) {
    return undefined;
  }

  const [firstDirectory] = directories;
  const normalizedFirstDirectory = firstDirectory.replace(/\\/g, '/').toLowerCase();
  return directories.every((directory) => directory.replace(/\\/g, '/').toLowerCase() === normalizedFirstDirectory)
    ? firstDirectory
    : undefined;
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

  if (artifactType === 'zip' && hasAction('local-filesystem', 'filesystem.package_zip')) {
    return 'local-filesystem/filesystem.package_zip';
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
    `Summary: ${truncateForPrompt(source.summary ?? 'No summary available.', maxKnowledgeSourceSummaryChars)}`
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

function normalizeRuntimeRequirementModelProfileId(profileId: string): string {
  const normalized = profileId.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('qiu-')) return profileId.trim();
  if (normalized.includes('asr') || normalized.includes('speech') || normalized.includes('audio')) return 'qiu-asr-default';
  if (
    normalized.includes('reason') ||
    normalized.includes('reasoner') ||
    normalized.includes('thinking') ||
    normalized.includes('deepseek-r1') ||
    normalized.includes('deepseek-v4-pro') ||
    normalized.includes('r1')
  ) {
    return 'qiu-reasoning-default';
  }
  if (normalized.includes('gpt-image') || normalized.includes('img2img') || normalized.includes('image-edit')) {
    return 'qiu-image-editing-default';
  }
  if (normalized.includes('image') || normalized.includes('vision') || normalized.includes('vl') || normalized.includes('gpt-4o')) {
    return 'qiu-vision-default';
  }
  if (normalized.includes('embedding') || normalized.includes('embed')) return 'qiu-embedding-default';
  if (normalized.includes('rerank')) return 'qiu-rerank-default';
  return 'qiu-general-default';
}

function mergeUniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
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
