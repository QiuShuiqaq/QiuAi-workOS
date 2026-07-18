import type { CurrentAccountResponse, PlatformOverviewResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { fallbackCurrentAccount, fallbackOverview } from './fallback-data';

export interface DashboardData {
  currentAccount: CurrentAccountResponse;
  overview: PlatformOverviewResponse;
  isApiFallback: boolean;
}

export async function loadDashboardData(): Promise<DashboardData> {
  const apiClient = createServerApiClient();

  try {
    const currentAccount = await apiClient.getCurrentAccount();
    const activeWorkspaceId = currentAccount.activeWorkspaceId;
    const overview = await apiClient.getPlatformOverview(activeWorkspaceId);

    return {
      currentAccount,
      overview,
      isApiFallback: false
    };
  } catch {
    return {
      currentAccount: fallbackCurrentAccount,
      overview: fallbackOverview,
      isApiFallback: true
    };
  }
}
