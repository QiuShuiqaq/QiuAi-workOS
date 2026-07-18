import type {
  ListRoleInstancesResponse,
  ListRoleTemplatesResponse,
  RoleInstanceDetail
} from '@qiuai/api-contract';

import { fallbackOverview } from '../dashboard/fallback-data';

export const fallbackRoleTemplates: ListRoleTemplatesResponse = {
  data: [
    {
      id: 'template_case_ops',
      name: 'AI案例运营专员',
      industry: '保健品和私域运营',
      scenario: '案例素材识别、筛选、剪辑和发布',
      description: '自动处理客户案例素材，生成筛选结果、内容建议和运营产物。',
      recommendedPlanCode: 'PERSONAL_FREE'
    },
    {
      id: 'template_customer_followup',
      name: 'AI客户回访专员',
      industry: '客户运营',
      scenario: '回访记录整理、意向识别和后续动作建议',
      description: '整理客户回访内容，识别客户意向和风险，并生成跟进建议。',
      recommendedPlanCode: 'ENTERPRISE_MONTHLY'
    },
    {
      id: 'template_contract_review',
      name: 'AI合同审核专员',
      industry: '法律服务',
      scenario: '合同条款审查和风险摘要',
      description: '对合同进行初步风险识别，输出审查摘要和风险提示。',
      recommendedPlanCode: 'ENTERPRISE_MONTHLY'
    }
  ]
};

export const fallbackRoles: ListRoleInstancesResponse = {
  data: fallbackOverview.roles.map((role) => ({
    id: role.id,
    templateId: role.id.replace('role_', 'template_'),
    workspaceId: 'enterprise',
    name: role.name,
    departmentName: role.departmentName,
    ownerName: '企业管理员',
    status: role.status,
    installedAt: '2026-07-18T00:00:00.000Z',
    kpis: {
      taskCompleted: 12,
      automationRate: 0.82,
      avgDurationMinutes: 10,
      monthlyCost: 128
    }
  }))
};

export function fallbackRoleDetail(roleId: string): RoleInstanceDetail {
  const role = fallbackRoles.data.find((item) => item.id === roleId) ?? fallbackRoles.data[0];
  return {
    ...role,
    businessGoal: '稳定完成岗位对应的重复性业务工作，并输出可验收结果。',
    knowledgeSources: ['企业知识库', '历史业务案例'],
    tools: ['业务系统连接器', '任务中心'],
    approvalPolicy: '高风险结果需要人工确认',
    recentTaskIds: ['task_case_screening']
  };
}
