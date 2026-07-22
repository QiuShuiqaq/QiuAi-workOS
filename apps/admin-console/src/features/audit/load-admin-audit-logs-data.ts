import type { AdminActionLogSummary, CurrentAccountResponse, PaginationMeta } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminAuditLogsPageData {
  currentAccount: CurrentAccountResponse;
  actionLogs: AdminActionLogSummary[];
  pagination: PaginationMeta;
}

export async function loadAdminAuditLogsPageData(): Promise<AdminAuditLogsPageData> {
  const { currentAccount } = await loadAdminSession('/audit');
  const apiClient = await createServerApiClient();
  const logs = await apiClient.listAdminActionLogs({
    page: 1,
    pageSize: 20
  });

  return {
    currentAccount,
    actionLogs: logs.data,
    pagination: logs.pagination
  };
}
