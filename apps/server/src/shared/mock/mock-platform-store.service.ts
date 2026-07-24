import { Injectable } from '@nestjs/common';

import {
  demoRoleTemplates,
  demoRoles,
  demoPlans,
  demoTasks,
  demoWorkspaces,
  type MockRoleInstanceDetail,
  type MockRoleTemplateSummary,
  type MockTaskDetail
} from './platform-seed';
import {
  demoDepartments,
  demoInvitations,
  demoMembers,
  demoOrganizations,
  demoSubscriptions,
  type MockDepartmentSummary,
  type MockInvitationSummary,
  type MockMemberSummary,
  type MockOrganizationSummary,
  type MockSubscriptionSummary
} from './enterprise-seed';

export interface MockCreateTaskRequest {
  roleInstanceId: string;
  title: string;
  taskType: string;
  input: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface MockDesktopRuntimeSyncSummary {
  runtimeId: string;
  workspaceId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  runtimeSnapshot: Record<string, unknown>;
  syncedAt: string;
}

@Injectable()
export class MockPlatformStore {
  private readonly roleTemplates: MockRoleTemplateSummary[] = [...demoRoleTemplates];
  private readonly roles: MockRoleInstanceDetail[] = demoRoles.map((role) => ({ ...role }));
  private readonly tasks: MockTaskDetail[] = demoTasks.map((task) => ({ ...task }));
  private readonly organizations: MockOrganizationSummary[] = demoOrganizations.map((item) => ({ ...item }));
  private readonly departments: MockDepartmentSummary[] = demoDepartments.map((item) => ({ ...item }));
  private readonly invitations: MockInvitationSummary[] = demoInvitations.map((item) => ({ ...item }));
  private readonly members: MockMemberSummary[] = demoMembers.map((item) => ({ ...item }));
  private readonly subscriptions: MockSubscriptionSummary[] = demoSubscriptions.map((item) => ({ ...item }));
  private readonly desktopRuntimeSyncs: MockDesktopRuntimeSyncSummary[] = [];

  listRoleTemplates(): MockRoleTemplateSummary[] {
    return this.roleTemplates;
  }

  getRoleTemplate(templateId: string) {
    return this.roleTemplates.find((template) => template.id === templateId);
  }

  createRoleTemplate(
    input: Omit<MockRoleTemplateSummary, 'createdAt' | 'updatedAt'> & {
      createdAt?: string;
      updatedAt?: string;
    }
  ) {
    if (this.getRoleTemplate(input.id)) {
      return undefined;
    }

    const now = new Date().toISOString();
    const template: MockRoleTemplateSummary = {
      ...input,
      createdAt: input.createdAt ?? now,
      updatedAt: input.updatedAt ?? now
    };
    this.roleTemplates.unshift(template);
    return template;
  }

  updateRoleTemplate(
    templateId: string,
    input: Partial<MockRoleTemplateSummary>
  ) {
    const template = this.getRoleTemplate(templateId);
    if (!template) {
      return undefined;
    }

    Object.assign(template, input, {
      updatedAt: new Date().toISOString()
    });
    return template;
  }

  getWorkspace(workspaceId: string) {
    return demoWorkspaces.find((workspace) => workspace.id === workspaceId);
  }

  getPlan(workspaceId: string) {
    const workspace = this.getWorkspace(workspaceId);
    if (!workspace) {
      return undefined;
    }
    return demoPlans.find((plan) => plan.code === workspace.planCode);
  }

  getOrganization(workspaceId: string) {
    return this.organizations.find((organization) => organization.workspaceId === workspaceId);
  }

  getSubscription(workspaceId: string) {
    return this.subscriptions.find((subscription) => subscription.workspaceId === workspaceId);
  }

  listDepartments(workspaceId: string) {
    const organization = this.getOrganization(workspaceId);
    if (!organization) {
      return [];
    }
    return this.departments.filter((department) => department.organizationId === organization.id);
  }

  listMembers(workspaceId: string) {
    return this.members.filter((member) => member.workspaceId === workspaceId);
  }

  getMember(workspaceId: string, memberId: string) {
    return this.listMembers(workspaceId).find((member) => member.id === memberId);
  }

  getDepartment(workspaceId: string, departmentId: string) {
    const organization = this.getOrganization(workspaceId);
    if (!organization) {
      return undefined;
    }
    return this.departments.find(
      (department) => department.organizationId === organization.id && department.id === departmentId
    );
  }

  listInvitations(workspaceId: string) {
    return this.invitations.filter((invitation) => invitation.workspaceId === workspaceId);
  }

  getInvitationByToken(invitationId: string) {
    return this.invitations.find((invitation) => invitation.id === invitationId);
  }

  createInvitation(
    workspaceId: string,
    input: {
      email: string;
      systemRole: 'admin' | 'member' | 'viewer';
      departmentId?: string;
      expiresInDays: number;
    }
  ) {
    const organization = this.getOrganization(workspaceId);
    if (!organization) {
      return undefined;
    }

    const department = input.departmentId ? this.getDepartment(workspaceId, input.departmentId) : undefined;
    const now = new Date().toISOString();
    const invitation = {
      id: `invite_${Date.now()}`,
      workspaceId,
      email: input.email.trim().toLowerCase(),
      systemRole: input.systemRole,
      departmentId: department?.id,
      departmentName: department?.name,
      status: 'pending' as const,
      expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now
    };

    this.invitations.unshift(invitation);
    return invitation;
  }

  cancelInvitation(workspaceId: string, invitationId: string) {
    const invitation = this.invitations.find(
      (item) => item.workspaceId === workspaceId && item.id === invitationId
    );

    if (!invitation) {
      return undefined;
    }

    invitation.status = 'cancelled';
    return invitation;
  }

  acceptInvitationByToken(invitationId: string) {
    const invitation = this.getInvitationByToken(invitationId);
    if (!invitation) {
      return undefined;
    }

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date().toISOString();
    return invitation;
  }

  createDepartment(
    workspaceId: string,
    input: { name: string; parentDepartmentId?: string; ownerUserId?: string }
  ) {
    const organization = this.getOrganization(workspaceId);
    if (!organization) {
      return undefined;
    }

    const now = new Date().toISOString();
    const department = {
      id: `dept_${Date.now()}`,
      organizationId: organization.id,
      parentDepartmentId: input.parentDepartmentId,
      name: input.name.trim(),
      ownerUserId: input.ownerUserId,
      createdAt: now
    };

    this.departments.unshift(department);
    return department;
  }

  hasEntitlement(workspaceId: string, featureKey: string) {
    const plan = this.getPlan(workspaceId);
    return plan?.entitlements.find((item) => item.featureKey === featureKey);
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
      templateVersion: template.version,
      workspaceId,
      name: input.name || template.name,
      departmentName: input.departmentName || '未分配部门',
      ownerName: '企业管理者',
      status: 'configuration_required' as const,
      installedAt: now,
      skills: template.skills.map((skill) => ({ ...skill })),
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

  upsertDesktopRuntimeSync(input: MockDesktopRuntimeSyncSummary) {
    const existingIndex = this.desktopRuntimeSyncs.findIndex(
      (sync) => sync.runtimeId === input.runtimeId
    );
    const record = { ...input };

    if (existingIndex >= 0) {
      this.desktopRuntimeSyncs[existingIndex] = record;
      return record;
    }

    this.desktopRuntimeSyncs.unshift(record);
    return record;
  }

  listDesktopRuntimeSyncs(workspaceId: string) {
    return this.desktopRuntimeSyncs.filter((sync) => sync.workspaceId === workspaceId);
  }

  getDesktopRuntimeSync(runtimeId: string) {
    return this.desktopRuntimeSyncs.find((sync) => sync.runtimeId === runtimeId);
  }
}
