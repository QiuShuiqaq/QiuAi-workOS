import type { PaginationMeta } from './pagination';
import type { RoleSkillSummary, RoleTemplateWorkflowStep } from './role';

export type AdminRoleTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface AdminRoleTemplateDetail {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  skills: RoleSkillSummary[];
  workflowSteps: RoleTemplateWorkflowStep[];
  sampleInputs: string[];
  outputFormat: string;
  approvalPolicy: string;
  status: AdminRoleTemplateStatus;
  allowedPlanCodes: string[];
  visibleWorkspaceIds: string[];
  publishedAt?: string;
  lastTestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListAdminRoleTemplatesResponse {
  data: AdminRoleTemplateDetail[];
}

export interface GetAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface AdminRoleTemplateSkillInput extends RoleSkillSummary {}

export interface CreateAdminRoleTemplateRequest {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  skills: AdminRoleTemplateSkillInput[];
  workflowSteps?: RoleTemplateWorkflowStep[];
  sampleInputs?: string[];
  outputFormat?: string;
  approvalPolicy: string;
  status?: AdminRoleTemplateStatus;
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
}

export interface UpdateAdminRoleTemplateRequest {
  version?: string;
  name?: string;
  industry?: string;
  scenario?: string;
  description?: string;
  recommendedPlanCode?: string;
  businessGoal?: string;
  knowledgeSources?: string[];
  tools?: string[];
  skills?: AdminRoleTemplateSkillInput[];
  workflowSteps?: RoleTemplateWorkflowStep[];
  sampleInputs?: string[];
  outputFormat?: string;
  approvalPolicy?: string;
  status?: AdminRoleTemplateStatus;
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
}

export interface TestAdminRoleTemplateRequest {
  sampleInput?: string;
  sampleWorkspaceId?: string;
}

export interface TestAdminRoleTemplateResponse {
  data: {
    templateId: string;
    valid: boolean;
    status: 'passed' | 'failed';
    message: string;
    warnings: string[];
    sampleInput?: string;
  };
}

export interface PublishAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface ArchiveAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface CreateAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface UpdateAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface ListAdminRoleTemplatesQuery {
  status?: AdminRoleTemplateStatus;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAdminRoleTemplatesPagedResponse {
  data: AdminRoleTemplateDetail[];
  pagination: PaginationMeta;
}
