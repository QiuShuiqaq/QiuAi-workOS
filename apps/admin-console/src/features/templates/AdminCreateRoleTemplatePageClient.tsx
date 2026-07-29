'use client';

import {
  AppstoreAddOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RocketOutlined,
  SaveOutlined,
  SettingOutlined
} from '@ant-design/icons';
import type {
  AdminPlanDetail,
  AdminRoleTemplateDetail,
  AdminRoleTemplateTestGraphTrace,
  AdminWorkspaceSummary,
  AssetDefinitionDetail,
  CreateAdminRoleTemplateRequest,
  CurrentAccountResponse,
  RoleWorkflowGraph,
  RoleWorkflowGraphNode,
  RoleWorkflowGraphSourceStep,
  ToolActionCatalog,
  UpdateAdminRoleTemplateRequest
} from '@qiuai/api-contract';
import { buildRoleWorkflowGraphFromSteps } from '@qiuai/api-contract';
import { QiuPage } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Divider from 'antd/es/divider';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Modal from 'antd/es/modal';
import Popover from 'antd/es/popover';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useRouter } from 'next/navigation';
import {
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge as FlowEdge,
  type EdgeChange,
  type Node as FlowNode,
  type NodeChange,
  type NodeProps,
  type ReactFlowInstance
} from '@xyflow/react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminCreateRoleTemplatePageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  toolCatalog: ToolActionCatalog;
  assets: AssetDefinitionDetail[];
  templateId?: string;
}

type WorkflowPreset = 'standard' | 'document' | 'research';
type WorkflowNodeType = RoleWorkflowGraphNode['type'];
type WorkflowArtifactType = NonNullable<RoleWorkflowGraphNode['artifactType']>;
type WorkflowVariableType = NonNullable<NonNullable<RoleWorkflowGraph['variables']>[number]['type']>;
type WorkflowEdge = RoleWorkflowGraph['edges'][number];
type WorkflowEdgeConditionType = NonNullable<WorkflowEdge['condition']>['type'];
type ToolConfigFieldType = 'text' | 'number' | 'textarea' | 'boolean';
type WorkflowModelOutputMode = 'text' | 'json';
type WorkflowLlmTaskType =
  | 'text'
  | 'reasoning'
  | 'structured_extraction'
  | 'long_document'
  | 'vision'
  | 'video_understanding'
  | 'image_generation'
  | 'video_generation'
  | 'embedding'
  | 'rerank';
type WorkflowDataMode = 'assign' | 'template' | 'code';
type WorkflowCanvasPosition = { x: number; y: number };
type WorkflowSelection = { type: 'node' | 'edge'; id: string };
type WorkflowConfigPanelTab = 'settings' | 'lastRun';
type WorkflowNodePickerMode = 'free' | 'after' | 'before' | 'edge';
type WorkflowContextMenu =
  | { open: false }
  | {
      open: true;
      type: 'pane' | 'node' | 'edge';
      x: number;
      y: number;
      flowPosition?: WorkflowCanvasPosition;
      nodeId?: string;
      edgeId?: string;
    };
type WorkflowContextEvent = MouseEvent | ReactMouseEvent<Element>;
type WorkflowTableColumnConfig = { header: string; path: string };
type WorkflowCodePreviewResult = {
  status: 'passed' | 'failed';
  inputPreview: string;
  outputPreview: string;
  error?: string;
};
type WorkflowFlowNodeData = {
  nodeType: WorkflowNodeType;
  title: string;
  meta: string;
  details: string[];
  tone: string;
  statusLabel: string;
  statusClass: 'ready' | 'warning' | 'failed';
  warnings: string[];
  reachable: boolean;
  onInsertBefore?: (nodeId: string) => void;
  onInsertAfter?: (nodeId: string) => void;
} & Record<string, unknown>;
type WorkflowFlowNode = FlowNode<WorkflowFlowNodeData, 'workflowNode'>;
type WorkflowFlowEdge = FlowEdge<{ conditionLabel: string }>;
type WorkflowCapabilitySummary = {
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeSources: string[];
  artifactTypes: string[];
  approvalRequired: boolean;
  nodeCount: number;
  edgeCount: number;
  warnings: string[];
};

type ToolConfigField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: ToolConfigFieldType;
  format?: 'text' | 'json';
};

type ToolActionTemplate = {
  toolId: string;
  value: string;
  label: string;
  defaults: Record<string, unknown>;
  fields: ToolConfigField[];
};

type TemplateTestResult = {
  templateId: string;
  valid: boolean;
  status: 'passed' | 'failed';
  message: string;
  warnings: string[];
  sampleInput?: string;
  graphTrace?: AdminRoleTemplateTestGraphTrace;
  requiredToolActions?: string[];
};
type WorkflowNodeTrace = NonNullable<TemplateTestResult['graphTrace']>['nodes'][number];

type WorkflowVariableOption = {
  value: string;
  label: string;
  type: WorkflowVariableType;
  source: string;
  description?: string;
};

type SkillForm = {
  code?: string;
  name?: string;
  summary?: string;
};

type CreateRoleTemplateFormValues = {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  businessGoal: string;
  recommendedPlanCode: string;
  approvalPolicy: string;
  outputFormat?: string;
  workflowPreset: WorkflowPreset;
  knowledgeSources?: string[];
  tools?: string[];
  skills?: SkillForm[];
  sampleInputs?: string[];
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
};

const knowledgeOptions = [
  'local_folder',
  'local_file',
  'workspace_library',
  'server_summary'
].map((value) => ({ value, label: value }));

const workflowPresetOptions: Array<{ value: WorkflowPreset; label: string; description: string }> = [
  {
    value: 'standard',
    label: '标准任务',
    description: '输入任务、读取知识、LLM 起草、生成文档、返回结果。'
  },
  {
    value: 'document',
    label: '文档处理',
    description: '读取附件、分析内容、生成 Word/表格/PPT 类产物。'
  },
  {
    value: 'research',
    label: '调研任务',
    description: '先做网页搜索，再综合分析，输出调研报告。'
  }
];

const workflowNodeTypeOptions: Array<{ value: WorkflowNodeType; label: string }> = [
  { value: 'input', label: '接收输入' },
  { value: 'list', label: '列表筛选' },
  { value: 'knowledge', label: '知识库' },
  { value: 'llm', label: 'LLM 大模型' },
  { value: 'data', label: '数据处理' },
  { value: 'tool', label: '工具' },
  { value: 'condition', label: '条件分支' },
  { value: 'iteration', label: '批处理' },
  { value: 'loop', label: '循环控制' },
  { value: 'aggregator', label: '结果合并' },
  { value: 'artifact', label: '产物生成' },
  { value: 'approval', label: '人工确认' },
  { value: 'output', label: '返回结果' }
];

const workflowAuthoringNodeTypes: WorkflowNodeType[] = [
  'input',
  'knowledge',
  'llm',
  'tool',
  'condition',
  'list',
  'iteration',
  'loop',
  'aggregator',
  'data',
  'artifact',
  'approval',
  'output'
];

const workflowNodeCatalogGroups: Array<{
  title: string;
  description: string;
  nodes: Array<{ value: WorkflowNodeType; label: string; hint: string }>;
}> = [
  {
    title: '常用主链路',
    description: '大多数数字员工先用这些节点搭出主流程。',
    nodes: [
      { value: 'input', label: '接收输入', hint: '接收用户任务和拖入附件' },
      { value: 'llm', label: 'LLM 大模型', hint: '文本、推理、多模态都在这里配置' },
      { value: 'tool', label: '工具', hint: '搜索、读文件、OCR、视频等真实动作' },
      { value: 'artifact', label: '产物生成', hint: '生成 Word、表格、PDF、图片或视频' },
      { value: 'output', label: '返回结果', hint: '把结果和产物交给用户' }
    ]
  },
  {
    title: '数据与知识',
    description: '整理输入、读取知识、把数据变成后续节点能用的格式。',
    nodes: [
      { value: 'knowledge', label: '知识库', hint: '读取企业知识库或本地知识' },
      { value: 'list', label: '列表筛选', hint: '从附件或数组里筛选处理对象' },
      { value: 'iteration', label: '批处理', hint: '逐个处理文件、表格行或列表项' },
      { value: 'aggregator', label: '结果合并', hint: '合并分支、批处理或多个变量' }
    ]
  },
  {
    title: '转换与规则',
    description: '处理字段、格式、表格和固定文本规则。',
    nodes: [
      { value: 'data', label: '数据处理', hint: '整理变量、拼接文本、清洗 JSON 或生成 rows' }
    ]
  },
  {
    title: '流程控制',
    description: '复杂任务需要分支、循环或人工确认时使用。',
    nodes: [
      { value: 'condition', label: '条件分支', hint: '根据变量结果走不同路径' },
      { value: 'loop', label: '循环控制', hint: '限制重复执行次数和退出条件' },
      { value: 'approval', label: '人工确认', hint: '高风险步骤前让用户确认' }
    ]
  }
];

const modelProfileOptions = [
  { value: 'deepseek-v4-flash', label: 'DeepSeek / deepseek-v4-flash（通用生成）' },
  { value: 'deepseek-chat', label: 'DeepSeek / deepseek-chat（通用对话）' },
  { value: 'deepseek-reasoner', label: 'DeepSeek / deepseek-reasoner（深度推理）' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek / deepseek-v4-pro（深度推理）' },
  { value: 'openai-gpt-4o', label: 'OpenAI / gpt-4o（多模态）' },
  { value: 'openai-gpt-4o-mini', label: 'OpenAI / gpt-4o-mini（轻量通用）' },
  { value: 'openai-gpt-5.6-terra', label: 'OpenAI / gpt-5.6-terra（平衡）' },
  { value: 'openai-gpt-5.6-sol', label: 'OpenAI / gpt-5.6-sol（高质量）' },
  { value: 'qwen-plus', label: '通义千问 / qwen-plus（通用生成）' },
  { value: 'qwen-max', label: '通义千问 / qwen-max（高质量）' },
  { value: 'qwen-long', label: '通义千问 / qwen-long（长文档）' },
  { value: 'qwen-vl-max', label: '通义千问 / qwen-vl-max（图片理解）' },
  { value: 'moonshot-v1-32k', label: 'Kimi / moonshot-v1-32k（长文档）' },
  { value: 'moonshot-v1-128k', label: 'Kimi / moonshot-v1-128k（超长文档）' },
  { value: 'qiu-general-default', label: '企业默认通用模型（兜底，PC 端配置）' },
  { value: 'qiu-reasoning-default', label: '企业默认推理模型（兜底，PC 端配置）' },
  { value: 'qiu-vision-default', label: '企业默认视觉模型（兜底，PC 端配置）' },
  { value: 'custom-model', label: '自定义 OpenAI 兼容模型' }
];

const artifactTypeOptions: Array<{ value: WorkflowArtifactType; label: string }> = [
  'docx',
  'xlsx',
  'pptx',
  'mp4',
  'markdown',
  'csv'
].map((value) => ({ value: value as WorkflowArtifactType, label: value }));

const conditionTypeOptions: Array<{ value: WorkflowEdgeConditionType; label: string }> = [
  { value: 'always', label: '总是执行' },
  { value: 'exists', label: '变量存在' },
  { value: 'equals', label: '等于' },
  { value: 'contains', label: '包含' },
  { value: 'expression', label: '表达式' }
];

const modelOutputModeOptions: Array<{ value: WorkflowModelOutputMode; label: string }> = [
  { value: 'text', label: '文本' },
  { value: 'json', label: 'JSON 结构化数据' }
];

const llmTaskTypeOptions: Array<{
  value: WorkflowLlmTaskType;
  label: string;
  description: string;
  requiredCapabilities: string[];
  defaultOutputMode: WorkflowModelOutputMode;
}> = [
  {
    value: 'text',
    label: '文本生成',
    description: '总结、改写、起草、问答等通用文本任务。',
    requiredCapabilities: ['text', 'text_generation'],
    defaultOutputMode: 'text'
  },
  {
    value: 'reasoning',
    label: '深度推理',
    description: '复杂分析、规划、判断、评分和多步骤推理。',
    requiredCapabilities: ['reasoning', 'reasoning_text'],
    defaultOutputMode: 'text'
  },
  {
    value: 'structured_extraction',
    label: '结构提取',
    description: '把自然语言、文档或工具结果提取成稳定 JSON 字段。',
    requiredCapabilities: ['text', 'text_generation', 'reasoning'],
    defaultOutputMode: 'json'
  },
  {
    value: 'long_document',
    label: '长文档理解',
    description: '读取长文本、长文档、合同、技术资料后输出结论。',
    requiredCapabilities: ['long_context', 'document', 'file'],
    defaultOutputMode: 'text'
  },
  {
    value: 'vision',
    label: '图片理解',
    description: '把图片或截图交给模型，输出文字说明或 JSON。',
    requiredCapabilities: ['vision', 'vision_understanding', 'vision_text', 'image'],
    defaultOutputMode: 'text'
  },
  {
    value: 'video_understanding',
    label: '视频理解',
    description: '把视频地址或视频片段交给模型，输出分析、评分或剪辑建议。',
    requiredCapabilities: ['video', 'video_understanding', 'video_text'],
    defaultOutputMode: 'json'
  },
  {
    value: 'image_generation',
    label: '生成图片',
    description: '根据文本或参考图生成图片素材。',
    requiredCapabilities: ['image_generation', 'text_to_image', 'image_editing'],
    defaultOutputMode: 'json'
  },
  {
    value: 'video_generation',
    label: '生成视频',
    description: '根据文本或参考图生成视频素材。',
    requiredCapabilities: ['video_generation', 'text_to_video', 'image_to_video'],
    defaultOutputMode: 'json'
  },
  {
    value: 'embedding',
    label: '向量化 embedding',
    description: '把文本转成向量，用于检索、召回和相似度计算。',
    requiredCapabilities: ['embedding'],
    defaultOutputMode: 'json'
  },
  {
    value: 'rerank',
    label: '重排 rerank',
    description: '给候选文本列表重新排序，输出分数和排序结果。',
    requiredCapabilities: ['rerank'],
    defaultOutputMode: 'json'
  }
];

const workflowVariableTypeLabels: Record<WorkflowVariableType, string> = {
  text: '文本',
  number: '数字',
  boolean: '布尔',
  json: 'JSON',
  asset: '文件',
  'asset[]': '文件组',
  table: '表格',
  artifact: '产物'
};

const workflowVariableTypeColors: Record<WorkflowVariableType, string> = {
  text: 'blue',
  number: 'cyan',
  boolean: 'gold',
  json: 'purple',
  asset: 'green',
  'asset[]': 'green',
  table: 'magenta',
  artifact: 'volcano'
};

const defaultWorkflowVariableOptions: WorkflowVariableOption[] = [
  {
    value: 'start.text',
    label: '用户输入的任务文本',
    type: 'text',
    source: '开始节点'
  },
  {
    value: 'start.files',
    label: '用户拖入的全部附件',
    type: 'asset[]',
    source: '开始节点',
    description: '文件只传引用和本地路径，节点执行时再读取'
  },
  {
    value: 'start.documents',
    label: '文档附件',
    type: 'asset[]',
    source: '开始节点'
  },
  {
    value: 'start.spreadsheets',
    label: '表格附件',
    type: 'asset[]',
    source: '开始节点'
  },
  {
    value: 'start.images',
    label: '图片附件',
    type: 'asset[]',
    source: '开始节点'
  },
  {
    value: 'start.videos',
    label: '视频附件',
    type: 'asset[]',
    source: '开始节点'
  },
  {
    value: 'runtime.previous_text',
    label: '上一步文本结果',
    type: 'text',
    source: '运行时'
  },
  {
    value: 'runtime.current_item',
    label: '当前迭代项',
    type: 'asset',
    source: '运行时'
  }
];

const variableRuntimeRefByAssetKey: Record<string, string> = {
  task_text: 'start.text',
  input_files: 'start.files',
  input_file: 'start.files.0',
  assistant_message: 'assistant_message',
  artifact_file: 'artifact_file'
};

const modelAvailabilityStatusLabels: Record<string, string> = {
  verified: '已验证',
  provider_documented: '供应商公开',
  requires_manual_model_id: '需确认模型ID',
  experimental: '实验',
  deprecated: '已废弃',
  placeholder: '占位'
};

const legacyWorkflowNodeNameTranslations: Record<string, string> = {
  Start: '开始',
  'Receive task': '接收任务',
  'Gather context': '读取上下文',
  'Web research': '网页调研',
  'Draft result': '生成初稿',
  'Write deliverable': '生成产物',
  'Final response': '返回结果'
};

const defaultNodeNames: Record<WorkflowNodeType, string> = {
  start: '开始',
  input: '接收输入',
  list: '列表筛选',
  knowledge: '读取知识',
  llm: 'LLM 大模型',
  data: '数据处理',
  tool: '工具',
  condition: '条件分支',
  iteration: '批处理',
  loop: '循环控制',
  aggregator: '结果合并',
  artifact: '生成产物',
  approval: '人工确认',
  output: '返回结果'
};

function uniqueTags(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function createWorkflowNodeId(type: WorkflowNodeType, nodes: RoleWorkflowGraphNode[]) {
  const base = `${type}_${Date.now().toString(36)}`;
  const nodeIds = new Set(nodes.map((node) => node.id));
  let candidate = base;
  let suffix = 1;

  while (nodeIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return candidate;
}

function createWorkflowEdgeId(sourceNodeId: string, targetNodeId: string, edges: WorkflowEdge[]) {
  const base = `${sourceNodeId}__${targetNodeId}`;
  const edgeIds = new Set(edges.map((edge) => edge.id));
  let candidate = base;
  let suffix = 1;

  while (edgeIds.has(candidate)) {
    suffix += 1;
    candidate = `${base}_${suffix}`;
  }

  return candidate;
}

function getWorkflowReachableNodeIds(graph: RoleWorkflowGraph) {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const reachableNodeIds = new Set<string>();
  const edgesBySource = new Map<string, WorkflowEdge[]>();

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) continue;
    edgesBySource.set(edge.sourceNodeId, [...(edgesBySource.get(edge.sourceNodeId) ?? []), edge]);
  }

  const queue = nodeIds.has(graph.entryNodeId) ? [graph.entryNodeId] : [];
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || reachableNodeIds.has(nodeId)) continue;
    reachableNodeIds.add(nodeId);
    for (const edge of edgesBySource.get(nodeId) ?? []) {
      if (!reachableNodeIds.has(edge.targetNodeId)) {
        queue.push(edge.targetNodeId);
      }
    }
  }

  return reachableNodeIds;
}

function getWorkflowExecutableNodes(graph: RoleWorkflowGraph) {
  const reachableNodeIds = getWorkflowReachableNodeIds(graph);
  return graph.nodes.filter((node) => reachableNodeIds.has(node.id));
}

function getWorkflowDetachedNodes(graph: RoleWorkflowGraph) {
  const reachableNodeIds = getWorkflowReachableNodeIds(graph);
  return graph.nodes.filter((node) => node.id !== graph.entryNodeId && !reachableNodeIds.has(node.id));
}

function wouldCreateWorkflowCycle(edges: WorkflowEdge[], sourceNodeId: string, targetNodeId: string) {
  const edgesBySource = new Map<string, string[]>();
  for (const edge of edges) {
    edgesBySource.set(edge.sourceNodeId, [...(edgesBySource.get(edge.sourceNodeId) ?? []), edge.targetNodeId]);
  }

  const queue = [targetNodeId];
  const visited = new Set<string>();
  while (queue.length) {
    const nodeId = queue.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    if (nodeId === sourceNodeId) return true;
    visited.add(nodeId);
    queue.push(...(edgesBySource.get(nodeId) ?? []));
  }

  return false;
}

function validateWorkflowConnection(graph: RoleWorkflowGraph, sourceNodeId?: string | null, targetNodeId?: string | null) {
  if (!sourceNodeId || !targetNodeId) return '请从节点右侧圆点拖到另一个节点左侧圆点';
  if (sourceNodeId === targetNodeId) return '不能把节点连接到自己';
  if (targetNodeId === graph.entryNodeId) return '开始节点只能作为流程入口，不能作为连线终点';
  if (!graph.nodes.some((node) => node.id === sourceNodeId)) return '起点节点不存在';
  if (!graph.nodes.some((node) => node.id === targetNodeId)) return '终点节点不存在';
  if (graph.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId)) {
    return '这条连线已经存在';
  }
  if (wouldCreateWorkflowCycle(graph.edges, sourceNodeId, targetNodeId)) {
    return '这条连线会形成循环，请使用循环节点表达重复逻辑';
  }
  return undefined;
}

function createCanvasNode(
  type: WorkflowNodeType,
  nodes: RoleWorkflowGraphNode[],
  options?: {
    defaultToolId?: string;
    getDefaultToolActionTemplate?: (toolId: string) => ToolActionTemplate | undefined;
    getDefaultArtifactActionTemplate?: (artifactType: WorkflowArtifactType | undefined) => ToolActionTemplate | undefined;
  }
): RoleWorkflowGraphNode {
  const id = createWorkflowNodeId(type, nodes);
  const artifactType = type === 'artifact' ? 'docx' : undefined;
  const toolActionTemplate = type === 'artifact'
    ? options?.getDefaultArtifactActionTemplate?.(artifactType)
    : type === 'tool' && options?.defaultToolId
      ? options.getDefaultToolActionTemplate?.(options.defaultToolId)
      : undefined;
  const toolId = type === 'artifact'
    ? toolActionTemplate?.toolId
    : type === 'tool'
      ? toolActionTemplate?.toolId ?? options?.defaultToolId
      : undefined;
  const defaultConfig =
    type === 'list'
        ? { sourceRef: 'start.files', kind: '', limit: 50 }
        : type === 'iteration'
          ? { sourceRef: 'list.items' }
          : type === 'loop'
            ? { maxIterations: 3 }
                : type === 'aggregator'
                  ? { mode: 'object' }
                : type === 'data'
                  ? {
                      dataMode: 'assign',
                      assignments: [{ name: `${id}.value`, value: '$runtime.previous_text' }]
                    }
                : type === 'llm'
                  ? {
                      llmTaskType: 'text',
                      outputMode: 'text'
                    }
                : (type === 'tool' || type === 'artifact') && toolActionTemplate
                  ? {
                      action: toolActionTemplate.value,
                      input: toolActionTemplate.defaults
                    }
                  : undefined;

  return {
    id,
    type,
    name: defaultNodeNames[type],
    instruction:
      type === 'condition'
        ? '根据输入变量或上一个节点输出选择下一条连线。'
        : type === 'list'
            ? '从文件或数组变量中筛选出后续要处理的列表。'
            : type === 'iteration'
              ? '从数组中取出当前项，供后续节点逐个处理。'
              : type === 'aggregator'
                ? '把多个变量或分支结果合并成一个结果。'
                : type === 'loop'
                  ? '控制循环次数和继续条件。'
        : type === 'tool'
          ? '调用指定工具完成当前步骤。'
          : type === 'artifact'
            ? '把最终内容生成可下载产物。'
            : '按节点目标处理任务，并把结果写入输出变量。',
    toolId,
    modelProfileId: type === 'llm' ? 'qiu-general-default' : undefined,
    artifactType,
    inputVariables:
      type === 'input'
        ? ['start.text', 'start.files']
        : type === 'list'
          ? ['start.files']
          : type === 'iteration'
            ? ['list.items']
            : ['start.text'],
    outputVariables:
      type === 'list'
        ? [`${id}.items`]
        : type === 'iteration'
          ? [`${id}.current`]
          : type === 'data'
            ? [`${id}.value`]
            : type === 'llm'
              ? [`${id}.text`]
              : [`${id}.text`],
    requiresApproval: type === 'approval',
    config: defaultConfig
  };
}

function parseJsonConfigValue(value: string, fallback: unknown) {
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    return fallback;
  }
}

function stringifyJsonConfigValue(value: unknown) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '';
  }
}

function buildToolNodeConfig(node: RoleWorkflowGraphNode, patch: Record<string, unknown>): Record<string, unknown> {
  return {
    ...(node.config ?? {}),
    ...patch
  };
}

function readWorkflowModelOutputMode(node: RoleWorkflowGraphNode): WorkflowModelOutputMode {
  if (readWorkflowConfigString(node.config, 'llmTaskType') === 'structured_extraction') return 'json';
  return node.config?.outputMode === 'json' ? 'json' : 'text';
}

function defaultWorkflowModelSchema(node: RoleWorkflowGraphNode): Record<string, unknown> {
  return {
    summary: 'string',
    items: 'array',
    risks: 'string[]',
    nextActions: 'string[]'
  };
}

function readWorkflowModelSchema(node: RoleWorkflowGraphNode): unknown {
  return node.config?.schema ?? node.config?.jsonSchema ?? {};
}

function readWorkflowAssignConfig(node: RoleWorkflowGraphNode): { name: string; value: string } {
  const assignments = Array.isArray(node.config?.assignments) ? node.config.assignments : [];
  const firstAssignment = assignments.find(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)
  );
  const assignmentName = typeof firstAssignment?.name === 'string' ? firstAssignment.name : '';
  const assignmentValue = firstAssignment?.value;
  const fallbackName = node.outputVariables?.[0] ?? `${node.id}.value`;
  const fallbackValue = node.config?.value ?? node.config?.template ?? '$runtime.previous_text';

  return {
    name: assignmentName || fallbackName,
    value: typeof assignmentValue === 'string'
      ? assignmentValue
      : assignmentValue === undefined
        ? String(fallbackValue)
        : stringifyJsonConfigValue(assignmentValue)
  };
}

function readWorkflowToolInputConfig(node: RoleWorkflowGraphNode): Record<string, unknown> {
  return node.config?.input && typeof node.config.input === 'object' && !Array.isArray(node.config.input)
    ? (node.config.input as Record<string, unknown>)
    : {};
}

function mergeWorkflowToolInputDefaults(
  defaults: Record<string, unknown> | undefined,
  current: Record<string, unknown> | undefined
): Record<string, unknown> {
  const merged = { ...(defaults ?? {}) };
  for (const [key, value] of Object.entries(current ?? {})) {
    if (isBlankWorkflowToolInputValue(value)) {
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function isBlankWorkflowToolInputValue(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0);
}

function readArtifactTableSourceRef(node: RoleWorkflowGraphNode): string | undefined {
  const rows = readWorkflowToolInputConfig(node).rows;
  if (typeof rows !== 'string') return undefined;
  const match = rows.trim().match(/^\$([a-zA-Z0-9_.-]+)$/);
  return match?.[1];
}

function readWorkflowAssignTableMappingConfig(node: RoleWorkflowGraphNode): {
  sourceRef?: string;
  outputVariable: string;
  columns: WorkflowTableColumnConfig[];
} {
  const mapping = node.config?.tableMapping && typeof node.config.tableMapping === 'object' && !Array.isArray(node.config.tableMapping)
    ? (node.config.tableMapping as Record<string, unknown>)
    : {};
  const columns = Array.isArray(mapping.columns)
    ? mapping.columns.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        const header = typeof record.header === 'string' ? record.header.trim() : '';
        const path = typeof record.path === 'string' ? record.path.trim() : '';
        return header && path ? [{ header, path }] : [];
      })
    : [];

  return {
    sourceRef: typeof mapping.sourceRef === 'string' && mapping.sourceRef.trim() ? mapping.sourceRef.trim() : undefined,
    outputVariable:
      typeof mapping.outputVariable === 'string' && mapping.outputVariable.trim()
        ? mapping.outputVariable.trim()
        : node.outputVariables?.[0] ?? `${node.id}.rows`,
    columns
  };
}

const defaultWorkflowTableColumns: WorkflowTableColumnConfig[] = [
  { header: '名称', path: 'name' },
  { header: '分数', path: 'score' },
  { header: '建议', path: 'suggestion' }
];

function readWorkflowNodeCanvasPosition(
  node: RoleWorkflowGraphNode,
  fallback: WorkflowCanvasPosition
): WorkflowCanvasPosition {
  const value = node.config?.__canvas;
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    typeof (value as { x?: unknown }).x === 'number' &&
    typeof (value as { y?: unknown }).y === 'number'
  ) {
    return {
      x: Math.max(0, Math.round((value as { x: number }).x)),
      y: Math.max(0, Math.round((value as { y: number }).y))
    };
  }

  return fallback;
}

function writeWorkflowNodeCanvasPosition(
  node: RoleWorkflowGraphNode,
  position: WorkflowCanvasPosition
): RoleWorkflowGraphNode {
  return {
    ...node,
    config: {
      ...(node.config ?? {}),
      __canvas: {
        x: Math.max(0, Math.round(position.x)),
        y: Math.max(0, Math.round(position.y))
      }
    }
  };
}

function workflowVariableTypeClass(type: WorkflowVariableType) {
  return type.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
}

function isModelNodeType(type: WorkflowNodeType) {
  return type === 'llm';
}

function isDataProcessingNodeType(type: WorkflowNodeType) {
  return type === 'data';
}

function readWorkflowDataMode(node: RoleWorkflowGraphNode): WorkflowDataMode {
  const value = readWorkflowConfigString(node.config, 'dataMode');
  if (value === 'assign' || value === 'template' || value === 'code') {
    return value;
  }
  return 'assign';
}

function readAssetSchemaString(asset: AssetDefinitionDetail | undefined, key: string): string | undefined {
  const value = asset?.schema[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readAssetSchemaStringArray(asset: AssetDefinitionDetail | undefined, key: string): string[] {
  const value = asset?.schema[key];
  return Array.isArray(value)
    ? uniqueTags(value.filter((item): item is string => typeof item === 'string'))
    : [];
}

function readAssetDefaultsRecord(asset: AssetDefinitionDetail | undefined): Record<string, unknown> {
  return asset?.defaults && typeof asset.defaults === 'object' && !Array.isArray(asset.defaults)
    ? asset.defaults
    : {};
}

function readWorkflowConfigString(config: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function toWorkflowVariableType(value?: string): WorkflowVariableType {
  if (
    value === 'text' ||
    value === 'number' ||
    value === 'boolean' ||
    value === 'json' ||
    value === 'asset' ||
    value === 'asset[]' ||
    value === 'table' ||
    value === 'artifact'
  ) {
    return value;
  }

  if (value === 'files' || value === 'images' || value === 'videos') return 'asset[]';
  if (value === 'file' || value === 'image' || value === 'video') return 'asset';
  return 'text';
}

function buildAssetVariableOptions(assets: AssetDefinitionDetail[]): WorkflowVariableOption[] {
  return assets
    .filter((asset) => asset.type === 'VARIABLE' && asset.status === 'ACTIVE')
    .map((asset) => {
      const runtimeRef = variableRuntimeRefByAssetKey[asset.key] ?? asset.key;
      return {
        value: runtimeRef,
        label: `${asset.name} / ${asset.key}`,
        type: toWorkflowVariableType(readAssetSchemaString(asset, 'valueType')),
        source: '变量库',
        description: asset.description
      };
    });
}

function readWorkflowLlmTaskType(node: RoleWorkflowGraphNode): WorkflowLlmTaskType {
  const value = readWorkflowConfigString(node.config, 'llmTaskType');
  if (llmTaskTypeOptions.some((option) => option.value === value)) {
    return value as WorkflowLlmTaskType;
  }
  return 'text';
}

function readWorkflowLlmTaskOption(taskType: WorkflowLlmTaskType) {
  return llmTaskTypeOptions.find((option) => option.value === taskType) ?? llmTaskTypeOptions[0];
}

function normalizeModelCapability(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/g, '_');
}

function modelAssetSupportsLlmTask(asset: AssetDefinitionDetail, taskType: WorkflowLlmTaskType) {
  const taskOption = readWorkflowLlmTaskOption(taskType);
  const capabilities = [
    ...readAssetSchemaStringArray(asset, 'capabilities'),
    ...readAssetSchemaStringArray(asset, 'inputTypes'),
    ...readAssetSchemaStringArray(asset, 'outputTypes')
  ].map(normalizeModelCapability);
  if (capabilities.length === 0) return true;
  if (taskType === 'text') {
    return capabilities.some((capability) => ['text', 'text_generation', 'chat'].includes(capability));
  }
  return taskOption.requiredCapabilities
    .map(normalizeModelCapability)
    .some((capability) => capabilities.includes(capability));
}

function fallbackModelOptionSupportsLlmTask(option: { value: string }, taskType: WorkflowLlmTaskType) {
  if (taskType === 'text' || taskType === 'long_document') {
    return !option.value.includes('vision') && !option.value.includes('reasoning');
  }
  if (taskType === 'reasoning') return option.value.includes('reasoning') || option.value.includes('deepseek');
  if (taskType === 'vision') return option.value.includes('vision') || option.value.includes('gpt-4o');
  return option.value === 'custom-model';
}

function buildModelAssetOptions(assets: AssetDefinitionDetail[], taskType?: WorkflowLlmTaskType) {
  const filteredAssets = taskType ? assets.filter((asset) => modelAssetSupportsLlmTask(asset, taskType)) : assets;
  const assetOptions = filteredAssets.map((asset) => {
    const providerId = readAssetSchemaString(asset, 'providerId') ?? asset.category;
    const modelId = readAssetSchemaString(asset, 'modelId') ?? asset.key;
    const availabilityStatus = readAssetSchemaString(asset, 'availabilityStatus');
    const statusLabel = availabilityStatus && availabilityStatus !== 'verified'
      ? ` / ${modelAvailabilityStatusLabels[availabilityStatus] ?? availabilityStatus}`
      : '';
    return {
      value: asset.key,
      label: `${asset.name} / ${providerId} / ${modelId}${statusLabel}`
    };
  });
  const fallbackOptions = modelProfileOptions.filter(
    (option) => !assets.some((asset) => asset.key === option.value) &&
      (!taskType || fallbackModelOptionSupportsLlmTask(option, taskType))
  );
  return [...assetOptions, ...fallbackOptions];
}

function buildToolActionAssetOptions(assets: AssetDefinitionDetail[]) {
  return assets.map((asset) => {
    const packageId = readAssetSchemaString(asset, 'packageId') ?? asset.category;
    const actionId = readAssetSchemaString(asset, 'actionId') ?? asset.key;
    return {
      value: asset.key,
      label: `${asset.name} / ${packageId} / ${actionId}`
    };
  });
}

function buildArtifactTemplateAssetOptions(assets: AssetDefinitionDetail[]) {
  return assets.map((asset) => {
    const artifactType = readAssetSchemaString(asset, 'artifactType') ?? asset.category;
    return {
      value: asset.key,
      label: `${asset.name} / ${artifactType}`
    };
  });
}

function inferWorkflowVariableTypeFromName(value: string): WorkflowVariableType {
  const normalized = value.toLowerCase();
  if (/(table|rows|sheet|spreadsheet|csv|xlsx)/.test(normalized)) return 'table';
  if (/(files|attachments|documents|spreadsheets|images|videos|audios)/.test(normalized)) return 'asset[]';
  if (/(artifact|deliverable|final_file|output_file|\.file$|_file$)/.test(normalized)) return 'artifact';
  if (/(current_item|asset|localpath|file_path|video_path|image_path|document_path)/.test(normalized)) return 'asset';
  if (/(json|object|items|list|array|schema|plan|payload|result)/.test(normalized)) return 'json';
  if (/(count|score|duration|seconds|number|index|total|max|min|price|amount|cost|ratio)/.test(normalized)) return 'number';
  if (/(flag|valid|ok|success|enabled|boolean|needs_|is_|has_)/.test(normalized)) return 'boolean';
  return 'text';
}

function inferWorkflowToolOutputType(node: RoleWorkflowGraphNode): WorkflowVariableType {
  const action = typeof node.config?.action === 'string' ? node.config.action : '';
  if (node.type === 'artifact') return 'artifact';
  if (action.includes('extract_text') || action.includes('read_text') || action.includes('web.search') || action.includes('web.fetch')) {
    return 'text';
  }
  if (action.includes('write_xlsx') || action.includes('write_csv')) return 'table';
  if (action.includes('compose_clips')) return 'artifact';
  if (action.includes('extract_frames')) return 'asset[]';
  if (action.includes('probe') || action.includes('http.request') || action.includes('mcp.call')) return 'json';
  return 'json';
}

function inferWorkflowNodeOutputType(node: RoleWorkflowGraphNode, variableName: string): WorkflowVariableType {
  const byName = inferWorkflowVariableTypeFromName(variableName);
  if (byName !== 'text') return byName;

  if (node.type === 'artifact') return 'artifact';
  if (node.type === 'tool') return inferWorkflowToolOutputType(node);
  if (node.type === 'aggregator') return 'json';
  if (node.type === 'data') return readWorkflowDataMode(node) === 'template' ? 'text' : 'json';
  if (node.type === 'list') return 'asset[]';
  if (node.type === 'iteration') return 'asset';
  if (node.type === 'condition') return 'boolean';
  if (node.type === 'llm') {
    const taskType = readWorkflowLlmTaskType(node);
    if (taskType === 'image_generation' || taskType === 'video_generation') return 'asset';
    if (taskType === 'embedding' || taskType === 'rerank' || readWorkflowModelOutputMode(node) === 'json') return 'json';
  }
  if (node.type === 'knowledge' || node.type === 'llm' || node.type === 'output') {
    return 'text';
  }
  return byName;
}

function getWorkflowNodeDefaultOutputVariables(node: RoleWorkflowGraphNode): string[] {
  if (node.type === 'start') return [];
  if (node.type === 'artifact') return [`${node.id}.file`];
  if (node.type === 'data') {
    const mode = readWorkflowDataMode(node);
    if (mode === 'template') return [`${node.id}.text`];
    if (mode === 'code') return [`${node.id}.json`];
    return [readWorkflowAssignConfig(node).name || `${node.id}.value`];
  }
  if (node.type === 'list') return [`${node.id}.items`];
  if (node.type === 'iteration') return [`${node.id}.current`];
  if (node.type === 'tool') {
    const outputType = inferWorkflowToolOutputType(node);
    if (outputType === 'asset[]') return [`${node.id}.files`];
    if (outputType === 'asset') return [`${node.id}.file`];
    if (outputType === 'artifact') return [`${node.id}.file`];
    if (outputType === 'table') return [`${node.id}.table`];
    if (outputType === 'json') return [`${node.id}.json`];
  }
  if (node.type === 'llm') {
    const taskType = readWorkflowLlmTaskType(node);
    if (taskType === 'image_generation') return [`${node.id}.image`];
    if (taskType === 'video_generation') return [`${node.id}.video`];
    if (taskType === 'embedding') return [`${node.id}.embedding`];
    if (taskType === 'rerank') return [`${node.id}.scores`];
    if (readWorkflowModelOutputMode(node) === 'json') return [`${node.id}.json`];
  }
  if (node.type === 'condition') return [`${node.id}.matched`];
  if (node.type === 'aggregator') return [`${node.id}.json`];
  return [`${node.id}.text`];
}

function addWorkflowVariableOption(
  options: Map<string, WorkflowVariableOption>,
  option: WorkflowVariableOption
) {
  const value = option.value.trim();
  if (!value || options.has(value)) return;
  options.set(value, { ...option, value });
}

function deriveWorkflowVariableOptions(
  graph: RoleWorkflowGraph,
  assetVariableOptions: WorkflowVariableOption[] = []
): WorkflowVariableOption[] {
  const options = new Map<string, WorkflowVariableOption>();

  for (const option of defaultWorkflowVariableOptions) {
    addWorkflowVariableOption(options, option);
  }
  for (const option of assetVariableOptions) {
    addWorkflowVariableOption(options, option);
  }

  for (const variable of graph.variables ?? []) {
    addWorkflowVariableOption(options, {
      value: variable.name,
      label: variable.description ?? variable.name,
      type: variable.type ?? inferWorkflowVariableTypeFromName(variable.name),
      source: '画布变量',
      description: variable.required ? '必填变量' : undefined
    });
  }

  for (const node of graph.nodes) {
    for (const variableName of uniqueTags([
      ...(node.outputVariables ?? []),
      ...getWorkflowNodeDefaultOutputVariables(node)
    ])) {
      addWorkflowVariableOption(options, {
        value: variableName,
        label: `${node.name} 输出`,
        type: inferWorkflowNodeOutputType(node, variableName),
        source: node.name,
        description: workflowNodeTypeLabel(node.type)
      });
    }
  }

  return [...options.values()];
}

function buildWorkflowVariableSelectOptions(
  variableOptions: WorkflowVariableOption[],
  acceptedTypes?: WorkflowVariableType[]
) {
  const acceptedTypeSet = acceptedTypes ? new Set<WorkflowVariableType>(acceptedTypes) : undefined;
  return variableOptions
    .filter((option) => !acceptedTypeSet || acceptedTypeSet.has(option.type))
    .map((option) => ({
      value: option.value,
      label: `${option.value} · ${workflowVariableTypeLabels[option.type]} · ${option.label}`
    }));
}

function formatWorkflowVariableToken(value: string, mode: 'template' | 'path' = 'template') {
  return mode === 'path' ? `$${value}` : `{{${value}}}`;
}

function readWorkflowGraphToolIds(graph: RoleWorkflowGraph): string[] {
  return uniqueTags(
    getWorkflowExecutableNodes(graph).flatMap((node) => [
      node.toolId,
      ...(Array.isArray(node.config?.toolIds) ? node.config.toolIds : [])
    ]).filter((toolId): toolId is string => typeof toolId === 'string')
  );
}

function deriveWorkflowKnowledgeSources(graph: RoleWorkflowGraph): string[] {
  const executableNodes = getWorkflowExecutableNodes(graph);
  const sources = executableNodes.flatMap((node) => {
    if (node.type !== 'knowledge') return [];
    const configSources = Array.isArray(node.config?.sources) ? node.config.sources : [];
    return configSources.filter((source): source is string => typeof source === 'string');
  });

  return uniqueTags(sources.length ? sources : executableNodes.some((node) => node.type === 'knowledge') ? ['workspace_library'] : []);
}

function deriveWorkflowModelProfileIds(graph: RoleWorkflowGraph): string[] {
  return uniqueTags(
    getWorkflowExecutableNodes(graph)
      .filter((node) => isModelNodeType(node.type))
      .map((node) => node.modelProfileId ?? 'qiu-general-default')
  );
}

function deriveWorkflowArtifactTypes(graph: RoleWorkflowGraph): string[] {
  return uniqueTags(
    getWorkflowExecutableNodes(graph)
      .filter((node) => node.type === 'artifact')
      .map((node) => node.artifactType ?? 'docx')
  );
}

function deriveWorkflowSkills(graph: RoleWorkflowGraph): Array<{ code: string; name: string; summary: string }> {
  const skillNodes = getWorkflowExecutableNodes(graph).filter((node) =>
    node.type === 'llm' ||
    node.type === 'data' ||
    node.type === 'list' ||
    node.type === 'iteration' ||
    node.type === 'aggregator' ||
    node.type === 'tool' ||
    node.type === 'knowledge' ||
    node.type === 'artifact'
  );

  return skillNodes.slice(0, 8).map((node) => ({
    code: node.id,
    name: node.name,
    summary: node.instruction ?? node.description ?? `${node.name} 节点能力`
  }));
}

function deriveWorkflowCapabilitySummary(graph: RoleWorkflowGraph): WorkflowCapabilitySummary {
  const executableNodes = getWorkflowExecutableNodes(graph);
  const executableBusinessNodes = executableNodes.filter((node) => node.id !== graph.entryNodeId);
  const detachedNodes = getWorkflowDetachedNodes(graph);
  const executableNodeIds = new Set(executableNodes.map((node) => node.id));
  const executableEdgeCount = graph.edges.filter(
    (edge) => executableNodeIds.has(edge.sourceNodeId) && executableNodeIds.has(edge.targetNodeId)
  ).length;
  const hasOutputNode = executableNodes.some((node) => node.type === 'output');

  return {
    modelProfileIds: deriveWorkflowModelProfileIds(graph),
    toolIds: readWorkflowGraphToolIds(graph),
    knowledgeSources: deriveWorkflowKnowledgeSources(graph),
    artifactTypes: deriveWorkflowArtifactTypes(graph),
    approvalRequired: executableNodes.some((node) => node.requiresApproval || node.type === 'approval'),
    nodeCount: executableBusinessNodes.length,
    edgeCount: executableEdgeCount,
    warnings: [
      ...(!hasOutputNode ? ['缺少输出节点，PC 端可能无法明确展示最终结果。'] : []),
      ...(detachedNodes.length ? [`有 ${detachedNodes.length} 个未接入节点，不会在 PC 端运行。`] : [])
    ]
  };
}

function deriveWorkflowNodeWarningCount(graph: RoleWorkflowGraph) {
  const variableOptions = deriveWorkflowVariableOptions(graph);
  const reachableNodeIds = getWorkflowReachableNodeIds(graph);
  return graph.nodes
    .filter((node) => reachableNodeIds.has(node.id))
    .reduce((total, node) => total + workflowNodeWarnings(node, variableOptions).length, 0);
}

function deriveWorkflowTraceSummary(result: TemplateTestResult | null) {
  const traces = result?.graphTrace?.nodes ?? [];
  if (!traces.length) return undefined;

  return {
    passed: traces.filter((trace) => trace.status === 'passed').length,
    warning: traces.filter((trace) => trace.status === 'warning').length,
    failed: traces.filter((trace) => trace.status === 'failed').length
  };
}

function formatConditionLabel(condition: WorkflowEdge['condition']) {
  if (!condition || condition.type === 'always') return '总是';
  if (condition.type === 'expression') return `表达式：${condition.expression ?? '-'}`;
  if (condition.type === 'exists') return `存在：${condition.variable ?? 'input'}`;
  if (condition.type === 'equals') return `${condition.variable ?? 'input'} 等于 ${String(condition.value ?? '')}`;
  return `${condition.variable ?? 'input'} 包含 ${String(condition.value ?? '')}`;
}

function normalizeConditionValue(value: unknown) {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function deriveWorkflowStepsFromGraph(graph: RoleWorkflowGraph): RoleWorkflowGraphSourceStep[] {
  const steps: RoleWorkflowGraphSourceStep[] = [];
  let order = 0;
  for (const node of getWorkflowExecutableNodes(graph)) {
    if (node.id === graph.entryNodeId) {
      continue;
    }

    const mappedType =
      node.type === 'llm'
        ? 'llm'
        : node.type === 'artifact'
          ? 'tool'
          : node.type === 'approval' ||
              node.type === 'output' ||
              node.type === 'input' ||
              node.type === 'knowledge' ||
              node.type === 'tool'
            ? node.type
            : undefined;

    if (!mappedType) {
      continue;
    }

    order += 1;
    const step: RoleWorkflowGraphSourceStep = {
      id: node.id,
      order,
      type: mappedType,
      name: node.name,
      instruction: node.instruction ?? node.description ?? ''
    };

    if (node.toolId) {
      step.toolIds = [node.toolId];
    }
    if (node.requiresApproval) {
      step.requiresApproval = true;
    }

    steps.push(step);
  }

  return steps;
}

function createWorkflowSteps(preset: WorkflowPreset): RoleWorkflowGraphSourceStep[] {
  if (preset === 'document') {
    return [
      {
        id: 'receive_file',
        order: 1,
        type: 'input',
        name: '接收任务和附件',
        instruction: '确认用户目标、附件、输出格式和约束。'
      },
      {
        id: 'extract_file',
        order: 2,
        type: 'tool',
        name: '读取文件',
        instruction: '读取用户拖入的文档、表格或资料，并提取可分析文本。',
        toolIds: ['office-document', 'local-filesystem']
      },
      {
        id: 'analyze_content',
        order: 3,
        type: 'llm',
        name: '分析内容',
        instruction: '结合任务目标分析附件内容，提炼结论、风险和下一步动作。'
      },
      {
        id: 'write_result',
        order: 4,
        type: 'tool',
        name: '生成产物',
        instruction: '生成用户可下载的业务文档、表格或演示稿。',
        toolIds: ['office-document']
      },
      {
        id: 'final_reply',
        order: 5,
        type: 'output',
        name: '返回结果',
        instruction: '在对话中总结完成情况，并给出下载入口。'
      }
    ];
  }

  if (preset === 'research') {
    return [
      {
        id: 'receive_topic',
        order: 1,
        type: 'input',
        name: '接收调研主题',
        instruction: '确认调研主题、范围、行业、输出深度和引用要求。'
      },
      {
        id: 'search_context',
        order: 2,
        type: 'tool',
        name: '网页搜索',
        instruction: '搜索公开资料，整理可引用的背景信息和关键事实。',
        toolIds: ['web-search']
      },
      {
        id: 'gather_knowledge',
        order: 3,
        type: 'knowledge',
        name: '读取企业知识',
        instruction: '结合企业本地知识、历史资料和业务约束。'
      },
      {
        id: 'draft_report',
        order: 4,
        type: 'llm',
        name: '生成调研报告',
        instruction: '形成结构化调研报告，包含结论、证据、风险和建议。'
      },
      {
        id: 'final_reply',
        order: 5,
        type: 'output',
        name: '返回结果',
        instruction: '在对话中返回摘要，并给出完整报告下载入口。'
      }
    ];
  }

  return [
    {
      id: 'receive_task',
      order: 1,
      type: 'input',
      name: '接收任务',
      instruction: '确认用户目标、背景、输入资料、输出格式和限制条件。'
    },
    {
      id: 'gather_context',
      order: 2,
      type: 'knowledge',
      name: '读取知识',
      instruction: '读取企业知识库、本地资料和历史经验。'
    },
    {
      id: 'draft_result',
      order: 3,
      type: 'llm',
      name: '分析生成',
      instruction: '完成任务分析，生成可直接交付的初稿。'
    },
    {
      id: 'write_artifact',
      order: 4,
      type: 'tool',
      name: '生成产物',
      instruction: '把最终内容写入可下载的文件。',
      toolIds: ['office-document']
    },
    {
      id: 'final_reply',
      order: 5,
      type: 'output',
      name: '返回结果',
      instruction: '总结完成情况、产物路径和建议的下一步动作。'
    }
  ];
}

function createWorkflowGraph(preset: WorkflowPreset): RoleWorkflowGraph {
  const graph = buildRoleWorkflowGraphFromSteps(createWorkflowSteps(preset), {
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false
    }
  });

  return {
    ...graph,
    nodes: graph.nodes.map((node) =>
      node.type === 'llm'
        ? {
            ...node,
            modelProfileId: node.modelProfileId ?? 'qiu-general-default'
          }
        : node
    )
  };
}

function createBlankWorkflowGraph(): RoleWorkflowGraph {
  return {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      {
        id: 'start',
        type: 'start',
        name: '开始',
        description: '工作流入口。'
      }
    ],
    edges: [],
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false
    }
  };
}

function normalizeWorkflowNodeForNewSurface(node: RoleWorkflowGraphNode): RoleWorkflowGraphNode {
  const translatedName = legacyWorkflowNodeNameTranslations[node.name] ?? node.name;
  const config = { ...(node.config ?? {}) };

  if (node.type === 'data') {
    return {
      ...node,
      name: translatedName,
      config: {
        ...config,
        dataMode: readWorkflowDataMode(node)
      }
    };
  }

  if (node.type === 'llm') {
    return {
      ...node,
      name: translatedName,
      modelProfileId: node.modelProfileId ?? 'qiu-general-default',
      config: {
        ...config,
        llmTaskType: readWorkflowLlmTaskType(node),
        outputMode: readWorkflowModelOutputMode(node)
      }
    };
  }

  return {
    ...node,
    name: translatedName
  };
}

function normalizeWorkflowGraphForCanvas(graph: RoleWorkflowGraph): RoleWorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map(normalizeWorkflowNodeForNewSurface)
  };
}

function nodeTone(type: RoleWorkflowGraphNode['type']) {
  if (type === 'llm') return 'blue';
  if (type === 'tool' || type === 'artifact') return 'purple';
  if (type === 'knowledge' || type === 'list' || type === 'iteration' || type === 'aggregator' || type === 'data') return 'green';
  if (type === 'output') return 'gold';
  return 'default';
}

function workflowNodeTypeLabel(type: RoleWorkflowGraphNode['type']) {
  return workflowNodeTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function buildWorkflowNodeTypeSelectOptions(currentType: WorkflowNodeType) {
  const visibleTypes = new Set<WorkflowNodeType>(workflowAuthoringNodeTypes);
  visibleTypes.add(currentType);
  return workflowNodeTypeOptions.filter((option) => visibleTypes.has(option.value));
}

function traceStatusTone(status: 'passed' | 'warning' | 'failed') {
  if (status === 'passed') return 'green';
  if (status === 'failed') return 'red';
  return 'gold';
}

function workflowNodeMeta(node: RoleWorkflowGraphNode) {
  return node.toolId ?? node.artifactType ?? node.modelProfileId ?? (node.type === 'data' ? readWorkflowDataMode(node) : node.id);
}

function workflowNodeDetails(node: RoleWorkflowGraphNode) {
  const details: string[] = [];
  if (node.inputVariables?.length) details.push(`入 ${node.inputVariables.length}`);
  if (node.outputVariables?.length) details.push(`出 ${node.outputVariables.length}`);
  if (typeof node.config?.action === 'string') details.push(node.config.action);
  if (node.requiresApproval) details.push('需确认');
  return details.slice(0, 3);
}

function workflowNodeWarnings(node: RoleWorkflowGraphNode, variableOptions?: WorkflowVariableOption[]) {
  const warnings: string[] = [];
  const instruction = node.instruction?.trim();
  const action = typeof node.config?.action === 'string' ? node.config.action.trim() : '';
  const variableTypeByValue = variableOptions
    ? new Map(variableOptions.map((variable) => [variable.value, variable.type]))
    : undefined;

  if (node.type === 'llm') {
    if (!node.modelProfileId) warnings.push('未选模型');
    if (!instruction) warnings.push('缺少提示词');
    if (readWorkflowModelOutputMode(node) === 'json') {
      const schema = readWorkflowModelSchema(node);
      if (!schema || (typeof schema === 'object' && !Array.isArray(schema) && Object.keys(schema).length === 0)) {
        warnings.push('JSON 输出缺少结构说明');
      }
    }
  }

  if (node.type === 'tool') {
    if (!node.toolId) warnings.push('未选工具');
    if (!action) warnings.push('未选动作');
  }

  if (node.type === 'data' && readWorkflowDataMode(node) === 'assign') {
    const assignConfig = readWorkflowAssignConfig(node);
    if (!assignConfig.name.trim()) warnings.push('未设置变量名');
    if (!assignConfig.value.trim()) warnings.push('未设置变量值');
    if (node.config?.tableMapping) {
      const tableMapping = readWorkflowAssignTableMappingConfig(node);
      if (!tableMapping.sourceRef) warnings.push('表格映射缺少来源变量');
      if (!tableMapping.outputVariable.trim()) warnings.push('表格映射缺少输出变量');
      if (tableMapping.columns.length === 0) warnings.push('表格映射缺少列');
    }
  }

  if (node.type === 'data' && readWorkflowDataMode(node) === 'code') {
    const code = typeof node.config?.code === 'string' ? node.config.code.trim() : '';
    const outputVariable = typeof node.config?.outputVariable === 'string'
      ? node.config.outputVariable.trim()
      : node.outputVariables?.[0]?.trim();
    const timeoutMs = typeof node.config?.timeoutMs === 'number' ? node.config.timeoutMs : 0;
    if (!code) warnings.push('缺少转换脚本');
    if (!outputVariable) warnings.push('未设置输出变量');
    if (!timeoutMs) warnings.push('未设置超时');
    if (timeoutMs > 10_000) warnings.push('超时不能超过 10000ms');
  }

  if (node.type === 'data' && readWorkflowDataMode(node) === 'template') {
    const template = typeof node.config?.template === 'string' ? node.config.template.trim() : '';
    if (!template) warnings.push('未设置模板内容');
  }

  if (node.type === 'artifact') {
    if (!node.artifactType) warnings.push('未选格式');
    if (!node.toolId) warnings.push('未选写入工具');
    if (!action) warnings.push('未选写入动作');
    const actionArtifactType = workflowArtifactTypeForToolAction(action);
    if (node.artifactType && actionArtifactType && actionArtifactType !== node.artifactType) {
      warnings.push(`写入动作生成 ${actionArtifactType}，与产物格式 ${node.artifactType} 不一致`);
    }
    const missingFields = missingArtifactWriterInputFields(node);
    if (missingFields.length > 0) {
      warnings.push(`产物写入参数缺少：${missingFields.join('、')}`);
    }
    if (
      (node.artifactType === 'xlsx' || node.artifactType === 'csv') &&
      !(node.inputVariables ?? []).some((value) =>
        variableTypeByValue
          ? variableTypeByValue.get(value) === 'table'
          : isSpreadsheetReadyVariableRef(value)
      )
    ) {
      warnings.push('表格产物建议接 table/rows');
    }
  }

  if (node.type === 'output' && !(node.inputVariables?.length)) {
    warnings.push('未接结果变量');
  }

  return warnings;
}

function workflowArtifactTypeForToolAction(action: string): WorkflowArtifactType | undefined {
  if (action === 'office.write_docx_document') return 'docx';
  if (action === 'office.write_markdown_document' || action === 'filesystem.write_text_file') return 'markdown';
  if (action === 'spreadsheet.write_xlsx') return 'xlsx';
  if (action === 'spreadsheet.write_csv') return 'csv';
  if (action === 'presentation.write_pptx') return 'pptx';
  if (action === 'video.compose_clips' || action === 'video.export_mp4') return 'mp4';
  return undefined;
}

function missingArtifactWriterInputFields(node: RoleWorkflowGraphNode): string[] {
  const input = readWorkflowToolInputConfig(node);
  const missing: string[] = [];
  const requireFilled = (key: string, label: string) => {
    if (isBlankWorkflowToolInputValue(input[key])) missing.push(label);
  };
  const hasAnyFilled = (keys: string[]) => keys.some((key) => !isBlankWorkflowToolInputValue(input[key]));

  if (node.artifactType === 'docx' || node.artifactType === 'markdown') {
    requireFilled('title', '标题');
    requireFilled('folder', '目录');
    requireFilled('fileName', '文件名');
    requireFilled('content', '内容');
  }

  if (node.artifactType === 'xlsx' || node.artifactType === 'csv') {
    requireFilled('folder', '目录');
    requireFilled('fileName', '文件名');
    if (!hasAnyFilled(['content', 'rows', 'sheets'])) missing.push('内容或表格数据');
  }

  if (node.artifactType === 'pptx') {
    requireFilled('title', '标题');
    requireFilled('folder', '目录');
    requireFilled('fileName', '文件名');
    if (!hasAnyFilled(['content', 'slides'])) missing.push('内容或幻灯片');
  }

  if (node.artifactType === 'mp4') {
    requireFilled('videoPath', '视频路径');
    requireFilled('cutPlan', '剪辑方案');
    requireFilled('folder', '目录');
    requireFilled('fileName', '文件名');
  }

  return missing;
}

function isSpreadsheetReadyVariableRef(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes('table') ||
    normalized.includes('rows') ||
    normalized.includes('sheet') ||
    normalized.includes('xlsx') ||
    normalized.includes('csv')
  );
}

function workflowTraceStatusLabel(status: WorkflowNodeTrace['status']) {
  if (status === 'passed') return '已通过';
  if (status === 'failed') return '失败';
  return '有警告';
}

function toWorkflowFlowNodes(
  graph: RoleWorkflowGraph,
  testGraphTrace?: AdminRoleTemplateTestGraphTrace,
  variableOptions?: WorkflowVariableOption[],
  actions?: {
    onInsertBefore?: (nodeId: string) => void;
    onInsertAfter?: (nodeId: string) => void;
  }
): WorkflowFlowNode[] {
  const traceByNodeId = new Map((testGraphTrace?.nodes ?? []).map((trace) => [trace.nodeId, trace]));
  const reachableNodeIds = getWorkflowReachableNodeIds(graph);
  return graph.nodes.map((node, index) => {
    const warnings = workflowNodeWarnings(node, variableOptions);
    const trace = traceByNodeId.get(node.id);
    const reachable = reachableNodeIds.has(node.id);
    const statusClass =
      !reachable
        ? 'warning'
        : trace?.status === 'failed'
        ? 'failed'
        : trace?.status === 'warning' || warnings.length
          ? 'warning'
          : 'ready';
    return {
      id: node.id,
      type: 'workflowNode',
      position: readWorkflowNodeCanvasPosition(node, {
        x: 80 + index * 260,
        y: 180 + (index % 2) * 140
      }),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        nodeType: node.type,
        title: node.name,
        meta: workflowNodeMeta(node),
        details: workflowNodeDetails(node),
        tone: nodeTone(node.type),
        statusLabel: !reachable ? '未接入' : trace ? workflowTraceStatusLabel(trace.status) : warnings.length ? '需配置' : '就绪',
        statusClass,
        warnings: reachable ? warnings : ['未接入主流程，运行时不会执行'],
        reachable,
        onInsertBefore: actions?.onInsertBefore,
        onInsertAfter: actions?.onInsertAfter
      }
    };
  });
}

function toWorkflowFlowEdges(graph: RoleWorkflowGraph): WorkflowFlowEdge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: 'smoothstep',
    label: formatConditionLabel(edge.condition),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#94a3b8'
    },
    data: {
      conditionLabel: formatConditionLabel(edge.condition)
    },
    className: edge.condition && edge.condition.type !== 'always'
      ? 'workflow-flow-edge conditional'
      : 'workflow-flow-edge'
  }));
}

function WorkflowFlowNodeCard({ id, data, selected }: NodeProps<WorkflowFlowNode>) {
  return (
    <div className={`workflow-flow-node tone-${data.tone}${selected ? ' selected' : ''}${data.reachable ? '' : ' detached'}`}>
      <Handle type="target" position={Position.Left} className="workflow-flow-handle" />
      <button
        type="button"
        className="workflow-node-insert-button before"
        aria-label={`在 ${data.title} 前面添加节点`}
        onClick={(event) => {
          event.stopPropagation();
          data.onInsertBefore?.(id);
        }}
      >
        +
      </button>
      <div className="workflow-flow-node-header">
        <span className="workflow-flow-node-type-wrap">
          <span className="workflow-flow-node-dot" />
          <span className="workflow-flow-node-type">{workflowNodeTypeLabel(data.nodeType)}</span>
        </span>
        <span className={`workflow-flow-node-status ${data.statusClass}`}>
          {data.statusLabel}
        </span>
      </div>
      <Typography.Text strong ellipsis className="workflow-flow-node-title">
        {data.title}
      </Typography.Text>
      <Typography.Text type="secondary" ellipsis className="workflow-flow-node-meta">
        {data.meta}
      </Typography.Text>
      {data.warnings.length ? (
        <Typography.Text type="warning" ellipsis className="workflow-flow-node-warning">
          {data.warnings[0]}
        </Typography.Text>
      ) : null}
      {data.details.length ? (
        <div className="workflow-flow-node-tags">
          {data.details.map((detail) => (
            <span key={detail}>{detail}</span>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        className="workflow-node-insert-button after"
        aria-label={`在 ${data.title} 后面添加节点`}
        onClick={(event) => {
          event.stopPropagation();
          data.onInsertAfter?.(id);
        }}
      >
        +
      </button>
      <Handle type="source" position={Position.Right} className="workflow-flow-handle" />
    </div>
  );
}

const workflowNodeTypes = {
  workflowNode: WorkflowFlowNodeCard
};

function WorkflowTestTracePanel({ result }: { result: TemplateTestResult }) {
  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Alert
        showIcon
        type={result.valid ? 'success' : 'warning'}
        message={result.message}
        description={
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text>状态：{result.status}</Typography.Text>
            {result.sampleInput ? (
              <Typography.Text type="secondary">样例：{result.sampleInput}</Typography.Text>
            ) : null}
            {result.warnings.length ? (
              <Typography.Text type="warning">提示：{result.warnings.join('；')}</Typography.Text>
            ) : null}
          </Space>
        }
      />
      {result.requiredToolActions?.length ? (
        <Card size="small" bordered={false} className="workflow-empty-panel">
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Typography.Text strong>需要的工具动作</Typography.Text>
            <Space wrap>
              {result.requiredToolActions.map((actionId) => (
                <Tag key={actionId} color="blue">
                  {actionId}
                </Tag>
              ))}
            </Space>
          </Space>
        </Card>
      ) : null}
      {result.graphTrace ? (
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Typography.Text strong>
            节点 trace：{result.graphTrace.nodeCount} 个节点 / {result.graphTrace.edgeCount} 条连线
          </Typography.Text>
          {result.graphTrace.nodes.map((node) => (
            <Card key={node.nodeId} size="small" bordered>
              <Space direction="vertical" size={4} style={{ width: '100%' }}>
                <Space wrap>
                  <Typography.Text strong>{node.nodeName}</Typography.Text>
                  <Tag>{node.nodeType}</Tag>
                  <Tag color={traceStatusTone(node.status)}>{node.status}</Tag>
                </Space>
                <Typography.Text type="secondary">输入：{node.inputPreview}</Typography.Text>
                <Typography.Text type="secondary">输出：{node.outputPreview}</Typography.Text>
                {node.toolActionId ? (
                  <Space wrap size={4}>
                    <Tag color="blue">{node.toolActionId}</Tag>
                    {(node.requiredInputTypes ?? []).map((type) => (
                      <Tag key={`in-${node.nodeId}-${type}`}>入：{type}</Tag>
                    ))}
                    {(node.producedOutputTypes ?? []).map((type) => (
                      <Tag key={`out-${node.nodeId}-${type}`}>出：{type}</Tag>
                    ))}
                  </Space>
                ) : null}
                {node.warnings.length ? (
                  <Typography.Text type="warning">警告：{node.warnings.join('；')}</Typography.Text>
                ) : null}
              </Space>
            </Card>
          ))}
        </Space>
      ) : null}
    </Space>
  );
}

function WorkflowConfigSection({
  title,
  description,
  children
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="workflow-config-section">
      <Space direction="vertical" size={6} style={{ width: '100%' }}>
        <Space direction="vertical" size={1} style={{ width: '100%' }}>
          <Typography.Text strong>{title}</Typography.Text>
          {description ? (
            <Typography.Text type="secondary" className="workflow-config-section-desc">
              {description}
            </Typography.Text>
          ) : null}
        </Space>
        {children}
      </Space>
    </section>
  );
}

function WorkflowVariableTypeBadge({ type }: { type: WorkflowVariableType }) {
  return (
    <Tag color={workflowVariableTypeColors[type]} className={`workflow-variable-type type-${workflowVariableTypeClass(type)}`}>
      {workflowVariableTypeLabels[type]}
    </Tag>
  );
}

function WorkflowVariableReferencePanel({
  variables,
  selectedNode
}: {
  variables: WorkflowVariableOption[];
  selectedNode: RoleWorkflowGraphNode;
}) {
  const variableByValue = new Map(variables.map((variable) => [variable.value, variable]));
  const selectedInputs = selectedNode.inputVariables ?? [];
  const selectedOutputs = selectedNode.outputVariables ?? [];
  const visibleVariables = variables.slice(0, 24);
  const variableReferenceContent = (
    <div className="workflow-variable-popover">
      <Typography.Text strong>变量说明</Typography.Text>
      <Typography.Text type="secondary" className="workflow-config-section-desc">
        变量是节点之间传递数据的引用。文件、图片、视频只传路径或引用，执行时由对应工具读取。
      </Typography.Text>
      <div className="workflow-variable-list">
        {visibleVariables.map((variable) => (
          <div key={variable.value} className="workflow-variable-row">
            <div className="workflow-variable-row-main">
              <Typography.Text ellipsis className="workflow-variable-name">
                {variable.value}
              </Typography.Text>
              <Typography.Text type="secondary" ellipsis className="workflow-variable-label">
                {variable.source} · {variable.label}
              </Typography.Text>
            </div>
            <WorkflowVariableTypeBadge type={variable.type} />
          </div>
        ))}
      </div>
      {variables.length > visibleVariables.length ? (
        <Typography.Text type="secondary" className="workflow-config-section-desc">
          已显示前 {visibleVariables.length} 个变量，其余可在输入框中搜索。
        </Typography.Text>
      ) : null}
    </div>
  );

  return (
    <div className="workflow-variable-reference compact">
      <div className="workflow-variable-reference-head">
        <div>
          <Typography.Text strong>变量</Typography.Text>
          <Typography.Text type="secondary" className="workflow-config-section-desc">
            当前节点的输入和输出
          </Typography.Text>
        </div>
        <Popover placement="leftTop" trigger="hover" content={variableReferenceContent}>
          <Button
            size="small"
            type="text"
            className="workflow-variable-help-button"
            icon={<InfoCircleOutlined />}
          />
        </Popover>
      </div>
      <div className="workflow-variable-current compact">
        <Typography.Text type="secondary">输入</Typography.Text>
        <div className="workflow-variable-tags compact">
          {selectedInputs.length ? (
            selectedInputs.map((value) => {
              const variable = variableByValue.get(value);
              return (
                <Tag key={value} color={variable ? workflowVariableTypeColors[variable.type] : undefined}>
                  {value}
                </Tag>
              );
            })
          ) : (
            <Tag>无</Tag>
          )}
        </div>
        <Typography.Text type="secondary">输出</Typography.Text>
        <div className="workflow-variable-tags compact">
          {selectedOutputs.length ? (
            selectedOutputs.map((value) => {
              const variable = variableByValue.get(value);
              return (
                <Tag key={value} color={variable ? workflowVariableTypeColors[variable.type] : undefined}>
                  {value}
                </Tag>
              );
            })
          ) : (
            <Tag>无</Tag>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkflowVariableQuickSet({
  variables,
  onPick,
  mode = 'template'
}: {
  variables: WorkflowVariableOption[];
  onPick: (token: string) => void;
  mode?: 'template' | 'path';
}) {
  return (
    <Select
      size="small"
      allowClear
      showSearch
      value={undefined}
      placeholder="填入变量"
      optionFilterProp="label"
      options={buildWorkflowVariableSelectOptions(variables)}
      onChange={(value) => {
        if (!value) return;
        onPick(formatWorkflowVariableToken(value, mode));
      }}
    />
  );
}

function WorkflowTableMappingColumnsEditor({
  columns,
  onChange
}: {
  columns: WorkflowTableColumnConfig[];
  onChange: (columns: WorkflowTableColumnConfig[]) => void;
}) {
  const editorColumns = columns.length ? columns : defaultWorkflowTableColumns;

  function updateColumn(index: number, patch: Partial<WorkflowTableColumnConfig>) {
    onChange(
      editorColumns.map((column, columnIndex) =>
        columnIndex === index
          ? {
              header: patch.header ?? column.header,
              path: patch.path ?? column.path
            }
          : column
      )
    );
  }

  function removeColumn(index: number) {
    const nextColumns = editorColumns.filter((_, columnIndex) => columnIndex !== index);
    onChange(nextColumns.length ? nextColumns : editorColumns);
  }

  return (
    <div className="workflow-table-mapping-editor">
      <div className="workflow-table-mapping-head">
        <span>表格列名</span>
        <span>读取字段路径</span>
        <span />
      </div>
      {editorColumns.map((column, index) => (
        <div className="workflow-table-mapping-row" key={`${column.header}-${column.path}-${index}`}>
          <Input
            size="small"
            value={column.header}
            placeholder="例如：客户名称"
            onChange={(event) => updateColumn(index, { header: event.target.value })}
          />
          <Input
            size="small"
            value={column.path}
            placeholder="例如：customer.name"
            onChange={(event) => updateColumn(index, { path: event.target.value })}
          />
          <Button
            size="small"
            type="text"
            danger
            icon={<DeleteOutlined />}
            disabled={editorColumns.length <= 1}
            onClick={() => removeColumn(index)}
          />
        </div>
      ))}
      <Space size={8}>
        <Button
          size="small"
          icon={<PlusOutlined />}
          onClick={() => onChange([...editorColumns, { header: '', path: '' }])}
        >
          添加列
        </Button>
        <Button size="small" type="text" onClick={() => onChange(defaultWorkflowTableColumns)}>
          使用示例列
        </Button>
      </Space>
    </div>
  );
}

function buildWorkflowCodePreviewInput(
  node: RoleWorkflowGraphNode,
  variables: WorkflowVariableOption[]
): Record<string, unknown> {
  const input: Record<string, unknown> = {
    variables: {}
  };
  const variablesByRef = input.variables as Record<string, unknown>;
  const variableByRef = new Map(variables.map((variable) => [variable.value, variable]));
  const refs = node.inputVariables?.length ? node.inputVariables : ['start.text'];

  for (const ref of refs) {
    const variable = variableByRef.get(ref) ?? {
      value: ref,
      label: ref,
      source: '示例',
      type: inferWorkflowVariableTypeFromName(ref)
    };
    const value = createWorkflowCodePreviewValue(variable);
    variablesByRef[ref] = value;
    writeWorkflowCodePreviewInputPath(input, ref, value);

    const alias = ref.split('.').map((part) => part.trim()).filter(Boolean).at(-1);
    if (alias && input[alias] === undefined) {
      input[alias] = value;
    }
  }

  return input;
}

function createWorkflowCodePreviewValue(variable: WorkflowVariableOption): unknown {
  if (variable.value === 'start.text') {
    return '请把这批客户线索整理成 Excel，并给出优先级。';
  }
  if (variable.value === 'runtime.previous_text') {
    return '上一步已经提取出 2 条客户线索。';
  }
  if (variable.type === 'table' || /(rows|table|xlsx|csv)/i.test(variable.value)) {
    return [
      ['客户', '分数', '建议'],
      ['Acme', '92', '优先跟进'],
      ['Beta', '76', '确认预算']
    ];
  }
  if (variable.type === 'asset[]') {
    return [
      {
        id: 'sample-file-1',
        name: '客户线索.txt',
        kind: 'document',
        localPath: 'C:\\QiuAI\\samples\\客户线索.txt'
      }
    ];
  }
  if (variable.type === 'asset') {
    return {
      id: 'sample-file-1',
      name: '客户线索.txt',
      kind: 'document',
      localPath: 'C:\\QiuAI\\samples\\客户线索.txt'
    };
  }
  if (variable.type === 'number') {
    return 92;
  }
  if (variable.type === 'boolean') {
    return true;
  }
  if (variable.type === 'json' || /(payload|items|records|data|json)/i.test(variable.value)) {
    return {
      items: [
        { customer: 'Acme', score: 92, suggestion: '优先跟进' },
        { customer: 'Beta', score: 76, suggestion: '确认预算' }
      ],
      summary: '示例结构化数据'
    };
  }
  if (variable.type === 'artifact') {
    return {
      localPath: 'C:\\QiuAI\\outputs\\结果.xlsx',
      type: 'xlsx'
    };
  }
  return `示例文本：${variable.label}`;
}

function writeWorkflowCodePreviewInputPath(
  target: Record<string, unknown>,
  ref: string,
  value: unknown
) {
  const parts = ref.split('.').map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return;

  let current = target;
  for (const part of parts.slice(0, -1)) {
    const existing = current[part];
    if (!existing || typeof existing !== 'object' || Array.isArray(existing)) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  current[parts[parts.length - 1]!] = value;
}

const workflowCodePreviewForbiddenPattern =
  /\b(?:async|await|eval|Function|import|require|process|globalThis|window|document|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|navigator|electron|setTimeout|setInterval)\b|__proto__|prototype|constructor/;

function runWorkflowCodePreview(input: {
  code: string;
  runtimeInput: Record<string, unknown>;
  timeoutMs: number;
}): Promise<unknown> {
  const source = input.code.trim();
  if (!source) {
    return Promise.reject(new Error('代码为空。'));
  }
  const forbiddenMatch = source.match(workflowCodePreviewForbiddenPattern);
  if (forbiddenMatch) {
    return Promise.reject(new Error(`代码包含被禁止的关键词：${forbiddenMatch[0]}`));
  }
  if (typeof Worker !== 'function' || typeof Blob !== 'function' || typeof URL.createObjectURL !== 'function') {
    return Promise.reject(new Error('当前浏览器不支持代码节点试算 Worker。'));
  }

  const workerUrl = URL.createObjectURL(
    new Blob([createWorkflowCodePreviewWorkerSource()], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);

  return new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error(`代码试算超过 ${input.timeoutMs}ms，已停止。`));
    }, input.timeoutMs);

    worker.onmessage = (event: MessageEvent) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      const payload = event.data as { ok?: boolean; result?: unknown; error?: string };
      if (payload?.ok) {
        resolve(payload.result);
        return;
      }
      reject(new Error(payload?.error || '代码试算失败。'));
    };
    worker.onerror = (event) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      reject(new Error(event.message || '代码 Worker 执行失败。'));
    };
    worker.postMessage({ source, input: input.runtimeInput });
  });
}

function createWorkflowCodePreviewWorkerSource() {
  return `
function readColumn(value, path) {
  const segments = String(path || '').split('.').map((segment) => segment.trim()).filter(Boolean);
  let currentValue = value;
  for (const segment of segments) {
    if (currentValue === undefined || currentValue === null) return '';
    if (Array.isArray(currentValue)) {
      const index = Number(segment);
      if (!Number.isInteger(index) || index < 0 || index >= currentValue.length) return '';
      currentValue = currentValue[index];
      continue;
    }
    if (typeof currentValue === 'object') {
      currentValue = currentValue[segment];
      continue;
    }
    return '';
  }
  return currentValue === undefined || currentValue === null ? '' : currentValue;
}
function formatCell(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}
function normalizeRows(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return [];
  for (const key of ['rows', 'items', 'results', 'data', 'records']) {
    if (Array.isArray(value[key])) return value[key];
  }
  return [value];
}
function readColumnConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const path = typeof value.path === 'string' ? value.path.trim() : '';
  const header = typeof value.header === 'string' && value.header.trim() ? value.header.trim() : path;
  return path && header ? [{ header, path }] : [];
}
function ensureSerializable(value) {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) throw new Error('结果必须是 JSON 可序列化数据。');
  return JSON.parse(serialized);
}
function createHelpers() {
  return {
    pick(value, path) {
      return readColumn(value, path);
    },
    toRows(items, columns) {
      const sourceRows = normalizeRows(items);
      const normalizedColumns = Array.isArray(columns) ? columns.flatMap(readColumnConfig) : [];
      if (normalizedColumns.length === 0) return sourceRows;
      return [
        normalizedColumns.map((column) => column.header),
        ...sourceRows.map((item) => normalizedColumns.map((column) => formatCell(readColumn(item, column.path))))
      ];
    }
  };
}
self.onmessage = function(event) {
  try {
    const runner = new Function('input', 'helpers', [
      '"use strict";',
      'const require = undefined;',
      'const process = undefined;',
      'const window = undefined;',
      'const document = undefined;',
      'const fetch = undefined;',
      event.data.source
    ].join('\\n'));
    const result = runner(ensureSerializable(event.data.input), createHelpers());
    if (result === undefined) throw new Error('代码必须 return 一个结果。');
    if (result && typeof result === 'object' && typeof result.then === 'function') {
      throw new Error('代码节点只支持同步转换。');
    }
    self.postMessage({ ok: true, result: ensureSerializable(result) });
  } catch (error) {
    self.postMessage({ ok: false, error: error && error.message ? error.message : String(error) });
  }
};`;
}

function WorkflowNodeLastRunPanel({
  trace
}: {
  trace?: WorkflowNodeTrace;
}) {
  if (!trace) {
    return (
      <Card size="small" bordered={false} className="workflow-empty-panel">
        <Typography.Text type="secondary">
          还没有这个节点的试运行记录。点击右上角“试运行”后，这里会显示输入、输出和错误。
        </Typography.Text>
      </Card>
    );
  }

  return (
    <Space direction="vertical" size={10} style={{ width: '100%' }}>
      <Alert
        showIcon
        type={trace.status === 'failed' ? 'error' : trace.warnings.length ? 'warning' : 'success'}
        message={`上次运行：${trace.status}`}
        description={trace.warnings.length ? trace.warnings.join('；') : '节点运行记录可用于定位提示词、变量和工具参数问题。'}
      />
      <WorkflowConfigSection title="输入快照">
        <Typography.Paragraph className="workflow-trace-preview">
          {trace.inputPreview || '无'}
        </Typography.Paragraph>
      </WorkflowConfigSection>
      <WorkflowConfigSection title="输出快照">
        <Typography.Paragraph className="workflow-trace-preview">
          {trace.outputPreview || '无'}
        </Typography.Paragraph>
      </WorkflowConfigSection>
    </Space>
  );
}

function workflowNodeConfigDescription(node: RoleWorkflowGraphNode) {
  if (node.type === 'list') return '从附件或上游数组里筛出要处理的对象，例如只保留视频、图片或表格。';
  if (node.type === 'iteration') return '按顺序一条条处理列表里的文件、表格行或业务对象。';
  if (node.type === 'aggregator') return '把多个分支或批处理结果合成一个结果，方便后续继续使用。';
  if (node.type === 'data') return '把变量整理成固定字段、文本片段或结构化结果，供后续工具、模型和产物节点使用。';
  if (node.type === 'tool') return '调用具体工具完成真实动作，例如搜索、读写文件、OCR、视频处理或 MCP。';
  if (node.type === 'artifact') return '生成真实可下载文件，格式和写入规则由这个节点决定。';
  if (node.type === 'output') return '整理最终回复，只负责告诉用户结果、说明和下载位置。';
  if (node.type === 'condition') return '根据变量结果选择下一条线，适合通过/不通过、A 类/B 类这类分支。';
  if (node.type === 'loop') return '控制重复执行的次数和退出条件，避免流程失控。';
  if (node.type === 'knowledge') return '读取企业知识库、本地知识或服务端摘要，作为后续节点参考。';
  if (node.type === 'llm') return '调用一个大模型完成生成、分析、推理或结构化输出。';
  return '配置节点名称、执行说明、输入变量和输出变量。';
}

function WorkflowReactFlowEditor({
  graph,
  onChange,
  testGraphTrace,
  toolCatalog,
  assets
}: {
  graph: RoleWorkflowGraph;
  onChange: (graph: RoleWorkflowGraph) => void;
  testGraphTrace?: AdminRoleTemplateTestGraphTrace;
  toolCatalog: ToolActionCatalog;
  assets: AssetDefinitionDetail[];
}) {
  const [selection, setSelection] = useState<WorkflowSelection>({
    type: 'node',
    id: graph.entryNodeId
  });
  const [configPanelTab, setConfigPanelTab] = useState<WorkflowConfigPanelTab>('settings');
  const [nodePicker, setNodePicker] = useState<{
    open: boolean;
    mode: WorkflowNodePickerMode;
    sourceNodeId?: string;
    targetNodeId?: string;
    edgeId?: string;
    position?: WorkflowCanvasPosition;
  }>({ open: false, mode: 'free' });
  const canvasShellRef = useRef<HTMLElement | null>(null);
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null);
  const [contextMenu, setContextMenu] = useState<WorkflowContextMenu>({ open: false });
  const [runningCodePreviewNodeId, setRunningCodePreviewNodeId] = useState<string | null>(null);
  const [codePreviewResults, setCodePreviewResults] = useState<Record<string, WorkflowCodePreviewResult>>({});
  const serverToolOptions = useMemo(
    () =>
      toolCatalog.packages.map((toolPackage) => ({
        value: toolPackage.id,
        label: `${toolPackage.name} / ${toolPackage.id}`
      })),
    [toolCatalog]
  );
  const assetVariableOptions = useMemo(
    () => buildAssetVariableOptions(assets),
    [assets]
  );
  const modelAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'MODEL' && asset.status === 'ACTIVE'),
    [assets]
  );
  const toolActionAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'TOOL' && asset.status === 'ACTIVE'),
    [assets]
  );
  const artifactTemplateAssets = useMemo(
    () => assets.filter((asset) => asset.type === 'ARTIFACT_TEMPLATE' && asset.status === 'ACTIVE'),
    [assets]
  );
  const modelAssetOptions = useMemo(() => buildModelAssetOptions(modelAssets), [modelAssets]);
  const toolActionAssetOptions = useMemo(
    () => buildToolActionAssetOptions(toolActionAssets),
    [toolActionAssets]
  );
  const artifactTemplateAssetOptions = useMemo(
    () => buildArtifactTemplateAssetOptions(artifactTemplateAssets),
    [artifactTemplateAssets]
  );
  const serverToolActionTemplatesByToolId = useMemo(() => {
    const grouped: Record<string, ToolActionTemplate[]> = {};
    for (const action of toolCatalog.actions) {
      const templates = grouped[action.packageId] ?? [];
      templates.push({
        toolId: action.packageId,
        value: action.actionId,
        label: `${action.name} / ${action.actionId}`,
        defaults: action.defaultInput,
        fields: action.uiFields
      });
      grouped[action.packageId] = templates;
    }
    return grouped;
  }, [toolCatalog]);
  const getDefaultToolActionTemplateForCanvas = useCallback(
    (toolId: string): ToolActionTemplate | undefined => serverToolActionTemplatesByToolId[toolId]?.[0],
    [serverToolActionTemplatesByToolId]
  );
  const getSelectedToolActionTemplateForCanvas = useCallback(
    (toolId: string | undefined, action: string | undefined): ToolActionTemplate | undefined => {
      if (!toolId) return undefined;
      const templates = serverToolActionTemplatesByToolId[toolId] ?? [];
      return templates.find((template) => template.value === action) ?? templates[0];
    },
    [serverToolActionTemplatesByToolId]
  );
  const getDefaultArtifactActionTemplateForCanvas = useCallback(
    (artifactType: WorkflowArtifactType | undefined): ToolActionTemplate | undefined => {
      if (artifactType === 'mp4') {
        return serverToolActionTemplatesByToolId['video-processing']?.find(
          (template) => template.value === 'video.compose_clips'
        );
      }
      const officeTemplates = serverToolActionTemplatesByToolId['office-document'] ?? [];
      if (artifactType === 'xlsx') {
        return officeTemplates.find((template) => template.value === 'spreadsheet.write_xlsx');
      }
      if (artifactType === 'csv') {
        return officeTemplates.find((template) => template.value === 'spreadsheet.write_csv');
      }
      if (artifactType === 'pptx') {
        return officeTemplates.find((template) => template.value === 'presentation.write_pptx');
      }
      if (artifactType === 'markdown') {
        return officeTemplates.find((template) => template.value === 'office.write_markdown_document');
      }
      return officeTemplates.find((template) => template.value === 'office.write_docx_document');
    },
    [serverToolActionTemplatesByToolId]
  );
  const getSelectedWorkflowNodeToolActionTemplateForCanvas = useCallback(
    (node: RoleWorkflowGraphNode): ToolActionTemplate | undefined => {
      const action = typeof node.config?.action === 'string' ? node.config.action : undefined;
      if (node.type === 'artifact') {
        return getSelectedToolActionTemplateForCanvas(
          node.toolId,
          action ?? getDefaultArtifactActionTemplateForCanvas(node.artifactType)?.value
        );
      }
      return getSelectedToolActionTemplateForCanvas(node.toolId, action);
    },
    [getDefaultArtifactActionTemplateForCanvas, getSelectedToolActionTemplateForCanvas]
  );
  const variableOptions = useMemo(
    () => deriveWorkflowVariableOptions(graph, assetVariableOptions),
    [assetVariableOptions, graph]
  );
  const variableSelectOptions = useMemo(
    () => buildWorkflowVariableSelectOptions(variableOptions),
    [variableOptions]
  );
  const flowNodes = useMemo(
    () =>
      toWorkflowFlowNodes(graph, testGraphTrace, variableOptions, {
        onInsertBefore: openNodePickerBefore,
        onInsertAfter: openNodePickerAfter
      }),
    [graph, testGraphTrace, variableOptions]
  );
  const flowEdges = useMemo(() => toWorkflowFlowEdges(graph), [graph]);
  const nodePositions = useMemo(
    () => new Map(flowNodes.map((node) => [node.id, node.position] as const)),
    [flowNodes]
  );
  const selectedNode =
    selection.type === 'node'
      ? graph.nodes.find((node) => node.id === selection.id) ?? graph.nodes[0]
      : undefined;
  const selectedEdge =
    selection.type === 'edge'
      ? graph.edges.find((edge) => edge.id === selection.id) ?? graph.edges[0]
      : undefined;
  const nodeOptions = graph.nodes.map((node) => ({
    value: node.id,
    label: `${node.name} / ${node.id}`
  }));
  const selectedNodeWarnings = selectedNode ? workflowNodeWarnings(selectedNode, variableOptions) : [];
  const selectedNodeTrace = selectedNode
    ? testGraphTrace?.nodes.find((node) => node.nodeId === selectedNode.id)
    : undefined;
  const selectedDataMode = selectedNode && isDataProcessingNodeType(selectedNode.type)
    ? readWorkflowDataMode(selectedNode)
    : undefined;
  const selectedAssignConfig = selectedNode && isDataProcessingNodeType(selectedNode.type) && selectedDataMode === 'assign'
    ? readWorkflowAssignConfig(selectedNode)
    : undefined;
  const selectedAssignTableMapping = selectedNode && isDataProcessingNodeType(selectedNode.type) && selectedDataMode === 'assign'
    ? readWorkflowAssignTableMappingConfig(selectedNode)
    : undefined;
  const selectedArtifactTableSourceRef = selectedNode?.type === 'artifact'
    ? readArtifactTableSourceRef(selectedNode)
    : undefined;
  const selectedCodePreviewInput = selectedNode && isDataProcessingNodeType(selectedNode.type) && selectedDataMode === 'code'
    ? buildWorkflowCodePreviewInput(selectedNode, variableOptions)
    : undefined;
  const selectedCodePreviewResult = selectedNode && isDataProcessingNodeType(selectedNode.type) && selectedDataMode === 'code'
    ? codePreviewResults[selectedNode.id]
    : undefined;
  const selectedModelAssetKey =
    selectedNode && isModelNodeType(selectedNode.type)
      ? readWorkflowConfigString(selectedNode.config, 'modelAssetKey') ?? selectedNode.modelProfileId
      : undefined;
  const selectedLlmTaskType =
    selectedNode && isModelNodeType(selectedNode.type)
      ? readWorkflowLlmTaskType(selectedNode)
      : undefined;
  const selectedModelAssetOptions = useMemo(
    () => buildModelAssetOptions(modelAssets, selectedLlmTaskType),
    [modelAssets, selectedLlmTaskType]
  );
  const selectedToolActionAssetKey =
    selectedNode && (selectedNode.type === 'tool' || selectedNode.type === 'artifact')
      ? readWorkflowConfigString(selectedNode.config, 'toolActionAssetKey') ?? readWorkflowConfigString(selectedNode.config, 'action')
      : undefined;
  const selectedArtifactTemplateAssetKey =
    selectedNode?.type === 'artifact'
      ? readWorkflowConfigString(selectedNode.config, 'artifactTemplateAssetKey')
      : undefined;

  useEffect(() => {
    const selectedNodeExists = selection.type === 'node' && graph.nodes.some((node) => node.id === selection.id);
    const selectedEdgeExists = selection.type === 'edge' && graph.edges.some((edge) => edge.id === selection.id);
    if (!selectedNodeExists && !selectedEdgeExists) {
      setSelection({ type: 'node', id: graph.entryNodeId });
    }
  }, [graph, selection]);

  useEffect(() => {
    setConfigPanelTab('settings');
  }, [selection.id, selection.type]);

  const updateNode = useCallback(
    (nodeId: string, patch: Partial<RoleWorkflowGraphNode>) => {
      onChange({
        ...graph,
        nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
      });
    },
    [graph, onChange]
  );

  const updateEdge = useCallback(
    (edgeId: string, patch: Partial<WorkflowEdge>) => {
      onChange({
        ...graph,
        edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge))
      });
    },
    [graph, onChange]
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<WorkflowFlowNode>[]) => {
      const removedNodeIds = new Set(
        changes
          .filter((change) => change.type === 'remove')
          .map((change) => change.id)
          .filter((nodeId) => nodeId !== graph.entryNodeId)
      );
      const positions = new Map<string, WorkflowCanvasPosition>();

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          positions.set(change.id, change.position);
        }
      }

      if (removedNodeIds.size === 0 && positions.size === 0) {
        return;
      }

      onChange({
        ...graph,
        nodes: graph.nodes
          .filter((node) => !removedNodeIds.has(node.id))
          .map((node) => {
            const position = positions.get(node.id);
            return position ? writeWorkflowNodeCanvasPosition(node, position) : node;
          }),
        edges: graph.edges.filter(
          (edge) => !removedNodeIds.has(edge.sourceNodeId) && !removedNodeIds.has(edge.targetNodeId)
        )
      });
    },
    [graph, onChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange<WorkflowFlowEdge>[]) => {
      const removedEdgeIds = new Set(
        changes
          .filter((change) => change.type === 'remove')
          .map((change) => change.id)
      );

      if (removedEdgeIds.size === 0) {
        return;
      }

      onChange({
        ...graph,
        edges: graph.edges.filter((edge) => !removedEdgeIds.has(edge.id))
      });
    },
    [graph, onChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      const error = validateWorkflowConnection(graph, connection.source, connection.target);
      if (error) {
        message.warning(error);
        return;
      }

      const edge: WorkflowEdge = {
        id: createWorkflowEdgeId(connection.source!, connection.target!, graph.edges),
        sourceNodeId: connection.source!,
        targetNodeId: connection.target!,
        condition: { type: 'always' }
      };
      onChange({ ...graph, edges: [...graph.edges, edge] });
      setSelection({ type: 'edge', id: edge.id });
    },
    [graph, onChange]
  );

  function closeContextMenu() {
    setContextMenu({ open: false });
  }

  function readCanvasRelativePosition(event: { clientX: number; clientY: number }) {
    const rect = canvasShellRef.current?.getBoundingClientRect();
    return {
      x: Math.max(8, Math.round(event.clientX - (rect?.left ?? 0))),
      y: Math.max(8, Math.round(event.clientY - (rect?.top ?? 0)))
    };
  }

  function toFlowPosition(event: { clientX: number; clientY: number }): WorkflowCanvasPosition | undefined {
    return flowInstance?.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });
  }

  function openNodePicker(options?: {
    mode?: WorkflowNodePickerMode;
    sourceNodeId?: string;
    targetNodeId?: string;
    edgeId?: string;
    position?: WorkflowCanvasPosition;
  }) {
    setNodePicker({
      open: true,
      mode: options?.mode ?? 'free',
      sourceNodeId: options?.sourceNodeId,
      targetNodeId: options?.targetNodeId,
      edgeId: options?.edgeId,
      position: options?.position
    });
    closeContextMenu();
  }

  function openNodePickerAfter(nodeId: string) {
    const sourcePosition = nodePositions.get(nodeId);
    openNodePicker({
      mode: 'after',
      sourceNodeId: nodeId,
      position: sourcePosition ? { x: sourcePosition.x + 260, y: sourcePosition.y } : undefined
    });
  }

  function openNodePickerBefore(nodeId: string) {
    if (nodeId === graph.entryNodeId) {
      message.warning('开始节点前面不能再添加节点');
      return;
    }
    const incomingEdge = graph.edges.find((edge) => edge.targetNodeId === nodeId);
    const targetPosition = nodePositions.get(nodeId);
    openNodePicker({
      mode: incomingEdge ? 'edge' : 'before',
      edgeId: incomingEdge?.id,
      targetNodeId: nodeId,
      position: targetPosition ? { x: targetPosition.x - 260, y: targetPosition.y } : undefined
    });
  }

  function closeNodePicker() {
    setNodePicker({ open: false, mode: 'free' });
  }

  function createNodeAt(type: WorkflowNodeType, position?: WorkflowCanvasPosition) {
    const node = createCanvasNode(type, graph.nodes, {
      defaultToolId: serverToolOptions[0]?.value,
      getDefaultToolActionTemplate: getDefaultToolActionTemplateForCanvas,
      getDefaultArtifactActionTemplate: getDefaultArtifactActionTemplateForCanvas
    });
    return writeWorkflowNodeCanvasPosition(node, position ?? {
      x: 140 + (graph.nodes.length % 3) * 36,
      y: 180 + (graph.nodes.length % 4) * 36
    });
  }

  function addNode(
    type: WorkflowNodeType,
    options?: {
      mode?: WorkflowNodePickerMode;
      sourceNodeId?: string;
      targetNodeId?: string;
      edgeId?: string;
      position?: WorkflowCanvasPosition;
    }
  ) {
    const mode = options?.mode ?? nodePicker.mode;
    const edgeId = options?.edgeId ?? nodePicker.edgeId;
    const edgeToInsert = edgeId
      ? graph.edges.find((edge) => edge.id === edgeId)
      : undefined;
    const sourceNodeId = edgeToInsert?.sourceNodeId ?? options?.sourceNodeId ?? nodePicker.sourceNodeId;
    const targetNodeId = edgeToInsert?.targetNodeId ?? options?.targetNodeId ?? nodePicker.targetNodeId;
    const sourcePosition = sourceNodeId ? nodePositions.get(sourceNodeId) : undefined;
    const targetPosition = targetNodeId ? nodePositions.get(targetNodeId) : undefined;
    const fallbackPosition =
      options?.position ?? nodePicker.position ??
      (edgeToInsert && sourcePosition && targetPosition
        ? {
            x: Math.round((sourcePosition.x + targetPosition.x) / 2),
            y: Math.round((sourcePosition.y + targetPosition.y) / 2) + 80
          }
        : sourcePosition && mode === 'after'
          ? { x: sourcePosition.x + 260, y: sourcePosition.y }
          : targetPosition && mode === 'before'
            ? { x: targetPosition.x - 260, y: targetPosition.y }
            : undefined);
    const node = createNodeAt(type, fallbackPosition);
    const sourceNodeIndex = sourceNodeId ? graph.nodes.findIndex((item) => item.id === sourceNodeId) : -1;
    const targetNodeIndex = targetNodeId ? graph.nodes.findIndex((item) => item.id === targetNodeId) : -1;
    const insertIndex =
      sourceNodeIndex >= 0
        ? sourceNodeIndex + 1
        : targetNodeIndex >= 0
          ? targetNodeIndex
          : graph.nodes.length;
    const nodes = [
      ...graph.nodes.slice(0, insertIndex),
      node,
      ...graph.nodes.slice(insertIndex)
    ];

    let edges: WorkflowEdge[] = graph.edges;
    if (edgeToInsert) {
      edges = [
        ...graph.edges.filter((edge) => edge.id !== edgeToInsert.id),
        {
          id: createWorkflowEdgeId(edgeToInsert.sourceNodeId, node.id, graph.edges),
          sourceNodeId: edgeToInsert.sourceNodeId,
          targetNodeId: node.id,
          condition: edgeToInsert.condition ?? { type: 'always' as const }
        },
        {
          id: createWorkflowEdgeId(node.id, edgeToInsert.targetNodeId, graph.edges),
          sourceNodeId: node.id,
          targetNodeId: edgeToInsert.targetNodeId,
          condition: { type: 'always' as const }
        }
      ];
    } else if (mode === 'after' && sourceNodeId) {
      edges = [
        ...graph.edges,
        {
          id: createWorkflowEdgeId(sourceNodeId, node.id, graph.edges),
          sourceNodeId,
          targetNodeId: node.id,
          condition: { type: 'always' as const }
        }
      ];
    } else if (mode === 'before' && targetNodeId) {
      const error = validateWorkflowConnection({ ...graph, nodes }, node.id, targetNodeId);
      if (error) {
        message.warning(error);
        return;
      }
      edges = [
        ...graph.edges,
        {
          id: createWorkflowEdgeId(node.id, targetNodeId, graph.edges),
          sourceNodeId: node.id,
          targetNodeId,
          condition: { type: 'always' as const }
        }
      ];
    }

    const nextGraph = { ...graph, nodes, edges };
    const nodeIsReachable = getWorkflowReachableNodeIds(nextGraph).has(node.id);
    onChange(nextGraph);
    setSelection({ type: 'node', id: node.id });
    closeNodePicker();
    message.success(nodeIsReachable ? '已添加并接入主流程' : '已添加自由节点，连到主流程后才会运行');
  }

  function deleteNode(nodeId: string) {
    if (nodeId === graph.entryNodeId) {
      message.warning('入口节点不能删除');
      return;
    }
    onChange({
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      edges: graph.edges.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
    });
    setSelection({ type: 'node', id: graph.entryNodeId });
  }

  function deleteEdge(edgeId: string) {
    onChange({
      ...graph,
      edges: graph.edges.filter((edge) => edge.id !== edgeId)
    });
    setSelection({ type: 'node', id: graph.entryNodeId });
  }

  function resetLinearEdges() {
    const reachableNodeIds = getWorkflowReachableNodeIds(graph);
    const executableNodes = graph.nodes.filter((node) => reachableNodeIds.has(node.id));
    const detachedNodes = graph.nodes.filter((node) => !reachableNodeIds.has(node.id));
    const nextPositions = new Map<string, WorkflowCanvasPosition>();

    executableNodes.forEach((node, index) => {
      nextPositions.set(node.id, {
        x: 90 + index * 280,
        y: 170 + (index % 2) * 110
      });
    });
    detachedNodes.forEach((node, index) => {
      nextPositions.set(node.id, {
        x: 120 + (index % 3) * 280,
        y: 460 + Math.floor(index / 3) * 140
      });
    });

    onChange({
      ...graph,
      nodes: graph.nodes.map((node) => {
        const position = nextPositions.get(node.id);
        return position ? writeWorkflowNodeCanvasPosition(node, position) : node;
      })
    });
    message.success('已整理节点位置，连线保持不变');
  }

  function updateToolNodeToolId(node: RoleWorkflowGraphNode, toolId?: string) {
    if (!toolId) {
      updateNode(node.id, {
        toolId: undefined,
        config: undefined
      });
      return;
    }

    const nextArtifactType =
      node.type === 'artifact'
        ? toolId === 'video-processing'
          ? 'mp4'
          : node.artifactType === 'mp4'
            ? 'docx'
            : node.artifactType
        : node.artifactType;
    const template = node.type === 'artifact'
      ? getDefaultArtifactActionTemplateForCanvas(nextArtifactType) ?? getDefaultToolActionTemplateForCanvas(toolId)
      : getDefaultToolActionTemplateForCanvas(toolId);
    updateNode(node.id, {
      toolId: template?.toolId ?? toolId,
      artifactType: nextArtifactType,
      config: template
        ? buildToolNodeConfig(node, {
            toolActionAssetKey: template.value,
            action: template.value,
            input: mergeWorkflowToolInputDefaults(template.defaults, readWorkflowToolInputConfig(node))
          })
        : node.config
    });
  }

  function updateToolNodeAction(node: RoleWorkflowGraphNode, action: string) {
    const template = getSelectedToolActionTemplateForCanvas(node.toolId, action);
    updateNode(node.id, {
      config: buildToolNodeConfig(node, {
        toolActionAssetKey: template?.value ?? action,
        action: template?.value ?? action,
        input: mergeWorkflowToolInputDefaults(template?.defaults, readWorkflowToolInputConfig(node))
      })
    });
  }

  function updateModelNodeAsset(node: RoleWorkflowGraphNode, assetKey?: string) {
    if (!assetKey) {
      updateNode(node.id, {
        modelProfileId: undefined,
        config: {
          ...(node.config ?? {}),
          modelAssetKey: undefined,
          modelProviderId: undefined,
          modelId: undefined
        }
      });
      return;
    }

    const asset = modelAssets.find((item) => item.key === assetKey);
    if (!asset) {
      updateNode(node.id, {
        modelProfileId: assetKey,
        config: {
          ...(node.config ?? {}),
          modelAssetKey: undefined,
          modelProviderId: undefined,
          modelId: assetKey
        }
      });
      return;
    }

    const modelId = readAssetSchemaString(asset, 'modelId') ?? assetKey;
    const modelProfileId = readAssetSchemaString(asset, 'modelProfileId') ?? modelId;
    updateNode(node.id, {
      modelProfileId,
      config: {
        ...(node.config ?? {}),
        modelAssetKey: asset.key,
        modelProviderId: readAssetSchemaString(asset, 'providerId'),
        modelId
      }
    });
  }

  function updateToolNodeActionAsset(node: RoleWorkflowGraphNode, assetKey?: string) {
    if (!assetKey) {
      updateNode(node.id, {
        config: {
          ...(node.config ?? {}),
          toolActionAssetKey: undefined,
          action: undefined
        }
      });
      return;
    }

    const asset = toolActionAssets.find((item) => item.key === assetKey);
    const actionId = readAssetSchemaString(asset, 'actionId') ?? assetKey;
    const action = toolCatalog.actions.find((item) => item.actionId === actionId);
    const packageId = readAssetSchemaString(asset, 'packageId') ?? action?.packageId ?? node.toolId;
    updateNode(node.id, {
      toolId: packageId,
      config: buildToolNodeConfig(node, {
        toolActionAssetKey: asset?.key ?? actionId,
        action: actionId,
        input: mergeWorkflowToolInputDefaults(
          action?.defaultInput ?? readAssetDefaultsRecord(asset),
          readWorkflowToolInputConfig(node)
        )
      })
    });
  }

  function updateArtifactTemplateAsset(node: RoleWorkflowGraphNode, assetKey?: string) {
    if (!assetKey) {
      updateNode(node.id, {
        config: {
          ...(node.config ?? {}),
          artifactTemplateAssetKey: undefined
        }
      });
      return;
    }

    const asset = artifactTemplateAssets.find((item) => item.key === assetKey);
    const artifactType = readAssetSchemaString(asset, 'artifactType') as WorkflowArtifactType | undefined;
    const actionId = readAssetSchemaString(asset, 'toolActionId');
    const action = actionId ? toolCatalog.actions.find((item) => item.actionId === actionId) : undefined;
    const template = action
      ? getSelectedToolActionTemplateForCanvas(action.packageId, action.actionId)
      : getDefaultArtifactActionTemplateForCanvas(artifactType ?? node.artifactType);
    const inputVariables = readAssetSchemaStringArray(asset, 'inputVariables');
    const fileNamePattern = readAssetSchemaString(asset, 'fileNamePattern');
    const nextInput = {
      ...mergeWorkflowToolInputDefaults(template?.defaults, readWorkflowToolInputConfig(node)),
      ...(fileNamePattern ? { fileName: fileNamePattern, title: fileNamePattern } : {})
    };

    updateNode(node.id, {
      artifactType: artifactType ?? node.artifactType,
      toolId: template?.toolId ?? action?.packageId ?? node.toolId,
      inputVariables: inputVariables.length ? uniqueTags([...(node.inputVariables ?? []), ...inputVariables]) : node.inputVariables,
      config: buildToolNodeConfig(node, {
        artifactTemplateAssetKey: asset?.key ?? assetKey,
        toolActionAssetKey: action?.actionId ?? actionId ?? readWorkflowConfigString(node.config, 'toolActionAssetKey'),
        action: template?.value ?? actionId ?? readWorkflowConfigString(node.config, 'action'),
        input: nextInput
      })
    });
  }

  function updateToolNodeField(node: RoleWorkflowGraphNode, key: string, value: unknown) {
    const currentConfig = node.config ?? {};
    const currentInput =
      currentConfig.input && typeof currentConfig.input === 'object' && !Array.isArray(currentConfig.input)
        ? (currentConfig.input as Record<string, unknown>)
        : {};
    updateNode(node.id, {
      config: buildToolNodeConfig(node, {
        ...currentConfig,
        input: {
          ...currentInput,
          [key]: value
        }
      })
    });
  }

  function updateNodeConfigField(node: RoleWorkflowGraphNode, key: string, value: unknown) {
    updateNode(node.id, {
      config: {
        ...(node.config ?? {}),
        [key]: value
      }
    });
  }

  function updateDataProcessingMode(node: RoleWorkflowGraphNode, mode: WorkflowDataMode) {
    if (mode === 'assign') {
      const outputVariable = node.outputVariables?.[0] ?? `${node.id}.value`;
      updateNode(node.id, {
        type: 'data',
        name: node.name === defaultNodeNames[node.type] ? defaultNodeNames.data : node.name,
        outputVariables: [outputVariable],
        config: {
          dataMode: mode,
          assignments: [
            {
              name: outputVariable,
              value: '$runtime.previous_text'
            }
          ]
        }
      });
      return;
    }

    if (mode === 'template') {
      updateNode(node.id, {
        type: 'data',
        name: node.name === defaultNodeNames[node.type] ? defaultNodeNames.data : node.name,
        outputVariables: [`${node.id}.text`],
        config: {
          dataMode: mode,
          template: '{{runtime.previous_text}}'
        }
      });
      return;
    }

    updateNode(node.id, {
      type: 'data',
      name: node.name === defaultNodeNames[node.type] ? defaultNodeNames.data : node.name,
      outputVariables: [`${node.id}.json`],
      config: {
        dataMode: mode,
        code: [
          'const text = input.runtime?.previous_text || input.start?.text || "";',
          'return {',
          '  text,',
          "  rows: [['项目', '内容'], ['输入', text]]",
          '};'
        ].join('\n'),
        outputVariable: `${node.id}.json`,
        timeoutMs: 2_000
      }
    });
  }

  function updateAssignNodeConfig(node: RoleWorkflowGraphNode, name: string, value: string) {
    const nextName = name.trim();
    updateNode(node.id, {
      outputVariables: nextName ? [nextName] : node.outputVariables,
      config: {
        ...(node.config ?? {}),
        assignments: [
          {
            name: nextName || `${node.id}.value`,
            value
          }
        ]
      }
    });
  }

  function updateAssignTableMapping(
    node: RoleWorkflowGraphNode,
    patch: Partial<{
      sourceRef: string;
      outputVariable: string;
      columns: WorkflowTableColumnConfig[];
    }>
  ) {
    const current = readWorkflowAssignTableMappingConfig(node);
    const nextSourceRef = patch.sourceRef ?? current.sourceRef;
    const nextOutputVariable = (patch.outputVariable ?? current.outputVariable).trim() || `${node.id}.rows`;
    const nextColumns = patch.columns ?? current.columns;
    updateNode(node.id, {
      inputVariables: nextSourceRef ? uniqueTags([...(node.inputVariables ?? []), nextSourceRef]) : node.inputVariables,
      outputVariables: uniqueTags([nextOutputVariable]),
      config: {
        ...(node.config ?? {}),
        tableMapping: {
          sourceRef: nextSourceRef ?? '',
          outputVariable: nextOutputVariable,
          columns: nextColumns.length ? nextColumns : defaultWorkflowTableColumns
        }
      }
    });
  }

  function updateCodeNodeConfig(
    node: RoleWorkflowGraphNode,
    patch: Partial<{
      code: string;
      outputVariable: string;
      timeoutMs: number;
    }>
  ) {
    const currentOutputVariable = typeof node.config?.outputVariable === 'string' && node.config.outputVariable.trim()
      ? node.config.outputVariable.trim()
      : node.outputVariables?.[0] ?? `${node.id}.json`;
    const nextOutputVariable = (patch.outputVariable ?? currentOutputVariable).trim() || `${node.id}.json`;
    updateNode(node.id, {
      outputVariables: uniqueTags([nextOutputVariable]),
      config: {
        ...(node.config ?? {}),
        code: patch.code ?? (typeof node.config?.code === 'string' ? node.config.code : ''),
        outputVariable: nextOutputVariable,
        timeoutMs: patch.timeoutMs ?? (typeof node.config?.timeoutMs === 'number' ? node.config.timeoutMs : 2_000)
      }
    });
  }

  async function previewCodeNode(node: RoleWorkflowGraphNode) {
    const runtimeInput = buildWorkflowCodePreviewInput(node, variableOptions);
    const timeoutMs = typeof node.config?.timeoutMs === 'number' ? node.config.timeoutMs : 2_000;
    setRunningCodePreviewNodeId(node.id);
    setCodePreviewResults((current) => ({
      ...current,
      [node.id]: {
        status: 'passed',
        inputPreview: stringifyJsonConfigValue(runtimeInput),
        outputPreview: '试算中...'
      }
    }));

    try {
      const result = await runWorkflowCodePreview({
        code: typeof node.config?.code === 'string' ? node.config.code : '',
        runtimeInput,
        timeoutMs
      });
      setCodePreviewResults((current) => ({
        ...current,
        [node.id]: {
          status: 'passed',
          inputPreview: stringifyJsonConfigValue(runtimeInput),
          outputPreview: stringifyJsonConfigValue(result)
        }
      }));
      message.success('代码节点试算通过');
    } catch (error) {
      setCodePreviewResults((current) => ({
        ...current,
        [node.id]: {
          status: 'failed',
          inputPreview: stringifyJsonConfigValue(runtimeInput),
          outputPreview: '',
          error: error instanceof Error ? error.message : '代码试算失败'
        }
      }));
    } finally {
      setRunningCodePreviewNodeId(null);
    }
  }

  function updateModelOutputMode(node: RoleWorkflowGraphNode, outputMode: WorkflowModelOutputMode) {
    const schema = readWorkflowModelSchema(node);
    const nextConfig = {
      ...(node.config ?? {}),
      outputMode,
      ...(outputMode === 'json' && (!schema || (typeof schema === 'object' && Object.keys(schema).length === 0))
        ? { schema: defaultWorkflowModelSchema(node) }
        : {})
    };
    updateNode(node.id, {
      config: nextConfig,
      outputVariables:
        node.type === 'llm' ? [`${node.id}.${outputMode === 'json' ? 'json' : 'text'}`] : node.outputVariables
    });
  }

  function updateLlmTaskType(node: RoleWorkflowGraphNode, taskType: WorkflowLlmTaskType) {
    const taskOption = readWorkflowLlmTaskOption(taskType);
    const nextOutputMode = taskOption.defaultOutputMode;
    const schema = readWorkflowModelSchema(node);
    const nextNode: RoleWorkflowGraphNode = {
      ...node,
      config: {
        ...(node.config ?? {}),
        llmTaskType: taskType,
        outputMode: nextOutputMode,
        ...(nextOutputMode === 'json' && (!schema || (typeof schema === 'object' && Object.keys(schema).length === 0))
          ? { schema: defaultWorkflowModelSchema(node) }
          : {})
      }
    };
    updateNode(node.id, {
      config: nextNode.config,
      outputVariables: getWorkflowNodeDefaultOutputVariables(nextNode)
    });
  }

  function updateArtifactTableSource(node: RoleWorkflowGraphNode, sourceRef?: string) {
    const template = getDefaultArtifactActionTemplateForCanvas(node.artifactType ?? 'xlsx');
    const currentInput = readWorkflowToolInputConfig(node);
    const rows = sourceRef ? `$${sourceRef}` : currentInput.rows;
    updateNode(node.id, {
      inputVariables: sourceRef ? uniqueTags([...(node.inputVariables ?? []), sourceRef]) : node.inputVariables,
      config: buildToolNodeConfig(node, {
        toolActionAssetKey: template?.value ?? (node.artifactType === 'csv' ? 'spreadsheet.write_csv' : 'spreadsheet.write_xlsx'),
        action: template?.value ?? (node.artifactType === 'csv' ? 'spreadsheet.write_csv' : 'spreadsheet.write_xlsx'),
        input: {
          ...mergeWorkflowToolInputDefaults(template?.defaults, currentInput),
          rows
        }
      })
    });
  }

  function updateSelectedEdgeConditionType(type: WorkflowEdgeConditionType) {
    if (!selectedEdge) return;
    updateEdge(selectedEdge.id, {
      condition: type === 'always'
        ? { type: 'always' }
        : type === 'expression'
          ? { type, expression: selectedEdge.condition?.expression ?? '' }
          : {
              type,
              variable: selectedEdge.condition?.variable ?? 'start.text',
              value: selectedEdge.condition?.value ?? ''
            }
    });
  }

  function updateSelectedEdgeEndpoint(patch: Partial<Pick<WorkflowEdge, 'sourceNodeId' | 'targetNodeId'>>) {
    if (!selectedEdge) return;
    const sourceNodeId = patch.sourceNodeId ?? selectedEdge.sourceNodeId;
    const targetNodeId = patch.targetNodeId ?? selectedEdge.targetNodeId;
    const otherEdges = graph.edges.filter((edge) => edge.id !== selectedEdge.id);
    const error = validateWorkflowConnection({ ...graph, edges: otherEdges }, sourceNodeId, targetNodeId);
    if (error) {
      message.warning(error);
      return;
    }
    updateEdge(selectedEdge.id, patch);
  }

  function handlePaletteDragStart(event: ReactDragEvent<HTMLElement>, nodeType: WorkflowNodeType) {
    event.dataTransfer.setData('application/qiuai-workflow-node', nodeType);
    event.dataTransfer.effectAllowed = 'copy';
  }

  function handleCanvasDragOver(event: ReactDragEvent<HTMLElement>) {
    if (!event.dataTransfer.types.includes('application/qiuai-workflow-node')) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleCanvasDrop(event: ReactDragEvent<HTMLElement>) {
    const nodeType = event.dataTransfer.getData('application/qiuai-workflow-node') as WorkflowNodeType;
    if (!nodeType) return;
    event.preventDefault();
    addNode(nodeType, {
      mode: 'free',
      position: toFlowPosition(event)
    });
  }

  function openPaneContextMenu(event: WorkflowContextEvent) {
    event.preventDefault();
    const position = readCanvasRelativePosition(event);
    setContextMenu({
      open: true,
      type: 'pane',
      x: position.x,
      y: position.y,
      flowPosition: toFlowPosition(event)
    });
  }

  function openNodeContextMenu(event: WorkflowContextEvent, nodeId: string) {
    event.preventDefault();
    const position = readCanvasRelativePosition(event);
    setSelection({ type: 'node', id: nodeId });
    setContextMenu({
      open: true,
      type: 'node',
      x: position.x,
      y: position.y,
      nodeId
    });
  }

  function openEdgeContextMenu(event: WorkflowContextEvent, edgeId: string) {
    event.preventDefault();
    const position = readCanvasRelativePosition(event);
    setSelection({ type: 'edge', id: edgeId });
    setContextMenu({
      open: true,
      type: 'edge',
      x: position.x,
      y: position.y,
      edgeId
    });
  }

  function duplicateNode(nodeId: string) {
    const sourceNode = graph.nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;
    const sourcePosition = nodePositions.get(nodeId) ?? { x: 120, y: 180 };
    const nextNodeId = createWorkflowNodeId(sourceNode.type, graph.nodes);
    const rebaseOutputVariable = (value: string) =>
      value.startsWith(`${sourceNode.id}.`) ? `${nextNodeId}${value.slice(sourceNode.id.length)}` : value;
    const sourceConfig = sourceNode.config ?? {};
    const rebasedConfig = {
      ...sourceConfig,
      ...(typeof sourceConfig.outputVariable === 'string'
        ? { outputVariable: rebaseOutputVariable(sourceConfig.outputVariable) }
        : {}),
      ...(Array.isArray(sourceConfig.assignments)
        ? {
            assignments: sourceConfig.assignments.map((assignment) =>
              assignment && typeof assignment === 'object' && !Array.isArray(assignment)
                ? {
                    ...assignment,
                    name: typeof assignment.name === 'string' ? rebaseOutputVariable(assignment.name) : assignment.name
                  }
                : assignment
            )
          }
        : {})
    };
    const node = writeWorkflowNodeCanvasPosition(
      {
        ...sourceNode,
        id: nextNodeId,
        name: `${sourceNode.name} 副本`,
        outputVariables: sourceNode.outputVariables?.map(rebaseOutputVariable),
        config: rebasedConfig
      },
      {
        x: sourcePosition.x + 40,
        y: sourcePosition.y + 120
      }
    );
    onChange({ ...graph, nodes: [...graph.nodes, node] });
    setSelection({ type: 'node', id: node.id });
    closeContextMenu();
    message.success('已复制为自由节点');
  }

  const nodePickerTitle =
    nodePicker.mode === 'edge'
      ? '在线中插入节点'
      : nodePicker.mode === 'before'
        ? '在前面添加节点'
        : nodePicker.mode === 'after'
          ? '在后面添加节点'
          : '添加自由节点';
  const nodePickerDescription =
    nodePicker.mode === 'free'
      ? '自由节点会先放在画布上，连线后才会进入主流程并在 PC 端运行。'
      : '选择节点后会自动接入当前位置，你仍然可以拖动节点调整布局。';

  return (
    <div className="workflow-builder-shell">
      <aside className="workflow-node-palette">
        <div className="workflow-pane-heading">
          <div>
            <div className="workflow-pane-title">节点库</div>
            <Typography.Text type="secondary" className="workflow-pane-subtitle">
              拖到画布生成自由节点
            </Typography.Text>
          </div>
          <Button
            size="small"
            type="primary"
            icon={<AppstoreAddOutlined />}
            onClick={() => openNodePicker({ mode: 'free' })}
          >
            添加
          </Button>
        </div>
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          {workflowNodeCatalogGroups.map((group) => (
            <section key={group.title} className="workflow-node-group">
              <div className="workflow-node-group-title">{group.title}</div>
              {group.nodes.map((node) => (
                <Button
                  key={`${group.title}-${node.value}`}
                  block
                  className={`workflow-palette-button tone-${nodeTone(node.value)}`}
                  draggable
                  onDragStart={(event) => handlePaletteDragStart(event, node.value)}
                  onClick={() => addNode(node.value, { mode: 'free' })}
                >
                  <span>{node.label}</span>
                  <span className="workflow-palette-hint">{node.hint}</span>
                </Button>
              ))}
            </section>
          ))}
        </Space>
      </aside>

      <section
        ref={canvasShellRef}
        className="workflow-canvas-shell"
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <div className="workflow-canvas-toolbar">
          <Space>
            <Button size="small" onClick={resetLinearEdges}>
              整理布局
            </Button>
            <Button size="small" onClick={() => openNodePicker({ mode: 'free' })} icon={<PlusOutlined />}>
              添加节点
            </Button>
          </Space>
          <Typography.Text type="secondary">
            拖入节点不会自动运行；从节点右侧圆点连线后才会进入流程。
          </Typography.Text>
        </div>
        <ReactFlowProvider>
          <ReactFlow
            className="workflow-react-flow"
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={workflowNodeTypes}
            onInit={setFlowInstance}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => {
              closeContextMenu();
              setSelection({ type: 'node', id: node.id });
            }}
            onEdgeClick={(_, edge) => {
              closeContextMenu();
              setSelection({ type: 'edge', id: edge.id });
            }}
            onPaneClick={closeContextMenu}
            onPaneContextMenu={openPaneContextMenu}
            onNodeContextMenu={(event, node) => openNodeContextMenu(event, node.id)}
            onEdgeContextMenu={(event, edge) => openEdgeContextMenu(event, edge.id)}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.25}
            maxZoom={1.4}
            nodesDraggable
            nodesConnectable
            elementsSelectable
            deleteKeyCode={['Backspace', 'Delete']}
          >
            <Background gap={20} size={1} color="#e5e7eb" />
            <Controls position="bottom-left" />
            <MiniMap
              position="bottom-right"
              pannable
              zoomable
              nodeColor={(node) => {
                const tone = (node as WorkflowFlowNode).data.tone;
                if (tone === 'blue') return '#1677ff';
                if (tone === 'green') return '#16a34a';
                if (tone === 'purple') return '#7c3aed';
                if (tone === 'gold') return '#d97706';
                return '#64748b';
              }}
            />
          </ReactFlow>
        </ReactFlowProvider>
        {contextMenu.open ? (
          <div
            className="workflow-context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(event) => event.stopPropagation()}
          >
            {contextMenu.type === 'pane' ? (
              <>
                <button
                  type="button"
                  onClick={() =>
                    openNodePicker({
                      mode: 'free',
                      position: contextMenu.flowPosition
                    })
                  }
                >
                  添加自由节点
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetLinearEdges();
                    closeContextMenu();
                  }}
                >
                  整理布局
                </button>
              </>
            ) : null}
            {contextMenu.type === 'node' && contextMenu.nodeId ? (
              <>
                <button type="button" onClick={() => openNodePickerBefore(contextMenu.nodeId!)}>
                  在前面添加节点
                </button>
                <button type="button" onClick={() => openNodePickerAfter(contextMenu.nodeId!)}>
                  在后面添加节点
                </button>
                <button type="button" onClick={() => duplicateNode(contextMenu.nodeId!)}>
                  复制为自由节点
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    deleteNode(contextMenu.nodeId!);
                    closeContextMenu();
                  }}
                >
                  删除节点
                </button>
              </>
            ) : null}
            {contextMenu.type === 'edge' && contextMenu.edgeId ? (
              <>
                <button type="button" onClick={() => openNodePicker({ mode: 'edge', edgeId: contextMenu.edgeId })}>
                  在线中插入节点
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    deleteEdge(contextMenu.edgeId!);
                    closeContextMenu();
                  }}
                >
                  删除连线
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      <aside className="workflow-config-panel">
        {selectedNode ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <div className="workflow-config-panel-header">
              <div className="workflow-config-panel-title-row">
                <Space wrap size={4}>
                  <Tag color={nodeTone(selectedNode.type)}>{workflowNodeTypeLabel(selectedNode.type)}</Tag>
                  {selectedNode.requiresApproval ? <Tag color="orange">需要确认</Tag> : null}
                </Space>
                <Tag color={selectedNodeWarnings.length ? 'gold' : 'green'}>
                  {selectedNodeWarnings.length ? '需配置' : '就绪'}
                </Tag>
              </div>
              <Typography.Title level={5} className="workflow-config-panel-title">
                {selectedNode.name}
              </Typography.Title>
              <Typography.Text type="secondary" className="workflow-config-panel-subtitle">
                {selectedNode.id}
              </Typography.Text>
              <div className="workflow-config-panel-tabs">
                <button
                  type="button"
                  className={configPanelTab === 'settings' ? 'active' : ''}
                  onClick={() => setConfigPanelTab('settings')}
                >
                  设置
                </button>
                <button
                  type="button"
                  className={configPanelTab === 'lastRun' ? 'active' : ''}
                  onClick={() => setConfigPanelTab('lastRun')}
                >
                  上次运行
                </button>
              </div>
            </div>
            {configPanelTab === 'lastRun' ? (
              <WorkflowNodeLastRunPanel trace={selectedNodeTrace} />
            ) : (
              <>
                {selectedNodeWarnings.length ? (
                  <Alert
                    showIcon
                    type="warning"
                    message="节点未就绪"
                    description={selectedNodeWarnings.join('；')}
                  />
                ) : null}
            <WorkflowConfigSection title="基础" description={workflowNodeConfigDescription(selectedNode)}>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Input
                  size="small"
                  value={selectedNode.name}
                  addonBefore="名称"
                  onChange={(event) => updateNode(selectedNode.id, { name: event.target.value })}
                />
                <Select
                  size="small"
                  value={selectedNode.type}
                  disabled={selectedNode.id === graph.entryNodeId}
                  options={buildWorkflowNodeTypeSelectOptions(selectedNode.type)}
                  onChange={(type) => {
                    const nextArtifactType = type === 'artifact' ? selectedNode.artifactType ?? 'docx' : selectedNode.artifactType;
                    const nextToolId =
                      type === 'tool'
                        ? selectedNode.toolId ?? serverToolOptions[0]?.value
                        : type === 'artifact'
                          ? getDefaultArtifactActionTemplateForCanvas(nextArtifactType)?.toolId ?? selectedNode.toolId
                          : selectedNode.toolId;
                    const nextToolTemplate =
                      type === 'artifact'
                        ? getDefaultArtifactActionTemplateForCanvas(nextArtifactType)
                        : getSelectedToolActionTemplateForCanvas(
                            nextToolId,
                            String(selectedNode.config?.action ?? '')
                          );

                    updateNode(selectedNode.id, {
                      type,
                      toolId: nextToolTemplate?.toolId ?? nextToolId,
                      modelProfileId:
                        type === 'llm' ? selectedNode.modelProfileId ?? 'qiu-general-default' : selectedNode.modelProfileId,
                      artifactType: nextArtifactType,
                      requiresApproval: type === 'approval' ? true : selectedNode.requiresApproval,
                      config:
                        type === 'tool' || type === 'artifact'
                          ? buildToolNodeConfig(selectedNode, {
                              action: nextToolTemplate?.value,
                              input: mergeWorkflowToolInputDefaults(
                                nextToolTemplate?.defaults,
                                readWorkflowToolInputConfig(selectedNode)
                              )
                            })
                          : type === 'data'
                            ? {
                                dataMode: 'assign',
                                assignments: [
                                  {
                                    name: selectedNode.outputVariables?.[0] ?? `${selectedNode.id}.value`,
                                    value: '$runtime.previous_text'
                                  }
                                ]
                              }
                            : type === 'llm'
                              ? {
                                  ...(selectedNode.config ?? {}),
                                  llmTaskType: readWorkflowLlmTaskType(selectedNode),
                                  outputMode: readWorkflowModelOutputMode(selectedNode)
                                }
                          : selectedNode.config
                    });
                  }}
                />
                <Input.TextArea
                  rows={4}
                  value={selectedNode.instruction ?? ''}
                  placeholder="节点执行说明"
                  onChange={(event) => updateNode(selectedNode.id, { instruction: event.target.value })}
                />
              </Space>
            </WorkflowConfigSection>
            <WorkflowVariableReferencePanel variables={variableOptions} selectedNode={selectedNode} />
            {selectedNode.type === 'list' ? (
              <WorkflowConfigSection
                title="列表筛选"
                description="从附件或上游变量中筛出一组文件/对象，例如只保留视频文件。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  size="small"
                  showSearch
                  allowClear
                  value={typeof selectedNode.config?.sourceRef === 'string' ? selectedNode.config.sourceRef : 'start.files'}
                  placeholder="来源变量"
                  optionFilterProp="label"
                  options={variableSelectOptions}
                  onChange={(sourceRef) => updateNodeConfigField(selectedNode, 'sourceRef', sourceRef ?? '')}
                />
                <Select
                  size="small"
                  allowClear
                  placeholder="文件类型筛选"
                  value={typeof selectedNode.config?.kind === 'string' && selectedNode.config.kind ? selectedNode.config.kind : undefined}
                  options={[
                    { value: 'video', label: '视频' },
                    { value: 'image', label: '图片' },
                    { value: 'document', label: '文档' },
                    { value: 'spreadsheet', label: '表格' },
                    { value: 'presentation', label: '演示稿' },
                    { value: 'audio', label: '音频' }
                  ]}
                  onChange={(kind) => updateNodeConfigField(selectedNode, 'kind', kind ?? '')}
                />
                <InputNumber
                  style={{ width: '100%' }}
                  addonBefore="最多保留"
                  value={typeof selectedNode.config?.limit === 'number' ? selectedNode.config.limit : 50}
                  onChange={(limit) => updateNodeConfigField(selectedNode, 'limit', limit ?? 50)}
                />
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'iteration' ? (
              <WorkflowConfigSection
                title="逐项处理"
                description="把列表里的当前项写入 runtime.current_item，后续工具节点通常读取这个变量。"
              >
                <Select
                  size="small"
                  showSearch
                  allowClear
                  value={typeof selectedNode.config?.sourceRef === 'string' ? selectedNode.config.sourceRef : 'start.files'}
                  placeholder="遍历列表变量"
                  optionFilterProp="label"
                  options={buildWorkflowVariableSelectOptions(variableOptions, ['asset[]', 'json', 'table'])}
                  onChange={(sourceRef) => updateNodeConfigField(selectedNode, 'sourceRef', sourceRef ?? '')}
                />
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'loop' ? (
              <WorkflowConfigSection
                title="循环限制"
                description="限制最多执行次数，避免复杂任务失控或无限循环。"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  addonBefore="最大循环"
                  value={typeof selectedNode.config?.maxIterations === 'number' ? selectedNode.config.maxIterations : 3}
                  onChange={(maxIterations) => updateNodeConfigField(selectedNode, 'maxIterations', maxIterations ?? 3)}
                />
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'aggregator' ? (
              <WorkflowConfigSection
                title="聚合方式"
                description="把多个输入变量合并后输出，常用于分支归并或多步骤结果汇总。"
              >
                <Select
                  size="small"
                  value={typeof selectedNode.config?.mode === 'string' ? selectedNode.config.mode : 'object'}
                  options={[
                    { value: 'object', label: '按变量名合并' },
                    { value: 'array', label: '按数组合并' }
                  ]}
                  onChange={(mode) => updateNodeConfigField(selectedNode, 'mode', mode)}
                />
              </WorkflowConfigSection>
            ) : null}
            {isDataProcessingNodeType(selectedNode.type) ? (
              <WorkflowConfigSection
                title="处理方式"
                description="一个数据处理节点可以做变量整理、文本拼接或代码转换。常规场景优先用变量整理和文本模板。"
              >
                <Select
                  size="small"
                  value={selectedDataMode}
                  options={[
                    { value: 'assign', label: '变量整理 / 固定值、复制变量、表格映射' },
                    { value: 'template', label: '文本模板 / 用变量拼成稳定文本' },
                    { value: 'code', label: '代码转换 / 清洗 JSON、计算字段、生成 rows' }
                  ]}
                  onChange={(mode) => updateDataProcessingMode(selectedNode, mode)}
                />
              </WorkflowConfigSection>
            ) : null}
            {selectedAssignConfig ? (
              <WorkflowConfigSection
                title="变量整理"
                description="把固定值或上游变量写成一个稳定变量，后续节点直接引用这个变量。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Input
                    size="small"
                    addonBefore="变量名"
                    value={selectedAssignConfig.name}
                    placeholder={`${selectedNode.id}.value`}
                    onChange={(event) =>
                      updateAssignNodeConfig(selectedNode, event.target.value, selectedAssignConfig.value)
                    }
                  />
                  <Input
                    size="small"
                    addonBefore="变量值"
                    value={selectedAssignConfig.value}
                    placeholder="$runtime.previous_text"
                    onChange={(event) =>
                      updateAssignNodeConfig(selectedNode, selectedAssignConfig.name, event.target.value)
                    }
                  />
                  <WorkflowVariableQuickSet
                    variables={variableOptions}
                    mode="path"
                    onPick={(token) => updateAssignNodeConfig(selectedNode, selectedAssignConfig.name, token)}
                  />
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {selectedAssignTableMapping ? (
              <WorkflowConfigSection
                title="生成表格 rows"
                description="把上游 JSON 数组映射成 Excel/CSV 可直接写入的二维表格。字段路径支持 customer.name 这类嵌套路径。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Input
                    size="small"
                    value={selectedAssignTableMapping.sourceRef}
                    addonBefore="来源变量"
                    placeholder="来源 JSON 数组，例如 extract.json.items"
                    onChange={(event) => updateAssignTableMapping(selectedNode, { sourceRef: event.target.value })}
                  />
                  <WorkflowVariableQuickSet
                    variables={variableOptions}
                    mode="path"
                    onPick={(token) => updateAssignTableMapping(selectedNode, { sourceRef: token.replace(/^\$/, '') })}
                  />
                  <Input
                    size="small"
                    addonBefore="输出变量"
                    value={selectedAssignTableMapping.outputVariable}
                    placeholder={`${selectedNode.id}.rows`}
                    onChange={(event) => updateAssignTableMapping(selectedNode, { outputVariable: event.target.value })}
                  />
                  <WorkflowTableMappingColumnsEditor
                    columns={selectedAssignTableMapping.columns}
                    onChange={(columns) => updateAssignTableMapping(selectedNode, { columns })}
                  />
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {isDataProcessingNodeType(selectedNode.type) && selectedDataMode === 'code' ? (
              <WorkflowConfigSection
                title="代码转换"
                description="只用于同步 JSON 转换。脚本里可读取 input 和 helpers，最后 return 一个 JSON 可序列化结果。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Input
                    size="small"
                    addonBefore="输出变量"
                    value={
                      typeof selectedNode.config?.outputVariable === 'string' && selectedNode.config.outputVariable.trim()
                        ? selectedNode.config.outputVariable
                        : selectedNode.outputVariables?.[0] ?? `${selectedNode.id}.json`
                    }
                    placeholder={`${selectedNode.id}.json`}
                    onChange={(event) => updateCodeNodeConfig(selectedNode, { outputVariable: event.target.value })}
                  />
                  <InputNumber
                    size="small"
                    addonBefore="超时毫秒"
                    min={100}
                    max={10000}
                    step={100}
                    style={{ width: '100%' }}
                    value={typeof selectedNode.config?.timeoutMs === 'number' ? selectedNode.config.timeoutMs : 2_000}
                    onChange={(timeoutMs) => updateCodeNodeConfig(selectedNode, { timeoutMs: timeoutMs ?? 2_000 })}
                  />
                  <Input.TextArea
                    rows={9}
                    className="workflow-code-editor"
                    value={typeof selectedNode.config?.code === 'string' ? selectedNode.config.code : ''}
                    placeholder={'const items = Array.isArray(input.items) ? input.items : [];\nreturn { rows: helpers.toRows(items, [\n  { header: "名称", path: "name" },\n  { header: "分数", path: "score" }\n]) };'}
                    onChange={(event) => updateCodeNodeConfig(selectedNode, { code: event.target.value })}
                  />
                  <Typography.Text type="secondary" className="workflow-config-section-desc">
                    可用辅助函数：helpers.pick(item, &apos;customer.name&apos;)、helpers.toRows(items, columns)。
                  </Typography.Text>
                  <Button
                    size="small"
                    icon={<PlayCircleOutlined />}
                    loading={runningCodePreviewNodeId === selectedNode.id}
                    onClick={() => previewCodeNode(selectedNode)}
                  >
                    试算代码
                  </Button>
                  <div className="workflow-code-preview-grid">
                    <div>
                      <Typography.Text strong>输入预览</Typography.Text>
                      <pre className="workflow-code-preview-box">
                        {stringifyJsonConfigValue(selectedCodePreviewInput ?? {})}
                      </pre>
                    </div>
                    <div>
                      <Typography.Text strong>输出示例</Typography.Text>
                      {selectedCodePreviewResult?.status === 'failed' ? (
                        <Alert
                          showIcon
                          type="error"
                          message="代码试算失败"
                          description={selectedCodePreviewResult.error}
                        />
                      ) : (
                        <pre className="workflow-code-preview-box">
                          {selectedCodePreviewResult?.outputPreview || '点击“试算代码”后显示输出。'}
                        </pre>
                      )}
                    </div>
                  </div>
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {isDataProcessingNodeType(selectedNode.type) && selectedDataMode === 'template' ? (
              <WorkflowConfigSection
                title="模板内容"
                description="用 {{变量}} 拼接文本，适合固定格式报告、提示词片段或工具入参。"
              >
                <Input.TextArea
                  rows={5}
                  value={typeof selectedNode.config?.template === 'string' ? selectedNode.config.template : '{{runtime.previous_text}}'}
                  placeholder="例如：视频评分：{{analyze.json.score}}"
                  onChange={(event) => updateNodeConfigField(selectedNode, 'template', event.target.value)}
                />
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'llm' ? (
              <WorkflowConfigSection
                title="LLM 大模型"
                description="先选任务类型，再选模型。系统会按模型资产能力过滤不匹配的模型。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Select
                    size="small"
                    value={selectedLlmTaskType}
                    options={llmTaskTypeOptions.map((option) => ({
                      value: option.value,
                      label: `${option.label} / ${option.description}`
                    }))}
                    onChange={(taskType) => updateLlmTaskType(selectedNode, taskType)}
                  />
                  <Select
                    size="small"
                    allowClear
                    showSearch
                    value={selectedModelAssetKey}
                    placeholder="从模型库选择具体模型"
                    options={selectedModelAssetOptions.length ? selectedModelAssetOptions : modelAssetOptions}
                    optionFilterProp="label"
                    onChange={(assetKey) => updateModelNodeAsset(selectedNode, assetKey)}
                  />
                  <Select
                    size="small"
                    value={readWorkflowModelOutputMode(selectedNode)}
                    options={modelOutputModeOptions}
                    onChange={(outputMode) => updateModelOutputMode(selectedNode, outputMode)}
                  />
                  {readWorkflowModelOutputMode(selectedNode) === 'json' ? (
                    <Input.TextArea
                      rows={5}
                      value={stringifyJsonConfigValue(readWorkflowModelSchema(selectedNode))}
                      placeholder='{"summary":"string","items":"array","risks":"string[]"}'
                      onChange={(event) =>
                        updateNodeConfigField(
                          selectedNode,
                          'schema',
                          parseJsonConfigValue(event.target.value, readWorkflowModelSchema(selectedNode) ?? {})
                        )
                      }
                    />
                  ) : null}
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'knowledge' ? (
              <WorkflowConfigSection
                title="知识来源"
                description="选择这个节点要读取的企业知识库、本地知识或服务端摘要。"
              >
                <Select
                  size="small"
                  mode="tags"
                  value={
                    Array.isArray(selectedNode.config?.sources)
                      ? selectedNode.config.sources.filter((source): source is string => typeof source === 'string')
                      : ['workspace_library']
                  }
                  placeholder="知识来源"
                  options={knowledgeOptions}
                  tokenSeparators={[',']}
                  onChange={(sources) =>
                    updateNode(selectedNode.id, {
                      config: {
                        ...(selectedNode.config ?? {}),
                        sources
                      }
                    })
                  }
                />
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'tool' || selectedNode.type === 'artifact' ? (
              <WorkflowConfigSection
                title={selectedNode.type === 'artifact' ? '产物写入动作' : '工具动作'}
                description="选择要执行的具体动作。工具包会由动作自动带出，通常不需要手动改。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Select
                    allowClear
                    showSearch
                    value={selectedToolActionAssetKey}
                    placeholder="从工具动作库选择具体动作"
                    options={toolActionAssetOptions}
                    optionFilterProp="label"
                    onChange={(assetKey) => updateToolNodeActionAsset(selectedNode, assetKey)}
                  />
                  <Typography.Text type="secondary" className="workflow-config-section-desc">
                    工具包：{selectedNode.toolId ?? '未选择'}
                  </Typography.Text>
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'artifact' ? (
              <WorkflowConfigSection
                title="产物格式"
                description="选择最终交付物格式；切到 MP4 会自动使用视频处理工具。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Select
                    size="small"
                    allowClear
                    showSearch
                    value={selectedArtifactTemplateAssetKey}
                    placeholder="从产物模板库选择"
                    options={artifactTemplateAssetOptions}
                    optionFilterProp="label"
                    onChange={(assetKey) => updateArtifactTemplateAsset(selectedNode, assetKey)}
                  />
                  <Select
                    size="small"
                    allowClear
                    value={selectedNode.artifactType}
                    placeholder="产物格式"
                    options={artifactTypeOptions}
                    onChange={(artifactType) => {
                      const nextToolTemplate = getDefaultArtifactActionTemplateForCanvas(artifactType);
                      updateNode(selectedNode.id, {
                        artifactType,
                        toolId: nextToolTemplate?.toolId ?? selectedNode.toolId,
                        config: buildToolNodeConfig(selectedNode, {
                          toolActionAssetKey: nextToolTemplate?.value,
                          action: nextToolTemplate?.value,
                          input: mergeWorkflowToolInputDefaults(
                            nextToolTemplate?.defaults,
                            readWorkflowToolInputConfig(selectedNode)
                          )
                        })
                      });
                    }}
                  />
                </Space>
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'artifact' && (selectedNode.artifactType === 'xlsx' || selectedNode.artifactType === 'csv') ? (
              <WorkflowConfigSection
                title="表格数据"
                description="Excel/CSV 最好绑定上游 JSON 数组或 rows/table 变量；这样每条记录会成为表格行。"
              >
                <Select
                  size="small"
                  showSearch
                  allowClear
                  value={selectedArtifactTableSourceRef}
                  placeholder="选择表格数据变量，例如 extract.json.rows"
                  optionFilterProp="label"
                  options={buildWorkflowVariableSelectOptions(variableOptions, ['table', 'json'])}
                  onChange={(sourceRef) => updateArtifactTableSource(selectedNode, sourceRef)}
                />
              </WorkflowConfigSection>
            ) : null}
            <details className="workflow-advanced-settings">
              <summary>高级设置</summary>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <WorkflowConfigSection
                  title="输入输出"
                  description="输入变量决定节点能读什么；输出变量决定后续节点怎么引用结果。"
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Select
                      size="small"
                      mode="tags"
                      value={selectedNode.inputVariables ?? []}
                      placeholder="输入变量，例如 start.text / start.files / 上一步输出"
                      options={variableSelectOptions}
                      optionFilterProp="label"
                      tokenSeparators={[',']}
                      onChange={(inputVariables) => updateNode(selectedNode.id, { inputVariables })}
                    />
                    <Select
                      size="small"
                      mode="tags"
                      value={selectedNode.outputVariables ?? []}
                      placeholder="输出变量，例如 analyze.json / final_video"
                      options={variableSelectOptions}
                      optionFilterProp="label"
                      tokenSeparators={[',']}
                      onChange={(outputVariables) => {
                        if (isDataProcessingNodeType(selectedNode.type) && readWorkflowDataMode(selectedNode) === 'code') {
                          updateCodeNodeConfig(selectedNode, { outputVariable: outputVariables[0] ?? `${selectedNode.id}.json` });
                          return;
                        }
                        updateNode(selectedNode.id, { outputVariables });
                      }}
                    />
                  </Space>
                </WorkflowConfigSection>
                <WorkflowConfigSection
                  title="人工确认"
                  description="高风险工具、写文件、发请求等节点可以要求用户确认后再执行。"
                >
                  <Select
                    size="small"
                    value={selectedNode.requiresApproval ? 'true' : 'false'}
                    options={[
                      { value: 'false', label: '无需人工确认' },
                      { value: 'true', label: '需要人工确认' }
                    ]}
                    onChange={(value) => updateNode(selectedNode.id, { requiresApproval: value === 'true' })}
                  />
                </WorkflowConfigSection>
              </Space>
            </details>
            {selectedNode.type === 'tool' || selectedNode.type === 'artifact' ? (
              <WorkflowConfigSection
                title={selectedNode.type === 'artifact' ? '产物写入参数' : '工具参数'}
                description="这里决定工具实际收到什么参数。支持 $变量 和 {{变量}} 引用上游输出。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  size="small"
                  value={String(
                    selectedNode.config?.action ??
                    getSelectedWorkflowNodeToolActionTemplateForCanvas(selectedNode)?.value ??
                    ''
                  )}
                  options={(serverToolActionTemplatesByToolId[selectedNode.toolId ?? ''] ?? []).map((template) => ({
                    value: template.value,
                    label: template.label
                  }))}
                  onChange={(action) => updateToolNodeAction(selectedNode, action)}
                />
                {(getSelectedWorkflowNodeToolActionTemplateForCanvas(selectedNode)?.fields ?? []).map((field) => {
                  const inputConfig =
                    selectedNode.config?.input && typeof selectedNode.config.input === 'object' && !Array.isArray(selectedNode.config.input)
                      ? (selectedNode.config.input as Record<string, unknown>)
                      : {};
                  const fieldValue = inputConfig[field.key];

                  if (field.type === 'number') {
                    return (
                      <Space key={field.key} direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Text type="secondary">{field.label}</Typography.Text>
                        <InputNumber
                          style={{ width: '100%' }}
                          value={typeof fieldValue === 'number' ? fieldValue : undefined}
                          onChange={(value) => updateToolNodeField(selectedNode, field.key, value ?? 0)}
                        />
                      </Space>
                    );
                  }

                  if (field.type === 'boolean') {
                    return (
                      <Space key={field.key} direction="vertical" size={4} style={{ width: '100%' }}>
                        <Typography.Text type="secondary">{field.label}</Typography.Text>
                        <Select
                          size="small"
                          value={fieldValue === true ? 'true' : 'false'}
                          options={[
                            { value: 'false', label: '否' },
                            { value: 'true', label: '是' }
                          ]}
                          onChange={(value) => updateToolNodeField(selectedNode, field.key, value === 'true')}
                        />
                      </Space>
                    );
                  }

                  if (field.type === 'textarea') {
                    const tokenMode = field.key.toLowerCase().includes('path') ? 'path' : 'template';
                    return (
                      <Space key={field.key} direction="vertical" size={4} style={{ width: '100%' }}>
                        <Input.TextArea
                          rows={3}
                          value={
                            field.format === 'json'
                              ? stringifyJsonConfigValue(fieldValue)
                              : typeof fieldValue === 'string'
                                ? fieldValue
                                : stringifyJsonConfigValue(fieldValue)
                          }
                          placeholder={field.placeholder}
                          onChange={(event) =>
                            updateToolNodeField(
                              selectedNode,
                              field.key,
                              field.format === 'json'
                                ? parseJsonConfigValue(event.target.value, fieldValue ?? '')
                                : event.target.value
                            )
                          }
                        />
                        <WorkflowVariableQuickSet
                          variables={variableOptions}
                          mode={tokenMode}
                          onPick={(token) => updateToolNodeField(selectedNode, field.key, token)}
                        />
                      </Space>
                    );
                  }

                  const tokenMode = field.key.toLowerCase().includes('path') ? 'path' : 'template';
                  return (
                    <Space key={field.key} direction="vertical" size={4} style={{ width: '100%' }}>
                      <Input
                        size="small"
                        value={typeof fieldValue === 'string' ? fieldValue : stringifyJsonConfigValue(fieldValue)}
                        addonBefore={field.label}
                        placeholder={field.placeholder}
                        onChange={(event) => updateToolNodeField(selectedNode, field.key, event.target.value)}
                      />
                      <WorkflowVariableQuickSet
                        variables={variableOptions}
                        mode={tokenMode}
                        onPick={(token) => updateToolNodeField(selectedNode, field.key, token)}
                      />
                    </Space>
                  );
                })}
                </Space>
              </WorkflowConfigSection>
            ) : null}
            <Button
              danger
              size="small"
              icon={<DeleteOutlined />}
              disabled={selectedNode.id === graph.entryNodeId}
              onClick={() => deleteNode(selectedNode.id)}
            >
              删除节点
            </Button>
              </>
            )}
          </Space>
        ) : null}

        {selectedEdge ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="cyan">edge</Tag>
              <Tag>{formatConditionLabel(selectedEdge.condition)}</Tag>
            </Space>
            <WorkflowConfigSection
              title="连接关系"
              description="修改这条线从哪个节点出发、进入哪个节点。"
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  size="small"
                  value={selectedEdge.sourceNodeId}
                  options={nodeOptions}
                  onChange={(sourceNodeId) => updateSelectedEdgeEndpoint({ sourceNodeId })}
                />
                <Select
                  size="small"
                  value={selectedEdge.targetNodeId}
                  options={nodeOptions}
                  onChange={(targetNodeId) => updateSelectedEdgeEndpoint({ targetNodeId })}
                />
              </Space>
            </WorkflowConfigSection>
            <WorkflowConfigSection
              title="通过条件"
              description="默认始终通过；需要分支时选择变量存在、等于、包含或表达式。"
            >
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Select
                  size="small"
                  value={selectedEdge.condition?.type ?? 'always'}
                  options={conditionTypeOptions}
                  onChange={updateSelectedEdgeConditionType}
                />
                {selectedEdge.condition?.type && selectedEdge.condition.type !== 'always' && selectedEdge.condition.type !== 'expression' ? (
                  <>
                    <Select
                      size="small"
                      showSearch
                      allowClear
                      value={selectedEdge.condition.variable ?? undefined}
                      placeholder="选择变量"
                      optionFilterProp="label"
                      options={variableSelectOptions}
                      onChange={(variable) =>
                        updateEdge(selectedEdge.id, {
                          condition: {
                            ...selectedEdge.condition,
                            type: selectedEdge.condition?.type ?? 'exists',
                            variable
                          }
                        })
                      }
                    />
                    {selectedEdge.condition.type !== 'exists' ? (
                      <Input
                        size="small"
                        value={normalizeConditionValue(selectedEdge.condition.value)}
                        addonBefore="值"
                        onChange={(event) =>
                          updateEdge(selectedEdge.id, {
                            condition: {
                              ...selectedEdge.condition,
                              type: selectedEdge.condition?.type ?? 'equals',
                              value: event.target.value
                            }
                          })
                        }
                      />
                    ) : null}
                  </>
                ) : null}
                {selectedEdge.condition?.type === 'expression' ? (
                  <Input.TextArea
                    rows={3}
                    value={selectedEdge.condition.expression ?? ''}
                    placeholder="例如：让模型判断是否需要进入合同审查分支"
                    onChange={(event) =>
                      updateEdge(selectedEdge.id, {
                        condition: {
                          type: 'expression',
                          expression: event.target.value
                        }
                      })
                    }
                  />
                ) : null}
              </Space>
            </WorkflowConfigSection>
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => deleteEdge(selectedEdge.id)}>
              删除连线
            </Button>
            <Button size="small" icon={<PlusOutlined />} onClick={() => openNodePicker({ mode: 'edge', edgeId: selectedEdge.id })}>
              在连线中插入节点
            </Button>
          </Space>
        ) : null}

        <Typography.Text type="secondary" className="workflow-config-note">
          选择节点编辑参数；选择连线编辑条件或插入节点。
        </Typography.Text>
      </aside>

      <Modal
        title={nodePickerTitle}
        open={nodePicker.open}
        width={720}
        footer={null}
        onCancel={closeNodePicker}
      >
        <div className="workflow-node-picker">
          <Alert showIcon type="info" message={nodePickerDescription} />
          {workflowNodeCatalogGroups.map((group) => (
            <section key={group.title} className="workflow-node-picker-group">
              <Space direction="vertical" size={4}>
                <Typography.Text strong>{group.title}</Typography.Text>
                <Typography.Text type="secondary">{group.description}</Typography.Text>
              </Space>
              <div className="workflow-node-picker-grid">
                {group.nodes.map((node) => (
                  <button
                    key={`${group.title}-${node.value}`}
                    type="button"
                    className="workflow-node-picker-option"
                    onClick={() => addNode(node.value)}
                  >
                    <span>{node.label}</span>
                    <small>{node.hint}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </Modal>
    </div>
  );
}


function buildPayload(
  values: CreateRoleTemplateFormValues,
  workflowGraph: RoleWorkflowGraph
): CreateAdminRoleTemplateRequest {
  const normalizedWorkflowGraph = normalizeWorkflowGraphForCanvas(workflowGraph);
  const workflowSteps = deriveWorkflowStepsFromGraph(normalizedWorkflowGraph);
  const inferredTools = workflowSteps.flatMap((step) => step.toolIds ?? []);

  return {
    id: values.id.trim(),
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: deriveWorkflowKnowledgeSources(normalizedWorkflowGraph),
    tools: uniqueTags([...inferredTools, ...readWorkflowGraphToolIds(normalizedWorkflowGraph)]),
    skills: deriveWorkflowSkills(normalizedWorkflowGraph),
    workflowSteps,
    workflowGraph: normalizedWorkflowGraph,
    sampleInputs: uniqueTags(values.sampleInputs),
    outputFormat: values.outputFormat?.trim(),
    approvalPolicy: values.approvalPolicy.trim(),
    status: 'DRAFT',
    allowedPlanCodes: uniqueTags(values.allowedPlanCodes),
    visibleWorkspaceIds: uniqueTags(values.visibleWorkspaceIds)
  };
}

function buildUpdatePayload(
  values: CreateRoleTemplateFormValues,
  workflowGraph: RoleWorkflowGraph
): UpdateAdminRoleTemplateRequest {
  const normalizedWorkflowGraph = normalizeWorkflowGraphForCanvas(workflowGraph);
  const workflowSteps = deriveWorkflowStepsFromGraph(normalizedWorkflowGraph);
  const inferredTools = workflowSteps.flatMap((step) => step.toolIds ?? []);

  return {
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: deriveWorkflowKnowledgeSources(normalizedWorkflowGraph),
    tools: uniqueTags([...inferredTools, ...readWorkflowGraphToolIds(normalizedWorkflowGraph)]),
    skills: deriveWorkflowSkills(normalizedWorkflowGraph),
    workflowSteps,
    workflowGraph: normalizedWorkflowGraph,
    sampleInputs: uniqueTags(values.sampleInputs),
    outputFormat: values.outputFormat?.trim(),
    approvalPolicy: values.approvalPolicy.trim(),
    allowedPlanCodes: uniqueTags(values.allowedPlanCodes),
    visibleWorkspaceIds: uniqueTags(values.visibleWorkspaceIds)
  };
}

function inferInitialPreset(template?: AdminRoleTemplateDetail): WorkflowPreset {
  const text = [
    template?.id,
    template?.name,
    template?.scenario,
    ...(template?.tools ?? []),
    ...(template?.workflowSteps.flatMap((step) => [step.id, step.name, step.instruction, ...(step.toolIds ?? [])]) ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('web-search') || text.includes('research') || text.includes('调研')) {
    return 'research';
  }
  if (text.includes('file') || text.includes('document') || text.includes('文档') || text.includes('附件')) {
    return 'document';
  }
  return 'standard';
}

export function AdminCreateRoleTemplatePageClient({
  currentAccount,
  templates,
  plans,
  workspaces,
  toolCatalog,
  assets,
  templateId
}: AdminCreateRoleTemplatePageClientProps) {
  const router = useRouter();
  const [form] = Form.useForm<CreateRoleTemplateFormValues>();
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | undefined>(templateId);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<TemplateTestResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(!templateId);
  const [testOpen, setTestOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates]
  );
  const watchedName = Form.useWatch('name', form);
  const watchedIndustry = Form.useWatch('industry', form);
  const persistedTemplateId = savedTemplateId ?? editingTemplate?.id;
  const initialGraph = useMemo(
    () => normalizeWorkflowGraphForCanvas(editingTemplate?.workflowGraph ?? createBlankWorkflowGraph()),
    [editingTemplate]
  );
  const [editableGraph, setEditableGraph] = useState<RoleWorkflowGraph>(initialGraph);
  const capabilitySummary = useMemo(
    () => deriveWorkflowCapabilitySummary(editableGraph),
    [editableGraph]
  );
  const nodeWarningCount = useMemo(
    () => deriveWorkflowNodeWarningCount(editableGraph),
    [editableGraph]
  );
  const traceSummary = useMemo(
    () => deriveWorkflowTraceSummary(testResult),
    [testResult]
  );

  const activePlans = useMemo(
    () => plans.filter((plan) => plan.status === 'ACTIVE'),
    [plans]
  );

  const activeEnterprisePlans = useMemo(
    () => activePlans.filter((plan) => plan.billingCycle !== 'FREE'),
    [activePlans]
  );
  const defaultPlanCode = activeEnterprisePlans[0]?.code ?? activePlans[0]?.code ?? '';

  const activePlanCodes = useMemo(
    () => new Set(activePlans.map((plan) => plan.code)),
    [activePlans]
  );

  const planOptions = useMemo(
    () => activePlans.map((plan) => ({ value: plan.code, label: `${plan.name} / ${plan.code}` })),
    [activePlans]
  );

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        value: workspace.id,
        label: `${workspace.name} / ${workspace.ownerEmail}`
      })),
    [workspaces]
  );

  const initialValues = useMemo<CreateRoleTemplateFormValues>(() => {
    if (editingTemplate) {
      return {
        id: editingTemplate.id,
        version: editingTemplate.version,
        name: editingTemplate.name,
        industry: editingTemplate.industry,
        scenario: editingTemplate.scenario,
        description: editingTemplate.description,
        businessGoal: editingTemplate.businessGoal,
        recommendedPlanCode: activePlanCodes.has(editingTemplate.recommendedPlanCode)
          ? editingTemplate.recommendedPlanCode
          : defaultPlanCode,
        approvalPolicy: editingTemplate.approvalPolicy,
        outputFormat: editingTemplate.outputFormat,
        workflowPreset: inferInitialPreset(editingTemplate),
        knowledgeSources: editingTemplate.knowledgeSources,
        tools: editingTemplate.tools,
        skills: editingTemplate.skills,
        sampleInputs: editingTemplate.sampleInputs,
        allowedPlanCodes: editingTemplate.allowedPlanCodes.filter((code) => activePlanCodes.has(code)),
        visibleWorkspaceIds: editingTemplate.visibleWorkspaceIds
      };
    }

    return {
      id: `template_custom_${Date.now()}`,
      version: '1.0.0',
      workflowPreset: 'standard',
      recommendedPlanCode: defaultPlanCode,
      allowedPlanCodes: activeEnterprisePlans.map((plan) => plan.code),
      knowledgeSources: ['workspace_library', 'local_folder'],
      tools: ['office-document', 'local-filesystem'],
      skills: [
        { code: 'task_analysis', name: '任务分析', summary: '拆解目标、输入、约束和交付要求。' },
        { code: 'deliverable_generation', name: '产物生成', summary: '生成可下载、可复用的业务产物。' }
      ],
      outputFormat: '对话摘要 + 可下载的业务文档/表格/演示稿。',
      approvalPolicy: '涉及对外发布、合同、财务、医疗、法律或重大经营决策时必须人工确认。'
    } as CreateRoleTemplateFormValues;
  }, [activeEnterprisePlans, activePlanCodes, defaultPlanCode, editingTemplate]);

  useEffect(() => {
    setEditableGraph(initialGraph);
  }, [initialGraph]);

  useEffect(() => {
    setSavedTemplateId(templateId);
  }, [templateId]);

  useEffect(() => {
    setTestInput(editingTemplate?.sampleInputs[0] ?? editingTemplate?.businessGoal ?? '');
    setTestResult(null);
  }, [editingTemplate]);

  function applyWorkflowPreset(preset: WorkflowPreset) {
    setEditableGraph(normalizeWorkflowGraphForCanvas(createWorkflowGraph(preset)));
    form.setFieldValue('workflowPreset', preset);
    setPresetPickerOpen(false);
    setTestResult(null);
    message.success('已应用模板，可以继续拖拽节点调整');
  }

  async function persistTemplateDraft(
    apiClient: ReturnType<typeof createBrowserApiClient>,
    values: CreateRoleTemplateFormValues
  ) {
    const currentTemplateId = savedTemplateId ?? editingTemplate?.id;
    return currentTemplateId
      ? apiClient.updateAdminRoleTemplate(currentTemplateId, buildUpdatePayload(values, editableGraph))
      : apiClient.createAdminRoleTemplate(buildPayload(values, editableGraph));
  }

  function readFormValues(values?: Partial<CreateRoleTemplateFormValues>): CreateRoleTemplateFormValues {
    const resolvedValues = {
      ...initialValues,
      ...form.getFieldsValue(true),
      ...values
    } as CreateRoleTemplateFormValues;

    return {
      ...resolvedValues,
      recommendedPlanCode: activePlanCodes.has(resolvedValues.recommendedPlanCode)
        ? resolvedValues.recommendedPlanCode
        : defaultPlanCode,
      allowedPlanCodes: uniqueTags(resolvedValues.allowedPlanCodes).filter((code) => activePlanCodes.has(code))
    };
  }

  async function handleSave(values: CreateRoleTemplateFormValues) {
    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const wasUpdate = Boolean(savedTemplateId ?? editingTemplate?.id);
      const response = await persistTemplateDraft(apiClient, readFormValues(values));
      setSavedTemplateId(response.data.id);
      message.success(wasUpdate ? '工作画布已保存' : '数字员工草稿已创建');
      router.push(`/templates?${wasUpdate ? 'updated' : 'created'}=${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  function useFirstSampleInput() {
    const values = readFormValues();
    const sampleInput = uniqueTags(values.sampleInputs)[0] ?? values.businessGoal?.trim();
    if (!sampleInput) {
      message.warning('请先填写测试样例或业务目标');
      return;
    }
    setTestInput(sampleInput);
  }

  async function handleSaveAndTest() {
    setTestOpen(true);
    setTesting(true);
    setTestResult(null);
    try {
      const values = await form.validateFields();
      const apiClient = createBrowserApiClient();
      const resolvedValues = readFormValues(values);
      const response = await persistTemplateDraft(apiClient, resolvedValues);
      setSavedTemplateId(response.data.id);
      const sampleInput = testInput.trim() || uniqueTags(resolvedValues.sampleInputs)[0] || resolvedValues.businessGoal.trim();
      if (sampleInput) {
        setTestInput(sampleInput);
      }
      const testResponse = await apiClient.testAdminRoleTemplate(response.data.id, { sampleInput });
      setTestResult(testResponse.data);
      message.success(testResponse.data.valid ? '测试通过' : '测试未通过');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '测试失败');
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveAndPublish() {
    setPublishing(true);
    try {
      const values = await form.validateFields();
      const apiClient = createBrowserApiClient();
      const response = await persistTemplateDraft(apiClient, readFormValues(values));
      setSavedTemplateId(response.data.id);
      await apiClient.publishAdminRoleTemplate(response.data.id);
      setPublishOpen(false);
      message.success('数字员工已保存并上架');
      router.push(`/templates?published=${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        message.error(error.message);
      } else {
        message.error('发布失败，请检查基础信息和发布范围');
      }
    } finally {
      setPublishing(false);
    }
  }

  function handleFormFinishFailed() {
    setSettingsOpen(true);
    message.warning('请先补全员工基础信息');
  }

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="工作画布"
        description={editingTemplate ? `编辑：${editingTemplate.name}` : '创建一个可测试、可上架、可被 PC 端同步安装的数字员工模板。'}
        actions={
          <Space>
            <Button icon={<ArrowLeftOutlined />} href="/templates">
              返回列表
            </Button>
            <Button icon={<SettingOutlined />} onClick={() => setSettingsOpen(true)}>
              员工设置
            </Button>
            <Button icon={<PlayCircleOutlined />} loading={testing} onClick={() => setTestOpen(true)}>
              试运行
            </Button>
            <Button icon={<RocketOutlined />} loading={publishing} onClick={() => setPublishOpen(true)}>
              发布
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>
              {editingTemplate ? '保存画布' : '保存草稿'}
            </Button>
          </Space>
        }
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          onFinishFailed={handleFormFinishFailed}
          initialValues={initialValues}
        >
          <section className="workflow-studio-shell">
            <div className="workflow-studio-topbar">
              <Space direction="vertical" size={2}>
                <Space wrap>
                  <Typography.Text strong>{watchedName || editingTemplate?.name || '未命名数字员工'}</Typography.Text>
                  <Tag color={editingTemplate?.status === 'PUBLISHED' ? 'green' : 'blue'}>
                    {editingTemplate?.status ?? 'DRAFT'}
                  </Tag>
                  {watchedIndustry ? <Tag>{watchedIndustry}</Tag> : null}
                </Space>
                <Typography.Text type="secondary">
                  {capabilitySummary.nodeCount} 个节点 / {capabilitySummary.edgeCount} 条连线，能力从画布节点自动识别。
                </Typography.Text>
              </Space>
              <Space wrap className="workflow-studio-status">
                <Tag color={nodeWarningCount ? 'gold' : 'green'}>
                  节点配置 {nodeWarningCount ? `${nodeWarningCount} 个提示` : '就绪'}
                </Tag>
                {traceSummary ? (
                  <Tag color={traceSummary.failed ? 'red' : traceSummary.warning ? 'gold' : 'green'}>
                    试运行 通过 {traceSummary.passed} / 警告 {traceSummary.warning} / 失败 {traceSummary.failed}
                  </Tag>
                ) : (
                  <Tag>未试运行</Tag>
                )}
                <Tag color="blue">手动保存</Tag>
                <Button size="small" icon={<AppstoreAddOutlined />} onClick={() => setPresetPickerOpen(true)}>
                  选择模板
                </Button>
              </Space>
            </div>

            <div className="workflow-capability-strip">
              <Tag color="blue">模型 {capabilitySummary.modelProfileIds.length || 0}</Tag>
              <Tag color="purple">工具 {capabilitySummary.toolIds.length || 0}</Tag>
              <Tag color="green">知识 {capabilitySummary.knowledgeSources.length || 0}</Tag>
              <Tag color="gold">产物 {capabilitySummary.artifactTypes.length || 0}</Tag>
              {capabilitySummary.approvalRequired ? <Tag color="orange">需要人工确认</Tag> : null}
              {capabilitySummary.warnings.map((warning) => (
                <Tag key={warning} color="red">{warning}</Tag>
              ))}
            </div>

            <WorkflowReactFlowEditor
              graph={editableGraph}
              onChange={setEditableGraph}
              testGraphTrace={testResult?.graphTrace}
              toolCatalog={toolCatalog}
              assets={assets}
            />
          </section>

          <Modal
            title="选择模板"
            open={presetPickerOpen}
            width={720}
            footer={null}
            onCancel={() => setPresetPickerOpen(false)}
          >
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="模板只在你主动选择时应用"
                description="应用模板会替换当前画布。新建数字员工默认从空白画布开始，你也可以直接拖拽节点自己搭建。"
              />
              <div className="workflow-preset-picker-grid">
                {workflowPresetOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="workflow-preset-picker-option"
                    onClick={() => applyWorkflowPreset(option.value)}
                  >
                    <span>{option.label}</span>
                    <small>{option.description}</small>
                    <b>使用这个模板</b>
                  </button>
                ))}
              </div>
            </Space>
          </Modal>

          <Drawer
            title="员工设置"
            placement="right"
            width={520}
            open={settingsOpen}
            forceRender
            onClose={() => setSettingsOpen(false)}
            extra={
              <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>
                保存
              </Button>
            }
          >
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <section>
                <Typography.Title level={5}>基础信息</Typography.Title>
                <div className="workflow-form-grid two">
                  <Form.Item name="id" label="员工 ID" rules={[{ required: true, message: '请输入员工 ID' }]}>
                    <Input disabled={Boolean(persistedTemplateId)} placeholder="template_sales_assistant" />
                  </Form.Item>
                  <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
                    <Input placeholder="1.0.0" />
                  </Form.Item>
                </div>
                <div className="workflow-form-grid two">
                  <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                    <Input placeholder="AI 销售助理" />
                  </Form.Item>
                  <Form.Item name="industry" label="行业/部门" rules={[{ required: true, message: '请输入行业或部门' }]}>
                    <Input placeholder="销售支持" />
                  </Form.Item>
                </div>
                <Form.Item name="scenario" label="使用场景" rules={[{ required: true, message: '请输入使用场景' }]}>
                  <Input placeholder="线索调研、客户跟进、方案草拟" />
                </Form.Item>
                <Form.Item name="description" label="说明" rules={[{ required: true, message: '请输入说明' }]}>
                  <Input.TextArea rows={3} />
                </Form.Item>
                <Form.Item name="businessGoal" label="业务目标" rules={[{ required: true, message: '请输入业务目标' }]}>
                  <Input.TextArea rows={3} />
                </Form.Item>
              </section>

              <Divider />

              <section>
                <Typography.Title level={5}>发布与权限</Typography.Title>
                <Alert
                  showIcon
                  type="info"
                  message="PC 端只会看到已上架且符合套餐或企业白名单的数字员工。"
                />
                <div className="workflow-form-grid two" style={{ marginTop: 12 }}>
                  <Form.Item
                    name="recommendedPlanCode"
                    label="推荐套餐"
                    rules={[{ required: true, message: '请选择推荐套餐' }]}
                    tooltip="用于运营推荐和列表标识，不等于唯一可见范围。"
                  >
                    <Select options={planOptions} showSearch optionFilterProp="label" />
                  </Form.Item>
                  <Form.Item
                    name="allowedPlanCodes"
                    label="允许套餐"
                    tooltip="企业套餐命中这里时，PC 端可拉取和安装该员工。"
                  >
                    <Select mode="multiple" options={planOptions} showSearch optionFilterProp="label" />
                  </Form.Item>
                </div>
                <Form.Item
                  name="visibleWorkspaceIds"
                  label="企业白名单"
                  tooltip="为空表示所有符合套餐的企业可见；选择企业后只对白名单企业可见。"
                >
                  <Select mode="multiple" options={workspaceOptions} showSearch optionFilterProp="label" />
                </Form.Item>
              </section>

              <Divider />

              <section>
                <Typography.Title level={5}>交付与边界</Typography.Title>
                <Form.Item name="outputFormat" label="默认交付说明">
                  <Input.TextArea rows={2} placeholder="例如：对话摘要 + 可下载 Word/PPT/Excel 产物" />
                </Form.Item>
                <Form.Item
                  name="approvalPolicy"
                  label="默认人工确认策略"
                  rules={[{ required: true, message: '请输入审批策略' }]}
                >
                  <Input.TextArea rows={3} />
                </Form.Item>
              </section>
            </Space>
          </Drawer>

          <Drawer
            title="试运行"
            placement="right"
            width={560}
            open={testOpen}
            forceRender
            onClose={() => setTestOpen(false)}
            extra={
              <Button type="primary" icon={<PlayCircleOutlined />} loading={testing} onClick={handleSaveAndTest}>
                保存并运行
              </Button>
            }
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="试运行会先保存当前画布，再生成节点 trace。"
              />
              <Form.Item name="sampleInputs" label="测试样例">
                <Select mode="tags" tokenSeparators={[',']} placeholder="输入一个样例任务后回车" />
              </Form.Item>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text strong>本次测试输入</Typography.Text>
                <Input.TextArea
                  rows={5}
                  value={testInput}
                  placeholder="输入一条真实任务，例如：帮我根据附件生成一份客户跟进方案"
                  onChange={(event) => setTestInput(event.target.value)}
                />
                <Space wrap>
                  <Button size="small" onClick={useFirstSampleInput}>
                    使用第一个样例
                  </Button>
                  <Button size="small" type="primary" icon={<PlayCircleOutlined />} loading={testing} onClick={handleSaveAndTest}>
                    运行
                  </Button>
                </Space>
              </Space>
              {testResult ? (
                <WorkflowTestTracePanel result={testResult} />
              ) : (
                <Card size="small" bordered={false} className="workflow-empty-panel">
                  <Typography.Text type="secondary">
                    运行后这里会显示每个节点的输入、输出、警告和最终结果。
                  </Typography.Text>
                </Card>
              )}
            </Space>
          </Drawer>

          <Modal
            title="发布数字员工"
            open={publishOpen}
            forceRender
            width={640}
            onCancel={() => setPublishOpen(false)}
            footer={[
              <Button key="cancel" onClick={() => setPublishOpen(false)}>
                取消
              </Button>,
              <Button key="publish" type="primary" icon={<RocketOutlined />} loading={publishing} onClick={handleSaveAndPublish}>
                保存并上架
              </Button>
            ]}
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Alert
                showIcon
                type={capabilitySummary.warnings.length ? 'warning' : 'success'}
                message={capabilitySummary.warnings.length ? '发布前建议处理提示' : '画布基础检查通过'}
                description={capabilitySummary.warnings.length ? capabilitySummary.warnings.join('；') : '未发现孤立节点或缺少输出节点。'}
              />
              <section>
                <Typography.Text strong>自动识别能力</Typography.Text>
                <div className="workflow-publish-summary">
                  <div>模型：{capabilitySummary.modelProfileIds.join('、') || '无'}</div>
                  <div>工具：{capabilitySummary.toolIds.join('、') || '无'}</div>
                  <div>知识：{capabilitySummary.knowledgeSources.join('、') || '无'}</div>
                  <div>产物：{capabilitySummary.artifactTypes.join('、') || '无'}</div>
                </div>
              </section>
              <div className="workflow-form-grid two">
                <Form.Item
                  name="recommendedPlanCode"
                  label="推荐套餐"
                  rules={[{ required: true, message: '请选择推荐套餐' }]}
                >
                  <Select options={planOptions} showSearch optionFilterProp="label" />
                </Form.Item>
                <Form.Item name="allowedPlanCodes" label="允许套餐">
                  <Select mode="multiple" options={planOptions} showSearch optionFilterProp="label" />
                </Form.Item>
              </div>
              <Form.Item name="visibleWorkspaceIds" label="企业白名单">
                <Select mode="multiple" options={workspaceOptions} showSearch optionFilterProp="label" />
              </Form.Item>
            </Space>
          </Modal>
        </Form>
      </QiuPage>
    </AdminShell>
  );
}
