'use client';

import {
  AppstoreAddOutlined,
  ArrowLeftOutlined,
  DeleteOutlined,
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
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
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
  type NodeProps
} from '@xyflow/react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminCreateRoleTemplatePageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  toolCatalog: ToolActionCatalog;
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
type WorkflowCanvasPosition = { x: number; y: number };
type WorkflowSelection = { type: 'node' | 'edge'; id: string };
type WorkflowConfigPanelTab = 'settings' | 'lastRun';
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
  { value: 'input', label: '输入' },
  { value: 'parameter_extractor', label: '参数提取' },
  { value: 'list', label: '列表处理' },
  { value: 'knowledge', label: '知识库' },
  { value: 'llm', label: 'LLM' },
  { value: 'tool', label: '工具' },
  { value: 'condition', label: '条件' },
  { value: 'iteration', label: '迭代' },
  { value: 'loop', label: '循环' },
  { value: 'aggregator', label: '变量聚合' },
  { value: 'code', label: '代码转换' },
  { value: 'template', label: '模板' },
  { value: 'assign', label: '变量赋值' },
  { value: 'artifact', label: '产物' },
  { value: 'approval', label: '审批' },
  { value: 'output', label: '输出' }
];

const workflowNodeCatalogGroups: Array<{
  title: string;
  description: string;
  nodes: Array<{ value: WorkflowNodeType; label: string; hint: string }>;
}> = [
  {
    title: 'AI',
    description: '模型生成、分析、任务拆解',
    nodes: [
      { value: 'parameter_extractor', label: '参数提取', hint: '从自然语言中提取结构化参数' },
      { value: 'llm', label: 'LLM', hint: '调用模型生成、总结或分析' },
      { value: 'condition', label: '条件判断', hint: '根据变量结果进入不同分支' }
    ]
  },
  {
    title: '数据',
    description: '接收输入、读取知识',
    nodes: [
      { value: 'input', label: '输入', hint: '声明用户任务和附件输入' },
      { value: 'list', label: '列表处理', hint: '筛选、排序和整理文件或数组' },
      { value: 'iteration', label: '迭代', hint: '逐个处理数组里的每一项' },
      { value: 'aggregator', label: '变量聚合', hint: '合并多个分支或变量结果' },
      { value: 'code', label: '代码转换', hint: '用受限 JS 清洗 JSON、计算字段或生成 rows' },
      { value: 'template', label: '内容模板', hint: '把变量拼成稳定格式' },
      { value: 'assign', label: '变量赋值', hint: '设置固定值或复制变量' },
      { value: 'knowledge', label: '知识库', hint: '读取企业或本地知识' }
    ]
  },
  {
    title: '工具',
    description: '执行外部动作',
    nodes: [
      { value: 'tool', label: '工具调用', hint: '网页搜索、Office、MCP、HTTP 等' },
      { value: 'artifact', label: '生成产物', hint: '生成 Word、表格、PPT、PDF、MP4 等文件' }
    ]
  },
  {
    title: '交付',
    description: '确认和输出',
    nodes: [
      { value: 'approval', label: '人工确认', hint: '高风险步骤前让用户确认' },
      { value: 'output', label: '输出结果', hint: '定义最终展示和下载内容' }
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
  'pdf',
  'png',
  'jpg',
  'mp4',
  'markdown',
  'csv',
  'zip'
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
  parameter_extractor: '提取参数',
  list: '整理列表',
  knowledge: '读取知识',
  reasoning: '分析推理',
  llm: 'LLM 生成',
  assign: '变量赋值',
  code: '代码转换',
  template: '套用模板',
  tool: '调用工具',
  condition: '条件判断',
  iteration: '逐项处理',
  loop: '循环优化',
  aggregator: '聚合结果',
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
  const modelOutputMode: WorkflowModelOutputMode = type === 'parameter_extractor' ? 'json' : 'text';
  const defaultConfig =
    type === 'parameter_extractor'
      ? {
          outputMode: 'json',
          schema: {
            targetDuration: 'number',
            outputFormat: 'string',
            priority: 'string[]'
          }
        }
      : type === 'list'
        ? { sourceRef: 'start.files', kind: '', limit: 50 }
        : type === 'iteration'
          ? { sourceRef: 'list.items' }
          : type === 'loop'
            ? { maxIterations: 3 }
                : type === 'aggregator'
                  ? { mode: 'object' }
                : type === 'template'
                  ? { template: '{{runtime.previous_text}}' }
                : type === 'assign'
                  ? { assignments: [{ name: `${id}.value`, value: '$runtime.previous_text' }] }
                : type === 'code'
                  ? {
                      code: [
                        'const text = input.runtime?.previous_text || input.start?.text || "";',
                        'return {',
                        '  text,',
                        "  rows: [['项目', '内容'], ['输入', text]]",
                        '};'
                      ].join('\n'),
                      outputVariable: `${id}.json`,
                      timeoutMs: 2_000
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
        : type === 'parameter_extractor'
          ? '把用户任务或上游文本提取为结构化参数。'
          : type === 'list'
            ? '从文件或数组变量中筛选出后续要处理的列表。'
            : type === 'iteration'
              ? '从数组中取出当前项，供后续节点逐个处理。'
              : type === 'aggregator'
                ? '把多个变量或分支结果合并成一个结果。'
                : type === 'loop'
                  ? '控制循环次数和继续条件。'
                  : type === 'code'
                    ? '运行受限 JavaScript，把输入变量转换成结构化 JSON 或表格 rows。'
        : type === 'tool'
          ? '调用指定工具完成当前步骤。'
          : type === 'artifact'
            ? '把最终内容生成可下载产物。'
            : '按节点目标处理任务，并把结果写入输出变量。',
    toolId,
    modelProfileId: type === 'llm' || type === 'reasoning' || type === 'parameter_extractor' ? 'qiu-general-default' : undefined,
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
          : type === 'assign'
            ? [`${id}.value`]
          : type === 'code'
            ? [`${id}.json`]
          : type === 'parameter_extractor'
            ? [`${id}.json`]
            : type === 'llm' || type === 'reasoning'
              ? [`${id}.${modelOutputMode === 'json' ? 'json' : 'text'}`]
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
  if (node.type === 'parameter_extractor') return 'json';
  return node.config?.outputMode === 'json' ? 'json' : 'text';
}

function defaultWorkflowModelSchema(node: RoleWorkflowGraphNode): Record<string, unknown> {
  if (node.type === 'parameter_extractor') {
    return {
      target: 'string',
      constraints: 'string[]',
      outputFormat: 'string'
    };
  }

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
  if (node.type === 'parameter_extractor' || node.type === 'aggregator' || node.type === 'assign' || node.type === 'code') return 'json';
  if (node.type === 'list') return 'asset[]';
  if (node.type === 'iteration') return 'asset';
  if (node.type === 'condition') return 'boolean';
  if ((node.type === 'llm' || node.type === 'reasoning') && readWorkflowModelOutputMode(node) === 'json') {
    return 'json';
  }
  if (node.type === 'knowledge' || node.type === 'llm' || node.type === 'reasoning' || node.type === 'template' || node.type === 'output') {
    return 'text';
  }
  return byName;
}

function getWorkflowNodeDefaultOutputVariables(node: RoleWorkflowGraphNode): string[] {
  if (node.type === 'start') return [];
  if (node.type === 'artifact') return [`${node.id}.file`];
  if (node.type === 'parameter_extractor') return [`${node.id}.json`];
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
  if ((node.type === 'llm' || node.type === 'reasoning') && readWorkflowModelOutputMode(node) === 'json') {
    return [`${node.id}.json`];
  }
  if (node.type === 'condition') return [`${node.id}.matched`];
  if (node.type === 'aggregator' || node.type === 'assign' || node.type === 'code') return [`${node.id}.json`];
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

function deriveWorkflowVariableOptions(graph: RoleWorkflowGraph): WorkflowVariableOption[] {
  const options = new Map<string, WorkflowVariableOption>();

  for (const option of defaultWorkflowVariableOptions) {
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
    graph.nodes.flatMap((node) => [
      node.toolId,
      ...(Array.isArray(node.config?.toolIds) ? node.config.toolIds : [])
    ]).filter((toolId): toolId is string => typeof toolId === 'string')
  );
}

function deriveWorkflowKnowledgeSources(graph: RoleWorkflowGraph): string[] {
  const sources = graph.nodes.flatMap((node) => {
    if (node.type !== 'knowledge') return [];
    const configSources = Array.isArray(node.config?.sources) ? node.config.sources : [];
    return configSources.filter((source): source is string => typeof source === 'string');
  });

  return uniqueTags(sources.length ? sources : graph.nodes.some((node) => node.type === 'knowledge') ? ['workspace_library'] : []);
}

function deriveWorkflowModelProfileIds(graph: RoleWorkflowGraph): string[] {
  return uniqueTags(
    graph.nodes
      .filter((node) => node.type === 'llm' || node.type === 'reasoning' || node.type === 'parameter_extractor')
      .map((node) => node.modelProfileId ?? 'qiu-general-default')
  );
}

function deriveWorkflowArtifactTypes(graph: RoleWorkflowGraph): string[] {
  return uniqueTags(
    graph.nodes
      .filter((node) => node.type === 'artifact')
      .map((node) => node.artifactType ?? 'docx')
  );
}

function deriveWorkflowSkills(graph: RoleWorkflowGraph): Array<{ code: string; name: string; summary: string }> {
  const skillNodes = graph.nodes.filter((node) =>
    node.type === 'llm' ||
    node.type === 'reasoning' ||
    node.type === 'parameter_extractor' ||
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
  const incomingTargets = new Set(graph.edges.map((edge) => edge.targetNodeId));
  const outgoingSources = new Set(graph.edges.map((edge) => edge.sourceNodeId));
  const orphanNodes = graph.nodes.filter(
    (node) =>
      node.id !== graph.entryNodeId &&
      !incomingTargets.has(node.id) &&
      !outgoingSources.has(node.id)
  );
  const hasOutputNode = graph.nodes.some((node) => node.type === 'output');

  return {
    modelProfileIds: deriveWorkflowModelProfileIds(graph),
    toolIds: readWorkflowGraphToolIds(graph),
    knowledgeSources: deriveWorkflowKnowledgeSources(graph),
    artifactTypes: deriveWorkflowArtifactTypes(graph),
    approvalRequired: graph.nodes.some((node) => node.requiresApproval || node.type === 'approval'),
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    warnings: [
      ...(!hasOutputNode ? ['缺少输出节点，PC 端可能无法明确展示最终结果。'] : []),
      ...(orphanNodes.length ? [`存在 ${orphanNodes.length} 个孤立节点，请确认是否需要连线。`] : [])
    ]
  };
}

function deriveWorkflowNodeWarningCount(graph: RoleWorkflowGraph) {
  const variableOptions = deriveWorkflowVariableOptions(graph);
  return graph.nodes.reduce((total, node) => total + workflowNodeWarnings(node, variableOptions).length, 0);
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

function rebuildLinearEdges(graph: RoleWorkflowGraph): RoleWorkflowGraph {
  const edges: WorkflowEdge[] = [];
  for (let index = 0; index < graph.nodes.length - 1; index += 1) {
    const sourceNodeId = graph.nodes[index]?.id;
    const targetNodeId = graph.nodes[index + 1]?.id;
    if (!sourceNodeId || !targetNodeId) continue;
    edges.push({
      id: createWorkflowEdgeId(sourceNodeId, targetNodeId, edges),
      sourceNodeId,
      targetNodeId,
      condition: { type: 'always' }
    });
  }

  return { ...graph, edges };
}

function deriveWorkflowStepsFromGraph(graph: RoleWorkflowGraph): RoleWorkflowGraphSourceStep[] {
  const steps: RoleWorkflowGraphSourceStep[] = [];
  let order = 0;
  for (const node of graph.nodes) {
    if (node.id === graph.entryNodeId) {
      continue;
    }

    const mappedType =
      node.type === 'llm'
        ? 'reasoning'
        : node.type === 'parameter_extractor'
          ? 'reasoning'
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
        type: 'reasoning',
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
        type: 'reasoning',
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
      type: 'reasoning',
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
      node.type === 'llm' || node.type === 'reasoning'
        ? {
            ...node,
            modelProfileId: node.modelProfileId ?? 'qiu-general-default'
          }
        : node
    )
  };
}

function normalizeWorkflowGraphForCanvas(graph: RoleWorkflowGraph): RoleWorkflowGraph {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      name: legacyWorkflowNodeNameTranslations[node.name] ?? node.name
    }))
  };
}

function nodeTone(type: RoleWorkflowGraphNode['type']) {
  if (type === 'llm' || type === 'reasoning' || type === 'parameter_extractor') return 'blue';
  if (type === 'tool' || type === 'artifact') return 'purple';
  if (type === 'knowledge' || type === 'list' || type === 'iteration' || type === 'aggregator') return 'green';
  if (type === 'output') return 'gold';
  return 'default';
}

function workflowNodeTypeLabel(type: RoleWorkflowGraphNode['type']) {
  return workflowNodeTypeOptions.find((option) => option.value === type)?.label ?? type;
}

function traceStatusTone(status: 'passed' | 'warning' | 'failed') {
  if (status === 'passed') return 'green';
  if (status === 'failed') return 'red';
  return 'gold';
}

function workflowNodeMeta(node: RoleWorkflowGraphNode) {
  return node.toolId ?? node.artifactType ?? node.modelProfileId ?? node.id;
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

  if (node.type === 'llm' || node.type === 'reasoning' || node.type === 'parameter_extractor') {
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

  if (node.type === 'assign') {
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

  if (node.type === 'code') {
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

  if (node.type === 'artifact') {
    if (!node.artifactType) warnings.push('未选格式');
    if (!node.toolId) warnings.push('未选写入工具');
    if (!action) warnings.push('未选写入动作');
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
  variableOptions?: WorkflowVariableOption[]
): WorkflowFlowNode[] {
  const traceByNodeId = new Map((testGraphTrace?.nodes ?? []).map((trace) => [trace.nodeId, trace]));
  return graph.nodes.map((node, index) => {
    const warnings = workflowNodeWarnings(node, variableOptions);
    const trace = traceByNodeId.get(node.id);
    const statusClass =
      trace?.status === 'failed'
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
        statusLabel: trace ? workflowTraceStatusLabel(trace.status) : warnings.length ? '需配置' : '就绪',
        statusClass,
        warnings
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

function WorkflowFlowNodeCard({ data, selected }: NodeProps<WorkflowFlowNode>) {
  return (
    <div className={`workflow-flow-node tone-${data.tone}${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Left} className="workflow-flow-handle" />
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
  const visibleVariables = variables.slice(0, 18);

  return (
    <div className="workflow-variable-reference">
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Typography.Text strong>变量</Typography.Text>
          <Typography.Text type="secondary" className="workflow-config-section-desc">
            传值用引用，不传大文件内容
          </Typography.Text>
        </Space>

        <div className="workflow-variable-current">
          <Typography.Text type="secondary">当前节点输入</Typography.Text>
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
          <Typography.Text type="secondary">当前节点输出</Typography.Text>
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
      </Space>
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
  if (node.type === 'parameter_extractor') return '把自然语言任务变成 JSON 参数，适合提取时长、格式、评分标准、输出要求。';
  if (node.type === 'list') return '从附件或上游数组里筛选一批对象，例如只取视频、图片或表格。';
  if (node.type === 'iteration') return '取列表中的当前项，适合一条条处理多个文件。';
  if (node.type === 'aggregator') return '把多个节点输出合并成一个对象或数组，供后续节点统一使用。';
  if (node.type === 'code') return '运行受限 JS 处理 JSON、表格和业务规则。输入变量会注入到 input 对象。';
  if (node.type === 'tool') return '调用本地或网络工具。工具参数支持 {{变量}} 模板和 $变量 引用。';
  if (node.type === 'artifact') return '生成真实可下载产物。这里的写入动作和参数会被 PC 端执行。';
  if (node.type === 'output') return '整理最终回复，通常放在流程最后，用于告诉用户结果和下载位置。';
  if (node.type === 'condition') return '配置分支条件；复杂判断可先用 LLM/参数提取节点生成分类结果，再在连线上判断。';
  return '配置节点名称、执行说明、输入变量和输出变量。';
}

function WorkflowReactFlowEditor({
  graph,
  onChange,
  testGraphTrace,
  toolCatalog
}: {
  graph: RoleWorkflowGraph;
  onChange: (graph: RoleWorkflowGraph) => void;
  testGraphTrace?: AdminRoleTemplateTestGraphTrace;
  toolCatalog: ToolActionCatalog;
}) {
  const [selection, setSelection] = useState<WorkflowSelection>({
    type: 'node',
    id: graph.entryNodeId
  });
  const [configPanelTab, setConfigPanelTab] = useState<WorkflowConfigPanelTab>('settings');
  const [nodePicker, setNodePicker] = useState<{
    open: boolean;
    sourceNodeId?: string;
    edgeId?: string;
  }>({ open: false });
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
      if (artifactType === 'markdown' || artifactType === 'pdf') {
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
  const variableOptions = useMemo(() => deriveWorkflowVariableOptions(graph), [graph]);
  const variableSelectOptions = useMemo(
    () => buildWorkflowVariableSelectOptions(variableOptions),
    [variableOptions]
  );
  const flowNodes = useMemo(
    () => toWorkflowFlowNodes(graph, testGraphTrace, variableOptions),
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
  const selectedAssignConfig = selectedNode?.type === 'assign'
    ? readWorkflowAssignConfig(selectedNode)
    : undefined;
  const selectedAssignTableMapping = selectedNode?.type === 'assign'
    ? readWorkflowAssignTableMappingConfig(selectedNode)
    : undefined;
  const selectedArtifactTableSourceRef = selectedNode?.type === 'artifact'
    ? readArtifactTableSourceRef(selectedNode)
    : undefined;
  const selectedCodePreviewInput = selectedNode?.type === 'code'
    ? buildWorkflowCodePreviewInput(selectedNode, variableOptions)
    : undefined;
  const selectedCodePreviewResult = selectedNode?.type === 'code'
    ? codePreviewResults[selectedNode.id]
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
      if (!connection.source || !connection.target || connection.source === connection.target) {
        message.warning('连线的起点和终点不能相同');
        return;
      }
      if (graph.edges.some((edge) => edge.sourceNodeId === connection.source && edge.targetNodeId === connection.target)) {
        message.warning('这条连线已经存在');
        return;
      }

      const edge: WorkflowEdge = {
        id: createWorkflowEdgeId(connection.source, connection.target, graph.edges),
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
        condition: { type: 'always' }
      };
      onChange({ ...graph, edges: [...graph.edges, edge] });
      setSelection({ type: 'edge', id: edge.id });
    },
    [graph, onChange]
  );

  function openNodePicker(options?: { sourceNodeId?: string; edgeId?: string }) {
    setNodePicker({
      open: true,
      sourceNodeId: options?.sourceNodeId ?? selectedNode?.id ?? graph.entryNodeId,
      edgeId: options?.edgeId
    });
  }

  function closeNodePicker() {
    setNodePicker({ open: false });
  }

  function addNode(type: WorkflowNodeType, options?: { sourceNodeId?: string; edgeId?: string }) {
    const edgeId = options?.edgeId ?? nodePicker.edgeId;
    const edgeToInsert = edgeId
      ? graph.edges.find((edge) => edge.id === edgeId)
      : undefined;
    const sourceNodeId =
      edgeToInsert?.sourceNodeId ?? options?.sourceNodeId ?? nodePicker.sourceNodeId ?? selectedNode?.id ?? graph.entryNodeId;
    const sourcePosition = nodePositions.get(sourceNodeId);
    const targetPosition = edgeToInsert ? nodePositions.get(edgeToInsert.targetNodeId) : undefined;
    const node = writeWorkflowNodeCanvasPosition(createCanvasNode(type, graph.nodes, {
      defaultToolId: serverToolOptions[0]?.value,
      getDefaultToolActionTemplate: getDefaultToolActionTemplateForCanvas,
      getDefaultArtifactActionTemplate: getDefaultArtifactActionTemplateForCanvas
    }), {
      x: targetPosition ? Math.round(((sourcePosition?.x ?? 80) + targetPosition.x) / 2) : (sourcePosition?.x ?? 80) + 260,
      y: targetPosition ? Math.round(((sourcePosition?.y ?? 180) + targetPosition.y) / 2) + 80 : Math.max(80, sourcePosition?.y ?? 180)
    });
    const selectedNodeIndex = graph.nodes.findIndex((item) => item.id === sourceNodeId);
    const insertIndex = selectedNodeIndex >= 0 ? selectedNodeIndex + 1 : graph.nodes.length;
    const nodes = [
      ...graph.nodes.slice(0, insertIndex),
      node,
      ...graph.nodes.slice(insertIndex)
    ];

    const edges: WorkflowEdge[] = edgeToInsert
      ? [
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
        ]
      : graph.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === node.id)
        ? graph.edges
        : [
            ...graph.edges,
            {
              id: createWorkflowEdgeId(sourceNodeId, node.id, graph.edges),
              sourceNodeId,
              targetNodeId: node.id,
              condition: { type: 'always' as const }
            }
          ];
    onChange({ ...graph, nodes, edges });
    setSelection({ type: 'node', id: node.id });
    closeNodePicker();
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
    const nodes = [...graph.nodes].sort((left, right) => {
      if (left.id === graph.entryNodeId) return -1;
      if (right.id === graph.entryNodeId) return 1;
      const leftPosition = nodePositions.get(left.id) ?? { x: 0, y: 0 };
      const rightPosition = nodePositions.get(right.id) ?? { x: 0, y: 0 };
      return leftPosition.x === rightPosition.x
        ? leftPosition.y - rightPosition.y
        : leftPosition.x - rightPosition.x;
    });
    onChange(rebuildLinearEdges({ ...graph, nodes }));
    message.success('已按画布从左到右重建连线');
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
            action: template.value,
            input: template.defaults
          })
        : node.config
    });
  }

  function updateToolNodeAction(node: RoleWorkflowGraphNode, action: string) {
    const template = getSelectedToolActionTemplateForCanvas(node.toolId, action);
    updateNode(node.id, {
      config: buildToolNodeConfig(node, {
        action: template?.value ?? action,
        input: template?.defaults ?? node.config?.input ?? {}
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
        node.type === 'llm' || node.type === 'reasoning' || node.type === 'parameter_extractor'
          ? [`${node.id}.${outputMode === 'json' ? 'json' : 'text'}`]
          : node.outputVariables
    });
  }

  function updateArtifactTableSource(node: RoleWorkflowGraphNode, sourceRef?: string) {
    const template = getDefaultArtifactActionTemplateForCanvas(node.artifactType ?? 'xlsx');
    const currentInput = readWorkflowToolInputConfig(node);
    const rows = sourceRef ? `$${sourceRef}` : currentInput.rows;
    updateNode(node.id, {
      inputVariables: sourceRef ? uniqueTags([...(node.inputVariables ?? []), sourceRef]) : node.inputVariables,
      config: buildToolNodeConfig(node, {
        action: template?.value ?? (node.artifactType === 'csv' ? 'spreadsheet.write_csv' : 'spreadsheet.write_xlsx'),
        input: {
          ...(template?.defaults ?? {}),
          ...currentInput,
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

  return (
    <div className="workflow-builder-shell">
      <aside className="workflow-node-palette">
        <div className="workflow-pane-heading">
          <div>
            <div className="workflow-pane-title">节点库</div>
            <Typography.Text type="secondary" className="workflow-pane-subtitle">
              选中节点后添加下一步
            </Typography.Text>
          </div>
          <Button size="small" type="primary" icon={<AppstoreAddOutlined />} onClick={() => openNodePicker()}>
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
                  onClick={() => addNode(node.value, { sourceNodeId: selectedNode?.id ?? graph.entryNodeId })}
                >
                  <span>{node.label}</span>
                  <span className="workflow-palette-hint">{node.hint}</span>
                </Button>
              ))}
            </section>
          ))}
        </Space>
      </aside>

      <section className="workflow-canvas-shell">
        <div className="workflow-canvas-toolbar">
          <Space>
            <Button size="small" onClick={resetLinearEdges}>
              自动整理连线
            </Button>
            <Button size="small" onClick={() => openNodePicker()} icon={<PlusOutlined />}>
              添加节点
            </Button>
          </Space>
          <Typography.Text type="secondary">
            拖动节点调整布局，拖出右侧圆点创建连线，右键画布空白处也可添加节点。
          </Typography.Text>
        </div>
        <ReactFlowProvider>
          <ReactFlow
            className="workflow-react-flow"
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={workflowNodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeClick={(_, node) => setSelection({ type: 'node', id: node.id })}
            onEdgeClick={(_, edge) => setSelection({ type: 'edge', id: edge.id })}
            onPaneContextMenu={(event) => {
              event.preventDefault();
              openNodePicker();
            }}
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
                  options={workflowNodeTypeOptions}
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
                        type === 'llm' || type === 'reasoning' || type === 'parameter_extractor'
                          ? selectedNode.modelProfileId ?? 'qiu-general-default'
                          : selectedNode.modelProfileId,
                      artifactType: nextArtifactType,
                      requiresApproval: type === 'approval' ? true : selectedNode.requiresApproval,
                      config:
                        type === 'tool' || type === 'artifact'
                          ? buildToolNodeConfig(selectedNode, {
                              action: nextToolTemplate?.value,
                              input: nextToolTemplate?.defaults ?? selectedNode.config?.input ?? {}
                            })
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
            {selectedNode.type === 'parameter_extractor' ? (
              <WorkflowConfigSection
                title="提取规则"
                description="写清楚要从用户任务里提取哪些字段，输出会成为后续节点可引用的 JSON。"
              >
                <Input.TextArea
                  rows={5}
                  value={stringifyJsonConfigValue(selectedNode.config?.schema ?? {})}
                  placeholder='{"targetDuration":"number","outputFormat":"string"}'
                  onChange={(event) =>
                    updateNodeConfigField(
                      selectedNode,
                      'schema',
                      parseJsonConfigValue(event.target.value, selectedNode.config?.schema ?? {})
                    )
                  }
                />
              </WorkflowConfigSection>
            ) : null}
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
            {selectedNode.type === 'assign' && selectedAssignConfig ? (
              <WorkflowConfigSection
                title="变量赋值"
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
            {selectedNode.type === 'assign' && selectedAssignTableMapping ? (
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
            {selectedNode.type === 'code' ? (
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
            {selectedNode.type === 'template' ? (
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
            {selectedNode.type === 'llm' || selectedNode.type === 'reasoning' || selectedNode.type === 'parameter_extractor' ? (
              <WorkflowConfigSection
                title="模型"
                description="模板里指定模型；PC 端安装员工时再配置对应 API Key。"
              >
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Select
                    size="small"
                    allowClear
                    showSearch
                    value={selectedNode.modelProfileId}
                    placeholder="选择具体模型（PC 端安装时配置 API Key）"
                    options={modelProfileOptions}
                    optionFilterProp="label"
                    onChange={(modelProfileId) => updateNode(selectedNode.id, { modelProfileId })}
                  />
                  <Select
                    size="small"
                    value={readWorkflowModelOutputMode(selectedNode)}
                    disabled={selectedNode.type === 'parameter_extractor'}
                    options={modelOutputModeOptions}
                    onChange={(outputMode) => updateModelOutputMode(selectedNode, outputMode)}
                  />
                  {readWorkflowModelOutputMode(selectedNode) === 'json' && selectedNode.type !== 'parameter_extractor' ? (
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
                title={selectedNode.type === 'artifact' ? '写入工具' : '调用工具'}
                description="选择这个节点实际调用的工具，例如文档、表格、网页搜索、视频处理或 MCP。"
              >
                <Select
                  size="small"
                  allowClear
                  value={selectedNode.toolId}
                  placeholder="工具 ID"
                  options={serverToolOptions}
                  onChange={(toolId) => updateToolNodeToolId(selectedNode, toolId)}
                />
              </WorkflowConfigSection>
            ) : null}
            {selectedNode.type === 'artifact' ? (
              <WorkflowConfigSection
                title="产物格式"
                description="选择最终交付物格式；切到 MP4 会自动使用视频处理工具。"
              >
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
                        action: nextToolTemplate?.value,
                        input: nextToolTemplate?.defaults ?? {}
                      })
                    });
                  }}
                />
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
                    if (selectedNode.type === 'code') {
                      updateCodeNodeConfig(selectedNode, { outputVariable: outputVariables[0] ?? `${selectedNode.id}.json` });
                      return;
                    }
                    updateNode(selectedNode.id, { outputVariables });
                  }}
                />
              </Space>
            </WorkflowConfigSection>
            {selectedNode.type === 'approval' || selectedNode.requiresApproval ? (
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
            ) : null}
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
                  onChange={(sourceNodeId) => updateEdge(selectedEdge.id, { sourceNodeId })}
                />
                <Select
                  size="small"
                  value={selectedEdge.targetNodeId}
                  options={nodeOptions}
                  onChange={(targetNodeId) => updateEdge(selectedEdge.id, { targetNodeId })}
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
            <Button size="small" icon={<PlusOutlined />} onClick={() => openNodePicker({ edgeId: selectedEdge.id })}>
              在连线中插入节点
            </Button>
          </Space>
        ) : null}

        <Typography.Text type="secondary" className="workflow-config-note">
          选择节点编辑参数；选择连线编辑条件或插入节点。
        </Typography.Text>
      </aside>

      <Modal
        title="添加节点"
        open={nodePicker.open}
        width={720}
        footer={null}
        onCancel={closeNodePicker}
      >
        <div className="workflow-node-picker">
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
  const workflowSteps = deriveWorkflowStepsFromGraph(workflowGraph);
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
    knowledgeSources: deriveWorkflowKnowledgeSources(workflowGraph),
    tools: uniqueTags([...inferredTools, ...readWorkflowGraphToolIds(workflowGraph)]),
    skills: deriveWorkflowSkills(workflowGraph),
    workflowSteps,
    workflowGraph,
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
  const workflowSteps = deriveWorkflowStepsFromGraph(workflowGraph);
  const inferredTools = workflowSteps.flatMap((step) => step.toolIds ?? []);

  return {
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: deriveWorkflowKnowledgeSources(workflowGraph),
    tools: uniqueTags([...inferredTools, ...readWorkflowGraphToolIds(workflowGraph)]),
    skills: deriveWorkflowSkills(workflowGraph),
    workflowSteps,
    workflowGraph,
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
  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates]
  );
  const watchedName = Form.useWatch('name', form);
  const watchedIndustry = Form.useWatch('industry', form);
  const persistedTemplateId = savedTemplateId ?? editingTemplate?.id;
  const initialGraph = useMemo(
    () => normalizeWorkflowGraphForCanvas(editingTemplate?.workflowGraph ?? createWorkflowGraph(inferInitialPreset(editingTemplate))),
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
                <Typography.Text type="secondary">预设</Typography.Text>
                <Form.Item name="workflowPreset" noStyle rules={[{ required: true }]}>
                  <Select
                    disabled={Boolean(persistedTemplateId)}
                    style={{ width: 168 }}
                    options={workflowPresetOptions.map((option) => ({
                      value: option.value,
                      label: option.label
                    }))}
                    onChange={(preset) => setEditableGraph(normalizeWorkflowGraphForCanvas(createWorkflowGraph(preset)))}
                  />
                </Form.Item>
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
            />
          </section>

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
