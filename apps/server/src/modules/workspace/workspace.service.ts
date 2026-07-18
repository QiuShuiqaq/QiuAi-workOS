import { Injectable, NotFoundException } from '@nestjs/common';

import {
  demoAccount,
  demoWorkspaces
} from '../../shared/mock/platform-seed';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { CurrentAccountResponseDto } from './dto/current-account-response.dto';
import { PlatformOverviewResponseDto } from './dto/platform-overview-response.dto';

@Injectable()
export class WorkspaceService {
  constructor(private readonly store: MockPlatformStore) {}

  getCurrentAccount(): CurrentAccountResponseDto {
    return {
      account: demoAccount,
      workspaces: demoWorkspaces,
      activeWorkspaceId: 'enterprise'
    };
  }

  getOverview(workspaceId: string): PlatformOverviewResponseDto {
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
}
