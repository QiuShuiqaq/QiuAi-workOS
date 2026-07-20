import type {
  CurrentAccountResponse,
  EnterpriseWorkspaceOverview,
  WorkspaceInvitationSummary
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { buildFallbackEnterpriseOverview } from './fallback-data';
import { buildFallbackWorkspaceInvitations } from './fallback-invitations';

export interface EnterprisePageData {
  currentAccount: CurrentAccountResponse;
  overview: EnterpriseWorkspaceOverview;
  invitations: WorkspaceInvitationSummary[];
  isApiFallback: boolean;
}

export async function loadEnterprisePageData(requestedWorkspaceId?: string): Promise<EnterprisePageData> {
  const currentAccount = await loadCurrentAccount();
  const activeWorkspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const apiClient = await createServerApiClient();
    const [overviewResponse, invitationsResponse] = await Promise.all([
      apiClient.getEnterpriseWorkspaceOverview(activeWorkspaceId),
      apiClient.listWorkspaceInvitations(activeWorkspaceId)
    ]);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId
      },
      overview: overviewResponse.data,
      invitations: invitationsResponse.data,
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
      invitations: buildFallbackWorkspaceInvitations(activeWorkspaceId),
      isApiFallback: true
    };
  }
}
