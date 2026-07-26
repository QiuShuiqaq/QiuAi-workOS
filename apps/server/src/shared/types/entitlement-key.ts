export const ENTITLEMENT_KEYS = [
  'maxRoleInstances',
  'maxTasksPerMonth',
  'maxDesktopDevices',
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
