'use client';

import {
  CheckCircleOutlined,
  EditOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import type {
  AdminPlanDetail,
  AdminRoleTemplateDetail,
  AdminRoleTemplateTestGraphTrace,
  AdminWorkspaceSummary,
  CreateAdminRoleTemplateRequest,
  CurrentAccountResponse,
  RoleWorkflowGraph,
  RoleTemplateStepType,
  UpdateAdminRoleTemplateRequest
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Divider from 'antd/es/divider';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminRoleTemplatesPageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
}

type RoleTemplateSkillForm = {
  code?: string;
  name?: string;
  summary?: string;
};

type RoleTemplateWorkflowStepForm = {
  id?: string;
  order?: number;
  type?: RoleTemplateStepType;
  name?: string;
  instruction?: string;
  toolIds?: string[];
  requiresApproval?: boolean;
};

type WorkflowGraphNodeForm = {
  id?: string;
  type?: RoleWorkflowGraph['nodes'][number]['type'];
  name?: string;
  description?: string;
  instruction?: string;
  modelProfileId?: string;
  toolId?: string;
  artifactType?: RoleWorkflowGraph['nodes'][number]['artifactType'];
  inputVariables?: string[];
  outputVariables?: string[];
  requiresApproval?: boolean;
  configJson?: string;
};

type WorkflowGraphEdgeForm = {
  id?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  condition?: {
    type?: NonNullable<RoleWorkflowGraph['edges'][number]['condition']>['type'];
    variable?: string;
    valueJson?: string;
    expression?: string;
  };
};

type WorkflowGraphForm = {
  entryNodeId?: string;
  nodes?: WorkflowGraphNodeForm[];
  edges?: WorkflowGraphEdgeForm[];
  variablesJson?: string;
  runtimePolicy?: {
    maxNodeExecutions?: number;
    maxLoopIterations?: number;
    requireApprovalBeforeTools?: boolean;
  };
};

type RoleTemplateFormValues = {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources?: string[];
  tools?: string[];
  skills?: RoleTemplateSkillForm[];
  workflowSteps?: RoleTemplateWorkflowStepForm[];
  workflowGraph?: WorkflowGraphForm;
  sampleInputs?: string[];
  outputFormat?: string;
  approvalPolicy: string;
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
};

type TemplateTestNotice = {
  templateName: string;
  valid: boolean;
  status: 'passed' | 'failed';
  message: string;
  warnings: string[];
  sampleInput?: string;
  graphTrace?: AdminRoleTemplateTestGraphTrace;
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

const workflowStepTypeOptions: Array<{ value: RoleTemplateStepType; label: string }> = [
  { value: 'input', label: '输入' },
  { value: 'knowledge', label: '知识' },
  { value: 'reasoning', label: '分析' },
  { value: 'tool', label: '工具' },
  { value: 'approval', label: '审批' },
  { value: 'output', label: '输出' }
];

const workflowGraphNodeTypeOptions: Array<{
  value: RoleWorkflowGraph['nodes'][number]['type'];
  label: string;
}> = [
  { value: 'start', label: 'Start' },
  { value: 'input', label: 'Input' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'reasoning', label: 'Reasoning' },
  { value: 'llm', label: 'LLM' },
  { value: 'assign', label: 'Assign' },
  { value: 'template', label: 'Template' },
  { value: 'tool', label: 'Tool' },
  { value: 'condition', label: 'Condition' },
  { value: 'artifact', label: 'Artifact' },
  { value: 'approval', label: 'Approval' },
  { value: 'output', label: 'Output' }
];

const workflowGraphConditionOptions: Array<{
  value: NonNullable<RoleWorkflowGraph['edges'][number]['condition']>['type'];
  label: string;
}> = [
  { value: 'always', label: 'Always' },
  { value: 'equals', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'exists', label: 'Exists' },
  { value: 'expression', label: 'Expression' }
];

const artifactTypeOptions: Array<{
  value: NonNullable<RoleWorkflowGraph['nodes'][number]['artifactType']>;
  label: string;
}> = (['markdown', 'docx', 'xlsx', 'pptx', 'pdf', 'png', 'jpg', 'csv', 'zip'] as const).map((value) => ({
  value,
  label: value
}));

type WorkflowGraphPresetType = 'standard' | 'branching' | 'document';

function normalizeTags(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalizeSkills(values?: RoleTemplateSkillForm[]) {
  return (values ?? [])
    .map((skill) => ({
      code: skill.code?.trim() ?? '',
      name: skill.name?.trim() ?? '',
      summary: skill.summary?.trim() ?? ''
    }))
    .filter((skill) => skill.code && skill.name && skill.summary);
}

function normalizeWorkflowSteps(values?: RoleTemplateWorkflowStepForm[]) {
  return (values ?? [])
    .map((step, index) => ({
      id: step.id?.trim() ?? '',
      order: Number.isInteger(step.order) && Number(step.order) > 0 ? Number(step.order) : index + 1,
      type: step.type ?? 'reasoning',
      name: step.name?.trim() ?? '',
      instruction: step.instruction?.trim() ?? '',
      toolIds: normalizeTags(step.toolIds),
      requiresApproval: Boolean(step.requiresApproval)
    }))
    .filter((step) => step.id && step.name && step.instruction)
    .sort((left, right) => left.order - right.order);
}

function buildWorkflowGraphFormFromSteps(values?: RoleTemplateWorkflowStepForm[]): WorkflowGraphForm {
  const steps = normalizeWorkflowSteps(values);
  const toolIds = normalizeTags(steps.flatMap((step) => step.toolIds ?? []));
  const hasWebSearch = toolIds.includes('web-search');
  const hasKnowledgeStep = steps.some((step) => step.type === 'knowledge');
  const artifactType = inferWorkflowGraphArtifactTypeFromSteps(steps);
  const sourceInstruction = steps
    .map((step) => `${step.order}. ${step.name}: ${step.instruction}`)
    .join('\n');
  const nodes: WorkflowGraphNodeForm[] = [
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
      outputVariables: ['task_brief']
    },
    ...(hasKnowledgeStep
      ? [
          {
            id: 'gather_context',
            type: 'knowledge' as const,
            name: 'Gather context',
            instruction: 'Read available enterprise and local knowledge context before drafting.',
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
            configJson: JSON.stringify({
              action: 'web.search',
              input: {
                query: '{{start.text}}',
                maxResults: 5
              }
            })
          }
        ]
      : []),
    {
      id: 'draft_result',
      type: 'llm',
      name: 'Draft result',
      instruction:
        sourceInstruction ||
        'Complete the digital employee task and produce a practical business-ready result.',
      inputVariables: [
        'start.text',
        hasKnowledgeStep ? 'gather_context.text' : undefined,
        hasWebSearch ? 'web_research.text' : undefined
      ].filter((value): value is string => Boolean(value)),
      outputVariables: ['draft_text']
    },
    {
      id: 'write_artifact',
      type: 'artifact',
      name: 'Write deliverable',
      instruction: `Write the final deliverable as ${artifactType}.`,
      toolId: 'office-document',
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

  const edges: WorkflowGraphEdgeForm[] = [];
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
    previousNodeId = node.id ?? previousNodeId;
  }

  return {
    entryNodeId: 'start',
    nodes,
    edges,
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false
    }
  };
}

function buildWorkflowGraphPreset(type: WorkflowGraphPresetType, steps?: RoleTemplateWorkflowStepForm[]): WorkflowGraphForm {
  if (type === 'standard') {
    return buildWorkflowGraphFormFromSteps(steps);
  }

  if (type === 'document') {
    return {
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start', description: 'Workflow entry node.' },
        {
          id: 'extract_file',
          type: 'tool',
          name: 'Extract file',
          instruction: 'Read the first attached file and extract readable text.',
          toolId: 'office-document',
          inputVariables: ['start.files'],
          outputVariables: ['file_text'],
          configJson: JSON.stringify({
            action: 'document.extract_text',
            input: {
              path: '$start.files.0.localPath',
              maxChars: 30000
            }
          })
        },
        {
          id: 'analyze_file',
          type: 'llm',
          name: 'Analyze file',
          instruction: 'Analyze the extracted file content and produce a business-ready result.',
          inputVariables: ['start.text', 'extract_file.text'],
          outputVariables: ['analysis_text']
        },
        {
          id: 'write_artifact',
          type: 'artifact',
          name: 'Write deliverable',
          instruction: 'Write the final deliverable as docx.',
          toolId: 'office-document',
          artifactType: 'docx',
          inputVariables: ['analyze_file.text'],
          outputVariables: ['deliverable_file']
        },
        {
          id: 'final_output',
          type: 'output',
          name: 'Final response',
          instruction: 'Summarize the result and mention the generated local file path.',
          inputVariables: ['analyze_file.text', 'write_artifact.file'],
          outputVariables: ['final_answer']
        }
      ],
      edges: [
        { id: 'start__extract_file', sourceNodeId: 'start', targetNodeId: 'extract_file', condition: { type: 'always' } },
        { id: 'extract_file__analyze_file', sourceNodeId: 'extract_file', targetNodeId: 'analyze_file', condition: { type: 'always' } },
        { id: 'analyze_file__write_artifact', sourceNodeId: 'analyze_file', targetNodeId: 'write_artifact', condition: { type: 'always' } },
        { id: 'write_artifact__final_output', sourceNodeId: 'write_artifact', targetNodeId: 'final_output', condition: { type: 'always' } }
      ],
      runtimePolicy: {
        maxNodeExecutions: 64,
        maxLoopIterations: 8,
        requireApprovalBeforeTools: false
      }
    };
  }

  return {
    entryNodeId: 'start',
    variablesJson: JSON.stringify([{ name: 'intent', required: false }]),
    nodes: [
      { id: 'start', type: 'start', name: 'Start', description: 'Workflow entry node.' },
      {
        id: 'classify_intent',
        type: 'llm',
        name: 'Classify intent',
        instruction:
          'Return JSON only: {"intent":"research|document|fallback","query":"search query","reason":"short reason"}.',
        inputVariables: ['start.text', 'start.files'],
        outputVariables: ['intent_payload']
      },
      {
        id: 'route_intent',
        type: 'condition',
        name: 'Route intent',
        instruction: 'Choose the next branch by classify_intent.json.intent.'
      },
      {
        id: 'web_research',
        type: 'tool',
        name: 'Web research',
        instruction: 'Search external context for research-heavy tasks.',
        toolId: 'web-search',
        inputVariables: ['classify_intent.json.query'],
        outputVariables: ['web_context'],
        configJson: JSON.stringify({
          action: 'web.search',
          input: {
            query: '{{classify_intent.json.query}}',
            maxResults: 5
          }
        })
      },
      {
        id: 'draft_result',
        type: 'llm',
        name: 'Draft result',
        instruction: 'Produce the final business deliverable using task input, branch result, and available context.',
        inputVariables: ['start.text', 'classify_intent.json', 'web_research.text'],
        outputVariables: ['draft_text']
      },
      {
        id: 'write_artifact',
        type: 'artifact',
        name: 'Write deliverable',
        instruction: 'Write the final deliverable as docx.',
        toolId: 'office-document',
        artifactType: 'docx',
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
    ],
    edges: [
      { id: 'start__classify_intent', sourceNodeId: 'start', targetNodeId: 'classify_intent', condition: { type: 'always' } },
      { id: 'classify_intent__route_intent', sourceNodeId: 'classify_intent', targetNodeId: 'route_intent', condition: { type: 'always' } },
      {
        id: 'route_intent__web_research',
        sourceNodeId: 'route_intent',
        targetNodeId: 'web_research',
        condition: { type: 'equals', variable: 'classify_intent.json.intent', valueJson: '"research"' }
      },
      {
        id: 'route_intent__draft_result',
        sourceNodeId: 'route_intent',
        targetNodeId: 'draft_result',
        condition: { type: 'always' }
      },
      { id: 'web_research__draft_result', sourceNodeId: 'web_research', targetNodeId: 'draft_result', condition: { type: 'always' } },
      { id: 'draft_result__write_artifact', sourceNodeId: 'draft_result', targetNodeId: 'write_artifact', condition: { type: 'always' } },
      { id: 'write_artifact__final_output', sourceNodeId: 'write_artifact', targetNodeId: 'final_output', condition: { type: 'always' } }
    ],
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false
    }
  };
}

function inferWorkflowGraphPresetToolIds(type: WorkflowGraphPresetType, graph: WorkflowGraphForm): string[] {
  const graphToolIds = normalizeTags((graph.nodes ?? []).flatMap((node) => (node.toolId ? [node.toolId] : [])));
  const defaultToolIds = type === 'standard' ? [] : ['office-document'];
  return [...new Set([...graphToolIds, ...defaultToolIds])];
}

function inferWorkflowGraphArtifactTypeFromSteps(
  steps: RoleTemplateWorkflowStepForm[]
): NonNullable<RoleWorkflowGraph['nodes'][number]['artifactType']> {
  const text = steps
    .flatMap((step) => [step.id, step.name, step.instruction, ...(step.toolIds ?? [])])
    .join(' ')
    .toLowerCase();

  if (/\b(ppt|pptx|slides?|presentation)\b/.test(text)) {
    return 'pptx';
  }

  if (/\b(xlsx?|spreadsheet|csv|excel|finance|invoice|reimbursement|inventory|metrics?|dashboard|quote)\b/.test(text)) {
    return 'xlsx';
  }

  return 'docx';
}

function workflowGraphToForm(
  graph: RoleWorkflowGraph | undefined,
  fallbackSteps?: RoleTemplateWorkflowStepForm[]
): WorkflowGraphForm {
  if (!graph?.nodes?.length) {
    return buildWorkflowGraphFormFromSteps(fallbackSteps);
  }

  return {
    entryNodeId: graph.entryNodeId,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      name: node.name,
      description: node.description,
      instruction: node.instruction,
      modelProfileId: node.modelProfileId,
      toolId: node.toolId,
      artifactType: node.artifactType,
      inputVariables: node.inputVariables,
      outputVariables: node.outputVariables,
      requiresApproval: node.requiresApproval,
      configJson: node.config === undefined ? undefined : JSON.stringify(node.config)
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      condition: edge.condition
        ? {
            type: edge.condition.type,
            variable: edge.condition.variable,
            valueJson:
              edge.condition.value === undefined ? undefined : JSON.stringify(edge.condition.value),
            expression: edge.condition.expression
          }
        : undefined
    })),
    variablesJson: graph.variables === undefined ? undefined : JSON.stringify(graph.variables),
    runtimePolicy: graph.runtimePolicy
  };
}

function parseConditionValue(value?: string): unknown {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  try {
    return JSON.parse(normalized);
  } catch {
    return normalized;
  }
}

function parseJsonRecord(value?: string): Record<string, unknown> | undefined {
  const parsed = parseConditionValue(value);
  return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function parseWorkflowGraphVariables(value?: string): RoleWorkflowGraph['variables'] {
  const parsed = parseConditionValue(value);
  if (!Array.isArray(parsed)) {
    return undefined;
  }

  return parsed.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    if (!name) {
      return [];
    }

    return [
      {
        name,
        description: typeof record.description === 'string' ? record.description.trim() : undefined,
        required: typeof record.required === 'boolean' ? record.required : undefined,
        defaultValue: record.defaultValue
      }
    ];
  });
}

function normalizeWorkflowGraphForm(
  value: WorkflowGraphForm | undefined,
  fallbackSteps: RoleTemplateWorkflowStepForm[]
): RoleWorkflowGraph {
  const source = value?.nodes?.length ? value : buildWorkflowGraphFormFromSteps(fallbackSteps);
  const nodes = (source.nodes ?? [])
    .map((node) => ({
      id: node.id?.trim() ?? '',
      type: node.type ?? 'reasoning',
      name: node.name?.trim() ?? '',
      description: node.description?.trim() || undefined,
      instruction: node.instruction?.trim() || undefined,
      modelProfileId: node.modelProfileId?.trim() || undefined,
      toolId: node.toolId?.trim() || undefined,
      artifactType: node.artifactType,
      inputVariables: normalizeTags(node.inputVariables),
      outputVariables: normalizeTags(node.outputVariables),
      requiresApproval: Boolean(node.requiresApproval),
      config: parseJsonRecord(node.configJson)
    }))
    .filter((node) => node.id && node.name);

  const fallback = buildWorkflowGraphFormFromSteps(fallbackSteps);
  const safeNodes = nodes.length ? nodes : normalizeWorkflowGraphForm(fallback, []).nodes;
  const nodeIds = new Set(safeNodes.map((node) => node.id));
  const entryNodeId =
    source.entryNodeId?.trim() && nodeIds.has(source.entryNodeId.trim())
      ? source.entryNodeId.trim()
      : safeNodes[0]?.id ?? 'start';

  const edges: RoleWorkflowGraph['edges'] = [];
  for (const edge of source.edges ?? []) {
    const id = edge.id?.trim() ?? '';
    const sourceNodeId = edge.sourceNodeId?.trim() ?? '';
    const targetNodeId = edge.targetNodeId?.trim() ?? '';
    if (!id || !nodeIds.has(sourceNodeId) || !nodeIds.has(targetNodeId)) {
      continue;
    }

    const conditionType = edge.condition?.type;
    edges.push({
      id,
      sourceNodeId,
      targetNodeId,
      condition: conditionType
        ? {
            type: conditionType,
            variable: edge.condition?.variable?.trim() || undefined,
            value: parseConditionValue(edge.condition?.valueJson),
            expression: edge.condition?.expression?.trim() || undefined
          }
        : undefined
    });
  }

  return {
    version: '1.0.0',
    nodes: safeNodes,
    edges,
    entryNodeId,
    variables: parseWorkflowGraphVariables(source.variablesJson),
    runtimePolicy: {
      maxNodeExecutions: source.runtimePolicy?.maxNodeExecutions ?? 64,
      maxLoopIterations: source.runtimePolicy?.maxLoopIterations ?? 8,
      requireApprovalBeforeTools: Boolean(source.runtimePolicy?.requireApprovalBeforeTools)
    }
  };
}
function createDefaultWorkflowSteps(): RoleTemplateWorkflowStepForm[] {
  return [
    {
      id: 'receive_input',
      order: 1,
      type: 'input',
      name: '接收任务',
      instruction: '确认用户输入、目标、边界和交付物要求。'
    },
    {
      id: 'gather_context',
      order: 2,
      type: 'knowledge',
      name: '读取知识',
      instruction: '读取企业授权知识和本地资料，记录缺失信息。'
    },
    {
      id: 'analyze_plan',
      order: 3,
      type: 'reasoning',
      name: '分析计划',
      instruction: '拆解任务，确定处理路径、风险和需要调用的工具。'
    },
    {
      id: 'use_tools',
      order: 4,
      type: 'tool',
      name: '调用工具',
      instruction: '在必要时调用已授权工具，并把工具结果写入最终产物。',
      toolIds: ['office-document']
    },
    {
      id: 'deliver_output',
      order: 5,
      type: 'output',
      name: '输出结果',
      instruction: '输出结构化结果、依据、风险提示、下一步动作和本地文件路径。'
    }
  ];
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function statusTone(status: string): 'default' | 'processing' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'warning';
  if (status === 'DRAFT') return 'processing';
  return 'default';
}

function buildCreatePayload(values: RoleTemplateFormValues): CreateAdminRoleTemplateRequest {
  const allowedPlanCodes = normalizeTags(values.allowedPlanCodes);
  const visibleWorkspaceIds = normalizeTags(values.visibleWorkspaceIds);
  const workflowSteps = normalizeWorkflowSteps(values.workflowSteps);

  return {
    id: values.id.trim(),
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: normalizeTags(values.knowledgeSources),
    tools: normalizeTags(values.tools),
    skills: normalizeSkills(values.skills),
    workflowSteps,
    workflowGraph: normalizeWorkflowGraphForm(values.workflowGraph, workflowSteps),
    sampleInputs: normalizeTags(values.sampleInputs),
    outputFormat: values.outputFormat?.trim() || undefined,
    approvalPolicy: values.approvalPolicy.trim(),
    allowedPlanCodes: allowedPlanCodes.length ? allowedPlanCodes : undefined,
    visibleWorkspaceIds: visibleWorkspaceIds.length ? visibleWorkspaceIds : undefined
  };
}

function buildUpdatePayload(values: RoleTemplateFormValues): UpdateAdminRoleTemplateRequest {
  const workflowSteps = normalizeWorkflowSteps(values.workflowSteps);

  return {
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: normalizeTags(values.knowledgeSources),
    tools: normalizeTags(values.tools),
    skills: normalizeSkills(values.skills),
    workflowSteps,
    workflowGraph: normalizeWorkflowGraphForm(values.workflowGraph, workflowSteps),
    sampleInputs: normalizeTags(values.sampleInputs),
    outputFormat: values.outputFormat?.trim(),
    approvalPolicy: values.approvalPolicy.trim(),
    allowedPlanCodes: normalizeTags(values.allowedPlanCodes),
    visibleWorkspaceIds: normalizeTags(values.visibleWorkspaceIds)
  };
}

export function AdminRoleTemplatesPageClient({
  currentAccount,
  templates,
  plans,
  workspaces
}: AdminRoleTemplatesPageClientProps) {
  const [rows, setRows] = useState(templates);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AdminRoleTemplateDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);
  const [actionTemplateId, setActionTemplateId] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<TemplateTestNotice | null>(null);
  const [form] = Form.useForm<RoleTemplateFormValues>();
  const workflowGraphNodes = Form.useWatch(['workflowGraph', 'nodes'], form) as
    | WorkflowGraphNodeForm[]
    | undefined;

  useEffect(() => {
    setRows(templates);
  }, [templates]);

  const activePaidPlanCode = useMemo(
    () =>
      plans.find((plan) => plan.status === 'ACTIVE' && plan.billingCycle !== 'FREE')?.code ??
      plans[0]?.code ??
      '',
    [plans]
  );

  const planOptions = useMemo(
    () =>
      plans.map((plan) => ({
        value: plan.code,
        label: `${plan.name} / ${plan.code}`
      })),
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

  const planNameByCode = useMemo(
    () => new Map(plans.map((plan) => [plan.code, plan.name] as const)),
    [plans]
  );

  const workspaceNameById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name] as const)),
    [workspaces]
  );

  const workflowGraphNodeOptions = useMemo(
    () =>
      (workflowGraphNodes ?? [])
        .map((node) => node.id?.trim())
        .filter((id): id is string => Boolean(id))
        .map((id) => ({
          value: id,
          label: id
        })),
    [workflowGraphNodes]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((item) => item.status === 'PUBLISHED').length,
      draft: rows.filter((item) => item.status === 'DRAFT').length,
      archived: rows.filter((item) => item.status === 'ARCHIVED').length
    }),
    [rows]
  );

  function setEditorValues(template: AdminRoleTemplateDetail | null) {
    if (template) {
      form.setFieldsValue({
        id: template.id,
        version: template.version,
        name: template.name,
        industry: template.industry,
        scenario: template.scenario,
        description: template.description,
        recommendedPlanCode: template.recommendedPlanCode,
        businessGoal: template.businessGoal,
        knowledgeSources: template.knowledgeSources,
        tools: template.tools,
        skills: template.skills,
        workflowSteps: template.workflowSteps,
        workflowGraph: workflowGraphToForm(template.workflowGraph, template.workflowSteps),
        sampleInputs: template.sampleInputs,
        outputFormat: template.outputFormat,
        approvalPolicy: template.approvalPolicy,
        allowedPlanCodes: template.allowedPlanCodes,
        visibleWorkspaceIds: template.visibleWorkspaceIds
      });
      return;
    }

    const workflowSteps = createDefaultWorkflowSteps();

    form.setFieldsValue({
      id: 'template_',
      version: '1.0.0',
      name: '',
      industry: '',
      scenario: '',
      description: '',
      recommendedPlanCode: activePaidPlanCode,
      businessGoal: '',
      knowledgeSources: [],
      tools: [],
      skills: [{ code: '', name: '', summary: '' }],
      workflowSteps,
      workflowGraph: buildWorkflowGraphFormFromSteps(workflowSteps),
      sampleInputs: [],
      outputFormat: 'Markdown report with summary, findings, risks, next actions, and local artifact links.',
      approvalPolicy: '',
      allowedPlanCodes: activePaidPlanCode ? [activePaidPlanCode] : [],
      visibleWorkspaceIds: []
    });
  }

  function openCreate() {
    setEditingTemplate(null);
    form.resetFields();
    setEditorValues(null);
    setDrawerOpen(true);
  }

  function openEdit(template: AdminRoleTemplateDetail) {
    setEditingTemplate(template);
    form.resetFields();
    setEditorValues(template);
    setDrawerOpen(true);
  }

  function closeEditor() {
    setDrawerOpen(false);
    setEditingTemplate(null);
    form.resetFields();
  }

  function syncWorkflowGraphFromSteps() {
    const workflowSteps = form.getFieldValue('workflowSteps');
    const graph = buildWorkflowGraphPreset('standard', workflowSteps);
    form.setFieldValue('workflowGraph', graph);
    message.success('Workflow graph regenerated from steps.');
  }

  function applyWorkflowGraphPreset(type: WorkflowGraphPresetType) {
    const workflowSteps = form.getFieldValue('workflowSteps');
    const graph = buildWorkflowGraphPreset(type, workflowSteps);
    const currentTools = normalizeTags(form.getFieldValue('tools'));
    const presetToolIds = inferWorkflowGraphPresetToolIds(type, graph);

    form.setFieldsValue({
      tools: [...new Set([...currentTools, ...presetToolIds])],
      workflowGraph: graph
    });
    message.success('Workflow preset applied.');
  }

  function replaceRow(template: AdminRoleTemplateDetail) {
    setRows((current) => {
      const exists = current.some((item) => item.id === template.id);
      if (!exists) {
        return [template, ...current];
      }
      return current.map((item) => (item.id === template.id ? template : item));
    });
  }

  async function handleSave(values: RoleTemplateFormValues) {
    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const response = editingTemplate
        ? await apiClient.updateAdminRoleTemplate(editingTemplate.id, buildUpdatePayload(values))
        : await apiClient.createAdminRoleTemplate(buildCreatePayload(values));

      replaceRow(response.data);
      message.success(editingTemplate ? '数字员工已更新' : '数字员工已创建');
      closeEditor();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(template: AdminRoleTemplateDetail) {
    setTestingTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().testAdminRoleTemplate(template.id, {
        sampleInput: template.sampleInputs[0] ?? template.businessGoal
      });
      setTestNotice({
        templateName: template.name,
        ...response.data
      });
      message.success(response.data.valid ? '测试通过' : '测试未通过');
      replaceRow({
        ...template,
        lastTestedAt: new Date().toISOString()
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '测试失败');
    } finally {
      setTestingTemplateId(null);
    }
  }

  async function handlePublish(template: AdminRoleTemplateDetail) {
    setActionTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().publishAdminRoleTemplate(template.id);
      replaceRow(response.data);
      message.success('已上架');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上架失败');
    } finally {
      setActionTemplateId(null);
    }
  }

  async function handleArchive(template: AdminRoleTemplateDetail) {
    setActionTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().archiveAdminRoleTemplate(template.id);
      replaceRow(response.data);
      message.success('已下架');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '下架失败');
    } finally {
      setActionTemplateId(null);
    }
  }

  function renderPlans(values: string[]) {
    if (values.length === 0) {
      return <Typography.Text type="secondary">未限定套餐</Typography.Text>;
    }

    return (
      <Space size={[4, 4]} wrap>
        {values.slice(0, 3).map((code) => (
          <Tag key={code}>{planNameByCode.get(code) ?? code}</Tag>
        ))}
        {values.length > 3 ? <Tag>+{values.length - 3}</Tag> : null}
      </Space>
    );
  }

  function renderWorkspaces(values: string[]) {
    if (values.length === 0) {
      return <Typography.Text type="secondary">无白名单</Typography.Text>;
    }

    return (
      <Space size={[4, 4]} wrap>
        {values.slice(0, 2).map((id) => (
          <Tag key={id}>{workspaceNameById.get(id) ?? id}</Tag>
        ))}
        {values.length > 2 ? <Tag>+{values.length - 2}</Tag> : null}
      </Space>
    );
  }

  const columns: ColumnsType<AdminRoleTemplateDetail> = [
    {
      title: '数字员工',
      key: 'template',
      width: 260,
      render: (_value, template) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{template.name}</Typography.Text>
          <Typography.Text type="secondary">{template.id}</Typography.Text>
        </Space>
      )
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 90
    },
    {
      title: '场景',
      key: 'scenario',
      render: (_value, template) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{template.industry}</Typography.Text>
          <Typography.Text type="secondary">{template.scenario}</Typography.Text>
        </Space>
      )
    },
    {
      title: '推荐套餐',
      dataIndex: 'recommendedPlanCode',
      width: 170,
      render: (code: string) => <Tag color="blue">{planNameByCode.get(code) ?? code}</Tag>
    },
    {
      title: '可见范围',
      key: 'visibility',
      width: 260,
      render: (_value, template) => (
        <Space direction="vertical" size={4}>
          {renderPlans(template.allowedPlanCodes)}
          {renderWorkspaces(template.visibleWorkspaceIds)}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => <QiuStatusTag tone={statusTone(status)}>{status}</QiuStatusTag>
    },
    {
      title: '最近测试',
      dataIndex: 'lastTestedAt',
      width: 160,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 310,
      render: (_value, template) => (
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => openEdit(template)}>
            编辑
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            loading={testingTemplateId === template.id}
            onClick={() => handleTest(template)}
          >
            测试
          </Button>
          {template.status === 'PUBLISHED' ? (
            <Popconfirm
              title="确认下架这个数字员工？"
              okText="下架"
              cancelText="取消"
              onConfirm={() => handleArchive(template)}
            >
              <Button danger icon={<InboxOutlined />} loading={actionTemplateId === template.id}>
                下架
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={actionTemplateId === template.id}
              onClick={() => handlePublish(template)}
            >
              上架
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="数字员工"
        description="搭建、测试、上架。PC 端直接同步可用员工。"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建员工
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card bordered={false}>
            <Space size={32} wrap>
              <Typography.Text>总数：{counts.total}</Typography.Text>
              <Typography.Text>已上架：{counts.published}</Typography.Text>
              <Typography.Text>草稿：{counts.draft}</Typography.Text>
              <Typography.Text>已下架：{counts.archived}</Typography.Text>
            </Space>
          </Card>

          {testNotice ? (
            <Alert
              showIcon
              type={testNotice.valid ? 'success' : 'warning'}
              message={`${testNotice.templateName}：${testNotice.message}`}
              description={
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text>状态：{testNotice.status}</Typography.Text>
                  {testNotice.warnings.length ? (
                    <Typography.Text type="secondary">
                      提示：{testNotice.warnings.join('；')}
                    </Typography.Text>
                  ) : null}
                  {testNotice.graphTrace ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text strong>
                        节点预览：{testNotice.graphTrace.nodeCount} 个节点 /{' '}
                        {testNotice.graphTrace.edgeCount} 条连线
                      </Typography.Text>
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        {testNotice.graphTrace.nodes.map((node) => (
                          <Card key={node.nodeId} size="small" bordered>
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Space wrap>
                                <Typography.Text strong>{node.nodeName}</Typography.Text>
                                <Tag>{node.nodeType}</Tag>
                                <Tag color={node.status === 'passed' ? 'green' : 'gold'}>
                                  {node.status}
                                </Tag>
                              </Space>
                              <Typography.Text type="secondary">输入：{node.inputPreview}</Typography.Text>
                              <Typography.Text type="secondary">输出：{node.outputPreview}</Typography.Text>
                              {node.warnings.length ? (
                                <Typography.Text type="warning">
                                  警告：{node.warnings.join('；')}
                                </Typography.Text>
                              ) : null}
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </Space>
                  ) : null}
                </Space>
              }
            />
          ) : null}

          <Card title="员工列表" bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 12 }}
              scroll={{ x: 1280 }}
              expandable={{
                expandedRowRender: (template) => (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text>{template.description}</Typography.Text>
                    <Typography.Text type="secondary">目标：{template.businessGoal}</Typography.Text>
                    <Space wrap>
                      {template.skills.map((skill) => (
                        <Tag key={skill.code}>{skill.name}</Tag>
                      ))}
                    </Space>
                    <Space wrap>
                      {template.workflowSteps.map((step) => (
                        <Tag key={step.id}>
                          {step.order}. {step.name}
                        </Tag>
                      ))}
                    </Space>
                    <Typography.Text type="secondary">
                      Workflow graph: {template.workflowGraph?.nodes.length ?? 0} nodes /{' '}
                      {template.workflowGraph?.edges.length ?? 0} edges
                    </Typography.Text>
                    <Typography.Text type="secondary">输出格式：{template.outputFormat || '-'}</Typography.Text>
                  </Space>
                )
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Drawer
        title={editingTemplate ? `编辑：${editingTemplate.name}` : '新建数字员工'}
        width={960}
        open={drawerOpen}
        onClose={closeEditor}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeEditor}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
            <Form.Item name="id" label="员工 ID" rules={[{ required: true, message: '请输入员工 ID' }]}>
              <Input disabled={Boolean(editingTemplate)} placeholder="template_sales_assistant" />
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
            <Input placeholder="线索研究、外联文案和提案支持" />
          </Form.Item>

          <Form.Item name="description" label="说明" rules={[{ required: true, message: '请输入说明' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="businessGoal" label="业务目标" rules={[{ required: true, message: '请输入业务目标' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="approvalPolicy" label="审批策略" rules={[{ required: true, message: '请输入审批策略' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left">能力配置</Divider>

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
                  <Card
                    key={field.key}
                    size="small"
                    title={`技能 ${field.name + 1}`}
                    extra={
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 180px 1fr', gap: 12 }}>
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
                        <Input placeholder="线索研究" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'summary']}
                        label="说明"
                        rules={[{ required: true, message: '请输入说明' }]}
                      >
                        <Input placeholder="搜索并整理潜在线索背景" />
                      </Form.Item>
                    </div>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ code: '', name: '', summary: '' })} block>
                  添加技能
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider orientation="left">步骤编排</Divider>

          <Form.List name="workflowSteps">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`步骤 ${field.name + 1}`}
                    extra={
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '96px 150px 1fr', gap: 12 }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'order']}
                        label="顺序"
                        rules={[{ required: true, message: '请输入顺序' }]}
                      >
                        <InputNumber min={1} style={{ width: '100%' }} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'type']}
                        label="类型"
                        rules={[{ required: true, message: '请选择类型' }]}
                      >
                        <Select options={workflowStepTypeOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        label="名称"
                        rules={[{ required: true, message: '请输入名称' }]}
                      >
                        <Input placeholder="读取知识" />
                      </Form.Item>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 140px', gap: 12 }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'id']}
                        label="步骤 ID"
                        rules={[{ required: true, message: '请输入步骤 ID' }]}
                      >
                        <Input placeholder="gather_context" />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'toolIds']} label="工具 ID">
                        <Select mode="tags" tokenSeparators={[',']} options={toolOptions} />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'requiresApproval']}
                        label="需要审批"
                        valuePropName="checked"
                      >
                        <Switch checkedChildren="是" unCheckedChildren="否" />
                      </Form.Item>
                    </div>
                    <Form.Item
                      {...field}
                      name={[field.name, 'instruction']}
                      label="执行说明"
                      rules={[{ required: true, message: '请输入执行说明' }]}
                    >
                      <Input.TextArea rows={2} />
                    </Form.Item>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  onClick={() =>
                    add({
                      id: `step_${fields.length + 1}`,
                      order: fields.length + 1,
                      type: 'reasoning',
                      name: '',
                      instruction: '',
                      requiresApproval: false
                    })
                  }
                  block
                >
                  添加步骤
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider orientation="left">Workflow graph</Divider>

          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 140px 160px', gap: 12 }}>
              <Form.Item name={['workflowGraph', 'entryNodeId']} label="Entry node">
                <Select options={workflowGraphNodeOptions} showSearch optionFilterProp="label" />
              </Form.Item>
              <Form.Item name={['workflowGraph', 'runtimePolicy', 'maxNodeExecutions']} label="Max nodes">
                <InputNumber min={1} max={512} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item name={['workflowGraph', 'runtimePolicy', 'maxLoopIterations']} label="Max loops">
                <InputNumber min={0} max={128} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name={['workflowGraph', 'runtimePolicy', 'requireApprovalBeforeTools']}
                label="Tool approval"
                valuePropName="checked"
              >
                <Switch checkedChildren="On" unCheckedChildren="Off" />
              </Form.Item>
            </div>

            <Form.Item name={['workflowGraph', 'variablesJson']} label="Variables JSON">
              <Input.TextArea rows={2} placeholder='[{"name":"intent","required":false}]' />
            </Form.Item>

            <Space wrap>
              <Button type="dashed" onClick={syncWorkflowGraphFromSteps}>
                Generate graph from steps
              </Button>
              <Button onClick={() => applyWorkflowGraphPreset('branching')}>Preset: branching</Button>
              <Button onClick={() => applyWorkflowGraphPreset('document')}>Preset: document</Button>
            </Space>

            <Form.List name={['workflowGraph', 'nodes']}>
              {(fields, { add, remove }) => (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`Node ${field.name + 1}`}
                      extra={
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      }
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 150px 1fr 1fr', gap: 12 }}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'id']}
                          label="Node ID"
                          rules={[{ required: true, message: 'Node ID is required' }]}
                        >
                          <Input placeholder="analyze_plan" />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'type']}
                          label="Type"
                          rules={[{ required: true, message: 'Node type is required' }]}
                        >
                          <Select options={workflowGraphNodeTypeOptions} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'name']}
                          label="Name"
                          rules={[{ required: true, message: 'Node name is required' }]}
                        >
                          <Input placeholder="Analyze plan" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'modelProfileId']} label="Model profile">
                          <Input placeholder="qiu-general-default" />
                        </Form.Item>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 140px', gap: 12 }}>
                        <Form.Item {...field} name={[field.name, 'toolId']} label="Tool">
                          <Select allowClear options={toolOptions} showSearch optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'artifactType']} label="Artifact">
                          <Select allowClear options={artifactTypeOptions} />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'requiresApproval']}
                          label="Approval"
                          valuePropName="checked"
                        >
                          <Switch checkedChildren="On" unCheckedChildren="Off" />
                        </Form.Item>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <Form.Item {...field} name={[field.name, 'inputVariables']} label="Input variables">
                          <Select mode="tags" tokenSeparators={[',']} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'outputVariables']} label="Output variables">
                          <Select mode="tags" tokenSeparators={[',']} />
                        </Form.Item>
                      </div>
                      <Form.Item {...field} name={[field.name, 'description']} label="Description">
                        <Input />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'instruction']} label="Instruction">
                        <Input.TextArea rows={2} />
                      </Form.Item>
                      <Form.Item {...field} name={[field.name, 'configJson']} label="Config JSON">
                        <Input.TextArea rows={2} placeholder='{"maxTokens":4096}' />
                      </Form.Item>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() =>
                      add({
                        id: `node_${fields.length + 1}`,
                        type: 'reasoning',
                        name: '',
                        requiresApproval: false
                      })
                    }
                    block
                  >
                    Add node
                  </Button>
                </Space>
              )}
            </Form.List>

            <Form.List name={['workflowGraph', 'edges']}>
              {(fields, { add, remove }) => (
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  {fields.map((field) => (
                    <Card
                      key={field.key}
                      size="small"
                      title={`Edge ${field.name + 1}`}
                      extra={
                        <Button type="link" danger onClick={() => remove(field.name)}>
                          Remove
                        </Button>
                      }
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 1fr 160px', gap: 12 }}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'id']}
                          label="Edge ID"
                          rules={[{ required: true, message: 'Edge ID is required' }]}
                        >
                          <Input placeholder="start__analyze_plan" />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'sourceNodeId']}
                          label="Source"
                          rules={[{ required: true, message: 'Source node is required' }]}
                        >
                          <Select options={workflowGraphNodeOptions} showSearch optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'targetNodeId']}
                          label="Target"
                          rules={[{ required: true, message: 'Target node is required' }]}
                        >
                          <Select options={workflowGraphNodeOptions} showSearch optionFilterProp="label" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'condition', 'type']} label="Condition">
                          <Select allowClear options={workflowGraphConditionOptions} />
                        </Form.Item>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                        <Form.Item {...field} name={[field.name, 'condition', 'variable']} label="Variable">
                          <Input placeholder="intent" />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'condition', 'valueJson']} label="Value">
                          <Input placeholder={'"approved"'} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'condition', 'expression']} label="Expression">
                          <Input placeholder="score > 0.8" />
                        </Form.Item>
                      </div>
                    </Card>
                  ))}
                  <Button
                    type="dashed"
                    onClick={() =>
                      add({
                        id: `edge_${fields.length + 1}`,
                        condition: {
                          type: 'always'
                        }
                      })
                    }
                    block
                  >
                    Add edge
                  </Button>
                </Space>
              )}
            </Form.List>
          </Space>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <Form.Item name="sampleInputs" label="测试样例">
              <Select mode="tags" tokenSeparators={[',']} placeholder="输入一个样例任务后回车" />
            </Form.Item>
            <Form.Item name="outputFormat" label="输出格式">
              <Input placeholder="Markdown report with summary, risks, next actions..." />
            </Form.Item>
          </div>

          <Divider orientation="left">可见范围</Divider>

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
        </Form>
      </Drawer>
    </AdminShell>
  );
}
