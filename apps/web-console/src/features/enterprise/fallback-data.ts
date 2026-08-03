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
      name: 'QiuAI Demo Enterprise',
      industry: '企业服务',
      size: '试点企业',
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
    departments: [],
    members: [
      {
        id: 'member_enterprise_owner',
        accountId: 'account_demo',
        name: '企业账号',
        email: 'admin@qiuai.local',
        systemRole: 'owner',
        status: 'active',
        joinedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    usage: [
      { metricKey: 'roleInstances.count', title: '数字员工数量', usedValue: 3, limitValue: 10, limitUnit: 'count' },
      { metricKey: 'digitalFactories.count', title: '数字工厂数量', usedValue: 1, limitValue: 1, limitUnit: 'count' },
      { metricKey: 'desktopDevices.count', title: '桌面端设备数量', usedValue: 1, limitValue: 3, limitUnit: 'count' }
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
        name: '个人账号',
        email: 'admin@qiuai.local',
        systemRole: 'owner',
        status: 'active',
        joinedAt: '2026-07-01T00:00:00.000Z'
      }
    ],
    usage: [
      { metricKey: 'roleInstances.count', title: '数字员工数量', usedValue: 1, limitValue: 3, limitUnit: 'count' },
      { metricKey: 'digitalFactories.count', title: '数字工厂数量', usedValue: 0, limitValue: 0, limitUnit: 'count' },
      { metricKey: 'desktopDevices.count', title: '桌面端设备数量', usedValue: 1, limitValue: 1, limitUnit: 'count' }
    ]
  };
}

export function buildFallbackEnterpriseOverview(workspaceId = fallbackCurrentAccount.activeWorkspaceId): EnterpriseWorkspaceOverview {
  const workspace = getWorkspace(workspaceId);
  return workspace.workspaceType === 'enterprise'
    ? buildEnterpriseOverview(workspace)
    : buildPersonalOverview(workspace);
}
