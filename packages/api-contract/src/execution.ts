export interface ArtifactSummary {
  id: string;
  type: 'text' | 'report' | 'video' | 'image' | 'file';
  title: string;
  content: string;
  createdAt: string;
}

export interface ExecutionLogEntry {
  id: string;
  level: 'info' | 'warning' | 'error';
  eventType: string;
  message: string;
  createdAt: string;
}

export interface CostRecordSummary {
  id: string;
  provider: string;
  modelName: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  currency: string;
  createdAt: string;
}

export interface ExecutionRunSummary {
  id: string;
  taskId: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
}
