import type { CurrentAccountResponse, DesktopReleaseSummary } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminDesktopReleasesPageData {
  currentAccount: CurrentAccountResponse;
  releases: DesktopReleaseSummary[];
}

export async function loadAdminDesktopReleasesPageData(): Promise<AdminDesktopReleasesPageData> {
  const { currentAccount } = await loadAdminSession('/desktop-releases');
  const apiClient = await createServerApiClient();
  const releases = await apiClient.listAdminDesktopReleases({
    page: 1,
    pageSize: 100
  });

  return {
    currentAccount,
    releases: releases.data
  };
}
