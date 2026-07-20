import type { LoginResponse } from './auth';

export type InvitationStatus = 'pending' | 'accepted' | 'cancelled' | 'expired';
export type InvitationSystemRole = 'admin' | 'member' | 'viewer';

export interface WorkspaceInvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  systemRole: InvitationSystemRole;
  departmentId?: string;
  departmentName?: string;
  status: InvitationStatus;
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface PublicInvitationDetail {
  email: string;
  workspaceId: string;
  workspaceName: string;
  organizationName?: string;
  systemRole: InvitationSystemRole;
  departmentName?: string;
  status: InvitationStatus;
  expiresAt: string;
}

export interface ListWorkspaceInvitationsResponse {
  data: WorkspaceInvitationSummary[];
}

export interface CreateWorkspaceInvitationRequest {
  email: string;
  systemRole?: InvitationSystemRole;
  departmentId?: string;
  expiresInDays?: number;
}

export interface CreateWorkspaceInvitationResponse {
  data: WorkspaceInvitationSummary;
  inviteUrl: string;
}

export interface CancelWorkspaceInvitationResponse {
  data: WorkspaceInvitationSummary;
}

export interface GetPublicInvitationResponse {
  data: PublicInvitationDetail;
}

export interface AcceptWorkspaceInvitationRequest {
  password: string;
  rememberMe?: boolean;
}

export interface AcceptWorkspaceInvitationResponse extends LoginResponse {}
