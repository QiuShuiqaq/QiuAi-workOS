export interface RoleSkillSummary {
  code: string;
  name: string;
  summary: string;
}

export type RoleTemplateStepType =
  | 'input'
  | 'reasoning'
  | 'knowledge'
  | 'tool'
  | 'approval'
  | 'output';

export interface RoleTemplateWorkflowStep {
  id: string;
  order: number;
  type: RoleTemplateStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

export interface RoleTemplateSummary {
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
}

export interface RoleInstanceSummary {
  id: string;
  templateId: string;
  templateVersion: string;
  workspaceId: string;
  name: string;
  departmentName?: string;
  ownerName: string;
  status: 'running' | 'trial' | 'configuration_required' | 'paused';
  installedAt: string;
  skills: RoleSkillSummary[];
  kpis: {
    taskCompleted: number;
    automationRate: number;
    avgDurationMinutes: number;
    monthlyCost: number;
  };
}

export interface RoleInstanceDetail extends RoleInstanceSummary {
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  approvalPolicy: string;
  recentTaskIds: string[];
}

export interface ListRoleTemplatesResponse {
  data: RoleTemplateSummary[];
}

export interface ListRoleInstancesResponse {
  data: RoleInstanceSummary[];
}

export interface GetRoleInstanceResponse {
  data: RoleInstanceDetail;
}

export interface InstallRoleRequest {
  templateId: string;
  name?: string;
  departmentName?: string;
}

export interface InstallRoleResponse {
  data: RoleInstanceDetail;
}
