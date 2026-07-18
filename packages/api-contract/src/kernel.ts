import type { PlanSummary } from './commercial';

export interface KernelStatusResponse {
  status: 'ready';
  dataModelVersion: string;
  databaseProvider: string;
  prismaClientVersion: string;
  plans: PlanSummary[];
}
