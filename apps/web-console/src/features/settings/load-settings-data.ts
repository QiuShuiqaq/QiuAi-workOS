import type { CurrentAccountResponse, ListPlansResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackPlans } from './fallback-data';

export interface SettingsPageData {
  currentAccount: CurrentAccountResponse;
  plans: ListPlansResponse;
  isApiFallback: boolean;
}

export async function loadSettingsPageData(requestedWorkspaceId?: string): Promise<SettingsPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const plans = await createServerApiClient().listPlans();
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      plans,
      isApiFallback: false
    };
  } catch {
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      plans: fallbackPlans,
      isApiFallback: true
    };
  }
}
