import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from '@nestjs/common';

import { PlanDetailDto } from '../commercial/dto/list-plans-response.dto';
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

interface CreateDepartmentInput {
  name: string;
  parentDepartmentId?: string;
  ownerUserId?: string;
}

@Injectable()
export class OrganizationService {
  constructor(private readonly store: MockPlatformStore) {}

  getOverview(workspaceId: string): GetEnterpriseWorkspaceOverviewResponseDto {
    const overview = this.buildOverview(workspaceId);
    return { data: overview };
  }

  createDepartment(
    workspaceId: string,
    input: CreateDepartmentInput
  ): CreateDepartmentResponseDto {
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
            requiredPlan: 'ENTERPRISE_MONTHLY'
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

  private buildOverview(workspaceId: string): EnterpriseWorkspaceOverviewResponseDto {
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
        usedValue: departmentCount * 2 + roleCount + taskCount / 10,
        limitUnit: 'GB'
      }
    ];
  }
}
