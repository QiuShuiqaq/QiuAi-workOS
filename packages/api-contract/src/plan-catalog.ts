import type { PlanDetail } from './commercial';

const personalFreeEntitlements = [
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
];

const enterpriseBasicEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 10, limitUnit: 'count' },
  { featureKey: 'maxTasksPerMonth', enabled: true, limitValue: 2000, limitUnit: 'count' },
  { featureKey: 'maxKnowledgeBases', enabled: true, limitValue: 3, limitUnit: 'count' },
  { featureKey: 'maxStorageGB', enabled: true, limitValue: 50, limitUnit: 'GB' },
  { featureKey: 'maxMembers', enabled: true, limitValue: 10, limitUnit: 'count' },
  { featureKey: 'canCreateDepartment', enabled: true },
  { featureKey: 'canInviteMember', enabled: true },
  { featureKey: 'canUseApprovalPolicy', enabled: true },
  { featureKey: 'canUseAuditLog', enabled: true },
  { featureKey: 'canUseAdvancedToolConnector', enabled: false },
  { featureKey: 'canUseCostBudget', enabled: true },
  { featureKey: 'canUseEnterpriseKPIDashboard', enabled: false }
];

const enterpriseStandardEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 30, limitUnit: 'count' },
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
];

const enterpriseProEntitlements = [
  { featureKey: 'maxRoleInstances', enabled: true, limitValue: 80, limitUnit: 'count' },
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
];

const enterpriseCustomEntitlements = [
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
    name: 'Enterprise Basic Monthly',
    billingCycle: 'MONTHLY',
    priceCents: 29900,
    currency: 'CNY',
    description: 'Basic enterprise workspace for small teams, departments, approvals, audit, and cost controls.',
    entitlements: enterpriseBasicEntitlements
  },
  {
    code: 'ENTERPRISE_BASIC_ANNUAL',
    name: 'Enterprise Basic Annual',
    billingCycle: 'ANNUAL',
    priceCents: 299000,
    currency: 'CNY',
    description: 'Annual basic enterprise workspace for small teams, priced at CNY 2,990/year.',
    entitlements: enterpriseBasicEntitlements
  },
  {
    code: 'ENTERPRISE_STANDARD_MONTHLY',
    name: 'Enterprise Standard Monthly',
    billingCycle: 'MONTHLY',
    priceCents: 59900,
    currency: 'CNY',
    description: 'Standard enterprise workspace for growing teams with advanced connectors and KPI dashboard.',
    entitlements: enterpriseStandardEntitlements
  },
  {
    code: 'ENTERPRISE_STANDARD_ANNUAL',
    name: 'Enterprise Standard Annual',
    billingCycle: 'ANNUAL',
    priceCents: 599000,
    currency: 'CNY',
    description: 'Annual standard enterprise workspace, priced at CNY 5,990/year.',
    entitlements: enterpriseStandardEntitlements
  },
  {
    code: 'ENTERPRISE_PRO_MONTHLY',
    name: 'Enterprise Professional Monthly',
    billingCycle: 'MONTHLY',
    priceCents: 98000,
    currency: 'CNY',
    description: 'Professional enterprise workspace for higher volume AI workforce operations.',
    entitlements: enterpriseProEntitlements
  },
  {
    code: 'ENTERPRISE_PRO_ANNUAL',
    name: 'Enterprise Professional Annual',
    billingCycle: 'ANNUAL',
    priceCents: 980000,
    currency: 'CNY',
    description: 'Annual professional enterprise workspace, priced at CNY 9,800/year.',
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
