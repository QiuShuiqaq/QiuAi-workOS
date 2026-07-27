import type { ServerRoleWorkflowGraph } from './workflow-graph';

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
  workflowGraph: ServerRoleWorkflowGraph;
  sampleInputs: string[];
  outputFormat: string;
  approvalPolicy: string;
  allowedPlanCodes: string[];
}

type BaseServerRoleTemplateCatalogEntry = Omit<
  ServerRoleTemplateCatalogEntry,
  'workflowSteps' | 'workflowGraph' | 'sampleInputs' | 'outputFormat' | 'allowedPlanCodes'
> & {
  workflowSteps?: ServerRoleTemplateWorkflowStep[];
  workflowGraph?: ServerRoleWorkflowGraph;
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
  competitorComparison: skill('competitor_comparison', '竞品对比', '形成竞品矩阵、优劣势和行动建议。'),
  customerIntentTriage: skill('customer_intent_triage', '客户意图分流', '识别咨询、投诉、售后、退款和高风险情绪。'),
  supportReplyDrafting: skill('support_reply_drafting', '客服回复草拟', '生成符合品牌口径的多轮客服回复和补充追问。'),
  knowledgeBaseImprovement: skill('knowledge_base_improvement', '知识库补全', '沉淀高频问题、缺失答案和知识库更新建议。'),
  seoKeywordResearch: skill('seo_keyword_research', 'SEO 关键词研究', '整理关键词、搜索意图、内容缺口和优先级。'),
  searchContentBrief: skill('search_content_brief', '搜索内容简报', '生成面向自然搜索的文章结构、标题和摘要。'),
  growthExperimentRecap: skill('growth_experiment_recap', '增长实验复盘', '汇总实验数据、结论、风险和下一轮动作。'),
  productRequirementDrafting: skill('product_requirement_drafting', '需求文档草拟', '把用户反馈和业务目标整理为 PRD、用户故事和验收标准。'),
  roadmapPrioritization: skill('roadmap_prioritization', '路线图排序', '按价值、成本、风险和依赖关系排序产品需求。'),
  acceptanceCriteria: skill('acceptance_criteria', '验收标准', '输出清晰可测试的验收标准和边界条件。'),
  projectPlanning: skill('project_planning', '项目计划', '拆解里程碑、任务、负责人、依赖和时间风险。'),
  riskTracking: skill('risk_tracking', '风险跟踪', '识别项目风险、阻塞项、影响范围和应对动作。'),
  weeklyStatusReporting: skill('weekly_status_reporting', '周报汇总', '生成项目周报、进展摘要、问题清单和下周计划。'),
  itIssueDiagnosis: skill('it_issue_diagnosis', 'IT 问题诊断', '根据现象、环境和日志定位常见 IT 问题方向。'),
  runbookExecution: skill('runbook_execution', '运维手册执行', '按标准操作手册输出排查步骤、确认项和升级条件。'),
  accessRequestReview: skill('access_request_review', '权限申请复核', '检查账号、系统、权限范围和审批证据是否完整。'),
  supplierResearch: skill('supplier_research', '供应商调研', '整理供应商资质、产品能力、风险和备选方案。'),
  quoteComparison: skill('quote_comparison', '报价对比', '对比报价、付款条件、交期、风险和议价空间。'),
  purchaseChecklist: skill('purchase_checklist', '采购清单', '生成采购规格、验收标准、合同注意点和决策建议。'),
  inventoryExceptionAnalysis: skill('inventory_exception_analysis', '库存异常分析', '识别缺货、积压、周转异常和补货风险。'),
  logisticsTrackingSummary: skill('logistics_tracking_summary', '物流跟踪汇总', '汇总运输节点、异常原因、影响订单和处理建议。'),
  replenishmentPlanning: skill('replenishment_planning', '补货计划', '生成补货优先级、安全库存和执行清单。'),
  productionPlanReview: skill('production_plan_review', '生产计划复核', '检查产能、物料、工序、交期和风险。'),
  workOrderSummary: skill('work_order_summary', '工单汇总', '整理生产工单进展、异常、责任人和下一步动作。'),
  defectRootCause: skill('defect_root_cause', '缺陷归因', '根据质检和生产记录归纳缺陷原因和改善建议。'),
  courseOutlineDesign: skill('course_outline_design', '课程大纲设计', '把培训目标拆成课程模块、练习和交付标准。'),
  learningMaterialDrafting: skill('learning_material_drafting', '培训材料草拟', '生成课件大纲、讲义、测验和作业说明。'),
  learningAssessment: skill('learning_assessment', '学习评估', '整理学员反馈、测验结果和改进建议。'),
  medicalRecordStructuring: skill('medical_record_structuring', '病历信息整理', '把非诊断类资料整理成结构化摘要和待确认事项。'),
  appointmentFollowup: skill('appointment_followup', '预约随访整理', '整理预约、随访、提醒和服务记录。'),
  complianceReminder: skill('compliance_reminder', '合规提醒', '提示医疗、隐私和对外沟通中的合规边界。'),
  auditEvidenceChecklist: skill('audit_evidence_checklist', '审计证据清单', '整理制度、记录、凭证和缺失证据。'),
  policyGapAnalysis: skill('policy_gap_analysis', '制度差距分析', '识别制度、流程和执行记录之间的缺口。'),
  remediationTracking: skill('remediation_tracking', '整改跟踪', '输出整改任务、责任人、截止日期和复核标准。'),
  spreadsheetAnalysis: skill('spreadsheet_analysis', '表格分析', '读取表格字段、指标、异常值和趋势。'),
  metricDashboardBrief: skill('metric_dashboard_brief', '指标看板简报', '生成指标摘要、变化原因、风险和行动建议。'),
  dataCleaningPlan: skill('data_cleaning_plan', '数据清洗计划', '识别缺失、重复、异常和字段标准化动作。'),
  brandBriefing: skill('brand_briefing', '品牌简报', '整理品牌定位、受众、风格关键词和传播目标。'),
  creativeDirection: skill('creative_direction', '创意方向', '生成创意概念、视觉方向、文案方向和素材清单。'),
  designReviewChecklist: skill('design_review_checklist', '设计审核清单', '检查视觉、信息层级、合规和交付规格。')
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

function inferWorkflowArtifactType(
  template: BaseServerRoleTemplateCatalogEntry,
  workflowSteps: ServerRoleTemplateWorkflowStep[]
): NonNullable<ServerRoleWorkflowGraph['nodes'][number]['artifactType']> {
  const text = [
    template.templateId,
    template.name,
    template.industry,
    template.scenario,
    template.description,
    template.outputFormat,
    ...template.skills.flatMap((item) => [item.code, item.name, item.summary]),
    ...workflowSteps.flatMap((step) => [step.id, step.name, step.instruction, ...(step.toolIds ?? [])])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(ppt|pptx|slides?|presentation|course|training)\b/.test(text)) {
    return 'pptx';
  }

  if (/\b(video|mp4|clip|trim|ffmpeg|cut_plan)\b/.test(text)) {
    return 'mp4';
  }

  if (
    /\b(xlsx?|spreadsheet|csv|excel|finance|invoice|reimbursement|inventory|metrics?|dashboard|quote|reconciliation)\b/.test(
      text
    )
  ) {
    return 'xlsx';
  }

  return 'docx';
}

function buildRunnableWorkflowGraphForTemplate(
  template: BaseServerRoleTemplateCatalogEntry,
  workflowSteps: ServerRoleTemplateWorkflowStep[]
): ServerRoleWorkflowGraph {
  const stepToolIds = workflowSteps.flatMap((step) => step.toolIds ?? []);
  const toolIds = [...new Set([...inferWorkflowToolIds(template), ...stepToolIds])];
  const hasWebSearch = toolIds.includes('web-search');
  const hasKnowledge = workflowSteps.some((step) => step.type === 'knowledge') || template.knowledgeSources.length > 0;
  const artifactType = inferWorkflowArtifactType(template, workflowSteps);
  const sourceInstruction = workflowSteps
    .map((step) => `${step.order}. ${step.name}: ${step.instruction}`)
    .join('\n');
  const nodes: ServerRoleWorkflowGraph['nodes'] = [
    {
      id: 'start',
      type: 'start',
      name: 'Start',
      description: 'Workflow entry node.'
    },
    {
      id: 'receive_input',
      type: 'input',
      name: 'Receive task',
      instruction: 'Normalize the user task, attached files, goal, constraints, and expected deliverable.',
      inputVariables: ['start.text', 'start.files'],
      outputVariables: ['task_brief'],
      config: {
        source: 'default_template_graph'
      }
    },
    ...(hasKnowledge
      ? [
          {
            id: 'gather_context',
            type: 'knowledge' as const,
            name: 'Gather context',
            instruction: `Read available knowledge context: ${template.knowledgeSources.join(', ') || 'workspace knowledge'}.`,
            inputVariables: ['start.text'],
            outputVariables: ['knowledge_context']
          }
        ]
      : []),
    ...(hasWebSearch
      ? [
          {
            id: 'web_research',
            type: 'tool' as const,
            name: 'Web research',
            instruction: 'Search web context when the task needs external or fresh information.',
            toolId: 'web-search',
            inputVariables: ['start.text'],
            outputVariables: ['web_context'],
            config: {
              action: 'web.search',
              input: {
                query: '{{start.text}}',
                maxResults: 5
              }
            }
          }
        ]
      : []),
    {
      id: 'draft_result',
      type: 'llm',
      name: 'Draft result',
      instruction:
        sourceInstruction ||
        `Complete the digital employee task for ${template.scenario} and produce a business-ready result.`,
      inputVariables: [
        'start.text',
        hasKnowledge ? 'gather_context.text' : undefined,
        hasWebSearch ? 'web_research.text' : undefined
      ].filter((value): value is string => Boolean(value)),
      outputVariables: ['draft_text']
    },
    {
      id: 'write_artifact',
      type: 'artifact',
      name: 'Write deliverable',
      instruction: `Write the final deliverable as ${artifactType}.`,
      toolId: artifactType === 'mp4' ? 'video-processing' : 'office-document',
      artifactType,
      inputVariables: ['draft_result.text'],
      outputVariables: ['deliverable_file']
    },
    {
      id: 'final_output',
      type: 'output',
      name: 'Final response',
      instruction: 'Summarize the completed work, mention generated local file paths, and list next actions.',
      inputVariables: ['draft_result.text', 'write_artifact.file'],
      outputVariables: ['final_answer']
    }
  ];
  const edges: ServerRoleWorkflowGraph['edges'] = [];
  let previousNodeId = 'start';

  for (const node of nodes.filter((node) => node.id !== 'start')) {
    edges.push({
      id: `${previousNodeId}__${node.id}`,
      sourceNodeId: previousNodeId,
      targetNodeId: node.id,
      condition: {
        type: 'always'
      }
    });
    previousNodeId = node.id;
  }

  return {
    version: '1.0.0',
    nodes,
    edges,
    entryNodeId: 'start',
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false
    }
  };
}

type OfficeProductionWorkflowArtifactType = Extract<
  NonNullable<ServerRoleWorkflowGraph['nodes'][number]['artifactType']>,
  'docx' | 'xlsx' | 'pptx' | 'pdf' | 'markdown'
>;

function graphEdge(sourceNodeId: string, targetNodeId: string): ServerRoleWorkflowGraph['edges'][number] {
  return {
    id: `${sourceNodeId}__${targetNodeId}`,
    sourceNodeId,
    targetNodeId,
    condition: {
      type: 'always'
    }
  };
}

function buildOfficeProductionWorkflowGraph(input: {
  artifactType: OfficeProductionWorkflowArtifactType;
  parameterSchema: Record<string, unknown>;
  analysisInstruction: string;
  draftInstruction: string;
  qualityInstruction: string;
  finalInstruction: string;
  includeWebSearch?: boolean;
}): ServerRoleWorkflowGraph {
  const nodes: ServerRoleWorkflowGraph['nodes'] = [
    {
      id: 'start',
      type: 'start',
      name: '开始'
    },
    {
      id: 'receive_input',
      type: 'input',
      name: '接收任务',
      instruction: '读取用户输入、拖入的附件、本次目标、限制条件和期望交付物。',
      inputVariables: ['start.text', 'start.files'],
      outputVariables: ['task_brief']
    },
    {
      id: 'extract_parameters',
      type: 'parameter_extractor',
      name: '提取任务参数',
      instruction: '把用户任务整理成结构化参数，字段缺失时返回 null，不要编造附件或外部信息。',
      modelProfileId: 'qiu-general-default',
      inputVariables: ['start.text', 'start.files'],
      outputVariables: ['task_parameters'],
      config: {
        schema: input.parameterSchema
      }
    },
    {
      id: 'gather_context',
      type: 'knowledge',
      name: '读取知识',
      instruction: '优先读取企业知识、本地知识和已配置资料，只提取与本次任务直接相关的内容。',
      inputVariables: ['start.text', 'extract_parameters.text'],
      outputVariables: ['knowledge_context']
    },
    {
      id: 'read_attachments',
      type: 'tool',
      name: '读取附件',
      instruction: '如果用户拖入了 Word、PDF、PPT、表格或文本附件，提取可读文本；没有附件时跳过。',
      toolId: 'office-document',
      inputVariables: ['start.files'],
      outputVariables: ['attachment_text'],
      config: {
        maxChars: 40000
      }
    },
    ...(input.includeWebSearch
      ? [
          {
            id: 'web_research',
            type: 'tool' as const,
            name: '联网检索',
            instruction: '根据任务参数检索公开资料，输出来源标题、链接和摘要。需要 PC 端已配置网页搜索服务。',
            toolId: 'web-search',
            inputVariables: ['start.text', 'extract_parameters.text'],
            outputVariables: ['web_context'],
            config: {
              action: 'web.search',
              input: {
                query: '{{start.text}}',
                maxResults: 5
              }
            }
          }
        ]
      : []),
    {
      id: 'analyze_work',
      type: 'llm',
      name: '分析与规划',
      instruction: input.analysisInstruction,
      modelProfileId: 'qiu-reasoning-default',
      inputVariables: [
        'start.text',
        'extract_parameters.text',
        'gather_context.text',
        'read_attachments.text',
        input.includeWebSearch ? 'web_research.text' : undefined
      ].filter((value): value is string => Boolean(value)),
      outputVariables: ['analysis_result']
    },
    {
      id: 'draft_deliverable',
      type: 'llm',
      name: '生成交付内容',
      instruction: input.draftInstruction,
      modelProfileId: 'qiu-general-default',
      inputVariables: ['analysis_result', 'knowledge_context', 'attachment_text'],
      outputVariables: ['deliverable_content']
    },
    {
      id: 'quality_check',
      type: 'llm',
      name: '自检修订',
      instruction: input.qualityInstruction,
      modelProfileId: 'qiu-general-default',
      inputVariables: ['deliverable_content', 'task_parameters'],
      outputVariables: ['quality_review']
    },
    {
      id: 'write_artifact',
      type: 'artifact',
      name: '生成文件',
      instruction: `把最终内容写成本地 ${input.artifactType} 文件，文件名使用任务标题。`,
      toolId: 'office-document',
      artifactType: input.artifactType,
      inputVariables: ['deliverable_content', 'quality_review'],
      outputVariables: ['deliverable_file']
    },
    {
      id: 'final_output',
      type: 'output',
      name: '返回结果',
      instruction: input.finalInstruction,
      modelProfileId: 'qiu-general-default',
      inputVariables: ['deliverable_content', 'quality_review', 'write_artifact.file'],
      outputVariables: ['final_answer']
    }
  ];

  return {
    version: '1.0.0',
    nodes,
    edges: nodes.slice(1).map((node, index) => graphEdge(nodes[index]!.id, node.id)),
    entryNodeId: 'start',
    variables: [
      { name: 'task_brief', type: 'text', description: '用户任务摘要', required: true },
      { name: 'task_parameters', type: 'json', description: '结构化任务参数', required: true },
      { name: 'knowledge_context', type: 'text', description: '企业和本地知识上下文' },
      { name: 'attachment_text', type: 'text', description: '附件提取文本' },
      { name: 'analysis_result', type: 'text', description: '分析和处理计划' },
      { name: 'deliverable_content', type: 'text', description: '最终交付内容' },
      { name: 'deliverable_file', type: 'artifact', description: '生成的本地文件' }
    ],
    runtimePolicy: {
      maxNodeExecutions: 32,
      maxLoopIterations: 4,
      requireApprovalBeforeTools: false
    }
  };
}

function buildVideoContentWorkflowGraph(): ServerRoleWorkflowGraph {
  return {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      {
        id: 'start',
        type: 'start',
        name: 'Start'
      },
      {
        id: 'receive_input',
        type: 'input',
        name: '接收任务',
        instruction: '读取用户上传的视频、本次剪辑目标、评分标准和输出要求。',
        inputVariables: ['start.text', 'start.files'],
        outputVariables: ['task_brief']
      },
      {
        id: 'collect_videos',
        type: 'list',
        name: '筛选视频',
        instruction: '从用户上传的附件里筛选视频文件，只传递本地路径，不上传视频本体。',
        inputVariables: ['start.files'],
        outputVariables: ['video_files'],
        config: {
          sourceRef: 'start.files',
          kind: 'video',
          limit: 10
        }
      },
      {
        id: 'current_video',
        type: 'iteration',
        name: '读取当前视频',
        instruction: '取出待处理的视频文件，后续节点通过 runtime.current_item.localPath 读取本地路径。',
        inputVariables: ['collect_videos.items'],
        outputVariables: ['current_video'],
        config: {
          sourceRef: 'collect_videos.items'
        }
      },
      {
        id: 'probe_video',
        type: 'tool',
        name: '读取视频信息',
        instruction: '调用本地视频工具读取文件名、大小和基础元信息。',
        toolId: 'video-processing',
        inputVariables: ['runtime.current_item'],
        outputVariables: ['video_metadata'],
        config: {
          action: 'video.probe',
          input: {
            videoPath: '$runtime.current_item.localPath'
          }
        }
      },
      {
        id: 'extract_frames',
        type: 'tool',
        name: '抽取关键帧',
        instruction: '调用本地 FFmpeg 抽取关键帧，输出图片路径数组，供多模态模型理解视频内容。',
        toolId: 'video-processing',
        inputVariables: ['runtime.current_item'],
        outputVariables: ['video_frames'],
        config: {
          action: 'video.extract_frames',
          input: {
            videoPath: '$runtime.current_item.localPath',
            frameIntervalSeconds: 5,
            maxFrames: 12,
            folder: 'frames',
            fileName: '{{task.title}}'
          }
        }
      },
      {
        id: 'analyze_video',
        type: 'llm',
        name: '视频理解与评分',
        instruction: [
          '根据任务要求、视频信息和关键帧路径分析视频内容。',
          '必须返回 JSON，不要使用 markdown 代码块。',
          '字段：summary、score、qualityIssues、cutPlan、editNotes、finalRecommendation。',
          'cutPlan 必须是数组，每项包含 start、end、reason，默认总时长控制在 15 秒左右。'
        ].join('\n'),
        modelProfileId: 'qiu-vision-default',
        inputVariables: ['start.text', 'probe_video.result', 'extract_frames.result', 'runtime.current_item'],
        outputVariables: ['video_analysis']
      },
      {
        id: 'export_video',
        type: 'artifact',
        name: '导出剪辑视频',
        instruction: '根据 analyze_video.json.cutPlan 调用本地 FFmpeg 生成 MP4 成品。',
        toolId: 'video-processing',
        artifactType: 'mp4',
        inputVariables: ['runtime.current_item', 'analyze_video.json'],
        outputVariables: ['final_video'],
        config: {
          action: 'video.compose_clips',
          input: {
            videoPath: '$runtime.current_item.localPath',
            cutPlan: '$analyze_video.json.cutPlan',
            folder: 'videos',
            fileName: '{{task.title}}-15s'
          }
        }
      },
      {
        id: 'final_output',
        type: 'output',
        name: '返回结果',
        instruction: '用中文总结视频评分、剪辑理由、风险提醒和生成文件路径。',
        inputVariables: ['analyze_video.text', 'export_video.file'],
        outputVariables: ['final_answer']
      }
    ],
    edges: [
      { id: 'start__receive_input', sourceNodeId: 'start', targetNodeId: 'receive_input', condition: { type: 'always' } },
      { id: 'receive_input__collect_videos', sourceNodeId: 'receive_input', targetNodeId: 'collect_videos', condition: { type: 'always' } },
      { id: 'collect_videos__current_video', sourceNodeId: 'collect_videos', targetNodeId: 'current_video', condition: { type: 'always' } },
      { id: 'current_video__probe_video', sourceNodeId: 'current_video', targetNodeId: 'probe_video', condition: { type: 'always' } },
      { id: 'probe_video__extract_frames', sourceNodeId: 'probe_video', targetNodeId: 'extract_frames', condition: { type: 'always' } },
      { id: 'extract_frames__analyze_video', sourceNodeId: 'extract_frames', targetNodeId: 'analyze_video', condition: { type: 'always' } },
      { id: 'analyze_video__export_video', sourceNodeId: 'analyze_video', targetNodeId: 'export_video', condition: { type: 'exists', variable: 'analyze_video.json.cutPlan' } },
      { id: 'export_video__final_output', sourceNodeId: 'export_video', targetNodeId: 'final_output', condition: { type: 'always' } }
    ],
    runtimePolicy: {
      maxNodeExecutions: 24,
      maxLoopIterations: 10,
      requireApprovalBeforeTools: false
    }
  };
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
  const workflowSteps = template.workflowSteps ?? defaultWorkflowSteps(template);

  return {
    ...template,
    workflowSteps,
    workflowGraph: template.workflowGraph ?? buildRunnableWorkflowGraphForTemplate(template, workflowSteps),
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
    workflowGraph: buildOfficeProductionWorkflowGraph({
      artifactType: 'xlsx',
      parameterSchema: {
        documentScope: '需要整理的文件、文件夹或附件范围',
        classifyBy: '分类规则或业务维度',
        requiredFields: '需要提取的字段',
        missingMaterialRules: '缺失材料判断规则',
        archiveTarget: '建议归档目录，缺失时为 null'
      },
      analysisInstruction:
        '根据附件文本、企业归档规则和用户目标，判断文档类型、所属业务、关键字段、缺失材料、归档建议和待办事项。',
      draftInstruction:
        '生成适合 Excel 的结构化内容。第一部分是文档索引表，字段包含文件/主题、类型、摘要、关键字段、责任人、建议归档路径、风险；第二部分是缺失材料清单；第三部分是待办清单。',
      qualityInstruction:
        '检查分类是否清晰、字段是否可落表、是否包含移动/删除原文件等高风险动作；高风险动作必须标记为“需人工确认”。',
      finalInstruction:
        '返回 Excel 文件位置、整理了哪些内容、缺失材料数量、需要人工确认的归档动作和下一步建议。'
    }),
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
    workflowGraph: buildOfficeProductionWorkflowGraph({
      artifactType: 'pptx',
      parameterSchema: {
        customerProfile: '客户行业、规模、角色和当前背景',
        painPoints: '客户痛点列表',
        productScope: '可用产品、服务或数字员工范围',
        proposalGoal: '本次方案要达成的目标',
        deliveryDeadline: '交付时间或演示时间，缺失时为 null'
      },
      analysisInstruction:
        '基于客户需求、附件资料和企业知识，拆解客户目标、关键痛点、决策人关注点、方案边界、交付风险和验收口径。输出结构化分析，不要直接写 PPT。',
      draftInstruction:
        '生成可直接写入 PPT 的方案内容。必须包含：封面标题、客户背景、痛点、解决方案架构、数字员工/功能模块、实施里程碑、交付物、风险与保障、下一步建议。每页用“Slide: 标题 + bullets”组织。',
      qualityInstruction:
        '检查方案是否存在过度承诺、报价/工期不确定、客户行业不匹配、缺少验收标准的问题，并给出修订后的最终要点。',
      finalInstruction:
        '用中文返回方案已生成、PPT 文件位置、核心卖点、需要人工确认的报价/工期/承诺事项和下一步沟通建议。',
      includeWebSearch: true
    }),
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
    workflowGraph: buildOfficeProductionWorkflowGraph({
      artifactType: 'docx',
      parameterSchema: {
        researchTarget: '公司、行业、产品或竞品名称',
        researchQuestions: '需要回答的问题列表',
        geography: '地区范围，缺失时为 null',
        timeRange: '时间范围或最新资料要求',
        outputAudience: '报告读者或使用场景'
      },
      analysisInstruction:
        '结合企业知识、附件和联网检索资料，提炼可信事实、来源线索、矛盾信息、竞品维度、机会点、风险点和待验证问题。',
      draftInstruction:
        '生成一份可交付的调研 Word 报告。必须包含：执行摘要、目标概况、关键事实、来源列表、竞品对比矩阵、机会与风险、适合销售/战略/运营使用的下一步动作。',
      qualityInstruction:
        '检查每个外部事实是否有来源提示；把不确定内容标记为“待验证”；删除无法支持的重要结论或改写成假设。',
      finalInstruction:
        '返回 Word 文件位置、最重要的 3 条结论、待验证问题和下一步行动建议。',
      includeWebSearch: true
    }),
    approvalPolicy: '对外引用、投资判断和战略结论必须由负责人复核。'
  },
  {
    templateId: 'template_customer_support_agent',
    version: '1.0.0',
    name: 'AI 客服支持专员',
    industry: '客服与售后',
    scenario: '客户意图分流、回复草拟、知识库补全',
    description: '整理客户咨询和投诉记录，识别问题类型、情绪风险和处理优先级，生成客服回复与知识库补全建议。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '降低客服重复回复成本，提升问题分流、升级和知识库沉淀效率。',
    knowledgeSources: ['客服话术库', '售后政策', '产品 FAQ', '历史工单'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.customerIntentTriage,
      additionalSkills.supportReplyDrafting,
      additionalSkills.knowledgeBaseImprovement
    ],
    sampleInputs: [
      '请整理这批客服聊天记录，按咨询、售后、退款、投诉和高风险情绪分组，并生成处理建议。',
      '请根据这 20 条高频问题，生成客服回复模板和需要补充到知识库的条目。'
    ],
    outputFormat: '问题分流表、客户情绪风险、建议回复、升级条件、知识库补全清单。',
    workflowGraph: buildOfficeProductionWorkflowGraph({
      artifactType: 'docx',
      parameterSchema: {
        sourceType: '聊天记录、工单、FAQ 或投诉材料',
        issueCategories: '用户指定的问题分类',
        riskSignals: '退款、投诉、情绪、舆情、合规等风险信号',
        replyTone: '回复语气要求',
        escalationPolicy: '升级规则，缺失时为 null'
      },
      analysisInstruction:
        '读取客服记录和政策知识，识别客户意图、问题分类、情绪风险、责任边界、是否需要升级和缺失的知识库条目。',
      draftInstruction:
        '生成客服处理文档。必须包含：问题分流表、优先级、建议回复、需要补问的信息、升级条件、禁止承诺事项、知识库补全清单。',
      qualityInstruction:
        '检查回复是否越权承诺退款/赔偿/结果，是否包含敏感或不确定表述；把需要人工确认的内容单独列出。',
      finalInstruction:
        '返回 Word 文件位置、分流结果摘要、高风险客户/问题、需要人工确认的回复和知识库补全建议。'
    }),
    approvalPolicy: '涉及退款、赔偿、承诺、投诉升级和敏感客户时必须人工确认。'
  },
  {
    templateId: 'template_seo_growth_specialist',
    version: '1.0.0',
    name: 'AI SEO 增长专员',
    industry: '市场增长',
    scenario: '关键词研究、搜索内容简报、增长实验复盘',
    description: '围绕产品和行业主题整理关键词、搜索意图、内容机会和实验复盘，输出可执行增长内容计划。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '帮助企业低成本规划自然搜索内容，提高内容选题、页面结构和实验复盘质量。',
    knowledgeSources: ['产品资料', '目标客户画像', '历史内容数据', '竞品页面资料'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.seoKeywordResearch,
      additionalSkills.searchContentBrief,
      additionalSkills.growthExperimentRecap
    ],
    sampleInputs: [
      '请围绕“企业数字员工”做一组 SEO 关键词研究，并输出内容优先级。',
      '请把这批历史文章数据整理成增长复盘，给出下一轮内容选题。'
    ],
    outputFormat: '关键词矩阵、搜索意图、内容简报、标题建议、实验复盘和下一步动作。',
    approvalPolicy: '对外发布内容、竞品结论和效果承诺必须由市场负责人确认。'
  },
  {
    templateId: 'template_product_manager',
    version: '1.0.0',
    name: 'AI 产品经理',
    industry: '产品管理',
    scenario: '用户反馈整理、PRD 草拟、路线图排序和验收标准',
    description: '把业务需求、用户反馈和竞品信息整理成需求文档、用户故事、验收标准和优先级建议。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提升需求澄清、文档输出和产品决策效率，让研发能拿到更清晰的输入。',
    knowledgeSources: ['用户反馈', '产品说明', '竞品资料', '研发约束'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.productRequirementDrafting,
      additionalSkills.roadmapPrioritization,
      additionalSkills.acceptanceCriteria
    ],
    sampleInputs: [
      '请根据这批用户反馈，整理一个 PRD 草案，包含目标、范围、用户故事和验收标准。',
      '请把这些需求按业务价值、实现成本和风险排序，输出下个版本建议路线图。'
    ],
    outputFormat: 'PRD 草案、用户故事、验收标准、优先级矩阵、风险和待确认问题。',
    approvalPolicy: '进入研发排期前必须由产品负责人和技术负责人确认。'
  },
  {
    templateId: 'template_project_manager',
    version: '1.0.0',
    name: 'AI 项目经理',
    industry: '项目管理',
    scenario: '项目计划、风险跟踪、周报汇总',
    description: '根据项目资料和进展记录拆解计划、跟踪风险、整理周报和待办，帮助项目负责人保持节奏。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '减少项目沟通和汇总成本，提高里程碑、风险和责任人的透明度。',
    knowledgeSources: ['项目计划', '会议纪要', '任务清单', '交付标准'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.projectPlanning,
      additionalSkills.riskTracking,
      additionalSkills.weeklyStatusReporting
    ],
    sampleInputs: [
      '请根据项目会议纪要生成本周项目周报，包含进展、风险、阻塞和下周计划。',
      '请把这个实施项目拆解成里程碑、任务、负责人、依赖和验收标准。'
    ],
    outputFormat: '项目计划、周报、风险清单、阻塞项、责任人和下一步动作。',
    approvalPolicy: '涉及交付承诺、延期说明和资源调整时必须由项目负责人确认。'
  },
  {
    templateId: 'template_it_helpdesk',
    version: '1.0.0',
    name: 'AI IT 支持专员',
    industry: 'IT 与运维',
    scenario: 'IT 问题诊断、运维手册执行、权限申请复核',
    description: '整理内部 IT 工单、日志和标准手册，给出排查步骤、升级条件和权限申请复核建议。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提升一线 IT 工单处理效率，降低重复排查和权限审批风险。',
    knowledgeSources: ['IT 运维手册', '系统 FAQ', '权限矩阵', '历史工单'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.itIssueDiagnosis,
      additionalSkills.runbookExecution,
      additionalSkills.accessRequestReview
    ],
    sampleInputs: [
      '请根据这条故障描述和日志，给出一线 IT 排查步骤、可能原因和升级条件。',
      '请复核这批权限申请，检查系统、角色、权限范围和审批证据是否完整。'
    ],
    outputFormat: '故障诊断步骤、确认项、升级条件、权限复核表和风险提示。',
    approvalPolicy: '涉及生产系统变更、管理员权限和安全策略调整时必须人工审批。'
  },
  {
    templateId: 'template_procurement_assistant',
    version: '1.0.0',
    name: 'AI 采购助理',
    industry: '采购管理',
    scenario: '供应商调研、报价对比、采购清单生成',
    description: '协助采购整理供应商资料、对比报价和付款条件，生成采购建议与验收清单。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提升供应商筛选和报价对比效率，降低采购决策遗漏风险。',
    knowledgeSources: ['采购制度', '供应商库', '报价单', '合同模板'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.supplierResearch,
      additionalSkills.quoteComparison,
      additionalSkills.purchaseChecklist
    ],
    sampleInputs: [
      '请对比这三份供应商报价，输出价格、交期、付款、风险和推荐方案。',
      '请根据采购需求生成供应商调研清单、验收标准和合同注意点。'
    ],
    outputFormat: '供应商对比表、报价分析、风险清单、采购规格、验收标准和推荐结论。',
    approvalPolicy: '涉及最终供应商选择、付款条件和合同条款时必须由采购负责人确认。'
  },
  {
    templateId: 'template_inventory_logistics',
    version: '1.0.0',
    name: 'AI 库存物流专员',
    industry: '供应链与物流',
    scenario: '库存异常分析、物流跟踪汇总、补货计划',
    description: '根据库存、订单和物流记录识别缺货、积压、运输异常和补货优先级。',
    recommendedPlanCode: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提高库存和物流异常处理效率，减少缺货、积压和订单延误。',
    knowledgeSources: ['库存台账', '订单记录', '物流节点', '补货规则'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.inventoryExceptionAnalysis,
      additionalSkills.logisticsTrackingSummary,
      additionalSkills.replenishmentPlanning
    ],
    sampleInputs: [
      '请分析这份库存表，找出缺货、积压、周转异常和补货优先级。',
      '请汇总这批异常物流订单，按影响客户、原因和处理动作排序。'
    ],
    outputFormat: '库存异常表、物流异常汇总、补货计划、客户影响和处理优先级。',
    approvalPolicy: '涉及采购补货、客户赔付和发货承诺时必须人工确认。'
  },
  {
    templateId: 'template_manufacturing_planner',
    version: '1.0.0',
    name: 'AI 生产计划专员',
    industry: '制造与生产',
    scenario: '生产计划复核、工单汇总、缺陷归因',
    description: '整理生产计划、工单进展和质检记录，识别交期、物料、产能和缺陷风险。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '提升生产计划复核和异常归因效率，帮助管理者更快发现交付风险。',
    knowledgeSources: ['生产计划', '工单记录', '物料清单', '质检记录'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.productionPlanReview,
      additionalSkills.workOrderSummary,
      additionalSkills.defectRootCause
    ],
    sampleInputs: [
      '请复核本周生产计划，检查产能、物料、工序、交期和风险。',
      '请根据质检记录和工单数据，归纳主要缺陷原因和改善动作。'
    ],
    outputFormat: '生产计划复核表、工单进展、异常风险、缺陷归因和改善建议。',
    approvalPolicy: '涉及排产调整、交期承诺和质量责任认定时必须由生产负责人确认。'
  },
  {
    templateId: 'template_training_designer',
    version: '1.0.0',
    name: 'AI 培训课程设计师',
    industry: '教育培训',
    scenario: '课程大纲设计、培训材料草拟、学习评估',
    description: '根据岗位能力目标设计培训课程、讲义、测验和评估方案，适合企业内部培训和客户培训。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '降低培训内容设计成本，提高课程结构、材料和评估的一致性。',
    knowledgeSources: ['岗位能力模型', '培训资料', '产品说明', '学员反馈'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.courseOutlineDesign,
      additionalSkills.learningMaterialDrafting,
      additionalSkills.learningAssessment
    ],
    sampleInputs: [
      '请为新销售设计一套 2 小时产品培训课，包含大纲、练习和测验。',
      '请根据这批学员反馈，整理培训复盘和下一版课程优化建议。'
    ],
    outputFormat: '课程大纲、讲义结构、练习题、测验题、评估标准和优化建议。',
    approvalPolicy: '对外客户培训材料和考试评价标准必须由培训负责人确认。'
  },
  {
    templateId: 'template_medical_admin_assistant',
    version: '1.0.0',
    name: 'AI 医疗运营助理',
    industry: '医疗服务运营',
    scenario: '非诊断资料整理、预约随访、合规提醒',
    description: '仅处理非诊断类运营资料，整理预约、随访、服务记录和待确认事项，提示隐私与合规边界。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '提升医疗服务运营资料整理效率，同时明确不替代医生诊断和治疗建议。',
    knowledgeSources: ['服务流程', '预约规则', '随访模板', '隐私合规规范'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.medicalRecordStructuring,
      additionalSkills.appointmentFollowup,
      additionalSkills.complianceReminder
    ],
    sampleInputs: [
      '请整理这批预约和随访记录，输出待跟进事项、时间提醒和缺失信息。',
      '请把这份非诊断类服务记录整理成结构化摘要，并标注需要人工确认的问题。'
    ],
    outputFormat: '预约随访清单、非诊断资料摘要、缺失信息、合规提醒和人工确认项。',
    approvalPolicy: '不得输出诊断、用药、治疗建议；涉及医疗判断必须转人工专业人员确认。'
  },
  {
    templateId: 'template_audit_compliance_assistant',
    version: '1.0.0',
    name: 'AI 审计合规助理',
    industry: '审计与合规',
    scenario: '审计证据清单、制度差距分析、整改跟踪',
    description: '整理审计资料、制度文件和执行记录，识别证据缺口、制度差距和整改追踪事项。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '提升审计准备和合规复核效率，形成可追踪的整改闭环。',
    knowledgeSources: ['制度文件', '审计清单', '流程记录', '整改台账'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.auditEvidenceChecklist,
      additionalSkills.policyGapAnalysis,
      additionalSkills.remediationTracking
    ],
    sampleInputs: [
      '请根据这批审计资料，整理证据清单、缺失材料和整改建议。',
      '请对比制度要求和执行记录，输出差距分析和整改跟踪表。'
    ],
    outputFormat: '审计证据清单、制度差距表、整改任务、责任人、截止日期和复核标准。',
    approvalPolicy: '涉及合规结论、责任认定和对外审计回复时必须人工复核。'
  },
  {
    templateId: 'template_spreadsheet_analyst',
    version: '1.0.0',
    name: 'AI 表格数据分析师',
    industry: '数据分析',
    scenario: '表格分析、指标看板简报、数据清洗计划',
    description: '读取表格和 CSV 数据，整理指标、异常、趋势和清洗建议，输出给业务负责人可读的分析结果。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '让非技术团队快速理解表格数据，形成可执行的数据分析结论。',
    knowledgeSources: ['指标口径', '业务规则', '历史报表', '数据字典'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.spreadsheetAnalysis,
      additionalSkills.metricDashboardBrief,
      additionalSkills.dataCleaningPlan
    ],
    sampleInputs: [
      '请分析这个销售表格，找出主要指标、异常客户、趋势变化和下一步建议。',
      '请检查这份 CSV 的缺失值、重复值和字段不一致问题，并给出清洗计划。'
    ],
    outputFormat: '指标摘要、异常值、趋势解释、数据质量问题、清洗计划和业务动作建议。',
    workflowGraph: buildOfficeProductionWorkflowGraph({
      artifactType: 'xlsx',
      parameterSchema: {
        datasetName: '数据集名称或业务主题',
        metricFields: '需要关注的指标字段',
        dimensionFields: '分组维度字段',
        anomalyRules: '异常判断规则',
        businessQuestion: '用户最想回答的业务问题'
      },
      analysisInstruction:
        '读取表格文本和指标口径，识别字段、核心指标、维度、趋势、异常值、缺失/重复/口径不一致问题和可执行业务问题。',
      draftInstruction:
        '生成适合 Excel 的分析结果。必须包含：指标摘要表、异常明细表、趋势解释、数据质量问题、清洗计划、业务动作建议。内容要尽量结构化，便于写入 xlsx。',
      qualityInstruction:
        '检查是否把推测当事实；缺少原始字段或无法计算的指标要标记“无法确认”；经营建议必须说明依据。',
      finalInstruction:
        '返回 Excel 文件位置、主要指标结论、异常数量、数据质量问题和下一步业务动作。'
    }),
    approvalPolicy: '涉及经营决策、财务口径和对外披露数据时必须由负责人确认。'
  },
  {
    templateId: 'template_brand_creative_planner',
    version: '1.0.0',
    name: 'AI 品牌创意策划',
    industry: '品牌与设计',
    scenario: '品牌简报、创意方向、设计审核清单',
    description: '根据品牌资料和活动目标整理创意 brief、视觉方向、文案方向和设计审核清单。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '提升品牌活动策划和设计沟通效率，让创意输入更清晰、可评审。',
    knowledgeSources: ['品牌手册', '活动目标', '受众画像', '历史物料'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      additionalSkills.brandBriefing,
      additionalSkills.creativeDirection,
      additionalSkills.designReviewChecklist
    ],
    sampleInputs: [
      '请根据这次活动目标生成一份品牌创意 brief，包含受众、卖点、视觉方向和物料清单。',
      '请审核这批海报文案和视觉说明，输出信息层级、合规风险和修改建议。'
    ],
    outputFormat: '创意 brief、视觉方向、文案方向、素材清单、设计审核清单和修改建议。',
    approvalPolicy: '对外发布物料、品牌主张和合规敏感内容必须由品牌负责人确认。'
  },
  {
    templateId: 'template_social_media_operator',
    version: '1.0.0',
    name: 'AI 社媒运营专员',
    industry: '社交媒体运营',
    scenario: '账号内容规划、互动回复、发布复盘',
    description: '围绕社媒账号定位、热点主题和用户互动记录，输出内容日历、互动回复和发布复盘建议。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '提高社媒内容规划和互动响应效率，让账号运营更稳定可复盘。',
    knowledgeSources: ['账号定位', '品牌话术', '历史发布数据', '互动评论记录'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [
      skills.contentPlanning,
      additionalSkills.communityReplyDrafting,
      additionalSkills.campaignRecap
    ],
    sampleInputs: [
      '请根据本月活动目标，生成一份小红书/公众号/视频号内容日历和选题说明。',
      '请整理这批评论和私信，生成回复建议、风险提醒和高价值线索列表。'
    ],
    outputFormat: '内容日历、选题说明、互动回复、风险提醒、线索清单和发布复盘。',
    approvalPolicy: '涉及对外发布、价格承诺、医疗/法律/财务敏感内容时必须人工确认。'
  },
  {
    templateId: 'template_store_operations_assistant',
    version: '1.0.0',
    name: 'AI 门店运营助理',
    industry: '门店与本地生活',
    scenario: '门店日报、客诉整理、排班和物料提醒',
    description: '整理门店经营记录、客户反馈、人员排班和物料情况，输出日报、异常事项和改善动作。',
    recommendedPlanCode: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '帮助门店负责人快速掌握经营异常、客户反馈和执行待办。',
    knowledgeSources: ['门店 SOP', '客户反馈记录', '排班表', '物料台账'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.customerIntentTriage,
      additionalSkills.inventoryExceptionAnalysis,
      additionalSkills.weeklyStatusReporting
    ],
    sampleInputs: [
      '请根据今天的门店记录生成门店日报，包含销售、客诉、人员、物料和异常事项。',
      '请整理这批客户反馈，输出高频问题、处理优先级和门店整改建议。'
    ],
    outputFormat: '门店日报、客诉分流、物料提醒、排班风险、整改动作和负责人清单。',
    approvalPolicy: '涉及赔付、人员处罚、价格承诺和对外回复时必须由门店负责人确认。'
  },
  {
    templateId: 'template_video_quality_editor',
    version: '1.0.0',
    name: 'AI 视频质检剪辑专员',
    industry: '内容运营与视频生产',
    scenario: '视频内容理解、质量评分、关键帧分析和 15 秒短视频剪辑',
    description: '读取用户本地视频路径，抽取关键帧，调用多模态模型输出评分和剪辑方案，再用本地 FFmpeg 导出成品 MP4。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '让企业能批量评估短视频素材质量，并把 50-70 秒视频快速剪成可复核的 15 秒成片。',
    knowledgeSources: ['视频质检标准', '品牌内容规范', '平台发布规则', '历史高质量视频案例'],
    tools: ['video-processing', 'office-document', 'local-filesystem'],
    skills: [
      skill('video_content_understanding', '视频内容理解', '识别视频主题、人物、场景、卖点和潜在风险。'),
      skill('video_quality_scoring', '视频质量评分', '按画面、节奏、信息密度、品牌表达和发布风险进行评分。'),
      skill('short_clip_planning', '短视频剪辑规划', '生成可执行的 cutPlan、剪辑理由和成品交付说明。')
    ],
    workflowSteps: [
      {
        id: 'receive_input',
        order: 1,
        type: 'input',
        name: '接收视频任务',
        instruction: '读取用户拖入的视频文件、本次目标、评分标准和输出要求。'
      },
      {
        id: 'collect_videos',
        order: 2,
        type: 'tool',
        name: '筛选视频文件',
        instruction: '从附件中筛选视频文件，只传递本地路径。',
        toolIds: ['local-filesystem']
      },
      {
        id: 'probe_and_frames',
        order: 3,
        type: 'tool',
        name: '读取信息并抽关键帧',
        instruction: '调用视频处理工具读取元信息，并用 FFmpeg 抽取关键帧。',
        toolIds: ['video-processing']
      },
      {
        id: 'analyze_video',
        order: 4,
        type: 'reasoning',
        name: '视频理解与评分',
        instruction: '调用多模态模型输出 summary、score、qualityIssues、cutPlan、editNotes 和 finalRecommendation。'
      },
      {
        id: 'export_video',
        order: 5,
        type: 'tool',
        name: '导出成品视频',
        instruction: '根据 cutPlan 调用本地 FFmpeg 导出 MP4 成品。',
        toolIds: ['video-processing'],
        requiresApproval: true
      },
      {
        id: 'deliver_output',
        order: 6,
        type: 'output',
        name: '返回交付结果',
        instruction: '返回视频评分、剪辑说明、风险提醒和本地成品文件路径。'
      }
    ],
    workflowGraph: buildVideoContentWorkflowGraph(),
    sampleInputs: [
      '请分析我拖入的这段 60 秒视频，按内容质量打分，并剪成 15 秒以内的高质量短视频。',
      '请帮我评估这条产品视频是否适合发布，输出评分、问题清单、剪辑方案和成品 MP4。'
    ],
    outputFormat: '视频评分 JSON、剪辑动作记录、风险提醒、本地关键帧路径和 MP4 成品路径。',
    approvalPolicy: '导出成品视频前需要用户确认剪辑方案；涉及品牌、医疗、金融、法律等敏感内容时必须人工复核。'
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
