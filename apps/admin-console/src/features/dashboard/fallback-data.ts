import type { CurrentAccountResponse, KernelStatusResponse, PlanDetail } from '@qiuai/api-contract';
import { qiuaiPlanCatalog } from '@qiuai/api-contract';

export const fallbackCurrentAccount: CurrentAccountResponse = {
  account: {
    id: 'platform_admin_demo',
    primaryEmail: 'admin@qiuai.local',
    status: 'active'
  },
  activeWorkspaceId: 'platform_workspace',
  workspaces: [
    {
      id: 'platform_workspace',
      tenantId: 'tenant_platform',
      workspaceType: 'enterprise',
      name: '平台运营空间',
      ownerAccountId: 'platform_admin_demo',
      status: 'active',
      planCode: 'ENTERPRISE_PRO_MONTHLY'
    },
    {
      id: 'personal_workspace',
      tenantId: 'tenant_personal',
      workspaceType: 'personal',
      name: '个人演示空间',
      ownerAccountId: 'platform_admin_demo',
      status: 'active',
      planCode: 'PERSONAL_FREE'
    }
  ]
};

export const fallbackKernelStatus: KernelStatusResponse = {
  status: 'ready',
  dataModelVersion: 'platform-kernel-v1',
  databaseProvider: 'postgresql',
  persistenceMode: 'mock',
  databaseReady: false,
  prismaClientVersion: '6.19.3',
  plans: qiuaiPlanCatalog.map((plan) => ({
    code: plan.code,
    name: plan.name,
    billingCycle: plan.billingCycle,
    priceCents: plan.priceCents,
    currency: plan.currency,
    description: plan.description
  })),
  databasePlanCount: qiuaiPlanCatalog.length,
  databaseTenantCount: 2,
  databaseWorkspaceCount: 2
};

export const fallbackPlans: PlanDetail[] = qiuaiPlanCatalog;
