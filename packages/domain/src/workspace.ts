export type TenantType = 'personal' | 'enterprise' | 'platform';

export type WorkspaceType = 'personal' | 'enterprise';

export type WorkspaceStatus = 'active' | 'suspended' | 'archived';

export interface Account {
  id: string;
  primaryEmail: string;
  phone?: string;
  status: 'active' | 'disabled';
  createdAt: string;
}

export interface Workspace {
  id: string;
  tenantId: string;
  workspaceType: WorkspaceType;
  name: string;
  ownerAccountId: string;
  status: WorkspaceStatus;
  createdAt: string;
}

export interface Organization {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  industry?: string;
  size?: string;
}

export interface Department {
  id: string;
  organizationId: string;
  parentDepartmentId?: string;
  name: string;
  ownerUserId?: string;
}
