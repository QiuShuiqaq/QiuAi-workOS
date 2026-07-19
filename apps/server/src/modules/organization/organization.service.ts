import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { AccountStatus, BillingCycle, SubscriptionStatus, WorkspaceStatus, WorkspaceType } from '@prisma/client';

import { PlanDetailDto } from '../commercial/dto/list-plans-response.dto';
import { EntitlementService } from '../entitlement/entitlement.service';
import { WorkspaceSummaryDto } from '../workspace/dto/current-account-response.dto';
import {
  CreateDepartmentResponseDto,
  DepartmentSummaryDto,
  EnterpriseWorkspaceOverviewResponseDto,
  GetEnterpriseWorkspaceOverviewResponseDto,
  MemberSummaryDto,
  OrganizationSummaryDto,
  SubscriptionSummaryDto,
  UsageMeterSummaryDto
} from './dto/enterprise-workspace-overview-response.dto';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';

interface CreateDepartmentInput {
  name: string;
  parentDepartmentId?: string;
  ownerUserId?: string;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly store: MockPlatformStore,
    private readonly prismaService: PrismaService,
    private readonly entitlementService: EntitlementService
  ) {}

  async getOverview(workspaceId: string): Promise<GetEnterpriseWorkspaceOverviewResponseDto> {
    const overview = isDatabasePersistenceEnabled()
      ? await this.buildDatabaseOverview(workspaceId)
      : this.buildMockOverview(workspaceId);
    return { data: overview };
  }

  async createDepartment(
    workspaceId: string,
    input: CreateDepartmentInput
  ): Promise<CreateDepartmentResponseDto> {
    if (isDatabasePersistenceEnabled()) {
      return {
        data: await this.createDatabaseDepartment(workspaceId, input)
      };
    }

    const workspace = this.store.getWorkspace(workspaceId);
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const entitlement = this.store.hasEntitlement(workspaceId, 'canCreateDepartment');
    if (!entitlement?.enabled) {
      throw new ForbiddenException({
        error: {
          code: 'PLAN_UPGRADE_REQUIRED',
          message: 'Department management requires an Enterprise plan.',
          details: {
            featureKey: 'canCreateDepartment',
            requiredPlan: 'ENTERPRISE_BASIC_MONTHLY'
          }
        }
      });
    }

    const organization = this.store.getOrganization(workspaceId);
    if (!organization) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Organization was not found.',
          details: { workspaceId }
        }
      });
    }

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Department name is required.'
        }
      });
    }

    const existingDepartment = this.store
      .listDepartments(workspaceId)
      .find((department) => department.name.toLowerCase() === name.toLowerCase());
    if (existingDepartment) {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'Department already exists.',
          details: {
            workspaceId,
            name
          }
        }
      });
    }

    if (input.ownerUserId && !this.store.getMember(workspaceId, input.ownerUserId)) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Department owner was not found.',
          details: {
            workspaceId,
            ownerUserId: input.ownerUserId
          }
        }
      });
    }

    if (input.parentDepartmentId && !this.store.getDepartment(workspaceId, input.parentDepartmentId)) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Parent department was not found.',
          details: {
            workspaceId,
            parentDepartmentId: input.parentDepartmentId
          }
        }
      });
    }

    const department = this.store.createDepartment(workspaceId, {
      name,
      parentDepartmentId: input.parentDepartmentId,
      ownerUserId: input.ownerUserId
    });

    if (!department) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Organization was not found.',
          details: { workspaceId }
        }
      });
    }

    return {
      data: this.toDepartmentSummary(workspaceId, department)
    };
  }

  private buildMockOverview(workspaceId: string): EnterpriseWorkspaceOverviewResponseDto {
    const workspace = this.store.getWorkspace(workspaceId);
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const plan = this.store.getPlan(workspaceId);
    const subscription = this.store.getSubscription(workspaceId);
    if (!plan || !subscription) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace subscription was not found.',
          details: { workspaceId }
        }
      });
    }

    const organization = this.store.getOrganization(workspaceId);
    const members = this.store.listMembers(workspaceId);
    const departments = this.store.listDepartments(workspaceId);
    const roles = this.store.listRoles(workspaceId);
    const tasks = this.store.listTasks(workspaceId);
    const departmentById = new Map(departments.map((department) => [department.id, department]));
    const memberById = new Map(members.map((member) => [member.id, member]));

    return {
      workspace: workspace as WorkspaceSummaryDto,
      organization: organization ? (organization as OrganizationSummaryDto) : null,
      plan: {
        code: plan.code,
        name: plan.name,
        billingCycle: plan.billingCycle,
        priceCents: plan.priceCents,
        currency: plan.currency,
        description: plan.description,
        entitlements: plan.entitlements.map((entitlement) => ({
          featureKey: entitlement.featureKey,
          enabled: entitlement.enabled,
          limitValue: entitlement.limitValue,
          limitUnit: entitlement.limitUnit
        }))
      } as PlanDetailDto,
      subscription: subscription as SubscriptionSummaryDto,
      departments: departments.map((department) => this.toDepartmentSummary(workspaceId, department, memberById, departmentById, members, roles)),
      members: members.map((member) => this.toMemberSummary(member, departmentById)),
      usage: this.buildUsageSummary(plan, members.length, departments.length, roles.length, tasks.length)
    };
  }

  private async buildDatabaseOverview(workspaceId: string): Promise<EnterpriseWorkspaceOverviewResponseDto> {
    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        memberships: {
          include: {
            account: true,
            department: true
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
        subscriptions: {
          include: {
            plan: {
              include: {
                entitlements: {
                  orderBy: {
                    featureKey: 'asc'
                  }
                }
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
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const subscription = workspace.subscriptions[0];
    if (!subscription) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace subscription was not found.',
          details: { workspaceId }
        }
      });
    }

    const organization = await this.prismaService.organization.findUnique({
      where: { workspaceId },
      include: {
        departments: {
          include: {
            parentDepartment: true,
            ownerMember: {
              include: {
                account: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    const memberCountByDepartment = new Map<string, number>();
    for (const member of workspace.memberships) {
      if (member.departmentId) {
        memberCountByDepartment.set(
          member.departmentId,
          (memberCountByDepartment.get(member.departmentId) ?? 0) + 1
        );
      }
    }

    const departments = organization?.departments ?? [];
    const [roleCount, taskCount, roleCountsByDepartment] = await Promise.all([
      this.prismaService.roleInstance.count({
        where: {
          workspaceId
        }
      }),
      this.prismaService.task.count({
        where: {
          workspaceId,
          createdAt: {
            gte: this.currentMonthStart()
          }
        }
      }),
      this.prismaService.roleInstance.groupBy({
        by: ['departmentId'],
        where: {
          workspaceId,
          departmentId: {
            not: null
          }
        },
        _count: {
          _all: true
        }
      })
    ]);
    const roleCountByDepartment = new Map(
      roleCountsByDepartment
        .filter((item) => item.departmentId)
        .map((item) => [item.departmentId as string, item._count._all])
    );

    return {
      workspace: {
        id: workspace.id,
        tenantId: workspace.tenantId,
        workspaceType: this.toWorkspaceType(workspace.type),
        name: workspace.name,
        ownerAccountId: workspace.ownerAccountId,
        status: this.toWorkspaceStatus(workspace.status),
        planCode: subscription.plan.code
      },
      organization: organization
        ? {
            id: organization.id,
            tenantId: organization.tenantId,
            workspaceId: organization.workspaceId,
            name: organization.name,
            industry: organization.industry ?? undefined,
            size: organization.size ?? undefined,
            status: 'active',
            createdAt: organization.createdAt.toISOString()
          }
        : null,
      plan: {
        code: subscription.plan.code,
        name: subscription.plan.name,
        billingCycle: subscription.plan.billingCycle,
        priceCents: subscription.plan.priceCents ?? undefined,
        currency: subscription.plan.currency ?? undefined,
        description: subscription.plan.description ?? undefined,
        entitlements: subscription.plan.entitlements.map((entitlement) => ({
          featureKey: entitlement.featureKey,
          enabled: entitlement.enabled,
          limitValue: entitlement.limitValue ?? undefined,
          limitUnit: entitlement.limitUnit ?? undefined
        }))
      },
      subscription: {
        id: subscription.id,
        workspaceId: subscription.workspaceId,
        planCode: subscription.plan.code,
        status: this.toSubscriptionStatus(subscription.status),
        billingCycle: this.toBillingCycle(subscription.billingCycle),
        currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
        currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
      },
      departments: departments.map((department) =>
        this.toDatabaseDepartmentSummary(
          department,
          memberCountByDepartment.get(department.id) ?? 0,
          roleCountByDepartment.get(department.id) ?? 0
        )
      ),
      members: workspace.memberships.map((member) => this.toDatabaseMemberSummary(member)),
      usage: this.buildUsageSummary(
        {
          entitlements: subscription.plan.entitlements.map((entitlement) => ({
            featureKey: entitlement.featureKey,
            enabled: entitlement.enabled,
            limitValue: entitlement.limitValue ?? undefined,
            limitUnit: entitlement.limitUnit ?? undefined
          }))
        },
        workspace.memberships.length,
        departments.length,
        roleCount,
        taskCount
      )
    };
  }

  private async createDatabaseDepartment(
    workspaceId: string,
    input: CreateDepartmentInput
  ): Promise<DepartmentSummaryDto> {
    await this.entitlementService.requireAllowed(
      {
        workspaceId,
        featureKey: 'canCreateDepartment'
      },
      'Department management requires an Enterprise plan.'
    );

    const organization = await this.prismaService.organization.findUnique({
      where: { workspaceId }
    });

    if (!organization) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Organization was not found.',
          details: { workspaceId }
        }
      });
    }

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Department name is required.'
        }
      });
    }

    const existingDepartment = await this.prismaService.department.findFirst({
      where: {
        organizationId: organization.id,
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });
    if (existingDepartment) {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'Department already exists.',
          details: {
            workspaceId,
            name
          }
        }
      });
    }

    let ownerMember:
      | {
          id: string;
          account: { primaryEmail: string };
        }
      | null = null;
    if (input.ownerUserId) {
      ownerMember = await this.prismaService.workspaceMember.findFirst({
        where: {
          id: input.ownerUserId,
          workspaceId
        },
        include: {
          account: true
        }
      });

      if (!ownerMember) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Department owner was not found.',
            details: {
              workspaceId,
              ownerUserId: input.ownerUserId
            }
          }
        });
      }
    }

    if (input.parentDepartmentId) {
      const parentDepartment = await this.prismaService.department.findFirst({
        where: {
          id: input.parentDepartmentId,
          organizationId: organization.id
        }
      });

      if (!parentDepartment) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Parent department was not found.',
            details: {
              workspaceId,
              parentDepartmentId: input.parentDepartmentId
            }
          }
        });
      }
    }

    const department = await this.prismaService.department.create({
      data: {
        organizationId: organization.id,
        parentDepartmentId: input.parentDepartmentId ?? null,
        name,
        ownerMemberId: ownerMember?.id ?? null
      },
      include: {
        parentDepartment: true,
        ownerMember: {
          include: {
            account: true
          }
        }
      }
    });

    return this.toDatabaseDepartmentSummary(department, 0, 0);
  }

  private toDepartmentSummary(
    workspaceId: string,
    department: {
      id: string;
      organizationId: string;
      parentDepartmentId?: string;
      name: string;
      ownerUserId?: string;
      createdAt: string;
    },
    memberById = new Map<string, { id: string; name: string; departmentId?: string }>(),
    departmentById = new Map<string, { id: string; name: string; parentDepartmentId?: string }>(),
    members = this.store.listMembers(workspaceId),
    roles = this.store.listRoles(workspaceId)
  ): DepartmentSummaryDto {
    const ownerName = department.ownerUserId ? memberById.get(department.ownerUserId)?.name : undefined;
    const parentDepartmentName = department.parentDepartmentId
      ? departmentById.get(department.parentDepartmentId)?.name
      : undefined;
    const memberCount = members.filter((member) => member.departmentId === department.id).length;
    const roleInstanceCount = roles.filter(
      (role) => role.departmentName === department.name
    ).length;

    return {
      id: department.id,
      organizationId: department.organizationId,
      parentDepartmentId: department.parentDepartmentId,
      parentDepartmentName,
      name: department.name,
      ownerUserId: department.ownerUserId,
      ownerName,
      memberCount,
      roleInstanceCount,
      createdAt: department.createdAt
    };
  }

  private toMemberSummary(
    member: {
      id: string;
      accountId: string;
      name: string;
      email: string;
      departmentId?: string;
      systemRole: 'owner' | 'admin' | 'member' | 'viewer';
      status: 'active' | 'invited' | 'disabled';
      joinedAt: string;
    },
    departmentById: Map<string, { id: string; name: string }>
  ): MemberSummaryDto {
    return {
      id: member.id,
      accountId: member.accountId,
      name: member.name,
      email: member.email,
      departmentId: member.departmentId,
      departmentName: member.departmentId ? departmentById.get(member.departmentId)?.name : undefined,
      systemRole: member.systemRole,
      status: member.status,
      joinedAt: member.joinedAt
    };
  }

  private toDatabaseDepartmentSummary(
    department: {
      id: string;
      organizationId: string;
      parentDepartmentId: string | null;
      name: string;
      ownerMemberId: string | null;
      createdAt: Date;
      parentDepartment?: { name: string } | null;
      ownerMember?: { account: { primaryEmail: string } } | null;
    },
    memberCount: number,
    roleInstanceCount: number
  ): DepartmentSummaryDto {
    return {
      id: department.id,
      organizationId: department.organizationId,
      parentDepartmentId: department.parentDepartmentId ?? undefined,
      parentDepartmentName: department.parentDepartment?.name,
      name: department.name,
      ownerUserId: department.ownerMemberId ?? undefined,
      ownerName: department.ownerMember
        ? this.displayNameFromEmail(department.ownerMember.account.primaryEmail)
        : undefined,
      memberCount,
      roleInstanceCount,
      createdAt: department.createdAt.toISOString()
    };
  }

  private toDatabaseMemberSummary(member: {
    id: string;
    accountId: string;
    departmentId: string | null;
    role: string;
    createdAt: Date;
    account: {
      primaryEmail: string;
      status: AccountStatus;
    };
    department?: {
      name: string;
    } | null;
  }): MemberSummaryDto {
    return {
      id: member.id,
      accountId: member.accountId,
      name: this.displayNameFromEmail(member.account.primaryEmail),
      email: member.account.primaryEmail,
      departmentId: member.departmentId ?? undefined,
      departmentName: member.department?.name,
      systemRole: this.toSystemRole(member.role),
      status: this.toMemberStatus(member.account.status),
      joinedAt: member.createdAt.toISOString()
    };
  }

  private toWorkspaceType(value: WorkspaceType): 'personal' | 'enterprise' {
    return value === 'ENTERPRISE' ? 'enterprise' : 'personal';
  }

  private toWorkspaceStatus(value: WorkspaceStatus): 'active' | 'suspended' | 'archived' {
    switch (value) {
      case 'SUSPENDED':
        return 'suspended';
      case 'ARCHIVED':
        return 'archived';
      default:
        return 'active';
    }
  }

  private toSubscriptionStatus(
    value: SubscriptionStatus
  ): 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired' {
    switch (value) {
      case 'FREE':
        return 'free';
      case 'TRIALING':
        return 'trialing';
      case 'ACTIVE':
        return 'active';
      case 'PAST_DUE':
        return 'past_due';
      case 'CANCELLED':
        return 'cancelled';
      case 'EXPIRED':
        return 'expired';
    }
  }

  private toBillingCycle(value: BillingCycle): 'free' | 'monthly' | 'annual' | 'custom' {
    switch (value) {
      case 'FREE':
        return 'free';
      case 'MONTHLY':
        return 'monthly';
      case 'ANNUAL':
        return 'annual';
      case 'CUSTOM':
        return 'custom';
    }
  }

  private toSystemRole(value: string): 'owner' | 'admin' | 'member' | 'viewer' {
    switch (value) {
      case 'OWNER':
        return 'owner';
      case 'ADMIN':
        return 'admin';
      case 'VIEWER':
        return 'viewer';
      default:
        return 'member';
    }
  }

  private toMemberStatus(value: AccountStatus): 'active' | 'invited' | 'disabled' {
    return value === 'DISABLED' ? 'disabled' : 'active';
  }

  private displayNameFromEmail(email: string): string {
    return email.split('@')[0] || email;
  }

  private currentMonthStart() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private buildUsageSummary(
    plan: {
      entitlements: Array<{ featureKey: string; enabled: boolean; limitValue?: number; limitUnit?: string }>;
    },
    memberCount: number,
    departmentCount: number,
    roleCount: number,
    taskCount: number
  ): UsageMeterSummaryDto[] {
    const maxRoleInstances = plan.entitlements.find((item) => item.featureKey === 'maxRoleInstances');
    const maxTasksPerMonth = plan.entitlements.find((item) => item.featureKey === 'maxTasksPerMonth');

    return [
      {
        metricKey: 'roleInstances.count',
        title: 'AI 岗位数量',
        usedValue: roleCount,
        limitValue: maxRoleInstances?.limitValue,
        limitUnit: maxRoleInstances?.limitUnit
      },
      {
        metricKey: 'tasks.monthlyCount',
        title: '月任务数',
        usedValue: taskCount,
        limitValue: maxTasksPerMonth?.limitValue,
        limitUnit: maxTasksPerMonth?.limitUnit
      },
      {
        metricKey: 'departments.count',
        title: '部门数量',
        usedValue: departmentCount
      },
      {
        metricKey: 'members.count',
        title: '成员数量',
        usedValue: memberCount
      },
      {
        metricKey: 'storage.usedGB',
        title: '存储用量',
        usedValue: 0,
        limitUnit: 'GB'
      }
    ];
  }
}
