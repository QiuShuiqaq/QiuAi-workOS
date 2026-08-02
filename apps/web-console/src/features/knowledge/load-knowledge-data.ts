import type {
  CurrentAccountResponse,
  EnterpriseKnowledgeBaseSummary
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';

export interface KnowledgePageData {
  currentAccount: CurrentAccountResponse;
  knowledgeBase: EnterpriseKnowledgeBaseSummary;
  isApiFallback: boolean;
}

export async function loadKnowledgePageData(requestedWorkspaceId?: string): Promise<KnowledgePageData> {
  const currentAccount = await loadCurrentAccount();
  const activeWorkspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const apiClient = await createServerApiClient();
    const response = await apiClient.getEnterpriseKnowledgeBase(activeWorkspaceId);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId
      },
      knowledgeBase: response.data,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId
      },
      knowledgeBase: buildFallbackKnowledgeBase(activeWorkspaceId),
      isApiFallback: true
    };
  }
}

function buildFallbackKnowledgeBase(workspaceId: string): EnterpriseKnowledgeBaseSummary {
  const now = new Date().toISOString();
  return {
    id: 'fallback-enterprise-knowledge',
    workspaceId,
    scope: 'enterprise',
    name: '企业知识库',
    status: 'active',
    profile: {},
    versions: [],
    createdAt: now,
    updatedAt: now
  };
}
