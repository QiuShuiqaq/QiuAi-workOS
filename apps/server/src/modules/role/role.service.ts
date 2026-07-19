import { Injectable, NotFoundException } from '@nestjs/common';

import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';

interface InstallRoleInput {
  templateId: string;
  name?: string;
  departmentName?: string;
}

type DatabaseRoleTemplate = {
  id: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: unknown;
  tools: unknown;
  approvalPolicy: string;
};

type DatabaseRoleInstance = {
  id: string;
  templateId: string;
  workspaceId: string;
  name: string;
  status: string;
  businessGoal: string;
  knowledgeSources: unknown;
  tools: unknown;
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

@Injectable()
export class RoleService {
  constructor(
    private readonly store: MockPlatformStore,
    private readonly prismaService: PrismaService,
    private readonly entitlementService: EntitlementService
  ) {}

  async listTemplates() {
    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store.listRoleTemplates()
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      orderBy: {
        createdAt: 'asc'
      }
    });

    return {
      data: templates.map((template) => this.toTemplateSummary(template))
    };
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
    if (!isDatabasePersistenceEnabled()) {
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

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      }
    });
    if (!workspace) {
      return undefined;
    }

    const existingRoleCount = await this.prismaService.roleInstance.count({
      where: {
        workspaceId
      }
    });
    await this.entitlementService.requireAllowed(
      {
        workspaceId,
        featureKey: 'maxRoleInstances',
        requestedAmount: existingRoleCount + 1
      },
      'AI role quota requires a higher plan.'
    );

    const [department, ownerMember] = await Promise.all([
      this.resolveDepartment(workspaceId, input.departmentName),
      this.resolveOwnerMember(workspaceId)
    ]);

    const role = await this.prismaService.roleInstance.create({
      data: {
        templateId: template.id,
        workspaceId,
        departmentId: department?.id ?? null,
        ownerMemberId: ownerMember?.id ?? null,
        name: input.name?.trim() || template.name,
        status: 'CONFIGURATION_REQUIRED',
        businessGoal: template.businessGoal,
        knowledgeSources: this.toStringArray(template.knowledgeSources),
        tools: this.toStringArray(template.tools),
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

  private toTemplateSummary(template: DatabaseRoleTemplate) {
    return {
      id: template.id,
      name: template.name,
      industry: template.industry,
      scenario: template.scenario,
      description: template.description,
      recommendedPlanCode: template.recommendedPlanCode
    };
  }

  private toRoleSummary(role: DatabaseRoleInstance) {
    return {
      id: role.id,
      templateId: role.templateId,
      workspaceId: role.workspaceId,
      name: role.name,
      departmentName: role.department?.name,
      ownerName: this.ownerName(role),
      status: this.toRoleStatus(role.status),
      installedAt: role.installedAt.toISOString(),
      kpis: this.calculateKpis(role)
    };
  }

  private toRoleDetail(role: DatabaseRoleInstance) {
    return {
      ...this.toRoleSummary(role),
      businessGoal: role.businessGoal,
      knowledgeSources: this.toStringArray(role.knowledgeSources),
      tools: this.toStringArray(role.tools),
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
