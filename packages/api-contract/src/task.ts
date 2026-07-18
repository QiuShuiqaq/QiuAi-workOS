import type {
  ArtifactSummary,
  CostRecordSummary,
  ExecutionLogEntry,
  ExecutionRunSummary
} from './execution';

export interface TaskSummary {
  id: string;
  workspaceId: string;
  roleInstanceId: string;
  roleName: string;
  title: string;
  taskType: string;
  status: 'queued' | 'running' | 'waiting_approval' | 'completed' | 'failed' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  createdAt: string;
  updatedAt: string;
}

export interface TaskDetail extends TaskSummary {
  input: string;
  artifacts: ArtifactSummary[];
  executionLogs: ExecutionLogEntry[];
  costRecords: CostRecordSummary[];
  currentRun?: ExecutionRunSummary;
}

export interface ListTasksResponse {
  data: TaskSummary[];
}

export interface GetTaskResponse {
  data: TaskDetail;
}

export interface CreateTaskRequest {
  roleInstanceId: string;
  title: string;
  taskType: string;
  input: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}

export interface CreateTaskResponse {
  data: TaskDetail;
}

export interface RunTaskResponse {
  data: TaskDetail;
}
