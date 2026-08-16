import type {
  BillingOrderSummary,
  CreateBillingOrderRequest
} from '@qiuai/api-contract/billing';

import { createBillingOrder } from '../shared/desktop-sync-client.js';
import { getDesktopAppInfo } from './runtime-state.js';
import { loadRuntimeIdentity } from './runtime-store.js';

export async function createDesktopBillingOrder(
  request: CreateBillingOrderRequest
): Promise<BillingOrderSummary> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  if (!identity.deviceToken || !identity.workspaceId || identity.workspaceId === 'workspace_pending_login') {
    throw new Error('请先登录或绑定账号后再购买。');
  }

  const response = await createBillingOrder(
    appInfo.serverBaseUrl,
    identity.workspaceId,
    identity.deviceToken,
    request
  );

  return response.data;
}
