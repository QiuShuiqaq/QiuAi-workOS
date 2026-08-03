import type { DesktopToolActionHealthSummary } from './desktop-sync';
import type {
  RoleTemplateDependencyManifest,
  RoleTemplateExecutionProfile
} from './dependency-manifest';
import type { PaginationMeta } from './pagination';
import type { RoleSkillSummary, RoleTemplateWorkflowStep } from './role';
import type { RoleWorkflowGraph } from './workflow-graph';

export type AdminRoleTemplateStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';
export type AdminRoleTemplateEditableStatus = Exclude<AdminRoleTemplateStatus, 'DELETED'>;
export type RoleTemplateApplicationType = 'digital_employee' | 'digital_factory';

export interface AdminRoleTemplateDetail {
  id: string;
  applicationType: RoleTemplateApplicationType;
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
  workflowGraph?: RoleWorkflowGraph;
  dependencyManifest?: RoleTemplateDependencyManifest;
  executionProfile?: RoleTemplateExecutionProfile;
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
  applicationType?: RoleTemplateApplicationType;
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
  workflowGraph?: RoleWorkflowGraph;
  dependencyManifest?: RoleTemplateDependencyManifest;
  executionProfile?: RoleTemplateExecutionProfile;
  sampleInputs?: string[];
  outputFormat?: string;
  approvalPolicy: string;
  status?: AdminRoleTemplateEditableStatus;
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
}

export interface UpdateAdminRoleTemplateRequest {
  applicationType?: RoleTemplateApplicationType;
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
  workflowGraph?: RoleWorkflowGraph;
  dependencyManifest?: RoleTemplateDependencyManifest;
  executionProfile?: RoleTemplateExecutionProfile;
  sampleInputs?: string[];
  outputFormat?: string;
  approvalPolicy?: string;
  status?: AdminRoleTemplateEditableStatus;
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
}

export interface TestAdminRoleTemplateRequest {
  sampleInput?: string;
  sampleWorkspaceId?: string;
}

export type AdminRoleTemplateToolCompatibilityStatus = 'passed' | 'warning' | 'failed';

export interface AdminRoleTemplateToolCompatibility {
  status: AdminRoleTemplateToolCompatibilityStatus;
  message: string;
  checks: string[];
}

export interface AdminRoleTemplateRuntimePreview {
  inputVariables: string[];
  outputVariables: string[];
}

export interface AdminRoleTemplateTestNodeTrace {
  nodeId: string;
  nodeName: string;
  nodeType: string;
  status: 'passed' | 'warning' | 'failed';
  inputPreview: string;
  outputPreview: string;
  warnings: string[];
  toolActionId?: string;
  requiredInputTypes?: string[];
  producedOutputTypes?: string[];
  runtimePreview?: AdminRoleTemplateRuntimePreview;
  resolvedToolInput?: unknown;
  toolCompatibility?: AdminRoleTemplateToolCompatibility;
}

export interface AdminRoleTemplateTestGraphTrace {
  entryNodeId: string;
  nodeCount: number;
  edgeCount: number;
  nodes: AdminRoleTemplateTestNodeTrace[];
  pcCompatibility?: {
    status: AdminRoleTemplateToolCompatibilityStatus;
    message: string;
    passedCount: number;
    warningCount: number;
    failedCount: number;
  };
}

export interface TestAdminRoleTemplateResponse {
  data: {
    templateId: string;
    valid: boolean;
    status: 'passed' | 'failed';
    message: string;
    warnings: string[];
    sampleInput?: string;
    graphTrace?: AdminRoleTemplateTestGraphTrace;
    requiredToolActions?: string[];
    deviceToolActions?: DesktopToolActionHealthSummary[];
  };
}

export interface PublishAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface ArchiveAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface DeleteAdminRoleTemplateResponse {
  data: {
    id: string;
  };
}

export interface CreateAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface UpdateAdminRoleTemplateResponse {
  data: AdminRoleTemplateDetail;
}

export interface ListAdminRoleTemplatesQuery {
  status?: AdminRoleTemplateEditableStatus;
  query?: string;
  page?: number;
  pageSize?: number;
}

export interface ListAdminRoleTemplatesPagedResponse {
  data: AdminRoleTemplateDetail[];
  pagination: PaginationMeta;
}
