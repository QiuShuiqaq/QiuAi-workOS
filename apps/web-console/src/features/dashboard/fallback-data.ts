import type { CurrentAccountResponse, PlatformOverviewResponse } from '@qiuai/api-contract';

export const fallbackCurrentAccount: CurrentAccountResponse = {
  account: {
    id: 'account_demo',
    primaryEmail: 'admin@qiuai.local',
    status: 'active'
  },
  activeWorkspaceId: 'enterprise',
  workspaces: [
    {
      id: 'personal',
      tenantId: 'tenant_personal',
      workspaceType: 'personal',
      name: '个人工作空间',
      ownerAccountId: 'account_demo',
      status: 'active',
      planCode: 'PERSONAL_FREE'
    },
    {
      id: 'enterprise',
      tenantId: 'tenant_enterprise',
      workspaceType: 'enterprise',
      name: '秋艾科技',
      ownerAccountId: 'account_demo',
      status: 'active',
      planCode: 'ENTERPRISE_MONTHLY'
    }
  ]
};

export const fallbackOverview: PlatformOverviewResponse = {
  workspace: fallbackCurrentAccount.workspaces[1],
  metrics: [
    { key: 'roles', title: 'AI 岗位', value: '12', trend: '+2 本月' },
    { key: 'tasks', title: '今日任务', value: '128', trend: '92% 完成' },
    { key: 'approvals', title: '待审批', value: '7', trend: '3 个高优先级' },
    { key: 'cost', title: '本月成本', value: '¥842', trend: '预算内' }
  ],
  roles: [
    {
      id: 'role_case_ops',
      name: 'AI案例运营专员',
      departmentName: '运营部',
      status: 'running'
    },
    {
      id: 'role_customer_followup',
      name: 'AI客户回访专员',
      departmentName: '客服部',
      status: 'configuration_required'
    },
    {
      id: 'role_contract_review',
      name: 'AI合同审核专员',
      departmentName: '法务部',
      status: 'trial'
    }
  ],
  tasks: [
    {
      id: 'task_case_screening',
      title: '案例视频初筛',
      roleName: 'AI案例运营专员',
      state: 'completed'
    },
    {
      id: 'task_customer_notes',
      title: '客户回访记录整理',
      roleName: 'AI客户回访专员',
      state: 'running'
    },
    {
      id: 'task_contract_summary',
      title: '合同风险摘要',
      roleName: 'AI合同审核专员',
      state: 'waiting_approval'
    }
  ]
};
