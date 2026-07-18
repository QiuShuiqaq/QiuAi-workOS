import type { CurrentAccountResponse } from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { fallbackCurrentAccount } from '../dashboard/fallback-data';

export async function loadCurrentAccount(): Promise<CurrentAccountResponse> {
  try {
    return await createServerApiClient().getCurrentAccount();
  } catch {
    return fallbackCurrentAccount;
  }
}
