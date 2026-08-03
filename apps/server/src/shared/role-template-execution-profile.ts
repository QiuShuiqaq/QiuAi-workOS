export type ServerRoleTemplateExecutionMode = 'conversation' | 'watch' | 'hybrid';
export type ServerRoleTemplateTriggerMode =
  | 'manual'
  | 'scheduled'
  | 'event'
  | 'folder_watch'
  | 'platform_watch';
export type ServerRoleTemplateInputSource =
  | 'chat'
  | 'uploaded_files'
  | 'local_folder'
  | 'enterprise_knowledge'
  | 'web'
  | 'external_platform';
export type ServerRoleTemplateExecutionToolCapability =
  | 'llm'
  | 'knowledge'
  | 'office'
  | 'web_search'
  | 'browser_automation'
  | 'external_api'
  | 'mcp'
  | 'local_files'
  | 'approval_queue';
export type ServerRoleTemplateOutputTarget =
  | 'chat_response'
  | 'artifact'
  | 'task_queue'
  | 'approval_queue'
  | 'daily_report'
  | 'external_platform';
export type ServerRoleTemplateDataBoundary = 'local_first' | 'summary_sync' | 'workspace_sync';
export type ServerRoleTemplateExternalConnectorType = 'browser' | 'api' | 'mcp' | 'manual';
export type ServerRoleTemplateExternalConnectorStatus = 'supported' | 'requires_setup' | 'planned';

export interface ServerRoleTemplateExternalConnector {
  key: string;
  name: string;
  type: ServerRoleTemplateExternalConnectorType;
  status: ServerRoleTemplateExternalConnectorStatus;
}

export interface ServerRoleTemplateExecutionProfile {
  mode: ServerRoleTemplateExecutionMode;
  summary: string;
  triggerModes: ServerRoleTemplateTriggerMode[];
  inputSources: ServerRoleTemplateInputSource[];
  toolCapabilities: ServerRoleTemplateExecutionToolCapability[];
  outputTargets: ServerRoleTemplateOutputTarget[];
  approval: {
    required: boolean;
    requiredActions: string[];
  };
  dataBoundary: ServerRoleTemplateDataBoundary;
  externalConnectors?: ServerRoleTemplateExternalConnector[];
  rolloutPhase?: 'ready' | 'foundation' | 'planned';
  notes?: string[];
}

export interface RoleTemplateExecutionProfileSource {
  templateId?: string;
  applicationType?: 'DIGITAL_EMPLOYEE' | 'DIGITAL_FACTORY' | 'digital_employee' | 'digital_factory' | string | null;
  name?: string;
  industry?: string;
  scenario?: string;
  description?: string;
  businessGoal?: string;
  knowledgeSources?: string[];
  tools?: string[];
  skills?: Array<{
    code?: string;
    name?: string;
    summary?: string;
  }>;
  outputFormat?: string | null;
  approvalPolicy?: string | null;
}

type RoleTemplateProfileKind =
  | 'factory'
  | 'recruiting'
  | 'sales'
  | 'customer_support'
  | 'after_sales'
  | 'enterprise_research'
  | 'finance'
  | 'legal'
  | 'procurement'
  | 'project'
  | 'document'
  | 'office';

const executionModes: ServerRoleTemplateExecutionMode[] = ['conversation', 'watch', 'hybrid'];
const triggerModes: ServerRoleTemplateTriggerMode[] = [
  'manual',
  'scheduled',
  'event',
  'folder_watch',
  'platform_watch'
];
const inputSources: ServerRoleTemplateInputSource[] = [
  'chat',
  'uploaded_files',
  'local_folder',
  'enterprise_knowledge',
  'web',
  'external_platform'
];
const toolCapabilities: ServerRoleTemplateExecutionToolCapability[] = [
  'llm',
  'knowledge',
  'office',
  'web_search',
  'browser_automation',
  'external_api',
  'mcp',
  'local_files',
  'approval_queue'
];
const outputTargets: ServerRoleTemplateOutputTarget[] = [
  'chat_response',
  'artifact',
  'task_queue',
  'approval_queue',
  'daily_report',
  'external_platform'
];
const dataBoundaries: ServerRoleTemplateDataBoundary[] = ['local_first', 'summary_sync', 'workspace_sync'];
const connectorTypes: ServerRoleTemplateExternalConnectorType[] = ['browser', 'api', 'mcp', 'manual'];
const connectorStatuses: ServerRoleTemplateExternalConnectorStatus[] = ['supported', 'requires_setup', 'planned'];

export function buildRoleTemplateExecutionProfile(
  template: RoleTemplateExecutionProfileSource
): ServerRoleTemplateExecutionProfile {
  const kind = inferRoleTemplateProfileKind(template);

  if (kind === 'factory') {
    return {
      mode: 'hybrid',
      summary: '批量任务型数字工厂：以文件批量输入、参数化执行和可审查产物输出为主。',
      triggerModes: ['manual'],
      inputSources: uniqueExecutionValues(inputSources, [
        'uploaded_files',
        'local_folder',
        'enterprise_knowledge'
      ]),
      toolCapabilities: uniqueExecutionValues(toolCapabilities, [
        'llm',
        'knowledge',
        'local_files',
        ...inferToolCapabilities(template)
      ]),
      outputTargets: ['artifact', 'task_queue'],
      approval: {
        required: requiresHumanApproval(template, kind),
        requiredActions: ['批量任务参数确认', '最终产物发布前复核']
      },
      dataBoundary: 'local_first',
      rolloutPhase: 'ready',
      notes: ['数字工厂优先在 PC 端本地处理大文件，服务端只同步任务摘要和授权状态。']
    };
  }

  const mode = inferExecutionMode(template, kind);
  const connectors = inferExternalConnectors(kind);
  const approvalRequired = requiresHumanApproval(template, kind);

  return {
    mode,
    summary: buildExecutionProfileSummary(mode, kind),
    triggerModes: inferTriggerModes(mode, connectors),
    inputSources: inferInputSources(template, connectors),
    toolCapabilities: uniqueExecutionValues(toolCapabilities, [
      'llm',
      'knowledge',
      ...inferToolCapabilities(template),
      ...(connectors.some((connector) => connector.type === 'browser') ? ['browser_automation' as const] : []),
      ...(connectors.some((connector) => connector.type === 'api') ? ['external_api' as const] : []),
      ...(approvalRequired ? ['approval_queue' as const] : [])
    ]),
    outputTargets: inferOutputTargets(mode, approvalRequired),
    approval: {
      required: approvalRequired,
      requiredActions: approvalRequired ? inferApprovalActions(kind) : []
    },
    dataBoundary: mode === 'conversation' ? 'local_first' : 'summary_sync',
    ...(connectors.length > 0 ? { externalConnectors: connectors } : {}),
    rolloutPhase: mode === 'conversation' ? 'ready' : 'foundation',
    notes:
      mode === 'conversation'
        ? ['当前版本以人工发起任务为主，支持上传文件、读取知识库并输出正式产物。']
        : ['当前版本采用通用网页 RPA 能力，不预置平台深度插件；涉及对外发送、报价、拒绝、退款等动作必须人工确认。']
  };
}

export function normalizeRoleTemplateExecutionProfile(
  value: unknown,
  fallbackSource?: RoleTemplateExecutionProfileSource
): ServerRoleTemplateExecutionProfile | undefined {
  const fallback = fallbackSource ? buildRoleTemplateExecutionProfile(fallbackSource) : undefined;
  const record = toRecord(value);
  if (!record) {
    return fallback;
  }

  const fallbackApproval = fallback?.approval ?? { required: false, requiredActions: [] };
  const approvalRecord = toRecord(record.approval);
  const externalConnectors = Array.isArray(record.externalConnectors)
    ? record.externalConnectors.flatMap((connector) => normalizeExternalConnector(connector))
    : fallback?.externalConnectors;
  const notes = normalizeStringArray(record.notes, fallback?.notes ?? []);
  const rolloutPhase = enumValue(
    record.rolloutPhase,
    ['ready', 'foundation', 'planned'] as const,
    fallback?.rolloutPhase ?? 'ready'
  );

  return {
    mode: enumValue(record.mode, executionModes, fallback?.mode ?? 'conversation'),
    summary: normalizeText(record.summary, fallback?.summary ?? '对话式数字员工：由用户发起任务并输出业务结果。'),
    triggerModes: enumArray(record.triggerModes, triggerModes, fallback?.triggerModes ?? ['manual']),
    inputSources: enumArray(record.inputSources, inputSources, fallback?.inputSources ?? ['chat']),
    toolCapabilities: enumArray(record.toolCapabilities, toolCapabilities, fallback?.toolCapabilities ?? ['llm']),
    outputTargets: enumArray(record.outputTargets, outputTargets, fallback?.outputTargets ?? ['chat_response']),
    approval: {
      required:
        typeof approvalRecord?.required === 'boolean'
          ? approvalRecord.required
          : fallbackApproval.required,
      requiredActions: normalizeStringArray(
        approvalRecord?.requiredActions,
        fallbackApproval.requiredActions
      )
    },
    dataBoundary: enumValue(record.dataBoundary, dataBoundaries, fallback?.dataBoundary ?? 'local_first'),
    ...(externalConnectors && externalConnectors.length > 0 ? { externalConnectors } : {}),
    rolloutPhase,
    ...(notes.length > 0 ? { notes } : {})
  };
}

export function readRoleTemplateExecutionProfile(
  value: unknown
): ServerRoleTemplateExecutionProfile | undefined {
  return normalizeRoleTemplateExecutionProfile(value);
}

function inferRoleTemplateProfileKind(template: RoleTemplateExecutionProfileSource): RoleTemplateProfileKind {
  const applicationType = String(template.applicationType ?? '').toLowerCase();
  if (applicationType === 'digital_factory') {
    return 'factory';
  }

  const text = templateText(template);
  const skillCodes = (template.skills ?? []).map((skill) => String(skill.code ?? '').toLowerCase());
  const templateId = String(template.templateId ?? '').toLowerCase();

  if (templateId.includes('factory')) return 'factory';
  if (templateId.includes('recruit') || skillCodes.some((code) => code.includes('resume') || code.includes('candidate'))) {
    return 'recruiting';
  }
  if (templateId.includes('after_sales')) {
    return 'after_sales';
  }
  if (templateId.includes('customer_support')) {
    return 'customer_support';
  }
  if (templateId.includes('sales')) {
    return 'sales';
  }
  if (text.includes('售后')) return 'after_sales';
  if (text.includes('客服') || text.includes('support')) return 'customer_support';
  if (text.includes('sales') || text.includes('销售') || skillCodes.some((code) => code.includes('lead') || code.includes('outreach'))) {
    return 'sales';
  }
  if (templateId.includes('research') || skillCodes.some((code) => code.includes('research') || code.includes('competitor'))) {
    return 'enterprise_research';
  }
  if (templateId.includes('finance') || templateId.includes('invoice') || templateId.includes('reimbursement')) {
    return 'finance';
  }
  if (templateId.includes('contract') || templateId.includes('legal') || text.includes('合同') || text.includes('法务')) {
    return 'legal';
  }
  if (templateId.includes('procurement') || text.includes('采购') || text.includes('供应商')) {
    return 'procurement';
  }
  if (templateId.includes('project') || templateId.includes('requirement') || text.includes('项目') || text.includes('需求')) {
    return 'project';
  }
  if (templateId.includes('document') || templateId.includes('archive') || text.includes('文档') || text.includes('归档')) {
    return 'document';
  }
  return 'office';
}

function inferExecutionMode(
  template: RoleTemplateExecutionProfileSource,
  kind: RoleTemplateProfileKind
): ServerRoleTemplateExecutionMode {
  if (['recruiting', 'sales', 'customer_support', 'after_sales', 'enterprise_research'].includes(kind)) {
    return 'watch';
  }

  const text = templateText(template);
  const tools = new Set((template.tools ?? []).map((tool) => tool.toLowerCase()));
  if (text.includes('定时') || text.includes('值守') || tools.has('web-search')) {
    return 'hybrid';
  }

  return 'conversation';
}

function inferExternalConnectors(kind: RoleTemplateProfileKind): ServerRoleTemplateExternalConnector[] {
  switch (kind) {
    case 'recruiting':
      return [
        { key: 'generic_recruiting_web_rpa', name: '招聘网页 RPA', type: 'browser', status: 'supported' }
      ];
    case 'sales':
      return [
        { key: 'generic_sales_web_rpa', name: '销售网页 RPA', type: 'browser', status: 'supported' }
      ];
    case 'customer_support':
      return [
        { key: 'generic_support_web_rpa', name: '客服网页 RPA', type: 'browser', status: 'supported' }
      ];
    case 'after_sales':
      return [
        { key: 'generic_after_sales_web_rpa', name: '售后网页 RPA', type: 'browser', status: 'supported' }
      ];
    case 'enterprise_research':
      return [
        { key: 'web_search', name: '公开网页搜索', type: 'api', status: 'supported' }
      ];
    default:
      return [];
  }
}

function inferTriggerModes(
  mode: ServerRoleTemplateExecutionMode,
  connectors: ServerRoleTemplateExternalConnector[]
): ServerRoleTemplateTriggerMode[] {
  if (mode === 'conversation') {
    return ['manual'];
  }

  if (mode === 'hybrid') {
    return ['manual', 'folder_watch', 'scheduled'];
  }

  return uniqueExecutionValues(triggerModes, [
    'manual',
    'scheduled',
    'event',
    connectors.length > 0 ? 'platform_watch' : undefined
  ]);
}

function inferInputSources(
  template: RoleTemplateExecutionProfileSource,
  connectors: ServerRoleTemplateExternalConnector[]
): ServerRoleTemplateInputSource[] {
  const tools = new Set((template.tools ?? []).map((tool) => tool.toLowerCase()));
  return uniqueExecutionValues(inputSources, [
    'chat',
    'uploaded_files',
    'enterprise_knowledge',
    tools.has('local-filesystem') ? 'local_folder' : undefined,
    tools.has('web-search') ? 'web' : undefined,
    connectors.length > 0 ? 'external_platform' : undefined
  ]);
}

function inferToolCapabilities(
  template: RoleTemplateExecutionProfileSource
): ServerRoleTemplateExecutionToolCapability[] {
  const tools = new Set((template.tools ?? []).map((tool) => tool.toLowerCase()));
  return uniqueExecutionValues(toolCapabilities, [
    tools.has('office-document') ? 'office' : 'office',
    tools.has('web-search') ? 'web_search' : undefined,
    tools.has('local-filesystem') ? 'local_files' : undefined,
    tools.has('video-processing') ? 'local_files' : undefined
  ]);
}

function inferOutputTargets(
  mode: ServerRoleTemplateExecutionMode,
  approvalRequired: boolean
): ServerRoleTemplateOutputTarget[] {
  if (mode === 'conversation') {
    return uniqueExecutionValues(outputTargets, ['chat_response', 'artifact', approvalRequired ? 'approval_queue' : undefined]);
  }
  if (mode === 'hybrid') {
    return uniqueExecutionValues(outputTargets, ['chat_response', 'artifact', 'task_queue', approvalRequired ? 'approval_queue' : undefined]);
  }
  return uniqueExecutionValues(outputTargets, ['artifact', 'task_queue', 'daily_report', approvalRequired ? 'approval_queue' : undefined]);
}

function buildExecutionProfileSummary(
  mode: ServerRoleTemplateExecutionMode,
  kind: RoleTemplateProfileKind
): string {
  if (mode === 'conversation') {
    return '对话式数字员工：由用户发起任务，读取文件和知识库后输出正式产物。';
  }

  if (mode === 'hybrid') {
    return '混合式数字员工：支持手动任务，也可扩展为文件夹监听或定时批处理。';
  }

  const subject =
    kind === 'recruiting'
      ? '招聘平台候选人'
      : kind === 'sales'
        ? '销售线索和客户跟进'
        : kind === 'customer_support'
          ? '客户咨询和服务工单'
          : kind === 'after_sales'
            ? '售后问题和工单'
            : '外部信息和企业情报';
  return `值守式数字员工：围绕${subject}持续巡检、整理、提醒和生成待审批动作。`;
}

function requiresHumanApproval(
  template: RoleTemplateExecutionProfileSource,
  kind: RoleTemplateProfileKind
): boolean {
  if (['recruiting', 'sales', 'customer_support', 'after_sales', 'legal', 'finance'].includes(kind)) {
    return true;
  }

  const text = `${template.approvalPolicy ?? ''} ${templateText(template)}`;
  return ['发布', '发送', '报价', '合同', '退款', '赔付', '医疗', '法务', '审批'].some((keyword) =>
    text.includes(keyword)
  );
}

function inferApprovalActions(kind: RoleTemplateProfileKind): string[] {
  switch (kind) {
    case 'recruiting':
      return ['候选人联系', '面试邀约', '淘汰/拒绝通知'];
    case 'sales':
      return ['对外触达', '报价承诺', '合同/交付承诺'];
    case 'customer_support':
      return ['退款/赔付', '公开回复', '升级处理'];
    case 'after_sales':
      return ['退款/赔付', '换货/补偿', '升级处理'];
    case 'legal':
      return ['合同条款确认', '风险结论确认'];
    case 'finance':
      return ['付款/报销结论确认', '财务风险确认'];
    default:
      return ['对外发送', '关键结论确认'];
  }
}

function normalizeExternalConnector(value: unknown): ServerRoleTemplateExternalConnector[] {
  const record = toRecord(value);
  if (!record) {
    return [];
  }

  const key = normalizeText(record.key, '');
  const name = normalizeText(record.name, '');
  if (!key || !name) {
    return [];
  }

  return [
    {
      key,
      name,
      type: enumValue(record.type, connectorTypes, 'manual'),
      status: enumValue(record.status, connectorStatuses, 'planned')
    }
  ];
}

function templateText(template: RoleTemplateExecutionProfileSource): string {
  return [
    template.templateId,
    template.name,
    template.industry,
    template.scenario,
    template.description,
    template.businessGoal,
    template.outputFormat,
    template.approvalPolicy,
    ...(template.knowledgeSources ?? []),
    ...(template.tools ?? []),
    ...(template.skills ?? []).flatMap((skill) => [skill.code, skill.name, skill.summary])
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
}

function normalizeText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeStringArray(value: unknown, fallback: string[] = []): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
  return normalized.length > 0 ? [...new Set(normalized)] : fallback;
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T[]
): T[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  const normalized = value.filter((item): item is T =>
    typeof item === 'string' && (allowed as readonly string[]).includes(item)
  );
  return normalized.length > 0 ? uniqueExecutionValues(allowed, normalized) : fallback;
}

function uniqueExecutionValues<T extends string>(allowed: readonly T[], values: Array<T | undefined>): T[] {
  const allowedSet = new Set<string>(allowed);
  return [...new Set(values.filter((value): value is T => value !== undefined && allowedSet.has(value)))];
}

function toRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
