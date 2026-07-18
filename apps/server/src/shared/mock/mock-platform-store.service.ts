import { Injectable } from '@nestjs/common';

import {
  demoRoleTemplates,
  demoRoles,
  demoTasks,
  demoWorkspaces,
  type MockRoleInstanceDetail,
  type MockRoleTemplateSummary,
  type MockTaskDetail
} from './platform-seed';

export interface MockCreateTaskRequest {
  roleInstanceId: string;
  title: string;
  taskType: string;
  input: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

@Injectable()
export class MockPlatformStore {
  private readonly roleTemplates: MockRoleTemplateSummary[] = [...demoRoleTemplates];
  private readonly roles: MockRoleInstanceDetail[] = demoRoles.map((role) => ({ ...role }));
  private readonly tasks: MockTaskDetail[] = demoTasks.map((task) => ({ ...task }));

  listRoleTemplates(): MockRoleTemplateSummary[] {
    return this.roleTemplates;
  }

  listRoles(workspaceId: string): MockRoleInstanceDetail[] {
    return this.roles.filter((role) => role.workspaceId === workspaceId);
  }

  getRole(workspaceId: string, roleId: string): MockRoleInstanceDetail | undefined {
    return this.roles.find((role) => role.workspaceId === workspaceId && role.id === roleId);
  }

  installRole(workspaceId: string, input: { templateId: string; name?: string; departmentName?: string }) {
    const template = this.roleTemplates.find((item) => item.id === input.templateId);
    if (!template) {
      return undefined;
    }

    const now = new Date().toISOString();
    const role = {
      id: `role_${Date.now()}`,
      templateId: template.id,
      workspaceId,
      name: input.name || template.name,
      departmentName: input.departmentName || '未分配部门',
      ownerName: '企业管理员',
      status: 'configuration_required' as const,
      installedAt: now,
      businessGoal: template.description,
      knowledgeSources: ['待配置企业知识'],
      tools: ['待配置工具'],
      approvalPolicy: '默认人工确认策略',
      recentTaskIds: [],
      kpis: {
        taskCompleted: 0,
        automationRate: 0,
        avgDurationMinutes: 0,
        monthlyCost: 0
      }
    };

    this.roles.unshift(role);
    return role;
  }

  listTasks(workspaceId: string): MockTaskDetail[] {
    return this.tasks.filter((task) => task.workspaceId === workspaceId);
  }

  getTask(workspaceId: string, taskId: string): MockTaskDetail | undefined {
    return this.tasks.find((task) => task.workspaceId === workspaceId && task.id === taskId);
  }

  createTask(workspaceId: string, input: MockCreateTaskRequest): MockTaskDetail | undefined {
    const role = this.getRole(workspaceId, input.roleInstanceId);
    if (!role) {
      return undefined;
    }

    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}`;
    const task = {
      id: taskId,
      workspaceId,
      roleInstanceId: role.id,
      roleName: role.name,
      title: input.title,
      taskType: input.taskType,
      status: 'queued' as const,
      priority: input.priority || 'normal',
      input: input.input,
      createdAt: now,
      updatedAt: now,
      artifacts: [],
      executionLogs: [
        {
          id: `log_${Date.now()}_created`,
          level: 'info' as const,
          eventType: 'TASK_CREATED',
          message: `${role.name} 已收到任务：${input.title}`,
          createdAt: now
        }
      ],
      costRecords: [],
      currentRun: {
        id: `run_${Date.now()}`,
        taskId,
        status: 'queued' as const
      }
    };

    this.tasks.unshift(task);
    role.recentTaskIds.unshift(task.id);
    return task;
  }

  runTask(workspaceId: string, taskId: string): MockTaskDetail | undefined {
    const task = this.getTask(workspaceId, taskId);
    if (!task) {
      return undefined;
    }

    const now = new Date().toISOString();
    task.status = 'completed';
    task.updatedAt = now;
    task.currentRun = {
      id: task.currentRun?.id || `run_${Date.now()}`,
      taskId,
      status: 'completed',
      startedAt: task.currentRun?.startedAt || now,
      finishedAt: now
    };
    task.executionLogs.push({
      id: `log_${Date.now()}_run`,
      level: 'info',
      eventType: 'MOCK_EXECUTION_COMPLETED',
      message: 'Mock Execution Runtime 已完成任务，并生成产物、日志和成本记录。',
      createdAt: now
    });
    task.artifacts.push({
      id: `artifact_${Date.now()}`,
      type: 'report',
      title: `${task.title} - 执行结果`,
      content: `任务「${task.title}」已由 ${task.roleName} 完成。输入内容已被整理为可交付结果，下一步可进入人工验收或发布。`,
      createdAt: now
    });
    task.costRecords.push({
      id: `cost_${Date.now()}`,
      provider: 'mock',
      modelName: 'mock-runtime-v1',
      inputTokens: 3200,
      outputTokens: 900,
      totalCost: 2.6,
      currency: 'CNY',
      createdAt: now
    });

    return task;
  }

  workspaceExists(workspaceId: string): boolean {
    return demoWorkspaces.some((workspace) => workspace.id === workspaceId);
  }
}
