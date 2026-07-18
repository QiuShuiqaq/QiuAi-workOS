import type { CurrentAccountResponse } from '@qiuai/api-contract';

export function resolveWorkspaceId(
  currentAccount: CurrentAccountResponse,
  requestedWorkspaceId?: string
) {
  const normalizedWorkspaceId = requestedWorkspaceId?.trim();
  if (!normalizedWorkspaceId) {
    return currentAccount.activeWorkspaceId;
  }

  return currentAccount.workspaces.some((workspace) => workspace.id === normalizedWorkspaceId)
    ? normalizedWorkspaceId
    : currentAccount.activeWorkspaceId;
}
