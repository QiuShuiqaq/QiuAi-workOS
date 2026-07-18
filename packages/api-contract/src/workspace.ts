import type { PlanCode } from './entitlement';

export interface WorkspaceSummary {
  id: string;
  tenantId: string;
  workspaceType: 'personal' | 'enterprise';
  name: string;
  ownerAccountId: string;
  status: 'active' | 'suspended' | 'archived';
  planCode: PlanCode;
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
