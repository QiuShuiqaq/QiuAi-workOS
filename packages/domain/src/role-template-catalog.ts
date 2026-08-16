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
  outputCategory?: string;
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

const imageGenerationAssistantSkills: RoleSkill[] = [
  {
    code: 'single_image_prompting',
    name: '单图提示词理解',
    summary: '把用户的画面、风格、比例和用途要求整理成一次生图指令。'
  },
  {
    code: 'reference_image_generation',
    name: '参考图生成',
    summary: '在用户上传参考图时保留主体关键外观、颜色、结构和风格方向。'
  },
  {
    code: 'image_result_delivery',
    name: '图片产物保存',
    summary: '把远程图片结果保存为本地 PNG，方便预览、复制和后续使用。'
  }
];

const videoGenerationAssistantSkills: RoleSkill[] = [
  {
    code: 'single_video_prompting',
    name: '单条视频提示词理解',
    summary: '把用户的镜头、动作、画幅、时长和风格要求整理成一次生视频指令。'
  },
  {
    code: 'reference_image_video_generation',
    name: '参考图生视频',
    summary: '在用户上传参考图时保留主体外观和画面风格，生成稳定短视频。'
  },
  {
    code: 'video_result_delivery',
    name: '视频产物保存',
    summary: '把远程视频结果保存为本地 MP4，方便预览、打开和复核。'
  }
];

const allDigitalEmployeePlanCodes = [
  'PERSONAL_FREE',
  'PERSONAL_MEMBER_MONTHLY',
  'PERSONAL_MEMBER_ANNUAL',
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
];

function roleGraphEdge(sourceNodeId: string, targetNodeId: string): RoleWorkflowGraph['edges'][number] {
  return {
    id: `${sourceNodeId}__${targetNodeId}`,
    sourceNodeId,
    targetNodeId,
    condition: {
      type: 'always'
    }
  };
}

function buildSingleMediaAssistantWorkflowGraph(input: {
  mediaKind: 'image' | 'video';
  mediaLabel: string;
  artifactType: 'png' | 'mp4';
  modelProfileId: 'qiu-image-generation-default' | 'qiu-video-generation-default';
  llmTaskType: 'image_generation' | 'video_generation';
  folder: string;
  defaultAspectRatio: string;
  defaultDurationSeconds?: number;
  generationInstruction: string;
}): RoleWorkflowGraph {
  return {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      {
        id: 'start',
        type: 'start',
        name: 'Start',
        description: 'Workflow entry node.'
      },
      {
        id: 'receive_input',
        type: 'input',
        name: '接收创作需求',
        instruction: `整理用户输入、可选参考图、画面比例、风格和限制条件；本数字员工每次只生成一个${input.mediaLabel}。`,
        inputVariables: ['start.text', 'start.images'],
        outputVariables: ['media_request'],
        config: {
          source: 'single_media_assistant'
        }
      },
      {
        id: 'generate_media',
        type: 'llm',
        name: `生成${input.mediaLabel}`,
        instruction: input.generationInstruction,
        modelProfileId: input.modelProfileId,
        inputVariables: ['media_request', 'start.images'],
        outputVariables: ['generated_media'],
        config: {
          llmTaskType: input.llmTaskType,
          outputMode: 'json',
          aspectRatio: input.defaultAspectRatio,
          responseFormat: 'url',
          ...(input.defaultDurationSeconds ? { durationSeconds: input.defaultDurationSeconds } : {}),
          requiredToolActions: [
            { toolId: 'local-filesystem', action: 'filesystem.download_remote_file' }
          ],
          output: {
            folder: input.folder,
            mediaKind: input.mediaKind,
            format: input.artifactType
          }
        }
      },
      {
        id: 'save_media',
        type: 'artifact',
        name: `保存${input.mediaLabel}`,
        instruction: `把生成模型返回的远程 URL 保存成本地 ${input.artifactType} 文件。`,
        toolId: 'local-filesystem',
        artifactType: input.artifactType,
        inputVariables: ['generated_media'],
        outputVariables: ['media_file'],
        config: {
          action: 'filesystem.download_remote_file',
          input: {
            url: '$generated_media.remoteUrl',
            folder: input.folder,
            fileName: '{{task.title}}',
            mediaKind: input.mediaKind
          }
        }
      }
    ],
    edges: [
      roleGraphEdge('start', 'receive_input'),
      roleGraphEdge('receive_input', 'generate_media'),
      roleGraphEdge('generate_media', 'save_media')
    ],
    runtimePolicy: {
      maxNodeExecutions: 12,
      maxLoopIterations: 1,
      requireApprovalBeforeTools: false
    }
  };
}

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
    allowedPlanCodes: allDigitalEmployeePlanCodes,
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
  },
  {
    templateId: 'template_image_generation_assistant_v1',
    applicationType: 'digital_employee',
    roleCode: 'ai-image-generation-assistant',
    name: 'AI 生图助手',
    version: '1.0.0',
    summary: '输入图片需求或上传参考图，生成单张 PNG 图片。',
    industry: '通用创作 / 图片生成',
    scenario: '输入图片需求或上传参考图，生成单张图片并保存到本地',
    description: '面向个人和企业的单次生图数字员工。用户描述画面、比例和用途，或上传一张参考图，即可生成一张可预览、可下载的图片产物。',
    recommendedPlanCode: 'PERSONAL_FREE',
    allowedPlanCodes: allDigitalEmployeePlanCodes,
    canInstall: true,
    businessGoal: '把零散生图需求收敛成一个简单入口，适合头像、封面、海报草图、商品素材和创意图片的单次生成。',
    knowledgeSources: ['用户提示词', '可选参考图片', '企业视觉规范', '历史优质提示词'],
    tools: ['local-filesystem'],
    executionProfile: {
      mode: 'conversation',
      summary: '对话式数字员工：由用户输入图片需求或上传参考图，调用生图模型生成一张图片并保存到本地。',
      triggerModes: ['manual'],
      inputSources: ['chat', 'uploaded_files', 'enterprise_knowledge'],
      toolCapabilities: ['llm', 'local_files', 'approval_queue'],
      outputTargets: ['chat_response', 'artifact', 'approval_queue'],
      approval: {
        required: true,
        requiredActions: ['对外发布前复核版权、人物肖像、品牌和事实表达']
      },
      dataBoundary: 'local_first',
      rolloutPhase: 'ready',
      notes: ['当前版本只支持单次生成一张图片；批量图片生产请使用数字工厂。']
    },
    approvalPolicy: '涉及人物肖像、品牌 Logo、版权素材、医疗金融法律事实表达或对外商业发布时，必须由用户人工复核。',
    skills: imageGenerationAssistantSkills,
    workflowSteps: [
      {
        id: 'receive_input',
        order: 1,
        type: 'input',
        name: '接收创作需求',
        instruction: '接收用户输入、可选参考图、比例和风格要求，确认本次只生成一个图片结果。'
      },
      {
        id: 'generate_media',
        order: 2,
        type: 'llm',
        name: '生成图片',
        instruction: '调用生图模型，输出一个远程 PNG 图片 URL，不返回二进制或 base64。'
      },
      {
        id: 'save_media',
        order: 3,
        type: 'tool',
        name: '保存 PNG 图片',
        instruction: '把模型返回的远程 PNG 图片下载保存到 PC 本地产物目录。',
        toolIds: ['local-filesystem']
      },
      {
        id: 'final_output',
        order: 4,
        type: 'output',
        name: '返回结果',
        instruction: '返回生成结果、本地 PNG 路径和需要人工复核的事项。'
      }
    ],
    workflowGraph: buildSingleMediaAssistantWorkflowGraph({
      mediaKind: 'image',
      mediaLabel: '图片',
      artifactType: 'png',
      modelProfileId: 'qiu-image-generation-default',
      llmTaskType: 'image_generation',
      folder: 'generated-images',
      defaultAspectRatio: '1:1',
      generationInstruction:
        '根据用户输入和可选参考图生成一张图片。必须遵守用户指定的比例、用途、文字语言和禁用要求；没有指定比例时使用 1:1。只输出一个图片结果 URL 的结构化 JSON。'
    }),
    sampleInputs: [
      '生成一张 1:1 的科技感头像，深色背景，干净高级，不要文字。',
      '参考我上传的产品图，生成一张 16:9 的宣传封面，画面简洁，文字留白区域明显。'
    ],
    outputFormat: '单张 PNG 图片，本地保存后可在产物预览区查看和打开。',
    modelProfileIds: ['qiu-image-generation-default'],
    toolIds: ['local-filesystem'],
    requiredKnowledgeSources: ['server_summary'],
    defaultTaskTypes: ['image_generation'],
    syncPolicy: 'summary_only',
    installNote: '适合头像、封面、海报草图、商品素材和创意图片的单次生成。'
  },
  {
    templateId: 'template_video_generation_assistant_v1',
    applicationType: 'digital_employee',
    roleCode: 'ai-video-generation-assistant',
    name: 'AI 生视频助手',
    version: '1.0.0',
    summary: '输入视频需求或上传参考图，生成单条 MP4 视频。',
    industry: '通用创作 / 视频生成',
    scenario: '输入视频需求或上传参考图，生成单条短视频并保存到本地',
    description: '面向个人和企业的单次生视频数字员工。用户描述镜头、动作、时长和画幅，或上传一张参考图，即可生成一条可预览、可下载的短视频产物。',
    recommendedPlanCode: 'PERSONAL_FREE',
    allowedPlanCodes: allDigitalEmployeePlanCodes,
    canInstall: true,
    businessGoal: '提供轻量的单条视频生成入口，适合封面动效、商品短片、口播背景、宣传片段和创意视频草稿。',
    knowledgeSources: ['用户提示词', '可选参考图片', '企业视频规范', '历史优质脚本'],
    tools: ['local-filesystem'],
    executionProfile: {
      mode: 'conversation',
      summary: '对话式数字员工：由用户输入视频需求或上传参考图，调用生视频模型生成一条短视频并保存到本地。',
      triggerModes: ['manual'],
      inputSources: ['chat', 'uploaded_files', 'enterprise_knowledge'],
      toolCapabilities: ['llm', 'local_files', 'approval_queue'],
      outputTargets: ['chat_response', 'artifact', 'approval_queue'],
      approval: {
        required: true,
        requiredActions: ['对外发布前复核版权、肖像、品牌、事实和平台规则']
      },
      dataBoundary: 'local_first',
      rolloutPhase: 'ready',
      notes: ['当前版本只支持单次生成一条视频；批量视频生产请使用数字工厂。']
    },
    approvalPolicy: '涉及人物肖像、品牌 Logo、版权素材、医疗金融法律事实表达或平台发布时，必须由用户人工复核。',
    skills: videoGenerationAssistantSkills,
    workflowSteps: [
      {
        id: 'receive_input',
        order: 1,
        type: 'input',
        name: '接收创作需求',
        instruction: '接收用户输入、可选参考图、比例、时长和风格要求，确认本次只生成一个视频结果。'
      },
      {
        id: 'generate_media',
        order: 2,
        type: 'llm',
        name: '生成视频',
        instruction: '调用生视频模型，输出一个远程 MP4 视频 URL，不返回二进制或 base64。'
      },
      {
        id: 'save_media',
        order: 3,
        type: 'tool',
        name: '保存 MP4 视频',
        instruction: '把模型返回的远程 MP4 视频下载保存到 PC 本地产物目录。',
        toolIds: ['local-filesystem']
      },
      {
        id: 'final_output',
        order: 4,
        type: 'output',
        name: '返回结果',
        instruction: '返回生成结果、本地 MP4 路径和需要人工复核的事项。'
      }
    ],
    workflowGraph: buildSingleMediaAssistantWorkflowGraph({
      mediaKind: 'video',
      mediaLabel: '视频',
      artifactType: 'mp4',
      modelProfileId: 'qiu-video-generation-default',
      llmTaskType: 'video_generation',
      folder: 'generated-videos',
      defaultAspectRatio: '9:16',
      defaultDurationSeconds: 6,
      generationInstruction:
        '根据用户输入和可选参考图生成一条短视频。必须遵守用户指定的镜头、动作、时长、画幅和禁用要求；没有指定画幅时使用 9:16，没有指定时长时使用 6 秒。只输出一个视频结果 URL 的结构化 JSON。'
    }),
    sampleInputs: [
      '生成一条 6 秒 9:16 的产品展示短视频，镜头缓慢推进，背景干净，不要夸张特效。',
      '参考我上传的图片，生成一条横屏 16:9 的品牌宣传短视频，节奏稳重，有轻微镜头运动。'
    ],
    outputFormat: '单条 MP4 视频，本地保存后可在产物预览区查看和打开。',
    modelProfileIds: ['qiu-video-generation-default'],
    toolIds: ['local-filesystem'],
    requiredKnowledgeSources: ['server_summary'],
    defaultTaskTypes: ['video_generation'],
    syncPolicy: 'summary_only',
    installNote: '适合封面动效、商品短片、口播背景、宣传片段和创意视频草稿的单次生成。'
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
