import type { CurrentAccountResponse, DesktopIssueMessageSummary, PaginationMeta } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminIssueMessagesPageData {
  currentAccount: CurrentAccountResponse;
  issueMessages: DesktopIssueMessageSummary[];
  pagination: PaginationMeta;
}

export async function loadAdminIssueMessagesPageData(): Promise<AdminIssueMessagesPageData> {
  const { currentAccount } = await loadAdminSession('/issue-messages');
  const apiClient = await createServerApiClient();
  const response = await apiClient.listAdminIssueMessages({
    page: 1,
    pageSize: 50
  });

  return {
    currentAccount,
    issueMessages: response.data,
    pagination: response.pagination
  };
}
