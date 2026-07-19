import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { QiuApiError } from '@qiuai/api-client';
import { redirect } from 'next/navigation';

import { createServerApiClient } from '../../shared/api/server-api';
import { fallbackCurrentAccount } from '../dashboard/fallback-data';
import { rethrowIfFrontendFallbackDisabled } from './api-fallback';

export async function loadCurrentAccount(): Promise<CurrentAccountResponse> {
  try {
    return await (await createServerApiClient()).getCurrentAccount();
  } catch (error) {
    if (error instanceof QiuApiError && error.status === 401) {
      redirect('/login');
    }

    rethrowIfFrontendFallbackDisabled(error);
    return fallbackCurrentAccount;
  }
}
