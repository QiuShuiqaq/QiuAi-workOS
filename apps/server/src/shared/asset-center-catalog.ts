import { listServerToolActionCatalog } from './tool-action-catalog';

export type ServerAssetDefinitionType =
  | 'VARIABLE'
  | 'MODEL'
  | 'TOOL'
  | 'ARTIFACT_TEMPLATE'
  | 'NODE_TEMPLATE';

export type ServerAssetDefinitionStatus = 'ACTIVE' | 'DISABLED' | 'ARCHIVED';

export type ServerAssetDefinitionScope = 'SYSTEM' | 'CUSTOM';

export interface ServerAssetDefinitionSeed {
  type: ServerAssetDefinitionType;
  key: string;
  name: string;
  description?: string;
  category: string;
  status: ServerAssetDefinitionStatus;
  scope: ServerAssetDefinitionScope;
  version: string;
  schema: Record<string, unknown>;
  defaults: Record<string, unknown>;
  tags: string[];
  sortOrder: number;
}

const variableAssets: ServerAssetDefinitionSeed[] = [
  variable(1000, 'task_text', '任务要求', 'system', '用户在 PC 端输入的任务指令。', 'text', ['start', 'llm', 'tool']),
  variable(1010, 'input_files', '上传附件', 'system', '用户拖入聊天框的全部附件。', 'files', ['start', 'tool']),
  variable(1020, 'input_file', '主附件', 'system', '当前任务默认处理的第一个附件。', 'file', ['tool']),
  variable(1030, 'document_text', '文档原文', 'document', '从 Word、PDF、TXT 等文件读取出的原始文本。', 'text', ['llm']),
  variable(1040, 'search_results', '网页搜索结果', 'web', '网页搜索返回的结构化结果。', 'json', ['llm', 'condition']),
  variable(1050, 'web_context', '网页参考内容', 'web', '适合直接交给模型使用的网页摘要文本。', 'text', ['llm']),
  variable(1060, 'analysis_result', '分析结果', 'analysis', '模型或工具生成的分析结论。', 'text', ['llm', 'condition', 'artifact']),
  variable(1070, 'draft_content', '初稿正文', 'document', '模型生成但尚未质检的正文。', 'text', ['llm', 'artifact']),
  variable(1080, 'final_content', '最终正文', 'document', '用于写入 Word、Markdown、PDF 的正式正文。', 'text', ['artifact', 'output']),
  variable(1090, 'table_rows', '表格数据', 'table', '用于生成 Excel 或 CSV 的二维表格数据。', 'table', ['artifact', 'tool']),
  variable(1100, 'artifact_title', '产物标题', 'artifact', '最终交付文件的标题。', 'text', ['artifact']),
  variable(1110, 'artifact_file', '产物文件', 'artifact', '工具生成的本地交付文件。', 'artifact', ['output']),
  variable(1120, 'assistant_message', '对话说明', 'output', '只显示在聊天框的补充说明，不写入交付文件。', 'text', ['output']),
  variable(1130, 'image_assets', '图片素材', 'media', '用户上传或工具生成的图片地址集合。', 'images', ['llm', 'tool']),
  variable(1140, 'video_asset', '视频素材', 'media', '用户上传或读取到的视频文件地址。', 'video', ['llm', 'tool'])
];

const modelAssets: ServerAssetDefinitionSeed[] = [
  model('deepseek-v4-flash', 'DeepSeek V4 Flash', 'deepseek', 'deepseek-v4-flash', ['text'], ['text'], ['文档整理', '内容生成', '通用问答']),
  model('deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek', 'deepseek-v4-pro', ['reasoning', 'text'], ['text'], ['复杂分析', '多步骤推理']),
  model('deepseek-chat', 'DeepSeek Chat', 'deepseek', 'deepseek-chat', ['text'], ['text'], ['通用文本任务']),
  model('deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek', 'deepseek-reasoner', ['reasoning', 'text'], ['text'], ['深度推理']),
  model('qwen-plus', '通义千问 Plus', 'qwen', 'qwen-plus', ['text'], ['text'], ['中文文档', '企业知识问答']),
  model('qwen-vl-max', '通义千问 VL Max', 'qwen', 'qwen-vl-max', ['vision', 'text'], ['text'], ['图片理解', '图文分析']),
  model('doubao-pro', '豆包 Pro', 'doubao', 'doubao-pro', ['text'], ['text'], ['长文处理', '内容生成']),
  model('doubao-vision', '豆包视觉模型', 'doubao', 'doubao-vision', ['vision', 'text'], ['text'], ['图片理解']),
  model('kimi-k2', 'Kimi K2', 'moonshot', 'kimi-k2', ['text', 'reasoning'], ['text'], ['长上下文分析']),
  model('glm-4-plus', 'GLM-4 Plus', 'zhipu', 'glm-4-plus', ['text'], ['text'], ['通用文本任务'])
];

const artifactTemplateAssets: ServerAssetDefinitionSeed[] = [
  artifactTemplate('formal-docx', '简洁正式 Word 文档', 'docx', ['artifact_title', 'final_content'], 'office.write_docx_document', '{{artifact_title}}-整理版'),
  artifactTemplate('technical-docx', '技术方案 Word 文档', 'docx', ['artifact_title', 'final_content'], 'office.write_docx_document', '{{artifact_title}}-技术方案'),
  artifactTemplate('analysis-xlsx', '分析表格 Excel', 'xlsx', ['artifact_title', 'table_rows'], 'spreadsheet.write_xlsx', '{{artifact_title}}-分析表'),
  artifactTemplate('quote-xlsx', '报价清单 Excel', 'xlsx', ['artifact_title', 'table_rows'], 'spreadsheet.write_xlsx', '{{artifact_title}}-报价清单'),
  artifactTemplate('plain-markdown', 'Markdown 文档', 'markdown', ['artifact_title', 'final_content'], 'office.write_markdown_document', '{{artifact_title}}'),
  artifactTemplate('summary-pdf', 'PDF 摘要文档', 'pdf', ['artifact_title', 'final_content'], 'office.write_docx_document', '{{artifact_title}}-摘要'),
  artifactTemplate('slides-pptx', '演示 PPT', 'pptx', ['artifact_title', 'table_rows'], 'presentation.write_pptx', '{{artifact_title}}-演示稿')
];

const nodeTemplateAssets: ServerAssetDefinitionSeed[] = [
  nodeTemplate('receive-input', '接收输入', 'input', ['task_text', 'input_files'], ['task_text', 'input_files']),
  nodeTemplate('read-document', '读取文档', 'tool', ['input_file'], ['document_text']),
  nodeTemplate('web-research', '网页调研', 'tool', ['task_text'], ['search_results', 'web_context']),
  nodeTemplate('document-draft', '整理正文', 'llm', ['task_text', 'document_text'], ['final_content']),
  nodeTemplate('table-extraction', '提取表格', 'llm', ['task_text', 'document_text'], ['table_rows']),
  nodeTemplate('quality-review', '质量检查', 'llm', ['final_content'], ['assistant_message']),
  nodeTemplate('condition-route', '条件分支', 'condition', ['analysis_result'], ['analysis_result']),
  nodeTemplate('write-artifact', '生成产物', 'artifact', ['artifact_title', 'final_content'], ['artifact_file']),
  nodeTemplate('final-output', '返回结果', 'output', ['artifact_file', 'assistant_message'], ['assistant_message'])
];

export function getDefaultAssetDefinitions(): ServerAssetDefinitionSeed[] {
  const toolAssets = listServerToolActionCatalog().actions.map((action, index) => ({
    type: 'TOOL' as const,
    key: action.actionId,
    name: action.name,
    description: action.description,
    category: action.category,
    status: 'ACTIVE' as const,
    scope: 'SYSTEM' as const,
    version: '1.0.0',
    schema: {
      packageId: action.packageId,
      actionId: action.actionId,
      input: action.input,
      output: action.output,
      uiFields: action.uiFields,
      requiredConfig: action.requiredConfig,
      requiredDependencies: action.requiredDependencies,
      artifactFormat: action.artifactFormat,
      maturity: action.maturity
    },
    defaults: action.defaultInput,
    tags: [action.packageId, action.category, action.artifactFormat].filter((value): value is string => Boolean(value)),
    sortOrder: 3000 + index
  }));

  return [
    ...variableAssets,
    ...modelAssets,
    ...toolAssets,
    ...artifactTemplateAssets,
    ...nodeTemplateAssets
  ];
}

function variable(
  sortOrder: number,
  key: string,
  name: string,
  category: string,
  description: string,
  valueType: string,
  usableIn: string[]
): ServerAssetDefinitionSeed {
  return {
    type: 'VARIABLE',
    key,
    name,
    description,
    category,
    status: 'ACTIVE',
    scope: 'SYSTEM',
    version: '1.0.0',
    schema: {
      valueType,
      source: category,
      usableIn,
      required: false
    },
    defaults: {},
    tags: [category, valueType],
    sortOrder
  };
}

function model(
  key: string,
  name: string,
  providerId: string,
  modelId: string,
  capabilities: string[],
  outputTypes: string[],
  recommendedUseCases: string[]
): ServerAssetDefinitionSeed {
  return {
    type: 'MODEL',
    key,
    name,
    description: `${name} 模型能力定义，API Key 由 PC 端配置。`,
    category: providerId,
    status: 'ACTIVE',
    scope: 'SYSTEM',
    version: '1.0.0',
    schema: {
      providerId,
      providerName: providerId,
      modelId,
      capabilities,
      inputTypes: capabilities.includes('vision') ? ['text', 'image'] : ['text'],
      outputTypes,
      credentialFields: ['apiKey', 'apiBaseUrl'],
      recommendedUseCases
    },
    defaults: {
      temperature: capabilities.includes('reasoning') ? 0.3 : 0.7,
      maxTokens: 4000
    },
    tags: [providerId, ...capabilities],
    sortOrder: 2000
  };
}

function artifactTemplate(
  key: string,
  name: string,
  artifactType: string,
  inputVariables: string[],
  toolActionId: string,
  fileNamePattern: string
): ServerAssetDefinitionSeed {
  return {
    type: 'ARTIFACT_TEMPLATE',
    key,
    name,
    description: `${name} 的标准交付格式。`,
    category: artifactType,
    status: 'ACTIVE',
    scope: 'SYSTEM',
    version: '1.0.0',
    schema: {
      artifactType,
      inputVariables,
      toolActionId,
      fileNamePattern,
      contentRules: ['只写入交付正文', '对话说明不进入文件', '文件名使用业务标题']
    },
    defaults: {
      folder: artifactType === 'xlsx' ? 'spreadsheets' : 'documents'
    },
    tags: [artifactType, 'artifact'],
    sortOrder: 4000
  };
}

function nodeTemplate(
  key: string,
  name: string,
  nodeType: string,
  inputVariables: string[],
  outputVariables: string[]
): ServerAssetDefinitionSeed {
  return {
    type: 'NODE_TEMPLATE',
    key,
    name,
    description: `${name} 节点标准配置。`,
    category: nodeType,
    status: 'ACTIVE',
    scope: 'SYSTEM',
    version: '1.0.0',
    schema: {
      nodeType,
      inputVariables,
      outputVariables,
      recommendedModelCapabilities: nodeType === 'llm' ? ['text'] : [],
      defaultConfig: {}
    },
    defaults: {
      name,
      inputVariables,
      outputVariables
    },
    tags: [nodeType],
    sortOrder: 5000
  };
}
