'use client';

import { ArrowLeftOutlined, DeleteOutlined, PlayCircleOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
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
  UpdateAdminRoleTemplateRequest
} from '@qiuai/api-contract';
import { buildRoleWorkflowGraphFromSteps } from '@qiuai/api-contract';
import { QiuPage } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminCreateRoleTemplatePageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  templateId?: string;
}

type WorkflowPreset = 'standard' | 'document' | 'research';
type WorkflowNodeType = RoleWorkflowGraphNode['type'];
type WorkflowArtifactType = NonNullable<RoleWorkflowGraphNode['artifactType']>;
type WorkflowEdge = RoleWorkflowGraph['edges'][number];
type WorkflowEdgeConditionType = NonNullable<WorkflowEdge['condition']>['type'];
type ToolConfigFieldType = 'text' | 'number' | 'textarea' | 'boolean';

type ToolConfigField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: ToolConfigFieldType;
  format?: 'text' | 'json';
};

type ToolActionTemplate = {
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

const toolOptions = [
  'web-search',
  'office-document',
  'local-filesystem',
  'browser-automation',
  'http-request',
  'mcp'
].map((value) => ({ value, label: value }));

const toolActionTemplatesByToolId: Record<string, ToolActionTemplate[]> = {
  'web-search': [
    {
      value: 'web.search',
      label: '网页搜索',
      defaults: { query: '{{start.text}}', maxResults: 5 },
      fields: [
        { key: 'query', label: '搜索词', placeholder: '{{start.text}}' },
        { key: 'maxResults', label: '结果数量', type: 'number' }
      ]
    },
    {
      value: 'web.fetch_url',
      label: '读取网页',
      defaults: { url: 'https://example.com', maxChars: 12000 },
      fields: [
        { key: 'url', label: 'URL', placeholder: 'https://example.com' },
        { key: 'maxChars', label: '最大字符', type: 'number' }
      ]
    }
  ],
  'office-document': [
    {
      value: 'document.extract_text',
      label: '读取文档文本',
      defaults: { path: '$start.files.0.localPath', maxChars: 30000 },
      fields: [
        { key: 'path', label: '文件路径', placeholder: '$start.files.0.localPath' },
        { key: 'maxChars', label: '最大字符', type: 'number' }
      ]
    },
    {
      value: 'office.write_docx_document',
      label: '生成 Word',
      defaults: {
        title: '{{task.title}}',
        folder: 'documents',
        fileName: '{{task.title}}',
        content: '{{runtime.previous_text}}'
      },
      fields: [
        { key: 'title', label: '标题' },
        { key: 'folder', label: '目录' },
        { key: 'fileName', label: '文件名' },
        { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' }
      ]
    },
    {
      value: 'office.write_markdown_document',
      label: '生成 Markdown',
      defaults: {
        title: '{{task.title}}',
        folder: 'documents',
        fileName: '{{task.title}}',
        content: '{{runtime.previous_text}}'
      },
      fields: [
        { key: 'title', label: '标题' },
        { key: 'folder', label: '目录' },
        { key: 'fileName', label: '文件名' },
        { key: 'content', label: '内容', type: 'textarea', format: 'text', placeholder: '{{runtime.previous_text}}' }
      ]
    },
    {
      value: 'spreadsheet.write_xlsx',
      label: '生成 Excel',
      defaults: {
        folder: 'spreadsheets',
        fileName: '{{task.title}}',
        rows: [['项目', '内容'], ['结果', '{{runtime.previous_text}}']]
      },
      fields: [
        { key: 'folder', label: '目录' },
        { key: 'fileName', label: '文件名' },
        { key: 'rows', label: '行数据 JSON', type: 'textarea', format: 'json', placeholder: '[["项目","内容"],["结果","{{runtime.previous_text}}"]]' }
      ]
    },
    {
      value: 'presentation.write_pptx',
      label: '生成 PPT',
      defaults: {
        title: '{{task.title}}',
        folder: 'presentations',
        fileName: '{{task.title}}',
        slides: [{ title: '{{task.title}}', bullets: ['{{runtime.previous_text}}'] }]
      },
      fields: [
        { key: 'title', label: '标题' },
        { key: 'folder', label: '目录' },
        { key: 'fileName', label: '文件名' },
        { key: 'slides', label: '幻灯片 JSON', type: 'textarea', format: 'json', placeholder: '[{"title":"标题","bullets":["要点"]}]' }
      ]
    }
  ],
  'local-filesystem': [
    {
      value: 'filesystem.read_text_file',
      label: '读取文本文件',
      defaults: { path: '$start.files.0.localPath', maxChars: 30000 },
      fields: [
        { key: 'path', label: '路径', placeholder: '$start.files.0.localPath' },
        { key: 'maxChars', label: '最大字符', type: 'number' }
      ]
    },
    {
      value: 'filesystem.write_text_file',
      label: '写入文本文件',
      defaults: { folder: 'reports', fileName: '{{task.title}}', content: '{{runtime.previous_text}}' },
      fields: [
        { key: 'folder', label: '目录' },
        { key: 'fileName', label: '文件名' },
        { key: 'content', label: '内容', type: 'textarea', placeholder: '{{runtime.previous_text}}' }
      ]
    },
    {
      value: 'filesystem.list_directory',
      label: '列出目录',
      defaults: { path: '$start.files.0.localPath' },
      fields: [{ key: 'path', label: '目录路径' }]
    }
  ],
  'http-request': [
    {
      value: 'http.request',
      label: 'HTTP 请求',
      defaults: {
        method: 'GET',
        url: 'https://api.example.com',
        headers: {},
        body: '',
        maxChars: 24000,
        timeoutMs: 30000,
        allowPrivateNetwork: false
      },
      fields: [
        { key: 'method', label: '方法' },
        { key: 'url', label: 'URL' },
        { key: 'headers', label: '请求头 JSON', type: 'textarea', format: 'json', placeholder: '{"Authorization":"Bearer ..."}' },
        { key: 'body', label: '请求体', type: 'textarea', format: 'text' },
        { key: 'maxChars', label: '最大字符', type: 'number' },
        { key: 'timeoutMs', label: '超时毫秒', type: 'number' },
        { key: 'allowPrivateNetwork', label: '允许内网', type: 'boolean' }
      ]
    }
  ],
  mcp: [
    {
      value: 'mcp.call',
      label: '调用 MCP 工具',
      defaults: {
        endpoint: 'http://127.0.0.1:3001/mcp',
        toolName: '',
        arguments: {},
        headers: {},
        timeoutMs: 30000,
        allowPrivateNetwork: true
      },
      fields: [
        { key: 'endpoint', label: 'Endpoint' },
        { key: 'toolName', label: '工具名' },
        { key: 'arguments', label: '参数 JSON', type: 'textarea', format: 'json', placeholder: '{"query":"{{start.text}}"}' },
        { key: 'headers', label: '请求头 JSON', type: 'textarea', format: 'json' },
        { key: 'timeoutMs', label: '超时毫秒', type: 'number' },
        { key: 'allowPrivateNetwork', label: '允许内网', type: 'boolean' }
      ]
    }
  ]
};

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
  { value: 'knowledge', label: '知识库' },
  { value: 'llm', label: 'LLM' },
  { value: 'tool', label: '工具' },
  { value: 'condition', label: '条件' },
  { value: 'artifact', label: '产物' },
  { value: 'approval', label: '审批' },
  { value: 'output', label: '输出' }
];

const modelProfileOptions = [
  { value: 'qiu-general-default', label: '通用执行模型（PC 端配置）' },
  { value: 'qiu-reasoning-default', label: '深度推理模型（PC 端配置）' },
  { value: 'qiu-vision-default', label: '视觉理解模型（PC 端配置）' },
  { value: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { value: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
  { value: 'openai-gpt-5.6-terra', label: 'OpenAI GPT-5.6 Terra' },
  { value: 'openai-gpt-5.6-sol', label: 'OpenAI GPT-5.6 Sol' },
  { value: 'qwen-plus', label: '通义千问 Qwen Plus' },
  { value: 'qwen-max', label: '通义千问 Qwen Max' },
  { value: 'custom-model', label: '自定义兼容模型' }
];

const artifactTypeOptions: Array<{ value: WorkflowArtifactType; label: string }> = [
  'docx',
  'xlsx',
  'pptx',
  'pdf',
  'png',
  'jpg',
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

const defaultNodeNames: Record<WorkflowNodeType, string> = {
  start: 'Start',
  input: '接收输入',
  knowledge: '读取知识',
  reasoning: '分析推理',
  llm: 'LLM 生成',
  assign: '变量赋值',
  template: '套用模板',
  tool: '调用工具',
  condition: '条件判断',
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

function createCanvasNode(type: WorkflowNodeType, nodes: RoleWorkflowGraphNode[]): RoleWorkflowGraphNode {
  const id = createWorkflowNodeId(type, nodes);
  const toolId = type === 'tool' || type === 'artifact' ? 'office-document' : undefined;
  const toolActionTemplate = toolId ? getDefaultToolActionTemplate(toolId) : undefined;

  return {
    id,
    type,
    name: defaultNodeNames[type],
    instruction:
      type === 'condition'
        ? '根据输入变量或上一个节点输出选择下一条连线。'
        : type === 'tool'
          ? '调用指定工具完成当前步骤。'
          : type === 'artifact'
            ? '把最终内容生成可下载产物。'
            : '按节点目标处理任务，并把结果写入输出变量。',
    toolId,
    modelProfileId: type === 'llm' || type === 'reasoning' ? 'qiu-general-default' : undefined,
    artifactType: type === 'artifact' ? 'docx' : undefined,
    inputVariables: type === 'input' ? ['start.text', 'start.files'] : ['start.text'],
    outputVariables: [`${id}.text`],
    requiresApproval: type === 'approval',
    config:
      type === 'tool' && toolActionTemplate
        ? {
            action: toolActionTemplate.value,
            input: toolActionTemplate.defaults
          }
        : undefined
  };
}

function getDefaultToolActionTemplate(toolId: string): ToolActionTemplate | undefined {
  return toolActionTemplatesByToolId[toolId]?.[0];
}

function getSelectedToolActionTemplate(toolId: string | undefined, action: string | undefined): ToolActionTemplate | undefined {
  if (!toolId) return undefined;
  const templates = toolActionTemplatesByToolId[toolId] ?? [];
  if (!action) return templates[0];
  return templates.find((template) => template.value === action) ?? templates[0];
}

function getNodeConfigValue(node: RoleWorkflowGraphNode, key: string) {
  const value = node.config?.[key];
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? value
    : undefined;
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

function readWorkflowGraphToolIds(graph: RoleWorkflowGraph): string[] {
  return uniqueTags(
    graph.nodes.flatMap((node) => [
      node.toolId,
      ...(Array.isArray(node.config?.toolIds) ? node.config.toolIds : [])
    ]).filter((toolId): toolId is string => typeof toolId === 'string')
  );
}

function formatConditionLabel(condition: WorkflowEdge['condition']) {
  if (!condition || condition.type === 'always') return 'always';
  if (condition.type === 'expression') return `expr: ${condition.expression ?? '-'}`;
  if (condition.type === 'exists') return `exists ${condition.variable ?? 'input'}`;
  return `${condition.type} ${condition.variable ?? 'input'} ${String(condition.value ?? '')}`;
}

function normalizeConditionValue(value: unknown) {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function hasLinearEdgesOnly(graph: RoleWorkflowGraph) {
  if (graph.edges.length !== Math.max(0, graph.nodes.length - 1)) return false;
  return graph.edges.every((edge) => !edge.condition || edge.condition.type === 'always');
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

function normalizeSkills(values?: SkillForm[]) {
  return (values ?? [])
    .map((skill) => ({
      code: skill.code?.trim() ?? '',
      name: skill.name?.trim() ?? '',
      summary: skill.summary?.trim() ?? ''
    }))
    .filter((skill) => skill.code && skill.name && skill.summary);
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

function nodeTone(type: RoleWorkflowGraphNode['type']) {
  if (type === 'llm' || type === 'reasoning') return 'blue';
  if (type === 'tool' || type === 'artifact') return 'purple';
  if (type === 'knowledge') return 'green';
  if (type === 'output') return 'gold';
  return 'default';
}

function traceStatusTone(status: 'passed' | 'warning' | 'failed') {
  if (status === 'passed') return 'green';
  if (status === 'failed') return 'red';
  return 'gold';
}

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

function WorkflowCanvasEditor({
  graph,
  onChange
}: {
  graph: RoleWorkflowGraph;
  onChange: (graph: RoleWorkflowGraph) => void;
}) {
  const [selection, setSelection] = useState<{ type: 'node' | 'edge'; id: string }>({
    type: 'node',
    id: graph.entryNodeId
  });
  const [draggingNodeId, setDraggingNodeId] = useState<string>();
  const [newEdgeSourceId, setNewEdgeSourceId] = useState(graph.entryNodeId);
  const [newEdgeTargetId, setNewEdgeTargetId] = useState(graph.nodes.find((node) => node.id !== graph.entryNodeId)?.id ?? graph.entryNodeId);
  const selectedNode =
    selection.type === 'node'
      ? graph.nodes.find((node) => node.id === selection.id) ?? graph.nodes[0]
      : undefined;
  const selectedEdge =
    selection.type === 'edge'
      ? graph.edges.find((edge) => edge.id === selection.id) ?? graph.edges[0]
      : undefined;
  const nodeWidth = 180;
  const nodeHeight = 92;
  const nodeGap = 76;
  const canvasPadding = 28;
  const canvasWidth = Math.max(760, graph.nodes.length * (nodeWidth + nodeGap) + canvasPadding * 2);
  const canvasHeight = 340;
  const nodeOptions = graph.nodes.map((node) => ({
    value: node.id,
    label: `${node.name} / ${node.id}`
  }));

  const nodePositions = useMemo(
    () =>
      new Map(
        graph.nodes.map((node, index) => [
          node.id,
          {
            x: canvasPadding + index * (nodeWidth + nodeGap),
            y: index % 2 === 0 ? 54 : 146
          }
        ] as const)
      ),
    [graph.nodes, canvasPadding]
  );

  useEffect(() => {
    const selectedNodeExists = selection.type === 'node' && graph.nodes.some((node) => node.id === selection.id);
    const selectedEdgeExists = selection.type === 'edge' && graph.edges.some((edge) => edge.id === selection.id);
    if (!selectedNodeExists && !selectedEdgeExists) {
      setSelection({ type: 'node', id: graph.entryNodeId });
    }
  }, [graph, selection]);

  function updateNode(nodeId: string, patch: Partial<RoleWorkflowGraphNode>) {
    onChange({
      ...graph,
      nodes: graph.nodes.map((node) => (node.id === nodeId ? { ...node, ...patch } : node))
    });
  }

  function updateEdge(edgeId: string, patch: Partial<WorkflowEdge>) {
    onChange({
      ...graph,
      edges: graph.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge))
    });
  }

  function updateToolNodeToolId(node: RoleWorkflowGraphNode, toolId?: string) {
    if (!toolId) {
      updateNode(node.id, {
        toolId: undefined,
        config: undefined
      });
      return;
    }

    const template = getDefaultToolActionTemplate(toolId);
    updateNode(node.id, {
      toolId,
      config: template
        ? buildToolNodeConfig(node, {
            action: template.value,
            input: template.defaults
          })
        : node.config
    });
  }

  function updateToolNodeAction(node: RoleWorkflowGraphNode, action: string) {
    const template = getSelectedToolActionTemplate(node.toolId, action);
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

  function updateToolNodeConfigInput(node: RoleWorkflowGraphNode, value: Record<string, unknown>) {
    updateNode(node.id, {
      config: buildToolNodeConfig(node, {
        input: value
      })
    });
  }

  function addNode(type: WorkflowNodeType) {
    const node = createCanvasNode(type, graph.nodes);
    const selectedNodeIndex = graph.nodes.findIndex((item) => item.id === selectedNode?.id);
    const insertIndex = selectedNodeIndex >= 0 ? selectedNodeIndex + 1 : graph.nodes.length;
    const nodes = [
      ...graph.nodes.slice(0, insertIndex),
      node,
      ...graph.nodes.slice(insertIndex)
    ];
    const sourceNodeId = selectedNode?.id ?? graph.entryNodeId;
    const edges: WorkflowEdge[] = graph.edges.some((edge) => edge.sourceNodeId === sourceNodeId && edge.targetNodeId === node.id)
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
    setNewEdgeTargetId(node.id);
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

  function addEdge() {
    if (newEdgeSourceId === newEdgeTargetId) {
      message.warning('连线的起点和终点不能相同');
      return;
    }
    if (graph.edges.some((edge) => edge.sourceNodeId === newEdgeSourceId && edge.targetNodeId === newEdgeTargetId)) {
      message.warning('这条连线已经存在');
      return;
    }

    const edge: WorkflowEdge = {
      id: createWorkflowEdgeId(newEdgeSourceId, newEdgeTargetId, graph.edges),
      sourceNodeId: newEdgeSourceId,
      targetNodeId: newEdgeTargetId,
      condition: { type: 'always' }
    };
    onChange({ ...graph, edges: [...graph.edges, edge] });
    setSelection({ type: 'edge', id: edge.id });
  }

  function deleteEdge(edgeId: string) {
    onChange({
      ...graph,
      edges: graph.edges.filter((edge) => edge.id !== edgeId)
    });
    setSelection({ type: 'node', id: graph.entryNodeId });
  }

  function moveNode(dragNodeId: string, targetNodeId: string) {
    if (dragNodeId === targetNodeId || dragNodeId === graph.entryNodeId || targetNodeId === graph.entryNodeId) {
      return;
    }

    const nodes = [...graph.nodes];
    const fromIndex = nodes.findIndex((node) => node.id === dragNodeId);
    const toIndex = nodes.findIndex((node) => node.id === targetNodeId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [draggedNode] = nodes.splice(fromIndex, 1);
    if (!draggedNode) return;
    nodes.splice(toIndex, 0, draggedNode);
    const nextGraph = { ...graph, nodes };
    onChange(hasLinearEdgesOnly(graph) ? rebuildLinearEdges(nextGraph) : nextGraph);
  }

  function resetLinearEdges() {
    onChange(rebuildLinearEdges(graph));
    message.success('已按当前节点顺序重建连线');
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
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 16 }}>
      <div
        style={{
          minHeight: canvasHeight,
          overflow: 'auto',
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          background:
            'linear-gradient(#f8fafc 1px, transparent 1px), linear-gradient(90deg, #f8fafc 1px, transparent 1px)',
          backgroundColor: '#ffffff',
          backgroundSize: '24px 24px'
        }}
      >
        <div style={{ position: 'sticky', left: 0, top: 0, zIndex: 5, display: 'flex', gap: 8, alignItems: 'center', padding: 10, borderBottom: '1px solid #eef2f7', background: 'rgba(255,255,255,0.92)' }}>
          <Select
            size="small"
            value="llm"
            style={{ width: 128 }}
            options={workflowNodeTypeOptions.filter((option) => option.value !== 'start')}
            onChange={(type) => addNode(type as WorkflowNodeType)}
          />
          <Button size="small" icon={<PlusOutlined />} onClick={() => addNode('llm')}>
            添加节点
          </Button>
          <Button size="small" onClick={resetLinearEdges}>
            顺序重连
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            拖拽节点调整位置，运行路径以连线为准。
          </Typography.Text>
        </div>
        <svg
          width={canvasWidth}
          height={canvasHeight}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <defs>
            <marker id="workflow-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = nodePositions.get(edge.sourceNodeId);
            const target = nodePositions.get(edge.targetNodeId);
            if (!source || !target) {
              return null;
            }

            const startX = source.x + nodeWidth;
            const startY = source.y + nodeHeight / 2;
            const endX = target.x;
            const endY = target.y + nodeHeight / 2;
            const controlOffset = Math.max(48, (endX - startX) / 2);

            return (
              <path
                key={edge.id}
                d={`M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`}
                fill="none"
                stroke="#94a3b8"
                strokeWidth={2}
                markerEnd="url(#workflow-arrow)"
              />
            );
          })}
        </svg>

        <div style={{ position: 'relative', width: canvasWidth, height: canvasHeight }}>
          {graph.edges.map((edge) => {
            const source = nodePositions.get(edge.sourceNodeId);
            const target = nodePositions.get(edge.targetNodeId);
            if (!source || !target) return null;
            const left = source.x + nodeWidth + Math.max(8, (target.x - source.x - nodeWidth) / 2) - 48;
            const top = (source.y + target.y) / 2 + nodeHeight / 2 - 12;
            const active = selectedEdge?.id === edge.id;

            return (
              <button
                key={`${edge.id}-label`}
                type="button"
                onClick={() => setSelection({ type: 'edge', id: edge.id })}
                style={{
                  position: 'absolute',
                  left,
                  top,
                  maxWidth: 160,
                  height: 24,
                  padding: '0 8px',
                  border: `1px solid ${active ? '#1677ff' : '#cbd5e1'}`,
                  borderRadius: 999,
                  background: active ? '#eff6ff' : '#ffffff',
                  color: '#475569',
                  fontSize: 12,
                  cursor: 'pointer',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {formatConditionLabel(edge.condition)}
              </button>
            );
          })}

          {graph.nodes.map((node, index) => {
            const position = nodePositions.get(node.id) ?? { x: canvasPadding, y: canvasPadding };
            const active = node.id === selectedNode?.id;
            return (
              <button
                key={node.id}
                type="button"
                draggable={node.id !== graph.entryNodeId}
                onDragStart={() => setDraggingNodeId(node.id)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingNodeId) moveNode(draggingNodeId, node.id);
                  setDraggingNodeId(undefined);
                }}
                onClick={() => setSelection({ type: 'node', id: node.id })}
                style={{
                  position: 'absolute',
                  left: position.x,
                  top: position.y,
                  width: nodeWidth,
                  height: nodeHeight,
                  padding: 12,
                  textAlign: 'left',
                  border: `1px solid ${active ? '#1677ff' : '#dbe2ea'}`,
                  borderRadius: 8,
                  background: active ? '#eff6ff' : '#ffffff',
                  boxShadow: active ? '0 8px 22px rgba(22, 119, 255, 0.14)' : '0 6px 16px rgba(15, 23, 42, 0.08)',
                  cursor: node.id === graph.entryNodeId ? 'pointer' : 'grab'
                }}
              >
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Space size={6}>
                    <Tag>{index + 1}</Tag>
                    <Tag color={nodeTone(node.type)}>{node.type}</Tag>
                  </Space>
                  <Typography.Text strong ellipsis style={{ maxWidth: 150 }}>
                    {node.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis style={{ maxWidth: 150 }}>
                    {node.toolId ?? node.artifactType ?? node.modelProfileId ?? node.id}
                  </Typography.Text>
                </Space>
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: '#fff' }}>
        {selectedNode ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={nodeTone(selectedNode.type)}>{selectedNode.type}</Tag>
              {selectedNode.requiresApproval ? <Tag color="orange">approval</Tag> : null}
            </Space>
            <Typography.Text strong>节点配置</Typography.Text>
            <Input size="small" value={selectedNode.id} disabled addonBefore="ID" />
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
              onChange={(type) =>
                updateNode(selectedNode.id, {
                  type,
                  toolId:
                    type === 'tool'
                      ? selectedNode.toolId ?? 'office-document'
                      : type === 'artifact'
                        ? selectedNode.toolId ?? 'office-document'
                        : selectedNode.toolId,
                  modelProfileId:
                    type === 'llm' || type === 'reasoning'
                      ? selectedNode.modelProfileId ?? 'qiu-general-default'
                      : selectedNode.modelProfileId,
                  artifactType: type === 'artifact' ? selectedNode.artifactType ?? 'docx' : selectedNode.artifactType,
                  requiresApproval: type === 'approval' ? true : selectedNode.requiresApproval,
                  config:
                    type === 'tool'
                      ? buildToolNodeConfig(selectedNode, {
                          action:
                            getSelectedToolActionTemplate(
                              selectedNode.toolId ?? 'office-document',
                              String(selectedNode.config?.action ?? '')
                            )?.value ?? getDefaultToolActionTemplate(selectedNode.toolId ?? 'office-document')?.value,
                          input:
                            getSelectedToolActionTemplate(
                              selectedNode.toolId ?? 'office-document',
                              String(selectedNode.config?.action ?? '')
                            )?.defaults ?? selectedNode.config?.input ?? {}
                        })
                      : selectedNode.config
                })
              }
            />
            <Input.TextArea
              rows={3}
              value={selectedNode.instruction ?? ''}
              placeholder="节点执行说明"
              onChange={(event) => updateNode(selectedNode.id, { instruction: event.target.value })}
            />
            <Select
              size="small"
              allowClear
              showSearch
              value={selectedNode.modelProfileId}
              placeholder="模型要求（PC 端安装时配置 API Key）"
              options={modelProfileOptions}
              optionFilterProp="label"
              onChange={(modelProfileId) => updateNode(selectedNode.id, { modelProfileId })}
            />
            <Select
              size="small"
              allowClear
              value={selectedNode.toolId}
              placeholder="工具 ID"
              options={toolOptions}
              onChange={(toolId) => updateToolNodeToolId(selectedNode, toolId)}
            />
            <Select
              size="small"
              allowClear
              value={selectedNode.artifactType}
              placeholder="产物格式"
              options={artifactTypeOptions}
              onChange={(artifactType) => updateNode(selectedNode.id, { artifactType })}
            />
            <Select
              size="small"
              mode="tags"
              value={selectedNode.inputVariables ?? []}
              placeholder="输入变量"
              tokenSeparators={[',']}
              onChange={(inputVariables) => updateNode(selectedNode.id, { inputVariables })}
            />
            <Select
              size="small"
              mode="tags"
              value={selectedNode.outputVariables ?? []}
              placeholder="输出变量"
              tokenSeparators={[',']}
              onChange={(outputVariables) => updateNode(selectedNode.id, { outputVariables })}
            />
            <Select
              size="small"
              value={selectedNode.requiresApproval ? 'true' : 'false'}
              options={[
                { value: 'false', label: '无需人工确认' },
                { value: 'true', label: '需要人工确认' }
              ]}
              onChange={(value) => updateNode(selectedNode.id, { requiresApproval: value === 'true' })}
            />
            {selectedNode.type === 'tool' ? (
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text strong>工具参数</Typography.Text>
                <Select
                  size="small"
                  value={String(selectedNode.config?.action ?? getDefaultToolActionTemplate(selectedNode.toolId ?? '')?.value ?? '')}
                  options={(toolActionTemplatesByToolId[selectedNode.toolId ?? ''] ?? []).map((template) => ({
                    value: template.value,
                    label: template.label
                  }))}
                  onChange={(action) => updateToolNodeAction(selectedNode, action)}
                />
                {(getSelectedToolActionTemplate(selectedNode.toolId, String(selectedNode.config?.action ?? ''))?.fields ?? []).map((field) => {
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
                    return (
                      <Input.TextArea
                        key={field.key}
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
                    );
                  }

                  return (
                    <Input
                      key={field.key}
                      size="small"
                      value={typeof fieldValue === 'string' ? fieldValue : stringifyJsonConfigValue(fieldValue)}
                      addonBefore={field.label}
                      placeholder={field.placeholder}
                      onChange={(event) => updateToolNodeField(selectedNode, field.key, event.target.value)}
                    />
                  );
                })}
              </Space>
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
          </Space>
        ) : null}

        {selectedEdge ? (
          <Space direction="vertical" size={10} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color="cyan">edge</Tag>
              <Tag>{formatConditionLabel(selectedEdge.condition)}</Tag>
            </Space>
            <Typography.Text strong>连线配置</Typography.Text>
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
            <Select
              size="small"
              value={selectedEdge.condition?.type ?? 'always'}
              options={conditionTypeOptions}
              onChange={updateSelectedEdgeConditionType}
            />
            {selectedEdge.condition?.type && selectedEdge.condition.type !== 'always' && selectedEdge.condition.type !== 'expression' ? (
              <>
                <Input
                  size="small"
                  value={selectedEdge.condition.variable ?? ''}
                  addonBefore="变量"
                  placeholder="start.text / draft_result.text"
                  onChange={(event) =>
                    updateEdge(selectedEdge.id, {
                      condition: {
                        ...selectedEdge.condition,
                        type: selectedEdge.condition?.type ?? 'exists',
                        variable: event.target.value
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
            <Button danger size="small" icon={<DeleteOutlined />} onClick={() => deleteEdge(selectedEdge.id)}>
              删除连线
            </Button>
          </Space>
        ) : null}

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #eef2f7' }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Typography.Text strong>新增连线</Typography.Text>
            <Select size="small" value={newEdgeSourceId} options={nodeOptions} onChange={setNewEdgeSourceId} />
            <Select size="small" value={newEdgeTargetId} options={nodeOptions} onChange={setNewEdgeTargetId} />
            <Button size="small" type="primary" onClick={addEdge}>
              添加连线
            </Button>
          </Space>
        </div>
      </div>
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
    knowledgeSources: uniqueTags(values.knowledgeSources),
    tools: uniqueTags([...uniqueTags(values.tools), ...inferredTools, ...readWorkflowGraphToolIds(workflowGraph)]),
    skills: normalizeSkills(values.skills),
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
    knowledgeSources: uniqueTags(values.knowledgeSources),
    tools: uniqueTags([...uniqueTags(values.tools), ...inferredTools, ...readWorkflowGraphToolIds(workflowGraph)]),
    skills: normalizeSkills(values.skills),
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
  templateId
}: AdminCreateRoleTemplatePageClientProps) {
  const router = useRouter();
  const [form] = Form.useForm<CreateRoleTemplateFormValues>();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [savedTemplateId, setSavedTemplateId] = useState<string | undefined>(templateId);
  const [testInput, setTestInput] = useState('');
  const [testResult, setTestResult] = useState<TemplateTestResult | null>(null);
  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates]
  );
  const persistedTemplateId = savedTemplateId ?? editingTemplate?.id;
  const selectedPreset = Form.useWatch('workflowPreset', form) ?? 'standard';
  const initialGraph = useMemo(
    () => editingTemplate?.workflowGraph ?? createWorkflowGraph(inferInitialPreset(editingTemplate)),
    [editingTemplate]
  );
  const [editableGraph, setEditableGraph] = useState<RoleWorkflowGraph>(initialGraph);

  const activeEnterprisePlans = useMemo(
    () => plans.filter((plan) => plan.status === 'ACTIVE' && plan.billingCycle !== 'FREE'),
    [plans]
  );
  const defaultPlanCode = activeEnterprisePlans[0]?.code ?? plans[0]?.code ?? '';

  const planOptions = useMemo(
    () => plans.map((plan) => ({ value: plan.code, label: `${plan.name} / ${plan.code}` })),
    [plans]
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
        recommendedPlanCode: editingTemplate.recommendedPlanCode,
        approvalPolicy: editingTemplate.approvalPolicy,
        outputFormat: editingTemplate.outputFormat,
        workflowPreset: inferInitialPreset(editingTemplate),
        knowledgeSources: editingTemplate.knowledgeSources,
        tools: editingTemplate.tools,
        skills: editingTemplate.skills,
        sampleInputs: editingTemplate.sampleInputs,
        allowedPlanCodes: editingTemplate.allowedPlanCodes,
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
  }, [activeEnterprisePlans, defaultPlanCode, editingTemplate]);

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

  async function handleSave(values: CreateRoleTemplateFormValues) {
    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const wasUpdate = Boolean(savedTemplateId ?? editingTemplate?.id);
      const response = await persistTemplateDraft(apiClient, values);
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
    const values = form.getFieldsValue();
    const sampleInput = uniqueTags(values.sampleInputs)[0] ?? values.businessGoal?.trim();
    if (!sampleInput) {
      message.warning('请先填写测试样例或业务目标');
      return;
    }
    setTestInput(sampleInput);
  }

  async function handleSaveAndTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const values = await form.validateFields();
      const apiClient = createBrowserApiClient();
      const response = await persistTemplateDraft(apiClient, values);
      setSavedTemplateId(response.data.id);
      const sampleInput = testInput.trim() || uniqueTags(values.sampleInputs)[0] || values.businessGoal.trim();
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
            <Button icon={<PlayCircleOutlined />} loading={testing} onClick={handleSaveAndTest}>
              保存草稿并测试
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>
              {editingTemplate ? '保存画布' : '保存草稿'}
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message={editingTemplate ? '当前正在编辑已有数字员工' : '先创建草稿，再到数字员工列表中测试和上架'}
            description="工作画布会维护数字员工的基础信息、能力配置、工作流预览和发布范围。复杂节点、条件和工具参数后续继续强化。"
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={initialValues}
          >
            <Card title="工作流画布" bordered={false} style={{ marginBottom: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16 }}>
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Form.Item name="workflowPreset" label="流程预设" rules={[{ required: true }]}>
                    <Select
                      disabled={Boolean(persistedTemplateId)}
                      options={workflowPresetOptions.map((option) => ({
                        value: option.value,
                        label: option.label
                      }))}
                      onChange={(preset) => setEditableGraph(createWorkflowGraph(preset))}
                    />
                  </Form.Item>
                  {workflowPresetOptions
                    .filter((option) => option.value === selectedPreset)
                    .map((option) => (
                      <Alert key={option.value} type="info" showIcon message={option.label} description={option.description} />
                    ))}
                  <Typography.Text type="secondary">
                    点击节点配置执行参数，点击连线配置分支条件。拖拽节点只调整画布顺序，真实运行路径以连线为准。
                  </Typography.Text>
                </Space>
                <WorkflowCanvasEditor graph={editableGraph} onChange={setEditableGraph} />
              </div>
            </Card>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16 }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="基础信息" bordered={false}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
                    <Form.Item name="id" label="员工 ID" rules={[{ required: true, message: '请输入员工 ID' }]}>
                      <Input disabled={Boolean(persistedTemplateId)} placeholder="template_sales_assistant" />
                    </Form.Item>
                    <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
                      <Input placeholder="1.0.0" />
                    </Form.Item>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Card>

                <Card title="能力配置" bordered={false}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="knowledgeSources" label="知识来源">
                      <Select mode="tags" tokenSeparators={[',']} options={knowledgeOptions} />
                    </Form.Item>
                    <Form.Item name="tools" label="工具">
                      <Select mode="tags" tokenSeparators={[',']} options={toolOptions} />
                    </Form.Item>
                  </div>

                  <Form.List name="skills">
                    {(fields, { add, remove }) => (
                      <Space direction="vertical" size={12} style={{ width: '100%' }}>
                        {fields.map((field) => (
                          <Card key={field.key} size="small" bordered>
                            <div style={{ display: 'grid', gridTemplateColumns: '160px 180px 1fr 72px', gap: 12 }}>
                              <Form.Item
                                {...field}
                                name={[field.name, 'code']}
                                label="code"
                                rules={[{ required: true, message: '请输入 code' }]}
                              >
                                <Input placeholder="lead_research" />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'name']}
                                label="名称"
                                rules={[{ required: true, message: '请输入名称' }]}
                              >
                                <Input placeholder="线索调研" />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'summary']}
                                label="说明"
                                rules={[{ required: true, message: '请输入说明' }]}
                              >
                                <Input placeholder="搜索并整理潜在线索背景。" />
                              </Form.Item>
                              <Button danger style={{ marginTop: 30 }} onClick={() => remove(field.name)}>
                                删除
                              </Button>
                            </div>
                          </Card>
                        ))}
                        <Button type="dashed" onClick={() => add({ code: '', name: '', summary: '' })} block>
                          添加技能
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </Card>

                <Card title="发布范围" bordered={false}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
                </Card>
              </Space>

              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="测试与输出" bordered={false}>
                  <Form.Item name="sampleInputs" label="测试样例">
                    <Select mode="tags" tokenSeparators={[',']} placeholder="输入一个样例任务后回车" />
                  </Form.Item>
                  <Space direction="vertical" size={8} style={{ width: '100%', marginBottom: 16 }}>
                    <Typography.Text strong>本次测试输入</Typography.Text>
                    <Input.TextArea
                      rows={4}
                      value={testInput}
                      placeholder="输入一条真实任务，例如：帮我根据附件生成一份客户跟进方案"
                      onChange={(event) => setTestInput(event.target.value)}
                    />
                    <Space wrap>
                      <Button size="small" onClick={useFirstSampleInput}>
                        使用第一个样例
                      </Button>
                      <Button
                        size="small"
                        type="primary"
                        icon={<PlayCircleOutlined />}
                        loading={testing}
                        onClick={handleSaveAndTest}
                      >
                        保存草稿并测试
                      </Button>
                    </Space>
                    <Typography.Text type="secondary">
                      测试会先保存当前画布，再调用服务端校验接口生成节点 trace。
                    </Typography.Text>
                  </Space>
                  <Form.Item name="outputFormat" label="输出格式">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item
                    name="approvalPolicy"
                    label="审批策略"
                    rules={[{ required: true, message: '请输入审批策略' }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Card>

                <Card bordered={false}>
                  {testResult ? (
                    <WorkflowTestTracePanel result={testResult} />
                  ) : (
                    <Space direction="vertical" size={8}>
                      <Typography.Text strong>保存后下一步</Typography.Text>
                      <Typography.Text type="secondary">
                        在这里测试通过后，到 <Link href="/templates">数字员工</Link> 列表中上架。
                      </Typography.Text>
                    </Space>
                  )}
                </Card>
              </Space>
            </div>
          </Form>
        </Space>
      </QiuPage>
    </AdminShell>
  );
}
