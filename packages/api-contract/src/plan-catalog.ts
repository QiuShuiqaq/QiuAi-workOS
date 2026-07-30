import type { PlanDetail } from './commercial';

const personalFreeEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 3, limitUnit: 'count' },
  { featureKey: 'maxDigitalFactories', enabled: true, limitValue: 0, limitUnit: 'count' },
  { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 100, limitUnit: 'count' },
  { featureKey: 'maxDesktopDevices', enabled: true, limitValue: 1, limitUnit: 'count' },
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
  { featureKey: 'maxDigitalFactories', enabled: true, limitValue: 1, limitUnit: 'count' },
  { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 100000, limitUnit: 'count' },
  { featureKey: 'maxDesktopDevices', enabled: true, limitValue: 3, limitUnit: 'count' },
  { featureKey: 'maxMembers', enabled: true, limitValue: 5, limitUnit: 'count' },
  { featureKey: 'canCreateDepartment', enabled: true },
  { featureKey: 'canInviteMember', enabled: true },
  { featureKey: 'canUseApprovalPolicy', enabled: true },
  { featureKey: 'canUseAuditLog', enabled: true },
  { featureKey: 'canUseAdvancedToolConnector', enabled: true },
  { featureKey: 'canUseCostBudget', enabled: true },
  { featureKey: 'canUseEnterpriseKPIDashboard', enabled: true }
];

const enterpriseStandardEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 30, limitUnit: 'count' },
  { featureKey: 'maxDigitalFactories', enabled: true, limitValue: 3, limitUnit: 'count' },
  { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 100000, limitUnit: 'count' },
  { featureKey: 'maxDesktopDevices', enabled: true, limitValue: 10, limitUnit: 'count' },
  { featureKey: 'maxMembers', enabled: true, limitValue: 20, limitUnit: 'count' },
  { featureKey: 'canCreateDepartment', enabled: true },
  { featureKey: 'canInviteMember', enabled: true },
  { featureKey: 'canUseApprovalPolicy', enabled: true },
  { featureKey: 'canUseAuditLog', enabled: true },
  { featureKey: 'canUseAdvancedToolConnector', enabled: true },
  { featureKey: 'canUseCostBudget', enabled: true },
  { featureKey: 'canUseEnterpriseKPIDashboard', enabled: true }
];

const enterpriseProEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 100, limitUnit: 'count' },
  { featureKey: 'maxDigitalFactories', enabled: true, limitValue: 10, limitUnit: 'count' },
  { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 100000, limitUnit: 'count' },
  { featureKey: 'maxDesktopDevices', enabled: true, limitValue: 50, limitUnit: 'count' },
  { featureKey: 'maxMembers', enabled: true, limitValue: 100, limitUnit: 'count' },
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
  { featureKey: 'maxDigitalFactories', enabled: true },
  { featureKey: 'maxTasksPerMonth', enabled: true },
  { featureKey: 'maxDesktopDevices', enabled: true },
  { featureKey: 'maxMembers', enabled: true },
  { featureKey: 'canCreateDepartment', enabled: true },
  { featureKey: 'canInviteMember', enabled: true },
  { featureKey: 'canUseApprovalPolicy', enabled: true },
  { featureKey: 'canUseAuditLog', enabled: true },
  { featureKey: 'canUseAdvancedToolConnector', enabled: true },
  { featureKey: 'canUseCostBudget', enabled: true },
  { featureKey: 'canUseEnterpriseKPIDashboard', enabled: true }
];

export const qiuaiPlanCatalog: PlanDetail[] = [
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
    name: '企业基础版（月付）',
    billingCycle: 'MONTHLY',
    priceCents: 58800,
    currency: 'CNY',
    description: '适合小团队试点，按企业设备数和单设备数字员工、数字工厂容量授权。',
    entitlements: enterpriseBasicEntitlements
  },
  {
    code: 'ENTERPRISE_BASIC_ANNUAL',
    name: '企业基础版（年付）',
    billingCycle: 'ANNUAL',
    priceCents: 588000,
    currency: 'CNY',
    description: '企业基础版年付，按 10 个月计费，相当于买 10 个月送 2 个月。',
    entitlements: enterpriseBasicEntitlements
  },
  {
    code: 'ENTERPRISE_STANDARD_MONTHLY',
    name: '企业标准版（月付）',
    billingCycle: 'MONTHLY',
    priceCents: 108800,
    currency: 'CNY',
    description: '适合正常企业团队使用，按企业设备数和单设备数字员工、数字工厂容量授权。',
    entitlements: enterpriseStandardEntitlements
  },
  {
    code: 'ENTERPRISE_STANDARD_ANNUAL',
    name: '企业标准版（年付）',
    billingCycle: 'ANNUAL',
    priceCents: 1088000,
    currency: 'CNY',
    description: '企业标准版年付，按 10 个月计费，相当于买 10 个月送 2 个月。',
    entitlements: enterpriseStandardEntitlements
  },
  {
    code: 'ENTERPRISE_PRO_MONTHLY',
    name: '企业专业版（月付）',
    billingCycle: 'MONTHLY',
    priceCents: 288800,
    currency: 'CNY',
    description: '适合多团队或高频生产使用，按企业设备数和单设备数字员工、数字工厂容量授权。',
    entitlements: enterpriseProEntitlements
  },
  {
    code: 'ENTERPRISE_PRO_ANNUAL',
    name: '企业专业版（年付）',
    billingCycle: 'ANNUAL',
    priceCents: 2888000,
    currency: 'CNY',
    description: '企业专业版年付，按 10 个月计费，相当于买 10 个月送 2 个月。',
    entitlements: enterpriseProEntitlements
  },
  {
    code: 'ENTERPRISE_CUSTOM',
    name: 'Enterprise Custom',
    billingCycle: 'CUSTOM',
    currency: 'CNY',
    description: 'Industry custom and private deployment plan. Implementation service starts from CNY 9,800; industry custom starts from CNY 29,800.',
    entitlements: enterpriseCustomEntitlements
  }
];
