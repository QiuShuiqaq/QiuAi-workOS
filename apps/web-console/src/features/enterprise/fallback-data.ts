import type {
  EnterpriseWorkspaceOverview,
  WorkspaceSummary
} from '@qiuai/api-contract';

import { fallbackCurrentAccount } from '../dashboard/fallback-data';
import { fallbackPlans } from '../settings/fallback-data';

function getWorkspace(workspaceId: string): WorkspaceSummary {
  return (
    fallbackCurrentAccount.workspaces.find((workspace) => workspace.id === workspaceId) ??
    fallbackCurrentAccount.workspaces[0]
  );
}

function getPlan(planCode: string) {
  return fallbackPlans.data.find((plan) => plan.code === planCode) ?? fallbackPlans.data[0];
}

function buildEnterpriseOverview(workspace: WorkspaceSummary): EnterpriseWorkspaceOverview {
  const plan = getPlan(workspace.planCode);

  return {
    workspace,
    organization: {
      id: 'org_enterprise',
      tenantId: workspace.tenantId,
      workspaceId: workspace.id,
      name: '秋壹科技',
      industry: '内容运营与企业服务',
      size: '50-200人',
      status: 'active',
      createdAt: '2026-07-01T00:00:00.000Z'
    },
    plan,
    subscription: {
      id: 'sub_enterprise',
      workspaceId: workspace.id,
      planCode: workspace.planCode,
      status: 'active',
      billingCycle: 'monthly',
      currentPeriodStart: '2026-07-01T00:00:00.000Z',
      currentPeriodEnd: '2026-08-01T00:00:00.000Z',
      cancelAtPeriodEnd: false
    },
    departments: [
      {
        id: 'dept_operations',
        organizationId: 'org_enterprise',
        name: '运营部',
        ownerUserId: 'member_ops_lead',
        ownerName: '王运营',
        memberCount: 2,
        roleInstanceCount: 1,
        createdAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'dept_customer',
        organizationId: 'org_enterprise',
        name: '客服部',
        ownerUserId: 'member_customer_lead',
        ownerName: '陈客服',
        memberCount: 1,
        roleInstanceCount: 1,
        createdAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'dept_legal',
        organizationId: 'org_enterprise',
        name: '法务部',
        ownerUserId: 'member_legal_lead',
        ownerName: '刘法务',
        memberCount: 1,
        roleInstanceCount: 1,
        createdAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    members: [
      {
        id: 'member_enterprise_owner',
        accountId: 'account_demo',
        name: '李管理员',
        email: 'admin@qiuai.local',
        systemRole: 'owner',
        status: 'active',
        joinedAt: '2026-07-01T00:00:00.000Z'
      },
      {
        id: 'member_ops_lead',
        accountId: 'account_ops_lead',
        name: '王运营',
        email: 'ops@qiuai.local',
        departmentId: 'dept_operations',
        departmentName: '运营部',
        systemRole: 'admin',
        status: 'active',
        joinedAt: '2026-07-02T00:00:00.000Z'
      },
      {
        id: 'member_ops_specialist',
        accountId: 'account_ops_specialist',
        name: '周运营',
        email: 'ops2@qiuai.local',
        departmentId: 'dept_operations',
        departmentName: '运营部',
        systemRole: 'member',
        status: 'active',
        joinedAt: '2026-07-03T00:00:00.000Z'
      },
      {
        id: 'member_customer_lead',
        accountId: 'account_customer_lead',
        name: '陈客服',
        email: 'service@qiuai.local',
        departmentId: 'dept_customer',
        departmentName: '客服部',
        systemRole: 'admin',
        status: 'active',
        joinedAt: '2026-07-02T00:00:00.000Z'
      },
      {
        id: 'member_legal_lead',
        accountId: 'account_legal_lead',
        name: '刘法务',
        email: 'legal@qiuai.local',
        departmentId: 'dept_legal',
        departmentName: '法务部',
        systemRole: 'admin',
        status: 'active',
        joinedAt: '2026-07-02T00:00:00.000Z'
      }
    ],
    usage: [
      { metricKey: 'roleInstances.count', title: 'AI 岗位数量', usedValue: 3, limitValue: 50, limitUnit: 'count' },
      { metricKey: 'tasks.monthlyCount', title: '月任务数', usedValue: 3, limitValue: 10000, limitUnit: 'count' },
      { metricKey: 'departments.count', title: '部门数量', usedValue: 3 },
      { metricKey: 'members.count', title: '成员数量', usedValue: 5 },
      { metricKey: 'storage.usedGB', title: '存储用量', usedValue: 24.6, limitUnit: 'GB' }
    ]
  };
}

function buildPersonalOverview(workspace: WorkspaceSummary): EnterpriseWorkspaceOverview {
  const plan = getPlan(workspace.planCode);

  return {
    workspace,
    organization: null,
    plan,
    subscription: {
      id: 'sub_personal',
      workspaceId: workspace.id,
      planCode: workspace.planCode,
      status: 'free',
      billingCycle: 'free',
      cancelAtPeriodEnd: false
    },
    departments: [],
    members: [
      {
        id: 'member_personal_owner',
        accountId: 'account_demo',
        name: '个人空间管理员',
        email: 'admin@qiuai.local',
        systemRole: 'owner',
        status: 'active',
        joinedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    usage: [
      { metricKey: 'roleInstances.count', title: 'AI 岗位数量', usedValue: 1, limitValue: 3, limitUnit: 'count' },
      { metricKey: 'tasks.monthlyCount', title: '月任务数', usedValue: 0, limitValue: 100, limitUnit: 'count' },
      { metricKey: 'departments.count', title: '部门数量', usedValue: 0 },
      { metricKey: 'members.count', title: '成员数量', usedValue: 1 },
      { metricKey: 'storage.usedGB', title: '存储用量', usedValue: 1.2, limitUnit: 'GB' }
    ]
  };
}

export function buildFallbackEnterpriseOverview(workspaceId = fallbackCurrentAccount.activeWorkspaceId): EnterpriseWorkspaceOverview {
  const workspace = getWorkspace(workspaceId);
  return workspace.workspaceType === 'enterprise'
    ? buildEnterpriseOverview(workspace)
    : buildPersonalOverview(workspace);
}
