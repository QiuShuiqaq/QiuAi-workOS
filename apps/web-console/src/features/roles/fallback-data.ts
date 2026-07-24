import type {
  ListRoleInstancesResponse,
  ListRoleTemplatesResponse,
  RoleInstanceDetail
} from '@qiuai/api-contract';
import {
  defaultRoleTemplateCatalog,
  getDefaultRoleTemplateByTemplateId
} from '@qiuai/domain';

import { fallbackOverview } from '../dashboard/fallback-data';

export const fallbackRoleTemplates: ListRoleTemplatesResponse = {
  data: defaultRoleTemplateCatalog.map((template) => ({
    id: template.templateId,
    version: template.version,
    name: template.name,
    industry: template.industry,
    scenario: template.scenario,
    description: template.description,
    recommendedPlanCode: template.recommendedPlanCode,
    businessGoal: template.businessGoal,
    knowledgeSources: template.knowledgeSources,
    tools: template.tools,
    skills: template.skills,
    workflowSteps: template.workflowSteps ?? [],
    sampleInputs: template.sampleInputs ?? [],
    outputFormat: template.outputFormat ?? '',
    approvalPolicy: template.approvalPolicy
  }))
};

export const fallbackRoles: ListRoleInstancesResponse = {
  data: fallbackOverview.roles.map((role) => {
    const templateId = role.id.replace('role_', 'template_');
    const template = getDefaultRoleTemplateByTemplateId(templateId);

    return {
      id: role.id,
      templateId,
      templateVersion: template?.version ?? '1.0.0',
      workspaceId: 'enterprise',
      name: role.name,
      departmentName: role.departmentName,
      ownerName: '企业管理者',
      status: role.status,
      installedAt: '2026-07-18T00:00:00.000Z',
      skills: template?.skills ?? [],
      kpis: {
        taskCompleted: 12,
        automationRate: 0.82,
        avgDurationMinutes: 10,
        monthlyCost: 128
      }
    };
  })
};

export function fallbackRoleDetail(roleId: string): RoleInstanceDetail {
  const role = fallbackRoles.data.find((item) => item.id === roleId) ?? fallbackRoles.data[0];
  const template = getDefaultRoleTemplateByTemplateId(role.templateId);

  return {
    ...role,
    skills: template?.skills ?? role.skills,
    businessGoal:
      template?.businessGoal ?? '稳定完成岗位对应的重复性业务工作，并输出可验收结果。',
    knowledgeSources: template?.knowledgeSources ?? ['企业知识库', '历史业务案例'],
    tools: template?.tools ?? ['业务系统连接器', '任务中心'],
    approvalPolicy: template?.approvalPolicy ?? '高风险结果需要人工确认。',
    recentTaskIds: ['task_case_screening']
  };
}
