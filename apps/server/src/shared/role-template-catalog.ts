export interface ServerRoleSkill {
  code: string;
  name: string;
  summary: string;
}

export type ServerRoleTemplateStepType =
  | 'input'
  | 'reasoning'
  | 'knowledge'
  | 'tool'
  | 'approval'
  | 'output';

export interface ServerRoleTemplateWorkflowStep {
  id: string;
  order: number;
  type: ServerRoleTemplateStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
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
  workflowSteps: ServerRoleTemplateWorkflowStep[];
  sampleInputs: string[];
  outputFormat: string;
  approvalPolicy: string;
  allowedPlanCodes: string[];
}

type BaseServerRoleTemplateCatalogEntry = Omit<
  ServerRoleTemplateCatalogEntry,
  'workflowSteps' | 'sampleInputs' | 'outputFormat' | 'allowedPlanCodes'
> & {
  workflowSteps?: ServerRoleTemplateWorkflowStep[];
  sampleInputs?: string[];
  outputFormat?: string;
  allowedPlanCodes?: string[];
};

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

const additionalSkills = {
  catalogOptimization: skill('catalog_optimization', '商品资料优化', '整理商品卖点、标题、详情页结构和发布建议。'),
  orderIssueTriage: skill('order_issue_triage', '订单问题分流', '识别订单、退款、物流和售后问题并给出处理优先级。'),
  campaignRecap: skill('campaign_recap', '活动复盘', '汇总活动数据、异常问题和下一轮优化动作。'),
  privateDomainTagging: skill('private_domain_tagging', '私域标签整理', '根据沟通记录识别客户标签、阶段和风险。'),
  communityReplyDrafting: skill('community_reply_drafting', '社群回复草拟', '生成符合品牌口径的社群回复和触达文案。'),
  conversionPlanning: skill('conversion_planning', '转化动作规划', '输出分层转化路径、跟进节奏和触达建议。'),
  documentClassification: skill('document_classification', '文档归类', '按企业规则识别文件类型、主题和归档位置。'),
  documentExtraction: skill('document_extraction', '文档信息提取', '从文档中提取关键字段、结论和待办事项。'),
  archiveChecklist: skill('archive_checklist', '归档检查', '检查命名、版本、缺失材料和后续处理要求。'),
  proposalStructuring: skill('proposal_structuring', '方案结构设计', '把客户需求拆解成方案目录、目标和交付范围。'),
  valueProposition: skill('value_proposition', '价值表达', '提炼客户痛点、解决路径、产品价值和差异化卖点。'),
  deliveryPlan: skill('delivery_plan', '交付计划', '生成实施计划、里程碑、风险和验收标准。'),
  qualityRuleCheck: skill('quality_rule_check', '质检规则检查', '根据质检标准识别违规、遗漏和高风险项。'),
  sampleReview: skill('sample_review', '样本复核', '抽查内容、记录问题并给出证据和改进建议。'),
  correctionAdvice: skill('correction_advice', '整改建议', '输出责任归因、整改动作和复检重点。'),
  companyResearch: skill('company_research', '企业调研', '检索并整理目标企业背景、业务、融资和竞争信息。'),
  industryBriefing: skill('industry_briefing', '行业简报', '汇总行业趋势、机会、风险和可引用来源。'),
  competitorComparison: skill('competitor_comparison', '竞品对比', '形成竞品矩阵、优劣势和行动建议。')
} as const;

function inferWorkflowToolIds(template: BaseServerRoleTemplateCatalogEntry): string[] {
  const text = [
    template.templateId,
    template.scenario,
    template.description,
    ...template.skills.map((item) => item.code)
  ]
    .join(' ')
    .toLowerCase();
  const toolIds: string[] = [];

  if (
    text.includes('research') ||
    text.includes('lead') ||
    text.includes('company') ||
    text.includes('industry') ||
    text.includes('competitor')
  ) {
    toolIds.push('web-search');
  }

  if (
    text.includes('draft') ||
    text.includes('proposal') ||
    text.includes('document') ||
    text.includes('contract') ||
    text.includes('resume') ||
    text.includes('invoice') ||
    text.includes('report') ||
    text.includes('content')
  ) {
    toolIds.push('office-document');
  }

  if (
    text.includes('file') ||
    text.includes('case') ||
    text.includes('finance') ||
    text.includes('document') ||
    text.includes('archive') ||
    text.includes('sample')
  ) {
    toolIds.push('local-filesystem');
  }

  return toolIds.length > 0 ? [...new Set(toolIds)] : ['office-document'];
}

function defaultWorkflowSteps(template: BaseServerRoleTemplateCatalogEntry): ServerRoleTemplateWorkflowStep[] {
  const toolIds = inferWorkflowToolIds(template);

  return [
    {
      id: 'receive_input',
      order: 1,
      type: 'input',
      name: '接收任务',
      instruction: `确认用户输入、目标、边界和交付物要求：${template.scenario}。`
    },
    {
      id: 'gather_context',
      order: 2,
      type: 'knowledge',
      name: '读取知识',
      instruction: `优先读取企业已授权知识：${template.knowledgeSources.join('、') || '企业知识库'}。`
    },
    {
      id: 'analyze_plan',
      order: 3,
      type: 'reasoning',
      name: '分析与计划',
      instruction: `围绕业务目标拆解任务，选择匹配技能：${template.skills.map((item) => item.name).join('、')}。`
    },
    {
      id: 'use_tools',
      order: 4,
      type: 'tool',
      name: '调用工具',
      instruction: `只在必要时调用已授权工具，工具输出必须回填到最终结果。`,
      toolIds
    },
    {
      id: 'human_check',
      order: 5,
      type: 'approval',
      name: '人工确认',
      instruction: template.approvalPolicy,
      requiresApproval: true
    },
    {
      id: 'deliver_output',
      order: 6,
      type: 'output',
      name: '输出交付物',
      instruction: '输出结构化结果、依据、风险提示、下一步动作和可下载本地文件路径。'
    }
  ];
}

function allowedPlanCodesFrom(planCode: string): string[] {
  switch (planCode) {
    case 'PERSONAL_FREE':
      return ['PERSONAL_FREE'];
    case 'ENTERPRISE_BASIC_MONTHLY':
    case 'ENTERPRISE_BASIC_ANNUAL':
      return [
        'ENTERPRISE_BASIC_MONTHLY',
        'ENTERPRISE_BASIC_ANNUAL',
        'ENTERPRISE_STANDARD_MONTHLY',
        'ENTERPRISE_STANDARD_ANNUAL',
        'ENTERPRISE_PRO_MONTHLY',
        'ENTERPRISE_PRO_ANNUAL',
        'ENTERPRISE_CUSTOM'
      ];
    case 'ENTERPRISE_STANDARD_MONTHLY':
    case 'ENTERPRISE_STANDARD_ANNUAL':
      return [
        'ENTERPRISE_STANDARD_MONTHLY',
        'ENTERPRISE_STANDARD_ANNUAL',
        'ENTERPRISE_PRO_MONTHLY',
        'ENTERPRISE_PRO_ANNUAL',
        'ENTERPRISE_CUSTOM'
      ];
    case 'ENTERPRISE_PRO_MONTHLY':
    case 'ENTERPRISE_PRO_ANNUAL':
      return ['ENTERPRISE_PRO_MONTHLY', 'ENTERPRISE_PRO_ANNUAL', 'ENTERPRISE_CUSTOM'];
    default:
      return [planCode];
  }
}

function completeCatalogEntry(
  template: BaseServerRoleTemplateCatalogEntry
): ServerRoleTemplateCatalogEntry {
  return {
    ...template,
    workflowSteps: template.workflowSteps ?? defaultWorkflowSteps(template),
    sampleInputs: template.sampleInputs ?? [
      `请按「${template.name}」的标准处理这个任务：${template.scenario}。`,
      `基于企业资料，输出一份可直接给负责人确认的${template.industry}工作结果。`
    ],
    outputFormat:
      template.outputFormat ??
      'Markdown report with summary, key findings, decisions needed, risks, next actions, and local artifact links.',
    allowedPlanCodes: template.allowedPlanCodes ?? allowedPlanCodesFrom(template.recommendedPlanCode)
  };
}

const baseServerRoleTemplateCatalog: BaseServerRoleTemplateCatalogEntry[] = [
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
    templateId: 'template_ecommerce_operator',
    version: '1.0.0',
    name: 'AI 电商运营专员',
    industry: '电商运营',
    scenario: '商品资料优化、订单问题分流、活动复盘',
    description: '协助电商团队整理商品卖点、处理订单售后线索，并形成活动复盘和优化建议。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '提升商品上架、售后分流和活动复盘效率，让运营动作更稳定可追踪。',
    knowledgeSources: ['商品资料库', '店铺运营规则', '售后处理标准', '历史活动数据'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.catalogOptimization,
      additionalSkills.orderIssueTriage,
      additionalSkills.campaignRecap
    ],
    sampleInputs: [
      '请根据这批新品资料，生成电商商品标题、卖点、详情页结构和风险提醒。',
      '请整理本周售后问题，按退款、物流、质量、咨询分流并给出处理优先级。'
    ],
    outputFormat: '商品优化表、订单问题分流表、活动复盘报告和下一轮运营动作清单。',
    approvalPolicy: '涉及价格、承诺、退款和对外发布内容时必须由运营负责人确认。'
  },
  {
    templateId: 'template_private_domain_operator',
    version: '1.0.0',
    name: 'AI 私域运营专员',
    industry: '私域与社群运营',
    scenario: '客户标签整理、社群回复草拟、转化动作规划',
    description: '把私域沟通记录整理成客户标签、阶段判断、触达话术和转化计划。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '降低私域跟进成本，提升客户分层、触达和转化动作的稳定性。',
    knowledgeSources: ['客户分层规则', '品牌话术库', '活动政策', '历史成交案例'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.privateDomainTagging,
      additionalSkills.communityReplyDrafting,
      additionalSkills.conversionPlanning
    ],
    sampleInputs: [
      '请根据这批微信沟通记录，整理客户标签、购买阶段和下一步触达建议。',
      '请为本周社群活动生成三组回复话术、风险提醒和转化节奏。'
    ],
    outputFormat: '客户标签表、触达话术、转化路径和需要人工确认的风险点。',
    approvalPolicy: '涉及价格承诺、医疗/法律/财务建议或大额权益时必须人工确认。'
  },
  {
    templateId: 'template_document_organizer',
    version: '1.0.0',
    name: 'AI 文档整理专员',
    industry: '办公与知识管理',
    scenario: '文档归类、信息提取、归档检查',
    description: '处理企业本地文件和资料，把零散文档整理为结构化摘要、归档建议和待办清单。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '减少文档查找和重复整理时间，让企业资料能被后续数字员工稳定复用。',
    knowledgeSources: ['文件命名规范', '归档目录规则', '部门资料说明', '历史项目文档'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.documentClassification,
      additionalSkills.documentExtraction,
      additionalSkills.archiveChecklist
    ],
    sampleInputs: [
      '请整理这个项目文件夹，输出文档分类、关键摘要、缺失材料和归档建议。',
      '请从这份会议材料中提取决策、待办、负责人和截止时间。'
    ],
    outputFormat: '文档索引表、结构化摘要、缺失材料清单、归档路径建议。',
    approvalPolicy: '移动、删除或覆盖企业原始文件前必须人工确认。'
  },
  {
    templateId: 'template_proposal_specialist',
    version: '1.0.0',
    name: 'AI 方案顾问',
    industry: '售前与解决方案',
    scenario: '需求拆解、方案结构、价值表达和交付计划',
    description: '把客户需求、产品资料和案例整理为可沟通的方案提纲、报价前置材料和实施计划。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提升售前方案输出速度，统一客户需求分析、价值表达和交付范围。',
    knowledgeSources: ['产品卖点库', '客户需求记录', '成功案例', '交付标准'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.proposalStructuring,
      additionalSkills.valueProposition,
      additionalSkills.deliveryPlan
    ],
    sampleInputs: [
      '请根据客户访谈记录，生成一版数字员工落地方案提纲和实施计划。',
      '请把这些产品资料整理成面向制造业客户的售前方案。'
    ],
    outputFormat: '方案目录、客户痛点、解决路径、交付范围、里程碑、风险和验收标准。',
    approvalPolicy: '正式对外发送方案、报价、工期和承诺前必须由负责人确认。'
  },
  {
    templateId: 'template_quality_inspector',
    version: '1.0.0',
    name: 'AI 质检专员',
    industry: '质检与合规',
    scenario: '质检规则检查、样本复核、整改建议',
    description: '按企业质检标准检查内容、话术、文档或流程样本，输出问题证据和整改建议。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '提升质检覆盖率和问题发现效率，形成可复检的整改闭环。',
    knowledgeSources: ['质检标准', '违规案例库', '流程规范', '整改模板'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.qualityRuleCheck,
      additionalSkills.sampleReview,
      additionalSkills.correctionAdvice
    ],
    sampleInputs: [
      '请按客服质检标准检查这批沟通记录，列出违规项、证据和整改建议。',
      '请抽查这份交付文档是否符合企业标准，并输出复检清单。'
    ],
    outputFormat: '质检问题表、证据摘录、风险等级、责任建议、整改动作和复检清单。',
    approvalPolicy: '涉及处罚、责任认定或对外合规结论时必须人工复核。'
  },
  {
    templateId: 'template_enterprise_researcher',
    version: '1.0.0',
    name: 'AI 企业调研员',
    industry: '市场与战略研究',
    scenario: '企业调研、行业简报、竞品对比',
    description: '围绕目标公司、行业或竞品进行资料检索、信息归纳和可引用简报输出。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '提升市场调研、客户背景调查和竞品分析的速度与复用价值。',
    knowledgeSources: ['调研主题库', '引用规范', '历史研究报告', '客户画像'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.companyResearch,
      additionalSkills.industryBriefing,
      additionalSkills.competitorComparison
    ],
    sampleInputs: [
      '请调研这家目标企业的业务、客户、近期动态和潜在合作切入点。',
      '请做一份行业简报，包含趋势、机会、风险、竞品和可引用来源。'
    ],
    outputFormat: '调研简报、来源列表、竞品矩阵、风险提示和下一步行动建议。',
    approvalPolicy: '对外引用、投资判断和战略结论必须由负责人复核。'
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

export const serverRoleTemplateCatalog: ServerRoleTemplateCatalogEntry[] =
  baseServerRoleTemplateCatalog.map(completeCatalogEntry);

export const serverRoleTemplateCatalogById = new Map(
  serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const)
);
