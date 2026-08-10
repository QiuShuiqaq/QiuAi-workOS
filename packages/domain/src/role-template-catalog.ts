import type { RoleWorkflowGraph } from './workflow-graph';

export type RoleKnowledgeSource =
  | 'local_folder'
  | 'local_file'
  | 'workspace_library'
  | 'server_summary';

export type RoleSyncPolicy = 'summary_only' | 'summary_plus_metadata';

export interface RoleSkill {
  code: string;
  name: string;
  summary: string;
}

export type RoleTemplateWorkflowStepType =
  | 'input'
  | 'llm'
  | 'knowledge'
  | 'tool'
  | 'approval'
  | 'output';

export interface RoleTemplateWorkflowStep {
  id: string;
  order: number;
  type: RoleTemplateWorkflowStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
}

export interface RoleTemplateExecutionProfile {
  mode: 'conversation' | 'watch' | 'hybrid';
  summary: string;
  triggerModes: string[];
  inputSources: string[];
  toolCapabilities: string[];
  outputTargets: string[];
  approval: {
    required: boolean;
    requiredActions: string[];
  };
  dataBoundary: string;
  externalConnectors?: Array<{
    key: string;
    name: string;
    type: string;
    status: string;
  }>;
  rolloutPhase?: string;
  notes?: string[];
}

export interface RoleTemplateCatalogEntry {
  templateId: string;
  applicationType?: 'digital_employee' | 'digital_factory';
  roleCode: string;
  name: string;
  version: string;
  summary: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  allowedPlanCodes?: string[];
  canInstall?: boolean;
  accessLabel?: string;
  accessReason?: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  approvalPolicy: string;
  skills: RoleSkill[];
  workflowSteps?: RoleTemplateWorkflowStep[];
  workflowGraph?: RoleWorkflowGraph;
  executionProfile?: RoleTemplateExecutionProfile;
  sampleInputs?: string[];
  outputFormat?: string;
  modelProfileIds: string[];
  toolIds: string[];
  requiredKnowledgeSources: RoleKnowledgeSource[];
  defaultTaskTypes: string[];
  syncPolicy: RoleSyncPolicy;
  installNote: string;
}

const documentAssistantSkills: RoleSkill[] = [
  {
    code: 'document_extraction',
    name: '文档提取',
    summary: '读取附件中的明确内容，区分事实、缺失项和待确认信息。'
  },
  {
    code: 'draft_generation',
    name: '文档生成',
    summary: '将处理结果整理为结构清晰、可编辑的 Word 文档。'
  },
  {
    code: 'quality_rule_check',
    name: '质量检查',
    summary: '检查内容依据、结构、重复和人工确认边界。'
  }
];

export const defaultRoleTemplateCatalog: RoleTemplateCatalogEntry[] = [
  {
    templateId: 'template_document_assistant',
    applicationType: 'digital_employee',
    roleCode: 'ai-document-assistant',
    name: 'AI 文档助手',
    version: '1.0.0',
    summary: '上传文档，选择场景，生成结构清晰的 Word 产物。',
    industry: '通用办公 / 企业文档',
    scenario: '上传文件、选择业务场景、整理内容并生成可交付文档',
    description:
      '统一处理招聘、财务、行政、合同、会议、调研和项目等文档场景，减少重复安装和配置。',
    recommendedPlanCode: 'PERSONAL_FREE',
    allowedPlanCodes: [
      'PERSONAL_FREE',
      'ENTERPRISE_BASIC_MONTHLY',
      'ENTERPRISE_BASIC_ANNUAL',
      'ENTERPRISE_STANDARD_MONTHLY',
      'ENTERPRISE_STANDARD_ANNUAL',
      'ENTERPRISE_PRO_MONTHLY',
      'ENTERPRISE_PRO_ANNUAL',
      'ENTERPRISE_MONTHLY',
      'ENTERPRISE_ANNUAL',
      'ENTERPRISE_CUSTOM'
    ],
    canInstall: true,
    businessGoal: '用一个稳定的文档处理入口替代相似岗位型数字员工，降低使用和维护成本。',
    knowledgeSources: ['用户上传文件', '本地知识库', '企业知识库', '场景模板'],
    tools: ['office-document', 'local-filesystem'],
    executionProfile: {
      mode: 'conversation',
      summary: '对话式数字员工：由用户上传资料并发起任务，读取文件和知识库后输出正式文档产物。',
      triggerModes: ['manual'],
      inputSources: ['chat', 'uploaded_files', 'enterprise_knowledge', 'local_folder'],
      toolCapabilities: ['llm', 'knowledge', 'office', 'local_files', 'approval_queue'],
      outputTargets: ['chat_response', 'artifact', 'approval_queue'],
      approval: {
        required: true,
        requiredActions: ['关键结论确认', '正式对外使用前复核']
      },
      dataBoundary: 'local_first',
      rolloutPhase: 'ready',
      notes: ['当前版本以用户主动发起对话任务为主，不启用平台值守或网页 RPA。']
    },
    approvalPolicy:
      '招聘录用、财务付款或报销、合同法律结论、制度正式发布、对外承诺和敏感个人信息处理必须人工确认。',
    skills: documentAssistantSkills,
    sampleInputs: [
      '请使用“招聘简历筛选”场景，读取我上传的岗位 JD 和简历，生成候选人筛选报告。',
      '请使用“行政制度文档”场景，根据上传资料生成一份结构清晰、可人工确认的 Word 文档。',
      '请使用“财务单据整理”场景，提取上传材料中的字段、异常和待补充信息，形成结构化报告。'
    ],
    outputFormat: '本地 Word 文档，按用户选择的场景输出正文、清单、风险提示和待确认事项。',
    modelProfileIds: ['qiu-general-default', 'qiu-reasoning-default'],
    toolIds: ['office-document', 'local-filesystem'],
    requiredKnowledgeSources: ['local_file', 'workspace_library', 'server_summary'],
    defaultTaskTypes: ['document_extraction', 'document_generation', 'quality_check'],
    syncPolicy: 'summary_only',
    installNote: '适合日常文档整理、招聘、财务、行政、合同、会议和项目资料处理。'
  }
];

export const defaultRoleTemplateCatalogByTemplateId = new Map(
  defaultRoleTemplateCatalog.map((template) => [template.templateId, template] as const)
);

export const defaultRoleTemplateCatalogByRoleCode = new Map(
  defaultRoleTemplateCatalog.map((template) => [template.roleCode, template] as const)
);

export function getDefaultRoleTemplateByTemplateId(templateId: string) {
  return defaultRoleTemplateCatalogByTemplateId.get(templateId);
}

export function getDefaultRoleTemplateByRoleCode(roleCode: string) {
  return defaultRoleTemplateCatalogByRoleCode.get(roleCode);
}
