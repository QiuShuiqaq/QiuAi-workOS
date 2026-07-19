import type { PlanCode } from '../types/plan-code';

export interface MockWorkspaceSummary {
  id: string;
  tenantId: string;
  workspaceType: 'personal' | 'enterprise';
  name: string;
  ownerAccountId: string;
  status: 'active' | 'suspended' | 'archived';
  planCode: PlanCode;
}

export interface MockPlanDetail {
  code: string;
  name: string;
  billingCycle: string;
  priceCents?: number;
  currency?: string;
  description?: string;
  entitlements: Array<{
    featureKey: string;
    enabled: boolean;
    limitValue?: number;
    limitUnit?: string;
  }>;
}

export interface MockRoleTemplateSummary {
  id: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
}

export interface MockRoleInstanceDetail {
  id: string;
  templateId: string;
  workspaceId: string;
  name: string;
  departmentName?: string;
  ownerName: string;
  status: 'running' | 'trial' | 'configuration_required' | 'paused';
  installedAt: string;
  kpis: {
    taskCompleted: number;
    automationRate: number;
    avgDurationMinutes: number;
    monthlyCost: number;
  };
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  approvalPolicy: string;
  recentTaskIds: string[];
}

export interface MockTaskDetail {
  id: string;
  workspaceId: string;
  roleInstanceId: string;
  roleName: string;
  title: string;
  taskType: string;
  status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  input: string;
  createdAt: string;
  updatedAt: string;
  artifacts: Array<{
    id: string;
    type: 'text' | 'report' | 'video' | 'image' | 'file';
    title: string;
    content: string;
    createdAt: string;
  }>;
  executionLogs: Array<{
    id: string;
    level: 'info' | 'warning' | 'error';
    eventType: string;
    message: string;
    createdAt: string;
  }>;
  costRecords: Array<{
    id: string;
    provider: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: number;
    currency: string;
    createdAt: string;
  }>;
  currentRun?: {
    id: string;
    taskId: string;
    status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
    startedAt?: string;
    finishedAt?: string;
  };
}

export interface MockPlatformMetricSummary {
  key: string;
  title: string;
  value: string;
  trend?: string;
}

export const demoAccount = {
  id: 'account_demo',
  primaryEmail: 'admin@qiuai.local',
  status: 'active' as const
};

export const demoWorkspaces: MockWorkspaceSummary[] = [
  {
    id: 'personal',
    tenantId: 'tenant_personal',
    workspaceType: 'personal' as const,
    name: '个人工作空间',
    ownerAccountId: demoAccount.id,
    status: 'active' as const,
    planCode: 'PERSONAL_FREE'
  },
  {
    id: 'enterprise',
    tenantId: 'tenant_enterprise',
    workspaceType: 'enterprise' as const,
    name: '秋艾科技',
    ownerAccountId: demoAccount.id,
    status: 'active' as const,
    planCode: 'ENTERPRISE_MONTHLY'
  }
];

export const demoPlans: MockPlanDetail[] = [
  {
    code: 'PERSONAL_FREE',
    name: 'Personal Free',
    billingCycle: 'FREE',
    priceCents: 0,
    currency: 'CNY',
    description: '个人免费版，支持基础 AI 员工搭建。',
    entitlements: [
      { featureKey: 'maxRoleInstances', enabled: true, limitValue: 3, limitUnit: 'count' },
      { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 100, limitUnit: 'count' },
      { featureKey: 'maxKnowledgeBases', enabled: true, limitValue: 1, limitUnit: 'count' },
      { featureKey: 'maxStorageGB', enabled: true, limitValue: 5, limitUnit: 'GB' },
      { featureKey: 'maxMembers', enabled: true, limitValue: 1, limitUnit: 'count' },
      { featureKey: 'canCreateDepartment', enabled: false },
      { featureKey: 'canInviteMember', enabled: false },
      { featureKey: 'canUseApprovalPolicy', enabled: false },
      { featureKey: 'canUseAuditLog', enabled: false },
      { featureKey: 'canUseAdvancedToolConnector', enabled: false },
      { featureKey: 'canUseCostBudget', enabled: false },
      { featureKey: 'canUseEnterpriseKPIDashboard', enabled: false }
    ]
  },
  {
    code: 'ENTERPRISE_MONTHLY',
    name: 'Enterprise Monthly',
    billingCycle: 'MONTHLY',
    priceCents: undefined,
    currency: 'CNY',
    description: '企业月付版，以企业、部门和岗位为核心。',
    entitlements: [
      { featureKey: 'maxRoleInstances', enabled: true, limitValue: 50, limitUnit: 'count' },
      { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 10000, limitUnit: 'count' },
      { featureKey: 'maxKnowledgeBases', enabled: true, limitValue: 10, limitUnit: 'count' },
      { featureKey: 'maxStorageGB', enabled: true, limitValue: 200, limitUnit: 'GB' },
      { featureKey: 'maxMembers', enabled: true, limitValue: 50, limitUnit: 'count' },
      { featureKey: 'canCreateDepartment', enabled: true },
      { featureKey: 'canInviteMember', enabled: true },
      { featureKey: 'canUseApprovalPolicy', enabled: true },
      { featureKey: 'canUseAuditLog', enabled: true },
      { featureKey: 'canUseAdvancedToolConnector', enabled: true },
      { featureKey: 'canUseCostBudget', enabled: true },
      { featureKey: 'canUseEnterpriseKPIDashboard', enabled: true }
    ]
  },
  {
    code: 'ENTERPRISE_ANNUAL',
    name: 'Enterprise Annual',
    billingCycle: 'ANNUAL',
    priceCents: undefined,
    currency: 'CNY',
    description: '企业年付版，提供更高额度和实施权益。',
    entitlements: [
      { featureKey: 'maxRoleInstances', enabled: true, limitValue: 120, limitUnit: 'count' },
      { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 50000, limitUnit: 'count' },
      { featureKey: 'maxKnowledgeBases', enabled: true, limitValue: 50, limitUnit: 'count' },
      { featureKey: 'maxStorageGB', enabled: true, limitValue: 1000, limitUnit: 'GB' },
      { featureKey: 'maxMembers', enabled: true, limitValue: 120, limitUnit: 'count' },
      { featureKey: 'canCreateDepartment', enabled: true },
      { featureKey: 'canInviteMember', enabled: true },
      { featureKey: 'canUseApprovalPolicy', enabled: true },
      { featureKey: 'canUseAuditLog', enabled: true },
      { featureKey: 'canUseAdvancedToolConnector', enabled: true },
      { featureKey: 'canUseCostBudget', enabled: true },
      { featureKey: 'canUseEnterpriseKPIDashboard', enabled: true }
    ]
  },
  {
    code: 'ENTERPRISE_CUSTOM',
    name: 'Enterprise Custom',
    billingCycle: 'CUSTOM',
    priceCents: undefined,
    currency: 'CNY',
    description: '企业定制版，支持专属部署、SLA 和高级治理。',
    entitlements: [
      { featureKey: 'maxRoleInstances', enabled: true },
      { featureKey: 'maxTasksPerMonth', enabled: true },
      { featureKey: 'maxKnowledgeBases', enabled: true },
      { featureKey: 'maxStorageGB', enabled: true },
      { featureKey: 'maxMembers', enabled: true },
      { featureKey: 'canCreateDepartment', enabled: true },
      { featureKey: 'canInviteMember', enabled: true },
      { featureKey: 'canUseApprovalPolicy', enabled: true },
      { featureKey: 'canUseAuditLog', enabled: true },
      { featureKey: 'canUseAdvancedToolConnector', enabled: true },
      { featureKey: 'canUseCostBudget', enabled: true },
      { featureKey: 'canUseEnterpriseKPIDashboard', enabled: true }
    ]
  }
];

export const demoRoleTemplates: MockRoleTemplateSummary[] = [
  {
    id: 'template_case_ops',
    name: 'AI案例运营专员',
    industry: '保健品和私域运营',
    scenario: '案例素材识别、筛选、剪辑和发布',
    description: '自动处理客户案例素材，生成筛选结果、内容建议和运营产物。',
    recommendedPlanCode: 'PERSONAL_FREE'
  },
  {
    id: 'template_customer_followup',
    name: 'AI客户回访专员',
    industry: '客户运营',
    scenario: '回访记录整理、意向识别和后续动作建议',
    description: '整理客户回访内容，识别客户意向和风险，并生成跟进建议。',
    recommendedPlanCode: 'ENTERPRISE_MONTHLY'
  },
  {
    id: 'template_contract_review',
    name: 'AI合同审核专员',
    industry: '法律服务',
    scenario: '合同条款审查和风险摘要',
    description: '对合同进行初步风险识别，输出审查摘要和风险提示。',
    recommendedPlanCode: 'ENTERPRISE_MONTHLY'
  }
];

export const demoRoles: MockRoleInstanceDetail[] = [
  {
    id: 'role_case_ops',
    templateId: 'template_case_ops',
    workspaceId: 'enterprise',
    name: 'AI案例运营专员',
    departmentName: '运营部',
    ownerName: '企业管理员',
    status: 'running' as const,
    installedAt: '2026-07-18T00:00:00.000Z',
    businessGoal: '提升案例素材处理效率，稳定完成案例筛选、内容生成和运营复盘。',
    knowledgeSources: ['企业案例标准', '内容发布规范', '历史爆款案例'],
    tools: ['素材库', '内容发布系统', '数据看板'],
    approvalPolicy: '发布前需要运营负责人审批',
    recentTaskIds: ['task_case_screening'],
    kpis: {
      taskCompleted: 86,
      automationRate: 0.92,
      avgDurationMinutes: 8,
      monthlyCost: 326
    }
  },
  {
    id: 'role_customer_followup',
    templateId: 'template_customer_followup',
    workspaceId: 'enterprise',
    name: 'AI客户回访专员',
    departmentName: '客服部',
    ownerName: '客服主管',
    status: 'configuration_required' as const,
    installedAt: '2026-07-18T00:00:00.000Z',
    businessGoal: '沉淀客户回访记录，识别客户意向并推动后续跟进。',
    knowledgeSources: ['客户分层规则', '回访话术', '售后政策'],
    tools: ['CRM', '回访记录表'],
    approvalPolicy: '高风险客户建议需要人工确认',
    recentTaskIds: ['task_customer_notes'],
    kpis: {
      taskCompleted: 31,
      automationRate: 0.74,
      avgDurationMinutes: 11,
      monthlyCost: 148
    }
  },
  {
    id: 'role_contract_review',
    templateId: 'template_contract_review',
    workspaceId: 'enterprise',
    name: 'AI合同审核专员',
    departmentName: '法务部',
    ownerName: '法务负责人',
    status: 'trial' as const,
    installedAt: '2026-07-18T00:00:00.000Z',
    businessGoal: '对合同进行初审，减少法务重复审查时间。',
    knowledgeSources: ['合同模板库', '风险条款清单'],
    tools: ['文档库'],
    approvalPolicy: '所有合同结论必须经法务确认',
    recentTaskIds: ['task_contract_summary'],
    kpis: {
      taskCompleted: 12,
      automationRate: 0.68,
      avgDurationMinutes: 18,
      monthlyCost: 368
    }
  }
];

export const demoTasks: MockTaskDetail[] = [
  {
    id: 'task_case_screening',
    workspaceId: 'enterprise',
    roleInstanceId: 'role_case_ops',
    title: '案例视频初筛',
    roleName: 'AI案例运营专员',
    taskType: 'case_screening',
    status: 'completed' as const,
    priority: 'normal' as const,
    input: '请筛选今天上传的 128 个案例视频，找出符合发布标准的素材。',
    createdAt: '2026-07-18T01:00:00.000Z',
    updatedAt: '2026-07-18T01:08:00.000Z',
    artifacts: [
      {
        id: 'artifact_case_report',
        type: 'report' as const,
        title: '案例筛选报告',
        content: '共识别 128 个视频，其中 23 个符合发布标准，建议优先处理 7 个高潜素材。',
        createdAt: '2026-07-18T01:08:00.000Z'
      }
    ],
    executionLogs: [
      {
        id: 'log_case_1',
        level: 'info' as const,
        eventType: 'TASK_STARTED',
        message: 'AI案例运营专员开始处理案例视频初筛。',
        createdAt: '2026-07-18T01:00:00.000Z'
      },
      {
        id: 'log_case_2',
        level: 'info' as const,
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
      status: 'completed' as const,
      startedAt: '2026-07-18T01:00:00.000Z',
      finishedAt: '2026-07-18T01:08:00.000Z'
    }
  },
  {
    id: 'task_customer_notes',
    workspaceId: 'enterprise',
    roleInstanceId: 'role_customer_followup',
    title: '客户回访记录整理',
    roleName: 'AI客户回访专员',
    taskType: 'customer_followup',
    status: 'running' as const,
    priority: 'high' as const,
    input: '整理今天的客户回访记录，标记高意向客户。',
    createdAt: '2026-07-18T02:00:00.000Z',
    updatedAt: '2026-07-18T02:05:00.000Z',
    artifacts: [],
    executionLogs: [
      {
        id: 'log_customer_1',
        level: 'info' as const,
        eventType: 'TASK_STARTED',
        message: 'AI客户回访专员开始整理回访记录。',
        createdAt: '2026-07-18T02:00:00.000Z'
      }
    ],
    costRecords: [],
    currentRun: {
      id: 'run_customer_1',
      taskId: 'task_customer_notes',
      status: 'running' as const,
      startedAt: '2026-07-18T02:00:00.000Z'
    }
  },
  {
    id: 'task_contract_summary',
    workspaceId: 'enterprise',
    roleInstanceId: 'role_contract_review',
    title: '合同风险摘要',
    roleName: 'AI合同审核专员',
    taskType: 'contract_review',
    status: 'waiting_approval' as const,
    priority: 'urgent' as const,
    input: '请审查供应商合同，并列出需要法务重点确认的条款。',
    createdAt: '2026-07-18T03:00:00.000Z',
    updatedAt: '2026-07-18T03:18:00.000Z',
    artifacts: [
      {
        id: 'artifact_contract_risk',
        type: 'report' as const,
        title: '合同风险摘要',
        content: '发现 4 项需确认条款：付款周期、违约责任、数据保密、自动续约。',
        createdAt: '2026-07-18T03:18:00.000Z'
      }
    ],
    executionLogs: [
      {
        id: 'log_contract_1',
        level: 'info' as const,
        eventType: 'TASK_STARTED',
        message: 'AI合同审核专员开始合同初审。',
        createdAt: '2026-07-18T03:00:00.000Z'
      },
      {
        id: 'log_contract_2',
        level: 'warning' as const,
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
      status: 'completed' as const,
      startedAt: '2026-07-18T03:00:00.000Z',
      finishedAt: '2026-07-18T03:18:00.000Z'
    }
  }
];

export const demoMetrics: MockPlatformMetricSummary[] = [
  { key: 'roles', title: 'AI 岗位', value: '12', trend: '+2 本月' },
  { key: 'tasks', title: '今日任务', value: '128', trend: '92% 完成' },
  { key: 'approvals', title: '待审批', value: '7', trend: '3 个高优先级' },
  { key: 'cost', title: '本月成本', value: '¥842', trend: '预算内' }
];

export const demoCurrentAccount = {
  account: demoAccount,
  workspaces: demoWorkspaces,
  activeWorkspaceId: 'enterprise'
};
