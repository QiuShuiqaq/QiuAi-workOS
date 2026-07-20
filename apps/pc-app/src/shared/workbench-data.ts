import type {
  DesktopArtifactSummary,
  DesktopCostRecordSummary,
  DesktopExecutionLogEntry,
  DesktopExecutionRunSummary,
  DesktopTaskDetail,
  DesktopTaskPriority,
  DesktopTaskState,
  DesktopTaskSummary
} from './desktop-contract.js';

export interface MockTaskSeed {
  taskId?: string;
  roleCode: string;
  roleName?: string;
  title: string;
  taskType?: string;
  input?: string;
  priority?: DesktopTaskPriority;
  state?: DesktopTaskState;
  updatedAt?: string;
  createdAt?: string;
  artifactCount?: number;
  costCents?: number;
}

export function createMockTaskSummary(seed: MockTaskSeed): DesktopTaskSummary {
  const detail = createMockTaskDetail({
    ...seed,
    roleName: seed.roleName ?? seed.roleCode
  });

  return toDesktopTaskSummary(detail);
}

export interface MockTaskDetailSeed extends MockTaskSeed {
  roleName: string;
}

export function createMockTaskDetail(seed: MockTaskDetailSeed): DesktopTaskDetail {
  const taskId = seed.taskId ?? createLocalId('task');
  const createdAt = seed.createdAt ?? seed.updatedAt ?? new Date().toISOString();
  const updatedAt = seed.updatedAt ?? createdAt;
  const state = seed.state ?? 'queued';
  const roleName = seed.roleName.trim();
  const taskType = seed.taskType ?? inferTaskType(seed.title, roleName);
  const input = seed.input ?? `请处理任务：${seed.title}`;
  const artifactCount = seed.artifactCount ?? (state === 'completed' ? 1 : 0);
  const costCents = seed.costCents ?? (state === 'queued' ? 0 : estimateTaskCost(seed.title));
  const executionLogs = buildExecutionLogs({
    taskId,
    roleName,
    title: seed.title,
    state,
    createdAt,
    updatedAt,
    artifactCount,
    costCents
  });

  return {
    taskId,
    roleCode: seed.roleCode,
    roleName,
    title: seed.title,
    taskType,
    input,
    priority: seed.priority ?? 'normal',
    state,
    createdAt,
    updatedAt,
    artifactCount,
    costCents,
    artifacts: buildArtifacts({
      taskId,
      title: seed.title,
      state,
      createdAt,
      artifactCount
    }),
    executionLogs,
    costRecords: buildCostRecords({
      taskId,
      title: seed.title,
      createdAt: updatedAt,
      costCents,
      state
    }),
    currentRun: buildCurrentRun({
      taskId,
      state,
      createdAt,
      updatedAt
    })
  };
}

export function createDesktopPreviewTasks(): DesktopTaskSummary[] {
  return createDesktopPreviewTaskDetails().map(toDesktopTaskSummary);
}

export function createDesktopPreviewTaskDetails(): DesktopTaskDetail[] {
  const baseTime = new Date('2026-07-19T06:00:00.000Z');

  return [
    createMockTaskDetail({
      taskId: 'task-preview-case-review',
      roleCode: 'ai-operations-specialist',
      roleName: 'AI 运营专员',
      title: '今日案例筛选',
      taskType: 'content_review',
      state: 'completed',
      updatedAt: baseTime.toISOString(),
      artifactCount: 1,
      costCents: 320
    }),
    createMockTaskDetail({
      taskId: 'task-preview-publish-check',
      roleCode: 'ai-operations-specialist',
      roleName: 'AI 运营专员',
      title: '发布前检查',
      taskType: 'publish_review',
      state: 'waiting_approval',
      updatedAt: new Date(baseTime.getTime() + 18 * 60 * 1000).toISOString(),
      artifactCount: 0,
      costCents: 120
    })
  ];
}

export function createTaskDetailFromSummary(
  summary: DesktopTaskSummary,
  roleName?: string,
  taskType?: string
): DesktopTaskDetail {
  return createMockTaskDetail({
    taskId: summary.taskId,
    roleCode: summary.roleCode,
    roleName: roleName ?? summary.roleCode,
    title: summary.title,
    taskType: taskType ?? inferTaskType(summary.title, roleName ?? summary.roleCode),
    state: summary.state,
    createdAt: summary.updatedAt,
    updatedAt: summary.updatedAt,
    artifactCount: summary.artifactCount ?? 0,
    costCents: summary.costCents ?? 0
  });
}

export function toDesktopTaskSummary(detail: DesktopTaskDetail): DesktopTaskSummary {
  return {
    taskId: detail.taskId,
    roleCode: detail.roleCode,
    title: detail.title,
    state: detail.state,
    updatedAt: detail.updatedAt,
    artifactCount: detail.artifactCount ?? detail.artifacts.length,
    costCents: detail.costCents ?? aggregateCostCents(detail.costRecords)
  };
}

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function inferTaskType(title: string, roleName: string): string {
  const text = `${title} ${roleName}`;
  if (/合同|法务/.test(text)) return 'contract_review';
  if (/客户|回访|客服/.test(text)) return 'customer_followup';
  if (/发布|案例|内容|运营/.test(text)) return 'content_review';
  return 'general_assist';
}

function buildExecutionLogs(input: {
  taskId: string;
  roleName: string;
  title: string;
  state: DesktopTaskState;
  createdAt: string;
  updatedAt: string;
  artifactCount: number;
  costCents: number;
}): DesktopExecutionLogEntry[] {
  const startedAt = input.createdAt;
  const finishedAt = input.updatedAt;
  const logs: DesktopExecutionLogEntry[] = [
    {
      id: `${input.taskId}-log-start`,
      level: 'info',
      eventType: 'TASK_STARTED',
      message: `${input.roleName} 开始处理任务「${input.title}」。`,
      createdAt: startedAt
    }
  ];

  if (input.state === 'waiting_approval') {
    logs.push({
      id: `${input.taskId}-log-approval`,
      level: 'warning',
      eventType: 'APPROVAL_REQUIRED',
      message: '任务已生成可验收产物，等待人工确认。',
      createdAt: finishedAt
    });
  }

  if (input.state === 'completed') {
    logs.push({
      id: `${input.taskId}-log-artifact`,
      level: 'info',
      eventType: 'ARTIFACT_CREATED',
      message: `已生成 ${Math.max(input.artifactCount, 1)} 个产物。`,
      createdAt: finishedAt
    });
    logs.push({
      id: `${input.taskId}-log-complete`,
      level: 'info',
      eventType: 'TASK_COMPLETED',
      message: `任务「${input.title}」已完成，成本约 ${formatCents(input.costCents)}。`,
      createdAt: finishedAt
    });
  }

  if (input.state === 'failed') {
    logs.push({
      id: `${input.taskId}-log-failed`,
      level: 'error',
      eventType: 'TASK_FAILED',
      message: '任务执行失败，需要重新检查输入或工具状态。',
      createdAt: finishedAt
    });
  }

  if (input.state === 'cancelled') {
    logs.push({
      id: `${input.taskId}-log-cancelled`,
      level: 'warning',
      eventType: 'TASK_CANCELLED',
      message: '任务已取消。',
      createdAt: finishedAt
    });
  }

  return logs;
}

function buildArtifacts(input: {
  taskId: string;
  title: string;
  state: DesktopTaskState;
  createdAt: string;
  artifactCount: number;
}): DesktopArtifactSummary[] {
  if (input.artifactCount <= 0 && input.state !== 'completed') {
    return [];
  }

  const count = Math.max(1, input.artifactCount);
  return Array.from({ length: count }, (_, index) => ({
    id: `${input.taskId}-artifact-${index + 1}`,
    type: 'report',
    title: `${input.title} - 产物 ${index + 1}`,
    content: `这是任务「${input.title}」生成的本地产物 ${index + 1}。`,
    createdAt: input.createdAt
  }));
}

function buildCostRecords(input: {
  taskId: string;
  title: string;
  createdAt: string;
  costCents: number;
  state: DesktopTaskState;
}): DesktopCostRecordSummary[] {
  if (input.costCents <= 0) {
    return [];
  }

  return [
    {
      id: `${input.taskId}-cost-1`,
      provider: 'local-mock',
      modelName: 'qiu-runtime-mock',
      inputTokens: estimateInputTokens(input.title),
      outputTokens: estimateOutputTokens(input.title, input.state),
      costCents: input.costCents,
      currency: 'CNY',
      createdAt: input.createdAt
    }
  ];
}

function buildCurrentRun(input: {
  taskId: string;
  state: DesktopTaskState;
  createdAt: string;
  updatedAt: string;
}): DesktopExecutionRunSummary {
  const status: DesktopExecutionRunSummary['status'] =
    input.state === 'running'
      ? 'running'
      : input.state === 'completed'
        ? 'completed'
        : input.state === 'failed'
          ? 'failed'
          : input.state === 'cancelled'
            ? 'cancelled'
            : 'queued';

  return {
    id: `${input.taskId}-run-1`,
    taskId: input.taskId,
    status,
    startedAt: input.createdAt,
    finishedAt: status === 'running' || status === 'queued' ? undefined : input.updatedAt
  };
}

function aggregateCostCents(costRecords: DesktopCostRecordSummary[]): number {
  return costRecords.reduce((sum, record) => sum + record.costCents, 0);
}

function estimateInputTokens(title: string): number {
  return Math.max(100, title.length * 40);
}

function estimateOutputTokens(title: string, state: DesktopTaskState): number {
  const multiplier = state === 'completed' ? 18 : state === 'waiting_approval' ? 12 : 8;
  return Math.max(80, title.length * multiplier);
}

function estimateTaskCost(title: string): number {
  return Math.max(80, title.length * 12);
}

function formatCents(value: number): string {
  return `¥${(value / 100).toFixed(2)}`;
}
