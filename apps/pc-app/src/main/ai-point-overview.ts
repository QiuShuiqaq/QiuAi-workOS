import type { DesktopAiPointOverview } from '../shared/desktop-api.js';
import { fetchAiPointOverview } from '../shared/desktop-sync-client.js';
import { getDesktopAppInfo } from './runtime-state.js';
import { loadRuntimeIdentity } from './runtime-store.js';

export async function getDesktopAiPointOverview(): Promise<DesktopAiPointOverview> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  if (!identity.deviceToken || !identity.workspaceId || identity.workspaceId === 'workspace_pending_login') {
    throw new Error('请先绑定企业或个人账号后再查看 AI 点数。');
  }

  const response = await fetchAiPointOverview(
    appInfo.serverBaseUrl,
    identity.workspaceId,
    identity.deviceToken
  );

  return {
    wallet: response.data.wallet,
    deviceQuota: response.data.deviceQuota,
    routes: response.data.routes
  };
}
