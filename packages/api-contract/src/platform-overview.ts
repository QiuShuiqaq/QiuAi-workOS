import type { WorkspaceSummary } from './workspace';

export interface RoleRuntimeSummary {
  id: string;
  name: string;
  departmentName?: string;
  status: 'running' | 'trial' | 'configuration_required' | 'paused';
}

export interface TaskRuntimeSummary {
  id: string;
  title: string;
  roleName: string;
  state: 'completed' | 'running' | 'waiting_approval' | 'failed';
}

export interface PlatformMetricSummary {
  key: string;
  title: string;
  value: string;
  trend?: string;
}

export interface PlatformOverviewResponse {
  workspace: WorkspaceSummary;
  metrics: PlatformMetricSummary[];
  roles: RoleRuntimeSummary[];
  tasks: TaskRuntimeSummary[];
}
