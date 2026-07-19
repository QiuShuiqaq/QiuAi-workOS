import type { GetBillingOverviewResponse, ListPlansResponse } from '@qiuai/api-contract';

export const fallbackPlans: ListPlansResponse = {
  data: [
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
  ]
};

export function createFallbackBillingOverview(workspaceId: string): GetBillingOverviewResponse {
  const activePlan =
    fallbackPlans.data.find((plan) => plan.code === 'ENTERPRISE_MONTHLY') ?? fallbackPlans.data[0];

  return {
    data: {
      workspaceId,
      billingAccount: {
        id: `fallback_billing_${workspaceId}`,
        workspaceId,
        status: 'ACTIVE',
        billingName: 'QiuAI Demo Enterprise',
        contactEmail: 'admin@qiuai.local',
        defaultProvider: 'ALIPAY',
        createdAt: '2026-07-19T00:00:00.000Z',
        updatedAt: '2026-07-19T00:00:00.000Z'
      },
      subscription: {
        id: `fallback_subscription_${workspaceId}`,
        workspaceId,
        planCode: activePlan.code,
        planName: activePlan.name,
        status: 'ACTIVE',
        billingCycle: activePlan.billingCycle,
        currentPeriodStart: '2026-07-01T00:00:00.000Z',
        currentPeriodEnd: '2026-08-01T00:00:00.000Z',
        cancelAtPeriodEnd: false
      },
      currentPlan: {
        code: activePlan.code,
        name: activePlan.name,
        billingCycle: activePlan.billingCycle,
        priceCents: activePlan.priceCents,
        currency: activePlan.currency,
        description: activePlan.description
      },
      paymentProviders: [
        {
          provider: 'ALIPAY',
          isConfigured: false,
          gatewayUrl: 'https://openapi.alipay.com/gateway.do',
          notifyPath: '/api/v1/billing/alipay/notify',
          returnPath: '/billing/alipay/return',
          missingEnvKeys: [
            'PAYMENT_ALIPAY_APP_ID',
            'PAYMENT_ALIPAY_PRIVATE_KEY',
            'PAYMENT_ALIPAY_PUBLIC_KEY'
          ]
        }
      ],
      recentOrders: []
    }
  };
}
