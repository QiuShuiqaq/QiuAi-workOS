import type {
  CurrentAccountResponse,
  GetBillingOverviewResponse,
  ListPlansResponse
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { createFallbackBillingOverview, fallbackPlans } from '../settings/fallback-data';

export interface PurchasePageData {
  currentAccount: CurrentAccountResponse;
  plans: ListPlansResponse;
  billing: GetBillingOverviewResponse;
  isApiFallback: boolean;
}

export async function loadPurchasePageData(requestedWorkspaceId?: string): Promise<PurchasePageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const apiClient = await createServerApiClient();
    const [plans, billing] = await Promise.all([
      apiClient.listPlans(),
      apiClient.getBillingOverview(workspaceId)
    ]);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      plans,
      billing,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      plans: fallbackPlans,
      billing: createFallbackBillingOverview(workspaceId),
      isApiFallback: true
    };
  }
}
