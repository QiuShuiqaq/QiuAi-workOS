import type {
  DesktopArtifactSummary,
  DesktopExecutionLogEntry,
  FactoryArtifactPreview,
  FactoryArtifactPreviewItem,
  FactoryArtifactPreviewItemStatus,
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
import {
  isOfficialPointsModelProfile,
  resolveModelProfileCredential
} from './desktop-model-credentials.js';
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
import {
  buildAcademicDemoConfig,
  normalizeAcademicDemoParameters,
  renderAcademicDemoHtml,
  renderAcademicDemoReport,
  renderAcademicDemoUnresolvedMarkdown,
  type AcademicDemoConfig,
  type AcademicDemoSource
} from './academic-demo-config.js';
import {
  buildAcademicDataProfileRows,
  profileAcademicDemoTables
} from './academic-demo-data-analysis.js';

export type DesktopModelInvoker = (
  request: DesktopModelChatRequest
) => Promise<DesktopModelChatResponse>;

export type DesktopToolInvoker = (
  request: DesktopToolInvocationRequest
) => Promise<DesktopToolInvocationResult>;

export type DesktopTaskProgressCallback = (
  task: DesktopTaskDetail
) => void | Promise<void>;

type WorkflowRuntimeNodeProgressEmitter = (input: {
  updatedAt?: string;
  executionLogs?: DesktopExecutionLogEntry[];
  artifacts?: DesktopArtifactSummary[];
  state?: DesktopTaskDetail['state'];
  currentRunStatus?: NonNullable<DesktopTaskDetail['currentRun']>['status'];
}) => Promise<DesktopTaskDetail>;

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
  requiredModelProfileIds: string[];
  modelProfiles: ModelProfile[];
  availableTools: ToolManifest[];
  availableKnowledgeSources: DesktopKnowledgeSourceSummary[];
  missingModelProfileIds: string[];
  missingToolIds: string[];
  missingKnowledgeBindingIds: string[];
  unconfiguredKnowledgeBindingIds: string[];
}

function isTaskKnowledgeEnabled(context: DesktopTaskDetail['executionContext'] | undefined): boolean {
  return context?.useKnowledge !== false;
}

function isTaskKnowledgeExplicitlyEnabled(context: DesktopTaskDetail['executionContext'] | undefined): boolean {
  return context?.useKnowledge === true;
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
  promptTemplate?: string;
  negativePrompt?: string;
}

interface FactoryRuntimePlatform {
  key?: string;
  label?: string;
  imageRatio?: string;
  imageSize?: '1K' | '2K' | '4K';
  notes?: string;
}

interface FactoryRuntimePromptControls {
  language?: string;
  globalPrompt?: string;
  style?: string;
  desiredEffect?: string;
  mustKeep?: string;
  avoid?: string;
  extraInstruction?: string;
}

const factoryGrsaiImageSubmitTimeoutMs = 120_000;
const factoryGrsaiImagePollRequestTimeoutMs = 30_000;
const factoryGrsaiImageFinalDeadlineMs = 30 * 60 * 1000;
const factoryGrsaiImagePollInitialIntervalMs = 3_000;
const factoryGrsaiImagePollMaxIntervalMs = 15_000;
export const factoryImageRecoveryWindowMs = 2 * 60 * 60 * 1000;

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
  imageSize?: '1K' | '2K' | '4K';
  createdAt: string;
}

type FactoryImageGenerationResult = FactoryArtifactPreviewItem;
type FactoryImageGenerationErrorType = NonNullable<FactoryArtifactPreviewItem['errorType']>;
type FactoryImageGenerationResultUpdatePhase = 'submitted' | 'polled' | 'timeout' | 'completed';
type FactoryImageGenerationResultUpdateHandler = (
  result: FactoryImageGenerationResult,
  phase: FactoryImageGenerationResultUpdatePhase
) => Promise<FactoryImageGenerationResult>;

interface FactoryVideoGenerationTask {
  id: string;
  order: number;
  sku: string;
  sourceName?: string;
  sourceImage?: WorkflowFileValue;
  packageKey: string;
  packageLabel: string;
  packageDescription?: string;
  prompt: string;
  negativePrompt?: string;
  targetPlatform: FactoryRuntimePlatform;
  durationSeconds: number;
  videoRatio: string;
  createdAt: string;
}

interface FactoryVideoGenerationResult {
  id: string;
  order: number;
  sku: string;
  sourceName?: string;
  packageKey: string;
  packageLabel: string;
  status: FactoryArtifactPreviewItemStatus;
  remoteUrl?: string;
  localPath?: string;
  thumbnailPath?: string;
  sourceImagePath?: string;
  prompt?: string;
  error?: string;
  errorType?: FactoryImageGenerationErrorType;
  attempts?: number;
  providerJobId?: string;
  providerStatus?: string;
  durationSeconds?: number;
  videoRatio?: string;
  createdAt: string;
}

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

interface FactoryOperationVideoResult {
  id: string;
  order: number;
  topic: string;
  title: string;
  audience?: string;
  hook?: string;
  sellingPoints: string[];
  script: string;
  storyboard: Array<{ shot: string; visual?: string; voiceover?: string; durationSeconds?: number }>;
  publishCopy?: string;
  hashtags: string[];
  risks: string[];
  reviewChecklist: string[];
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

export interface FactoryImageBatchRecoveryHealth {
  totalCount: number;
  completedCount: number;
  unresolvedCount: number;
  recoverableCount: number;
  policyViolationCount: number;
  providerFailureCount: number;
  pendingCount: number;
  expiredCount: number;
}

export interface RecoverFactoryImageBatchResult {
  task: DesktopTaskDetail;
  health: FactoryImageBatchRecoveryHealth;
  recoveredCount: number;
}

export type RecoverFactoryImageBatchInput = Omit<RunDesktopTaskInput, 'task' | 'onProgress' | 'completedAt'> & {
  task: DesktopTaskDetail;
  nowMs?: number;
  onProgress?: DesktopTaskProgressCallback;
};

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

interface WorkflowRuntimeNodeResult {
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  factoryOutputs?: FactoryOutputItem[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}

interface AttachmentContextPreparation {
  context: string;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}

const toolCallMarker = 'QIUAI_DESKTOP_TOOL_CALL:';
const maxDesktopToolTurns = 3;
const maxAttachmentContextFiles = 5;
const maxVisionInputImages = 8;
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
  'browser.open_url',
  'browser.extract_text',
  'browser.run_steps',
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

function upsertDesktopArtifacts(
  existing: DesktopArtifactSummary[],
  updates: DesktopArtifactSummary[]
): DesktopArtifactSummary[] {
  if (updates.length === 0) {
    return existing;
  }

  const nextArtifacts = existing.map((artifact) =>
    updates.find((update) => update.id === artifact.id) ?? artifact
  );
  const existingIds = new Set(existing.map((artifact) => artifact.id));
  for (const update of updates) {
    if (!existingIds.has(update.id)) {
      nextArtifacts.push(update);
      existingIds.add(update.id);
    }
  }
  return nextArtifacts;
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
    roleCode: input.task.roleCode,
    roleModelCredentialBindings: input.roleModelCredentialBindings ?? [],
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
        ...buildModelConfigWarningLogs(
          input.task,
          credentialedBinding.modelProfiles.filter(
            (profile) => credentialedBinding.requiredModelProfileIds.includes(profile.id)
          ),
          completedAt
        )
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

  if (
    isTaskKnowledgeExplicitlyEnabled(context) &&
    context.knowledgeBindingIds.length > 0 &&
    credentialedBinding.availableKnowledgeSources.length === 0
  ) {
    const failedTask = failTask(
      input.task,
      completedAt,
      '本次任务已启用知识库，但当前没有可用的知识库来源。请先配置知识库，或关闭“使用知识库”后再运行。',
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
  roleCode?: string;
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  const contextModelProfileIds = mergeUniqueStrings(
    input.context.modelProfileIds.map((profileId) => profileId.trim())
  );
  const semanticModelProfileIds = mergeUniqueStrings(
    contextModelProfileIds.map(normalizeRuntimeRequirementModelProfileId)
  );
  const runtimeModelProfileIdBySemanticId = new Map<string, string>();
  if (input.roleCode) {
    const semanticModelProfileIdSet = new Set(semanticModelProfileIds);
    for (const binding of input.roleModelCredentialBindings ?? []) {
      const runtimeModelProfileId = binding.runtimeModelProfileId?.trim();
      if (
        binding.roleCode === input.roleCode &&
        semanticModelProfileIdSet.has(binding.modelProfileId) &&
        runtimeModelProfileId
      ) {
        runtimeModelProfileIdBySemanticId.set(binding.modelProfileId, runtimeModelProfileId);
      }
    }
  }
  const boundRuntimeModelProfileIds = [...runtimeModelProfileIdBySemanticId.values()];
  const requiredModelProfileIds = mergeUniqueStrings([
    ...semanticModelProfileIds.map(
      (profileId) => runtimeModelProfileIdBySemanticId.get(profileId) ?? profileId
    )
  ]);
  const eligibleModelIds = new Set([
    ...input.enabledModelProfileIds,
    ...boundRuntimeModelProfileIds
  ]);
  const requiredKnowledgeBindingIds = mergeUniqueStrings(
    isTaskKnowledgeEnabled(input.context)
      ? input.context.knowledgeBindingIds.map(normalizeKnowledgeBindingId)
      : []
  );

  const candidateModelProfileIds = mergeUniqueStrings([
    ...contextModelProfileIds,
    ...semanticModelProfileIds,
    ...requiredModelProfileIds,
    ...boundRuntimeModelProfileIds,
    ...input.enabledModelProfileIds
  ]);
  const modelProfiles = candidateModelProfileIds.flatMap((profileId) => {
    const profile = modelProfilesById.get(profileId);
    return profile && eligibleModelIds.has(profileId) ? [profile] : [];
  });
  const missingModelProfileIds = requiredModelProfileIds.filter(
    (profileId) => !modelProfilesById.has(profileId) || !eligibleModelIds.has(profileId)
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
    requiredModelProfileIds,
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
      binding.modelProfiles.filter(
        (profile) =>
          binding.requiredModelProfileIds.includes(profile.id) &&
          !isModelApiConfigured(profile)
      ),
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
  roleModelCredentialBindings?: RoleModelCredentialBinding[];
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
  const emitNodeProgress: WorkflowRuntimeNodeProgressEmitter = async (progress) => {
    progressTask = await emitTaskProgress({
      onProgress: input.onProgress,
      task: progressTask,
      updatedAt: progress.updatedAt ?? input.createdAt,
      executionLogs: progress.executionLogs,
      artifacts: progress.artifacts
        ? upsertDesktopArtifacts(progressTask.artifacts, progress.artifacts)
        : undefined,
      state: progress.state ?? 'running',
      currentRunStatus: progress.currentRunStatus ?? 'running'
    });
    return progressTask;
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
        primaryProfile,
        emitProgress: emitNodeProgress
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
          ? upsertDesktopArtifacts(progressTask.artifacts, nodeResult.generatedArtifacts)
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
  emitProgress?: WorkflowRuntimeNodeProgressEmitter;
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
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
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
  message: string;
}> {
  const academicDemoMaterialsResult = completeWorkflowRuntimeAcademicDemoMaterialsNode(input);
  if (academicDemoMaterialsResult) {
    return Promise.resolve(academicDemoMaterialsResult);
  }

  const mode = readWorkflowRuntimeDataMode(input.node);
  if (mode === 'template') {
    return completeWorkflowRuntimeTemplateNode(input);
  }
  if (mode === 'code') {
    return completeWorkflowRuntimeCodeNode(input);
  }
  return completeWorkflowRuntimeAssignNode(input);
}

function completeWorkflowRuntimeAcademicDemoMaterialsNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): WorkflowRuntimeNodeResult | undefined {
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'academic_project_demo_factory') {
    return undefined;
  }
  if (input.node.id !== 'prepare_academic_materials') {
    return undefined;
  }

  const materials = readAcademicDemoRuntimeFiles(factoryRequest, input.pool.get('start.files'));
  const demoParameters = isWorkflowRuntimeRecord(factoryRequest?.demoParameters)
    ? (factoryRequest?.demoParameters as Record<string, unknown>)
    : {};
  const summary = `Academic demo materials prepared: ${materials.length} file(s).`;
  const outputRefs: string[] = [];
  const outputPayload = {
    factory_request: factoryRequest ?? {},
    academic_materials: materials,
    demo_parameters: demoParameters
  };

  for (const [key, value] of Object.entries(outputPayload)) {
    input.pool.set(key, value as WorkflowRuntimeValue);
    outputRefs.push(key);
    input.pool.set(`${input.node.id}.${key}`, value as WorkflowRuntimeValue);
    outputRefs.push(`${input.node.id}.${key}`);
  }
  input.pool.set(`${input.node.id}.text`, summary);
  input.pool.set(`${input.node.id}.result`, outputPayload as unknown as WorkflowRuntimeValue);
  input.pool.set(`${input.node.id}.json`, outputPayload as unknown as WorkflowRuntimeValue);
  input.pool.set('runtime.previous_text', summary);

  return {
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || summary
    },
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_ACADEMIC_DEMO_MATERIALS_PREPARED',
        summary,
        input.createdAt,
        sanitizeLogSuffix(input.node.id),
        {
          materials: materials.length
        }
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? ['factory_request', 'start.files', 'knowledge_context'],
    outputVariables: [...new Set([...outputRefs, `${input.node.id}.text`, `${input.node.id}.result`, `${input.node.id}.json`])],
    message: summary
  };
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
  if (!isTaskKnowledgeEnabled(input.task.executionContext)) {
    const skippedMessage = 'Knowledge base disabled for this task.';
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: ''
    });
    input.pool.set('runtime.previous_text', '');

    return Promise.resolve({
      response: input.currentResponse,
      primaryProfile: input.primaryProfile,
      logs: [
        createLog(
          input.task.taskId,
          'info',
          'WORKFLOW_RUNTIME_KNOWLEDGE_SKIPPED',
          skippedMessage,
          input.createdAt,
          sanitizeLogSuffix(input.node.id)
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables: input.node.inputVariables ?? [],
      outputVariables,
      message: 'Knowledge node skipped because the task disabled knowledge base usage.'
    });
  }

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
  emitProgress?: WorkflowRuntimeNodeProgressEmitter;
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
  if (
    isOptionalCrossBorderFactoryPromptNode(input.node, input.rolePackage) &&
    !shouldRunCrossBorderFactoryImageUnderstanding(input.pool)
  ) {
    return completeOptionalCrossBorderFactoryPromptNodeWithoutVisionModel({
      task: input.task,
      node: input.node,
      pool: input.pool,
      createdAt: input.createdAt,
      currentResponse: input.currentResponse,
      primaryProfile: input.primaryProfile,
      reason: '本次任务未开启图片理解增强。',
      intro: '图片理解增强未开启，已跳过提示词增强节点。'
    });
  }

  if (
    isOptionalCrossBorderFactoryQualityCheckNode(input.node, input.rolePackage) &&
    !shouldRunCrossBorderFactorySmartQualityCheck(input.pool)
  ) {
    return completeCrossBorderFactoryQualityCheckWithoutVisionModel({
      task: input.task,
      node: input.node,
      pool: input.pool,
      createdAt: input.createdAt,
      currentResponse: input.currentResponse,
      primaryProfile: input.primaryProfile
    });
  }

  if (input.node.type === 'output') {
    const factoryOutputResult = completeWorkflowRuntimeFactoryOutputNode(input);
    if (factoryOutputResult) {
      return factoryOutputResult;
    }
  }

  let profile: ModelProfile;
  try {
    profile = selectWorkflowRuntimeModelProfile(
      input.node,
      input.profiles,
      input.rolePackage,
      input.task.roleCode,
      input.roleModelCredentialBindings
    );
  } catch (error) {
    if (
      isOptionalCrossBorderFactoryPromptNode(input.node, input.rolePackage) &&
      !shouldRunCrossBorderFactoryImageUnderstanding(input.pool)
    ) {
      return completeOptionalCrossBorderFactoryPromptNodeWithoutVisionModel({
        task: input.task,
        node: input.node,
        pool: input.pool,
        createdAt: input.createdAt,
        currentResponse: input.currentResponse,
        primaryProfile: input.primaryProfile,
        reason: readErrorMessage(error),
        intro: '未配置兼容的图片理解模型，已跳过提示词增强节点。'
      });
    }

    throw error;
  }

  if (readWorkflowRuntimeString(input.node.config?.llmTaskType) === 'structured_extraction') {
    const academicDemoResult = await invokeWorkflowRuntimeAcademicDemoExtractionNode({
      ...input,
      profile
    });
    if (academicDemoResult) {
      return academicDemoResult;
    }
  }

  const academicDemoPreparedResult = completeWorkflowRuntimeAcademicDemoPreparedNode(input);
  if (academicDemoPreparedResult) {
    return academicDemoPreparedResult;
  }

  if (readWorkflowRuntimeString(input.node.config?.llmTaskType) === 'ai_video_production') {
    const aiVideoProductionResult = await invokeWorkflowRuntimeAiVideoProductionNode({
      ...input,
      profile
    });
    if (aiVideoProductionResult) {
      return aiVideoProductionResult;
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

  if (readWorkflowRuntimeString(input.node.config?.llmTaskType) === 'operation_video_batch') {
    const operationFactoryResult = await invokeWorkflowRuntimeOperationVideoFactoryNode({
      ...input,
      profile
    });
    if (operationFactoryResult) {
      return operationFactoryResult;
    }
  }

  if (readWorkflowRuntimeString(input.node.config?.llmTaskType) === 'video_generation') {
    const operationVideoFactoryResult = await invokeWorkflowRuntimeOperationVideoGenerationNode({
      ...input,
      profile
    });
    if (operationVideoFactoryResult) {
      return operationVideoFactoryResult;
    }

    const ecommerceVideoFactoryResult = await invokeWorkflowRuntimeEcommerceProductVideoFactoryNode({
      ...input,
      profile
    });
    if (ecommerceVideoFactoryResult) {
      return ecommerceVideoFactoryResult;
    }

    const singleVideoResult = await invokeWorkflowRuntimeSingleMediaGenerationNode({
      ...input,
      profile,
      mediaKind: 'video'
    });
    if (singleVideoResult) {
      return singleVideoResult;
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

    const singleImageResult = await invokeWorkflowRuntimeSingleMediaGenerationNode({
      ...input,
      profile,
      mediaKind: 'image'
    });
    if (singleImageResult) {
      return singleImageResult;
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
    visionInputs: collectWorkflowRuntimeVisionInputs(input.node, input.pool, variables),
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

async function invokeWorkflowRuntimeAiVideoProductionNode(input: {
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
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'ai_video_production_factory') {
    return undefined;
  }

  const videos = readFactoryVideoRuntimeItems(factoryRequest, input.pool.get('start.files'));
  const video = videos[0];
  if (!video) {
    throw new Error('AI制作视频工厂需要上传一个原始视频。');
  }

  if (!input.desktopToolInvoker || !input.workspaceId) {
    throw new Error('桌面端视频处理工具不可用，无法制作视频。');
  }
  if (!hasFactoryToolAction(input.binding, 'video-processing', 'video.probe')) {
    throw new Error('缺少 video.probe 工具能力，无法读取视频信息。');
  }
  if (!hasFactoryToolAction(input.binding, 'video-processing', 'video.extract_audio')) {
    throw new Error('缺少 video.extract_audio 工具能力，无法抽取音频。');
  }
  if (!hasFactoryToolAction(input.binding, 'video-processing', 'video.compose_clips')) {
    throw new Error('缺少 video.compose_clips 工具能力，无法合成 MP4。');
  }

  const asrProfile = selectFactoryAsrProfile(
    input.profiles,
    factoryRequest,
    input.task.roleCode,
    input.roleModelCredentialBindings
  );
  if (!asrProfile) {
    throw new Error('未配置语音转文字模型，无法分析原始视频。');
  }

  const voiceProfile = selectFactoryAudioGenerationProfile(
    input.profiles,
    factoryRequest,
    input.task.roleCode,
    input.roleModelCredentialBindings
  );
  if (!voiceProfile) {
    throw new Error('未配置口播模型，无法生成专业口播声音。');
  }

  const settings = readAiVideoProductionSettings(factoryRequest);
  const allowedRootPaths = buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext);
  const metrics: Record<string, unknown> = {};
  const usedToolIds = new Set<string>(['video-processing']);
  const logs: DesktopExecutionLogEntry[] = [
    createLog(
      input.task.taskId,
      'info',
      'WORKFLOW_RUNTIME_AI_VIDEO_PRODUCTION_STARTED',
      `AI video production started: ${video.name}.`,
      input.createdAt,
      sanitizeLogSuffix(input.node.id)
    )
  ];

  const probeResult = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: 'video-processing',
    action: 'video.probe',
    input: {
      videoPath: video.localPath
    },
    allowedRootPaths
  });
  if (!probeResult.ok) {
    throw new Error(probeResult.message ?? '视频基础信息读取失败。');
  }
  Object.assign(metrics, normalizeFactoryVideoProbeMetrics(probeResult.output));

  const preparedAudio = await prepareFactoryVideoAudioPath(
    {
      task: input.task,
      video,
      desktopToolInvoker: input.desktopToolInvoker,
      workspaceId: input.workspaceId,
      binding: input.binding,
      factoryRequest
    },
    metrics
  );
  if (!preparedAudio.audioPath) {
    throw new Error(preparedAudio.error ?? '音频抽取失败，无法提交语音转文字模型。');
  }

  const asr = isWorkflowRuntimeRecord(factoryRequest?.asr) ? factoryRequest.asr : {};
  const asrResult = await transcribeFactoryVideoWithRetry({
    video,
    audioPath: preparedAudio.audioPath,
    asrProfile,
    asr: {
      ...asr,
      language: readWorkflowRuntimeString(asr.language) ?? 'zh',
      prompt: '请转写软件录屏、产品演示或课程讲解视频中的口述内容，尽量保留时间顺序和关键操作。'
    },
    modelInvoker: input.modelInvoker
  });
  if (!asrResult.transcript) {
    throw new Error(classifyFactoryAsrFailure(asrResult.error));
  }

  const analysisResponse = await input.modelInvoker({
    profile: input.profile,
    messages: buildAiVideoProductionAnalysisMessages({
      task: input.task,
      video,
      transcript: asrResult.transcript,
      metrics,
      settings,
      factoryRequest
    }),
    timeoutMs: readWorkflowRuntimeModelTimeoutMs(input.node.config?.timeoutMs) ?? 120_000
  });
  const plan = normalizeAiVideoProductionPlan({
    parsed: parseWorkflowRuntimeJson(analysisResponse.content),
    rawContent: analysisResponse.content,
    transcript: asrResult.transcript,
    settings,
    videoDurationSeconds: readFactoryRuntimeNumber(metrics.durationSeconds)
  });

  const voiceResponse = await input.modelInvoker({
    profile: voiceProfile,
    taskKind: 'audio_generation',
    audioGeneration: {
      text: plan.narrationScript,
      voicePresetId: settings.voicePresetId,
      language: 'zh',
      format: 'mp3'
    },
    messages: [
      {
        role: 'user',
        content: `请生成视频口播音频，音色=${settings.voicePresetId}。\n\n${plan.narrationScript}`
      }
    ],
    timeoutMs: 180_000
  });
  const voiceResult = readFactoryVideoGenerationResponse(voiceResponse);
  const voiceAudioPath = voiceResult.localPath
    ? voiceResult.localPath
    : voiceResult.remoteUrl
      ? await downloadAiVideoProductionVoiceAudio({
          task: input.task,
          remoteUrl: voiceResult.remoteUrl,
          desktopToolInvoker: input.desktopToolInvoker,
          workspaceId: input.workspaceId,
          binding: input.binding,
          createdAt: input.createdAt
        })
      : undefined;
  if (!voiceAudioPath) {
    throw new Error('口播模型没有返回可下载的音频文件。');
  }
  usedToolIds.add('local-filesystem');

  const composeResult = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: 'video-processing',
    action: 'video.compose_clips',
    input: {
      videoPath: video.localPath,
      cutPlan: plan.cutPlan,
      voiceoverPath: voiceAudioPath,
      introPath: settings.introPath,
      outroPath: settings.outroPath,
      coverPath: settings.coverPath,
      watermarkPath: settings.watermarkPath,
      outputRatio: settings.outputRatio,
      outputResolution: settings.outputResolution,
      folder: 'ai-video-production',
      fileName: buildWorkflowArtifactFileName(input.task.title, settings.platformLabel)
    },
    allowedRootPaths
  });
  if (!composeResult.ok) {
    throw new Error(composeResult.message ?? '视频合成失败。');
  }
  const outputVideoPath = readWorkflowRuntimeString(composeResult.output?.localPath);
  if (!outputVideoPath) {
    throw new Error('视频合成完成但没有返回 MP4 本地路径。');
  }

  const productionResult = {
    platform: settings.platform,
    platformLabel: settings.platformLabel,
    sourceVideo: {
      name: video.name,
      localPath: video.localPath,
      durationSeconds: readFactoryRuntimeNumber(metrics.durationSeconds)
    },
    settings,
    transcript: asrResult.transcript,
    chapters: plan.chapters,
    highlightSegments: plan.highlightSegments,
    cutPlan: plan.cutPlan,
    narrationScript: plan.narrationScript,
    voiceAudioPath,
    outputVideoPath
  };
  const summaryContent = `已生成 MP4：${outputVideoPath}`;
  const generatedArtifacts: DesktopArtifactSummary[] = [
    {
      id: `${input.task.taskId}-ai-video-production-${Date.parse(input.createdAt) || Date.now()}`,
      type: 'video',
      title: getPathFileName(outputVideoPath) ?? `${input.task.title}.mp4`,
      content: summaryContent,
      localPath: outputVideoPath,
      createdAt: input.createdAt
    }
  ];
  const factoryOutputs: FactoryOutputItem[] = [
    {
      id: `${input.task.taskId}-ai-video-production-output`,
      factoryKind: 'ai_video_production_factory',
      kind: 'video',
      title: getPathFileName(outputVideoPath) ?? 'AI制作视频.mp4',
      status: 'qualified',
      originalStatus: 'qualified',
      sourcePath: video.localPath,
      outputPath: outputVideoPath,
      summary: settings.platformLabel,
      transcript: asrResult.transcript,
      metadata: productionResult as Record<string, unknown>,
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    }
  ];
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: summaryContent,
    json: productionResult as unknown as WorkflowRuntimeValue,
    result: productionResult as unknown as WorkflowRuntimeValue,
    outputValue: productionResult as unknown as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);
  input.pool.set('ai_video_production_result', productionResult as unknown as WorkflowRuntimeValue);
  input.pool.set('generated_video_path', outputVideoPath);
  input.pool.set('video_production_summary', summaryContent);

  logs.push(
    createLog(
      input.task.taskId,
      'info',
      'WORKFLOW_RUNTIME_AI_VIDEO_PRODUCTION_COMPLETED',
      `AI video production completed: ${outputVideoPath}.`,
      input.createdAt,
      sanitizeLogSuffix(`${input.node.id}-completed`),
      { outputVideoPath, platform: settings.platform }
    )
  );

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.profile.providerName,
      modelName: input.profile.modelName,
      content: summaryContent,
      inputTokens: analysisResponse.inputTokens,
      outputTokens: analysisResponse.outputTokens
    }),
    primaryProfile: input.profile,
    logs,
    usedToolIds: [...usedToolIds],
    generatedArtifacts,
    factoryOutputs,
    inputVariables: ['factory_request', 'start.files'],
    outputVariables: [...new Set([...outputVariables, 'generated_video_path', 'video_production_summary'])],
    message: 'AI video production finished.'
  };
}

async function invokeWorkflowRuntimeFactoryVideoScreeningNode(input: {
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
  const asrProfile = selectFactoryAsrProfile(
    input.profiles,
    factoryRequest,
    input.task.roleCode,
    input.roleModelCredentialBindings
  );
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

async function invokeWorkflowRuntimeOperationVideoFactoryNode(input: {
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
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'operation_video_factory') {
    return undefined;
  }

  const usedToolIds = new Set<string>();
  const extraLogs: DesktopExecutionLogEntry[] = [];
  const attachmentExtraction = await extractFactoryOperationAttachmentContext({
    task: input.task,
    factoryRequest,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: input.createdAt,
    nodeId: input.node.id
  });
  if (attachmentExtraction.usedToolId) {
    usedToolIds.add(attachmentExtraction.usedToolId);
  }
  extraLogs.push(...attachmentExtraction.logs);
  if (attachmentExtraction.text) {
    input.pool.set('operation_attachment_context', attachmentExtraction.text);
  }

  const variables = appendWorkflowOutputAssistantMessageVariable(
    input.node,
    input.pool,
    [
      ...resolveWorkflowVariableRefs(input.pool, input.node.inputVariables, getWorkflowRuntimeFallbackInputRefs(input.pool)),
      ...(attachmentExtraction.text
        ? [{ ref: 'operation_attachment_context', value: attachmentExtraction.text as WorkflowRuntimeValue }]
        : [])
    ]
  );
  const messages = buildWorkflowRuntimeModelMessages({
    task: input.task,
    node: input.node,
    variables,
    knowledgeSources: input.binding.availableKnowledgeSources,
    outputMode: 'json',
    schema: readWorkflowRuntimeModelSchema(input.node)
  });
  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_OPERATION_VIDEO_FACTORY_STARTED',
    'Operation video factory started.',
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  const modelResponse = await input.modelInvoker({
    profile: input.profile,
    messages,
    timeoutMs: readWorkflowRuntimeModelTimeoutMs(input.node.config?.timeoutMs)
  });
  const plan = normalizeFactoryOperationVideoPlan({
    parsed: parseWorkflowRuntimeJson(modelResponse.content),
    rawContent: modelResponse.content,
    factoryRequest
  });
  const selectedPackageKeys = new Set(
    readFactoryRuntimePackages(factoryRequest?.packages as WorkflowRuntimeValue).map((item) => item.key)
  );
  const shouldWritePackage = (key: string) => selectedPackageKeys.size === 0 || selectedPackageKeys.has(key);
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  const packageFiles: Array<{ localPath: string; archivePath?: string }> = [];
  let sequence = 1;

  const pushToolArtifact = (toolId: string, action: DesktopToolInvocationAction, output: Record<string, unknown> | undefined, title?: string) => {
    const artifact = buildGeneratedArtifactFromToolResult({
      taskId: input.task.taskId,
      toolId,
      action,
      output,
      createdAt: input.createdAt,
      sequence
    });
    sequence += 1;
    if (!artifact) {
      return undefined;
    }
    const titledArtifact = title ? { ...artifact, title } : artifact;
    generatedArtifacts.push(titledArtifact);
    if (artifact.localPath) {
      packageFiles.push({ localPath: artifact.localPath, archivePath: titledArtifact.title });
    }
    return titledArtifact;
  };

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'office-document', 'spreadsheet.write_xlsx') &&
    shouldWritePackage('topic_plan')
  ) {
    const topicResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'office-document',
      action: 'spreadsheet.write_xlsx',
      input: {
        title: '运营视频选题计划',
        folder: 'spreadsheets',
        fileName: buildWorkflowArtifactFileName(input.task.title, '选题计划表'),
        sheets: [
          {
            name: '选题计划',
            rows: buildFactoryOperationTopicRows(plan.items)
          }
        ]
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('office-document');
    if (topicResult.ok) {
      pushToolArtifact('office-document', 'spreadsheet.write_xlsx', topicResult.output, '选题计划表.xlsx');
    } else {
      extraLogs.push(createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_TOPIC_XLSX_FAILED',
        `Topic spreadsheet could not be written: ${topicResult.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-topic-xlsx`)
      ));
    }
  }

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'office-document', 'spreadsheet.write_xlsx') &&
    shouldWritePackage('publish_copy')
  ) {
    const publishResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'office-document',
      action: 'spreadsheet.write_xlsx',
      input: {
        title: '运营视频发布文案',
        folder: 'spreadsheets',
        fileName: buildWorkflowArtifactFileName(input.task.title, '发布文案表'),
        sheets: [
          {
            name: '发布文案',
            rows: buildFactoryOperationPublishRows(plan.items)
          }
        ]
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('office-document');
    if (publishResult.ok) {
      pushToolArtifact('office-document', 'spreadsheet.write_xlsx', publishResult.output, '发布文案表.xlsx');
    } else {
      extraLogs.push(createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_PUBLISH_XLSX_FAILED',
        `Publishing spreadsheet could not be written: ${publishResult.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-publish-xlsx`)
      ));
    }
  }

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.write_text_file') &&
    shouldWritePackage('script_storyboard')
  ) {
    const scriptResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'operation-videos',
        fileName: buildWorkflowArtifactFileName(input.task.title, '脚本分镜包'),
        content: buildFactoryOperationScriptMarkdown({
          taskTitle: input.task.title,
          summary: plan.summary,
          items: plan.items,
          createdAt: input.createdAt
        })
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (scriptResult.ok) {
      pushToolArtifact('local-filesystem', 'filesystem.write_text_file', scriptResult.output, '脚本分镜包.md');
    } else {
      extraLogs.push(createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_SCRIPT_MD_FAILED',
        `Script markdown could not be written: ${scriptResult.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-script-md`)
      ));
    }
  }

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.package_zip') &&
    shouldWritePackage('video_package')
  ) {
    const zipResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.package_zip',
      input: {
        folder: 'operation-videos',
        fileName: buildWorkflowArtifactFileName(input.task.title, '视频制作包'),
        files: packageFiles,
        manifest: {
          title: input.task.title,
          summary: plan.summary,
          factoryKind: 'operation_video_factory',
          itemCount: plan.items.length,
          createdAt: input.createdAt,
          items: plan.items
        }
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (zipResult.ok) {
      pushToolArtifact('local-filesystem', 'filesystem.package_zip', zipResult.output, '视频制作包.zip');
    } else {
      extraLogs.push(createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_ZIP_FAILED',
        `Operation video package could not be written: ${zipResult.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-zip`)
      ));
    }
  }

  const scriptArtifactPath = generatedArtifacts.find((artifact) => artifact.title.includes('脚本'))?.localPath;
  const packageArtifactPath = generatedArtifacts.find((artifact) => artifact.title.endsWith('.zip'))?.localPath;
  const factoryOutputs = buildFactoryOperationVideoOutputItems({
    taskId: input.task.taskId,
    results: plan.items,
    scriptArtifactPath,
    packageArtifactPath,
    createdAt: input.createdAt
  });
  const summaryContent = [
    `AI 运营视频工厂完成：生成 ${plan.items.length} 条视频方案`,
    plan.summary,
    generatedArtifacts.length > 0 ? `产物文件：${generatedArtifacts.length} 个` : '产物文件：未写入，请检查本地工具配置',
    '状态：等待人工复核后拍摄、剪辑和发布'
  ].filter(Boolean).join('\n');
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: summaryContent,
    json: plan.items,
    result: plan.items,
    outputValue: plan.items as unknown as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);
  input.pool.set('operation_video_results', plan.items as unknown as WorkflowRuntimeValue);
  input.pool.set('operation_summary', summaryContent);
  if (packageArtifactPath) {
    input.pool.set('operation_package_folder', packageArtifactPath);
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
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_FACTORY_COMPLETED',
        `Operation video factory completed: items=${plan.items.length}, artifacts=${generatedArtifacts.length}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-operation-video-factory`),
        { items: plan.items.length, artifacts: generatedArtifacts.length }
      )
    ],
    usedToolIds: [...usedToolIds],
    generatedArtifacts,
    factoryOutputs,
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables: [...new Set([...outputVariables, 'operation_video_results', 'operation_summary'])],
    message: `Operation video factory finished: items=${plan.items.length}, artifacts=${generatedArtifacts.length}.`
  };
}

async function invokeWorkflowRuntimeOperationVideoGenerationNode(input: {
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
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'operation_video_factory') {
    return undefined;
  }

  const packageKey = readWorkflowRuntimeString(input.node.config?.packageKey) ?? 'generated_video';
  const selectedPackageKeys = new Set(
    readFactoryRuntimePackages(input.pool.get('selected_packages')).map((item) => item.key)
  );
  const shouldGenerateVideos = selectedPackageKeys.has(packageKey);
  const planItems = readFactoryOperationVideoResults(input.pool.get('operation_video_results'), factoryRequest);
  const outputVariablesBase = input.node.outputVariables ?? ['operation_generated_videos', 'operation_video_generation_summary'];

  if (!shouldGenerateVideos || planItems.length === 0) {
    const summaryContent = !shouldGenerateVideos
      ? '运营视频生成已跳过：未勾选“生成视频成片”产物包。'
      : '运营视频生成已跳过：内容包没有可用于生视频的脚本分镜。';
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: summaryContent,
      json: [],
      result: [],
      outputValue: []
    });
    input.pool.set('operation_generated_videos', [] as unknown as WorkflowRuntimeValue);
    input.pool.set('operation_video_generation_summary', summaryContent);

    return {
      response: mergeWorkflowRuntimeResponses(input.currentResponse, {
        provider: input.primaryProfile.providerName,
        modelName: input.primaryProfile.modelName,
        content: summaryContent
      }),
      primaryProfile: input.primaryProfile,
      logs: [
        createLog(
          input.task.taskId,
          'info',
          'WORKFLOW_RUNTIME_OPERATION_VIDEO_GENERATION_SKIPPED',
          summaryContent,
          input.createdAt,
          sanitizeLogSuffix(input.node.id)
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      factoryOutputs: [],
      inputVariables: input.node.inputVariables ?? ['factory_request', 'operation_video_results', 'selected_packages'],
      outputVariables: [...new Set([...outputVariables, ...outputVariablesBase])],
      message: summaryContent
    };
  }

  const targetPlatform = readFactoryRuntimePlatform(input.pool.get('target_platform'));
  const videoConfig = readFactoryRuntimeVideoGenerationConfig(factoryRequest);
  const referenceImages = readFactoryOperationReferenceImages(factoryRequest);
  const concurrency = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.concurrency ?? factoryRequest?.concurrency),
    3,
    1,
    8
  );
  const maxRetries = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.maxRetries ?? factoryRequest?.maxRetries),
    2,
    0,
    5
  );
  const batchTasks = createFactoryOperationVideoGenerationTasks({
    items: planItems,
    factoryRequest,
    targetPlatform,
    videoConfig,
    referenceImages,
    createdAt: input.createdAt
  });
  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_OPERATION_VIDEO_GENERATION_STARTED',
    `Operation video generation started: ${batchTasks.length} video task(s), concurrency=${concurrency}.`,
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  const batchRun = await runFactoryVideoGenerationTasksAdaptive({
    tasks: batchTasks,
    maxConcurrency: concurrency,
    worker: (task) => runFactoryVideoGenerationTask({
      task,
      node: input.node,
      profile: input.profile,
      modelInvoker: input.modelInvoker,
      maxRetries
    })
  });
  const localAssetSave = await persistFactoryRemoteAssetsLocally({
    task: input.task,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    results: batchRun.results,
    mediaKind: 'video',
    folder: 'operation-videos',
    createdAt: input.createdAt,
    logSuffix: `${input.node.id}-operation-videos`
  });
  const results = localAssetSave.results;
  const completed = results.filter((item) => item.status === 'completed').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const generatedVideos = results.map((item) => ({
    id: item.id,
    name: item.packageLabel,
    kind: 'video',
    uri: item.localPath ? `local://${item.localPath}` : item.remoteUrl,
    mimeType: 'video/mp4',
    remoteUrl: item.remoteUrl,
    localPath: item.localPath,
    thumbnailPath: item.thumbnailPath,
    sourceImagePath: item.sourceImagePath,
    sku: item.sku,
    packageKey: item.packageKey,
    packageLabel: item.packageLabel,
    status: item.status,
    error: item.error,
    errorType: item.errorType,
    attempts: item.attempts,
    providerJobId: item.providerJobId,
    providerStatus: item.providerStatus,
    durationSeconds: item.durationSeconds,
    videoRatio: item.videoRatio
  }));
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: JSON.stringify(results, null, 2),
    json: results,
    result: results,
    outputValue: generatedVideos
  });
  const factoryOutputs = buildFactoryOperationGeneratedVideoOutputItems({
    taskId: input.task.taskId,
    results,
    createdAt: input.createdAt
  });
  const usedToolIds = new Set<string>(localAssetSave.usedToolIds);
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  const extraLogs: DesktopExecutionLogEntry[] = [...localAssetSave.logs];
  const summaryContent = [
    `运营视频生成完成：共 ${batchTasks.length} 条视频`,
    `成功：${completed}`,
    `失败：${failed}`,
    `并发数：${batchRun.minConcurrency === batchRun.maxObservedConcurrency
      ? batchRun.maxObservedConcurrency
      : `${batchRun.minConcurrency}-${batchRun.maxObservedConcurrency}`}（上限 ${concurrency}）`,
    targetPlatform.label ? `平台：${targetPlatform.label}` : undefined,
    `时长：${videoConfig.durationSeconds} 秒`,
    `画幅：${videoConfig.ratio}`
  ].filter(Boolean).join('\n');

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.write_text_file')
  ) {
    const manifestResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'operation-videos',
        fileName: buildWorkflowArtifactFileName(input.task.title, '运营视频生成结果清单'),
        content: buildFactoryEcommerceVideoManifestContent({
          taskTitle: input.task.title,
          summary: summaryContent,
          results,
          createdAt: input.createdAt
        })
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (manifestResult.ok) {
      const artifact = buildGeneratedArtifactFromToolResult({
        taskId: input.task.taskId,
        toolId: 'local-filesystem',
        action: 'filesystem.write_text_file',
        output: manifestResult.output,
        createdAt: input.createdAt,
        sequence: 1
      });
      if (artifact) {
        generatedArtifacts.push({
          ...artifact,
          title: '运营视频生成结果清单.md'
        });
      }
    } else {
      extraLogs.push(createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_GENERATION_MANIFEST_FAILED',
        `Operation video generation manifest could not be written: ${manifestResult.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-manifest`)
      ));
    }
  }

  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);
  input.pool.set('operation_generated_videos', generatedVideos as unknown as WorkflowRuntimeValue);
  input.pool.set('operation_video_generation_summary', summaryContent);

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
        failed > 0 ? 'warning' : 'info',
        'WORKFLOW_RUNTIME_OPERATION_VIDEO_GENERATION_COMPLETED',
        `Operation video generation completed: completed=${completed}, failed=${failed}, total=${batchTasks.length}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-operation-video-generation`),
        {
          concurrency,
          minConcurrency: batchRun.minConcurrency,
          maxObservedConcurrency: batchRun.maxObservedConcurrency,
          concurrencyAdjustments: batchRun.concurrencyAdjustments,
          completed,
          failed,
          total: batchTasks.length,
          failedItems: results.filter((item) => item.status === 'failed').map((item) => ({
            sku: item.sku,
            title: item.packageLabel,
            error: item.error,
            errorType: item.errorType,
            attempts: item.attempts
          }))
        }
      )
    ],
    usedToolIds: [...usedToolIds],
    generatedArtifacts,
    factoryOutputs,
    inputVariables: ['factory_request', 'operation_video_results', 'selected_packages', 'target_platform'],
    outputVariables: [...new Set([...outputVariables, 'operation_generated_videos', 'operation_video_generation_summary'])],
    message: `Operation video generation finished: ${completed}/${batchTasks.length}, concurrency=${concurrency}.`
  };
}

async function invokeWorkflowRuntimeEcommerceProductVideoFactoryNode(input: {
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
  const factoryKind = readWorkflowRuntimeString(factoryRequest?.factoryKind);
  if (!isReferenceImageVideoFactoryRuntimeKind(factoryKind)) {
    return undefined;
  }

  const items = readFactoryRuntimeItems(input.pool.get('factory_items'));
  const packages = readFactoryRuntimePackages(input.pool.get('selected_packages'));
  if (items.length === 0 || packages.length === 0) {
    return undefined;
  }

  const targetPlatform = readFactoryRuntimePlatform(input.pool.get('target_platform'));
  const outputConfig = isWorkflowRuntimeRecord(factoryRequest?.output) ? factoryRequest.output : undefined;
  const outputFolder = readWorkflowRuntimeString(outputConfig?.folder) ?? 'product-videos';
  const videoConfig = readFactoryRuntimeVideoGenerationConfig(factoryRequest);
  const promptControls = readFactoryRuntimePromptControls(factoryRequest?.promptControls);
  const concurrency = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.concurrency ?? factoryRequest?.concurrency),
    3,
    1,
    8
  );
  const maxRetries = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.maxRetries ?? factoryRequest?.maxRetries),
    2,
    0,
    5
  );
  const batchTasks = createFactoryVideoGenerationTasks({
    items,
    packages,
    targetPlatform,
    promptControls,
    videoConfig,
    createdAt: input.createdAt
  });
  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_ECOMMERCE_VIDEO_FACTORY_STARTED',
    `Ecommerce video factory started: ${batchTasks.length} video task(s), concurrency=${concurrency}.`,
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  const batchRun = await runFactoryVideoGenerationTasksAdaptive({
    tasks: batchTasks,
    maxConcurrency: concurrency,
    worker: (task) => runFactoryVideoGenerationTask({
      task,
      node: input.node,
      profile: input.profile,
      modelInvoker: input.modelInvoker,
      maxRetries
    })
  });
  const localAssetSave = await persistFactoryRemoteAssetsLocally({
    task: input.task,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    results: batchRun.results,
    mediaKind: 'video',
    folder: outputFolder,
    createdAt: input.createdAt,
    logSuffix: `${input.node.id}-${sanitizeLogSuffix(outputFolder)}`
  });
  const results = localAssetSave.results;
  const completed = results.filter((item) => item.status === 'completed').length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const generatedVideos = results.map((item) => {
    const displayName = getFactoryImageResultDisplayName(item);
    const order = String(item.order || 1).padStart(2, '0');
    return {
      id: item.id,
      name: `${displayName}-${order}-${item.packageLabel}`,
      kind: 'video',
      uri: item.localPath ? `local://${item.localPath}` : item.remoteUrl,
      mimeType: 'video/mp4',
      remoteUrl: item.remoteUrl,
      localPath: item.localPath,
      thumbnailPath: item.thumbnailPath,
      sourceImagePath: item.sourceImagePath,
      sku: item.sku,
      sourceName: item.sourceName,
      packageKey: item.packageKey,
      packageLabel: item.packageLabel,
      status: item.status,
      error: item.error,
      errorType: item.errorType,
      attempts: item.attempts,
      providerJobId: item.providerJobId,
      providerStatus: item.providerStatus,
      durationSeconds: item.durationSeconds,
      videoRatio: item.videoRatio
    };
  });
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: JSON.stringify(results, null, 2),
    json: results,
    result: results,
    outputValue: generatedVideos
  });
  const factoryOutputs = buildFactoryEcommerceVideoOutputItems({
    taskId: input.task.taskId,
    factoryKind,
    results,
    createdAt: input.createdAt
  });
  const usedToolIds = new Set<string>(localAssetSave.usedToolIds);
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  const extraLogs: DesktopExecutionLogEntry[] = [...localAssetSave.logs];
  const summaryContent = [
    `${readWorkflowRuntimeString(factoryRequest?.factoryName) ?? '视频工厂'}生成完成：共 ${batchTasks.length} 条视频`,
    `成功：${completed}`,
    `失败：${failed}`,
    `并发数：${batchRun.minConcurrency === batchRun.maxObservedConcurrency
      ? batchRun.maxObservedConcurrency
      : `${batchRun.minConcurrency}-${batchRun.maxObservedConcurrency}`}（上限 ${concurrency}）`,
    `时长：${videoConfig.durationSeconds} 秒`,
    `画幅：${videoConfig.ratio}`
  ].filter(Boolean).join('\n');

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.write_text_file')
  ) {
    const manifestResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: outputFolder,
        fileName: buildWorkflowArtifactFileName(input.task.title, '视频生成结果清单'),
        content: buildFactoryEcommerceVideoManifestContent({
          taskTitle: input.task.title,
          summary: summaryContent,
          results,
          createdAt: input.createdAt
        })
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (manifestResult.ok) {
      const artifact = buildGeneratedArtifactFromToolResult({
        taskId: input.task.taskId,
        toolId: 'local-filesystem',
        action: 'filesystem.write_text_file',
        output: manifestResult.output,
        createdAt: input.createdAt,
        sequence: 1
      });
      if (artifact) {
        generatedArtifacts.push({
          ...artifact,
          title: '视频生成结果清单.md'
        });
      }
    } else {
      extraLogs.push(createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_ECOMMERCE_VIDEO_MANIFEST_FAILED',
        `Ecommerce video manifest could not be written: ${manifestResult.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-manifest`)
      ));
    }
  }

  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);
  input.pool.set('factory_generated_videos', generatedVideos as unknown as WorkflowRuntimeValue);
  input.pool.set('video_generation_summary', summaryContent);

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
        failed > 0 ? 'warning' : 'info',
        'WORKFLOW_RUNTIME_ECOMMERCE_VIDEO_FACTORY_COMPLETED',
        `Reference image video factory completed: completed=${completed}, failed=${failed}, total=${batchTasks.length}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-ecommerce-video-factory`),
        {
          concurrency,
          minConcurrency: batchRun.minConcurrency,
          maxObservedConcurrency: batchRun.maxObservedConcurrency,
          concurrencyAdjustments: batchRun.concurrencyAdjustments,
          completed,
          failed,
          total: batchTasks.length,
          failedItems: results.filter((item) => item.status === 'failed').map((item) => ({
            sku: item.sku,
            packageKey: item.packageKey,
            error: item.error,
            errorType: item.errorType,
            attempts: item.attempts
          }))
        }
      )
    ],
    usedToolIds: [...usedToolIds],
    generatedArtifacts,
    factoryOutputs,
    inputVariables: ['factory_request', 'factory_items', 'selected_packages', 'target_platform'],
    outputVariables: [...new Set([...outputVariables, 'factory_generated_videos', 'video_generation_summary'])],
    message: `Ecommerce video generation finished: ${completed}/${batchTasks.length}, concurrency=${concurrency}.`
  };
}

function completeWorkflowRuntimeFactoryOutputNode(input: {
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
  const factoryKind = readWorkflowRuntimeString(factoryRequest?.factoryKind);
  if (factoryKind === 'academic_project_demo_factory') {
    const summary = readWorkflowRuntimeString(input.pool.get('academic_demo_summary'));
    const config = input.pool.get('academic_demo_config');
    const demoPackage = input.pool.get('academic_demo_package');
    if (!summary || config === undefined) {
      return undefined;
    }

    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: summary,
      result: {
        config,
        package: demoPackage
      } as WorkflowRuntimeValue,
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
          'Academic demo factory output returned without an extra model call.',
          input.createdAt,
          sanitizeLogSuffix(input.node.id)
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables: input.node.inputVariables ?? ['academic_demo_config', 'academic_demo_package', 'academic_demo_summary'],
      outputVariables,
      message: 'Academic demo factory output returned without an extra model call.'
    };
  }

  if (isImageFactoryRuntimeKind(factoryKind)) {
    const generatedImages = input.pool.get('factory_generated_images');
    if (generatedImages === undefined) {
      return undefined;
    }

    const items = Array.isArray(generatedImages)
      ? generatedImages
      : isWorkflowRuntimeRecord(generatedImages) && Array.isArray(generatedImages.items)
        ? generatedImages.items
        : [];
    const completed = items.filter(
      (item) => isWorkflowRuntimeRecord(item) && readWorkflowRuntimeString(item.status) === 'completed'
    ).length;
    const failed = items.filter(
      (item) => isWorkflowRuntimeRecord(item) && readWorkflowRuntimeString(item.status) === 'failed'
    ).length;
    const qualityReport = input.pool.get('quality_report');
    const factoryName = readWorkflowRuntimeString(factoryRequest?.factoryName) ?? '图片工厂';
    const summary = [
      `${factoryName}已完成：${completed}/${items.length} 张图片`,
      `失败：${failed}`,
      qualityReport !== undefined ? '质检结果已生成。' : undefined
    ].filter(Boolean).join('\n');
    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: summary,
      result: generatedImages,
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
          'Image factory output returned without an extra model call.',
          input.createdAt,
          sanitizeLogSuffix(input.node.id),
          {
            completed,
            failed,
            total: items.length,
            qualityReportIncluded: qualityReport !== undefined
          }
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables: input.node.inputVariables ?? ['factory_generated_images', 'quality_report'],
      outputVariables,
      message: 'Image factory output returned without an extra model call.'
    };
  }

  if (factoryKind === 'operation_video_factory') {
    const operationSummary = readWorkflowRuntimeString(input.pool.get('operation_summary'));
    const videoGenerationSummary = readWorkflowRuntimeString(input.pool.get('operation_video_generation_summary'));
    const summary = [operationSummary, videoGenerationSummary].filter(Boolean).join('\n\n');
    const contentResults = input.pool.get('operation_video_results');
    const generatedVideos = input.pool.get('operation_generated_videos');
    if (!summary || contentResults === undefined) {
      return undefined;
    }

    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: summary,
      result: {
        operationVideoResults: contentResults,
        generatedVideos: generatedVideos ?? []
      },
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
          'Operation video factory output returned without an extra model call.',
          input.createdAt,
          sanitizeLogSuffix(input.node.id)
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables: input.node.inputVariables ?? ['operation_summary', 'operation_video_results', 'operation_generated_videos'],
      outputVariables,
      message: 'Operation video factory output returned without an extra model call.'
    };
  }

  if (isReferenceImageVideoFactoryRuntimeKind(factoryKind)) {
    const summary = readWorkflowRuntimeString(input.pool.get('video_generation_summary'));
    const results = input.pool.get('factory_generated_videos');
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
          'Reference image video factory output returned without an extra model call.',
          input.createdAt,
          sanitizeLogSuffix(input.node.id)
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables: input.node.inputVariables ?? ['video_generation_summary', 'factory_generated_videos'],
      outputVariables,
      message: 'Reference image video factory output returned without an extra model call.'
    };
  }

  if (factoryKind === 'ai_video_production_factory') {
    const summary = readWorkflowRuntimeString(input.pool.get('video_production_summary'));
    const result = input.pool.get('ai_video_production_result');
    if (!summary || result === undefined) {
      return undefined;
    }

    const outputVariables = writeWorkflowNodeOutputs({
      pool: input.pool,
      node: input.node,
      text: summary,
      result,
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
          'AI video production factory output returned without an extra model call.',
          input.createdAt,
          sanitizeLogSuffix(input.node.id)
        )
      ],
      usedToolIds: [],
      generatedArtifacts: [],
      inputVariables: input.node.inputVariables ?? ['video_production_summary', 'ai_video_production_result'],
      outputVariables,
      message: 'AI video production factory output returned without an extra model call.'
    };
  }

  if (factoryKind !== 'medical_case_video_screening_factory') {
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

async function invokeWorkflowRuntimeAcademicDemoExtractionNode(input: {
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
}): Promise<WorkflowRuntimeNodeResult | undefined> {
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'academic_project_demo_factory') {
    return undefined;
  }
  if (input.node.id !== 'extract_academic_sections') {
    return undefined;
  }

  const parameters = normalizeAcademicDemoParameters(factoryRequest?.demoParameters ?? factoryRequest);
  const materialFiles = readAcademicDemoRuntimeFiles(factoryRequest, input.pool.get('start.files')).slice(0, 5);
  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_ACADEMIC_DEMO_STARTED',
    `Academic demo factory started: ${materialFiles.length} material file(s).`,
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  const sourceResult = await extractAcademicDemoSources({
    task: input.task,
    files: materialFiles,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: input.createdAt,
    nodeId: input.node.id
  });
  const dataAnalysis = profileAcademicDemoTables({
    sources: sourceResult.sources,
    maxChartCount: parameters.maxChartCount
  });
  const modelResult = await runAcademicDemoStructuredExtractionModel({
    task: input.task,
    node: input.node,
    profile: input.profile,
    modelInvoker: input.modelInvoker,
    sources: sourceResult.sources,
    dataProfiles: dataAnalysis.dataProfiles,
    charts: dataAnalysis.charts,
    parameters,
    knowledgeSources: input.binding.availableKnowledgeSources,
    createdAt: input.createdAt
  });
  const demoId = `${input.task.taskId}-academic-demo`;
  const config = buildAcademicDemoConfig({
    demoId,
    generatedAt: input.createdAt,
    taskTitle: input.task.title,
    parameters,
    extraction: modelResult.extraction,
    sources: sourceResult.sources,
    dataProfiles: dataAnalysis.dataProfiles,
    charts: dataAnalysis.charts
  });
  const packageResult = await writeAcademicDemoPackageArtifacts({
    task: input.task,
    config,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    createdAt: input.createdAt
  });
  const summaryContent = [
    `AI学术Demo工厂完成：${config.project.name}`,
    `资料：${sourceResult.sources.length} 个`,
    `板块：${config.sections.length} 个`,
    `图表：${config.charts.length} 个`,
    `公式：${config.formulas.length} 条`,
    `待补充：${config.unresolvedItems.length} 项`,
    packageResult.htmlPath ? `演示页面：${packageResult.htmlPath}` : undefined,
    packageResult.zipPath ? `演示包：${packageResult.zipPath}` : undefined,
    modelResult.fallbackReason ? `模型提取提示：${modelResult.fallbackReason}` : undefined
  ].filter(Boolean).join('\n');
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: JSON.stringify(modelResult.extraction ?? {}, null, 2),
    json: modelResult.extraction as WorkflowRuntimeValue,
    result: modelResult.extraction as WorkflowRuntimeValue,
    outputValue: modelResult.extraction as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);
  input.pool.set('academic_materials', materialFiles as unknown as WorkflowRuntimeValue);
  input.pool.set('academic_sources', sourceResult.sources as unknown as WorkflowRuntimeValue);
  input.pool.set('academic_data_profiles', dataAnalysis.dataProfiles as unknown as WorkflowRuntimeValue);
  input.pool.set('academic_chart_specs', dataAnalysis.charts as unknown as WorkflowRuntimeValue);
  input.pool.set('academic_extraction', (modelResult.extraction ?? {}) as WorkflowRuntimeValue);
  input.pool.set('academic_demo_config', config as unknown as WorkflowRuntimeValue);
  input.pool.set('academic_demo_summary', summaryContent);
  input.pool.set('academic_demo_package', packageResult.packageValue as unknown as WorkflowRuntimeValue);

  const factoryOutputs = buildAcademicDemoFactoryOutputItems({
    taskId: input.task.taskId,
    config,
    htmlPath: packageResult.htmlPath,
    configPath: packageResult.configPath,
    reportPath: packageResult.reportPath,
    unresolvedPath: packageResult.unresolvedPath,
    dataSummaryPath: packageResult.dataSummaryPath,
    zipPath: packageResult.zipPath,
    createdAt: input.createdAt
  });

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.profile.providerName,
      modelName: input.profile.modelName,
      content: summaryContent
    }),
    primaryProfile: input.profile,
    logs: [
      startedLog,
      ...sourceResult.logs,
      ...modelResult.logs,
      ...packageResult.logs,
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_ACADEMIC_DEMO_COMPLETED',
        `Academic demo factory completed: sources=${config.sources.length}, sections=${config.sections.length}, charts=${config.charts.length}, formulas=${config.formulas.length}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-academic-demo`),
        {
          sources: config.sources.length,
          sections: config.sections.length,
          charts: config.charts.length,
          formulas: config.formulas.length,
          unresolvedItems: config.unresolvedItems.length,
          htmlPath: packageResult.htmlPath,
          zipPath: packageResult.zipPath
        }
      )
    ],
    usedToolIds: [...new Set([...sourceResult.usedToolIds, ...packageResult.usedToolIds])],
    generatedArtifacts: packageResult.generatedArtifacts,
    factoryOutputs,
    inputVariables: ['factory_request', 'start.files', 'knowledge_context'],
    outputVariables: [
      ...new Set([
        ...outputVariables,
        'academic_materials',
        'academic_sources',
        'academic_data_profiles',
        'academic_chart_specs',
        'academic_demo_config',
        'academic_demo_summary',
        'academic_demo_package'
      ])
    ],
    message: `Academic demo factory finished: sources=${config.sources.length}, artifacts=${packageResult.generatedArtifacts.length}.`
  };
}

function completeWorkflowRuntimeAcademicDemoPreparedNode(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
}): WorkflowRuntimeNodeResult | undefined {
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  if (readWorkflowRuntimeString(factoryRequest?.factoryKind) !== 'academic_project_demo_factory') {
    return undefined;
  }
  if (input.node.id !== 'build_demo_config' && input.node.id !== 'write_demo_package') {
    return undefined;
  }

  const summary = readWorkflowRuntimeString(input.pool.get('academic_demo_summary'));
  const config = input.pool.get('academic_demo_config');
  const packageValue = input.pool.get('academic_demo_package');
  if (!summary || config === undefined) {
    return undefined;
  }

  const outputValue = input.node.id === 'write_demo_package' ? packageValue ?? config : config;
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: summary,
    json: outputValue as WorkflowRuntimeValue,
    result: outputValue as WorkflowRuntimeValue,
    outputValue: outputValue as WorkflowRuntimeValue
  });
  input.pool.set('runtime.previous_text', summary);
  input.pool.set('runtime.last_model_node', input.node.id);

  return {
    response: {
      ...input.currentResponse,
      content: input.currentResponse.content || summary
    },
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_ACADEMIC_DEMO_PREPARED_NODE_COMPLETED',
        `Academic demo prepared node completed without extra ${input.node.type === 'tool' ? 'tool' : 'model'} invocation.`,
        input.createdAt,
        sanitizeLogSuffix(input.node.id)
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables,
    message: 'Academic demo prepared result reused.'
  };
}

interface AcademicDemoRuntimeFile {
  id: string;
  order: number;
  name: string;
  localPath: string;
  fileType: AcademicDemoSource['fileType'];
  size?: number;
}

function readAcademicDemoRuntimeFiles(
  factoryRequest: Record<string, unknown> | undefined,
  startFiles: WorkflowRuntimeValue | undefined
): AcademicDemoRuntimeFile[] {
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
    if (!localPath) {
      return [];
    }

    const name = readWorkflowRuntimeString(record.name)
      ?? getPathFileName(localPath)
      ?? `material-${index + 1}`;
    const fileType = readAcademicDemoFileType(name);
    if (!fileType) {
      return [];
    }

    return [{
      id: readWorkflowRuntimeString(record.id) ?? `academic-demo-source-${index + 1}`,
      order: index + 1,
      name,
      localPath,
      fileType,
      size: readFactoryRuntimeNumber(record.size ?? record.sizeBytes)
    }];
  }).slice(0, 5);
}

function readAcademicDemoFileType(nameOrPath: string): AcademicDemoSource['fileType'] | undefined {
  const extension = nameOrPath.split('.').at(-1)?.trim().toLowerCase();
  if (extension === 'docx') return 'docx';
  if (extension === 'pdf') return 'pdf';
  if (extension === 'xlsx') return 'xlsx';
  if (extension === 'csv') return 'csv';
  return undefined;
}

async function extractAcademicDemoSources(input: {
  task: DesktopTaskDetail;
  files: AcademicDemoRuntimeFile[];
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  nodeId: string;
}): Promise<{
  sources: AcademicDemoSource[];
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}> {
  const logs: DesktopExecutionLogEntry[] = [];
  const usedToolIds = new Set<string>();
  const canExtract =
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'office-document', 'document.extract_text');

  if (!canExtract && input.files.length > 0) {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_ACADEMIC_DEMO_EXTRACT_UNAVAILABLE',
        'Academic demo source extraction skipped because office-document/document.extract_text is unavailable.',
        input.createdAt,
        sanitizeLogSuffix(`${input.nodeId}-extract-unavailable`)
      )
    );
  }

  const sources: AcademicDemoSource[] = [];
  for (const file of input.files) {
    let text: string | undefined;
    let truncated = false;
    if (canExtract && input.desktopToolInvoker && input.workspaceId) {
      const result = await input.desktopToolInvoker({
        workspaceId: input.workspaceId,
        toolId: 'office-document',
        action: 'document.extract_text',
        input: {
          path: file.localPath,
          maxChars: file.fileType === 'xlsx' || file.fileType === 'csv' ? 80_000 : 24_000
        },
        allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
      });
      usedToolIds.add('office-document');
      if (result.ok) {
        text = readToolTextOutput(result.output);
        truncated = result.output?.truncated === true;
      } else {
        logs.push(
          createLog(
            input.task.taskId,
            'warning',
            'WORKFLOW_RUNTIME_ACADEMIC_DEMO_SOURCE_EXTRACT_FAILED',
            `Academic demo source extraction failed for ${file.name}: ${result.message ?? 'unknown error'}.`,
            input.createdAt,
            sanitizeLogSuffix(`${input.nodeId}-source-${file.order}`)
          )
        );
      }
    }

    sources.push({
      id: file.id,
      fileName: file.name,
      fileType: file.fileType,
      localPath: file.localPath,
      text,
      truncated,
      sizeBytes: file.size
    });
  }

  return {
    sources,
    logs,
    usedToolIds: [...usedToolIds]
  };
}

async function runAcademicDemoStructuredExtractionModel(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  sources: AcademicDemoSource[];
  dataProfiles: ReturnType<typeof profileAcademicDemoTables>['dataProfiles'];
  charts: ReturnType<typeof profileAcademicDemoTables>['charts'];
  parameters: ReturnType<typeof normalizeAcademicDemoParameters>;
  knowledgeSources: DesktopKnowledgeSourceSummary[];
  createdAt: string;
}): Promise<{
  extraction: unknown;
  logs: DesktopExecutionLogEntry[];
  fallbackReason?: string;
}> {
  const sourceText = input.sources
    .map((source) => [
      `File: ${source.fileName}`,
      `Type: ${source.fileType}`,
      source.text ? truncateForPrompt(source.text, 8_000) : 'No extracted text.'
    ].join('\n'))
    .join('\n\n---\n\n')
    .slice(0, 40_000);
  const tableProfileText = JSON.stringify(input.dataProfiles.slice(0, 8), null, 2).slice(0, 16_000);
  const knowledgeContext = input.knowledgeSources
    .map((source) => formatKnowledgeSourceForPrompt(source))
    .join('\n---\n')
    .slice(0, 16_000);
  const messages: DesktopModelChatMessage[] = [
    {
      role: 'system',
      content: [
        'You are the structured extraction node for QiuAI WorkOS AI学术Demo工厂.',
        'Return valid JSON only. Do not add markdown fences.',
        'Be conservative: only extract claims, formulas, datasets, metrics, conclusions, teams, and organizations that have clear evidence in the provided sources.',
        'Use exactly five section types: cover, research_background, method_model, data_analysis, conclusion_value. Put formulas under method_model. Put dataset details, charts, experiment comparisons, and interactive demo content under data_analysis.',
        'If a section is unclear, put it into unresolvedItems. Never invent data, formulas, citations, organizations, methods, or experiment results.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Task title: ${input.task.title}`,
        `Parameters: ${JSON.stringify(input.parameters, null, 2)}`,
        `Knowledge context:\n${knowledgeContext || 'none'}`,
        `Table profiles:\n${tableProfileText || 'none'}`,
        `Source text:\n${sourceText || 'none'}`,
        'Expected JSON shape:',
        JSON.stringify(input.node.config?.schema ?? {}, null, 2)
      ].join('\n\n')
    }
  ];

  try {
    const response = await input.modelInvoker({
      profile: input.profile,
      messages,
      timeoutMs: readWorkflowRuntimeModelTimeoutMs(input.node.config?.timeoutMs)
    });
    const parsed = parseWorkflowRuntimeJson(response.content);
    if (parsed === undefined) {
      return {
        extraction: {},
        fallbackReason: '模型返回内容不是可解析 JSON，已生成保守空草稿。',
        logs: [
          createLog(
            input.task.taskId,
            'warning',
            'WORKFLOW_RUNTIME_ACADEMIC_DEMO_MODEL_JSON_FALLBACK',
            'Academic demo extraction model did not return parseable JSON; fallback config will be used.',
            input.createdAt,
            sanitizeLogSuffix(`${input.node.id}-model-json-fallback`)
          )
        ]
      };
    }

    return {
      extraction: parsed,
      logs: [
        createLog(
          input.task.taskId,
          'info',
          'WORKFLOW_RUNTIME_ACADEMIC_DEMO_MODEL_INVOKED',
          `Academic demo extraction model invoked via ${input.profile.providerName}/${input.profile.modelName}.`,
          input.createdAt,
          sanitizeLogSuffix(`${input.node.id}-model`)
        )
      ]
    };
  } catch (error) {
    const fallbackReason = readErrorMessage(error);
    return {
      extraction: {},
      fallbackReason,
      logs: [
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_ACADEMIC_DEMO_MODEL_FAILED_FALLBACK',
          `Academic demo extraction model failed; fallback config will be used: ${fallbackReason}`,
          input.createdAt,
          sanitizeLogSuffix(`${input.node.id}-model-failed`)
        )
      ]
    };
  }
}

async function writeAcademicDemoPackageArtifacts(input: {
  task: DesktopTaskDetail;
  config: AcademicDemoConfig;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
}): Promise<{
  generatedArtifacts: DesktopArtifactSummary[];
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  packageValue: Record<string, unknown>;
  configPath?: string;
  htmlPath?: string;
  reportPath?: string;
  unresolvedPath?: string;
  dataSummaryPath?: string;
  zipPath?: string;
}> {
  const generatedArtifacts: DesktopArtifactSummary[] = [];
  const logs: DesktopExecutionLogEntry[] = [];
  const usedToolIds = new Set<string>();
  const packageFiles: Array<{ localPath: string; archivePath?: string }> = [];
  const packageValue: Record<string, unknown> = {
    demoId: input.config.demoId,
    factoryKind: 'academic_project_demo_factory',
    createdAt: input.createdAt
  };
  let sequence = 1;

  const pushArtifact = (
    toolId: string,
    action: DesktopToolInvocationAction,
    output: Record<string, unknown> | undefined,
    title: string,
    archivePath?: string,
    options?: { expose?: boolean; includeInZip?: boolean }
  ) => {
    const artifact = buildGeneratedArtifactFromToolResult({
      taskId: input.task.taskId,
      toolId,
      action,
      output,
      createdAt: input.createdAt,
      sequence
    });
    sequence += 1;
    if (!artifact) {
      return undefined;
    }
    const titledArtifact = { ...artifact, title };
    if (options?.expose !== false) {
      generatedArtifacts.push(titledArtifact);
    }
    if (artifact.localPath && options?.includeInZip !== false) {
      packageFiles.push({ localPath: artifact.localPath, archivePath: archivePath ?? title });
    }
    return titledArtifact.localPath;
  };

  const canWriteText =
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.write_text_file');
  if (canWriteText && input.desktopToolInvoker && input.workspaceId) {
    const baseName = buildWorkflowArtifactFileName(input.task.title, 'academic-demo');
    const configResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'academic-demo',
        fileName: `${baseName}-demo-config.json`,
        content: JSON.stringify(input.config, null, 2)
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (configResult.ok) {
      packageValue.configPath = pushArtifact(
        'local-filesystem',
        'filesystem.write_text_file',
        configResult.output,
        'demo-config.json',
        'demo-config.json',
        { expose: false }
      );
    } else {
      logs.push(createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_ACADEMIC_DEMO_CONFIG_WRITE_FAILED', configResult.message ?? 'demo-config write failed.', input.createdAt));
    }

    const htmlResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'academic-demo',
        fileName: `${baseName}-demo.html`,
        content: renderAcademicDemoHtml(input.config)
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    if (htmlResult.ok) {
      packageValue.htmlPath = pushArtifact('local-filesystem', 'filesystem.write_text_file', htmlResult.output, 'Demo演示页面.html', 'demo.html');
    } else {
      logs.push(createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_ACADEMIC_DEMO_HTML_WRITE_FAILED', htmlResult.message ?? 'demo html write failed.', input.createdAt));
    }

    const reportResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'academic-demo',
        fileName: `${baseName}-识别报告`,
        content: renderAcademicDemoReport(input.config)
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    if (reportResult.ok) {
      packageValue.reportPath = pushArtifact(
        'local-filesystem',
        'filesystem.write_text_file',
        reportResult.output,
        '识别报告.md',
        'reports/识别报告.md',
        { expose: false }
      );
    }

    const unresolvedResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.write_text_file',
      input: {
        folder: 'academic-demo',
        fileName: `${baseName}-待补充内容`,
        content: renderAcademicDemoUnresolvedMarkdown(input.config)
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    if (unresolvedResult.ok) {
      packageValue.unresolvedPath = pushArtifact(
        'local-filesystem',
        'filesystem.write_text_file',
        unresolvedResult.output,
        '待补充内容.md',
        'reports/待补充内容.md',
        { expose: false }
      );
    }
  } else {
    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_ACADEMIC_DEMO_TEXT_WRITE_UNAVAILABLE',
        'Academic demo local text artifacts were not written because local-filesystem/filesystem.write_text_file is unavailable.',
        input.createdAt
      )
    );
  }

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'office-document', 'spreadsheet.write_xlsx') &&
    input.config.dataProfiles.length > 0
  ) {
    const dataSummaryResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'office-document',
      action: 'spreadsheet.write_xlsx',
      input: {
        title: '学术Demo数据分析摘要',
        folder: 'academic-demo',
        fileName: buildWorkflowArtifactFileName(input.task.title, '数据分析摘要'),
        sheets: [
          {
            name: '数据概况',
            rows: buildAcademicDataProfileRows(input.config.dataProfiles)
          }
        ]
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('office-document');
    if (dataSummaryResult.ok) {
      packageValue.dataSummaryPath = pushArtifact(
        'office-document',
        'spreadsheet.write_xlsx',
        dataSummaryResult.output,
        '数据分析摘要.xlsx',
        'spreadsheets/数据分析摘要.xlsx',
        { expose: false }
      );
    } else {
      logs.push(createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_ACADEMIC_DEMO_DATA_XLSX_FAILED', dataSummaryResult.message ?? 'data summary xlsx write failed.', input.createdAt));
    }
  }

  if (
    input.desktopToolInvoker &&
    input.workspaceId &&
    hasFactoryToolAction(input.binding, 'local-filesystem', 'filesystem.package_zip') &&
    packageFiles.length > 0
  ) {
    const zipResult = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'local-filesystem',
      action: 'filesystem.package_zip',
      input: {
        folder: 'academic-demo',
        fileName: buildWorkflowArtifactFileName(input.task.title, '学术Demo演示包'),
        files: packageFiles,
        manifest: {
          title: input.config.project.name,
          factoryKind: 'academic_project_demo_factory',
          demoId: input.config.demoId,
          createdAt: input.createdAt,
          sectionCount: input.config.sections.length,
          chartCount: input.config.charts.length,
          formulaCount: input.config.formulas.length,
          unresolvedItemCount: input.config.unresolvedItems.length
        }
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    usedToolIds.add('local-filesystem');
    if (zipResult.ok) {
      packageValue.zipPath = pushArtifact(
        'local-filesystem',
        'filesystem.package_zip',
        zipResult.output,
        '学术Demo演示包.zip',
        '学术Demo演示包.zip',
        { includeInZip: false }
      );
    } else {
      logs.push(createLog(input.task.taskId, 'warning', 'WORKFLOW_RUNTIME_ACADEMIC_DEMO_ZIP_FAILED', zipResult.message ?? 'academic demo zip write failed.', input.createdAt));
    }
  }

  return {
    generatedArtifacts,
    logs,
    usedToolIds: [...usedToolIds],
    packageValue,
    configPath: readWorkflowRuntimeString(packageValue.configPath),
    htmlPath: readWorkflowRuntimeString(packageValue.htmlPath),
    reportPath: readWorkflowRuntimeString(packageValue.reportPath),
    unresolvedPath: readWorkflowRuntimeString(packageValue.unresolvedPath),
    dataSummaryPath: readWorkflowRuntimeString(packageValue.dataSummaryPath),
    zipPath: readWorkflowRuntimeString(packageValue.zipPath)
  };
}

function buildAcademicDemoFactoryOutputItems(input: {
  taskId: string;
  config: AcademicDemoConfig;
  htmlPath?: string;
  configPath?: string;
  reportPath?: string;
  unresolvedPath?: string;
  dataSummaryPath?: string;
  zipPath?: string;
  createdAt: string;
}): FactoryOutputItem[] {
  const items: FactoryOutputItem[] = [];
  const push = (item: Omit<FactoryOutputItem, 'factoryKind' | 'originalStatus' | 'auditTrail' | 'createdAt' | 'updatedAt'>) => {
    items.push({
      factoryKind: 'academic_project_demo_factory',
      originalStatus: item.status,
      auditTrail: [],
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
      ...item
    });
  };

  push({
    id: `${input.taskId}-academic-demo-entry`,
    kind: 'artifact',
    title: 'Demo演示页面',
    status: input.htmlPath ? 'qualified' : 'processing_error',
    outputPath: input.htmlPath,
    summary: input.htmlPath ? '点击预览可启动本地 Demo 页面。' : '演示页面未写入，请检查本地文件工具。',
    metadata: { order: 1, action: 'launch_demo', configPath: input.configPath, packagePath: input.zipPath }
  });
  if (input.zipPath) {
    push({
      id: `${input.taskId}-academic-demo-zip`,
      kind: 'artifact',
      title: '本地演示包 ZIP',
      status: 'qualified',
      outputPath: input.zipPath,
      summary: '包含 Demo 页面、demo-config、识别报告、待补充内容和数据摘要。',
      metadata: { order: 2 }
    });
  }

  return items;
}

async function invokeWorkflowRuntimeSingleMediaGenerationNode(input: {
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
  profile: ModelProfile;
  mediaKind: 'image' | 'video';
}): Promise<WorkflowRuntimeNodeResult | undefined> {
  const taskType = readWorkflowRuntimeString(input.node.config?.llmTaskType);
  if (input.mediaKind === 'image' && !['image_generation', 'image_editing'].includes(taskType ?? '')) {
    return undefined;
  }
  if (input.mediaKind === 'video' && taskType !== 'video_generation') {
    return undefined;
  }

  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  const hasFactoryContext =
    Boolean(readWorkflowRuntimeString(factoryRequest?.factoryKind)) ||
    readFactoryRuntimeItems(input.pool.get('factory_items')).length > 0 ||
    readFactoryRuntimePackages(input.pool.get('selected_packages')).length > 0;
  if (hasFactoryContext) {
    return undefined;
  }

  const variables = resolveWorkflowVariableRefs(
    input.pool,
    input.node.inputVariables,
    getWorkflowRuntimeFallbackInputRefs(input.pool)
  );
  const sourceImage = findFirstWorkflowRuntimeImageFile([
    ...variables,
    { ref: 'start.images', value: input.pool.get('start.images') ?? [] }
  ]);
  const configuredAspectRatio =
    readWorkflowRuntimeString(input.node.config?.aspectRatio) ??
    readWorkflowRuntimeString(input.node.config?.imageRatio) ??
    readWorkflowRuntimeString(input.node.config?.videoRatio) ??
    (input.mediaKind === 'image' ? '1:1' : '9:16');
  const aspectRatio = inferSingleMediaAspectRatio(input.task.input, configuredAspectRatio);
  const configuredDurationSeconds = readWorkflowRuntimeNumber(input.node.config?.durationSeconds, 6);
  const durationSeconds = input.mediaKind === 'video'
    ? inferSingleVideoDurationSeconds(input.task.input, configuredDurationSeconds)
    : undefined;
  const prompt = buildSingleMediaGenerationPrompt({
    task: input.task,
    node: input.node,
    variables,
    mediaKind: input.mediaKind,
    aspectRatio,
    durationSeconds,
    sourceImage
  });
  const messages = buildSingleMediaGenerationMessages({
    task: input.task,
    node: input.node,
    variables,
    mediaKind: input.mediaKind,
    prompt,
    aspectRatio,
    durationSeconds,
    sourceImage
  });
  const timeoutMs = normalizeSingleMediaGenerationTimeoutMs(
    input.node.config?.timeoutMs,
    input.mediaKind === 'image' ? 180_000 : 240_000
  );
  const response = await input.modelInvoker(
    input.mediaKind === 'image'
      ? {
          profile: input.profile,
          taskKind: 'image_generation',
          imageGeneration: {
            prompt,
            sourceImagePath: sourceImage?.localPath,
            aspectRatio,
            responseFormat: 'url'
          },
          messages,
          timeoutMs
        }
      : {
          profile: input.profile,
          taskKind: 'video_generation',
          videoGeneration: {
            prompt,
            sourceImagePath: sourceImage?.localPath,
            durationSeconds,
            aspectRatio,
            responseFormat: 'url'
          },
          messages,
          timeoutMs
        }
  );
  const mediaResult = input.mediaKind === 'image'
    ? readFactoryImageGenerationResponse(response)
    : readFactoryVideoGenerationResponse(response);
  if (!mediaResult.remoteUrl && !mediaResult.localPath) {
    throw new Error(`Single ${input.mediaKind} generation response did not include a remoteUrl or localPath.`);
  }

  let resolvedMediaResult = mediaResult;
  let usedDownloadTool = false;
  if (
    resolvedMediaResult.remoteUrl &&
    !resolvedMediaResult.localPath &&
    input.desktopToolInvoker &&
    input.workspaceId &&
    canUseFactoryRemoteAssetDownload(input.binding)
  ) {
    try {
      const downloadResult = await input.desktopToolInvoker({
        workspaceId: input.workspaceId,
        toolId: 'local-filesystem',
        action: 'filesystem.download_remote_file',
        input: {
          url: resolvedMediaResult.remoteUrl,
          folder: input.mediaKind === 'image' ? 'generated-images' : 'generated-videos',
          fileName: buildWorkflowArtifactFileName(input.task.title, input.node.name),
          mediaKind: input.mediaKind
        }
      });
      const localPath = readWorkflowRuntimeString(downloadResult.output?.localPath);
      if (downloadResult.ok && localPath) {
        usedDownloadTool = true;
        resolvedMediaResult = {
          ...resolvedMediaResult,
          localPath,
          thumbnailPath: input.mediaKind === 'image' ? localPath : resolvedMediaResult.thumbnailPath
        };
      }
    } catch {
      // Keep the remote result when the local download is unavailable.
    }
  }

  const outputPayload = {
    kind: input.mediaKind,
    remoteUrl: resolvedMediaResult.remoteUrl,
    localPath: resolvedMediaResult.localPath,
    thumbnailPath: resolvedMediaResult.thumbnailPath,
    providerJobId: resolvedMediaResult.providerJobId,
    providerStatus: resolvedMediaResult.providerStatus,
    aspectRatio,
    durationSeconds,
    sourceImagePath: sourceImage?.localPath,
    prompt
  };
  const summaryContent = [
    input.mediaKind === 'image' ? '图片生成完成。' : '视频生成完成。',
    `画幅：${aspectRatio}`,
    durationSeconds ? `时长：${durationSeconds} 秒` : undefined,
    sourceImage?.localPath ? '已使用参考图。' : undefined,
    resolvedMediaResult.remoteUrl
      ? resolvedMediaResult.localPath
        ? '远程结果已保存到本地。'
        : '已获得远程结果，正在保存到本地。'
      : undefined,
    resolvedMediaResult.localPath ? `本地文件：${resolvedMediaResult.localPath}` : undefined
  ].filter(Boolean).join('\n');
  const generatedArtifact: DesktopArtifactSummary = {
    id: `${input.task.taskId}-single-${input.mediaKind}-${Date.parse(input.createdAt) || Date.now()}`,
    type: input.mediaKind,
    title: `${input.task.title} ${input.mediaKind === 'image' ? '图片结果' : '视频结果'}`,
    content: summaryContent,
    createdAt: input.createdAt,
    remoteUrl: resolvedMediaResult.remoteUrl,
    localPath: resolvedMediaResult.localPath,
    format: input.mediaKind === 'image' ? 'png' : 'mp4',
    mimeType: input.mediaKind === 'image' ? 'image/png' : 'video/mp4'
  };
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: JSON.stringify(outputPayload, null, 2),
    json: outputPayload,
    result: outputPayload,
    outputValue: outputPayload
  });
  input.pool.set('runtime.previous_text', summaryContent);
  input.pool.set('runtime.last_model_node', input.node.id);

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: response.provider,
      modelName: response.modelName,
      content: summaryContent,
      artifacts: response.artifacts
    }),
    primaryProfile: input.profile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
          input.mediaKind === 'image'
            ? 'WORKFLOW_RUNTIME_SINGLE_IMAGE_GENERATED'
            : 'WORKFLOW_RUNTIME_SINGLE_VIDEO_GENERATED',
          input.mediaKind === 'image'
            ? 'Single image generation completed.'
            : 'Single video generation completed.',
          input.createdAt,
          sanitizeLogSuffix(input.node.id),
          {
            hasRemoteUrl: Boolean(resolvedMediaResult.remoteUrl),
            hasLocalPath: Boolean(resolvedMediaResult.localPath),
            aspectRatio,
            durationSeconds
          }
        )
      ],
    usedToolIds: usedDownloadTool ? ['local-filesystem'] : [],
    generatedArtifacts: [generatedArtifact],
    inputVariables: variables.map((variable) => variable.ref),
    outputVariables,
    message: input.mediaKind === 'image' ? 'Single image generated.' : 'Single video generated.'
  };
}

function buildSingleMediaGenerationPrompt(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>;
  mediaKind: 'image' | 'video';
  aspectRatio: string;
  durationSeconds?: number;
  sourceImage?: WorkflowFileValue;
}): string {
  return [
    input.node.instruction,
    input.mediaKind === 'image'
      ? '生成单张图片，不做批量任务。'
      : '生成单条短视频，不做批量任务。',
    `画幅比例：${input.aspectRatio}`,
    input.durationSeconds ? `视频时长：${input.durationSeconds} 秒` : undefined,
    input.sourceImage?.localPath ? `参考图路径：${input.sourceImage.localPath}` : undefined,
    '用户需求：',
    input.task.input,
    '上下文：',
    renderWorkflowVariableRefsForPrompt(input.variables, 8_000),
    '要求：只生成一个结果；保持用户明确要求；不要添加无依据的品牌、文字、人物身份或功能效果。'
  ].filter(Boolean).join('\n');
}

function buildSingleMediaGenerationMessages(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>;
  mediaKind: 'image' | 'video';
  prompt: string;
  aspectRatio: string;
  durationSeconds?: number;
  sourceImage?: WorkflowFileValue;
}): DesktopModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        input.mediaKind === 'image'
          ? 'You are a QiuAI WorkOS single image generation executor.'
          : 'You are a QiuAI WorkOS single video generation executor.',
        input.mediaKind === 'image'
          ? 'Generate exactly one image for the user request.'
          : 'Generate exactly one short video for the user request.',
        input.mediaKind === 'image'
          ? 'Return JSON only: {"remoteUrl":"https://...","thumbnailPath":"https://..."} or {"localPath":"C:\\\\...\\\\image.png"}.'
          : 'Return JSON only: {"remoteUrl":"https://...","thumbnailPath":"https://..."} or {"localPath":"C:\\\\...\\\\video.mp4"}.',
        'Do not return binary data, base64, markdown, or multiple results.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Task title: ${input.task.title}`,
        `Aspect ratio: ${input.aspectRatio}`,
        input.durationSeconds ? `Duration seconds: ${input.durationSeconds}` : undefined,
        input.sourceImage?.localPath ? `Reference image local path: ${input.sourceImage.localPath}` : undefined,
        'Prompt:',
        input.prompt
      ].filter(Boolean).join('\n')
    }
  ];
}

function findFirstWorkflowRuntimeImageFile(
  variables: Array<{ ref: string; value: WorkflowRuntimeValue | undefined }>
): WorkflowFileValue | undefined {
  for (const variable of variables) {
    const image = readWorkflowRuntimeFiles(variable.value)
      .find((file) => file.kind === 'image' || Boolean(inferFactoryImageMimeType(file.name)));
    if (image?.localPath) {
      return image;
    }
  }

  return undefined;
}

function inferSingleMediaAspectRatio(text: string, fallback: string): string {
  const normalized = text.replace(/：/g, ':');
  const match = normalized.match(/\b(?:1:1|3:4|4:3|9:16|16:9|21:9|2:3|3:2)\b/);
  return match?.[0] ?? fallback;
}

function inferSingleVideoDurationSeconds(text: string, fallback: number): number {
  const match = text.match(/(\d{1,2})(?:\s*)(?:秒|s|sec|seconds?)/i);
  const duration = match ? Number(match[1]) : fallback;
  if (!Number.isFinite(duration)) {
    return fallback;
  }

  return Math.min(30, Math.max(1, Math.round(duration)));
}

function buildQueuedFactoryImageGenerationResult(task: FactoryImageGenerationTask): FactoryImageGenerationResult {
  return {
    id: task.id,
    order: task.order,
    sku: task.sku,
    sourceName: task.sourceName,
    packageKey: task.packageKey,
    packageLabel: task.packageLabel,
    imageSize: task.imageSize,
    status: 'queued',
    sourceImagePath: task.sourceImage.localPath,
    prompt: task.prompt,
    attempts: 0,
    createdAt: task.createdAt
  };
}

function buildFactoryImageBatchArtifact(input: {
  task: DesktopTaskDetail;
  artifactId: string;
  createdAt: string;
  targetPlatform: FactoryRuntimePlatform;
  concurrency: number;
  total: number;
  results: FactoryImageGenerationResult[];
  minConcurrency?: number;
  maxObservedConcurrency?: number;
  completedRun?: boolean;
}): {
  artifact: DesktopArtifactSummary;
  summaryContent: string;
  completed: number;
  failed: number;
} {
  const completed = input.results.filter((item) => item.status === 'completed').length;
  const failed = input.results.filter((item) => item.status === 'failed').length;
  const running = input.results.filter((item) => item.status === 'running').length;
  const queued = input.results.filter((item) => item.status === 'queued').length;
  const concurrencyLabel =
    input.minConcurrency !== undefined &&
    input.maxObservedConcurrency !== undefined &&
    input.minConcurrency !== input.maxObservedConcurrency
      ? `${input.minConcurrency}-${input.maxObservedConcurrency}`
      : String(input.maxObservedConcurrency ?? input.concurrency);
  const summaryContent = [
    input.completedRun
      ? `数字工厂图片批次完成：${completed}/${input.total}`
      : `数字工厂图片批次进度：${completed}/${input.total}`,
    failed > 0 ? `失败：${failed}` : '失败：0',
    running > 0 ? `生成中：${running}` : undefined,
    queued > 0 ? `等待中：${queued}` : undefined,
    `并发数：${concurrencyLabel}（上限 ${input.concurrency}）`,
    input.targetPlatform.label ? `图片比例：${input.targetPlatform.label}` : undefined
  ].filter(Boolean).join('\n');
  const preview = {
    kind: 'digital_factory_image_batch' as const,
    title: input.task.title,
    platformLabel: input.targetPlatform.label,
    concurrency: input.concurrency,
    total: input.total,
    completed,
    failed,
    items: input.results
  };

  return {
    completed,
    failed,
    summaryContent,
    artifact: {
      id: input.artifactId,
      type: 'image',
      title: `${input.task.title} 图片结果`,
      content: summaryContent,
      createdAt: input.createdAt,
      remoteUrl: input.results.find((item) => item.remoteUrl)?.remoteUrl,
      localPath: input.results.find((item) => item.localPath)?.localPath,
      factoryPreview: preview
    }
  };
}

function normalizeSingleMediaGenerationTimeoutMs(value: unknown, fallback: number): number {
  const timeoutMs = readWorkflowRuntimeNumber(value, fallback);
  return Math.min(300_000, Math.max(10_000, Math.round(timeoutMs)));
}

async function invokeWorkflowRuntimeFactoryImageGenerationNode(input: {
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
  emitProgress?: WorkflowRuntimeNodeProgressEmitter;
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
  const outputConfig = isWorkflowRuntimeRecord(factoryRequest?.output) ? factoryRequest.output : undefined;
  const outputFolder = readWorkflowRuntimeString(outputConfig?.folder) ?? 'product-images';
  const promptControls = readFactoryRuntimePromptControls(factoryRequest?.promptControls);
  const packageInstructions = readFactoryRuntimePackageInstructions(input.pool.get('package_instructions'));
  const concurrency = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.concurrency ?? factoryRequest?.concurrency),
    8,
    1,
    16
  );
  const maxRetries = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.node.config?.maxRetries ?? factoryRequest?.maxRetries),
    0,
    0,
    5
  );
  const batchTasks = createFactoryImageGenerationTasks({
    items,
    packages,
    targetPlatform,
    promptControls,
    packageInstructions,
    createdAt: input.createdAt
  });
  const artifactId = `${input.task.taskId}-factory-preview-${Date.parse(input.createdAt) || Date.now()}`;
  let streamingResults = batchTasks.map(buildQueuedFactoryImageGenerationResult);
  const streamingLocalSaveLogs: DesktopExecutionLogEntry[] = [];
  const streamingUsedToolIds = new Set<string>();
  let streamingSavedCount = 0;

  const emitBatchPreview = async (options?: {
    completedRun?: boolean;
    minConcurrency?: number;
    maxObservedConcurrency?: number;
  }) => {
    if (!input.emitProgress) {
      return;
    }

    const { artifact } = buildFactoryImageBatchArtifact({
      task: input.task,
      artifactId,
      createdAt: input.createdAt,
      targetPlatform,
      concurrency,
      total: batchTasks.length,
      results: streamingResults,
      minConcurrency: options?.minConcurrency,
      maxObservedConcurrency: options?.maxObservedConcurrency,
      completedRun: options?.completedRun
    });
    await input.emitProgress({
      updatedAt: input.createdAt,
      artifacts: [artifact],
      state: 'running',
      currentRunStatus: 'running'
    });
  };

  const saveAndPublishResult: FactoryImageGenerationResultUpdateHandler = async (result) => {
    const resultIndex = streamingResults.findIndex((item) => item.id === result.id);
    const previousResult = resultIndex >= 0 ? streamingResults[resultIndex] : undefined;
    let nextResult = result;

    if (nextResult.status === 'completed' && nextResult.remoteUrl && !nextResult.localPath) {
      const localSave = await persistFactoryRemoteAssetsLocally({
        task: input.task,
        binding: input.binding,
        desktopToolInvoker: input.desktopToolInvoker,
        workspaceId: input.workspaceId,
        results: [nextResult],
        mediaKind: 'image',
        folder: outputFolder,
        createdAt: input.createdAt,
        logSuffix: `${input.node.id}-${sanitizeLogSuffix(outputFolder)}-${sanitizeLogSuffix(nextResult.id)}`,
        includeSuccessLog: false
      });
      nextResult = localSave.results[0] ?? nextResult;
      streamingLocalSaveLogs.push(...localSave.logs);
      for (const toolId of localSave.usedToolIds) {
        streamingUsedToolIds.add(toolId);
      }
      if (!previousResult?.localPath && Boolean(nextResult.localPath)) {
        streamingSavedCount += 1;
      }
    }

    if (resultIndex >= 0) {
      streamingResults[resultIndex] = nextResult;
    } else {
      streamingResults = [...streamingResults, nextResult];
    }
    await emitBatchPreview();
    return nextResult;
  };

  const startedLog = createLog(
    input.task.taskId,
    'info',
    'WORKFLOW_RUNTIME_FACTORY_BATCH_STARTED',
    `Factory image batch started: ${batchTasks.length} image task(s), concurrency=${concurrency}.`,
    input.createdAt,
    sanitizeLogSuffix(input.node.id)
  );
  await emitBatchPreview();

  const batchRun = isAsyncPolledFactoryImageModelProfile(input.profile)
    ? await runFactoryImageGenerationTasksWithProviderPolling({
        tasks: batchTasks,
        maxConcurrency: concurrency,
        node: input.node,
        profile: input.profile,
        modelInvoker: input.modelInvoker,
        maxRetries,
        onResultUpdate: saveAndPublishResult
      })
    : await runFactoryImageGenerationTasksAdaptive({
        tasks: batchTasks,
        maxConcurrency: concurrency,
        worker: async (task) => saveAndPublishResult(
          await runFactoryImageGenerationTask({
            task,
            node: input.node,
            profile: input.profile,
            modelInvoker: input.modelInvoker,
            maxRetries
          }),
          'completed'
        )
      });
  const localAssetSave = await persistFactoryRemoteAssetsLocally({
    task: input.task,
    binding: input.binding,
    desktopToolInvoker: input.desktopToolInvoker,
    workspaceId: input.workspaceId,
    results: batchRun.results,
    mediaKind: 'image',
    folder: outputFolder,
    createdAt: input.createdAt,
    logSuffix: `${input.node.id}-${sanitizeLogSuffix(outputFolder)}`
  });
  streamingResults = localAssetSave.results;
  for (const toolId of localAssetSave.usedToolIds) {
    streamingUsedToolIds.add(toolId);
  }
  await emitBatchPreview({
    completedRun: true,
    minConcurrency: batchRun.minConcurrency,
    maxObservedConcurrency: batchRun.maxObservedConcurrency
  });
  const results = streamingResults;
  const {
    artifact,
    summaryContent,
    completed,
    failed
  } = buildFactoryImageBatchArtifact({
    task: input.task,
    artifactId,
    createdAt: input.createdAt,
    targetPlatform,
    concurrency,
    total: batchTasks.length,
    results,
    minConcurrency: batchRun.minConcurrency,
    maxObservedConcurrency: batchRun.maxObservedConcurrency,
    completedRun: true
  });
  const generatedImages = results.map((item) => {
    const displayName = getFactoryImageResultDisplayName(item);
    const order = String(item.order || 1).padStart(2, '0');
    return {
      id: item.id,
      name: `${displayName}-${order}-${item.packageLabel}`,
      kind: 'image',
      uri: item.localPath ? `local://${item.localPath}` : item.remoteUrl,
      mimeType: 'image/png',
      remoteUrl: item.remoteUrl,
      localPath: item.localPath,
      thumbnailPath: item.thumbnailPath,
      sourceImagePath: item.sourceImagePath,
      sku: item.sku,
      sourceName: item.sourceName,
      packageKey: item.packageKey,
      packageLabel: item.packageLabel,
      status: item.status,
      error: item.error,
      errorType: item.errorType,
      attempts: item.attempts,
      providerJobId: item.providerJobId,
      providerStatus: item.providerStatus
    };
  });
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: JSON.stringify(results, null, 2),
    json: results,
    result: results,
    outputValue: generatedImages
  });
  const streamingSavedLog = streamingSavedCount > 0
    ? createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_FACTORY_REMOTE_ASSETS_SAVED',
        `Factory remote image assets saved locally: ${streamingSavedCount}/${results.filter((item) => item.status === 'completed' && Boolean(item.remoteUrl)).length}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.node.id}-${sanitizeLogSuffix(outputFolder)}-remote-assets-streaming`)
      )
    : undefined;
  const completedLog = createLog(
    input.task.taskId,
    failed > 0 ? 'warning' : 'info',
    'WORKFLOW_RUNTIME_FACTORY_BATCH_COMPLETED',
    `Factory image batch completed: completed=${completed}, failed=${failed}, total=${batchTasks.length}.`,
    input.createdAt,
    sanitizeLogSuffix(`${input.node.id}-factory-batch`),
    {
      concurrency,
      minConcurrency: batchRun.minConcurrency,
      maxObservedConcurrency: batchRun.maxObservedConcurrency,
      concurrencyAdjustments: batchRun.concurrencyAdjustments,
      completed,
      failed,
      total: batchTasks.length,
      failedItems: results.filter((item) => item.status === 'failed').map((item) => ({
        sku: item.sku,
        packageKey: item.packageKey,
        error: item.error,
        errorType: item.errorType,
        attempts: item.attempts
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
    logs: [
      startedLog,
      ...(streamingSavedLog ? [streamingSavedLog] : []),
      ...streamingLocalSaveLogs,
      ...localAssetSave.logs,
      completedLog
    ],
    usedToolIds: [...streamingUsedToolIds],
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
    description: readWorkflowRuntimeString(value.description),
    promptTemplate: readWorkflowRuntimeString(value.promptTemplate)
      ?? readWorkflowRuntimeString(value.prompt)
      ?? readWorkflowRuntimeString(value.description),
    negativePrompt: readWorkflowRuntimeString(value.negativePrompt)
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
    imageSize: readWorkflowRuntimeImageSize(normalizedValue.imageSize),
    notes: readWorkflowRuntimeString(normalizedValue.notes)
  };
}

function readWorkflowRuntimeImageSize(value: unknown): '1K' | '2K' | '4K' | undefined {
  const normalized = readWorkflowRuntimeString(value)?.toUpperCase();
  return normalized === '1K' || normalized === '2K' || normalized === '4K'
    ? normalized
    : undefined;
}

function readFactoryRuntimePromptControls(value: unknown): FactoryRuntimePromptControls | undefined {
  if (!isWorkflowRuntimeRecord(value)) {
    return undefined;
  }

  const promptControls = {
    language: readWorkflowRuntimeString(value.language),
    globalPrompt: readWorkflowRuntimeString(value.globalPrompt),
    style: readWorkflowRuntimeString(value.style),
    desiredEffect: readWorkflowRuntimeString(value.desiredEffect),
    mustKeep: readWorkflowRuntimeString(value.mustKeep),
    avoid: readWorkflowRuntimeString(value.avoid),
    extraInstruction: readWorkflowRuntimeString(value.extraInstruction)
  };

  return Object.values(promptControls).some(Boolean) ? promptControls : undefined;
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
  factoryRequest: Record<string, unknown> | undefined,
  roleCode?: string,
  roleModelCredentialBindings: RoleModelCredentialBinding[] = []
): ModelProfile | undefined {
  const asr = isWorkflowRuntimeRecord(factoryRequest?.asr) ? factoryRequest.asr : undefined;
  const requestedProfileId = readWorkflowRuntimeString(asr?.modelProfileId);
  if (requestedProfileId) {
    const requestedProfile = profiles.find(
      (profile) => profile.id === requestedProfileId && modelProfileSupportsAnyCapability(profile, ['audio_to_text'])
    );
    if (requestedProfile) {
      return requestedProfile;
    }

    const boundRuntimeProfileId = roleCode
      ? roleModelCredentialBindings.find(
          (binding) =>
            binding.roleCode === roleCode &&
            binding.modelProfileId === requestedProfileId &&
            binding.runtimeModelProfileId?.trim()
        )?.runtimeModelProfileId?.trim()
      : undefined;
    if (boundRuntimeProfileId) {
      return profiles.find(
        (profile) =>
          profile.id === boundRuntimeProfileId &&
          modelProfileSupportsAnyCapability(profile, ['audio_to_text'])
      );
    }
  }

  return profiles.find((profile) => modelProfileSupportsAnyCapability(profile, ['audio_to_text']));
}

function selectFactoryAudioGenerationProfile(
  profiles: ModelProfile[],
  factoryRequest: Record<string, unknown> | undefined,
  roleCode?: string,
  roleModelCredentialBindings: RoleModelCredentialBinding[] = []
): ModelProfile | undefined {
  const voice = isWorkflowRuntimeRecord(factoryRequest?.voice) ? factoryRequest.voice : undefined;
  const requestedProfileId =
    readWorkflowRuntimeString(voice?.modelProfileId) ??
    readWorkflowRuntimeString(factoryRequest?.audioGenerationModelProfileId) ??
    'qiu-audio-generation-default';
  const requestedProfile = profiles.find(
    (profile) => profile.id === requestedProfileId && modelProfileSupportsAnyCapability(profile, ['text_to_audio'])
  );
  if (requestedProfile) {
    return requestedProfile;
  }

  const boundRuntimeProfileId = roleCode
    ? roleModelCredentialBindings.find(
        (binding) =>
          binding.roleCode === roleCode &&
          binding.modelProfileId === requestedProfileId &&
          binding.runtimeModelProfileId?.trim()
      )?.runtimeModelProfileId?.trim()
    : undefined;
  if (boundRuntimeProfileId) {
    const boundProfile = profiles.find(
      (profile) => profile.id === boundRuntimeProfileId && modelProfileSupportsAnyCapability(profile, ['text_to_audio'])
    );
    if (boundProfile) {
      return boundProfile;
    }
  }

  return profiles.find((profile) => modelProfileSupportsAnyCapability(profile, ['text_to_audio']));
}

interface AiVideoProductionSettings {
  platform: 'bilibili' | 'douyin';
  platformLabel: string;
  outputRatio: '16:9' | '9:16' | '1:1';
  outputResolution: '720p' | '1080p' | '2k';
  targetDurationSeconds: number;
  voicePresetId: string;
  introPath?: string;
  outroPath?: string;
  coverPath?: string;
  watermarkPath?: string;
}

interface AiVideoProductionPlan {
  chapters: Array<{ title: string; start: number; end: number }>;
  highlightSegments: Array<{ start: number; end: number; reason: string }>;
  cutPlan: Array<{ start: number; end: number; label?: string; reason?: string }>;
  narrationScript: string;
}

function readAiVideoProductionSettings(factoryRequest: Record<string, unknown> | undefined): AiVideoProductionSettings {
  const platformValue = readWorkflowRuntimeString(factoryRequest?.platform);
  const platform = platformValue === 'douyin' ? 'douyin' : 'bilibili';
  const ratioValue = readWorkflowRuntimeString(factoryRequest?.outputRatio ?? factoryRequest?.videoRatio);
  const defaultRatio = platform === 'douyin' ? '9:16' : '16:9';
  const outputRatio = ratioValue === '9:16' || ratioValue === '1:1' || ratioValue === '16:9' ? ratioValue : defaultRatio;
  const resolutionValue = readWorkflowRuntimeString(factoryRequest?.outputResolution ?? factoryRequest?.resolution);
  const outputResolution = resolutionValue === '720p' || resolutionValue === '2k' ? resolutionValue : '1080p';
  const requestedDuration = readFactoryRuntimeNumber(factoryRequest?.targetDurationSeconds ?? factoryRequest?.videoDurationSeconds);
  const targetDurationSeconds = clampWorkflowRuntimeLimit(
    requestedDuration,
    platform === 'douyin' ? 60 : 180,
    15,
    600
  );
  const materials = isWorkflowRuntimeRecord(factoryRequest?.materials) ? factoryRequest.materials : {};

  return {
    platform,
    platformLabel: platform === 'douyin' ? '抖音宣传' : 'B站教程',
    outputRatio,
    outputResolution,
    targetDurationSeconds,
    voicePresetId: readWorkflowRuntimeString(factoryRequest?.voicePresetId) ?? 'male_pro_1',
    introPath: readAiVideoMaterialPath(factoryRequest, materials, 'intro'),
    outroPath: readAiVideoMaterialPath(factoryRequest, materials, 'outro'),
    coverPath: readAiVideoMaterialPath(factoryRequest, materials, 'cover'),
    watermarkPath: readAiVideoMaterialPath(factoryRequest, materials, 'watermark')
  };
}

function readAiVideoMaterialPath(
  factoryRequest: Record<string, unknown> | undefined,
  materials: Record<string, unknown>,
  key: 'intro' | 'outro' | 'cover' | 'watermark'
): string | undefined {
  return readWorkflowRuntimeString(materials[`${key}Path`])
    ?? readWorkflowRuntimeString(materials[key])
    ?? readWorkflowRuntimeString(factoryRequest?.[`${key}Path`]);
}

function buildAiVideoProductionAnalysisMessages(input: {
  task: DesktopTaskDetail;
  video: FactoryVideoRuntimeItem;
  transcript: string;
  metrics: Record<string, unknown>;
  settings: AiVideoProductionSettings;
  factoryRequest: Record<string, unknown> | undefined;
}): DesktopModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        '你是 QiuAI WorkOS 的视频内容制作规划器。',
        '只依据 ASR 转写文本和视频基础元数据做内容结构分析，不做图像理解或视频理解。',
        '必须返回 JSON，不要 markdown，不要解释。',
        '输出字段：chapters、highlightSegments、cutPlan、narrationScript。',
        'cutPlan 每项必须包含 start、end、label、reason，单位是秒；总时长尽量接近用户目标时长。',
        'narrationScript 是最终 TTS 口播脚本，语言为中文，适合直接口播。'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `任务：${input.task.title}`,
        `源视频：${input.video.name}`,
        `目标平台：${input.settings.platformLabel}`,
        `目标画幅：${input.settings.outputRatio}`,
        `目标清晰度：${input.settings.outputResolution}`,
        `目标时长：${input.settings.targetDurationSeconds} 秒`,
        `视频时长：${readFactoryRuntimeNumber(input.metrics.durationSeconds) ?? '未知'} 秒`,
        input.settings.platform === 'douyin'
          ? '平台要求：偏宣传短视频，突出结果、效率、冲击力和产品价值，不要做完整教程口吻。'
          : '平台要求：偏教学教程，结构完整，讲解清楚，适合用户跟着学习。',
        readWorkflowRuntimeString(input.factoryRequest?.instruction)
          ? `补充要求：${readWorkflowRuntimeString(input.factoryRequest?.instruction)}`
          : undefined,
        '',
        'ASR 转写：',
        input.transcript
      ].filter(Boolean).join('\n')
    }
  ];
}

function normalizeAiVideoProductionPlan(input: {
  parsed: unknown;
  rawContent: string;
  transcript: string;
  settings: AiVideoProductionSettings;
  videoDurationSeconds?: number;
}): AiVideoProductionPlan {
  const record = isWorkflowRuntimeRecord(input.parsed) ? input.parsed : {};
  const fallbackEnd = Math.max(
    1,
    Math.min(input.videoDurationSeconds ?? input.settings.targetDurationSeconds, input.settings.targetDurationSeconds)
  );
  const chapters = normalizeAiVideoTimelineItems(record.chapters);
  const highlightSegments = normalizeAiVideoHighlightSegments(record.highlightSegments ?? record.highlight_segments);
  const cutPlan = normalizeAiVideoCutPlan(record.cutPlan ?? record.cut_plan ?? record.segments, fallbackEnd);
  const narrationScript =
    readWorkflowRuntimeString(record.narrationScript) ??
    readWorkflowRuntimeString(record.narration_script) ??
    readWorkflowRuntimeString(record.script) ??
    buildFallbackAiVideoNarrationScript(input.transcript, input.settings);

  return {
    chapters,
    highlightSegments,
    cutPlan,
    narrationScript
  };
}

function normalizeAiVideoTimelineItems(value: unknown): Array<{ title: string; start: number; end: number }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (!isWorkflowRuntimeRecord(item)) {
      return [];
    }
    const start = readAiVideoSeconds(item.start);
    const end = readAiVideoSeconds(item.end);
    if (start === undefined || end === undefined || end <= start) {
      return [];
    }
    return [{
      title: readWorkflowRuntimeString(item.title) ?? `片段 ${index + 1}`,
      start,
      end
    }];
  });
}

function normalizeAiVideoHighlightSegments(value: unknown): Array<{ start: number; end: number; reason: string }> {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!isWorkflowRuntimeRecord(item)) {
      return [];
    }
    const start = readAiVideoSeconds(item.start);
    const end = readAiVideoSeconds(item.end);
    if (start === undefined || end === undefined || end <= start) {
      return [];
    }
    return [{
      start,
      end,
      reason: readWorkflowRuntimeString(item.reason) ?? '适合作为重点片段'
    }];
  });
}

function normalizeAiVideoCutPlan(
  value: unknown,
  fallbackEnd: number
): Array<{ start: number; end: number; label?: string; reason?: string }> {
  const segments = Array.isArray(value) ? value : [];
  const normalizedSegments = segments.flatMap((item, index) => {
    if (!isWorkflowRuntimeRecord(item)) {
      return [];
    }
    const start = readAiVideoSeconds(item.start);
    const end = readAiVideoSeconds(item.end);
    if (start === undefined || end === undefined || end <= start) {
      return [];
    }
    return [{
      start,
      end,
      label: readWorkflowRuntimeString(item.label) ?? readWorkflowRuntimeString(item.title) ?? `片段 ${index + 1}`,
      reason: readWorkflowRuntimeString(item.reason)
    }];
  });

  return normalizedSegments.length > 0
    ? normalizedSegments
    : [{ start: 0, end: fallbackEnd, label: '默认片段', reason: '模型未返回有效剪辑计划，使用视频开头片段。' }];
}

function readAiVideoSeconds(value: unknown): number | undefined {
  const direct = readWorkflowRuntimeSeconds(value);
  if (direct !== undefined) {
    return direct;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parts = value.trim().split(':').map((item) => Number(item));
  if (parts.some((item) => !Number.isFinite(item) || item < 0)) {
    return undefined;
  }
  if (parts.length === 2) {
    return Math.round((parts[0]! * 60 + parts[1]!) * 1000) / 1000;
  }
  if (parts.length === 3) {
    return Math.round((parts[0]! * 3600 + parts[1]! * 60 + parts[2]!) * 1000) / 1000;
  }
  return undefined;
}

function buildFallbackAiVideoNarrationScript(transcript: string, settings: AiVideoProductionSettings): string {
  const normalizedTranscript = transcript.replace(/\s+/g, ' ').trim();
  const excerpt = normalizedTranscript.slice(0, 900);
  return settings.platform === 'douyin'
    ? `这段视频展示了一个可以直接落地的 AI 工作流程。重点不是展示概念，而是让用户看到结果：原来需要人工反复处理的内容，现在可以交给 QiuAI WorkOS 里的数字员工和数字工厂完成。${excerpt ? `原视频重点包括：${excerpt}` : ''}`
    : `本期教程根据原始录屏整理操作步骤，重点讲清楚功能入口、配置方式和最终产物。你可以跟着视频完成一次完整流程。${excerpt ? `原视频重点包括：${excerpt}` : ''}`;
}

async function downloadAiVideoProductionVoiceAudio(input: {
  task: DesktopTaskDetail;
  remoteUrl: string;
  desktopToolInvoker: DesktopToolInvoker;
  workspaceId: string;
  binding: ResolvedRuntimeBinding;
  createdAt: string;
}): Promise<string | undefined> {
  if (!canUseFactoryRemoteAssetDownload(input.binding)) {
    throw new Error('缺少 filesystem.download_remote_file 工具能力，无法保存口播音频。');
  }
  const downloadResult = await input.desktopToolInvoker({
    workspaceId: input.workspaceId,
    toolId: 'local-filesystem',
    action: 'filesystem.download_remote_file',
    input: {
      url: input.remoteUrl,
      folder: 'ai-video-production-audio',
      fileName: buildWorkflowArtifactFileName(input.task.title, '口播音频'),
      mediaKind: 'file',
      timeoutMs: 300_000
    },
    allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
  });
  if (!downloadResult.ok) {
    throw new Error(downloadResult.message ?? '口播音频下载失败。');
  }
  return readWorkflowRuntimeString(downloadResult.output?.localPath);
}

function hasFactoryToolAction(
  binding: ResolvedRuntimeBinding,
  toolId: string,
  action: DesktopToolInvocationAction
): boolean {
  const tool = binding.availableTools.find((item) => item.id === toolId);
  return tool ? isToolActionEnabledForManifest(tool, action) : false;
}

function canUseFactoryRemoteAssetDownload(binding: ResolvedRuntimeBinding): boolean {
  const tool = binding.availableTools.find((item) => item.id === 'local-filesystem');
  if (!tool) {
    return false;
  }

  return (
    hasFactoryToolAction(binding, 'local-filesystem', 'filesystem.download_remote_file') ||
    !tool.actions ||
    tool.actions.length === 0
  );
}

async function persistFactoryRemoteAssetsLocally<T extends {
  id: string;
  order: number;
  sku?: string;
  sourceName?: string;
  sourceImagePath?: string;
  packageKey: string;
  packageLabel: string;
  status: FactoryArtifactPreviewItemStatus;
  remoteUrl?: string;
  localPath?: string;
  thumbnailPath?: string;
}>(
  input: {
    task: DesktopTaskDetail;
    binding: ResolvedRuntimeBinding;
    desktopToolInvoker?: DesktopToolInvoker;
    workspaceId?: string;
    results: T[];
    mediaKind: 'image' | 'video';
    folder: string;
    createdAt: string;
    logSuffix: string;
    includeSuccessLog?: boolean;
  }
): Promise<{
  results: T[];
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
}> {
  if (
    !input.desktopToolInvoker ||
    !input.workspaceId ||
    !canUseFactoryRemoteAssetDownload(input.binding)
  ) {
    return {
      results: input.results,
      logs: [],
      usedToolIds: []
    };
  }

  const candidates = input.results
    .map((result, index) => ({ result, index }))
    .filter(({ result }) => result.status === 'completed' && Boolean(result.remoteUrl) && !result.localPath);

  if (candidates.length === 0) {
    return {
      results: input.results,
      logs: [],
      usedToolIds: []
    };
  }

  const updatedResults = [...input.results];
  const downloadResults = await runWorkflowRuntimeConcurrent(
    candidates,
    input.mediaKind === 'video' ? 2 : 4,
    async ({ result, index }) => {
      const remoteUrl = result.remoteUrl;
      if (!remoteUrl) {
        return { index, ok: false, message: 'Remote URL is empty.' };
      }

      try {
        const downloadResult = await input.desktopToolInvoker!({
          workspaceId: input.workspaceId!,
          toolId: 'local-filesystem',
          action: 'filesystem.download_remote_file',
          input: {
            url: remoteUrl,
            folder: input.folder,
            fileName: buildFactoryRemoteAssetFileName(result),
            mediaKind: input.mediaKind
          }
        });
        const localPath = readWorkflowRuntimeString(downloadResult.output?.localPath);
        if (!downloadResult.ok || !localPath) {
          return {
            index,
            ok: false,
            message: downloadResult.message ?? 'Remote asset download returned without a local path.'
          };
        }

        return {
          index,
          ok: true,
          localPath
        };
      } catch (error) {
        return {
          index,
          ok: false,
          message: readErrorMessage(error)
        };
      }
    }
  );

  const logs: DesktopExecutionLogEntry[] = [];
  let savedCount = 0;
  for (const result of downloadResults) {
    const current = updatedResults[result.index];
    if (!current) {
      continue;
    }

    if (result.ok && result.localPath) {
      savedCount += 1;
      updatedResults[result.index] = {
        ...current,
        localPath: result.localPath,
        thumbnailPath: input.mediaKind === 'image'
          ? result.localPath
          : current.thumbnailPath
      };
      continue;
    }

    logs.push(createLog(
      input.task.taskId,
      'warning',
      'WORKFLOW_RUNTIME_FACTORY_REMOTE_ASSET_SAVE_FAILED',
      `Factory remote ${input.mediaKind} could not be stored locally: ${result.message ?? 'unknown error'}.`,
      input.createdAt,
      sanitizeLogSuffix(`${input.logSuffix}-${current.id}`)
    ));
  }

  if (savedCount > 0 && input.includeSuccessLog !== false) {
    logs.unshift(createLog(
      input.task.taskId,
      'info',
      'WORKFLOW_RUNTIME_FACTORY_REMOTE_ASSETS_SAVED',
      `Factory remote ${input.mediaKind} assets saved locally: ${savedCount}/${candidates.length}.`,
      input.createdAt,
      sanitizeLogSuffix(`${input.logSuffix}-remote-assets`)
    ));
  }

  return {
    results: updatedResults,
    logs,
    usedToolIds: ['local-filesystem']
  };
}

function buildFactoryRemoteAssetFileName(item: {
  id: string;
  order: number;
  sku?: string;
  sourceName?: string;
  sourceImagePath?: string;
  packageKey: string;
  packageLabel: string;
}): string {
  const displayName = getFactoryImageResultDisplayName(item);
  const order = String(item.order || 1).padStart(2, '0');
  const stableSuffix = item.id.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(-24);
  return [displayName, order, item.packageLabel, stableSuffix].filter(Boolean).join('-');
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
  if (metrics.probeAvailable === false) {
    return errorFactoryVideo(
      input.video,
      metrics,
      videoSpecGate?.name ?? '视频规格',
      '视频基础信息读取失败，无法判断横竖屏、时长和音轨',
      undefined,
      [
        readWorkflowRuntimeString(metrics.probeWarning) ??
          '请重新安装包含视频处理工具的最新版客户端，或检查本机 FFmpeg/FFprobe 是否可用。'
      ]
    );
  }
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
    probeAvailable: output?.probeAvailable === true ? true : output?.probeAvailable === false ? false : undefined,
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
      const transcriptionPrompt = readWorkflowRuntimeString(input.asr.prompt)
        ?? '请转写医疗案例视频中的人物口述内容，保留使用前、使用后、症状变化等关键信息。';
      const asrResponse = await input.modelInvoker({
        profile: input.asrProfile,
        taskKind: 'audio_transcription',
        audioTranscription: {
          audioPath: input.audioPath,
          language: readWorkflowRuntimeString(input.asr.language) ?? 'zh',
          dialect: readWorkflowRuntimeString(input.asr.dialect) ?? 'auto',
          prompt: transcriptionPrompt
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

function buildFactoryEcommerceVideoOutputItems(input: {
  taskId: string;
  factoryKind?: string;
  results: FactoryVideoGenerationResult[];
  createdAt: string;
}): FactoryOutputItem[] {
  return input.results.map((result) => {
    const status: FactoryOutputItemStatus = result.status === 'completed' ? 'qualified' : 'processing_error';
    const displayName = getFactoryImageResultDisplayName(result);
    const order = String(result.order || 1).padStart(2, '0');
    return {
      id: `${input.taskId}-ecommerce-video-output-${result.order}`,
      factoryKind: input.factoryKind ?? 'ecommerce_product_video_factory',
      kind: 'video',
      title: `${displayName}-${order}-${result.packageLabel}`,
      status,
      originalStatus: status,
      sourcePath: result.sourceImagePath,
      outputPath: result.localPath,
      outputUrl: result.remoteUrl,
      thumbnailPath: result.thumbnailPath,
      summary: result.status === 'completed'
        ? `${result.packageLabel} 已生成${result.videoRatio ? `，${result.videoRatio}` : ''}${result.durationSeconds ? `，${result.durationSeconds} 秒` : ''}`
        : undefined,
      reason: result.error,
      risks: result.error ? [result.error] : [],
      metadata: {
        order: result.order,
        sku: result.sku,
        sourceName: result.sourceName,
        packageKey: result.packageKey,
        packageLabel: result.packageLabel,
        providerJobId: result.providerJobId,
        providerStatus: result.providerStatus,
        attempts: result.attempts,
        errorType: result.errorType,
        durationSeconds: result.durationSeconds,
        videoRatio: result.videoRatio,
        prompt: result.prompt
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

async function extractFactoryOperationAttachmentContext(input: {
  task: DesktopTaskDetail;
  factoryRequest: Record<string, unknown> | undefined;
  binding: ResolvedRuntimeBinding;
  desktopToolInvoker?: DesktopToolInvoker;
  workspaceId?: string;
  createdAt: string;
  nodeId: string;
}): Promise<{ text?: string; logs: DesktopExecutionLogEntry[]; usedToolId?: string }> {
  const attachments = readFactoryOperationRuntimeAttachments(input.factoryRequest)
    .filter((attachment) => isFactoryOperationExtractableDocumentPath(attachment.localPath, attachment.name))
    .slice(0, 8);
  if (attachments.length === 0) {
    return { logs: [] };
  }

  if (
    !input.desktopToolInvoker ||
    !input.workspaceId ||
    !hasFactoryToolAction(input.binding, 'office-document', 'document.extract_text')
  ) {
    return {
      logs: [
        createLog(
          input.task.taskId,
          'warning',
          'WORKFLOW_RUNTIME_OPERATION_ATTACHMENT_EXTRACT_SKIPPED',
          'Operation video factory skipped attachment text extraction because office-document/document.extract_text is unavailable.',
          input.createdAt,
          sanitizeLogSuffix(`${input.nodeId}-attachment-extract-skipped`)
        )
      ]
    };
  }

  const logs: DesktopExecutionLogEntry[] = [];
  const parts: string[] = [];
  for (const attachment of attachments) {
    const result = await input.desktopToolInvoker({
      workspaceId: input.workspaceId,
      toolId: 'office-document',
      action: 'document.extract_text',
      input: {
        path: attachment.localPath,
        maxChars: 8_000
      },
      allowedRootPaths: buildAllowedRootPaths(input.binding.availableKnowledgeSources, input.task.executionContext)
    });
    if (result.ok) {
      const text = readWorkflowRuntimeString(result.output?.text);
      if (text) {
        parts.push([`文件：${attachment.name}`, text].join('\n'));
      }
      continue;
    }

    logs.push(
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPERATION_ATTACHMENT_EXTRACT_FAILED',
        `Attachment text extraction failed for ${attachment.name}: ${result.message ?? 'unknown error'}.`,
        input.createdAt,
        sanitizeLogSuffix(`${input.nodeId}-attachment-${attachment.order}`)
      )
    );
  }

  const text = parts.join('\n\n---\n\n').slice(0, 30_000);
  return {
    text: text || undefined,
    logs,
    usedToolId: 'office-document'
  };
}

function readFactoryOperationRuntimeAttachments(
  factoryRequest: Record<string, unknown> | undefined
): Array<{ order: number; name: string; localPath: string }> {
  const rawAttachments = Array.isArray(factoryRequest?.attachments) ? factoryRequest.attachments : [];
  return rawAttachments.flatMap((item, index) => {
    if (!isWorkflowRuntimeRecord(item)) {
      return [];
    }

    const localPath = readWorkflowRuntimeString(item.localPath)
      ?? readWorkflowRuntimeString(item.path)
      ?? readWorkflowRuntimeString(item.filePath);
    if (!localPath) {
      return [];
    }

    return [{
      order: readFactoryRuntimeNumber(item.order) ?? index + 1,
      name: readWorkflowRuntimeString(item.name) ?? getPathFileName(localPath) ?? `attachment-${index + 1}`,
      localPath
    }];
  });
}

function readFactoryOperationReferenceImages(
  factoryRequest: Record<string, unknown> | undefined
): WorkflowFileValue[] {
  const rawAttachments = Array.isArray(factoryRequest?.attachments) ? factoryRequest.attachments : [];
  return rawAttachments.flatMap((item, index) => {
    if (!isWorkflowRuntimeRecord(item)) {
      return [];
    }

    const localPath = readWorkflowRuntimeString(item.localPath)
      ?? readWorkflowRuntimeString(item.path)
      ?? readWorkflowRuntimeString(item.filePath);
    if (!localPath) {
      return [];
    }

    const name = readWorkflowRuntimeString(item.name) ?? getPathFileName(localPath) ?? `reference-image-${index + 1}`;
    const kind = readWorkflowRuntimeString(item.kind);
    const extension = name.split('.').at(-1)?.trim().toLowerCase();
    const isImage = kind === 'reference_image' || ['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '');
    if (!isImage) {
      return [];
    }

    return [{
      id: readWorkflowRuntimeString(item.id) ?? `operation-reference-image-${index + 1}`,
      name,
      kind: 'image',
      uri: localPath.startsWith('http://') || localPath.startsWith('https://') ? localPath : `local://${localPath}`,
      localPath,
      mimeType: readWorkflowRuntimeString(item.mimeType) ?? inferFactoryImageMimeType(name),
      sizeBytes: readFactoryRuntimeNumber(item.size ?? item.sizeBytes)
    }];
  });
}

function isFactoryOperationExtractableDocumentPath(localPath: string, name?: string): boolean {
  const target = name || localPath;
  const extension = target.split('.').at(-1)?.trim().toLowerCase();
  return ['pdf', 'docx', 'pptx', 'xlsx', 'csv', 'txt', 'md', 'html', 'htm'].includes(extension ?? '');
}

function readFactoryOperationVideoResults(
  value: WorkflowRuntimeValue | undefined,
  factoryRequest: Record<string, unknown> | undefined
): FactoryOperationVideoResult[] {
  const normalizedValue = readFactoryRuntimeJsonValue(value);
  const rawItems = Array.isArray(normalizedValue)
    ? normalizedValue
    : isWorkflowRuntimeRecord(normalizedValue) && Array.isArray(normalizedValue.items)
      ? normalizedValue.items
      : [];

  return rawItems.map((item, index) => normalizeFactoryOperationVideoItem(item, index, factoryRequest));
}

function normalizeFactoryOperationVideoPlan(input: {
  parsed: unknown;
  rawContent: string;
  factoryRequest: Record<string, unknown> | undefined;
}): { summary: string; items: FactoryOperationVideoResult[] } {
  const record = isWorkflowRuntimeRecord(input.parsed) ? input.parsed : {};
  const rawItems = Array.isArray(record.items)
    ? record.items
    : Array.isArray(record.videos)
      ? record.videos
      : Array.isArray(record.topics)
        ? record.topics
        : [];
  const requestedCount = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(input.factoryRequest?.videoCount),
    3,
    1,
    20
  );
  const fallbackItems = rawItems.length > 0
    ? rawItems
    : buildFallbackFactoryOperationVideoItems(input.rawContent, input.factoryRequest, requestedCount);
  const items = fallbackItems
    .slice(0, requestedCount)
    .map((item, index) => normalizeFactoryOperationVideoItem(item, index, input.factoryRequest));
  const summary = readWorkflowRuntimeString(record.summary)
    ?? readWorkflowRuntimeString(record.overview)
    ?? buildFactoryOperationFallbackSummary(input.factoryRequest, items.length);

  return {
    summary,
    items
  };
}

function normalizeFactoryOperationVideoItem(
  value: unknown,
  index: number,
  factoryRequest: Record<string, unknown> | undefined
): FactoryOperationVideoResult {
  const record = isWorkflowRuntimeRecord(value) ? value : {};
  const topic = readWorkflowRuntimeString(record.topic)
    ?? readWorkflowRuntimeString(record.name)
    ?? readWorkflowRuntimeString(record.title)
    ?? `运营视频选题 ${index + 1}`;
  const title = readWorkflowRuntimeString(record.title)
    ?? readWorkflowRuntimeString(record.publishTitle)
    ?? topic;
  const script = readWorkflowRuntimeString(record.script)
    ?? readWorkflowRuntimeString(record.voiceover)
    ?? readWorkflowRuntimeString(record.content)
    ?? buildFactoryOperationFallbackScript(topic, factoryRequest);

  return {
    id: readWorkflowRuntimeString(record.id) ?? `operation-video-${index + 1}`,
    order: readFactoryRuntimeNumber(record.order) ?? index + 1,
    topic,
    title,
    audience: readWorkflowRuntimeString(record.audience)
      ?? readWorkflowRuntimeString(factoryRequest?.targetAudience),
    hook: readWorkflowRuntimeString(record.hook)
      ?? readWorkflowRuntimeString(record.opening)
      ?? `用一个真实业务痛点切入：${topic}`,
    sellingPoints: readFactoryOperationStringList(record.sellingPoints ?? record.points, ['产品价值清晰', '场景贴近客户', '便于人工复核']),
    script,
    storyboard: readFactoryOperationStoryboard(record.storyboard ?? record.shots, script),
    publishCopy: readWorkflowRuntimeString(record.publishCopy)
      ?? readWorkflowRuntimeString(record.description)
      ?? `围绕「${topic}」说明问题、解决方式和下一步咨询入口。`,
    hashtags: readFactoryOperationStringList(record.hashtags ?? record.tags, ['企业AI', '数字员工', '业务自动化']),
    risks: readFactoryOperationStringList(record.risks, ['发布前核对事实、版权、平台规则和品牌口径']),
    reviewChecklist: readFactoryOperationStringList(record.reviewChecklist ?? record.checklist, [
      '确认产品描述真实准确',
      '确认案例和数据有依据',
      '确认不包含夸大承诺或违规表达'
    ])
  };
}

function buildFallbackFactoryOperationVideoItems(
  rawContent: string,
  factoryRequest: Record<string, unknown> | undefined,
  count: number
): unknown[] {
  const platformLabel = readFactoryOperationLabel(factoryRequest?.platform, '目标平台');
  const goalLabel = readFactoryOperationLabel(factoryRequest?.contentGoal, '内容增长');
  const styleLabel = readFactoryOperationLabel(factoryRequest?.contentStyle, '痛点切入');
  const audience = readWorkflowRuntimeString(factoryRequest?.targetAudience) ?? '目标客户';
  const baseTopic = rawContent.trim().slice(0, 80) || `${platformLabel}${goalLabel}`;

  return Array.from({ length: count }, (_, index) => ({
    order: index + 1,
    topic: `${baseTopic} - 选题 ${index + 1}`,
    title: `${audience}为什么需要关注这件事 ${index + 1}`,
    audience,
    hook: `用${audience}最常见的业务痛点开场。`,
    sellingPoints: [goalLabel, styleLabel, '降低重复运营成本'],
    script: buildFactoryOperationFallbackScript(`${baseTopic} - 选题 ${index + 1}`, factoryRequest),
    publishCopy: `这条内容面向${audience}，用${styleLabel}方式说明${goalLabel}。`,
    hashtags: ['企业AI', '数字员工', '短视频运营'],
    risks: ['模型未返回完整结构，已生成兜底方案；发布前需要人工补充细节。'],
    reviewChecklist: ['补充真实案例或产品细节', '核对平台合规', '确认品牌口径']
  }));
}

function buildFactoryOperationFallbackSummary(
  factoryRequest: Record<string, unknown> | undefined,
  itemCount: number
) {
  const platformLabel = readFactoryOperationLabel(factoryRequest?.platform, '目标平台');
  const goalLabel = readFactoryOperationLabel(factoryRequest?.contentGoal, '内容增长');
  return `面向 ${platformLabel} 生成 ${itemCount} 条${goalLabel}短视频方案，需人工复核后发布。`;
}

function buildFactoryOperationFallbackScript(
  topic: string,
  factoryRequest: Record<string, unknown> | undefined
) {
  const audience = readWorkflowRuntimeString(factoryRequest?.targetAudience) ?? '目标客户';
  const tone = readWorkflowRuntimeString(factoryRequest?.brandTone) ?? '专业、克制、可信';
  return [
    `开场：${audience}在日常业务里，经常会遇到一个问题：${topic}。`,
    '展开：先说明问题为什么会消耗时间和成本，再说明产品或方案能帮助用户减少哪些重复动作。',
    `收束：用${tone}的语气提醒用户先做一次小范围验证，再决定是否深入使用。`
  ].join('\n');
}

function readFactoryOperationLabel(value: unknown, fallback: string) {
  if (isWorkflowRuntimeRecord(value)) {
    return readWorkflowRuntimeString(value.label)
      ?? readWorkflowRuntimeString(value.name)
      ?? readWorkflowRuntimeString(value.key)
      ?? fallback;
  }

  return readWorkflowRuntimeString(value) ?? fallback;
}

function readFactoryOperationStringList(value: unknown, fallback: string[]): string[] {
  if (Array.isArray(value)) {
    const list = value
      .map((item) => readWorkflowRuntimeString(item))
      .filter((item): item is string => Boolean(item));
    return list.length ? list.slice(0, 12) : fallback;
  }

  const text = readWorkflowRuntimeString(value);
  if (!text) {
    return fallback;
  }

  const list = text
    .split(/[；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length ? list.slice(0, 12) : fallback;
}

function readFactoryOperationStoryboard(
  value: unknown,
  script: string
): FactoryOperationVideoResult['storyboard'] {
  if (Array.isArray(value)) {
    const storyboard: FactoryOperationVideoResult['storyboard'] = value.flatMap((item, index): FactoryOperationVideoResult['storyboard'] => {
      if (!isWorkflowRuntimeRecord(item)) {
        const text = readWorkflowRuntimeString(item);
        return text ? [{ shot: `镜头 ${index + 1}`, visual: text, voiceover: text }] : [];
      }

      return [{
        shot: readWorkflowRuntimeString(item.shot) ?? readWorkflowRuntimeString(item.name) ?? `镜头 ${index + 1}`,
        visual: readWorkflowRuntimeString(item.visual) ?? readWorkflowRuntimeString(item.picture),
        voiceover: readWorkflowRuntimeString(item.voiceover) ?? readWorkflowRuntimeString(item.script),
        durationSeconds: readFactoryRuntimeNumber(item.durationSeconds)
      }];
    });
    if (storyboard.length > 0) {
      return storyboard.slice(0, 12);
    }
  }

  const parts = script.split(/\n+/).map((item) => item.trim()).filter(Boolean);
  return parts.slice(0, 4).map((item, index) => ({
    shot: `镜头 ${index + 1}`,
    visual: index === 0 ? '人物或产品开场画面' : '产品、案例或业务场景画面',
    voiceover: item,
    durationSeconds: 6
  }));
}

function buildFactoryOperationTopicRows(results: FactoryOperationVideoResult[]): string[][] {
  return [
    ['序号', '选题', '标题', '目标人群', '开场钩子', '核心卖点', '风险提示', '复核项'],
    ...results.map((item) => [
      String(item.order),
      item.topic,
      item.title,
      item.audience ?? '',
      item.hook ?? '',
      item.sellingPoints.join('；'),
      item.risks.join('；'),
      item.reviewChecklist.join('；')
    ])
  ];
}

function buildFactoryOperationPublishRows(results: FactoryOperationVideoResult[]): string[][] {
  return [
    ['序号', '标题', '发布简介', '话题标签', '评论区引导', '人工复核状态'],
    ...results.map((item) => [
      String(item.order),
      item.title,
      item.publishCopy ?? '',
      item.hashtags.join(' '),
      '引导用户留言业务场景或咨询具体方案',
      '待复核'
    ])
  ];
}

function buildFactoryOperationScriptMarkdown(input: {
  taskTitle: string;
  summary: string;
  items: FactoryOperationVideoResult[];
  createdAt: string;
}): string {
  return [
    `# ${input.taskTitle}`,
    '',
    `生成时间：${input.createdAt}`,
    '',
    '## 摘要',
    '',
    input.summary,
    '',
    ...input.items.flatMap((item) => [
      `## ${item.order}. ${item.topic}`,
      '',
      `标题：${item.title}`,
      '',
      item.audience ? `目标人群：${item.audience}` : '',
      item.hook ? `开场钩子：${item.hook}` : '',
      '',
      '### 核心卖点',
      '',
      ...item.sellingPoints.map((point) => `- ${point}`),
      '',
      '### 口播脚本',
      '',
      item.script,
      '',
      '### 分镜',
      '',
      '| 镜头 | 画面 | 口播 | 时长 |',
      '| --- | --- | --- | --- |',
      ...item.storyboard.map((shot) =>
        [
          escapeMarkdownTableCell(shot.shot),
          escapeMarkdownTableCell(shot.visual ?? ''),
          escapeMarkdownTableCell(shot.voiceover ?? ''),
          shot.durationSeconds === undefined ? '' : `${shot.durationSeconds}s`
        ].join(' | ')
      ).map((row) => `| ${row} |`),
      '',
      '### 发布文案',
      '',
      item.publishCopy ?? '',
      '',
      `话题标签：${item.hashtags.join(' ')}`,
      '',
      '### 人工复核',
      '',
      ...item.reviewChecklist.map((check) => `- ${check}`),
      '',
      item.risks.length ? `风险提示：${item.risks.join('；')}` : ''
    ])
  ].filter((line) => line !== '').join('\n');
}

function buildFactoryOperationVideoOutputItems(input: {
  taskId: string;
  results: FactoryOperationVideoResult[];
  scriptArtifactPath?: string;
  packageArtifactPath?: string;
  createdAt: string;
}): FactoryOutputItem[] {
  return input.results.map((result) => ({
    id: `${input.taskId}-operation-video-output-${result.order}`,
    factoryKind: 'operation_video_factory',
    kind: 'document',
    title: `${result.order}. ${result.title}`,
    status: 'review_required',
    originalStatus: 'review_required',
    outputPath: input.scriptArtifactPath ?? input.packageArtifactPath,
    score: undefined,
    grade: '待复核',
    summary: result.hook ?? result.topic,
    risks: result.risks,
    metadata: {
      order: result.order,
      topic: result.topic,
      audience: result.audience,
      sellingPoints: result.sellingPoints,
      script: result.script,
      storyboard: result.storyboard,
      publishCopy: result.publishCopy,
      hashtags: result.hashtags,
      reviewChecklist: result.reviewChecklist,
      packagePath: input.packageArtifactPath
    },
    auditTrail: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  }));
}

function buildFactoryOperationGeneratedVideoOutputItems(input: {
  taskId: string;
  results: FactoryVideoGenerationResult[];
  createdAt: string;
}): FactoryOutputItem[] {
  return input.results.map((result) => {
    const status: FactoryOutputItemStatus = result.status === 'completed' ? 'qualified' : 'processing_error';
    return {
      id: `${input.taskId}-operation-generated-video-${result.order}`,
      factoryKind: 'operation_video_factory',
      kind: 'video',
      title: `${result.order}. ${result.packageLabel}`,
      status,
      originalStatus: status,
      sourcePath: result.sourceImagePath,
      outputPath: result.localPath,
      outputUrl: result.remoteUrl,
      thumbnailPath: result.thumbnailPath,
      summary: result.status === 'completed'
        ? `运营视频已生成${result.videoRatio ? `，${result.videoRatio}` : ''}${result.durationSeconds ? `，${result.durationSeconds} 秒` : ''}`
        : undefined,
      reason: result.error,
      risks: result.error ? [result.error] : [],
      metadata: {
        order: result.order,
        sku: result.sku,
        packageKey: result.packageKey,
        title: result.packageLabel,
        providerJobId: result.providerJobId,
        providerStatus: result.providerStatus,
        attempts: result.attempts,
        errorType: result.errorType,
        durationSeconds: result.durationSeconds,
        videoRatio: result.videoRatio,
        prompt: result.prompt
      },
      auditTrail: [],
      createdAt: input.createdAt,
      updatedAt: input.createdAt
    };
  });
}

function buildFactoryEcommerceVideoManifestContent(input: {
  taskTitle: string;
  summary: string;
  results: FactoryVideoGenerationResult[];
  createdAt: string;
}): string {
  const lines = [
    `# ${input.taskTitle}`,
    '',
    `生成时间：${input.createdAt}`,
    '',
    '## 摘要',
    '',
    input.summary,
    '',
    '## 视频结果',
    '',
    '| 序号 | SKU | 产物包 | 状态 | 视频地址 | 缩略图 | 来源图 | 任务ID | 错误 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...input.results.map((item) =>
      [
        String(item.order),
        escapeMarkdownTableCell(item.sku),
        escapeMarkdownTableCell(item.packageLabel),
        item.status === 'completed' ? '成功' : '失败',
        escapeMarkdownTableCell(item.localPath ?? item.remoteUrl ?? ''),
        escapeMarkdownTableCell(item.thumbnailPath ?? ''),
        escapeMarkdownTableCell(item.sourceImagePath ?? ''),
        escapeMarkdownTableCell(item.providerJobId ?? ''),
        escapeMarkdownTableCell(item.error ?? '')
      ].join(' | ')
    ).map((row) => `| ${row} |`)
  ];

  return lines.join('\n');
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
  promptControls?: FactoryRuntimePromptControls;
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
        prompt: instruction?.prompt ?? buildFactoryImageGenerationFallbackPrompt(
          item,
          packageItem,
          input.targetPlatform,
          input.promptControls
        ),
        negativePrompt: instruction?.negativePrompt ?? packageItem.negativePrompt ?? input.promptControls?.avoid,
        targetPlatform: input.targetPlatform,
        imageSize: input.targetPlatform.imageSize,
        createdAt: input.createdAt
      });
    }
  }

  return tasks;
}

function getFactoryImageResultDisplayName(item: {
  sku?: string;
  sourceName?: string;
  sourceImagePath?: string;
}): string {
  const sku = item.sku?.trim();
  const sourceName = stripFactoryImageNameExtension(
    item.sourceName ?? getPathFileName(item.sourceImagePath ?? '')
  );

  if (sourceName && (!sku || /^SKU-\d+$/i.test(sku))) {
    return sourceName;
  }

  return sku || sourceName || 'product';
}

function stripFactoryImageNameExtension(value: string | undefined): string {
  const name = value?.trim();
  if (!name) {
    return '';
  }

  return name.replace(/\.(png|jpe?g|webp|gif|bmp|tiff?)$/i, '');
}

function readFactoryRuntimeVideoGenerationConfig(factoryRequest: Record<string, unknown> | undefined): {
  durationSeconds: number;
  ratio: string;
} {
  const videoGeneration = isWorkflowRuntimeRecord(factoryRequest?.videoGeneration)
    ? factoryRequest.videoGeneration
    : {};
  const ratioValue = isWorkflowRuntimeRecord(videoGeneration.ratio)
    ? readWorkflowRuntimeString(videoGeneration.ratio.key)
      ?? readWorkflowRuntimeString(videoGeneration.ratio.label)
    : readWorkflowRuntimeString(videoGeneration.ratio)
      ?? readWorkflowRuntimeString(factoryRequest?.videoRatio)
      ?? readWorkflowRuntimeString(factoryRequest?.platform && isWorkflowRuntimeRecord(factoryRequest.platform)
        ? factoryRequest.platform.imageRatio
        : undefined);
  const durationSeconds = clampWorkflowRuntimeLimit(
    readFactoryRuntimeNumber(videoGeneration.durationSeconds ?? factoryRequest?.videoDurationSeconds),
    8,
    3,
    30
  );

  return {
    durationSeconds,
    ratio: ratioValue ?? '9:16'
  };
}

function createFactoryVideoGenerationTasks(input: {
  items: FactoryRuntimeItem[];
  packages: FactoryRuntimePackage[];
  targetPlatform: FactoryRuntimePlatform;
  promptControls?: FactoryRuntimePromptControls;
  videoConfig: { durationSeconds: number; ratio: string };
  createdAt: string;
}): FactoryVideoGenerationTask[] {
  const tasks: FactoryVideoGenerationTask[] = [];
  for (const item of input.items) {
    for (const packageItem of input.packages) {
      const order = tasks.length + 1;
      tasks.push({
        id: `factory-video-${order}-${sanitizeLogSuffix(item.sku)}-${sanitizeLogSuffix(packageItem.key)}`,
        order,
        sku: item.sku,
        sourceName: item.sourceName,
        sourceImage: item.image,
        packageKey: packageItem.key,
        packageLabel: packageItem.label,
        packageDescription: packageItem.description,
        prompt: buildFactoryVideoGenerationFallbackPrompt(
          item,
          packageItem,
          input.targetPlatform,
          input.videoConfig,
          input.promptControls
        ),
        negativePrompt: packageItem.negativePrompt ?? input.promptControls?.avoid,
        targetPlatform: input.targetPlatform,
        durationSeconds: input.videoConfig.durationSeconds,
        videoRatio: input.videoConfig.ratio,
        createdAt: input.createdAt
      });
    }
  }

  return tasks;
}

function createFactoryOperationVideoGenerationTasks(input: {
  items: FactoryOperationVideoResult[];
  factoryRequest: Record<string, unknown> | undefined;
  targetPlatform: FactoryRuntimePlatform;
  videoConfig: { durationSeconds: number; ratio: string };
  referenceImages: WorkflowFileValue[];
  createdAt: string;
}): FactoryVideoGenerationTask[] {
  return input.items.map((item, index) => {
    const referenceImage = input.referenceImages.length > 0
      ? input.referenceImages[index % input.referenceImages.length]
      : undefined;
    const order = index + 1;
    return {
      id: `operation-video-${order}-${sanitizeLogSuffix(item.id || item.title)}`,
      order,
      sku: `OP-${order}`,
      sourceName: referenceImage?.name ?? item.title,
      sourceImage: referenceImage,
      packageKey: 'generated_video',
      packageLabel: item.title,
      packageDescription: item.topic,
      prompt: buildFactoryOperationVideoGenerationPrompt({
        item,
        factoryRequest: input.factoryRequest,
        targetPlatform: input.targetPlatform,
        videoConfig: input.videoConfig
      }),
      negativePrompt: buildFactoryOperationVideoNegativePrompt(item),
      targetPlatform: input.targetPlatform,
      durationSeconds: input.videoConfig.durationSeconds,
      videoRatio: input.videoConfig.ratio,
      createdAt: input.createdAt
    };
  });
}

function buildFactoryOperationVideoGenerationPrompt(input: {
  item: FactoryOperationVideoResult;
  factoryRequest: Record<string, unknown> | undefined;
  targetPlatform: FactoryRuntimePlatform;
  videoConfig: { durationSeconds: number; ratio: string };
}): string {
  const contentGoalValue = input.factoryRequest?.contentGoal;
  const contentStyleValue = input.factoryRequest?.contentStyle;
  const contentGoal = isWorkflowRuntimeRecord(contentGoalValue)
    ? readWorkflowRuntimeString(contentGoalValue.label)
    : readWorkflowRuntimeString(contentGoalValue);
  const contentStyle = isWorkflowRuntimeRecord(contentStyleValue)
    ? readWorkflowRuntimeString(contentStyleValue.label)
    : readWorkflowRuntimeString(contentStyleValue);
  const brandTone = readWorkflowRuntimeString(input.factoryRequest?.brandTone);
  const instruction = readWorkflowRuntimeString(input.factoryRequest?.instruction);
  const sourceUrls = Array.isArray(input.factoryRequest?.sourceUrls)
    ? input.factoryRequest.sourceUrls.map((item) => readWorkflowRuntimeString(item)).filter(Boolean)
    : [];
  const storyboard = input.item.storyboard.map((shot, index) =>
    `${index + 1}. ${shot.shot}${shot.durationSeconds ? `（${shot.durationSeconds}秒）` : ''}：${[
      shot.visual ? `画面=${shot.visual}` : undefined,
      shot.voiceover ? `旁白=${shot.voiceover}` : undefined
    ].filter(Boolean).join('；')}`
  );

  return [
    `生成一条适合 ${input.targetPlatform.label || '短视频平台'} 发布的运营短视频。`,
    `标题：${input.item.title}`,
    `主题：${input.item.topic}`,
    input.item.audience ? `目标客户：${input.item.audience}` : undefined,
    input.item.hook ? `前三秒钩子：${input.item.hook}` : undefined,
    input.item.sellingPoints.length ? `核心卖点：${input.item.sellingPoints.join('；')}` : undefined,
    contentGoal ? `内容目标：${contentGoal}` : undefined,
    contentStyle ? `视频风格：${contentStyle}` : undefined,
    brandTone ? `品牌语气：${brandTone}` : undefined,
    input.targetPlatform.notes ? `平台规则：${input.targetPlatform.notes}` : undefined,
    `视频时长：${input.videoConfig.durationSeconds} 秒`,
    `画幅：${input.videoConfig.ratio}`,
    '',
    '口播脚本：',
    input.item.script,
    '',
    '分镜要求：',
    storyboard.join('\n'),
    '',
    '画面要求：真实、清晰、商业质感，节奏紧凑，避免过度夸张。画面文字如需出现，必须简短且与脚本一致。',
    sourceUrls.length ? `参考来源：${sourceUrls.join('；')}` : undefined,
    instruction ? `补充要求：${instruction}` : undefined
  ].filter(Boolean).join('\n');
}

function buildFactoryOperationVideoNegativePrompt(item: FactoryOperationVideoResult): string {
  return [
    '不要生成虚假数据、绝对化承诺、夸大效果、违规医疗金融表述。',
    '不要生成低清晰度、严重畸变、乱码字幕、错别字、大段不可读文字。',
    item.risks.length ? `额外避免：${item.risks.join('；')}` : undefined
  ].filter(Boolean).join('\n');
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

async function runFactoryImageGenerationTasksAdaptive(input: {
  tasks: FactoryImageGenerationTask[];
  maxConcurrency: number;
  worker: (task: FactoryImageGenerationTask, index: number) => Promise<FactoryImageGenerationResult>;
}): Promise<{
  results: FactoryImageGenerationResult[];
  minConcurrency: number;
  maxObservedConcurrency: number;
  concurrencyAdjustments: Array<{
    afterCompleted: number;
    from: number;
    to: number;
    reason: string;
  }>;
}> {
  const maxConcurrency = Math.min(Math.max(1, Math.floor(input.maxConcurrency)), Math.max(1, input.tasks.length));
  const results = new Array<FactoryImageGenerationResult>(input.tasks.length);
  const concurrencyAdjustments: Array<{
    afterCompleted: number;
    from: number;
    to: number;
    reason: string;
  }> = [];
  let currentConcurrency = maxConcurrency;
  let minConcurrency = currentConcurrency;
  let maxObservedConcurrency = currentConcurrency;
  let completedCount = 0;
  let stableWaves = 0;

  while (completedCount < input.tasks.length) {
    const waveConcurrency = Math.min(currentConcurrency, input.tasks.length - completedCount);
    minConcurrency = Math.min(minConcurrency, waveConcurrency);
    maxObservedConcurrency = Math.max(maxObservedConcurrency, waveConcurrency);
    const waveStart = completedCount;
    const waveTasks = input.tasks.slice(waveStart, waveStart + waveConcurrency);
    const waveResults = await Promise.all(
      waveTasks.map((task, offset) => input.worker(task, waveStart + offset))
    );
    for (let index = 0; index < waveResults.length; index += 1) {
      results[waveStart + index] = waveResults[index]!;
    }
    completedCount += waveResults.length;

    const shouldBackoff = waveResults.some((item) => shouldBackoffFactoryImageConcurrency(item.errorType));
    const hasFailures = waveResults.some((item) => item.status === 'failed');
    if (shouldBackoff && currentConcurrency > 1) {
      const nextConcurrency = Math.max(1, Math.floor(currentConcurrency / 2));
      concurrencyAdjustments.push({
        afterCompleted: completedCount,
        from: currentConcurrency,
        to: nextConcurrency,
        reason: 'provider_or_network_backoff'
      });
      currentConcurrency = nextConcurrency;
      stableWaves = 0;
      continue;
    }

    if (!hasFailures) {
      stableWaves += 1;
      if (stableWaves >= 2 && currentConcurrency < maxConcurrency) {
        const nextConcurrency = Math.min(maxConcurrency, currentConcurrency + 1);
        concurrencyAdjustments.push({
          afterCompleted: completedCount,
          from: currentConcurrency,
          to: nextConcurrency,
          reason: 'stable_recovery'
        });
        currentConcurrency = nextConcurrency;
        stableWaves = 0;
      }
      continue;
    }

    stableWaves = 0;
  }

  return {
    results,
    minConcurrency,
    maxObservedConcurrency,
    concurrencyAdjustments
  };
}

async function runFactoryVideoGenerationTasksAdaptive(input: {
  tasks: FactoryVideoGenerationTask[];
  maxConcurrency: number;
  worker: (task: FactoryVideoGenerationTask, index: number) => Promise<FactoryVideoGenerationResult>;
}): Promise<{
  results: FactoryVideoGenerationResult[];
  minConcurrency: number;
  maxObservedConcurrency: number;
  concurrencyAdjustments: Array<{
    afterCompleted: number;
    from: number;
    to: number;
    reason: string;
  }>;
}> {
  const maxConcurrency = Math.min(Math.max(1, Math.floor(input.maxConcurrency)), Math.max(1, input.tasks.length));
  const results = new Array<FactoryVideoGenerationResult>(input.tasks.length);
  const concurrencyAdjustments: Array<{
    afterCompleted: number;
    from: number;
    to: number;
    reason: string;
  }> = [];
  let currentConcurrency = maxConcurrency;
  let minConcurrency = currentConcurrency;
  let maxObservedConcurrency = currentConcurrency;
  let completedCount = 0;
  let stableWaves = 0;

  while (completedCount < input.tasks.length) {
    const waveConcurrency = Math.min(currentConcurrency, input.tasks.length - completedCount);
    minConcurrency = Math.min(minConcurrency, waveConcurrency);
    maxObservedConcurrency = Math.max(maxObservedConcurrency, waveConcurrency);
    const waveStart = completedCount;
    const waveTasks = input.tasks.slice(waveStart, waveStart + waveConcurrency);
    const waveResults = await Promise.all(
      waveTasks.map((task, offset) => input.worker(task, waveStart + offset))
    );
    for (let index = 0; index < waveResults.length; index += 1) {
      results[waveStart + index] = waveResults[index]!;
    }
    completedCount += waveResults.length;

    const shouldBackoff = waveResults.some((item) => shouldBackoffFactoryImageConcurrency(item.errorType));
    const hasFailures = waveResults.some((item) => item.status === 'failed');
    if (shouldBackoff && currentConcurrency > 1) {
      const nextConcurrency = Math.max(1, Math.floor(currentConcurrency / 2));
      concurrencyAdjustments.push({
        afterCompleted: completedCount,
        from: currentConcurrency,
        to: nextConcurrency,
        reason: 'provider_or_network_backoff'
      });
      currentConcurrency = nextConcurrency;
      stableWaves = 0;
      continue;
    }

    if (!hasFailures) {
      stableWaves += 1;
      if (stableWaves >= 2 && currentConcurrency < maxConcurrency) {
        const nextConcurrency = Math.min(maxConcurrency, currentConcurrency + 1);
        concurrencyAdjustments.push({
          afterCompleted: completedCount,
          from: currentConcurrency,
          to: nextConcurrency,
          reason: 'stable_recovery'
        });
        currentConcurrency = nextConcurrency;
        stableWaves = 0;
      }
      continue;
    }

    stableWaves = 0;
  }

  return {
    results,
    minConcurrency,
    maxObservedConcurrency,
    concurrencyAdjustments
  };
}

async function runFactoryImageGenerationTasksWithProviderPolling(input: {
  tasks: FactoryImageGenerationTask[];
  maxConcurrency: number;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  maxRetries: number;
  onResultUpdate?: FactoryImageGenerationResultUpdateHandler;
}): Promise<{
  results: FactoryImageGenerationResult[];
  minConcurrency: number;
  maxObservedConcurrency: number;
  concurrencyAdjustments: Array<{
    afterCompleted: number;
    from: number;
    to: number;
    reason: string;
  }>;
}> {
  const submittedAtById = new Map<string, number>();
  const submitRun = await runFactoryImageGenerationTasksAdaptive({
    tasks: input.tasks,
    maxConcurrency: input.maxConcurrency,
    worker: async (task) => {
      const result = await submitFactoryImageGenerationTask({
        task,
        node: input.node,
        profile: input.profile,
        modelInvoker: input.modelInvoker,
        maxRetries: input.maxRetries
      });
      const updatedResult = input.onResultUpdate
        ? await input.onResultUpdate(result, 'submitted')
        : result;
      if (updatedResult.providerJobId && updatedResult.status === 'running') {
        submittedAtById.set(updatedResult.id, Date.now());
      }
      return updatedResult;
    }
  });

  const results = [...submitRun.results];
  let pendingIndexes = results
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.status === 'running' && Boolean(item.providerJobId))
    .map(({ index }) => index);
  let pollIntervalMs = factoryGrsaiImagePollInitialIntervalMs;

  while (pendingIndexes.length > 0) {
    const now = Date.now();
    const expiredIndexes: number[] = [];
    pendingIndexes = pendingIndexes.filter((index) => {
      const result = results[index]!;
      const submittedAt = submittedAtById.get(result.id) ?? now;
      if (now - submittedAt >= factoryGrsaiImageFinalDeadlineMs) {
        expiredIndexes.push(index);
        return false;
      }
      return true;
    });

    for (const index of expiredIndexes) {
      const current = results[index]!;
      const timeoutResult: FactoryImageGenerationResult = {
        ...current,
        status: 'failed',
        error: `Image generation task timed out after 30 minutes. taskId=${current.providerJobId}${current.providerStatus ? `, status=${current.providerStatus}` : ''}`,
        errorType: 'timeout',
        attempts: current.attempts ?? 1
      };
      results[index] = input.onResultUpdate
        ? await input.onResultUpdate(timeoutResult, 'timeout')
        : timeoutResult;
    }

    if (pendingIndexes.length === 0) {
      break;
    }

    await sleepFactoryRuntime(pollIntervalMs);
    const polledResults = await runWorkflowRuntimeConcurrent(
      pendingIndexes,
      input.maxConcurrency,
      async (resultIndex) => {
        const current = results[resultIndex]!;
        const polledResult = await pollFactoryImageGenerationTaskOnce({
          current,
          node: input.node,
          profile: input.profile,
          modelInvoker: input.modelInvoker
        });
        const updatedResult = input.onResultUpdate
          ? await input.onResultUpdate(polledResult, 'polled')
          : polledResult;
        return {
          resultIndex,
          result: updatedResult
        };
      }
    );

    for (const { resultIndex, result } of polledResults) {
      results[resultIndex] = result;
    }

    pendingIndexes = results
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.status === 'running' && Boolean(item.providerJobId))
      .map(({ index }) => index);
    pollIntervalMs = Math.min(factoryGrsaiImagePollMaxIntervalMs, Math.ceil(pollIntervalMs * 1.5));
  }

  return {
    ...submitRun,
    results
  };
}

function shouldBackoffFactoryImageConcurrency(errorType: FactoryImageGenerationErrorType | undefined): boolean {
  return errorType === 'timeout' ||
    errorType === 'network' ||
    errorType === 'rate_limit' ||
    errorType === 'provider';
}

function classifyFactoryImageGenerationError(message: string): FactoryImageGenerationErrorType {
  const normalized = message.toLowerCase();
  if (/policy|safety|moderation|content violation|prompt rejected|违规|敏感|内容限制|不合规/.test(normalized)) {
    return 'policy_violation';
  }
  if (/api key|unauthorized|forbidden|401|403|base url|model name|does not support|invalidparameter|invalid parameter/.test(normalized)) {
    return 'configuration';
  }
  if (/quota|余额|insufficient|payment|required|billing|credits|limit exceeded/.test(normalized)) {
    return 'quota';
  }
  if (/429|rate limit|too many requests|限流|频率/.test(normalized)) {
    return 'rate_limit';
  }
  if (/timeout|timed out|aborted due to timeout|operation was aborted/.test(normalized)) {
    return 'timeout';
  }
  if (/network|fetch failed|econnreset|enotfound|etimedout|socket|dns|tls/.test(normalized)) {
    return 'network';
  }
  if (/5\d\d|bad gateway|service unavailable|internalerror|provider|upstream/.test(normalized)) {
    return 'provider';
  }
  return 'unknown';
}

function shouldStopFactoryImageRetry(errorType: FactoryImageGenerationErrorType): boolean {
  return errorType === 'configuration' || errorType === 'quota' || errorType === 'policy_violation';
}

function getFactoryImageRetryDelayMs(errorType: FactoryImageGenerationErrorType, attempt: number): number {
  const baseDelay =
    errorType === 'rate_limit' ? 2_000 :
    errorType === 'timeout' || errorType === 'network' ? 1_200 :
    errorType === 'provider' ? 1_500 :
    800;
  return Math.min(8_000, baseDelay * (attempt + 1));
}

function isGrsaiFactoryImageModelProfile(profile: ModelProfile): boolean {
  const normalized = [
    profile.providerId,
    profile.providerName,
    profile.apiBaseUrl
  ].filter(Boolean).join(' ').toLowerCase();
  return normalized.includes('grsai') || normalized.includes('dakka.com.cn');
}

function isOfficialImageFactoryModelProfile(profile: ModelProfile): boolean {
  return isOfficialPointsModelProfile(profile) && Boolean(profile.officialRouteKey?.startsWith('official-image-'));
}

function isAsyncPolledFactoryImageModelProfile(profile: ModelProfile): boolean {
  return isGrsaiFactoryImageModelProfile(profile) || isOfficialImageFactoryModelProfile(profile);
}

async function submitFactoryImageGenerationTask(input: {
  task: FactoryImageGenerationTask;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  maxRetries: number;
}): Promise<FactoryImageGenerationResult> {
  let lastError = '';
  let lastErrorType: FactoryImageGenerationErrorType = 'unknown';
  let attempts = 0;
  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    attempts = attempt + 1;
    try {
      const response = await input.modelInvoker({
        profile: input.profile,
        taskKind: 'image_generation',
        imageGeneration: {
          prompt: input.task.prompt,
          negativePrompt: input.task.negativePrompt,
          sourceImagePath: input.task.sourceImage.localPath,
          size: input.task.imageSize,
          aspectRatio: input.task.targetPlatform.imageRatio,
          responseFormat: 'url',
          asyncMode: 'submit_only'
        },
        messages: buildFactoryImageGenerationMessages(input.task),
        timeoutMs: Math.min(
          readWorkflowRuntimeModelTimeoutMs(input.node.config?.submitTimeoutMs ?? factoryGrsaiImageSubmitTimeoutMs),
          factoryGrsaiImageSubmitTimeoutMs
        )
      });
      const imageResult = readFactoryImageGenerationResponse(response);
      if (imageResult.remoteUrl || imageResult.localPath) {
        return buildCompletedFactoryImageGenerationResult({
          task: input.task,
          imageResult,
          attempts
        });
      }

      if (imageResult.providerJobId) {
        return {
          id: input.task.id,
          order: input.task.order,
          sku: input.task.sku,
          sourceName: input.task.sourceName,
          packageKey: input.task.packageKey,
          packageLabel: input.task.packageLabel,
          imageSize: input.task.imageSize,
          status: 'running',
          sourceImagePath: input.task.sourceImage.localPath,
          prompt: input.task.prompt,
          attempts,
          providerJobId: imageResult.providerJobId,
          providerStatus: imageResult.providerStatus ?? 'submitted',
          providerSubmittedAt: new Date().toISOString(),
          createdAt: input.task.createdAt
        };
      }

      throw new Error('Image generation submit response did not include a remoteUrl, localPath, or task id.');
    } catch (error) {
      lastError = readErrorMessage(error);
      lastErrorType = classifyFactoryImageGenerationError(lastError);
      if (shouldStopFactoryImageRetry(lastErrorType)) {
        break;
      }
      const retryDelayMs = getFactoryImageRetryDelayMs(lastErrorType, attempt);
      if (retryDelayMs > 0 && attempt < input.maxRetries) {
        await sleepFactoryRuntime(retryDelayMs);
      }
    }
  }

  return {
    id: input.task.id,
    order: input.task.order,
    sku: input.task.sku,
    sourceName: input.task.sourceName,
    packageKey: input.task.packageKey,
    packageLabel: input.task.packageLabel,
    status: 'failed',
    sourceImagePath: input.task.sourceImage.localPath,
    prompt: input.task.prompt,
    error: lastError || 'Image generation submit failed.',
    errorType: lastErrorType,
    attempts,
    createdAt: input.task.createdAt
  };
}

async function pollFactoryImageGenerationTaskOnce(input: {
  current: FactoryImageGenerationResult;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
}): Promise<FactoryImageGenerationResult> {
  if (!input.current.providerJobId) {
    return {
      ...input.current,
      status: 'failed',
      error: 'Image generation polling cannot continue without a provider task id.',
      errorType: 'provider'
    };
  }

  try {
    const response = await input.modelInvoker({
      profile: input.profile,
      taskKind: 'image_generation',
      imageGeneration: {
        prompt: input.current.prompt ?? '',
        sourceImagePath: input.current.sourceImagePath,
        size: input.current.imageSize,
        responseFormat: 'url',
        asyncMode: 'poll_once',
        providerJobId: input.current.providerJobId
      },
      messages: [{ role: 'user', content: `Poll image generation task ${input.current.providerJobId}.` }],
      timeoutMs: readWorkflowRuntimeModelTimeoutMs(
        input.node.config?.pollRequestTimeoutMs ?? factoryGrsaiImagePollRequestTimeoutMs
      )
    });
    const imageResult = readFactoryImageGenerationResponse(response);
    if (imageResult.remoteUrl || imageResult.localPath) {
      return buildCompletedFactoryImageGenerationResult({
        task: {
          id: input.current.id,
          order: input.current.order,
          sku: input.current.sku,
          sourceName: input.current.sourceName,
          imageSize: input.current.imageSize,
          sourceImage: {
            id: input.current.id,
            name: input.current.sourceName ?? input.current.sku,
            kind: 'image',
            uri: input.current.sourceImagePath ? `local://${input.current.sourceImagePath}` : '',
            localPath: input.current.sourceImagePath ?? ''
          },
          packageKey: input.current.packageKey,
          packageLabel: input.current.packageLabel,
          prompt: input.current.prompt ?? '',
          createdAt: input.current.createdAt
        },
        imageResult: {
          ...imageResult,
          providerJobId: imageResult.providerJobId ?? input.current.providerJobId,
          providerStatus: imageResult.providerStatus ?? input.current.providerStatus,
          providerSubmittedAt: input.current.providerSubmittedAt
        },
        attempts: input.current.attempts ?? 1
      });
    }

    return {
      ...input.current,
      providerStatus: imageResult.providerStatus ?? input.current.providerStatus ?? 'pending'
    };
  } catch (error) {
    const errorMessage = readErrorMessage(error);
    const errorType = classifyFactoryImageGenerationError(errorMessage);
    if (!shouldStopFactoryImageRetry(errorType) && !/grsai image task failed/i.test(errorMessage)) {
      return {
        ...input.current,
        status: 'running',
        providerStatus: input.current.providerStatus ?? 'pending',
        error: errorMessage,
        errorType
      };
    }

    return {
      ...input.current,
      status: 'failed',
      error: errorMessage,
      errorType
    };
  }
}

function isFactoryImagePolicyViolationItem(item: FactoryArtifactPreviewItem): boolean {
  const normalizedStatus = item.providerStatus?.trim().toLowerCase() ?? '';
  const normalizedError = item.error?.trim().toLowerCase() ?? '';
  return item.errorType === 'policy_violation' ||
    /violation|policy|safety|moderation|prompt rejected|content restriction|违规|敏感|不合规/.test(
      `${normalizedStatus} ${normalizedError}`
    );
}

function readFactoryImageProviderSubmittedAtMs(item: FactoryArtifactPreviewItem): number | undefined {
  const raw = item.providerSubmittedAt ?? item.createdAt;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasFactoryImageResult(item: FactoryArtifactPreviewItem): boolean {
  return Boolean(item.remoteUrl || item.localPath) || item.status === 'completed';
}

export function getFactoryImageBatchRecoveryHealth(
  preview: FactoryArtifactPreview,
  nowMs = Date.now()
): FactoryImageBatchRecoveryHealth {
  let recoverableCount = 0;
  let pendingCount = 0;
  let expiredCount = 0;

  for (const item of preview.items) {
    if (hasFactoryImageResult(item) || !item.providerJobId || isFactoryImagePolicyViolationItem(item)) {
      continue;
    }

    const submittedAtMs = readFactoryImageProviderSubmittedAtMs(item);
    const ageMs = submittedAtMs === undefined ? Number.POSITIVE_INFINITY : nowMs - submittedAtMs;
    if (ageMs >= 0 && ageMs < factoryImageRecoveryWindowMs) {
      recoverableCount += 1;
      if (item.status === 'running') {
        pendingCount += 1;
      }
    } else if (ageMs >= factoryImageRecoveryWindowMs) {
      expiredCount += 1;
    }
  }

  const completedCount = preview.items.filter(hasFactoryImageResult).length;
  const unresolvedCount = preview.items.length - completedCount;
  const policyViolationCount = preview.items.filter(isFactoryImagePolicyViolationItem).length;
  const providerFailureCount = preview.items.filter(
    (item) => item.status === 'failed' && !isFactoryImagePolicyViolationItem(item)
  ).length;

  return {
    totalCount: preview.items.length,
    completedCount,
    unresolvedCount,
    recoverableCount,
    policyViolationCount,
    providerFailureCount,
    pendingCount,
    expiredCount
  };
}

function buildFactoryImageRecoveryArtifact(
  artifact: DesktopArtifactSummary,
  results: FactoryArtifactPreviewItem[],
  updatedAt: string
): DesktopArtifactSummary {
  const preview = artifact.factoryPreview;
  if (!preview || preview.kind !== 'digital_factory_image_batch') {
    return artifact;
  }

  const completed = results.filter(hasFactoryImageResult).length;
  const failed = results.filter((item) => item.status === 'failed').length;
  const running = results.filter((item) => item.status === 'running').length;
  const summaryContent = [
    `数字工厂图片批次进度：${completed}/${preview.total}`,
    `失败：${failed}`,
    running > 0 ? `生成中：${running}` : undefined,
    `并发数：${preview.concurrency}`,
    preview.platformLabel ? `图片比例：${preview.platformLabel}` : undefined
  ].filter(Boolean).join('\n');

  return {
    ...artifact,
    content: summaryContent,
    remoteUrl: results.find((item) => item.remoteUrl)?.remoteUrl ?? artifact.remoteUrl,
    localPath: results.find((item) => item.localPath)?.localPath ?? artifact.localPath,
    factoryPreview: {
      ...preview,
      completed,
      failed,
      items: results
    }
  };
}

function updateFactoryImageRecoveryTask(
  task: DesktopTaskDetail,
  artifactId: string,
  results: FactoryArtifactPreviewItem[],
  updatedAt: string
): DesktopTaskDetail {
  return {
    ...task,
    updatedAt,
    artifacts: task.artifacts.map((artifact) =>
      artifact.id === artifactId
        ? buildFactoryImageRecoveryArtifact(artifact, results, updatedAt)
        : artifact
    )
  };
}

export async function recoverFactoryImageBatch(
  input: RecoverFactoryImageBatchInput
): Promise<RecoverFactoryImageBatchResult> {
  const previewArtifact = input.task.artifacts.find(
    (artifact) => artifact.factoryPreview?.kind === 'digital_factory_image_batch'
  );
  const preview = previewArtifact?.factoryPreview;
  if (!preview || preview.kind !== 'digital_factory_image_batch' || !previewArtifact) {
    throw new Error('当前任务没有可补全的图片批次。');
  }

  const nowMs = input.nowMs ?? Date.now();
  const initialHealth = getFactoryImageBatchRecoveryHealth(preview, nowMs);
  if (initialHealth.recoverableCount === 0) {
    return {
      task: input.task,
      health: initialHealth,
      recoveredCount: 0
    };
  }
  if (!input.modelInvoker) {
    throw new Error('桌面端模型桥接不可用，无法执行补全检查。');
  }

  const createdAt = input.task.updatedAt || input.task.createdAt;
  const workflowPlan = buildWorkflowExecutionPlan({
    task: input.task,
    rolePackage: input.rolePackage,
    createdAt
  });
  const imageNode = workflowPlan.orderedNodes.find(
    (node) =>
      node.type === 'llm' &&
      (node.outputVariables ?? []).includes('factory_generated_images')
  );
  if (!imageNode) {
    throw new Error('当前任务没有找到图片批次生成节点。');
  }

  const context = augmentExecutionContextWithWorkflowPlan(
    input.task.executionContext ?? buildContextFromRolePackage(input.rolePackage),
    workflowPlan
  );
  if (!context) {
    throw new Error('当前任务缺少执行上下文，无法补全图片批次。');
  }

  const binding = resolveRuntimeBinding({
    context,
    roleCode: input.task.roleCode,
    roleModelCredentialBindings: input.roleModelCredentialBindings ?? [],
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
  const configuredModelProfiles = credentialedBinding.modelProfiles.filter(isModelApiConfigured);
  const profile = selectWorkflowRuntimeModelProfile(
    imageNode,
    configuredModelProfiles,
    input.rolePackage,
    input.task.roleCode,
    input.roleModelCredentialBindings ?? []
  );

  let results = [...preview.items];
  let recoveredCount = 0;
  const recoverableItems = results.filter((item) => {
    const currentHealth = getFactoryImageBatchRecoveryHealth(
      { ...preview, items: [item] },
      nowMs
    );
    return currentHealth.recoverableCount === 1;
  });
  let currentTask = input.task;

  const publish = async () => {
    currentTask = updateFactoryImageRecoveryTask(
      currentTask,
      previewArtifact.id,
      results,
      new Date().toISOString()
    );
    await input.onProgress?.(currentTask);
  };

  await runWorkflowRuntimeConcurrent(
    recoverableItems,
    Math.min(4, recoverableItems.length),
    async (current) => {
      const resultIndex = results.findIndex((item) => item.id === current.id);
      if (resultIndex < 0) {
        return current;
      }

      let nextResult = await pollFactoryImageGenerationTaskOnce({
        current,
        node: imageNode,
        profile,
        modelInvoker: input.modelInvoker!
      });

      if (nextResult.status === 'completed' && nextResult.remoteUrl && !nextResult.localPath) {
        const localSave = await persistFactoryRemoteAssetsLocally({
          task: currentTask,
          binding: credentialedBinding,
          desktopToolInvoker: input.desktopToolInvoker,
          workspaceId: input.workspaceId,
          results: [nextResult],
          mediaKind: 'image',
          folder: 'product-images',
          createdAt,
          logSuffix: `factory-recovery-${sanitizeLogSuffix(nextResult.id)}`,
          includeSuccessLog: false
        });
        nextResult = localSave.results[0] ?? nextResult;
      }

      results[resultIndex] = nextResult;
      if (hasFactoryImageResult(nextResult) && !hasFactoryImageResult(current)) {
        recoveredCount += 1;
      }
      await publish();
      return nextResult;
    }
  );

  const finalPreview = {
    ...preview,
    items: results
  };
  const health = getFactoryImageBatchRecoveryHealth(finalPreview, nowMs);
  currentTask = updateFactoryImageRecoveryTask(
    currentTask,
    previewArtifact.id,
    results,
    new Date().toISOString()
  );

  return {
    task: currentTask,
    health,
    recoveredCount
  };
}

function buildCompletedFactoryImageGenerationResult(input: {
  task: Pick<
    FactoryImageGenerationTask,
    'id' | 'order' | 'sku' | 'sourceName' | 'sourceImage' | 'packageKey' | 'packageLabel' | 'imageSize' | 'prompt' | 'createdAt'
  >;
  imageResult: {
    remoteUrl?: string;
    localPath?: string;
    thumbnailPath?: string;
    providerJobId?: string;
    providerStatus?: string;
    providerSubmittedAt?: string;
  };
  attempts: number;
}): FactoryImageGenerationResult {
  return {
    id: input.task.id,
    order: input.task.order,
    sku: input.task.sku,
    sourceName: input.task.sourceName,
    packageKey: input.task.packageKey,
    packageLabel: input.task.packageLabel,
    imageSize: input.task.imageSize,
    status: 'completed',
    remoteUrl: input.imageResult.remoteUrl,
    localPath: input.imageResult.localPath,
    thumbnailPath: input.imageResult.thumbnailPath,
    sourceImagePath: input.task.sourceImage.localPath,
    prompt: input.task.prompt,
    attempts: input.attempts,
    providerJobId: input.imageResult.providerJobId,
    providerStatus: input.imageResult.providerStatus,
    providerSubmittedAt: input.imageResult.providerSubmittedAt,
    createdAt: input.task.createdAt
  };
}

async function runFactoryImageGenerationTask(input: {
  task: FactoryImageGenerationTask;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  maxRetries: number;
}): Promise<FactoryImageGenerationResult> {
  let lastError = '';
  let lastErrorType: FactoryImageGenerationErrorType = 'unknown';
  let attempts = 0;
  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    attempts = attempt + 1;
    try {
      const response = await input.modelInvoker({
        profile: input.profile,
        taskKind: 'image_generation',
        imageGeneration: {
          prompt: input.task.prompt,
          negativePrompt: input.task.negativePrompt,
          sourceImagePath: input.task.sourceImage.localPath,
          size: input.task.imageSize,
          aspectRatio: input.task.targetPlatform.imageRatio,
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
        sourceName: input.task.sourceName,
        packageKey: input.task.packageKey,
        packageLabel: input.task.packageLabel,
        imageSize: input.task.imageSize,
        status: 'completed',
        remoteUrl: imageResult.remoteUrl,
        localPath: imageResult.localPath,
        thumbnailPath: imageResult.thumbnailPath,
        sourceImagePath: input.task.sourceImage.localPath,
        prompt: input.task.prompt,
        attempts,
        providerJobId: imageResult.providerJobId,
        providerStatus: imageResult.providerStatus,
        createdAt: input.task.createdAt
      };
    } catch (error) {
      lastError = readErrorMessage(error);
      lastErrorType = classifyFactoryImageGenerationError(lastError);
      if (shouldStopFactoryImageRetry(lastErrorType)) {
        break;
      }
      const retryDelayMs = getFactoryImageRetryDelayMs(lastErrorType, attempt);
      if (retryDelayMs > 0 && attempt < input.maxRetries) {
        await sleepFactoryRuntime(retryDelayMs);
      }
    }
  }

  return {
    id: input.task.id,
    order: input.task.order,
    sku: input.task.sku,
    sourceName: input.task.sourceName,
    packageKey: input.task.packageKey,
    packageLabel: input.task.packageLabel,
    imageSize: input.task.imageSize,
    status: 'failed',
    sourceImagePath: input.task.sourceImage.localPath,
    prompt: input.task.prompt,
    error: lastError || 'Image generation failed.',
    errorType: lastErrorType,
    attempts,
    createdAt: input.task.createdAt
  };
}

async function runFactoryVideoGenerationTask(input: {
  task: FactoryVideoGenerationTask;
  node: WorkflowGraphNode;
  profile: ModelProfile;
  modelInvoker: DesktopModelInvoker;
  maxRetries: number;
}): Promise<FactoryVideoGenerationResult> {
  let lastError = '';
  let lastErrorType: FactoryImageGenerationErrorType = 'unknown';
  let attempts = 0;
  for (let attempt = 0; attempt <= input.maxRetries; attempt += 1) {
    attempts = attempt + 1;
    try {
      const response = await input.modelInvoker({
        profile: input.profile,
        taskKind: 'video_generation',
        videoGeneration: {
          prompt: input.task.prompt,
          negativePrompt: input.task.negativePrompt,
          sourceImagePath: input.task.sourceImage?.localPath,
          durationSeconds: input.task.durationSeconds,
          aspectRatio: input.task.videoRatio,
          responseFormat: 'url'
        },
        messages: buildFactoryVideoGenerationMessages(input.task),
        timeoutMs: readWorkflowRuntimeModelTimeoutMs(input.node.config?.timeoutMs ?? 240_000)
      });
      const videoResult = readFactoryVideoGenerationResponse(response);
      if (!videoResult.remoteUrl && !videoResult.localPath) {
        throw new Error('Video generation response did not include a remoteUrl or localPath.');
      }

      return {
        id: input.task.id,
        order: input.task.order,
        sku: input.task.sku,
        sourceName: input.task.sourceName,
        packageKey: input.task.packageKey,
        packageLabel: input.task.packageLabel,
        status: 'completed',
        remoteUrl: videoResult.remoteUrl,
        localPath: videoResult.localPath,
        thumbnailPath: videoResult.thumbnailPath,
        sourceImagePath: input.task.sourceImage?.localPath,
        prompt: input.task.prompt,
        attempts,
        providerJobId: videoResult.providerJobId,
        providerStatus: videoResult.providerStatus,
        durationSeconds: input.task.durationSeconds,
        videoRatio: input.task.videoRatio,
        createdAt: input.task.createdAt
      };
    } catch (error) {
      lastError = readErrorMessage(error);
      lastErrorType = classifyFactoryImageGenerationError(lastError);
      if (shouldStopFactoryImageRetry(lastErrorType)) {
        break;
      }
      const retryDelayMs = getFactoryImageRetryDelayMs(lastErrorType, attempt);
      if (retryDelayMs > 0 && attempt < input.maxRetries) {
        await sleepFactoryRuntime(retryDelayMs);
      }
    }
  }

  return {
    id: input.task.id,
    order: input.task.order,
    sku: input.task.sku,
    sourceName: input.task.sourceName,
    packageKey: input.task.packageKey,
    packageLabel: input.task.packageLabel,
    status: 'failed',
    sourceImagePath: input.task.sourceImage?.localPath,
    prompt: input.task.prompt,
    error: lastError || 'Video generation failed.',
    errorType: lastErrorType,
    attempts,
    durationSeconds: input.task.durationSeconds,
    videoRatio: input.task.videoRatio,
    createdAt: input.task.createdAt
  };
}

function buildFactoryImageGenerationMessages(task: FactoryImageGenerationTask): DesktopModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are a QiuAI WorkOS digital factory image generation executor.',
        'Generate exactly one image for the requested source item and package.',
        'Return JSON only: {"remoteUrl":"https://...","thumbnailPath":"https://..."} or {"localPath":"C:\\\\...\\\\image.png"}.',
        'Do not return image binary data, base64, or markdown.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Internal item id: ${task.sku}`,
        task.sourceName ? `Source name: ${task.sourceName}` : undefined,
        `Source image local path: ${task.sourceImage.localPath}`,
        task.sourceImage.uri ? `Source image URI: ${task.sourceImage.uri}` : undefined,
        `Package: ${task.packageLabel} (${task.packageKey})`,
        task.imageSize ? `Image size: ${task.imageSize}` : undefined,
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

function buildFactoryVideoGenerationMessages(task: FactoryVideoGenerationTask): DesktopModelChatMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You are a QiuAI WorkOS digital factory video generation executor.',
        'Generate exactly one short video for the requested item and package.',
        'Return JSON only: {"remoteUrl":"https://...","thumbnailPath":"https://..."} or {"localPath":"C:\\\\...\\\\video.mp4"}.',
        'Do not return video binary data, base64, or markdown.'
      ].join('\n')
    },
    {
      role: 'user',
      content: [
        `Internal item id: ${task.sku}`,
        task.sourceName ? `Source name: ${task.sourceName}` : undefined,
        task.sourceImage?.localPath ? `Source image local path: ${task.sourceImage.localPath}` : undefined,
        task.sourceImage?.uri ? `Source image URI: ${task.sourceImage.uri}` : undefined,
        `Package: ${task.packageLabel} (${task.packageKey})`,
        task.packageDescription ? `Package description: ${task.packageDescription}` : undefined,
        task.targetPlatform.label ? `Target platform: ${task.targetPlatform.label}` : undefined,
        task.targetPlatform.notes ? `Platform notes: ${task.targetPlatform.notes}` : undefined,
        `Video duration: ${task.durationSeconds} seconds`,
        `Video aspect ratio: ${task.videoRatio}`,
        'Prompt:',
        task.prompt,
        task.negativePrompt ? `Negative prompt: ${task.negativePrompt}` : undefined
      ].filter(Boolean).join('\n')
    }
  ];
}

export function readFactoryImageGenerationResponse(
  response: DesktopModelChatResponse
): { remoteUrl?: string; localPath?: string; thumbnailPath?: string; providerJobId?: string; providerStatus?: string; pending?: boolean } {
  const artifactResults = (response.artifacts ?? []).map((artifact) => ({
    remoteUrl: readWorkflowRuntimeString(artifact.remoteUrl),
    localPath: readWorkflowRuntimeString(artifact.localPath),
    thumbnailPath: readWorkflowRuntimeString(artifact.thumbnailPath),
    providerJobId: readWorkflowRuntimeString(artifact.providerJobId)
      ?? readWorkflowRuntimeString(artifact.metadata?.providerJobId),
    providerStatus: readWorkflowRuntimeString(artifact.providerStatus)
      ?? readWorkflowRuntimeString(artifact.metadata?.providerStatus),
    pending: artifact.metadata?.pending === true ? true : undefined
  }));
  const successfulArtifact = artifactResults.find((item) => item.remoteUrl || item.localPath);
  if (successfulArtifact) {
    return successfulArtifact;
  }

  const pendingArtifact = artifactResults.find((item) => item.providerJobId);
  const parsed = parseWorkflowRuntimeJson(response.content);
  const parsedResult = readFactoryImageResultFromValue(parsed);
  if (parsedResult.remoteUrl || parsedResult.localPath) {
    return {
      ...parsedResult,
      providerJobId: parsedResult.providerJobId ?? pendingArtifact?.providerJobId,
      providerStatus: parsedResult.providerStatus ?? pendingArtifact?.providerStatus
    };
  }

  const contentUrl = extractFirstHttpUrl(response.content);
  if (contentUrl) {
    return {
      remoteUrl: contentUrl,
      providerJobId: pendingArtifact?.providerJobId,
      providerStatus: pendingArtifact?.providerStatus
    };
  }

  if (pendingArtifact) {
    return {
      ...pendingArtifact,
      pending: true
    };
  }

  return parsedResult;
}

function readFactoryImageResultFromValue(value: unknown): {
  remoteUrl?: string;
  localPath?: string;
  thumbnailPath?: string;
  providerJobId?: string;
  providerStatus?: string;
  pending?: boolean;
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
  const providerJobId = readWorkflowRuntimeString(value.providerJobId)
    ?? readWorkflowRuntimeString(value.taskId)
    ?? readWorkflowRuntimeString(value.task_id)
    ?? readWorkflowRuntimeString(value.id);
  const providerStatus = readWorkflowRuntimeString(value.providerStatus)
    ?? readWorkflowRuntimeString(value.status);
  if (directRemoteUrl || directLocalPath) {
    return {
      remoteUrl: directRemoteUrl,
      localPath: directLocalPath,
      thumbnailPath: readWorkflowRuntimeString(value.thumbnailPath)
        ?? readWorkflowRuntimeString(value.thumbnailUrl),
      providerJobId,
      providerStatus
    };
  }

  if (providerJobId || providerStatus || value.pending === true) {
    return {
      providerJobId,
      providerStatus,
      pending: true
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

function readFactoryVideoGenerationResponse(
  response: DesktopModelChatResponse
): { remoteUrl?: string; localPath?: string; thumbnailPath?: string; providerJobId?: string; providerStatus?: string } {
  const artifact = response.artifacts?.find((item) => item.remoteUrl || item.localPath);
  if (artifact) {
    return {
      remoteUrl: readWorkflowRuntimeString(artifact.remoteUrl),
      localPath: readWorkflowRuntimeString(artifact.localPath),
      thumbnailPath: readWorkflowRuntimeString(artifact.thumbnailPath),
      providerJobId: readWorkflowRuntimeString(artifact.providerJobId),
      providerStatus: readWorkflowRuntimeString(artifact.providerStatus)
    };
  }

  const parsed = parseWorkflowRuntimeJson(response.content);
  const fromJson = readFactoryVideoResultFromValue(parsed);
  if (fromJson.remoteUrl || fromJson.localPath) {
    return fromJson;
  }

  return {
    remoteUrl: extractFirstHttpUrl(response.content)
  };
}

function readFactoryVideoResultFromValue(value: unknown): {
  remoteUrl?: string;
  localPath?: string;
  thumbnailPath?: string;
  providerJobId?: string;
  providerStatus?: string;
} {
  if (typeof value === 'string') {
    return value.startsWith('http://') || value.startsWith('https://')
      ? { remoteUrl: value }
      : { localPath: value };
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const result = readFactoryVideoResultFromValue(item);
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
    ?? readWorkflowRuntimeString(value.videoUrl)
    ?? readWorkflowRuntimeString(value.video_url)
    ?? readWorkflowRuntimeString(value.outputUrl)
    ?? readWorkflowRuntimeString(value.output_url);
  const directLocalPath =
    readWorkflowRuntimeString(value.localPath)
    ?? readWorkflowRuntimeString(value.path)
    ?? readWorkflowRuntimeString(value.filePath);
  if (directRemoteUrl || directLocalPath) {
    return {
      remoteUrl: directRemoteUrl,
      localPath: directLocalPath,
      thumbnailPath: readWorkflowRuntimeString(value.thumbnailPath)
        ?? readWorkflowRuntimeString(value.thumbnailUrl),
      providerJobId: readWorkflowRuntimeString(value.providerJobId)
        ?? readWorkflowRuntimeString(value.taskId)
        ?? readWorkflowRuntimeString(value.id),
      providerStatus: readWorkflowRuntimeString(value.providerStatus)
        ?? readWorkflowRuntimeString(value.status)
    };
  }

  for (const key of ['video', 'videos', 'artifact', 'artifacts', 'data', 'result', 'output']) {
    const nested = readFactoryVideoResultFromValue(value[key]);
    if (nested.remoteUrl || nested.localPath) {
      return nested;
    }
  }

  return {};
}

function buildFactoryImageGenerationFallbackPrompt(
  item: FactoryRuntimeItem,
  packageItem: FactoryRuntimePackage,
  platform: FactoryRuntimePlatform,
  promptControls?: FactoryRuntimePromptControls
): string {
  const packagePrompt = packageItem.promptTemplate ?? packageItem.description;

  return [
    `Use the source product image ${item.image.localPath} as the reference.`,
    `Create a ${packageItem.label} image for source image ${item.sourceName ?? item.image.name ?? item.sku}.`,
    packagePrompt ? `Package prompt: ${packagePrompt}.` : undefined,
    platform.label ? `Target platform: ${platform.label}.` : undefined,
    platform.imageRatio ? `Required ratio: ${platform.imageRatio}.` : undefined,
    platform.notes ? `Platform notes: ${platform.notes}.` : undefined,
    promptControls?.language ? `Text language: ${promptControls.language}.` : undefined,
    promptControls?.globalPrompt ? `Global prompt: ${promptControls.globalPrompt}.` : undefined,
    promptControls?.style ? `Image style: ${promptControls.style}.` : undefined,
    promptControls?.desiredEffect ? `Desired effect: ${promptControls.desiredEffect}.` : undefined,
    promptControls?.mustKeep ? `Must preserve: ${promptControls.mustKeep}.` : undefined,
    promptControls?.avoid ? `Avoid: ${promptControls.avoid}.` : undefined,
    promptControls?.extraInstruction ? `Extra instruction: ${promptControls.extraInstruction}.` : undefined,
    'Preserve the product identity, shape, color, material, logo, and important details.'
  ].filter(Boolean).join('\n')
}

function buildFactoryVideoGenerationFallbackPrompt(
  item: FactoryRuntimeItem,
  packageItem: FactoryRuntimePackage,
  platform: FactoryRuntimePlatform,
  videoConfig: { durationSeconds: number; ratio: string },
  promptControls?: FactoryRuntimePromptControls
): string {
  const packagePrompt = packageItem.promptTemplate ?? packageItem.description;

  return [
    `Use the source product image ${item.image.localPath} as the visual reference.`,
    `Create one ecommerce product video for source image ${item.sourceName ?? item.image.name ?? item.sku}.`,
    `Video package: ${packageItem.label} (${packageItem.key}).`,
    packagePrompt ? `Package prompt: ${packagePrompt}.` : undefined,
    `Required duration: ${videoConfig.durationSeconds} seconds.`,
    `Required aspect ratio: ${videoConfig.ratio}.`,
    promptControls?.language ? `On-screen text language: ${promptControls.language}.` : undefined,
    promptControls?.style ? `Video style: ${promptControls.style}.` : undefined,
    promptControls?.desiredEffect ? `Desired effect: ${promptControls.desiredEffect}.` : undefined,
    promptControls?.mustKeep ? `Must preserve: ${promptControls.mustKeep}.` : undefined,
    promptControls?.avoid ? `Avoid: ${promptControls.avoid}.` : undefined,
    promptControls?.extraInstruction ? `Extra instruction: ${promptControls.extraInstruction}.` : undefined,
    'Preserve the product identity, shape, color, material, logo, and important details.',
    'Do not invent unsupported product functions or misleading claims.'
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
  factoryOutputs?: FactoryOutputItem[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
}> {
  const academicDemoPreparedResult = completeWorkflowRuntimeAcademicDemoPreparedNode(input);
  if (academicDemoPreparedResult) {
    return academicDemoPreparedResult;
  }

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

function collectWorkflowRuntimeVisionInputs(
  node: WorkflowGraphNode,
  pool: WorkflowVariablePool,
  variables: Array<{ ref: string; value: WorkflowRuntimeValue }>
): NonNullable<DesktopModelChatRequest['visionInputs']> | undefined {
  if (getWorkflowEffectiveModelTaskType(node) !== 'vision') {
    return undefined;
  }

  const imageFiles = [
    ...variables.flatMap((variable) => readWorkflowRuntimeFiles(variable.value)),
    ...readWorkflowRuntimeFiles(pool.get('start.images') ?? []),
    ...readFactoryRuntimeItems(pool.get('factory_items')).map((item) => item.image)
  ].filter((file) => file.kind === 'image' || Boolean(inferFactoryImageMimeType(file.name)));
  const seen = new Set<string>();
  const inputs = imageFiles.flatMap((file) => {
    const imagePath = file.localPath.trim();
    if (!imagePath || seen.has(imagePath)) {
      return [];
    }
    seen.add(imagePath);
    return [
      {
        imagePath,
        mimeType: file.mimeType ?? inferFactoryImageMimeType(file.name)
      }
    ];
  });

  return inputs.length > 0 ? inputs.slice(0, maxVisionInputImages) : undefined;
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

  if (toolId === 'browser-automation') {
    const explicitUrl =
      typeof config.url === 'string'
        ? String(resolveWorkflowRuntimeConfigValue(config.url, pool))
        : undefined;
    const url = explicitUrl || extractFirstUrl(query || String(pool.get('start.text') ?? ''));
    if (!url) {
      return undefined;
    }

    return {
      toolId,
      action: 'browser.extract_text',
      input: {
        url,
        waitForUserSeconds: readWorkflowRuntimeNumber(config.waitForUserSeconds, 1),
        maxChars: readWorkflowRuntimeNumber(config.maxChars, 50_000),
        show: config.show !== false,
        closeAfter: config.closeAfter === true,
        allowPrivateNetwork: config.allowPrivateNetwork === true
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

function extractFirstUrl(text: string): string | undefined {
  const match = text.match(/https?:\/\/[^\s"'<>，。；、）)]+/i);
  return match?.[0];
}

function isOptionalCrossBorderFactoryPromptNode(
  node: WorkflowGraphNode,
  rolePackage?: RolePackageManifest
): boolean {
  const isCrossBorderFactory = isImageFactoryRolePackage(rolePackage);

  return (
    isCrossBorderFactory &&
    node.id === 'generate_package_prompts' &&
    getWorkflowEffectiveModelTaskType(node) === 'vision'
  );
}

function isOptionalCrossBorderFactoryQualityCheckNode(
  node: WorkflowGraphNode,
  rolePackage?: RolePackageManifest
): boolean {
  const factoryKind = readRolePackageFactoryKind(rolePackage);
  const isSupportedFactory =
    isImageFactoryRolePackage(rolePackage) ||
    isReferenceImageVideoFactoryRuntimeKind(factoryKind) ||
    rolePackage?.templateId === 'factory_ecommerce_product_videos_v1';

  return (
    isSupportedFactory &&
    node.id === 'quality_check' &&
    getWorkflowEffectiveModelTaskType(node) === 'vision'
  );
}

function isReferenceImageVideoFactoryRuntimeKind(factoryKind: string | undefined) {
  return factoryKind === 'ecommerce_product_video_factory' ||
    factoryKind === 'digital_spokesperson_video_factory' ||
    factoryKind === 'ad_social_media_video_factory';
}

function isImageFactoryRuntimeKind(factoryKind: string | undefined) {
  return factoryKind === 'cross_border_product_image_factory' || factoryKind?.endsWith('_image_factory') === true;
}

function readRolePackageFactoryKind(rolePackage?: RolePackageManifest): string | undefined {
  const kind = readWorkflowRuntimeString(
    rolePackage?.dependencyManifest?.factory &&
      isWorkflowRuntimeRecord(rolePackage.dependencyManifest.factory)
      ? rolePackage.dependencyManifest.factory.kind
      : undefined
  );
  return kind;
}

function isImageFactoryRolePackage(rolePackage?: RolePackageManifest) {
  const kind = readRolePackageFactoryKind(rolePackage);
  return (
    isImageFactoryRuntimeKind(kind) ||
    rolePackage?.templateId === 'factory_cross_border_product_images_v1' ||
    (rolePackage?.templateId?.startsWith('factory_') === true &&
      rolePackage.templateId.endsWith('_images_v1')) ||
    rolePackage?.roleCode === 'cross-border-image-factory' ||
    rolePackage?.roleCode.includes('cross-border') === true
  );
}

function shouldRunCrossBorderFactoryImageUnderstanding(pool: WorkflowVariablePool): boolean {
  const factoryRequest = readFactoryRuntimeObject(pool.get('factory_request'));
  return readFactoryRuntimeBoolean(
    factoryRequest?.enableImageUnderstanding ??
    factoryRequest?.imageUnderstandingEnabled ??
    factoryRequest?.useImageUnderstanding
  );
}

function shouldRunCrossBorderFactorySmartQualityCheck(pool: WorkflowVariablePool): boolean {
  const mode = readWorkflowRuntimeString(pool.get('quality_check_mode'))?.toLowerCase();
  const factoryRequest = readFactoryRuntimeObject(pool.get('factory_request'));
  const requestMode = readWorkflowRuntimeString(factoryRequest?.qualityCheckMode)?.toLowerCase();
  return (mode ?? requestMode) === 'smart';
}

function readFactoryGeneratedMediaPoolKey(factoryKind: string | undefined): 'factory_generated_images' | 'factory_generated_videos' {
  return isReferenceImageVideoFactoryRuntimeKind(factoryKind)
    ? 'factory_generated_videos'
    : 'factory_generated_images';
}

function completeOptionalCrossBorderFactoryPromptNodeWithoutVisionModel(input: {
  task: DesktopTaskDetail;
  node: WorkflowGraphNode;
  pool: WorkflowVariablePool;
  createdAt: string;
  currentResponse: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  reason: string;
  intro?: string;
}): {
  response: DesktopModelChatResponse;
  primaryProfile: ModelProfile;
  logs: DesktopExecutionLogEntry[];
  usedToolIds: string[];
  generatedArtifacts: DesktopArtifactSummary[];
  inputVariables: string[];
  outputVariables: string[];
  message: string;
} {
  const message = [
    input.intro ?? '图片理解增强已跳过。',
    '后续生图将使用平台、产物包和用户提示词控制生成兜底提示词。',
    `原因：${input.reason}`
  ].join('\n');
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text: '[]',
    json: [],
    result: [],
    outputValue: []
  });

  input.pool.set('runtime.previous_text', message);
  input.pool.set('runtime.last_model_node', input.node.id);

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.primaryProfile.providerName,
      modelName: input.primaryProfile.modelName,
      content: message
    }),
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'warning',
        'WORKFLOW_RUNTIME_OPTIONAL_VISION_SKIPPED',
        message,
        input.createdAt,
        sanitizeLogSuffix(input.node.id),
        {
          reason: input.reason,
          fallback: 'factory_image_generation_fallback_prompt'
        }
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables,
    message
  };
}

function completeCrossBorderFactoryQualityCheckWithoutVisionModel(input: {
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
} {
  const factoryRequest = readFactoryRuntimeObject(input.pool.get('factory_request'));
  const mode =
    readWorkflowRuntimeString(input.pool.get('quality_check_mode'))?.toLowerCase() ??
    readWorkflowRuntimeString(factoryRequest?.qualityCheckMode)?.toLowerCase() ??
    'none';
  const factoryKind = readWorkflowRuntimeString(factoryRequest?.factoryKind);
  const generatedMedia = input.pool.get(readFactoryGeneratedMediaPoolKey(factoryKind));
  const mediaCount = Array.isArray(generatedMedia)
    ? generatedMedia.length
    : isWorkflowRuntimeRecord(generatedMedia) && Array.isArray(generatedMedia.items)
      ? generatedMedia.items.length
      : 0;
  const mediaLabel = isReferenceImageVideoFactoryRuntimeKind(factoryKind) ? '视频' : '图片';
  const report = {
    mode,
    passed: true,
    skippedSmartCheck: true,
    mediaCount,
    issues: [] as string[],
    message: mode === 'basic'
      ? `基础质检完成：已跳过额外多模态${mediaLabel}质检，保留人工发布前复核。`
      : '未启用质检：已跳过额外多模态质检，保留人工发布前复核。'
  };
  const text = JSON.stringify(report, null, 2);
  const outputVariables = writeWorkflowNodeOutputs({
    pool: input.pool,
    node: input.node,
    text,
    json: report,
    result: report,
    outputValue: report
  });

  input.pool.set('runtime.previous_text', text);
  input.pool.set('runtime.last_model_node', input.node.id);

  return {
    response: mergeWorkflowRuntimeResponses(input.currentResponse, {
      provider: input.primaryProfile.providerName,
      modelName: input.primaryProfile.modelName,
      content: text
    }),
    primaryProfile: input.primaryProfile,
    logs: [
      createLog(
        input.task.taskId,
        'info',
        'WORKFLOW_RUNTIME_OPTIONAL_VISION_SKIPPED',
        report.message,
        input.createdAt,
        sanitizeLogSuffix(input.node.id),
        {
          mode,
          mediaCount,
          fallback: 'factory_basic_quality_check'
        }
      )
    ],
    usedToolIds: [],
    generatedArtifacts: [],
    inputVariables: input.node.inputVariables ?? [],
    outputVariables,
    message: report.message
  };
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

  if (taskType === 'audio_generation') {
    return ['text_to_audio'];
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
  if (taskType === 'audio_generation') return 'qiu-audio-generation-default';
  if (taskType === 'image_generation') return 'qiu-image-generation-default';
  if (taskType === 'image_editing') return 'qiu-image-editing-default';
  if (taskType === 'video_generation') return 'qiu-video-generation-default';
  if (taskType === 'video_understanding') return 'qiu-vision-default';
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
  const semanticDefaultProfileId = getWorkflowSemanticDefaultProfileId(node);
  const asset = modelAssetKey
    ? modelAssets.find((item) => item.key === modelAssetKey)
    : modelAssets.find(
        (item) =>
          item.nodeIds.includes(node.id) &&
          readDependencyManifestSemanticModelProfileId(item) === semanticDefaultProfileId
      ) ?? modelAssets.find((item) => item.nodeIds.includes(node.id));
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
  const declaredProfileId = asset.modelProfileId || asset.modelId || asset.key;
  const declaredSemanticProfileId = normalizeRuntimeRequirementModelProfileId(declaredProfileId);
  if (declaredProfileId.trim().toLowerCase().startsWith('qiu-')) {
    return declaredSemanticProfileId;
  }

  return getSemanticModelProfileIdForAssetCapabilities({
    capabilities: asset.capabilities,
    inputTypes: asset.inputTypes,
    outputTypes: asset.outputTypes
  }) ?? declaredSemanticProfileId;
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
  if (capabilities.has('text_to_audio')) return 'qiu-audio-generation-default';
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
  if (capabilities.has('video_generation') || capabilities.has('text_to_video') || capabilities.has('image_to_video') || outputTypes.has('video')) {
    return 'qiu-video-generation-default';
  }
  if (
    capabilities.has('image_understanding') ||
    capabilities.has('vision_understanding') ||
    capabilities.has('vision_text') ||
    (inputTypes.has('image') && (outputTypes.has('text') || outputTypes.has('json')))
  ) {
    return 'qiu-vision-default';
  }
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

  if (
    request.toolId === 'local-filesystem' &&
    request.action === 'filesystem.download_remote_file' &&
    ['png', 'jpg', 'mp4'].includes(artifactType)
  ) {
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
  if (artifactType === 'png' || artifactType === 'jpg') return 'generated-images';
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
  const unconfiguredProfiles = modelProfiles.filter((profile) => !isModelApiConfigured(profile));
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

  if ((artifactType === 'png' || artifactType === 'jpg') && hasAction('local-filesystem', 'filesystem.download_remote_file')) {
    return 'local-filesystem/filesystem.download_remote_file';
  }

  if (artifactType === 'mp4' && hasAction('video-processing', 'video.compose_clips')) {
    return 'video-processing/video.compose_clips';
  }

  if (artifactType === 'mp4' && hasAction('local-filesystem', 'filesystem.download_remote_file')) {
    return 'local-filesystem/filesystem.download_remote_file';
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
  if (isOfficialPointsModelProfile(profile)) {
    return true;
  }

  return Boolean(profile.apiBaseUrl?.trim() && profile.apiKey?.trim());
}

function normalizeRuntimeRequirementModelProfileId(profileId: string): string {
  const normalized = profileId.trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.startsWith('qiu-')) return profileId.trim();
  if (normalized.includes('text_to_audio') || normalized.includes('tts') || normalized.includes('text-to-speech') || normalized.includes('speech_generation')) return 'qiu-audio-generation-default';
  if (normalized.includes('asr') || normalized.includes('speech_to_text') || normalized.includes('speech-to-text') || normalized.includes('audio_to_text') || normalized.includes('transcription')) return 'qiu-asr-default';
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
  if (
    normalized.includes('veo') ||
    normalized.includes('kling') ||
    normalized.includes('pika') ||
    normalized.includes('hailuo') ||
    normalized.includes('runway') ||
    normalized.includes('sora') ||
    normalized.includes('seedance') ||
    normalized.includes('text-to-video') ||
    normalized.includes('image-to-video') ||
    normalized.includes('t2v') ||
    normalized.includes('i2v') ||
    normalized.includes('wanx-video')
  ) {
    return 'qiu-video-generation-default';
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
