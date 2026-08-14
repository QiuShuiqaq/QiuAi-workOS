import type { DesktopReferralOverview } from '../shared/desktop-api.js';
import { fetchReferralOverview } from '../shared/desktop-sync-client.js';
import { getDesktopAppInfo } from './runtime-state.js';
import { loadRuntimeIdentity } from './runtime-store.js';

export async function getDesktopReferralOverview(): Promise<DesktopReferralOverview> {
  const appInfo = getDesktopAppInfo();
  const identity = loadRuntimeIdentity(appInfo.userDataPath);
  if (!identity.deviceToken || !identity.workspaceId || identity.workspaceId === 'workspace_pending_login') {
    return {
      workspaceId: 'workspace_pending_login',
      accountStatus: 'unregistered',
      canInvite: false,
      invitedPaidCount: 0,
      earnedPoints: 0,
      policy: {
        inviteeRewardPoints: 300,
        inviterRewardPoints: 500,
        rewardExpiresInDays: 90
      }
    };
  }

  const response = await fetchReferralOverview(
    appInfo.serverBaseUrl,
    identity.workspaceId,
    identity.deviceToken
  );

  return response.data;
}
