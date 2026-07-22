import type { BillingAccountSummary, BillingOrderSummary, BillingSubscriptionSummary } from './billing';
import type { EntitlementSummary, PlanDetail } from './commercial';
import type { CreateDesktopBindingCodeRequest, DesktopBindingCodeSummary } from './desktop-sync';
import type {
  CancelWorkspaceInvitationResponse,
  CreateWorkspaceInvitationRequest,
  CreateWorkspaceInvitationResponse,
  WorkspaceInvitationSummary
} from './invitation';
import type { PaginationMeta } from './pagination';

export type AdminPlanStatus = 'ACTIVE' | 'ARCHIVED';
export type AdminWorkspaceStatus = 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

export interface AdminPlanDetail extends PlanDetail {
  status: AdminPlanStatus;
}

export interface AdminEntitlementInput extends EntitlementSummary {}

export interface ListAdminPlansResponse {
  data: AdminPlanDetail[];
}

export interface UpdateAdminPlanRequest {
  name?: string;
  description?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  status?: AdminPlanStatus;
  entitlements?: AdminEntitlementInput[];
}

export interface UpdateAdminPlanResponse {
  data: AdminPlanDetail;
}

export interface AdminWorkspaceSummary {
  id: string;
  tenantId: string;
  tenantName: string;
  workspaceType: 'personal' | 'enterprise';
  name: string;
  ownerAccountId: string;
  ownerEmail: string;
  status: 'active' | 'suspended' | 'archived';
  planCode: string;
  planName?: string;
  subscriptionStatus?: string;
  subscriptionPeriodEnd?: string;
  memberCount: number;
  roleCount: number;
  taskCount: number;
  desktopDeviceCount: number;
  billingOrderCount: number;
  updatedAt: string;
}

export interface AdminWorkspaceMemberSummary {
  id: string;
  workspaceId: string;
  accountId: string;
  primaryEmail: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  departmentId?: string;
  departmentName?: string;
  createdAt: string;
}

export interface ListAdminWorkspacesResponse {
  data: AdminWorkspaceSummary[];
  pagination: PaginationMeta;
}

export interface CreateAdminWorkspaceRequest {
  workspaceName: string;
  ownerEmail: string;
  planCode: string;
  durationDays?: number;
  periodStart?: string;
  periodEnd?: string;
  ownerPassword?: string;
  tenantName?: string;
  industry?: string;
  size?: string;
  note?: string;
}

export interface AdminDesktopDeviceSummary {
  id: string;
  runtimeId: string;
  deviceId: string;
  deviceName: string;
  platform: string;
  appVersion: string;
  status: string;
  boundAt: string;
  lastSeenAt?: string;
  lastSyncedAt?: string;
}

export interface AdminWorkspaceDetail {
  workspace: AdminWorkspaceSummary;
  subscription: BillingSubscriptionSummary | null;
  billingAccount: BillingAccountSummary | null;
  members: AdminWorkspaceMemberSummary[];
  invitations: WorkspaceInvitationSummary[];
  recentOrders: BillingOrderSummary[];
  desktopDevices: AdminDesktopDeviceSummary[];
  desktopBindingCodes: DesktopBindingCodeSummary[];
}

export interface GetAdminWorkspaceResponse {
  data: AdminWorkspaceDetail;
}

export interface CreateAdminWorkspaceResponse {
  data: AdminWorkspaceDetail;
  ownerAccount: {
    id: string;
    primaryEmail: string;
    passwordMode: 'existing' | 'provided' | 'generated';
  };
  temporaryPassword?: string;
}

export interface GrantAdminWorkspaceAuthorizationRequest {
  planCode: string;
  durationDays?: number;
  periodStart?: string;
  periodEnd?: string;
  reason: string;
  note?: string;
}

export interface GrantAdminWorkspaceAuthorizationResponse {
  data: AdminWorkspaceDetail;
}

export interface UpdateAdminWorkspaceStatusRequest {
  status: AdminWorkspaceStatus;
  reason: string;
  note?: string;
}

export interface UpdateAdminWorkspaceStatusResponse {
  data: AdminWorkspaceDetail;
}

export interface AdminActionLogSummary {
  id: string;
  operatorAccountId?: string;
  operatorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ListAdminActionLogsResponse {
  data: AdminActionLogSummary[];
  pagination: PaginationMeta;
}

export interface CreateAdminWorkspaceInvitationRequest extends CreateWorkspaceInvitationRequest {}

export interface CreateAdminWorkspaceInvitationResponse extends CreateWorkspaceInvitationResponse {}

export interface CancelAdminWorkspaceInvitationResponse extends CancelWorkspaceInvitationResponse {}

export interface CreateAdminDesktopBindingCodeRequest extends CreateDesktopBindingCodeRequest {}

export interface CreateAdminDesktopBindingCodeResponse {
  data: DesktopBindingCodeSummary & {
    bindingCode: string;
  };
}

export interface RevokeAdminDesktopDeviceResponse {
  data: AdminDesktopDeviceSummary;
}
