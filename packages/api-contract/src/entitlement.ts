export type PlanCode =
  | 'PERSONAL_FREE'
  | 'ENTERPRISE_MONTHLY'
  | 'ENTERPRISE_ANNUAL'
  | 'ENTERPRISE_CUSTOM';

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

export interface EntitlementCheckRequest {
  workspaceId: string;
  featureKey: EntitlementKey;
  requestedAmount?: number;
}

export interface EntitlementCheckAllowed {
  allowed: true;
}

export interface EntitlementCheckDenied {
  allowed: false;
  reason: 'entitlement_required' | 'quota_exceeded' | 'subscription_inactive';
  featureKey: EntitlementKey;
  requiredPlan?: PlanCode;
  limitValue?: number;
  usedValue?: number;
}

export type EntitlementCheckResult = EntitlementCheckAllowed | EntitlementCheckDenied;
