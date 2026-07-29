import type { AssetDefinitionDetail, CurrentAccountResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminAssetsPageData {
  currentAccount: CurrentAccountResponse;
  assets: AssetDefinitionDetail[];
}

export async function loadAdminAssetsPageData(): Promise<AdminAssetsPageData> {
  const { currentAccount } = await loadAdminSession('/assets');
  const apiClient = await createServerApiClient();
  const assets = await apiClient.listAdminAssets();

  return {
    currentAccount,
    assets: assets.data
  };
}
