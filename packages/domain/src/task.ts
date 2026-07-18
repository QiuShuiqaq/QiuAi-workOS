export type TaskStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'waiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface Task {
  id: string;
  workspaceId: string;
  organizationId?: string;
  roleInstanceId: string;
  title: string;
  taskType: string;
  status: TaskStatus;
  priority: TaskPriority;
  requesterUserId?: string;
  dueAt?: string;
  completedAt?: string;
}

export interface Artifact {
  id: string;
  taskId: string;
  type: string;
  title: string;
  contentRef: string;
  createdBy: string;
  createdAt: string;
}
