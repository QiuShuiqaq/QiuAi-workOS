import {
  ApiOutlined,
  BorderOutlined,
  CloudDownloadOutlined,
  CloudSyncOutlined,
  CloseOutlined,
  ControlOutlined,
  DatabaseOutlined,
  DownOutlined,
  FileAddOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  DownloadOutlined,
  InfoCircleOutlined,
  LogoutOutlined,
  MinusOutlined,
  PaperClipOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  RollbackOutlined,
  ReloadOutlined,
  ToolOutlined,
  UserOutlined
} from '@ant-design/icons';
import { qiuAntTheme } from '@qiuai/design-tokens';
import AppProvider from 'antd/es/app';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import ConfigProvider from 'antd/es/config-provider';
import Descriptions from 'antd/es/descriptions';
import Empty from 'antd/es/empty';
import Divider from 'antd/es/divider';
import Flex from 'antd/es/flex';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Layout from 'antd/es/layout';
import List from 'antd/es/list';
import Modal from 'antd/es/modal';
import Popover from 'antd/es/popover';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import zhCN from 'antd/es/locale/zh_CN';
import { type ChangeEvent, type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type {
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopAuthorizedRoleTemplateSummary,
  DesktopBackupSummary,
  DesktopRuntimeState,
  DesktopWindowControlAction
} from '../shared/desktop-api';
import type {
  DesktopRolePackageState,
  DesktopTaskState,
  DesktopTaskDetail,
  DesktopTaskSummary,
  DesktopKnowledgeSourceSummary,
  KnowledgeBindingSource,
  ModelProfile,
  RolePackageManifest,
  ToolManifest
} from '../shared/desktop-contract';
import { defaultRoleTemplateCatalog, type RoleTemplateCatalogEntry } from '@qiuai/domain';
import { createDesktopRuntimePreviewState } from '../shared/desktop-state';
import {
  createMockTaskDetail,
  createTaskDetailFromSummary,
  toDesktopTaskSummary
} from '../shared/workbench-data';
import { runDesktopTask } from '../shared/desktop-task-runner';
import {
  ensureModelProfilesForRolePackage,
  findFirstUnreadyRequiredModelProfileId,
  getRoleModelRuntimeRequirementStatuses,
  readRequiredModelProfileIdsForRolePackage,
  readWorkflowRequiredModelProfileIds
} from '../shared/desktop-role-requirements';

type SectionKey = 'workbench' | 'roles' | 'models' | 'tools' | 'knowledge' | 'settings';
type DesktopThemePreference = 'light' | 'system';
type DesktopDensityPreference = 'comfortable' | 'compact';

interface DesktopClientPreferences {
  theme: DesktopThemePreference;
  density: DesktopDensityPreference;
  startupSection: SectionKey;
}

type DesktopRoleTemplate = RoleTemplateCatalogEntry;

interface TaskFormValues {
  roleCode: string;
  title: string;
  input?: string;
}

interface ComposerAttachment {
  id: string;
  name: string;
  size: number;
  type?: string;
  localPath?: string;
  progress: number;
  status: 'uploading' | 'ready';
  stagedAt: string;
}

interface WorkflowRuntimeLogVariable {
  name: string;
  valueType: string;
  preview: string;
}

interface WorkflowRuntimeNodeLogDetail {
  id: string;
  type: string;
  name: string;
  status: string;
  message?: string;
  modelProfileId?: string;
  toolId?: string;
  artifactType?: string;
  artifactPath?: string;
  inputs: WorkflowRuntimeLogVariable[];
  outputs: WorkflowRuntimeLogVariable[];
}

interface ModelFormValues {
  providerName: string;
  modelName: string;
  purpose: ModelProfile['purpose'];
  apiBaseUrl?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
  monthlyBudgetCents?: number;
  fallbackProfileId?: string;
}

interface OnboardingFormValues {
  bindingCode: string;
}

interface RoleConfigFormValues {
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeSources: KnowledgeBindingSource[];
}

interface ToolSettingsFormValues {
  webSearchEndpoint?: string;
  webSearchApiKey?: string;
  allowPrivateNetwork?: boolean;
}

interface ModelProviderPreset {
  id: string;
  name: string;
  summary: string;
  apiBaseUrl?: string;
  models: Array<{
    label: string;
    modelName: string;
    purpose: ModelProfile['purpose'];
    temperature?: number;
    maxTokens?: number;
  }>;
}

interface KnowledgeBindingCatalogEntry {
  source: KnowledgeBindingSource;
  bindingId: string;
  label: string;
  description: string;
}

const sectionItems: Array<{ key: SectionKey; icon: ReactNode; label: string }> = [
  { key: 'workbench', icon: <ControlOutlined />, label: '对话' },
  { key: 'roles', icon: <RobotOutlined />, label: '数字员工' },
  { key: 'models', icon: <ApiOutlined />, label: '模型' },
  { key: 'tools', icon: <ToolOutlined />, label: '工具' },
  { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' }
];

const desktopClientPreferenceStorageKey = 'qiuai.pc.client.preferences.v1';
const defaultDesktopClientPreferences: DesktopClientPreferences = {
  theme: 'light',
  density: 'comfortable',
  startupSection: 'workbench'
};

const desktopThemeOptions: Array<{ value: DesktopThemePreference; label: string }> = [
  { value: 'light', label: '浅色' },
  { value: 'system', label: '跟随系统' }
];

const desktopDensityOptions: Array<{ value: DesktopDensityPreference; label: string }> = [
  { value: 'comfortable', label: '标准' },
  { value: 'compact', label: '紧凑' }
];

const fallbackDesktopRoleTemplates: DesktopRoleTemplate[] = defaultRoleTemplateCatalog;
const fallbackRoleTemplateByTemplateId = new Map(
  fallbackDesktopRoleTemplates.map((template) => [template.templateId, template] as const)
);

const knowledgeBindingCatalog: KnowledgeBindingCatalogEntry[] = [
  {
    source: 'local_folder',
    bindingId: 'kb-local-folder',
    label: '本地文件夹',
    description: '同步指定目录下的资料与文档摘要'
  },
  {
    source: 'local_file',
    bindingId: 'kb-local-file',
    label: '本地文件',
    description: '同步单个文件或附件摘要'
  },
  {
    source: 'workspace_library',
    bindingId: 'kb-workspace-library',
    label: '工作区知识库',
    description: '同步当前工作区内的沉淀知识'
  },
  {
    source: 'server_summary',
    bindingId: 'kb-server-summary',
    label: '服务端摘要',
    description: '同步服务端返回的精简摘要'
  }
];

const knowledgeBindingCatalogByBindingId = new Map(
  knowledgeBindingCatalog.map((entry) => [entry.bindingId, entry] as const)
);

const knowledgeBindingOptions = [
  { id: 'kb-local-folder', label: '本地文件夹' },
  { id: 'kb-local-file', label: '本地文件' },
  { id: 'kb-workspace-library', label: '工作区知识库' },
  { id: 'kb-server-summary', label: '服务端摘要' }
];

const modelProviderPresets: ModelProviderPreset[] = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    summary: '适合国内中小企业试点，成本可控，支持 OpenAI 兼容接口。',
    apiBaseUrl: 'https://api.deepseek.com',
    models: [
      {
        label: 'V4 Flash · 省钱通用',
        modelName: 'deepseek-v4-flash',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'V4 Pro · 深度推理',
        modelName: 'deepseek-v4-pro',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      }
    ]
  },
  {
    id: 'openai',
    name: 'OpenAI',
    summary: '适合质量优先和复杂任务；当前桌面端先按兼容接口配置。',
    apiBaseUrl: 'https://api.openai.com/v1',
    models: [
      {
        label: 'GPT-5.6 Terra · 质量成本平衡',
        modelName: 'gpt-5.6-terra',
        purpose: 'general',
        temperature: 0.3,
        maxTokens: 4096
      },
      {
        label: 'GPT-5.6 Luna · 低成本批量',
        modelName: 'gpt-5.6-luna',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'GPT-5.6 Sol · 高质量复杂任务',
        modelName: 'gpt-5.6-sol',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      }
    ]
  },
  {
    id: 'dashscope',
    name: '通义千问',
    summary: '阿里云 DashScope 兼容模式，适合国内部署和企业网络环境。',
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {
        label: 'Qwen Plus · 通用',
        modelName: 'qwen-plus',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Qwen Max · 高质量',
        modelName: 'qwen-max',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      }
    ]
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    summary: '适合长文本阅读、材料整理和报告生成。',
    apiBaseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {
        label: 'Kimi K2 · 通用',
        modelName: 'kimi-k2-0711-preview',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    summary: '聚合模型服务，适合快速替换和对比不同开源模型。',
    apiBaseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      {
        label: '自选模型',
        modelName: 'Qwen/Qwen3-32B',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'ollama',
    name: 'Ollama 本地模型',
    summary: '适合隐私敏感和离线场景，需要用户电脑本地运行 Ollama。',
    apiBaseUrl: 'http://127.0.0.1:11434/v1',
    models: [
      {
        label: '本地 Qwen',
        modelName: 'qwen3',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: '本地 Llama',
        modelName: 'llama3.1',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'custom',
    name: '自定义兼容接口',
    summary: '用于企业私有模型、代理网关或其他 OpenAI-compatible 服务。',
    models: [
      {
        label: '自定义模型',
        modelName: 'custom-model',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  }
];

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0
});
const pendingWorkspaceId = 'workspace_pending_login';
const newTaskSelectionId = '__qiuai_new_task__';
const initialAuthorizedRoleTemplateCatalog: DesktopAuthorizedRoleTemplateCatalog = {
  source: 'local_fallback',
  workspaceId: pendingWorkspaceId,
  loadedAt: new Date(0).toISOString(),
  templates: fallbackDesktopRoleTemplates.map(toRoleTemplateSummary)
};

function cloneJsonValue<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as T);
}

function toRoleTemplateSummary(template: DesktopRoleTemplate): DesktopAuthorizedRoleTemplateSummary {
  return {
    id: template.templateId,
    version: template.version,
    name: template.name,
    industry: template.industry,
    scenario: template.scenario,
    description: template.description,
    recommendedPlanCode: template.recommendedPlanCode,
    businessGoal: template.businessGoal,
    knowledgeSources: [...template.knowledgeSources],
    tools: [...template.tools],
    skills: template.skills.map((skill) => ({ ...skill })),
    workflowSteps: (template.workflowSteps ?? []).map((step) => ({
      ...step,
      toolIds: step.toolIds ? [...step.toolIds] : undefined
    })),
    workflowGraph: cloneJsonValue(template.workflowGraph),
    sampleInputs: [...(template.sampleInputs ?? [])],
    outputFormat: template.outputFormat ?? '',
    approvalPolicy: template.approvalPolicy
  };
}

function toDesktopRoleTemplate(summary: DesktopAuthorizedRoleTemplateSummary): DesktopRoleTemplate {
  const fallback = fallbackRoleTemplateByTemplateId.get(summary.id);
  const roleCode = fallback?.roleCode ?? createRoleCodeFromTemplateId(summary.id);
  const workflowGraph = cloneJsonValue(summary.workflowGraph) as DesktopRoleTemplate['workflowGraph'];

  return {
    templateId: summary.id,
    roleCode,
    name: summary.name,
    version: summary.version,
    summary: fallback?.summary ?? summary.description,
    industry: summary.industry,
    scenario: summary.scenario,
    description: summary.description,
    recommendedPlanCode: summary.recommendedPlanCode,
    businessGoal: summary.businessGoal,
    knowledgeSources: [...summary.knowledgeSources],
    tools: [...summary.tools],
    approvalPolicy: summary.approvalPolicy,
    skills: summary.skills.map((skill) => ({ ...skill })),
    workflowSteps: (summary.workflowSteps ?? []).map((step) => ({
      ...step,
      toolIds: step.toolIds ? [...step.toolIds] : undefined
    })),
    workflowGraph,
    sampleInputs: [...(summary.sampleInputs ?? [])],
    outputFormat: summary.outputFormat ?? '',
    modelProfileIds: fallback?.modelProfileIds ?? inferDesktopModelProfileIds(workflowGraph),
    toolIds: fallback?.toolIds ?? inferDesktopToolIds(summary),
    requiredKnowledgeSources:
      fallback?.requiredKnowledgeSources ?? inferRequiredKnowledgeSources(summary),
    defaultTaskTypes: fallback?.defaultTaskTypes ?? inferDefaultTaskTypes(summary),
    syncPolicy: fallback?.syncPolicy ?? 'summary_only',
    installNote: fallback?.installNote ?? '由平台授权模板生成，可按企业实际情况配置模型、工具和知识来源。'
  };
}

function inferDesktopModelProfileIds(workflowGraph: DesktopRoleTemplate['workflowGraph']): string[] {
  const workflowModelProfileIds = readWorkflowRequiredModelProfileIds(workflowGraph);
  return workflowModelProfileIds.length > 0 ? workflowModelProfileIds : ['qiu-general-default'];
}

function createRoleCodeFromTemplateId(templateId: string): string {
  const normalized = templateId
    .trim()
    .replace(/^template[_-]?/i, 'ai-')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  if (!normalized) {
    return 'ai-role-template';
  }

  return normalized.startsWith('ai-') ? normalized : `ai-${normalized}`;
}

function inferDesktopToolIds(summary: DesktopAuthorizedRoleTemplateSummary): string[] {
  const text = roleTemplateSearchText(summary);
  const toolIds: string[] = [];

  if (includesAny(text, ['web', 'search', 'browser', '网页', '搜索', '检索', '资料'])) {
    toolIds.push('web-search');
  }

  if (includesAny(text, ['office', 'word', 'document', 'ppt', 'presentation', 'excel', 'spreadsheet', '文档', '报告', '提案', '合同', '简历', '发票'])) {
    toolIds.push('office-document');
  }

  if (includesAny(text, ['file', 'folder', 'local', 'filesystem', '本地', '文件', '目录', '素材', '附件'])) {
    toolIds.push('local-filesystem');
  }

  if (includesAny(text, ['http', 'api', 'webhook', '接口', '请求'])) {
    toolIds.push('http-request');
  }

  if (includesAny(text, ['mcp', 'model context protocol'])) {
    toolIds.push('mcp');
  }

  return toolIds.length > 0 ? mergeUniqueStrings(toolIds, []) : ['web-search', 'office-document'];
}

function inferRequiredKnowledgeSources(summary: DesktopAuthorizedRoleTemplateSummary): KnowledgeBindingSource[] {
  const text = roleTemplateSearchText(summary);
  const sources: KnowledgeBindingSource[] = ['server_summary'];

  if (includesAny(text, ['folder', 'local', 'filesystem', '本地', '目录', '素材库', '资料库'])) {
    sources.push('local_folder');
  }

  if (includesAny(text, ['file', 'document', 'word', 'pdf', '合同', '简历', '发票', '附件'])) {
    sources.push('local_file');
  }

  if (includesAny(text, ['workspace', 'crm', 'library', '客户', '企业', '知识库', '流程', '制度'])) {
    sources.push('workspace_library');
  }

  return mergeUniqueStrings(sources, []) as KnowledgeBindingSource[];
}

function inferDefaultTaskTypes(summary: DesktopAuthorizedRoleTemplateSummary): string[] {
  const skillCodes = summary.skills.map((skill) => skill.code).filter(Boolean);
  if (skillCodes.length > 0) {
    return skillCodes.slice(0, 5);
  }

  const scenarioSlug = summary.scenario
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();

  return [scenarioSlug || 'general_task'];
}

function roleTemplateSearchText(summary: DesktopAuthorizedRoleTemplateSummary): string {
  return [
    summary.id,
    summary.name,
    summary.industry,
    summary.scenario,
    summary.description,
    summary.businessGoal,
    ...summary.knowledgeSources,
    ...summary.tools,
    ...summary.skills.flatMap((skill) => [skill.code, skill.name, skill.summary])
  ].join(' ');
}

function includesAny(text: string, tokens: string[]): boolean {
  const normalizedText = text.toLowerCase();
  return tokens.some((token) => normalizedText.includes(token.toLowerCase()));
}

function isSectionKey(value: string): value is SectionKey {
  return sectionItems.some((item) => item.key === value);
}

function readDesktopClientPreferences(): DesktopClientPreferences {
  if (typeof window === 'undefined') {
    return defaultDesktopClientPreferences;
  }

  try {
    const rawValue = window.localStorage.getItem(desktopClientPreferenceStorageKey);
    if (!rawValue) {
      return defaultDesktopClientPreferences;
    }

    const parsed = JSON.parse(rawValue) as Partial<DesktopClientPreferences>;
    return {
      theme: parsed.theme === 'system' ? 'system' : 'light',
      density: parsed.density === 'compact' ? 'compact' : 'comfortable',
      startupSection:
        parsed.startupSection && isSectionKey(parsed.startupSection)
          ? parsed.startupSection
          : defaultDesktopClientPreferences.startupSection
    };
  } catch {
    return defaultDesktopClientPreferences;
  }
}

function writeDesktopClientPreferences(preferences: DesktopClientPreferences) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(desktopClientPreferenceStorageKey, JSON.stringify(preferences));
  } catch {
    // User preferences are non-critical; keep the app usable if storage is unavailable.
  }
}

function readInitialSectionKey(): SectionKey {
  const hashValue = window.location.hash.replace(/^#/, '');
  if (hashValue === 'runtime' || hashValue === 'sync') {
    return 'settings';
  }

  if (hashValue === 'files') {
    return 'workbench';
  }

  return isSectionKey(hashValue) ? hashValue : readDesktopClientPreferences().startupSection;
}

export default function App() {
  const [runtimeState, setRuntimeState] = useState<DesktopRuntimeState>(
    createDesktopRuntimePreviewState()
  );
  const [selectedSection, setSelectedSection] = useState<SectionKey>(() => readInitialSectionKey());
  const [clientPreferences, setClientPreferences] = useState<DesktopClientPreferences>(
    () => readDesktopClientPreferences()
  );
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBindingDevice, setIsBindingDevice] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [onboardingNotice, setOnboardingNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [modelTestNotice, setModelTestNotice] = useState('');
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [localActionNotice, setLocalActionNotice] = useState('');
  const [roleTemplateNotice, setRoleTemplateNotice] = useState('');
  const [isLoadingRoleTemplates, setIsLoadingRoleTemplates] = useState(false);
  const [authorizedRoleTemplateCatalog, setAuthorizedRoleTemplateCatalog] =
    useState<DesktopAuthorizedRoleTemplateCatalog>(initialAuthorizedRoleTemplateCatalog);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const [workspaceBackups, setWorkspaceBackups] = useState<DesktopBackupSummary[]>([]);
  const chatMessageListRef = useRef<HTMLDivElement | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [modelForm] = Form.useForm<ModelFormValues>();
  const [toolSettingsForm] = Form.useForm<ToolSettingsFormValues>();
  const [onboardingForm] = Form.useForm<OnboardingFormValues>();
  const [roleConfigForm] = Form.useForm<RoleConfigFormValues>();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [roleConfigModalOpen, setRoleConfigModalOpen] = useState(false);
  const [roleConfigMode, setRoleConfigMode] = useState<'install' | 'configure'>('install');
  const [roleConfigRoleCode, setRoleConfigRoleCode] = useState('');
  const [toolSettingsNotice, setToolSettingsNotice] = useState('');
  const [isSavingToolSettings, setIsSavingToolSettings] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [toolConfigToolId, setToolConfigToolId] = useState('');
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [selectedRoleCategory, setSelectedRoleCategory] = useState('全部');
  const [selectedToolCategory, setSelectedToolCategory] = useState('全部');
  const [selectedKnowledgeScope, setSelectedKnowledgeScope] = useState<'enterprise' | 'local'>(
    'enterprise'
  );
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isComposerDragOver, setIsComposerDragOver] = useState(false);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);

  useEffect(() => {
    void loadRuntimeState();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setSelectedSection(readInitialSectionKey());
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    void loadWorkspaceBackups();
  }, [hasLoadedPersistedState, runtimeState.localRuntime.workspaceId]);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    void loadAuthorizedRoleTemplates();
  }, [hasLoadedPersistedState, runtimeState.localRuntime.workspaceId]);

  useEffect(() => {
    const bridge = window.qiuDesktop;
    if (!hasLoadedPersistedState || !bridge) {
      return;
    }

    const handle = window.setTimeout(() => {
      void bridge.saveRuntimeState(runtimeState);
    }, 150);

    return () => window.clearTimeout(handle);
  }, [hasLoadedPersistedState, runtimeState]);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    if (runtimeState.localRuntime.workspaceId === pendingWorkspaceId) {
      onboardingForm.setFieldsValue({ bindingCode: '' });
      setOnboardingNotice('');
      setOnboardingOpen(true);
    }
  }, [hasLoadedPersistedState, onboardingForm, runtimeState.localRuntime.workspaceId]);

  useEffect(() => {
    const firstModelId = runtimeState.modelProfiles[0]?.id;
    if (!selectedModelId && firstModelId) {
      setSelectedModelId(firstModelId);
    }
    if (selectedModelId && !runtimeState.modelProfiles.some((profile) => profile.id === selectedModelId)) {
      setSelectedModelId(firstModelId ?? '');
    }
  }, [runtimeState.modelProfiles, selectedModelId]);

  useEffect(() => {
    if (selectedTaskId === newTaskSelectionId) {
      return;
    }

    const firstTaskId = runtimeState.runtimeSnapshot.tasks[0]?.taskId;
    if (!selectedTaskId && firstTaskId) {
      setSelectedTaskId(firstTaskId);
      return;
    }

    if (selectedTaskId && !runtimeState.runtimeSnapshot.tasks.some((task) => task.taskId === selectedTaskId)) {
      setSelectedTaskId(firstTaskId ?? '');
    }
  }, [runtimeState.runtimeSnapshot.tasks, selectedTaskId]);

  useEffect(() => {
    const activeRoleCode = runtimeState.localRuntime.activeRoleCode ?? runtimeState.rolePackages[0]?.roleCode;
    if (activeRoleCode) {
      taskForm.setFieldsValue({ roleCode: activeRoleCode });
    }
  }, [runtimeState.localRuntime.activeRoleCode, runtimeState.rolePackages, taskForm]);

  async function loadRuntimeState() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsRefreshing(true);
    try {
      setRuntimeState(await window.qiuDesktop.getRuntimeState());
      setHasLoadedPersistedState(true);
      await loadWorkspaceBackups();
    } finally {
      setIsRefreshing(false);
    }
  }

  async function loadWorkspaceBackups() {
    if (!window.qiuDesktop) {
      return;
    }

    try {
      const backups = await window.qiuDesktop.listWorkspaceBackups();
      setWorkspaceBackups(backups);
    } catch (error) {
      setBackupNotice(`备份列表加载失败：${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  async function loadAuthorizedRoleTemplates() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsLoadingRoleTemplates(true);
    try {
      const catalog = await window.qiuDesktop.listAuthorizedRoleTemplates();
      setAuthorizedRoleTemplateCatalog(catalog);
      if (catalog.source === 'server') {
        const authorizedTemplates = catalog.templates.map(toDesktopRoleTemplate);
        setRuntimeState((current) =>
          pruneUnauthorizedRolePackages(current, authorizedTemplates)
        );
      }
      setRoleTemplateNotice(
        catalog.message ??
          (catalog.source === 'server'
            ? `已同步 ${catalog.templates.length} 个数字员工`
            : `使用内置数字员工：${catalog.templates.length} 个`)
      );
    } catch (error) {
      setAuthorizedRoleTemplateCatalog(initialAuthorizedRoleTemplateCatalog);
      setRoleTemplateNotice(
        `数字员工同步失败，已使用内置列表：${error instanceof Error ? error.message : 'unknown error'}`
      );
    } finally {
      setIsLoadingRoleTemplates(false);
    }
  }

  async function refreshConnection() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsRefreshing(true);
    try {
      const serverConnection = await window.qiuDesktop.checkServerConnection();
      setRuntimeState((current) => ({
        ...current,
        serverConnection
      }));
    } finally {
      setIsRefreshing(false);
    }
  }

  async function syncRuntimeState() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsSyncing(true);
    setSyncNotice('');
    try {
      const result = await window.qiuDesktop.syncRuntimeState(runtimeState);
      const syncedAt = result.data.syncedAt;
      setRuntimeState((current) => ({
        ...current,
        localRuntime: {
          ...current.localRuntime,
          lastSyncedAt: syncedAt
        },
        runtimeSnapshot: {
          ...current.runtimeSnapshot,
          lastSyncedAt: syncedAt
        }
      }));
      setSyncNotice(`已同步到服务端：${formatDate(syncedAt)}`);
    } catch (error) {
      setSyncNotice(`同步失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsSyncing(false);
    }
  }

  async function createWorkspaceBackup() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsBackupBusy(true);
    setBackupNotice('');
    try {
      const createdBackup = await window.qiuDesktop.createWorkspaceBackup(runtimeState);
      setWorkspaceBackups((current) => [createdBackup, ...current.filter((item) => item.bundleId !== createdBackup.bundleId)]);
      setBackupNotice(`已创建备份：${createdBackup.bundleId}`);
    } catch (error) {
      setBackupNotice(`创建备份失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function restoreWorkspaceBackup(bundlePath: string) {
    if (!window.qiuDesktop) {
      return;
    }

    setIsBackupBusy(true);
    setBackupNotice('');
    try {
      const restoredBackup = await window.qiuDesktop.restoreWorkspaceBackup(bundlePath);
      await loadRuntimeState();
      await loadWorkspaceBackups();
      setBackupNotice(`已恢复备份：${restoredBackup.bundleId}`);
    } catch (error) {
      setBackupNotice(`恢复备份失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsBackupBusy(false);
    }
  }

  async function openLocalPath(targetPath?: string) {
    if (!targetPath || !window.qiuDesktop) {
      return;
    }

    setLocalActionNotice('');
    try {
      await window.qiuDesktop.openLocalPath(targetPath);
    } catch (error) {
      setLocalActionNotice(`打开本地路径失败：${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  function stageComposerFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.size >= 0);
    if (files.length === 0) {
      return;
    }

    const stagedAt = new Date().toISOString();
    const attachments = files.map((file, index): ComposerAttachment => ({
      id: `attachment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || `附件 ${index + 1}`,
      size: file.size,
      type: file.type || undefined,
      localPath: getFileLocalPath(file),
      progress: 12,
      status: 'uploading',
      stagedAt
    }));

    setComposerAttachments((current) => [...current, ...attachments]);

    for (const attachment of attachments) {
      for (const [delay, progress] of [
        [120, 42],
        [280, 76],
        [520, 100]
      ] as const) {
        window.setTimeout(() => {
          setComposerAttachments((current) =>
            current.map((item) =>
              item.id === attachment.id
                ? {
                    ...item,
                    progress,
                    status: progress === 100 ? 'ready' : 'uploading'
                  }
                : item
            )
          );
        }, delay);
      }
    }
  }

  function removeComposerAttachment(attachmentId: string) {
    setComposerAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }

  function handleComposerDragOver(event: DragEvent<HTMLFormElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsComposerDragOver(true);
  }

  function handleComposerDragLeave(event: DragEvent<HTMLFormElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsComposerDragOver(false);
  }

  function handleComposerDrop(event: DragEvent<HTMLFormElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setIsComposerDragOver(false);
    stageComposerFiles(event.dataTransfer.files);
  }

  function handleComposerFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      stageComposerFiles(event.target.files);
    }

    event.target.value = '';
  }

  function handleWindowControl(action: DesktopWindowControlAction) {
    void window.qiuDesktop?.controlWindow(action);
  }

  function updateClientPreferences(patch: Partial<DesktopClientPreferences>) {
    setClientPreferences((current) => {
      const next = { ...current, ...patch };
      writeDesktopClientPreferences(next);
      return next;
    });
  }

  async function submitOnboarding(values: OnboardingFormValues) {
    const bindingCode = values.bindingCode.trim();
    if (!bindingCode || !window.qiuDesktop) {
      return;
    }

    setIsBindingDevice(true);
    setOnboardingNotice('');
    try {
      const boundState = await window.qiuDesktop.bindDesktopDevice(bindingCode);
      setRuntimeState(boundState);
      onboardingForm.resetFields();
      setOnboardingOpen(false);
    } catch (error) {
      setOnboardingNotice(`绑定失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsBindingDevice(false);
    }
  }

  const activeRolePackage = useMemo(() => {
    return (
      runtimeState.rolePackages.find(
        (rolePackage) => rolePackage.roleCode === runtimeState.localRuntime.activeRoleCode
      ) ?? runtimeState.rolePackages[0]
    );
  }, [runtimeState.localRuntime.activeRoleCode, runtimeState.rolePackages]);

  const selectedModelProfile = useMemo(() => {
    return runtimeState.modelProfiles.find((profile) => profile.id === selectedModelId);
  }, [runtimeState.modelProfiles, selectedModelId]);

  useEffect(() => {
    if (!selectedModelProfile) {
      return;
    }

    modelForm.setFieldsValue({
      providerName: selectedModelProfile.providerName,
      modelName: selectedModelProfile.modelName,
      purpose: selectedModelProfile.purpose,
      apiBaseUrl: selectedModelProfile.apiBaseUrl,
      apiKey: selectedModelProfile.apiKey,
      temperature: selectedModelProfile.temperature,
      maxTokens: selectedModelProfile.maxTokens,
      monthlyBudgetCents: selectedModelProfile.monthlyBudgetCents,
      fallbackProfileId: selectedModelProfile.fallbackProfileId
    });
    setModelTestNotice('');
  }, [modelForm, selectedModelProfile]);

  useEffect(() => {
    const webSearchSettings = runtimeState.localRuntime.toolSettings?.webSearch;
    toolSettingsForm.setFieldsValue({
      webSearchEndpoint: webSearchSettings?.endpoint,
      webSearchApiKey: webSearchSettings?.apiKey,
      allowPrivateNetwork: webSearchSettings?.allowPrivateNetwork ?? false
    });
  }, [runtimeState.localRuntime.toolSettings, toolSettingsForm]);

  const orderedTasks = useMemo(() => {
    return [...runtimeState.runtimeSnapshot.tasks].sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
    );
  }, [runtimeState.runtimeSnapshot.tasks]);

  const taskDetails = useMemo(() => {
    const detailsById = new Map(
      (runtimeState.taskDetails ?? []).map((detail) => [detail.taskId, detail])
    );

    return orderedTasks.map(
      (task) =>
        detailsById.get(task.taskId) ??
        createTaskDetailFromSummary(task, resolveRoleName(runtimeState.rolePackages, task.roleCode))
    );
  }, [orderedTasks, runtimeState.rolePackages, runtimeState.taskDetails]);

  const selectedTask = useMemo(() => {
    if (!taskDetails.length) {
      return undefined;
    }

    if (selectedTaskId === newTaskSelectionId) {
      return undefined;
    }

    if (!selectedTaskId) {
      return taskDetails[0];
    }

    return taskDetails.find((task) => task.taskId === selectedTaskId) ?? taskDetails[0];
  }, [selectedTaskId, taskDetails]);

  useEffect(() => {
    if (selectedSection !== 'workbench') {
      return;
    }

    const messageList = chatMessageListRef.current;
    if (!messageList) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      messageList.scrollTo({
        top: messageList.scrollHeight,
        behavior: 'smooth'
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    selectedSection,
    selectedTask?.taskId,
    selectedTask?.updatedAt,
    selectedTask?.executionLogs.length,
    selectedTask?.artifacts.length,
    selectedTask?.costRecords.length
  ]);

  const installedRoleSummaries = useMemo(() => {
    return runtimeState.runtimeSnapshot.rolePackages;
  }, [runtimeState.runtimeSnapshot.rolePackages]);

  const desktopRoleTemplates = useMemo(() => {
    const templates = authorizedRoleTemplateCatalog.templates.map(toDesktopRoleTemplate);
    if (authorizedRoleTemplateCatalog.source === 'server') {
      return templates;
    }

    return templates.length > 0 ? templates : fallbackDesktopRoleTemplates;
  }, [authorizedRoleTemplateCatalog.source, authorizedRoleTemplateCatalog.templates]);

  const desktopRoleTemplateByRoleCode = useMemo(() => {
    const authorizedByRoleCode = new Map(
      desktopRoleTemplates.map((template) => [template.roleCode, template] as const)
    );

    if (authorizedRoleTemplateCatalog.source !== 'server') {
      for (const template of fallbackDesktopRoleTemplates) {
        if (!authorizedByRoleCode.has(template.roleCode)) {
          authorizedByRoleCode.set(template.roleCode, template);
        }
      }
    }

    return authorizedByRoleCode;
  }, [authorizedRoleTemplateCatalog.source, desktopRoleTemplates]);

  const enabledModelCount = runtimeState.localRuntime.enabledModelProfileIds.length;
  const enabledToolCount = runtimeState.localRuntime.enabledToolIds.length;
  const knowledgeBindingCount = runtimeState.localRuntime.knowledgeBindingIds.length;
  const requiresOnboarding = runtimeState.localRuntime.workspaceId === pendingWorkspaceId;
  const currentSectionMeta = sectionMeta(selectedSection);
  const desktopShellClassName = [
    'desktop-shell',
    `desktop-density-${clientPreferences.density}`,
    `desktop-theme-${clientPreferences.theme}`
  ].join(' ');

  const connectionTone = useMemo(() => {
    if (runtimeState.serverConnection.state === 'online') return 'success';
    if (runtimeState.serverConnection.state === 'offline') return 'error';
    return 'default';
  }, [runtimeState.serverConnection.state]);

  return (
    <ConfigProvider locale={zhCN} theme={qiuAntTheme}>
      <AppProvider>
        <Layout className={desktopShellClassName}>
          <Layout.Content className="desktop-content">
            <Space direction="vertical" size={18} className="content-stack">
              <Flex
                align="center"
                justify="space-between"
                gap={16}
                wrap="wrap"
                className="desktop-global-header"
              >
                <div>
                  <Typography.Title level={2} className="page-title">
                    {currentSectionMeta.title}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {currentSectionMeta.description}
                  </Typography.Text>
                </div>

                <Space wrap>
                  {requiresOnboarding ? (
                    <Button type="primary" onClick={() => setOnboardingOpen(true)}>
                      初始化工作区
                    </Button>
                  ) : null}
                  <Tag icon={<SafetyCertificateOutlined />} color={connectionTone}>
                    {connectionLabel(runtimeState.serverConnection.state)}
                  </Tag>
                  <Button
                    icon={<CloudSyncOutlined />}
                    loading={isRefreshing}
                    onClick={refreshConnection}
                  >
                    检查连接
                  </Button>
                </Space>
              </Flex>

              <div className="product-shell">
                {renderProductTitleBar()}
                {renderProductRail()}
                <div
                  className={
                    selectedSection === 'workbench'
                      ? 'product-surface product-surface-flush'
                      : 'product-surface product-surface-padded'
                  }
                >
                  {selectedSection === 'workbench' ? renderWorkbench() : null}
                  {selectedSection === 'roles' ? renderRoles() : null}
                  {selectedSection === 'models' ? renderModels() : null}
                  {selectedSection === 'tools' ? renderTools() : null}
                  {selectedSection === 'knowledge' ? renderKnowledge() : null}
                  {selectedSection === 'settings' ? renderSettings() : null}
                </div>
              </div>
            </Space>
          </Layout.Content>
        </Layout>
        {renderOnboardingModal()}
      </AppProvider>
    </ConfigProvider>
  );

  function renderProductTitleBar() {
    return (
      <header className="product-titlebar">
        <div className="product-titlebar-drag">
          <Typography.Text strong className="product-titlebar-brand">
            QiuAI WorkOS
          </Typography.Text>
          <Typography.Text type="secondary" className="product-titlebar-section">
            {currentSectionMeta.title}
          </Typography.Text>
        </div>

        <div className="product-titlebar-actions">
          {requiresOnboarding ? (
            <Button size="small" type="primary" onClick={() => setOnboardingOpen(true)}>
              Bind
            </Button>
          ) : null}
          <Tag icon={<SafetyCertificateOutlined />} color={connectionTone}>
            {connectionLabel(runtimeState.serverConnection.state)}
          </Tag>
          <Button
            type="text"
            size="small"
            title="Check connection"
            icon={<CloudSyncOutlined />}
            loading={isRefreshing}
            onClick={refreshConnection}
          />
          <div className="window-control-group">
            <Button
              type="text"
              size="small"
              title="Minimize"
              icon={<MinusOutlined />}
              onClick={() => handleWindowControl('minimize')}
            />
            <Button
              type="text"
              size="small"
              title="Maximize"
              icon={<BorderOutlined />}
              onClick={() => handleWindowControl('toggle-maximize')}
            />
            <Button
              type="text"
              size="small"
              danger
              title="Close"
              icon={<CloseOutlined />}
              onClick={() => handleWindowControl('close')}
            />
          </div>
        </div>
      </header>
    );
  }

  function renderProductRail() {
    return (
      <aside className="product-rail">
        <div className="product-rail-actions">
          {sectionItems.map((item) => (
            <Button
              key={item.key}
              shape="circle"
              type={selectedSection === item.key ? 'primary' : 'default'}
              title={item.label}
              icon={item.icon}
              onClick={() => navigateToSection(item.key)}
            />
          ))}
        </div>

        <div className="product-rail-footer">
          {accountMenuOpen ? (
            <div className="account-popover">
              <div className="account-popover-profile">
                <span className="account-avatar">Q</span>
                <span>
                  <Typography.Text strong>QiuAI WorkOS</Typography.Text>
                  <Typography.Text type="secondary">
                    {connectionLabel(runtimeState.serverConnection.state)}
                  </Typography.Text>
                </span>
              </div>
              <div className="account-popover-list">
                <button type="button">
                  <UserOutlined />
                  <span>个人资料</span>
                </button>
                <button type="button">
                  <QuestionCircleOutlined />
                  <span>帮助中心</span>
                </button>
                <button type="button">
                  <InfoCircleOutlined />
                  <span>发行说明</span>
                </button>
                <button type="button">
                  <CloudDownloadOutlined />
                  <span>下载应用</span>
                </button>
                <button type="button">
                  <LogoutOutlined />
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          ) : null}
          <button
            type="button"
            className="product-rail-brand"
            title="QiuAI WorkOS"
            onClick={() => setAccountMenuOpen((open) => !open)}
          >
            Q
          </button>
        </div>
      </aside>
    );
  }

  function renderOnboardingModal() {
    return (
      <Modal
        title="桌面端绑定"
        open={onboardingOpen}
        closable={!requiresOnboarding}
        maskClosable={false}
        okText="绑定"
        cancelText="稍后"
        confirmLoading={isBindingDevice}
        cancelButtonProps={{
          style: requiresOnboarding ? { display: 'none' } : undefined
        }}
        onCancel={() => setOnboardingOpen(false)}
        onOk={() => onboardingForm.submit()}
      >
        <Form<OnboardingFormValues> form={onboardingForm} layout="vertical" onFinish={submitOnboarding}>
          <Form.Item
            name="bindingCode"
            label="绑定码"
            rules={[{ required: true, message: '请输入桌面端绑定码' }]}
          >
            <Input placeholder="例如：QIU-ABCD-EFGH" />
          </Form.Item>
          <Typography.Text type="secondary">
            绑定后，桌面端会自动接入当前工作区；本机数据仍保存在本地。
          </Typography.Text>
          {onboardingNotice ? <Typography.Text type="danger">{onboardingNotice}</Typography.Text> : null}
        </Form>
      </Modal>
    );
    return (
      <Modal
        title="企业工作区初始化"
        open={onboardingOpen}
        closable={!requiresOnboarding}
        maskClosable={false}
        okText="完成初始化"
        cancelText="稍后"
        cancelButtonProps={{
          style: requiresOnboarding ? { display: 'none' } : undefined
        }}
        onCancel={() => setOnboardingOpen(false)}
        onOk={() => onboardingForm.submit()}
      >
        <Form<OnboardingFormValues>
          form={onboardingForm}
          layout="vertical"
          onFinish={submitOnboarding}
        >
          <Form.Item
            name="workspaceId"
            label="Workspace ID"
            rules={[{ required: true, message: '请输入企业工作区 ID' }]}
          >
            <Input placeholder="例如：从 web-console 企业工作区复制 workspaceId" />
          </Form.Item>
          <Typography.Text type="secondary">
            桌面端会把任务、知识库摘要、模型配置和本地产物绑定到这个工作区；用户电脑上的资产仍保存在本机。
          </Typography.Text>
        </Form>
      </Modal>
    );
  }

  function renderWorkbench() {
    const runningTaskCount = orderedTasks.filter((task) => task.state === 'running').length;
    const waitingTaskCount = orderedTasks.filter(
      (task) => task.state === 'queued' || task.state === 'waiting_approval'
    ).length;
    const completedTaskCount = orderedTasks.filter((task) => task.state === 'completed').length;
    const latestTaskByRole = new Map<string, DesktopTaskDetail>();

    for (const task of orderedTasks) {
      if (latestTaskByRole.has(task.roleCode)) {
        continue;
      }

      const detail =
        taskDetails.find((item) => item.taskId === task.taskId) ??
        createTaskDetailFromSummary(task, resolveRoleName(runtimeState.rolePackages, task.roleCode));
      latestTaskByRole.set(task.roleCode, detail);
    }

    const activeRoleCode = activeRolePackage?.roleCode ?? runtimeState.rolePackages[0]?.roleCode ?? '';
    const activeRoleTasks = taskDetails
      .filter((task) => task.roleCode === activeRoleCode)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    const isCreatingNewTask = selectedTaskId === newTaskSelectionId;
    const conversationTask =
      isCreatingNewTask
        ? undefined
        : selectedTask && selectedTask.roleCode === activeRoleCode
        ? selectedTask
        : activeRoleTasks[0];
    const conversationRole =
      runtimeState.rolePackages.find((rolePackage) => rolePackage.roleCode === activeRoleCode) ??
      activeRolePackage;
    const conversationFinalAnswer = conversationTask ? readConversationFinalAnswer(conversationTask) : '';
    const conversationArtifacts = conversationTask
      ? conversationTask.artifacts.filter(isUserDeliverableArtifact)
      : [];
    const canRunConversationTask =
      conversationTask &&
      conversationTask.state !== 'running' &&
      conversationTask.state !== 'completed' &&
      conversationTask.state !== 'cancelled';
    const startNewConversationTask = () => {
      setSelectedTaskId(newTaskSelectionId);
      taskForm.resetFields(['input']);
      setTaskHistoryOpen(false);
    };
    const selectConversationTask = (taskId: string) => {
      setSelectedTaskId(taskId);
      setTaskHistoryOpen(false);
    };
    const taskHistoryContent = (
      <div className="task-history-popover">
        <Flex align="center" justify="space-between" gap={8} className="task-history-header">
          <Typography.Text strong>任务记录</Typography.Text>
          <Button size="small" onClick={startNewConversationTask}>
            新任务
          </Button>
        </Flex>

        {activeRoleTasks.length > 0 ? (
          <div className="task-history-list">
            {activeRoleTasks.slice(0, 20).map((task) => (
              <button
                key={task.taskId}
                type="button"
                className={
                  conversationTask?.taskId === task.taskId
                    ? 'task-history-item selected'
                    : 'task-history-item'
                }
                onClick={() => selectConversationTask(task.taskId)}
              >
                <span className="task-history-title">{task.title}</span>
                <span className="task-history-meta">
                  <Tag color={taskStateColor(task.state)}>{taskStateLabel(task.state)}</Tag>
                  <span>{formatShortTime(task.updatedAt)}</span>
                  <span>产物 {countUserDeliverableArtifacts(task)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史任务" />
        )}
      </div>
    );

    return (
      <div className="workbench-page">
        <aside className="agent-session-panel">
          <Flex align="center" justify="space-between" className="agent-panel-header">
            <Space direction="vertical" size={0}>
              <Typography.Text strong>对话</Typography.Text>
              <Typography.Text type="secondary">选择数字员工</Typography.Text>
            </Space>
            <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={() => navigateToSection('roles')} />
          </Flex>

          <div className="agent-session-list">
            {runtimeState.rolePackages.map((rolePackage) => {
              const latestTask = latestTaskByRole.get(rolePackage.roleCode);
              const isActive = rolePackage.roleCode === activeRoleCode;
              const summary = installedRoleSummaries.find((item) => item.roleCode === rolePackage.roleCode);

              return (
                <button
                  key={rolePackage.roleCode}
                  type="button"
                  className={isActive ? 'agent-session-item selected' : 'agent-session-item'}
                  onClick={() => {
                    activateRole(rolePackage.roleCode);
                    setTaskHistoryOpen(false);
                    if (latestTask) {
                      setSelectedTaskId(latestTask.taskId);
                    }
                  }}
                >
                  <span className="agent-avatar">{roleAvatarText(rolePackage.name)}</span>
                  <span className="agent-session-main">
                    <span className="agent-session-title-row">
                      <Typography.Text strong ellipsis>
                        {rolePackage.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="agent-session-time">
                        {latestTask ? formatShortTime(latestTask.updatedAt) : '待开始'}
                      </Typography.Text>
                    </span>
                    <Typography.Text type="secondary" ellipsis className="agent-session-preview">
                      {latestTask
                        ? `${taskStateLabel(latestTask.state)}：${latestTask.title}`
                        : rolePackage.summary ?? '点击后开始一段新的任务对话'}
                    </Typography.Text>
                    <span className="agent-session-tags">
                      <Tag color={isActive ? 'green' : 'default'}>{isActive ? '当前' : '可用'}</Tag>
                      <Tag>任务 {summary?.taskCount ?? 0}</Tag>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="chat-workspace">
          <header className="chat-workspace-header">
            <Space size={12}>
              <span className="chat-agent-avatar">
                {roleAvatarText(conversationRole?.name ?? '数字员工')}
              </span>
              <Space direction="vertical" size={2} className="chat-header-main">
                <span className="chat-header-title-row">
                  <Typography.Text strong>
                    {conversationRole?.name ?? '选择一个数字员工'}
                  </Typography.Text>
                  <Popover
                    trigger="click"
                    placement="bottomLeft"
                    open={taskHistoryOpen}
                    onOpenChange={setTaskHistoryOpen}
                    content={taskHistoryContent}
                  >
                    <Button size="small" className="task-switcher-button">
                      <span className="task-switcher-label">
                        {conversationTask?.title ?? '新任务'}
                      </span>
                      <DownOutlined />
                    </Button>
                  </Popover>
                </span>
                <Typography.Text type="secondary">
                  {conversationRole?.summary ?? '选择左侧员工后，直接用自然语言下达任务。'}
                </Typography.Text>
              </Space>
            </Space>

            <Space wrap>
              <Tag color="geekblue">运行中 {runningTaskCount}</Tag>
              <Tag color="gold">待处理 {waitingTaskCount}</Tag>
              <Tag color="green">已完成 {completedTaskCount}</Tag>
              <Button size="small" onClick={startNewConversationTask}>
                新任务
              </Button>
              <Button size="small" onClick={() => navigateToSection('models')}>
                模型
              </Button>
            </Space>
          </header>

          <div
            ref={chatMessageListRef}
            className="chat-message-list"
            role="log"
            aria-label="数字员工对话记录"
            aria-live="polite"
          >
            {conversationTask ? (
              <>
                <div className="chat-message-row user">
                  <div className="chat-bubble user-bubble">
                    {renderTaskInputMessage(conversationTask.input)}
                  </div>
                </div>

                <div className="chat-message-row assistant">
                  <span className="message-avatar">{roleAvatarText(conversationTask.roleName)}</span>
                  <div className="chat-bubble assistant-bubble">
                    <Typography.Text strong>{conversationTask.roleName}</Typography.Text>
                    <Typography.Paragraph style={{ margin: '6px 0 0' }}>
                      收到，我会按任务要求处理：{conversationTask.title}
                    </Typography.Paragraph>
                    <Space size={6} wrap>
                      <Tag color={taskStateColor(conversationTask.state)}>
                        {taskStateLabel(conversationTask.state)}
                      </Tag>
                      <Tag>{conversationTask.taskType}</Tag>
                      <Tag>产物 {conversationArtifacts.length}</Tag>
                    </Space>
                  </div>
                </div>

                <div className="chat-message-row assistant">
                  <span className="message-avatar"><ToolOutlined /></span>
                  <div className="chat-bubble assistant-bubble process-bubble">
                    <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                      <Typography.Text strong>工作流程</Typography.Text>
                      {canRunConversationTask ? (
                        <Button
                          size="small"
                          type="primary"
                          icon={<PlayCircleOutlined />}
                          onClick={() => void completeTask(conversationTask.taskId)}
                        >
                          开始执行
                        </Button>
                      ) : null}
                    </Flex>

                    {conversationTask.executionLogs.length > 0 ? (
                      <div className="process-step-list">
                        {conversationTask.executionLogs.map((log) => {
                          const workflowNodeDetail = readWorkflowNodeLogDetail(log);
                          return (
                            <div key={log.id} className={`process-step ${log.level}`}>
                              <span className="process-dot" />
                              <Space direction="vertical" size={6}>
                                <Space size={8} wrap>
                                  <Typography.Text strong>{executionEventLabel(log.eventType)}</Typography.Text>
                                  <Typography.Text type="secondary">{formatDate(log.createdAt)}</Typography.Text>
                                </Space>
                                <Typography.Text type="secondary">{executionEventMessage(log)}</Typography.Text>
                                {workflowNodeDetail ? renderWorkflowNodeLogDetail(workflowNodeDetail) : null}
                              </Space>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <Typography.Text type="secondary">
                        任务已进入对话，点击“开始执行”后会在这里展示模型调用、工具调用和产物生成过程。
                      </Typography.Text>
                    )}
                  </div>
                </div>

                {conversationFinalAnswer ? (
                  <div className="chat-message-row assistant">
                    <span className="message-avatar">{roleAvatarText(conversationTask.roleName)}</span>
                    <div className="chat-bubble assistant-bubble final-answer-bubble">
                      <Typography.Text strong>结果总结</Typography.Text>
                      <Typography.Paragraph className="final-answer-text">
                        {conversationFinalAnswer}
                      </Typography.Paragraph>
                    </div>
                  </div>
                ) : null}

                {conversationArtifacts.length > 0 ? (
                  <div className="chat-message-row assistant">
                    <span className="message-avatar"><FolderOpenOutlined /></span>
                    <div className="chat-bubble assistant-bubble artifact-bubble">
                      <Typography.Text strong>结果已生成</Typography.Text>
                      <div className="chat-artifact-grid">
                        {conversationArtifacts.map((artifact) => (
                          <div key={artifact.id} className="chat-artifact-card">
                            <Space align="start" size={10}>
                              <FolderOpenOutlined className="list-icon" />
                              <Space direction="vertical" size={4}>
                                <Space size={6} wrap>
                                  <Typography.Text strong>{artifact.title}</Typography.Text>
                                  <Tag>{artifact.type}</Tag>
                                </Space>
                                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                                  {formatArtifactPreview(artifact)}
                                </Typography.Paragraph>
                                {artifact.localPath ? (
                                  <Typography.Text type="secondary" ellipsis>
                                    {artifact.localPath}
                                  </Typography.Text>
                                ) : null}
                                {artifact.localPath ? (
                                  <Button
                                    size="small"
                                    type="primary"
                                    icon={<FolderOpenOutlined />}
                                    onClick={() => void openLocalPath(artifact.localPath)}
                                  >
                                    打开文件
                                  </Button>
                                ) : null}
                              </Space>
                            </Space>
                          </div>
                        ))}
                      </div>
                      {localActionNotice ? (
                        <Typography.Text type="warning">{localActionNotice}</Typography.Text>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {conversationTask.costRecords.length > 0 ? (
                  <div className="chat-message-row assistant">
                    <span className="message-avatar"><DatabaseOutlined /></span>
                    <div className="chat-bubble assistant-bubble cost-bubble">
                      <Typography.Text strong>预估成本</Typography.Text>
                      <Space size={8} wrap>
                        {conversationTask.costRecords.map((record) => (
                          <Tag key={record.id}>
                            {record.provider} / {record.modelName} / {formatEstimatedCostCents(record.costCents)}
                          </Tag>
                        ))}
                      </Space>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="chat-empty-state">
                <RobotOutlined />
                <Typography.Title level={3}>选择数字员工，直接开始对话</Typography.Title>
                <Typography.Text type="secondary">
                  你可以让员工读取本地文件、调用模型、生成报告或整理资料，执行过程会在这里逐步展示。
                </Typography.Text>
                <div className="prompt-chip-row">
                  {[
                    '整理客户反馈并生成周报',
                    '读取文件夹，输出一份销售线索清单',
                    '生成一份产品发布内容草稿'
                  ].map((prompt) => (
                    <Button
                      key={prompt}
                      onClick={() => taskForm.setFieldsValue({ input: prompt })}
                    >
                      {prompt}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Form<TaskFormValues>
            form={taskForm}
            className={isComposerDragOver ? 'chat-composer dragging' : 'chat-composer'}
            onDragOver={handleComposerDragOver}
            onDragLeave={handleComposerDragLeave}
            onDrop={handleComposerDrop}
            onFinish={(values) => {
              const input = values.input?.trim() ?? '';
              if (!activeRoleCode || (!input && composerAttachments.length === 0)) {
                return;
              }

              const taskInput = buildTaskInputWithAttachments(input, composerAttachments);
              createTask({
                roleCode: activeRoleCode,
                title: createChatTaskTitle(taskInput),
                input: taskInput,
                attachments: composerAttachments
              });
              setComposerAttachments([]);
            }}
          >
            {composerAttachments.length > 0 || isComposerDragOver ? (
              <div className="composer-attachment-row">
                {composerAttachments.map((attachment) => (
                  <div key={attachment.id} className="composer-attachment-chip">
                    <span className="attachment-file-icon">
                      <PaperClipOutlined />
                    </span>
                    <span className="attachment-file-main">
                      <Typography.Text strong ellipsis>
                        {attachment.name}
                      </Typography.Text>
                      <Typography.Text type="secondary">
                        {attachment.status === 'ready'
                          ? `${formatFileSize(attachment.size)} · 已就绪`
                          : `${attachment.progress}%`}
                      </Typography.Text>
                      <span className="attachment-progress">
                        <span style={{ width: `${attachment.progress}%` }} />
                      </span>
                    </span>
                    <button
                      type="button"
                      className="attachment-remove"
                      aria-label={`移除 ${attachment.name}`}
                      onClick={() => removeComposerAttachment(attachment.id)}
                    >
                      <CloseOutlined />
                    </button>
                  </div>
                ))}
                {isComposerDragOver ? (
                  <div className="composer-drop-hint">
                    <PaperClipOutlined />
                    <span>松开后添加到当前任务</span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <Form.Item
              name="input"
              rules={[
                {
                  validator: async (_, value) => {
                    if (String(value ?? '').trim() || composerAttachments.length > 0) {
                      return;
                    }

                    throw new Error('请输入任务，或拖入要处理的文件');
                  }
                }
              ]}
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 7 }}
                disabled={!activeRoleCode}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) {
                    return;
                  }

                  event.preventDefault();
                  taskForm.submit();
                }}
                placeholder="输入任务，或把文档、表格、图片直接拖到这里"
              />
            </Form.Item>
            <Flex align="center" justify="space-between" gap={12} wrap="wrap">
              <Space size={8} wrap>
                <Button icon={<PaperClipOutlined />} onClick={() => composerFileInputRef.current?.click()}>
                  添加文件
                </Button>
                <input
                  ref={composerFileInputRef}
                  className="composer-file-input"
                  type="file"
                  multiple
                  onChange={handleComposerFileInputChange}
                />
              </Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<PlayCircleOutlined />}
                disabled={!activeRoleCode}
              >
                发送任务
              </Button>
            </Flex>
          </Form>
        </section>
      </div>
    );
  }

  function renderTaskInputMessage(input: string) {
    const attachmentMarker = '\n附件：\n';
    if (!input.includes(attachmentMarker)) {
      return <Typography.Text>{input}</Typography.Text>;
    }

    const [message, attachmentSection = ''] = input.split(attachmentMarker);
    const attachmentLines = attachmentSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\d+\.\s/.test(line));

    return (
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        <Typography.Text>{message.trim()}</Typography.Text>
        <div className="chat-input-attachment-grid">
          {attachmentLines.map((line) => {
            const attachment = parseTaskInputAttachmentLine(line);
            return (
              <div key={line} className="chat-input-attachment-card">
                <PaperClipOutlined />
                <span>
                  <Typography.Text strong ellipsis>
                    {attachment.name}
                  </Typography.Text>
                  <Typography.Text type="secondary" ellipsis>
                    {attachment.meta}
                  </Typography.Text>
                </span>
              </div>
            );
          })}
        </div>
      </Space>
    );
  }

  function renderRoles() {
    const roleConfigTemplate = roleConfigRoleCode
      ? desktopRoleTemplateByRoleCode.get(roleConfigRoleCode)
      : undefined;
    const roleConfigRolePackage = runtimeState.rolePackages.find(
      (rolePackage) => rolePackage.roleCode === roleConfigRoleCode
    );
    const roleConfigPreviewPackage = roleConfigTemplate
      ? roleConfigRolePackage ?? toInstalledRolePackage(roleConfigTemplate)
      : undefined;
    const roleConfigModelRequirements = roleConfigPreviewPackage
      ? getRoleModelRuntimeRequirementStatuses(
          runtimeState.modelProfiles,
          runtimeState.localRuntime.enabledModelProfileIds,
          roleConfigPreviewPackage
        )
      : [];
    const roleConfigModelOptions = mergeModelProfileOptions(
      runtimeState.modelProfiles,
      roleConfigModelRequirements.map((requirement) => requirement.profile)
    );
    const roleConfigHasUnreadyModel = roleConfigModelRequirements.some(
      (requirement) => !requirement.ready
    );
    const installedRoleCodes = new Set(runtimeState.rolePackages.map((rolePackage) => rolePackage.roleCode));
    const roleCategories = buildRoleCategoryTabs(desktopRoleTemplates);
    const filteredRoleTemplates = desktopRoleTemplates.filter(
      (template) => selectedRoleCategory === '全部' || roleTemplateCategory(template) === selectedRoleCategory
    );

    return (
      <>
        <div className="catalog-page">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
            <div>
              <Typography.Title level={2} className="page-title">
                数字员工
              </Typography.Title>
              <Typography.Text type="secondary">
                选择、安装和配置企业可用的数字员工。
              </Typography.Text>
            </div>
            <Button icon={<ReloadOutlined />} loading={isLoadingRoleTemplates} onClick={loadAuthorizedRoleTemplates}>
              刷新
            </Button>
          </Flex>

          <div className="category-tabs">
            {roleCategories.map((category) => (
              <button
                key={category}
                type="button"
                className={selectedRoleCategory === category ? 'category-tab active' : 'category-tab'}
                onClick={() => setSelectedRoleCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>

          {roleTemplateNotice ? (
            <Typography.Paragraph type="secondary">
              {roleTemplateNotice}
            </Typography.Paragraph>
          ) : null}

          <div className="catalog-grid role-catalog-grid">
            {filteredRoleTemplates.map((template) => {
              const installed = installedRoleCodes.has(template.roleCode);
              const active = runtimeState.localRuntime.activeRoleCode === template.roleCode;
              const summary = installedRoleSummaries.find((item) => item.roleCode === template.roleCode);

              return (
                <Card key={template.roleCode} bordered={false} className="catalog-card role-catalog-card">
                  <Space direction="vertical" size={12} style={{ width: '100%' }}>
                    <Flex align="flex-start" justify="space-between" gap={12}>
                      <span className="catalog-card-icon">
                        <RobotOutlined />
                      </span>
                      <Space size={6} wrap>
                        <Tag color={active ? 'green' : installed ? 'blue' : 'default'}>
                          {active ? '当前' : installed ? '已安装' : '可安装'}
                        </Tag>
                        <Tag>{roleTemplateCategory(template)}</Tag>
                      </Space>
                    </Flex>

                    <Space direction="vertical" size={6} style={{ width: '100%' }}>
                      <Typography.Title level={5}>{template.name}</Typography.Title>
                      <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                        {template.summary}
                      </Typography.Paragraph>
                    </Space>

                    <Space size={6} wrap>
                      {template.skills.slice(0, 3).map((skill) => (
                        <Tag key={skill.code}>{skill.name}</Tag>
                      ))}
                    </Space>

                    <Typography.Text type="secondary" className="catalog-card-meta">
                      {template.industry} · 任务 {summary?.taskCount ?? 0}
                    </Typography.Text>

                    <Space wrap>
                      {installed ? (
                        <Button
                          type={active ? 'default' : 'primary'}
                          onClick={() => {
                            activateRole(template.roleCode);
                            navigateToSection('workbench');
                          }}
                        >
                          {active ? '进入对话' : '开始使用'}
                        </Button>
                      ) : (
                        <Button type="primary" onClick={() => openRoleConfig(template.roleCode, 'install')}>
                          安装
                        </Button>
                      )}
                      <Button onClick={() => openRoleConfig(template.roleCode, installed ? 'configure' : 'install')}>
                        配置
                      </Button>
                    </Space>
                  </Space>
                </Card>
              );
            })}
          </div>
        </div>

        <Modal
          open={roleConfigModalOpen}
          title={
            roleConfigTemplate
              ? `${roleConfigMode === 'install' ? '安装' : '配置'}：${roleConfigTemplate.name}`
              : roleConfigMode === 'install'
                ? '安装数字员工'
                : '配置数字员工'
          }
          okText={roleConfigMode === 'install' ? '安装' : '保存'}
          onCancel={closeRoleConfig}
          onOk={() => roleConfigForm.submit()}
          width={820}
          destroyOnHidden
        >
          {roleConfigTemplate ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="版本">{roleConfigTemplate.version}</Descriptions.Item>
                <Descriptions.Item label="行业">{roleConfigTemplate.industry}</Descriptions.Item>
                <Descriptions.Item label="场景">{roleConfigTemplate.scenario}</Descriptions.Item>
                <Descriptions.Item label="业务目标">{roleConfigTemplate.businessGoal}</Descriptions.Item>
              </Descriptions>

              <Space size={6} wrap>
                {roleConfigTemplate.skills.map((skill) => (
                  <Tag key={skill.code}>{skill.name}</Tag>
                ))}
              </Space>

              <Card size="small" bordered className="role-model-requirements-card">
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Flex align="center" justify="space-between" gap={12}>
                    <Typography.Text strong>模型连接</Typography.Text>
                    <Tag color={roleConfigHasUnreadyModel ? 'orange' : 'green'}>
                      {roleConfigHasUnreadyModel ? '待配置' : '已就绪'}
                    </Tag>
                  </Flex>
                  <Space size={[6, 6]} wrap>
                    {roleConfigModelRequirements.map((requirement) => (
                      <Tag
                        key={requirement.profile.id}
                        color={requirement.ready ? 'green' : requirement.issue === 'disabled' ? 'red' : 'orange'}
                      >
                        {requirement.profile.providerName} / {requirement.profile.modelName}
                        {requirement.requiredByNodeIds.length > 0
                          ? ` · ${requirement.requiredByNodeIds.length} 个节点`
                          : ''}
                        {requirement.issue === 'disabled'
                          ? ' · 未启用'
                          : requirement.issue === 'missing'
                            ? ' · 待创建'
                            : requirement.issue === 'unconfigured'
                              ? ' · 待填 Key'
                              : ''}
                      </Tag>
                    ))}
                  </Space>
                  <Typography.Text type="secondary">
                    API Key 只保存在当前电脑。本员工安装后，如果模型未配置，会自动打开模型配置。
                  </Typography.Text>
                </Space>
              </Card>

              <Form<RoleConfigFormValues>
                form={roleConfigForm}
                layout="vertical"
                id="role-config-form"
                initialValues={{
                  modelProfileIds: roleConfigRolePackage?.modelProfileIds ?? roleConfigTemplate.modelProfileIds,
                  toolIds: roleConfigRolePackage?.toolIds ?? roleConfigTemplate.toolIds,
                  knowledgeSources:
                    roleConfigRolePackage?.requiredKnowledgeSources ??
                    roleConfigTemplate.requiredKnowledgeSources
                }}
                onFinish={submitRoleConfig}
              >
                <Form.Item
                  name="modelProfileIds"
                  label="模型"
                  rules={[{ required: true, message: '至少选择一个模型绑定' }]}
                >
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择可使用的模型"
                    options={roleConfigModelOptions.map((profile) => ({
                      label: `${profile.providerName} / ${profile.modelName}`,
                      value: profile.id
                    }))}
                  />
                </Form.Item>

                <Form.Item name="toolIds" label="工具">
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择可调用的工具"
                    options={runtimeState.tools.map((tool) => ({
                      label: tool.name,
                      value: tool.id
                    }))}
                  />
                </Form.Item>

                <Form.Item name="knowledgeSources" label="知识">
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择要使用的知识"
                    options={knowledgeBindingCatalog.map((entry) => ({
                      label: entry.label,
                      value: entry.source
                    }))}
                  />
                </Form.Item>
              </Form>
            </Space>
          ) : (
            <Empty description="未找到数字员工" />
          )}
        </Modal>
      </>
    );
  }

  function renderModels() {
    const configuredModelCount = runtimeState.modelProfiles.filter(hasConfiguredModelApi).length;
    const enabledModelProfiles = runtimeState.modelProfiles.filter((profile) =>
      runtimeState.localRuntime.enabledModelProfileIds.includes(profile.id)
    );
    const filteredPresets = modelProviderPresets.filter((preset) => {
      const search = modelSearchQuery.trim().toLowerCase();
      if (!search) {
        return true;
      }

      return (
        preset.name.toLowerCase().includes(search) ||
        preset.summary.toLowerCase().includes(search) ||
        preset.models.some(
          (model) =>
            model.label.toLowerCase().includes(search) || model.modelName.toLowerCase().includes(search)
        )
      );
    });

    return (
      <>
        <div className="catalog-page">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
            <div>
              <Typography.Title level={2} className="page-title">
                模型配置
              </Typography.Title>
              <Typography.Text type="secondary">
                选择供应商，填写 API Key，模型配置只保存在本机。
              </Typography.Text>
            </div>

            <Space wrap>
              <Input.Search
                allowClear
                value={modelSearchQuery}
                onChange={(event) => setModelSearchQuery(event.target.value)}
                placeholder="搜索供应商或模型"
                style={{ width: 240 }}
              />
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  const preset = modelProviderPresets[0];
                  if (!preset) return;
                  applyModelProviderPreset(preset, preset.models[0]);
                  setModelConfigOpen(true);
                }}
              >
                新建配置
              </Button>
            </Space>
          </Flex>

          <div className="model-summary-row">
            <Tag color={configuredModelCount > 0 ? 'green' : 'orange'}>
              已接通 {configuredModelCount}/{runtimeState.modelProfiles.length}
            </Tag>
            <Tag color={enabledModelProfiles.length > 0 ? 'blue' : 'default'}>
              已启用 {enabledModelProfiles.length}
            </Tag>
          </div>

          <div className="catalog-grid model-provider-grid">
            {filteredPresets.map((preset) => (
              <Card key={preset.id} bordered={false} className="catalog-card model-provider-card">
                <Space direction="vertical" size={12} className="catalog-card-content">
                  <Flex align="flex-start" justify="space-between" gap={12}>
                    <span className={`model-provider-logo provider-${preset.id}`}>
                      {modelProviderLogoText(preset.name)}
                    </span>
                    {preset.apiBaseUrl ? <Tag color="blue">兼容接口</Tag> : null}
                  </Flex>

                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Typography.Title level={5}>{preset.name}</Typography.Title>
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                      {preset.summary}
                    </Typography.Paragraph>
                  </Space>

                  <Space size={6} wrap>
                    {preset.models.slice(0, 4).map((model) => (
                      <Tag key={`${preset.id}-${model.modelName}`}>{model.label}</Tag>
                    ))}
                  </Space>

                  <div className="catalog-card-action-row">
                    <Button
                      type="primary"
                      onClick={() => {
                        applyModelProviderPreset(preset, preset.models[0]);
                        setModelConfigOpen(true);
                      }}
                    >
                      配置
                    </Button>
                  </div>
                </Space>
              </Card>
            ))}
          </div>

          {filteredPresets.length === 0 ? (
            <div className="provider-empty">
              <Empty description="没有匹配的模型供应商" />
            </div>
          ) : null}
        </div>

        <Modal
          open={modelConfigOpen}
          title="模型配置"
          okText="保存"
          cancelText="关闭"
          width={760}
          destroyOnHidden
          onCancel={() => setModelConfigOpen(false)}
          onOk={() => modelForm.submit()}
        >
          {selectedModelProfile ? (
            <Form<ModelFormValues> form={modelForm} layout="vertical" onFinish={saveModelProfile}>
              <Form.Item name="apiKey" label="API Key">
                <Input.Password placeholder="只保存在本机，不上传服务端" />
              </Form.Item>
              <div className="inline-form-grid">
                <Form.Item name="providerName" label="供应商" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="modelName" label="模型" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="purpose" label="模型角色" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: '通用执行', value: 'general' },
                    { label: '深度推理', value: 'reasoning' },
                    { label: '视觉理解', value: 'vision' },
                    { label: '知识库向量', value: 'embeddings' },
                    { label: '文档处理', value: 'document' }
                  ]}
                />
              </Form.Item>

              <Divider style={{ margin: '8px 0 16px' }} />
              <div className="inline-form-grid">
                <Form.Item name="apiBaseUrl" label="API Base URL">
                  <Input placeholder="https://api.openai.com/v1" />
                </Form.Item>
                <Form.Item name="monthlyBudgetCents" label="月度预算（分）">
                  <InputNumber min={0} step={100} style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <div className="inline-form-grid">
                <Form.Item name="temperature" label="温度">
                  <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="maxTokens" label="最大输出">
                  <InputNumber min={0} step={256} style={{ width: '100%' }} />
                </Form.Item>
              </div>
              <Form.Item name="fallbackProfileId" label="失败时回退到">
                <Select
                  allowClear
                  options={runtimeState.modelProfiles
                    .filter((profile) => profile.id !== selectedModelProfile.id)
                    .map((profile) => ({
                      label: `${modelPurposeLabel(profile.purpose)} · ${profile.providerName}/${profile.modelName}`,
                      value: profile.id
                    }))}
                />
              </Form.Item>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Space wrap>
                  <Button
                    onClick={() => toggleModelProfile(
                      selectedModelProfile.id,
                      !runtimeState.localRuntime.enabledModelProfileIds.includes(selectedModelProfile.id)
                    )}
                  >
                    {runtimeState.localRuntime.enabledModelProfileIds.includes(selectedModelProfile.id)
                      ? '停用'
                      : '启用'}
                  </Button>
                  <Button
                    icon={<ReloadOutlined />}
                    loading={isTestingModel}
                    onClick={() => void testSelectedModelConnection()}
                  >
                    测试连接
                  </Button>
                </Space>
                {modelTestNotice ? (
                  <Typography.Text type={modelTestNotice.startsWith('模型连接正常') ? 'success' : 'danger'}>
                    {modelTestNotice}
                  </Typography.Text>
                ) : null}
              </Space>
            </Form>
          ) : (
            <Empty description="请选择模型供应商" />
          )}
        </Modal>
      </>
    );
  }

  function renderTools() {
    const webSearchSettings = runtimeState.localRuntime.toolSettings?.webSearch;
    const webSearchConfigured = Boolean(webSearchSettings?.endpoint);
    const toolCategories = buildToolCategoryTabs(runtimeState.tools);
    const filteredTools = runtimeState.tools.filter((tool) => {
      const search = toolSearchQuery.trim().toLowerCase();
      const categoryMatch = selectedToolCategory === '全部' || toolCategory(tool) === selectedToolCategory;
      const searchMatch = !search || (
        tool.name.toLowerCase().includes(search) ||
        tool.scope.toLowerCase().includes(search) ||
        tool.entryPoint.toLowerCase().includes(search) ||
        tool.capabilities.some((capability) => capability.toLowerCase().includes(search))
      );

      return categoryMatch && searchMatch;
    });
    const toolConfigTool = runtimeState.tools.find((tool) => tool.id === toolConfigToolId);

    return (
      <div className="catalog-page">
        <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
          <div>
            <Typography.Title level={2} className="page-title">
              工具
            </Typography.Title>
            <Typography.Text type="secondary">
              管理数字员工可调用的文档、网页和本地工具。
            </Typography.Text>
          </div>

          <Input.Search
            allowClear
            value={toolSearchQuery}
            onChange={(event) => setToolSearchQuery(event.target.value)}
            placeholder="搜索工具或能力"
            style={{ width: 240 }}
          />
        </Flex>

        <div className="category-tabs">
          {toolCategories.map((category) => (
            <button
              key={category}
              type="button"
              className={selectedToolCategory === category ? 'category-tab active' : 'category-tab'}
              onClick={() => setSelectedToolCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="catalog-grid tool-card-grid">
          {filteredTools.map((tool) => {
            const enabled = runtimeState.localRuntime.enabledToolIds.includes(tool.id);

            return (
              <Card key={tool.id} bordered={false} className="catalog-card tool-card">
                <Space direction="vertical" size={12} className="catalog-card-content">
                  <Flex align="flex-start" justify="space-between" gap={12}>
                    <span className="catalog-card-icon">
                      {toolCategoryIcon(tool)}
                    </span>
                    <Switch
                      size="small"
                      checked={enabled}
                      onChange={(checked) => toggleTool(tool.id, checked)}
                    />
                  </Flex>

                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Typography.Title level={5}>{tool.name}</Typography.Title>
                    <Typography.Text type="secondary">
                      {tool.entryPoint === 'bridge' ? '桌面桥接工具' : tool.scope}
                    </Typography.Text>
                  </Space>

                  <Space size={6} wrap>
                    <Tag color={enabled ? 'green' : 'default'}>{enabled ? '已启用' : '已停用'}</Tag>
                    <Tag>{toolCategory(tool)}</Tag>
                    {tool.requiresApproval ? <Tag color="gold">需审批</Tag> : null}
                    {tool.id === 'web-search' ? (
                      <Tag color={webSearchConfigured ? 'green' : 'orange'}>
                        {webSearchConfigured ? '已配置' : '待配置'}
                      </Tag>
                    ) : null}
                  </Space>

                  <Space size={6} wrap>
                    {tool.capabilities.slice(0, 4).map((capability) => (
                      <Tag key={capability}>{capability}</Tag>
                    ))}
                  </Space>

                  <div className="catalog-card-action-row">
                    <Button
                      onClick={() => {
                        setToolSettingsNotice('');
                        setToolConfigToolId(tool.id);
                        if (tool.id === 'web-search') {
                          toolSettingsForm.setFieldsValue({
                            webSearchEndpoint: webSearchSettings?.endpoint,
                            webSearchApiKey: webSearchSettings?.apiKey,
                            allowPrivateNetwork: webSearchSettings?.allowPrivateNetwork ?? false
                          });
                        }
                      }}
                    >
                      配置
                    </Button>
                  </div>
                </Space>
              </Card>
            );
          })}
        </div>

        {filteredTools.length === 0 ? (
          <div className="provider-empty">
            <Empty description="没有匹配的工具" />
          </div>
        ) : null}

        <Modal
          open={Boolean(toolConfigToolId)}
          title={toolConfigTool ? `${toolConfigTool.name}配置` : '工具配置'}
          okText={toolConfigToolId === 'web-search' ? '保存' : '关闭'}
          cancelText="取消"
          width={640}
          destroyOnHidden
          onCancel={() => setToolConfigToolId('')}
          onOk={() => {
            if (toolConfigToolId === 'web-search') {
              toolSettingsForm.submit();
              return;
            }
            setToolConfigToolId('');
          }}
          okButtonProps={toolConfigToolId === 'web-search' ? { loading: isSavingToolSettings } : undefined}
        >
          {toolConfigToolId === 'web-search' ? (
            <Form<ToolSettingsFormValues>
              form={toolSettingsForm}
              layout="vertical"
              onFinish={async (values) => {
                const saved = await saveToolSettings(values);
                if (saved) {
                  setToolConfigToolId('');
                }
              }}
            >
              <Form.Item name="webSearchEndpoint" label="搜索服务地址">
                <Input placeholder="https://search.example.com/api/search" />
              </Form.Item>
              <Form.Item name="webSearchApiKey" label="搜索服务密钥">
                <Input.Password placeholder="只保存在本机" />
              </Form.Item>
              <Form.Item
                name="allowPrivateNetwork"
                label="允许私网访问"
                valuePropName="checked"
                extra="默认会拦截 127.0.0.1、10.x、192.168.x、172.16-31.x。"
              >
                <Switch />
              </Form.Item>
              {toolSettingsNotice ? (
                <Typography.Text type={toolSettingsNotice.startsWith('工具配置已保存') ? 'success' : 'danger'}>
                  {toolSettingsNotice}
                </Typography.Text>
              ) : null}
            </Form>
          ) : (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="名称">
                  {toolConfigTool?.name ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="入口">
                  {toolConfigTool?.entryPoint ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="范围">
                  {toolConfigTool?.scope ?? '-'}
                </Descriptions.Item>
              </Descriptions>
              <Typography.Text type="secondary">
                该工具使用默认配置或本地桥接能力，无额外配置项。
              </Typography.Text>
            </Space>
          )}
        </Modal>
      </div>
    );
  }

  function renderKnowledge() {
    const knowledgeSources =
      runtimeState.knowledgeSources.length > 0
        ? runtimeState.knowledgeSources
        : runtimeState.localRuntime.knowledgeBindingIds.map((bindingId) =>
            createKnowledgeSourceFromBindingId(bindingId)
          );
    const enterpriseOptions = knowledgeBindingCatalog.filter(
      (entry) => entry.source === 'workspace_library' || entry.source === 'server_summary'
    );
    const localOptions = knowledgeBindingCatalog.filter(
      (entry) => entry.source === 'local_file' || entry.source === 'local_folder'
    );
    const visibleOptions = selectedKnowledgeScope === 'enterprise' ? enterpriseOptions : localOptions;
    const visibleSources = knowledgeSources.filter((source) =>
      selectedKnowledgeScope === 'enterprise'
        ? source.source === 'workspace_library' || source.source === 'server_summary'
        : source.source === 'local_file' || source.source === 'local_folder'
    );

    return (
      <div className="catalog-page">
        <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
          <div>
            <Typography.Title level={2} className="page-title">
              知识库
            </Typography.Title>
            <Typography.Text type="secondary">
              同步企业知识库，或导入本地资料给数字员工使用。
            </Typography.Text>
          </div>

          {selectedKnowledgeScope === 'enterprise' ? (
            <Button type="primary" icon={<CloudSyncOutlined />} loading={isSyncing} onClick={syncRuntimeState}>
              同步
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<FileAddOutlined />}
              onClick={() => {
                const localFileOption = localOptions.find((option) => option.source === 'local_file') ?? localOptions[0];
                if (localFileOption) {
                  void addKnowledgeBinding(localFileOption);
                }
              }}
            >
              导入
            </Button>
          )}
        </Flex>

        <div className="category-tabs">
          <button
            type="button"
            className={selectedKnowledgeScope === 'enterprise' ? 'category-tab active' : 'category-tab'}
            onClick={() => setSelectedKnowledgeScope('enterprise')}
          >
            企业知识库
          </button>
          <button
            type="button"
            className={selectedKnowledgeScope === 'local' ? 'category-tab active' : 'category-tab'}
            onClick={() => setSelectedKnowledgeScope('local')}
          >
            本地知识库
          </button>
        </div>

        <div className="catalog-grid knowledge-source-grid">
          {visibleOptions.map((option) => {
            const isBound = runtimeState.localRuntime.knowledgeBindingIds.includes(option.bindingId);

            return (
              <Card key={option.bindingId} bordered={false} className="catalog-card knowledge-source-card">
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Flex align="flex-start" justify="space-between" gap={12}>
                    <span className="catalog-card-icon">
                      {selectedKnowledgeScope === 'enterprise' ? <CloudSyncOutlined /> : <DatabaseOutlined />}
                    </span>
                    <Tag color={isBound ? 'green' : 'default'}>{isBound ? '已绑定' : '可绑定'}</Tag>
                  </Flex>
                  <Typography.Title level={5}>{option.label}</Typography.Title>
                  <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                    {option.description}
                  </Typography.Paragraph>
                  <Button
                    type={isBound ? 'default' : 'primary'}
                    disabled={isBound}
                    onClick={() => void addKnowledgeBinding(option)}
                  >
                    {isBound ? '已绑定' : selectedKnowledgeScope === 'enterprise' ? '添加' : '导入'}
                  </Button>
                </Space>
              </Card>
            );
          })}
        </div>

        <section className="simple-panel">
          <Typography.Title level={5}>已绑定</Typography.Title>
          <List
            dataSource={visibleSources}
            locale={{ emptyText: selectedKnowledgeScope === 'enterprise' ? '尚未同步企业知识库' : '尚未导入本地知识库' }}
            renderItem={(source) => (
              <List.Item>
                <List.Item.Meta
                  avatar={<DatabaseOutlined className="list-icon" />}
                  title={
                    <Space size={8} wrap>
                      <Typography.Text strong>{source.label}</Typography.Text>
                      {source.enabled ? <Tag color="green">已启用</Tag> : <Tag>已停用</Tag>}
                    </Space>
                  }
                  description={source.localPath ?? source.summary ?? source.id}
                />
              </List.Item>
            )}
          />
          {syncNotice ? <Typography.Text type="secondary">{syncNotice}</Typography.Text> : null}
        </section>
      </div>
    );
  }

  function renderGeneralSettings() {
    const startupOptions = sectionItems.map((item) => ({
      value: item.key,
      label: item.label
    }));
    const latestBackup = workspaceBackups[0];

    return (
      <div className="settings-list-page">
        <section className="settings-list-section">
          <Typography.Text strong className="settings-list-title">外观</Typography.Text>
          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>主题</Typography.Text>
              <Typography.Text type="secondary">桌面端显示风格</Typography.Text>
            </div>
            <Select<DesktopThemePreference>
              value={clientPreferences.theme}
              options={desktopThemeOptions}
              style={{ width: 160 }}
              onChange={(theme) => updateClientPreferences({ theme })}
            />
          </div>

          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>界面密度</Typography.Text>
              <Typography.Text type="secondary">列表和面板间距</Typography.Text>
            </div>
            <Select<DesktopDensityPreference>
              value={clientPreferences.density}
              options={desktopDensityOptions}
              style={{ width: 160 }}
              onChange={(density) => updateClientPreferences({ density })}
            />
          </div>
        </section>

        <section className="settings-list-section">
          <Typography.Text strong className="settings-list-title">启动</Typography.Text>
          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>启动页</Typography.Text>
              <Typography.Text type="secondary">打开客户端后的默认页面</Typography.Text>
            </div>
            <Select<SectionKey>
              value={clientPreferences.startupSection}
              options={startupOptions}
              style={{ width: 160 }}
              onChange={(startupSection) => updateClientPreferences({ startupSection })}
            />
          </div>
        </section>

        <section className="settings-list-section">
          <Typography.Text strong className="settings-list-title">连接</Typography.Text>
          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>控制端</Typography.Text>
              <Typography.Text type="secondary">{runtimeState.app.serverBaseUrl}</Typography.Text>
            </div>
            <Space wrap>
              <Tag color={connectionTone}>{connectionLabel(runtimeState.serverConnection.state)}</Tag>
              <Button size="small" icon={<CloudSyncOutlined />} loading={isRefreshing} onClick={refreshConnection}>
                检查
              </Button>
            </Space>
          </div>

          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>同步摘要</Typography.Text>
              <Typography.Text type="secondary">
                {syncNotice || `当前策略：${syncPolicyLabel(runtimeState.localRuntime.syncPolicy)}`}
              </Typography.Text>
            </div>
            <Button size="small" type="primary" loading={isSyncing} onClick={syncRuntimeState}>
              同步
            </Button>
          </div>
        </section>

        <section className="settings-list-section">
          <Typography.Text strong className="settings-list-title">本地数据</Typography.Text>
          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>数据目录</Typography.Text>
              <Typography.Text type="secondary" ellipsis copyable>
                {runtimeState.app.userDataPath}
              </Typography.Text>
            </div>
            <Button size="small" icon={<FolderOpenOutlined />} onClick={() => void openLocalPath(runtimeState.app.userDataPath)}>
              打开
            </Button>
          </div>

          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>备份</Typography.Text>
              <Typography.Text type="secondary">
                {backupNotice || '创建本机备份，用于迁移和恢复。'}
              </Typography.Text>
            </div>
            <Button size="small" icon={<DownloadOutlined />} loading={isBackupBusy} onClick={() => void createWorkspaceBackup()}>
              创建
            </Button>
          </div>

          <div className="settings-list-row">
            <div className="client-setting-copy">
              <Typography.Text strong>恢复</Typography.Text>
              <Typography.Text type="secondary">
                {latestBackup ? `最近备份：${formatDate(latestBackup.createdAt)}` : '暂无可恢复备份'}
              </Typography.Text>
            </div>
            <Space wrap>
              <Button size="small" icon={<ReloadOutlined />} loading={isRefreshing} onClick={loadWorkspaceBackups}>
                刷新
              </Button>
              <Button
                size="small"
                icon={<RollbackOutlined />}
                disabled={!latestBackup}
                loading={isBackupBusy}
                onClick={() => {
                  if (latestBackup) {
                    void restoreWorkspaceBackup(latestBackup.bundlePath);
                  }
                }}
              >
                恢复最近
              </Button>
            </Space>
          </div>
        </section>
      </div>
    );
  }

  function renderSettings() {
    return (
      <div className="settings-page client-settings-page">
        {renderGeneralSettings()}
      </div>
    );
  }

  function installRole(template: DesktopRoleTemplate, values?: RoleConfigFormValues) {
    setRuntimeState((current) => {
      const existingRole = current.rolePackages.find(
        (rolePackage) => rolePackage.roleCode === template.roleCode
      );
      const now = new Date().toISOString();
      const configuredRolePackage = {
        ...(existingRole ?? toInstalledRolePackage(template)),
        modelProfileIds: values?.modelProfileIds ?? template.modelProfileIds,
        toolIds: values?.toolIds ?? template.toolIds,
        requiredKnowledgeSources: values?.knowledgeSources ?? template.requiredKnowledgeSources
      };
      const installedRolePackage = {
        ...configuredRolePackage,
        modelProfileIds: readRequiredModelProfileIdsForRolePackage(configuredRolePackage)
      };
      const rolePackages = existingRole
        ? current.rolePackages.map((rolePackage) =>
            rolePackage.roleCode === template.roleCode ? installedRolePackage : rolePackage
          )
        : [installedRolePackage, ...current.rolePackages];
      const modelProfiles = ensureModelProfilesForRolePackage(
        current.modelProfiles,
        installedRolePackage
      );
      const enabledKnowledgeBindingIds = mergeUniqueStrings(
        current.localRuntime.knowledgeBindingIds,
        installedRolePackage.requiredKnowledgeSources.map((source) => getKnowledgeBindingId(source))
      );
      const enabledModelProfileIds = mergeUniqueStrings(
        current.localRuntime.enabledModelProfileIds,
        installedRolePackage.modelProfileIds
      );
      const enabledToolIds = mergeUniqueStrings(
        current.localRuntime.enabledToolIds,
        installedRolePackage.toolIds
      );
      const activeRoleCode =
        current.localRuntime.activeRoleCode && rolePackages.some((rolePackage) => rolePackage.roleCode === current.localRuntime.activeRoleCode)
          ? current.localRuntime.activeRoleCode
          : template.roleCode;
      const tasks = current.runtimeSnapshot.tasks;

      return {
        ...current,
        rolePackages,
        modelProfiles,
        localRuntime: {
          ...current.localRuntime,
          installedRoleCodes: rolePackages.map((rolePackage) => rolePackage.roleCode),
          activeRoleCode,
          knowledgeBindingIds: enabledKnowledgeBindingIds,
          enabledModelProfileIds,
          enabledToolIds
        },
        runtimeSnapshot: {
          ...current.runtimeSnapshot,
          rolePackages: rebuildRoleSummaries(
            rolePackages,
            tasks,
            current.runtimeSnapshot.rolePackages,
            activeRoleCode,
            now
          ),
          tools: rebuildToolSummaries(current.tools, enabledToolIds, current.runtimeSnapshot.tools)
        }
      };
    });
  }

  function activateRole(roleCode: string) {
    setRuntimeState((current) => {
      if (current.localRuntime.activeRoleCode === roleCode) {
        return current;
      }

      const now = new Date().toISOString();
      return {
        ...current,
        localRuntime: {
          ...current.localRuntime,
          activeRoleCode: roleCode
        },
        runtimeSnapshot: {
          ...current.runtimeSnapshot,
          rolePackages: rebuildRoleSummaries(
            current.rolePackages,
            current.runtimeSnapshot.tasks,
            current.runtimeSnapshot.rolePackages,
            roleCode,
            now
          )
        }
      };
    });
  }

  function toggleModelProfile(profileId: string, enabled: boolean) {
    setRuntimeState((current) => {
      const enabledModelProfileIds = enabled
        ? mergeUniqueStrings(current.localRuntime.enabledModelProfileIds, [profileId])
        : current.localRuntime.enabledModelProfileIds.filter((id) => id !== profileId);

      return {
        ...current,
        localRuntime: {
          ...current.localRuntime,
          enabledModelProfileIds
        }
      };
    });
  }

  function saveModelProfile(values: ModelFormValues) {
    if (!selectedModelProfile) {
      return;
    }

    setRuntimeState((current) => ({
      ...current,
      modelProfiles: current.modelProfiles.map((profile) =>
        profile.id === selectedModelProfile.id
          ? {
              ...profile,
              providerName: values.providerName.trim(),
              modelName: values.modelName.trim(),
              purpose: values.purpose,
              apiBaseUrl: values.apiBaseUrl?.trim() || undefined,
              apiKey: values.apiKey?.trim() || undefined,
              temperature: values.temperature,
              maxTokens: values.maxTokens,
              monthlyBudgetCents: values.monthlyBudgetCents,
              fallbackProfileId: values.fallbackProfileId || undefined
            }
          : profile
      )
    }));
  }

  function applyModelProviderPreset(
    preset: ModelProviderPreset,
    model: ModelProviderPreset['models'][number]
  ) {
    const targetProfile =
      runtimeState.modelProfiles.find((profile) => profile.purpose === model.purpose) ??
      selectedModelProfile ??
      runtimeState.modelProfiles[0];

    if (!targetProfile) {
      return;
    }

    setSelectedModelId(targetProfile.id);
    setRuntimeState((current) => ({
      ...current,
      modelProfiles: current.modelProfiles.map((profile) =>
        profile.id === targetProfile.id
          ? {
              ...profile,
              providerName: preset.name,
              modelName: model.modelName,
              purpose: model.purpose,
              apiBaseUrl: preset.apiBaseUrl,
              temperature: model.temperature,
              maxTokens: model.maxTokens
            }
          : profile
      )
    }));
    modelForm.setFieldsValue({
      providerName: preset.name,
      modelName: model.modelName,
      purpose: model.purpose,
      apiBaseUrl: preset.apiBaseUrl,
      apiKey: targetProfile.apiKey,
      temperature: model.temperature,
      maxTokens: model.maxTokens,
      monthlyBudgetCents: targetProfile.monthlyBudgetCents,
      fallbackProfileId: targetProfile.fallbackProfileId
    });
    setModelTestNotice(`已套用 ${preset.name} / ${model.modelName}，请填写 API Key 后保存并测试连接。`);
  }

  async function testSelectedModelConnection() {
    if (!selectedModelProfile || !window.qiuDesktop) {
      return;
    }

    setIsTestingModel(true);
    setModelTestNotice('');

    try {
      const values = await modelForm.validateFields();
      const apiBaseUrl = values.apiBaseUrl?.trim();
      const apiKey = values.apiKey?.trim();

      if (!apiBaseUrl || !apiKey) {
        setModelTestNotice('请先填写 API Base URL 和 API Key。');
        return;
      }

      const profile: ModelProfile = {
        ...selectedModelProfile,
        providerName: values.providerName.trim(),
        modelName: values.modelName.trim(),
        purpose: values.purpose,
        apiBaseUrl,
        apiKey,
        temperature: values.temperature,
        maxTokens: Math.min(values.maxTokens ?? 256, 512),
        monthlyBudgetCents: values.monthlyBudgetCents,
        fallbackProfileId: values.fallbackProfileId || undefined
      };

      const response = await window.qiuDesktop.invokeModelChat({
        profile,
        timeoutMs: 20_000,
        messages: [
          {
            role: 'system',
            content: 'You are a connection test assistant. Reply briefly in Chinese.'
          },
          {
            role: 'user',
            content: '请回复“连接正常”，并说明当前模型可用于 QiuAI WorkOS 桌面端。'
          }
        ]
      });

      setModelTestNotice(`模型连接正常：${response.provider}/${response.modelName}`);
    } catch (error) {
      setModelTestNotice(`模型连接失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsTestingModel(false);
    }
  }

  function toggleTool(toolId: string, enabled: boolean) {
    setRuntimeState((current) => {
      const enabledToolIds = enabled
        ? mergeUniqueStrings(current.localRuntime.enabledToolIds, [toolId])
        : current.localRuntime.enabledToolIds.filter((id) => id !== toolId);

      return {
        ...current,
        localRuntime: {
          ...current.localRuntime,
          enabledToolIds
        },
        runtimeSnapshot: {
          ...current.runtimeSnapshot,
          tools: rebuildToolSummaries(current.tools, enabledToolIds, current.runtimeSnapshot.tools)
        }
      };
    });
  }

  async function saveToolSettings(values: ToolSettingsFormValues) {
    setIsSavingToolSettings(true);
    setToolSettingsNotice('');
    try {
      const webSearchEndpoint = values.webSearchEndpoint?.trim() || undefined;
      const webSearchApiKey = values.webSearchApiKey?.trim() || undefined;
      const allowPrivateNetwork = values.allowPrivateNetwork ?? false;

      setRuntimeState((current) => ({
        ...current,
        localRuntime: {
          ...current.localRuntime,
          toolSettings: {
            ...current.localRuntime.toolSettings,
            webSearch: {
              endpoint: webSearchEndpoint,
              apiKey: webSearchApiKey,
              allowPrivateNetwork
            }
          }
        }
      }));
      setToolSettingsNotice('工具配置已保存到本地。');
      return true;
    } catch (error) {
      setToolSettingsNotice(`工具配置保存失败：${error instanceof Error ? error.message : 'unknown error'}`);
      return false;
    } finally {
      setIsSavingToolSettings(false);
    }
  }

  async function addKnowledgeBinding(option: KnowledgeBindingCatalogEntry) {
    const now = new Date().toISOString();
    const pathResult =
      option.source === 'local_folder' || option.source === 'local_file'
        ? await window.qiuDesktop?.selectKnowledgeSourcePath(option.source)
        : undefined;

    if (pathResult?.canceled) {
      return;
    }

    const knowledgeSource: DesktopKnowledgeSourceSummary = {
      id: option.bindingId,
      source: option.source,
      label: pathResult?.label ?? option.label,
      enabled: true,
      createdAt: now,
      localPath: pathResult?.path,
      lastIndexedAt: pathResult?.lastIndexedAt,
      summary:
        pathResult?.summary
          ? pathResult.summary
          : option.description
    };

    setRuntimeState((current) => {
      if (current.localRuntime.knowledgeBindingIds.includes(option.bindingId)) {
        return current;
      }

      return {
        ...current,
        knowledgeSources: [
          ...current.knowledgeSources.filter((source) => source.id !== knowledgeSource.id),
          knowledgeSource
        ],
        localRuntime: {
          ...current.localRuntime,
          knowledgeBindingIds: [...current.localRuntime.knowledgeBindingIds, option.bindingId]
        }
      };
    });
  }

  async function persistTaskArtifacts(
    task: DesktopTaskDetail,
    workspaceId: string,
    createdAt: string
  ): Promise<DesktopTaskDetail> {
    const bridge = window.qiuDesktop;
    if (!bridge || task.artifacts.length === 0) {
      return task;
    }

    const artifacts: DesktopTaskDetail['artifacts'] = [];
    const artifactLogs: DesktopTaskDetail['executionLogs'] = [];

    for (const artifact of task.artifacts) {
      if (artifact.localPath) {
        artifacts.push(artifact);
        continue;
      }

      try {
        const result = await bridge.writeTaskArtifact({
          workspaceId,
          taskId: task.taskId,
          artifact
        });

        artifacts.push({
          ...artifact,
          localPath: result.localPath
        });
        artifactLogs.push({
          id: `${task.taskId}-log-local-filesystem-invoked-${artifact.id}-${Date.parse(createdAt) || Date.now()}`,
          level: 'info',
          eventType: 'TOOL_INVOKED',
          message: `local-filesystem wrote artifact file: ${result.localPath}`,
          createdAt
        });
        artifactLogs.push({
          id: `${task.taskId}-log-artifact-file-written-${artifact.id}-${Date.parse(createdAt) || Date.now()}`,
          level: 'info',
          eventType: 'ARTIFACT_FILE_WRITTEN',
          message: `Artifact written to local file: ${result.localPath}`,
          createdAt
        });
      } catch (error) {
        artifacts.push(artifact);
        artifactLogs.push({
          id: `${task.taskId}-log-artifact-file-write-failed-${artifact.id}-${Date.parse(createdAt) || Date.now()}`,
          level: 'warning',
          eventType: 'ARTIFACT_FILE_WRITE_FAILED',
          message: error instanceof Error ? error.message : 'Artifact file write failed.',
          createdAt
        });
      }
    }

    return {
      ...task,
      artifacts,
      executionLogs: [...task.executionLogs, ...artifactLogs]
    };
  }

  function openRoleConfig(roleCode: string, mode: 'install' | 'configure') {
    const template = desktopRoleTemplateByRoleCode.get(roleCode);
    if (!template) {
      return;
    }

    const currentRolePackage =
      runtimeState.rolePackages.find((rolePackage) => rolePackage.roleCode === roleCode) ??
      toInstalledRolePackage(template);

    setRoleConfigRoleCode(roleCode);
    setRoleConfigMode(mode);
    setRoleConfigModalOpen(true);
    roleConfigForm.setFieldsValue({
      modelProfileIds: currentRolePackage.modelProfileIds,
      toolIds: currentRolePackage.toolIds,
      knowledgeSources: currentRolePackage.requiredKnowledgeSources
    });
  }

  function closeRoleConfig() {
    setRoleConfigModalOpen(false);
    setRoleConfigRoleCode('');
    roleConfigForm.resetFields();
  }

  function submitRoleConfig(values: RoleConfigFormValues) {
    const template = desktopRoleTemplateByRoleCode.get(roleConfigRoleCode);
    if (!template) {
      return;
    }

    const previewRolePackage: RolePackageManifest = {
      ...toInstalledRolePackage(template),
      modelProfileIds: values.modelProfileIds,
      toolIds: values.toolIds,
      requiredKnowledgeSources: values.knowledgeSources
    };
    const normalizedPreviewRolePackage: RolePackageManifest = {
      ...previewRolePackage,
      modelProfileIds: readRequiredModelProfileIdsForRolePackage(previewRolePackage)
    };
    const nextModelProfiles = ensureModelProfilesForRolePackage(
      runtimeState.modelProfiles,
      normalizedPreviewRolePackage
    );
    const nextEnabledModelProfileIds = mergeUniqueStrings(
      runtimeState.localRuntime.enabledModelProfileIds,
      normalizedPreviewRolePackage.modelProfileIds
    );
    const firstUnreadyModelProfileId = findFirstUnreadyRequiredModelProfileId(
      nextModelProfiles,
      nextEnabledModelProfileIds,
      normalizedPreviewRolePackage
    );

    installRole(template, values);
    closeRoleConfig();

    if (firstUnreadyModelProfileId) {
      setSelectedModelId(firstUnreadyModelProfileId);
      setModelConfigOpen(true);
      setModelTestNotice('请先填写 API Key 并测试连接，模型配置只保存在当前电脑。');
      navigateToSection('models');
    }
  }

  function prepareRoleForTaskRun(roleCode: string): DesktopRuntimeState | undefined {
    const rolePackage = runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    if (!rolePackage) {
      return runtimeState;
    }

    const preparedRolePackage: RolePackageManifest = {
      ...rolePackage,
      modelProfileIds: readRequiredModelProfileIdsForRolePackage(rolePackage)
    };
    const preparedModelProfiles = ensureModelProfilesForRolePackage(
      runtimeState.modelProfiles,
      preparedRolePackage
    );
    const modelReadiness = getRoleModelRuntimeRequirementStatuses(
      preparedModelProfiles,
      runtimeState.localRuntime.enabledModelProfileIds,
      preparedRolePackage
    );
    const firstUnreadyModel = modelReadiness.find((requirement) => !requirement.ready);
    const preparedState = replaceRolePackageAndModelProfiles(
      runtimeState,
      preparedRolePackage,
      preparedModelProfiles
    );

    if (!firstUnreadyModel) {
      return preparedState;
    }

    setRuntimeState(preparedState);
    setSelectedModelId(firstUnreadyModel.profile.id);
    setModelConfigOpen(true);
    setModelTestNotice(
      firstUnreadyModel.issue === 'disabled'
        ? '这个数字员工需要先启用指定模型，并确认 API Key 已填写。'
        : '这个数字员工需要先填写指定模型的 API Key，并测试连接。'
    );
    navigateToSection('models');
    return undefined;
  }

  function createTask(values: TaskFormValues & { attachments?: ComposerAttachment[] }) {
    const title = values.title.trim();
    if (!title) {
      return;
    }

    const roleCode = values.roleCode;
    const preparedState = prepareRoleForTaskRun(roleCode);
    if (!preparedState) {
      return;
    }

    const roleName = resolveRoleName(preparedState.rolePackages, roleCode);
    const input = values.input?.trim() || `请处理任务：${title}`;
    const executionContext = buildTaskExecutionContextWithAttachments(
      buildExecutionContextForRole(preparedState.rolePackages, roleCode),
      values.attachments ?? []
    );
    const taskDetail = createMockTaskDetail({
      roleCode,
      roleName,
      title,
      input,
      state: 'queued',
      artifactCount: 0,
      costCents: 0,
      executionContext
    });
    const task = toDesktopTaskSummary(taskDetail);

    const nextState = upsertTaskDetailInRuntimeState(preparedState, taskDetail);
    setRuntimeState(nextState);
    setSelectedTaskId(task.taskId);
    taskForm.resetFields(['title', 'input']);

    const startedAt = new Date().toISOString();
    void runTaskDetail(nextState, startTaskRun(taskDetail, startedAt)).catch(() => {
      // runTaskDetail already writes the failed task state; avoid an unhandled rejection in the renderer.
    });
  }

  function navigateToSection(section: SectionKey) {
    setSelectedSection(section);
    setAccountMenuOpen(false);

    const nextHash = `#${section}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }

  async function completeTask(taskId: string) {
    const startedAt = new Date().toISOString();
    const sourceTaskDetails = getRuntimeTaskDetails(runtimeState);
    const targetTask = sourceTaskDetails.find((detail) => detail.taskId === taskId);

    if (!targetTask) {
      return;
    }

    const preparedState = prepareRoleForTaskRun(targetTask.roleCode);
    if (!preparedState) {
      return;
    }

    const preparedTask =
      getRuntimeTaskDetails(preparedState).find((detail) => detail.taskId === taskId) ?? targetTask;
    const runningTask = startTaskRun(preparedTask, startedAt);
    const nextState = upsertTaskDetailInRuntimeState(preparedState, runningTask);
    setRuntimeState(nextState);
    await runTaskDetail(nextState, runningTask);
  }

  function upsertTaskDetail(
    taskDetail: DesktopTaskDetail,
    usedToolIds: string[] = [],
    usedToolAt = taskDetail.updatedAt
  ) {
    setRuntimeState((current) =>
      upsertTaskDetailInRuntimeState(current, taskDetail, usedToolIds, usedToolAt)
    );
  }

  async function runTaskDetail(
    sourceState: DesktopRuntimeState,
    runningTask: DesktopTaskDetail,
    options: {
      completedEventType?: string;
      completedMessage?: string;
      failedEventType?: string;
      failedMessage?: string;
    } = {}
  ): Promise<DesktopTaskDetail> {
    const completedAt = new Date().toISOString();

    try {
      const result = await runDesktopTask({
        task: runningTask,
        workspaceId: sourceState.localRuntime.workspaceId,
        rolePackage: sourceState.rolePackages.find(
          (rolePackage) => rolePackage.roleCode === runningTask.roleCode
        ),
        modelProfiles: sourceState.modelProfiles,
        tools: sourceState.tools,
        knowledgeSources: sourceState.knowledgeSources,
        enabledModelProfileIds: sourceState.localRuntime.enabledModelProfileIds,
        enabledToolIds: sourceState.localRuntime.enabledToolIds,
        enabledKnowledgeBindingIds: sourceState.localRuntime.knowledgeBindingIds,
        modelInvoker: window.qiuDesktop?.invokeModelChat,
        desktopToolInvoker: window.qiuDesktop?.invokeDesktopTool,
        onProgress: (progressTask) => {
          upsertTaskDetail(progressTask, [], progressTask.updatedAt);
        },
        completedAt
      });
      const persistedTask = await persistTaskArtifacts(
        result.task,
        sourceState.localRuntime.workspaceId,
        result.task.updatedAt
      );
      const outcomeEventType =
        persistedTask.state === 'completed' ? options.completedEventType : options.failedEventType;
      const outcomeMessage =
        persistedTask.state === 'completed' ? options.completedMessage : options.failedMessage;
      const finalTask =
        outcomeEventType && outcomeMessage
          ? appendTaskExecutionLog(
              persistedTask,
              createTaskExecutionLog(
                persistedTask.taskId,
                persistedTask.state === 'completed' ? 'info' : 'error',
                outcomeEventType,
                outcomeMessage,
                persistedTask.updatedAt
              )
            )
          : persistedTask;

      upsertTaskDetail(finalTask, result.usedToolIds, completedAt);
      return finalTask;
    } catch (error) {
      const failedAt = new Date().toISOString();
      const failedTask = failTaskRunLocally(
        runningTask,
        failedAt,
        options.failedEventType ?? 'WORKOS_TASK_RUN_FAILED',
        options.failedMessage ??
          `任务运行异常：${error instanceof Error ? error.message : 'unknown error'}`
      );

      upsertTaskDetail(failedTask, [], failedAt);
      throw error;
    }
  }

}

function getRuntimeTaskDetails(state: DesktopRuntimeState): DesktopTaskDetail[] {
  const existingDetails = state.taskDetails ?? [];
  const existingTaskIds = new Set(existingDetails.map((detail) => detail.taskId));
  const backfilledDetails = state.runtimeSnapshot.tasks
    .filter((task) => !existingTaskIds.has(task.taskId))
    .map((task) =>
      createTaskDetailFromSummary(task, resolveRoleName(state.rolePackages, task.roleCode))
    );

  return [...existingDetails, ...backfilledDetails];
}

function upsertTaskDetailInRuntimeState(
  state: DesktopRuntimeState,
  taskDetail: DesktopTaskDetail,
  usedToolIds: string[] = [],
  usedToolAt = taskDetail.updatedAt
): DesktopRuntimeState {
  const previousDetails = getRuntimeTaskDetails(state);
  const hasTask = previousDetails.some((detail) => detail.taskId === taskDetail.taskId);
  const taskDetails = hasTask
    ? previousDetails.map((detail) => (detail.taskId === taskDetail.taskId ? taskDetail : detail))
    : [taskDetail, ...previousDetails];
  const tasks = taskDetails.map(toDesktopTaskSummary);
  const usedToolIdSet = new Set(usedToolIds);

  return {
    ...state,
    taskDetails,
    runtimeSnapshot: {
      ...state.runtimeSnapshot,
      tasks,
      rolePackages: rebuildRoleSummaries(
        state.rolePackages,
        tasks,
        state.runtimeSnapshot.rolePackages,
        state.localRuntime.activeRoleCode
      ),
      tools: rebuildToolSummaries(
        state.tools,
        state.localRuntime.enabledToolIds,
        state.runtimeSnapshot.tools
      ).map((tool) => (usedToolIdSet.has(tool.toolId) ? { ...tool, lastUsedAt: usedToolAt } : tool))
    }
  };
}

function startTaskRun(task: DesktopTaskDetail, startedAt: string): DesktopTaskDetail {
  return appendTaskExecutionLog(
    {
      ...task,
      state: 'running',
      updatedAt: startedAt,
      currentRun: {
        id: task.currentRun?.id ?? `${task.taskId}-run-1`,
        taskId: task.taskId,
        status: 'running',
        startedAt
      }
    },
    createTaskExecutionLog(
      task.taskId,
      'info',
      'WORKOS_TASK_RUN_STARTED',
      '桌面端开始真实执行任务。',
      startedAt
    )
  );
}

function failTaskRunLocally(
  task: DesktopTaskDetail,
  failedAt: string,
  eventType: string,
  message: string
): DesktopTaskDetail {
  return appendTaskExecutionLog(
    {
      ...task,
      state: 'failed',
      updatedAt: failedAt,
      currentRun: {
        id: task.currentRun?.id ?? `${task.taskId}-run-1`,
        taskId: task.taskId,
        status: 'failed',
        startedAt: task.currentRun?.startedAt ?? task.createdAt,
        finishedAt: failedAt
      }
    },
    createTaskExecutionLog(task.taskId, 'error', eventType, message, failedAt)
  );
}

function appendTaskExecutionLog(
  task: DesktopTaskDetail,
  log: DesktopTaskDetail['executionLogs'][number]
): DesktopTaskDetail {
  return {
    ...task,
    executionLogs: [...task.executionLogs, log]
  };
}

function createTaskExecutionLog(
  taskId: string,
  level: DesktopTaskDetail['executionLogs'][number]['level'],
  eventType: string,
  message: string,
  createdAt: string
): DesktopTaskDetail['executionLogs'][number] {
  return {
    id: `${taskId}-log-${eventType.toLowerCase()}-${Date.parse(createdAt) || Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    level,
    eventType,
    message,
    createdAt
  };
}

function buildVerificationExecutionContext(
  state: DesktopRuntimeState,
  rolePackage: RolePackageManifest
): NonNullable<DesktopTaskDetail['executionContext']> {
  const availableToolIds = new Set(state.tools.map((tool) => tool.id));
  const enabledModelProfileIds = new Set(state.localRuntime.enabledModelProfileIds);
  const roleModelProfileIds = rolePackage.modelProfileIds.filter((profileId) =>
    enabledModelProfileIds.has(profileId)
  );
  const configuredModelProfileIds = state.modelProfiles
    .filter((profile) => enabledModelProfileIds.has(profile.id) && hasConfiguredModelApi(profile))
    .map((profile) => profile.id);
  const knownEnabledModelProfileIds = state.modelProfiles
    .filter((profile) => enabledModelProfileIds.has(profile.id))
    .map((profile) => profile.id);
  const roleToolIds = rolePackage.toolIds.filter((toolId) => availableToolIds.has(toolId));
  const preferredToolIds = ['web-search', 'office-document', 'local-filesystem'].filter((toolId) =>
    availableToolIds.has(toolId)
  );
  const roleKnowledgeBindingIds = rolePackage.requiredKnowledgeSources.map((source) =>
    getKnowledgeBindingId(source)
  );

  return {
    modelProfileIds: mergeUniqueStrings(
      mergeUniqueStrings(roleModelProfileIds, configuredModelProfileIds),
      knownEnabledModelProfileIds
    ),
    toolIds: mergeUniqueStrings(roleToolIds, preferredToolIds),
    knowledgeBindingIds: mergeUniqueStrings(roleKnowledgeBindingIds, state.localRuntime.knowledgeBindingIds)
  };
}

function hasConfiguredModelApi(profile: ModelProfile): boolean {
  return Boolean(profile.apiBaseUrl?.trim() && profile.apiKey?.trim());
}

function roleTemplateCategory(template: DesktopRoleTemplate): string {
  const text = [template.name, template.industry, template.scenario, template.summary, template.businessGoal].join(' ');
  if (includesAny(text, ['教育', '课程', '培训', '学习'])) return '教育';
  if (includesAny(text, ['医疗', '健康', '医生', '医药', '康复'])) return '医疗';
  if (includesAny(text, ['销售', '线索', '客户', '外联', '回访'])) return '销售';
  if (includesAny(text, ['运营', '内容', '私域', '发布', '社群'])) return '运营';
  if (includesAny(text, ['人力', '招聘', '简历', '面试', '候选人'])) return '人力';
  if (includesAny(text, ['财务', '报销', '对账', '发票', '单据'])) return '财务';
  if (includesAny(text, ['法律', '合同', '法务', '条款'])) return '法务';
  if (includesAny(text, ['行政', '会议', '日程', '纪要'])) return '行政';
  if (includesAny(text, ['数据', '研究', '调研', '报告'])) return '研究';
  return '通用';
}

function buildRoleCategoryTabs(templates: DesktopRoleTemplate[]): string[] {
  const fixedCategories = ['全部', '教育', '医疗', '销售', '运营', '人力', '财务', '法务', '行政', '研究', '通用'];
  const availableCategories = new Set(templates.map(roleTemplateCategory));
  return fixedCategories.filter((category) => category === '全部' || availableCategories.has(category));
}

function toolCategory(tool: ToolManifest): string {
  const text = [tool.id, tool.name, tool.scope, tool.entryPoint, ...tool.capabilities].join(' ');
  if (includesAny(text, ['document', 'office', 'word', 'ppt', 'spreadsheet', '文档', '表格', '演示'])) return '文档';
  if (includesAny(text, ['web', 'search', 'fetch', 'url', '网页', '搜索'])) return '网页';
  if (includesAny(text, ['file', 'filesystem', 'folder', 'local', '文件', '目录'])) return '文件';
  if (includesAny(text, ['http', 'api', 'custom_api', 'mcp', '接口'])) return '接口';
  if (tool.requiresApproval) return '安全';
  if (tool.entryPoint === 'bridge') return '本地';
  return '通用';
}

function buildToolCategoryTabs(tools: ToolManifest[]): string[] {
  const fixedCategories = ['全部', '文档', '网页', '文件', '接口', '本地', '安全', '通用'];
  const availableCategories = new Set(tools.map(toolCategory));
  return fixedCategories.filter((category) => category === '全部' || availableCategories.has(category));
}

function toolCategoryIcon(tool: ToolManifest): ReactNode {
  const category = toolCategory(tool);
  if (category === '文档') return <FileTextOutlined />;
  if (category === '网页') return <GlobalOutlined />;
  if (category === '文件') return <FolderOpenOutlined />;
  if (category === '接口') return <ApiOutlined />;
  if (category === '安全') return <SafetyCertificateOutlined />;
  return <ToolOutlined />;
}

function modelProviderLogoText(providerName: string): string {
  const normalizedName = providerName.trim();
  if (!normalizedName) return 'AI';
  if (/deepseek/i.test(normalizedName)) return 'DS';
  if (/openai/i.test(normalizedName)) return 'OA';
  if (/qwen|通义/i.test(normalizedName)) return 'QW';
  if (/claude|anthropic/i.test(normalizedName)) return 'CL';
  return normalizedName.slice(0, 2).toUpperCase();
}

function sectionMeta(section: SectionKey) {
  const meta: Record<SectionKey, { title: string; description: string }> = {
    workbench: {
      title: '对话',
      description: '选员工，发任务，拿结果。'
    },
    roles: {
      title: '数字员工',
      description: '安装和配置可用员工。'
    },
    models: {
      title: '模型',
      description: '配置和测试桌面端模型。'
    },
    tools: {
      title: '工具',
      description: '管理文件、文档和网页能力。'
    },
    knowledge: {
      title: '知识库',
      description: '管理本地资料和知识来源。'
    },
    settings: {
      title: '设置',
      description: '管理 PC 客户端偏好。'
    }
  };

  return meta[section];
}

function connectionLabel(state: DesktopRuntimeState['serverConnection']['state']) {
  if (state === 'online') return '控制端在线';
  if (state === 'offline') return '控制端离线';
  return '未检查';
}

function taskStateLabel(state: DesktopTaskState) {
  const labels: Record<DesktopTaskState, string> = {
    queued: '排队中',
    running: '运行中',
    waiting_approval: '待审批',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  };

  return labels[state];
}

function taskStateColor(state: DesktopTaskState) {
  const colors: Record<DesktopTaskState, string> = {
    queued: 'blue',
    running: 'geekblue',
    waiting_approval: 'gold',
    completed: 'green',
    failed: 'red',
    cancelled: 'default'
  };

  return colors[state];
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN') : '—';
}

function formatShortTime(value?: string) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatCents(value?: number) {
  if (value === undefined || value === null) {
    return '—';
  }

  return currencyFormatter.format(value / 100);
}

function formatEstimatedCostCents(value?: number) {
  if (value === undefined || value === null) {
    return '未统计';
  }

  if (value <= 0) {
    return '暂未产生费用';
  }

  return `约 ¥${(value / 100).toFixed(2)}`;
}

function isUserDeliverableArtifact(artifact: DesktopTaskDetail['artifacts'][number]) {
  return artifact.type !== 'report';
}

function formatArtifactPreview(artifact: DesktopTaskDetail['artifacts'][number]) {
  if (artifact.localPath) {
    return `已生成本地文件：${artifact.title}`;
  }

  return artifact.content;
}

function countUserDeliverableArtifacts(task: DesktopTaskDetail) {
  return task.artifacts.filter(isUserDeliverableArtifact).length;
}

function createChatTaskTitle(input: string) {
  const normalized = input
    .split('\n')
    .find((line) => line.trim() && !line.trim().startsWith('附件：'))
    ?.replace(/\s+/g, ' ')
    .trim() ?? input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的数字员工任务';
  }

  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
}

function hasDraggedFiles(dataTransfer: DataTransfer) {
  return Array.from(dataTransfer.types).includes('Files');
}

function getFileLocalPath(file: File): string | undefined {
  const candidate = file as File & { path?: unknown };
  return typeof candidate.path === 'string' && candidate.path.trim() ? candidate.path.trim() : undefined;
}

function formatFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  if (size < 1024 * 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function buildTaskInputWithAttachments(input: string, attachments: ComposerAttachment[]) {
  const normalizedInput = input.trim() || '请处理已添加的文件。';
  if (attachments.length === 0) {
    return normalizedInput;
  }

  const attachmentLines = attachments.map((attachment, index) =>
    [
      `${index + 1}. ${attachment.name}`,
      `大小：${formatFileSize(attachment.size)}`,
      attachment.localPath ? `本地路径：${attachment.localPath}` : '本地路径：当前运行环境未暴露路径',
      attachment.type ? `类型：${attachment.type}` : undefined
    ]
      .filter(Boolean)
      .join('；')
  );

  return [
    normalizedInput,
    '',
    '附件：',
    ...attachmentLines,
    '',
    '请优先根据上述附件完成任务；如果需要读取附件内容，请调用本地文件工具读取对应本地路径。'
  ].join('\n');
}

function parseTaskInputAttachmentLine(line: string) {
  const withoutIndex = line.replace(/^\d+\.\s*/, '');
  const parts = withoutIndex.split('；');
  const name = parts[0]?.trim() || '附件';
  const size = parts.find((part) => part.startsWith('大小：'))?.replace('大小：', '').trim();
  const path = parts.find((part) => part.startsWith('本地路径：'))?.replace('本地路径：', '').trim();
  const type = parts.find((part) => part.startsWith('类型：'))?.replace('类型：', '').trim();
  const meta = [size, type, path].filter(Boolean).join(' · ');

  return {
    name,
    meta: meta || '已添加到任务'
  };
}

function readConversationFinalAnswer(task: DesktopTaskDetail): string {
  if (task.state !== 'completed') {
    return '';
  }

  const reportArtifact = [...task.artifacts].reverse().find((artifact) => artifact.type === 'report');
  const content = reportArtifact?.content ?? '';
  const marker = '\nModel output:\n';
  const markerIndex = content.indexOf(marker);
  const answer = markerIndex >= 0 ? content.slice(markerIndex + marker.length).trim() : content.trim();

  return answer.length > 0 ? answer : '';
}

function buildTaskExecutionContextWithAttachments(
  executionContext: NonNullable<DesktopTaskDetail['executionContext']> | undefined,
  attachments: ComposerAttachment[]
): NonNullable<DesktopTaskDetail['executionContext']> | undefined {
  if (!executionContext) {
    return undefined;
  }

  const attachmentPaths = attachments.flatMap((attachment) => (attachment.localPath ? [attachment.localPath] : []));
  if (attachmentPaths.length === 0) {
    return executionContext;
  }

  return {
    ...executionContext,
    attachmentPaths
  };
}

function roleAvatarText(name: string) {
  const normalized = name.trim();
  if (!normalized) {
    return 'AI';
  }

  const asciiWords = normalized.match(/[A-Za-z0-9]+/g);
  if (asciiWords && asciiWords.length > 0) {
    return asciiWords
      .slice(0, 2)
      .map((word) => word[0])
      .join('')
      .toUpperCase();
  }

  return normalized.slice(0, 2);
}

function renderWorkflowNodeLogDetail(detail: WorkflowRuntimeNodeLogDetail): ReactNode {
  return (
    <div className="workflow-node-detail">
      <div className="workflow-node-meta">
        <Tag>{detail.type}</Tag>
        <Tag color={detail.status === 'failed' ? 'red' : detail.status === 'running' ? 'blue' : 'green'}>
          {detail.status}
        </Tag>
        {detail.modelProfileId ? <Tag>模型 {detail.modelProfileId}</Tag> : null}
        {detail.toolId ? <Tag>工具 {detail.toolId}</Tag> : null}
        {detail.artifactType ? <Tag>产物 {detail.artifactType}</Tag> : null}
      </div>
      {detail.message ? (
        <Typography.Text type="secondary" className="workflow-node-message">
          {detail.message}
        </Typography.Text>
      ) : null}
      <div className="workflow-node-vars">
        {renderWorkflowVariableGroup('输入', detail.inputs)}
        {renderWorkflowVariableGroup('输出', detail.outputs)}
      </div>
      {detail.artifactPath ? (
        <Typography.Text type="secondary" ellipsis>
          文件：{detail.artifactPath}
        </Typography.Text>
      ) : null}
    </div>
  );
}

function renderWorkflowVariableGroup(title: string, variables: WorkflowRuntimeLogVariable[]): ReactNode {
  return (
    <div className="workflow-node-var-group">
      <Typography.Text strong>{title}</Typography.Text>
      {variables.length > 0 ? (
        <div className="workflow-node-var-list">
          {variables.map((variable) => (
            <div key={`${title}-${variable.name}`} className="workflow-node-var">
              <span className="workflow-node-var-name">{variable.name}</span>
              <span className="workflow-node-var-type">{variable.valueType}</span>
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                {variable.preview}
              </Typography.Paragraph>
            </div>
          ))}
        </div>
      ) : (
        <Typography.Text type="secondary">无</Typography.Text>
      )}
    </div>
  );
}

function readWorkflowNodeLogDetail(
  log: DesktopTaskDetail['executionLogs'][number]
): WorkflowRuntimeNodeLogDetail | undefined {
  const detail = log.details?.workflowNode;
  if (!isPlainObject(detail)) {
    return undefined;
  }

  const id = readString(detail.id);
  const type = readString(detail.type);
  const name = readString(detail.name);
  const status = readString(detail.status);
  if (!id || !type || !name || !status) {
    return undefined;
  }

  return {
    id,
    type,
    name,
    status,
    message: readString(detail.message),
    modelProfileId: readString(detail.modelProfileId),
    toolId: readString(detail.toolId),
    artifactType: readString(detail.artifactType),
    artifactPath: readString(detail.artifactPath),
    inputs: readWorkflowRuntimeLogVariables(detail.inputs),
    outputs: readWorkflowRuntimeLogVariables(detail.outputs)
  };
}

function readWorkflowRuntimeLogVariables(value: unknown): WorkflowRuntimeLogVariable[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const name = readString(item.name);
    const valueType = readString(item.valueType);
    const preview = readString(item.preview);
    if (!name || !valueType) {
      return [];
    }

    return [
      {
        name,
        valueType,
        preview: preview || '-'
      }
    ];
  });
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function executionEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    WORKOS_TASK_RUN_STARTED: '接收任务',
    WORKOS_TASK_RUN_FAILED: '任务运行失败',
    LOCAL_RUN_STARTED: '开始本地执行',
    TOOL_BINDING_SKIPPED: '跳过未启用工具',
    KNOWLEDGE_BINDING_MISSING: '知识库未启用',
    KNOWLEDGE_SOURCE_UNCONFIGURED: '知识库未配置',
    MODEL_API_CONFIG_MISSING: '模型配置不完整',
    MODEL_SELECTED: '选择模型',
    MODEL_REQUEST_STARTED: '调用模型',
    MODEL_REQUEST_FAILED: '模型调用失败',
    MODEL_RESPONSE_RECEIVED: '模型返回结果',
    ATTACHMENT_CONTEXT_EXTRACTED: '读取附件',
    ATTACHMENT_CONTEXT_SKIPPED: '跳过附件读取',
    ATTACHMENT_CONTEXT_FAILED: '附件读取失败',
    ATTACHMENT_CONTEXT_EMPTY: '附件内容为空',
    TOOL_CALL_DETECTED: '请求工具',
    TOOL_CALL_REJECTED: '工具被拒绝',
    TOOL_CALL_SKIPPED: '跳过工具',
    TOOL_CALL_FAILED: '工具失败',
    TOOL_INVOKED: '工具完成',
    TOOL_RESULT_RETURNED_TO_MODEL: '工具结果回传',
    TOOL_RESULT_FINALIZATION_FAILED: '结果整理失败',
    TOOL_CALL_LIMIT_REACHED: '工具轮次上限',
    ARTIFACT_CREATED: '生成产物',
    ARTIFACT_FILE_WRITTEN: '写入本地文件',
    ARTIFACT_FILE_WRITE_FAILED: '文件写入失败',
    TASK_COMPLETED: '任务完成'
  };

  return labels[eventType] ?? workflowExecutionEventLabel(eventType) ?? eventType.replace(/_/g, ' ').toLowerCase();
}

function executionEventMessage(log: DesktopTaskDetail['executionLogs'][number]) {
  const messages: Record<string, string> = {
    WORKOS_TASK_RUN_STARTED: '任务已进入桌面端执行队列。',
    LOCAL_RUN_STARTED: '数字员工开始在本机处理任务。',
    MODEL_SELECTED: formatModelLogMessage(log.message),
    MODEL_REQUEST_STARTED: formatModelLogMessage(log.message),
    MODEL_RESPONSE_RECEIVED: '模型已返回可用于整理结果的内容。',
    ATTACHMENT_CONTEXT_EXTRACTED: formatPathLogMessage(log.message, '已读取附件内容'),
    ATTACHMENT_CONTEXT_SKIPPED: '已收到附件，但当前员工没有可用的文档读取工具。',
    ATTACHMENT_CONTEXT_EMPTY: formatPathLogMessage(log.message, '附件未读取到有效文本'),
    TOOL_CALL_DETECTED: formatToolLogMessage(log.message, '模型请求调用工具'),
    TOOL_INVOKED: formatToolLogMessage(log.message, '工具已执行完成'),
    TOOL_RESULT_RETURNED_TO_MODEL: formatToolLogMessage(log.message, '工具结果已交回模型整理'),
    ARTIFACT_CREATED: '结果文件和执行报告已准备好。',
    ARTIFACT_FILE_WRITTEN: formatPathLogMessage(log.message, '已写入本地结果文件'),
    TASK_COMPLETED: '任务已完成，可以查看结果或打开文件。'
  };

  return messages[log.eventType] ?? workflowExecutionEventMessage(log) ?? log.message;
}

function workflowExecutionEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    WORKFLOW_GRAPH_LOADED: '加载工作流',
    WORKFLOW_GRAPH_NODE_PLANNED: '规划步骤',
    WORKFLOW_GRAPH_SKIPPED: '跳过工作流',
    WORKFLOW_GRAPH_CONDITION_DEFERRED: '延后判断',
    WORKFLOW_RUNTIME_STARTED: '开始工作流',
    WORKFLOW_RUNTIME_FILE_CONTEXT_EXTRACTED: '读取文件',
    WORKFLOW_RUNTIME_FILE_CONTEXT_SKIPPED: '跳过文件读取',
    WORKFLOW_RUNTIME_FILE_CONTEXT_FAILED: '文件读取失败',
    WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVED: '检索知识',
    WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVAL_SKIPPED: '跳过知识检索',
    WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVAL_FAILED: '知识检索失败',
    WORKFLOW_RUNTIME_NODE_STARTED: '执行节点',
    WORKFLOW_RUNTIME_MODEL_INVOKED: '节点调用模型',
    WORKFLOW_RUNTIME_TOOL_INVOKED: '节点调用工具',
    WORKFLOW_RUNTIME_ARTIFACT_INPUT_RESOLVED: '整理产物内容',
    WORKFLOW_RUNTIME_ARTIFACT_WRITTEN: '写入产物',
    WORKFLOW_RUNTIME_NODE_COMPLETED: '节点完成',
    WORKFLOW_RUNTIME_NODE_FAILED: '节点失败',
    WORKFLOW_RUNTIME_CONDITION_DEFERRED: '条件延后',
    WORKFLOW_RUNTIME_LOOP_LIMIT_REACHED: '循环上限',
    WORKFLOW_RUNTIME_NODE_LIMIT_REACHED: '节点上限',
    WORKFLOW_RUNTIME_COMPLETED: '工作流完成',
    WORKFLOW_ARTIFACT_FALLBACK_STARTED: '写入产物',
    WORKFLOW_ARTIFACT_FALLBACK_CREATED: '产物完成',
    WORKFLOW_ARTIFACT_FALLBACK_FAILED: '产物失败',
    WORKFLOW_ARTIFACT_FALLBACK_SKIPPED: '跳过产物'
  };

  return labels[eventType];
}

function workflowExecutionEventMessage(log: DesktopTaskDetail['executionLogs'][number]) {
  if (!log.eventType.startsWith('WORKFLOW_')) {
    return undefined;
  }

  if (log.eventType === 'WORKFLOW_GRAPH_SKIPPED') {
    return '工作流配置不可用，已回退到普通执行模式。';
  }

  if (log.eventType === 'WORKFLOW_RUNTIME_FILE_CONTEXT_SKIPPED') {
    return '已收到文件，但当前员工没有可用的读取工具。';
  }

  if (
    log.eventType === 'WORKFLOW_RUNTIME_ARTIFACT_WRITTEN' ||
    log.eventType === 'WORKFLOW_ARTIFACT_FALLBACK_CREATED'
  ) {
    return formatPathLogMessage(log.message, '已生成本地文件');
  }

  if (
    log.eventType === 'WORKFLOW_RUNTIME_FILE_CONTEXT_EXTRACTED' ||
    log.eventType === 'WORKFLOW_RUNTIME_FILE_CONTEXT_FAILED'
  ) {
    return formatPathLogMessage(log.message, '已处理任务文件');
  }

  return formatWorkflowLogMessage(log.message);
}

function formatWorkflowLogMessage(message: string) {
  return message.replace(/\.$/, '').trim();
}

function formatModelLogMessage(message: string) {
  const normalized = message.replace(/^Primary model:\s*/i, '').replace(/^Invoking model:\s*/i, '').trim();
  return normalized ? `使用模型：${normalized}` : message;
}

function formatToolLogMessage(message: string, prefix: string) {
  const normalized = message
    .replace(/^Model requested desktop tool action:\s*/i, '')
    .replace(/^Desktop tool executed:\s*/i, '')
    .replace(/^Desktop tool result was returned to model:\s*/i, '')
    .replace(/\.$/, '')
    .trim();
  return normalized ? `${prefix}：${normalized}` : prefix;
}

function formatPathLogMessage(message: string, prefix: string) {
  const details = readMessageDetails(message);
  return details ? `${prefix}：${details}` : message;
}

function readMessageDetails(message: string) {
  const detailIndex = message.indexOf(': ');
  if (detailIndex < 0) {
    return '';
  }

  return message.slice(detailIndex + 2).replace(/\.$/, '').trim();
}

function toInstalledRolePackage(template: DesktopRoleTemplate): RolePackageManifest {
  return {
    roleCode: template.roleCode,
    name: template.name,
    version: template.version,
    summary: template.summary,
    templateId: template.templateId,
    templateVersion: template.version,
    skills: template.skills.map((skill) => ({ ...skill })),
    workflowSteps: (template.workflowSteps ?? []).map((step) => ({
      ...step,
      toolIds: step.toolIds ? [...step.toolIds] : undefined
    })),
    workflowGraph: cloneJsonValue(template.workflowGraph),
    sampleInputs: [...(template.sampleInputs ?? [])],
    outputFormat: template.outputFormat,
    modelProfileIds: [...template.modelProfileIds],
    toolIds: [...template.toolIds],
    requiredKnowledgeSources: [...template.requiredKnowledgeSources],
    defaultTaskTypes: [...template.defaultTaskTypes],
    syncPolicy: template.syncPolicy
  };
}

function mergeUniqueStrings(left: string[], right: string[]) {
  return [...new Set([...left, ...right])];
}

function mergeModelProfileOptions(
  currentProfiles: ModelProfile[],
  requiredProfiles: ModelProfile[]
): ModelProfile[] {
  const byId = new Map(currentProfiles.map((profile) => [profile.id, profile]));
  for (const profile of requiredProfiles) {
    if (!byId.has(profile.id)) {
      byId.set(profile.id, profile);
    }
  }

  return [...byId.values()];
}

function getKnowledgeBindingId(source: KnowledgeBindingSource) {
  return knowledgeBindingCatalog.find((entry) => entry.source === source)?.bindingId ?? source;
}

function createKnowledgeSourceFromBindingId(bindingId: string): DesktopKnowledgeSourceSummary {
  const catalogEntry = knowledgeBindingCatalogByBindingId.get(bindingId);

  return {
    id: bindingId,
    source: catalogEntry?.source ?? 'server_summary',
    label: catalogEntry?.label ?? bindingId,
    enabled: true,
    createdAt: new Date(0).toISOString(),
    summary: catalogEntry?.description
  };
}

function pruneUnauthorizedRolePackages(
  state: DesktopRuntimeState,
  authorizedTemplates: DesktopRoleTemplate[]
): DesktopRuntimeState {
  const authorizedRoleCodes = new Set(authorizedTemplates.map((template) => template.roleCode));
  const rolePackages = state.rolePackages.filter((rolePackage) =>
    authorizedRoleCodes.has(rolePackage.roleCode)
  );

  if (
    rolePackages.length === state.rolePackages.length &&
    (!state.localRuntime.activeRoleCode || authorizedRoleCodes.has(state.localRuntime.activeRoleCode))
  ) {
    return state;
  }

  const activeRoleCode =
    state.localRuntime.activeRoleCode && authorizedRoleCodes.has(state.localRuntime.activeRoleCode)
      ? state.localRuntime.activeRoleCode
      : rolePackages[0]?.roleCode;

  return {
    ...state,
    rolePackages,
    localRuntime: {
      ...state.localRuntime,
      installedRoleCodes: rolePackages.map((rolePackage) => rolePackage.roleCode),
      activeRoleCode
    },
    runtimeSnapshot: {
      ...state.runtimeSnapshot,
      rolePackages: rebuildRoleSummaries(
        rolePackages,
        state.runtimeSnapshot.tasks,
        state.runtimeSnapshot.rolePackages,
        activeRoleCode
      )
    }
  };
}

function replaceRolePackageAndModelProfiles(
  state: DesktopRuntimeState,
  rolePackage: RolePackageManifest,
  modelProfiles: ModelProfile[]
): DesktopRuntimeState {
  const rolePackages = state.rolePackages.map((item) =>
    item.roleCode === rolePackage.roleCode ? rolePackage : item
  );
  const activeRoleCode =
    state.localRuntime.activeRoleCode && rolePackages.some((item) => item.roleCode === state.localRuntime.activeRoleCode)
      ? state.localRuntime.activeRoleCode
      : rolePackages[0]?.roleCode;

  return {
    ...state,
    rolePackages,
    modelProfiles,
    localRuntime: {
      ...state.localRuntime,
      installedRoleCodes: rolePackages.map((item) => item.roleCode),
      activeRoleCode
    },
    runtimeSnapshot: {
      ...state.runtimeSnapshot,
      rolePackages: rebuildRoleSummaries(
        rolePackages,
        state.runtimeSnapshot.tasks,
        state.runtimeSnapshot.rolePackages,
        activeRoleCode
      )
    }
  };
}

function rebuildRoleSummaries(
  rolePackages: RolePackageManifest[],
  tasks: DesktopTaskSummary[],
  previousSummaries: DesktopRuntimeState['runtimeSnapshot']['rolePackages'],
  activeRoleCode?: string,
  installedAt = new Date().toISOString()
): DesktopRuntimeState['runtimeSnapshot']['rolePackages'] {
  const previousByCode = new Map(previousSummaries.map((summary) => [summary.roleCode, summary]));
  const taskCounts = new Map<string, number>();
  const lastRuns = new Map<string, string>();

  for (const task of tasks) {
    taskCounts.set(task.roleCode, (taskCounts.get(task.roleCode) ?? 0) + 1);
    const currentLastRun = lastRuns.get(task.roleCode);
    if (!currentLastRun || task.updatedAt > currentLastRun) {
      lastRuns.set(task.roleCode, task.updatedAt);
    }
  }

  return rolePackages.map((rolePackage) => {
    const previous = previousByCode.get(rolePackage.roleCode);
    const preservedState: DesktopRolePackageState =
      previous && (previous.state === 'paused' || previous.state === 'error')
      ? previous.state
      : 'installed';

    return {
      roleCode: rolePackage.roleCode,
      version: rolePackage.version,
      state: rolePackage.roleCode === activeRoleCode ? 'running' : preservedState,
      installedAt: previous?.installedAt ?? installedAt,
      lastRunAt: lastRuns.get(rolePackage.roleCode) ?? previous?.lastRunAt,
      taskCount: taskCounts.get(rolePackage.roleCode) ?? previous?.taskCount ?? 0,
      templateId: rolePackage.templateId ?? previous?.templateId,
      templateVersion: rolePackage.templateVersion ?? previous?.templateVersion,
      skills:
        rolePackage.skills?.length
          ? rolePackage.skills.map((skill) => ({ ...skill }))
          : previous?.skills?.map((skill) => ({ ...skill }))
    };
  });
}

function rebuildToolSummaries(
  tools: DesktopRuntimeState['tools'],
  enabledToolIds: string[],
  previousSummaries: DesktopRuntimeState['runtimeSnapshot']['tools']
) {
  const previousByToolId = new Map(previousSummaries.map((summary) => [summary.toolId, summary]));

  return tools.map((tool) => ({
    toolId: tool.id,
    enabled: enabledToolIds.includes(tool.id),
    lastUsedAt: previousByToolId.get(tool.id)?.lastUsedAt
  }));
}

function estimateTaskCost(title: string) {
  return Math.max(80, title.length * 12);
}

function resolveRoleName(rolePackages: RolePackageManifest[], roleCode: string): string {
  return rolePackages.find((rolePackage) => rolePackage.roleCode === roleCode)?.name ?? roleCode;
}

function buildExecutionContextForRole(
  rolePackages: RolePackageManifest[],
  roleCode: string
): NonNullable<DesktopTaskDetail['executionContext']> | undefined {
  const rolePackage = rolePackages.find((item) => item.roleCode === roleCode);
  if (!rolePackage) {
    return undefined;
  }

  return {
    modelProfileIds: [...rolePackage.modelProfileIds],
    toolIds: [...rolePackage.toolIds],
    knowledgeBindingIds: rolePackage.requiredKnowledgeSources.map((source) => getKnowledgeBindingId(source))
  };
}

function resolveModelProfileLabel(modelProfiles: ModelProfile[], profileId: string): string {
  const profile = modelProfiles.find((item) => item.id === profileId);
  return profile ? `${profile.providerName} / ${profile.modelName}` : profileId;
}

function modelPurposeLabel(purpose: ModelProfile['purpose']): string {
  const labels: Record<ModelProfile['purpose'], string> = {
    general: '通用执行模型',
    reasoning: '深度推理模型',
    vision: '视觉理解模型',
    embeddings: '知识库向量模型',
    document: '文档处理模型'
  };

  return labels[purpose];
}

function syncPolicyLabel(policy: DesktopRuntimeState['localRuntime']['syncPolicy']): string {
  const labels: Record<DesktopRuntimeState['localRuntime']['syncPolicy'], string> = {
    summary_only: '仅摘要',
    summary_plus_metadata: '摘要+元数据'
  };

  return labels[policy] ?? policy;
}

function resolveToolLabel(tools: DesktopRuntimeState['tools'], toolId: string): string {
  const tool = tools.find((item) => item.id === toolId);
  return tool ? tool.name : toolId;
}

function resolveKnowledgeBindingLabel(bindingId: string): string {
  return knowledgeBindingCatalogByBindingId.get(bindingId)?.label ?? bindingId;
}

function logLevelColor(level: DesktopTaskDetail['executionLogs'][number]['level']) {
  if (level === 'error') {
    return 'red';
  }

  if (level === 'warning') {
    return 'gold';
  }

  return 'blue';
}

function completeTaskDetail(detail: DesktopTaskDetail, completedAt: string): DesktopTaskDetail {
  const artifactCount = Math.max(detail.artifactCount ?? detail.artifacts.length, 1);
  const costCents = detail.costCents && detail.costCents > 0 ? detail.costCents : estimateTaskCost(detail.title);
  const artifacts =
    detail.artifacts.length > 0
      ? detail.artifacts
      : [
          {
            id: `${detail.taskId}-artifact-1`,
            type: 'report' as const,
            title: `${detail.title} - 结果摘要`,
            content: `任务「${detail.title}」已完成。`,
            createdAt: completedAt
          }
        ];
  const executionLogs = [
    ...detail.executionLogs,
    {
      id: `${detail.taskId}-log-artifact`,
      level: 'info' as const,
      eventType: 'ARTIFACT_CREATED',
      message: `已生成 ${artifactCount} 个产物。`,
      createdAt: completedAt
    },
    {
      id: `${detail.taskId}-log-complete`,
      level: 'info' as const,
      eventType: 'TASK_COMPLETED',
      message: `任务「${detail.title}」已完成，成本约 ${formatCents(costCents)}。`,
      createdAt: completedAt
    }
  ];
  const costRecords =
    detail.costRecords.length > 0
      ? detail.costRecords
      : [
          {
            id: `${detail.taskId}-cost-1`,
            provider: 'local-mock',
            modelName: 'qiu-runtime-mock',
            inputTokens: Math.max(100, detail.title.length * 40),
            outputTokens: Math.max(80, detail.title.length * 18),
            costCents,
            currency: 'CNY',
            createdAt: completedAt
          }
        ];

  return {
    ...detail,
    state: 'completed',
    updatedAt: completedAt,
    artifactCount,
    costCents,
    artifacts,
    executionLogs,
    costRecords,
    currentRun: {
      ...(detail.currentRun ?? {
        id: `${detail.taskId}-run-1`,
        taskId: detail.taskId,
        status: 'running' as const,
        startedAt: detail.createdAt
      }),
      status: 'completed',
      finishedAt: completedAt
    }
  };
}
