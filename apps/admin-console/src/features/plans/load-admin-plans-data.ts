import type { AdminPlanDetail, CurrentAccountResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminPlansPageData {
  currentAccount: CurrentAccountResponse;
  plans: AdminPlanDetail[];
}

export async function loadAdminPlansPageData(): Promise<AdminPlansPageData> {
  const { currentAccount } = await loadAdminSession('/plans');
  const apiClient = await createServerApiClient();
  const plans = await apiClient.listAdminPlans();

  return {
    currentAccount,
    plans: plans.data
  };
}
