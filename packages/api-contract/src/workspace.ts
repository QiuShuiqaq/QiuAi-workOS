export interface WorkspaceSummary {
  id: string;
  tenantId: string;
  workspaceType: 'personal' | 'enterprise';
  name: string;
  ownerAccountId: string;
  status: 'active' | 'suspended' | 'archived';
  planCode: string;
}

export interface CurrentAccountResponse {
  account: {
    id: string;
    primaryEmail: string;
    status: 'active' | 'disabled';
  };
  workspaces: WorkspaceSummary[];
  activeWorkspaceId: string;
}
