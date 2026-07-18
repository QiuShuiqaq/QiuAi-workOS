import { Injectable } from '@nestjs/common';

import { MockPlatformStore, type MockCreateTaskRequest } from '../../shared/mock/mock-platform-store.service';

@Injectable()
export class TaskService {
  constructor(private readonly store: MockPlatformStore) {}

  listTasks(workspaceId: string) {
    return {
      data: this.store.listTasks(workspaceId).map((task) => ({
        id: task.id,
        workspaceId: task.workspaceId,
        roleInstanceId: task.roleInstanceId,
        roleName: task.roleName,
        title: task.title,
        taskType: task.taskType,
        status: task.status,
        priority: task.priority,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt
      }))
    };
  }

  getTask(workspaceId: string, taskId: string) {
    const task = this.store.getTask(workspaceId, taskId);
    return task ? { data: task } : undefined;
  }

  createTask(workspaceId: string, input: MockCreateTaskRequest) {
    const task = this.store.createTask(workspaceId, input);
    return task ? { data: task } : undefined;
  }

  runTask(workspaceId: string, taskId: string) {
    const task = this.store.runTask(workspaceId, taskId);
    return task ? { data: task } : undefined;
  }
}
