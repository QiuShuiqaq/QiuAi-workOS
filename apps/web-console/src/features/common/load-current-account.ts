import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { QiuApiError } from '@qiuai/api-client';
import { redirect } from 'next/navigation';

import { createServerApiClient } from '../../shared/api/server-api';
import { fallbackCurrentAccount } from '../dashboard/fallback-data';

export async function loadCurrentAccount(): Promise<CurrentAccountResponse> {
  try {
    return await (await createServerApiClient()).getCurrentAccount();
  } catch (error) {
    if (
      process.env.WORKOS_PERSISTENCE_MODE === 'database' &&
      error instanceof QiuApiError &&
      error.status === 401
    ) {
      redirect('/login');
    }

    return fallbackCurrentAccount;
  }
}
