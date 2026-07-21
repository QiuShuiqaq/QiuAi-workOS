import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service';
import { CreateTaskRequestDto } from './dto/create-task-request.dto';
import { TaskService } from './task.service';

@ApiTags('tasks')
@Controller({
  path: 'workspaces/:workspaceId/tasks',
  version: '1'
})
export class TaskController {
  constructor(
    @Inject(TaskService)
    private readonly taskService: TaskService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Get()
  async listTasks(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.taskService.listTasks(workspaceId);
  }

  @Get(':taskId')
  async getTask(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    const task = await this.taskService.getTask(workspaceId, taskId);
    if (!task) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Task was not found.',
          details: { workspaceId, taskId }
        }
      });
    }
    return task;
  }

  @Post()
  async createTask(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateTaskRequestDto,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    const task = await this.taskService.createTask(workspaceId, body);
    if (!task) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Role instance was not found for task creation.',
          details: { workspaceId, roleInstanceId: body.roleInstanceId }
        }
      });
    }
    return task;
  }

  @Post(':taskId/run')
  async runTask(
    @Param('workspaceId') workspaceId: string,
    @Param('taskId') taskId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    const task = await this.taskService.runTask(workspaceId, taskId);
    if (!task) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Task was not found.',
          details: { workspaceId, taskId }
        }
      });
    }
    return task;
  }
}
