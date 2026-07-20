import { demoAccount, demoWorkspaces } from './platform-seed';
import type { PlanCode } from '../types/plan-code';

export interface MockOrganizationSummary {
  id: string;
  tenantId: string;
  workspaceId: string;
  name: string;
  industry?: string;
  size?: string;
  status: 'active' | 'suspended' | 'archived';
  createdAt: string;
}

export interface MockDepartmentSummary {
  id: string;
  organizationId: string;
  parentDepartmentId?: string;
  name: string;
  ownerUserId?: string;
  createdAt: string;
}

export interface MockMemberSummary {
  id: string;
  accountId: string;
  tenantId: string;
  workspaceId: string;
  organizationId?: string;
  departmentId?: string;
  name: string;
  email: string;
  systemRole: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'disabled';
  joinedAt: string;
}

export interface MockSubscriptionSummary {
  id: string;
  workspaceId: string;
  planCode: PlanCode;
  status: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';
  billingCycle: 'free' | 'monthly' | 'annual' | 'custom';
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

export interface MockInvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  systemRole: 'admin' | 'member' | 'viewer';
  departmentId?: string;
  departmentName?: string;
  status: 'pending' | 'accepted' | 'cancelled' | 'expired';
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

export const demoOrganizations: MockOrganizationSummary[] = [
  {
    id: 'org_enterprise',
    tenantId: 'tenant_enterprise',
    workspaceId: 'enterprise',
    name: '秋壹科技',
    industry: '内容运营与企业服务',
    size: '50-200人',
    status: 'active',
    createdAt: '2026-07-01T00:00:00.000Z'
  }
];

export const demoDepartments: MockDepartmentSummary[] = [
  {
    id: 'dept_operations',
    organizationId: 'org_enterprise',
    name: '运营部',
    ownerUserId: 'member_ops_lead',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'dept_customer',
    organizationId: 'org_enterprise',
    name: '客服部',
    ownerUserId: 'member_customer_lead',
    createdAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'dept_legal',
    organizationId: 'org_enterprise',
    name: '法务部',
    ownerUserId: 'member_legal_lead',
    createdAt: '2026-07-01T00:00:00.000Z'
  }
];

export const demoMembers: MockMemberSummary[] = [
  {
    id: 'member_personal_owner',
    accountId: demoAccount.id,
    tenantId: 'tenant_personal',
    workspaceId: 'personal',
    name: '个人空间管理员',
    email: demoAccount.primaryEmail,
    systemRole: 'owner',
    status: 'active',
    joinedAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'member_enterprise_owner',
    accountId: demoAccount.id,
    tenantId: 'tenant_enterprise',
    workspaceId: 'enterprise',
    organizationId: 'org_enterprise',
    name: '李管理员',
    email: demoAccount.primaryEmail,
    systemRole: 'owner',
    status: 'active',
    joinedAt: '2026-07-01T00:00:00.000Z'
  },
  {
    id: 'member_ops_lead',
    accountId: 'account_ops_lead',
    tenantId: 'tenant_enterprise',
    workspaceId: 'enterprise',
    organizationId: 'org_enterprise',
    departmentId: 'dept_operations',
    name: '王运营',
    email: 'ops@qiuai.local',
    systemRole: 'admin',
    status: 'active',
    joinedAt: '2026-07-02T00:00:00.000Z'
  },
  {
    id: 'member_ops_specialist',
    accountId: 'account_ops_specialist',
    tenantId: 'tenant_enterprise',
    workspaceId: 'enterprise',
    organizationId: 'org_enterprise',
    departmentId: 'dept_operations',
    name: '周运营',
    email: 'ops2@qiuai.local',
    systemRole: 'member',
    status: 'active',
    joinedAt: '2026-07-03T00:00:00.000Z'
  },
  {
    id: 'member_customer_lead',
    accountId: 'account_customer_lead',
    tenantId: 'tenant_enterprise',
    workspaceId: 'enterprise',
    organizationId: 'org_enterprise',
    departmentId: 'dept_customer',
    name: '陈客服',
    email: 'service@qiuai.local',
    systemRole: 'admin',
    status: 'active',
    joinedAt: '2026-07-02T00:00:00.000Z'
  },
  {
    id: 'member_legal_lead',
    accountId: 'account_legal_lead',
    tenantId: 'tenant_enterprise',
    workspaceId: 'enterprise',
    organizationId: 'org_enterprise',
    departmentId: 'dept_legal',
    name: '刘法务',
    email: 'legal@qiuai.local',
    systemRole: 'admin',
    status: 'active',
    joinedAt: '2026-07-02T00:00:00.000Z'
  }
];

export const demoSubscriptions: MockSubscriptionSummary[] = [
  {
    id: 'sub_personal',
    workspaceId: 'personal',
    planCode: 'PERSONAL_FREE',
    status: 'free',
    billingCycle: 'free',
    cancelAtPeriodEnd: false
  },
  {
    id: 'sub_enterprise',
    workspaceId: 'enterprise',
    planCode: 'ENTERPRISE_BASIC_MONTHLY',
    status: 'active',
    billingCycle: 'monthly',
    currentPeriodStart: '2026-07-01T00:00:00.000Z',
    currentPeriodEnd: '2026-08-01T00:00:00.000Z',
    cancelAtPeriodEnd: false
  }
];

export const demoInvitations: MockInvitationSummary[] = [
  {
    id: 'invite_ops_new',
    workspaceId: 'enterprise',
    email: 'new.member@qiuai.local',
    systemRole: 'member',
    departmentId: 'dept_operations',
    departmentName: '杩愯惀閮?',
    status: 'pending',
    expiresAt: '2026-08-01T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z'
  }
];

export const enterpriseWorkspaceId = demoWorkspaces.find((workspace) => workspace.workspaceType === 'enterprise')?.id ?? 'enterprise';
