import { qiuaiPlanCatalog, type GetBillingOverviewResponse, type ListPlansResponse } from '@qiuai/api-contract';

export const fallbackPlans: ListPlansResponse = {
  data: qiuaiPlanCatalog
};

export function createFallbackBillingOverview(workspaceId: string): GetBillingOverviewResponse {
  const activePlan =
    fallbackPlans.data.find((plan) => plan.code === 'ENTERPRISE_BASIC_MONTHLY') ?? fallbackPlans.data[0];

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
