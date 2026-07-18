export type RoleTemplateStatus = 'draft' | 'internal' | 'published' | 'deprecated' | 'archived';

export type RoleInstanceStatus =
  | 'installing'
  | 'draft'
  | 'trial_running'
  | 'active'
  | 'paused'
  | 'archived';

export interface RoleTemplate {
  id: string;
  name: string;
  industry?: string;
  scenario?: string;
  description?: string;
  version: string;
  status: RoleTemplateStatus;
}

export interface RoleInstance {
  id: string;
  workspaceId: string;
  organizationId?: string;
  departmentId?: string;
  templateId: string;
  name: string;
  ownerUserId?: string;
  status: RoleInstanceStatus;
  installedAt?: string;
}
