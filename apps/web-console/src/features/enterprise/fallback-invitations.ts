import type { WorkspaceInvitationSummary } from '@qiuai/api-contract';

import { fallbackCurrentAccount } from '../dashboard/fallback-data';

export function buildFallbackWorkspaceInvitations(workspaceId: string): WorkspaceInvitationSummary[] {
  if (workspaceId !== fallbackCurrentAccount.activeWorkspaceId) {
    return [];
  }

  return [
    {
      id: 'invite_ops_new',
      workspaceId,
      email: 'new.member@qiuai.local',
      systemRole: 'member',
      departmentId: 'dept_operations',
      departmentName: 'Operations',
      status: 'pending',
      expiresAt: '2026-08-01T00:00:00.000Z',
      createdAt: '2026-07-20T00:00:00.000Z'
    }
  ];
}
