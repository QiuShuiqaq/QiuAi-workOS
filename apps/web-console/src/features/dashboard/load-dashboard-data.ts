import type { CurrentAccountResponse, PlatformOverviewResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackCurrentAccount, fallbackOverview } from './fallback-data';

export interface DashboardData {
  currentAccount: CurrentAccountResponse;
  overview: PlatformOverviewResponse;
  isApiFallback: boolean;
}

export async function loadDashboardData(requestedWorkspaceId?: string): Promise<DashboardData> {
  const apiClient = await createServerApiClient();

  try {
    const currentAccount = await apiClient.getCurrentAccount();
    const activeWorkspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);
    const overview = await apiClient.getPlatformOverview(activeWorkspaceId);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId
      },
      overview,
      isApiFallback: false
    };
  } catch {
    const activeWorkspaceId = resolveWorkspaceId(fallbackCurrentAccount, requestedWorkspaceId);
    return {
      currentAccount: {
        ...fallbackCurrentAccount,
        activeWorkspaceId
      },
      overview: fallbackOverview,
      isApiFallback: true
    };
  }
}
