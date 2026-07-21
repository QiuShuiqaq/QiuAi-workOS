import { Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { demoWorkspaces } from '../../shared/mock/platform-seed';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentAccountResponseDto } from './dto/current-account-response.dto';
import { PlatformOverviewResponseDto } from './dto/platform-overview-response.dto';

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async getCurrentAccount(cookieHeader?: string): Promise<CurrentAccountResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      return this.authService.getCurrentAccount(cookieHeader);
    }

    try {
      return await this.authService.getCurrentAccount(cookieHeader);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.'
        }
      });
    }
  }

  async getOverview(workspaceId: string, cookieHeader?: string): Promise<PlatformOverviewResponseDto> {
    await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);

    if (isDatabasePersistenceEnabled()) {
      return this.getDatabaseOverview(workspaceId);
    }

    return this.getMockOverview(workspaceId);
  }

  private getMockOverview(workspaceId: string): PlatformOverviewResponseDto {
    const workspace = demoWorkspaces.find((item) => item.id === workspaceId);
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const roles = this.store.listRoles(workspaceId);
    const tasks = this.store.listTasks(workspaceId);
    const runningRoles = roles.filter((role) => role.status === 'running').length;
    const completedTasks = tasks.filter((task) => task.status === 'completed').length;
    const waitingApprovalTasks = tasks.filter((task) => task.status === 'waiting_approval').length;
    const totalCost = tasks.reduce(
      (sum, task) => sum + task.costRecords.reduce((taskSum, record) => taskSum + record.totalCost, 0),
      0
    );

    return {
      workspace,
      metrics: [
        { key: 'roles', title: 'AI 岗位', value: String(roles.length), trend: `${runningRoles} 个运行中` },
        { key: 'tasks', title: '任务总数', value: String(tasks.length), trend: `${completedTasks} 个已完成` },
        { key: 'approvals', title: '待审批', value: String(waitingApprovalTasks), trend: '需要人工确认' },
        { key: 'cost', title: '累计成本', value: `¥${totalCost.toFixed(2)}`, trend: 'mock 统计' }
      ],
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        departmentName: role.departmentName,
        status: role.status
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        roleName: task.roleName,
        state: this.toOverviewTaskState(task.status)
      }))
    };
  }

  private toOverviewTaskState(status: ReturnType<MockPlatformStore['listTasks']>[number]['status']) {
    if (status === 'completed') return 'completed';
    if (status === 'failed') return 'failed';
    if (status === 'waiting_approval') return 'waiting_approval';
    return 'running';
  }

  private async getDatabaseOverview(workspaceId: string): Promise<PlatformOverviewResponseDto> {
    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        subscriptions: {
          include: {
            plan: true
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

    const [
      roleCount,
      runningRoleCount,
      taskCount,
      completedTaskCount,
      waitingApprovalTaskCount,
      costTotal,
      roles,
      tasks
    ] = await this.prismaService.$transaction([
      this.prismaService.roleInstance.count({
        where: { workspaceId }
      }),
      this.prismaService.roleInstance.count({
        where: { workspaceId, status: 'RUNNING' }
      }),
      this.prismaService.task.count({
        where: { workspaceId }
      }),
      this.prismaService.task.count({
        where: { workspaceId, status: 'COMPLETED' }
      }),
      this.prismaService.task.count({
        where: { workspaceId, status: 'WAITING_APPROVAL' }
      }),
      this.prismaService.costRecord.aggregate({
        where: { workspaceId },
        _sum: {
          totalCost: true
        }
      }),
      this.prismaService.roleInstance.findMany({
        where: { workspaceId },
        include: {
          department: true
        },
        orderBy: {
          installedAt: 'desc'
        },
        take: 10
      }),
      this.prismaService.task.findMany({
        where: { workspaceId },
        include: {
          roleInstance: true
        },
        orderBy: {
          updatedAt: 'desc'
        },
        take: 10
      })
    ]);

    const subscription = workspace.subscriptions[0];
    const totalCost = Number(costTotal._sum.totalCost ?? 0);

    return {
      workspace: {
        id: workspace.id,
        tenantId: workspace.tenantId,
        workspaceType: workspace.type === 'ENTERPRISE' ? 'enterprise' : 'personal',
        name: workspace.name,
        ownerAccountId: workspace.ownerAccountId,
        status: this.toWorkspaceStatus(workspace.status),
        planCode: subscription?.plan.code ?? 'PERSONAL_FREE'
      },
      metrics: [
        {
          key: 'roles',
          title: 'AI 岗位',
          value: String(roleCount),
          trend: `${runningRoleCount} 个运行中`
        },
        {
          key: 'tasks',
          title: '任务总数',
          value: String(taskCount),
          trend: `${completedTaskCount} 个已完成`
        },
        {
          key: 'approvals',
          title: '待审批',
          value: String(waitingApprovalTaskCount),
          trend: '来自真实任务状态'
        },
        {
          key: 'cost',
          title: '累计成本',
          value: `¥${totalCost.toFixed(2)}`,
          trend: '来自真实成本记录'
        }
      ],
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        departmentName: role.department?.name,
        status: this.toRoleStatus(role.status)
      })),
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        roleName: task.roleInstance.name,
        state: this.toDatabaseOverviewTaskState(task.status)
      }))
    };
  }

  private toWorkspaceStatus(value: string): 'active' | 'suspended' | 'archived' {
    switch (value) {
      case 'SUSPENDED':
        return 'suspended';
      case 'ARCHIVED':
        return 'archived';
      default:
        return 'active';
    }
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

  private toDatabaseOverviewTaskState(value: string): 'completed' | 'running' | 'waiting_approval' | 'failed' {
    switch (value) {
      case 'COMPLETED':
        return 'completed';
      case 'WAITING_APPROVAL':
        return 'waiting_approval';
      case 'FAILED':
      case 'CANCELLED':
        return 'failed';
      default:
        return 'running';
    }
  }
}
