import type { CurrentAccountResponse, ListPlansResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadCurrentAccount } from '../common/load-current-account';
import { fallbackPlans } from './fallback-data';

export interface SettingsPageData {
  currentAccount: CurrentAccountResponse;
  plans: ListPlansResponse;
  isApiFallback: boolean;
}

export async function loadSettingsPageData(): Promise<SettingsPageData> {
  const currentAccount = await loadCurrentAccount();

  try {
    const plans = await createServerApiClient().listPlans();
    return { currentAccount, plans, isApiFallback: false };
  } catch {
    return { currentAccount, plans: fallbackPlans, isApiFallback: true };
  }
}
