import type { PlanDetail } from './commercial';
import type { PlanCode } from './entitlement';
import type { WorkspaceSummary } from './workspace';

export interface OrganizationSummary {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  industry?: string;
  size?: string;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
}

export interface DepartmentSummary {
  id: string;
  organizationId: string;
  parentDepartmentId?: string;
  parentDepartmentName?: string;
  name: string;
  ownerUserId?: string;
  ownerName?: string;
  memberCount: number;
  roleInstanceCount: number;
  createdAt: string;
}

export interface MemberSummary {
  id: string;
  accountId: string;
  name: string;
  email: string;
  departmentId?: string;
  departmentName?: string;
  systemRole: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  joinedAt: string;
}

export interface SubscriptionSummary {
  id: string;
  workspaceId: string;
  planCode: PlanCode;
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  billingCycle: 'free' | 'monthly' | 'annual' | 'custom';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

export interface UsageMeterSummary {
  metricKey: string;
  title: string;
  usedValue: number;
  limitValue?: number;
  limitUnit?: string;
}

export interface EnterpriseWorkspaceOverview {
  workspace: WorkspaceSummary;
  organization: OrganizationSummary | null;
  plan: PlanDetail;
  subscription: SubscriptionSummary;
  departments: DepartmentSummary[];
  members: MemberSummary[];
  usage: UsageMeterSummary[];
}

export interface GetEnterpriseWorkspaceOverviewResponse {
  data: EnterpriseWorkspaceOverview;
}

export interface CreateDepartmentRequest {
  name: string;
  parentDepartmentId?: string;
  ownerUserId?: string;
}

export interface CreateDepartmentResponse {
  data: DepartmentSummary;
}
