import type { AdminOfficialModelRouteSummary, CurrentAccountResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminOfficialRoutesPageData {
  currentAccount: CurrentAccountResponse;
  routes: AdminOfficialModelRouteSummary[];
}

export async function loadAdminOfficialRoutesPageData(): Promise<AdminOfficialRoutesPageData> {
  const { currentAccount } = await loadAdminSession('/official-routes');
  const apiClient = await createServerApiClient();
  const routes = await apiClient.listAdminOfficialModelRoutes();

  return {
    currentAccount,
    routes: routes.data
  };
}
