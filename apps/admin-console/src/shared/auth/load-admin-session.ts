import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { redirect } from 'next/navigation';

import { createServerApiClient } from '../api/server-api';
import { isAdminOperatorEmail } from './admin-operator';

export async function loadAdminSession(nextPath: string): Promise<{
  currentAccount: CurrentAccountResponse;
  isAdminOperator: boolean;
}> {
  let session;

  try {
    session = await (await createServerApiClient()).getAuthSession();
  } catch {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!session.authenticated || !session.account || !session.workspaces || !session.activeWorkspaceId) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  const currentAccount: CurrentAccountResponse = {
    account: session.account,
    workspaces: session.workspaces,
    activeWorkspaceId: session.activeWorkspaceId
  };

  return {
    currentAccount,
    isAdminOperator: isAdminOperatorEmail(session.account.primaryEmail)
  };
}
