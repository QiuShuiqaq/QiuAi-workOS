import type { ListTasksResponse, TaskDetail } from '@qiuai/api-contract';

export const fallbackTaskDetails: TaskDetail[] = [
  {
    id: 'task_case_screening',
    workspaceId: 'enterprise',
    roleInstanceId: 'role_case_ops',
    roleName: 'AI案例运营专员',
    title: '案例视频初筛',
    taskType: 'case_screening',
    status: 'completed',
    priority: 'normal',
    input: '请筛选今天上传的 128 个案例视频，找出符合发布标准的素材。',
    createdAt: '2026-07-18T01:00:00.000Z',
    updatedAt: '2026-07-18T01:08:00.000Z',
    artifacts: [
      {
        id: 'artifact_case_report',
        type: 'report',
        title: '案例筛选报告',
        content: '共识别 128 个视频，其中 23 个符合发布标准，建议优先处理 7 个高潜素材。',
        createdAt: '2026-07-18T01:08:00.000Z'
      }
    ],
    executionLogs: [
      {
        id: 'log_case_1',
        level: 'info',
        eventType: 'TASK_STARTED',
        message: 'AI案例运营专员开始处理案例视频初筛。',
        createdAt: '2026-07-18T01:00:00.000Z'
      },
      {
        id: 'log_case_2',
        level: 'info',
        eventType: 'ARTIFACT_CREATED',
        message: '已生成案例筛选报告。',
        createdAt: '2026-07-18T01:08:00.000Z'
      }
    ],
    costRecords: [
      {
        id: 'cost_case_1',
        provider: 'mock',
        modelName: 'mock-runtime-v1',
        inputTokens: 4800,
        outputTokens: 1200,
        totalCost: 3.2,
        currency: 'CNY',
        createdAt: '2026-07-18T01:08:00.000Z'
      }
    ],
    currentRun: {
      id: 'run_case_1',
      taskId: 'task_case_screening',
      status: 'completed',
      startedAt: '2026-07-18T01:00:00.000Z',
      finishedAt: '2026-07-18T01:08:00.000Z'
    }
  },
  {
    id: 'task_customer_notes',
    workspaceId: 'enterprise',
    roleInstanceId: 'role_customer_followup',
    roleName: 'AI客户回访专员',
    title: '客户回访记录整理',
    taskType: 'customer_followup',
    status: 'running',
    priority: 'high',
    input: '整理今天的客户回访记录，标记高意向客户。',
    createdAt: '2026-07-18T02:00:00.000Z',
    updatedAt: '2026-07-18T02:05:00.000Z',
    artifacts: [],
    executionLogs: [
      {
        id: 'log_customer_1',
        level: 'info',
        eventType: 'TASK_STARTED',
        message: 'AI客户回访专员开始整理回访记录。',
        createdAt: '2026-07-18T02:00:00.000Z'
      }
    ],
    costRecords: [],
    currentRun: {
      id: 'run_customer_1',
      taskId: 'task_customer_notes',
      status: 'running',
      startedAt: '2026-07-18T02:00:00.000Z'
    }
  },
  {
    id: 'task_contract_summary',
    workspaceId: 'enterprise',
    roleInstanceId: 'role_contract_review',
    roleName: 'AI合同审核专员',
    title: '合同风险摘要',
    taskType: 'contract_review',
    status: 'waiting_approval',
    priority: 'urgent',
    input: '请审查供应商合同，并列出需要法务重点确认的条款。',
    createdAt: '2026-07-18T03:00:00.000Z',
    updatedAt: '2026-07-18T03:18:00.000Z',
    artifacts: [
      {
        id: 'artifact_contract_risk',
        type: 'report',
        title: '合同风险摘要',
        content: '发现 4 项需确认条款：付款周期、违约责任、数据保密、自动续约。',
        createdAt: '2026-07-18T03:18:00.000Z'
      }
    ],
    executionLogs: [
      {
        id: 'log_contract_1',
        level: 'info',
        eventType: 'TASK_STARTED',
        message: 'AI合同审核专员开始合同初审。',
        createdAt: '2026-07-18T03:00:00.000Z'
      },
      {
        id: 'log_contract_2',
        level: 'warning',
        eventType: 'APPROVAL_REQUIRED',
        message: '合同风险摘要需要法务负责人审批。',
        createdAt: '2026-07-18T03:18:00.000Z'
      }
    ],
    costRecords: [
      {
        id: 'cost_contract_1',
        provider: 'mock',
        modelName: 'mock-runtime-v1',
        inputTokens: 8600,
        outputTokens: 1800,
        totalCost: 7.8,
        currency: 'CNY',
        createdAt: '2026-07-18T03:18:00.000Z'
      }
    ],
    currentRun: {
      id: 'run_contract_1',
      taskId: 'task_contract_summary',
      status: 'completed',
      startedAt: '2026-07-18T03:00:00.000Z',
      finishedAt: '2026-07-18T03:18:00.000Z'
    }
  }
];

export const fallbackTasks: ListTasksResponse = {
  data: fallbackTaskDetails.map((task) => ({
    id: task.id,
    workspaceId: task.workspaceId,
    roleInstanceId: task.roleInstanceId,
    roleName: task.roleName,
    title: task.title,
    taskType: task.taskType,
    status: task.status,
    priority: task.priority,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  }))
};

export function fallbackTaskDetail(taskId: string): TaskDetail {
  return fallbackTaskDetails.find((task) => task.id === taskId) ?? fallbackTaskDetails[0];
}
