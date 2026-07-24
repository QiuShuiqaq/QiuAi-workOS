import {
  ApiOutlined,
  BorderOutlined,
  CloudSyncOutlined,
  CloseOutlined,
  ControlOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  MinusOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  RollbackOutlined,
  ReloadOutlined,
  ToolOutlined
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
import Menu from 'antd/es/menu';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Statistic from 'antd/es/statistic';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import zhCN from 'antd/es/locale/zh_CN';
import { type ReactNode, useEffect, useMemo, useState } from 'react';

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
  RolePackageManifest
} from '../shared/desktop-contract';
import { defaultRoleTemplateCatalog, type RoleTemplateCatalogEntry } from '@qiuai/domain';
import { createDesktopRuntimePreviewState } from '../shared/desktop-state';
import {
  createMockTaskDetail,
  createTaskDetailFromSummary,
  toDesktopTaskSummary
} from '../shared/workbench-data';
import { runDesktopTask } from '../shared/desktop-task-runner';

type SectionKey = 'workbench' | 'roles' | 'files' | 'settings';
type SettingsSectionKey = 'models' | 'tools' | 'knowledge' | 'sync';

type DesktopRoleTemplate = RoleTemplateCatalogEntry;

interface TaskFormValues {
  roleCode: string;
  title: string;
  input?: string;
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
  { key: 'workbench', icon: <ControlOutlined />, label: '工作台' },
  { key: 'roles', icon: <RobotOutlined />, label: '数字员工' },
  { key: 'files', icon: <FolderOpenOutlined />, label: '文件与产物' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置中心' }
];

const settingsSectionItems: Array<{
  key: SettingsSectionKey;
  icon: ReactNode;
  label: string;
  description: string;
}> = [
  { key: 'models', icon: <ApiOutlined />, label: '模型', description: '供应商、模型角色和 API Key' },
  { key: 'tools', icon: <ToolOutlined />, label: '工具', description: '网页搜索、本地文件和工具权限' },
  { key: 'knowledge', icon: <FolderOpenOutlined />, label: '知识与文件', description: '本地资料、知识来源和绑定策略' },
  { key: 'sync', icon: <CloudSyncOutlined />, label: '连接与同步', description: '服务端连接、备份和同步状态' }
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
const initialAuthorizedRoleTemplateCatalog: DesktopAuthorizedRoleTemplateCatalog = {
  source: 'local_fallback',
  workspaceId: pendingWorkspaceId,
  loadedAt: new Date(0).toISOString(),
  templates: fallbackDesktopRoleTemplates.map(toRoleTemplateSummary)
};

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
    sampleInputs: [...(template.sampleInputs ?? [])],
    outputFormat: template.outputFormat ?? '',
    approvalPolicy: template.approvalPolicy
  };
}

function toDesktopRoleTemplate(summary: DesktopAuthorizedRoleTemplateSummary): DesktopRoleTemplate {
  const fallback = fallbackRoleTemplateByTemplateId.get(summary.id);
  const roleCode = fallback?.roleCode ?? createRoleCodeFromTemplateId(summary.id);

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
    sampleInputs: [...(summary.sampleInputs ?? [])],
    outputFormat: summary.outputFormat ?? '',
    modelProfileIds: fallback?.modelProfileIds ?? ['qiu-general-default'],
    toolIds: fallback?.toolIds ?? inferDesktopToolIds(summary),
    requiredKnowledgeSources:
      fallback?.requiredKnowledgeSources ?? inferRequiredKnowledgeSources(summary),
    defaultTaskTypes: fallback?.defaultTaskTypes ?? inferDefaultTaskTypes(summary),
    syncPolicy: fallback?.syncPolicy ?? 'summary_only',
    installNote: fallback?.installNote ?? '由平台授权模板生成，可按企业实际情况配置模型、工具和知识来源。'
  };
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

function readInitialSectionKey(): SectionKey {
  const hashValue = window.location.hash.replace(/^#/, '');
  if (hashValue === 'runtime') {
    return 'files';
  }

  if (settingsSectionItems.some((item) => item.key === hashValue)) {
    return 'settings';
  }

  return sectionItems.some((item) => item.key === hashValue) ? (hashValue as SectionKey) : 'workbench';
}

function readInitialSettingsSectionKey(): SettingsSectionKey {
  const hashValue = window.location.hash.replace(/^#/, '');
  return settingsSectionItems.some((item) => item.key === hashValue)
    ? (hashValue as SettingsSectionKey)
    : 'models';
}

export default function App() {
  const [runtimeState, setRuntimeState] = useState<DesktopRuntimeState>(
    createDesktopRuntimePreviewState()
  );
  const [selectedSection, setSelectedSection] = useState<SectionKey>(() => readInitialSectionKey());
  const [selectedSettingsSection, setSelectedSettingsSection] = useState<SettingsSectionKey>(
    () => readInitialSettingsSectionKey()
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
  const [verificationNotice, setVerificationNotice] = useState('');
  const [isRunningVerification, setIsRunningVerification] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [selectedModelNav, setSelectedModelNav] = useState<'catalog' | 'profiles' | 'advanced'>(
    'catalog'
  );
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [selectedToolNav, setSelectedToolNav] = useState<'catalog' | 'web-search' | 'permissions'>(
    'catalog'
  );
  const [selectedKnowledgeNav, setSelectedKnowledgeNav] = useState<'sources' | 'catalog' | 'policy'>(
    'sources'
  );

  useEffect(() => {
    void loadRuntimeState();
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      const nextSection = readInitialSectionKey();
      setSelectedSection(nextSection);
      if (nextSection === 'settings') {
        setSelectedSettingsSection(readInitialSettingsSectionKey());
      }
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
      setRoleTemplateNotice(
        catalog.message ??
          (catalog.source === 'server'
            ? `已加载服务端授权模板：${catalog.templates.length} 个`
            : `使用本地内置模板：${catalog.templates.length} 个`)
      );
    } catch (error) {
      setAuthorizedRoleTemplateCatalog(initialAuthorizedRoleTemplateCatalog);
      setRoleTemplateNotice(
        `模板目录加载失败，已使用本地内置模板：${error instanceof Error ? error.message : 'unknown error'}`
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

  function handleWindowControl(action: DesktopWindowControlAction) {
    void window.qiuDesktop?.controlWindow(action);
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

    if (!selectedTaskId) {
      return taskDetails[0];
    }

    return taskDetails.find((task) => task.taskId === selectedTaskId) ?? taskDetails[0];
  }, [selectedTaskId, taskDetails]);

  const installedRoleSummaries = useMemo(() => {
    return runtimeState.runtimeSnapshot.rolePackages;
  }, [runtimeState.runtimeSnapshot.rolePackages]);

  const desktopRoleTemplates = useMemo(() => {
    const templates = authorizedRoleTemplateCatalog.templates.map(toDesktopRoleTemplate);
    return templates.length > 0 ? templates : fallbackDesktopRoleTemplates;
  }, [authorizedRoleTemplateCatalog.templates]);

  const desktopRoleTemplateByRoleCode = useMemo(() => {
    const authorizedByRoleCode = new Map(
      desktopRoleTemplates.map((template) => [template.roleCode, template] as const)
    );

    for (const template of fallbackDesktopRoleTemplates) {
      if (!authorizedByRoleCode.has(template.roleCode)) {
        authorizedByRoleCode.set(template.roleCode, template);
      }
    }

    return authorizedByRoleCode;
  }, [desktopRoleTemplates]);

  const enabledModelCount = runtimeState.localRuntime.enabledModelProfileIds.length;
  const enabledToolCount = runtimeState.localRuntime.enabledToolIds.length;
  const knowledgeBindingCount = runtimeState.localRuntime.knowledgeBindingIds.length;
  const requiresOnboarding = runtimeState.localRuntime.workspaceId === pendingWorkspaceId;
  const currentSectionMeta = sectionMeta(selectedSection);

  const connectionTone = useMemo(() => {
    if (runtimeState.serverConnection.state === 'online') return 'success';
    if (runtimeState.serverConnection.state === 'offline') return 'error';
    return 'default';
  }, [runtimeState.serverConnection.state]);

  return (
    <ConfigProvider locale={zhCN} theme={qiuAntTheme}>
      <AppProvider>
        <Layout className="desktop-shell">
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
                  {selectedSection === 'files' ? renderFiles() : null}
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
        <button
          type="button"
          className="product-rail-brand"
          title="QiuAI WorkOS"
          onClick={() => navigateToSection('workbench')}
        >
          Q
        </button>

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
          <Tag color={connectionTone} title={runtimeState.app.serverBaseUrl}>
            {runtimeState.serverConnection.state === 'online' ? '在线' : '连接'}
          </Tag>
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
    const configuredModelCount = runtimeState.modelProfiles.filter(hasConfiguredModelApi).length;
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
    const conversationTask =
      selectedTask && selectedTask.roleCode === activeRoleCode
        ? selectedTask
        : latestTaskByRole.get(activeRoleCode) ?? selectedTask;
    const conversationRole =
      runtimeState.rolePackages.find((rolePackage) => rolePackage.roleCode === activeRoleCode) ??
      activeRolePackage;
    const canRunConversationTask =
      conversationTask &&
      conversationTask.state !== 'running' &&
      conversationTask.state !== 'completed' &&
      conversationTask.state !== 'cancelled';

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

          <div className="agent-panel-footer">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space size={6} wrap>
                <Tag color={configuredModelCount > 0 ? 'green' : 'orange'}>
                  模型 {configuredModelCount}/{enabledModelCount}
                </Tag>
                <Tag color={enabledToolCount > 0 ? 'green' : 'orange'}>
                  工具 {enabledToolCount}/{runtimeState.tools.length}
                </Tag>
              </Space>
              <Button
                block
                size="small"
                icon={<PlayCircleOutlined />}
                loading={isRunningVerification}
                disabled={runtimeState.rolePackages.length === 0 || isRunningVerification}
                onClick={() => void runVerificationTask()}
              >
                闭环测试
              </Button>
              {verificationNotice ? (
                <Typography.Text type={verificationNotice.startsWith('失败') ? 'danger' : 'secondary'}>
                  {verificationNotice}
                </Typography.Text>
              ) : null}
            </Space>
          </div>
        </aside>

        <section className="chat-workspace">
          <header className="chat-workspace-header">
            <Space size={12}>
              <span className="chat-agent-avatar">
                {roleAvatarText(conversationRole?.name ?? '数字员工')}
              </span>
              <Space direction="vertical" size={0}>
                <Typography.Text strong>
                  {conversationRole?.name ?? '选择一个数字员工'}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {conversationRole?.summary ?? '选择左侧员工后，直接用自然语言下达任务。'}
                </Typography.Text>
              </Space>
            </Space>

            <Space wrap>
              <Tag color="geekblue">运行中 {runningTaskCount}</Tag>
              <Tag color="gold">待处理 {waitingTaskCount}</Tag>
              <Tag color="green">已完成 {completedTaskCount}</Tag>
              <Button size="small" onClick={() => navigateToSection('settings')}>
                配置
              </Button>
            </Space>
          </header>

          <div className="chat-message-list">
            {conversationTask ? (
              <>
                <div className="chat-message-row user">
                  <div className="chat-bubble user-bubble">
                    <Typography.Text>{conversationTask.input}</Typography.Text>
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
                      <Tag>产物 {conversationTask.artifacts.length}</Tag>
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
                        {conversationTask.executionLogs.map((log) => (
                          <div key={log.id} className={`process-step ${log.level}`}>
                            <span className="process-dot" />
                            <Space direction="vertical" size={2}>
                              <Space size={8} wrap>
                                <Typography.Text strong>{executionEventLabel(log.eventType)}</Typography.Text>
                                <Typography.Text type="secondary">{formatDate(log.createdAt)}</Typography.Text>
                              </Space>
                              <Typography.Text type="secondary">{log.message}</Typography.Text>
                            </Space>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Typography.Text type="secondary">
                        任务已进入对话，点击“开始执行”后会在这里展示模型调用、工具调用和产物生成过程。
                      </Typography.Text>
                    )}
                  </div>
                </div>

                {conversationTask.artifacts.length > 0 ? (
                  <div className="chat-message-row assistant">
                    <span className="message-avatar"><FolderOpenOutlined /></span>
                    <div className="chat-bubble assistant-bubble artifact-bubble">
                      <Typography.Text strong>结果已生成</Typography.Text>
                      <div className="chat-artifact-grid">
                        {conversationTask.artifacts.map((artifact) => (
                          <div key={artifact.id} className="chat-artifact-card">
                            <Space align="start" size={10}>
                              <FolderOpenOutlined className="list-icon" />
                              <Space direction="vertical" size={4}>
                                <Space size={6} wrap>
                                  <Typography.Text strong>{artifact.title}</Typography.Text>
                                  <Tag>{artifact.type}</Tag>
                                </Space>
                                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                                  {artifact.content}
                                </Typography.Paragraph>
                                {artifact.localPath ? (
                                  <Typography.Text type="secondary" ellipsis>
                                    {artifact.localPath}
                                  </Typography.Text>
                                ) : null}
                                <Space size={8} wrap>
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
                                  <Button size="small" onClick={() => navigateToSection('files')}>
                                    查看产物
                                  </Button>
                                </Space>
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
                      <Typography.Text strong>本次成本</Typography.Text>
                      <Space size={8} wrap>
                        {conversationTask.costRecords.map((record) => (
                          <Tag key={record.id}>
                            {record.provider} / {record.modelName} / {formatCents(record.costCents)}
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
            className="chat-composer"
            onFinish={(values) => {
              const input = values.input?.trim() ?? '';
              if (!activeRoleCode || !input) {
                return;
              }

              createTask({
                roleCode: activeRoleCode,
                title: createChatTaskTitle(input),
                input
              });
            }}
          >
            <Form.Item
              name="input"
              rules={[{ required: true, message: '请输入要交给数字员工处理的任务' }]}
            >
              <Input.TextArea
                autoSize={{ minRows: 3, maxRows: 7 }}
                placeholder="输入任务，可以描述目标、文件位置、输出格式，也可以 @ 数字员工或引用本地文件"
              />
            </Form.Item>
            <Flex align="center" justify="space-between" gap={12} wrap="wrap">
              <Space size={8} wrap>
                <Button icon={<PlusOutlined />} onClick={() => navigateToSection('files')}>
                  添加文件
                </Button>
                <Button icon={<ToolOutlined />} onClick={() => navigateToSection('settings')}>
                  工具与模型
                </Button>
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

  function renderRoles() {
    const roleConfigTemplate = roleConfigRoleCode
      ? desktopRoleTemplateByRoleCode.get(roleConfigRoleCode)
      : undefined;
    const roleConfigRolePackage = runtimeState.rolePackages.find(
      (rolePackage) => rolePackage.roleCode === roleConfigRoleCode
    );

    return (
      <>
        <div className="metric-grid">
          <Card bordered={false}>
            <Statistic title="已安装" value={runtimeState.rolePackages.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="运行中" value={installedRoleSummaries.filter((item) => item.state === 'running').length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="模板库" value={desktopRoleTemplates.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="当前角色" value={activeRolePackage?.name ?? '未激活'} />
          </Card>
        </div>

        <div className="main-grid">
          <Card title="已安装角色" bordered={false}>
            <List
              dataSource={runtimeState.rolePackages}
              renderItem={(rolePackage) => {
                const summary = installedRoleSummaries.find((item) => item.roleCode === rolePackage.roleCode);
                const isActive = runtimeState.localRuntime.activeRoleCode === rolePackage.roleCode;
                const template = desktopRoleTemplateByRoleCode.get(rolePackage.roleCode);

                return (
                  <List.Item
                    actions={[
                      <Button
                        key="configure"
                        type="link"
                        onClick={() => openRoleConfig(rolePackage.roleCode, 'configure')}
                      >
                        配置
                      </Button>,
                      <Button
                        key="activate"
                        type={isActive ? 'default' : 'link'}
                        onClick={() => activateRole(rolePackage.roleCode)}
                        disabled={isActive}
                      >
                        {isActive ? '当前使用' : '激活'}
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<RobotOutlined className="list-icon" />}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{rolePackage.name}</Typography.Text>
                          <Tag color={isActive ? 'green' : 'blue'}>
                            {isActive ? '运行中' : '已安装'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Space size={8} wrap>
                            <Typography.Text type="secondary">
                              {rolePackage.roleCode} · {rolePackage.version}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              任务 {summary?.taskCount ?? 0}
                            </Typography.Text>
                          </Space>
                          {template ? (
                            <Space size={6} wrap>
                              {(summary?.skills ?? template.skills).slice(0, 4).map((skill) => (
                                <Tag key={skill.code}>{skill.name}</Tag>
                              ))}
                            </Space>
                          ) : null}
                          <Typography.Text type="secondary">
                            模型 {rolePackage.modelProfileIds.length} / 工具 {rolePackage.toolIds.length} / 知识 {rolePackage.requiredKnowledgeSources.length}
                          </Typography.Text>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>

          <Card title="可安装模板" bordered={false}>
            {roleTemplateNotice ? (
              <Typography.Paragraph type="secondary">
                {roleTemplateNotice}
              </Typography.Paragraph>
            ) : null}
            <List
              loading={isLoadingRoleTemplates}
              dataSource={desktopRoleTemplates}
              renderItem={(template) => {
                const isInstalled = runtimeState.rolePackages.some(
                  (rolePackage) => rolePackage.roleCode === template.roleCode
                );

                return (
                  <List.Item
                    actions={[
                      isInstalled ? (
                        <Button
                          key="active"
                          type="link"
                          onClick={() => activateRole(template.roleCode)}
                        >
                          {runtimeState.localRuntime.activeRoleCode === template.roleCode
                            ? '当前使用'
                            : '切换'}
                        </Button>
                      ) : (
                        <Button
                          key="install"
                          type="link"
                          icon={<RobotOutlined />}
                          onClick={() => openRoleConfig(template.roleCode, 'install')}
                        >
                          安装
                        </Button>
                      )
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{template.name}</Typography.Text>
                          <Tag color="blue">{template.industry}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Typography.Text type="secondary">{template.summary}</Typography.Text>
                          <Typography.Text type="secondary">{template.installNote}</Typography.Text>
                          <Typography.Text type="secondary">{template.businessGoal}</Typography.Text>
                          <Space size={6} wrap>
                            {template.skills.map((skill) => (
                              <Tag key={skill.code}>{skill.name}</Tag>
                            ))}
                          </Space>
                          <Space size={6} wrap>
                            {template.defaultTaskTypes.map((type) => (
                              <Tag key={type}>{type}</Tag>
                            ))}
                          </Space>
                          <Typography.Text type="secondary">
                            模型 {template.modelProfileIds.length} / 工具 {template.toolIds.length} / 知识 {template.requiredKnowledgeSources.length}
                          </Typography.Text>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>
        </div>

        <Modal
          open={roleConfigModalOpen}
          title={
            roleConfigTemplate
              ? `${roleConfigMode === 'install' ? '配置并安装' : '配置'} - ${roleConfigTemplate.name}`
              : roleConfigMode === 'install'
                ? '配置并安装角色'
                : '配置角色'
          }
          okText={roleConfigMode === 'install' ? '安装角色' : '保存配置'}
          onCancel={closeRoleConfig}
          onOk={() => roleConfigForm.submit()}
          width={820}
          destroyOnHidden
        >
          {roleConfigTemplate ? (
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="模板版本">{roleConfigTemplate.version}</Descriptions.Item>
                <Descriptions.Item label="行业">{roleConfigTemplate.industry}</Descriptions.Item>
                <Descriptions.Item label="场景">{roleConfigTemplate.scenario}</Descriptions.Item>
                <Descriptions.Item label="安装说明">{roleConfigTemplate.installNote}</Descriptions.Item>
                <Descriptions.Item label="业务目标">{roleConfigTemplate.businessGoal}</Descriptions.Item>
              </Descriptions>

              <Space size={6} wrap>
                {roleConfigTemplate.skills.map((skill) => (
                  <Tag key={skill.code}>{skill.name}</Tag>
                ))}
              </Space>

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
                  label="模型绑定"
                  rules={[{ required: true, message: '至少选择一个模型绑定' }]}
                >
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择角色可使用的模型"
                    options={runtimeState.modelProfiles.map((profile) => ({
                      label: `${profile.providerName} / ${profile.modelName}`,
                      value: profile.id
                    }))}
                  />
                </Form.Item>

                <Form.Item name="toolIds" label="工具绑定">
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择角色可调用的工具"
                    options={runtimeState.tools.map((tool) => ({
                      label: tool.name,
                      value: tool.id
                    }))}
                  />
                </Form.Item>

                <Form.Item name="knowledgeSources" label="知识绑定">
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择角色依赖的知识来源"
                    options={knowledgeBindingCatalog.map((entry) => ({
                      label: entry.label,
                      value: entry.source
                    }))}
                  />
                </Form.Item>
              </Form>
            </Space>
          ) : (
            <Empty description="未找到可配置的角色模板" />
          )}
        </Modal>
      </>
    );
  }

  function renderModels() {
    const configuredModelCount = runtimeState.modelProfiles.filter(hasConfiguredModelApi).length;
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

    const modelNavItems = [
      { key: 'catalog', icon: <ApiOutlined />, label: '模型供应商' },
      { key: 'profiles', icon: <RobotOutlined />, label: '模型角色' },
      { key: 'advanced', icon: <SettingOutlined />, label: '高级配置' }
    ];

    return (
      <>
        <div className="dify-section-shell">
          <aside className="dify-section-sidebar">
            <Button
              type="primary"
              block
              icon={<PlusOutlined />}
              onClick={() => {
                const preset = modelProviderPresets[0];
                if (preset) {
                  applyModelProviderPreset(preset, preset.models[0]);
                  setSelectedModelNav('catalog');
                }
              }}
            >
              快速套用
            </Button>

            <Menu
              mode="inline"
              selectedKeys={[selectedModelNav]}
              items={modelNavItems}
              onClick={({ key }) => {
                const nextKey = key as typeof selectedModelNav;
                setSelectedModelNav(nextKey);
              }}
            />

            <div className="sidebar-footer">
              <Space direction="vertical" size={4}>
                <Typography.Text strong>模型角色</Typography.Text>
                <Typography.Text type="secondary">
                  {configuredModelCount}/{runtimeState.modelProfiles.length} 已接通
                </Typography.Text>
              </Space>
            </div>
          </aside>

          <div className="dify-section-content">
            <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="page-toolbar">
              <div>
                <Typography.Title level={2} className="page-title">
                  {selectedModelNav === 'catalog'
                    ? '模型供应商'
                    : selectedModelNav === 'profiles'
                      ? '模型角色'
                      : '高级配置'}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {selectedModelNav === 'catalog'
                    ? '先选择常用供应商，再填写本机保存的 API Key。'
                    : selectedModelNav === 'profiles'
                      ? '每个模型角色单独启停，避免把所有任务压在同一个模型上。'
                      : '在这里调整 API、预算、温度和失败回退策略。'}
                </Typography.Text>
              </div>

              <Space wrap>
                {selectedModelNav === 'catalog' ? (
                  <>
                    <Input.Search
                      allowClear
                      value={modelSearchQuery}
                      onChange={(event) => setModelSearchQuery(event.target.value)}
                      placeholder="搜索模型供应商"
                      style={{ width: 240 }}
                    />
                    <Button onClick={() => setModelSearchQuery('')}>清除筛选</Button>
                  </>
                ) : (
                  <Button onClick={() => setSelectedModelNav('catalog')}>回到供应商</Button>
                )}
                {selectedModelNav !== 'advanced' ? (
                  <Button type="primary" onClick={() => setSelectedModelNav('advanced')}>
                    打开高级配置
                  </Button>
                ) : null}
              </Space>
            </Flex>

            <div className="metric-grid model-metric-grid">
              <Card bordered={false}>
                <Statistic title="模型角色" value={runtimeState.modelProfiles.length} />
              </Card>
              <Card bordered={false}>
                <Statistic title="已启用" value={enabledModelCount} />
              </Card>
              <Card bordered={false}>
                <Statistic title="已接通" value={configuredModelCount} />
              </Card>
              <Card bordered={false}>
                <Statistic title="当前模型" value={selectedModelProfile?.modelName ?? '未选择'} />
              </Card>
            </div>

            <div className="models-workbench-grid">
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {selectedModelNav === 'catalog' ? (
                  <Card id="model-provider-catalog" title="模型供应商" bordered={false}>
                    <div className="provider-grid">
                      {filteredPresets.length > 0 ? (
                        filteredPresets.map((preset) => (
                          <Card key={preset.id} size="small" bordered className="provider-card">
                            <Space direction="vertical" size={10} style={{ width: '100%' }}>
                              <Space size={8} wrap>
                                <Typography.Text strong>{preset.name}</Typography.Text>
                                {preset.apiBaseUrl ? <Tag color="blue">OpenAI Compatible</Tag> : null}
                              </Space>
                              <Typography.Text type="secondary">{preset.summary}</Typography.Text>
                              <Space size={6} wrap>
                                {preset.models.map((model) => (
                                  <Tag key={`${preset.id}-${model.modelName}`}>{model.label}</Tag>
                                ))}
                              </Space>
                              <Space wrap>
                                <Button
                                  size="small"
                                  type="primary"
                                  onClick={() => {
                                    applyModelProviderPreset(preset, preset.models[0]);
                                    setSelectedModelNav('advanced');
                                  }}
                                >
                                  套用预设
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => {
                                    applyModelProviderPreset(preset, preset.models[0]);
                                    setSelectedModelNav('advanced');
                                  }}
                                >
                                  配置
                                </Button>
                              </Space>
                            </Space>
                          </Card>
                        ))
                      ) : (
                        <div className="provider-empty">
                          <Empty description="没有匹配的模型供应商" />
                        </div>
                      )}
                    </div>
                  </Card>
                ) : null}

                {selectedModelNav === 'profiles' ? (
                  <Card id="model-role-profiles" title="模型角色" bordered={false}>
                    <div className="model-role-grid">
                      {runtimeState.modelProfiles.map((profile) => {
                        const enabled = runtimeState.localRuntime.enabledModelProfileIds.includes(profile.id);
                        const configured = hasConfiguredModelApi(profile);

                        return (
                          <Card
                            key={profile.id}
                            size="small"
                            bordered
                            className={selectedModelProfile?.id === profile.id ? 'model-role-card selected' : 'model-role-card'}
                            onClick={() => setSelectedModelId(profile.id)}
                          >
                            <Space direction="vertical" size={8} style={{ width: '100%' }}>
                              <Space size={8} wrap>
                                <Typography.Text strong>{modelPurposeLabel(profile.purpose)}</Typography.Text>
                                <Tag color={enabled ? 'green' : 'default'}>{enabled ? '已启用' : '已停用'}</Tag>
                                <Tag color={configured ? 'green' : 'orange'}>
                                  {configured ? '已接通' : '待配置'}
                                </Tag>
                              </Space>
                              <Typography.Text type="secondary">
                                {profile.providerName} / {profile.modelName}
                              </Typography.Text>
                              <Space wrap>
                                <Button
                                  size="small"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    toggleModelProfile(profile.id, !enabled);
                                  }}
                                >
                                  {enabled ? '停用' : '启用'}
                                </Button>
                                <Button
                                  size="small"
                                  type="link"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedModelId(profile.id);
                                    setSelectedModelNav('advanced');
                                  }}
                                >
                                  编辑
                                </Button>
                              </Space>
                            </Space>
                          </Card>
                        );
                      })}
                    </div>
                  </Card>
                ) : null}
              </Space>

              {selectedModelNav === 'advanced' ? (
                <Card id="model-advanced-config" title="高级配置" bordered={false} className="model-config-panel">
                  {selectedModelProfile ? (
                    <Space direction="vertical" size={16} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text strong>{modelPurposeLabel(selectedModelProfile.purpose)}</Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
                          供应商预设已套用后，只需要填 API Key 并保存。
                        </Typography.Paragraph>
                      </div>

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
                        <Typography.Text strong>高级配置</Typography.Text>
                        <Typography.Paragraph type="secondary" style={{ marginTop: 4 }}>
                          企业私有模型、代理网关或本地模型需要调整这些字段。
                        </Typography.Paragraph>
                        <Form.Item name="apiBaseUrl" label="API Base URL">
                          <Input placeholder="https://api.openai.com/v1" />
                        </Form.Item>
                        <div className="inline-form-grid">
                          <Form.Item name="temperature" label="温度">
                            <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                          </Form.Item>
                          <Form.Item name="maxTokens" label="最大输出">
                            <InputNumber min={0} step={256} style={{ width: '100%' }} />
                          </Form.Item>
                        </div>
                        <Form.Item name="monthlyBudgetCents" label="月度预算（分）">
                          <InputNumber min={0} step={100} style={{ width: '100%' }} />
                        </Form.Item>
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
                            <Button type="primary" htmlType="submit" icon={<SettingOutlined />}>
                              保存配置
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
                            <Typography.Text
                              type={modelTestNotice.startsWith('模型连接正常') ? 'success' : 'danger'}
                            >
                              {modelTestNotice}
                            </Typography.Text>
                          ) : null}
                        </Space>
                      </Form>
                    </Space>
                  ) : null}
                </Card>
              ) : null}
            </div>
          </div>

          <aside className="dify-section-inspector">
            <div className="inspector-panel">
              <Typography.Title level={5}>模型运行摘要</Typography.Title>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="已接通">
                  {configuredModelCount}/{runtimeState.modelProfiles.length}
                </Descriptions.Item>
                <Descriptions.Item label="已启用">{enabledModelCount}</Descriptions.Item>
                <Descriptions.Item label="当前模型">
                  {selectedModelProfile
                    ? `${selectedModelProfile.providerName} / ${selectedModelProfile.modelName}`
                    : '未选择'}
                </Descriptions.Item>
                <Descriptions.Item label="连接状态">
                  {selectedModelProfile && hasConfiguredModelApi(selectedModelProfile)
                    ? '可测试'
                    : '待填写 API Key'}
                </Descriptions.Item>
                <Descriptions.Item label="月度预算">
                  {formatCents(selectedModelProfile?.monthlyBudgetCents)}
                </Descriptions.Item>
              </Descriptions>
            </div>

            <div className="inspector-panel">
              <Typography.Title level={5}>建议配置顺序</Typography.Title>
              <Space direction="vertical" size={8} style={{ width: '100%' }}>
                <Typography.Text type="secondary">
                  先保证通用执行模型可用，再补推理、视觉和知识库向量模型。
                </Typography.Text>
                <Space size={6} wrap>
                  <Tag color={runtimeState.modelProfiles.some((profile) => profile.purpose === 'general' && hasConfiguredModelApi(profile)) ? 'green' : 'orange'}>
                    通用
                  </Tag>
                  <Tag color={runtimeState.modelProfiles.some((profile) => profile.purpose === 'reasoning' && hasConfiguredModelApi(profile)) ? 'green' : 'orange'}>
                    推理
                  </Tag>
                  <Tag color={runtimeState.modelProfiles.some((profile) => profile.purpose === 'embeddings' && hasConfiguredModelApi(profile)) ? 'green' : 'default'}>
                    向量
                  </Tag>
                  <Tag color={runtimeState.modelProfiles.some((profile) => profile.purpose === 'vision' && hasConfiguredModelApi(profile)) ? 'green' : 'default'}>
                    视觉
                  </Tag>
                </Space>
                <Button block onClick={() => setSelectedModelNav('advanced')}>
                  检查当前配置
                </Button>
              </Space>
            </div>
          </aside>
        </div>
      </>
    );
  }

  function renderTools() {
    const webSearchSettings = runtimeState.localRuntime.toolSettings?.webSearch;
    const webSearchConfigured = Boolean(webSearchSettings?.endpoint);
    const bridgeToolCount = runtimeState.tools.filter((tool) => tool.entryPoint === 'bridge').length;
    const approvalToolCount = runtimeState.tools.filter((tool) => tool.requiresApproval).length;
    const filteredTools = runtimeState.tools.filter((tool) => {
      const search = toolSearchQuery.trim().toLowerCase();
      if (!search) {
        return true;
      }

      return (
        tool.name.toLowerCase().includes(search) ||
        tool.scope.toLowerCase().includes(search) ||
        tool.entryPoint.toLowerCase().includes(search) ||
        tool.capabilities.some((capability) => capability.toLowerCase().includes(search))
      );
    });
    const toolNavItems = [
      { key: 'catalog', icon: <ToolOutlined />, label: '工具目录' },
      { key: 'web-search', icon: <CloudSyncOutlined />, label: '网页搜索' },
      { key: 'permissions', icon: <SafetyCertificateOutlined />, label: '权限边界' }
    ];

    return (
      <div className="dify-section-shell">
        <aside className="dify-section-sidebar">
          <Button
            type="primary"
            block
            icon={<PlusOutlined />}
            onClick={() => {
              setSelectedToolNav('web-search');
            }}
          >
            配置网页搜索
          </Button>

          <Menu
            mode="inline"
            selectedKeys={[selectedToolNav]}
            items={toolNavItems}
            onClick={({ key }) => {
              const nextKey = key as typeof selectedToolNav;
              setSelectedToolNav(nextKey);
            }}
          />

          <div className="sidebar-footer">
            <Space direction="vertical" size={4}>
              <Typography.Text strong>工具状态</Typography.Text>
              <Typography.Text type="secondary">
                {enabledToolCount}/{runtimeState.tools.length} 已启用
              </Typography.Text>
            </Space>
          </div>
        </aside>

        <div className="dify-section-content">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="page-toolbar">
            <div>
              <Typography.Title level={2} className="page-title">
                {selectedToolNav === 'catalog'
                  ? '工具目录'
                  : selectedToolNav === 'web-search'
                    ? '网页搜索'
                    : '权限边界'}
              </Typography.Title>
              <Typography.Text type="secondary">
                {selectedToolNav === 'catalog'
                  ? '管理桌面端可调用的网页、文件、Office 和本地桥接工具。'
                  : selectedToolNav === 'web-search'
                    ? '网页搜索是桌面任务常用的外部能力，配置会保存在本机。'
                    : '敏感或破坏性操作应被单独标记和限制。'}
              </Typography.Text>
            </div>

            <Space wrap>
              {selectedToolNav === 'catalog' ? (
                <>
                  <Input.Search
                    allowClear
                    value={toolSearchQuery}
                    onChange={(event) => setToolSearchQuery(event.target.value)}
                    placeholder="搜索工具或能力"
                    style={{ width: 240 }}
                  />
                  <Button onClick={() => setToolSearchQuery('')}>清除筛选</Button>
                </>
              ) : (
                <Button onClick={() => setSelectedToolNav('catalog')}>回到目录</Button>
              )}
              {selectedToolNav !== 'web-search' ? (
                <Button type="primary" onClick={() => setSelectedToolNav('web-search')}>
                  打开网页搜索
                </Button>
              ) : null}
            </Space>
          </Flex>

          <div className="metric-grid tool-metric-grid">
            <Card bordered={false}>
              <Statistic title="注册工具" value={runtimeState.tools.length} />
            </Card>
            <Card bordered={false}>
              <Statistic title="已启用" value={enabledToolCount} />
            </Card>
            <Card bordered={false}>
              <Statistic title="需审批" value={approvalToolCount} />
            </Card>
            <Card bordered={false}>
              <Statistic title="桌面桥接" value={bridgeToolCount} />
            </Card>
          </div>

          <div className="tools-workbench-grid">
            {selectedToolNav === 'catalog' ? (
              <Card id="tool-catalog" title="工具目录" bordered={false}>
                <div className="tool-card-grid">
                  {filteredTools.length > 0 ? (
                    filteredTools.map((tool) => {
                      const enabled = runtimeState.localRuntime.enabledToolIds.includes(tool.id);

                      return (
                        <Card key={tool.id} size="small" bordered className="tool-card">
                          <Space direction="vertical" size={10} style={{ width: '100%' }}>
                            <Flex align="flex-start" justify="space-between" gap={12}>
                              <Space size={8} wrap>
                                <ToolOutlined className="list-icon" />
                                <Typography.Text strong>{tool.name}</Typography.Text>
                              </Space>
                              <Switch
                                size="small"
                                checked={enabled}
                                onChange={(checked) => toggleTool(tool.id, checked)}
                              />
                            </Flex>

                            <Space size={6} wrap>
                              <Tag color={enabled ? 'green' : 'default'}>
                                {enabled ? '已启用' : '已停用'}
                              </Tag>
                              <Tag>{tool.scope}</Tag>
                              <Tag>{tool.entryPoint}</Tag>
                              {tool.requiresApproval ? <Tag color="gold">需审批</Tag> : null}
                              {tool.id === 'web-search' ? (
                                <Tag color={webSearchConfigured ? 'green' : 'orange'}>
                                  {webSearchConfigured ? '已配置' : '待配置'}
                                </Tag>
                              ) : null}
                            </Space>

                            {tool.id === 'web-search' ? (
                              <Typography.Text type="secondary">
                                {webSearchSettings?.endpoint
                                  ? webSearchSettings.endpoint
                                  : '尚未设置搜索服务地址'}
                              </Typography.Text>
                            ) : null}

                            <Space size={6} wrap>
                              {tool.capabilities.map((capability) => (
                                <Tag key={capability}>{capability}</Tag>
                              ))}
                            </Space>
                          </Space>
                        </Card>
                      );
                    })
                  ) : (
                    <div className="provider-empty">
                      <Empty description="没有匹配的工具" />
                    </div>
                  )}
                </div>
              </Card>
            ) : null}

            {selectedToolNav === 'web-search' ? (
              <Card
                id="tool-web-search-config"
                title="网页搜索配置"
                bordered={false}
                className="tool-config-panel"
              >
                <Form<ToolSettingsFormValues>
                  form={toolSettingsForm}
                  layout="vertical"
                  onFinish={saveToolSettings}
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
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">
                      web.search 会优先使用这里保存的地址；web.fetch_url 直接读取公开网页。
                    </Typography.Text>
                    <Space wrap>
                      <Button
                        type="primary"
                        htmlType="submit"
                        icon={<SettingOutlined />}
                        loading={isSavingToolSettings}
                      >
                        保存配置
                      </Button>
                    </Space>
                    {toolSettingsNotice ? (
                      <Typography.Text
                        type={toolSettingsNotice.startsWith('工具配置已保存') ? 'success' : 'danger'}
                      >
                        {toolSettingsNotice}
                      </Typography.Text>
                    ) : null}
                  </Space>
                </Form>
              </Card>
            ) : null}

            {selectedToolNav === 'permissions' ? (
              <Card
                id="tool-permission-boundary"
                title="权限边界"
                bordered={false}
                className="tool-config-panel"
              >
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="本地文件">
                    只通过桌面桥接访问用户授权范围内的路径。
                  </Descriptions.Item>
                  <Descriptions.Item label="网页访问">
                    默认阻断私网地址，防止任务误访问本机或内网服务。
                  </Descriptions.Item>
                  <Descriptions.Item label="需审批工具">
                    当前 {approvalToolCount} 个工具标记为敏感操作。
                  </Descriptions.Item>
                  <Descriptions.Item label="本机保存">
                    工具密钥保存在桌面端本地运行配置，不上传服务端。
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ) : null}
          </div>
        </div>

        <aside className="dify-section-inspector">
          <div className="inspector-panel">
            <Typography.Title level={5}>工具运行摘要</Typography.Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="注册工具">{runtimeState.tools.length}</Descriptions.Item>
              <Descriptions.Item label="已启用">{enabledToolCount}</Descriptions.Item>
              <Descriptions.Item label="桌面桥接">{bridgeToolCount}</Descriptions.Item>
              <Descriptions.Item label="需审批">{approvalToolCount}</Descriptions.Item>
              <Descriptions.Item label="网页搜索">
                {webSearchConfigured ? '已配置' : '待配置'}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div className="inspector-panel">
            <Typography.Title level={5}>已启用能力</Typography.Title>
            <Space size={6} wrap>
              {runtimeState.tools
                .filter((tool) => runtimeState.localRuntime.enabledToolIds.includes(tool.id))
                .flatMap((tool) => tool.capabilities)
                .slice(0, 12)
                .map((capability) => (
                  <Tag key={capability}>{capability}</Tag>
                ))}
            </Space>
            {enabledToolCount === 0 ? (
              <Typography.Text type="secondary">尚未启用工具。</Typography.Text>
            ) : null}
          </div>

          <div className="inspector-panel">
            <Typography.Title level={5}>落地检查</Typography.Title>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                试点前至少要保证本地文件、Office 文档和网页搜索三类能力可用。
              </Typography.Text>
              <Button block onClick={() => setSelectedToolNav('web-search')}>
                检查网页搜索
              </Button>
              <Button block onClick={() => setSelectedToolNav('permissions')}>
                查看权限边界
              </Button>
            </Space>
          </div>
        </aside>
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
    const localSourceCount = knowledgeSources.filter(
      (source) => source.source === 'local_file' || source.source === 'local_folder'
    ).length;
    const knowledgeNavItems = [
      { key: 'sources', icon: <FolderOpenOutlined />, label: '当前来源' },
      { key: 'catalog', icon: <PlusOutlined />, label: '添加来源' },
      { key: 'policy', icon: <SafetyCertificateOutlined />, label: '同步策略' }
    ];

    return (
      <div className="dify-section-shell">
        <aside className="dify-section-sidebar">
          <Button
            type="primary"
            block
            icon={<PlusOutlined />}
            onClick={() => setSelectedKnowledgeNav('catalog')}
          >
            添加知识来源
          </Button>

          <Menu
            mode="inline"
            selectedKeys={[selectedKnowledgeNav]}
            items={knowledgeNavItems}
            onClick={({ key }) => {
              const nextKey = key as typeof selectedKnowledgeNav;
              setSelectedKnowledgeNav(nextKey);
            }}
          />

          <div className="sidebar-footer">
            <Space direction="vertical" size={4}>
              <Typography.Text strong>知识状态</Typography.Text>
              <Typography.Text type="secondary">
                {knowledgeBindingCount}/{knowledgeBindingCatalog.length} 已绑定
              </Typography.Text>
            </Space>
          </div>
        </aside>

        <div className="dify-section-content">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="page-toolbar">
            <div>
              <Typography.Title level={2} className="page-title">
                {selectedKnowledgeNav === 'sources'
                  ? '当前来源'
                  : selectedKnowledgeNav === 'catalog'
                    ? '添加来源'
                    : '同步策略'}
              </Typography.Title>
              <Typography.Text type="secondary">
                {selectedKnowledgeNav === 'sources'
                  ? '管理桌面端可读取的本地文件、文件夹和服务端摘要。'
                  : selectedKnowledgeNav === 'catalog'
                    ? '为数字员工绑定可用知识入口，实际资产仍保留在用户电脑。'
                    : '明确哪些内容留在本机、哪些摘要可同步到服务端。'}
              </Typography.Text>
            </div>

            <Space wrap>
              {selectedKnowledgeNav !== 'catalog' ? (
                <Button type="primary" onClick={() => setSelectedKnowledgeNav('catalog')}>
                  添加来源
                </Button>
              ) : (
                <Button onClick={() => setSelectedKnowledgeNav('sources')}>查看当前来源</Button>
              )}
            </Space>
          </Flex>

          <div className="metric-grid knowledge-metric-grid">
            <Card bordered={false}>
              <Statistic title="绑定数量" value={knowledgeBindingCount} />
            </Card>
            <Card bordered={false}>
              <Statistic title="本地来源" value={localSourceCount} />
            </Card>
            <Card bordered={false}>
              <Statistic title="可用来源" value={knowledgeBindingCatalog.length} />
            </Card>
            <Card bordered={false}>
              <Statistic title="同步策略" value={syncPolicyLabel(runtimeState.localRuntime.syncPolicy)} />
            </Card>
          </div>

          <div className="knowledge-workbench-grid">
            {selectedKnowledgeNav === 'sources' ? (
              <Card title="当前绑定" bordered={false}>
                <List
                  dataSource={knowledgeSources}
                  locale={{ emptyText: '尚未绑定本地知识' }}
                  renderItem={(source) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<FolderOpenOutlined className="list-icon" />}
                        title={
                          <Space size={8} wrap>
                            <Typography.Text strong>{source.label}</Typography.Text>
                            <Tag>{source.source}</Tag>
                            {source.enabled ? <Tag color="green">已启用</Tag> : <Tag>已停用</Tag>}
                          </Space>
                        }
                        description={source.localPath ?? source.summary ?? source.id}
                      />
                    </List.Item>
                  )}
                />
              </Card>
            ) : null}

            {selectedKnowledgeNav === 'catalog' ? (
              <Card title="添加来源" bordered={false}>
                <div className="knowledge-source-grid">
                  {knowledgeBindingCatalog.map((option) => {
                    const isBound = runtimeState.localRuntime.knowledgeBindingIds.includes(option.bindingId);

                    return (
                      <Card key={option.bindingId} size="small" bordered className="knowledge-source-card">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <Space size={8} wrap>
                            <FolderOpenOutlined className="list-icon" />
                            <Typography.Text strong>{option.label}</Typography.Text>
                            <Tag color={isBound ? 'green' : 'default'}>
                              {isBound ? '已绑定' : '可绑定'}
                            </Tag>
                          </Space>
                          <Typography.Text type="secondary">{option.description}</Typography.Text>
                          <Button
                            type={isBound ? 'default' : 'primary'}
                            disabled={isBound}
                            onClick={() => void addKnowledgeBinding(option)}
                          >
                            {isBound ? '已绑定' : '绑定来源'}
                          </Button>
                        </Space>
                      </Card>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {selectedKnowledgeNav === 'policy' ? (
              <Card title="同步策略" bordered={false}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="本地资产">
                    原始文件、目录、产物和中间缓存默认保存在用户电脑。
                  </Descriptions.Item>
                  <Descriptions.Item label="服务端同步">
                    服务端只接收工作区摘要、任务状态、授权和必要元数据。
                  </Descriptions.Item>
                  <Descriptions.Item label="恢复迁移">
                    通过本地备份包导出、迁移和恢复，不要求用户单独安装数据库。
                  </Descriptions.Item>
                  <Descriptions.Item label="当前策略">
                    {syncPolicyLabel(runtimeState.localRuntime.syncPolicy)}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            ) : null}
          </div>
        </div>

        <aside className="dify-section-inspector">
          <div className="inspector-panel">
            <Typography.Title level={5}>知识库摘要</Typography.Title>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="绑定来源">{knowledgeBindingCount}</Descriptions.Item>
              <Descriptions.Item label="本地来源">{localSourceCount}</Descriptions.Item>
              <Descriptions.Item label="本地优先">是</Descriptions.Item>
              <Descriptions.Item label="同步策略">
                {syncPolicyLabel(runtimeState.localRuntime.syncPolicy)}
              </Descriptions.Item>
            </Descriptions>
          </div>

          <div className="inspector-panel">
            <Typography.Title level={5}>落地建议</Typography.Title>
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Typography.Text type="secondary">
                试点企业先绑定一个本地资料文件夹，再绑定服务端摘要即可跑通基础知识流。
              </Typography.Text>
              <Space size={6} wrap>
                {knowledgeBindingCatalog.map((entry) => (
                  <Tag
                    key={entry.bindingId}
                    color={runtimeState.localRuntime.knowledgeBindingIds.includes(entry.bindingId) ? 'green' : 'default'}
                  >
                    {entry.label}
                  </Tag>
                ))}
              </Space>
              <Button block onClick={() => setSelectedKnowledgeNav('policy')}>
                查看同步边界
              </Button>
            </Space>
          </div>
        </aside>
      </div>
    );
  }

  function renderSettings() {
    const configuredModelCount = runtimeState.modelProfiles.filter(hasConfiguredModelApi).length;
    const webSearchConfigured = Boolean(runtimeState.localRuntime.toolSettings?.webSearch?.endpoint);
    const selectedSettingsContent =
      selectedSettingsSection === 'models'
        ? renderModels()
        : selectedSettingsSection === 'tools'
          ? renderTools()
          : selectedSettingsSection === 'knowledge'
            ? renderKnowledge()
            : renderSync();
    const selectedSettingsItem =
      settingsSectionItems.find((item) => item.key === selectedSettingsSection) ?? settingsSectionItems[0];

    return (
      <div className="settings-page">
        <Card bordered={false} className="settings-overview">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap">
            <div>
              <Typography.Title level={3} style={{ marginBottom: 4 }}>
                统一配置中心
              </Typography.Title>
              <Typography.Text type="secondary">
                模型、工具、知识来源和同步策略都在这里集中维护，工作台只保留客户日常使用入口。
              </Typography.Text>
            </div>

            <Space wrap>
              <Tag color={configuredModelCount > 0 ? 'green' : 'orange'}>
                模型 {configuredModelCount}/{runtimeState.modelProfiles.length}
              </Tag>
              <Tag color={enabledToolCount > 0 ? 'green' : 'orange'}>
                工具 {enabledToolCount}/{runtimeState.tools.length}
              </Tag>
              <Tag color={webSearchConfigured ? 'green' : 'default'}>
                网页搜索 {webSearchConfigured ? '已配置' : '未配置'}
              </Tag>
            </Space>
          </Flex>

          <div className="settings-quick-grid">
            <Button
              onClick={() => {
                navigateToSettingsSection('models');
                setSelectedModelNav('advanced');
              }}
            >
              配置模型 API
            </Button>
            <Button
              onClick={() => {
                navigateToSettingsSection('tools');
                setSelectedToolNav('web-search');
              }}
            >
              配置网页搜索
            </Button>
            <Button
              onClick={() => {
                navigateToSettingsSection('knowledge');
                setSelectedKnowledgeNav('catalog');
              }}
            >
              添加知识来源
            </Button>
            <Button
              onClick={() => {
                navigateToSettingsSection('sync');
              }}
            >
              检查同步状态
            </Button>
          </div>
        </Card>

        <div className="settings-layout">
          <aside className="settings-sidebar">
            <Space direction="vertical" size={4}>
              <Typography.Text strong>设置中心</Typography.Text>
              <Typography.Text type="secondary">按能力模块维护桌面端运行配置。</Typography.Text>
            </Space>

            <nav className="settings-sidebar-nav">
              {settingsSectionItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={
                    selectedSettingsSection === item.key
                      ? 'settings-sidebar-item selected'
                      : 'settings-sidebar-item'
                  }
                  onClick={() => navigateToSettingsSection(item.key)}
                >
                  <span className="settings-sidebar-icon">{item.icon}</span>
                  <span className="settings-sidebar-main">
                    <Typography.Text strong>{item.label}</Typography.Text>
                    <Typography.Text type="secondary">{item.description}</Typography.Text>
                  </span>
                </button>
              ))}
            </nav>

            <div className="settings-sidebar-footer">
              <Typography.Text type="secondary">当前状态</Typography.Text>
              <Space size={6} wrap>
                <Tag color={configuredModelCount > 0 ? 'green' : 'orange'}>模型 {configuredModelCount}</Tag>
                <Tag color={enabledToolCount > 0 ? 'green' : 'orange'}>工具 {enabledToolCount}</Tag>
                <Tag color={webSearchConfigured ? 'green' : 'default'}>
                  搜索 {webSearchConfigured ? '已配' : '未配'}
                </Tag>
              </Space>
            </div>
          </aside>

          <section className="settings-section-panel">
            <div className="settings-section-header">
              <Typography.Title level={4}>{selectedSettingsItem.label}</Typography.Title>
              <Typography.Text type="secondary">{selectedSettingsItem.description}</Typography.Text>
            </div>
            <div className="settings-section-body">{selectedSettingsContent}</div>
          </section>
        </div>
      </div>
    );
  }

  function renderFiles() {
    const artifacts = taskDetails
      .flatMap((task) =>
        task.artifacts.map((artifact) => ({
          ...artifact,
          roleName: task.roleName,
          taskTitle: task.title
        }))
      )
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return (
      <div className="files-page">
        <div className="metric-grid">
          <Card bordered={false}>
            <Statistic title="本地产物" value={artifacts.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="任务记录" value={orderedTasks.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="备份包" value={workspaceBackups.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="同步策略" value={syncPolicyLabel(runtimeState.localRuntime.syncPolicy)} />
          </Card>
        </div>

        <div className="main-grid">
          <Card title="最近产物" bordered={false}>
            <List
              dataSource={artifacts}
              locale={{ emptyText: '暂无产物，先在工作台下达或运行一条任务。' }}
              renderItem={(artifact) => (
                <List.Item
                  actions={
                    artifact.localPath
                      ? [
                          <Button
                            key="open"
                            type="link"
                            icon={<FolderOpenOutlined />}
                            onClick={() => void openLocalPath(artifact.localPath)}
                          >
                            打开
                          </Button>
                        ]
                      : undefined
                  }
                >
                  <List.Item.Meta
                    avatar={<FolderOpenOutlined className="list-icon" />}
                    title={
                      <Space size={8} wrap>
                        <Typography.Text strong>{artifact.title}</Typography.Text>
                        <Tag>{artifact.type}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4}>
                        <Typography.Text type="secondary">
                          {artifact.roleName} · {artifact.taskTitle} · {formatDate(artifact.createdAt)}
                        </Typography.Text>
                        <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
                          {artifact.content}
                        </Typography.Paragraph>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="备份与恢复" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space wrap>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  loading={isBackupBusy}
                  onClick={createWorkspaceBackup}
                >
                  创建备份
                </Button>
                <Button icon={<ReloadOutlined />} loading={isRefreshing} onClick={loadWorkspaceBackups}>
                  刷新列表
                </Button>
              </Space>
              <Typography.Text type="secondary">
                {backupNotice || '备份保存在用户电脑，可用于导出、迁移和恢复。'}
              </Typography.Text>

              <Divider style={{ margin: '8px 0' }} />

              <List
                dataSource={workspaceBackups}
                locale={{ emptyText: '尚未生成备份' }}
                renderItem={(backup) => (
                  <List.Item
                    actions={[
                      <Button
                        key="restore"
                        type="link"
                        icon={<RollbackOutlined />}
                        loading={isBackupBusy}
                        onClick={() => restoreWorkspaceBackup(backup.bundlePath)}
                      >
                        恢复
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<DownloadOutlined className="list-icon" />}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>备份 {formatDate(backup.createdAt)}</Typography.Text>
                          <Tag color="blue">{backup.appVersion}</Tag>
                        </Space>
                      }
                      description={backup.bundlePath}
                    />
                  </List.Item>
                )}
              />
            </Space>
          </Card>
        </div>

        <Card title="本地存储边界" bordered={false}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="本地目录">
              <Space size={8} wrap>
                <Typography.Text>{runtimeState.app.userDataPath}</Typography.Text>
                <Button
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={() => void openLocalPath(runtimeState.app.userDataPath)}
                >
                  打开
                </Button>
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="原始资产">
              文档、素材、产物和中间缓存默认保留在用户电脑。
            </Descriptions.Item>
            <Descriptions.Item label="服务端同步">
              服务端只同步任务状态、工作区摘要、授权和必要元数据。
            </Descriptions.Item>
            <Descriptions.Item label="控制端">
              {runtimeState.serverConnection.serverBaseUrl}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    );
  }

  function renderSync() {
    return (
      <div className="main-grid">
        <Card title="同步控制" bordered={false}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Button
              type="primary"
              icon={<CloudSyncOutlined />}
              loading={isSyncing}
              onClick={syncRuntimeState}
            >
              推送本地摘要
            </Button>
            <Typography.Text type="secondary">
              {syncNotice || '仅同步角色、工具、任务摘要，不上传本地文件和私有素材。'}
            </Typography.Text>
          </Space>
        </Card>
        <Card title="连接状态" bordered={false}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="状态">
              {connectionLabel(runtimeState.serverConnection.state)}
            </Descriptions.Item>
            <Descriptions.Item label="延迟">
              {runtimeState.serverConnection.latencyMs ? `${runtimeState.serverConnection.latencyMs} ms` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="服务">
              {runtimeState.serverConnection.service ?? '—'}
            </Descriptions.Item>
            <Descriptions.Item label="检查时间">
              {formatDate(runtimeState.serverConnection.checkedAt)}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="摘要信息" bordered={false}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="角色数">{runtimeState.rolePackages.length}</Descriptions.Item>
            <Descriptions.Item label="模型数">{runtimeState.modelProfiles.length}</Descriptions.Item>
            <Descriptions.Item label="工具数">{runtimeState.tools.length}</Descriptions.Item>
            <Descriptions.Item label="任务数">{runtimeState.runtimeSnapshot.tasks.length}</Descriptions.Item>
            <Descriptions.Item label="知识绑定">{knowledgeBindingCount}</Descriptions.Item>
          </Descriptions>
        </Card>
      </div>
    );
  }

  function installRole(template: DesktopRoleTemplate, values?: RoleConfigFormValues) {
    setRuntimeState((current) => {
      const existingRole = current.rolePackages.find(
        (rolePackage) => rolePackage.roleCode === template.roleCode
      );
      const now = new Date().toISOString();
      const installedRolePackage = {
        ...(existingRole ?? toInstalledRolePackage(template)),
        modelProfileIds: values?.modelProfileIds ?? template.modelProfileIds,
        toolIds: values?.toolIds ?? template.toolIds,
        requiredKnowledgeSources: values?.knowledgeSources ?? template.requiredKnowledgeSources
      };
      const rolePackages = existingRole
        ? current.rolePackages.map((rolePackage) =>
            rolePackage.roleCode === template.roleCode ? installedRolePackage : rolePackage
          )
        : [installedRolePackage, ...current.rolePackages];
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
    } catch (error) {
      setToolSettingsNotice(`工具配置保存失败：${error instanceof Error ? error.message : 'unknown error'}`);
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

    installRole(template, values);
    closeRoleConfig();
  }

  function createTask(values: TaskFormValues) {
    const title = values.title.trim();
    if (!title) {
      return;
    }

    const roleCode = values.roleCode;
    const roleName = resolveRoleName(runtimeState.rolePackages, roleCode);
    const executionContext = buildExecutionContextForRole(runtimeState.rolePackages, roleCode);
    const input = values.input?.trim() || `请处理任务：${title}`;
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

    setRuntimeState((current) => {
      const taskDetails = [taskDetail, ...(current.taskDetails ?? [])];
      const tasks = [task, ...current.runtimeSnapshot.tasks];

      return {
        ...current,
        taskDetails,
        runtimeSnapshot: {
          ...current.runtimeSnapshot,
          tasks,
          rolePackages: rebuildRoleSummaries(
            current.rolePackages,
            tasks,
            current.runtimeSnapshot.rolePackages,
            current.localRuntime.activeRoleCode
          )
        }
      };
    });

    setSelectedTaskId(task.taskId);
    taskForm.resetFields(['title', 'input']);
  }

  function navigateToSection(section: SectionKey) {
    setSelectedSection(section);

    const nextHash = `#${section}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }

  function navigateToSettingsSection(section: SettingsSectionKey) {
    setSelectedSection('settings');
    setSelectedSettingsSection(section);

    const nextHash = `#${section}`;
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, '', nextHash);
    }
  }

  async function runVerificationTask() {
    const sourceState = runtimeState;
    const rolePackage = activeRolePackage;

    if (!rolePackage) {
      setVerificationNotice('失败：请先安装并激活一个数字员工。');
      return;
    }

    const startedAt = new Date().toISOString();
    const baseTask = createMockTaskDetail({
      roleCode: rolePackage.roleCode,
      roleName: rolePackage.name,
      title: `真实闭环测试 ${formatDate(startedAt)}`,
      taskType: 'desktop_runtime_verification',
      input: buildVerificationTaskInput(sourceState, rolePackage),
      priority: 'high',
      state: 'queued',
      createdAt: startedAt,
      updatedAt: startedAt,
      artifactCount: 0,
      costCents: 0,
      executionContext: buildVerificationExecutionContext(sourceState, rolePackage)
    });
    const verificationTask = appendTaskExecutionLog(
      baseTask,
      createTaskExecutionLog(
        baseTask.taskId,
        'info',
        'WORKOS_VERIFICATION_STARTED',
        '真实闭环测试已创建：将验证模型调用、工具调用、本地产物、日志和成本记录。',
        startedAt
      )
    );
    const runningTask = startTaskRun(verificationTask, startedAt);

    setIsRunningVerification(true);
    setVerificationNotice('闭环测试已开始，请在任务明细里查看状态和日志。');
    setSelectedTaskId(runningTask.taskId);
    upsertTaskDetail(runningTask);

    try {
      const completedTask = await runTaskDetail(sourceState, runningTask, {
        completedEventType: 'WORKOS_VERIFICATION_COMPLETED',
        completedMessage: '真实闭环测试已完成，请检查产物、本地文件路径、工具日志和成本记录。',
        failedEventType: 'WORKOS_VERIFICATION_FAILED',
        failedMessage: '真实闭环测试未通过，请检查模型 API、工具启用状态、网页搜索配置和本地桥接。'
      });

      setVerificationNotice(
        completedTask.state === 'completed'
          ? `闭环测试已完成：生成 ${completedTask.artifacts.length} 个产物。`
          : `闭环测试未通过：当前状态为 ${taskStateLabel(completedTask.state)}，请查看执行日志。`
      );
    } catch (error) {
      setVerificationNotice(`失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsRunningVerification(false);
    }
  }

  async function completeTask(taskId: string) {
    const sourceState = runtimeState;
    const startedAt = new Date().toISOString();
    const sourceTaskDetails = getRuntimeTaskDetails(sourceState);
    const targetTask = sourceTaskDetails.find((detail) => detail.taskId === taskId);

    if (!targetTask) {
      return;
    }

    const runningTask = startTaskRun(targetTask, startedAt);
    upsertTaskDetail(runningTask);
    await runTaskDetail(sourceState, runningTask);
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

function buildVerificationTaskInput(
  state: DesktopRuntimeState,
  rolePackage: RolePackageManifest
): string {
  const enabledToolNames = state.tools
    .filter((tool) => state.localRuntime.enabledToolIds.includes(tool.id))
    .map((tool) => tool.name)
    .join('、') || '无';
  const configuredModelCount = state.modelProfiles.filter(
    (profile) =>
      state.localRuntime.enabledModelProfileIds.includes(profile.id) && hasConfiguredModelApi(profile)
  ).length;

  return [
    '请执行一次 QiuAI WorkOS 桌面端真实闭环测试。',
    `当前数字员工：${rolePackage.name}`,
    `已配置可用模型数：${configuredModelCount}`,
    `已启用工具：${enabledToolNames}`,
    '',
    '验收目标：确认模型调用、桌面工具调用、本地产物生成、执行日志、成本记录可以形成闭环。',
    '执行要求：',
    '1. 先判断当前任务适合调用哪些桌面工具。',
    '2. 如果 office-document 或 local-filesystem 可用，必须尝试生成一份本地 Markdown 验收报告。',
    '3. 如果 web-search 已配置可用，可以搜索“企业数字员工 桌面端 试点 检查清单”，并把摘要写入报告；如果未配置，不要强行搜索，记录为缺口。',
    '4. 最终用中文输出验收结论、发现的问题、下一步处理建议。'
  ].join('\n');
}

function hasConfiguredModelApi(profile: ModelProfile): boolean {
  return Boolean(profile.apiBaseUrl?.trim() && profile.apiKey?.trim());
}

function sectionMeta(section: SectionKey) {
  const meta: Record<SectionKey, { title: string; description: string }> = {
    workbench: {
      title: '工作台',
      description: '选择数字员工，输入任务，并查看执行过程和输出结果。'
    },
    roles: {
      title: '数字员工',
      description: '管理企业可使用的岗位模板、技能组合和默认任务类型。'
    },
    files: {
      title: '文件与产物',
      description: '查看本地任务产物、备份包和资产保存边界。'
    },
    settings: {
      title: '设置中心',
      description: '集中配置模型、工具、知识来源、连接和同步策略。'
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

function createChatTaskTitle(input: string) {
  const normalized = input.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '新的数字员工任务';
  }

  return normalized.length > 28 ? `${normalized.slice(0, 28)}...` : normalized;
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

function executionEventLabel(eventType: string) {
  const labels: Record<string, string> = {
    WORKOS_VERIFICATION_STARTED: '闭环测试开始',
    WORKOS_VERIFICATION_COMPLETED: '闭环测试完成',
    WORKOS_VERIFICATION_FAILED: '闭环测试失败',
    WORKOS_TASK_RUN_FAILED: '任务运行失败',
    LOCAL_RUN_STARTED: '开始本地执行',
    MODEL_INVOCATION_STARTED: '调用模型',
    MODEL_INVOCATION_COMPLETED: '模型返回结果',
    TOOL_CALL_REQUESTED: '请求工具调用',
    TOOL_CALL_COMPLETED: '工具调用完成',
    ARTIFACT_CREATED: '生成产物',
    TASK_COMPLETED: '任务完成'
  };

  return labels[eventType] ?? eventType.replace(/_/g, ' ').toLowerCase();
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
