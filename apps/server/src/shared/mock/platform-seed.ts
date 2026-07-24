import type { PlanCode } from '../types/plan-code';
import {
  serverRoleTemplateCatalog,
  type ServerRoleSkill
} from '../role-template-catalog';

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
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  skills: ServerRoleSkill[];
  approvalPolicy: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  allowedPlanCodes: string[];
  visibleWorkspaceIds: string[];
  publishedAt?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MockRoleInstanceDetail {
  id: string;
  templateId: string;
  templateVersion: string;
  workspaceId: string;
  name: string;
  departmentName?: string;
  ownerName: string;
  status: 'running' | 'trial' | 'configuration_required' | 'paused';
  installedAt: string;
  skills: ServerRoleSkill[];
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

const roleTemplateById = new Map(
  serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const)
);

function cloneSkills(skills: ServerRoleSkill[]) {
  return skills.map((skill) => ({ ...skill }));
}

function defaultAllowedPlanCodes(planCode: string): string[] {
  switch (planCode) {
    case 'ENTERPRISE_BASIC_MONTHLY':
    case 'ENTERPRISE_BASIC_ANNUAL':
      return ['ENTERPRISE_BASIC_MONTHLY', 'ENTERPRISE_BASIC_ANNUAL'];
    case 'ENTERPRISE_STANDARD_MONTHLY':
    case 'ENTERPRISE_STANDARD_ANNUAL':
      return ['ENTERPRISE_STANDARD_MONTHLY', 'ENTERPRISE_STANDARD_ANNUAL'];
    case 'ENTERPRISE_PRO_MONTHLY':
    case 'ENTERPRISE_PRO_ANNUAL':
      return ['ENTERPRISE_PRO_MONTHLY', 'ENTERPRISE_PRO_ANNUAL'];
    case 'ENTERPRISE_MONTHLY':
    case 'ENTERPRISE_ANNUAL':
      return ['ENTERPRISE_MONTHLY', 'ENTERPRISE_ANNUAL'];
    default:
      return [planCode];
  }
}

const personalFreeEntitlements = [
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
];

const enterpriseBasicEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 10, limitUnit: 'count' },
  { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 2000, limitUnit: 'count' },
  { featureKey: 'maxKnowledgeBases', enabled: true, limitValue: 3, limitUnit: 'count' },
  { featureKey: 'maxStorageGB', enabled: true, limitValue: 50, limitUnit: 'GB' },
  { featureKey: 'maxMembers', enabled: true, limitValue: 10, limitUnit: 'count' },
  { featureKey: 'canCreateDepartment', enabled: true },
  { featureKey: 'canInviteMember', enabled: true },
  { featureKey: 'canUseApprovalPolicy', enabled: true },
  { featureKey: 'canUseAuditLog', enabled: true },
  { featureKey: 'canUseAdvancedToolConnector', enabled: false },
  { featureKey: 'canUseCostBudget', enabled: true },
  { featureKey: 'canUseEnterpriseKPIDashboard', enabled: false }
];

const enterpriseStandardEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 30, limitUnit: 'count' },
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
];

const enterpriseProEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 80, limitUnit: 'count' },
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
];

const enterpriseCustomEntitlements = [
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
];

export const demoAccount = {
  id: 'account_demo',
  primaryEmail: 'admin@qiuai.local',
  status: 'active' as const
};

export const demoWorkspaces: MockWorkspaceSummary[] = [
  {
    id: 'personal',
    tenantId: 'tenant_personal',
    workspaceType: 'personal',
    name: 'Personal Workspace',
    ownerAccountId: demoAccount.id,
    status: 'active',
    planCode: 'PERSONAL_FREE'
  },
  {
    id: 'enterprise',
    tenantId: 'tenant_enterprise',
    workspaceType: 'enterprise',
    name: 'QiuAI Demo Enterprise',
    ownerAccountId: demoAccount.id,
    status: 'active',
    planCode: 'ENTERPRISE_BASIC_MONTHLY'
  }
];

export const demoPlans: MockPlanDetail[] = [
  {
    code: 'PERSONAL_FREE',
    name: 'Personal Free',
    billingCycle: 'FREE',
    priceCents: 0,
    currency: 'CNY',
    description: 'Free personal workspace for basic AI employee setup.',
    entitlements: personalFreeEntitlements
  },
  {
    code: 'ENTERPRISE_BASIC_MONTHLY',
    name: 'Enterprise Basic Monthly',
    billingCycle: 'MONTHLY',
    priceCents: 29900,
    currency: 'CNY',
    description: 'Basic enterprise workspace for small teams.',
    entitlements: enterpriseBasicEntitlements
  },
  {
    code: 'ENTERPRISE_BASIC_ANNUAL',
    name: 'Enterprise Basic Annual',
    billingCycle: 'ANNUAL',
    priceCents: 299000,
    currency: 'CNY',
    description: 'Annual basic enterprise workspace.',
    entitlements: enterpriseBasicEntitlements
  },
  {
    code: 'ENTERPRISE_STANDARD_MONTHLY',
    name: 'Enterprise Standard Monthly',
    billingCycle: 'MONTHLY',
    priceCents: 59900,
    currency: 'CNY',
    description: 'Standard enterprise workspace with advanced connectors and KPI dashboard.',
    entitlements: enterpriseStandardEntitlements
  },
  {
    code: 'ENTERPRISE_STANDARD_ANNUAL',
    name: 'Enterprise Standard Annual',
    billingCycle: 'ANNUAL',
    priceCents: 599000,
    currency: 'CNY',
    description: 'Annual standard enterprise workspace.',
    entitlements: enterpriseStandardEntitlements
  },
  {
    code: 'ENTERPRISE_PRO_MONTHLY',
    name: 'Enterprise Professional Monthly',
    billingCycle: 'MONTHLY',
    priceCents: 98000,
    currency: 'CNY',
    description: 'Professional enterprise workspace for higher volume operations.',
    entitlements: enterpriseProEntitlements
  },
  {
    code: 'ENTERPRISE_PRO_ANNUAL',
    name: 'Enterprise Professional Annual',
    billingCycle: 'ANNUAL',
    priceCents: 980000,
    currency: 'CNY',
    description: 'Annual professional enterprise workspace.',
    entitlements: enterpriseProEntitlements
  },
  {
    code: 'ENTERPRISE_CUSTOM',
    name: 'Enterprise Custom',
    billingCycle: 'CUSTOM',
    currency: 'CNY',
    description: 'Industry custom and private deployment plan.',
    entitlements: enterpriseCustomEntitlements
  }
];

export const demoRoleTemplates: MockRoleTemplateSummary[] = serverRoleTemplateCatalog.map(
  (template) => ({
    id: template.templateId,
    version: template.version,
    name: template.name,
    industry: template.industry,
    scenario: template.scenario,
    description: template.description,
    recommendedPlanCode: template.recommendedPlanCode,
    businessGoal: template.businessGoal,
    knowledgeSources: [...template.knowledgeSources],
    tools: [...template.tools],
    skills: cloneSkills(template.skills),
    approvalPolicy: template.approvalPolicy,
    status: 'PUBLISHED',
    allowedPlanCodes: defaultAllowedPlanCodes(template.recommendedPlanCode),
    visibleWorkspaceIds: [],
    publishedAt: '2026-07-24T00:00:00.000Z',
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z'
  })
);

export const demoRoles: MockRoleInstanceDetail[] = [
  {
    id: 'role_case_ops',
    templateId: 'template_case_ops',
    templateVersion: roleTemplateById.get('template_case_ops')?.version ?? '1.0.0',
    workspaceId: 'enterprise',
    name: 'AI Case Operations Specialist',
    departmentName: 'Operations',
    ownerName: 'Workspace Admin',
    status: 'running',
    installedAt: '2026-07-18T00:00:00.000Z',
    skills: cloneSkills(roleTemplateById.get('template_case_ops')?.skills ?? []),
    businessGoal: 'Improve case material handling efficiency and produce repeatable operations output.',
    knowledgeSources: ['Case standard', 'Publishing guideline', 'Historical case library'],
    tools: ['Asset library', 'Publishing system', 'Data dashboard'],
    approvalPolicy: 'Publishing output requires operations approval.',
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
    templateVersion: roleTemplateById.get('template_customer_followup')?.version ?? '1.0.0',
    workspaceId: 'enterprise',
    name: 'AI Customer Follow-up Specialist',
    departmentName: 'Customer Success',
    ownerName: 'Customer Lead',
    status: 'configuration_required',
    installedAt: '2026-07-18T00:00:00.000Z',
    skills: cloneSkills(roleTemplateById.get('template_customer_followup')?.skills ?? []),
    businessGoal: 'Turn customer follow-up notes into structured intent and next actions.',
    knowledgeSources: ['Customer segments', 'Follow-up scripts', 'After-sales policy'],
    tools: ['CRM', 'Follow-up records'],
    approvalPolicy: 'High-risk customer suggestions require human confirmation.',
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
    templateVersion: roleTemplateById.get('template_contract_review')?.version ?? '1.0.0',
    workspaceId: 'enterprise',
    name: 'AI Contract Review Specialist',
    departmentName: 'Legal',
    ownerName: 'Legal Lead',
    status: 'trial',
    installedAt: '2026-07-18T00:00:00.000Z',
    skills: cloneSkills(roleTemplateById.get('template_contract_review')?.skills ?? []),
    businessGoal: 'Reduce repeated legal review time by producing a first-pass risk summary.',
    knowledgeSources: ['Contract templates', 'Risk clause checklist'],
    tools: ['Document library'],
    approvalPolicy: 'All contract conclusions require legal approval.',
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
    title: 'Case video screening',
    roleName: 'AI Case Operations Specialist',
    taskType: 'case_screening',
    status: 'completed',
    priority: 'normal',
    input: 'Screen 128 uploaded case videos and identify materials suitable for publishing.',
    createdAt: '2026-07-18T01:00:00.000Z',
    updatedAt: '2026-07-18T01:08:00.000Z',
    artifacts: [
      {
        id: 'artifact_case_report',
        type: 'report',
        title: 'Case screening report',
        content: '128 videos were checked. 23 match the publishing standard and 7 are high priority.',
        createdAt: '2026-07-18T01:08:00.000Z'
      }
    ],
    executionLogs: [
      {
        id: 'log_case_1',
        level: 'info',
        eventType: 'TASK_STARTED',
        message: 'AI Case Operations Specialist started case video screening.',
        createdAt: '2026-07-18T01:00:00.000Z'
      },
      {
        id: 'log_case_2',
        level: 'info',
        eventType: 'ARTIFACT_CREATED',
        message: 'Case screening report was created.',
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
    title: 'Customer follow-up notes cleanup',
    roleName: 'AI Customer Follow-up Specialist',
    taskType: 'customer_followup',
    status: 'running',
    priority: 'high',
    input: 'Clean up today customer follow-up notes and mark high-intent customers.',
    createdAt: '2026-07-18T02:00:00.000Z',
    updatedAt: '2026-07-18T02:05:00.000Z',
    artifacts: [],
    executionLogs: [
      {
        id: 'log_customer_1',
        level: 'info',
        eventType: 'TASK_STARTED',
        message: 'AI Customer Follow-up Specialist started note cleanup.',
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
    title: 'Contract risk summary',
    roleName: 'AI Contract Review Specialist',
    taskType: 'contract_review',
    status: 'waiting_approval',
    priority: 'urgent',
    input: 'Review the supplier contract and list clauses that need legal confirmation.',
    createdAt: '2026-07-18T03:00:00.000Z',
    updatedAt: '2026-07-18T03:18:00.000Z',
    artifacts: [
      {
        id: 'artifact_contract_risk',
        type: 'report',
        title: 'Contract risk summary',
        content: 'Four clauses need confirmation: payment cycle, breach liability, data confidentiality, and auto-renewal.',
        createdAt: '2026-07-18T03:18:00.000Z'
      }
    ],
    executionLogs: [
      {
        id: 'log_contract_1',
        level: 'info',
        eventType: 'TASK_STARTED',
        message: 'AI Contract Review Specialist started first-pass review.',
        createdAt: '2026-07-18T03:00:00.000Z'
      },
      {
        id: 'log_contract_2',
        level: 'warning',
        eventType: 'APPROVAL_REQUIRED',
        message: 'Contract risk summary requires legal approval.',
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

export const demoMetrics: MockPlatformMetricSummary[] = [
  { key: 'roles', title: 'AI Roles', value: '12', trend: '+2 this month' },
  { key: 'tasks', title: 'Tasks Today', value: '128', trend: '92% completed' },
  { key: 'approvals', title: 'Pending Approvals', value: '7', trend: '3 high priority' },
  { key: 'cost', title: 'Monthly Cost', value: 'CNY 842', trend: 'within budget' }
];

export const demoCurrentAccount = {
  account: demoAccount,
  workspaces: demoWorkspaces,
  activeWorkspaceId: 'enterprise'
};
