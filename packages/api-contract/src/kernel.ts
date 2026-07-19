import type { PlanSummary } from './commercial';

export interface KernelStatusResponse {
  status: 'ready';
  dataModelVersion: string;
  databaseProvider: string;
  persistenceMode?: 'mock' | 'database';
  databaseReady?: boolean;
  prismaClientVersion: string;
  plans: PlanSummary[];
  databasePlanCount?: number;
  databaseTenantCount?: number;
  databaseWorkspaceCount?: number;
}
