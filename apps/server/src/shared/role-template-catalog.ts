export interface ServerRoleSkill {
  code: string;
  name: string;
  summary: string;
}

export interface ServerRoleTemplateCatalogEntry {
  templateId: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  skills: ServerRoleSkill[];
  approvalPolicy: string;
}

const skill = (code: string, name: string, summary: string): ServerRoleSkill => ({
  code,
  name,
  summary
});

const skills = {
  caseScreening: skill('case_screening', '案例筛选', '按企业标准筛选出可交付的案例素材。'),
  contentRewrite: skill('content_rewrite', '内容改写', '把原始内容改写为可发布版本。'),
  publicationReadiness: skill('publication_readiness', '发布准备', '输出发布前检查与风险提示。'),
  followupCleanup: skill('followup_cleanup', '回访整理', '整理零散回访记录为结构化摘要。'),
  intentDetection: skill('intent_detection', '意向识别', '识别客户意向、风险和下一步动作。'),
  nextActionPlanning: skill('next_action_planning', '后续动作规划', '给出可执行的跟进建议。'),
  contentPlanning: skill('content_planning', '内容策划', '拆解选题、节奏和交付计划。'),
  draftGeneration: skill('draft_generation', '文案生成', '生成初稿、标题和结构化内容。'),
  publishingReview: skill('publishing_review', '发布审核', '检查内容是否符合发布标准。'),
  leadResearch: skill('lead_research', '线索研究', '搜索并整理潜在线索背景。'),
  outreachDrafting: skill('outreach_drafting', '外联文案', '生成外联、跟进或催办话术。'),
  proposalSupport: skill('proposal_support', '方案支撑', '整理方案提纲和卖点表达。'),
  clauseExtraction: skill('clause_extraction', '条款提取', '提取合同关键条款和约束。'),
  riskSummary: skill('risk_summary', '风险摘要', '汇总风险点并给出处理建议。'),
  approvalNote: skill('approval_note', '审批说明', '形成给法务或负责人审批的说明。'),
  resumeScreening: skill('resume_screening', '简历筛选', '按岗位要求筛选候选人。'),
  interviewSummary: skill('interview_summary', '面试纪要', '整理面试过程、结论和待办。'),
  candidateRanking: skill('candidate_ranking', '候选人排序', '输出候选人优先级和推荐理由。'),
  invoiceExtraction: skill('invoice_extraction', '单据提取', '提取发票和报销单关键信息。'),
  reimbursementReview: skill('reimbursement_review', '报销审核', '检查报销合规性和缺项。'),
  reportReconciliation: skill('report_reconciliation', '对账汇总', '整理账目和差异并输出汇总。'),
  meetingSummary: skill('meeting_summary', '会议纪要', '生成会议要点和待办。'),
  scheduleCoordination: skill('schedule_coordination', '日程协调', '协助安排会议和时间。'),
  taskDelegation: skill('task_delegation', '任务分派', '把事项拆成可跟进任务。'),
  dataResearch: skill('data_research', '数据调研', '搜集并整理外部资料。'),
  reportGeneration: skill('report_generation', '报告生成', '输出可阅读的研究报告。')
} as const;

export const serverRoleTemplateCatalog: ServerRoleTemplateCatalogEntry[] = [
  {
    templateId: 'template_case_ops',
    version: '1.0.0',
    name: 'AI 案例运营专员',
    industry: '健康产品与私域运营',
    scenario: '案例素材筛选、改写和发布前检查',
    description: '自动处理客户案例素材，生成筛选结果、内容建议和运营交付物。',
    recommendedPlanCode: 'PERSONAL_FREE',
    businessGoal: '提升案例素材处理效率，稳定完成筛选、改写和发布准备。',
    knowledgeSources: ['企业案例标准', '内容发布规范', '历史案例库'],
    tools: ['素材库', '内容发布系统', '数据看板'],
    skills: [skills.caseScreening, skills.contentRewrite, skills.publicationReadiness],
    approvalPolicy: '发布前需要运营负责人审批。'
  },
  {
    templateId: 'template_customer_followup',
    version: '1.0.0',
    name: 'AI 客户回访专员',
    industry: '客户运营',
    scenario: '回访记录整理、意向识别和后续动作建议',
    description: '整理客户回访内容，识别意向和风险，并生成跟进建议。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '沉淀客户回访记录，识别客户意向并推进后续跟进。',
    knowledgeSources: ['客户分层规则', '回访话术', '售后政策'],
    tools: ['CRM', '回访记录表'],
    skills: [skills.followupCleanup, skills.intentDetection, skills.nextActionPlanning],
    approvalPolicy: '高风险客户建议需人工确认。'
  },
  {
    templateId: 'template_content_ops',
    version: '1.0.0',
    name: 'AI 内容运营专员',
    industry: '内容运营',
    scenario: '选题策划、草稿生成、发布审核',
    description: '围绕选题、草稿、审核和发布节奏输出可交付内容。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '稳定输出内容选题、草稿和发布前审核建议。',
    knowledgeSources: ['内容选题库', '品牌表达规范', '历史内容档案'],
    tools: ['素材库', '内容协作系统'],
    skills: [skills.contentPlanning, skills.draftGeneration, skills.publishingReview],
    approvalPolicy: '发布前需要内容负责人确认。'
  },
  {
    templateId: 'template_sales_assist',
    version: '1.0.0',
    name: 'AI 销售助理',
    industry: '销售支持',
    scenario: '线索研究、外联文案和提案支撑',
    description: '协助销售搜集线索、整理卖点并输出跟进文案。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '帮助销售快速完成线索研究和外联准备。',
    knowledgeSources: ['销售话术库', '产品卖点库', '客户画像'],
    tools: ['线索管理', '提案文档'],
    skills: [skills.leadResearch, skills.outreachDrafting, skills.proposalSupport],
    approvalPolicy: '正式对外发送前需要销售负责人确认。'
  },
  {
    templateId: 'template_contract_review',
    version: '1.0.0',
    name: 'AI 合同审查专员',
    industry: '法律服务',
    scenario: '合同条款审查、风险摘要和审批建议',
    description: '对合同进行初筛，输出风险摘要和法务审批建议。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '减少法务重复审查时间，稳定输出合同初审意见。',
    knowledgeSources: ['合同模板库', '风险条款清单', '审批规范'],
    tools: ['合同文档', '条款库'],
    skills: [skills.clauseExtraction, skills.riskSummary, skills.approvalNote],
    approvalPolicy: '所有合同结论必须经过法务确认。'
  },
  {
    templateId: 'template_hr_recruiting',
    version: '1.0.0',
    name: 'AI 招聘专员',
    industry: '人力资源',
    scenario: '简历筛选、面试纪要和候选人排序',
    description: '协助 HR 筛选简历、整理面试记录并输出候选人建议。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提升招聘筛选效率，形成统一的候选人建议。',
    knowledgeSources: ['岗位画像', '招聘流程规范', '面试评价标准'],
    tools: ['招聘系统', '面试记录表'],
    skills: [skills.resumeScreening, skills.interviewSummary, skills.candidateRanking],
    approvalPolicy: '候选人推荐结果需招聘负责人确认。'
  },
  {
    templateId: 'template_finance_ops',
    version: '1.0.0',
    name: 'AI 财务单据专员',
    industry: '财务运营',
    scenario: '单据提取、报销审核和对账汇总',
    description: '整理发票、报销单和对账材料，输出财务审核建议。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '减少财务单据处理时间，稳定输出对账和审核意见。',
    knowledgeSources: ['报销制度', '单据模板', '对账规则'],
    tools: ['财务系统', '单据台账'],
    skills: [skills.invoiceExtraction, skills.reimbursementReview, skills.reportReconciliation],
    approvalPolicy: '超过额度或异常单据必须人工复核。'
  },
  {
    templateId: 'template_executive_assistant',
    version: '1.0.0',
    name: 'AI 行政助理',
    industry: '行政支持',
    scenario: '会议纪要、日程协调和任务分派',
    description: '帮助管理者整理会议内容、协调日程并跟进分派事项。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '减少行政沟通成本，让重要事项能够及时分派和追踪。',
    knowledgeSources: ['会议纪要规范', '日程安排规则', '事项跟进表'],
    tools: ['日程系统', '会议文档'],
    skills: [skills.meetingSummary, skills.scheduleCoordination, skills.taskDelegation],
    approvalPolicy: '对外发送的日程和纪要需管理者确认。'
  },
  {
    templateId: 'template_data_research',
    version: '1.0.0',
    name: 'AI 数据研究专员',
    industry: '数据研究',
    scenario: '数据调研、研究报告和资料整理',
    description: '围绕指定主题进行资料检索、整理和报告输出。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '提高调研效率，稳定输出可复用的数据研究报告。',
    knowledgeSources: ['研究主题库', '引用规范', '历史研究报告'],
    tools: ['资料库', '报告模板'],
    skills: [skills.dataResearch, skills.reportGeneration, skills.proposalSupport],
    approvalPolicy: '对外使用的研究结论需人工复核。'
  }
];

export const serverRoleTemplateCatalogById = new Map(
  serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const)
);

