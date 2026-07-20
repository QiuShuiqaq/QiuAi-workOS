import type { PublicInvitationDetail } from '@qiuai/api-contract';

import { fallbackCurrentAccount } from '../dashboard/fallback-data';

export function buildFallbackPublicInvitation(token: string): PublicInvitationDetail {
  const workspace = fallbackCurrentAccount.workspaces.find((item) => item.workspaceType === 'enterprise')!;

  return {
    email: 'new.member@qiuai.local',
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    organizationName: workspace.name,
    systemRole: 'member',
    departmentName: 'Operations',
    status: token ? 'pending' : 'expired',
    expiresAt: '2026-08-01T00:00:00.000Z'
  };
}
