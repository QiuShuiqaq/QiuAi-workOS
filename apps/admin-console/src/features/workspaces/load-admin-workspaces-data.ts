import type { AdminPlanDetail, AdminWorkspaceSummary, CurrentAccountResponse, PaginationMeta } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminWorkspacesPageData {
  currentAccount: CurrentAccountResponse;
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  pagination: PaginationMeta;
}

export async function loadAdminWorkspacesPageData(): Promise<AdminWorkspacesPageData> {
  const { currentAccount } = await loadAdminSession('/workspaces');
  const apiClient = await createServerApiClient();
  const [plans, workspaces] = await Promise.all([
    apiClient.listAdminPlans(),
    apiClient.listAdminWorkspaces({ page: 1, pageSize: 20 })
  ]);

  return {
    currentAccount,
    plans: plans.data,
    workspaces: workspaces.data,
    pagination: workspaces.pagination
  };
}
