import type { ServerRoleWorkflowGraph, ServerRoleWorkflowGraphNode } from './workflow-graph';

export interface ServerRoleSkill {
  code: string;
  name: string;
  summary: string;
}

export type ServerRoleTemplateStepType =
  | 'input'
  | 'llm'
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
  applicationType?: 'DIGITAL_EMPLOYEE' | 'DIGITAL_FACTORY';
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
  dependencyManifestFactory?: unknown;
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

const DESIGNED_ROLE_TEMPLATE_VERSION = '1.1.1';

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
      outputVariables: ['deliverable_file'],
      config: buildArtifactWriterConfig({
        artifactType,
        contentRef: '{{draft_text}}'
      })
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
  'docx' | 'xlsx' | 'pptx' | 'markdown'
>;
type ServerWorkflowArtifactType = NonNullable<ServerRoleWorkflowGraph['nodes'][number]['artifactType']>;

function artifactWriterAction(artifactType: ServerWorkflowArtifactType): string | undefined {
  switch (artifactType) {
    case 'xlsx':
      return 'spreadsheet.write_xlsx';
    case 'csv':
      return 'spreadsheet.write_csv';
    case 'pptx':
      return 'presentation.write_pptx';
    case 'docx':
      return 'office.write_docx_document';
    case 'markdown':
      return 'office.write_markdown_document';
    case 'mp4':
      return 'video.compose_clips';
    default:
      return undefined;
  }
}

function buildArtifactWriterConfig(input: {
  artifactType: ServerWorkflowArtifactType;
  contentRef: string;
  fileNameSuffix?: string;
  tableDataRef?: string;
  tableDataField?: 'rows' | 'sheets';
}): { action?: string; input?: Record<string, unknown> } {
  const action = artifactWriterAction(input.artifactType);
  const title = '{{task.title}}';
  const fileName = `{{task.title}}${input.fileNameSuffix ?? ''}`;

  if (input.artifactType === 'docx' || input.artifactType === 'markdown') {
    return {
      action,
      input: {
        title,
        folder: 'documents',
        fileName,
        content: input.contentRef
      }
    };
  }

  if (input.artifactType === 'xlsx' || input.artifactType === 'csv') {
    const tableInput = input.tableDataRef
      ? {
          [input.tableDataField ?? (input.artifactType === 'csv' ? 'rows' : 'sheets')]: input.tableDataRef
        }
      : {};

    return {
      action,
      input: {
        title,
        folder: 'spreadsheets',
        fileName,
        ...tableInput,
        content: input.contentRef
      }
    };
  }

  if (input.artifactType === 'pptx') {
    return {
      action,
      input: {
        title,
        folder: 'presentations',
        fileName,
        content: input.contentRef
      }
    };
  }

  if (input.artifactType === 'mp4') {
    return {
      action,
      input: {
        videoPath: '$runtime.current_item.localPath',
        cutPlan: '$analyze_video.json.cutPlan',
        folder: 'videos',
        fileName
      }
    };
  }

  return {
    action,
    input: {
      title,
      folder: 'documents',
      fileName,
      content: input.contentRef
    }
  };
}

function isSpreadsheetArtifactType(artifactType: ServerWorkflowArtifactType): artifactType is 'xlsx' | 'csv' {
  return artifactType === 'xlsx' || artifactType === 'csv';
}

function buildSpreadsheetDeliverableSchema(artifactType: 'xlsx' | 'csv'): Record<string, unknown> {
  if (artifactType === 'csv') {
    return {
      rows: [
        ['用户要求字段1', '用户要求字段2'],
        ['字段值1', '字段值2']
      ],
      assistantMessage: '给用户看的处理摘要、异常说明和待确认字段，不写入主表。'
    };
  }

  return {
    sheets: [
      {
        name: '整理后明细',
        rows: [
          ['用户要求字段1', '用户要求字段2'],
          ['字段值1', '字段值2']
        ]
      },
      {
        name: '异常项',
        rows: [
          ['类型', '说明'],
          ['缺失值', '无法确认的字段留空或标记待确认']
        ]
      }
    ],
    assistantMessage: '给用户看的处理摘要、异常说明和待确认字段，不写入主表。'
  };
}

function buildSpreadsheetDraftInstruction(instruction: string, artifactType: 'xlsx' | 'csv'): string {
  const outputField = artifactType === 'csv' ? 'rows' : 'sheets';

  return [
    instruction,
    `本节点必须只返回合法 JSON，不要返回 Markdown、代码块或自然语言正文。根字段必须包含 ${outputField}。`,
    artifactType === 'xlsx'
      ? 'sheets 是工作表数组；每个工作表包含 name 和 rows；rows 必须是二维数组，第一行是表头。主工作表命名为“整理后明细”。'
      : 'rows 必须是二维数组，第一行是表头。',
    '如果用户明确指定字段，例如“商品名称”和“价格”，主表只保留这些字段，不要额外增加备注、销量、建议等列。',
    '缺失、异常、无法确认的信息不要混入主表；Excel 可放入“异常项”工作表，CSV 则放入 assistantMessage。',
    '数值保持原始精度；不确定的数据留空或写“待确认”，不要编造。'
  ].join('\n');
}

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

function buildOfficeProductionWorkflowSteps(input: {
  artifactType: OfficeProductionWorkflowArtifactType;
  includeWebSearch: boolean;
  scenario: string;
}): ServerRoleTemplateWorkflowStep[] {
  const steps: ServerRoleTemplateWorkflowStep[] = [
    {
      id: 'receive_input',
      order: 1,
      type: 'input',
      name: '接收任务',
      instruction: `确认用户输入、附件、目标、边界和交付物要求：${input.scenario}。`
    },
    {
      id: 'extract_parameters',
      order: 2,
      type: 'llm',
      name: '提取任务参数',
      instruction: '把用户要求整理成结构化参数，字段缺失时标记为 null，不编造。'
    },
    {
      id: 'gather_context',
      order: 3,
      type: 'knowledge',
      name: '读取知识',
      instruction: '读取企业知识库、本地知识和已配置资料，只保留与当前任务相关的内容。'
    },
    {
      id: 'read_attachments',
      order: 4,
      type: 'tool',
      name: '按需读取附件',
      instruction: '仅当用户上传附件时读取文档、表格、PPT、PDF 或文本内容。',
      toolIds: ['office-document']
    }
  ];

  if (input.includeWebSearch) {
    steps.push({
      id: 'web_research',
      order: steps.length + 1,
      type: 'tool',
      name: '联网检索',
      instruction: '需要外部公开资料时检索网页，并把来源标题、链接和摘要带入后续分析。',
      toolIds: ['web-search']
    });
  }

  steps.push(
    {
      id: 'analyze_work',
      order: steps.length + 1,
      type: 'llm',
      name: '分析与规划',
      instruction: '结合用户输入、附件、知识库和工具结果，形成事实、风险、缺失信息和处理计划。'
    },
    {
      id: 'draft_deliverable',
      order: steps.length + 2,
      type: 'llm',
      name: '生成交付内容',
      instruction: input.artifactType === 'xlsx'
        ? '生成可直接写入 Excel 的结构化 JSON，必须包含 sheets。'
        : '生成可直接写入目标文件的正式正文。'
    },
    {
      id: 'quality_check',
      order: steps.length + 3,
      type: 'llm',
      name: '自检修订',
      instruction: '检查事实依据、格式、越权承诺、缺失项和需要人工确认的内容。'
    },
    {
      id: 'write_artifact',
      order: steps.length + 4,
      type: 'tool',
      name: '写入产物文件',
      instruction: `调用 PC 端办公工具生成 ${input.artifactType} 文件。`,
      toolIds: ['office-document']
    },
    {
      id: 'final_output',
      order: steps.length + 5,
      type: 'output',
      name: '返回结果',
      instruction: '返回文件位置、核心结果、异常或待确认事项。'
    }
  );

  return steps;
}

function buildOfficeProductionWorkflowGraph(input: {
  artifactType: OfficeProductionWorkflowArtifactType;
  parameterSchema: Record<string, unknown>;
  analysisInstruction: string;
  draftInstruction: string;
  qualityInstruction: string;
  finalInstruction: string;
  includeWebSearch?: boolean;
  analysisModelProfileId?: string;
  analysisTimeoutMs?: number;
  draftTimeoutMs?: number;
  qualityTimeoutMs?: number;
}): ServerRoleWorkflowGraph {
  const spreadsheetArtifactType = isSpreadsheetArtifactType(input.artifactType) ? input.artifactType : undefined;
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
      type: 'llm',
      name: '提取任务参数',
      instruction: '把用户任务整理成结构化参数，字段缺失时返回 null，不要编造附件或外部信息。',
      modelProfileId: 'qiu-general-default',
      inputVariables: ['start.text', 'start.files'],
      outputVariables: ['task_parameters'],
      config: {
        llmTaskType: 'structured_extraction',
        outputMode: 'json',
        schema: input.parameterSchema
      }
    },
    {
      id: 'gather_context',
      type: 'knowledge',
      name: '读取知识',
      instruction: '优先读取企业知识、本地知识和已配置资料，只提取与本次任务直接相关的内容。',
      inputVariables: ['start.text', 'task_parameters'],
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
        action: 'document.extract_text',
        input: {
          path: '$start.files.0.localPath',
          maxChars: 40000
        },
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
            inputVariables: ['start.text', 'task_parameters'],
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
      modelProfileId: input.analysisModelProfileId ?? 'qiu-reasoning-default',
      inputVariables: [
        'start.text',
        'task_parameters',
        'gather_context.text',
        'read_attachments.text',
        input.includeWebSearch ? 'web_research.text' : undefined
      ].filter((value): value is string => Boolean(value)),
      outputVariables: ['analysis_result'],
      config: input.analysisTimeoutMs ? { timeoutMs: input.analysisTimeoutMs } : undefined
    },
    {
      id: 'draft_deliverable',
      type: 'llm',
      name: '生成交付内容',
      instruction: spreadsheetArtifactType
        ? buildSpreadsheetDraftInstruction(input.draftInstruction, spreadsheetArtifactType)
        : input.draftInstruction,
      modelProfileId: 'qiu-general-default',
      inputVariables: ['analysis_result', 'knowledge_context', 'attachment_text'],
      outputVariables: ['deliverable_content'],
      config: spreadsheetArtifactType
        ? {
            outputMode: 'json',
            schema: buildSpreadsheetDeliverableSchema(spreadsheetArtifactType),
            ...(input.draftTimeoutMs ? { timeoutMs: input.draftTimeoutMs } : {})
          }
        : input.draftTimeoutMs
          ? { timeoutMs: input.draftTimeoutMs }
          : undefined
    },
    {
      id: 'quality_check',
      type: 'llm',
      name: '自检修订',
      instruction: input.qualityInstruction,
      modelProfileId: 'qiu-general-default',
      inputVariables: ['deliverable_content', 'task_parameters'],
      outputVariables: ['quality_review'],
      config: input.qualityTimeoutMs ? { timeoutMs: input.qualityTimeoutMs } : undefined
    },
    {
      id: 'write_artifact',
      type: 'artifact',
      name: '生成文件',
      instruction: `把最终内容写成本地 ${input.artifactType} 文件，文件名使用任务标题。`,
      toolId: 'office-document',
      artifactType: input.artifactType,
      inputVariables: ['deliverable_content', 'quality_review'],
      outputVariables: ['deliverable_file'],
      config: buildArtifactWriterConfig({
        artifactType: input.artifactType,
        contentRef: spreadsheetArtifactType ? '{{quality_review}}' : '{{deliverable_content}}',
        fileNameSuffix: input.artifactType === 'docx' ? '-整理版' : undefined,
        tableDataRef: spreadsheetArtifactType
          ? '$deliverable_content.sheets'
          : undefined,
        tableDataField: spreadsheetArtifactType
          ? 'sheets'
          : undefined
      })
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

  const afterAttachmentNodeId = input.includeWebSearch ? 'web_research' : 'analyze_work';
  const edges: ServerRoleWorkflowGraph['edges'] = [
    graphEdge('start', 'receive_input'),
    graphEdge('receive_input', 'extract_parameters'),
    graphEdge('extract_parameters', 'gather_context'),
    {
      id: 'gather_context__read_attachments',
      sourceNodeId: 'gather_context',
      targetNodeId: 'read_attachments',
      condition: {
        type: 'exists',
        variable: 'start.files'
      }
    },
    {
      id: `gather_context__${afterAttachmentNodeId}`,
      sourceNodeId: 'gather_context',
      targetNodeId: afterAttachmentNodeId,
      condition: {
        type: 'always'
      }
    },
    graphEdge('read_attachments', afterAttachmentNodeId),
    ...(input.includeWebSearch ? [graphEdge('web_research', 'analyze_work')] : []),
    graphEdge('analyze_work', 'draft_deliverable'),
    graphEdge('draft_deliverable', 'quality_check'),
    graphEdge('quality_check', 'write_artifact'),
    graphEdge('write_artifact', 'final_output')
  ];

  return {
    version: '1.0.0',
    nodes,
    edges,
    entryNodeId: 'start',
    variables: [
      { name: 'task_brief', type: 'text', description: '用户任务摘要', required: true },
      { name: 'task_parameters', type: 'json', description: '结构化任务参数', required: true },
      { name: 'knowledge_context', type: 'text', description: '企业和本地知识上下文' },
      { name: 'attachment_text', type: 'text', description: '附件提取文本' },
      { name: 'analysis_result', type: 'text', description: '分析和处理计划' },
      {
        name: 'deliverable_content',
        type: spreadsheetArtifactType ? 'json' : 'text',
        description: spreadsheetArtifactType ? '最终交付表格 JSON' : '最终交付内容'
      },
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

type CrossBorderFactoryPackageKey =
  | 'white_background'
  | 'main_image'
  | 'scene_image'
  | 'background_replacement'
  | 'model_replacement'
  | 'dimension_image'
  | 'selling_point_image';

const crossBorderFactoryPackageOptions: Array<{
  key: CrossBorderFactoryPackageKey;
  label: string;
  description: string;
  outputType: 'image';
}> = [
  {
    key: 'white_background',
    label: '白底图',
    description: '保留商品主体，生成干净白底商品图。',
    outputType: 'image'
  },
  {
    key: 'main_image',
    label: '商品主图',
    description: '突出商品卖点，适合平台列表和首图。',
    outputType: 'image'
  },
  {
    key: 'scene_image',
    label: '场景图',
    description: '把商品放入真实使用场景，增强购买代入感。',
    outputType: 'image'
  },
  {
    key: 'background_replacement',
    label: '换背景',
    description: '替换背景风格，同时保持商品主体一致。',
    outputType: 'image'
  },
  {
    key: 'model_replacement',
    label: '换模特',
    description: '适合服饰、配饰、家居等需要人物展示的商品图。',
    outputType: 'image'
  },
  {
    key: 'dimension_image',
    label: '尺寸图',
    description: '生成带尺寸、规格或关键参数标注的说明图。',
    outputType: 'image'
  },
  {
    key: 'selling_point_image',
    label: '卖点图',
    description: '围绕核心卖点生成电商详情页可用图片。',
    outputType: 'image'
  }
];

const crossBorderFactoryPlatforms = [
  { key: 'amazon', label: 'Amazon', imageRatio: '1:1', notes: '主图简洁，避免夸张文字和过度装饰。' },
  { key: 'temu', label: 'Temu', imageRatio: '1:1', notes: '强调直观卖点、价格感和清晰主体。' },
  { key: 'aliexpress', label: '速卖通', imageRatio: '1:1', notes: '适合主图、场景图和参数卖点图组合。' },
  { key: 'tiktok_shop', label: 'TikTok Shop', imageRatio: '1:1', notes: '画面更生活化，适合短视频封面和场景图。' },
  { key: 'ozon', label: 'Ozon', imageRatio: '1:1', notes: '主体清晰，参数和尺寸信息需要可读。' },
  { key: 'shopee', label: 'Shopee', imageRatio: '1:1', notes: '适合醒目、轻促销风格的商品图。' },
  { key: 'lazada', label: 'Lazada', imageRatio: '1:1', notes: '重视商品主体和卖点信息层级。' },
  { key: 'ebay', label: 'eBay', imageRatio: '1:1', notes: '真实、清晰、少修饰，便于买家检查商品。' },
  { key: 'walmart', label: 'Walmart', imageRatio: '1:1', notes: '偏干净、规范的零售商品图。' },
  { key: 'shein', label: 'SHEIN', imageRatio: '3:4', notes: '服饰类可突出模特、穿搭和风格。' }
];

const crossBorderFactoryDefaultPackageKeys: CrossBorderFactoryPackageKey[] = [
  'white_background',
  'main_image',
  'scene_image',
  'background_replacement',
  'model_replacement',
  'dimension_image',
  'selling_point_image'
];

const medicalCaseVideoScreeningGates = [
  {
    key: 'video_spec',
    label: '视频规格筛选',
    description: '先剔除比例、时长和音轨不达标的视频，减少后续模型成本。',
    rules: [
      { metric: 'portraitRatio', operator: 'between', value: [1.72, 1.86], failReason: '视频不是合格的 9:16 竖屏比例' },
      { metric: 'durationSeconds', operator: '>=', value: 20, failReason: '视频时长小于 20 秒' },
      { metric: 'hasAudio', operator: 'equals', value: true, failReason: '视频缺少可识别音轨' }
    ]
  },
  {
    key: 'asr_quality',
    label: '语音质量筛选',
    description: '用 ASR 转写结果判断是否存在说话听不清、识别失败或内容过短。',
    rules: [
      { metric: 'transcriptChars', operator: '>=', value: 80, failReason: '识别文本过短，说话内容不足' },
      { metric: 'unclearTokenRatio', operator: '<=', value: 0.25, failReason: '语音含糊或识别失败比例过高' }
    ]
  },
  {
    key: 'content_minimum',
    label: '内容完整性筛选',
    description: '只让具备使用前、使用过程、使用后改善表达的视频进入评分。',
    rules: [
      { metric: 'beforeAfterCompleteness', operator: '>=', value: 0.6, failReason: '缺少清晰的使用前/使用后改善表述' }
    ]
  }
];

function buildCrossBorderImageFactoryManifest() {
  return {
    kind: 'cross_border_product_image_factory',
    version: '1.0.0',
    title: '跨境商品图工厂',
    batch: {
      maxItems: 50,
      itemUnit: 'product',
      inputFileKinds: ['image', 'spreadsheet', 'csv'],
      imageExtensions: ['png', 'jpg', 'jpeg', 'webp'],
      tableExtensions: ['xlsx', 'csv']
    },
    platforms: crossBorderFactoryPlatforms,
    packages: crossBorderFactoryPackageOptions.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      outputType: item.outputType,
      defaultSelected: crossBorderFactoryDefaultPackageKeys.includes(item.key)
    })),
    qualityCheck: {
      defaultMode: 'basic',
      modes: [
        { key: 'none', label: '不质检', description: '不额外调用模型，只生成图片。' },
        { key: 'basic', label: '基础质检', description: '检查文件数量、命名、格式和基础规则。' },
        { key: 'smart', label: '智能质检', description: '调用多模态模型检查主体一致性、平台合规和卖点可读性。' }
      ]
    },
    output: {
      cacheDays: 30,
      defaultImageFormat: 'png',
      packageFormat: 'url_manifest',
      folder: 'product-images'
    },
    requiredCapabilities: ['vision', 'image_generation', 'image_editing'],
    ui: {
      primaryActionLabel: '开始生成',
      uploadHint: '上传商品参考图，可选上传 SKU 表格；单批最多 50 个商品。',
      packageSelection: 'checkbox'
    }
  };
}

function buildMedicalCaseVideoFactoryManifest() {
  return {
    kind: 'medical_case_video_screening_factory',
    version: '1.0.0',
    title: '案例视频质检剪辑工厂',
    batch: {
      maxItems: 50,
      itemUnit: 'video',
      inputFileKinds: ['video'],
      videoExtensions: ['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v']
    },
    packages: [
      {
        key: 'screening_score',
        label: '筛选评分表',
        description: '输出每个视频的筛选状态、失败原因、评分、等级、ASR 转写和风险提示。',
        outputType: 'xlsx',
        defaultSelected: true
      },
      {
        key: 'optional_edit',
        label: '可选初剪视频',
        description: '用户开启初剪后，只对通过筛选且评分较高的视频生成本地初剪视频。',
        outputType: 'video',
        defaultSelected: false
      }
    ],
    asr: {
      defaultLanguage: 'zh',
      defaultDialect: 'auto',
      dialects: [
        { key: 'auto', label: '自动识别' },
        { key: 'mandarin', label: '普通话' },
        { key: 'cantonese', label: '粤语' },
        { key: 'shanghai', label: '上海话' },
        { key: 'sichuan_chongqing', label: '四川/重庆口音' }
      ]
    },
    screeningProfiles: [
      {
        key: 'default_medical_case',
        label: '医疗案例素材标准',
        description: '适合用户口述使用前后变化的视频素材筛选，不判断医学疗效。',
        defaultSelected: true,
        gates: medicalCaseVideoScreeningGates.map((gate) => ({
          id: gate.key,
          name: gate.label,
          description: gate.description,
          rules: gate.rules
        }))
      }
    ],
    editing: {
      defaultEnabled: false,
      targetSeconds: 30,
      targetSecondOptions: [15, 30, 45],
      requiresFfmpeg: true
    },
    output: {
      cacheDays: 30,
      folder: 'case-videos',
      reportFormat: 'xlsx',
      videoFormat: 'mp4'
    },
    requiredCapabilities: ['audio_to_text', 'text', 'video_processing', 'spreadsheet_edit'],
    ui: {
      primaryActionLabel: '开始筛选',
      uploadHint: '上传案例视频，单批最多 50 个；大视频只在本机处理，不经过服务端。',
      screeningSelection: 'select',
      editingToggle: true
    }
  };
}

function buildCrossBorderImageFactoryWorkflowGraph(): ServerRoleWorkflowGraph {
  const nodes: ServerRoleWorkflowGraphNode[] = [
    {
      id: 'start',
      type: 'start',
      name: '开始',
      description: '工作流入口。'
    },
    {
      id: 'factory_input',
      type: 'input',
      name: '接收商品批次',
      instruction: '接收商品图片、SKU 表格、目标平台、勾选产物包和质检模式；单批最多 50 个商品。',
      inputVariables: ['start.text', 'start.files', 'start.images', 'start.spreadsheets'],
      outputVariables: ['task_brief'],
      config: {
        acceptedFileKinds: ['image', 'spreadsheet', 'csv'],
        maxItems: 50,
        source: 'digital_factory'
      }
    },
    {
      id: 'gather_factory_rules',
      type: 'knowledge',
      name: '读取平台和品牌规则',
      instruction: '读取企业知识库里的平台规则、品牌素材规范、禁用词和历史优质商品图案例。',
      inputVariables: ['task_brief', 'factory_request'],
      outputVariables: ['knowledge_context']
    },
    {
      id: 'prepare_batch',
      type: 'data',
      name: '整理批次参数',
      instruction: '把用户输入、附件和工厂面板参数整理成稳定 JSON，供后续节点读取。',
      inputVariables: ['start.files', 'factory_request'],
      outputVariables: ['factory_request', 'factory_items', 'selected_packages', 'target_platform', 'quality_check_mode'],
      config: {
        dataMode: 'code',
        outputVariable: 'factory_items',
        timeoutMs: 2_000,
        code:
          'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
          'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
          'const images = files.filter((file) => file && file.kind === "image");\n' +
          'const selectedPackages = Array.isArray(request.packages) ? request.packages : [];\n' +
          'const platform = request.platform && typeof request.platform === "object" ? request.platform : { key: "amazon", label: "Amazon" };\n' +
          'const qualityCheckMode = typeof request.qualityCheckMode === "string" ? request.qualityCheckMode : "basic";\n' +
          'return {\n' +
          '  factory_request: request,\n' +
          '  factory_items: images.slice(0, 50).map((file, index) => ({ sku: `SKU-${index + 1}`, image: file, sourceName: file.name || `image-${index + 1}` })),\n' +
          '  selected_packages: selectedPackages,\n' +
          '  target_platform: platform,\n' +
          '  quality_check_mode: qualityCheckMode\n' +
          '};'
      }
    },
    {
      id: 'generate_package_prompts',
      type: 'llm',
      name: '理解图片并生成提示词',
      instruction: '使用多模态模型读取商品参考图、平台规则和品牌规则，直接输出每个商品、每个所选产物包的生图提示词。不要生成图片，只输出 JSON。',
      modelProfileId: 'openai-gpt-4o',
      inputVariables: ['factory_request', 'factory_items', 'selected_packages', 'target_platform', 'knowledge_context'],
      outputVariables: ['package_instructions'],
      config: {
        llmTaskType: 'vision',
        outputMode: 'json',
        schema: {
          items: [
            {
              sku: 'string',
              productName: 'string',
              packages: [
                {
                  key: 'white_background',
                  prompt: 'string',
                  negativePrompt: 'string',
                  referenceImagePath: 'string'
                }
              ]
            }
          ]
        }
      }
    },
    {
      id: 'generate_images',
      type: 'llm',
      name: '批量生成商品图',
      instruction: '按 package_instructions 调用图片生成模型。只处理用户勾选的产物包，保持商品主体一致，输出图片远程 URL 元数据；大图片不经过服务端。',
      modelProfileId: 'openai-gpt-image-2',
      inputVariables: ['package_instructions', 'start.images'],
      outputVariables: ['factory_generated_images'],
      config: {
        llmTaskType: 'image_generation',
        outputMode: 'json',
        packageKeys: crossBorderFactoryDefaultPackageKeys,
        concurrency: 8,
        output: {
          folder: 'product-images',
          imageFormat: 'png'
        }
      }
    },
    {
      id: 'quality_check',
      type: 'llm',
      name: '可选质检',
      instruction: '如果 quality_check_mode 为 none，则输出 skipped。basic 只做文件数量、命名、尺寸规则检查；smart 再用多模态模型检查主体一致性、平台合规和卖点可读性。',
      modelProfileId: 'openai-gpt-4o',
      inputVariables: ['factory_generated_images', 'factory_items', 'quality_check_mode', 'target_platform'],
      outputVariables: ['quality_report'],
      config: {
        llmTaskType: 'vision',
        outputMode: 'json',
        schema: {
          mode: 'basic',
          passed: true,
          issues: [{ sku: 'string', packageKey: 'string', message: 'string' }]
        }
      }
    },
    {
      id: 'factory_output',
      type: 'output',
      name: '返回结果',
      instruction: '返回批量完成数量、失败项、图片 URL 结果和质检摘要。',
      inputVariables: ['factory_generated_images', 'quality_report'],
      outputVariables: ['final_answer']
    }
  ];

  return {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes,
    edges: [
      { id: 'start__factory_input', sourceNodeId: 'start', targetNodeId: 'factory_input', condition: { type: 'always' } },
      { id: 'factory_input__gather_factory_rules', sourceNodeId: 'factory_input', targetNodeId: 'gather_factory_rules', condition: { type: 'always' } },
      { id: 'gather_factory_rules__prepare_batch', sourceNodeId: 'gather_factory_rules', targetNodeId: 'prepare_batch', condition: { type: 'always' } },
      { id: 'prepare_batch__generate_package_prompts', sourceNodeId: 'prepare_batch', targetNodeId: 'generate_package_prompts', condition: { type: 'always' } },
      { id: 'generate_package_prompts__generate_images', sourceNodeId: 'generate_package_prompts', targetNodeId: 'generate_images', condition: { type: 'always' } },
      { id: 'generate_images__quality_check', sourceNodeId: 'generate_images', targetNodeId: 'quality_check', condition: { type: 'always' } },
      { id: 'quality_check__factory_output', sourceNodeId: 'quality_check', targetNodeId: 'factory_output', condition: { type: 'always' } }
    ],
    variables: [
      { name: 'factory_request', type: 'json', description: '工厂面板提交的批量运行参数。', required: true },
      { name: 'factory_items', type: 'json', description: '待处理商品列表，单批最多 50 个。', required: true },
      { name: 'selected_packages', type: 'json', description: '用户勾选的产物包 key。', required: true },
      { name: 'target_platform', type: 'text', description: '目标电商平台。', required: true },
      { name: 'quality_check_mode', type: 'text', description: 'none/basic/smart。', required: true },
      { name: 'package_instructions', type: 'json', description: '多模态模型生成的分包生图提示词。', required: true },
      { name: 'factory_generated_images', type: 'asset[]', description: '图片结果元数据，包含 remoteUrl、thumbnailPath、SKU 和产物包信息。', required: true },
      { name: 'quality_report', type: 'json', description: '质检报告或跳过记录。' }
    ],
    runtimePolicy: {
      maxNodeExecutions: 160,
      maxLoopIterations: 50,
      requireApprovalBeforeTools: false
    }
  };
}

function buildMedicalCaseVideoScreeningFactoryWorkflowGraph(): ServerRoleWorkflowGraph {
  const nodes: ServerRoleWorkflowGraphNode[] = [
    {
      id: 'start',
      type: 'start',
      name: '开始',
      description: '工作流入口。'
    },
    {
      id: 'factory_input',
      type: 'input',
      name: '接收视频批次',
      instruction: '接收案例视频、筛选规则、ASR 语言/方言、是否启用初剪和目标成片时长；单批最多 50 个视频。',
      inputVariables: ['start.text', 'start.files', 'start.videos'],
      outputVariables: ['task_brief'],
      config: {
        acceptedFileKinds: ['video'],
        maxItems: 50,
        source: 'digital_factory'
      }
    },
    {
      id: 'load_screening_rules',
      type: 'knowledge',
      name: '读取筛选标准',
      instruction: '读取企业知识库中的案例视频标准、合规边界、禁用表述和人工复核规则。',
      inputVariables: ['task_brief', 'factory_request'],
      outputVariables: ['knowledge_context']
    },
    {
      id: 'screen_score_and_edit',
      type: 'llm',
      name: '批量筛选评分',
      instruction: '按 factory_request 对每个视频先做硬性筛选：视频比例、时长、音轨、ASR 可识别度、内容完整性；未通过的直接标记并停止后续处理。通过筛选的视频再按表达清晰度、使用前后完整性、改善表述具体度、自然度、剪辑价值评分。只评价素材质量和表达质量，不做医疗诊断，不判断疗效真实性。',
      modelProfileId: 'qiu-general-default',
      inputVariables: ['factory_request', 'start.files', 'start.videos', 'knowledge_context'],
      outputVariables: ['video_screening_results', 'screening_summary'],
      config: {
        llmTaskType: 'video_screening_batch',
        outputMode: 'json',
        concurrency: 3,
        schema: {
          summary: 'string',
          results: [
            {
              fileName: 'string',
              status: 'rejected | scored | review_required | edited',
              rejectedGate: 'string',
              rejectedReason: 'string',
              score: 0,
              grade: 'A | B | C | D',
              transcript: 'string',
              editPlan: [{ start: 0, end: 10, label: 'string', reason: 'string' }]
            }
          ]
        }
      }
    },
    {
      id: 'factory_output',
      type: 'output',
      name: '返回结果',
      instruction: '返回筛选评分表、筛掉原因、评分摘要、风险提示和可选初剪视频；提醒用户医疗相关内容需人工复核。',
      inputVariables: ['video_screening_results', 'screening_summary'],
      outputVariables: ['final_answer']
    },
    {
      id: 'asr_dependency',
      type: 'llm',
      name: 'ASR 模型依赖',
      description: '依赖声明节点，不接入主链路。',
      instruction: '需要配置支持普通话、粤语、上海话、四川/重庆口音等常见中文方言的语音转文字模型。',
      modelProfileId: 'qiu-asr-default',
      inputVariables: ['start.videos'],
      outputVariables: ['transcript'],
      config: {
        llmTaskType: 'audio_transcription',
        dependencyOnly: true
      }
    },
    {
      id: 'video_tool_dependency',
      type: 'tool',
      name: '视频工具依赖',
      description: '依赖声明节点，不接入主链路。',
      instruction: '需要 PC 端视频处理工具读取比例、时长、音轨，并在用户开启初剪时调用 FFmpeg 生成视频片段。',
      toolId: 'video-processing',
      config: {
        action: 'video.probe',
        dependencyOnly: true
      }
    },
    {
      id: 'spreadsheet_tool_dependency',
      type: 'tool',
      name: '表格产物依赖',
      description: '依赖声明节点，不接入主链路。',
      instruction: '需要 Office 文档工具把筛选、评分、转写和风险信息写入 Excel 结果表。',
      toolId: 'office-document',
      config: {
        action: 'spreadsheet.write_xlsx',
        dependencyOnly: true
      }
    }
  ];

  return {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes,
    edges: [
      { id: 'start__factory_input', sourceNodeId: 'start', targetNodeId: 'factory_input', condition: { type: 'always' } },
      { id: 'factory_input__load_screening_rules', sourceNodeId: 'factory_input', targetNodeId: 'load_screening_rules', condition: { type: 'always' } },
      { id: 'load_screening_rules__screen_score_and_edit', sourceNodeId: 'load_screening_rules', targetNodeId: 'screen_score_and_edit', condition: { type: 'always' } },
      { id: 'screen_score_and_edit__factory_output', sourceNodeId: 'screen_score_and_edit', targetNodeId: 'factory_output', condition: { type: 'always' } }
    ],
    variables: [
      { name: 'factory_request', type: 'json', description: '工厂面板提交的视频批量处理参数。', required: true },
      { name: 'video_screening_results', type: 'json', description: '每个视频的筛选、评分、转写、风险和初剪结果。', required: true },
      { name: 'screening_summary', type: 'text', description: '批量处理统计摘要。', required: true },
      { name: 'transcript', type: 'text', description: 'ASR 转写文本。' }
    ],
    runtimePolicy: {
      maxNodeExecutions: 180,
      maxLoopIterations: 50,
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
      type: 'llm',
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
      return [
        'PERSONAL_FREE',
        'ENTERPRISE_BASIC_MONTHLY',
        'ENTERPRISE_BASIC_ANNUAL',
        'ENTERPRISE_STANDARD_MONTHLY',
        'ENTERPRISE_STANDARD_ANNUAL',
        'ENTERPRISE_PRO_MONTHLY',
        'ENTERPRISE_PRO_ANNUAL',
        'ENTERPRISE_CUSTOM'
      ];
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
    applicationType: template.applicationType ?? 'DIGITAL_EMPLOYEE',
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
    recommendedPlanCode: 'PERSONAL_FREE',
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
        type: 'llm',
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

type DesignedOfficeRoleTemplateInput = {
  templateId: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  plan?: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools?: string[];
  skills: ServerRoleSkill[];
  sampleInputs: string[];
  outputFormat: string;
  approvalPolicy: string;
  artifactType?: OfficeProductionWorkflowArtifactType;
  includeWebSearch?: boolean;
  parameterSchema?: Record<string, unknown>;
  analysisInstruction?: string;
  draftInstruction?: string;
  qualityInstruction?: string;
  finalInstruction?: string;
  analysisModelProfileId?: string;
  analysisTimeoutMs?: number;
  draftTimeoutMs?: number;
  qualityTimeoutMs?: number;
};

function createOfficeRoleTemplate(input: DesignedOfficeRoleTemplateInput): BaseServerRoleTemplateCatalogEntry {
  const tools = input.tools ?? [
    ...(input.includeWebSearch ? ['web-search'] : []),
    'office-document',
    'local-filesystem'
  ];
  const artifactType = input.artifactType ?? 'docx';
  const includeWebSearch = input.includeWebSearch ?? tools.includes('web-search');

  return {
    templateId: input.templateId,
    version: DESIGNED_ROLE_TEMPLATE_VERSION,
    name: `AI ${input.name}`,
    industry: input.industry,
    scenario: input.scenario,
    description: input.description,
    recommendedPlanCode: input.plan ?? 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: input.businessGoal,
    knowledgeSources: input.knowledgeSources,
    tools,
    skills: input.skills,
    workflowSteps: buildOfficeProductionWorkflowSteps({
      artifactType,
      includeWebSearch,
      scenario: input.scenario
    }),
    sampleInputs: input.sampleInputs,
    outputFormat: input.outputFormat,
    workflowGraph: buildOfficeProductionWorkflowGraph({
      artifactType,
      parameterSchema: input.parameterSchema ?? {
        taskGoal: '用户希望完成的业务目标',
        inputMaterials: '用户输入或附件资料',
        outputAudience: '产物读者或使用对象',
        constraints: '格式、篇幅、口径、禁区或人工确认要求',
        expectedArtifact: `期望输出 ${artifactType} 文件`
      },
      analysisInstruction:
        input.analysisInstruction ??
        `围绕「${input.scenario}」读取附件和企业知识库，提炼事实、任务边界、缺失信息、风险点和处理计划。不要编造没有依据的企业资料。`,
      draftInstruction:
        input.draftInstruction ??
        `生成可直接交付的「${input.name}」产物，结构清晰、口径正式，只保留与任务相关的内容；需要人工确认的内容单独列出，不写入为确定结论。`,
      qualityInstruction:
        input.qualityInstruction ??
        '检查是否存在编造事实、越权承诺、输出格式不适合落地、缺少人工确认项的问题，并把最终内容修订到可交付状态。',
      finalInstruction:
        input.finalInstruction ??
        '返回生成文件位置、核心结论、需要人工确认的问题和下一步建议。',
      includeWebSearch,
      analysisModelProfileId: input.analysisModelProfileId,
      analysisTimeoutMs: input.analysisTimeoutMs,
      draftTimeoutMs: input.draftTimeoutMs,
      qualityTimeoutMs: input.qualityTimeoutMs
    }),
    approvalPolicy: input.approvalPolicy
  };
}

const freeBasicRoleTemplates: BaseServerRoleTemplateCatalogEntry[] = [
  createOfficeRoleTemplate({
    templateId: 'basic_document_organizer_v1',
    name: '文档整理专员',
    industry: '免费基础 / 办公文档',
    scenario: '读取文档、提炼核心内容、整理成正式 Word',
    description: '把用户上传的 txt、docx、pdf 等资料整理成简洁正式的 Word 文档，适合日常办公文档清理。',
    plan: 'PERSONAL_FREE',
    businessGoal: '让个人和企业用户都能稳定完成文档整理、摘要提炼和正式化表达。',
    knowledgeSources: ['用户附件', '本地知识文件', '文档格式规范'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.documentExtraction,
      skills.draftGeneration,
      additionalSkills.archiveChecklist
    ],
    sampleInputs: [
      '请把这份产品技术文档整理成一份简洁正式的 Word 文档，保留核心内容。',
      '请根据我上传的材料生成一份结构清晰的说明文档，不要额外发挥。'
    ],
    outputFormat: '正式 Word 文档，包含标题、摘要、分级正文、必要清单和人工确认项。',
    artifactType: 'docx',
    analysisInstruction:
      '读取附件全文，识别主题、章节、核心事实、必须保留的参数、可压缩的冗余内容和不能擅自补充的信息。',
    draftInstruction:
      '生成简洁正式的 Word 正文。只保留附件中的核心内容，不额外发挥；不要把用户指令写入产物；后续建议只在确有原文依据时保留。',
    qualityInstruction:
      '检查标题、摘要和正文是否重复；删除没有原文依据的建议；确保正文适合直接写入 Word。',
    finalInstruction: '返回 Word 文件位置、整理范围、保留的核心内容和需要用户确认的缺失信息。',
    approvalPolicy: '涉及正式对外发布、合同、法律、医疗、财务内容时需要用户自行确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'basic_spreadsheet_organizer_v1',
    name: '表格整理专员',
    industry: '免费基础 / 表格办公',
    scenario: '读取表格、清洗字段、汇总成规范 Excel',
    description: '把 Excel、CSV 或文本表格整理为结构化清单、汇总表和异常提示。',
    plan: 'PERSONAL_FREE',
    businessGoal: '帮助用户把杂乱表格快速整理为可筛选、可复查、可交付的 Excel。',
    knowledgeSources: ['用户附件', '本地表格样例', '字段口径说明'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      additionalSkills.spreadsheetAnalysis,
      additionalSkills.dataCleaningPlan,
      additionalSkills.metricDashboardBrief
    ],
    sampleInputs: [
      '请整理这份客户名单，去掉重复项，补充分类并生成 Excel。',
      '请从这个文本里提取关键字段，整理成一张结构清晰的表格。'
    ],
    outputFormat: 'Excel 文件，包含整理后明细、异常项、字段说明和下一步处理建议。',
    artifactType: 'xlsx',
    analysisModelProfileId: 'qiu-general-default',
    analysisTimeoutMs: 60_000,
    draftTimeoutMs: 60_000,
    qualityTimeoutMs: 45_000,
    analysisInstruction:
      '读取表格或文本，识别字段、重复项、缺失值、异常值、分类维度和用户要求的汇总口径。',
    draftInstruction:
      '生成适合写入 Excel 的结构化结果。必须包含整理后明细、异常项、字段说明、可选汇总表；无法确认的数据标记为空或待确认。',
    qualityInstruction:
      '检查每一列是否有明确含义，避免把自然语言长段落塞进单元格；缺失和异常必须单独列出。',
    finalInstruction: '返回 Excel 文件位置、整理行数、发现的异常和建议用户确认的字段。',
    approvalPolicy: '涉及财务、客户隐私和对外披露数据时需要用户自行确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'basic_meeting_minutes_v1',
    name: '会议纪要专员',
    industry: '免费基础 / 会议办公',
    scenario: '会议记录整理、决议提取、待办拆解',
    description: '根据会议录音转写文本、聊天记录或用户笔记整理会议纪要和行动清单。',
    plan: 'PERSONAL_FREE',
    businessGoal: '让用户快速从会议记录中得到结论、责任人、截止时间和后续动作。',
    knowledgeSources: ['会议记录', '项目资料', '本地团队术语'],
    tools: ['office-document', 'local-filesystem'],
    skills: [skills.meetingSummary, skills.taskDelegation, skills.scheduleCoordination],
    sampleInputs: [
      '请把这段会议记录整理成正式纪要，包含决议和待办。',
      '请根据这份讨论记录提取责任人、截止日期、风险和下次会议议题。'
    ],
    outputFormat: 'Word 会议纪要，包含会议背景、核心结论、决议、待办表和风险提醒。',
    artifactType: 'docx',
    analysisInstruction:
      '从会议材料中提取参会背景、主题、事实、争议、明确决议、待办事项、责任人、截止时间和待确认问题。',
    draftInstruction:
      '生成正式会议纪要。必须区分“已决议”和“待确认”；没有明确责任人或日期时标记待补充。',
    qualityInstruction:
      '检查是否把讨论意见误写为决议；检查待办是否可执行、是否包含责任人和截止时间。',
    finalInstruction: '返回 Word 文件位置、会议结论、待办数量和需要补充确认的信息。',
    approvalPolicy: '正式发给客户、管理层或作为项目依据前需要会议负责人确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'basic_translation_polish_v1',
    name: '翻译润色专员',
    industry: '免费基础 / 文案语言',
    scenario: '中英互译、正式润色、表达优化',
    description: '对用户输入或附件内容做翻译、润色、正式化和语气调整，输出可直接使用的文档。',
    plan: 'PERSONAL_FREE',
    businessGoal: '降低日常跨语言沟通和文案润色成本，提升表达清晰度和正式度。',
    knowledgeSources: ['用户附件', '术语表', '品牌表达规范'],
    tools: ['office-document', 'local-filesystem'],
    skills: [
      skill('translation', '翻译', '保留原意完成中英互译或指定语言翻译。'),
      skill('polishing', '润色', '调整语气、结构和用词，让表达更自然正式。'),
      skill('terminology_check', '术语检查', '保持专有名词、品牌名和技术术语一致。')
    ],
    sampleInputs: [
      '请把这份中文说明翻译成正式英文，保留技术术语。',
      '请把这段商务邮件润色得更专业、简洁、礼貌。'
    ],
    outputFormat: 'Word 文档，包含润色/翻译后的正文、术语说明和需要确认的歧义点。',
    artifactType: 'docx',
    analysisInstruction:
      '识别源语言、目标语言、语气、受众、术语和可能存在歧义的句子；保留 deepseek 等专有名词原样。',
    draftInstruction:
      '输出自然、准确、正式的翻译或润色正文；不要扩写事实；专有名词保持一致。',
    qualityInstruction:
      '检查是否遗漏原文信息、是否改变事实含义、是否存在术语不一致和过度润色。',
    finalInstruction: '返回 Word 文件位置、处理语言、术语处理说明和需要用户确认的歧义点。',
    approvalPolicy: '合同、法律、医疗、财务、对外公告类内容正式使用前需要人工复核。'
  })
];

const salesRoleSkills = [
  skill('customer_profile', '客户画像', '整理客户行业、角色、痛点、预算、决策链和采购阶段。'),
  skill('sales_proposal', '销售方案', '把企业产品资料转成面向目标行业的方案、卖点和价值表达。'),
  skill('followup_playbook', '跟进话术', '生成开场、异议处理、推进成交和复盘动作。')
];

type SalesRoleTemplateDefinition = {
  id: string;
  name: string;
  industry: string;
  focus: string;
  plan?: string;
  artifactType?: OfficeProductionWorkflowArtifactType;
};

function createSalesRoleTemplate(input: SalesRoleTemplateDefinition): BaseServerRoleTemplateCatalogEntry {
  const artifactType = input.artifactType ?? 'docx';

  return createOfficeRoleTemplate({
    templateId: `sales_${input.id}_v1`,
    name: input.name,
    industry: `销售增长 / ${input.industry}`,
    scenario: `${input.focus}客户画像、需求挖掘、方案话术和跟进计划`,
    description: `面向${input.focus}场景，结合企业知识库、产品资料和客户资料，辅助销售完成客户分析、卖点匹配、沟通话术和下一步推进。`,
    plan: input.plan ?? 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: `提升${input.focus}销售准备效率，降低销售话术和方案输出的不稳定性，帮助销售更快形成可执行跟进动作。`,
    knowledgeSources: [
      '企业知识库',
      '产品资料',
      '销售话术库',
      '客户画像',
      `${input.focus}行业资料`,
      '历史成交案例'
    ],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: salesRoleSkills,
    sampleInputs: [
      `请作为${input.name}，根据这个客户背景和我司产品资料，生成一份拜访准备和跟进话术。`,
      `请帮我分析一个${input.focus}客户的需求、可能异议、方案切入点和下一步推进计划。`
    ],
    outputFormat:
      artifactType === 'xlsx'
        ? 'Excel 销售跟进表，包含客户画像、需求、异议、卖点匹配、报价线索、下一步动作和负责人。'
        : 'Word 销售方案/拜访准备，包含客户画像、痛点、卖点匹配、话术、异议处理、风险和下一步动作。',
    artifactType,
    includeWebSearch: true,
    parameterSchema: {
      customerProfile: '客户名称、行业、规模、角色、当前背景',
      productScope: '可销售产品、服务或方案范围',
      salesStage: '初次触达、需求沟通、报价、谈判、复购等阶段',
      painPoints: '客户已表达或推断的痛点',
      objections: '客户异议、风险、预算、竞品或决策阻碍',
      expectedNextAction: '本次希望生成的销售动作或产物'
    },
    analysisInstruction: [
      `你是${input.name}，面向${input.focus}销售场景。`,
      '必须优先结合企业知识库里的产品资料、案例、价格政策、服务边界和销售话术。',
      '可以使用网页搜索补充客户或行业公开背景，但不能把未验证信息当成确定事实。',
      '输出分析时要区分客户已知信息、合理推断、待确认问题和不能承诺事项。'
    ].join('\n'),
    draftInstruction: [
      `生成一份${input.name}可直接使用的销售交付内容。`,
      '必须包含：客户画像、核心痛点、需求判断、我司产品/服务匹配、差异化卖点、沟通话术、异议处理、下一步跟进计划、需要人工确认的报价/承诺事项。',
      '内容要服务于真实成交推进，不要写成泛泛营销文章。'
    ].join('\n'),
    qualityInstruction:
      '检查是否有越权承诺、价格/交付/效果保证、行业合规风险、缺少企业知识依据的问题；不确定内容必须标记为待确认。',
    finalInstruction:
      '返回生成文件位置、最重要的客户切入点、建议下一步动作、需要人工确认的报价/承诺/合规事项。',
    approvalPolicy: '正式对外发送报价、合同、交付周期、效果承诺和敏感行业表述前必须由销售负责人确认。'
  });
}

const salesRoleTemplateDefinitions: SalesRoleTemplateDefinition[] = [
  { id: 'general_sales', name: '通用销售专员', industry: '通用销售', focus: '通用产品与服务' },
  { id: 'key_account_sales', name: '大客户销售专员', industry: '通用销售', focus: '大客户和复杂决策链' },
  { id: 'phone_sales', name: '电话销售专员', industry: '通用销售', focus: '电话外呼和初筛线索' },
  { id: 'private_domain_sales', name: '私域销售专员', industry: '通用销售', focus: '微信私域和社群转化' },
  { id: 'channel_recruitment_sales', name: '渠道招商销售专员', industry: '通用销售', focus: '代理商、加盟商和渠道招商' },
  { id: 'pre_sales_solution', name: '售前方案专员', industry: '通用销售', focus: '售前方案和客户演示' },
  { id: 'sales_quote', name: '销售报价专员', industry: '通用销售', focus: '报价单和报价说明', artifactType: 'xlsx' },
  { id: 'sales_followup_review', name: '销售跟进复盘专员', industry: '通用销售', focus: '沟通记录复盘和下一步推进', artifactType: 'xlsx' },

  { id: 'saas_sales', name: 'SaaS 销售专员', industry: '软件与企业服务', focus: 'SaaS 软件订阅' },
  { id: 'ai_product_sales', name: 'AI 产品销售专员', industry: '软件与企业服务', focus: 'AI 软件、智能体和自动化产品' },
  { id: 'enterprise_it_sales', name: '企业信息化销售专员', industry: '软件与企业服务', focus: '企业信息化项目' },
  { id: 'erp_crm_oa_sales', name: 'ERP/CRM/OA 销售专员', industry: '软件与企业服务', focus: 'ERP、CRM、OA 管理软件' },
  { id: 'cybersecurity_sales', name: '网络安全销售专员', industry: '软件与企业服务', focus: '网络安全产品和服务' },
  { id: 'cloud_service_sales', name: '云服务销售专员', industry: '软件与企业服务', focus: '云计算、云主机和云迁移' },
  { id: 'data_service_sales', name: '数据服务销售专员', industry: '软件与企业服务', focus: '数据平台、数据治理和数据服务' },

  { id: 'education_sales', name: '教育销售专员', industry: '教育培训', focus: '教育培训课程和服务' },
  { id: 'course_consultant', name: '课程顾问专员', industry: '教育培训', focus: '课程咨询和转化' },
  { id: 'vocational_education_sales', name: '职业教育销售专员', industry: '教育培训', focus: '职业教育和技能培训' },
  { id: 'school_enterprise_sales', name: '校企合作销售专员', industry: '教育培训', focus: '校企合作和校园项目' },
  { id: 'enterprise_training_sales', name: '企业培训销售专员', industry: '教育培训', focus: '企业内训和人才发展项目' },

  { id: 'medical_device_sales', name: '医疗器械销售专员', industry: '医疗健康', focus: '医疗器械和设备', plan: 'ENTERPRISE_STANDARD_MONTHLY' },
  { id: 'pharma_sales', name: '医药销售专员', industry: '医疗健康', focus: '医药产品和院外服务', plan: 'ENTERPRISE_STANDARD_MONTHLY' },
  { id: 'dental_consulting_sales', name: '口腔咨询销售专员', industry: '医疗健康', focus: '口腔门诊咨询和转化', plan: 'ENTERPRISE_STANDARD_MONTHLY' },
  { id: 'medical_beauty_sales', name: '医美咨询销售专员', industry: '医疗健康', focus: '医美咨询和方案转化', plan: 'ENTERPRISE_STANDARD_MONTHLY' },
  { id: 'health_check_sales', name: '体检健康管理销售专员', industry: '医疗健康', focus: '体检套餐和健康管理服务' },
  { id: 'eldercare_sales', name: '养老护理服务销售专员', industry: '医疗健康', focus: '养老护理和康养服务' },

  { id: 'ecommerce_sales', name: '电商销售专员', industry: '电商零售', focus: '电商商品和店铺转化' },
  { id: 'live_commerce_sales', name: '直播带货销售专员', industry: '电商零售', focus: '直播间转化和主播话术' },
  { id: 'private_ecommerce_sales', name: '私域电商销售专员', industry: '电商零售', focus: '私域电商复购和转化' },
  { id: 'beauty_personal_care_sales', name: '美妆个护销售专员', industry: '电商零售', focus: '美妆个护商品' },
  { id: 'maternal_baby_sales', name: '母婴用品销售专员', industry: '电商零售', focus: '母婴用品和亲子消费' },
  { id: 'home_appliance_sales', name: '家居家电销售专员', industry: '电商零售', focus: '家居家电和耐用品' },
  { id: 'food_beverage_channel_sales', name: '食品饮料渠道销售专员', industry: '电商零售', focus: '食品饮料渠道和经销' },

  { id: 'industrial_goods_sales', name: '工业品销售专员', industry: '制造工业', focus: '工业品和生产耗材' },
  { id: 'machinery_sales', name: '机械设备销售专员', industry: '制造工业', focus: '机械设备和产线设备' },
  { id: 'automation_equipment_sales', name: '自动化设备销售专员', industry: '制造工业', focus: '自动化设备和智能制造' },
  { id: 'electronic_component_sales', name: '电子元器件销售专员', industry: '制造工业', focus: '电子元器件和供应链' },
  { id: 'instrument_sales', name: '仪器仪表销售专员', industry: '制造工业', focus: '仪器仪表和检测设备' },
  { id: 'chemical_raw_material_sales', name: '化工原料销售专员', industry: '制造工业', focus: '化工原料和工业材料' },
  { id: 'new_material_sales', name: '新材料销售专员', industry: '制造工业', focus: '新材料和材料解决方案' },
  { id: 'packaging_printing_sales', name: '包装印刷销售专员', industry: '制造工业', focus: '包装印刷和定制生产' },

  { id: 'building_materials_sales', name: '建材销售专员', industry: '建筑地产', focus: '建材和工程材料' },
  { id: 'home_decoration_sales', name: '装修家装销售专员', industry: '建筑地产', focus: '装修家装和设计服务' },
  { id: 'real_estate_sales', name: '房产销售专员', industry: '建筑地产', focus: '住宅和商业地产销售' },
  { id: 'commercial_office_recruitment_sales', name: '商办招商销售专员', industry: '建筑地产', focus: '商业办公招商' },
  { id: 'property_service_sales', name: '物业服务销售专员', industry: '建筑地产', focus: '物业服务和园区服务' },
  { id: 'engineering_project_sales', name: '工程项目销售专员', industry: '建筑地产', focus: '工程项目和施工服务' },
  { id: 'park_recruitment_sales', name: '园区招商销售专员', industry: '建筑地产', focus: '产业园区招商' },

  { id: 'auto_sales', name: '汽车销售专员', industry: '汽车能源', focus: '乘用车销售和置换' },
  { id: 'commercial_vehicle_sales', name: '商用车销售专员', industry: '汽车能源', focus: '商用车和车队采购' },
  { id: 'construction_machinery_sales', name: '工程机械销售专员', industry: '汽车能源', focus: '工程机械和租赁销售' },
  { id: 'solar_sales', name: '新能源光伏销售专员', industry: '汽车能源', focus: '光伏和新能源项目' },
  { id: 'energy_storage_sales', name: '储能销售专员', industry: '汽车能源', focus: '储能系统和能源管理' },
  { id: 'charging_pile_sales', name: '充电桩销售专员', industry: '汽车能源', focus: '充电桩和充电站建设' },

  { id: 'tax_service_sales', name: '财税服务销售专员', industry: '财税法务咨询', focus: '财税代理、筹划和合规服务' },
  { id: 'legal_service_sales', name: '法律服务销售专员', industry: '财税法务咨询', focus: '法律咨询和企业法律服务' },
  { id: 'consulting_service_sales', name: '企业咨询销售专员', industry: '财税法务咨询', focus: '管理咨询和战略咨询' },
  { id: 'hr_service_sales', name: '人力资源服务销售专员', industry: '财税法务咨询', focus: '招聘外包、人事代理和灵活用工' },
  { id: 'ip_service_sales', name: '知识产权销售专员', industry: '财税法务咨询', focus: '商标、专利和知识产权服务' },
  { id: 'certification_testing_sales', name: '认证检测销售专员', industry: '财税法务咨询', focus: '认证、检测和资质服务' },

  { id: 'restaurant_franchise_sales', name: '餐饮加盟招商专员', industry: '本地生活', focus: '餐饮加盟和品牌招商' },
  { id: 'hotel_tourism_sales', name: '酒店文旅销售专员', industry: '本地生活', focus: '酒店、文旅和团建产品' },
  { id: 'event_sales', name: '会展活动销售专员', industry: '本地生活', focus: '会展、活动和会议服务' },
  { id: 'beauty_store_sales', name: '美业门店销售专员', industry: '本地生活', focus: '美业门店项目和会员转化' },
  { id: 'fitness_coach_sales', name: '健身私教销售专员', industry: '本地生活', focus: '健身私教和会员续费' },
  { id: 'photo_wedding_sales', name: '摄影婚庆销售专员', industry: '本地生活', focus: '摄影、婚庆和活动套餐' },

  { id: 'logistics_supply_chain_sales', name: '物流供应链销售专员', industry: '物流外贸', focus: '物流供应链服务' },
  { id: 'cross_border_ecommerce_sales', name: '跨境电商销售专员', industry: '物流外贸', focus: '跨境电商产品和服务' },
  { id: 'foreign_trade_sales', name: '外贸销售专员', industry: '物流外贸', focus: '外贸客户开发和跟单' },
  { id: 'freight_forwarding_sales', name: '货代销售专员', industry: '物流外贸', focus: '国际货代和运输服务' },
  { id: 'warehousing_service_sales', name: '仓储服务销售专员', industry: '物流外贸', focus: '仓储、云仓和履约服务' },

  { id: 'agricultural_input_sales', name: '农资销售专员', industry: '农业食品', focus: '种子、肥料、农药和农资服务' },
  { id: 'agricultural_product_channel_sales', name: '农产品渠道销售专员', industry: '农业食品', focus: '农产品渠道和批发销售' },
  { id: 'food_processing_sales', name: '食品加工销售专员', industry: '农业食品', focus: '食品加工产品和代工服务' },
  { id: 'fresh_supply_chain_sales', name: '生鲜供应链销售专员', industry: '农业食品', focus: '生鲜供应链和冷链服务' },

  { id: 'government_project_sales', name: '政企项目销售专员', industry: '政企项目', focus: '政企项目和招投标销售', plan: 'ENTERPRISE_STANDARD_MONTHLY' },
  { id: 'security_system_sales', name: '安防销售专员', industry: '政企项目', focus: '安防系统和监控项目' },
  { id: 'fire_safety_sales', name: '消防销售专员', industry: '政企项目', focus: '消防设备和消防工程' },
  { id: 'smart_park_sales', name: '智慧园区销售专员', industry: '政企项目', focus: '智慧园区和数字化项目' },
  { id: 'environmental_service_sales', name: '环保服务销售专员', industry: '政企项目', focus: '环保治理和环保服务' }
];

const enterpriseSalesRoleTemplates = salesRoleTemplateDefinitions.map(createSalesRoleTemplate);

const enterpriseCoreRoleTemplates: BaseServerRoleTemplateCatalogEntry[] = [
  createOfficeRoleTemplate({
    templateId: 'core_enterprise_researcher_v1',
    name: '企业调研专员',
    industry: '企业职能 / 市场调研',
    scenario: '企业调研、行业简报、竞品对比',
    description: '围绕目标公司、行业或竞品进行资料检索、企业知识结合和可引用报告输出。',
    plan: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '帮助销售、市场和管理者快速完成客户背景调查、行业判断和竞品分析。',
    knowledgeSources: ['企业知识库', '客户画像', '历史调研报告', '引用规范'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [additionalSkills.companyResearch, additionalSkills.industryBriefing, additionalSkills.competitorComparison],
    sampleInputs: [
      '请调研这家目标企业的业务、客户、近期动态和潜在合作切入点。',
      '请做一份行业简报，包含趋势、机会、风险、竞品和可引用来源。'
    ],
    outputFormat: 'Word 调研报告，包含执行摘要、来源列表、竞品矩阵、机会风险和下一步行动。',
    includeWebSearch: true,
    approvalPolicy: '对外引用、投资判断、战略结论和客户承诺必须由负责人复核。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_customer_support_agent_v1',
    name: '通用客服专员',
    industry: '企业职能 / 客户服务',
    scenario: '客户意图分流、回复草拟、知识库补全',
    description: '结合企业知识库、售后政策和历史工单，整理客户问题、生成回复建议和知识库补全项。',
    businessGoal: '降低客服重复回复成本，提高问题分流、升级和知识库沉淀效率。',
    knowledgeSources: ['企业知识库', '客服话术库', '售后政策', '产品 FAQ', '历史工单'],
    skills: [additionalSkills.customerIntentTriage, additionalSkills.supportReplyDrafting, additionalSkills.knowledgeBaseImprovement],
    sampleInputs: [
      '请整理这批客服聊天记录，按咨询、售后、退款、投诉和高风险情绪分组。',
      '请根据这 20 条高频问题，生成客服回复模板和需要补充到知识库的条目。'
    ],
    outputFormat: 'Word 客服处理文档，包含问题分流、建议回复、升级条件和知识库补全清单。',
    approvalPolicy: '涉及退款、赔偿、承诺、投诉升级和敏感客户时必须人工确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_after_sales_ticket_v1',
    name: '售后工单整理专员',
    industry: '企业职能 / 客户服务',
    scenario: '售后问题归类、工单优先级、处理建议',
    description: '把客户售后记录整理为工单、问题类型、优先级、责任建议和待补充信息。',
    businessGoal: '让售后负责人更快判断问题优先级、责任边界和下一步处理动作。',
    knowledgeSources: ['企业知识库', '售后政策', '质保规则', '历史工单', '升级流程'],
    skills: [additionalSkills.orderIssueTriage, additionalSkills.customerIntentTriage, additionalSkills.supportReplyDrafting],
    sampleInputs: [
      '请把这批售后聊天记录整理成工单表，标记优先级、问题类型和处理建议。',
      '请根据这些客户反馈识别高风险投诉、退款诉求和需要升级的问题。'
    ],
    outputFormat: 'Excel 工单表，包含客户、问题类型、优先级、建议回复、负责人和截止时间。',
    artifactType: 'xlsx',
    approvalPolicy: '涉及赔付、退款、召回、投诉升级和责任认定时必须人工确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_contract_review_v1',
    name: '合同审核专员',
    industry: '企业职能 / 法务合规',
    scenario: '合同条款提取、风险点识别、修改建议',
    description: '读取合同或协议，提取付款、交付、违约、保密、终止等关键条款并输出风险提示。',
    plan: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '减少法务初筛时间，帮助业务负责人提前发现合同风险和待确认条款。',
    knowledgeSources: ['企业知识库', '合同模板', '风险条款清单', '审批规范'],
    skills: [skills.clauseExtraction, skills.riskSummary, skills.approvalNote],
    sampleInputs: [
      '请审核这份采购合同，重点看付款、交付、违约责任和终止条款。',
      '请把这份协议里的高风险条款整理成风险清单和修改建议。'
    ],
    outputFormat: 'Word 合同初审报告，包含关键条款、风险等级、修改建议和人工确认项。',
    approvalPolicy: '不得替代正式法律意见；所有合同结论必须经过法务或负责人确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_recruiting_v1',
    name: '招聘简历筛选专员',
    industry: '企业职能 / 人力资源',
    scenario: '简历筛选、岗位匹配、候选人排序',
    description: '批量读取简历和岗位要求，输出候选人评分、匹配理由、风险和面试建议。',
    plan: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '提升招聘初筛效率，让候选人比较更结构化、更容易复核。',
    knowledgeSources: ['企业知识库', '岗位 JD', '能力模型', '面试评价标准'],
    skills: [skills.resumeScreening, skills.interviewSummary, skills.candidateRanking],
    sampleInputs: [
      '请根据这个岗位 JD 筛选这批简历，输出候选人排序和推荐理由。',
      '请整理这些面试记录，生成候选人优劣势和录用建议。'
    ],
    outputFormat: 'Excel 候选人排序表，包含评分、匹配点、风险、面试问题和建议动作。',
    artifactType: 'xlsx',
    approvalPolicy: '涉及录用、薪资、淘汰和敏感个人信息处理时必须人工确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_employee_policy_v1',
    name: '员工制度专员',
    industry: '企业职能 / 行政人事',
    scenario: '制度草拟、通知公告、流程说明',
    description: '根据企业要求和知识库资料生成制度、通知、公告、SOP 和流程说明。',
    businessGoal: '帮助中小企业快速形成规范、清晰、可复核的内部管理文档。',
    knowledgeSources: ['企业知识库', '员工手册', '制度模板', '流程规范'],
    skills: [
      skill('policy_drafting', '制度草拟', '生成内部制度、公告、通知和流程文档。'),
      additionalSkills.documentExtraction,
      additionalSkills.archiveChecklist
    ],
    sampleInputs: [
      '请帮我写一份员工请假制度，正式一点，适合公司内部发布。',
      '请根据这些流程说明整理一份员工入职 SOP。'
    ],
    outputFormat: 'Word 制度文档，包含适用范围、规则、流程、责任和执行注意事项。',
    approvalPolicy: '正式发布制度、处罚条款、薪酬福利和劳动关系内容前必须由负责人确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_reimbursement_v1',
    name: '报销票据整理专员',
    industry: '企业职能 / 财务',
    scenario: '票据提取、报销审核、费用归类',
    description: '整理发票、报销单和费用明细，输出报销清单、异常项和需要补充的材料。',
    plan: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '减少财务票据整理和报销初审时间，提高费用归类一致性。',
    knowledgeSources: ['企业知识库', '报销制度', '费用科目', '票据规范'],
    skills: [skills.invoiceExtraction, skills.reimbursementReview, skills.reportReconciliation],
    sampleInputs: [
      '请整理这些报销票据，生成费用明细、异常项和缺失材料。',
      '请按公司报销制度检查这份报销单是否合规。'
    ],
    outputFormat: 'Excel 报销整理表，包含费用科目、金额、票据状态、异常项和补充材料。',
    artifactType: 'xlsx',
    approvalPolicy: '涉及付款、税务、报销通过和异常费用认定时必须由财务确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_receivables_followup_v1',
    name: '应收账款提醒专员',
    industry: '企业职能 / 财务',
    scenario: '账期整理、催款提醒、客户清单',
    description: '根据应收账款表和客户记录整理逾期情况、催款优先级和沟通文案。',
    plan: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '帮助财务和销售及时发现逾期账款，形成更清晰的催收动作。',
    knowledgeSources: ['企业知识库', '客户合同', '账期规则', '历史回款记录'],
    skills: [
      skill('receivables_analysis', '应收分析', '识别账龄、逾期金额、风险客户和责任人。'),
      skills.outreachDrafting,
      skills.nextActionPlanning
    ],
    sampleInputs: [
      '请根据这份应收账款表生成逾期客户清单、催款优先级和沟通话术。',
      '请整理本月需要提醒回款的客户，按风险和金额排序。'
    ],
    outputFormat: 'Excel 应收跟进表，包含客户、金额、账龄、风险、负责人、催款建议。',
    artifactType: 'xlsx',
    approvalPolicy: '涉及正式催收、停服、法律动作和客户信用判断时必须由负责人确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_ecommerce_copywriter_v1',
    name: '电商商品文案专员',
    industry: '企业职能 / 电商运营',
    scenario: '商品标题、卖点、详情页文案、活动话术',
    description: '根据商品资料、用户评价和平台要求生成商品文案、卖点和活动话术。',
    businessGoal: '提升商品上架、活动准备和客服转化文案效率。',
    knowledgeSources: ['企业知识库', '商品资料', '品牌话术', '平台规则', '历史爆款文案'],
    skills: [additionalSkills.catalogOptimization, skills.draftGeneration, skills.publishingReview],
    sampleInputs: [
      '请根据这个商品资料生成电商标题、五个卖点和详情页文案。',
      '请把这些用户评价整理成可用于详情页的卖点和 FAQ。'
    ],
    outputFormat: 'Word 商品文案，包含标题、卖点、详情页结构、FAQ、活动话术和风险提醒。',
    approvalPolicy: '涉及功效承诺、医疗健康、价格权益和平台敏感词时必须人工确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_requirement_analyst_v1',
    name: '需求分析专员',
    industry: '企业职能 / 项目交付',
    scenario: '客户需求整理、范围边界、验收标准',
    description: '把客户描述、会议记录和附件资料整理成需求文档、范围边界和验收标准。',
    plan: 'ENTERPRISE_BASIC_MONTHLY',
    businessGoal: '让项目团队更快拿到清晰、可确认、可执行的需求输入。',
    knowledgeSources: ['企业知识库', '客户资料', '项目模板', '验收标准'],
    skills: [additionalSkills.productRequirementDrafting, additionalSkills.acceptanceCriteria, additionalSkills.projectPlanning],
    sampleInputs: [
      '请把这段客户沟通记录整理成需求文档，包含范围、边界和验收标准。',
      '请根据这些材料生成一份项目需求分析和待确认问题清单。'
    ],
    outputFormat: 'Word 需求文档，包含背景、目标、范围、功能点、验收标准、风险和待确认问题。',
    approvalPolicy: '进入报价、排期和研发实施前必须由客户或项目负责人确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_project_proposal_v1',
    name: '项目方案专员',
    industry: '企业职能 / 项目交付',
    scenario: '项目方案、实施计划、交付清单',
    description: '根据客户需求和企业能力资料生成项目方案、交付范围、里程碑和验收标准。',
    plan: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提高售前和交付方案输出速度，统一项目边界和交付口径。',
    knowledgeSources: ['企业知识库', '产品资料', '成功案例', '交付标准'],
    skills: [additionalSkills.proposalStructuring, additionalSkills.valueProposition, additionalSkills.deliveryPlan],
    sampleInputs: [
      '请根据客户访谈记录，生成一版项目方案和实施计划。',
      '请把这些产品资料整理成面向客户的项目交付方案。'
    ],
    outputFormat: 'Word 项目方案，包含客户背景、目标、方案、里程碑、交付物、风险和验收。',
    approvalPolicy: '正式对外发送方案、报价、工期和承诺前必须由负责人确认。'
  }),
  createOfficeRoleTemplate({
    templateId: 'core_procurement_assistant_v1',
    name: '采购助理',
    industry: '企业职能 / 采购供应链',
    scenario: '供应商调研、报价对比、采购清单生成',
    description: '整理供应商资料、报价单和采购需求，输出对比分析、风险和推荐方案。',
    plan: 'ENTERPRISE_STANDARD_MONTHLY',
    businessGoal: '提升供应商筛选和报价对比效率，降低采购决策遗漏风险。',
    knowledgeSources: ['企业知识库', '采购制度', '供应商库', '报价单', '合同模板'],
    tools: ['web-search', 'office-document', 'local-filesystem'],
    skills: [additionalSkills.supplierResearch, additionalSkills.quoteComparison, additionalSkills.purchaseChecklist],
    sampleInputs: [
      '请对比这三份供应商报价，输出价格、交期、付款、风险和推荐方案。',
      '请根据采购需求生成供应商调研清单、验收标准和合同注意点。'
    ],
    outputFormat: 'Excel 供应商对比表，包含报价、交期、付款、风险、验收标准和推荐结论。',
    artifactType: 'xlsx',
    includeWebSearch: true,
    approvalPolicy: '涉及最终供应商选择、付款条件和合同条款时必须由采购负责人确认。'
  })
];

const digitalFactoryRoleTemplates: BaseServerRoleTemplateCatalogEntry[] = [
  {
    templateId: 'factory_cross_border_product_images_v1',
    applicationType: 'DIGITAL_FACTORY',
    version: DESIGNED_ROLE_TEMPLATE_VERSION,
    name: '跨境商品图工厂',
    industry: '跨境电商 / 商品图片',
    scenario: '批量生成白底图、主图、场景图、换背景、换模特、尺寸图和卖点图',
    description: '面向跨境电商团队，批量上传商品参考图，选择目标平台和产物包后生成图片结果 URL 与本地缩略图预览。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '把跨境商品图从单张手工制作提升为批量化工厂流程，减少运营制图和重复提示词调试成本。',
    knowledgeSources: ['企业知识库', '品牌素材规范', '跨境平台图片规则', '历史优质商品图案例'],
    tools: ['local-filesystem'],
    skills: [
      skill('product_image_understanding', '商品图理解', '识别商品主体、材质、颜色、使用场景和平台展示约束。'),
      skill('prompt_package_generation', '分包提示词生成', '按白底图、主图、场景图等产物包生成稳定生图提示词。'),
      skill('image_batch_generation', '批量生图', '按用户勾选产物包并发生成商品图结果，输出 URL 和缩略图预览。')
    ],
    workflowSteps: [
      {
        id: 'factory_input',
        order: 1,
        type: 'input',
        name: '接收商品批次',
        instruction: '接收商品图片、SKU 表格、目标平台、勾选产物包和质检模式。'
      },
      {
        id: 'gather_factory_rules',
        order: 2,
        type: 'knowledge',
        name: '读取平台和品牌规则',
        instruction: '读取企业知识库里的平台规则、品牌素材规范、禁用词和历史优质商品图案例。'
      },
      {
        id: 'prepare_batch',
        order: 3,
        type: 'llm',
        name: '整理批次参数',
        instruction: '把商品图、SKU、目标平台和产物包整理成可并发执行的批次 JSON。'
      },
      {
        id: 'generate_package_prompts',
        order: 4,
        type: 'llm',
        name: '理解图片并生成提示词',
        instruction: '用多模态模型理解商品图，同时生成各产物包的稳定生图提示词。'
      },
      {
        id: 'generate_images',
        order: 5,
        type: 'llm',
        name: '批量生成商品图',
        instruction: '按商品批次和所选产物包调用图片生成模型，输出图片远程 URL 元数据。'
      },
      {
        id: 'quality_check',
        order: 6,
        type: 'llm',
        name: '可选质检',
        instruction: '按用户选择执行基础规则检查或多模态质检。'
      },
      {
        id: 'factory_output',
        order: 7,
        type: 'output',
        name: '返回结果',
        instruction: '返回批量任务统计、失败项和图片预览结果。'
      }
    ],
    workflowGraph: buildCrossBorderImageFactoryWorkflowGraph(),
    dependencyManifestFactory: buildCrossBorderImageFactoryManifest(),
    sampleInputs: [
      '请把这批商品图按 Amazon 生成白底图、主图、场景图、尺寸图和卖点图。',
      '请按 Temu 风格批量生成商品图，保留主体一致，开启基础质检。'
    ],
    outputFormat: '图片批次结果，包含各 SKU 的产物包、远程图片 URL、本地缩略图、失败原因和质检摘要。',
    allowedPlanCodes: allowedPlanCodesFrom('ENTERPRISE_PRO_MONTHLY'),
    approvalPolicy: '生成前由用户选择产物包和目标平台；对外发布前需人工复核平台规则、品牌合规和图片真实性。'
  },
  {
    templateId: 'factory_medical_case_video_screening_v1',
    applicationType: 'DIGITAL_FACTORY',
    version: DESIGNED_ROLE_TEMPLATE_VERSION,
    name: '案例视频质检剪辑工厂',
    industry: '医疗健康 / 案例视频运营',
    scenario: '批量筛选案例视频、ASR 转写、素材评分和可选初剪',
    description: '面向医疗健康案例视频运营场景，按硬性规则先筛掉不合格视频，再对通过视频做表达质量评分，并可选生成本地初剪视频。',
    recommendedPlanCode: 'ENTERPRISE_PRO_MONTHLY',
    businessGoal: '用稳定的批量筛选和评分流程替代人工初筛，降低案例视频素材审核与粗剪成本。',
    knowledgeSources: ['企业知识库', '案例视频筛选标准', '医疗内容合规边界', '历史高质量案例素材'],
    tools: ['video-processing', 'office-document', 'local-filesystem'],
    skills: [
      skill('video_gate_screening', '视频硬性筛选', '按比例、时长、音轨、ASR 质量和内容完整性逐级筛掉不合格素材。'),
      skill('case_expression_scoring', '案例表达评分', '按表达清晰度、改善表述完整度、自然度和剪辑价值评分。'),
      skill('rough_cut_planning', '可选初剪规划', '在用户开启初剪时生成剪辑计划并调用本地视频工具导出片段。')
    ],
    workflowSteps: [
      {
        id: 'factory_input',
        order: 1,
        type: 'input',
        name: '接收视频批次',
        instruction: '接收用户上传的案例视频、筛选配置、ASR 方言设置和是否初剪。'
      },
      {
        id: 'load_screening_rules',
        order: 2,
        type: 'knowledge',
        name: '读取筛选标准',
        instruction: '读取企业知识库中的案例视频标准、合规边界、禁用表述和人工复核规则。'
      },
      {
        id: 'screen_score_and_edit',
        order: 3,
        type: 'llm',
        name: '批量筛选评分',
        instruction: '按视频规格、ASR 质量、内容完整性逐级筛选；通过后再做表达质量评分，并按用户开关决定是否生成初剪。'
      },
      {
        id: 'factory_output',
        order: 4,
        type: 'output',
        name: '返回结果',
        instruction: '返回筛选评分表、失败原因、需人工复核项和可选初剪视频。'
      }
    ],
    workflowGraph: buildMedicalCaseVideoScreeningFactoryWorkflowGraph(),
    dependencyManifestFactory: buildMedicalCaseVideoFactoryManifest(),
    sampleInputs: [
      '请筛选这批用户案例视频，普通话和方言自动识别，输出筛选评分表，不开启初剪。',
      '请按医疗案例素材标准筛选视频，通过评分高的视频生成 30 秒以内初剪。'
    ],
    outputFormat: 'Excel 筛选评分表、失败原因、ASR 转写摘要、风险提示和可选 MP4 初剪视频。',
    allowedPlanCodes: allowedPlanCodesFrom('ENTERPRISE_PRO_MONTHLY'),
    approvalPolicy: '只评价素材质量和表达质量，不做医疗诊断或疗效真实性判断；医疗相关内容发布前必须人工复核。'
  }
];

const designedServerRoleTemplateCatalog: BaseServerRoleTemplateCatalogEntry[] = [
  ...freeBasicRoleTemplates,
  ...enterpriseCoreRoleTemplates,
  ...digitalFactoryRoleTemplates,
  ...enterpriseSalesRoleTemplates
];

const allServerRoleTemplateCatalogCandidates: BaseServerRoleTemplateCatalogEntry[] = [
  ...baseServerRoleTemplateCatalog,
  ...designedServerRoleTemplateCatalog
];

const productionRoleTemplateIds = designedServerRoleTemplateCatalog.map((template) => template.templateId);

const productionRoleTemplateIdSet = new Set<string>(productionRoleTemplateIds);

function requireBaseRoleTemplate(templateId: string): BaseServerRoleTemplateCatalogEntry {
  const template = allServerRoleTemplateCatalogCandidates.find((item) => item.templateId === templateId);
  if (!template) {
    throw new Error(`Missing production role template: ${templateId}`);
  }
  return template;
}

export const retiredServerRoleTemplateIds = baseServerRoleTemplateCatalog
  .map((template) => template.templateId)
  .filter((templateId) => !productionRoleTemplateIdSet.has(templateId));

export const serverRoleTemplateCatalog: ServerRoleTemplateCatalogEntry[] =
  productionRoleTemplateIds.map((templateId) => completeCatalogEntry(requireBaseRoleTemplate(templateId)));

export const serverRoleTemplateCatalogById = new Map(
  serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const)
);
