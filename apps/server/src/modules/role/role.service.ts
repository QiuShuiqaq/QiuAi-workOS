import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  allDigitalEmployeePlanCodes,
  isDigitalFactoryApplicationType,
  isDigitalEmployeeApplicationType
} from '../../shared/role-template-access-policy';
import {
  normalizeWorkflowGraphOrFallback,
  type WorkflowStepLike
} from '../../shared/workflow-graph';
import { buildRoleTemplateDependencyManifest } from '../../shared/role-template-dependencies';
import {
  buildRoleTemplateExecutionProfile,
  readRoleTemplateExecutionProfile,
  type ServerRoleTemplateExecutionProfile
} from '../../shared/role-template-execution-profile';
import { resolveRoleTemplateOutputCategory } from '../../shared/role-template-output-category';
import { retiredServerRoleTemplateIds } from '../../shared/role-template-catalog';

const retiredDesktopTemplateIds = [...retiredServerRoleTemplateIds];
const retiredDesktopTemplateIdSet = new Set<string>(retiredDesktopTemplateIds);

const workflowStepTypeSet = new Set<string>([
  'input',
  'llm',
  'knowledge',
  'tool',
  'approval',
  'output'
]);

const freePlanCode = 'PERSONAL_FREE';
const usablePaidSubscriptionStatuses = new Set(['ACTIVE', 'TRIALING']);

interface InstallRoleInput {
  templateId: string;
  name?: string;
  departmentName?: string;
}

type DatabaseRoleTemplate = {
  id: string;
  applicationType?: string | null;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: unknown;
  tools: unknown;
  skills: unknown;
  workflowSteps: unknown;
  workflowGraph: unknown;
  dependencyManifest?: unknown;
  executionProfile?: unknown;
  sampleInputs: unknown;
  outputFormat?: string | null;
  approvalPolicy: string;
  status: string;
  allowedPlanCodes: unknown;
  visibleWorkspaceIds: unknown;
};

type DatabaseRoleInstance = {
  id: string;
  templateId: string;
  templateVersion: string;
  workspaceId: string;
  name: string;
  status: string;
  businessGoal: string;
  knowledgeSources: unknown;
  tools: unknown;
  skills: unknown;
  approvalPolicy: string;
  installedAt: Date;
  department?: { name: string } | null;
  ownerMember?: { account: { primaryEmail: string } } | null;
  tasks: Array<{
    id: string;
    status: string;
    runs: Array<{
      startedAt: Date | null;
      finishedAt: Date | null;
    }>;
    costRecords: Array<{
      totalCost: unknown;
    }>;
  }>;
};

type TemplateAccessSummary = {
  canInstall?: boolean;
  accessLabel?: string;
  accessReason?: string;
};

@Injectable()
export class RoleService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService
  ) {}

  async listTemplates(workspaceId: string) {
    const planCode = await this.resolveWorkspacePlanCode(workspaceId);
    if (!planCode) {
      return {
        data: []
      };
    }

    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store
          .listRoleTemplates()
          .filter((template) => this.canWorkspaceUseTemplate(template, workspaceId, planCode))
          .map((template) => this.toTemplateSummary(template))
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    });

    return {
      data: templates
        .filter((template) => this.canWorkspaceUseTemplate(template, workspaceId, planCode))
        .map((template) => this.toTemplateSummary(template))
    };
  }

  async listPublishedTemplatesForDesktop(workspaceId: string) {
    const access = await this.resolveWorkspaceDesktopTemplateAccess(workspaceId);
    if (!access) {
      return {
        data: []
      };
    }

    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store
          .listRoleTemplates()
          .filter((template) => template.status === 'PUBLISHED')
          .filter((template) => !this.isRetiredDesktopTemplate(template))
          .filter((template) =>
            this.canWorkspaceSeeDesktopTemplate(template, workspaceId, {
              includeWorkspaceVisibility: access.includeWorkspaceVisibility
            })
          )
          .map((template) => this.toDesktopTemplateSummary(template, workspaceId, access))
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      where: {
        status: 'PUBLISHED',
        id: {
          notIn: retiredDesktopTemplateIds
        }
      },
      orderBy: [
        {
          publishedAt: 'desc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    return {
      data: templates
        .filter((template) =>
          this.canWorkspaceSeeDesktopTemplate(template, workspaceId, {
            includeWorkspaceVisibility: access.includeWorkspaceVisibility
          })
        )
        .map((template) => this.toDesktopTemplateSummary(template, workspaceId, access))
    };
  }

  async listPublicFreeTemplatesForDesktop() {
    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store
          .listRoleTemplates()
          .filter((template) => !this.isRetiredDesktopTemplate(template))
          .filter((template) => this.isPublicDesktopTemplate(template))
          .map((template) => this.toPublicDesktopTemplateSummary(template))
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      where: {
        status: 'PUBLISHED',
        id: {
          notIn: retiredDesktopTemplateIds
        }
      },
      orderBy: [
        {
          publishedAt: 'desc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    return {
      data: templates
        .filter((template) => this.isPublicDesktopTemplate(template))
      .map((template) => this.toPublicDesktopTemplateSummary(template))
    };
  }

  async listAllPublishedTemplatesForLocalDevelopment() {
    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store
          .listRoleTemplates()
          .filter((template) => template.status === 'PUBLISHED')
          .map((template) => this.toTemplateSummary(template, { canInstall: true }))
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      where: {
        status: 'PUBLISHED'
      },
      orderBy: [
        {
          publishedAt: 'desc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    return {
      data: templates.map((template) => this.toTemplateSummary(template, { canInstall: true }))
    };
  }

  async listDeletedTemplateIds(templateIds: string[]): Promise<string[]> {
    const normalizedTemplateIds = [...new Set(templateIds.map((id) => id.trim()).filter(Boolean))];
    if (normalizedTemplateIds.length === 0) {
      return [];
    }
    const retiredTemplateIds = normalizedTemplateIds.filter((templateId) =>
      retiredDesktopTemplateIdSet.has(templateId)
    );

    if (!isDatabasePersistenceEnabled()) {
      const deletedTemplateIds = this.store
        .listRoleTemplates()
        .filter((template) => normalizedTemplateIds.includes(template.id))
        .filter((template) => template.status === 'DELETED')
        .map((template) => template.id);
      return [...new Set([...retiredTemplateIds, ...deletedTemplateIds])];
    }

    const deletedTemplates = await this.prismaService.roleTemplate.findMany({
      where: {
        id: {
          in: normalizedTemplateIds
        },
        status: 'DELETED'
      },
      select: {
        id: true
      }
    });

    return [...new Set([...retiredTemplateIds, ...deletedTemplates.map((template) => template.id)])];
  }

  async listRoles(workspaceId: string) {
    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store.listRoles(workspaceId)
      };
    }

    const roles = await this.prismaService.roleInstance.findMany({
      where: {
        workspaceId
      },
      include: this.roleInclude(),
      orderBy: {
        installedAt: 'desc'
      }
    });

    return {
      data: roles.map((role) => this.toRoleSummary(role))
    };
  }

  async getRole(workspaceId: string, roleId: string) {
    if (!isDatabasePersistenceEnabled()) {
      const role = this.store.getRole(workspaceId, roleId);
      return role ? { data: role } : undefined;
    }

    const role = await this.prismaService.roleInstance.findFirst({
      where: {
        id: roleId,
        workspaceId
      },
      include: this.roleInclude()
    });

    return role ? { data: this.toRoleDetail(role) } : undefined;
  }

  async installRole(workspaceId: string, input: InstallRoleInput) {
    const planCode = await this.resolveWorkspacePlanCode(workspaceId);
    if (!planCode) {
      return undefined;
    }

    if (!isDatabasePersistenceEnabled()) {
      const template = this.store.getRoleTemplate(input.templateId);
      if (!template || !this.canWorkspaceUseTemplate(template, workspaceId, planCode)) {
        return undefined;
      }

      const role = this.store.installRole(workspaceId, input);
      return role ? { data: role } : undefined;
    }

    const template = await this.prismaService.roleTemplate.findUnique({
      where: {
        id: input.templateId
      }
    });
    if (!template) {
      return undefined;
    }

    if (!this.canWorkspaceUseTemplate(template, workspaceId, planCode)) {
      return undefined;
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      }
    });
    if (!workspace) {
      return undefined;
    }

    const [department, ownerMember] = await Promise.all([
      this.resolveDepartment(workspaceId, input.departmentName),
      this.resolveOwnerMember(workspaceId)
    ]);

    const role = await this.prismaService.roleInstance.create({
      data: {
        templateId: template.id,
        templateVersion: template.version,
        workspaceId,
        departmentId: department?.id ?? null,
        ownerMemberId: ownerMember?.id ?? null,
        name: input.name?.trim() || template.name,
        status: 'CONFIGURATION_REQUIRED',
        businessGoal: template.businessGoal,
        knowledgeSources: this.toStringArray(template.knowledgeSources),
        tools: this.toStringArray(template.tools),
        skills: this.toSkillSummaries(template.skills),
        approvalPolicy: template.approvalPolicy
      },
      include: this.roleInclude()
    });

    await this.upsertRoleUsage(workspaceId);

    return {
      data: this.toRoleDetail(role)
    };
  }

  private roleInclude() {
    return {
      department: true,
      ownerMember: {
        include: {
          account: true
        }
      },
      tasks: {
        include: {
          runs: true,
          costRecords: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      }
    } as const;
  }

  private async resolveDepartment(workspaceId: string, departmentName?: string) {
    const name = departmentName?.trim();
    if (!name) {
      return null;
    }

    const organization = await this.prismaService.organization.findUnique({
      where: {
        workspaceId
      }
    });
    if (!organization) {
      return null;
    }

    const department = await this.prismaService.department.findFirst({
      where: {
        organizationId: organization.id,
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });

    if (!department) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Department was not found.',
          details: {
            workspaceId,
            departmentName: name
          }
        }
      });
    }

    return department;
  }

  private async resolveOwnerMember(workspaceId: string) {
    const ownerMember = await this.prismaService.workspaceMember.findFirst({
      where: {
        workspaceId,
        role: 'OWNER'
      },
      include: {
        account: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    if (ownerMember) {
      return ownerMember;
    }

    return this.prismaService.workspaceMember.findFirst({
      where: {
        workspaceId
      },
      include: {
        account: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });
  }

  private async upsertRoleUsage(workspaceId: string) {
    const usedValue = await this.prismaService.roleInstance.count({
      where: {
        workspaceId
      }
    });

    await this.prismaService.usageMeter.upsert({
      where: {
        workspaceId_metricKey_period: {
          workspaceId,
          metricKey: 'roleInstances.count',
          period: this.currentMonthPeriod()
        }
      },
      update: {
        usedValue
      },
      create: {
        workspaceId,
        metricKey: 'roleInstances.count',
        period: this.currentMonthPeriod(),
        usedValue
      }
    });
  }

  private toTemplateSummary(
    template: DatabaseRoleTemplate,
    access: TemplateAccessSummary = {}
  ) {
    const applicationType = isDigitalFactoryApplicationType(template.applicationType)
      ? 'digital_factory'
      : 'digital_employee';
    const workflowSteps = this.toWorkflowSteps(template.workflowSteps);
    const knowledgeSources = this.toStringArray(template.knowledgeSources);
    const tools = this.toStringArray(template.tools);
    const skills = this.toSkillSummaries(template.skills);
    const executionProfile = this.resolveTemplateExecutionProfile(template, {
      knowledgeSources,
      tools,
      skills
    });
    const workflowGraph = normalizeWorkflowGraphOrFallback(template.workflowGraph, workflowSteps);
    const dependencyManifest = this.withTemplateExecutionProfile(
      this.rebuildModelDependencyManifest(template.dependencyManifest, workflowGraph),
      executionProfile
    );

    return {
      id: template.id,
      applicationType,
      outputCategory: resolveRoleTemplateOutputCategory({
        applicationType,
        templateId: template.id,
        name: template.name,
        outputFormat: template.outputFormat,
        dependencyManifest
      }),
      version: template.version,
      name: template.name,
      industry: template.industry,
      scenario: template.scenario,
      description: template.description,
      recommendedPlanCode: template.recommendedPlanCode,
      allowedPlanCodes: isDigitalEmployeeApplicationType(template.applicationType)
        ? [...allDigitalEmployeePlanCodes]
        : this.toStringArray(template.allowedPlanCodes),
      canInstall: access.canInstall ?? true,
      accessLabel: access.accessLabel,
      accessReason: access.accessReason,
      businessGoal: template.businessGoal,
      knowledgeSources,
      tools,
      skills,
      workflowSteps,
      workflowGraph,
      dependencyManifest,
      executionProfile,
      sampleInputs: this.toStringArray(template.sampleInputs),
      outputFormat: template.outputFormat?.trim() || '',
      approvalPolicy: template.approvalPolicy
    };
  }

  private toDesktopTemplateSummary(
    template: DatabaseRoleTemplate,
    workspaceId: string,
    access: { planCode: string; includeWorkspaceVisibility: boolean }
  ) {
    const canInstall = this.canWorkspaceUseTemplate(template, workspaceId, access.planCode, {
      includeWorkspaceVisibility: access.includeWorkspaceVisibility
    });

    return this.toTemplateSummary(template, {
      canInstall,
      accessLabel: canInstall ? undefined : '\u5347\u7ea7\u53ef\u7528',
      accessReason: canInstall
        ? undefined
        : '\u5f53\u524d\u5957\u9910\u6682\u4e0d\u652f\u6301\u5b89\u88c5\uff0c\u8bf7\u5728\u8d2d\u4e70\u4e2d\u5fc3\u5347\u7ea7\u540e\u4f7f\u7528\u3002'
    });
  }

  private toPublicDesktopTemplateSummary(template: DatabaseRoleTemplate) {
    const canInstall =
      isDigitalEmployeeApplicationType(template.applicationType) ||
      this.toStringArray(template.allowedPlanCodes).includes(freePlanCode);

    return this.toTemplateSummary(template, {
      canInstall,
      accessLabel: canInstall ? undefined : '\u5347\u7ea7\u53ef\u7528',
      accessReason: canInstall
        ? undefined
        : '\u5f53\u524d\u4e3a\u514d\u8d39\u7248\uff0c\u5347\u7ea7\u6216\u7ed1\u5b9a\u4f01\u4e1a\u540e\u53ef\u5b89\u88c5\u3002'
    });
  }

  private async resolveWorkspacePlanCode(workspaceId: string): Promise<string | null> {
    if (!isDatabasePersistenceEnabled()) {
      const subscription = this.store.getSubscription(workspaceId);
      return subscription?.planCode ?? this.store.getWorkspace(workspaceId)?.planCode ?? null;
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      select: {
        subscriptions: {
          select: {
            plan: {
              select: {
                code: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    return workspace?.subscriptions[0]?.plan.code ?? null;
  }

  private async resolveWorkspaceDesktopTemplateAccess(
    workspaceId: string
  ): Promise<{ planCode: string; includeWorkspaceVisibility: boolean } | null> {
    if (!isDatabasePersistenceEnabled()) {
      const workspace = this.store.getWorkspace(workspaceId);
      if (!workspace) {
        return null;
      }

      const subscription = this.store.getSubscription(workspaceId);
      if (!subscription) {
        return {
          planCode: freePlanCode,
          includeWorkspaceVisibility: false
        };
      }

      return this.toDesktopTemplateAccess(
        subscription.planCode,
        subscription.status,
        subscription.currentPeriodEnd
      );
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      select: {
        subscriptions: {
          select: {
            status: true,
            currentPeriodEnd: true,
            plan: {
              select: {
                code: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!workspace) {
      return null;
    }

    const subscription = workspace.subscriptions[0];
    if (!subscription) {
      return {
        planCode: freePlanCode,
        includeWorkspaceVisibility: false
      };
    }

    return this.toDesktopTemplateAccess(
      subscription.plan.code,
      subscription.status,
      subscription.currentPeriodEnd
    );
  }

  private toDesktopTemplateAccess(
    planCode: string,
    subscriptionStatus: string,
    currentPeriodEnd?: string | Date | null
  ) {
    const normalizedStatus = subscriptionStatus.toUpperCase();
    if (normalizedStatus === 'FREE') {
      return {
        planCode: freePlanCode,
        includeWorkspaceVisibility: true
      };
    }

    if (!usablePaidSubscriptionStatuses.has(normalizedStatus) || this.hasSubscriptionPeriodEnded(currentPeriodEnd)) {
      return {
        planCode: freePlanCode,
        includeWorkspaceVisibility: false
      };
    }

    return {
      planCode,
      includeWorkspaceVisibility: true
    };
  }

  private hasSubscriptionPeriodEnded(currentPeriodEnd?: string | Date | null): boolean {
    if (!currentPeriodEnd) {
      return false;
    }

    const periodEnd =
      currentPeriodEnd instanceof Date ? currentPeriodEnd.getTime() : Date.parse(currentPeriodEnd);
    if (Number.isNaN(periodEnd)) {
      return false;
    }

    return periodEnd <= Date.now();
  }

  private canWorkspaceUseTemplate(
    template: {
      status: string;
      applicationType?: string | null;
      allowedPlanCodes: unknown;
      visibleWorkspaceIds: unknown;
    },
    workspaceId: string,
    planCode: string,
    options: { includeWorkspaceVisibility?: boolean } = {}
  ): boolean {
    if (template.status !== 'PUBLISHED') {
      return false;
    }

    const visibleWorkspaceIds = this.toStringArray(template.visibleWorkspaceIds);
    if (options.includeWorkspaceVisibility !== false && visibleWorkspaceIds.includes(workspaceId)) {
      return true;
    }

    if (isDigitalEmployeeApplicationType(template.applicationType)) {
      return true;
    }

    return this.toStringArray(template.allowedPlanCodes).includes(planCode);
  }

  private canWorkspaceSeeDesktopTemplate(
    template: {
      status: string;
      visibleWorkspaceIds: unknown;
    },
    workspaceId: string,
    options: { includeWorkspaceVisibility?: boolean } = {}
  ): boolean {
    if (template.status !== 'PUBLISHED') {
      return false;
    }

    const visibleWorkspaceIds = this.toStringArray(template.visibleWorkspaceIds);
    if (visibleWorkspaceIds.length === 0) {
      return true;
    }

    return options.includeWorkspaceVisibility !== false && visibleWorkspaceIds.includes(workspaceId);
  }

  private isRetiredDesktopTemplate(template: { id: string }): boolean {
    return retiredDesktopTemplateIdSet.has(template.id);
  }

  private isPublicDesktopTemplate(template: {
    status: string;
    visibleWorkspaceIds: unknown;
  }): boolean {
    return (
      template.status === 'PUBLISHED' &&
      this.toStringArray(template.visibleWorkspaceIds).length === 0
    );
  }

  private toRoleSummary(role: DatabaseRoleInstance) {
    return {
      id: role.id,
      templateId: role.templateId,
      templateVersion: role.templateVersion,
      workspaceId: role.workspaceId,
      name: role.name,
      departmentName: role.department?.name,
      ownerName: this.ownerName(role),
      status: this.toRoleStatus(role.status),
      installedAt: role.installedAt.toISOString(),
      skills: this.toSkillSummaries(role.skills),
      kpis: this.calculateKpis(role)
    };
  }

  private toRoleDetail(role: DatabaseRoleInstance) {
    return {
      ...this.toRoleSummary(role),
      businessGoal: role.businessGoal,
      knowledgeSources: this.toStringArray(role.knowledgeSources),
      tools: this.toStringArray(role.tools),
      skills: this.toSkillSummaries(role.skills),
      approvalPolicy: role.approvalPolicy,
      recentTaskIds: role.tasks.slice(0, 10).map((task) => task.id)
    };
  }

  private ownerName(role: DatabaseRoleInstance) {
    const email = role.ownerMember?.account.primaryEmail;
    if (!email) {
      return 'Workspace Owner';
    }

    return email.split('@')[0] || email;
  }

  private calculateKpis(role: DatabaseRoleInstance) {
    const completedTasks = role.tasks.filter((task) => task.status === 'COMPLETED');
    const finishedRuns = role.tasks
      .flatMap((task) => task.runs)
      .filter((run) => run.startedAt && run.finishedAt);
    const totalDurationMinutes = finishedRuns.reduce((sum, run) => {
      if (!run.startedAt || !run.finishedAt) {
        return sum;
      }

      return sum + (run.finishedAt.getTime() - run.startedAt.getTime()) / 60000;
    }, 0);
    const totalCost = role.tasks.reduce(
      (sum, task) =>
        sum +
        task.costRecords.reduce((taskSum, record) => taskSum + Number(record.totalCost), 0),
      0
    );

    return {
      taskCompleted: completedTasks.length,
      automationRate: role.tasks.length ? completedTasks.length / role.tasks.length : 0,
      avgDurationMinutes: finishedRuns.length ? Math.round(totalDurationMinutes / finishedRuns.length) : 0,
      monthlyCost: Number(totalCost.toFixed(2))
    };
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private resolveTemplateExecutionProfile(
    template: DatabaseRoleTemplate,
    normalized?: {
      knowledgeSources?: string[];
      tools?: string[];
      skills?: Array<{ code: string; name: string; summary: string }>;
    }
  ): ServerRoleTemplateExecutionProfile {
    const manifestProfile = readRoleTemplateExecutionProfile(
      this.toRecord(template.dependencyManifest)?.executionProfile
    );
    if (manifestProfile) {
      return manifestProfile;
    }

    const explicitProfile = readRoleTemplateExecutionProfile(template.executionProfile);
    if (explicitProfile) {
      return explicitProfile;
    }

    return buildRoleTemplateExecutionProfile({
      templateId: template.id,
      applicationType: template.applicationType,
      name: template.name,
      industry: template.industry,
      scenario: template.scenario,
      description: template.description,
      businessGoal: template.businessGoal,
      knowledgeSources: normalized?.knowledgeSources ?? this.toStringArray(template.knowledgeSources),
      tools: normalized?.tools ?? this.toStringArray(template.tools),
      skills: normalized?.skills ?? this.toSkillSummaries(template.skills),
      outputFormat: template.outputFormat,
      approvalPolicy: template.approvalPolicy
    });
  }

  private withTemplateExecutionProfile(
    dependencyManifest: unknown,
    executionProfile: ServerRoleTemplateExecutionProfile
  ): unknown {
    const record = this.toRecord(dependencyManifest);
    if (!record) {
      return dependencyManifest;
    }

    return {
      ...record,
      executionProfile: readRoleTemplateExecutionProfile(record.executionProfile) ?? executionProfile
    };
  }

  private rebuildModelDependencyManifest(
    dependencyManifest: unknown,
    workflowGraph: DatabaseRoleTemplate['workflowGraph']
  ): unknown {
    const existing = this.toRecord(dependencyManifest);
    const generatedAt =
      typeof existing?.generatedAt === 'string' && existing.generatedAt.trim()
        ? existing.generatedAt
        : new Date().toISOString();
    const compiled = buildRoleTemplateDependencyManifest({
      workflowGraph: workflowGraph as Parameters<typeof buildRoleTemplateDependencyManifest>[0]['workflowGraph'],
      generatedAt
    });

    if (!existing) {
      return compiled;
    }

    return {
      ...existing,
      modelAssets: compiled.modelAssets
    };
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private toSkillSummaries(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }

      const record = item as Record<string, unknown>;
      const code = typeof record.code === 'string' ? record.code.trim() : '';
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const summary = typeof record.summary === 'string' ? record.summary.trim() : '';

      if (!code || !name || !summary) {
        return [];
      }

      return [{ code, name, summary }];
    });
  }

  private toWorkflowSteps(value: unknown): WorkflowStepLike[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === 'string' ? record.id.trim() : '';
      const type = typeof record.type === 'string' ? record.type.trim() : '';
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const instruction = typeof record.instruction === 'string' ? record.instruction.trim() : '';
      const order = typeof record.order === 'number' && Number.isInteger(record.order) ? record.order : 0;

      if (!id || !workflowStepTypeSet.has(type) || !name || !instruction || order <= 0) {
        return [];
      }

      return [
        {
          id,
          order,
          type: type as WorkflowStepLike['type'],
          name,
          instruction,
          toolIds: this.toStringArray(record.toolIds),
          requiresApproval:
            typeof record.requiresApproval === 'boolean'
              ? record.requiresApproval
              : type === 'approval'
        }
      ];
    });
  }

  private toRoleStatus(value: string): 'running' | 'trial' | 'configuration_required' | 'paused' {
    switch (value) {
      case 'RUNNING':
        return 'running';
      case 'TRIAL':
        return 'trial';
      case 'PAUSED':
        return 'paused';
      default:
        return 'configuration_required';
    }
  }

  private currentMonthPeriod() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
