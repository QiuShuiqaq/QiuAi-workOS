import { PrismaClient } from '@prisma/client';

import { hashPassword } from '../src/shared/auth/password-hash';

const prisma = new PrismaClient();

const ids = {
  accounts: {
    owner: '00000000-0000-4000-8000-000000000001',
    opsLead: '00000000-0000-4000-8000-000000000002',
    customerLead: '00000000-0000-4000-8000-000000000003',
    legalLead: '00000000-0000-4000-8000-000000000004'
  },
  tenants: {
    personal: '10000000-0000-4000-8000-000000000001',
    enterprise: '10000000-0000-4000-8000-000000000002'
  },
  workspaces: {
    personal: '20000000-0000-4000-8000-000000000001',
    enterprise: '20000000-0000-4000-8000-000000000002'
  },
  members: {
    personalOwner: '30000000-0000-4000-8000-000000000001',
    enterpriseOwner: '30000000-0000-4000-8000-000000000002',
    opsLead: '30000000-0000-4000-8000-000000000003',
    customerLead: '30000000-0000-4000-8000-000000000004',
    legalLead: '30000000-0000-4000-8000-000000000005'
  },
  organization: '40000000-0000-4000-8000-000000000001',
  departments: {
    operations: '50000000-0000-4000-8000-000000000001',
    customer: '50000000-0000-4000-8000-000000000002',
    legal: '50000000-0000-4000-8000-000000000003'
  },
  plans: {
    personalFree: '60000000-0000-4000-8000-000000000001',
    enterpriseMonthly: '60000000-0000-4000-8000-000000000002',
    enterpriseAnnual: '60000000-0000-4000-8000-000000000003',
    enterpriseCustom: '60000000-0000-4000-8000-000000000004'
  },
  subscriptions: {
    personal: '70000000-0000-4000-8000-000000000001',
    enterprise: '70000000-0000-4000-8000-000000000002'
  }
};

const plans = [
  {
    id: ids.plans.personalFree,
    code: 'PERSONAL_FREE',
    name: 'Personal Free',
    description: 'Free personal workspace for basic AI employee setup.',
    billingCycle: 'FREE',
    priceCents: 0,
    currency: 'CNY',
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
    id: ids.plans.enterpriseMonthly,
    code: 'ENTERPRISE_MONTHLY',
    name: 'Enterprise Monthly',
    description: 'Monthly enterprise workspace with organization, department, governance, and quota controls.',
    billingCycle: 'MONTHLY',
    priceCents: null,
    currency: 'CNY',
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
    id: ids.plans.enterpriseAnnual,
    code: 'ENTERPRISE_ANNUAL',
    name: 'Enterprise Annual',
    description: 'Annual enterprise workspace with higher quotas and implementation support.',
    billingCycle: 'ANNUAL',
    priceCents: null,
    currency: 'CNY',
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
    id: ids.plans.enterpriseCustom,
    code: 'ENTERPRISE_CUSTOM',
    name: 'Enterprise Custom',
    description: 'Custom enterprise deployment for dedicated rollout, SLA, and advanced governance.',
    billingCycle: 'CUSTOM',
    priceCents: null,
    currency: 'CNY',
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
] as const;

async function seedAccounts() {
  const accounts = [
    {
      id: ids.accounts.owner,
      primaryEmail: 'admin@qiuai.local',
      passwordHash: process.env.WORKOS_BOOTSTRAP_ADMIN_PASSWORD
        ? hashPassword(process.env.WORKOS_BOOTSTRAP_ADMIN_PASSWORD)
        : undefined
    },
    { id: ids.accounts.opsLead, primaryEmail: 'ops@qiuai.local' },
    { id: ids.accounts.customerLead, primaryEmail: 'service@qiuai.local' },
    { id: ids.accounts.legalLead, primaryEmail: 'legal@qiuai.local' }
  ];

  for (const account of accounts) {
    await prisma.account.upsert({
      where: { id: account.id },
      update: {
        primaryEmail: account.primaryEmail,
        status: 'ACTIVE',
        passwordHash: account.passwordHash
      },
      create: {
        id: account.id,
        primaryEmail: account.primaryEmail,
        status: 'ACTIVE',
        passwordHash: account.passwordHash
      }
    });
  }
}

async function seedTenantsAndWorkspaces() {
  await prisma.tenant.upsert({
    where: { id: ids.tenants.personal },
    update: {
      name: 'Personal Tenant',
      type: 'PERSONAL',
      status: 'ACTIVE'
    },
    create: {
      id: ids.tenants.personal,
      name: 'Personal Tenant',
      type: 'PERSONAL',
      status: 'ACTIVE'
    }
  });

  await prisma.tenant.upsert({
    where: { id: ids.tenants.enterprise },
    update: {
      name: 'QiuAI Demo Enterprise Tenant',
      type: 'ENTERPRISE',
      status: 'ACTIVE'
    },
    create: {
      id: ids.tenants.enterprise,
      name: 'QiuAI Demo Enterprise Tenant',
      type: 'ENTERPRISE',
      status: 'ACTIVE'
    }
  });

  await prisma.workspace.upsert({
    where: { id: ids.workspaces.personal },
    update: {
      tenantId: ids.tenants.personal,
      type: 'PERSONAL',
      name: 'Personal Workspace',
      ownerAccountId: ids.accounts.owner,
      status: 'ACTIVE'
    },
    create: {
      id: ids.workspaces.personal,
      tenantId: ids.tenants.personal,
      type: 'PERSONAL',
      name: 'Personal Workspace',
      ownerAccountId: ids.accounts.owner,
      status: 'ACTIVE'
    }
  });

  await prisma.workspace.upsert({
    where: { id: ids.workspaces.enterprise },
    update: {
      tenantId: ids.tenants.enterprise,
      type: 'ENTERPRISE',
      name: 'QiuAI Demo Enterprise',
      ownerAccountId: ids.accounts.owner,
      status: 'ACTIVE'
    },
    create: {
      id: ids.workspaces.enterprise,
      tenantId: ids.tenants.enterprise,
      type: 'ENTERPRISE',
      name: 'QiuAI Demo Enterprise',
      ownerAccountId: ids.accounts.owner,
      status: 'ACTIVE'
    }
  });
}

async function seedPlans() {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        description: plan.description,
        billingCycle: plan.billingCycle,
        priceCents: plan.priceCents,
        currency: plan.currency,
        status: 'ACTIVE'
      },
      create: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        billingCycle: plan.billingCycle,
        priceCents: plan.priceCents,
        currency: plan.currency,
        status: 'ACTIVE'
      }
    });

    for (const entitlement of plan.entitlements) {
      await prisma.entitlement.upsert({
        where: {
          planId_featureKey: {
            planId: plan.id,
            featureKey: entitlement.featureKey
          }
        },
        update: {
          enabled: entitlement.enabled,
          limitValue: entitlement.limitValue ?? null,
          limitUnit: entitlement.limitUnit ?? null
        },
        create: {
          planId: plan.id,
          featureKey: entitlement.featureKey,
          enabled: entitlement.enabled,
          limitValue: entitlement.limitValue ?? null,
          limitUnit: entitlement.limitUnit ?? null
        }
      });
    }
  }
}

async function seedOrganization() {
  const members = [
    {
      id: ids.members.personalOwner,
      workspaceId: ids.workspaces.personal,
      accountId: ids.accounts.owner,
      role: 'OWNER'
    },
    {
      id: ids.members.enterpriseOwner,
      workspaceId: ids.workspaces.enterprise,
      accountId: ids.accounts.owner,
      role: 'OWNER'
    },
    {
      id: ids.members.opsLead,
      workspaceId: ids.workspaces.enterprise,
      accountId: ids.accounts.opsLead,
      departmentId: ids.departments.operations,
      role: 'ADMIN'
    },
    {
      id: ids.members.customerLead,
      workspaceId: ids.workspaces.enterprise,
      accountId: ids.accounts.customerLead,
      departmentId: ids.departments.customer,
      role: 'ADMIN'
    },
    {
      id: ids.members.legalLead,
      workspaceId: ids.workspaces.enterprise,
      accountId: ids.accounts.legalLead,
      departmentId: ids.departments.legal,
      role: 'ADMIN'
    }
  ] as const;

  for (const member of members) {
    await prisma.workspaceMember.upsert({
      where: { id: member.id },
      update: {
        workspaceId: member.workspaceId,
        accountId: member.accountId,
        role: member.role
      },
      create: {
        id: member.id,
        workspaceId: member.workspaceId,
        accountId: member.accountId,
        role: member.role
      }
    });
  }

  await prisma.organization.upsert({
    where: { id: ids.organization },
    update: {
      tenantId: ids.tenants.enterprise,
      workspaceId: ids.workspaces.enterprise,
      name: 'QiuAI Demo Enterprise',
      industry: 'Digital workforce operations',
      size: '50-200',
      settings: {
        bootstrapSeed: true
      }
    },
    create: {
      id: ids.organization,
      tenantId: ids.tenants.enterprise,
      workspaceId: ids.workspaces.enterprise,
      name: 'QiuAI Demo Enterprise',
      industry: 'Digital workforce operations',
      size: '50-200',
      settings: {
        bootstrapSeed: true
      }
    }
  });

  const departments = [
    {
      id: ids.departments.operations,
      name: 'Operations',
      ownerMemberId: ids.members.opsLead
    },
    {
      id: ids.departments.customer,
      name: 'Customer Success',
      ownerMemberId: ids.members.customerLead
    },
    {
      id: ids.departments.legal,
      name: 'Legal',
      ownerMemberId: ids.members.legalLead
    }
  ];

  for (const department of departments) {
    await prisma.department.upsert({
      where: { id: department.id },
      update: {
        organizationId: ids.organization,
        parentDepartmentId: null,
        name: department.name,
        ownerMemberId: department.ownerMemberId
      },
      create: {
        id: department.id,
        organizationId: ids.organization,
        name: department.name,
        ownerMemberId: department.ownerMemberId
      }
    });
  }

  for (const member of members) {
    if ('departmentId' in member) {
      await prisma.workspaceMember.update({
        where: { id: member.id },
        data: {
          departmentId: member.departmentId
        }
      });
    }
  }
}

async function seedSubscriptionsAndUsage() {
  await prisma.subscription.upsert({
    where: { id: ids.subscriptions.personal },
    update: {
      workspaceId: ids.workspaces.personal,
      planId: ids.plans.personalFree,
      status: 'FREE',
      billingCycle: 'FREE',
      currentPeriodStart: null,
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false
    },
    create: {
      id: ids.subscriptions.personal,
      workspaceId: ids.workspaces.personal,
      planId: ids.plans.personalFree,
      status: 'FREE',
      billingCycle: 'FREE',
      cancelAtPeriodEnd: false
    }
  });

  await prisma.subscription.upsert({
    where: { id: ids.subscriptions.enterprise },
    update: {
      workspaceId: ids.workspaces.enterprise,
      planId: ids.plans.enterpriseMonthly,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false
    },
    create: {
      id: ids.subscriptions.enterprise,
      workspaceId: ids.workspaces.enterprise,
      planId: ids.plans.enterpriseMonthly,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false
    }
  });

  const usageMeters = [
    { workspaceId: ids.workspaces.personal, metricKey: 'roleInstances.count', period: '2026-07', usedValue: 0 },
    { workspaceId: ids.workspaces.personal, metricKey: 'tasks.monthlyCount', period: '2026-07', usedValue: 0 },
    { workspaceId: ids.workspaces.enterprise, metricKey: 'roleInstances.count', period: '2026-07', usedValue: 3 },
    { workspaceId: ids.workspaces.enterprise, metricKey: 'tasks.monthlyCount', period: '2026-07', usedValue: 3 }
  ];

  for (const meter of usageMeters) {
    await prisma.usageMeter.upsert({
      where: {
        workspaceId_metricKey_period: {
          workspaceId: meter.workspaceId,
          metricKey: meter.metricKey,
          period: meter.period
        }
      },
      update: {
        usedValue: meter.usedValue
      },
      create: meter
    });
  }
}

async function main() {
  await seedAccounts();
  await seedTenantsAndWorkspaces();
  await seedPlans();
  await seedOrganization();
  await seedSubscriptionsAndUsage();
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('QiuAI WorkOS platform kernel seed completed.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
