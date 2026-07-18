export interface RoleTemplateSummary {
  id: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
}

export interface RoleInstanceSummary {
  id: string;
  templateId: string;
  workspaceId: string;
  name: string;
  departmentName?: string;
  ownerName: string;
  status: 'running' | 'trial' | 'configuration_required' | 'paused';
  installedAt: string;
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
