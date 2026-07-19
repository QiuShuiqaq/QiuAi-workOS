import type { CurrentAccountResponse, EnterpriseWorkspaceOverview } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { buildFallbackEnterpriseOverview } from './fallback-data';

export interface EnterprisePageData {
  currentAccount: CurrentAccountResponse;
  overview: EnterpriseWorkspaceOverview;
  isApiFallback: boolean;
}

export async function loadEnterprisePageData(requestedWorkspaceId?: string): Promise<EnterprisePageData> {
  const currentAccount = await loadCurrentAccount();
  const activeWorkspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const response = await (await createServerApiClient()).getEnterpriseWorkspaceOverview(activeWorkspaceId);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId
      },
      overview: response.data,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId
      },
      overview: buildFallbackEnterpriseOverview(activeWorkspaceId),
      isApiFallback: true
    };
  }
}
