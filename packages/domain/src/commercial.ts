export type PlanCode =
  | 'PERSONAL_FREE'
  | 'ENTERPRISE_MONTHLY'
  | 'ENTERPRISE_ANNUAL'
  | 'ENTERPRISE_CUSTOM';

export type BillingCycle = 'free' | 'monthly' | 'annual' | 'custom';

export type SubscriptionStatus =
  | 'free'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'cancelled'
  | 'expired';

export const ENTITLEMENT_KEYS = [
  'maxRoleInstances',
  'maxTasksPerMonth',
  'maxKnowledgeBases',
  'maxStorageGB',
  'maxMembers',
  'canCreateDepartment',
  'canInviteMember',
  'canUseApprovalPolicy',
  'canUseAuditLog',
  'canUseAdvancedToolConnector',
  'canUseCostBudget',
  'canUseEnterpriseKPIDashboard'
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export interface Plan {
  code: PlanCode;
  name: string;
  billingCycle: BillingCycle;
  priceCents?: number;
  currency?: string;
}

export interface Subscription {
  id: string;
  workspaceId: string;
  planCode: PlanCode;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

export interface Entitlement {
  featureKey: EntitlementKey;
  enabled: boolean;
  limitValue?: number;
  limitUnit?: string;
}

export interface UsageMeter {
  workspaceId: string;
  metricKey: string;
  period: string;
  usedValue: number;
  resetAt?: string;
}
