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
  model(2000, 'deepseek-v4-flash', 'DeepSeek V4 Flash', 'deepseek', 'deepseek-v4-flash', ['text'], ['text'], ['text', 'text_generation'], ['文档整理', '内容生成', '通用问答'], { availabilityStatus: 'verified' }),
  model(2010, 'deepseek-v4-pro', 'DeepSeek V4 Pro', 'deepseek', 'deepseek-v4-pro', ['text'], ['text'], ['reasoning', 'reasoning_text', 'text'], ['复杂分析', '多步骤推理'], { availabilityStatus: 'verified' }),
  model(2020, 'deepseek-chat', 'DeepSeek Chat', 'deepseek', 'deepseek-chat', ['text'], ['text'], ['text', 'text_generation'], ['通用文本任务'], { availabilityStatus: 'verified' }),
  model(2030, 'deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek', 'deepseek-reasoner', ['text'], ['text'], ['reasoning', 'reasoning_text', 'text'], ['深度推理'], { availabilityStatus: 'verified' }),
  model(2040, 'openai-gpt-4o', 'OpenAI GPT-4o', 'openai', 'gpt-4o', ['text', 'image'], ['text', 'json'], ['text', 'vision', 'vision_understanding'], ['图文分析', '通用办公'], { availabilityStatus: 'provider_documented' }),
  model(2050, 'openai-gpt-4o-mini', 'OpenAI GPT-4o mini', 'openai', 'gpt-4o-mini', ['text', 'image'], ['text', 'json'], ['text', 'vision', 'vision_understanding'], ['轻量图文任务'], { availabilityStatus: 'provider_documented' }),
  model(2060, 'openai-o4-mini', 'OpenAI o4-mini', 'openai', 'o4-mini', ['text'], ['text', 'json'], ['reasoning', 'reasoning_text'], ['复杂推理', '规划'], { availabilityStatus: 'provider_documented' }),
  model(2070, 'openai-gpt-image-1', 'OpenAI GPT Image 1', 'openai', 'gpt-image-1', ['text', 'image'], ['image'], ['image_generation', 'text_to_image', 'image_editing'], ['生成图片', '改图'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2080, 'openai-gpt-image-2', 'OpenAI GPT Image 2', 'openai', 'gpt-image-2', ['text', 'image'], ['image'], ['image_generation', 'text_to_image', 'image_editing'], ['生成图片', '改图'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2090, 'openai-text-embedding-3-small', 'OpenAI Text Embedding 3 Small', 'openai', 'text-embedding-3-small', ['text'], ['embedding'], ['embedding'], ['知识库向量化', '检索'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2100, 'openai-text-embedding-3-large', 'OpenAI Text Embedding 3 Large', 'openai', 'text-embedding-3-large', ['text'], ['embedding'], ['embedding'], ['高质量向量化'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2110, 'anthropic-claude-opus-4-6', 'Claude Opus 4.6', 'anthropic', 'claude-opus-4.6', ['text', 'image'], ['text', 'json'], ['reasoning', 'long_context', 'vision'], ['复杂推理', '长文档', '图文分析'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2120, 'anthropic-claude-sonnet-4-5', 'Claude Sonnet 4.5', 'anthropic', 'claude-sonnet-4.5', ['text', 'image'], ['text', 'json'], ['reasoning', 'long_context', 'vision'], ['企业通用分析', '代码和文档'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2130, 'anthropic-claude-haiku-4-5', 'Claude Haiku 4.5', 'anthropic', 'claude-haiku-4.5', ['text', 'image'], ['text', 'json'], ['text', 'vision'], ['快速图文处理'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2140, 'google-gemini-2-5-pro', 'Gemini 2.5 Pro', 'google', 'gemini-2.5-pro', ['text', 'image', 'video'], ['text', 'json'], ['reasoning', 'long_context', 'vision', 'video_understanding'], ['长文档', '图片理解', '视频理解'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2150, 'google-gemini-2-5-flash', 'Gemini 2.5 Flash', 'google', 'gemini-2.5-flash', ['text', 'image', 'video'], ['text', 'json'], ['text', 'vision', 'video_understanding'], ['轻量多模态分析'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2160, 'google-gemini-3-pro', 'Gemini 3 Pro', 'google', 'gemini-3-pro', ['text', 'image', 'video'], ['text', 'json'], ['reasoning', 'long_context', 'vision', 'video_understanding'], ['复杂多模态'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2170, 'google-nano-banana-2', 'Nano Banana 2', 'google', 'nano-banana-2', ['text', 'image'], ['image'], ['image_generation', 'text_to_image', 'image_editing'], ['生成图片', '编辑图片'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2180, 'google-imagen-4', 'Imagen 4', 'google', 'imagen-4', ['text'], ['image'], ['image_generation', 'text_to_image'], ['生成图片'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2190, 'google-veo-3', 'Veo 3', 'google', 'veo-3', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2200, 'qwen-plus', '通义千问 Plus', 'qwen', 'qwen-plus', ['text'], ['text'], ['text', 'text_generation'], ['中文文档', '企业知识问答'], { availabilityStatus: 'provider_documented' }),
  model(2210, 'qwen-max', '通义千问 Max', 'qwen', 'qwen-max', ['text'], ['text', 'json'], ['reasoning', 'text'], ['高质量中文分析'], { availabilityStatus: 'provider_documented' }),
  model(2220, 'qwen-long', '通义千问 Long', 'qwen', 'qwen-long', ['text', 'file'], ['text', 'json'], ['long_context', 'document', 'text'], ['长文档理解'], { availabilityStatus: 'provider_documented' }),
  model(2230, 'qwen-vl-max', '通义千问 VL Max', 'qwen', 'qwen-vl-max', ['text', 'image'], ['text', 'json'], ['vision', 'vision_understanding', 'text'], ['图片理解', '图文分析'], { availabilityStatus: 'provider_documented' }),
  model(2240, 'qwen-image', '通义千问 Image', 'qwen', 'qwen-image', ['text', 'image'], ['image'], ['image_generation', 'text_to_image', 'image_editing'], ['生成图片', '改图'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2250, 'wanx-video', '通义万相视频', 'qwen', 'wanx-video', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2260, 'doubao-pro', '豆包 Pro', 'doubao', 'doubao-pro', ['text'], ['text'], ['text', 'long_context'], ['长文处理', '内容生成'], { availabilityStatus: 'requires_manual_model_id' }),
  model(2270, 'doubao-vision', '豆包视觉模型', 'doubao', 'doubao-vision', ['text', 'image'], ['text', 'json'], ['vision', 'vision_understanding'], ['图片理解'], { availabilityStatus: 'requires_manual_model_id' }),
  model(2280, 'doubao-seedream', '豆包 Seedream', 'doubao', 'seedream', ['text', 'image'], ['image'], ['image_generation', 'text_to_image', 'image_editing'], ['生成图片', '改图'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2290, 'bytedance-seedance-2-0', 'Seedance 2.0', 'doubao', 'seedance-2.0', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2300, 'kimi-k2', 'Kimi K2', 'moonshot', 'kimi-k2', ['text'], ['text', 'json'], ['text', 'reasoning', 'long_context'], ['长上下文分析'], { availabilityStatus: 'requires_manual_model_id' }),
  model(2310, 'moonshot-v1-128k', 'Moonshot v1 128k', 'moonshot', 'moonshot-v1-128k', ['text'], ['text', 'json'], ['long_context', 'document', 'text'], ['超长文档'], { availabilityStatus: 'provider_documented' }),
  model(2320, 'glm-4-plus', 'GLM-4 Plus', 'zhipu', 'glm-4-plus', ['text'], ['text', 'json'], ['text', 'reasoning'], ['通用文本任务'], { availabilityStatus: 'provider_documented' }),
  model(2330, 'glm-4v-plus', 'GLM-4V Plus', 'zhipu', 'glm-4v-plus', ['text', 'image'], ['text', 'json'], ['vision', 'vision_understanding'], ['图片理解'], { availabilityStatus: 'provider_documented' }),
  model(2340, 'baidu-ernie-4', '文心 ERNIE 4', 'baidu', 'ernie-4.0', ['text'], ['text', 'json'], ['text', 'reasoning'], ['中文办公', '企业分析'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2350, 'minimax-text-01', 'MiniMax Text 01', 'minimax', 'text-01', ['text'], ['text', 'json'], ['text', 'long_context'], ['长文本生成'], { availabilityStatus: 'requires_manual_model_id' }),
  model(2360, 'minimax-image-01', 'MiniMax Image 01', 'minimax', 'image-01', ['text', 'image'], ['image'], ['image_generation', 'text_to_image', 'image_editing'], ['生成图片'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2370, 'minimax-hailuo-2-3', 'MiniMax Hailuo 2.3', 'minimax', 'hailuo-2.3', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2380, 'cohere-rerank', 'Cohere Rerank', 'cohere', 'rerank', ['text'], ['scores'], ['rerank'], ['搜索结果重排', '知识库重排'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2390, 'cohere-embed', 'Cohere Embed', 'cohere', 'embed', ['text'], ['embedding'], ['embedding'], ['向量化'], { availabilityStatus: 'provider_documented', apiStyle: 'provider_native' }),
  model(2400, 'bge-m3', 'BGE-M3', 'custom', 'bge-m3', ['text'], ['embedding'], ['embedding'], ['本地/私有向量模型'], { availabilityStatus: 'requires_manual_model_id' }),
  model(2410, 'jina-reranker', 'Jina Reranker', 'jina', 'jina-reranker', ['text'], ['scores'], ['rerank'], ['重排'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2420, 'runway-gen-4', 'Runway Gen-4', 'runway', 'gen-4', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2430, 'luma-ray-2', 'Luma Ray 2', 'luma', 'ray-2', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2440, 'kling-2-1', '可灵 2.1', 'kling', 'kling-2.1', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2450, 'pika-2-2', 'Pika 2.2', 'pika', 'pika-2.2', ['text', 'image'], ['video'], ['video_generation', 'text_to_video', 'image_to_video'], ['生成视频'], { availabilityStatus: 'requires_manual_model_id', apiStyle: 'provider_native' }),
  model(2460, 'custom-openai-compatible', '自定义 OpenAI 兼容模型', 'custom', 'custom-model', ['text'], ['text', 'json'], ['text', 'reasoning', 'long_context'], ['企业私有网关', '中转服务'], { availabilityStatus: 'requires_manual_model_id' })
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
  sortOrder: number,
  key: string,
  name: string,
  providerId: string,
  modelId: string,
  inputTypes: string[],
  outputTypes: string[],
  capabilities: string[],
  recommendedUseCases: string[],
  options?: {
    availabilityStatus?: 'verified' | 'provider_documented' | 'requires_manual_model_id' | 'experimental' | 'deprecated' | 'placeholder';
    apiStyle?: 'openai_compatible' | 'provider_native' | 'azure_openai' | 'custom';
  }
): ServerAssetDefinitionSeed {
  const apiStyle = options?.apiStyle ?? 'openai_compatible';
  const availabilityStatus = options?.availabilityStatus ?? 'provider_documented';
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
      inputTypes,
      outputTypes,
      apiStyle,
      endpointRequired: true,
      credentialFields: ['apiKey', 'apiBaseUrl'],
      supportsModelList: apiStyle === 'openai_compatible',
      availabilityStatus,
      recommendedUseCases
    },
    defaults: {
      temperature: capabilities.includes('reasoning') ? 0.3 : 0.7,
      maxTokens: capabilities.includes('long_context') ? 8192 : 4000,
      timeoutSeconds: outputTypes.includes('video') ? 300 : outputTypes.includes('image') ? 120 : 45
    },
    tags: [providerId, ...inputTypes, ...outputTypes, ...capabilities, availabilityStatus],
    sortOrder
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
