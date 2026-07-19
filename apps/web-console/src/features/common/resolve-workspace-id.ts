import type { CurrentAccountResponse } from '@qiuai/api-contract';

export function resolveWorkspaceId(
  currentAccount: CurrentAccountResponse,
  requestedWorkspaceId?: string
) {
  const normalizedWorkspaceId = requestedWorkspaceId?.trim();
  if (!normalizedWorkspaceId) {
    return currentAccount.activeWorkspaceId;
  }

  const matchedWorkspace = currentAccount.workspaces.find(
    (workspace) => workspace.id === normalizedWorkspaceId
  );
  if (matchedWorkspace) {
    return matchedWorkspace.id;
  }

  const legacyWorkspaceAlias = currentAccount.workspaces.find(
    (workspace) => workspace.workspaceType === normalizedWorkspaceId
  );
  if (legacyWorkspaceAlias) {
    return legacyWorkspaceAlias.id;
  }

  return currentAccount.activeWorkspaceId;
}
