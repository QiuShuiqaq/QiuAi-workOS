import type { PlanCode } from './entitlement';

export interface AuthWorkspaceSummary {
  id: string;
  tenantId: string;
  workspaceType: 'personal' | 'enterprise';
  name: string;
  ownerAccountId: string;
  status: 'active' | 'suspended' | 'archived';
  planCode: PlanCode;
}

export interface AuthAccountSummary {
  id: string;
  primaryEmail: string;
  status: 'active' | 'disabled';
}

export interface AuthSessionResponse {
  authenticated: boolean;
  persistenceMode: 'mock' | 'database';
  account?: AuthAccountSummary;
  workspaces?: AuthWorkspaceSummary[];
  activeWorkspaceId?: string;
  expiresAt?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse extends AuthSessionResponse {
  authenticated: true;
}

export interface LogoutResponse {
  ok: true;
}
