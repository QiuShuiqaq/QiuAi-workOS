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
    enterpriseCustom: '60000000-0000-4000-8000-000000000004',
    enterpriseBasicMonthly: '60000000-0000-4000-8000-000000000005',
    enterpriseBasicAnnual: '60000000-0000-4000-8000-000000000006',
    enterpriseStandardMonthly: '60000000-0000-4000-8000-000000000007',
    enterpriseStandardAnnual: '60000000-0000-4000-8000-000000000008',
    enterpriseProMonthly: '60000000-0000-4000-8000-000000000009',
    enterpriseProAnnual: '60000000-0000-4000-8000-000000000010'
  },
  subscriptions: {
    personal: '70000000-0000-4000-8000-000000000001',
    enterprise: '70000000-0000-4000-8000-000000000002'
  },
  billingAccounts: {
    personal: '80000000-0000-4000-8000-000000000001',
    enterprise: '80000000-0000-4000-8000-000000000002'
  }
};

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
] as const;

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
] as const;

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
] as const;

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
] as const;

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
] as const;

const plans = [
  {
    id: ids.plans.personalFree,
    code: 'PERSONAL_FREE',
    name: 'Personal Free',
    description: 'Free personal workspace for basic AI employee setup.',
    billingCycle: 'FREE',
    priceCents: 0,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: personalFreeEntitlements
  },
  {
    id: ids.plans.enterpriseBasicMonthly,
    code: 'ENTERPRISE_BASIC_MONTHLY',
    name: 'Enterprise Basic Monthly',
    description: 'Basic enterprise workspace for small teams, departments, approvals, audit, and cost controls.',
    billingCycle: 'MONTHLY',
    priceCents: 29900,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseBasicEntitlements
  },
  {
    id: ids.plans.enterpriseBasicAnnual,
    code: 'ENTERPRISE_BASIC_ANNUAL',
    name: 'Enterprise Basic Annual',
    description: 'Annual basic enterprise workspace for small teams, priced at CNY 2,990/year.',
    billingCycle: 'ANNUAL',
    priceCents: 299000,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseBasicEntitlements
  },
  {
    id: ids.plans.enterpriseStandardMonthly,
    code: 'ENTERPRISE_STANDARD_MONTHLY',
    name: 'Enterprise Standard Monthly',
    description: 'Standard enterprise workspace for growing teams with advanced connectors and KPI dashboard.',
    billingCycle: 'MONTHLY',
    priceCents: 59900,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseStandardEntitlements
  },
  {
    id: ids.plans.enterpriseStandardAnnual,
    code: 'ENTERPRISE_STANDARD_ANNUAL',
    name: 'Enterprise Standard Annual',
    description: 'Annual standard enterprise workspace, priced at CNY 5,990/year.',
    billingCycle: 'ANNUAL',
    priceCents: 599000,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseStandardEntitlements
  },
  {
    id: ids.plans.enterpriseProMonthly,
    code: 'ENTERPRISE_PRO_MONTHLY',
    name: 'Enterprise Professional Monthly',
    description: 'Professional enterprise workspace for higher volume AI workforce operations.',
    billingCycle: 'MONTHLY',
    priceCents: 98000,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseProEntitlements
  },
  {
    id: ids.plans.enterpriseProAnnual,
    code: 'ENTERPRISE_PRO_ANNUAL',
    name: 'Enterprise Professional Annual',
    description: 'Annual professional enterprise workspace, priced at CNY 9,800/year.',
    billingCycle: 'ANNUAL',
    priceCents: 980000,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseProEntitlements
  },
  {
    id: ids.plans.enterpriseMonthly,
    code: 'ENTERPRISE_MONTHLY',
    name: 'Enterprise Monthly Legacy',
    description: 'Archived legacy monthly enterprise plan kept for historical orders and subscriptions.',
    billingCycle: 'MONTHLY',
    priceCents: 98000,
    currency: 'CNY',
    status: 'ARCHIVED',
    entitlements: enterpriseProEntitlements
  },
  {
    id: ids.plans.enterpriseAnnual,
    code: 'ENTERPRISE_ANNUAL',
    name: 'Enterprise Annual Legacy',
    description: 'Archived legacy annual enterprise plan kept for historical orders and subscriptions.',
    billingCycle: 'ANNUAL',
    priceCents: 980000,
    currency: 'CNY',
    status: 'ARCHIVED',
    entitlements: enterpriseProEntitlements
  },
  {
    id: ids.plans.enterpriseCustom,
    code: 'ENTERPRISE_CUSTOM',
    name: 'Enterprise Custom',
    description: 'Industry custom and private deployment plan. Implementation service starts from CNY 9,800; industry custom starts from CNY 29,800.',
    billingCycle: 'CUSTOM',
    priceCents: null,
    currency: 'CNY',
    status: 'ACTIVE',
    entitlements: enterpriseCustomEntitlements
  }
] as const;

const roleTemplates = [
  {
    id: 'template_case_ops',
    name: 'AI案例运营专员',
    industry: '保健品与私域运营',
    scenario: '案例素材识别、筛选、剪辑建议和发布准备',
    description: '自动处理客户案例素材，生成筛选结果、内容建议和运营交付物。',
    recommendedPlanCode: 'PERSONAL_FREE',
    businessGoal: '提升案例素材处理效率，稳定完成案例筛选、内容生成和运营复盘。',
    knowledgeSources: ['企业案例标准', '内容发布规范', '历史案例库'],
    tools: ['素材库', '内容发布系统', '数据看板'],
    approvalPolicy: '发布前需要运营负责人审批。'
  },
  {
    id: 'template_customer_followup',
    name: 'AI客户回访专员',
    industry: '客户运营',
    scenario: '回访记录整理、意向识别和后续动作建议',
    description: '整理客户回访内容，识别客户意向和风险，并生成跟进建议。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '沉淀客户回访记录，识别客户意向并推动后续跟进。',
    knowledgeSources: ['客户分层规则', '回访话术', '售后政策'],
    tools: ['CRM', '回访记录表'],
    approvalPolicy: '高风险客户建议需要人工确认。'
  },
  {
    id: 'template_contract_review',
    name: 'AI合同审核专员',
    industry: '法律服务',
    scenario: '合同条款审查和风险摘要',
    description: '对合同进行初步风险识别，输出审查摘要和风险提示。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '对合同进行初审，减少法务重复审查时间。',
    knowledgeSources: ['合同模板库', '风险条款清单'],
    tools: ['文档库'],
    approvalPolicy: '所有合同结论必须经法务确认。'
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
        status: plan.status
      },
      create: {
        id: plan.id,
        code: plan.code,
        name: plan.name,
        description: plan.description,
        billingCycle: plan.billingCycle,
        priceCents: plan.priceCents,
        currency: plan.currency,
        status: plan.status
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
      planId: ids.plans.enterpriseBasicMonthly,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date('2026-07-01T00:00:00.000Z'),
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      cancelAtPeriodEnd: false
    },
    create: {
      id: ids.subscriptions.enterprise,
      workspaceId: ids.workspaces.enterprise,
      planId: ids.plans.enterpriseBasicMonthly,
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
    { workspaceId: ids.workspaces.enterprise, metricKey: 'roleInstances.count', period: '2026-07', usedValue: 0 },
    { workspaceId: ids.workspaces.enterprise, metricKey: 'tasks.monthlyCount', period: '2026-07', usedValue: 0 }
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

async function seedBilling() {
  await prisma.billingAccount.upsert({
    where: { workspaceId: ids.workspaces.personal },
    update: {
      status: 'ACTIVE',
      billingName: 'Personal Workspace',
      taxId: null,
      contactEmail: 'admin@qiuai.local',
      defaultProvider: null
    },
    create: {
      id: ids.billingAccounts.personal,
      workspaceId: ids.workspaces.personal,
      status: 'ACTIVE',
      billingName: 'Personal Workspace',
      contactEmail: 'admin@qiuai.local'
    }
  });

  await prisma.billingAccount.upsert({
    where: { workspaceId: ids.workspaces.enterprise },
    update: {
      status: 'ACTIVE',
      billingName: 'QiuAI Demo Enterprise',
      taxId: null,
      contactEmail: 'admin@qiuai.local',
      defaultProvider: 'ALIPAY'
    },
    create: {
      id: ids.billingAccounts.enterprise,
      workspaceId: ids.workspaces.enterprise,
      status: 'ACTIVE',
      billingName: 'QiuAI Demo Enterprise',
      contactEmail: 'admin@qiuai.local',
      defaultProvider: 'ALIPAY'
    }
  });
}

async function seedRoleTemplates() {
  for (const template of roleTemplates) {
    await prisma.roleTemplate.upsert({
      where: {
        id: template.id
      },
      update: {
        name: template.name,
        industry: template.industry,
        scenario: template.scenario,
        description: template.description,
        recommendedPlanCode: template.recommendedPlanCode,
        businessGoal: template.businessGoal,
        knowledgeSources: [...template.knowledgeSources],
        tools: [...template.tools],
        approvalPolicy: template.approvalPolicy
      },
      create: {
        id: template.id,
        name: template.name,
        industry: template.industry,
        scenario: template.scenario,
        description: template.description,
        recommendedPlanCode: template.recommendedPlanCode,
        businessGoal: template.businessGoal,
        knowledgeSources: [...template.knowledgeSources],
        tools: [...template.tools],
        approvalPolicy: template.approvalPolicy
      }
    });
  }
}

async function main() {
  await seedAccounts();
  await seedTenantsAndWorkspaces();
  await seedPlans();
  await seedOrganization();
  await seedSubscriptionsAndUsage();
  await seedBilling();
  await seedRoleTemplates();
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
