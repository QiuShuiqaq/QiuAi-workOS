import {
  ApiOutlined,
  BorderOutlined,
  CloudDownloadOutlined,
  CloudSyncOutlined,
  CloseOutlined,
  ControlOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DownOutlined,
  ExclamationCircleOutlined,
  FileAddOutlined,
  FileExcelOutlined,
  FileImageOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  FileWordOutlined,
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
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Popover from 'antd/es/popover';
import Radio from 'antd/es/radio';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Tag from 'antd/es/tag';
import Tooltip from 'antd/es/tooltip';
import Typography from 'antd/es/typography';
import zhCN from 'antd/es/locale/zh_CN';
import { type ChangeEvent, type DragEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import type {
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopAuthorizedRoleTemplateSummary,
  DesktopBackupSummary,
  DesktopRuntimeState,
  DesktopUpdateCheckResult,
  DesktopWindowControlAction
} from '../shared/desktop-api';
import type {
  DesktopRolePackageState,
  DesktopTaskState,
  DesktopTaskDetail,
  DesktopTaskSummary,
  DesktopKnowledgeSourceSummary,
  KnowledgeBindingSource,
  ModelCapability,
  ModelCredential,
  ModelCredentialBindingMode,
  ModelProviderCatalog,
  ModelProfile,
  RoleModelCredentialBinding,
  RoleTemplateDependencyManifest,
  RolePackageManifest,
  ToolManifest
} from '../shared/desktop-contract';
import {
  modelCapabilityOptions,
  modelCapabilitySummary,
  normalizeModelCapabilities,
  purposeForModelCapabilities,
  readModelProfileCapabilities
} from '../shared/desktop-model-capabilities';
import type { RoleTemplateCatalogEntry } from '@qiuai/domain';
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
  readWorkflowRequiredModelProfileIds,
  type RoleModelRuntimeIssue
} from '../shared/desktop-role-requirements';
import {
  selectModelProfileForPreset,
  type ModelProviderPreset,
  type ModelProviderPresetModel
} from '../shared/desktop-model-presets';
import {
  createCredentialId,
  findDefaultModelCredential,
  listProviderModelCredentials,
  resolveModelProfileCredential,
  upsertDefaultModelCredential
} from '../shared/desktop-model-credentials';
import {
  parseWorkflowGraph,
  type WorkflowGraphArtifactType
} from '../shared/desktop-workflow-graph';

type SectionKey = 'workbench' | 'roles' | 'logs' | 'models' | 'tools' | 'knowledge' | 'settings';
type AccountModalKey = 'enterprise' | 'help' | 'release' | 'download' | 'logout';
type DesktopThemePreference = 'light' | 'system';
type DesktopDensityPreference = 'comfortable' | 'compact';

interface DesktopClientPreferences {
  theme: DesktopThemePreference;
  density: DesktopDensityPreference;
  startupSection: SectionKey;
}

type DesktopRoleTemplate = RoleTemplateCatalogEntry & {
  dependencyManifest?: RoleTemplateDependencyManifest;
};

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
  purpose?: ModelProfile['purpose'];
  capabilities?: ModelCapability[];
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
  modelCredentialBindings?: Record<string, RoleModelCredentialFormValue>;
}

interface RoleModelCredentialFormValue {
  mode?: ModelCredentialBindingMode;
  credentialId?: string;
  apiBaseUrl?: string;
  apiKey?: string;
}

interface ToolSettingsFormValues {
  webSearchEndpoint?: string;
  webSearchApiKey?: string;
  allowPrivateNetwork?: boolean;
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
  { key: 'logs', icon: <FileTextOutlined />, label: '日志' },
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
    summary: '国内常用低成本模型，适合企业试点、通用对话、报告生成和推理任务。',
    apiBaseUrl: 'https://api.deepseek.com',
    models: [
      {
        label: 'V4 Flash / 快速通用',
        modelName: 'deepseek-v4-flash',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'DeepSeek Chat / 通用',
        modelName: 'deepseek-chat',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'DeepSeek Reasoner / 推理',
        modelName: 'deepseek-reasoner',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      },
      {
        label: 'V4 Pro / 深度推理',
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
    summary: '适合质量优先、复杂任务和多模态能力；接口按 Chat Completions 兼容方式调用。',
    apiBaseUrl: 'https://api.openai.com/v1',
    models: [
      {
        label: 'GPT-5.6 Terra / 平衡',
        modelName: 'gpt-5.6-terra',
        purpose: 'general',
        temperature: 0.3,
        maxTokens: 4096
      },
      {
        label: 'GPT-5.6 Luna / 低成本',
        modelName: 'gpt-5.6-luna',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'GPT-5.6 Sol / 高质量',
        modelName: 'gpt-5.6-sol',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      },
      {
        label: 'GPT-4o / 多模态',
        modelName: 'gpt-4o',
        purpose: 'vision',
        temperature: 0.3,
        maxTokens: 4096
      },
      {
        label: 'GPT-4o mini / 轻量',
        modelName: 'gpt-4o-mini',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'dashscope',
    name: '通义千问',
    summary: '阿里云 DashScope 兼容模式，适合国内企业网络、知识库问答和中文办公场景。',
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {
        label: 'Qwen Plus / 通用',
        modelName: 'qwen-plus',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Qwen Max / 高质量',
        modelName: 'qwen-max',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      },
      {
        label: 'Qwen Turbo / 批量',
        modelName: 'qwen-turbo',
        purpose: 'general',
        temperature: 0.5,
        maxTokens: 4096
      },
      {
        label: 'Qwen Long / 长文档',
        modelName: 'qwen-long',
        purpose: 'document',
        temperature: 0.3,
        maxTokens: 8192
      },
      {
        label: 'Qwen VL Max / 图片理解',
        modelName: 'qwen-vl-max',
        purpose: 'vision',
        temperature: 0.2,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'moonshot',
    name: 'Kimi / Moonshot',
    summary: '适合长文本阅读、材料整理、合同/报告分析和内容改写。',
    apiBaseUrl: 'https://api.moonshot.cn/v1',
    models: [
      {
        label: 'Kimi K2 / 通用',
        modelName: 'kimi-k2-0711-preview',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Kimi Latest / 默认',
        modelName: 'kimi-latest',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Moonshot 32K / 长文档',
        modelName: 'moonshot-v1-32k',
        purpose: 'document',
        temperature: 0.3,
        maxTokens: 8192
      },
      {
        label: 'Moonshot 128K / 超长文档',
        modelName: 'moonshot-v1-128k',
        purpose: 'document',
        temperature: 0.3,
        maxTokens: 8192
      }
    ]
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    summary: '聚合开源模型服务，适合快速切换 Qwen、DeepSeek、GLM 等不同模型。',
    apiBaseUrl: 'https://api.siliconflow.cn/v1',
    models: [
      {
        label: 'Qwen3 32B / 通用',
        modelName: 'Qwen/Qwen3-32B',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'DeepSeek V3 / 通用',
        modelName: 'deepseek-ai/DeepSeek-V3',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'DeepSeek R1 / 推理',
        modelName: 'deepseek-ai/DeepSeek-R1',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      },
      {
        label: 'Qwen2.5 VL / 图片理解',
        modelName: 'Qwen/Qwen2.5-VL-72B-Instruct',
        purpose: 'vision',
        temperature: 0.2,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'zhipu',
    name: '智谱 GLM',
    summary: '国内常用企业模型，适合中文办公、推理和多模态任务。',
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      {
        label: 'GLM-4.5 / 通用推理',
        modelName: 'glm-4.5',
        purpose: 'reasoning',
        temperature: 0.3,
        maxTokens: 8192
      },
      {
        label: 'GLM-4.5 Flash / 低成本',
        modelName: 'glm-4.5-flash',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'GLM-4V / 图片理解',
        modelName: 'glm-4v',
        purpose: 'vision',
        temperature: 0.2,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    summary: '适合客服、营销文案、长文本生成和中文场景的兼容接口。',
    apiBaseUrl: 'https://api.minimax.chat/v1',
    models: [
      {
        label: 'MiniMax M1 / 推理',
        modelName: 'MiniMax-M1',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      },
      {
        label: 'MiniMax Text / 通用',
        modelName: 'MiniMax-Text-01',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'MiniMax VL / 图片理解',
        modelName: 'MiniMax-VL-01',
        purpose: 'vision',
        temperature: 0.2,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'volcengine-ark',
    name: '火山方舟',
    summary: '字节火山方舟兼容接口，模型名通常填写控制台里的 Endpoint ID。',
    apiBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
    models: [
      {
        label: 'Doubao Seed / 通用',
        modelName: 'doubao-seed-1-6',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Doubao Thinking / 推理',
        modelName: 'doubao-seed-1-6-thinking',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      },
      {
        label: 'Ark Endpoint / 自填',
        modelName: 'your-ark-endpoint-id',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    summary: '海外聚合网关，适合统一接入不同模型并做对比测试。',
    apiBaseUrl: 'https://openrouter.ai/api/v1',
    models: [
      {
        label: 'GPT-4o mini / 通用',
        modelName: 'openai/gpt-4o-mini',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Claude Sonnet / 高质量',
        modelName: 'anthropic/claude-3.5-sonnet',
        purpose: 'reasoning',
        temperature: 0.3,
        maxTokens: 8192
      },
      {
        label: 'Gemini Flash / 快速',
        modelName: 'google/gemini-2.5-flash',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'DeepSeek Chat / 低成本',
        modelName: 'deepseek/deepseek-chat',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      }
    ]
  },
  {
    id: 'gemini-openai',
    name: 'Gemini 兼容接口',
    summary: 'Google Gemini 的 OpenAI-compatible 入口，适合图片理解和长上下文任务。',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    models: [
      {
        label: 'Gemini 2.5 Flash / 快速',
        modelName: 'gemini-2.5-flash',
        purpose: 'general',
        temperature: 0.4,
        maxTokens: 4096
      },
      {
        label: 'Gemini 2.5 Pro / 高质量',
        modelName: 'gemini-2.5-pro',
        purpose: 'reasoning',
        temperature: 0.3,
        maxTokens: 8192
      },
      {
        label: 'Gemini Flash Vision / 图片',
        modelName: 'gemini-2.5-flash',
        purpose: 'vision',
        temperature: 0.2,
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
      },
      {
        label: '本地 DeepSeek R1',
        modelName: 'deepseek-r1',
        purpose: 'reasoning',
        temperature: 0.2,
        maxTokens: 8192
      }
    ]
  },
  {
    id: 'custom',
    name: '自定义兼容接口',
    summary: '用于企业私有模型、代理网关、Dify/MCP 网关或其他 OpenAI-compatible 服务。',
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
  templates: []
};

function cloneJsonValue<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : (JSON.parse(JSON.stringify(value)) as T);
}

function toDesktopRoleTemplate(summary: DesktopAuthorizedRoleTemplateSummary): DesktopRoleTemplate {
  const roleCode = createRoleCodeFromTemplateId(summary.id);
  const workflowGraph = cloneJsonValue(summary.workflowGraph) as DesktopRoleTemplate['workflowGraph'];
  const dependencyManifest = cloneRoleTemplateDependencyManifest(summary.dependencyManifest);
  const manifestModelProfileIds = readDependencyManifestModelProfileIds(dependencyManifest);
  const manifestToolIds = readDependencyManifestToolIds(dependencyManifest);

  return {
    templateId: summary.id,
    roleCode,
    name: summary.name,
    version: summary.version,
    summary: summary.description,
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
    dependencyManifest,
    sampleInputs: [...(summary.sampleInputs ?? [])],
    outputFormat: summary.outputFormat ?? '',
    modelProfileIds:
      manifestModelProfileIds.length > 0
        ? manifestModelProfileIds
        : inferDesktopModelProfileIds(workflowGraph),
    toolIds:
      manifestToolIds.length > 0
        ? manifestToolIds
        : inferDesktopToolIds(summary),
    requiredKnowledgeSources: inferRequiredKnowledgeSources(summary),
    defaultTaskTypes: inferDefaultTaskTypes(summary),
    syncPolicy: 'summary_only',
    installNote: '由平台授权模板生成，可按企业实际情况配置模型、工具和知识来源。'
  };
}

function cloneRoleTemplateDependencyManifest(
  manifest: RoleTemplateDependencyManifest | undefined
): RoleTemplateDependencyManifest | undefined {
  if (!isRoleTemplateDependencyManifest(manifest)) {
    return undefined;
  }

  return cloneJsonValue(manifest);
}

function isRoleTemplateDependencyManifest(value: unknown): value is RoleTemplateDependencyManifest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Partial<RoleTemplateDependencyManifest>;
  return (
    record.version === '1.0.0' &&
    typeof record.generatedAt === 'string' &&
    Array.isArray(record.variables) &&
    Array.isArray(record.modelAssets) &&
    Array.isArray(record.toolActions) &&
    Array.isArray(record.artifactTemplates) &&
    Array.isArray(record.nodeTemplates) &&
    Array.isArray(record.warnings)
  );
}

function readDependencyManifestModelProfileIds(
  manifest: RoleTemplateDependencyManifest | undefined
): string[] {
  if (!manifest) {
    return [];
  }

  return mergeUniqueStrings(
    manifest.modelAssets
      .map((asset) => asset.modelProfileId || asset.modelId || asset.key)
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    []
  );
}

function readDependencyManifestToolIds(
  manifest: RoleTemplateDependencyManifest | undefined
): string[] {
  if (!manifest) {
    return [];
  }

  return mergeUniqueStrings(
    manifest.toolActions
      .map((action) => action.packageId)
      .filter((value) => value.trim().length > 0),
    []
  );
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
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [onboardingNotice, setOnboardingNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [updateNotice, setUpdateNotice] = useState('');
  const [updateCheckResult, setUpdateCheckResult] = useState<DesktopUpdateCheckResult | null>(null);
  const [modelTestNotice, setModelTestNotice] = useState('');
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [isPullingProviderModels, setIsPullingProviderModels] = useState(false);
  const [localActionNotice, setLocalActionNotice] = useState('');
  const [savingArtifactId, setSavingArtifactId] = useState('');
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
  const [accountModal, setAccountModal] = useState<AccountModalKey | null>(null);
  const [isUnbindingDevice, setIsUnbindingDevice] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isComposerDragOver, setIsComposerDragOver] = useState(false);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);
  const [pendingUninstallRoleCode, setPendingUninstallRoleCode] = useState('');

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
    taskForm.setFieldsValue({ roleCode: activeRoleCode ?? '' });
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
          pruneUnauthorizedRolePackages(current, authorizedTemplates, catalog.deletedTemplateIds ?? [])
        );
      }
      setRoleTemplateNotice(
        catalog.message ??
          (catalog.source === 'server'
            ? `已同步 ${catalog.templates.length} 个数字员工`
            : '暂未同步到数字员工，请检查网络或服务端配置。')
      );
    } catch (error) {
      setAuthorizedRoleTemplateCatalog(initialAuthorizedRoleTemplateCatalog);
      setRoleTemplateNotice(
        `数字员工同步失败：${error instanceof Error ? error.message : 'unknown error'}`
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

  async function saveArtifactAs(artifact: DesktopTaskDetail['artifacts'][number]) {
    if (!artifact.localPath || !window.qiuDesktop) {
      return;
    }

    setLocalActionNotice('');
    setSavingArtifactId(artifact.id);
    try {
      const result = await window.qiuDesktop.saveArtifactAs({
        sourcePath: artifact.localPath,
        suggestedFileName: getArtifactFileName(artifact)
      });
      if (!result.canceled) {
        message.success('结果文件已保存');
      }
    } catch (error) {
      setLocalActionNotice(`保存结果文件失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setSavingArtifactId('');
    }
  }

  async function checkForUpdates() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsCheckingForUpdates(true);
    setUpdateNotice('');
    try {
      const result = await window.qiuDesktop.checkForUpdates();
      setUpdateCheckResult(result);
      if (result.updateAvailable && result.latestRelease) {
        setUpdateNotice(`发现新版本 ${result.latestRelease.version}`);
      } else {
        setUpdateNotice('当前已经是最新版本');
      }
    } catch (error) {
      setUpdateNotice(`检查更新失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsCheckingForUpdates(false);
    }
  }

  async function openUpdateDownload() {
    const downloadUrl = updateCheckResult?.latestRelease?.downloadUrl;
    if (!downloadUrl || !window.qiuDesktop) {
      return;
    }

    setUpdateNotice('');
    try {
      await window.qiuDesktop.openExternalUrl(downloadUrl);
    } catch (error) {
      setUpdateNotice(`打开下载地址失败：${error instanceof Error ? error.message : 'unknown error'}`);
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

  function openAccountModal(modal: AccountModalKey) {
    setAccountModal(modal);
    setAccountMenuOpen(false);
  }

  async function handleUnbindDesktopDevice() {
    if (!window.qiuDesktop) {
      return;
    }

    setIsUnbindingDevice(true);
    setOnboardingNotice('');
    try {
      const nextState = await window.qiuDesktop.unbindDesktopDevice();
      setRuntimeState(nextState);
      setAuthorizedRoleTemplateCatalog(initialAuthorizedRoleTemplateCatalog);
      setAccountModal(null);
      setOnboardingOpen(false);
    } catch (error) {
      setOnboardingNotice(`解绑失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsUnbindingDevice(false);
    }
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
    const currentRolePackage = runtimeState.rolePackages.find(
      (rolePackage) => rolePackage.roleCode === runtimeState.localRuntime.activeRoleCode
    );
    if (currentRolePackage) {
      return currentRolePackage;
    }

    const availableRolePackages = runtimeState.rolePackages.filter(
      (rolePackage) => !isRuntimeRolePackageDeleted(runtimeState, rolePackage.roleCode)
    );
    return availableRolePackages[0];
  }, [runtimeState]);

  const selectedModelProfile = useMemo(() => {
    return runtimeState.modelProfiles.find((profile) => profile.id === selectedModelId);
  }, [runtimeState.modelProfiles, selectedModelId]);
  const selectedModelDefaultCredential = useMemo(() => {
    return selectedModelProfile
      ? findDefaultModelCredential(runtimeState.modelCredentials, selectedModelProfile.providerId)
      : undefined;
  }, [runtimeState.modelCredentials, selectedModelProfile]);

  useEffect(() => {
    if (!selectedModelProfile) {
      return;
    }

    modelForm.setFieldsValue({
      providerName: selectedModelProfile.providerName,
      modelName: selectedModelProfile.modelName,
      purpose: selectedModelProfile.purpose,
      capabilities: readModelProfileCapabilities(selectedModelProfile),
      apiBaseUrl: selectedModelDefaultCredential?.apiBaseUrl ?? selectedModelProfile.apiBaseUrl,
      apiKey: selectedModelDefaultCredential?.apiKey ?? selectedModelProfile.apiKey ?? '',
      temperature: selectedModelProfile.temperature,
      maxTokens: selectedModelProfile.maxTokens,
      monthlyBudgetCents: selectedModelProfile.monthlyBudgetCents,
      fallbackProfileId: selectedModelProfile.fallbackProfileId
    });
    setModelTestNotice('');
  }, [modelForm, selectedModelDefaultCredential, selectedModelProfile]);

  useEffect(() => {
    const webSearchSettings = runtimeState.localRuntime.toolSettings?.webSearch;
    toolSettingsForm.setFieldsValue({
      webSearchEndpoint: webSearchSettings?.endpoint,
      webSearchApiKey: webSearchSettings?.apiKey,
      allowPrivateNetwork: webSearchSettings?.allowPrivateNetwork ?? false
    });
  }, [runtimeState.localRuntime.toolSettings, toolSettingsForm]);

  function isRuntimeModelProfileConfigured(profile: ModelProfile, roleCode?: string): boolean {
    return resolveModelProfileCredential({
      profile,
      roleCode,
      credentials: runtimeState.modelCredentials,
      roleBindings: runtimeState.roleModelCredentialBindings
    }).configured;
  }

  function findPresetDefaultCredential(preset: ModelProviderPreset): ModelCredential | undefined {
    return findDefaultModelCredential(runtimeState.modelCredentials, preset.id);
  }

  function findPresetModelCatalog(preset: ModelProviderPreset): ModelProviderCatalog | undefined {
    const credential = findPresetDefaultCredential(preset);
    return findModelProviderCatalog(
      runtimeState.modelCatalogs,
      preset.id,
      credential?.apiBaseUrl ?? preset.apiBaseUrl
    );
  }

  function findRecommendedPresetForRequiredModelProfile(profile: ModelProfile):
    | { preset: ModelProviderPreset; model: ModelProviderPresetModel }
    | undefined {
    if (!isPendingModelProviderProfile(profile)) {
      return undefined;
    }

    const capabilities = readModelProfileCapabilities(profile);
    const preferredModelName = capabilities.includes('reasoning_text')
      ? 'deepseek-v4-pro'
      : capabilities.includes('vision_text')
        ? 'qwen-vl-max'
        : 'deepseek-v4-flash';
    const fallbackPurpose = purposeForModelCapabilities(capabilities, profile.purpose);
    const preferredPreset = modelProviderPresets.find((preset) =>
      preset.models.some((model) => model.modelName === preferredModelName)
    );
    const preferredModel = preferredPreset?.models.find((model) => model.modelName === preferredModelName);

    if (preferredPreset && preferredModel) {
      return { preset: preferredPreset, model: preferredModel };
    }

    for (const preset of modelProviderPresets) {
      const model = preset.models.find((item) => item.purpose === fallbackPurpose);
      if (model) {
        return { preset, model };
      }
    }

    return undefined;
  }

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
    return authorizedRoleTemplateCatalog.templates.map(toDesktopRoleTemplate);
  }, [authorizedRoleTemplateCatalog.source, authorizedRoleTemplateCatalog.templates]);

  const desktopRoleTemplateByRoleCode = useMemo(() => {
    const authorizedByRoleCode = new Map(
      desktopRoleTemplates.map((template) => [template.roleCode, template] as const)
    );

    return authorizedByRoleCode;
  }, [authorizedRoleTemplateCatalog.source, desktopRoleTemplates]);

  const enabledModelCount = runtimeState.localRuntime.enabledModelProfileIds.length;
  const enabledToolCount = runtimeState.localRuntime.enabledToolIds.length;
  const knowledgeBindingCount = runtimeState.localRuntime.knowledgeBindingIds.length;
  const isEnterpriseUnbound = runtimeState.localRuntime.workspaceId === pendingWorkspaceId;
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
                  {isEnterpriseUnbound ? (
                    <Button type="primary" onClick={() => setOnboardingOpen(true)}>
                      绑定企业
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
                  {selectedSection === 'logs' ? renderLogs() : null}
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
        {renderAccountModal()}
        {renderRoleUninstallModal()}
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
          {isEnterpriseUnbound ? (
            <Button size="small" type="primary" onClick={() => setOnboardingOpen(true)}>
              绑定企业
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
                <button type="button" onClick={() => openAccountModal('enterprise')}>
                  <UserOutlined />
                  <span>企业资料</span>
                </button>
                <button type="button" onClick={() => openAccountModal('help')}>
                  <QuestionCircleOutlined />
                  <span>帮助中心</span>
                </button>
                <button type="button" onClick={() => openAccountModal('release')}>
                  <InfoCircleOutlined />
                  <span>发行说明</span>
                </button>
                <button type="button" onClick={() => openAccountModal('download')}>
                  <CloudDownloadOutlined />
                  <span>下载应用</span>
                </button>
                <button type="button" onClick={() => openAccountModal('logout')}>
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
        closable
        maskClosable
        okText="绑定"
        cancelText="稍后"
        confirmLoading={isBindingDevice}
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
            未绑定时可直接使用免费版；绑定企业后，桌面端会自动接入对应企业工作区。
          </Typography.Text>
          {onboardingNotice ? <Typography.Text type="danger">{onboardingNotice}</Typography.Text> : null}
        </Form>
      </Modal>
    );
  }

  function renderAccountModal() {
    const open = Boolean(accountModal);
    const latestRelease = updateCheckResult?.latestRelease;

    return (
      <Modal
        title={accountModalTitle(accountModal)}
        open={open}
        footer={null}
        width={accountModal === 'release' ? 720 : 640}
        destroyOnHidden
        onCancel={() => setAccountModal(null)}
      >
        {accountModal === 'enterprise' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="企业工作区">
                {runtimeState.localRuntime.workspaceId === pendingWorkspaceId
                  ? '免费版（未绑定企业）'
                  : runtimeState.localRuntime.workspaceId}
              </Descriptions.Item>
              <Descriptions.Item label="设备名称">{runtimeState.app.deviceName}</Descriptions.Item>
              <Descriptions.Item label="设备 ID">{runtimeState.localRuntime.deviceId}</Descriptions.Item>
              <Descriptions.Item label="运行时 ID">{runtimeState.localRuntime.runtimeId}</Descriptions.Item>
              <Descriptions.Item label="客户端版本">{runtimeState.app.appVersion}</Descriptions.Item>
              <Descriptions.Item label="控制端">{runtimeState.app.serverBaseUrl}</Descriptions.Item>
              <Descriptions.Item label="连接状态">
                <Tag color={connectionTone}>{connectionLabel(runtimeState.serverConnection.state)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="最近同步">
                {formatDate(runtimeState.localRuntime.lastSyncedAt)}
              </Descriptions.Item>
            </Descriptions>

            <div className="account-stat-grid">
              <div>
                <Typography.Text strong>{runtimeState.rolePackages.length}</Typography.Text>
                <Typography.Text type="secondary">数字员工</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{enabledModelCount}</Typography.Text>
                <Typography.Text type="secondary">已启用模型</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{enabledToolCount}</Typography.Text>
                <Typography.Text type="secondary">已启用工具</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{knowledgeBindingCount}</Typography.Text>
                <Typography.Text type="secondary">知识来源</Typography.Text>
              </div>
            </div>
          </Space>
        ) : null}

        {accountModal === 'help' ? (
          <Space direction="vertical" size={14} className="account-modal-body">
            {[
              ['怎么绑定企业？', '客户端默认可直接使用免费版；在 web-console 生成绑定码后，点击“绑定企业”输入绑定码即可接入企业工作区。'],
              ['模型在哪里配置？', '进入左侧“模型”，选择供应商卡片并填写 API Key。不同数字员工可要求不同模型配置。'],
              ['文件怎么交给数字员工？', '在“对话”输入框直接拖入文档、表格、图片等文件，再输入任务要求。'],
              ['结果文件在哪里？', '任务完成后会在聊天记录里显示可下载或可打开的本地产物。'],
              ['怎么更新客户端？', '打开左下角 Q 菜单里的“下载应用”，检查版本并下载新版安装包。']
            ].map(([question, answer]) => (
              <div key={question} className="account-help-item">
                <Typography.Text strong>{question}</Typography.Text>
                <Typography.Text type="secondary">{answer}</Typography.Text>
              </div>
            ))}
          </Space>
        ) : null}

        {accountModal === 'release' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            <section className="account-legal-section">
              <Typography.Text strong>版本说明</Typography.Text>
              <Typography.Paragraph type="secondary">
                当前版本 {runtimeState.app.appVersion}，重点支持数字员工安装、模型配置、工具调用、本地文件处理、任务历史和本地数据备份。
              </Typography.Paragraph>
            </section>
            <section className="account-legal-section">
              <Typography.Text strong>协议声明</Typography.Text>
              <Typography.Paragraph type="secondary">
                使用本客户端即表示企业确认已获得处理相关业务数据、文件和账号信息的授权。企业应自行确保上传、处理、导出的资料符合内部制度和适用法律法规。
              </Typography.Paragraph>
            </section>
            <section className="account-legal-section">
              <Typography.Text strong>法律边界</Typography.Text>
              <Typography.Paragraph type="secondary">
                数字员工输出用于辅助办公，不构成法律、医疗、金融投资等强监管领域的最终专业意见。涉及重大决策时，应由具备资质的人员复核。
              </Typography.Paragraph>
            </section>
            <section className="account-legal-section">
              <Typography.Text strong>使用边界</Typography.Text>
              <Typography.Paragraph type="secondary">
                不得用于违法违规、侵犯隐私、绕过安全限制、批量骚扰、恶意爬取、生成欺诈内容或其他损害第三方权益的行为。
              </Typography.Paragraph>
            </section>
          </Space>
        ) : null}

        {accountModal === 'download' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="当前版本">{runtimeState.app.appVersion}</Descriptions.Item>
              <Descriptions.Item label="最新版本">
                {latestRelease
                  ? `${latestRelease.version} · ${
                      updateCheckResult?.updateAvailable ? '可更新' : '已是最新'
                    }`
                  : updateNotice || '尚未检查'}
              </Descriptions.Item>
              {latestRelease?.fileSizeBytes !== undefined ? (
                <Descriptions.Item label="安装包大小">
                  {formatFileSize(latestRelease.fileSizeBytes)}
                </Descriptions.Item>
              ) : null}
              {latestRelease?.releaseNotes ? (
                <Descriptions.Item label="更新说明">{latestRelease.releaseNotes}</Descriptions.Item>
              ) : null}
              <Descriptions.Item label="更新策略">
                {updateCheckResult?.forceUpdate ? <Tag color="red">强制更新</Tag> : <Tag>常规更新</Tag>}
              </Descriptions.Item>
            </Descriptions>
            {updateNotice ? <Typography.Text type="secondary">{updateNotice}</Typography.Text> : null}
            <Space wrap>
              <Button
                icon={<CloudDownloadOutlined />}
                loading={isCheckingForUpdates}
                onClick={() => void checkForUpdates()}
              >
                检查更新
              </Button>
              <Button
                type="primary"
                disabled={!updateCheckResult?.updateAvailable || !latestRelease}
                onClick={() => void openUpdateDownload()}
              >
                下载新版
              </Button>
            </Space>
          </Space>
        ) : null}

        {accountModal === 'logout' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            <Typography.Paragraph>
              退出登录会解绑当前设备。解绑后，本机需要重新输入企业绑定码才能同步企业数字员工和授权。
            </Typography.Paragraph>
            <Typography.Text type="secondary">
              本地任务记录、模型配置和产物文件不会在此操作中主动删除。
            </Typography.Text>
            {onboardingNotice ? <Typography.Text type="danger">{onboardingNotice}</Typography.Text> : null}
            <Space wrap>
              <Button onClick={() => setAccountModal(null)}>取消</Button>
              <Button
                danger
                type="primary"
                loading={isUnbindingDevice}
                onClick={() => void handleUnbindDesktopDevice()}
              >
                解绑当前设备
              </Button>
            </Space>
          </Space>
        ) : null}
      </Modal>
    );
  }

  function renderRoleUninstallModal() {
    const rolePackage = runtimeState.rolePackages.find(
      (item) => item.roleCode === pendingUninstallRoleCode
    );
    const blockingTasks = pendingUninstallRoleCode
      ? getBlockingTasksForRole(runtimeState, pendingUninstallRoleCode)
      : [];
    const hasBlockingTasks = blockingTasks.length > 0;

    return (
      <Modal
        title={rolePackage ? `卸载：${rolePackage.name}` : '卸载数字员工'}
        open={Boolean(pendingUninstallRoleCode)}
        okText={hasBlockingTasks ? '暂不能卸载' : '确认卸载'}
        cancelText="取消"
        okButtonProps={{ danger: true, disabled: hasBlockingTasks || !rolePackage }}
        destroyOnHidden
        onCancel={() => setPendingUninstallRoleCode('')}
        onOk={() => {
          if (rolePackage) {
            uninstallRole(rolePackage.roleCode);
          }
        }}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Paragraph>
            卸载后，该数字员工将从当前电脑移除。历史任务和已生成产物仍会保留，以后可以在数字员工市场重新安装。
          </Typography.Paragraph>
          {hasBlockingTasks ? (
            <div className="role-uninstall-blocking-note">
              <Typography.Text strong>该数字员工还有未结束任务，完成或取消后再卸载。</Typography.Text>
              <Space direction="vertical" size={4} style={{ width: '100%', marginTop: 8 }}>
                {blockingTasks.slice(0, 3).map((task) => (
                  <Typography.Text key={task.taskId} type="secondary" ellipsis>
                    {taskStateLabel(task.state)}：{task.title}
                  </Typography.Text>
                ))}
              </Space>
            </div>
          ) : null}
        </Space>
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

    const activeRoleCode = activeRolePackage?.roleCode ?? '';
    const activeRoleDeleted = activeRoleCode
      ? isRuntimeRolePackageDeleted(runtimeState, activeRoleCode)
      : false;
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
      !activeRoleDeleted &&
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
          <Button size="small" disabled={activeRoleDeleted} onClick={startNewConversationTask}>
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
              const isDeleted = summary?.state === 'deleted';

              return (
                <button
                  key={rolePackage.roleCode}
                  type="button"
                  className={[
                    'agent-session-item',
                    isActive ? 'selected' : '',
                    isDeleted ? 'deleted' : ''
                  ].filter(Boolean).join(' ')}
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
                        : isDeleted
                          ? '该数字员工已被服务端删除，历史任务仍可查看'
                          : rolePackage.summary ?? '点击后开始一段新的任务对话'}
                    </Typography.Text>
                    <span className="agent-session-tags">
                      <Tag color={isDeleted ? 'red' : isActive ? 'green' : 'default'}>
                        {isDeleted ? '已删除' : isActive ? '当前' : '可用'}
                      </Tag>
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
              <Button size="small" disabled={activeRoleDeleted} onClick={startNewConversationTask}>
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
                        {selectConversationVisibleLogs(conversationTask).map((log) => (
                          <div key={log.id} className={`process-step ${log.level}`}>
                            <span className="process-dot" />
                            <Space direction="vertical" size={4}>
                              <Space size={8} wrap>
                                <Typography.Text strong>{executionEventLabel(log.eventType)}</Typography.Text>
                                <Typography.Text type="secondary">{formatDate(log.createdAt)}</Typography.Text>
                              </Space>
                              <Typography.Text type="secondary">{userFriendlyExecutionMessage(log)}</Typography.Text>
                            </Space>
                          </div>
                        ))}
                        <Button
                          size="small"
                          icon={<FileTextOutlined />}
                          className="process-log-link"
                          onClick={() => {
                            setSelectedTaskId(conversationTask.taskId);
                            navigateToSection('logs');
                          }}
                        >
                          查看详细日志
                        </Button>
                      </div>
                    ) : (
                      <Typography.Text type="secondary">
                        任务已进入对话，点击“开始执行”后会展示关键进度；完整节点输入输出会记录到“日志”。
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
                        {conversationArtifacts.map((artifact) => {
                          const fileName = getArtifactFileName(artifact);
                          return (
                          <div key={artifact.id} className="chat-artifact-card">
                            <div className={`artifact-file-icon ${getArtifactToneClass(artifact)}`}>
                              {renderArtifactFileIcon(artifact)}
                            </div>
                            <div className="artifact-file-main">
                              <div className="artifact-file-title-row">
                                <Typography.Text strong ellipsis title={fileName}>
                                  {fileName}
                                </Typography.Text>
                                <Tag className="artifact-file-type">{getArtifactTypeLabel(artifact)}</Tag>
                              </div>
                              <Typography.Text type="secondary" className="artifact-file-meta">
                                {formatArtifactMeta(artifact)}
                              </Typography.Text>
                            </div>
                            {artifact.localPath ? (
                              <Button
                                size="small"
                                className="artifact-download-button"
                                icon={<DownloadOutlined />}
                                loading={savingArtifactId === artifact.id}
                                title="Save file"
                                aria-label="Save file"
                                onClick={() => void saveArtifactAs(artifact)}
                              />
                            ) : (
                              <Tag color="warning">缓存已过期</Tag>
                            )}
                          </div>
                          );
                        })}
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
              if (activeRoleDeleted) {
                message.warning('该数字员工已被服务端删除，不能继续执行。');
                return;
              }
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
                disabled={!activeRoleCode || activeRoleDeleted}
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
                disabled={!activeRoleCode || activeRoleDeleted}
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

  function renderLogs() {
    const selectedLogTask =
      selectedTaskId && selectedTaskId !== newTaskSelectionId
        ? taskDetails.find((task) => task.taskId === selectedTaskId) ?? taskDetails[0]
        : taskDetails[0];
    const logStats = buildTaskLogStats(taskDetails);

    return (
      <div className="logs-page">
        <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
          <div>
            <Typography.Title level={2} className="page-title">
              日志
            </Typography.Title>
            <Typography.Text type="secondary">
              查看所有任务的执行细节、节点输入输出、工具调用和失败原因。
            </Typography.Text>
          </div>
          <Space size={8} wrap>
            <Tag color="default">全部 {taskDetails.length}</Tag>
            <Tag color="red">失败 {logStats.failed}</Tag>
            <Tag color="geekblue">运行中 {logStats.running}</Tag>
            <Tag color="green">成功 {logStats.completed}</Tag>
          </Space>
        </Flex>

        <div className="logs-layout">
          <aside className="logs-task-list" aria-label="任务日志列表">
            {taskDetails.length > 0 ? (
              taskDetails.map((task) => (
                <button
                  key={task.taskId}
                  type="button"
                  className={selectedLogTask?.taskId === task.taskId ? 'logs-task-item selected' : 'logs-task-item'}
                  onClick={() => setSelectedTaskId(task.taskId)}
                >
                  <span className="logs-task-title">{task.title}</span>
                  <span className="logs-task-meta">
                    <Tag color={taskStateColor(task.state)}>{taskStateLabel(task.state)}</Tag>
                    <span>{formatShortTime(task.updatedAt)}</span>
                    <span>{task.roleName}</span>
                  </span>
                </button>
              ))
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无任务日志" />
            )}
          </aside>

          <section className="logs-detail-panel">
            {selectedLogTask ? (
              <>
                <Flex align="flex-start" justify="space-between" gap={12} wrap="wrap" className="logs-detail-header">
                  <Space direction="vertical" size={4}>
                    <Space size={8} wrap>
                      <Typography.Text strong>{selectedLogTask.title}</Typography.Text>
                      <Tag color={taskStateColor(selectedLogTask.state)}>{taskStateLabel(selectedLogTask.state)}</Tag>
                    </Space>
                    <Typography.Text type="secondary">
                      {selectedLogTask.roleName} · {formatDateTime(selectedLogTask.updatedAt)} · 产物 {countUserDeliverableArtifacts(selectedLogTask)}
                    </Typography.Text>
                  </Space>
                  <Button
                    size="small"
                    onClick={() => {
                      activateRole(selectedLogTask.roleCode);
                      setSelectedTaskId(selectedLogTask.taskId);
                      navigateToSection('workbench');
                    }}
                  >
                    回到对话
                  </Button>
                </Flex>

                <div className="logs-timeline">
                  {selectedLogTask.executionLogs.length > 0 ? (
                    selectedLogTask.executionLogs.map((log) => {
                      const workflowNodeDetail = readWorkflowNodeLogDetail(log);
                      const friendlyMessage = userFriendlyExecutionMessage(log);
                      const rawMessage = log.message.trim();
                      return (
                        <div key={log.id} className={`log-entry ${log.level}`}>
                          <span className="log-entry-dot" />
                          <div className="log-entry-body">
                            <Flex align="center" justify="space-between" gap={8} wrap="wrap">
                              <Space size={8} wrap>
                                <Typography.Text strong>{executionEventLabel(log.eventType)}</Typography.Text>
                                <Tag color={logLevelColor(log.level)}>{logLevelLabel(log.level)}</Tag>
                              </Space>
                              <Typography.Text type="secondary">{formatDateTime(log.createdAt)}</Typography.Text>
                            </Flex>
                            <Typography.Text className="log-friendly-message">{friendlyMessage}</Typography.Text>
                            {rawMessage && rawMessage !== friendlyMessage ? (
                              <details className="log-raw-details">
                                <summary>原始日志</summary>
                                <pre>{rawMessage}</pre>
                              </details>
                            ) : null}
                            {workflowNodeDetail ? (
                              <details className="log-raw-details">
                                <summary>节点输入输出</summary>
                                {renderWorkflowNodeLogDetail(workflowNodeDetail)}
                              </details>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该任务暂无执行日志" />
                  )}
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择左侧任务查看详细日志" />
            )}
          </section>
        </div>
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
    const roleConfigPreviewPackage = roleConfigTemplate
      ? toConfiguredRolePackagePreview(roleConfigTemplate, roleConfigRolePackage)
      : undefined;
    const roleConfigModelRequirements = roleConfigPreviewPackage
      ? getRoleModelRuntimeRequirementStatuses(
          runtimeState.modelProfiles,
          runtimeState.localRuntime.enabledModelProfileIds,
          roleConfigPreviewPackage,
          {
            roleCode: roleConfigPreviewPackage.roleCode,
            credentials: runtimeState.modelCredentials,
            roleBindings: runtimeState.roleModelCredentialBindings
          }
        )
      : [];
    const roleConfigCredentialInitialValues = roleConfigPreviewPackage
      ? buildRoleModelCredentialFormValues(
          roleConfigPreviewPackage.roleCode,
          roleConfigPreviewPackage.modelProfileIds,
          runtimeState.roleModelCredentialBindings
        )
      : {};
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
              const installedRolePackage = runtimeState.rolePackages.find(
                (rolePackage) => rolePackage.roleCode === template.roleCode
              );
              const readiness = installedRolePackage
                ? buildRoleRuntimeReadiness(runtimeState, installedRolePackage)
                : undefined;
              const hasTemplateUpdate = isInstalledRoleTemplateOutdated(template, installedRolePackage);
              const fileContract = buildRoleFileContractSummary(template);

              return (
                <Card key={template.roleCode} bordered={false} className="catalog-card role-catalog-card">
                  <Space direction="vertical" size={10} style={{ width: '100%' }} className="role-card-content">
                    <Flex align="flex-start" justify="space-between" gap={12}>
                      <span className="catalog-card-icon">
                        <RobotOutlined />
                      </span>
                      <Space size={6} wrap>
                        <Tag color={active ? 'green' : installed ? 'blue' : 'default'}>
                          {active ? '当前' : installed ? '已安装' : '可安装'}
                        </Tag>
                        {readiness ? (
                          <Tooltip title={readiness.issueText}>
                            <Tag color={readiness.color}>{readiness.label}</Tag>
                          </Tooltip>
                        ) : null}
                        {hasTemplateUpdate ? <Tag color="orange">有新版</Tag> : null}
                        <Tag>{roleTemplateCategory(template)}</Tag>
                      </Space>
                    </Flex>

                    <Flex align="center" gap={6} className="role-card-title-row">
                      <Typography.Title level={5} ellipsis title={template.name}>
                        {template.name}
                      </Typography.Title>
                      {template.summary ? (
                        <Tooltip title={template.summary} placement="top">
                          <button
                            type="button"
                            className="role-info-trigger"
                            aria-label={`${template.name} 说明`}
                          >
                            <ExclamationCircleOutlined />
                          </button>
                        </Tooltip>
                      ) : null}
                    </Flex>

                    <Space size={6} wrap>
                      {template.skills.slice(0, 3).map((skill) => (
                        <Tag key={skill.code}>{skill.name}</Tag>
                      ))}
                    </Space>

                    <div className="role-card-io-grid">
                      {renderRoleIoRow('可上传', fileContract.uploadLabels, fileContract.uploadDetail)}
                      {renderRoleIoRow('可输出', fileContract.outputLabels, fileContract.outputDetail)}
                    </div>

                    <Typography.Text type="secondary" className="catalog-card-meta">
                      {template.industry} · 任务 {summary?.taskCount ?? 0}
                    </Typography.Text>

                    <Space size={6} className="role-card-actions">
                      {installed ? (
                        <Button
                          size="small"
                          type={active ? 'default' : 'primary'}
                          onClick={() => {
                            activateRole(template.roleCode);
                            navigateToSection('workbench');
                          }}
                        >
                          {active ? '进入对话' : '开始使用'}
                        </Button>
                      ) : (
                        <Button size="small" type="primary" onClick={() => openRoleConfig(template.roleCode, 'install')}>
                          安装
                        </Button>
                      )}
                      {installed && hasTemplateUpdate ? (
                        <Button size="small" type="primary" ghost onClick={() => updateInstalledRole(template)}>
                          更新
                        </Button>
                      ) : null}
                      <Button size="small" onClick={() => openRoleConfig(template.roleCode, installed ? 'configure' : 'install')}>
                        配置
                      </Button>
                      {installed ? (
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => confirmUninstallRole(template.roleCode)}
                        >
                          卸载
                        </Button>
                      ) : null}
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
                  <List
                    size="small"
                    dataSource={roleConfigModelRequirements}
                    locale={{ emptyText: '当前数字员工没有声明模型需求' }}
                    renderItem={(requirement) => (
                      <List.Item
                        actions={[
                          <Button
                            key="configure"
                            size="small"
                            type={requirement.ready ? 'default' : 'primary'}
                            onClick={() => openRequiredModelProfileConfig(requirement.profile)}
                          >
                            {requirement.ready ? '查看配置' : '配置模型'}
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <Space size={6} wrap>
                              <Typography.Text strong>
                                {requirement.profile.providerName} / {requirement.profile.modelName}
                              </Typography.Text>
                              <Tag>{modelCapabilitySummary(requirement.profile.capabilities, requirement.profile.purpose)}</Tag>
                              <Tag color={requirement.ready ? 'green' : 'orange'}>
                                {renderModelRequirementStatusLabel(requirement.issue)}
                              </Tag>
                            </Space>
                          }
                          description={
                            <Space direction="vertical" size={2}>
                              <Typography.Text type="secondary">
                                Profile ID：{requirement.profile.id}
                              </Typography.Text>
                              <Typography.Text type="secondary">
                                Base URL：{requirement.profile.apiBaseUrl || '待填写'}
                              </Typography.Text>
                              <Typography.Text type="secondary">
                                API Key：{requirement.configured ? '已填写' : '待填写'} · 启用：
                                {requirement.enabled ? '已启用' : '未启用'} · 节点：
                                {requirement.requiredByNodeIds.length > 0
                                  ? requirement.requiredByNodeIds.join('、')
                                  : '通用绑定'}
                              </Typography.Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                  <Typography.Text type="secondary">
                    API Key 只保存在当前电脑；从 admin-console 上架的员工如果声明了多个 LLM，这里会逐项列出。
                  </Typography.Text>
                </Space>
              </Card>

              <Form<RoleConfigFormValues>
                form={roleConfigForm}
                layout="vertical"
                id="role-config-form"
                initialValues={{
                  modelProfileIds: roleConfigPreviewPackage?.modelProfileIds ?? roleConfigTemplate.modelProfileIds,
                  toolIds: roleConfigPreviewPackage?.toolIds ?? roleConfigTemplate.toolIds,
                  knowledgeSources: roleConfigPreviewPackage?.requiredKnowledgeSources ?? roleConfigTemplate.requiredKnowledgeSources,
                  modelCredentialBindings: roleConfigCredentialInitialValues
                }}
                onFinish={submitRoleConfig}
              >
                <Space direction="vertical" size={12} style={{ width: '100%' }}>
                  <Typography.Text strong>API Key 使用方式</Typography.Text>
                  {roleConfigModelRequirements.length === 0 ? (
                    <Empty description="当前数字员工没有声明模型需求" />
                  ) : (
                    roleConfigModelRequirements.map((requirement) =>
                      renderRoleModelCredentialEditor(requirement.profile)
                    )
                  )}
                </Space>

                <Form.Item name="toolIds" label="工具">
                  <Select
                    mode="multiple"
                    allowClear
                    optionLabelProp="label"
                    placeholder="选择可调用的工具"
                    options={(roleConfigPreviewPackage?.toolIds ?? roleConfigTemplate.toolIds).map((toolId) => ({
                      label: resolveToolLabel(runtimeState.tools, toolId),
                      value: toolId
                    }))}
                    disabled
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

              {roleConfigMode === 'configure' && roleConfigRolePackage ? (
                <div className="role-config-danger-zone">
                  <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong>本机卸载</Typography.Text>
                      <Typography.Text type="secondary">
                        从当前电脑移除该数字员工，历史任务和已生成产物仍会保留。
                      </Typography.Text>
                    </Space>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => confirmUninstallRole(roleConfigRolePackage.roleCode)}
                    >
                      卸载数字员工
                    </Button>
                  </Flex>
                </div>
              ) : null}
            </Space>
          ) : (
            <Empty description="未找到数字员工" />
          )}
        </Modal>
      </>
    );
  }

  function renderRoleIoRow(label: string, values: string[], detail: string) {
    const visibleValues = values.slice(0, 3);
    const hiddenCount = Math.max(values.length - visibleValues.length, 0);

    return (
      <div className="role-card-io-row">
        <span className="role-card-io-label">{label}</span>
        <span className="role-card-io-tags">
          {visibleValues.map((value) => (
            <Tag key={`${label}-${value}`} className="role-card-io-tag">
              {value}
            </Tag>
          ))}
          {hiddenCount > 0 ? (
            <Tooltip title={detail}>
              <Tag className="role-card-io-tag">+{hiddenCount}</Tag>
            </Tooltip>
          ) : null}
        </span>
      </div>
    );
  }

  function renderModels() {
    const configuredModelCount = runtimeState.modelProfiles.filter((profile) =>
      isRuntimeModelProfileConfigured(profile)
    ).length;
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
    const selectedModelCatalog = selectedModelProfile
      ? findModelProviderCatalog(
          runtimeState.modelCatalogs,
          selectedModelProfile.providerId,
          selectedModelDefaultCredential?.apiBaseUrl ?? selectedModelProfile.apiBaseUrl
        )
      : undefined;

    return (
      <>
        <div className="catalog-page">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
            <div>
              <Typography.Title level={2} className="page-title">
                模型配置
              </Typography.Title>
              <Typography.Text type="secondary">
                配置供应商默认 API Key；数字员工也可以单独覆盖自己的 Key。
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
              已接通模型 {configuredModelCount}/{runtimeState.modelProfiles.length}
            </Tag>
            <Tag color={enabledModelProfiles.length > 0 ? 'blue' : 'default'}>
              已启用 {enabledModelProfiles.length}
            </Tag>
            <Tag color={runtimeState.modelCredentials.length > 0 ? 'green' : 'default'}>
              默认 Key {runtimeState.modelCredentials.filter((credential) => credential.isDefault).length}
            </Tag>
          </div>

          <div className="catalog-grid model-provider-grid">
            {filteredPresets.map((preset) => {
              const defaultCredential = findPresetDefaultCredential(preset);
              const modelCatalog = findPresetModelCatalog(preset);
              return (
              <Card key={preset.id} bordered={false} className="catalog-card model-provider-card">
                <Space direction="vertical" size={12} className="catalog-card-content">
                  <Flex align="flex-start" justify="space-between" gap={12}>
                    <span className={`model-provider-logo provider-${preset.id}`}>
                      {modelProviderLogoText(preset.name)}
                    </span>
                    <Space size={4} wrap>
                      {preset.apiBaseUrl ? <Tag color="blue">兼容接口</Tag> : null}
                      <Tag color={defaultCredential ? 'green' : 'orange'}>
                        {defaultCredential ? '默认 Key 已配置' : '待配置默认 Key'}
                      </Tag>
                      {modelCatalog ? <Tag color="purple">已拉取 {modelCatalog.models.length}</Tag> : null}
                    </Space>
                  </Flex>

                  <Space direction="vertical" size={6} style={{ width: '100%' }}>
                    <Typography.Title level={5}>{preset.name}</Typography.Title>
                    <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                      {preset.summary}
                    </Typography.Paragraph>
                  </Space>

                  <Space size={6} wrap>
                    {preset.models.slice(0, 5).map((model) => (
                      <Tag
                        key={`${preset.id}-${model.modelName}-${model.purpose}`}
                        className="model-preset-tag"
                        onClick={() => {
                          applyModelProviderPreset(preset, model);
                          setModelConfigOpen(true);
                        }}
                      >
                        {model.label}
                      </Tag>
                    ))}
                    {preset.models.length > 5 ? <Tag>+{preset.models.length - 5}</Tag> : null}
                  </Space>

                  <div className="catalog-card-action-row">
                    <Button
                      type="primary"
                      onClick={() => {
                        applyModelProviderPreset(preset, preset.models[0]);
                        setModelConfigOpen(true);
                      }}
                    >
                      配置模型
                    </Button>
                  </div>
                </Space>
              </Card>
              );
            })}
          </div>

          {filteredPresets.length === 0 ? (
            <div className="provider-empty">
              <Empty description="没有匹配的模型供应商" />
            </div>
          ) : null}
        </div>

        <Modal
          open={modelConfigOpen}
          title="供应商模型配置"
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
                <Input.Password placeholder="作为该供应商默认 Key，只保存在本机" />
              </Form.Item>
              <div className="inline-form-grid">
                <Form.Item name="providerName" label="供应商" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="modelName" label="模型" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </div>
              <Form.Item name="capabilities" label="模型能力" rules={[{ required: true, message: '请选择模型能力' }]}>
                <Select
                  mode="multiple"
                  placeholder="按模型真实输入输出选择"
                  options={modelCapabilityOptions.map((option) => ({
                    label: `${option.label} - ${option.description}`,
                    value: option.value
                  }))}
                />
              </Form.Item>
              <Form.Item name="purpose" hidden>
                <Input />
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
                      label: `${modelCapabilitySummary(profile.capabilities, profile.purpose)} · ${profile.providerName}/${profile.modelName}`,
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
                    测试模型
                  </Button>
                  <Button
                    icon={<CloudDownloadOutlined />}
                    loading={isPullingProviderModels}
                    onClick={() => void pullSelectedProviderModels()}
                  >
                    拉取模型
                  </Button>
                </Space>
                {modelTestNotice ? (
                  <Typography.Text
                    type={
                      modelTestNotice.startsWith('模型连接正常') || modelTestNotice.startsWith('已拉取')
                        ? 'success'
                        : 'danger'
                    }
                  >
                    {modelTestNotice}
                  </Typography.Text>
                ) : null}
                {selectedModelCatalog ? (
                  <div className="provider-model-catalog">
                    <Flex align="center" justify="space-between" gap={12} wrap="wrap">
                      <Typography.Text strong>可调用模型</Typography.Text>
                      <Typography.Text type="secondary">
                        最近拉取：{formatDateTime(selectedModelCatalog.fetchedAt)}
                      </Typography.Text>
                    </Flex>
                    <div className="provider-model-list">
                      {selectedModelCatalog.models.map((model) => (
                        <button
                          key={model.id}
                          type="button"
                          className={
                            selectedModelProfile.modelName === model.id
                              ? 'provider-model-option active'
                              : 'provider-model-option'
                          }
                          onClick={() => applyFetchedProviderModel(selectedModelProfile, model)}
                        >
                          <span>{model.label ?? model.id}</span>
                          <small>{modelCapabilitySummary(model.capabilities, 'general')}</small>
                        </button>
                      ))}
                    </div>
                  </div>
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

  function renderRoleModelCredentialEditor(profile: ModelProfile) {
    const defaultCredential = findDefaultModelCredential(
      runtimeState.modelCredentials,
      profile.providerId
    );
    const providerCredentials = listProviderModelCredentials(
      runtimeState.modelCredentials,
      profile.providerId
    );
    const modePath = ['modelCredentialBindings', profile.id, 'mode'];

    return (
      <div key={profile.id} className="role-model-credential-editor">
        <Flex align="flex-start" justify="space-between" gap={12} wrap="wrap">
          <Space direction="vertical" size={2}>
            <Typography.Text strong>
              {profile.providerName} / {profile.modelName}
            </Typography.Text>
            <Typography.Text type="secondary">
              {modelCapabilitySummary(profile.capabilities, profile.purpose)} · Profile ID：{profile.id}
            </Typography.Text>
          </Space>
          <Tag color={isRuntimeModelProfileConfigured(profile, roleConfigRoleCode) ? 'green' : 'orange'}>
            {isRuntimeModelProfileConfigured(profile, roleConfigRoleCode) ? '已就绪' : '待配置'}
          </Tag>
        </Flex>

        <Form.Item
          name={modePath}
          rules={[{ required: true, message: '请选择 API Key 使用方式' }]}
        >
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            options={[
              { label: '使用默认 Key', value: 'provider_default' },
              {
                label: '选择已有 Key',
                value: 'credential_ref',
                disabled: providerCredentials.length === 0
              },
              { label: '单独输入 Key', value: 'inline' }
            ]}
          />
        </Form.Item>

        <Form.Item noStyle shouldUpdate>
          {({ getFieldValue }) => {
            const mode = (getFieldValue(modePath) ?? 'provider_default') as ModelCredentialBindingMode;

            if (mode === 'credential_ref') {
              return (
                <Form.Item
                  name={['modelCredentialBindings', profile.id, 'credentialId']}
                  rules={[{ required: true, message: '请选择已有 Key' }]}
                >
                  <Select
                    placeholder="选择已有 Key"
                    options={providerCredentials.map((credential) => ({
                      label: `${credential.label}${credential.isDefault ? '（默认）' : ''}`,
                      value: credential.id
                    }))}
                  />
                </Form.Item>
              );
            }

            if (mode === 'inline') {
              return (
                <div className="inline-form-grid">
                  <Form.Item
                    name={['modelCredentialBindings', profile.id, 'apiBaseUrl']}
                    label="API Base URL"
                    initialValue={profile.apiBaseUrl}
                  >
                    <Input placeholder={profile.apiBaseUrl ?? 'https://api.example.com/v1'} />
                  </Form.Item>
                  <Form.Item
                    name={['modelCredentialBindings', profile.id, 'apiKey']}
                    label="专用 API Key"
                    rules={[{ required: true, message: '请输入专用 API Key' }]}
                  >
                    <Input.Password placeholder="只给当前数字员工使用" />
                  </Form.Item>
                </div>
              );
            }

            return (
              <Typography.Text type={defaultCredential ? 'secondary' : 'danger'}>
                {defaultCredential
                  ? `将使用 ${defaultCredential.label}`
                  : `尚未配置 ${profile.providerName} 默认 Key，可先去“模型配置”填写，或选择“单独输入 Key”。`}
              </Typography.Text>
            );
          }}
        </Form.Item>
      </div>
    );
  }

  function renderTools() {
    const webSearchSettings = runtimeState.localRuntime.toolSettings?.webSearch;
    const webSearchUsesCustomEndpoint = Boolean(webSearchSettings?.endpoint);
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
                    {renderToolRuntimeTags(tool, webSearchUsesCustomEndpoint)}
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
              <Typography.Paragraph type="secondary">
                默认使用内置网页搜索；只有需要接入企业自有搜索服务时，才填写下面的地址和密钥。
              </Typography.Paragraph>
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
      const templateRolePackage = toInstalledRolePackage(template);
      const configuredRolePackage = {
        ...templateRolePackage,
        toolIds: templateRolePackage.toolIds,
        requiredKnowledgeSources: values?.knowledgeSources ?? templateRolePackage.requiredKnowledgeSources
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
      const roleModelCredentialBindings = values?.modelCredentialBindings
        ? [
            ...current.roleModelCredentialBindings.filter(
              (binding) => binding.roleCode !== installedRolePackage.roleCode
            ),
            ...buildRoleModelCredentialBindingsFromForm(
              installedRolePackage.roleCode,
              installedRolePackage.modelProfileIds,
              values.modelCredentialBindings
            )
          ]
        : current.roleModelCredentialBindings;
      const activeRoleCode =
        current.localRuntime.activeRoleCode && rolePackages.some((rolePackage) => rolePackage.roleCode === current.localRuntime.activeRoleCode)
          ? current.localRuntime.activeRoleCode
          : template.roleCode;
      const tasks = current.runtimeSnapshot.tasks;

      return {
        ...current,
        rolePackages,
        modelProfiles,
        roleModelCredentialBindings,
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

  function updateInstalledRole(template: DesktopRoleTemplate) {
    const existingRole = runtimeState.rolePackages.find((rolePackage) => rolePackage.roleCode === template.roleCode);
    if (!existingRole) {
      openRoleConfig(template.roleCode, 'install');
      return;
    }

    installRole(template, {
      modelProfileIds: template.modelProfileIds,
      toolIds: template.toolIds,
      knowledgeSources: existingRole.requiredKnowledgeSources
    });
    message.success(`${template.name} 已更新到 ${template.version}。`);
  }

  function confirmUninstallRole(roleCode: string) {
    const rolePackage = runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    if (!rolePackage) {
      message.warning('该数字员工未安装在当前电脑。');
      return;
    }

    setPendingUninstallRoleCode(roleCode);
  }

  function uninstallRole(roleCode: string) {
    const rolePackage = runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    if (!rolePackage) {
      message.warning('该数字员工未安装在当前电脑。');
      return;
    }

    if (hasBlockingTaskForRole(runtimeState, roleCode)) {
      message.warning('该数字员工正在执行任务，请等待任务完成或取消后再卸载。');
      return;
    }

    setRuntimeState((current) => uninstallRolePackageFromRuntimeState(current, roleCode));
    if (roleConfigRoleCode === roleCode) {
      closeRoleConfig();
    }
    setPendingUninstallRoleCode('');
    setTaskHistoryOpen(false);
    message.success(`${rolePackage.name} 已从当前电脑卸载，历史任务和产物已保留。`);
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

  function openRequiredModelProfileConfig(profile: ModelProfile) {
    const recommendation = findRecommendedPresetForRequiredModelProfile(profile);
    const hasProfile = runtimeState.modelProfiles.some((item) => item.id === profile.id);
    const baseModelProfiles = hasProfile ? runtimeState.modelProfiles : [...runtimeState.modelProfiles, profile];
    const selectedModelProfile = recommendation
      ? selectModelProfileForPreset(
          baseModelProfiles,
          recommendation.preset,
          recommendation.model,
          { preferredProfileId: profile.id }
        )
      : undefined;
    const nextSelectedProfile = selectedModelProfile?.profile ?? profile;

    setRuntimeState((current) => {
      const enabledModelProfileIds = mergeUniqueStrings(
        current.localRuntime.enabledModelProfileIds,
        [nextSelectedProfile.id]
      );

      return {
        ...current,
        modelProfiles: selectedModelProfile?.modelProfiles ?? baseModelProfiles,
        localRuntime: {
          ...current.localRuntime,
          enabledModelProfileIds
        }
      };
    });
    setSelectedModelId(nextSelectedProfile.id);
    setModelConfigOpen(true);
    if (recommendation) {
      setModelTestNotice(
        `已为 ${profile.id} 推荐 ${recommendation.preset.name} / ${recommendation.model.modelName}，填写 API Key 后保存并测试模型。`
      );
    }
  }

  function saveModelProfile(values: ModelFormValues) {
    if (!selectedModelProfile) {
      return;
    }

    const capabilities = normalizeModelCapabilities(
      values.capabilities,
      values.purpose ?? selectedModelProfile.purpose
    );
    const purpose = purposeForModelCapabilities(capabilities, selectedModelProfile.purpose);
    const updatedProfile: ModelProfile = {
      ...selectedModelProfile,
      providerId: selectedModelProfile.providerId,
      providerName: values.providerName.trim(),
      modelName: values.modelName.trim(),
      purpose,
      capabilities,
      apiBaseUrl: values.apiBaseUrl?.trim() || undefined,
      apiKey: undefined,
      temperature: values.temperature,
      maxTokens: values.maxTokens,
      monthlyBudgetCents: values.monthlyBudgetCents,
      fallbackProfileId: values.fallbackProfileId || undefined
    };

    setRuntimeState((current) => ({
      ...current,
      modelProfiles: current.modelProfiles.map((profile) =>
        profile.id === selectedModelProfile.id
          ? updatedProfile
          : profile
      ),
      modelCredentials: upsertDefaultModelCredential({
        credentials: current.modelCredentials,
        profile: updatedProfile,
        apiKey: values.apiKey,
        apiBaseUrl: values.apiBaseUrl
      })
    }));
  }

  function applyModelProviderPreset(
    preset: ModelProviderPreset,
    model: ModelProviderPresetModel,
    options: { apiBaseUrl?: string; apiKey?: string } = {}
  ) {
    const presetForSelection = options.apiBaseUrl
      ? { ...preset, apiBaseUrl: options.apiBaseUrl }
      : preset;
    const selection = selectModelProfileForPreset(runtimeState.modelProfiles, presetForSelection, model);

    if (!selection) {
      return;
    }

    const defaultCredential = findDefaultModelCredential(
      runtimeState.modelCredentials,
      selection.profile.providerId
    );
    setSelectedModelId(selection.profile.id);
    setRuntimeState((current) => ({
      ...current,
      modelProfiles: selection.modelProfiles
    }));
    modelForm.setFieldsValue({
      providerName: preset.name,
      modelName: model.modelName,
      purpose: model.purpose,
      capabilities: normalizeModelCapabilities(model.capabilities, model.purpose),
      apiBaseUrl: options.apiBaseUrl ?? defaultCredential?.apiBaseUrl ?? selection.profile.apiBaseUrl,
      apiKey: options.apiKey ?? defaultCredential?.apiKey ?? '',
      temperature: selection.profile.temperature,
      maxTokens: selection.profile.maxTokens,
      monthlyBudgetCents: selection.profile.monthlyBudgetCents,
      fallbackProfileId: selection.profile.fallbackProfileId
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
        purpose: purposeForModelCapabilities(
          values.capabilities,
          values.purpose ?? selectedModelProfile.purpose
        ),
        capabilities: normalizeModelCapabilities(
          values.capabilities,
          values.purpose ?? selectedModelProfile.purpose
        ),
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

  async function pullSelectedProviderModels() {
    if (!selectedModelProfile || !window.qiuDesktop) {
      return;
    }

    setIsPullingProviderModels(true);
    setModelTestNotice('');

    try {
      const values = await modelForm.validateFields();
      const apiBaseUrl = values.apiBaseUrl?.trim();
      const apiKey = values.apiKey?.trim();

      if (!apiBaseUrl || !apiKey) {
        setModelTestNotice('请先填写 API Base URL 和 API Key。');
        return;
      }

      const catalog = await window.qiuDesktop.listProviderModels({
        providerId: selectedModelProfile.providerId,
        providerName: values.providerName.trim(),
        apiBaseUrl,
        apiKey,
        timeoutMs: 20_000
      });

      setRuntimeState((current) => ({
        ...current,
        modelCatalogs: upsertModelProviderCatalog(current.modelCatalogs, catalog)
      }));
      setModelTestNotice(
        catalog.models.length > 0
          ? `已拉取 ${catalog.models.length} 个可调用模型。请选择需要启用的模型后保存。`
          : '已拉取模型列表，但供应商没有返回可用模型。'
      );
    } catch (error) {
      setModelTestNotice(`拉取模型失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsPullingProviderModels(false);
    }
  }

  function applyFetchedProviderModel(
    currentProfile: ModelProfile,
    model: ModelProviderCatalog['models'][number]
  ) {
    const capabilities = normalizeModelCapabilities(model.capabilities, currentProfile.purpose);
    const purpose = purposeForModelCapabilities(capabilities, currentProfile.purpose);
    const preset =
      modelProviderPresets.find((item) => item.id === currentProfile.providerId) ?? {
        id: currentProfile.providerId,
        name: currentProfile.providerName,
        summary: `${currentProfile.providerName} compatible endpoint.`,
        apiBaseUrl: currentProfile.apiBaseUrl,
        models: []
      };
    const presetModel: ModelProviderPresetModel = {
      label: model.label ?? model.id,
      modelName: model.id,
      purpose,
      capabilities,
      temperature: purpose === 'reasoning' ? 0.2 : 0.4,
      maxTokens: purpose === 'reasoning' ? 8192 : 4096
    };

    applyModelProviderPreset(preset, presetModel, {
      apiBaseUrl: modelForm.getFieldValue('apiBaseUrl')?.trim(),
      apiKey: modelForm.getFieldValue('apiKey')?.trim()
    });
    setModelTestNotice(`已选择 ${preset.name} / ${model.id}，保存后可作为独立模型使用。`);
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
      toConfiguredRolePackagePreview(
        template,
        runtimeState.rolePackages.find((rolePackage) => rolePackage.roleCode === roleCode)
      );

    setRoleConfigRoleCode(roleCode);
    setRoleConfigMode(mode);
    setRoleConfigModalOpen(true);
    const normalizedModelProfileIds = readRequiredModelProfileIdsForRolePackage(currentRolePackage);
    roleConfigForm.setFieldsValue({
      modelProfileIds: normalizedModelProfileIds,
      toolIds: currentRolePackage.toolIds,
      knowledgeSources: currentRolePackage.requiredKnowledgeSources,
      modelCredentialBindings: buildRoleModelCredentialFormValues(
        currentRolePackage.roleCode,
        normalizedModelProfileIds,
        runtimeState.roleModelCredentialBindings
      )
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
      modelProfileIds: template.modelProfileIds,
      toolIds: template.toolIds,
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
      normalizedPreviewRolePackage,
      {
        roleCode: normalizedPreviewRolePackage.roleCode,
        credentials: runtimeState.modelCredentials,
        roleBindings: buildRoleModelCredentialBindingsFromForm(
          normalizedPreviewRolePackage.roleCode,
          normalizedPreviewRolePackage.modelProfileIds,
          values.modelCredentialBindings
        )
      }
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
      message.warning('该数字员工未安装在当前电脑，请先安装后再执行任务。');
      return undefined;
    }
    if (isRuntimeRolePackageDeleted(runtimeState, roleCode)) {
      message.warning('该数字员工已被服务端删除，不能继续执行。');
      return undefined;
    }
    const latestTemplate = desktopRoleTemplates.find((template) => template.roleCode === roleCode);
    if (latestTemplate && isInstalledRoleTemplateOutdated(latestTemplate, rolePackage)) {
      message.warning('该数字员工有新版可用，请先在“数字员工”页面更新后再运行。');
      navigateToSection('roles');
      return undefined;
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
      preparedRolePackage,
      {
        roleCode: preparedRolePackage.roleCode,
        credentials: runtimeState.modelCredentials,
        roleBindings: runtimeState.roleModelCredentialBindings
      }
    );
    const firstUnreadyModel = modelReadiness.find((requirement) => !requirement.ready);
    const preparedState = replaceRolePackageAndModelProfiles(
      runtimeState,
      preparedRolePackage,
      preparedModelProfiles
    );

    if (firstUnreadyModel) {
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

    const runtimeReadiness = buildRoleRuntimeReadiness(preparedState, preparedRolePackage);
    if (!runtimeReadiness.ready) {
      setRuntimeState(preparedState);
      message.warning(runtimeReadiness.issueText || '该数字员工运行所需配置不完整。');
      navigateToSection(
        runtimeReadiness.missingToolIds.length > 0 || runtimeReadiness.disabledToolIds.length > 0
          ? 'tools'
          : 'models'
      );
      return undefined;
    }

    return preparedState;
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
        modelCredentials: sourceState.modelCredentials,
        roleModelCredentialBindings: sourceState.roleModelCredentialBindings,
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
    .filter(
      (profile) =>
        enabledModelProfileIds.has(profile.id) &&
        hasConfiguredModelApi(state, profile, rolePackage.roleCode)
    )
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

function hasConfiguredModelApi(
  state: DesktopRuntimeState,
  profile: ModelProfile,
  roleCode?: string
): boolean {
  return resolveModelProfileCredential({
    profile,
    roleCode,
    credentials: state.modelCredentials,
    roleBindings: state.roleModelCredentialBindings
  }).configured;
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
  if (includesAny(text, ['video', 'mp4', 'ffmpeg', 'clip', 'trim', 'video_processing'])) return '视频';
  if (includesAny(text, ['document', 'office', 'word', 'ppt', 'spreadsheet', '文档', '表格', '演示'])) return '文档';
  if (includesAny(text, ['web', 'search', 'fetch', 'url', '网页', '搜索'])) return '网页';
  if (includesAny(text, ['file', 'filesystem', 'folder', 'local', '文件', '目录'])) return '文件';
  if (includesAny(text, ['http', 'api', 'custom_api', 'mcp', '接口'])) return '接口';
  if (tool.entryPoint === 'bridge') return '本地';
  return '通用';
}

function buildToolCategoryTabs(tools: ToolManifest[]): string[] {
  const fixedCategories = ['全部', '文档', '网页', '视频', '文件', '接口', '本地', '通用'];
  const availableCategories = new Set(tools.map(toolCategory));
  return fixedCategories.filter((category) => category === '全部' || availableCategories.has(category));
}

function toolCategoryIcon(tool: ToolManifest): ReactNode {
  const category = toolCategory(tool);
  if (category === '文档') return <FileTextOutlined />;
  if (category === '网页') return <GlobalOutlined />;
  if (category === '视频') return <PlayCircleOutlined />;
  if (category === '文件') return <FolderOpenOutlined />;
  if (category === '接口') return <ApiOutlined />;
  return <ToolOutlined />;
}

function renderToolRuntimeTags(tool: ToolManifest, webSearchUsesCustomEndpoint: boolean): ReactNode {
  if (tool.id === 'web-search') {
    return (
      <Tag color="green">
        {webSearchUsesCustomEndpoint ? '自定义搜索' : '内置可用'}
      </Tag>
    );
  }

  if (tool.id === 'office-document') {
    return <Tag color="blue">本机产物</Tag>;
  }

  if (tool.id === 'local-filesystem') {
    return <Tag color="blue">本机文件</Tag>;
  }

  if (tool.id === 'http-request' || tool.id === 'mcp') {
    return <Tag color="gold">高风险</Tag>;
  }

  if (tool.scope === 'desktop') {
    return <Tag color="blue">本机执行</Tag>;
  }

  return null;
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
    logs: {
      title: '日志',
      description: '查看任务执行细节和排错信息。'
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

function accountModalTitle(modal: AccountModalKey | null) {
  const titles: Record<AccountModalKey, string> = {
    enterprise: '企业资料',
    help: '帮助中心',
    release: '发行说明',
    download: '下载应用',
    logout: '退出登录'
  };

  return modal ? titles[modal] : '';
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

function formatDateTime(value?: string) {
  return formatDate(value);
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

function countUserDeliverableArtifacts(task: DesktopTaskDetail) {
  return task.artifacts.filter(isUserDeliverableArtifact).length;
}

function getArtifactFileName(artifact: DesktopTaskDetail['artifacts'][number]) {
  const source = artifact.localPath?.trim() || artifact.title.trim();
  const normalizedSource = source.replace(/\\/g, '/');
  const fileName = normalizedSource.split('/').filter(Boolean).at(-1)?.trim();
  return fileName || artifact.title || 'result-file';
}

function getArtifactExtension(artifact: DesktopTaskDetail['artifacts'][number]) {
  const fileName = getArtifactFileName(artifact);
  return fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? '';
}

function getArtifactTypeLabel(artifact: DesktopTaskDetail['artifacts'][number]) {
  const extension = getArtifactExtension(artifact);
  if (extension) {
    return extension.toUpperCase();
  }

  return artifact.type.toUpperCase();
}

function getArtifactToneClass(artifact: DesktopTaskDetail['artifacts'][number]) {
  const extension = getArtifactExtension(artifact);
  if (['xlsx', 'xls', 'csv'].includes(extension)) return 'excel';
  if (['doc', 'docx'].includes(extension)) return 'word';
  if (extension === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'].includes(extension)) return 'image';
  if (['ppt', 'pptx'].includes(extension)) return 'ppt';
  return 'file';
}

function renderArtifactFileIcon(artifact: DesktopTaskDetail['artifacts'][number]): ReactNode {
  const tone = getArtifactToneClass(artifact);
  if (tone === 'excel') return <FileExcelOutlined />;
  if (tone === 'word') return <FileWordOutlined />;
  if (tone === 'pdf') return <FilePdfOutlined />;
  if (tone === 'image') return <FileImageOutlined />;
  return <FileTextOutlined />;
}

function formatArtifactMeta(artifact: DesktopTaskDetail['artifacts'][number]) {
  const createdAt = Date.parse(artifact.createdAt);
  const createdLabel = Number.isFinite(createdAt) ? formatDate(artifact.createdAt) : '刚刚生成';
  return `${getArtifactTypeLabel(artifact)} · ${createdLabel} · 本地缓存 30 天`;
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
  if (typeof candidate.path === 'string' && candidate.path.trim()) {
    return candidate.path.trim();
  }

  const bridgePath = window.qiuDesktop?.getPathForFile(file);
  return typeof bridgePath === 'string' && bridgePath.trim() ? bridgePath.trim() : undefined;
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
    TASK_COMPLETED: '任务已完成，可以查看结果并保存文件。'
  };

  return messages[log.eventType] ?? workflowExecutionEventMessage(log) ?? log.message;
}

function selectConversationVisibleLogs(task: DesktopTaskDetail): DesktopTaskDetail['executionLogs'] {
  const importantEventTypes = new Set([
    'WORKOS_TASK_RUN_STARTED',
    'LOCAL_RUN_STARTED',
    'WORKFLOW_RUNTIME_FILE_CONTEXT_EXTRACTED',
    'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVED',
    'WORKFLOW_RUNTIME_MODEL_INVOKED',
    'WORKFLOW_RUNTIME_TOOL_INVOKED',
    'WORKFLOW_RUNTIME_ARTIFACT_WRITTEN',
    'WORKFLOW_ARTIFACT_FALLBACK_CREATED',
    'TASK_COMPLETED'
  ]);
  const visibleLogs = task.executionLogs.filter((log) => {
    if (log.level === 'error' || log.level === 'warning') {
      return true;
    }
    if (importantEventTypes.has(log.eventType)) {
      return true;
    }
    if (log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED') {
      const detail = readWorkflowNodeLogDetail(log);
      return detail?.type === 'artifact' || detail?.type === 'output';
    }
    return false;
  });

  return visibleLogs.length > 0 ? visibleLogs.slice(-8) : task.executionLogs.slice(-5);
}

function userFriendlyExecutionMessage(log: DesktopTaskDetail['executionLogs'][number]) {
  if (log.level === 'error' || /FAILED|ERROR/i.test(log.eventType)) {
    return userFriendlyErrorMessage(log.message);
  }

  return executionEventMessage(log);
}

function userFriendlyErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('timeout') || normalized.includes('aborted due to timeout')) {
    return '模型响应超时，本次任务未完成。你可以稍后重试，或在模型配置中换用响应更快的模型。';
  }

  if (normalized.includes('api key') || normalized.includes('model api key') || normalized.includes('missing key')) {
    return '模型 API Key 未配置或不可用。请先检查模型配置，再重新运行任务。';
  }

  if (normalized.includes('tool input path is required') || normalized.includes('path is required')) {
    return '缺少要读取的文件路径。请重新上传文件，或检查该数字员工的读取文件节点配置。';
  }

  if (normalized.includes('web search endpoint is not configured')) {
    return '网页搜索服务未配置。请到工具页面检查网页搜索能力后再运行。';
  }

  if (normalized.includes('eperm') || normalized.includes('operation not permitted')) {
    return '当前保存位置没有写入权限。请换一个文件夹保存，或检查系统权限。';
  }

  if (normalized.includes('not configured') || normalized.includes('requires') || normalized.includes('missing')) {
    return '运行所需配置不完整。请检查模型、工具或数字员工配置后重试。';
  }

  return '任务执行失败。你可以查看详细日志，确认失败节点和原始错误信息。';
}

function buildTaskLogStats(tasks: DesktopTaskDetail[]) {
  return tasks.reduce(
    (stats, task) => ({
      completed: stats.completed + (task.state === 'completed' ? 1 : 0),
      failed: stats.failed + (task.state === 'failed' ? 1 : 0),
      running: stats.running + (task.state === 'running' ? 1 : 0)
    }),
    { completed: 0, failed: 0, running: 0 }
  );
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
    dependencyManifest: cloneRoleTemplateDependencyManifest(template.dependencyManifest),
    sampleInputs: [...(template.sampleInputs ?? [])],
    outputFormat: template.outputFormat,
    modelProfileIds: [...template.modelProfileIds],
    toolIds: [...template.toolIds],
    requiredKnowledgeSources: [...template.requiredKnowledgeSources],
    defaultTaskTypes: [...template.defaultTaskTypes],
    syncPolicy: template.syncPolicy
  };
}

function toConfiguredRolePackagePreview(
  template: DesktopRoleTemplate,
  installedRolePackage: RolePackageManifest | undefined
): RolePackageManifest {
  const templateRolePackage = toInstalledRolePackage(template);

  return {
    ...templateRolePackage,
    requiredKnowledgeSources:
      installedRolePackage?.requiredKnowledgeSources ?? templateRolePackage.requiredKnowledgeSources
  };
}

function mergeUniqueStrings(left: string[], right: string[]) {
  return [...new Set([...left, ...right])];
}

interface RoleFileContractSummary {
  uploadLabels: string[];
  uploadDetail: string;
  outputLabels: string[];
  outputDetail: string;
}

interface RoleRuntimeReadinessSummary {
  ready: boolean;
  label: string;
  color: string;
  issueText: string;
  missingToolIds: string[];
  disabledToolIds: string[];
}

function buildRoleFileContractSummary(
  rolePackage: Pick<RolePackageManifest, 'workflowGraph' | 'dependencyManifest' | 'outputFormat' | 'toolIds'> & {
    name?: string;
    summary?: string;
  }
): RoleFileContractSummary {
  const inputTypes = new Set<string>();
  const outputTypes = new Set<string>();
  const artifactTypes = new Set<string>();
  const graph = parseWorkflowGraph(rolePackage.workflowGraph);

  for (const variable of rolePackage.dependencyManifest?.variables ?? []) {
    collectRoleInputFormat(inputTypes, variable.key);
    collectRoleInputFormat(inputTypes, variable.valueType);
  }

  for (const modelAsset of rolePackage.dependencyManifest?.modelAssets ?? []) {
    for (const inputType of modelAsset.inputTypes) {
      collectRoleInputFormat(inputTypes, inputType);
    }
    for (const outputType of modelAsset.outputTypes) {
      collectRoleOutputFormat(outputTypes, outputType);
    }
  }

  for (const toolAction of rolePackage.dependencyManifest?.toolActions ?? []) {
    for (const inputType of toolAction.inputTypes) {
      collectRoleInputFormat(inputTypes, inputType);
    }
    for (const outputType of toolAction.outputTypes) {
      collectRoleOutputFormat(outputTypes, outputType);
    }
    if (toolAction.artifactFormat) {
      collectRoleArtifactFormat(artifactTypes, toolAction.artifactFormat);
    }
  }

  for (const artifactTemplate of rolePackage.dependencyManifest?.artifactTemplates ?? []) {
    if (artifactTemplate.artifactType) {
      collectRoleArtifactFormat(artifactTypes, artifactTemplate.artifactType);
    }
  }

  for (const node of graph?.nodes ?? []) {
    for (const inputVariable of node.inputVariables ?? []) {
      collectRoleInputFormat(inputTypes, inputVariable);
    }
    if (node.artifactType) {
      collectRoleArtifactFormat(artifactTypes, node.artifactType);
    }
  }

  collectRoleInputFormat(inputTypes, rolePackage.name);
  collectRoleInputFormat(inputTypes, rolePackage.summary);
  collectRoleFormatsFromText(artifactTypes, rolePackage.outputFormat);

  if (rolePackage.toolIds.includes('office-document')) {
    collectRoleInputFormat(inputTypes, 'document');
  }
  if (rolePackage.toolIds.includes('video-processing')) {
    collectRoleInputFormat(inputTypes, 'video');
  }

  const uploadLabels = sortRoleFormatLabels(
    inputTypes.size > 0 ? [...inputTypes] : ['文本', '附件']
  );
  const outputLabels = sortRoleFormatLabels(
    artifactTypes.size > 0
      ? [...artifactTypes]
      : outputTypes.size > 0
        ? [...outputTypes]
        : ['按工作流配置']
  );

  return {
    uploadLabels,
    uploadDetail: uploadLabels.join(' / '),
    outputLabels,
    outputDetail: outputLabels.join(' / ')
  };
}

function buildRoleRuntimeReadiness(
  state: DesktopRuntimeState,
  rolePackage: RolePackageManifest
): RoleRuntimeReadinessSummary {
  const preparedRolePackage = {
    ...rolePackage,
    modelProfileIds: readRequiredModelProfileIdsForRolePackage(rolePackage)
  };
  const preparedModelProfiles = ensureModelProfilesForRolePackage(
    state.modelProfiles,
    preparedRolePackage
  );
  const modelReadiness = getRoleModelRuntimeRequirementStatuses(
    preparedModelProfiles,
    state.localRuntime.enabledModelProfileIds,
    preparedRolePackage,
    {
      roleCode: preparedRolePackage.roleCode,
      credentials: state.modelCredentials,
      roleBindings: state.roleModelCredentialBindings
    }
  );
  const unreadyModelCount = modelReadiness.filter((requirement) => !requirement.ready).length;
  const knownToolIds = new Set(state.tools.map((tool) => tool.id));
  const enabledToolIds = new Set(state.localRuntime.enabledToolIds);
  const missingToolIds = preparedRolePackage.toolIds.filter((toolId) => !knownToolIds.has(toolId));
  const disabledToolIds = preparedRolePackage.toolIds.filter(
    (toolId) => knownToolIds.has(toolId) && !enabledToolIds.has(toolId)
  );
  const issues = [
    unreadyModelCount > 0 ? `${unreadyModelCount} 个模型未配置` : '',
    missingToolIds.length > 0 ? `缺少工具：${missingToolIds.join('、')}` : '',
    disabledToolIds.length > 0 ? `未启用工具：${disabledToolIds.join('、')}` : ''
  ].filter(Boolean);

  if (issues.length > 0) {
    return {
      ready: false,
      label: unreadyModelCount > 0 ? '待配置' : '缺少工具',
      color: 'orange',
      issueText: issues.join('；'),
      missingToolIds,
      disabledToolIds
    };
  }

  return {
    ready: true,
    label: '可运行',
    color: 'green',
    issueText: '模型和工具已就绪。',
    missingToolIds,
    disabledToolIds
  };
}

function isInstalledRoleTemplateOutdated(
  template: DesktopRoleTemplate,
  installedRolePackage: RolePackageManifest | undefined
) {
  if (!installedRolePackage) {
    return false;
  }

  return (installedRolePackage.templateVersion ?? installedRolePackage.version) !== template.version;
}

function collectRoleInputFormat(target: Set<string>, value: string | undefined) {
  const normalized = normalizeRoleFormatValue(value);
  if (!normalized) {
    return;
  }

  if (includesAny(normalized, ['xlsx', 'xls', 'excel', 'spreadsheet', 'csv', 'table', 'rows', '表格', '清单', '报价', '报销'])) {
    target.add('Excel');
    target.add('CSV');
    target.add('TXT');
    return;
  }

  if (includesAny(normalized, ['docx', 'word', 'pdf', 'txt', 'markdown', 'md', 'document', 'file', 'files', 'attachment', '文档', '合同', '纪要', '笔记'])) {
    target.add('Word');
    target.add('PDF');
    target.add('TXT');
    return;
  }

  if (includesAny(normalized, ['image', 'images', 'png', 'jpg', 'jpeg', '图片', '图像'])) {
    target.add('图片');
    return;
  }

  if (includesAny(normalized, ['video', 'videos', 'mp4', '视频'])) {
    target.add('视频');
    return;
  }

  if (includesAny(normalized, ['audio', 'mp3', 'wav', '录音', '音频'])) {
    target.add('音频');
    return;
  }

  if (includesAny(normalized, ['text', '文本', '聊天记录'])) {
    target.add('文本');
  }
}

function collectRoleOutputFormat(target: Set<string>, value: string | undefined) {
  const normalized = normalizeRoleFormatValue(value);
  if (!normalized) {
    return;
  }

  if (includesAny(normalized, ['json'])) target.add('JSON');
  if (includesAny(normalized, ['text'])) target.add('文本');
  if (includesAny(normalized, ['image', 'png', 'jpg', 'jpeg'])) target.add('图片');
  if (includesAny(normalized, ['video', 'mp4'])) target.add('视频');
  if (includesAny(normalized, ['embedding'])) target.add('Embedding');
  if (includesAny(normalized, ['scores'])) target.add('评分');
}

function collectRoleArtifactFormat(target: Set<string>, value: string | WorkflowGraphArtifactType | undefined) {
  const normalized = normalizeRoleFormatValue(value);
  if (!normalized) {
    return;
  }

  const artifactLabelMap: Record<string, string> = {
    markdown: 'MD',
    md: 'MD',
    docx: 'DOCX',
    xlsx: 'XLSX',
    csv: 'CSV',
    pptx: 'PPTX',
    pdf: 'PDF',
    png: 'PNG',
    jpg: 'JPG',
    jpeg: 'JPG',
    mp4: 'MP4',
    zip: 'ZIP'
  };

  for (const [keyword, label] of Object.entries(artifactLabelMap)) {
    if (normalized.includes(keyword)) {
      target.add(label);
    }
  }
}

function collectRoleFormatsFromText(target: Set<string>, text: string | undefined) {
  const normalized = normalizeRoleFormatValue(text);
  if (!normalized) {
    return;
  }

  collectRoleArtifactFormat(target, normalized);
}

function normalizeRoleFormatValue(value: string | undefined) {
  return value?.trim().toLowerCase().replace(/_/g, '-');
}

function sortRoleFormatLabels(labels: string[]) {
  const order = ['文本', '附件', 'Word', 'PDF', 'TXT', 'Excel', 'CSV', '图片', '视频', '音频', 'DOCX', 'XLSX', 'PPTX', 'MD', 'PDF', 'PNG', 'JPG', 'MP4', 'ZIP', 'JSON', '评分', 'Embedding', '按工作流配置'];
  const orderOf = (label: string) => {
    const index = order.indexOf(label);
    return index >= 0 ? index : order.length;
  };

  return [...new Set(labels)].sort((left, right) => orderOf(left) - orderOf(right) || left.localeCompare(right));
}

function findModelProviderCatalog(
  catalogs: ModelProviderCatalog[],
  providerId: string,
  apiBaseUrl?: string
): ModelProviderCatalog | undefined {
  const normalizedApiBaseUrl = normalizeComparableUrl(apiBaseUrl);
  return catalogs.find(
    (catalog) =>
      catalog.providerId === providerId &&
      (!normalizedApiBaseUrl || normalizeComparableUrl(catalog.apiBaseUrl) === normalizedApiBaseUrl)
  );
}

function upsertModelProviderCatalog(
  catalogs: ModelProviderCatalog[],
  catalog: ModelProviderCatalog
): ModelProviderCatalog[] {
  const normalizedApiBaseUrl = normalizeComparableUrl(catalog.apiBaseUrl);
  const nextCatalog: ModelProviderCatalog = {
    ...catalog,
    models: [...catalog.models].sort((left, right) => left.id.localeCompare(right.id))
  };
  const existing = catalogs.find(
    (item) =>
      item.providerId === catalog.providerId &&
      normalizeComparableUrl(item.apiBaseUrl) === normalizedApiBaseUrl
  );

  return existing
    ? catalogs.map((item) =>
        item.providerId === catalog.providerId &&
        normalizeComparableUrl(item.apiBaseUrl) === normalizedApiBaseUrl
          ? nextCatalog
          : item
      )
    : [...catalogs, nextCatalog];
}

function normalizeComparableUrl(value?: string) {
  return value?.trim().replace(/\/+$/, '').toLowerCase() ?? '';
}

function isPendingModelProviderProfile(profile: ModelProfile): boolean {
  return profile.providerId === 'provider-pending' || profile.providerId === 'provider-local';
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

function isRuntimeRolePackageDeleted(state: DesktopRuntimeState, roleCode: string): boolean {
  return state.runtimeSnapshot.rolePackages.some(
    (summary) => summary.roleCode === roleCode && summary.state === 'deleted'
  );
}

function hasBlockingTaskForRole(state: DesktopRuntimeState, roleCode: string): boolean {
  return getBlockingTasksForRole(state, roleCode).length > 0;
}

function getBlockingTasksForRole(state: DesktopRuntimeState, roleCode: string): DesktopTaskDetail[] {
  return getRuntimeTaskDetails(state).filter(
    (task) =>
      task.roleCode === roleCode &&
      (task.state === 'queued' || task.state === 'running' || task.state === 'waiting_approval')
  );
}

function uninstallRolePackageFromRuntimeState(
  state: DesktopRuntimeState,
  roleCode: string
): DesktopRuntimeState {
  if (!state.rolePackages.some((rolePackage) => rolePackage.roleCode === roleCode)) {
    return state;
  }

  const rolePackages = state.rolePackages.filter((rolePackage) => rolePackage.roleCode !== roleCode);
  const deletedRoleCodes = new Set(
    state.runtimeSnapshot.rolePackages
      .filter((summary) => summary.state === 'deleted')
      .map((summary) => summary.roleCode)
  );
  const activeRoleIsAvailable =
    Boolean(state.localRuntime.activeRoleCode) &&
    rolePackages.some(
      (rolePackage) =>
        rolePackage.roleCode === state.localRuntime.activeRoleCode &&
        !deletedRoleCodes.has(rolePackage.roleCode)
    );
  const activeRoleCode = activeRoleIsAvailable
    ? state.localRuntime.activeRoleCode
    : rolePackages.find((rolePackage) => !deletedRoleCodes.has(rolePackage.roleCode))?.roleCode;
  const rolePackageSummaries = rebuildRoleSummaries(
    rolePackages,
    state.runtimeSnapshot.tasks,
    state.runtimeSnapshot.rolePackages,
    activeRoleCode
  ).map((summary) =>
    deletedRoleCodes.has(summary.roleCode)
      ? {
          ...summary,
          state: 'deleted' as const
        }
      : summary
  );

  return {
    ...state,
    rolePackages,
    roleModelCredentialBindings: state.roleModelCredentialBindings.filter(
      (binding) => binding.roleCode !== roleCode
    ),
    localRuntime: {
      ...state.localRuntime,
      installedRoleCodes: rolePackages.map((rolePackage) => rolePackage.roleCode),
      activeRoleCode
    },
    runtimeSnapshot: {
      ...state.runtimeSnapshot,
      rolePackages: rolePackageSummaries
    }
  };
}

function isRolePackageTemplateDeleted(
  rolePackage: RolePackageManifest,
  deletedTemplateIds: Set<string>
): boolean {
  return Boolean(rolePackage.templateId && deletedTemplateIds.has(rolePackage.templateId));
}

function pruneUnauthorizedRolePackages(
  state: DesktopRuntimeState,
  authorizedTemplates: DesktopRoleTemplate[],
  deletedTemplateIds: string[] = []
): DesktopRuntimeState {
  const authorizedRoleCodes = new Set(authorizedTemplates.map((template) => template.roleCode));
  const deletedTemplateIdSet = new Set(deletedTemplateIds);
  const rolePackages = state.rolePackages.filter((rolePackage) =>
    authorizedRoleCodes.has(rolePackage.roleCode) ||
    isRolePackageTemplateDeleted(rolePackage, deletedTemplateIdSet)
  );
  const deletedRoleCodes = new Set(
    rolePackages
      .filter((rolePackage) => isRolePackageTemplateDeleted(rolePackage, deletedTemplateIdSet))
      .map((rolePackage) => rolePackage.roleCode)
  );
  const activeRoleIsAvailable =
    Boolean(state.localRuntime.activeRoleCode) &&
    rolePackages.some(
      (rolePackage) =>
        rolePackage.roleCode === state.localRuntime.activeRoleCode &&
        !deletedRoleCodes.has(rolePackage.roleCode)
    );

  if (
    rolePackages.length === state.rolePackages.length &&
    deletedRoleCodes.size === 0 &&
    (!state.localRuntime.activeRoleCode || activeRoleIsAvailable)
  ) {
    return state;
  }

  const activeRoleCode =
    state.localRuntime.activeRoleCode && activeRoleIsAvailable
      ? state.localRuntime.activeRoleCode
      : rolePackages.find((rolePackage) => !deletedRoleCodes.has(rolePackage.roleCode))?.roleCode;
  const rolePackageSummaries = rebuildRoleSummaries(
    rolePackages,
    state.runtimeSnapshot.tasks,
    state.runtimeSnapshot.rolePackages,
    activeRoleCode
  ).map((summary) =>
    deletedRoleCodes.has(summary.roleCode)
      ? {
          ...summary,
          state: 'deleted' as const
        }
      : summary
  );

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
      rolePackages: rolePackageSummaries
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

function buildRoleModelCredentialFormValues(
  roleCode: string,
  modelProfileIds: string[],
  bindings: RoleModelCredentialBinding[]
): NonNullable<RoleConfigFormValues['modelCredentialBindings']> {
  const bindingsByModelId = new Map(
    bindings
      .filter((binding) => binding.roleCode === roleCode)
      .map((binding) => [binding.modelProfileId, binding])
  );

  return Object.fromEntries(
    modelProfileIds.map((modelProfileId) => {
      const binding = bindingsByModelId.get(modelProfileId);
      return [
        modelProfileId,
        {
          mode: binding?.mode ?? 'provider_default',
          credentialId: binding?.credentialId,
          apiBaseUrl: binding?.apiBaseUrl,
          apiKey: binding?.apiKey
        } satisfies RoleModelCredentialFormValue
      ];
    })
  );
}

function buildRoleModelCredentialBindingsFromForm(
  roleCode: string,
  modelProfileIds: string[],
  values: RoleConfigFormValues['modelCredentialBindings'] | undefined
): RoleModelCredentialBinding[] {
  const now = new Date().toISOString();

  return modelProfileIds.map((modelProfileId) => {
    const value = values?.[modelProfileId];
    const mode = value?.mode ?? 'provider_default';

    if (mode === 'credential_ref' && value?.credentialId) {
      return {
        roleCode,
        modelProfileId,
        mode,
        credentialId: value.credentialId,
        updatedAt: now
      };
    }

    if (mode === 'inline' && value?.apiKey?.trim()) {
      return {
        roleCode,
        modelProfileId,
        mode,
        apiBaseUrl: value.apiBaseUrl?.trim() || undefined,
        apiKey: value.apiKey.trim(),
        updatedAt: now
      };
    }

    return {
      roleCode,
      modelProfileId,
      mode: 'provider_default',
      updatedAt: now
    };
  });
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
      previous && previous.state === 'deleted'
      ? 'deleted'
      : previous && (previous.state === 'paused' || previous.state === 'error')
      ? previous.state
      : 'installed';

    return {
      roleCode: rolePackage.roleCode,
      version: rolePackage.version,
      state: preservedState === 'deleted'
        ? 'deleted'
        : rolePackage.roleCode === activeRoleCode
          ? 'running'
          : preservedState,
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

function renderModelRequirementStatusLabel(issue: RoleModelRuntimeIssue | undefined): string {
  if (!issue) {
    return '已就绪';
  }

  const labels: Record<RoleModelRuntimeIssue, string> = {
    missing: '待创建',
    disabled: '未启用',
    unconfigured: '待填 Key'
  };

  return labels[issue];
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

function logLevelLabel(level: DesktopTaskDetail['executionLogs'][number]['level']) {
  if (level === 'error') {
    return '错误';
  }

  if (level === 'warning') {
    return '警告';
  }

  return '信息';
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
