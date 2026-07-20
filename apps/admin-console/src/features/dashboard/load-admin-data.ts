import type { CurrentAccountResponse, KernelStatusResponse, PlanDetail } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { fallbackCurrentAccount, fallbackKernelStatus, fallbackPlans } from './fallback-data';

export interface AdminDashboardData {
  currentAccount: CurrentAccountResponse;
  kernelStatus: KernelStatusResponse;
  plans: PlanDetail[];
  isApiFallback: boolean;
}

export async function loadAdminDashboardData(): Promise<AdminDashboardData> {
  const apiClient = await createServerApiClient();

  try {
    const [currentAccount, kernelStatus, plans] = await Promise.all([
      apiClient.getCurrentAccount(),
      apiClient.getKernelStatus(),
      apiClient.listPlans()
    ]);

    return {
      currentAccount,
      kernelStatus,
      plans: plans.data,
      isApiFallback: false
    };
  } catch {
    return {
      currentAccount: fallbackCurrentAccount,
      kernelStatus: fallbackKernelStatus,
      plans: fallbackPlans,
      isApiFallback: true
    };
  }
}
