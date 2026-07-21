import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import { MockPlatformStore, type MockCreateTaskRequest } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { EntitlementService } from '../entitlement/entitlement.service';

type DatabaseTask = {
  id: string;
  workspaceId: string;
  roleInstanceId: string;
  title: string;
  taskType: string;
  status: string;
  priority: string;
  input: string;
  createdAt: Date;
  updatedAt: Date;
  roleInstance: {
    name: string;
  };
  artifacts: Array<{
    id: string;
    type: string;
    title: string;
    content: string;
    createdAt: Date;
  }>;
  logs: Array<{
    id: string;
    level: string;
    eventType: string;
    message: string;
    createdAt: Date;
  }>;
  costRecords: Array<{
    id: string;
    provider: string;
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    totalCost: unknown;
    currency: string;
    createdAt: Date;
  }>;
  runs: Array<{
    id: string;
    taskId: string;
    status: string;
    startedAt: Date | null;
    finishedAt: Date | null;
  }>;
};

@Injectable()
export class TaskService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService
  ) {}

  async listTasks(workspaceId: string) {
    if (!isDatabasePersistenceEnabled()) {
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

    const tasks = await this.prismaService.task.findMany({
      where: {
        workspaceId
      },
      include: this.taskInclude(),
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return {
      data: tasks.map((task) => this.toTaskSummary(task))
    };
  }

  async getTask(workspaceId: string, taskId: string) {
    if (!isDatabasePersistenceEnabled()) {
      const task = this.store.getTask(workspaceId, taskId);
      return task ? { data: task } : undefined;
    }

    const task = await this.prismaService.task.findFirst({
      where: {
        id: taskId,
        workspaceId
      },
      include: this.taskInclude()
    });

    return task ? { data: this.toTaskDetail(task) } : undefined;
  }

  async createTask(workspaceId: string, input: MockCreateTaskRequest) {
    if (!isDatabasePersistenceEnabled()) {
      const task = this.store.createTask(workspaceId, input);
      return task ? { data: task } : undefined;
    }

    const title = input.title.trim();
    const taskInput = input.input.trim();
    const taskType = input.taskType.trim();

    if (!title || !taskInput || !taskType) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Task title, type, and input are required.'
        }
      });
    }

    const role = await this.prismaService.roleInstance.findFirst({
      where: {
        id: input.roleInstanceId,
        workspaceId
      }
    });
    if (!role) {
      return undefined;
    }

    const currentMonthStart = this.currentMonthStart();
    const existingTaskCount = await this.prismaService.task.count({
      where: {
        workspaceId,
        createdAt: {
          gte: currentMonthStart
        }
      }
    });
    await this.entitlementService.requireAllowed(
      {
        workspaceId,
        featureKey: 'maxTasksPerMonth',
        requestedAmount: existingTaskCount + 1
      },
      'Monthly task quota requires a higher plan.'
    );

    const task = await this.prismaService.task.create({
      data: {
        workspaceId,
        roleInstanceId: role.id,
        title,
        taskType,
        input: taskInput,
        priority: this.toDatabasePriority(input.priority ?? 'normal'),
        status: 'QUEUED',
        runs: {
          create: {
            status: 'QUEUED'
          }
        },
        logs: {
          create: {
            level: 'INFO',
            eventType: 'TASK_CREATED',
            message: `${role.name} received task: ${title}`
          }
        }
      },
      include: this.taskInclude()
    });

    await this.upsertTaskUsage(workspaceId);

    return {
      data: this.toTaskDetail(task)
    };
  }

  async runTask(workspaceId: string, taskId: string) {
    if (!isDatabasePersistenceEnabled()) {
      const task = this.store.runTask(workspaceId, taskId);
      return task ? { data: task } : undefined;
    }

    const task = await this.prismaService.task.findFirst({
      where: {
        id: taskId,
        workspaceId
      },
      include: {
        runs: {
          where: {
            status: {
              in: ['QUEUED', 'RUNNING']
            }
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    if (!task) {
      return undefined;
    }

    const updatedTask = await this.prismaService.task.update({
      where: {
        id: task.id
      },
      data: {
        status: 'QUEUED',
        logs: {
          create: {
            level: 'WARNING',
            eventType: 'EXECUTION_RUNTIME_NOT_CONNECTED',
            message: 'Execution request was recorded, but no execution worker is connected yet.'
          }
        },
        ...(task.runs.length
          ? {}
          : {
              runs: {
                create: {
                  status: 'QUEUED'
                }
              }
            })
      },
      include: this.taskInclude()
    });

    return {
      data: this.toTaskDetail(updatedTask)
    };
  }

  private taskInclude() {
    return {
      roleInstance: true,
      artifacts: {
        orderBy: {
          createdAt: 'asc'
        }
      },
      logs: {
        orderBy: {
          createdAt: 'asc'
        }
      },
      costRecords: {
        orderBy: {
          createdAt: 'asc'
        }
      },
      runs: {
        orderBy: {
          createdAt: 'desc'
        }
      }
    } as const;
  }

  private async upsertTaskUsage(workspaceId: string) {
    const usedValue = await this.prismaService.task.count({
      where: {
        workspaceId,
        createdAt: {
          gte: this.currentMonthStart()
        }
      }
    });

    await this.prismaService.usageMeter.upsert({
      where: {
        workspaceId_metricKey_period: {
          workspaceId,
          metricKey: 'tasks.monthlyCount',
          period: this.currentMonthPeriod()
        }
      },
      update: {
        usedValue
      },
      create: {
        workspaceId,
        metricKey: 'tasks.monthlyCount',
        period: this.currentMonthPeriod(),
        usedValue
      }
    });
  }

  private toTaskSummary(task: DatabaseTask) {
    return {
      id: task.id,
      workspaceId: task.workspaceId,
      roleInstanceId: task.roleInstanceId,
      roleName: task.roleInstance.name,
      title: task.title,
      taskType: task.taskType,
      status: this.toTaskStatus(task.status),
      priority: this.toTaskPriority(task.priority),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString()
    };
  }

  private toTaskDetail(task: DatabaseTask) {
    const currentRun = task.runs[0];

    return {
      ...this.toTaskSummary(task),
      input: task.input,
      artifacts: task.artifacts.map((artifact) => ({
        id: artifact.id,
        type: this.toArtifactType(artifact.type),
        title: artifact.title,
        content: artifact.content,
        createdAt: artifact.createdAt.toISOString()
      })),
      executionLogs: task.logs.map((log) => ({
        id: log.id,
        level: this.toLogLevel(log.level),
        eventType: log.eventType,
        message: log.message,
        createdAt: log.createdAt.toISOString()
      })),
      costRecords: task.costRecords.map((record) => ({
        id: record.id,
        provider: record.provider,
        modelName: record.modelName,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalCost: Number(record.totalCost),
        currency: record.currency,
        createdAt: record.createdAt.toISOString()
      })),
      currentRun: currentRun
        ? {
            id: currentRun.id,
            taskId: currentRun.taskId,
            status: this.toRunStatus(currentRun.status),
            startedAt: currentRun.startedAt?.toISOString(),
            finishedAt: currentRun.finishedAt?.toISOString()
          }
        : undefined
    };
  }

  private toDatabasePriority(priority: MockCreateTaskRequest['priority']) {
    switch (priority) {
      case 'low':
        return 'LOW';
      case 'high':
        return 'HIGH';
      case 'urgent':
        return 'URGENT';
      default:
        return 'NORMAL';
    }
  }

  private toTaskStatus(value: string): 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled' {
    switch (value) {
      case 'RUNNING':
        return 'running';
      case 'WAITING_APPROVAL':
        return 'waiting_approval';
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'queued';
    }
  }

  private toTaskPriority(value: string): 'low' | 'normal' | 'high' | 'urgent' {
    switch (value) {
      case 'LOW':
        return 'low';
      case 'HIGH':
        return 'high';
      case 'URGENT':
        return 'urgent';
      default:
        return 'normal';
    }
  }

  private toRunStatus(value: string): 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' {
    switch (value) {
      case 'RUNNING':
        return 'running';
      case 'COMPLETED':
        return 'completed';
      case 'FAILED':
        return 'failed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'queued';
    }
  }

  private toArtifactType(value: string): 'text' | 'report' | 'video' | 'image' | 'file' {
    switch (value) {
      case 'REPORT':
        return 'report';
      case 'VIDEO':
        return 'video';
      case 'IMAGE':
        return 'image';
      case 'FILE':
        return 'file';
      default:
        return 'text';
    }
  }

  private toLogLevel(value: string): 'info' | 'warning' | 'error' {
    switch (value) {
      case 'WARNING':
        return 'warning';
      case 'ERROR':
        return 'error';
      default:
        return 'info';
    }
  }

  private currentMonthStart() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private currentMonthPeriod() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}
