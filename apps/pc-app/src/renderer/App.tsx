import {
  ApiOutlined,
  AppstoreOutlined,
  BankOutlined,
  BorderOutlined,
  CloudDownloadOutlined,
  CloudSyncOutlined,
  CloseOutlined,
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
  MessageOutlined,
  ToolOutlined,
  VideoCameraOutlined
} from '@ant-design/icons';
import { qiuAntTheme } from '@qiuai/design-tokens';
import AppProvider from 'antd/es/app';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Checkbox from 'antd/es/checkbox';
import ConfigProvider from 'antd/es/config-provider';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
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
import Popconfirm from 'antd/es/popconfirm';
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
  DesktopAgreementStatus,
  DesktopAuthorizedRoleTemplateCatalog,
  DesktopAuthorizedRoleTemplateSummary,
  DesktopBackupSummary,
  DesktopDeviceCapacitySummary,
  DesktopIssueCategory,
  DesktopIssueReportSubmitRequest,
  DesktopIssueSeverity,
  DesktopModelTestResponse,
  DesktopRoleWatchApprovalMode,
  DesktopRoleWatchConfig,
  DesktopRoleWatchRun,
  DesktopRuntimeState,
  DesktopUpdateCheckResult,
  DesktopWindowControlAction
} from '../shared/desktop-api';
import type {
  DesktopRolePackageState,
  DesktopTaskState,
  DesktopTaskDetail,
  DesktopTaskSummary,
  FactoryArtifactPreview,
  FactoryArtifactPreviewItem,
  FactoryOutputItem,
  FactoryOutputItemStatus,
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
  inferModelCapabilitiesFromName,
  modelCapabilityOptions,
  modelCapabilityLabel,
  modelCapabilitySummary,
  modelProfileSupportsRequiredCapabilities,
  normalizeModelCapabilities,
  purposeForModelCapabilities,
  readModelProfileCapabilities
} from '../shared/desktop-model-capabilities';
import type { RoleTemplateCatalogEntry } from '@qiuai/domain';
import { createDesktopRuntimePreviewState } from '../shared/desktop-state';
import {
  enterpriseKnowledgeBindingId,
  knowledgeBindingIdFromSource,
  knowledgeBindingSourceFromId,
  localPdfKnowledgeBindingId,
  normalizeKnowledgeBindingId
} from '../shared/knowledge-bindings';
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
  createCustomCompatibleModelProfile,
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
import {
  qiuaiUserAgreementDocument,
  qiuaiUserAgreementRequiredReadSeconds,
  type DesktopLegalDocument
} from '../shared/desktop-agreements';
import aliyunBailianLogoUrl from './assets/model-providers/bailian-color.svg';
import deepseekLogoUrl from './assets/model-providers/deepseek-color.svg';
import geminiLogoUrl from './assets/model-providers/gemini-color.svg';
import kimiLogoUrl from './assets/model-providers/kimi-color.svg';
import minimaxLogoUrl from './assets/model-providers/minimax-color.svg';
import ollamaLogoUrl from './assets/model-providers/ollama.svg';
import openaiLogoUrl from './assets/model-providers/openai.svg';
import openrouterLogoUrl from './assets/model-providers/openrouter-color.svg';
import qwenLogoUrl from './assets/model-providers/qwen-color.svg';
import siliconcloudLogoUrl from './assets/model-providers/siliconcloud-color.svg';
import tencentcloudLogoUrl from './assets/model-providers/tencentcloud-color.svg';
import volcengineLogoUrl from './assets/model-providers/volcengine-color.svg';
import zhipuLogoUrl from './assets/model-providers/zhipu-color.svg';

type SectionKey = 'workbench' | 'factories' | 'roles' | 'logs' | 'models' | 'tools' | 'knowledge' | 'settings';
type AccountModalKey = 'enterprise' | 'help' | 'release' | 'download' | 'logout';
type DesktopThemePreference = 'light' | 'system';
type DesktopDensityPreference = 'comfortable' | 'compact';
type ProviderModelCapabilityFilter = 'all' | ModelCapability;
type ProviderModelCatalogEntry = ModelProviderCatalog['models'][number];

interface DesktopClientPreferences {
  theme: DesktopThemePreference;
  density: DesktopDensityPreference;
  startupSection: SectionKey;
}

type DesktopRoleTemplate = RoleTemplateCatalogEntry & {
  dependencyManifest?: RoleTemplateDependencyManifest;
  executionProfile?: RoleTemplateDependencyManifest['executionProfile'];
};
type DesktopRoleExecutionProfile = NonNullable<RoleTemplateDependencyManifest['executionProfile']>;

interface TaskFormValues {
  roleCode: string;
  title: string;
  input?: string;
}

type RoleApplicationType = 'digital_employee' | 'digital_factory';

interface FactoryRunFormValues {
  roleCode: string;
  platform?: string;
  packageKeys?: string[];
  packageDefinitions?: FactoryRunPackageDefinition[];
  qualityCheckMode?: 'none' | 'basic' | 'smart';
  asrModelProfileId?: string;
  dialect?: string;
  screeningProfileKey?: string;
  editEnabled?: boolean;
  editTargetSeconds?: number;
  promptLanguage?: string;
  promptStyle?: string;
  promptGoal?: string;
  promptMustKeep?: string;
  promptAvoid?: string;
  instruction?: string;
}

interface FactoryRunPackageDefinition {
  key: string;
  label: string;
  description?: string;
  outputType?: string;
  defaultSelected?: boolean;
  custom?: boolean;
}

type FactoryVideoScreeningOperator = '>=' | '<=' | '>' | '<' | 'equals' | 'notEquals' | 'between';
type FactoryVideoScreeningMetricType = 'number' | 'boolean';

interface FactoryVideoScreeningRuleDefinition {
  metric: string;
  operator: FactoryVideoScreeningOperator;
  value: unknown;
  failReason: string;
}

interface FactoryVideoScreeningGateDefinition {
  id: string;
  name: string;
  description?: string;
  rules: FactoryVideoScreeningRuleDefinition[];
}

interface FactoryRunScreeningProfileDefinition {
  key: string;
  label: string;
  description?: string;
  defaultSelected?: boolean;
  gates: FactoryVideoScreeningGateDefinition[];
  custom?: boolean;
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
  runtimeModelProfileId?: string;
  mode?: ModelCredentialBindingMode;
  credentialId?: string;
  apiBaseUrl?: string;
  apiKey?: string;
}

interface RuntimeModelQuickSwitchFormValues {
  runtimeModels?: Record<string, string | undefined>;
}

interface WatchConfigFormValues {
  enabled?: boolean;
  sourceUrls?: string;
  intervalMinutes?: number;
  rules?: string;
  approvalMode?: DesktopRoleWatchApprovalMode;
}

interface ToolSettingsFormValues {
  webSearchEndpoint?: string;
  webSearchApiKey?: string;
  allowPrivateNetwork?: boolean;
}

interface IssueFeedbackFormValues {
  category: DesktopIssueCategory;
  severity: DesktopIssueSeverity;
  title: string;
  description: string;
  contact?: string;
}

interface KnowledgeBindingCatalogEntry {
  source: KnowledgeBindingSource;
  bindingId: string;
  label: string;
  description: string;
}

interface AccountHelpSection {
  title: string;
  items: Array<{
    question: string;
    answer: string;
  }>;
}

const sectionItems: Array<{ key: SectionKey; icon: ReactNode; label: string }> = [
  { key: 'workbench', icon: <MessageOutlined />, label: '数字员工' },
  { key: 'factories', icon: <BankOutlined />, label: '数字工厂' },
  { key: 'roles', icon: <AppstoreOutlined />, label: '数字市场' },
  { key: 'logs', icon: <FileTextOutlined />, label: '日志' },
  { key: 'models', icon: <ApiOutlined />, label: '模型' },
  { key: 'tools', icon: <ToolOutlined />, label: '工具' },
  { key: 'knowledge', icon: <DatabaseOutlined />, label: '知识库' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' }
];

const desktopClientPreferenceStorageKey = 'qiuai.pc.client.preferences.v1';
const factoryPackagePresetStorageKey = 'qiuai.pc.factory.package.presets.v1';
const factoryScreeningProfileStorageKey = 'qiuai.pc.factory.screening.profiles.v1';
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

const issueFeedbackCategoryOptions: Array<{ value: DesktopIssueCategory; label: string }> = [
  { value: 'BUG', label: 'Bug/报错' },
  { value: 'USAGE', label: '使用问题' },
  { value: 'FEATURE_REQUEST', label: '功能建议' },
  { value: 'BAD_OUTPUT', label: '结果不好' },
  { value: 'OTHER', label: '其他' }
];

const issueFeedbackSeverityOptions: Array<{ value: DesktopIssueSeverity; label: string }> = [
  { value: 'NORMAL', label: '普通' },
  { value: 'IMPACTING', label: '影响工作' },
  { value: 'BLOCKING', label: '阻塞使用' }
];

const watchApprovalModeOptions: Array<{ value: DesktopRoleWatchApprovalMode; label: string; description: string }> = [
  { value: 'readonly', label: '只读分析', description: '自动采集、分析并生成结果，不回填外部网页。' },
  { value: 'draft', label: '生成草稿', description: '允许生成回复、邀约或跟进草稿，但不自动提交。' },
  { value: 'manual_submit', label: '人工确认提交', description: '关键对外动作进入人工确认，确认后再由用户执行。' }
];

const factoryVideoScreeningMetricOptions: Array<{
  key: string;
  label: string;
  description: string;
  type: FactoryVideoScreeningMetricType;
  defaultOperator: FactoryVideoScreeningOperator;
  defaultValue: unknown;
  defaultFailReason: string;
}> = [
  {
    key: 'portraitRatio',
    label: '视频方向：横屏',
    description: '横屏视频的画面高宽比通常小于 1。',
    type: 'number',
    defaultOperator: '<',
    defaultValue: 1,
    defaultFailReason: '视频为竖屏或非横屏比例，不符合横屏要求'
  },
  {
    key: 'durationSeconds',
    label: '视频时长',
    description: '视频必须达到指定秒数后才进入后续流程。',
    type: 'number',
    defaultOperator: '>=',
    defaultValue: 20,
    defaultFailReason: '视频时长小于 20 秒'
  },
  {
    key: 'hasAudio',
    label: '必须有音轨',
    description: '视频需要包含可识别音轨，才能执行语音转文字。',
    type: 'boolean',
    defaultOperator: 'equals',
    defaultValue: true,
    defaultFailReason: '视频缺少可识别音轨'
  },
  {
    key: 'transcriptChars',
    label: '转写文本长度',
    description: 'ASR 转写后的文字越多，越容易判断表达质量。',
    type: 'number',
    defaultOperator: '>=',
    defaultValue: 80,
    defaultFailReason: '识别文本过短，说话内容不足'
  },
  {
    key: 'unclearTokenRatio',
    label: '语音不清晰比例',
    description: '数值越高代表转写中“听不清、无法识别”等内容越多。',
    type: 'number',
    defaultOperator: '<=',
    defaultValue: 0.25,
    defaultFailReason: '语音含糊或识别失败比例过高'
  },
  {
    key: 'beforeAfterCompleteness',
    label: '内容完整度',
    description: '按 0-1 判断使用前、使用后改善表达是否完整。',
    type: 'number',
    defaultOperator: '>=',
    defaultValue: 0.6,
    defaultFailReason: '使用前/使用后改善表述较简略，建议人工确认是否可用'
  }
];

const factoryVideoScreeningOperatorOptions: Array<{ value: FactoryVideoScreeningOperator; label: string }> = [
  { value: '>=', label: '大于等于' },
  { value: '<=', label: '小于等于' },
  { value: '>', label: '大于' },
  { value: '<', label: '小于' },
  { value: 'equals', label: '等于' },
  { value: 'notEquals', label: '不等于' },
  { value: 'between', label: '介于' }
];

const knowledgeBindingCatalog: KnowledgeBindingCatalogEntry[] = [
  {
    source: 'local_file',
    bindingId: localPdfKnowledgeBindingId,
    label: '本地 PDF 知识库',
    description: '只保留一份启用中的本地完整 PDF，作为本机知识库资产。'
  },
  {
    source: 'workspace_library',
    bindingId: enterpriseKnowledgeBindingId,
    label: '企业知识库',
    description: '同步 web-console 中启用的企业基础信息和企业知识 PDF。'
  }
];

const knowledgeBindingCatalogByBindingId = new Map(
  knowledgeBindingCatalog.map((entry) => [entry.bindingId, entry] as const)
);

const providerModelCapabilityFilters: Array<{
  value: ProviderModelCapabilityFilter;
  label: string;
}> = [
  { value: 'all', label: '全部' },
  { value: 'text', label: '文本模型' },
  { value: 'reasoning_text', label: '推理模型' },
  { value: 'long_context', label: '长文档模型' },
  { value: 'image_understanding', label: '图片理解' },
  { value: 'text_to_image', label: '生图' },
  { value: 'image_to_image', label: '参考图编辑' },
  { value: 'video_understanding', label: '视频理解' },
  { value: 'video_generation', label: '生视频' },
  { value: 'audio_to_text', label: '语音转文字' },
  { value: 'embedding', label: 'Embedding' },
  { value: 'rerank', label: 'Rerank' }
];

const accountHelpSections: AccountHelpSection[] = [
  {
    title: '快速开始',
    items: [
      {
        question: '首次打开为什么是免费版？',
        answer: 'PC 客户端安装后默认进入免费版，可以安装公开免费的数字员工。输入企业绑定码后，才会接入企业授权、企业数字员工和企业知识库。'
      },
      {
        question: '怎么绑定企业？',
        answer: '点击左侧或设置里的“绑定企业”，输入 web-console 生成的绑定码。绑定成功后客户端会自动同步企业授权和可安装数字员工。'
      },
      {
        question: '退出登录是什么意思？',
        answer: '退出登录等同于解绑当前设备。解绑后保留本机历史任务、模型配置和产物文件，但不再同步企业数字员工和企业授权。'
      }
    ]
  },
  {
    title: '模型与 API Key',
    items: [
      {
        question: '模型应该在哪里配置？',
        answer: '进入左侧“模型”，按供应商填写默认 API Key。安装数字员工后，也可以在该数字员工的配置里选择使用默认 Key，或单独填写一个专用 Key。'
      },
      {
        question: '为什么模型测试失败？',
        answer: '常见原因包括 API Key 填错、账户余额不足、模型名不在该 Key 权限内、网络无法访问供应商接口，或接口地址不是兼容的 OpenAI 格式。'
      },
      {
        question: '一个供应商多个模型能共用 Key 吗？',
        answer: '可以。推荐先在模型页配置供应商默认 Key，再通过“拉取模型”确认该 Key 支持哪些模型；特殊数字员工再单独覆盖。'
      }
    ]
  },
  {
    title: '数字员工',
    items: [
      {
        question: '为什么看不到某个数字员工？',
        answer: '请先刷新数字市场。如果仍看不到，通常是该模板未上架、权限套餐不包含当前账号、企业白名单限制，或服务端已删除该模板。'
      },
      {
        question: '数字员工安装后为什么还不能运行？',
        answer: '请打开数字员工配置，检查所需模型、工具和知识库是否就绪。只有 API Key 等隐私配置需要你本机填写，其他工具能力应由服务端模板定义。'
      },
      {
        question: '卸载数字员工会删除历史结果吗？',
        answer: '不会。卸载只移除当前电脑上的数字员工，历史任务和已生成产物仍保留；以后可以重新安装。'
      }
    ]
  },
  {
    title: '文件与产物',
    items: [
      {
        question: '怎么把文件交给数字员工？',
        answer: '在对话输入框拖入文件，或点击附件按钮选择文件，再输入任务要求。支持类型取决于该数字员工的输入合约和已安装工具。'
      },
      {
        question: '为什么文件读取失败？',
        answer: '常见原因是文件路径未暴露、文件被其他软件占用、格式不受当前工具支持、文件过大，或数字员工模板没有接入对应读取工具。'
      },
      {
        question: '结果文件保存在哪里？',
        answer: '产物会先保存到本机缓存目录，聊天里显示文件图标和下载按钮。点击下载按钮可以另存到你选择的本地文件夹；默认缓存会定期清理。'
      }
    ]
  },
  {
    title: '工具与运行环境',
    items: [
      {
        question: '网页搜索不可用怎么办？',
        answer: '确认该数字员工模板已接入网页搜索工具，并且工具中心已启用对应工具。企业部署时建议由管理员在服务端配置好可用的搜索接口。'
      },
      {
        question: 'Office 文档能力包括什么？',
        answer: 'Office 能力按具体工具拆分，例如读取文档、生成 Word、生成 Excel、处理 Markdown 等。数字员工最终能输出什么，由工作画布里的产物节点决定。'
      },
      {
        question: '视频任务为什么提示缺少 FFmpeg？',
        answer: '视频剪辑、转码、截帧等能力依赖 FFmpeg。缺少时可以先完成视频理解类任务，但无法稳定生成剪辑产物。'
      }
    ]
  },
  {
    title: '故障排查',
    items: [
      {
        question: '任务失败后先看哪里？',
        answer: '进入左侧“日志”，找到对应任务。日志会记录每个节点做了什么、用了哪个模型或工具、在哪里失败。'
      },
      {
        question: '保存文件提示权限不足怎么办？',
        answer: '不要直接保存到磁盘根目录或受系统保护的目录，建议选择桌面、文档或你有写入权限的文件夹。'
      },
      {
        question: '客户端没有同步最新配置怎么办？',
        answer: '先点击刷新或同步；如果仍未变化，检查服务端连接状态、企业绑定状态，以及管理后台模板是否已经上架。'
      }
    ]
  }
];

const accountLegalDocuments: DesktopLegalDocument[] = [
  qiuaiUserAgreementDocument,
  {
    id: 'privacy-policy',
    title: '隐私政策',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明个人信息和设备信息的收集、使用、保存、共享、删除及用户权利。',
    legalBasis: ['《中华人民共和国个人信息保护法》', '《中华人民共和国网络安全法》'],
    sections: [
      {
        title: '信息收集范围',
        paragraphs: [
          '为提供软件运行、设备授权、模型配置、任务执行、错误排查和版本更新服务，软件可能处理设备 ID、运行 ID、客户端版本、连接状态、任务日志、模型配置状态等必要信息。',
          'API Key、业务文件、产物文件和本地知识库属于敏感业务数据。除完成用户主动发起的任务或同步企业授权所需外，软件不应主动上传无关内容。'
        ]
      },
      {
        title: '信息使用目的',
        paragraphs: [
          '相关信息仅用于账号授权、设备识别、任务执行、产物生成、日志排查、服务安全、版本更新和用户明确授权的业务处理。',
          '平台不得将用户业务数据用于与服务无关的广告投放、画像交易或未经授权的第三方训练。'
        ]
      },
      {
        title: '用户权利',
        paragraphs: [
          '用户有权根据适用法律法规要求查询、更正、删除相关个人信息或撤回授权。企业用户可通过内部管理员统一管理企业设备和授权。',
          '用户可通过解绑设备停止企业授权同步；本地历史任务和产物是否删除，由用户在本机自行管理。'
        ]
      }
    ]
  },
  {
    id: 'data-security',
    title: '企业数据与本地文件处理说明',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明本地文件、知识库、任务产物和企业资料的处理边界。',
    legalBasis: ['《中华人民共和国数据安全法》', '《网络数据安全管理条例》'],
    sections: [
      {
        title: '本地优先原则',
        paragraphs: [
          'PC 客户端处理文件时应优先传递文件路径、摘要或必要片段，避免在不必要的情况下传输大体积原始文件。',
          '涉及模型调用或工具调用时，系统会根据数字员工模板和用户任务需要读取必要内容；用户应自行判断资料是否适合交由第三方模型或工具处理。'
        ]
      },
      {
        title: '企业知识库',
        paragraphs: [
          '企业数字员工可结合企业知识库执行任务。企业应确保知识库内容来源合法、权限清晰、分类准确，并定期删除过期或不应继续使用的资料。',
          '当企业账号到期、设备解绑或授权被撤销时，客户端应停止继续同步受限企业能力。'
        ]
      },
      {
        title: '产物缓存',
        paragraphs: [
          '任务产物会保存到本机缓存目录，便于用户查看和另存。默认缓存用于提升使用便利性，不等同于长期归档。',
          '含有商业秘密、个人信息或重要合同资料的产物，用户应按企业制度及时归档、加密或删除。'
        ]
      }
    ]
  },
  {
    id: 'ai-content',
    title: 'AI 生成内容使用声明',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '明确 AI 输出属于辅助结果，需人工复核，不得直接替代专业判断。',
    legalBasis: ['《生成式人工智能服务管理暂行办法》', '《人工智能生成合成内容标识办法》'],
    sections: [
      {
        title: '辅助办公定位',
        paragraphs: [
          '数字员工输出用于辅助办公、资料整理、文本生成、信息提取、流程建议和工具调用，不保证绝对准确、完整或适合全部业务场景。',
          '涉及法律、医疗、金融、投资、人事处分、安全生产、重大合同等高风险事项时，必须由具备资质或职责权限的人员复核。'
        ]
      },
      {
        title: '内容责任',
        paragraphs: [
          '用户应对其输入内容、配置的模型、选择的工具、发布或使用的最终产物承担相应责任。',
          '用户不得利用 AI 生成虚假信息、侵权内容、欺诈材料、违法广告、恶意代码、违法音视频或其他违反法律法规和公序良俗的内容。'
        ]
      },
      {
        title: '标识与披露',
        paragraphs: [
          '当法律法规、平台规则、客户合同或企业制度要求披露 AI 参与生成时，用户应主动进行必要标识或说明。',
          '平台可在后续版本中对特定类型产物加入生成标识、来源记录或审计提示。'
        ]
      }
    ]
  },
  {
    id: 'usage-boundary',
    title: '服务使用边界与免责声明',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '明确禁止用途、风险场景、第三方服务异常和不可抗力责任边界。',
    legalBasis: ['《中华人民共和国网络安全法》', '《中华人民共和国数据安全法》'],
    sections: [
      {
        title: '禁止用途',
        paragraphs: [
          '不得使用本软件实施违法违规活动，包括但不限于侵犯个人隐私、侵犯知识产权、规避安全控制、攻击系统、非法采集数据、生成欺诈材料或传播违法有害信息。',
          '不得将本软件用于未经授权的监控、自动化骚扰、账号批量注册、绕过平台限制、恶意营销或其他损害第三方权益的行为。'
        ]
      },
      {
        title: '风险提示',
        paragraphs: [
          'AI 模型可能出现事实错误、遗漏、格式不稳定、理解偏差或幻觉。用户应结合业务场景进行验收和复核。',
          '第三方模型、搜索服务、Office 工具、视频工具或网络环境异常，可能导致任务失败、超时、结果不完整或产物格式变化。'
        ]
      },
      {
        title: '责任边界',
        paragraphs: [
          '在法律允许范围内，因用户违法使用、错误配置、未复核 AI 输出、第三方服务不可用、网络故障或不可抗力造成的损失，平台不承担超出法定范围的责任。',
          '如平台故意或重大过失导致用户权益受损，应依法承担相应责任。'
        ]
      }
    ]
  },
  {
    id: 'third-party',
    title: '第三方模型与工具服务声明',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明用户自配 API Key、第三方模型供应商和外部工具的责任分界。',
    legalBasis: ['《中华人民共和国民法典》', '《中华人民共和国个人信息保护法》'],
    sections: [
      {
        title: '第三方模型',
        paragraphs: [
          '用户在 PC 客户端配置的 API Key 可能对应 DeepSeek、OpenAI、通义千问、Kimi、智谱、MiniMax、火山方舟或其他模型服务商。',
          '用户应自行阅读并遵守第三方模型服务商的服务条款、隐私政策、数据处理规则、计费规则和地区合规要求。'
        ]
      },
      {
        title: '第三方工具',
        paragraphs: [
          '网页搜索、Office 处理、OCR、视频处理、MCP 工具或其他外部能力可能由本地程序、企业服务或第三方接口提供。',
          '当数字员工调用第三方服务时，可能产生额外费用、网络请求、日志记录或数据处理行为。用户应确认相关工具适合当前业务资料。'
        ]
      },
      {
        title: '密钥管理',
        paragraphs: [
          '用户应妥善保存 API Key，不得将密钥公开、共享给无关人员或提交到不可信环境。',
          '如发现密钥泄露，应立即到对应服务商控制台禁用或轮换密钥，并检查异常调用和账单。'
        ]
      }
    ]
  },
  {
    id: 'paid-license',
    title: '付费服务与授权规则',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明套餐权限、设备授权、续费到期和免费版降级规则。',
    legalBasis: ['《中华人民共和国民法典》', '《中华人民共和国消费者权益保护法》'],
    sections: [
      {
        title: '套餐授权',
        paragraphs: [
          '企业套餐对应不同数字员工、工具能力、设备数量、服务范围和支持等级。具体以购买页面、订单、合同或管理后台展示为准。',
          '数字员工模板可按套餐、白名单或企业授权控制安装范围。白名单设置优先级高于普通套餐范围。'
        ]
      },
      {
        title: '续费与降级',
        paragraphs: [
          '企业账号未续费或授权到期后，对应企业授权设备应降级为免费版，仅保留免费能力和本地历史数据访问能力。',
          '降级不会主动删除本地产物，但会停止同步企业专属数字员工、企业知识库和付费工具权限。'
        ]
      },
      {
        title: '费用与退款',
        paragraphs: [
          '具体价格、计费周期、开票、退款和服务支持，以用户购买页面、订单、合同或双方书面约定为准。',
          '第三方模型和工具产生的费用，通常由用户与第三方服务商直接结算，除非合同另有约定。'
        ]
      }
    ]
  },
  {
    id: 'software-update',
    title: '软件许可与更新维护规则',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明客户端版本更新、安装包下载、强制更新和维护责任。',
    legalBasis: ['《中华人民共和国网络安全法》', '《中华人民共和国民法典》'],
    sections: [
      {
        title: '软件许可',
        paragraphs: [
          '用户获得的是在授权范围内安装和使用 QiuAI WorkOS 的非独占、不可转让、不可再许可的软件使用权。',
          '未经书面许可，用户不得反向工程、破解、复制授权机制、移除版权标识或将软件用于超出授权范围的商业分发。'
        ]
      },
      {
        title: '版本更新',
        paragraphs: [
          '客户端可通过“版本与更新”检查管理后台发布的最新安装包。更新可能包含功能改进、稳定性修复、安全修复和兼容性调整。',
          '当旧版本存在安全风险或协议不兼容时，平台可设置强制更新。用户应及时安装新版，以免影响服务可用性。'
        ]
      },
      {
        title: '维护边界',
        paragraphs: [
          '平台负责维护自身软件、服务端接口和已发布数字员工模板的可用性。第三方模型、用户电脑环境、系统权限和本地文件损坏不属于平台完全可控范围。',
          '用户应保持操作系统、依赖工具、网络环境和安全软件配置处于可用状态。'
        ]
      }
    ]
  },
  {
    id: 'ip-rights',
    title: '知识产权与内容权属声明',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明软件、模板、用户输入、企业资料和生成产物的权属边界。',
    legalBasis: ['《中华人民共和国著作权法》', '《中华人民共和国民法典》'],
    sections: [
      {
        title: '软件与模板',
        paragraphs: [
          'QiuAI WorkOS 的软件代码、界面设计、数字员工模板、工作流编排、文档和品牌标识受知识产权相关法律保护。',
          '用户不得未经授权复制、出售、出租、改编、反向工程或以其他方式侵犯平台知识产权。'
        ]
      },
      {
        title: '用户内容',
        paragraphs: [
          '用户对其合法拥有或依法获得授权的输入资料、企业知识库、业务文件和人工确认后的最终产物享有相应权利。',
          '用户应确保输入内容不侵犯第三方著作权、商标权、商业秘密、肖像权、名誉权、隐私权或其他合法权益。'
        ]
      },
      {
        title: '生成产物',
        paragraphs: [
          'AI 生成产物的可使用范围可能受输入资料、第三方模型条款、素材来源和适用法律影响。用户在对外发布或商业使用前应自行审查。',
          '平台不保证任何生成产物天然满足商用、注册、审查、备案或对外承诺条件。'
        ]
      }
    ]
  },
  {
    id: 'open-source',
    title: '开源软件与第三方组件声明',
    version: 'v1.0',
    effectiveDate: '2026-07-29',
    summary: '说明 Electron、React、Ant Design 等第三方组件的许可边界。',
    legalBasis: ['开源软件许可证', '第三方组件许可文件'],
    sections: [
      {
        title: '第三方组件',
        paragraphs: [
          '本软件可能使用 Electron、React、Ant Design、Vite、Prisma、sql.js、JSZip 等开源或第三方组件。',
          '第三方组件分别适用其自身许可证。平台会尽合理努力遵守相关许可要求，并在必要时提供许可证信息。'
        ]
      },
      {
        title: '组件责任',
        paragraphs: [
          '第三方组件按其许可证和维护状态提供。组件漏洞、安全更新或兼容性变化可能影响软件运行。',
          '平台会根据产品维护计划评估并升级关键依赖，但不对第三方组件作出超出其许可证范围的承诺。'
        ]
      },
      {
        title: '商用注意',
        paragraphs: [
          '企业在二次分发、私有化改造或深度集成时，应额外核查第三方组件许可证、模型服务条款和企业内部合规要求。',
          '如客户合同对开源软件披露、供应链安全或漏洞修复周期有特别要求，应在签约或交付前单独约定。'
        ]
      }
    ]
  }
];

const knowledgeBindingOptions = [
  { id: 'kb-local-folder', label: '本地文件夹' },
  { id: 'kb-local-file', label: '本地文件' },
  { id: 'kb-workspace-library', label: '工作区知识库' },
  { id: 'kb-server-summary', label: '服务端摘要' }
];

const modelProviderPresets: ModelProviderPreset[] = [
  {
    id: 'tencent-cloud',
    name: '腾讯云',
    summary: '腾讯云平台接口，当前优先接入语音识别，适合普通话、粤语、上海话、四川/重庆口音和中文医疗场景。',
    apiBaseUrl: 'https://asr.tencentcloudapi.com?region=ap-shanghai',
    models: [
      {
        label: '16k_zh / 中文普通话',
        modelName: '16k_zh',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      },
      {
        label: '16k_zh_en_2.0 / 中英及多方言',
        modelName: '16k_zh_en_2.0',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      },
      {
        label: '16k_zh_dialect / 多方言',
        modelName: '16k_zh_dialect',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      },
      {
        label: '16k_zh_medical / 中文医疗',
        modelName: '16k_zh_medical',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      }
    ]
  },
  {
    id: 'aliyun-bailian',
    name: '阿里云',
    summary: '阿里云百炼模型平台，当前优先接入语音模型，支持短音频识别、长文件转写和中文方言场景。',
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: [
      {
        label: 'qwen3-asr-flash / 短音频转写',
        modelName: 'qwen3-asr-flash',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      },
      {
        label: 'qwen3-asr-flash-filetrans / 文件转写与时间戳',
        modelName: 'qwen3-asr-flash-filetrans',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      },
      {
        label: 'fun-asr / 中文方言与噪声场景',
        modelName: 'fun-asr',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      },
      {
        label: 'paraformer-v2 / 中文语音识别',
        modelName: 'paraformer-v2',
        purpose: 'audio',
        capabilities: ['audio_to_text'],
        temperature: 0,
        maxTokens: 0
      }
    ]
  },
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
  const executionProfile = cloneJsonValue(
    summary.executionProfile ?? dependencyManifest?.executionProfile
  ) as DesktopRoleTemplate['executionProfile'];
  const manifestModelProfileIds = readDependencyManifestModelProfileIds(dependencyManifest);
  const manifestToolIds = readDependencyManifestToolIds(dependencyManifest);

  return {
    templateId: summary.id,
    applicationType: summary.applicationType ?? summary.dependencyManifest?.applicationType ?? 'digital_employee',
    roleCode,
    name: summary.name,
    version: summary.version,
    summary: summary.description,
    industry: summary.industry,
    scenario: summary.scenario,
    description: summary.description,
    recommendedPlanCode: summary.recommendedPlanCode,
    allowedPlanCodes: [...(summary.allowedPlanCodes ?? [])],
    canInstall: summary.canInstall ?? true,
    accessLabel: summary.accessLabel,
    accessReason: summary.accessReason,
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
    executionProfile,
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

  if (includesAny(text, ['rpa', 'browser automation', 'browser-automation', 'boss', 'zhipin', 'liepin', 'zhilian'])) {
    toolIds.push('browser-automation');
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

function isFreeRoleTemplate(template: Pick<DesktopRoleTemplate, 'allowedPlanCodes'>): boolean {
  return (template.allowedPlanCodes ?? []).includes('PERSONAL_FREE');
}

function canInstallRoleTemplate(template: Pick<DesktopRoleTemplate, 'canInstall'>): boolean {
  return template.canInstall !== false;
}

function roleTemplateAccessLabel(template: Pick<DesktopRoleTemplate, 'accessLabel'>): string {
  return template.accessLabel?.trim() || '\u5347\u7ea7\u540e\u53ef\u5b89\u88c5';
}

function roleTemplateAccessReason(template: Pick<DesktopRoleTemplate, 'accessReason'>): string {
  return template.accessReason?.trim() || '\u5f53\u524d\u7248\u672c\u6682\u4e0d\u652f\u6301\u5b89\u88c5\u8be5\u6a21\u677f\u3002';
}

function roleExecutionModeMeta(profile: DesktopRoleExecutionProfile | undefined): {
  label: string;
  color: string;
} {
  switch (profile?.mode) {
    case 'watch':
      return { label: '值守式', color: 'gold' };
    case 'hybrid':
      return { label: '混合式', color: 'cyan' };
    default:
      return { label: '对话式', color: 'blue' };
  }
}

function roleExecutionProfileTooltip(profile: DesktopRoleExecutionProfile | undefined): ReactNode {
  if (!profile) {
    return '由用户发起任务，按模板读取资料并输出结果。';
  }

  return (
    <Space direction="vertical" size={4}>
      <span>{profile.summary}</span>
      <span>触发方式：{formatRoleExecutionValues(profile.triggerModes, roleExecutionTriggerLabel)}</span>
      <span>输入来源：{formatRoleExecutionValues(profile.inputSources, roleExecutionInputSourceLabel)}</span>
      <span>输出位置：{formatRoleExecutionValues(profile.outputTargets, roleExecutionOutputTargetLabel)}</span>
      {profile.approval.required ? (
        <span>需审批：{profile.approval.requiredActions.join('、') || '关键动作'}</span>
      ) : null}
      {profile.externalConnectors?.length ? (
        <span>
          外部连接：{profile.externalConnectors.map((connector) => connector.name).join('、')}
        </span>
      ) : null}
    </Space>
  );
}

function formatRoleExecutionValues(
  values: string[],
  labeler: (value: string) => string
): string {
  const labels = values.map(labeler).filter(Boolean);
  return labels.length > 0 ? labels.join('、') : '未声明';
}

function roleExecutionTriggerLabel(value: string): string {
  const labels: Record<string, string> = {
    manual: '手动',
    scheduled: '定时',
    event: '事件',
    folder_watch: '文件夹监听',
    platform_watch: '平台值守'
  };
  return labels[value] ?? value;
}

function roleExecutionInputSourceLabel(value: string): string {
  const labels: Record<string, string> = {
    chat: '对话',
    uploaded_files: '上传文件',
    local_folder: '本地文件夹',
    enterprise_knowledge: '企业知识库',
    web: '网页',
    external_platform: '外部平台'
  };
  return labels[value] ?? value;
}

function roleExecutionOutputTargetLabel(value: string): string {
  const labels: Record<string, string> = {
    chat_response: '对话回复',
    artifact: '产物文件',
    task_queue: '任务队列',
    approval_queue: '审批队列',
    daily_report: '日报',
    external_platform: '外部平台'
  };
  return labels[value] ?? value;
}

type RoleApplicationUsage = Record<RoleApplicationType, number>;

interface RoleInstallAvailability {
  canInstall: boolean;
  label: string;
  reason: string;
  usedValue?: number;
  limitValue?: number;
}

function countInstalledRoleApplications(rolePackages: RolePackageManifest[]): RoleApplicationUsage {
  return rolePackages.reduce<RoleApplicationUsage>(
    (counts, rolePackage) => {
      counts[readRoleApplicationType(rolePackage)] += 1;
      return counts;
    },
    {
      digital_employee: 0,
      digital_factory: 0
    }
  );
}

function roleApplicationCapacityLimit(
  applicationType: RoleApplicationType,
  deviceCapacity: DesktopDeviceCapacitySummary | undefined
): number | undefined {
  return applicationType === 'digital_factory'
    ? deviceCapacity?.maxDigitalFactories
    : deviceCapacity?.maxRoleInstances;
}

function resolveRoleInstallAvailability(
  template: DesktopRoleTemplate,
  installedUsage: RoleApplicationUsage,
  deviceCapacity: DesktopDeviceCapacitySummary | undefined
): RoleInstallAvailability {
  if (!canInstallRoleTemplate(template)) {
    return {
      canInstall: false,
      label: roleTemplateAccessLabel(template),
      reason: roleTemplateAccessReason(template)
    };
  }

  const applicationType = readRoleApplicationType(template);
  const limitValue = roleApplicationCapacityLimit(applicationType, deviceCapacity);
  const usedValue = installedUsage[applicationType];
  if (limitValue !== undefined && usedValue >= limitValue) {
    const applicationLabel = roleApplicationTypeLabel(applicationType);
    return {
      canInstall: false,
      label: '额度已满',
      reason: `当前套餐每台设备最多可安装 ${limitValue} 个${applicationLabel}，这台电脑已安装 ${usedValue} 个。请先卸载不需要的${applicationLabel}，或在购买中心升级套餐。`,
      usedValue,
      limitValue
    };
  }

  return {
    canInstall: true,
    label: '可安装',
    reason: '',
    usedValue,
    limitValue
  };
}

function formatRoleApplicationCapacityUsage(
  applicationType: RoleApplicationType,
  installedUsage: RoleApplicationUsage,
  deviceCapacity: DesktopDeviceCapacitySummary | undefined
): string {
  const usedValue = installedUsage[applicationType];
  const limitValue = roleApplicationCapacityLimit(applicationType, deviceCapacity);

  return limitValue === undefined
    ? `本机已安装 ${usedValue} 个`
    : `本机已安装 ${usedValue}/${limitValue} 个`;
}

function restrictInstalledRolePackagesByDeviceCapacity(
  rolePackages: RolePackageManifest[],
  deviceCapacity: DesktopDeviceCapacitySummary | undefined
): RolePackageManifest[] {
  const limits: Record<RoleApplicationType, number | undefined> = {
    digital_employee: deviceCapacity?.maxRoleInstances,
    digital_factory: deviceCapacity?.maxDigitalFactories
  };
  const used: RoleApplicationUsage = {
    digital_employee: 0,
    digital_factory: 0
  };

  return rolePackages.filter((rolePackage) => {
    const applicationType = readRoleApplicationType(rolePackage);
    const limitValue = limits[applicationType];
    if (limitValue !== undefined && used[applicationType] >= limitValue) {
      return false;
    }

    used[applicationType] += 1;
    return true;
  });
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

function normalizeFactoryPackageDefinitions(
  value: unknown,
  fallback: Array<DigitalFactoryPackageOption | FactoryRunPackageDefinition>
): FactoryRunPackageDefinition[] {
  const source = Array.isArray(value) ? value : fallback;
  const usedKeys = new Set<string>();
  const normalized: FactoryRunPackageDefinition[] = [];

  for (const [index, item] of source.entries()) {
    if (!isPlainObject(item)) {
      continue;
    }

    const fallbackKey = `custom_${index + 1}`;
    const key = normalizeFactoryPackageKey(readString(item.key) ?? fallbackKey, fallbackKey);
    const label = readString(item.label)?.trim();
    if (!key || !label || usedKeys.has(key)) {
      continue;
    }

    usedKeys.add(key);
    normalized.push({
      key,
      label,
      description: readString(item.description),
      outputType: readString(item.outputType) ?? 'image',
      defaultSelected: typeof item.defaultSelected === 'boolean' ? item.defaultSelected : undefined,
      custom: typeof item.custom === 'boolean' ? item.custom : key.startsWith('custom_')
    });

    if (normalized.length >= 20) {
      break;
    }
  }

  if (!normalized.length && source !== fallback) {
    return normalizeFactoryPackageDefinitions(fallback, []);
  }

  return normalized;
}

function normalizeFactoryPackageKey(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  return normalized || fallback;
}

function readFactoryPackagePreset(
  roleCode: string,
  fallback: DigitalFactoryPackageOption[]
): FactoryRunPackageDefinition[] {
  if (typeof window === 'undefined') {
    return normalizeFactoryPackageDefinitions(fallback, []);
  }

  try {
    const rawValue = window.localStorage.getItem(factoryPackagePresetStorageKey);
    if (!rawValue) {
      return normalizeFactoryPackageDefinitions(fallback, []);
    }

    const parsed = JSON.parse(rawValue);
    if (!isPlainObject(parsed)) {
      return normalizeFactoryPackageDefinitions(fallback, []);
    }

    return normalizeFactoryPackageDefinitions(parsed[roleCode], fallback);
  } catch {
    return normalizeFactoryPackageDefinitions(fallback, []);
  }
}

function writeFactoryPackagePreset(roleCode: string, packages: FactoryRunPackageDefinition[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(factoryPackagePresetStorageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    const current = isPlainObject(parsed) ? parsed : {};
    window.localStorage.setItem(
      factoryPackagePresetStorageKey,
      JSON.stringify({
        ...current,
        [roleCode]: normalizeFactoryPackageDefinitions(packages, [])
      })
    );
  } catch {
    // Local factory package presets are optional; task execution should not depend on storage.
  }
}

function removeFactoryPackagePreset(roleCode: string) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(factoryPackagePresetStorageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    if (!isPlainObject(parsed)) {
      return;
    }

    const next = { ...parsed };
    delete next[roleCode];
    window.localStorage.setItem(factoryPackagePresetStorageKey, JSON.stringify(next));
  } catch {
    // Local factory package presets are optional.
  }
}

function readFactoryCustomScreeningProfiles(roleCode: string): FactoryRunScreeningProfileDefinition[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(factoryScreeningProfileStorageKey);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    if (!isPlainObject(parsed)) {
      return [];
    }

    return normalizeFactoryScreeningProfiles(parsed[roleCode], [], { custom: true });
  } catch {
    return [];
  }
}

function writeFactoryCustomScreeningProfiles(roleCode: string, profiles: FactoryRunScreeningProfileDefinition[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(factoryScreeningProfileStorageKey);
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    const current = isPlainObject(parsed) ? parsed : {};
    window.localStorage.setItem(
      factoryScreeningProfileStorageKey,
      JSON.stringify({
        ...current,
        [roleCode]: normalizeFactoryScreeningProfiles(profiles, [], { custom: true })
      })
    );
  } catch {
    // Local factory screening profiles are optional; task execution can still use service templates.
  }
}

function normalizeFactoryScreeningProfiles(
  value: unknown,
  fallback: FactoryRunScreeningProfileDefinition[],
  options?: { custom?: boolean }
): FactoryRunScreeningProfileDefinition[] {
  const source = Array.isArray(value) ? value : fallback;
  const usedKeys = new Set<string>();
  const normalized: FactoryRunScreeningProfileDefinition[] = [];

  for (const [index, item] of source.entries()) {
    if (!isPlainObject(item)) {
      continue;
    }

    const fallbackKey = options?.custom ? `custom_screening_${index + 1}` : `screening_${index + 1}`;
    const key = normalizeFactoryScreeningKey(readString(item.key) ?? fallbackKey, fallbackKey);
    const label = readString(item.label)?.trim();
    if (!key || !label || usedKeys.has(key)) {
      continue;
    }

    const gates = normalizeFactoryScreeningGates(item.gates, []);
    normalized.push({
      key,
      label,
      description: readString(item.description),
      defaultSelected: typeof item.defaultSelected === 'boolean' ? item.defaultSelected : undefined,
      gates: gates.length > 0 ? gates : cloneFactoryScreeningGates(defaultFactoryVideoScreeningGateDefinitions),
      custom: options?.custom === true || item.custom === true
    });
    usedKeys.add(key);

    if (normalized.length >= 30) {
      break;
    }
  }

  if (!normalized.length && source !== fallback) {
    return normalizeFactoryScreeningProfiles(fallback, [], options);
  }

  return normalized;
}

function normalizeFactoryScreeningGates(
  value: unknown,
  fallback: FactoryVideoScreeningGateDefinition[]
): FactoryVideoScreeningGateDefinition[] {
  const source = Array.isArray(value) ? value : fallback;
  const usedIds = new Set<string>();
  const normalized: FactoryVideoScreeningGateDefinition[] = [];

  for (const [index, item] of source.entries()) {
    if (!isPlainObject(item)) {
      continue;
    }

    const fallbackId = `gate_${index + 1}`;
    const id = normalizeFactoryScreeningKey(readString(item.id) ?? fallbackId, fallbackId);
    const name = readString(item.name)?.trim() ?? id;
    const rules = normalizeFactoryScreeningRules(item.rules, []);
    if (!id || usedIds.has(id) || rules.length === 0) {
      continue;
    }

    normalized.push({
      id,
      name,
      description: readString(item.description),
      rules
    });
    usedIds.add(id);
  }

  return normalized;
}

function normalizeFactoryScreeningRules(
  value: unknown,
  fallback: FactoryVideoScreeningRuleDefinition[]
): FactoryVideoScreeningRuleDefinition[] {
  const source = Array.isArray(value) ? value : fallback;
  const normalized: FactoryVideoScreeningRuleDefinition[] = [];

  for (const item of source) {
    if (!isPlainObject(item)) {
      continue;
    }

    const metric = readString(item.metric);
    const metricOption = findFactoryVideoScreeningMetric(metric);
    if (!metricOption) {
      continue;
    }

    const operator = readFactoryVideoScreeningOperator(item.operator, metricOption);
    const value = normalizeFactoryScreeningRuleValue(item.value, metricOption, operator);
    const failReason = readString(item.failReason)?.trim() || metricOption.defaultFailReason;
    normalized.push({
      metric: metricOption.key,
      operator,
      value,
      failReason
    });
  }

  return normalized;
}

function cloneFactoryScreeningGates(gates: FactoryVideoScreeningGateDefinition[]) {
  return gates.map((gate) => ({
    ...gate,
    rules: gate.rules.map((rule) => ({
      ...rule,
      value: Array.isArray(rule.value) ? [...rule.value] : rule.value
    }))
  }));
}

function mergeFactoryScreeningProfiles(
  baseProfiles: FactoryRunScreeningProfileDefinition[],
  customProfiles: FactoryRunScreeningProfileDefinition[]
) {
  const usedKeys = new Set(baseProfiles.map((item) => item.key));
  return [
    ...baseProfiles.map((item) => ({ ...item, custom: false })),
    ...customProfiles
      .filter((item) => item.custom && !usedKeys.has(item.key))
      .map((item) => ({ ...item, custom: true, defaultSelected: false }))
  ];
}

function normalizeFactoryScreeningKey(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);

  return normalized || fallback;
}

function findFactoryVideoScreeningMetric(metric: string | undefined) {
  return factoryVideoScreeningMetricOptions.find((item) => item.key === metric);
}

function readFactoryVideoScreeningOperator(
  value: unknown,
  metric: (typeof factoryVideoScreeningMetricOptions)[number]
): FactoryVideoScreeningOperator {
  if (
    value === '>=' ||
    value === '<=' ||
    value === '>' ||
    value === '<' ||
    value === 'equals' ||
    value === 'notEquals' ||
    value === 'between'
  ) {
    if (metric.type === 'boolean' && value !== 'equals' && value !== 'notEquals') {
      return metric.defaultOperator;
    }
    return value;
  }

  return metric.defaultOperator;
}

function normalizeFactoryScreeningRuleValue(
  value: unknown,
  metric: (typeof factoryVideoScreeningMetricOptions)[number],
  operator: FactoryVideoScreeningOperator
) {
  if (metric.type === 'boolean') {
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'false') {
      return false;
    }
    return Boolean(metric.defaultValue);
  }

  if (operator === 'between') {
    const rawBounds = Array.isArray(value) ? value : Array.isArray(metric.defaultValue) ? metric.defaultValue : [0, 1];
    const bounds = rawBounds.map((item) => Number(item)).filter((item) => Number.isFinite(item));
    return bounds.length >= 2 ? [bounds[0], bounds[1]] : [0, 1];
  }

  const numberValue = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(numberValue) ? numberValue : metric.defaultValue;
}

function createFactoryScreeningRule(metricKey: string): FactoryVideoScreeningRuleDefinition {
  const metric = findFactoryVideoScreeningMetric(metricKey) ?? factoryVideoScreeningMetricOptions[0];
  return {
    metric: metric.key,
    operator: metric.defaultOperator,
    value: metric.defaultValue,
    failReason: metric.defaultFailReason
  };
}

function validateFactoryScreeningProfile(profile: FactoryRunScreeningProfileDefinition | undefined): string | undefined {
  if (!profile) {
    return '请选择一个筛选标准。';
  }
  if (!profile.label.trim()) {
    return '筛选标准名称不能为空。';
  }
  if (profile.gates.length === 0) {
    return '筛选标准至少需要一个筛选分组。';
  }

  for (const gate of profile.gates) {
    if (!gate.name.trim()) {
      return '筛选分组名称不能为空。';
    }
    if (gate.rules.length === 0) {
      return `${gate.name} 至少需要一条规则。`;
    }
    for (const rule of gate.rules) {
      const metric = findFactoryVideoScreeningMetric(rule.metric);
      if (!metric) {
        return `${gate.name} 里存在暂不支持的指标。`;
      }
      if (!rule.failReason.trim()) {
        return `${gate.name} 里有规则缺少不通过原因。`;
      }
      if (metric.type === 'number' && rule.operator !== 'between' && typeof rule.value !== 'number') {
        return `${gate.name} 里有数值规则未填写阈值。`;
      }
      if (
        metric.type === 'number' &&
        rule.operator === 'between' &&
        (!Array.isArray(rule.value) || rule.value.length < 2)
      ) {
        return `${gate.name} 里有区间规则未填写完整。`;
      }
    }
  }

  return undefined;
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
  const [providerModelSearchQuery, setProviderModelSearchQuery] = useState('');
  const [providerModelCapabilityFilter, setProviderModelCapabilityFilter] =
    useState<ProviderModelCapabilityFilter>('all');
  const [providerModelCompatibilityOnly, setProviderModelCompatibilityOnly] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBindingDevice, setIsBindingDevice] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [isCheckingForUpdates, setIsCheckingForUpdates] = useState(false);
  const [isInstallingUpdate, setIsInstallingUpdate] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [onboardingNotice, setOnboardingNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [updateNotice, setUpdateNotice] = useState('');
  const [updateCheckResult, setUpdateCheckResult] = useState<DesktopUpdateCheckResult | null>(null);
  const [userAgreementStatus, setUserAgreementStatus] = useState<DesktopAgreementStatus | null>(null);
  const [isCheckingUserAgreement, setIsCheckingUserAgreement] = useState(true);
  const [isAcceptingUserAgreement, setIsAcceptingUserAgreement] = useState(false);
  const [userAgreementNotice, setUserAgreementNotice] = useState('');
  const [userAgreementReadStartedAt, setUserAgreementReadStartedAt] = useState<number | null>(null);
  const [userAgreementRemainingSeconds, setUserAgreementRemainingSeconds] = useState(
    qiuaiUserAgreementRequiredReadSeconds
  );
  const [modelTestNotice, setModelTestNotice] = useState('');
  const [modelTestResult, setModelTestResult] = useState<DesktopModelTestResponse | null>(null);
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [isPullingProviderModels, setIsPullingProviderModels] = useState(false);
  const [latestPulledModelCatalog, setLatestPulledModelCatalog] = useState<{
    profileId: string;
    catalog: ModelProviderCatalog;
  } | null>(null);
  const [localActionNotice, setLocalActionNotice] = useState('');
  const [savingArtifactId, setSavingArtifactId] = useState('');
  const [savingFactoryImageId, setSavingFactoryImageId] = useState('');
  const [exportingFactoryOutputId, setExportingFactoryOutputId] = useState('');
  const [exportingFactoryOutputBatch, setExportingFactoryOutputBatch] = useState('');
  const [roleTemplateNotice, setRoleTemplateNotice] = useState('');
  const [isLoadingRoleTemplates, setIsLoadingRoleTemplates] = useState(false);
  const [authorizedRoleTemplateCatalog, setAuthorizedRoleTemplateCatalog] =
    useState<DesktopAuthorizedRoleTemplateCatalog>(initialAuthorizedRoleTemplateCatalog);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const [workspaceBackups, setWorkspaceBackups] = useState<DesktopBackupSummary[]>([]);
  const chatMessageListRef = useRef<HTMLDivElement | null>(null);
  const composerFileInputRef = useRef<HTMLInputElement | null>(null);
  const factoryFileInputRef = useRef<HTMLInputElement | null>(null);
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [factoryRunForm] = Form.useForm<FactoryRunFormValues>();
  const [modelForm] = Form.useForm<ModelFormValues>();
  const [toolSettingsForm] = Form.useForm<ToolSettingsFormValues>();
  const [onboardingForm] = Form.useForm<OnboardingFormValues>();
  const [roleConfigForm] = Form.useForm<RoleConfigFormValues>();
  const [runtimeModelQuickSwitchForm] = Form.useForm<RuntimeModelQuickSwitchFormValues>();
  const [watchConfigForm] = Form.useForm<WatchConfigFormValues>();
  const [issueFeedbackForm] = Form.useForm<IssueFeedbackFormValues>();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [roleConfigModalOpen, setRoleConfigModalOpen] = useState(false);
  const [roleConfigMode, setRoleConfigMode] = useState<'install' | 'configure'>('install');
  const [roleConfigRoleCode, setRoleConfigRoleCode] = useState('');
  const [runtimeModelQuickSwitchOpen, setRuntimeModelQuickSwitchOpen] = useState(false);
  const [runtimeModelQuickSwitchRoleCode, setRuntimeModelQuickSwitchRoleCode] = useState('');
  const [watchConfigModalOpen, setWatchConfigModalOpen] = useState(false);
  const [watchConfigRoleCode, setWatchConfigRoleCode] = useState('');
  const [toolSettingsNotice, setToolSettingsNotice] = useState('');
  const [isSavingToolSettings, setIsSavingToolSettings] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const [modelConfigOpen, setModelConfigOpen] = useState(false);
  const [toolConfigToolId, setToolConfigToolId] = useState('');
  const [toolSearchQuery, setToolSearchQuery] = useState('');
  const [selectedRoleCategory, setSelectedRoleCategory] = useState('全部');
  const [selectedRoleApplicationType, setSelectedRoleApplicationType] =
    useState<RoleApplicationType>('digital_employee');
  const [selectedToolCategory, setSelectedToolCategory] = useState('全部');
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [accountModal, setAccountModal] = useState<AccountModalKey | null>(null);
  const [issueFeedbackOpen, setIssueFeedbackOpen] = useState(false);
  const [issueFeedbackTaskId, setIssueFeedbackTaskId] = useState('');
  const [isSubmittingIssueFeedback, setIsSubmittingIssueFeedback] = useState(false);
  const [issueFeedbackNotice, setIssueFeedbackNotice] = useState('');
  const [selectedLegalDocumentId, setSelectedLegalDocumentId] = useState('');
  const [isUnbindingDevice, setIsUnbindingDevice] = useState(false);
  const [composerAttachments, setComposerAttachments] = useState<ComposerAttachment[]>([]);
  const [isComposerDragOver, setIsComposerDragOver] = useState(false);
  const [taskHistoryOpen, setTaskHistoryOpen] = useState(false);
  const [pendingUninstallRoleCode, setPendingUninstallRoleCode] = useState('');
  const [selectedFactoryRoleCode, setSelectedFactoryRoleCode] = useState('');
  const [factoryAttachments, setFactoryAttachments] = useState<ComposerAttachment[]>([]);
  const [isFactoryDragOver, setIsFactoryDragOver] = useState(false);
  const [previewFactoryImage, setPreviewFactoryImage] = useState<FactoryArtifactPreviewItem | null>(null);
  const [factorySidePanelOpen, setFactorySidePanelOpen] = useState<'status' | 'logs' | null>(null);
  const [factoryPackageEditorOpen, setFactoryPackageEditorOpen] = useState(false);
  const [factoryPackageEditorRoleCode, setFactoryPackageEditorRoleCode] = useState('');
  const [factoryPackageEditorDraft, setFactoryPackageEditorDraft] = useState<FactoryRunPackageDefinition[]>([]);
  const [, refreshFactoryScreeningProfiles] = useState(0);
  const [factoryScreeningEditorOpen, setFactoryScreeningEditorOpen] = useState(false);
  const [factoryScreeningEditorRoleCode, setFactoryScreeningEditorRoleCode] = useState('');
  const [factoryScreeningEditorProfiles, setFactoryScreeningEditorProfiles] = useState<
    FactoryRunScreeningProfileDefinition[]
  >([]);
  const [factoryScreeningEditorSelectedKey, setFactoryScreeningEditorSelectedKey] = useState('');
  const runtimeStateRef = useRef(runtimeState);
  const runningWatchRoleCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void loadRuntimeState();
    void loadUserAgreementStatus();
  }, []);

  useEffect(() => {
    runtimeStateRef.current = runtimeState;
  }, [runtimeState]);

  useEffect(() => {
    if (!userAgreementStatus || userAgreementStatus.accepted) {
      return;
    }

    const startedAt = Date.now();
    setUserAgreementReadStartedAt(startedAt);
    setUserAgreementRemainingSeconds(userAgreementStatus.agreement.requiredReadSeconds);

    const handle = window.setInterval(() => {
      const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
      setUserAgreementRemainingSeconds(
        Math.max(0, userAgreementStatus.agreement.requiredReadSeconds - elapsedSeconds)
      );
    }, 250);

    return () => window.clearInterval(handle);
  }, [
    userAgreementStatus?.accepted,
    userAgreementStatus?.agreement.agreementVersion,
    userAgreementStatus?.agreement.contentHash,
    userAgreementStatus?.agreement.requiredReadSeconds
  ]);

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
    if (!hasLoadedPersistedState) {
      return;
    }

    const tick = () => {
      void triggerDueWatchJobs();
    };
    const initialHandle = window.setTimeout(tick, 3000);
    const intervalHandle = window.setInterval(tick, 30000);

    return () => {
      window.clearTimeout(initialHandle);
      window.clearInterval(intervalHandle);
    };
  }, [hasLoadedPersistedState]);

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

  const desktopRoleTemplates = useMemo(() => {
    return authorizedRoleTemplateCatalog.templates.map(toDesktopRoleTemplate);
  }, [authorizedRoleTemplateCatalog.source, authorizedRoleTemplateCatalog.templates]);

  const desktopRoleTemplateByRoleCode = useMemo(() => {
    const authorizedByRoleCode = new Map(
      desktopRoleTemplates.map((template) => [template.roleCode, template] as const)
    );

    return authorizedByRoleCode;
  }, [desktopRoleTemplates]);

  const refreshedInstalledRolePackages = useMemo(
    () =>
      runtimeState.rolePackages.map((rolePackage) =>
        refreshInstalledRolePackageFromTemplate(
          rolePackage,
          desktopRoleTemplateByRoleCode.get(rolePackage.roleCode)
        )
      ),
    [desktopRoleTemplateByRoleCode, runtimeState.rolePackages]
  );
  const refreshedInstalledRolePackageByRoleCode = useMemo(
    () =>
      new Map(
        refreshedInstalledRolePackages.map((rolePackage) => [rolePackage.roleCode, rolePackage] as const)
      ),
    [refreshedInstalledRolePackages]
  );

  const installedDigitalEmployeePackages = useMemo(
    () =>
      refreshedInstalledRolePackages.filter(
        (rolePackage) => readRoleApplicationType(rolePackage) === 'digital_employee'
      ),
    [refreshedInstalledRolePackages]
  );
  const installedDigitalFactoryPackages = useMemo(
    () =>
      refreshedInstalledRolePackages.filter(
        (rolePackage) => readRoleApplicationType(rolePackage) === 'digital_factory'
      ),
    [refreshedInstalledRolePackages]
  );

  useEffect(() => {
    const currentActiveEmployee = installedDigitalEmployeePackages.find(
      (rolePackage) => rolePackage.roleCode === runtimeState.localRuntime.activeRoleCode
    );
    const activeRoleCode =
      currentActiveEmployee?.roleCode ??
      installedDigitalEmployeePackages.find(
        (rolePackage) => !isRuntimeRolePackageDeleted(runtimeState, rolePackage.roleCode)
      )?.roleCode;
    taskForm.setFieldsValue({ roleCode: activeRoleCode ?? '' });
  }, [installedDigitalEmployeePackages, runtimeState, taskForm]);

  useEffect(() => {
    if (
      selectedFactoryRoleCode &&
      installedDigitalFactoryPackages.some((rolePackage) => rolePackage.roleCode === selectedFactoryRoleCode)
    ) {
      return;
    }

    setSelectedFactoryRoleCode(
      installedDigitalFactoryPackages.find(
        (rolePackage) => !isRuntimeRolePackageDeleted(runtimeState, rolePackage.roleCode)
      )?.roleCode ??
        installedDigitalFactoryPackages[0]?.roleCode ??
        ''
    );
  }, [installedDigitalFactoryPackages, runtimeState, selectedFactoryRoleCode]);

  useEffect(() => {
    if (!selectedFactoryRoleCode) {
      factoryRunForm.resetFields();
      setFactoryAttachments([]);
      return;
    }

    const defaultValues = buildFactoryRunDefaultValues(selectedFactoryRoleCode);
    if (defaultValues) {
      factoryRunForm.setFieldsValue(defaultValues);
      setFactoryAttachments([]);
    }
  }, [factoryRunForm, selectedFactoryRoleCode]);

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

  async function loadUserAgreementStatus() {
    if (!window.qiuDesktop) {
      setUserAgreementStatus({
        agreement: {
          agreementKey: qiuaiUserAgreementDocument.id,
          agreementVersion: qiuaiUserAgreementDocument.version,
          contentHash: 'browser-preview',
          title: qiuaiUserAgreementDocument.title,
          effectiveDate: qiuaiUserAgreementDocument.effectiveDate,
          requiredReadSeconds: qiuaiUserAgreementRequiredReadSeconds
        },
        accepted: true,
        cloudSynced: false
      });
      return;
    }

    setIsCheckingUserAgreement(true);
    setUserAgreementNotice('');
    try {
      const status = await window.qiuDesktop.getUserAgreementStatus();
      setUserAgreementStatus(status);
      setUserAgreementNotice(status.message ?? '');
    } catch (error) {
      setUserAgreementNotice(
        `协议状态加载失败：${error instanceof Error ? error.message : 'unknown error'}`
      );
      setUserAgreementStatus({
        agreement: {
          agreementKey: qiuaiUserAgreementDocument.id,
          agreementVersion: qiuaiUserAgreementDocument.version,
          contentHash: 'unavailable',
          title: qiuaiUserAgreementDocument.title,
          effectiveDate: qiuaiUserAgreementDocument.effectiveDate,
          requiredReadSeconds: qiuaiUserAgreementRequiredReadSeconds
        },
        accepted: false,
        cloudSynced: false
      });
    } finally {
      setIsCheckingUserAgreement(false);
    }
  }

  async function submitUserAgreementAcceptance() {
    if (!window.qiuDesktop || !userAgreementReadStartedAt) {
      return;
    }

    setIsAcceptingUserAgreement(true);
    setUserAgreementNotice('');
    try {
      const actualReadSeconds = Math.floor((Date.now() - userAgreementReadStartedAt) / 1000);
      const status = await window.qiuDesktop.acceptUserAgreement({
        actualReadSeconds
      });
      setUserAgreementStatus(status);
      setUserAgreementNotice('');
      message.success('用户协议已同意并完成云端留痕');
    } catch (error) {
      setUserAgreementNotice(
        `同意协议失败：${error instanceof Error ? error.message : 'unknown error'}`
      );
    } finally {
      setIsAcceptingUserAgreement(false);
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
          pruneUnauthorizedRolePackages(
            current,
            authorizedTemplates,
            catalog.deletedTemplateIds ?? [],
            catalog.deviceCapacity
          )
        );
      }
      setRoleTemplateNotice(
        catalog.message ??
          (catalog.source === 'server'
            ? `已同步 ${catalog.templates.length} 个市场应用`
            : '暂未同步到数字市场，请检查网络或服务端配置。')
      );
    } catch (error) {
      setAuthorizedRoleTemplateCatalog(initialAuthorizedRoleTemplateCatalog);
      setRoleTemplateNotice(
        `数字市场同步失败：${error instanceof Error ? error.message : 'unknown error'}`
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
      const refreshedState = await window.qiuDesktop.getRuntimeState();
      setRuntimeState({
        ...refreshedState,
        localRuntime: {
          ...refreshedState.localRuntime,
          lastSyncedAt: syncedAt
        },
        runtimeSnapshot: {
          ...refreshedState.runtimeSnapshot,
          lastSyncedAt: syncedAt
        }
      });
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

  async function saveFactoryPreviewImage(item: FactoryArtifactPreviewItem) {
    if (!item.remoteUrl || !window.qiuDesktop) {
      return;
    }

    setLocalActionNotice('');
    setSavingFactoryImageId(item.id);
    try {
      const result = await window.qiuDesktop.saveRemoteFileAs({
        url: item.remoteUrl,
        suggestedFileName: getFactoryPreviewImageFileName(item)
      });
      if (!result.canceled) {
        message.success('图片已保存');
      }
    } catch (error) {
      const errorMessage = `保存图片失败：${error instanceof Error ? error.message : 'unknown error'}`;
      setLocalActionNotice(errorMessage);
      message.error(errorMessage);
    } finally {
      setSavingFactoryImageId('');
    }
  }

  async function exportFactoryOutputItems(
    task: DesktopTaskDetail,
    items: FactoryOutputItem[],
    batchKey: string
  ) {
    if (!window.qiuDesktop) {
      return;
    }

    const exportableFiles = items
      .filter((item) => item.status !== 'excluded')
      .map((item) => {
        const sourcePath = getFactoryOutputLocalPath(item);
        return sourcePath
          ? {
              sourcePath,
              suggestedFileName: getFactoryOutputSuggestedFileName(item, sourcePath)
            }
          : undefined;
      })
      .filter((item): item is { sourcePath: string; suggestedFileName: string } => Boolean(item));

    if (exportableFiles.length === 0) {
      message.warning('没有可导出的本地文件。');
      return;
    }

    setLocalActionNotice('');
    setExportingFactoryOutputBatch(batchKey);
    try {
      const result = await window.qiuDesktop.exportLocalFiles({
        targetFolderName: `${task.title}-${batchKey === 'qualified' ? '合格输出' : '输出物'}`,
        files: exportableFiles
      });
      if (!result.canceled) {
        message.success(`已导出 ${result.exportedFiles.length} 个文件。`);
      }
    } catch (error) {
      const errorMessage = `导出输出物失败：${error instanceof Error ? error.message : 'unknown error'}`;
      setLocalActionNotice(errorMessage);
      message.error(errorMessage);
    } finally {
      setExportingFactoryOutputBatch('');
    }
  }

  async function exportSingleFactoryOutputItem(task: DesktopTaskDetail, item: FactoryOutputItem) {
    if (!window.qiuDesktop) {
      return;
    }

    const sourcePath = getFactoryOutputLocalPath(item);
    if (!sourcePath) {
      message.warning('这个输出物没有可导出的本地文件。');
      return;
    }

    setLocalActionNotice('');
    setExportingFactoryOutputId(item.id);
    try {
      const result = await window.qiuDesktop.exportLocalFiles({
        targetFolderName: `${task.title}-输出物`,
        files: [
          {
            sourcePath,
            suggestedFileName: getFactoryOutputSuggestedFileName(item, sourcePath)
          }
        ]
      });
      if (!result.canceled) {
        message.success('输出物已导出。');
      }
    } catch (error) {
      const errorMessage = `导出输出物失败：${error instanceof Error ? error.message : 'unknown error'}`;
      setLocalActionNotice(errorMessage);
      message.error(errorMessage);
    } finally {
      setExportingFactoryOutputId('');
    }
  }

  function updateFactoryOutputItemStatus(
    taskId: string,
    itemId: string,
    nextStatus: FactoryOutputItemStatus,
    reason: string
  ) {
    const updatedAt = new Date().toISOString();
    const taskDetail = getRuntimeTaskDetails(runtimeState).find((task) => task.taskId === taskId);
    if (!taskDetail?.factoryOutputs?.length) {
      return;
    }

    let changed = false;
    const factoryOutputs = taskDetail.factoryOutputs.map((item) => {
      if (item.id !== itemId || item.status === nextStatus) {
        return item;
      }

      changed = true;
      const auditAction: NonNullable<FactoryOutputItem['auditTrail']>[number]['action'] =
        item.status === 'excluded' ? 'restored' : 'status_changed';
      return {
        ...item,
        status: nextStatus,
        updatedAt,
        auditTrail: [
          ...(item.auditTrail ?? []),
          {
            id: `${item.id}-audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
            action: auditAction,
            fromStatus: item.status,
            toStatus: nextStatus,
            reason,
            createdAt: updatedAt
          }
        ]
      };
    });

    if (!changed) {
      return;
    }

    const nextState = upsertTaskDetailInRuntimeState(runtimeState, {
      ...taskDetail,
      factoryOutputs,
      updatedAt
    });
    setRuntimeState(nextState);
    void window.qiuDesktop?.saveRuntimeState(nextState);
    message.success('输出物状态已更新。');
  }

  function excludeFactoryOutputItem(taskId: string, itemId: string) {
    updateFactoryOutputItemStatus(taskId, itemId, 'excluded', '人工从输出队列移除');
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

  async function downloadAndInstallUpdate() {
    if (!updateCheckResult?.latestRelease || !window.qiuDesktop) {
      return;
    }

    setIsInstallingUpdate(true);
    setUpdateNotice('');
    try {
      const result = await window.qiuDesktop.downloadAndInstallUpdate();
      setUpdateNotice(`已下载 ${result.releaseVersion}，正在启动安装程序。客户端会自动退出。`);
    } catch (error) {
      setUpdateNotice(`自动更新失败：${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setIsInstallingUpdate(false);
    }
  }

  function stageComposerFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.size >= 0);
    if (files.length === 0) {
      return;
    }

    const attachments = buildComposerAttachments(files);

    setComposerAttachments((current) => [...current, ...attachments]);
    animateAttachmentReadiness(setComposerAttachments, attachments);
  }

  function stageFactoryFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => file.size >= 0);
    if (files.length === 0) {
      return;
    }

    const attachments = buildComposerAttachments(files);
    setFactoryAttachments((current) => [...current, ...attachments]);
    animateAttachmentReadiness(setFactoryAttachments, attachments);
  }

  function buildComposerAttachments(files: File[]): ComposerAttachment[] {
    const stagedAt = new Date().toISOString();
    return files.map((file, index): ComposerAttachment => ({
      id: `attachment-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name || `附件 ${index + 1}`,
      size: file.size,
      type: file.type || undefined,
      localPath: getFileLocalPath(file),
      progress: 12,
      status: 'uploading',
      stagedAt
    }));
  }

  function animateAttachmentReadiness(
    setter: typeof setComposerAttachments,
    attachments: ComposerAttachment[]
  ) {
    for (const attachment of attachments) {
      for (const [delay, progress] of [
        [120, 42],
        [280, 76],
        [520, 100]
      ] as const) {
        window.setTimeout(() => {
          setter((current) =>
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

  function removeFactoryAttachment(attachmentId: string) {
    setFactoryAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
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

  function handleFactoryFileInputChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      stageFactoryFiles(event.target.files);
    }

    event.target.value = '';
  }

  function handleFactoryDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsFactoryDragOver(true);
  }

  function handleFactoryDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }

    setIsFactoryDragOver(false);
  }

  function handleFactoryDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setIsFactoryDragOver(false);
    stageFactoryFiles(event.dataTransfer.files);
  }

  function handleWindowControl(action: DesktopWindowControlAction) {
    void window.qiuDesktop?.controlWindow(action);
  }

  function openAccountModal(modal: AccountModalKey) {
    setAccountModal(modal);
    setSelectedLegalDocumentId('');
    setAccountMenuOpen(false);
  }

  async function copyDeviceDiagnostics() {
    const diagnostics = [
      `应用：${runtimeState.app.appName}`,
      `客户端版本：${runtimeState.app.appVersion}`,
      `系统平台：${runtimeState.app.platform} ${runtimeState.app.arch}`,
      `设备名称：${runtimeState.app.deviceName}`,
      `设备 ID：${runtimeState.localRuntime.deviceId}`,
      `运行时 ID：${runtimeState.localRuntime.runtimeId}`,
      `授权状态：${isEnterpriseUnbound ? '免费版（未绑定企业）' : '已绑定企业'}`,
      `工作区：${runtimeState.localRuntime.workspaceId}`,
      `控制端：${runtimeState.app.serverBaseUrl}`,
      `连接状态：${connectionLabel(runtimeState.serverConnection.state)}`,
      `最近同步：${formatDate(runtimeState.localRuntime.lastSyncedAt)}`,
      `数字员工：${installedDigitalEmployeePackages.length}`,
      `数字工厂：${installedDigitalFactoryPackages.length}`,
      `已启用模型：${enabledModelCount}`,
      `已启用工具：${enabledToolCount}`,
      `知识来源：${knowledgeBindingCount}`,
      `本地数据目录：${runtimeState.app.userDataPath}`
    ].join('\n');

    try {
      await navigator.clipboard.writeText(diagnostics);
      message.success('设备诊断信息已复制');
    } catch {
      message.error('复制失败，请手动复制设备信息');
    }
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
    const currentRolePackage = installedDigitalEmployeePackages.find(
      (rolePackage) => rolePackage.roleCode === runtimeState.localRuntime.activeRoleCode
    );
    if (currentRolePackage) {
      return currentRolePackage;
    }

    return (
      installedDigitalEmployeePackages.find(
        (rolePackage) => !isRuntimeRolePackageDeleted(runtimeState, rolePackage.roleCode)
      ) ?? installedDigitalEmployeePackages[0]
    );
  }, [installedDigitalEmployeePackages, runtimeState]);

  const selectedModelProfile = useMemo(() => {
    return runtimeState.modelProfiles.find((profile) => profile.id === selectedModelId);
  }, [runtimeState.modelProfiles, selectedModelId]);
  const selectedModelDefaultCredential = useMemo(() => {
    return selectedModelProfile
      ? findDefaultModelCredential(runtimeState.modelCredentials, selectedModelProfile.providerId)
      : undefined;
  }, [runtimeState.modelCredentials, selectedModelProfile]);
  const selectedModelFormCapabilities = Form.useWatch('capabilities', modelForm) as ModelCapability[] | undefined;
  const selectedModelRequiredCapabilities = useMemo(() => {
    if (!selectedModelProfile) {
      return [];
    }

    return normalizeModelCapabilities(
      Array.isArray(selectedModelFormCapabilities)
        ? selectedModelFormCapabilities
        : selectedModelProfile.capabilities,
      selectedModelProfile.purpose
    );
  }, [selectedModelFormCapabilities, selectedModelProfile]);

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
    setModelTestResult(null);
    setLatestPulledModelCatalog(null);
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
    const preferredModelName = capabilities.includes('audio_to_text')
      ? 'qwen3-asr-flash'
      : capabilities.includes('reasoning_text')
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
        createTaskDetailFromSummary(task, resolveRoleName(refreshedInstalledRolePackages, task.roleCode))
    );
  }, [orderedTasks, refreshedInstalledRolePackages, runtimeState.taskDetails]);

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

  const issueFeedbackTask = useMemo(
    () => taskDetails.find((task) => task.taskId === issueFeedbackTaskId),
    [issueFeedbackTaskId, taskDetails]
  );

  function openIssueFeedbackModal(task?: DesktopTaskDetail) {
    const defaultCategory: DesktopIssueCategory = task
      ? task.state === 'failed'
        ? 'BUG'
        : 'BAD_OUTPUT'
      : 'BUG';
    setIssueFeedbackTaskId(task?.taskId ?? '');
    setIssueFeedbackNotice('');
    issueFeedbackForm.setFieldsValue({
      category: defaultCategory,
      severity: task?.state === 'failed' ? 'IMPACTING' : 'NORMAL',
      title: task ? `任务问题：${task.title}` : '',
      description: '',
      contact: ''
    });
    setIssueFeedbackOpen(true);
    setAccountMenuOpen(false);
  }

  async function submitIssueFeedback(values: IssueFeedbackFormValues) {
    if (!window.qiuDesktop) {
      setIssueFeedbackNotice('当前运行环境不支持提交问题反馈。');
      return;
    }

    const payload: DesktopIssueReportSubmitRequest = {
      category: values.category,
      severity: values.severity,
      title: values.title.trim(),
      description: values.description.trim(),
      contact: values.contact?.trim() || undefined,
      workspaceId: isEnterpriseUnbound ? undefined : runtimeState.localRuntime.workspaceId,
      runtimeId: runtimeState.localRuntime.runtimeId,
      deviceId: runtimeState.localRuntime.deviceId,
      deviceName: runtimeState.app.deviceName,
      appVersion: runtimeState.app.appVersion,
      platform: runtimeState.app.platform,
      diagnostics: buildIssueFeedbackDiagnostics(issueFeedbackTask)
    };

    setIsSubmittingIssueFeedback(true);
    setIssueFeedbackNotice('');
    try {
      const response = await window.qiuDesktop.submitIssueReport(payload);
      message.success(`问题反馈已提交：${response.data.issueNo}`);
      setIssueFeedbackOpen(false);
      setIssueFeedbackTaskId('');
      issueFeedbackForm.resetFields();
    } catch (error) {
      setIssueFeedbackNotice(
        `提交失败：${error instanceof Error ? error.message : 'unknown error'}`
      );
    } finally {
      setIsSubmittingIssueFeedback(false);
    }
  }

  function buildIssueFeedbackDiagnostics(task?: DesktopTaskDetail) {
    const taskLogs = task?.executionLogs ?? [];
    const attachmentPaths = task?.executionContext?.attachmentPaths ?? [];
    return {
      appVersion: runtimeState.app.appVersion,
      platform: runtimeState.app.platform,
      arch: runtimeState.app.arch,
      deviceName: runtimeState.app.deviceName,
      runtimeId: runtimeState.localRuntime.runtimeId,
      deviceId: runtimeState.localRuntime.deviceId,
      workspaceId: isEnterpriseUnbound ? undefined : runtimeState.localRuntime.workspaceId,
      serverBaseUrl: runtimeState.app.serverBaseUrl,
      connectionState: runtimeState.serverConnection.state,
      task: task
        ? {
            taskId: task.taskId,
            taskTitle: task.title,
            taskState: task.state,
            roleCode: task.roleCode,
            roleName: task.roleName,
            updatedAt: task.updatedAt
          }
        : undefined,
      logs: taskLogs.slice(-24).map((log) => ({
        level: log.level,
        eventType: log.eventType,
        message: redactDiagnosticText(log.message).slice(0, 900),
        createdAt: log.createdAt
      })),
      models: runtimeState.modelProfiles.map((profile) => ({
        providerId: profile.providerId,
        providerName: profile.providerName,
        modelName: profile.modelName,
        purpose: profile.purpose,
        enabled: runtimeState.localRuntime.enabledModelProfileIds.includes(profile.id)
      })),
      tools: [
        ...runtimeState.tools.map((tool) => ({
          toolId: tool.id,
          enabled: runtimeState.localRuntime.enabledToolIds.includes(tool.id)
        })),
        ...((runtimeState.runtimeSnapshot.toolActions ?? []).map((action) => ({
          toolId: action.toolId,
          actionId: action.actionId,
          status: action.status,
          message: action.message ? redactDiagnosticText(action.message).slice(0, 300) : undefined
        })))
      ].slice(0, 80),
      files: attachmentPaths.slice(0, 20).map((filePath) => ({
        name: fileNameFromPath(filePath)
      })),
      notes: [
        'Diagnostics are sanitized on the desktop client before upload.',
        'API keys, local file contents, artifacts and full local paths are not included.'
      ]
    };
  }

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

  const installedRoleApplicationUsage = useMemo(() => {
    return countInstalledRoleApplications(refreshedInstalledRolePackages);
  }, [refreshedInstalledRolePackages]);

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
                    selectedSection === 'workbench' || selectedSection === 'factories'
                      ? 'product-surface product-surface-flush'
                      : 'product-surface product-surface-padded'
                  }
                >
                  {selectedSection === 'workbench' ? renderWorkbench() : null}
                  {selectedSection === 'factories' ? renderFactories() : null}
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
        {renderIssueFeedbackModal()}
        {renderRoleUninstallModal()}
        {renderRuntimeModelQuickSwitchModal()}
        {renderWatchConfigModal()}
        {renderRoleConfigModal()}
        {renderFactoryPackageEditorModal()}
        {renderFactoryScreeningProfileEditorModal()}
        {renderFactoryImagePreviewModal()}
        {renderUserAgreementModal()}
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
                  <BorderOutlined />
                  <span>设备信息</span>
                </button>
                <button type="button" onClick={() => openAccountModal('help')}>
                  <QuestionCircleOutlined />
                  <span>帮助中心</span>
                </button>
                <button type="button" onClick={() => openAccountModal('release')}>
                  <SafetyCertificateOutlined />
                  <span>协议与声明</span>
                </button>
                <button type="button" onClick={() => openAccountModal('download')}>
                  <CloudDownloadOutlined />
                  <span>版本与更新</span>
                </button>
                <button type="button" onClick={() => openIssueFeedbackModal()}>
                  <MessageOutlined />
                  <span>问题反馈</span>
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

  function renderUserAgreementModal() {
    const mustShowAgreement = !userAgreementStatus || !userAgreementStatus.accepted;
    const canAcceptAgreement =
      mustShowAgreement &&
      !isCheckingUserAgreement &&
      !isAcceptingUserAgreement &&
      userAgreementRemainingSeconds <= 0;

    return (
      <Modal
        title="欢迎使用 QiuAI WorkOS"
        open={mustShowAgreement}
        width={820}
        closable={false}
        maskClosable={false}
        destroyOnHidden={false}
        footer={
          <Flex align="center" justify="space-between" gap={12} wrap="wrap">
            <Typography.Text type={userAgreementRemainingSeconds > 0 ? 'secondary' : 'success'}>
              {isCheckingUserAgreement
                ? '正在校验协议状态'
                : userAgreementRemainingSeconds > 0
                ? `请阅读协议，${userAgreementRemainingSeconds} 秒后可同意`
                : '已达到最低阅读时间，可以同意'}
            </Typography.Text>
            <Space>
              <Button onClick={() => handleWindowControl('close')}>不同意并退出</Button>
              <Button
                type="primary"
                loading={isAcceptingUserAgreement}
                disabled={!canAcceptAgreement}
                onClick={() => void submitUserAgreementAcceptance()}
              >
                我已阅读并同意
              </Button>
            </Space>
          </Flex>
        }
      >
        <Space direction="vertical" size={14} className="user-agreement-modal-body">
          <div className="user-agreement-critical-notice">
            <Typography.Text strong>重点提示</Typography.Text>
            <Typography.Text type="secondary">
              使用本软件前，请确认你已阅读并理解 AI 输出需要人工复核、本地文件和企业数据需合法授权、第三方模型和工具由用户自行配置和承担相应责任、禁止违法违规用途等条款。
            </Typography.Text>
          </div>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="协议名称">{qiuaiUserAgreementDocument.title}</Descriptions.Item>
            <Descriptions.Item label="协议版本">
              {userAgreementStatus?.agreement.agreementVersion ?? qiuaiUserAgreementDocument.version}
            </Descriptions.Item>
            <Descriptions.Item label="生效日期">
              {userAgreementStatus?.agreement.effectiveDate ?? qiuaiUserAgreementDocument.effectiveDate}
            </Descriptions.Item>
            <Descriptions.Item label="内容指纹">
              <Typography.Text copyable ellipsis>
                {userAgreementStatus?.agreement.contentHash ?? '—'}
              </Typography.Text>
            </Descriptions.Item>
          </Descriptions>
          {userAgreementNotice ? (
            <Typography.Text type="danger">{userAgreementNotice}</Typography.Text>
          ) : null}
          <div className="user-agreement-scroll">
            <Typography.Title level={4}>{qiuaiUserAgreementDocument.title}</Typography.Title>
            <Typography.Text type="secondary">
              {qiuaiUserAgreementDocument.summary}
            </Typography.Text>
            <Space wrap className="user-agreement-basis">
              {qiuaiUserAgreementDocument.legalBasis.map((basis) => (
                <Tag key={basis}>{basis}</Tag>
              ))}
            </Space>
            {qiuaiUserAgreementDocument.sections.map((section) => (
              <section key={section.title} className="user-agreement-section">
                <Typography.Text strong>{section.title}</Typography.Text>
                {section.paragraphs.map((paragraph) => (
                  <Typography.Paragraph key={paragraph} type="secondary">
                    {paragraph}
                  </Typography.Paragraph>
                ))}
              </section>
            ))}
          </div>
        </Space>
      </Modal>
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

  function renderIssueFeedbackModal() {
    return (
      <Modal
        title="问题反馈"
        open={issueFeedbackOpen}
        width={680}
        destroyOnHidden
        okText="提交反馈"
        cancelText="取消"
        confirmLoading={isSubmittingIssueFeedback}
        onCancel={() => {
          setIssueFeedbackOpen(false);
          setIssueFeedbackTaskId('');
          setIssueFeedbackNotice('');
        }}
        onOk={() => issueFeedbackForm.submit()}
      >
        <Form<IssueFeedbackFormValues>
          form={issueFeedbackForm}
          layout="vertical"
          onFinish={(values) => void submitIssueFeedback(values)}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {issueFeedbackTask ? (
              <div className="issue-feedback-context">
                <Typography.Text strong>关联任务</Typography.Text>
                <Typography.Text type="secondary" ellipsis>
                  {issueFeedbackTask.title} · {taskStateLabel(issueFeedbackTask.state)}
                </Typography.Text>
              </div>
            ) : null}

            <Space size={12} style={{ width: '100%' }} align="start">
              <Form.Item
                name="category"
                label="问题类型"
                rules={[{ required: true, message: '请选择问题类型' }]}
                style={{ flex: 1 }}
              >
                <Select options={issueFeedbackCategoryOptions} />
              </Form.Item>
              <Form.Item
                name="severity"
                label="影响程度"
                rules={[{ required: true, message: '请选择影响程度' }]}
                style={{ width: 180 }}
              >
                <Select options={issueFeedbackSeverityOptions} />
              </Form.Item>
            </Space>

            <Form.Item
              name="title"
              label="标题"
              rules={[
                { required: true, message: '请填写标题' },
                { max: 120, message: '标题最多 120 字' }
              ]}
            >
              <Input placeholder="例如：视频质检任务运行失败" />
            </Form.Item>

            <Form.Item
              name="description"
              label="问题描述"
              rules={[
                { required: true, message: '请描述你遇到的问题' },
                { max: 4000, message: '问题描述最多 4000 字' }
              ]}
            >
              <Input.TextArea
                rows={6}
                showCount
                maxLength={4000}
                placeholder="请说明你做了什么、期望结果是什么、实际发生了什么。"
              />
            </Form.Item>

            <Form.Item name="contact" label="联系方式（选填）" rules={[{ max: 120, message: '联系方式最多 120 字' }]}>
              <Input placeholder="手机号、微信或邮箱，方便后续联系" />
            </Form.Item>

            <div className="issue-feedback-privacy-note">
              <InfoCircleOutlined />
              <Typography.Text type="secondary">
                提交时会自动附带客户端版本、设备状态、模型/工具状态和最近任务日志。不会上传 API Key、原始文件、产物内容或完整本地路径。
              </Typography.Text>
            </div>

            {issueFeedbackNotice ? (
              <Typography.Text type="danger">{issueFeedbackNotice}</Typography.Text>
            ) : null}
          </Space>
        </Form>
      </Modal>
    );
  }

  function renderAccountModal() {
    const open = Boolean(accountModal);
    const latestRelease = updateCheckResult?.latestRelease;
    const selectedLegalDocument = accountLegalDocuments.find(
      (document) => document.id === selectedLegalDocumentId
    );
    const accountModalWidth = accountModal === 'release' ? 860 : accountModal === 'help' ? 760 : 680;

    return (
      <Modal
        title={accountModalTitle(accountModal)}
        open={open}
        footer={null}
        width={accountModalWidth}
        destroyOnHidden
        onCancel={() => {
          setAccountModal(null);
          setSelectedLegalDocumentId('');
        }}
      >
        {accountModal === 'enterprise' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="授权状态">
                {isEnterpriseUnbound ? <Tag>免费版（未绑定企业）</Tag> : <Tag color="green">已绑定企业</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="工作区 ID">
                {isEnterpriseUnbound ? '未绑定企业工作区' : runtimeState.localRuntime.workspaceId}
              </Descriptions.Item>
              <Descriptions.Item label="设备名称">{runtimeState.app.deviceName}</Descriptions.Item>
              <Descriptions.Item label="设备 ID">{runtimeState.localRuntime.deviceId}</Descriptions.Item>
              <Descriptions.Item label="运行时 ID">{runtimeState.localRuntime.runtimeId}</Descriptions.Item>
              <Descriptions.Item label="客户端版本">{runtimeState.app.appVersion}</Descriptions.Item>
              <Descriptions.Item label="系统平台">
                {runtimeState.app.platform} / {runtimeState.app.arch}
              </Descriptions.Item>
              <Descriptions.Item label="控制端">{runtimeState.app.serverBaseUrl}</Descriptions.Item>
              <Descriptions.Item label="连接状态">
                <Tag color={connectionTone}>{connectionLabel(runtimeState.serverConnection.state)}</Tag>
                {runtimeState.serverConnection.latencyMs ? (
                  <Typography.Text type="secondary"> {runtimeState.serverConnection.latencyMs}ms</Typography.Text>
                ) : null}
              </Descriptions.Item>
              <Descriptions.Item label="最近同步">
                {formatDate(runtimeState.localRuntime.lastSyncedAt)}
              </Descriptions.Item>
              <Descriptions.Item label="本地数据目录">
                <Typography.Text copyable ellipsis>
                  {runtimeState.app.userDataPath}
                </Typography.Text>
              </Descriptions.Item>
            </Descriptions>

            <div className="account-stat-grid">
              <div>
                <Typography.Text strong>{installedDigitalEmployeePackages.length}</Typography.Text>
                <Typography.Text type="secondary">数字员工</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{installedDigitalFactoryPackages.length}</Typography.Text>
                <Typography.Text type="secondary">数字工厂</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{enabledModelCount}</Typography.Text>
                <Typography.Text type="secondary">已启用模型</Typography.Text>
              </div>
              <div>
                <Typography.Text strong>{enabledToolCount}</Typography.Text>
                <Typography.Text type="secondary">已启用工具</Typography.Text>
              </div>
            </div>

            <Space wrap>
              <Button icon={<CloudSyncOutlined />} loading={isRefreshing} onClick={refreshConnection}>
                检查连接
              </Button>
              <Button icon={<FolderOpenOutlined />} onClick={() => void openLocalPath(runtimeState.app.userDataPath)}>
                打开数据目录
              </Button>
              <Button icon={<InfoCircleOutlined />} onClick={() => void copyDeviceDiagnostics()}>
                复制诊断信息
              </Button>
            </Space>
          </Space>
        ) : null}

        {accountModal === 'help' ? (
          <Space direction="vertical" size={18} className="account-modal-body">
            {accountHelpSections.map((section) => (
              <section key={section.title} className="account-help-section">
                <Typography.Text strong>{section.title}</Typography.Text>
                <div className="account-help-grid">
                  {section.items.map((item) => (
                    <div key={item.question} className="account-help-item">
                      <Typography.Text strong>{item.question}</Typography.Text>
                      <Typography.Text type="secondary">{item.answer}</Typography.Text>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </Space>
        ) : null}

        {accountModal === 'release' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            {selectedLegalDocument ? (
              <>
                <Space direction="vertical" size={8} className="account-legal-header">
                  <Button size="small" icon={<RollbackOutlined />} onClick={() => setSelectedLegalDocumentId('')}>
                    返回协议列表
                  </Button>
                  <Typography.Title level={4}>{selectedLegalDocument.title}</Typography.Title>
                  <Typography.Text type="secondary">
                    版本 {selectedLegalDocument.version} · 生效日期 {selectedLegalDocument.effectiveDate}
                  </Typography.Text>
                  <Typography.Text type="secondary">{selectedLegalDocument.summary}</Typography.Text>
                  <Space wrap>
                    {selectedLegalDocument.legalBasis.map((basis) => (
                      <Tag key={basis}>{basis}</Tag>
                    ))}
                  </Space>
                </Space>
                <Divider />
                {selectedLegalDocument.sections.map((section) => (
                  <section key={section.title} className="account-legal-section">
                    <Typography.Text strong>{section.title}</Typography.Text>
                    {section.paragraphs.map((paragraph) => (
                      <Typography.Paragraph key={paragraph} type="secondary">
                        {paragraph}
                      </Typography.Paragraph>
                    ))}
                  </section>
                ))}
              </>
            ) : (
              <>
                <Typography.Paragraph type="secondary">
                  以下文件用于说明 QiuAI WorkOS 的法律责任、数据处理边界、AI 生成内容风险和软件授权规则。具体文本建议在正式商用前交由律师复核。
                </Typography.Paragraph>
                <div className="account-legal-list">
                  {accountLegalDocuments.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      className="account-legal-card"
                      onClick={() => setSelectedLegalDocumentId(document.id)}
                    >
                      <span>
                        <Typography.Text strong>{document.title}</Typography.Text>
                        <Typography.Text type="secondary">{document.summary}</Typography.Text>
                      </span>
                      <span className="account-legal-meta">
                        <Tag>{document.version}</Tag>
                        <Typography.Text type="secondary">{document.effectiveDate}</Typography.Text>
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Space>
        ) : null}

        {accountModal === 'download' ? (
          <Space direction="vertical" size={16} className="account-modal-body">
            <Typography.Paragraph type="secondary">
              客户端会从服务端读取管理后台“桌面版本”中已发布的 Windows stable 安装包。管理员上传并发布新版后，这里即可检查并下载。
            </Typography.Paragraph>
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
              {latestRelease?.minimumSupportedVersion ? (
                <Descriptions.Item label="最低支持版本">
                  {latestRelease.minimumSupportedVersion}
                </Descriptions.Item>
              ) : null}
              {latestRelease?.publishedAt ? (
                <Descriptions.Item label="发布时间">
                  {formatDate(latestRelease.publishedAt)}
                </Descriptions.Item>
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
                loading={isInstallingUpdate}
                disabled={!updateCheckResult?.updateAvailable || !latestRelease || isCheckingForUpdates}
                onClick={() => void downloadAndInstallUpdate()}
              >
                下载并安装新版
              </Button>
            </Space>
            <div className="account-update-note">
              <Typography.Text strong>管理员维护方式</Typography.Text>
              <Typography.Text type="secondary">
                在 admin-console 打开“桌面版本”，上传新版安装包，填写版本号、更新说明、最低支持版本和强制更新策略，确认无误后发布。
              </Typography.Text>
            </div>
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
        title={rolePackage ? `卸载：${rolePackage.name}` : '卸载应用'}
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
            卸载后，该应用将从当前电脑移除。历史任务和已生成产物仍会保留，以后可以在数字市场重新安装。
          </Typography.Paragraph>
          {hasBlockingTasks ? (
            <div className="role-uninstall-blocking-note">
              <Typography.Text strong>该应用还有未结束任务，完成或取消后再卸载。</Typography.Text>
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

  function renderFactoryPackageEditorModal() {
    return (
      <Modal
        title="编辑产物包"
        open={factoryPackageEditorOpen}
        width={720}
        destroyOnHidden
        onCancel={() => setFactoryPackageEditorOpen(false)}
        footer={[
          <Button key="restore" onClick={restoreFactoryPackageDefaults}>
            恢复官方默认
          </Button>,
          <Button key="add" icon={<PlusOutlined />} onClick={addFactoryPackageEditorDraft}>
            新增产物包
          </Button>,
          <Button key="apply" onClick={() => applyFactoryPackageEditorDraft()}>
            应用本次
          </Button>,
          <Button key="save" type="primary" onClick={() => applyFactoryPackageEditorDraft({ saveAsDefault: true })}>
            保存为本机默认
          </Button>
        ]}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Typography.Text type="secondary">
            这里调整的是当前电脑的运行配置。官方模板仍由服务端维护，恢复默认可回到服务端模板。
          </Typography.Text>
          <div className="factory-package-editor-list">
            {factoryPackageEditorDraft.map((item, index) => (
              <div key={item.key} className="factory-package-editor-item">
                <div className="factory-package-editor-row">
                  <Input
                    value={item.label}
                    maxLength={32}
                    placeholder="产物包名称"
                    onChange={(event) =>
                      updateFactoryPackageEditorDraft(index, { label: event.target.value })
                    }
                  />
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    disabled={factoryPackageEditorDraft.length <= 1}
                    onClick={() => removeFactoryPackageEditorDraft(index)}
                  />
                </div>
                <Input.TextArea
                  value={item.description}
                  rows={2}
                  maxLength={160}
                  placeholder="说明这个产物包要生成什么，提示词模型会参考这里写生图提示词。"
                  onChange={(event) =>
                    updateFactoryPackageEditorDraft(index, { description: event.target.value })
                  }
                />
              </div>
            ))}
          </div>
        </Space>
      </Modal>
    );
  }

  function renderFactoryScreeningRuleValueControl(
    gateIndex: number,
    ruleIndex: number,
    rule: FactoryVideoScreeningRuleDefinition,
    readOnly: boolean
  ) {
    const metric = findFactoryVideoScreeningMetric(rule.metric) ?? factoryVideoScreeningMetricOptions[0];
    if (metric.type === 'boolean') {
      return (
        <Select
          size="large"
          disabled={readOnly}
          value={rule.value === false ? 'false' : 'true'}
          options={[
            { value: 'true', label: '是' },
            { value: 'false', label: '否' }
          ]}
          onChange={(value) => updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, { value: value === 'true' })}
        />
      );
    }

    if (rule.operator === 'between') {
      const bounds = Array.isArray(rule.value) ? rule.value.map((item) => Number(item)) : [0, 1];
      return (
        <Space.Compact block>
          <InputNumber
            size="large"
            disabled={readOnly}
            value={Number.isFinite(bounds[0]) ? bounds[0] : undefined}
            step={metric.key === 'durationSeconds' || metric.key === 'transcriptChars' ? 1 : 0.05}
            placeholder="最小值"
            onChange={(value) =>
              updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, {
                value: [typeof value === 'number' ? value : 0, Number.isFinite(bounds[1]) ? bounds[1] : 1]
              })
            }
          />
          <InputNumber
            size="large"
            disabled={readOnly}
            value={Number.isFinite(bounds[1]) ? bounds[1] : undefined}
            step={metric.key === 'durationSeconds' || metric.key === 'transcriptChars' ? 1 : 0.05}
            placeholder="最大值"
            onChange={(value) =>
              updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, {
                value: [Number.isFinite(bounds[0]) ? bounds[0] : 0, typeof value === 'number' ? value : 1]
              })
            }
          />
        </Space.Compact>
      );
    }

    return (
      <InputNumber
        size="large"
        disabled={readOnly}
        value={typeof rule.value === 'number' ? rule.value : undefined}
        step={metric.key === 'durationSeconds' || metric.key === 'transcriptChars' ? 1 : 0.05}
        placeholder="阈值"
        onChange={(value) =>
          updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, {
            value: typeof value === 'number' ? value : metric.defaultValue
          })
        }
      />
    );
  }

  function renderFactoryScreeningProfileEditorModal() {
    const selectedProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    const readOnly = !selectedProfile?.custom;

    return (
      <Modal
        title="筛选标准库"
        open={factoryScreeningEditorOpen}
        width={980}
        destroyOnHidden
        onCancel={() => setFactoryScreeningEditorOpen(false)}
        footer={[
          <Button key="restore" onClick={restoreFactoryScreeningProfileDefaults}>
            恢复系统模板
          </Button>,
          <Button key="add" icon={<PlusOutlined />} onClick={addFactoryScreeningProfileDraft}>
            新增标准
          </Button>,
          <Button key="save" type="primary" onClick={applyFactoryScreeningProfileEditor}>
            保存并应用
          </Button>
        ]}
      >
        <div className="factory-screening-editor">
          <aside className="factory-screening-profile-list">
            <Typography.Text type="secondary">
              系统模板只读。需要修改时，先新增标准或复制当前模板。
            </Typography.Text>
            {factoryScreeningEditorProfiles.map((profile) => (
              <button
                key={profile.key}
                type="button"
                className={
                  profile.key === factoryScreeningEditorSelectedKey
                    ? 'factory-screening-profile-item selected'
                    : 'factory-screening-profile-item'
                }
                onClick={() => setFactoryScreeningEditorSelectedKey(profile.key)}
              >
                <span>
                  <Typography.Text strong ellipsis>
                    {profile.label}
                  </Typography.Text>
                  <Tag color={profile.custom ? 'blue' : 'default'}>{profile.custom ? '自定义' : '系统'}</Tag>
                </span>
                {profile.description ? (
                  <Typography.Text type="secondary" ellipsis>
                    {profile.description}
                  </Typography.Text>
                ) : null}
              </button>
            ))}
          </aside>

          <section className="factory-screening-profile-detail">
            {selectedProfile ? (
              <>
                <Flex align="center" justify="space-between" gap={12} wrap>
                  <Space direction="vertical" size={2}>
                    <Typography.Text strong>{selectedProfile.label}</Typography.Text>
                    <Typography.Text type="secondary">
                      {readOnly ? '这是系统模板，复制后才能编辑。' : '这是本机自定义标准，可以编辑、删除和保存。'}
                    </Typography.Text>
                  </Space>
                  <Space>
                    {readOnly ? (
                      <Button icon={<PlusOutlined />} onClick={addFactoryScreeningProfileDraft}>
                        复制为自定义
                      </Button>
                    ) : (
                      <Popconfirm
                        title="删除这个自定义筛选标准？"
                        description="删除后不会影响系统模板，已完成的任务记录也会保留。"
                        okText="删除"
                        cancelText="取消"
                        onConfirm={removeFactoryScreeningProfileDraft}
                      >
                        <Button danger icon={<DeleteOutlined />}>
                          删除
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Flex>

                <div className="factory-screening-profile-fields">
                  <Input
                    size="large"
                    disabled={readOnly}
                    value={selectedProfile.label}
                    maxLength={40}
                    placeholder="筛选标准名称"
                    onChange={(event) => updateFactoryScreeningProfileDraft({ label: event.target.value })}
                  />
                  <Input.TextArea
                    disabled={readOnly}
                    value={selectedProfile.description}
                    rows={2}
                    maxLength={180}
                    placeholder="说明这个标准适合什么客户或什么视频素材。"
                    onChange={(event) => updateFactoryScreeningProfileDraft({ description: event.target.value })}
                  />
                </div>

                <div className="factory-screening-gate-list">
                  {selectedProfile.gates.map((gate, gateIndex) => (
                    <div key={gate.id} className="factory-screening-gate-card">
                      <Flex align="center" justify="space-between" gap={12} wrap>
                        <Space direction="vertical" size={2}>
                          <Input
                            size="large"
                            disabled={readOnly}
                            value={gate.name}
                            maxLength={24}
                            onChange={(event) =>
                              updateFactoryScreeningGateDraft(gateIndex, { name: event.target.value })
                            }
                          />
                          {gate.description ? (
                            <Typography.Text type="secondary">{gate.description}</Typography.Text>
                          ) : null}
                        </Space>
                        <Button disabled={readOnly} icon={<PlusOutlined />} onClick={() => addFactoryScreeningRuleDraft(gateIndex)}>
                          新增规则
                        </Button>
                      </Flex>

                      <div className="factory-screening-rule-list">
                        {gate.rules.map((rule, ruleIndex) => {
                          const metric = findFactoryVideoScreeningMetric(rule.metric) ?? factoryVideoScreeningMetricOptions[0];
                          const operatorOptions = factoryVideoScreeningOperatorOptions.filter(
                            (operator) =>
                              metric.type === 'number' || operator.value === 'equals' || operator.value === 'notEquals'
                          );

                          return (
                            <div key={`${rule.metric}-${ruleIndex}`} className="factory-screening-rule-row">
                              <Select
                                size="large"
                                disabled={readOnly}
                                value={rule.metric}
                                options={factoryVideoScreeningMetricOptions.map((item) => ({
                                  value: item.key,
                                  label: item.label
                                }))}
                                onChange={(value) => changeFactoryScreeningRuleMetric(gateIndex, ruleIndex, value)}
                              />
                              <Select
                                size="large"
                                disabled={readOnly}
                                value={rule.operator}
                                options={operatorOptions}
                                onChange={(value) =>
                                  updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, {
                                    operator: value,
                                    value: normalizeFactoryScreeningRuleValue(rule.value, metric, value)
                                  })
                                }
                              />
                              {renderFactoryScreeningRuleValueControl(gateIndex, ruleIndex, rule, readOnly)}
                              <Input
                                size="large"
                                disabled={readOnly}
                                value={rule.failReason}
                                maxLength={80}
                                placeholder="不通过原因"
                                onChange={(event) =>
                                  updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, {
                                    failReason: event.target.value
                                  })
                                }
                              />
                              <Button
                                danger
                                disabled={readOnly || gate.rules.length <= 1}
                                icon={<DeleteOutlined />}
                                onClick={() => removeFactoryScreeningRuleDraft(gateIndex, ruleIndex)}
                              />
                              <Typography.Text type="secondary" className="factory-screening-rule-hint">
                                {metric.description}
                              </Typography.Text>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无筛选标准" />
            )}
          </section>
        </div>
      </Modal>
    );
  }

  function renderFactoryImagePreviewModal() {
    const imageSrc = previewFactoryImage ? getFactoryPreviewImageSrc(previewFactoryImage) : '';
    const title = previewFactoryImage
      ? `${previewFactoryImage.sku} / ${previewFactoryImage.packageLabel}`
      : '图片预览';

    return (
      <Modal
        title={title}
        open={Boolean(previewFactoryImage)}
        footer={[
          <Button key="close" onClick={() => setPreviewFactoryImage(null)}>
            关闭
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<DownloadOutlined />}
            disabled={!previewFactoryImage?.remoteUrl}
            loading={savingFactoryImageId === previewFactoryImage?.id}
            onClick={() => previewFactoryImage && void saveFactoryPreviewImage(previewFactoryImage)}
          >
            保存图片
          </Button>
        ]}
        width={760}
        centered
        destroyOnHidden
        onCancel={() => setPreviewFactoryImage(null)}
      >
        <div className="factory-preview-modal-body">
          {imageSrc ? (
            <img className="factory-preview-modal-image" src={imageSrc} alt={title} />
          ) : (
            <Empty description="没有可预览的图片地址" />
          )}
          {previewFactoryImage?.remoteUrl ? (
            <Typography.Paragraph className="factory-preview-url" copyable>
              {previewFactoryImage.remoteUrl}
            </Typography.Paragraph>
          ) : null}
        </div>
      </Modal>
    );
  }

  function openRuntimeModelQuickSwitch(roleCode: string) {
    const rolePackage = getPreparedInstalledRolePackage(roleCode);
    if (!rolePackage) {
      message.warning('该应用未安装在当前电脑，请先安装后再切换模型。');
      return;
    }

    const normalizedModelProfileIds = readRequiredModelProfileIdsForRolePackage(rolePackage);
    const credentialValues = buildRoleModelCredentialFormValues(
      rolePackage.roleCode,
      normalizedModelProfileIds,
      runtimeState.roleModelCredentialBindings
    );

    runtimeModelQuickSwitchForm.setFieldsValue({
      runtimeModels: Object.fromEntries(
        normalizedModelProfileIds.map((modelProfileId) => [
          modelProfileId,
          credentialValues[modelProfileId]?.runtimeModelProfileId ?? modelProfileId
        ])
      )
    });
    setRuntimeModelQuickSwitchRoleCode(rolePackage.roleCode);
    setRuntimeModelQuickSwitchOpen(true);
  }

  function closeRuntimeModelQuickSwitch() {
    setRuntimeModelQuickSwitchOpen(false);
    setRuntimeModelQuickSwitchRoleCode('');
    runtimeModelQuickSwitchForm.resetFields();
  }

  function submitRuntimeModelQuickSwitch(values: RuntimeModelQuickSwitchFormValues) {
    const rolePackage = getPreparedInstalledRolePackage(runtimeModelQuickSwitchRoleCode);
    if (!rolePackage) {
      closeRuntimeModelQuickSwitch();
      return;
    }

    const normalizedModelProfileIds = readRequiredModelProfileIdsForRolePackage(rolePackage);
    const selectedRuntimeModelProfileIds = Object.values(values.runtimeModels ?? {})
      .map((profileId) => profileId?.trim())
      .filter((profileId): profileId is string => Boolean(profileId));
    setRuntimeState((current) => ({
      ...current,
      localRuntime: {
        ...current.localRuntime,
        enabledModelProfileIds: mergeUniqueStrings(
          current.localRuntime.enabledModelProfileIds,
          selectedRuntimeModelProfileIds
        )
      },
      roleModelCredentialBindings: buildRoleModelCredentialBindingsWithRuntimeModelSelections(
        rolePackage.roleCode,
        normalizedModelProfileIds,
        current.roleModelCredentialBindings,
        values.runtimeModels
      )
    }));
    message.success('当前调用模型已保存。');
    closeRuntimeModelQuickSwitch();
  }

  function renderRuntimeModelQuickSwitchModal() {
    const rolePackage = runtimeModelQuickSwitchRoleCode
      ? getPreparedInstalledRolePackage(runtimeModelQuickSwitchRoleCode)
      : undefined;
    const requirements = rolePackage
      ? getRoleModelRuntimeRequirementStatuses(
          runtimeState.modelProfiles,
          runtimeState.localRuntime.enabledModelProfileIds,
          rolePackage,
          {
            roleCode: rolePackage.roleCode,
            credentials: runtimeState.modelCredentials,
            roleBindings: runtimeState.roleModelCredentialBindings
          }
        )
      : [];

    return (
      <Modal
        open={runtimeModelQuickSwitchOpen}
        title={rolePackage ? `当前调用模型：${rolePackage.name}` : '当前调用模型'}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnHidden
        onCancel={closeRuntimeModelQuickSwitch}
        onOk={() => runtimeModelQuickSwitchForm.submit()}
      >
        {rolePackage ? (
          <Form<RuntimeModelQuickSwitchFormValues>
            form={runtimeModelQuickSwitchForm}
            layout="vertical"
            onFinish={submitRuntimeModelQuickSwitch}
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div className="runtime-model-quick-note">
                <InfoCircleOutlined />
                <Typography.Text type="secondary">
                  这里只切换当前应用各模型槽位实际调用的模型。API Key、工具、知识库请在“模型与工具”里配置。
                </Typography.Text>
              </div>

              {requirements.length > 0 ? (
                requirements.map((requirement) => {
                  const binding = runtimeState.roleModelCredentialBindings.find(
                    (item) =>
                      item.roleCode === rolePackage.roleCode &&
                      item.modelProfileId === requirement.profile.id
                  );
                  const runtimeModelProfileId =
                    requirement.runtimeProfileId ?? binding?.runtimeModelProfileId ?? requirement.profile.id;
                  const runtimeProfile =
                    requirement.runtimeProfile ??
                    runtimeState.modelProfiles.find((profile) => profile.id === runtimeModelProfileId) ??
                    requirement.profile;
                  const runtimeReady = requirement.ready;

                  return (
                    <div key={requirement.profile.id} className="runtime-model-switch-item">
                      <Flex align="flex-start" justify="space-between" gap={12} wrap="wrap">
                        <Space direction="vertical" size={2}>
                          <Typography.Text strong>
                            {modelCapabilitySummary(requirement.profile.capabilities, requirement.profile.purpose)}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            槽位：{requirement.profile.providerName} / {requirement.profile.modelName}
                          </Typography.Text>
                        </Space>
                        <Tag color={runtimeReady ? 'green' : 'orange'}>
                          {runtimeReady ? '当前可用' : '待配置'}
                        </Tag>
                      </Flex>
                      <Form.Item
                        name={['runtimeModels', requirement.profile.id]}
                        label="实际调用模型"
                        tooltip="显示输入输出能力兼容且已配置的本机模型，保存后会自动启用所选模型。"
                      >
                        <Select
                          showSearch
                          optionFilterProp="label"
                          placeholder="选择实际调用模型"
                          options={buildCompatibleRuntimeModelOptions(
                            runtimeState,
                            requirement.profile,
                            rolePackage.roleCode
                          )}
                        />
                      </Form.Item>
                    </div>
                  );
                })
              ) : (
                <Empty description="当前应用没有声明模型槽位" />
              )}
            </Space>
          </Form>
        ) : (
          <Empty description="未找到已安装应用" />
        )}
      </Modal>
    );
  }

  function renderWatchConfigModal() {
    const rolePackage = watchConfigRoleCode
      ? refreshedInstalledRolePackageByRoleCode.get(watchConfigRoleCode) ??
        runtimeState.rolePackages.find((item) => item.roleCode === watchConfigRoleCode)
      : undefined;

    return (
      <Modal
        open={watchConfigModalOpen}
        title={`值守配置${rolePackage ? `：${rolePackage.name}` : ''}`}
        width={680}
        destroyOnHidden
        onCancel={closeWatchConfig}
        onOk={() => watchConfigForm.submit()}
      >
        <Form<WatchConfigFormValues>
          form={watchConfigForm}
          layout="vertical"
          onFinish={saveWatchConfig}
        >
          <Form.Item name="enabled" valuePropName="checked">
            <Switch checkedChildren="启用" unCheckedChildren="暂停" />
          </Form.Item>
          <Form.Item
            name="sourceUrls"
            label="值守网页 URL"
            extra="每行一个 URL。第一版每次按顺序巡检一个来源，保留登录态；遇到登录失效或验证码会停在页面等待人工处理。"
            rules={[{ required: true, message: '请填写至少一个 URL' }]}
          >
            <Input.TextArea autoSize={{ minRows: 4, maxRows: 8 }} placeholder="https://example.com/list" />
          </Form.Item>
          <Flex gap={12} wrap="wrap">
            <Form.Item
              name="intervalMinutes"
              label="巡检间隔"
              className="watch-config-inline-field"
              rules={[{ required: true, message: '请设置巡检间隔' }]}
            >
              <InputNumber min={5} max={1440} addonAfter="分钟" />
            </Form.Item>
            <Form.Item
              name="approvalMode"
              label="动作边界"
              className="watch-config-inline-field wide"
              rules={[{ required: true, message: '请选择动作边界' }]}
            >
              <Select
                options={watchApprovalModeOptions.map((option) => ({
                  value: option.value,
                  label: option.label
                }))}
              />
            </Form.Item>
          </Flex>
          <Form.Item
            name="rules"
            label="值守规则"
            extra="写清楚筛选、评分、排除、输出和人工确认要求。"
            rules={[{ required: true, message: '请填写值守规则' }]}
          >
            <Input.TextArea autoSize={{ minRows: 5, maxRows: 10 }} />
          </Form.Item>
          <div className="watch-approval-hints">
            {watchApprovalModeOptions.map((option) => (
              <div key={option.value}>
                <Typography.Text strong>{option.label}</Typography.Text>
                <Typography.Text type="secondary">{option.description}</Typography.Text>
              </div>
            ))}
          </div>
        </Form>
      </Modal>
    );
  }

  function buildRuntimeModelSummaryItems(rolePackage: RolePackageManifest | undefined) {
    if (!rolePackage) {
      return [];
    }

    return getRoleModelRuntimeRequirementStatuses(
      runtimeState.modelProfiles,
      runtimeState.localRuntime.enabledModelProfileIds,
      rolePackage,
      {
        roleCode: rolePackage.roleCode,
        credentials: runtimeState.modelCredentials,
        roleBindings: runtimeState.roleModelCredentialBindings
      }
    ).map((requirement) => {
      const runtimeModelProfileId = runtimeState.roleModelCredentialBindings.find(
        (binding) =>
          binding.roleCode === rolePackage.roleCode &&
          binding.modelProfileId === requirement.profile.id &&
          binding.runtimeModelProfileId
      )?.runtimeModelProfileId;
      const runtimeProfile = runtimeModelProfileId
        ? runtimeState.modelProfiles.find((profile) => profile.id === runtimeModelProfileId)
        : undefined;
      const displayProfile = requirement.runtimeProfile ?? runtimeProfile ?? requirement.profile;

      return {
        key: requirement.profile.id,
        capability: modelCapabilitySummary(requirement.profile.capabilities, requirement.profile.purpose),
        model: `${displayProfile.providerName} / ${displayProfile.modelName}`,
        ready: requirement.ready
      };
    });
  }

  function renderRuntimeModelSummaryStrip(input: {
    rolePackage?: RolePackageManifest;
    compact?: boolean;
    onQuickSwitch: () => void;
  }) {
    const items = buildRuntimeModelSummaryItems(input.rolePackage);

    if (!input.rolePackage) {
      return null;
    }

    return (
      <button
        type="button"
        className={input.compact ? 'runtime-model-strip compact' : 'runtime-model-strip'}
        onClick={input.onQuickSwitch}
        title="点击快速切换当前调用模型"
        aria-label="点击快速切换当前调用模型"
      >
        <ApiOutlined />
        <span className="runtime-model-strip-label">当前调用模型</span>
        <span className="runtime-model-strip-items">
          {items.length > 0 ? (
            items.slice(0, 3).map((item) => (
              <span key={item.key} className={item.ready ? 'runtime-model-chip ready' : 'runtime-model-chip warning'}>
                <span>{item.capability}</span>
                <strong>{item.model}</strong>
              </span>
            ))
          ) : (
            <span className="runtime-model-chip warning">
              <span>模型</span>
              <strong>未声明</strong>
            </span>
          )}
          {items.length > 3 ? <span className="runtime-model-more">+{items.length - 3}</span> : null}
        </span>
        <SettingOutlined />
      </button>
    );
  }

  function renderWatchControlPanel(rolePackage: RolePackageManifest, disabled: boolean) {
    const config = findRoleWatchConfig(runtimeState, rolePackage.roleCode);
    const latestRun = getRuntimeWatchRuns(runtimeState, rolePackage.roleCode)[0];
    const enabled = config?.enabled === true;
    const ready = Boolean(config?.sourceUrls.length);
    const nextRunText = config?.nextRunAt ? formatDate(config.nextRunAt) : enabled ? '等待调度' : '未启用';
    const statusColor =
      config?.lastStatus === 'failed'
        ? 'red'
        : enabled
          ? 'green'
          : config?.lastStatus === 'running'
            ? 'blue'
            : 'default';

    return (
      <div className="watch-control-panel">
        <Flex align="center" justify="space-between" gap={12} wrap="wrap">
          <Space direction="vertical" size={2}>
            <Space size={8} wrap>
              <Typography.Text strong>值守模式</Typography.Text>
              <Tag color={statusColor}>{enabled ? '已启用' : config ? '已暂停' : '未配置'}</Tag>
              <Tag>{config?.sourceUrls.length ?? 0} 个来源</Tag>
              <Tag>{config ? `${config.intervalMinutes} 分钟/次` : '未设置频率'}</Tag>
              <Tag>{config ? watchApprovalModeLabel(config.approvalMode) : '人工确认边界'}</Tag>
            </Space>
            <Typography.Text type="secondary" className="watch-control-meta">
              下次运行：{nextRunText}
              {latestRun ? ` · 最近运行：${watchRunStatusLabel(latestRun.status)} / ${formatShortTime(latestRun.startedAt)}` : ''}
              {config?.lastError ? ` · ${config.lastError}` : ''}
            </Typography.Text>
          </Space>
          <Space size={8} wrap>
            <Switch
              size="small"
              checked={enabled}
              disabled={disabled || (!ready && !enabled)}
              checkedChildren="启用"
              unCheckedChildren="暂停"
              onChange={(checked) => toggleWatchConfig(rolePackage.roleCode, checked)}
            />
            <Button size="small" onClick={() => openWatchConfig(rolePackage.roleCode)}>
              配置值守
            </Button>
            <Button
              size="small"
              type="primary"
              ghost
              icon={<PlayCircleOutlined />}
              disabled={disabled || !ready || runningWatchRoleCodesRef.current.has(rolePackage.roleCode)}
              onClick={() => void runWatchNow(rolePackage.roleCode)}
            >
              立即巡检
            </Button>
          </Space>
        </Flex>
      </div>
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
        createTaskDetailFromSummary(task, resolveRoleName(refreshedInstalledRolePackages, task.roleCode));
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
      refreshedInstalledRolePackageByRoleCode.get(activeRoleCode) ??
      activeRolePackage;
    const openConversationConfig = () => {
      if (!conversationRole) {
        return;
      }
      setSelectedRoleApplicationType('digital_employee');
      setSelectedRoleCategory('全部');
      openRoleConfig(conversationRole.roleCode, 'configure');
    };
    const openConversationRuntimeModelQuickSwitch = () => {
      if (!conversationRole) {
        return;
      }
      openRuntimeModelQuickSwitch(conversationRole.roleCode);
    };
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
            {installedDigitalEmployeePackages.map((rolePackage) => {
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
            {installedDigitalEmployeePackages.length === 0 ? (
              <div className="agent-session-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已安装数字员工" />
                <Button size="small" type="primary" onClick={() => navigateToSection('roles')}>
                  去数字市场安装
                </Button>
              </div>
            ) : null}
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
                {renderRuntimeModelSummaryStrip({
                  rolePackage: conversationRole,
                  compact: true,
                  onQuickSwitch: openConversationRuntimeModelQuickSwitch
                })}
              </Space>
            </Space>

            <Space wrap>
              <Tag color="geekblue">运行中 {runningTaskCount}</Tag>
              <Tag color="gold">待处理 {waitingTaskCount}</Tag>
              <Tag color="green">已完成 {completedTaskCount}</Tag>
              <Button size="small" disabled={activeRoleDeleted} onClick={startNewConversationTask}>
                新任务
              </Button>
              <Button
                size="small"
                icon={<SettingOutlined />}
                disabled={!conversationRole}
                onClick={openConversationConfig}
              >
                模型与工具
              </Button>
            </Space>
          </header>

          {conversationRole && isWatchRolePackage(conversationRole)
            ? renderWatchControlPanel(conversationRole, activeRoleDeleted)
            : null}

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
                        {conversationTask.state === 'failed' ? (
                          <Button
                            size="small"
                            icon={<MessageOutlined />}
                            className="process-log-link"
                            onClick={() => openIssueFeedbackModal(conversationTask)}
                          >
                            提交问题反馈
                          </Button>
                        ) : null}
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
                          const factoryPreview = artifact.factoryPreview;
                          if (factoryPreview?.kind === 'digital_factory_image_batch') {
                            const previewItems = [...factoryPreview.items].sort((left, right) => left.order - right.order);
                            return (
                              <div key={artifact.id} className="chat-artifact-card factory-artifact-card">
                                <div className="factory-artifact-header">
                                  <div className="artifact-file-icon image">
                                    <FileImageOutlined />
                                  </div>
                                  <div className="artifact-file-main">
                                    <div className="artifact-file-title-row">
                                      <Typography.Text strong ellipsis title={artifact.title}>
                                        {artifact.title}
                                      </Typography.Text>
                                      <Tag className="artifact-file-type">图片批次</Tag>
                                    </div>
                                    <Typography.Text type="secondary" className="artifact-file-meta">
                                      {formatFactoryPreviewMeta(factoryPreview)}
                                    </Typography.Text>
                                  </div>
                                </div>
                                <div className="factory-preview-grid">
                                  {previewItems.map((item) => {
                                    const imageSrc = getFactoryPreviewImageSrc(item);
                                    return (
                                      <button
                                        key={item.id}
                                        type="button"
                                        className={`factory-preview-tile ${item.status}`}
                                        disabled={!imageSrc}
                                        title={item.error ?? `${item.sku} / ${item.packageLabel}`}
                                        onClick={() => setPreviewFactoryImage(item)}
                                      >
                                        <span className="factory-preview-thumb">
                                          {imageSrc ? (
                                            <img src={imageSrc} alt={`${item.sku} ${item.packageLabel}`} loading="lazy" />
                                          ) : (
                                            <FileImageOutlined />
                                          )}
                                        </span>
                                        <span className="factory-preview-caption">
                                          <span>{item.sku}</span>
                                          <span>{item.packageLabel}</span>
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }

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
                <MessageOutlined />
                <Typography.Title level={3}>选择数字员工，直接开始对话</Typography.Title>
                <Typography.Text type="secondary">
                  安装数字员工后，可以在这里下达任务、上传文件并查看交付结果。
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

  function renderFactories() {
    const latestTaskByFactory = new Map<string, DesktopTaskDetail>();

    for (const task of taskDetails) {
      if (latestTaskByFactory.has(task.roleCode)) {
        continue;
      }
      latestTaskByFactory.set(task.roleCode, task);
    }

    const selectedFactoryPackage =
      installedDigitalFactoryPackages.find((rolePackage) => rolePackage.roleCode === selectedFactoryRoleCode) ??
      installedDigitalFactoryPackages[0];
    const selectedFactoryCode = selectedFactoryPackage?.roleCode ?? '';
    const selectedFactoryTasks = selectedFactoryCode
      ? taskDetails
          .filter((task) => task.roleCode === selectedFactoryCode)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      : [];
    const focusedFactoryTask =
      selectedFactoryTasks.find((task) => task.taskId === selectedTaskId) ?? selectedFactoryTasks[0];
    const selectedFactoryDeleted = selectedFactoryCode
      ? isRuntimeRolePackageDeleted(runtimeState, selectedFactoryCode)
      : false;
    const selectedFactoryTemplate = selectedFactoryCode
      ? desktopRoleTemplateByRoleCode.get(selectedFactoryCode)
      : undefined;
    const selectedFactoryManifest = readFactoryManifest(
      selectedFactoryPackage?.dependencyManifest ?? selectedFactoryTemplate?.dependencyManifest
    );
    const selectedFactoryFileContract = selectedFactoryPackage
      ? buildRoleFileContractSummary(selectedFactoryPackage)
      : undefined;
    const selectedFactoryReadiness = selectedFactoryPackage
      ? buildRoleRuntimeReadiness(runtimeState, selectedFactoryPackage)
      : undefined;
    const maxItems = readFactoryMaxItems(selectedFactoryManifest);
    const isVideoFactory = isMedicalCaseVideoFactory(selectedFactoryManifest);
    const packageOptions = readFactoryPackageOptions(selectedFactoryManifest);
    const platformOptions = readFactoryPlatformOptions(selectedFactoryManifest);
    const qualityModes = readFactoryQualityModes(selectedFactoryManifest);
    const promptControlFields = readFactoryPromptControlFields(selectedFactoryManifest);
    const screeningProfiles = readFactoryScreeningProfiles(selectedFactoryManifest, selectedFactoryCode);
    const selectedFactoryPreparedPackage = selectedFactoryPackage
      ? {
          ...selectedFactoryPackage,
          modelProfileIds: readRequiredModelProfileIdsForRolePackage(selectedFactoryPackage)
        }
      : undefined;
    const selectedFactoryPreparedProfiles = selectedFactoryPreparedPackage
      ? ensureModelProfilesForRolePackage(runtimeState.modelProfiles, selectedFactoryPreparedPackage)
      : [];
    const selectedFactoryModelReadiness = selectedFactoryPreparedPackage
      ? getRoleModelRuntimeRequirementStatuses(
          selectedFactoryPreparedProfiles,
          runtimeState.localRuntime.enabledModelProfileIds,
          selectedFactoryPreparedPackage,
          {
            roleCode: selectedFactoryPreparedPackage.roleCode,
            credentials: runtimeState.modelCredentials,
            roleBindings: runtimeState.roleModelCredentialBindings
          }
        )
      : [];
    const dialectOptions = readFactoryAsrDialectOptions(selectedFactoryManifest);
    const targetSecondOptions = selectedFactoryManifest.editing?.targetSecondOptions?.length
      ? selectedFactoryManifest.editing.targetSecondOptions
      : [15, 30, 45];
    const audioProfileOptions = selectedFactoryModelReadiness
      .filter((requirement) => readModelProfileCapabilities(requirement.profile).includes('audio_to_text'))
      .map((requirement) => {
        const profile = requirement.profile;
        const suffix = [
          requirement.enabled ? '' : '未启用',
          requirement.configured ? '' : '未配置'
        ].filter(Boolean).join(' / ');

        return {
          value: profile.id,
          label: `${profile.providerName} / ${profile.modelName}${suffix ? `（${suffix}）` : ''}`,
          disabled: !requirement.known
        };
      });
    const hasReadyAudioProfile = selectedFactoryModelReadiness.some(
      (requirement) =>
        requirement.ready && readModelProfileCapabilities(requirement.profile).includes('audio_to_text')
    );
    const acceptedFactoryFileTypes = isVideoFactory
      ? '.mp4,.mov,.mkv,.avi,.webm,.m4v'
      : '.png,.jpg,.jpeg,.webp,.xlsx,.csv';
    const validFactoryAttachments = isVideoFactory
      ? factoryAttachments.filter((attachment) => isFactoryVideoAttachment(attachment))
      : factoryAttachments.filter((attachment) => isFactoryImageInputAttachment(attachment));
    const invalidFactoryAttachmentCount = factoryAttachments.length - validFactoryAttachments.length;
    const latestFactoryLogs = focusedFactoryTask ? selectFactoryVisibleLogs(focusedFactoryTask) : [];
    const focusedFactoryArtifacts = focusedFactoryTask?.artifacts.filter(isUserDeliverableArtifact) ?? [];
    const focusedFactoryOutputs =
      focusedFactoryTask?.factoryOutputs?.filter((item) => item.status !== 'excluded') ?? [];
    const focusedFactoryCostCents =
      focusedFactoryTask?.costCents ??
      focusedFactoryTask?.costRecords.reduce((total, record) => total + record.costCents, 0);
    const focusedFactoryInputFiles = readFactoryTaskInputFiles(focusedFactoryTask);
    const focusedFactoryStats = focusedFactoryTask
      ? buildFactoryTaskBatchStats(focusedFactoryTask, isVideoFactory)
      : undefined;
    const focusedFactoryFinalAnswer = focusedFactoryTask ? readConversationFinalAnswer(focusedFactoryTask) : '';
    const missingFactoryModel = selectedFactoryModelReadiness.find((requirement) => !requirement.ready);
    const missingFactoryToolId = selectedFactoryPackage?.toolIds.find((toolId) => {
      const known = runtimeState.tools.some((tool) => tool.id === toolId);
      const enabled = runtimeState.localRuntime.enabledToolIds.includes(toolId);
      return !known || !enabled;
    });
    const factoryRuntimeHint = selectedFactoryReadiness?.ready
      ? '当前环境可运行'
      : missingFactoryModel
        ? `缺少模型配置：${missingFactoryModel.profile.modelName}`
        : missingFactoryToolId
          ? `缺少工具配置：${resolveToolLabel(runtimeState.tools, missingFactoryToolId)}`
          : '请检查模型和工具配置';
    const renderFactoryStatusPanel = (variant: 'default' | 'drawer' = 'default') => (
      <section className={`factory-panel factory-status-panel ${variant === 'drawer' ? 'factory-drawer-panel' : ''}`}>
        <Flex align="center" justify="space-between" gap={12}>
          <Typography.Text strong>模型与工具状态</Typography.Text>
          <Tag color={selectedFactoryReadiness?.ready ? 'green' : 'orange'}>
            {selectedFactoryReadiness?.label ?? '待检查'}
          </Tag>
        </Flex>

        <div className={`factory-readiness-hint ${selectedFactoryReadiness?.ready ? 'ready' : 'warning'}`}>
          <InfoCircleOutlined />
          <Typography.Text>{factoryRuntimeHint}</Typography.Text>
        </div>

        <div className="factory-status-list">
          {selectedFactoryModelReadiness.length > 0 ? (
            selectedFactoryModelReadiness.map((requirement) => (
              <div key={requirement.profile.id} className="factory-status-row">
                <span>
                  <ApiOutlined />
                  <Typography.Text ellipsis>{requirement.profile.modelName}</Typography.Text>
                </span>
                <Tag color={requirement.ready ? 'green' : 'orange'}>
                  {renderModelRequirementStatusLabel(requirement.issue)}
                </Tag>
              </div>
            ))
          ) : (
            <Typography.Text type="secondary">未声明指定模型。</Typography.Text>
          )}
          {selectedFactoryPackage.toolIds.map((toolId) => {
            const known = runtimeState.tools.some((tool) => tool.id === toolId);
            const enabled = runtimeState.localRuntime.enabledToolIds.includes(toolId);
            return (
              <div key={toolId} className="factory-status-row">
                <span>
                  <ToolOutlined />
                  <Typography.Text ellipsis>{resolveToolLabel(runtimeState.tools, toolId)}</Typography.Text>
                </span>
                <Tag color={!known ? 'red' : enabled ? 'green' : 'orange'}>
                  {!known ? '缺失' : enabled ? '可用' : '未启用'}
                </Tag>
              </div>
            );
          })}
          {focusedFactoryCostCents && focusedFactoryCostCents > 0 ? (
            <div className="factory-status-row">
              <span>
                <InfoCircleOutlined />
                <Typography.Text>本次计费</Typography.Text>
              </span>
              <Tag color="blue">{formatCents(focusedFactoryCostCents)}</Tag>
            </div>
          ) : null}
        </div>

        <Button
          block
          onClick={() => {
            setSelectedRoleApplicationType('digital_factory');
            setSelectedRoleCategory('全部');
            openRoleConfig(selectedFactoryCode, 'configure');
          }}
        >
          模型与工具
        </Button>
      </section>
    );
    const renderFactoryLogPanel = (variant: 'default' | 'drawer' = 'default') => (
      <section className={`factory-panel factory-log-panel ${variant === 'drawer' ? 'factory-drawer-panel' : ''}`}>
        <Flex align="center" justify="space-between" gap={12}>
          <Typography.Text strong>工作日志</Typography.Text>
          <Button
            size="small"
            disabled={!focusedFactoryTask}
            onClick={() => {
              if (focusedFactoryTask) {
                setSelectedTaskId(focusedFactoryTask.taskId);
              }
              navigateToSection('logs');
            }}
          >
            详情
          </Button>
        </Flex>
        {latestFactoryLogs.length > 0 ? (
          <div className="factory-log-list">
            {latestFactoryLogs.map((log) => (
              <div key={log.id} className={`factory-log-item ${log.level}`}>
                <span className="factory-log-time">{formatShortTime(log.createdAt)}</span>
                <span className="factory-log-body">
                  <Typography.Text strong>{executionEventLabel(log.eventType)}</Typography.Text>
                  <Typography.Text type="secondary">
                    {userFriendlyExecutionMessage(log)}
                  </Typography.Text>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无日志" />
        )}
      </section>
    );

    return (
      <div className="workbench-page factory-page">
        <aside className="agent-session-panel">
          <Flex align="center" justify="space-between" className="agent-panel-header">
            <Space direction="vertical" size={0}>
              <Typography.Text strong>批量工厂</Typography.Text>
              <Typography.Text type="secondary">选择数字工厂</Typography.Text>
            </Space>
            <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={() => navigateToSection('roles')} />
          </Flex>

          <div className="agent-session-list">
            {installedDigitalFactoryPackages.map((rolePackage) => {
              const latestTask = latestTaskByFactory.get(rolePackage.roleCode);
              const isActive = rolePackage.roleCode === selectedFactoryCode;
              const summary = installedRoleSummaries.find((item) => item.roleCode === rolePackage.roleCode);
              const isDeleted = summary?.state === 'deleted';

              return (
                <button
                  key={rolePackage.roleCode}
                  type="button"
                  className={['agent-session-item', isActive ? 'selected' : '', isDeleted ? 'deleted' : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setSelectedFactoryRoleCode(rolePackage.roleCode);
                    if (latestTask) {
                      setSelectedTaskId(latestTask.taskId);
                    }
                  }}
                >
                  <span className="agent-avatar factory-avatar">
                    <BankOutlined />
                  </span>
                  <span className="agent-session-main">
                    <span className="agent-session-title-row">
                      <Typography.Text strong ellipsis>
                        {rolePackage.name}
                      </Typography.Text>
                      <Typography.Text type="secondary" className="agent-session-time">
                        {latestTask ? formatShortTime(latestTask.updatedAt) : '待运行'}
                      </Typography.Text>
                    </span>
                    <Typography.Text type="secondary" ellipsis className="agent-session-preview">
                      {latestTask
                        ? `${taskStateLabel(latestTask.state)}：${latestTask.title}`
                        : isDeleted
                          ? '该数字工厂已被服务端删除，历史批次仍可查看'
                          : rolePackage.summary ?? '点击后配置并运行批量任务'}
                    </Typography.Text>
                    <span className="agent-session-tags">
                      <Tag color={isDeleted ? 'red' : isActive ? 'green' : 'default'}>
                        {isDeleted ? '已删除' : isActive ? '当前' : '可用'}
                      </Tag>
                      <Tag>批次 {summary?.taskCount ?? 0}</Tag>
                    </span>
                  </span>
                </button>
              );
            })}
            {installedDigitalFactoryPackages.length === 0 ? (
              <div className="agent-session-empty">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已安装数字工厂" />
                <Button
                  size="small"
                  type="primary"
                  onClick={() => {
                    setSelectedRoleApplicationType('digital_factory');
                    navigateToSection('roles');
                  }}
                >
                  去数字市场安装
                </Button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className="factory-workspace">
          {selectedFactoryPackage ? (
            <>
              <header className="factory-workspace-header">
                <Space size={12} align="start">
                  <span className="chat-agent-avatar factory-avatar">
                    <BankOutlined />
                  </span>
                  <Space direction="vertical" size={4} className="chat-header-main">
                    <Space size={8} wrap>
                      <Typography.Text strong>{selectedFactoryPackage.name}</Typography.Text>
                      <Tag color={selectedFactoryReadiness?.ready ? 'green' : 'orange'}>
                        {selectedFactoryReadiness?.label ?? '待检查'}
                      </Tag>
                      <Tag>{isVideoFactory ? '视频批处理' : '图片批处理'}</Tag>
                    </Space>
                    <Typography.Text type="secondary">
                      {selectedFactoryPackage.summary ?? '批量上传素材，按工作流生成结构化产物。'}
                    </Typography.Text>
                    {renderRuntimeModelSummaryStrip({
                      rolePackage: selectedFactoryPackage,
                      compact: true,
                      onQuickSwitch: () => openRuntimeModelQuickSwitch(selectedFactoryCode)
                    })}
                  </Space>
                </Space>
                <Space wrap>
                  <Button
                    disabled={selectedFactoryDeleted || !selectedFactoryTemplate}
                    onClick={() => {
                      setSelectedRoleApplicationType('digital_factory');
                      setSelectedRoleCategory('全部');
                      openRoleConfig(selectedFactoryCode, 'configure');
                    }}
                  >
                    模型与工具
                  </Button>
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    disabled={selectedFactoryDeleted}
                    onClick={() => {
                      factoryRunForm.setFieldsValue({ roleCode: selectedFactoryCode });
                      factoryRunForm.submit();
                    }}
                  >
                    开始任务
                  </Button>
                </Space>
              </header>

              <div className="factory-workspace-body factory-console-body">
                <div className="factory-console-compact-bar">
                  <div className={`factory-readiness-hint ${selectedFactoryReadiness?.ready ? 'ready' : 'warning'}`}>
                    <InfoCircleOutlined />
                    <Typography.Text>{factoryRuntimeHint}</Typography.Text>
                  </div>
                  <Space size={8} wrap>
                    <Button icon={<InfoCircleOutlined />} onClick={() => setFactorySidePanelOpen('status')}>
                      状态
                    </Button>
                    <Button icon={<MessageOutlined />} onClick={() => setFactorySidePanelOpen('logs')}>
                      日志
                    </Button>
                  </Space>
                </div>
                <div className="factory-console-grid">
                  <section className="factory-console-column factory-console-left">
                    <section
                      className={[
                        'factory-panel',
                        'factory-console-upload',
                        isFactoryDragOver ? 'dragging' : ''
                      ].filter(Boolean).join(' ')}
                      onDragOver={handleFactoryDragOver}
                      onDragLeave={handleFactoryDragLeave}
                      onDrop={handleFactoryDrop}
                    >
                      <Flex align="flex-start" justify="space-between" gap={12}>
                        <Space direction="vertical" size={2}>
                          <Typography.Text strong>输入</Typography.Text>
                          <Typography.Text type="secondary">
                            {isVideoFactory
                              ? `上传待质检视频，单批最多 ${maxItems} 个。`
                              : `上传商品图或表格，单批最多 ${maxItems} 个。`}
                          </Typography.Text>
                        </Space>
                        <Tag color="blue">{validFactoryAttachments.length}/{maxItems}</Tag>
                      </Flex>

                      <button
                        type="button"
                        className="factory-upload-dropzone"
                        onClick={() => factoryFileInputRef.current?.click()}
                      >
                        <FileAddOutlined />
                        <span>{isVideoFactory ? '添加视频或拖拽到这里' : '添加图片/表格或拖拽到这里'}</span>
                        <small>{isVideoFactory ? 'mp4、mov、mkv、avi、webm、m4v' : 'png、jpg、webp、xlsx、csv'}</small>
                      </button>
                      <input
                        ref={factoryFileInputRef}
                        type="file"
                        multiple
                        accept={acceptedFactoryFileTypes}
                        hidden
                        onChange={handleFactoryFileInputChange}
                      />

                      {invalidFactoryAttachmentCount > 0 ? (
                        <Typography.Text type="warning">
                          已忽略 {invalidFactoryAttachmentCount} 个不符合当前工厂类型的文件。
                        </Typography.Text>
                      ) : null}

                      {factoryAttachments.length > 0 ? (
                        <div className="factory-attachment-list compact">
                          {factoryAttachments.map((attachment) => {
                            const valid = isVideoFactory
                              ? isFactoryVideoAttachment(attachment)
                              : isFactoryImageInputAttachment(attachment);
                            return (
                              <div key={attachment.id} className={valid ? 'factory-attachment-item' : 'factory-attachment-item invalid'}>
                                <Space size={8}>
                                  {isVideoFactory ? <VideoCameraOutlined /> : isFactoryImageAttachment(attachment) ? <FileImageOutlined /> : <FileExcelOutlined />}
                                  <span>{attachment.name}</span>
                                  <Typography.Text type="secondary">{formatFileSize(attachment.size)}</Typography.Text>
                                  {!valid ? <Tag color="red">不适用</Tag> : null}
                                </Space>
                                <Button size="small" type="text" danger onClick={() => removeFactoryAttachment(attachment.id)}>
                                  移除
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={isVideoFactory ? '请添加案例视频' : '请添加商品素材'} />
                      )}

                      {focusedFactoryInputFiles.length > 0 ? (
                        <div className="factory-input-history">
                          <Flex align="center" justify="space-between" gap={8}>
                            <Typography.Text strong>当前批次输入</Typography.Text>
                            <Tag>{focusedFactoryInputFiles.length} 个文件</Tag>
                          </Flex>
                          <div className="factory-input-file-list">
                            {focusedFactoryInputFiles.slice(0, 6).map((filePath) => (
                              <div key={filePath} className="factory-input-file-item">
                                {isVideoFactory ? <VideoCameraOutlined /> : <PaperClipOutlined />}
                                <Typography.Text ellipsis title={filePath}>
                                  {getPathFileName(filePath)}
                                </Typography.Text>
                              </div>
                            ))}
                            {focusedFactoryInputFiles.length > 6 ? (
                              <Typography.Text type="secondary">
                                还有 {focusedFactoryInputFiles.length - 6} 个文件未展开显示
                              </Typography.Text>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </section>

                    <Form<FactoryRunFormValues>
                      form={factoryRunForm}
                      layout="vertical"
                      className="factory-console-form"
                      onFinish={submitFactoryRun}
                    >
                      <Form.Item name="roleCode" hidden>
                        <Input />
                      </Form.Item>
                      <section className="factory-panel factory-parameter-panel">
                        <Flex align="center" justify="space-between" gap={12}>
                          <Space direction="vertical" size={2}>
                            <Typography.Text strong>参数设置</Typography.Text>
                            <Typography.Text type="secondary">只保留本次运行需要调整的参数。</Typography.Text>
                          </Space>
                          <Button size="small" onClick={() => resetFactoryRunFormForRole(selectedFactoryCode)}>
                            重置
                          </Button>
                        </Flex>

                        {isVideoFactory ? (
                          <>
                            <Form.Item
                              name="asrModelProfileId"
                              label="语音转文字模型"
                              rules={[{ required: true, message: '请选择可用的语音转文字模型' }]}
                            >
                              <Select
                                size="large"
                                placeholder="选择语音转文字模型"
                                options={audioProfileOptions}
                                notFoundContent="暂无支持语音转文字的模型"
                              />
                            </Form.Item>
                            {!hasReadyAudioProfile ? (
                              <Typography.Text type="warning">
                                语音转文字模型未配置时，任务会停在语音识别前。请先到模型配置填写 API Key。
                              </Typography.Text>
                            ) : null}
                            <div className="factory-inline-form-grid">
                              <Form.Item name="dialect" label="语言 / 方言" rules={[{ required: true }]}>
                                <Select
                                  size="large"
                                  options={dialectOptions.map((item) => ({
                                    value: item.key,
                                    label: item.label
                                  }))}
                                />
                              </Form.Item>
                              <Form.Item
                                name="screeningProfileKey"
                                label={
                                  <Flex align="center" justify="space-between" gap={8} className="factory-form-label-row">
                                    <span>筛选标准</span>
                                    <Button
                                      size="small"
                                      icon={<SettingOutlined />}
                                      onMouseDown={(event) => event.preventDefault()}
                                      onClick={(event) => {
                                        event.preventDefault();
                                        openFactoryScreeningProfileEditor(selectedFactoryCode);
                                      }}
                                    >
                                      编辑
                                    </Button>
                                  </Flex>
                                }
                                rules={[{ required: true, message: '请选择筛选标准' }]}
                              >
                                <Select
                                  size="large"
                                  options={screeningProfiles.map((item) => ({
                                    value: item.key,
                                    label: `${item.label}${item.custom ? '（自定义）' : ''}`
                                  }))}
                                />
                              </Form.Item>
                            </div>
                            <Form.Item shouldUpdate noStyle>
                              {({ getFieldValue }) => {
                                const selectedProfile = screeningProfiles.find(
                                  (item) => item.key === getFieldValue('screeningProfileKey')
                                );

                                return selectedProfile ? (
                                  <div className="factory-screening-selected-summary">
                                    <Tag color={selectedProfile.custom ? 'blue' : 'default'}>
                                      {selectedProfile.custom ? '自定义标准' : '系统模板'}
                                    </Tag>
                                    <Typography.Text type="secondary">
                                      {selectedProfile.description ?? '按当前筛选标准逐级判断视频是否进入后续流程。'}
                                    </Typography.Text>
                                  </div>
                                ) : null;
                              }}
                            </Form.Item>
                            <div className="factory-inline-form-grid compact">
                              <Form.Item name="editEnabled" label="生成初剪" valuePropName="checked">
                                <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                              </Form.Item>
                              <Form.Item shouldUpdate noStyle>
                                {({ getFieldValue }) => (
                                  <Form.Item name="editTargetSeconds" label="目标时长">
                                    <Select
                                      size="large"
                                      disabled={!getFieldValue('editEnabled')}
                                      options={targetSecondOptions.map((seconds) => ({
                                        value: seconds,
                                        label: `${seconds} 秒`
                                      }))}
                                    />
                                  </Form.Item>
                                )}
                              </Form.Item>
                            </div>
                            <Form.Item name="instruction" label="补充要求">
                              <Input.TextArea
                                rows={3}
                                placeholder="例如：优先保留使用前症状和使用后改善的片段；夸张医疗承诺请标记风险。"
                              />
                            </Form.Item>
                          </>
                        ) : (
                          <>
                            <Form.Item name="platform" label="目标平台" rules={[{ required: true, message: '请选择目标平台' }]}>
                              <Select
                                size="large"
                                options={platformOptions.map((item) => ({
                                  value: item.key,
                                  label: `${item.label}${item.imageRatio ? ` / ${item.imageRatio}` : ''}`
                                }))}
                              />
                            </Form.Item>
                            <Form.Item shouldUpdate noStyle>
                              {({ getFieldValue }) => {
                                const currentPackages = normalizeFactoryPackageDefinitions(
                                  getFieldValue('packageDefinitions'),
                                  packageOptions
                                );

                                return (
                                  <Form.Item
                                    name="packageKeys"
                                    label={
                                      <Flex align="center" justify="space-between" gap={8} className="factory-form-label-row">
                                        <span>选择产物包</span>
                                        <Button
                                          size="small"
                                          icon={<SettingOutlined />}
                                          onClick={() => openFactoryPackageEditor(selectedFactoryCode)}
                                        >
                                          编辑
                                        </Button>
                                      </Flex>
                                    }
                                    rules={[{ required: true, message: '请至少选择一个产物包' }]}
                                  >
                                    <Checkbox.Group className="factory-package-checks">
                                      {currentPackages.map((item) => (
                                        <Tooltip key={item.key} title={item.description}>
                                          <Checkbox value={item.key}>{item.label}</Checkbox>
                                        </Tooltip>
                                      ))}
                                    </Checkbox.Group>
                                  </Form.Item>
                                );
                              }}
                            </Form.Item>
                            <Form.Item name="qualityCheckMode" label="质检方式" rules={[{ required: true }]}>
                              <Select
                                size="large"
                                options={qualityModes.map((item) => ({
                                  value: item.key,
                                  label: item.label
                                }))}
                              />
                            </Form.Item>
                            <div className="factory-prompt-control-block">
                              <Flex align="center" justify="space-between" gap={8}>
                                <Typography.Text strong>提示词控制</Typography.Text>
                                <Typography.Text type="secondary">控制提示词模型怎么写生图指令</Typography.Text>
                              </Flex>
                              <div className="factory-prompt-control-grid">
                                {promptControlFields.map((field) => (
                                  <Form.Item key={field.key} name={field.key} label={field.label}>
                                    {field.inputType === 'textarea' ? (
                                      <Input.TextArea rows={2} placeholder={field.placeholder} />
                                    ) : (
                                      <Input placeholder={field.placeholder} />
                                    )}
                                  </Form.Item>
                                ))}
                              </div>
                            </div>
                            <Form.Item name="instruction" label="补充要求">
                              <Input.TextArea
                                rows={3}
                                placeholder="例如：面向美国站，风格干净高级；白底图不要文字。"
                              />
                            </Form.Item>
                          </>
                        )}
                      </section>
                    </Form>
                  </section>

                  <section className="factory-console-column factory-console-main">
                    <section className="factory-panel factory-queue-panel">
                      <Flex align="center" justify="space-between" gap={12}>
                        <Space direction="vertical" size={2}>
                          <Typography.Text strong>任务队列</Typography.Text>
                          <Typography.Text type="secondary">批量任务的进度和状态。</Typography.Text>
                        </Space>
                        <Tag>{selectedFactoryTasks.length} 个批次</Tag>
                      </Flex>

                      {selectedFactoryTasks.length > 0 ? (
                        <div className="factory-queue-list">
                          {selectedFactoryTasks.slice(0, 30).map((task) => {
                            const progress = factoryTaskProgressPercent(task);
                            const batchStats = buildFactoryTaskBatchStats(task, isVideoFactory);
                            return (
                              <button
                                key={task.taskId}
                                type="button"
                                className={
                                  focusedFactoryTask?.taskId === task.taskId
                                    ? 'factory-queue-item selected'
                                    : 'factory-queue-item'
                                }
                                onClick={() => setSelectedTaskId(task.taskId)}
                              >
                                <span className="factory-queue-main">
                                  <span className="factory-task-title">{task.title}</span>
                                  <span className="factory-task-meta">
                                    <Tag color={taskStateColor(task.state)}>{taskStateLabel(task.state)}</Tag>
                                    <span>{formatShortTime(task.updatedAt)}</span>
                                    <span>输入 {batchStats.total}</span>
                                    <span>产物 {batchStats.artifacts}</span>
                                  </span>
                                </span>
                                <span className="factory-queue-stats">
                                  {batchStats.qualified !== undefined ? <span>合格 {batchStats.qualified}</span> : null}
                                  {batchStats.rejected !== undefined ? <span>筛掉 {batchStats.rejected}</span> : null}
                                  {batchStats.review !== undefined ? <span>复核 {batchStats.review}</span> : null}
                                  {batchStats.processingError !== undefined ? <span>异常 {batchStats.processingError}</span> : null}
                                  {batchStats.edited !== undefined ? <span>初剪 {batchStats.edited}</span> : null}
                                </span>
                                <span className="factory-progress-bar" aria-label={`进度 ${progress}%`}>
                                  <span style={{ width: `${progress}%` }} />
                                </span>
                                <span className="factory-stage-strip">
                                  {buildFactoryTaskStages(task, isVideoFactory).map((stage) => (
                                    <span key={stage.key} className={`factory-stage-pill ${stage.status}`}>
                                      {stage.label}
                                    </span>
                                  ))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有运行批次" />
                      )}
                    </section>

                    <section className="factory-panel factory-output-panel">
                      <Flex align="center" justify="space-between" gap={12}>
                        <Space direction="vertical" size={2}>
                          <Typography.Text strong>输出队列</Typography.Text>
                          <Typography.Text type="secondary">结果文件和本地位置。</Typography.Text>
                        </Space>
                        <Tag color={focusedFactoryArtifacts.length + focusedFactoryOutputs.length > 0 ? 'green' : 'default'}>
                          产物 {focusedFactoryArtifacts.length} / 输出物 {focusedFactoryOutputs.length}
                        </Tag>
                      </Flex>

                      {focusedFactoryTask ? (
                        <div className="factory-output-content">
                          <Flex align="center" justify="space-between" gap={10} wrap="wrap">
                            <Space size={8} wrap>
                              <Typography.Text strong>{focusedFactoryTask.title}</Typography.Text>
                              <Tag color={taskStateColor(focusedFactoryTask.state)}>
                                {taskStateLabel(focusedFactoryTask.state)}
                              </Tag>
                            </Space>
                            <Typography.Text type="secondary">
                              {formatDateTime(focusedFactoryTask.updatedAt)}
                            </Typography.Text>
                          </Flex>
                          {focusedFactoryStats ? (
                            <div className="factory-batch-summary-grid">
                              {buildFactoryBatchStatItems(focusedFactoryStats, isVideoFactory).map((item) => (
                                <div key={item.key} className={`factory-batch-summary-card ${item.tone ?? ''}`}>
                                  <span>{item.label}</span>
                                  <strong>{item.value}</strong>
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {focusedFactoryFinalAnswer ? (
                            <div className="factory-result-preview">
                              <Flex align="center" justify="space-between" gap={10}>
                                <Typography.Text strong>结果说明</Typography.Text>
                                <Button
                                  size="small"
                                  type="text"
                                  onClick={() => {
                                    setSelectedTaskId(focusedFactoryTask.taskId);
                                    navigateToSection('logs');
                                  }}
                                >
                                  查看详情
                                </Button>
                              </Flex>
                              <Typography.Paragraph className="factory-task-summary">
                                {buildFactoryFinalAnswerPreview(focusedFactoryFinalAnswer)}
                              </Typography.Paragraph>
                            </div>
                          ) : null}
                          {renderFactoryOutputItems(focusedFactoryTask)}
                          {renderFactoryTaskArtifacts(focusedFactoryTask, {
                            showEmpty: focusedFactoryOutputs.length === 0
                          })}
                        </div>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择一个批次查看产物" />
                      )}
                    </section>
                  </section>

                  <aside className="factory-console-column factory-console-right">
                    {renderFactoryStatusPanel()}
                    {renderFactoryLogPanel()}
                  </aside>
                </div>
              </div>
              <Drawer
                className="factory-side-drawer"
                title={factorySidePanelOpen === 'logs' ? '工作日志' : '模型与工具状态'}
                placement="right"
                width={400}
                open={Boolean(factorySidePanelOpen)}
                onClose={() => setFactorySidePanelOpen(null)}
                destroyOnHidden
              >
                {factorySidePanelOpen === 'logs'
                  ? renderFactoryLogPanel('drawer')
                  : renderFactoryStatusPanel('drawer')}
              </Drawer>
            </>
          ) : (
            <div className="factory-empty-state">
              <BankOutlined />
              <Typography.Title level={3}>先安装一个数字工厂</Typography.Title>
              <Typography.Text type="secondary">
                数字工厂适合批量处理图片、视频和表格类任务，安装后会在这里运行。
              </Typography.Text>
              <Button
                type="primary"
                onClick={() => {
                  setSelectedRoleApplicationType('digital_factory');
                  navigateToSection('roles');
                }}
              >
                打开数字市场
              </Button>
            </div>
          )}
        </section>
      </div>
    );
  }

  function renderFactoryOutputItems(task: DesktopTaskDetail) {
    const outputItems = [...(task.factoryOutputs ?? [])]
      .filter((item) => item.status !== 'excluded')
      .sort((left, right) => getFactoryOutputOrder(left) - getFactoryOutputOrder(right));

    if (outputItems.length === 0) {
      return null;
    }

    const qualifiedItems = outputItems.filter((item) => item.status === 'qualified');

    return (
      <div className="factory-output-item-panel">
        <Flex align="center" justify="space-between" gap={10} wrap="wrap">
          <Space size={8} wrap>
            <Typography.Text strong>输出物</Typography.Text>
            <Tag color="blue">{outputItems.length} 条</Tag>
            {qualifiedItems.length > 0 ? <Tag color="green">合格 {qualifiedItems.length}</Tag> : null}
          </Space>
          <Space size={6} wrap>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={exportingFactoryOutputBatch === 'qualified'}
              disabled={qualifiedItems.length === 0}
              onClick={() => void exportFactoryOutputItems(task, qualifiedItems, 'qualified')}
            >
              导出合格
            </Button>
            <Button
              size="small"
              icon={<DownloadOutlined />}
              loading={exportingFactoryOutputBatch === 'all'}
              onClick={() => void exportFactoryOutputItems(task, outputItems, 'all')}
            >
              导出全部
            </Button>
          </Space>
        </Flex>

        <div className="factory-output-item-list">
          {outputItems.map((item) => {
            const previewPath = getFactoryOutputLocalPath(item);
            const scoreLabel = item.score === undefined ? undefined : `${item.score} 分${item.grade ? ` / ${item.grade}` : ''}`;
            return (
              <div key={item.id} className={`factory-output-item-card ${item.status}`}>
                <div className="factory-output-item-icon">
                  {item.kind === 'video' ? <VideoCameraOutlined /> : renderFactoryOutputKindIcon(item.kind)}
                </div>
                <div className="factory-output-item-main">
                  <Flex align="center" justify="space-between" gap={8} wrap="wrap">
                    <Space size={6} wrap>
                      <Typography.Text strong ellipsis title={item.title}>
                        {item.title}
                      </Typography.Text>
                      <Tag color={factoryOutputStatusColor(item.status)}>
                        {factoryOutputStatusLabel(item.status)}
                      </Tag>
                      {scoreLabel ? <Tag>{scoreLabel}</Tag> : null}
                    </Space>
                    <Typography.Text type="secondary" className="factory-output-item-time">
                      {formatShortTime(item.updatedAt)}
                    </Typography.Text>
                  </Flex>

                  {item.summary || item.reason ? (
                    <Typography.Text type="secondary" className="factory-output-item-summary" ellipsis>
                      {item.reason ?? item.summary}
                    </Typography.Text>
                  ) : null}

                  {item.risks?.length ? (
                    <Typography.Text type="secondary" className="factory-output-item-risk" ellipsis>
                      {item.risks.slice(0, 2).join('；')}
                    </Typography.Text>
                  ) : null}

                  {previewPath ? (
                    <Typography.Text type="secondary" className="factory-output-item-path" ellipsis copyable>
                      {previewPath}
                    </Typography.Text>
                  ) : null}

                  <Space size={6} wrap className="factory-output-item-actions">
                    <Button
                      size="small"
                      icon={<PlayCircleOutlined />}
                      disabled={!previewPath}
                      onClick={() => void openLocalPath(previewPath)}
                    >
                      预览
                    </Button>
                    <Button
                      size="small"
                      icon={<DownloadOutlined />}
                      loading={exportingFactoryOutputId === item.id}
                      disabled={!previewPath}
                      onClick={() => void exportSingleFactoryOutputItem(task, item)}
                    >
                      导出
                    </Button>
                    <Button
                      size="small"
                      disabled={item.status === 'qualified'}
                      onClick={() =>
                        updateFactoryOutputItemStatus(task.taskId, item.id, 'qualified', '人工设为合格')
                      }
                    >
                      设为合格
                    </Button>
                    <Button
                      size="small"
                      disabled={item.status === 'rejected'}
                      onClick={() =>
                        updateFactoryOutputItemStatus(task.taskId, item.id, 'rejected', '人工设为不通过')
                      }
                    >
                      设为不通过
                    </Button>
                    <Button
                      size="small"
                      disabled={item.status === 'review_required'}
                      onClick={() =>
                        updateFactoryOutputItemStatus(task.taskId, item.id, 'review_required', '人工设为需复核')
                      }
                    >
                      设为需复核
                    </Button>
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => excludeFactoryOutputItem(task.taskId, item.id)}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderFactoryTaskArtifacts(
    task: DesktopTaskDetail,
    options: { showEmpty?: boolean } = {}
  ) {
    const artifacts = task.artifacts.filter(isUserDeliverableArtifact);
    if (artifacts.length === 0) {
      return options.showEmpty === false
        ? null
        : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可交付产物" />;
    }

    const editedVideoFolder = readCommonArtifactDirectory(
      artifacts
        .filter((artifact) => artifact.type === 'video' || getArtifactExtension(artifact) === 'mp4')
        .flatMap((artifact) => (artifact.localPath ? [artifact.localPath] : []))
    );

    return (
      <div className="factory-task-artifacts">
        {editedVideoFolder ? (
          <div className="factory-folder-artifact-card">
            <div className="artifact-file-icon video">
              <VideoCameraOutlined />
            </div>
            <div className="artifact-file-main">
              <div className="artifact-file-title-row">
                <Typography.Text strong ellipsis title={editedVideoFolder}>
                  初剪视频文件夹
                </Typography.Text>
                <Tag className="artifact-file-type">文件夹</Tag>
              </div>
              <Typography.Text type="secondary" className="artifact-file-meta" ellipsis copyable>
                {editedVideoFolder}
              </Typography.Text>
            </div>
            <Button
              size="small"
              icon={<FolderOpenOutlined />}
              title="打开位置"
              aria-label="打开位置"
              onClick={() => void openLocalPath(editedVideoFolder)}
            />
          </div>
        ) : null}
        {artifacts.map((artifact) => {
          const factoryPreview = artifact.factoryPreview;
          if (factoryPreview?.kind === 'digital_factory_image_batch') {
            const previewItems = [...factoryPreview.items].sort((left, right) => left.order - right.order);
            return (
              <div key={artifact.id} className="factory-artifact-card">
                <div className="factory-artifact-header">
                  <div className="artifact-file-icon image">
                    <FileImageOutlined />
                  </div>
                  <div className="artifact-file-main">
                    <div className="artifact-file-title-row">
                      <Typography.Text strong ellipsis title={artifact.title}>
                        {artifact.title}
                      </Typography.Text>
                      <Tag className="artifact-file-type">图片批次</Tag>
                    </div>
                    <Typography.Text type="secondary" className="artifact-file-meta">
                      {formatFactoryPreviewMeta(factoryPreview)}
                    </Typography.Text>
                  </div>
                </div>
                <div className="factory-preview-grid">
                  {previewItems.map((item) => {
                    const imageSrc = getFactoryPreviewImageSrc(item);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`factory-preview-tile ${item.status}`}
                        disabled={!imageSrc}
                        title={item.error ?? `${item.sku} / ${item.packageLabel}`}
                        onClick={() => setPreviewFactoryImage(item)}
                      >
                        <span className="factory-preview-thumb">
                          {imageSrc ? (
                            <img src={imageSrc} alt={`${item.sku} ${item.packageLabel}`} loading="lazy" />
                          ) : (
                            <FileImageOutlined />
                          )}
                        </span>
                        <span className="factory-preview-caption">
                          <span>{item.sku}</span>
                          <span>{item.packageLabel}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (editedVideoFolder && (artifact.type === 'video' || getArtifactExtension(artifact) === 'mp4')) {
            return null;
          }

          const fileName = getArtifactFileName(artifact);
          const displayTitle = getFactoryArtifactDisplayTitle(artifact);
          return (
            <div key={artifact.id} className="chat-artifact-card factory-file-artifact-card">
              <div className={`artifact-file-icon ${getArtifactToneClass(artifact)}`}>
                {renderArtifactFileIcon(artifact)}
              </div>
              <div className="artifact-file-main">
                <div className="artifact-file-title-row">
                  <Typography.Text strong ellipsis title={fileName}>
                    {displayTitle}
                  </Typography.Text>
                  <Tag className="artifact-file-type">{getFactoryArtifactTypeLabel(artifact)}</Tag>
                </div>
                <Typography.Text type="secondary" className="artifact-file-meta" ellipsis copyable={Boolean(artifact.localPath)}>
                  {artifact.localPath ?? formatArtifactMeta(artifact)}
                </Typography.Text>
              </div>
              {artifact.localPath ? (
                <Space size={6}>
                  <Button
                    size="small"
                    icon={<FolderOpenOutlined />}
                    title="打开位置"
                    aria-label="打开位置"
                    onClick={() => void openLocalPath(artifact.localPath)}
                  />
                  <Button
                    size="small"
                    className="artifact-download-button"
                    icon={<DownloadOutlined />}
                    loading={savingArtifactId === artifact.id}
                    title="另存为"
                    aria-label="另存为"
                    onClick={() => void saveArtifactAs(artifact)}
                  />
                </Space>
              ) : (
                <Tag color="warning">缓存已过期</Tag>
              )}
            </div>
          );
        })}
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
                    icon={<MessageOutlined />}
                    onClick={() => openIssueFeedbackModal(selectedLogTask)}
                  >
                    反馈此任务问题
                  </Button>
                  <Button
                    size="small"
                    onClick={() => {
                      const rolePackage = runtimeState.rolePackages.find(
                        (item) => item.roleCode === selectedLogTask.roleCode
                      );
                      const roleTemplate = desktopRoleTemplateByRoleCode.get(selectedLogTask.roleCode);
                      setSelectedTaskId(selectedLogTask.taskId);
                      if (readRoleApplicationType(rolePackage ?? roleTemplate) === 'digital_factory') {
                        setSelectedFactoryRoleCode(selectedLogTask.roleCode);
                        navigateToSection('factories');
                        return;
                      }

                      activateRole(selectedLogTask.roleCode);
                      navigateToSection('workbench');
                    }}
                  >
                    回到任务
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

  function renderRoleConfigModal() {
    const roleConfigTemplate = roleConfigRoleCode
      ? desktopRoleTemplateByRoleCode.get(roleConfigRoleCode)
      : undefined;
    const roleConfigRolePackage = runtimeState.rolePackages.find(
      (rolePackage) => rolePackage.roleCode === roleConfigRoleCode
    );
    const refreshedRoleConfigRolePackage = roleConfigRoleCode
      ? refreshedInstalledRolePackageByRoleCode.get(roleConfigRoleCode) ?? roleConfigRolePackage
      : undefined;
    const roleConfigPreviewPackage = roleConfigTemplate
      ? toConfiguredRolePackagePreview(roleConfigTemplate, roleConfigRolePackage)
      : refreshedRoleConfigRolePackage;
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
    const roleConfigApplicationLabel = roleConfigTemplate
      ? roleApplicationTypeLabel(readRoleApplicationType(roleConfigTemplate))
      : roleApplicationTypeLabel(selectedRoleApplicationType);
    const roleConfigDisplayName = roleConfigTemplate?.name ?? roleConfigPreviewPackage?.name;
    const roleConfigSkills = roleConfigTemplate?.skills ?? roleConfigPreviewPackage?.skills ?? [];
    const roleConfigModelProfileIds = roleConfigPreviewPackage?.modelProfileIds ?? roleConfigTemplate?.modelProfileIds ?? [];
    const roleConfigToolIds = roleConfigPreviewPackage?.toolIds ?? roleConfigTemplate?.toolIds ?? [];
    const roleConfigKnowledgeSources =
      roleConfigPreviewPackage?.requiredKnowledgeSources ?? roleConfigTemplate?.requiredKnowledgeSources ?? [];

    return (
      <Modal
        open={roleConfigModalOpen}
        title={
          roleConfigDisplayName
            ? `${roleConfigMode === 'install' ? '安装' : '模型与工具'}：${roleConfigDisplayName}`
            : roleConfigMode === 'install'
              ? `安装${roleConfigApplicationLabel}`
              : `${roleConfigApplicationLabel}模型与工具`
        }
        okText={roleConfigMode === 'install' ? '安装' : '保存'}
        onCancel={closeRoleConfig}
        onOk={() => roleConfigForm.submit()}
        width={820}
        destroyOnHidden
      >
        {roleConfigPreviewPackage ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="版本">{roleConfigPreviewPackage.version}</Descriptions.Item>
              {roleConfigTemplate ? (
                <>
                  <Descriptions.Item label="行业">{roleConfigTemplate.industry}</Descriptions.Item>
                  <Descriptions.Item label="场景">{roleConfigTemplate.scenario}</Descriptions.Item>
                  <Descriptions.Item label="业务目标">{roleConfigTemplate.businessGoal}</Descriptions.Item>
                </>
              ) : (
                <>
                  <Descriptions.Item label="说明">
                    {roleConfigPreviewPackage.summary ?? '该配置来自本机已安装包。'}
                  </Descriptions.Item>
                  <Descriptions.Item label="输出">
                    {roleConfigPreviewPackage.outputFormat ?? '按工作流产物输出'}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            {roleConfigSkills.length > 0 ? (
              <Space size={6} wrap>
                {roleConfigSkills.map((skill) => (
                  <Tag key={skill.code}>{skill.name}</Tag>
                ))}
              </Space>
            ) : null}

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
                  locale={{ emptyText: `当前${roleConfigApplicationLabel}没有声明模型需求` }}
                  renderItem={(requirement) => {
                    const displayProfile = requirement.runtimeProfile ?? requirement.profile;
                    const isRuntimeOverride = displayProfile.id !== requirement.profile.id;

                    return (
                    <List.Item
                      actions={[
                        <Button
                          key="configure"
                          size="small"
                          type={requirement.ready ? 'default' : 'primary'}
                          onClick={() => openRequiredModelProfileConfig(displayProfile)}
                        >
                          {requirement.ready ? '查看模型' : '配置模型'}
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space size={6} wrap>
                            <Typography.Text strong>
                              {displayProfile.providerName} / {displayProfile.modelName}
                            </Typography.Text>
                            <Tag>{modelCapabilitySummary(requirement.profile.capabilities, requirement.profile.purpose)}</Tag>
                            {isRuntimeOverride ? <Tag color="blue">实际调用</Tag> : null}
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
                              Base URL：{displayProfile.apiBaseUrl || '待填写'}
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
                    );
                  }}
                />
                <Typography.Text type="secondary">
                  API Key 只保存在当前电脑；这里可为每个模型槽位选择实际调用模型。
                </Typography.Text>
              </Space>
            </Card>

            <Form<RoleConfigFormValues>
              form={roleConfigForm}
              layout="vertical"
              id="role-config-form"
              initialValues={{
                modelProfileIds: roleConfigModelProfileIds,
                toolIds: roleConfigToolIds,
                knowledgeSources: roleConfigKnowledgeSources,
                modelCredentialBindings: roleConfigCredentialInitialValues
              }}
              onFinish={submitRoleConfig}
            >
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Typography.Text strong>模型调用设置</Typography.Text>
                {roleConfigModelRequirements.length === 0 ? (
                  <Empty description={`当前${roleConfigApplicationLabel}没有声明模型需求`} />
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
                  options={roleConfigToolIds.map((toolId) => ({
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
                      从当前电脑移除该{roleConfigApplicationLabel}，历史任务和已生成产物仍会保留。
                    </Typography.Text>
                  </Space>
                  <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => confirmUninstallRole(roleConfigRolePackage.roleCode)}
                  >
                    卸载{roleConfigApplicationLabel}
                  </Button>
                </Flex>
              </div>
            ) : null}
          </Space>
        ) : (
          <Empty description={`未找到${roleConfigApplicationLabel}`} />
        )}
      </Modal>
    );
  }

  function renderRoles() {
    const roleConfigTemplate = roleConfigRoleCode
      ? desktopRoleTemplateByRoleCode.get(roleConfigRoleCode)
      : undefined;
    const roleConfigRolePackage = runtimeState.rolePackages.find(
      (rolePackage) => rolePackage.roleCode === roleConfigRoleCode
    );
    const refreshedRoleConfigRolePackage = roleConfigRoleCode
      ? refreshedInstalledRolePackageByRoleCode.get(roleConfigRoleCode) ?? roleConfigRolePackage
      : undefined;
    const roleConfigPreviewPackage = roleConfigTemplate
      ? toConfiguredRolePackagePreview(roleConfigTemplate, roleConfigRolePackage)
      : refreshedRoleConfigRolePackage;
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
    const roleConfigApplicationLabel = roleConfigTemplate
      ? roleApplicationTypeLabel(readRoleApplicationType(roleConfigTemplate))
      : roleApplicationTypeLabel(selectedRoleApplicationType);
    const installedRoleCodes = new Set(runtimeState.rolePackages.map((rolePackage) => rolePackage.roleCode));
    const roleApplicationCounts = countRoleApplications(desktopRoleTemplates);
    const selectedApplicationTemplates = desktopRoleTemplates.filter(
      (template) => readRoleApplicationType(template) === selectedRoleApplicationType
    );
    const roleCategories = buildRoleCategoryTabs(selectedApplicationTemplates);
    const filteredRoleTemplates = selectedApplicationTemplates.filter(
      (template) => selectedRoleCategory === '全部' || roleTemplateCategory(template) === selectedRoleCategory
    );
    const selectedApplicationCapacityText = formatRoleApplicationCapacityUsage(
      selectedRoleApplicationType,
      installedRoleApplicationUsage,
      authorizedRoleTemplateCatalog.deviceCapacity
    );

    return (
      <>
        <div className="catalog-page">
          <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
            <div>
              <Typography.Title level={2} className="page-title">
                数字市场
              </Typography.Title>
              <Typography.Text type="secondary">
                选择、安装和配置数字员工与数字工厂；安装后到对应侧边栏开始使用。
              </Typography.Text>
            </div>
            <Button icon={<ReloadOutlined />} loading={isLoadingRoleTemplates} onClick={loadAuthorizedRoleTemplates}>
              刷新
            </Button>
          </Flex>

          <div className="category-tabs role-application-tabs">
            {(['digital_employee', 'digital_factory'] as RoleApplicationType[]).map((applicationType) => (
              <button
                key={applicationType}
                type="button"
                className={selectedRoleApplicationType === applicationType ? 'category-tab active' : 'category-tab'}
                onClick={() => {
                  setSelectedRoleApplicationType(applicationType);
                  setSelectedRoleCategory('全部');
                }}
              >
                {roleApplicationTypeLabel(applicationType)}
                <span className="category-tab-count">{roleApplicationCounts[applicationType]}</span>
              </button>
            ))}
          </div>

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

          <Typography.Paragraph type="secondary" className="catalog-capacity-hint">
            {selectedApplicationCapacityText}
          </Typography.Paragraph>

          {roleTemplateNotice ? (
            <Typography.Paragraph type="secondary">
              {roleTemplateNotice}
            </Typography.Paragraph>
          ) : null}

          {filteredRoleTemplates.length === 0 ? (
            <Empty
              className="catalog-empty-state"
              description={
                selectedRoleApplicationType === 'digital_factory'
                  ? '当前还没有可安装的数字工厂，请先在管理后台创建并上架。'
                  : '当前还没有可安装的数字员工，请先刷新或检查企业权限。'
              }
            />
          ) : (
          <div className="catalog-grid role-catalog-grid">
            {filteredRoleTemplates.map((template) => {
              const installed = installedRoleCodes.has(template.roleCode);
              const isFactory = readRoleApplicationType(template) === 'digital_factory';
              const active = !isFactory && runtimeState.localRuntime.activeRoleCode === template.roleCode;
              const summary = installedRoleSummaries.find((item) => item.roleCode === template.roleCode);
              const installedRolePackage = runtimeState.rolePackages.find(
                (rolePackage) => rolePackage.roleCode === template.roleCode
              );
              const refreshedInstalledRolePackage =
                refreshedInstalledRolePackageByRoleCode.get(template.roleCode) ?? installedRolePackage;
              const readiness = refreshedInstalledRolePackage
                ? buildRoleRuntimeReadiness(runtimeState, refreshedInstalledRolePackage)
                : undefined;
              const hasTemplateUpdate = isInstalledRoleTemplateOutdated(template, installedRolePackage);
              const fileContract = buildRoleFileContractSummary(template);
              const freeTemplate = isFreeRoleTemplate(template);
              const executionModeMeta = roleExecutionModeMeta(template.executionProfile);
              const installAvailability = resolveRoleInstallAvailability(
                template,
                installedRoleApplicationUsage,
                authorizedRoleTemplateCatalog.deviceCapacity
              );
              const installStatusColor = active ? 'green' : installed ? 'blue' : installAvailability.canInstall ? 'default' : 'orange';
              const installStatusLabel = active
                ? '当前'
                : installed
                  ? '已安装'
                  : installAvailability.canInstall
                    ? '可安装'
                    : installAvailability.label;
              const installStatusTooltip = !installAvailability.canInstall && !installed
                ? installAvailability.reason
                : readiness && !readiness.ready
                  ? readiness.issueText
                  : undefined;

              return (
                <Card key={template.roleCode} bordered={false} className="catalog-card role-catalog-card">
                  <Space direction="vertical" size={10} style={{ width: '100%' }} className="role-card-content">
                    <Flex align="center" justify="space-between" gap={12} className="role-card-top-row">
                      <Flex align="center" gap={8}>
                        <span className="catalog-card-icon">
                          {isFactory ? <BankOutlined /> : <RobotOutlined />}
                        </span>
                        {freeTemplate ? <Tag color="green" className="role-card-fixed-tag">免费</Tag> : null}
                      </Flex>
                      <span className="role-card-status-tags">
                        <Tooltip title={installStatusTooltip}>
                          <Tag color={installStatusColor} className="role-card-fixed-tag">
                            {installStatusLabel}
                          </Tag>
                        </Tooltip>
                        <Tooltip title={roleExecutionProfileTooltip(template.executionProfile)}>
                          <Tag color={executionModeMeta.color} className="role-card-fixed-tag">
                            {executionModeMeta.label}
                          </Tag>
                        </Tooltip>
                        {hasTemplateUpdate ? (
                          <Tooltip title="该应用模板有新版，可以安装后更新。">
                            <Tag color="orange" className="role-card-fixed-tag">新版</Tag>
                          </Tooltip>
                        ) : null}
                      </span>
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

                    {renderRoleSkillTags(template.skills)}

                    <div className="role-card-io-grid">
                      {renderRoleIoRow('可上传', fileContract.uploadLabels, fileContract.uploadDetail)}
                      {renderRoleIoRow('可输出', fileContract.outputLabels, fileContract.outputDetail)}
                    </div>

                    <Typography.Text type="secondary" ellipsis className="catalog-card-meta">
                      {roleTemplateCategory(template)} / {template.industry} · 任务 {summary?.taskCount ?? 0}
                    </Typography.Text>

                    <Space size={6} className="role-card-actions">
                      {installed ? (
                        <Button
                          size="small"
                          type={active ? 'default' : 'primary'}
                          onClick={() => {
                            if (isFactory) {
                              setSelectedFactoryRoleCode(template.roleCode);
                              navigateToSection('factories');
                            } else {
                              activateRole(template.roleCode);
                              navigateToSection('workbench');
                            }
                          }}
                        >
                          {isFactory ? '进入工厂' : active ? '进入对话' : '开始使用'}
                        </Button>
                      ) : !installAvailability.canInstall ? (
                        <Tooltip title={installAvailability.reason}>
                          <span>
                            <Button size="small" type="primary" disabled>
                              {installAvailability.label}
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Button size="small" type="primary" onClick={() => installRoleFromMarket(template)}>
                          安装
                        </Button>
                      )}
                      {installed && hasTemplateUpdate ? (
                        <Button size="small" type="primary" ghost onClick={() => updateInstalledRole(template)}>
                          更新
                        </Button>
                      ) : null}
                      {!installed && !installAvailability.canInstall ? (
                        <Tooltip title={installAvailability.reason}>
                          <span>
                            <Button size="small" disabled>
                              配置
                            </Button>
                          </span>
                        </Tooltip>
                      ) : (
                        <Button size="small" onClick={() => openRoleConfig(template.roleCode, installed ? 'configure' : 'install')}>
                          配置
                        </Button>
                      )}
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
          )}
        </div>

        <Modal
          open={false}
          title={
            roleConfigTemplate
              ? `${roleConfigMode === 'install' ? '安装' : '配置'}：${roleConfigTemplate.name}`
              : roleConfigMode === 'install'
                ? `安装${roleConfigApplicationLabel}`
                : `配置${roleConfigApplicationLabel}`
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
                    locale={{ emptyText: `当前${roleConfigApplicationLabel}没有声明模型需求` }}
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
                    API Key 只保存在当前电脑；从 admin-console 上架的模板如果声明了多个 LLM，这里会逐项列出。
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
                    <Empty description={`当前${roleConfigApplicationLabel}没有声明模型需求`} />
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
                        从当前电脑移除该{roleConfigApplicationLabel}，历史任务和已生成产物仍会保留。
                      </Typography.Text>
                    </Space>
                    <Button
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => confirmUninstallRole(roleConfigRolePackage.roleCode)}
                    >
                      卸载{roleConfigApplicationLabel}
                    </Button>
                  </Flex>
                </div>
              ) : null}
            </Space>
          ) : (
            <Empty description={`未找到${roleConfigApplicationLabel}`} />
          )}
        </Modal>
      </>
    );
  }

  function renderRoleSkillTags(skills: DesktopRoleTemplate['skills']) {
    const visibleSkills = skills.slice(0, 2);
    const hiddenSkills = skills.slice(visibleSkills.length);
    const detail = skills.map((skill) => `${skill.name}：${skill.summary}`).join('\n');

    return (
      <div className="role-card-skill-row">
        {visibleSkills.map((skill) => (
          <Tooltip key={skill.code} title={skill.summary}>
            <Tag className="role-card-skill-tag">{skill.name}</Tag>
          </Tooltip>
        ))}
        {hiddenSkills.length > 0 ? (
          <Tooltip title={<span className="role-card-tooltip-lines">{detail}</span>}>
            <Tag className="role-card-skill-tag">+{hiddenSkills.length}</Tag>
          </Tooltip>
        ) : null}
      </div>
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

  function renderProviderModelCatalogPanel(input: {
    catalog: ModelProviderCatalog;
    selectedModelName?: string;
    onPick: (model: ModelProviderCatalog['models'][number]) => void;
  }) {
    const search = providerModelSearchQuery.trim().toLowerCase();
    const requiredCapabilities = selectedModelRequiredCapabilities;
    const selectedModel = input.catalog.models.find((model) => model.id === input.selectedModelName);
    const compatibleModels = input.catalog.models.filter((model) =>
      modelCatalogEntrySupportsCapabilities(model, requiredCapabilities)
    );
    const filteredModels = input.catalog.models.filter((model) => {
      if (
        providerModelCompatibilityOnly &&
        !modelCatalogEntrySupportsCapabilities(model, requiredCapabilities)
      ) {
        return false;
      }

      if (
        providerModelCapabilityFilter !== 'all' &&
        !modelCatalogEntrySupportsCapabilities(model, [providerModelCapabilityFilter])
      ) {
        return false;
      }

      if (!search) {
        return true;
      }

      return modelCatalogEntrySearchText(model).includes(search);
    });
    const visibleModels = prioritizeProviderCatalogModels({
      models: filteredModels,
      selectedModel,
      requiredCapabilities
    });

    return (
      <div className="provider-model-catalog">
        <Flex align="center" justify="space-between" gap={12} wrap="wrap">
          <Space size={8} wrap>
            <Typography.Text strong>已拉取可用模型</Typography.Text>
            <Tag color="purple">{input.catalog.models.length} 个</Tag>
            <Tag color={compatibleModels.length > 0 ? 'green' : 'orange'}>
              匹配当前能力 {compatibleModels.length}
            </Tag>
            <Tag>{visibleModels.length} 个正在显示</Tag>
          </Space>
          <Typography.Text type="secondary">
            最近拉取：{formatDateTime(input.catalog.fetchedAt)}
          </Typography.Text>
        </Flex>
        <div className="provider-model-toolbar">
          <Input
            allowClear
            value={providerModelSearchQuery}
            placeholder="搜索模型 ID、名称或能力，例如 qwen、asr、vl、image"
            onChange={(event) => setProviderModelSearchQuery(event.target.value)}
          />
          <Flex align="center" justify="space-between" gap={12} wrap="wrap" className="provider-model-filter-row">
            <Space size={6} wrap>
              {providerModelCapabilityFilters.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={
                    providerModelCapabilityFilter === filter.value
                      ? 'provider-model-filter active'
                      : 'provider-model-filter'
                  }
                  onClick={() => setProviderModelCapabilityFilter(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </Space>
            <Switch
              checked={providerModelCompatibilityOnly}
              checkedChildren="只看匹配"
              unCheckedChildren="查看全部"
              onChange={setProviderModelCompatibilityOnly}
            />
          </Flex>
        </div>
        <div className="provider-model-list">
          {visibleModels.map((model) => {
            const compatible = modelCatalogEntrySupportsCapabilities(model, requiredCapabilities);
            const inferredCapabilities = readModelCatalogEntryEffectiveCapabilities(model);

            return (
            <button
              key={model.id}
              type="button"
              className={
                input.selectedModelName === model.id
                  ? 'provider-model-option active'
                  : compatible
                    ? 'provider-model-option'
                    : 'provider-model-option incompatible'
              }
              onClick={() => input.onPick(model)}
              title={model.label ?? model.id}
            >
              <span>
                {model.label ?? model.id}
                {input.selectedModelName === model.id ? (
                  <Tag color="blue" className="model-source-tag">当前</Tag>
                ) : null}
                {compatible ? (
                  <Tag color="green" className="model-source-tag">匹配</Tag>
                ) : null}
                {model.source ? (
                  <Tag color={modelCatalogSourceColor(model.source)} className="model-source-tag">
                    {modelCatalogSourceLabel(model.source)}
                  </Tag>
                ) : null}
              </span>
              <small>{model.id}</small>
              <small>{modelCapabilitySummary(inferredCapabilities, 'general')}</small>
            </button>
          );
          })}
        </div>
        {visibleModels.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="没有匹配的模型。可以清空搜索词，或切换为“查看全部”。"
          />
        ) : null}
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
    const search = modelSearchQuery.trim().toLowerCase();
    const visibleModelProviderPresets = modelProviderPresets.filter((preset) => preset.id !== 'custom');
    const customModelProfiles = runtimeState.modelProfiles.filter(isCustomModelConfigurationProfile);
    const filteredPresets = visibleModelProviderPresets.filter((preset) => {
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
    const filteredCustomModelProfiles = customModelProfiles.filter((profile) => {
      if (!search) {
        return true;
      }

      return (
        profile.providerId.toLowerCase().includes(search) ||
        profile.providerName.toLowerCase().includes(search) ||
        profile.modelName.toLowerCase().includes(search) ||
        modelCapabilitySummary(profile.capabilities, profile.purpose).toLowerCase().includes(search)
      );
    });
    const selectedModelCatalog = selectedModelProfile
      ? findModelProviderCatalog(
          runtimeState.modelCatalogs,
          selectedModelProfile.providerId,
          selectedModelDefaultCredential?.apiBaseUrl ?? selectedModelProfile.apiBaseUrl
        )
      : undefined;
    const activeSelectedModelCatalog =
      latestPulledModelCatalog && latestPulledModelCatalog.profileId === selectedModelProfile?.id
        ? latestPulledModelCatalog.catalog
        : selectedModelCatalog;

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
                onClick={() => createCustomModelConfiguration()}
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

          {filteredCustomModelProfiles.length > 0 ? (
            <div className="custom-model-profile-section">
              <Flex align="center" justify="space-between" gap={12} wrap="wrap" className="custom-model-profile-header">
                <Space direction="vertical" size={2}>
                  <Typography.Title level={4}>已创建模型配置</Typography.Title>
                  <Typography.Text type="secondary">
                    自定义兼容接口会按你填写的模型供应商和模型名称展示，可创建多个独立配置。
                  </Typography.Text>
                </Space>
                <Tag color="blue">{filteredCustomModelProfiles.length} 个配置</Tag>
              </Flex>
              <div className="catalog-grid model-provider-grid custom-model-profile-grid">
                {filteredCustomModelProfiles.map((profile) => {
                  const providerName = profile.providerName.trim() || '未命名供应商';
                  const modelName = profile.modelName.trim() || '未命名模型';
                  const profileLabel = `${providerName} / ${modelName}`;
                  const defaultCredential = findDefaultModelCredential(
                    runtimeState.modelCredentials,
                    profile.providerId
                  );
                  const modelCatalog = findModelProviderCatalog(
                    runtimeState.modelCatalogs,
                    profile.providerId,
                    defaultCredential?.apiBaseUrl ?? profile.apiBaseUrl
                  );
                  const configured = isRuntimeModelProfileConfigured(profile);
                  const enabled = runtimeState.localRuntime.enabledModelProfileIds.includes(profile.id);

                  return (
                    <Card key={profile.id} bordered={false} className="catalog-card model-provider-card">
                      <Space direction="vertical" size={12} className="catalog-card-content">
                        <Flex align="flex-start" justify="space-between" gap={12}>
                          <span
                            className={`model-provider-logo provider-${profile.providerId}`}
                            title={providerName}
                            aria-label={providerName}
                          >
                            {renderModelProviderLogo(profile.providerId, providerName)}
                          </span>
                          <Space size={4} wrap>
                            <Tag color="blue">兼容接口</Tag>
                            <Tag color={configured ? 'green' : 'orange'}>
                              {configured ? '已配置' : '待配置'}
                            </Tag>
                            <Tag color={enabled ? 'green' : 'default'}>
                              {enabled ? '已启用' : '未启用'}
                            </Tag>
                            {modelCatalog ? <Tag color="purple">已拉取 {modelCatalog.models.length}</Tag> : null}
                          </Space>
                        </Flex>

                        <Space direction="vertical" size={6} style={{ width: '100%' }}>
                          <Typography.Title level={5}>{providerName} / {modelName}</Typography.Title>
                          <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                            {modelCapabilitySummary(profile.capabilities, profile.purpose)}
                            {profile.apiBaseUrl ? ` · ${profile.apiBaseUrl}` : ''}
                          </Typography.Paragraph>
                        </Space>

                        <div className="catalog-card-action-row">
                          <Space size={8}>
                            <Popconfirm
                              title="删除模型配置"
                              description={`确认删除「${profileLabel}」？相关 Key、拉取模型列表和模型切换记录也会同步清理。`}
                              okText="删除"
                              cancelText="取消"
                              okButtonProps={{ danger: true }}
                              onConfirm={() => deleteCustomModelConfiguration(profile)}
                            >
                              <Button danger icon={<DeleteOutlined />}>
                                删除
                              </Button>
                            </Popconfirm>
                            <Button
                              type="primary"
                              onClick={() => {
                                setSelectedModelId(profile.id);
                                setModelConfigOpen(true);
                              }}
                            >
                              配置模型
                            </Button>
                          </Space>
                        </div>
                      </Space>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="catalog-grid model-provider-grid">
            {filteredPresets.map((preset) => {
              const defaultCredential = findPresetDefaultCredential(preset);
              const modelCatalog = findPresetModelCatalog(preset);
              return (
              <Card key={preset.id} bordered={false} className="catalog-card model-provider-card">
                <Space direction="vertical" size={12} className="catalog-card-content">
                  <Flex align="flex-start" justify="space-between" gap={12}>
                    <span
                      className={`model-provider-logo provider-${preset.id}`}
                      title={preset.name}
                      aria-label={preset.name}
                    >
                      {renderModelProviderLogo(preset.id, preset.name)}
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

          {filteredPresets.length === 0 && filteredCustomModelProfiles.length === 0 ? (
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
              {activeSelectedModelCatalog
                ? renderProviderModelCatalogPanel({
                    catalog: activeSelectedModelCatalog,
                    selectedModelName: selectedModelProfile.modelName,
                    onPick: (model) => applyFetchedProviderModel(selectedModelProfile, model)
                  })
                : null}
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
                      isModelNoticeSuccess(modelTestNotice)
                        ? 'success'
                        : 'danger'
                    }
                  >
                    {modelTestNotice}
                  </Typography.Text>
                ) : null}
                {modelTestResult?.checks?.length ? (
                  <div className="model-test-check-list">
                    {modelTestResult.checks.map((check) => (
                      <div key={check.id} className={`model-test-check ${check.status}`}>
                        <Flex align="center" justify="space-between" gap={8} wrap="wrap">
                          <Space size={6} wrap>
                            <Tag color={modelTestCheckColor(check.status)}>
                              {modelTestCheckLabel(check.status)}
                            </Tag>
                            <Typography.Text strong>{check.label}</Typography.Text>
                            {check.costWarning ? <Tag color="gold">可能计费</Tag> : null}
                          </Space>
                          {typeof check.elapsedMs === 'number' ? (
                            <Typography.Text type="secondary">{formatElapsedMs(check.elapsedMs)}</Typography.Text>
                          ) : null}
                        </Flex>
                        <Typography.Text type="secondary">{check.message}</Typography.Text>
                        {check.endpoint ? (
                          <Typography.Text type="secondary" className="model-test-endpoint">
                            {check.endpoint}
                          </Typography.Text>
                        ) : null}
                      </div>
                    ))}
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
    const compatibleRuntimeModelOptions = buildCompatibleRuntimeModelOptions(
      runtimeState,
      profile,
      roleConfigRoleCode
    );
    const runtimeModelPath = ['modelCredentialBindings', profile.id, 'runtimeModelProfileId'];
    const modePath = ['modelCredentialBindings', profile.id, 'mode'];

    return (
      <Form.Item
        key={profile.id}
        noStyle
        shouldUpdate={(previous, current) =>
          previous.modelCredentialBindings?.[profile.id]?.runtimeModelProfileId !==
            current.modelCredentialBindings?.[profile.id]?.runtimeModelProfileId ||
          previous.modelCredentialBindings?.[profile.id]?.mode !==
            current.modelCredentialBindings?.[profile.id]?.mode
        }
      >
        {({ getFieldValue }) => {
          const runtimeModelProfileId =
            typeof getFieldValue(runtimeModelPath) === 'string' &&
            getFieldValue(runtimeModelPath).trim()
              ? getFieldValue(runtimeModelPath).trim()
              : profile.id;
          const runtimeProfile =
            runtimeState.modelProfiles.find((item) => item.id === runtimeModelProfileId) ?? profile;
          const defaultCredential = findDefaultModelCredential(
            runtimeState.modelCredentials,
            runtimeProfile.providerId
          );
          const providerCredentials = listProviderModelCredentials(
            runtimeState.modelCredentials,
            runtimeProfile.providerId
          );
          const runtimeConfigured = isRuntimeModelProfileConfigured(
            runtimeProfile,
            roleConfigRoleCode
          );
          const isRuntimeOverride = runtimeProfile.id !== profile.id;

          return (
            <div className="role-model-credential-editor">
              <Flex align="flex-start" justify="space-between" gap={12} wrap="wrap">
                <Space direction="vertical" size={2}>
                  <Typography.Text strong>
                    {runtimeProfile.providerName} / {runtimeProfile.modelName}
                  </Typography.Text>
                  <Typography.Text type="secondary">
                    {modelCapabilitySummary(profile.capabilities, profile.purpose)} · Profile ID：{profile.id}
                    {isRuntimeOverride ? ` · 实际模型：${runtimeProfile.id}` : ''}
                  </Typography.Text>
                </Space>
                <Tag color={runtimeConfigured ? 'green' : 'orange'}>
                  {runtimeConfigured ? '已就绪' : '待配置'}
                </Tag>
              </Flex>

              <Form.Item
                name={runtimeModelPath}
                label="实际调用模型"
                tooltip="显示输入输出能力兼容且已配置的本机模型。保存后会自动启用所选模型。API Key 请在模型配置里先配置好。"
              >
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择实际调用模型"
                  options={compatibleRuntimeModelOptions}
                />
              </Form.Item>

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
                {({ getFieldValue: readModeFieldValue }) => {
                  const mode = (readModeFieldValue(modePath) ?? 'provider_default') as ModelCredentialBindingMode;

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
                          initialValue={runtimeProfile.apiBaseUrl}
                        >
                          <Input placeholder={runtimeProfile.apiBaseUrl ?? 'https://api.example.com/v1'} />
                        </Form.Item>
                        <Form.Item
                          name={['modelCredentialBindings', profile.id, 'apiKey']}
                          label="专用 API Key"
                          rules={[{ required: true, message: '请输入专用 API Key' }]}
                        >
                          <Input.Password placeholder="只给当前应用使用" />
                        </Form.Item>
                      </div>
                    );
                  }

                  return (
                    <Typography.Text type={defaultCredential ? 'secondary' : 'danger'}>
                      {defaultCredential
                        ? `将使用 ${defaultCredential.label}`
                        : `尚未配置 ${runtimeProfile.providerName} 默认 Key，可先去“模型配置”填写，或选择“单独输入 Key”。`}
                    </Typography.Text>
                  );
                }}
              </Form.Item>
            </div>
          );
        }}
      </Form.Item>
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
    const normalizedBindingIds = new Set(
      runtimeState.localRuntime.knowledgeBindingIds.map(normalizeKnowledgeBindingId)
    );
    const enterpriseOption =
      knowledgeBindingCatalogByBindingId.get(enterpriseKnowledgeBindingId) ?? knowledgeBindingCatalog[1];
    const localPdfOption =
      knowledgeBindingCatalogByBindingId.get(localPdfKnowledgeBindingId) ?? knowledgeBindingCatalog[0];
    const enterpriseSource = knowledgeSources.find(
      (source) => normalizeKnowledgeBindingId(source.id) === enterpriseKnowledgeBindingId
    );
    const localPdfSource = knowledgeSources.find(
      (source) => normalizeKnowledgeBindingId(source.id) === localPdfKnowledgeBindingId
    );
    const enterpriseEnabled =
      Boolean(enterpriseSource?.enabled) && normalizedBindingIds.has(enterpriseKnowledgeBindingId);
    const localPdfEnabled = Boolean(localPdfSource?.enabled) && normalizedBindingIds.has(localPdfKnowledgeBindingId);

    return (
      <div className="catalog-page knowledge-page">
        <Flex align="center" justify="space-between" gap={16} wrap="wrap" className="catalog-page-header">
          <div>
            <Typography.Title level={2} className="page-title">
              知识库
            </Typography.Title>
            <Typography.Text type="secondary">
              企业知识库和本地 PDF 会在任务运行时自动合并，数字员工和数字工厂只需要调用“知识库”。
            </Typography.Text>
          </div>

          <Space wrap>
            <Button icon={<CloudSyncOutlined />} loading={isSyncing} onClick={syncRuntimeState}>
              同步企业知识库
            </Button>
            <Button type="primary" icon={<FileAddOutlined />} onClick={() => void addKnowledgeBinding(localPdfOption)}>
              选择本地 PDF
            </Button>
          </Space>
        </Flex>

        <div className="knowledge-source-summary-grid">
          <Card bordered={false} className="knowledge-status-card">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Flex align="flex-start" justify="space-between" gap={12}>
                <Space align="start">
                  <span className="catalog-card-icon">
                    <CloudSyncOutlined />
                  </span>
                  <div>
                    <Typography.Title level={5}>企业知识库</Typography.Title>
                    <Typography.Text type="secondary">
                      {enterpriseOption?.description ?? '同步 web-console 中启用的企业知识。'}
                    </Typography.Text>
                  </div>
                </Space>
                <Tag color={enterpriseEnabled ? 'green' : 'default'}>
                  {enterpriseEnabled ? '已启用' : enterpriseSource ? '未启用' : '未同步'}
                </Tag>
              </Flex>

              <Descriptions column={1} size="small" className="knowledge-descriptions">
                <Descriptions.Item label="来源">web-console 企业知识库</Descriptions.Item>
                <Descriptions.Item label="最近同步">
                  {enterpriseSource?.lastIndexedAt
                    ? formatDate(enterpriseSource.lastIndexedAt)
                    : runtimeState.localRuntime.lastSyncedAt
                      ? formatDate(runtimeState.localRuntime.lastSyncedAt)
                      : '尚未同步'}
                </Descriptions.Item>
                <Descriptions.Item label="当前内容">
                  {enterpriseSource?.summary ? (
                    <Typography.Paragraph ellipsis={{ rows: 4 }} className="knowledge-source-description">
                      {enterpriseSource.summary}
                    </Typography.Paragraph>
                  ) : (
                    <Typography.Text type="secondary">企业知识库为空，或当前设备尚未绑定企业。</Typography.Text>
                  )}
                </Descriptions.Item>
              </Descriptions>

              <Button icon={<CloudSyncOutlined />} loading={isSyncing} onClick={syncRuntimeState}>
                立即同步
              </Button>
            </Space>
          </Card>

          <Card bordered={false} className="knowledge-status-card">
            <Space direction="vertical" size={14} style={{ width: '100%' }}>
              <Flex align="flex-start" justify="space-between" gap={12}>
                <Space align="start">
                  <span className="catalog-card-icon">
                    <FilePdfOutlined />
                  </span>
                  <div>
                    <Typography.Title level={5}>本地 PDF 知识库</Typography.Title>
                    <Typography.Text type="secondary">
                      {localPdfOption?.description ?? '选择一份本机 PDF 作为本地知识库。'}
                    </Typography.Text>
                  </div>
                </Space>
                <Tag color={localPdfEnabled ? 'green' : 'default'}>{localPdfEnabled ? '已启用' : '未配置'}</Tag>
              </Flex>

              {localPdfSource ? (
                <Descriptions column={1} size="small" className="knowledge-descriptions">
                  <Descriptions.Item label="文件">{localPdfSource.label}</Descriptions.Item>
                  <Descriptions.Item label="路径">
                    <Typography.Text ellipsis title={localPdfSource.localPath}>
                      {localPdfSource.localPath ?? '未记录本地路径'}
                    </Typography.Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="最近索引">
                    {localPdfSource.lastIndexedAt ? formatDate(localPdfSource.lastIndexedAt) : '尚未索引'}
                  </Descriptions.Item>
                  <Descriptions.Item label="内容预览">
                    <Typography.Paragraph ellipsis={{ rows: 4 }} className="knowledge-source-description">
                      {localPdfSource.summary ?? '已选择本地 PDF。'}
                    </Typography.Paragraph>
                  </Descriptions.Item>
                </Descriptions>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="尚未选择本地 PDF"
                  className="knowledge-empty-state"
                />
              )}

              <Button type="primary" icon={<FileAddOutlined />} onClick={() => void addKnowledgeBinding(localPdfOption)}>
                {localPdfSource ? '替换 PDF' : '选择 PDF'}
              </Button>
            </Space>
          </Card>
        </div>

        <section className="simple-panel">
          <Typography.Title level={5}>运行规则</Typography.Title>
          <List
            dataSource={[
              '企业知识库由 web-console 维护，PC 端只负责同步当前启用版本。',
              '本地知识库只选择一份完整 PDF，替换 PDF 后会覆盖旧的本地知识来源。',
              '任务运行时会合并企业知识库和本地 PDF；本地 PDF 可以为空，企业知识库建议保持启用。'
            ]}
            renderItem={(item) => (
              <List.Item>
                <List.Item.Meta avatar={<DatabaseOutlined className="list-icon" />} description={item} />
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
        mergeUniqueStrings(
          current.localRuntime.enabledModelProfileIds,
          installedRolePackage.modelProfileIds
        ),
        readRuntimeModelProfileIdsFromRoleConfigForm(values?.modelCredentialBindings)
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
      const currentActiveRolePackage = current.localRuntime.activeRoleCode
        ? rolePackages.find((rolePackage) => rolePackage.roleCode === current.localRuntime.activeRoleCode)
        : undefined;
      const activeRoleCode =
        currentActiveRolePackage && readRoleApplicationType(currentActiveRolePackage) === 'digital_employee'
          ? currentActiveRolePackage.roleCode
          : readRoleApplicationType(installedRolePackage) === 'digital_employee'
            ? template.roleCode
            : rolePackages.find((rolePackage) => readRoleApplicationType(rolePackage) === 'digital_employee')?.roleCode;
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

  function installRoleFromMarket(template: DesktopRoleTemplate) {
    const installAvailability = resolveRoleInstallAvailability(
      template,
      installedRoleApplicationUsage,
      authorizedRoleTemplateCatalog.deviceCapacity
    );
    if (!installAvailability.canInstall) {
      message.warning(installAvailability.reason);
      return;
    }

    installRole(template);
    message.success(`${template.name} 已安装，缺少配置时会在运行前提示你补充。`);
  }

  function confirmUninstallRole(roleCode: string) {
    const rolePackage = runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    if (!rolePackage) {
      message.warning('该应用未安装在当前电脑。');
      return;
    }

    setPendingUninstallRoleCode(roleCode);
  }

  function uninstallRole(roleCode: string) {
    const rolePackage = runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    if (!rolePackage) {
      message.warning('该应用未安装在当前电脑。');
      return;
    }

    if (hasBlockingTaskForRole(runtimeState, roleCode)) {
      message.warning('该应用正在执行任务，请等待任务完成或取消后再卸载。');
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

  function buildFactoryRunDefaultValues(roleCode: string): FactoryRunFormValues | undefined {
    const template = desktopRoleTemplateByRoleCode.get(roleCode);
    if (!template) {
      return undefined;
    }

    const factory = readFactoryManifest(template.dependencyManifest);
    if (isMedicalCaseVideoFactory(factory)) {
      const screeningProfiles = readFactoryScreeningProfiles(factory, roleCode);
      const defaultProfile = screeningProfiles.find((item) => item.defaultSelected) ?? screeningProfiles[0];
      const rolePackage =
        getPreparedInstalledRolePackage(roleCode) ??
        normalizeRolePackageRequiredModelProfiles(toInstalledRolePackage(template));
      const modelRequirements = getRoleModelRuntimeRequirementStatuses(
        ensureModelProfilesForRolePackage(runtimeState.modelProfiles, rolePackage),
        runtimeState.localRuntime.enabledModelProfileIds,
        rolePackage,
        {
          roleCode,
          credentials: runtimeState.modelCredentials,
          roleBindings: runtimeState.roleModelCredentialBindings
        }
      );
      const audioRequirements = modelRequirements.filter((requirement) =>
        readModelProfileCapabilities(requirement.profile).includes('audio_to_text')
      );
      const readyAudioProfile = audioRequirements.find((requirement) => requirement.ready)?.profile;
      const firstAudioProfile = audioRequirements[0]?.profile;

      return {
        roleCode,
        asrModelProfileId: readyAudioProfile?.id ?? firstAudioProfile?.id,
        dialect: factory.asr?.defaultDialect ?? 'auto',
        screeningProfileKey: defaultProfile?.key ?? 'default_medical_case',
        editEnabled: factory.editing?.defaultEnabled ?? false,
        editTargetSeconds: factory.editing?.targetSeconds ?? 30,
        instruction: ''
      };
    }

    const packageOptions = readFactoryPackageOptions(factory);
    const packageDefinitions = readFactoryPackagePreset(roleCode, packageOptions);
    const platformOptions = readFactoryPlatformOptions(factory);
    const qualityModes = readFactoryQualityModes(factory);
    const defaultPackages = packageDefinitions
      .filter((item) => item.defaultSelected !== false)
      .map((item) => item.key);

    return {
      roleCode,
      platform: platformOptions[0]?.key ?? 'amazon',
      packageDefinitions,
      packageKeys: defaultPackages.length ? defaultPackages : packageDefinitions.map((item) => item.key),
      qualityCheckMode: qualityModes[0]?.key ?? 'basic',
      promptLanguage: '',
      promptStyle: '',
      promptGoal: '',
      promptMustKeep: '',
      promptAvoid: '',
      instruction: ''
    };
  }

  function resetFactoryRunFormForRole(roleCode: string) {
    const defaultValues = buildFactoryRunDefaultValues(roleCode);
    if (!defaultValues) {
      message.warning('未找到这个数字工厂。');
      return false;
    }

    factoryRunForm.setFieldsValue(defaultValues);
    setFactoryAttachments([]);
    return true;
  }

  function readFactoryManifestForRoleCode(roleCode: string) {
    const rolePackage = runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    const template = desktopRoleTemplateByRoleCode.get(roleCode);
    return readFactoryManifest(rolePackage?.dependencyManifest ?? template?.dependencyManifest);
  }

  function openFactoryPackageEditor(roleCode: string) {
    if (!roleCode) {
      message.warning('请先选择一个数字工厂。');
      return;
    }

    const factory = readFactoryManifestForRoleCode(roleCode);
    const currentPackages = normalizeFactoryPackageDefinitions(
      factoryRunForm.getFieldValue('packageDefinitions'),
      readFactoryPackageOptions(factory)
    );
    setFactoryPackageEditorRoleCode(roleCode);
    setFactoryPackageEditorDraft(currentPackages);
    setFactoryPackageEditorOpen(true);
  }

  function updateFactoryPackageEditorDraft(index: number, patch: Partial<FactoryRunPackageDefinition>) {
    setFactoryPackageEditorDraft((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item))
    );
  }

  function addFactoryPackageEditorDraft() {
    setFactoryPackageEditorDraft((current) => {
      if (current.length >= 20) {
        message.warning('单个数字工厂最多保留 20 个产物包。');
        return current;
      }

      const usedKeys = new Set(current.map((item) => item.key));
      let index = current.length + 1;
      let key = `custom_${index}`;
      while (usedKeys.has(key)) {
        index += 1;
        key = `custom_${index}`;
      }

      return [
        ...current,
        {
          key,
          label: `自定义产物包 ${index}`,
          description: '',
          outputType: 'image',
          defaultSelected: true,
          custom: true
        }
      ];
    });
  }

  function removeFactoryPackageEditorDraft(index: number) {
    setFactoryPackageEditorDraft((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function applyFactoryPackageEditorDraft(options?: { saveAsDefault?: boolean }) {
    if (!factoryPackageEditorRoleCode) {
      return;
    }

    const factory = readFactoryManifestForRoleCode(factoryPackageEditorRoleCode);
    const normalizedPackages = normalizeFactoryPackageDefinitions(
      factoryPackageEditorDraft,
      readFactoryPackageOptions(factory)
    );
    if (!normalizedPackages.length) {
      message.warning('请至少保留一个产物包。');
      return;
    }

    const currentSelectedKeys = new Set<string>(factoryRunForm.getFieldValue('packageKeys') ?? []);
    const nextPackageKeys = normalizedPackages
      .filter((item) => currentSelectedKeys.has(item.key) || item.custom)
      .map((item) => item.key);
    const selectedPackageKeys = nextPackageKeys.length
      ? nextPackageKeys
      : normalizedPackages
          .filter((item) => item.defaultSelected !== false)
          .map((item) => item.key);

    factoryRunForm.setFieldsValue({
      packageDefinitions: normalizedPackages,
      packageKeys: selectedPackageKeys.length ? selectedPackageKeys : normalizedPackages.map((item) => item.key)
    });

    if (options?.saveAsDefault) {
      writeFactoryPackagePreset(factoryPackageEditorRoleCode, normalizedPackages);
      message.success('已保存为这台电脑的默认产物包。');
    } else {
      message.success('已应用到本次任务。');
    }

    setFactoryPackageEditorOpen(false);
  }

  function restoreFactoryPackageDefaults() {
    if (!factoryPackageEditorRoleCode) {
      return;
    }

    const factory = readFactoryManifestForRoleCode(factoryPackageEditorRoleCode);
    const defaultPackages = normalizeFactoryPackageDefinitions(readFactoryPackageOptions(factory), []);
    const selectedPackageKeys = defaultPackages
      .filter((item) => item.defaultSelected !== false)
      .map((item) => item.key);
    removeFactoryPackagePreset(factoryPackageEditorRoleCode);
    factoryRunForm.setFieldsValue({
      packageDefinitions: defaultPackages,
      packageKeys: selectedPackageKeys.length ? selectedPackageKeys : defaultPackages.map((item) => item.key)
    });
    setFactoryPackageEditorDraft(defaultPackages);
    message.success('已恢复官方默认产物包。');
  }

  function openFactoryScreeningProfileEditor(roleCode: string) {
    if (!roleCode) {
      message.warning('请先选择一个数字工厂。');
      return;
    }

    const factory = readFactoryManifestForRoleCode(roleCode);
    if (!isMedicalCaseVideoFactory(factory)) {
      message.warning('当前数字工厂不需要筛选标准。');
      return;
    }

    const profiles = readFactoryScreeningProfiles(factory, roleCode);
    const currentKey = factoryRunForm.getFieldValue('screeningProfileKey');
    const selectedProfile =
      profiles.find((item) => item.key === currentKey) ??
      profiles.find((item) => item.defaultSelected) ??
      profiles[0];
    setFactoryScreeningEditorRoleCode(roleCode);
    setFactoryScreeningEditorProfiles(profiles);
    setFactoryScreeningEditorSelectedKey(selectedProfile?.key ?? '');
    setFactoryScreeningEditorOpen(true);
  }

  function createFactoryScreeningProfileDraft(
    source: FactoryRunScreeningProfileDefinition | undefined,
    profiles: FactoryRunScreeningProfileDefinition[]
  ): FactoryRunScreeningProfileDefinition {
    const usedKeys = new Set(profiles.map((item) => item.key));
    let index = profiles.filter((item) => item.custom).length + 1;
    let key = `custom_screening_${index}`;
    while (usedKeys.has(key)) {
      index += 1;
      key = `custom_screening_${index}`;
    }

    return {
      key,
      label: source ? `${source.label} 副本` : `自定义筛选标准 ${index}`,
      description: source?.description ?? '',
      defaultSelected: false,
      gates: cloneFactoryScreeningGates(
        source?.gates?.length ? source.gates : defaultFactoryVideoScreeningGateDefinitions
      ),
      custom: true
    };
  }

  function addFactoryScreeningProfileDraft() {
    const currentProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    const nextProfile = createFactoryScreeningProfileDraft(currentProfile, factoryScreeningEditorProfiles);
    setFactoryScreeningEditorProfiles((current) => [...current, nextProfile]);
    setFactoryScreeningEditorSelectedKey(nextProfile.key);
  }

  function updateFactoryScreeningProfileDraft(patch: Partial<FactoryRunScreeningProfileDefinition>) {
    setFactoryScreeningEditorProfiles((current) =>
      current.map((item) =>
        item.key === factoryScreeningEditorSelectedKey && item.custom
          ? {
              ...item,
              ...patch,
              gates: patch.gates ?? item.gates
            }
          : item
      )
    );
  }

  function removeFactoryScreeningProfileDraft() {
    const target = factoryScreeningEditorProfiles.find((item) => item.key === factoryScreeningEditorSelectedKey);
    if (!target) {
      return;
    }
    if (!target.custom) {
      message.warning('系统模板不能删除，可以先复制为自定义标准。');
      return;
    }

    const nextProfiles = factoryScreeningEditorProfiles.filter((item) => item.key !== target.key);
    setFactoryScreeningEditorProfiles(nextProfiles);
    setFactoryScreeningEditorSelectedKey(
      nextProfiles.find((item) => item.defaultSelected)?.key ?? nextProfiles[0]?.key ?? ''
    );
  }

  function updateFactoryScreeningGateDraft(
    gateIndex: number,
    patch: Partial<FactoryVideoScreeningGateDefinition>
  ) {
    const currentProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    if (!currentProfile?.custom) {
      return;
    }

    updateFactoryScreeningProfileDraft({
      gates: currentProfile.gates.map((gate, index) => (index === gateIndex ? { ...gate, ...patch } : gate))
    });
  }

  function addFactoryScreeningRuleDraft(gateIndex: number) {
    const currentProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    if (!currentProfile?.custom) {
      return;
    }

    const usedMetrics = new Set(currentProfile.gates[gateIndex]?.rules.map((rule) => rule.metric) ?? []);
    const metric =
      factoryVideoScreeningMetricOptions.find((item) => !usedMetrics.has(item.key)) ??
      factoryVideoScreeningMetricOptions[0];
    updateFactoryScreeningGateDraft(gateIndex, {
      rules: [...(currentProfile.gates[gateIndex]?.rules ?? []), createFactoryScreeningRule(metric.key)]
    });
  }

  function updateFactoryScreeningRuleDraft(
    gateIndex: number,
    ruleIndex: number,
    patch: Partial<FactoryVideoScreeningRuleDefinition>
  ) {
    const currentProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    if (!currentProfile?.custom) {
      return;
    }

    const gates = currentProfile.gates.map((gate, currentGateIndex) => {
      if (currentGateIndex !== gateIndex) {
        return gate;
      }

      return {
        ...gate,
        rules: gate.rules.map((rule, currentRuleIndex) =>
          currentRuleIndex === ruleIndex ? { ...rule, ...patch } : rule
        )
      };
    });
    updateFactoryScreeningProfileDraft({ gates });
  }

  function changeFactoryScreeningRuleMetric(gateIndex: number, ruleIndex: number, metricKey: string) {
    updateFactoryScreeningRuleDraft(gateIndex, ruleIndex, createFactoryScreeningRule(metricKey));
  }

  function removeFactoryScreeningRuleDraft(gateIndex: number, ruleIndex: number) {
    const currentProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    if (!currentProfile?.custom) {
      return;
    }

    const gate = currentProfile.gates[gateIndex];
    if (!gate || gate.rules.length <= 1) {
      message.warning('每个筛选分组至少保留一条规则。');
      return;
    }

    updateFactoryScreeningGateDraft(gateIndex, {
      rules: gate.rules.filter((_, index) => index !== ruleIndex)
    });
  }

  function restoreFactoryScreeningProfileDefaults() {
    if (!factoryScreeningEditorRoleCode) {
      return;
    }

    const factory = readFactoryManifestForRoleCode(factoryScreeningEditorRoleCode);
    const defaultProfiles = readFactoryScreeningProfiles(factory);
    writeFactoryCustomScreeningProfiles(factoryScreeningEditorRoleCode, []);
    setFactoryScreeningEditorProfiles(defaultProfiles);
    setFactoryScreeningEditorSelectedKey(
      defaultProfiles.find((item) => item.defaultSelected)?.key ?? defaultProfiles[0]?.key ?? ''
    );
    factoryRunForm.setFieldsValue({
      screeningProfileKey: defaultProfiles.find((item) => item.defaultSelected)?.key ?? defaultProfiles[0]?.key
    });
    refreshFactoryScreeningProfiles((value) => value + 1);
    message.success('已恢复系统筛选标准。');
  }

  function applyFactoryScreeningProfileEditor() {
    if (!factoryScreeningEditorRoleCode) {
      return;
    }

    const selectedProfile = factoryScreeningEditorProfiles.find(
      (item) => item.key === factoryScreeningEditorSelectedKey
    );
    const validationMessage = validateFactoryScreeningProfile(selectedProfile);
    if (validationMessage) {
      message.warning(validationMessage);
      return;
    }

    const customProfiles = factoryScreeningEditorProfiles.filter((item) => item.custom);
    for (const profile of customProfiles) {
      const customValidationMessage = validateFactoryScreeningProfile(profile);
      if (customValidationMessage) {
        message.warning(`${profile.label || '未命名筛选标准'}：${customValidationMessage}`);
        return;
      }
    }

    writeFactoryCustomScreeningProfiles(factoryScreeningEditorRoleCode, customProfiles);
    factoryRunForm.setFieldsValue({ screeningProfileKey: selectedProfile?.key });
    refreshFactoryScreeningProfiles((value) => value + 1);
    setFactoryScreeningEditorOpen(false);
    message.success('筛选标准已保存并应用到当前任务。');
  }

  function submitFactoryRun(values: FactoryRunFormValues) {
    const template = desktopRoleTemplateByRoleCode.get(values.roleCode);
    if (!template) {
      message.warning('未找到这个数字工厂。');
      return;
    }

    const factory = readFactoryManifest(template.dependencyManifest);
    const maxItems = readFactoryMaxItems(factory);
    if (isMedicalCaseVideoFactory(factory)) {
      const videoAttachments = factoryAttachments.filter((attachment) => isFactoryVideoAttachment(attachment));
      if (videoAttachments.length === 0) {
        message.warning('请至少添加一个案例视频。');
        return;
      }
      if (videoAttachments.length > maxItems) {
        message.warning(`单批最多处理 ${maxItems} 个视频，请拆分批次。`);
        return;
      }
      if (videoAttachments.some((attachment) => !attachment.localPath)) {
        message.warning('当前运行环境没有暴露视频本地路径，无法执行本机视频筛选。');
        return;
      }
      if (!values.asrModelProfileId) {
        message.warning('请选择一个可用的语音转文字模型。');
        return;
      }

      const rolePackage =
        getPreparedInstalledRolePackage(values.roleCode) ??
        normalizeRolePackageRequiredModelProfiles(toInstalledRolePackage(template));
      const availableModelProfiles = ensureModelProfilesForRolePackage(runtimeState.modelProfiles, rolePackage);
      const asrProfile = availableModelProfiles.find((profile) => profile.id === values.asrModelProfileId);
      if (
        !asrProfile ||
        !readModelProfileCapabilities(asrProfile).includes('audio_to_text')
      ) {
        message.warning('请选择语音转文字能力对应的模型。');
        return;
      }

      const title = `${template.name} - ${videoAttachments.length} 个视频`;
      const input = buildMedicalCaseVideoFactoryTaskInput({
        template,
        factory,
        values,
        attachments: videoAttachments
      });
      const created = createTask({
        roleCode: values.roleCode,
        title,
        input,
        attachments: videoAttachments,
        extraModelProfileIds: [values.asrModelProfileId]
      });
      if (created) {
        resetFactoryRunFormForRole(values.roleCode);
        setSelectedFactoryRoleCode(values.roleCode);
        navigateToSection('factories');
      }
      return;
    }

    const imageAttachments = factoryAttachments.filter((attachment) => isFactoryImageAttachment(attachment));
    const invalidImageFactoryAttachments = factoryAttachments.filter(
      (attachment) => !isFactoryImageInputAttachment(attachment)
    );
    if (imageAttachments.length === 0) {
      message.warning('请至少上传一张商品参考图。');
      return;
    }
    if (invalidImageFactoryAttachments.length > 0) {
      message.warning('当前工厂只支持图片、Excel 或 CSV，请移除不适用文件后再运行。');
      return;
    }
    if (imageAttachments.length > maxItems) {
      message.warning(`单批最多处理 ${maxItems} 张商品图，请拆分批次。`);
      return;
    }
    const imageFactoryValues: FactoryRunFormValues = {
      ...values,
      packageDefinitions: normalizeFactoryPackageDefinitions(
        factoryRunForm.getFieldValue('packageDefinitions'),
        readFactoryPackageOptions(factory)
      )
    };
    if (!imageFactoryValues.packageKeys?.length) {
      message.warning('请至少选择一个产物包。');
      return;
    }

    const platform = readFactoryPlatformOptions(factory).find((item) => item.key === imageFactoryValues.platform);
    const title = `${template.name} - ${platform?.label ?? imageFactoryValues.platform} - ${imageAttachments.length} 个商品`;
    const input = buildFactoryTaskInput({
      template,
      factory,
      values: imageFactoryValues,
      attachments: factoryAttachments
    });

    const created = createTask({
      roleCode: values.roleCode,
      title,
      input,
      attachments: factoryAttachments
    });
    if (created) {
      resetFactoryRunFormForRole(values.roleCode);
      setSelectedFactoryRoleCode(values.roleCode);
      navigateToSection('factories');
    }
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

  function createCustomModelConfiguration() {
    const profile = createCustomCompatibleModelProfile(runtimeState.modelProfiles, {
      providerName: '',
      modelName: 'custom-model',
      purpose: 'general',
      capabilities: ['text'],
      temperature: 0.4,
      maxTokens: 4096
    });

    setRuntimeState((current) => ({
      ...current,
      modelProfiles: [...current.modelProfiles, profile]
    }));
    setSelectedModelId(profile.id);
    modelForm.setFieldsValue({
      providerName: '',
      modelName: profile.modelName,
      purpose: profile.purpose,
      capabilities: readModelProfileCapabilities(profile),
      apiBaseUrl: '',
      apiKey: '',
      temperature: profile.temperature,
      maxTokens: profile.maxTokens,
      monthlyBudgetCents: profile.monthlyBudgetCents,
      fallbackProfileId: undefined
    });
    setModelTestNotice('已新建模型配置，请填写模型供应商、模型、API Base URL 和 API Key。');
    setModelTestResult(null);
    setLatestPulledModelCatalog(null);
    setModelConfigOpen(true);
  }

  function deleteCustomModelConfiguration(profile: ModelProfile) {
    if (!isCustomModelConfigurationProfile(profile)) {
      message.warning('系统预设模型配置不能在这里删除。');
      return;
    }

    const providerName = profile.providerName.trim() || '未命名供应商';
    const modelName = profile.modelName.trim() || '未命名模型';
    const label = `${providerName} / ${modelName}`;

    setRuntimeState((current) => {
      const nextModelProfiles = current.modelProfiles
        .filter((item) => item.id !== profile.id)
        .map((item) =>
          item.fallbackProfileId === profile.id
            ? { ...item, fallbackProfileId: undefined }
            : item
        );
      const providerStillUsed = nextModelProfiles.some(
        (item) => item.providerId === profile.providerId
      );
      const removedCredentialIds = new Set(
        current.modelCredentials
          .filter((credential) => credential.providerId === profile.providerId)
          .map((credential) => credential.id)
      );

      return {
        ...current,
        modelProfiles: nextModelProfiles,
        modelCredentials: providerStillUsed
          ? current.modelCredentials
          : current.modelCredentials.filter(
              (credential) => credential.providerId !== profile.providerId
            ),
        modelCatalogs: providerStillUsed
          ? current.modelCatalogs
          : current.modelCatalogs.filter((catalog) => catalog.providerId !== profile.providerId),
        roleModelCredentialBindings: current.roleModelCredentialBindings.filter(
          (binding) =>
            binding.modelProfileId !== profile.id &&
            binding.runtimeModelProfileId !== profile.id &&
            (
              providerStillUsed ||
              !binding.credentialId ||
              !removedCredentialIds.has(binding.credentialId)
            )
        ),
        localRuntime: {
          ...current.localRuntime,
          enabledModelProfileIds: current.localRuntime.enabledModelProfileIds.filter(
            (profileId) => profileId !== profile.id
          )
        }
      };
    });

    if (selectedModelId === profile.id) {
      setSelectedModelId('');
      setModelConfigOpen(false);
    }
    setLatestPulledModelCatalog((current) =>
      current?.profileId === profile.id ? null : current
    );
    setModelTestResult(null);
    setModelTestNotice('');
    message.success(`已删除模型配置：${label}`);
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
      localRuntime: {
        ...current.localRuntime,
        enabledModelProfileIds: mergeUniqueStrings(
          current.localRuntime.enabledModelProfileIds,
          [updatedProfile.id]
        )
      },
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
    options: { apiBaseUrl?: string; apiKey?: string; replaceProfileId?: string } = {}
  ) {
    const presetForSelection = options.apiBaseUrl
      ? { ...preset, apiBaseUrl: options.apiBaseUrl }
      : preset;
    const selection = selectModelProfileForPreset(runtimeState.modelProfiles, presetForSelection, model, {
      replaceProfileId: options.replaceProfileId
    });

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
    setModelTestResult(null);

    try {
      const values = await modelForm.validateFields();
      const apiBaseUrl = values.apiBaseUrl?.trim();
      const apiKey = values.apiKey?.trim();
      const capabilities = normalizeModelCapabilities(
        values.capabilities,
        values.purpose ?? selectedModelProfile.purpose
      );

      if ((!apiBaseUrl && !isNativeProviderModelProfile(selectedModelProfile, capabilities)) || !apiKey) {
        setModelTestNotice('请先填写 API Key；OpenAI 兼容接口还需要填写 API Base URL。');
        return;
      }

      if (modelCapabilitiesMayCreatePaidArtifacts(capabilities)) {
        const confirmed = await confirmPaidModelTest();
        if (!confirmed) {
          setModelTestNotice('已取消模型测试。');
          return;
        }
      }

      const profile: ModelProfile = {
        ...selectedModelProfile,
        providerName: values.providerName.trim(),
        modelName: values.modelName.trim(),
        purpose: purposeForModelCapabilities(
          capabilities,
          values.purpose ?? selectedModelProfile.purpose
        ),
        capabilities,
        apiBaseUrl,
        apiKey,
        temperature: values.temperature,
        maxTokens: Math.min(values.maxTokens ?? 256, 512),
        monthlyBudgetCents: values.monthlyBudgetCents,
        fallbackProfileId: values.fallbackProfileId || undefined
      };

      const response = await window.qiuDesktop.testModelConnection({
        profile,
        timeoutMs: modelCapabilitiesMayCreatePaidArtifacts(capabilities) ? 180_000 : 30_000
      });

      setModelTestResult(response);
      setModelTestNotice(formatModelTestNotice(response));
    } catch (error) {
      setModelTestNotice(`模型连接失败：${error instanceof Error ? error.message : 'unknown error'}`);
      setModelTestResult(null);
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
    setModelTestResult(null);

    try {
      const values = await modelForm.validateFields();
      const apiBaseUrl = values.apiBaseUrl?.trim();
      const apiKey = values.apiKey?.trim();
      const capabilities = normalizeModelCapabilities(
        values.capabilities,
        values.purpose ?? selectedModelProfile.purpose
      );

      if ((!apiBaseUrl && !isNativeProviderModelProfile(selectedModelProfile, capabilities)) || !apiKey) {
        setModelTestNotice('请先填写 API Key；OpenAI 兼容接口还需要填写 API Base URL。');
        return;
      }

      const catalog = await window.qiuDesktop.listProviderModels({
        providerId: selectedModelProfile.providerId,
        providerName: values.providerName.trim(),
        apiBaseUrl,
        apiKey,
        modelName: values.modelName.trim(),
        capabilities,
        timeoutMs: 20_000
      });

      setLatestPulledModelCatalog({
        profileId: selectedModelProfile.id,
        catalog
      });
      setRuntimeState((current) => ({
        ...current,
        modelCatalogs: upsertModelProviderCatalog(current.modelCatalogs, catalog)
      }));
      setModelTestNotice(
        catalog.models.length > 0
          ? `已拉取 ${catalog.models.length} 个可配置模型。请选择需要启用的模型后保存。`
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
    const formProviderName = modelForm.getFieldValue('providerName')?.trim();
    const formApiBaseUrl = modelForm.getFieldValue('apiBaseUrl')?.trim();
    const formApiKey = modelForm.getFieldValue('apiKey')?.trim();
    const preset =
      modelProviderPresets.find((item) => item.id === currentProfile.providerId) ?? {
        id: currentProfile.providerId,
        name: formProviderName || currentProfile.providerName || '自定义供应商',
        summary: `${currentProfile.providerName} compatible endpoint.`,
        apiBaseUrl: formApiBaseUrl || currentProfile.apiBaseUrl,
        models: []
      };
    const presetModel = createPresetModelFromCatalogEntry(model, currentProfile.purpose);

    applyModelProviderPreset(preset, presetModel, {
      apiBaseUrl: formApiBaseUrl,
      apiKey: formApiKey,
      replaceProfileId: currentProfile.id
    });
    setModelTestNotice(`已选择 ${preset.name} / ${model.id}，保存后会更新当前模型配置。`);
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
    try {
      const now = new Date().toISOString();
      const bindingId = normalizeKnowledgeBindingId(option.bindingId);
      const pathResult =
        option.source === 'local_folder' || option.source === 'local_file'
          ? await window.qiuDesktop?.selectKnowledgeSourcePath(option.source)
          : undefined;

      if (pathResult?.canceled) {
        return;
      }

      const knowledgeSource: DesktopKnowledgeSourceSummary = {
        id: bindingId,
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
        return {
          ...current,
          knowledgeSources: [
            ...current.knowledgeSources.filter((source) => normalizeKnowledgeBindingId(source.id) !== bindingId),
            knowledgeSource
          ],
          localRuntime: {
            ...current.localRuntime,
            knowledgeBindingIds: mergeUniqueStrings(
              current.localRuntime.knowledgeBindingIds.map(normalizeKnowledgeBindingId),
              [bindingId]
            )
          }
        };
      });
    } catch (error) {
      message.error(`导入知识库失败：${error instanceof Error ? error.message : 'unknown error'}`);
    }
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
    if (mode === 'install') {
      const installAvailability = resolveRoleInstallAvailability(
        template,
        installedRoleApplicationUsage,
        authorizedRoleTemplateCatalog.deviceCapacity
      );
      if (!installAvailability.canInstall) {
        message.warning(installAvailability.reason);
        return;
      }
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
    if (roleConfigMode === 'install') {
      const installAvailability = resolveRoleInstallAvailability(
        template,
        installedRoleApplicationUsage,
        authorizedRoleTemplateCatalog.deviceCapacity
      );
      if (!installAvailability.canInstall) {
        message.warning(installAvailability.reason);
        closeRoleConfig();
        return;
      }
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
    const nextRoleModelCredentialBindings = buildRoleModelCredentialBindingsFromForm(
      normalizedPreviewRolePackage.roleCode,
      normalizedPreviewRolePackage.modelProfileIds,
      values.modelCredentialBindings
    );
    const nextEnabledModelProfileIds = mergeUniqueStrings(
      mergeUniqueStrings(
        runtimeState.localRuntime.enabledModelProfileIds,
        normalizedPreviewRolePackage.modelProfileIds
      ),
      readRuntimeModelProfileIdsFromRoleConfigForm(values.modelCredentialBindings)
    );
    const firstUnreadyModelProfileId = findFirstUnreadyRequiredModelProfileId(
      nextModelProfiles,
      nextEnabledModelProfileIds,
      normalizedPreviewRolePackage,
      {
        roleCode: normalizedPreviewRolePackage.roleCode,
        credentials: runtimeState.modelCredentials,
        roleBindings: nextRoleModelCredentialBindings
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

  function getPreparedInstalledRolePackage(roleCode: string): RolePackageManifest | undefined {
    const rolePackage =
      refreshedInstalledRolePackageByRoleCode.get(roleCode) ??
      runtimeState.rolePackages.find((item) => item.roleCode === roleCode);
    return rolePackage ? normalizeRolePackageRequiredModelProfiles(rolePackage) : undefined;
  }

  function prepareRoleForTaskRun(roleCode: string): DesktopRuntimeState | undefined {
    const rolePackage = getPreparedInstalledRolePackage(roleCode);
    if (!rolePackage) {
      message.warning('该应用未安装在当前电脑，请先安装后再执行任务。');
      return undefined;
    }
    const roleApplicationLabel = roleApplicationTypeLabel(readRoleApplicationType(rolePackage));
    if (isRuntimeRolePackageDeleted(runtimeState, roleCode)) {
      message.warning(`该${roleApplicationLabel}已被服务端删除，不能继续执行。`);
      return undefined;
    }
    const preparedRolePackage = rolePackage;
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
          ? `这个${roleApplicationLabel}需要先启用指定模型，并确认 API Key 已填写。`
          : `这个${roleApplicationLabel}需要先填写指定模型的 API Key，并测试连接。`
      );
      navigateToSection('models');
      return undefined;
    }

    const runtimeReadiness = buildRoleRuntimeReadiness(preparedState, preparedRolePackage);
    if (!runtimeReadiness.ready) {
      setRuntimeState(preparedState);
      message.warning(runtimeReadiness.issueText || `该${roleApplicationLabel}运行所需配置不完整。`);
      navigateToSection(
        runtimeReadiness.missingToolIds.length > 0 || runtimeReadiness.disabledToolIds.length > 0
          ? 'tools'
          : 'models'
      );
      return undefined;
    }

    return preparedState;
  }

  function prepareRoleForWatchRun(
    sourceState: DesktopRuntimeState,
    roleCode: string,
    notifyUser: boolean
  ): DesktopRuntimeState | undefined {
    const rolePackage = sourceState.rolePackages.find((item) => item.roleCode === roleCode);
    if (!rolePackage) {
      if (notifyUser) {
        message.warning('该值守数字员工未安装在当前电脑。');
      }
      return undefined;
    }

    if (isRuntimeRolePackageDeleted(sourceState, roleCode)) {
      if (notifyUser) {
        message.warning('该值守数字员工已被服务端删除，不能继续执行。');
      }
      return undefined;
    }

    const preparedRolePackage = normalizeRolePackageRequiredModelProfiles(rolePackage);
    const preparedModelProfiles = ensureModelProfilesForRolePackage(
      sourceState.modelProfiles,
      preparedRolePackage
    );
    const modelReadiness = getRoleModelRuntimeRequirementStatuses(
      preparedModelProfiles,
      sourceState.localRuntime.enabledModelProfileIds,
      preparedRolePackage,
      {
        roleCode: preparedRolePackage.roleCode,
        credentials: sourceState.modelCredentials,
        roleBindings: sourceState.roleModelCredentialBindings
      }
    );
    const firstUnreadyModel = modelReadiness.find((requirement) => !requirement.ready);
    const preparedState = replaceRolePackageAndModelProfiles(
      sourceState,
      preparedRolePackage,
      preparedModelProfiles
    );

    if (firstUnreadyModel) {
      if (notifyUser) {
        setRuntimeState(preparedState);
        setSelectedModelId(firstUnreadyModel.profile.id);
        setModelConfigOpen(true);
        setModelTestNotice('值守数字员工需要先完成模型配置。');
        navigateToSection('models');
      }
      return undefined;
    }

    const runtimeReadiness = buildRoleRuntimeReadiness(preparedState, preparedRolePackage);
    if (!runtimeReadiness.ready) {
      if (notifyUser) {
        setRuntimeState(preparedState);
        message.warning(runtimeReadiness.issueText || '该值守数字员工运行所需配置不完整。');
        navigateToSection(
          runtimeReadiness.missingToolIds.length > 0 || runtimeReadiness.disabledToolIds.length > 0
            ? 'tools'
            : 'models'
        );
      }
      return undefined;
    }

    return preparedState;
  }

  function openWatchConfig(roleCode: string) {
    const rolePackage = getPreparedInstalledRolePackage(roleCode);
    if (!rolePackage || !isWatchRolePackage(rolePackage)) {
      message.warning('该数字员工不是值守式员工。');
      return;
    }

    const now = new Date().toISOString();
    const config = findRoleWatchConfig(runtimeState, roleCode) ?? createDefaultWatchConfig(rolePackage, now);
    setWatchConfigRoleCode(roleCode);
    watchConfigForm.setFieldsValue({
      enabled: config.enabled,
      sourceUrls: config.sourceUrls.join('\n'),
      intervalMinutes: config.intervalMinutes,
      rules: config.rules,
      approvalMode: config.approvalMode
    });
    setWatchConfigModalOpen(true);
  }

  function closeWatchConfig() {
    setWatchConfigModalOpen(false);
    setWatchConfigRoleCode('');
    watchConfigForm.resetFields();
  }

  function saveWatchConfig(values: WatchConfigFormValues) {
    const rolePackage = getPreparedInstalledRolePackage(watchConfigRoleCode);
    if (!rolePackage || !isWatchRolePackage(rolePackage)) {
      message.warning('该数字员工不是值守式员工。');
      return;
    }

    const sourceUrls = normalizeWatchSourceUrls(values.sourceUrls);
    if (sourceUrls.length === 0) {
      message.warning('至少填写一个值守网页 URL。');
      return;
    }

    const now = new Date().toISOString();
    const previous = findRoleWatchConfig(runtimeState, watchConfigRoleCode);
    const enabled = values.enabled === true;
    const config: DesktopRoleWatchConfig = {
      ...(previous ?? createDefaultWatchConfig(rolePackage, now)),
      enabled,
      sourceUrls,
      intervalMinutes: normalizeWatchIntervalMinutes(values.intervalMinutes),
      rules: normalizeWatchRules(values.rules, rolePackage),
      approvalMode: values.approvalMode ?? previous?.approvalMode ?? 'draft',
      lastStatus: enabled ? previous?.lastStatus ?? 'idle' : 'paused',
      lastError: enabled ? undefined : previous?.lastError,
      nextRunAt: enabled
        ? previous?.nextRunAt ?? now
        : undefined,
      updatedAt: now
    };

    setRuntimeState((current) => {
      const nextState = upsertRoleWatchConfigInRuntimeState(current, config);
      runtimeStateRef.current = nextState;
      return nextState;
    });
    message.success(enabled ? '值守已启用。' : '值守配置已保存，当前为暂停状态。');
    closeWatchConfig();
  }

  function toggleWatchConfig(roleCode: string, enabled: boolean) {
    const rolePackage = getPreparedInstalledRolePackage(roleCode);
    if (!rolePackage || !isWatchRolePackage(rolePackage)) {
      return;
    }

    const existing = findRoleWatchConfig(runtimeState, roleCode);
    if (!existing || existing.sourceUrls.length === 0) {
      openWatchConfig(roleCode);
      return;
    }

    const now = new Date().toISOString();
    const nextConfig: DesktopRoleWatchConfig = {
      ...existing,
      enabled,
      lastStatus: enabled ? existing.lastStatus ?? 'idle' : 'paused',
      nextRunAt: enabled ? now : undefined,
      updatedAt: now
    };
    setRuntimeState((current) => {
      const nextState = upsertRoleWatchConfigInRuntimeState(current, nextConfig);
      runtimeStateRef.current = nextState;
      return nextState;
    });
  }

  async function runWatchNow(roleCode: string) {
    const config = findRoleWatchConfig(runtimeStateRef.current, roleCode);
    if (!config || config.sourceUrls.length === 0) {
      openWatchConfig(roleCode);
      return;
    }

    await triggerWatchRun(config, { manual: true });
  }

  async function triggerDueWatchJobs() {
    const sourceState = runtimeStateRef.current;
    const nowMs = Date.now();
    const configs = getRuntimeWatchConfigs(sourceState)
      .filter((config) => config.enabled && config.sourceUrls.length > 0)
      .sort((left, right) => String(left.nextRunAt ?? '').localeCompare(String(right.nextRunAt ?? '')));

    for (const config of configs) {
      if (runningWatchRoleCodesRef.current.has(config.roleCode)) {
        continue;
      }
      if (hasActiveRoleTask(sourceState, config.roleCode)) {
        continue;
      }
      const nextRunAtMs = config.nextRunAt ? Date.parse(config.nextRunAt) : 0;
      if (Number.isFinite(nextRunAtMs) && nextRunAtMs > nowMs) {
        continue;
      }

      await triggerWatchRun(config, { manual: false });
      break;
    }
  }

  async function triggerWatchRun(
    inputConfig: DesktopRoleWatchConfig,
    options: { manual: boolean }
  ) {
    const sourceState = runtimeStateRef.current;
    const config = findRoleWatchConfig(sourceState, inputConfig.roleCode) ?? inputConfig;
    const rolePackage = sourceState.rolePackages.find((item) => item.roleCode === config.roleCode);
    if (!rolePackage || !isWatchRolePackage(rolePackage) || config.sourceUrls.length === 0) {
      return;
    }
    if (runningWatchRoleCodesRef.current.has(config.roleCode) || hasActiveRoleTask(sourceState, config.roleCode)) {
      if (options.manual) {
        message.info('该值守员工已有任务在运行或排队。');
      }
      return;
    }

    const preparedState = prepareRoleForWatchRun(sourceState, config.roleCode, options.manual);
    if (!preparedState) {
      markWatchConfigFailed(config, '模型、工具或知识库配置不完整，值守已暂停。');
      return;
    }

    const now = new Date().toISOString();
    const selectedSource = selectWatchSourceUrl(config);
    const nextConfig = markWatchConfigRunning(config, selectedSource.nextCursor, now);
    const runRecord: DesktopRoleWatchRun = {
      id: createWatchRunId(config.roleCode, now),
      configId: config.id,
      roleCode: config.roleCode,
      sourceUrl: selectedSource.url,
      status: 'running',
      startedAt: now,
      message: options.manual ? '手动触发值守巡检。' : '自动触发值守巡检。'
    };
    const roleName = resolveRoleName(preparedState.rolePackages, config.roleCode);
    const taskDetail = createMockTaskDetail({
      roleCode: config.roleCode,
      roleName,
      title: buildWatchTaskTitle(rolePackage, selectedSource.url),
      taskType: 'watch_monitoring',
      input: buildWatchTaskInput(rolePackage, nextConfig, selectedSource.url),
      state: 'queued',
      artifactCount: 0,
      costCents: 0,
      executionContext: buildExecutionContextForRole(preparedState.rolePackages, config.roleCode)
    });
    const runningTask = startTaskRun(taskDetail, now);
    const startedRun: DesktopRoleWatchRun = {
      ...runRecord,
      taskId: runningTask.taskId
    };
    const nextState = upsertTaskDetailInRuntimeState(
      upsertRoleWatchRunInRuntimeState(
        upsertRoleWatchConfigInRuntimeState(preparedState, {
          ...nextConfig,
          lastTaskId: runningTask.taskId
        }),
        startedRun
      ),
      runningTask
    );

    runningWatchRoleCodesRef.current.add(config.roleCode);
    runtimeStateRef.current = nextState;
    setRuntimeState(nextState);
    setSelectedTaskId(runningTask.taskId);

    try {
      const completedTask = await runTaskDetail(nextState, runningTask, {
        completedEventType: 'WORKOS_WATCH_RUN_COMPLETED',
        completedMessage: '值守巡检完成，已生成结果并保留人工确认边界。',
        failedEventType: 'WORKOS_WATCH_RUN_FAILED',
        failedMessage: '值守巡检失败，请查看日志后处理。'
      });
      const finishedAt = new Date().toISOString();
      const fingerprint = createWatchTaskFingerprint(completedTask);
      setRuntimeState((current) => {
        const nextFinishedState = finishWatchRunInRuntimeState(current, startedRun.id, {
          status: completedTask.state === 'completed' ? 'completed' : 'failed',
          finishedAt,
          message: completedTask.state === 'completed' ? '值守巡检完成。' : '值守巡检未完成。',
          fingerprint,
          configPatch: finishWatchConfigPatch(
            nextConfig,
            completedTask.state === 'completed' ? 'completed' : 'failed',
            finishedAt,
            fingerprint,
            completedTask.state === 'completed' ? undefined : '任务未完成，请查看日志。'
          )
        });
        runtimeStateRef.current = nextFinishedState;
        return nextFinishedState;
      });
    } catch (error) {
      const failedAt = new Date().toISOString();
      const messageText = error instanceof Error ? error.message : 'unknown error';
      setRuntimeState((current) => {
        const nextFailedState = finishWatchRunInRuntimeState(current, startedRun.id, {
          status: 'failed',
          finishedAt: failedAt,
          message: messageText,
          configPatch: finishWatchConfigPatch(nextConfig, 'failed', failedAt, undefined, messageText)
        });
        runtimeStateRef.current = nextFailedState;
        return nextFailedState;
      });
    } finally {
      runningWatchRoleCodesRef.current.delete(config.roleCode);
    }
  }

  function markWatchConfigFailed(config: DesktopRoleWatchConfig, error: string) {
    const now = new Date().toISOString();
    setRuntimeState((current) => {
      const nextState = upsertRoleWatchConfigInRuntimeState(current, {
        ...config,
        enabled: false,
        lastStatus: 'failed',
        lastError: error,
        nextRunAt: undefined,
        updatedAt: now
      });
      runtimeStateRef.current = nextState;
      return nextState;
    });
  }

  function createTask(values: TaskFormValues & { attachments?: ComposerAttachment[]; extraModelProfileIds?: string[] }): boolean {
    const title = values.title.trim();
    if (!title) {
      return false;
    }

    const roleCode = values.roleCode;
    const preparedState = prepareRoleForTaskRun(roleCode);
    if (!preparedState) {
      return false;
    }

    const roleName = resolveRoleName(preparedState.rolePackages, roleCode);
    const input = values.input?.trim() || `请处理任务：${title}`;
    const executionContext = buildTaskExecutionContextWithAttachments(
      buildTaskExecutionContextWithExtraModels(
        buildExecutionContextForRole(preparedState.rolePackages, roleCode),
        values.extraModelProfileIds ?? []
      ),
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
    return true;
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

function isWatchRolePackage(rolePackage: RolePackageManifest | undefined): boolean {
  const mode = rolePackage?.executionProfile?.mode;
  return mode === 'watch' || rolePackage?.toolIds.includes('browser-automation') === true;
}

function getRuntimeWatchConfigs(state: DesktopRuntimeState): DesktopRoleWatchConfig[] {
  return state.watchConfigs ?? [];
}

function getRuntimeWatchRuns(state: DesktopRuntimeState, roleCode?: string): DesktopRoleWatchRun[] {
  const runs = state.watchRuns ?? [];
  return runs
    .filter((run) => !roleCode || run.roleCode === roleCode)
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt));
}

function findRoleWatchConfig(
  state: DesktopRuntimeState,
  roleCode: string
): DesktopRoleWatchConfig | undefined {
  return getRuntimeWatchConfigs(state).find((config) => config.roleCode === roleCode);
}

function createDefaultWatchConfig(rolePackage: RolePackageManifest, now: string): DesktopRoleWatchConfig {
  return {
    id: `watch_${rolePackage.roleCode}`,
    roleCode: rolePackage.roleCode,
    enabled: false,
    sourceUrls: [],
    intervalMinutes: 60,
    rules: buildDefaultWatchRules(rolePackage),
    approvalMode: 'draft',
    sourceCursor: 0,
    seenFingerprints: [],
    lastStatus: 'idle',
    createdAt: now,
    updatedAt: now
  };
}

function buildDefaultWatchRules(rolePackage: RolePackageManifest): string {
  const name = rolePackage.name;
  const profileMode = rolePackage.executionProfile?.mode === 'watch' ? '值守式' : '辅助式';
  return [
    `你是${name}，当前以${profileMode}数字员工方式巡检网页业务信息。`,
    '只读取用户配置的网页来源，不绕过登录、验证码或平台风控。',
    '根据网页内容提取新增对象、关键字段、优先级、风险点和建议动作。',
    '输出必须区分：已处理/疑似重复/新增/需要人工确认。',
    '涉及对外发送、报价、拒绝、退款、承诺效果、敏感行业判断的动作，只能生成草稿或建议，不得自动提交。'
  ].join('\n');
}

function normalizeWatchSourceUrls(value: unknown): string[] {
  const raw = typeof value === 'string' ? value : '';
  const urls = raw
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => /^https?:\/\//i.test(item));

  return [...new Set(urls)].slice(0, 20);
}

function normalizeWatchIntervalMinutes(value: unknown): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : 60;
  return Math.max(5, Math.min(1440, Math.round(numeric)));
}

function normalizeWatchRules(value: unknown, rolePackage: RolePackageManifest): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || buildDefaultWatchRules(rolePackage);
}

function watchApprovalModeLabel(mode: DesktopRoleWatchApprovalMode): string {
  return watchApprovalModeOptions.find((option) => option.value === mode)?.label ?? '人工确认';
}

function watchRunStatusLabel(status: DesktopRoleWatchRun['status']): string {
  const labels: Record<DesktopRoleWatchRun['status'], string> = {
    idle: '待运行',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停'
  };
  return labels[status] ?? status;
}

function selectWatchSourceUrl(config: DesktopRoleWatchConfig): { url: string; nextCursor: number } {
  const sourceUrls = config.sourceUrls.length > 0 ? config.sourceUrls : [''];
  const cursor = Math.max(0, config.sourceCursor ?? 0);
  const index = cursor % sourceUrls.length;
  return {
    url: sourceUrls[index],
    nextCursor: (index + 1) % sourceUrls.length
  };
}

function markWatchConfigRunning(
  config: DesktopRoleWatchConfig,
  nextCursor: number,
  startedAt: string
): DesktopRoleWatchConfig {
  return {
    ...config,
    enabled: true,
    sourceCursor: nextCursor,
    lastRunAt: startedAt,
    nextRunAt: addMinutesIso(startedAt, config.intervalMinutes),
    lastStatus: 'running',
    lastError: undefined,
    updatedAt: startedAt
  };
}

function finishWatchConfigPatch(
  config: DesktopRoleWatchConfig,
  status: DesktopRoleWatchConfig['lastStatus'],
  finishedAt: string,
  fingerprint?: string,
  error?: string
): Partial<DesktopRoleWatchConfig> {
  const seenFingerprints = fingerprint
    ? [...new Set([...(config.seenFingerprints ?? []), fingerprint])].slice(-100)
    : config.seenFingerprints ?? [];

  return {
    lastStatus: status,
    lastError: error,
    lastFingerprint: fingerprint ?? config.lastFingerprint,
    seenFingerprints,
    nextRunAt: config.enabled ? config.nextRunAt ?? addMinutesIso(finishedAt, config.intervalMinutes) : undefined,
    updatedAt: finishedAt
  };
}

function upsertRoleWatchConfigInRuntimeState(
  state: DesktopRuntimeState,
  config: DesktopRoleWatchConfig
): DesktopRuntimeState {
  const configs = getRuntimeWatchConfigs(state);
  const exists = configs.some((item) => item.id === config.id);
  const watchConfigs = exists
    ? configs.map((item) => (item.id === config.id ? config : item))
    : [config, ...configs];

  return {
    ...state,
    watchConfigs
  };
}

function upsertRoleWatchRunInRuntimeState(
  state: DesktopRuntimeState,
  run: DesktopRoleWatchRun
): DesktopRuntimeState {
  const runs = state.watchRuns ?? [];
  const exists = runs.some((item) => item.id === run.id);
  const watchRuns = (exists
    ? runs.map((item) => (item.id === run.id ? run : item))
    : [run, ...runs]
  )
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .slice(0, 100);

  return {
    ...state,
    watchRuns
  };
}

function finishWatchRunInRuntimeState(
  state: DesktopRuntimeState,
  runId: string,
  patch: {
    status: DesktopRoleWatchRun['status'];
    finishedAt: string;
    message?: string;
    fingerprint?: string;
    configPatch?: Partial<DesktopRoleWatchConfig>;
  }
): DesktopRuntimeState {
  const existingRun = (state.watchRuns ?? []).find((run) => run.id === runId);
  const updatedRun = existingRun
    ? {
        ...existingRun,
        status: patch.status,
        finishedAt: patch.finishedAt,
        message: patch.message,
        fingerprint: patch.fingerprint ?? existingRun.fingerprint
      }
    : undefined;
  const config = existingRun ? findRoleWatchConfig(state, existingRun.roleCode) : undefined;
  const nextState = updatedRun ? upsertRoleWatchRunInRuntimeState(state, updatedRun) : state;

  if (!config || !patch.configPatch) {
    return nextState;
  }

  return upsertRoleWatchConfigInRuntimeState(nextState, {
    ...config,
    ...patch.configPatch
  });
}

function hasActiveRoleTask(state: DesktopRuntimeState, roleCode: string): boolean {
  return getRuntimeTaskDetails(state).some(
    (task) =>
      task.roleCode === roleCode &&
      (task.state === 'queued' || task.state === 'running' || task.state === 'waiting_approval')
  );
}

function buildWatchTaskTitle(rolePackage: RolePackageManifest, sourceUrl: string): string {
  const host = readUrlHost(sourceUrl);
  return `值守巡检：${rolePackage.name}${host ? ` / ${host}` : ''}`;
}

function buildWatchTaskInput(
  rolePackage: RolePackageManifest,
  config: DesktopRoleWatchConfig,
  sourceUrl: string
): string {
  return [
    `【值守巡检任务】${rolePackage.name}`,
    `值守来源：${sourceUrl}`,
    `巡检间隔：${config.intervalMinutes} 分钟`,
    `动作边界：${watchApprovalModeLabel(config.approvalMode)}`,
    '',
    '值守规则：',
    config.rules,
    '',
    '历史状态：',
    `最近指纹：${config.lastFingerprint ?? '无'}`,
    `已处理指纹数量：${config.seenFingerprints?.length ?? 0}`,
    '',
    '执行要求：',
    '1. 先通过 RPA 浏览器读取值守来源页面。',
    '2. 如果页面要求登录、验证码或人工确认，保留现场并在结果中说明。',
    '3. 从页面内容中提取可处理对象，判断新增、重复、风险和优先级。',
    '4. 只生成建议、草稿、清单或报告；不得自动提交外部动作。',
    '5. 最终输出要包含：本次处理摘要、发现的新对象、需要人工确认的动作、下一步建议。'
  ].join('\n');
}

function createWatchTaskFingerprint(task: DesktopTaskDetail): string {
  const text = [
    task.title,
    task.state,
    readConversationFinalAnswer(task),
    ...task.artifacts.map((artifact) => `${artifact.title}:${artifact.localPath ?? artifact.remoteUrl ?? ''}`)
  ].join('\n');
  return simpleStringHash(text || task.taskId);
}

function createWatchRunId(roleCode: string, timestamp: string): string {
  return `watch_run_${roleCode}_${Date.parse(timestamp) || Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function addMinutesIso(iso: string, minutes: number): string {
  const base = Date.parse(iso);
  const time = Number.isFinite(base) ? base : Date.now();
  return new Date(time + normalizeWatchIntervalMinutes(minutes) * 60_000).toISOString();
}

function readUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function simpleStringHash(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fp_${(hash >>> 0).toString(16)}`;
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

const modelProviderLogoUrlById: Record<string, string> = {
  'aliyun-bailian': aliyunBailianLogoUrl,
  'deepseek': deepseekLogoUrl,
  'dashscope': qwenLogoUrl,
  'gemini-openai': geminiLogoUrl,
  'kimi': kimiLogoUrl,
  'minimax': minimaxLogoUrl,
  'moonshot': kimiLogoUrl,
  'ollama': ollamaLogoUrl,
  'openai': openaiLogoUrl,
  'openrouter': openrouterLogoUrl,
  'siliconflow': siliconcloudLogoUrl,
  'tencent-cloud': tencentcloudLogoUrl,
  'volcengine-ark': volcengineLogoUrl,
  'zhipu': zhipuLogoUrl
};

function renderModelProviderLogo(providerId: string, providerName: string): ReactNode {
  const normalized = `${providerId} ${providerName}`.toLowerCase();
  const logoUrl =
    modelProviderLogoUrlById[providerId] ??
    (normalized.includes('deepseek') ? deepseekLogoUrl : undefined) ??
    (normalized.includes('openai') ? openaiLogoUrl : undefined) ??
    (normalized.includes('tencent') || normalized.includes('腾讯') ? tencentcloudLogoUrl : undefined) ??
    (normalized.includes('bailian') || normalized.includes('阿里云') || normalized.includes('百炼') ? aliyunBailianLogoUrl : undefined) ??
    (normalized.includes('dashscope') || normalized.includes('qwen') || normalized.includes('通义') ? qwenLogoUrl : undefined) ??
    (normalized.includes('gemini') || normalized.includes('google') ? geminiLogoUrl : undefined) ??
    (normalized.includes('moonshot') || normalized.includes('kimi') ? kimiLogoUrl : undefined) ??
    (normalized.includes('siliconflow') || normalized.includes('siliconcloud') ? siliconcloudLogoUrl : undefined) ??
    (normalized.includes('zhipu') || normalized.includes('glm') || normalized.includes('智谱') ? zhipuLogoUrl : undefined) ??
    (normalized.includes('minimax') ? minimaxLogoUrl : undefined) ??
    (normalized.includes('volcengine') || normalized.includes('火山') || normalized.includes('doubao') ? volcengineLogoUrl : undefined) ??
    (normalized.includes('openrouter') ? openrouterLogoUrl : undefined) ??
    (normalized.includes('ollama') ? ollamaLogoUrl : undefined);

  if (logoUrl) {
    return <img className="provider-logo-img" src={logoUrl} alt="" aria-hidden="true" />;
  }

  return <span className="provider-logo-wordmark">{modelProviderLogoText(providerName)}</span>;
}

function sectionMeta(section: SectionKey) {
  const meta: Record<SectionKey, { title: string; description: string }> = {
    workbench: {
      title: '数字员工',
      description: '和已安装的数字员工对话，上传文件并交付结果。'
    },
    factories: {
      title: '数字工厂',
      description: '运行批量化任务，查看批次进度和工厂产物。'
    },
    roles: {
      title: '数字市场',
      description: '发现、安装和配置数字员工与数字工厂。'
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
    enterprise: '设备信息',
    help: '帮助中心',
    release: '协议与声明',
    download: '版本与更新',
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

type FactoryTaskStageStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'optional';

interface FactoryTaskStageView {
  key: string;
  label: string;
  status: FactoryTaskStageStatus;
}

function factoryTaskProgressPercent(task: DesktopTaskDetail): number {
  if (task.state === 'completed') {
    return 100;
  }

  if (task.state === 'failed' || task.state === 'cancelled') {
    return 100;
  }

  if (task.state === 'queued') {
    return 8;
  }

  const progressFromLogs = Math.min(88, 18 + task.executionLogs.length * 3);
  return Math.max(24, progressFromLogs);
}

function buildFactoryTaskStages(task: DesktopTaskDetail, isVideoFactory: boolean): FactoryTaskStageView[] {
  const stages = isVideoFactory
    ? [
        { key: 'probe', label: '规格' },
        { key: 'asr', label: '语音转文字' },
        { key: 'score', label: '评分' },
        { key: 'edit', label: '初剪', optional: true },
        { key: 'artifact', label: '产物' }
      ]
    : [
        { key: 'prompt', label: '提示词' },
        { key: 'generate', label: '生图' },
        { key: 'quality', label: '质检', optional: true },
        { key: 'artifact', label: '产物' }
      ];
  const text = task.executionLogs.map((log) => `${log.eventType} ${log.message}`).join('\n').toLowerCase();
  const completed = task.state === 'completed';
  const failed = task.state === 'failed' || task.state === 'cancelled';

  return stages.map((stage, index): FactoryTaskStageView => {
    if (completed) {
      if (stage.optional && !stageWasObserved(stage.key, text) && !hasFactoryArtifactForStage(task, stage.key)) {
        return { key: stage.key, label: stage.label, status: 'optional' };
      }
      return { key: stage.key, label: stage.label, status: 'completed' };
    }

    if (failed && (stageWasObserved(stage.key, text) || index === 0)) {
      return { key: stage.key, label: stage.label, status: 'failed' };
    }

    if (stageWasObserved(stage.key, text) || hasFactoryArtifactForStage(task, stage.key)) {
      return { key: stage.key, label: stage.label, status: task.state === 'running' ? 'running' : 'completed' };
    }

    if (stage.optional) {
      return { key: stage.key, label: stage.label, status: 'optional' };
    }

    return { key: stage.key, label: stage.label, status: task.state === 'running' && index === 0 ? 'running' : 'waiting' };
  });
}

function stageWasObserved(stageKey: string, text: string): boolean {
  if (stageKey === 'probe') return text.includes('video.probe') || text.includes('视频规格');
  if (stageKey === 'asr') return text.includes('asr') || text.includes('audio_transcription') || text.includes('语音识别');
  if (stageKey === 'score') return text.includes('score') || text.includes('评分') || text.includes('video screening');
  if (stageKey === 'edit') return text.includes('compose_clips') || text.includes('初剪') || text.includes('剪辑');
  if (stageKey === 'artifact') return text.includes('artifact') || text.includes('产物') || text.includes('写入');
  if (stageKey === 'prompt') return text.includes('prompt') || text.includes('提示词');
  if (stageKey === 'generate') return text.includes('image_generation') || text.includes('生图') || text.includes('图片');
  if (stageKey === 'quality') return text.includes('quality') || text.includes('质检');
  return false;
}

function hasFactoryArtifactForStage(task: DesktopTaskDetail, stageKey: string): boolean {
  if (stageKey === 'artifact') {
    return task.artifacts.some(isUserDeliverableArtifact);
  }

  if (stageKey === 'edit') {
    return task.artifacts.some((artifact) => artifact.type === 'video' || getArtifactExtension(artifact) === 'mp4');
  }

  if (stageKey === 'generate') {
    return task.artifacts.some((artifact) => artifact.factoryPreview?.kind === 'digital_factory_image_batch');
  }

  return false;
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

interface FactoryTaskBatchStats {
  total: number;
  artifacts: number;
  qualified?: number;
  rejected?: number;
  review?: number;
  processingError?: number;
  excluded?: number;
  edited?: number;
}

interface FactoryBatchStatItem {
  key: string;
  label: string;
  value: string | number;
  tone?: 'good' | 'warning' | 'danger' | 'neutral';
}

function buildFactoryTaskBatchStats(task: DesktopTaskDetail, isVideoFactory: boolean): FactoryTaskBatchStats {
  if (isVideoFactory && task.factoryOutputs?.length) {
    const visibleOutputs = task.factoryOutputs.filter((item) => item.status !== 'excluded');
    return {
      total: task.factoryOutputs.length,
      artifacts: countUserDeliverableArtifacts(task),
      qualified: visibleOutputs.filter((item) => item.status === 'qualified').length,
      rejected: visibleOutputs.filter((item) => item.status === 'rejected').length,
      review: visibleOutputs.filter((item) => item.status === 'review_required').length,
      processingError: visibleOutputs.filter((item) => item.status === 'processing_error').length,
      excluded: task.factoryOutputs.filter((item) => item.status === 'excluded').length,
      edited: visibleOutputs.filter((item) => Boolean(item.outputPath)).length
    };
  }

  const searchableText = [
    readConversationFinalAnswer(task),
    task.input,
    ...task.executionLogs.map((log) => `${log.eventType}\n${log.message}`)
  ].join('\n');
  const inputFiles = readFactoryTaskInputFiles(task);
  const total =
    readFirstMatchedInteger(searchableText, [
      /共\s*(\d+)\s*个视频/,
      /(\d+)\s*个视频/,
      /共\s*(\d+)\s*个(?:图片|文件|素材)/,
      /total\s*[:：]\s*(\d+)/i
    ]) ?? inputFiles.length;

  if (!isVideoFactory) {
    return {
      total,
      artifacts: countUserDeliverableArtifacts(task)
    };
  }

  return {
    total,
    artifacts: countUserDeliverableArtifacts(task),
    qualified: readFirstMatchedInteger(searchableText, [
      /合格视频\s*[:：]\s*(\d+)/,
      /合格\s*[:：]\s*(\d+)/,
      /(\d+)\s*个合格/
    ]),
    rejected: readFirstMatchedInteger(searchableText, [
      /筛掉\s*[:：]?\s*(\d+)/,
      /(\d+)\s*个被筛掉/,
      /不合格\s*[:：]\s*(\d+)/
    ]),
    review: readFirstMatchedInteger(searchableText, [
      /需人工复核\s*[:：]?\s*(\d+)/,
      /人工复核\s*[:：]\s*(\d+)/,
      /(\d+)\s*个需人工复核/
    ]),
    edited: readFirstMatchedInteger(searchableText, [
      /已生成初剪\s*[:：]?\s*(\d+)/,
      /初剪\s*[:：]\s*(\d+)/,
      /(\d+)\s*个初剪/
    ])
  };
}

function buildFactoryBatchStatItems(
  stats: FactoryTaskBatchStats,
  isVideoFactory: boolean
): FactoryBatchStatItem[] {
  const items: FactoryBatchStatItem[] = [
    { key: 'total', label: '输入', value: stats.total, tone: 'neutral' },
    { key: 'artifacts', label: '产物', value: stats.artifacts, tone: stats.artifacts > 0 ? 'good' : 'neutral' }
  ];

  if (!isVideoFactory) {
    return items;
  }

  return [
    { key: 'total', label: '输入视频', value: stats.total, tone: 'neutral' },
    { key: 'qualified', label: '合格', value: stats.qualified ?? '待统计', tone: 'good' },
    { key: 'rejected', label: '筛掉', value: stats.rejected ?? '待统计', tone: 'danger' },
    { key: 'review', label: '需复核', value: stats.review ?? '待统计', tone: 'warning' },
    ...(stats.processingError !== undefined
      ? [{ key: 'processingError', label: '异常', value: stats.processingError, tone: 'danger' as const }]
      : []),
    { key: 'edited', label: '初剪', value: stats.edited ?? '未开启', tone: 'neutral' },
    { key: 'artifacts', label: '产物', value: stats.artifacts, tone: stats.artifacts > 0 ? 'good' : 'neutral' }
  ];
}

function readFirstMatchedInteger(text: string, patterns: RegExp[]): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1] ? Number.parseInt(match[1], 10) : Number.NaN;
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
  }

  return undefined;
}

function readFactoryTaskInputFiles(task: DesktopTaskDetail | undefined): string[] {
  return [...new Set(task?.executionContext?.attachmentPaths?.filter(Boolean) ?? [])];
}

function getFactoryOutputOrder(item: FactoryOutputItem): number {
  const order = item.metadata?.order;
  return typeof order === 'number' && Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER;
}

function getFactoryOutputLocalPath(item: FactoryOutputItem): string | undefined {
  return item.outputPath?.trim() || item.sourcePath?.trim() || undefined;
}

function getFactoryOutputSuggestedFileName(item: FactoryOutputItem, sourcePath: string): string {
  const sourceFileName = getPathFileName(sourcePath);
  if (sourceFileName) {
    return sourceFileName;
  }

  const extension = item.kind === 'video'
    ? '.mp4'
    : item.kind === 'image'
      ? '.png'
      : item.kind === 'table'
        ? '.xlsx'
        : '';
  return `${item.title || 'factory-output'}${extension}`;
}

function factoryOutputStatusLabel(status: FactoryOutputItemStatus): string {
  if (status === 'qualified') return '合格';
  if (status === 'rejected') return '不通过';
  if (status === 'review_required') return '需复核';
  if (status === 'processing_error') return '处理异常';
  return '已删除';
}

function factoryOutputStatusColor(status: FactoryOutputItemStatus): string {
  if (status === 'qualified') return 'green';
  if (status === 'rejected') return 'red';
  if (status === 'review_required') return 'orange';
  if (status === 'processing_error') return 'volcano';
  return 'default';
}

function renderFactoryOutputKindIcon(kind: FactoryOutputItem['kind']): ReactNode {
  if (kind === 'image') return <FileImageOutlined />;
  if (kind === 'document') return <FileWordOutlined />;
  if (kind === 'table') return <FileExcelOutlined />;
  if (kind === 'folder') return <FolderOpenOutlined />;
  return <FileTextOutlined />;
}

function buildFactoryFinalAnswerPreview(answer: string) {
  const normalized = answer
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ');

  return normalized.length > 180 ? `${normalized.slice(0, 180)}...` : normalized;
}

function selectFactoryVisibleLogs(task: DesktopTaskDetail): DesktopTaskDetail['executionLogs'] {
  const importantEventTypes = new Set([
    'WORKOS_TASK_RUN_STARTED',
    'LOCAL_RUN_STARTED',
    'WORKFLOW_RUNTIME_FACTORY_BATCH_STARTED',
    'WORKFLOW_RUNTIME_FACTORY_BATCH_COMPLETED',
    'WORKFLOW_RUNTIME_VIDEO_FACTORY_COMPLETED',
    'WORKFLOW_RUNTIME_ARTIFACT_WRITTEN',
    'WORKFLOW_ARTIFACT_FALLBACK_CREATED',
    'ARTIFACT_CREATED',
    'ARTIFACT_FILE_WRITTEN',
    'TASK_COMPLETED'
  ]);
  const visibleLogs = task.executionLogs.filter((log) => {
    if (log.level === 'error' || log.level === 'warning') {
      return true;
    }
    if (importantEventTypes.has(log.eventType)) {
      return true;
    }
    if (/FACTORY|ARTIFACT|TASK_COMPLETED/i.test(log.eventType)) {
      return true;
    }
    if (log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED') {
      const detail = readWorkflowNodeLogDetail(log);
      return detail?.type === 'artifact' || detail?.type === 'output';
    }
    return false;
  });

  return visibleLogs.length > 0 ? visibleLogs.slice(-10) : task.executionLogs.slice(-6);
}

function getArtifactFileName(artifact: DesktopTaskDetail['artifacts'][number]) {
  const source = artifact.localPath?.trim() || artifact.title.trim();
  return getPathFileName(source) || artifact.title || 'result-file';
}

function getPathFileName(path: string) {
  const normalizedSource = path.replace(/\\/g, '/');
  return normalizedSource.split('/').filter(Boolean).at(-1)?.trim() ?? '';
}

function getArtifactExtension(artifact: DesktopTaskDetail['artifacts'][number]) {
  const fileName = getArtifactFileName(artifact);
  return fileName.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase() ?? '';
}

function readCommonArtifactDirectory(paths: string[]): string | undefined {
  const directories = paths
    .map((path) => path.trim())
    .filter(Boolean)
    .map((path) => {
      const normalized = path.replace(/\\/g, '/');
      const index = normalized.lastIndexOf('/');
      return index > 0 ? path.slice(0, index) : '';
    })
    .filter(Boolean);

  if (directories.length === 0) {
    return undefined;
  }

  return directories.every((directory) => directory === directories[0]) ? directories[0] : undefined;
}

function getArtifactTypeLabel(artifact: DesktopTaskDetail['artifacts'][number]) {
  const extension = getArtifactExtension(artifact);
  if (extension) {
    return extension.toUpperCase();
  }

  return artifact.type.toUpperCase();
}

function getFactoryArtifactDisplayTitle(artifact: DesktopTaskDetail['artifacts'][number]) {
  const fileName = getArtifactFileName(artifact);
  const normalized = fileName.toLowerCase();

  if (/qualified|合格|address|list/.test(normalized)) {
    return '合格视频地址清单';
  }

  if (/screening|质检|打分|score/.test(normalized) || getArtifactExtension(artifact) === 'xlsx') {
    return '筛选打分报告';
  }

  if (/review|复核/.test(normalized)) {
    return '人工复核清单';
  }

  return fileName;
}

function getFactoryArtifactTypeLabel(artifact: DesktopTaskDetail['artifacts'][number]) {
  const fileName = getArtifactFileName(artifact).toLowerCase();
  if (/qualified|合格|address|list/.test(fileName)) {
    return '清单';
  }
  if (/screening|质检|打分|score/.test(fileName)) {
    return '报告';
  }
  return getArtifactTypeLabel(artifact);
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

function formatFactoryPreviewMeta(preview: FactoryArtifactPreview) {
  const failedText = preview.failed > 0 ? `，失败 ${preview.failed}` : '';
  const platformText = preview.platformLabel ? ` · ${preview.platformLabel}` : '';
  return `完成 ${preview.completed}/${preview.total}${failedText} · 并发 ${preview.concurrency}${platformText}`;
}

function getFactoryPreviewImageSrc(item: FactoryArtifactPreviewItem) {
  return toFactoryPreviewImageSrc(item.thumbnailPath)
    ?? toFactoryPreviewImageSrc(item.localPath)
    ?? toFactoryPreviewImageSrc(item.remoteUrl)
    ?? '';
}

function getFactoryPreviewImageFileName(item: FactoryArtifactPreviewItem) {
  const extension = getFactoryPreviewImageExtension(item.remoteUrl ?? item.thumbnailPath ?? item.localPath) ?? 'png';
  const sku = sanitizeFactoryPreviewFileNamePart(item.sku) || 'SKU';
  const packageLabel = sanitizeFactoryPreviewFileNamePart(item.packageLabel) || item.packageKey || 'image';
  return `${sku}-${packageLabel}.${extension}`;
}

function getFactoryPreviewImageExtension(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  const pathPart = normalized.split('?')[0]?.split('#')[0] ?? normalized;
  const extension = pathPart.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  return extension && ['png', 'jpg', 'jpeg', 'webp'].includes(extension) ? extension : undefined;
}

function sanitizeFactoryPreviewFileNamePart(value: string | undefined) {
  return (value ?? '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 48);
}

function toFactoryPreviewImageSrc(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }

  if (/^https?:\/\//i.test(normalized) || /^data:/i.test(normalized) || /^file:\/\//i.test(normalized)) {
    return normalized;
  }

  return `file:///${normalized.replace(/\\/g, '/').replace(/^\/+/, '')}`;
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

function buildTaskExecutionContextWithExtraModels(
  executionContext: NonNullable<DesktopTaskDetail['executionContext']> | undefined,
  modelProfileIds: string[]
): NonNullable<DesktopTaskDetail['executionContext']> | undefined {
  if (!executionContext) {
    return undefined;
  }

  const extraModelProfileIds = modelProfileIds
    .map((profileId) => profileId.trim())
    .filter(Boolean);
  if (extraModelProfileIds.length === 0) {
    return executionContext;
  }

  return {
    ...executionContext,
    modelProfileIds: [...new Set([...executionContext.modelProfileIds, ...extraModelProfileIds])]
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
    applicationType: template.applicationType ?? 'digital_employee',
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
    executionProfile: cloneJsonValue(template.executionProfile ?? template.dependencyManifest?.executionProfile),
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

function refreshInstalledRolePackageFromTemplate(
  installedRolePackage: RolePackageManifest,
  template: DesktopRoleTemplate | undefined
): RolePackageManifest {
  if (!template) {
    return normalizeRolePackageRequiredModelProfiles(installedRolePackage);
  }

  const templateRolePackage = toInstalledRolePackage(template);
  const refreshedRolePackage: RolePackageManifest = {
    ...templateRolePackage,
    requiredKnowledgeSources:
      installedRolePackage.requiredKnowledgeSources.length > 0
        ? installedRolePackage.requiredKnowledgeSources
        : templateRolePackage.requiredKnowledgeSources
  };

  return {
    ...refreshedRolePackage,
    modelProfileIds: readRequiredModelProfileIdsForRolePackage(refreshedRolePackage)
  };
}

function normalizeRolePackageRequiredModelProfiles(rolePackage: RolePackageManifest): RolePackageManifest {
  return {
    ...rolePackage,
    modelProfileIds: readRequiredModelProfileIdsForRolePackage(rolePackage)
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

interface DigitalFactoryPlatformOption {
  key: string;
  label: string;
  imageRatio?: string;
  notes?: string;
}

interface DigitalFactoryPackageOption {
  key: string;
  label: string;
  description?: string;
  outputType?: string;
  defaultSelected?: boolean;
}

interface DigitalFactoryQualityModeOption {
  key: FactoryRunFormValues['qualityCheckMode'];
  label: string;
  description?: string;
}

interface DigitalFactoryPromptControlField {
  key: string;
  label: string;
  placeholder?: string;
  inputType?: 'text' | 'textarea';
  defaultValue?: string;
}

interface DigitalFactoryAsrDialectOption {
  key: string;
  label: string;
}

interface DigitalFactoryScreeningProfileOption {
  key: string;
  label: string;
  description?: string;
  defaultSelected?: boolean;
  gates?: FactoryVideoScreeningGateDefinition[];
  custom?: boolean;
}

interface DigitalFactoryManifest {
  kind?: string;
  title?: string;
  batch?: {
    maxItems?: number;
    imageExtensions?: string[];
    tableExtensions?: string[];
    videoExtensions?: string[];
  };
  platforms?: DigitalFactoryPlatformOption[];
  packages?: DigitalFactoryPackageOption[];
  qualityCheck?: {
    defaultMode?: FactoryRunFormValues['qualityCheckMode'];
    modes?: DigitalFactoryQualityModeOption[];
  };
  promptControls?: {
    fields?: DigitalFactoryPromptControlField[];
  };
  asr?: {
    defaultLanguage?: string;
    defaultDialect?: string;
    dialects?: DigitalFactoryAsrDialectOption[];
  };
  screeningProfiles?: DigitalFactoryScreeningProfileOption[];
  editing?: {
    defaultEnabled?: boolean;
    targetSeconds?: number;
    targetSecondOptions?: number[];
    requiresFfmpeg?: boolean;
  };
  output?: {
    defaultImageFormat?: string;
    packageFormat?: string;
    folder?: string;
    reportFormat?: string;
    videoFormat?: string;
  };
}

const defaultFactoryPlatforms: DigitalFactoryPlatformOption[] = [
  { key: 'amazon', label: 'Amazon', imageRatio: '1:1', notes: '主图简洁，避免夸张文字和过度装饰。' },
  { key: 'temu', label: 'Temu', imageRatio: '1:1', notes: '强调直观卖点、价格感和清晰主体。' },
  { key: 'aliexpress', label: '速卖通', imageRatio: '1:1', notes: '适合主图、场景图和参数卖点图组合。' },
  { key: 'tiktok_shop', label: 'TikTok Shop', imageRatio: '1:1', notes: '画面更生活化，适合短视频封面和场景图。' },
  { key: 'ozon', label: 'Ozon', imageRatio: '1:1', notes: '主体清晰，参数和尺寸信息需要可读。' },
  { key: 'shopee', label: 'Shopee', imageRatio: '1:1', notes: '适合醒目、轻促销风格的商品图。' },
  { key: 'lazada', label: 'Lazada', imageRatio: '1:1', notes: '重视商品主体和卖点信息层级。' },
  { key: 'ebay', label: 'eBay', imageRatio: '1:1', notes: '真实、清晰、少修饰，便于买家检查商品。' },
  { key: 'walmart', label: 'Walmart', imageRatio: '1:1', notes: '偏干净、规范的零售商品图。' },
  { key: 'shein', label: 'SHEIN', imageRatio: '3:4', notes: '服饰类可突出模特、穿搭和风格。' }
];

const defaultFactoryPackages: DigitalFactoryPackageOption[] = [
  {
    key: 'white_background',
    label: '白底图',
    description: '保留商品主体，生成干净白底商品图。',
    outputType: 'image',
    defaultSelected: true
  },
  {
    key: 'main_image',
    label: '商品主图',
    description: '突出商品卖点，适合平台列表和首图。',
    outputType: 'image',
    defaultSelected: true
  },
  {
    key: 'scene_image',
    label: '场景图',
    description: '把商品放入真实使用场景，增强购买代入感。',
    outputType: 'image',
    defaultSelected: true
  },
  {
    key: 'background_replacement',
    label: '换背景',
    description: '替换背景风格，同时保持商品主体一致。',
    outputType: 'image',
    defaultSelected: true
  },
  {
    key: 'model_replacement',
    label: '换模特',
    description: '适合服饰、配饰、家居等需要人物展示的商品图。',
    outputType: 'image',
    defaultSelected: true
  },
  {
    key: 'dimension_image',
    label: '尺寸图',
    description: '生成带尺寸、规格或关键参数标注的说明图。',
    outputType: 'image',
    defaultSelected: true
  },
  {
    key: 'selling_point_image',
    label: '卖点图',
    description: '围绕核心卖点生成电商详情页可用图片。',
    outputType: 'image',
    defaultSelected: true
  }
];

const defaultFactoryQualityModes: DigitalFactoryQualityModeOption[] = [
  { key: 'none', label: '不质检', description: '不额外调用模型，只生成图片。' },
  { key: 'basic', label: '基础质检', description: '检查文件数量、命名、格式和基础规则。' },
  { key: 'smart', label: '智能质检', description: '调用多模态模型检查主体一致性、平台合规和卖点可读性。' }
];

const defaultFactoryPromptControlFields: DigitalFactoryPromptControlField[] = [
  {
    key: 'promptLanguage',
    label: '文字语言',
    placeholder: '例如：English、中文、Deutsch、Español；不需要文字可填：不生成文字',
    inputType: 'text'
  },
  {
    key: 'promptStyle',
    label: '图片风格',
    placeholder: '例如：真实摄影、欧美电商、高级极简、TikTok生活感',
    inputType: 'text'
  },
  {
    key: 'promptGoal',
    label: '希望效果',
    placeholder: '例如：突出材质和容量，画面干净，有购买欲',
    inputType: 'textarea'
  },
  {
    key: 'promptMustKeep',
    label: '必须保留',
    placeholder: '例如：产品主体、颜色、结构、品牌标识、原有角度',
    inputType: 'textarea'
  },
  {
    key: 'promptAvoid',
    label: '不要出现',
    placeholder: '例如：水印、乱码文字、夸张变形、多余配件、错误 Logo',
    inputType: 'textarea'
  }
];

const factoryImageExtensions = new Set(['png', 'jpg', 'jpeg', 'webp']);
const factoryTableExtensions = new Set(['xlsx', 'csv']);
const factoryVideoExtensions = new Set(['mp4', 'mov', 'mkv', 'avi', 'webm', 'm4v']);

const defaultFactoryAsrDialects: DigitalFactoryAsrDialectOption[] = [
  { key: 'auto', label: '自动识别' },
  { key: 'mandarin', label: '普通话' },
  { key: 'cantonese', label: '粤语' },
  { key: 'shanghai', label: '上海话' },
  { key: 'sichuan_chongqing', label: '四川/重庆口音' }
];

const defaultFactoryVideoScreeningGateDefinitions: FactoryVideoScreeningGateDefinition[] = [
  {
    id: 'video_spec',
    name: '视频规格',
    description: '先用本机视频工具检查画面比例、时长和音轨。',
    rules: [
      createFactoryScreeningRule('portraitRatio'),
      createFactoryScreeningRule('durationSeconds'),
      createFactoryScreeningRule('hasAudio')
    ]
  },
  {
    id: 'asr_quality',
    name: '语音质量',
    description: 'ASR 转写后检查文字量和不清晰内容比例。',
    rules: [
      createFactoryScreeningRule('transcriptChars'),
      createFactoryScreeningRule('unclearTokenRatio')
    ]
  },
  {
    id: 'content_minimum',
    name: '内容完整性',
    description: '检查使用前、使用后改善表达是否足够完整。',
    rules: [createFactoryScreeningRule('beforeAfterCompleteness')]
  }
];

const defaultFactoryScreeningProfiles: DigitalFactoryScreeningProfileOption[] = [
  {
    key: 'default_medical_case',
    label: '医疗案例素材标准',
    description: '先检查横屏、20 秒以上、音轨可识别，再检查使用前后改善表述完整度。',
    defaultSelected: true,
    gates: defaultFactoryVideoScreeningGateDefinitions
  }
];

function readRoleApplicationType(
  value:
    | Pick<DesktopRoleTemplate, 'applicationType' | 'dependencyManifest'>
    | Pick<RolePackageManifest, 'applicationType' | 'dependencyManifest'>
    | undefined
): RoleApplicationType {
  if (value?.applicationType === 'digital_factory' || value?.applicationType === 'digital_employee') {
    return value.applicationType;
  }

  const manifestApplicationType = value?.dependencyManifest?.applicationType;
  return manifestApplicationType === 'digital_factory' ? 'digital_factory' : 'digital_employee';
}

function roleApplicationTypeLabel(applicationType: RoleApplicationType) {
  return applicationType === 'digital_factory' ? '数字工厂' : '数字员工';
}

function countRoleApplications(templates: DesktopRoleTemplate[]): Record<RoleApplicationType, number> {
  return templates.reduce<Record<RoleApplicationType, number>>(
    (counts, template) => {
      counts[readRoleApplicationType(template)] += 1;
      return counts;
    },
    {
      digital_employee: 0,
      digital_factory: 0
    }
  );
}

function readFactoryManifest(manifest: RoleTemplateDependencyManifest | undefined): DigitalFactoryManifest {
  const factory = manifest?.factory;
  if (!isPlainObject(factory)) {
    return {};
  }

  const batch = isPlainObject(factory.batch) ? factory.batch : undefined;
  const qualityCheck = isPlainObject(factory.qualityCheck) ? factory.qualityCheck : undefined;
  const promptControls = isPlainObject(factory.promptControls) ? factory.promptControls : undefined;
  const output = isPlainObject(factory.output) ? factory.output : undefined;

  return {
    kind: readString(factory.kind),
    title: readString(factory.title),
    batch: {
      maxItems: readNumber(batch?.maxItems),
      imageExtensions: readStringArray(batch?.imageExtensions),
      tableExtensions: readStringArray(batch?.tableExtensions),
      videoExtensions: readStringArray(batch?.videoExtensions)
    },
    platforms: readFactoryPlatformOptionsFromValue(factory.platforms),
    packages: readFactoryPackageOptionsFromValue(factory.packages),
    qualityCheck: {
      defaultMode: readFactoryQualityModeKey(qualityCheck?.defaultMode),
      modes: readFactoryQualityModeOptionsFromValue(qualityCheck?.modes)
    },
    promptControls: {
      fields: readFactoryPromptControlFieldsFromValue(promptControls?.fields)
    },
    asr: {
      defaultLanguage: readString(isPlainObject(factory.asr) ? factory.asr.defaultLanguage : undefined),
      defaultDialect: readString(isPlainObject(factory.asr) ? factory.asr.defaultDialect : undefined),
      dialects: readFactoryAsrDialectOptionsFromValue(isPlainObject(factory.asr) ? factory.asr.dialects : undefined)
    },
    screeningProfiles: readFactoryScreeningProfilesFromValue(factory.screeningProfiles),
    editing: {
      defaultEnabled: isPlainObject(factory.editing) && typeof factory.editing.defaultEnabled === 'boolean'
        ? factory.editing.defaultEnabled
        : undefined,
      targetSeconds: readNumber(isPlainObject(factory.editing) ? factory.editing.targetSeconds : undefined),
      targetSecondOptions: readNumberArray(isPlainObject(factory.editing) ? factory.editing.targetSecondOptions : undefined),
      requiresFfmpeg: isPlainObject(factory.editing) && typeof factory.editing.requiresFfmpeg === 'boolean'
        ? factory.editing.requiresFfmpeg
        : undefined
    },
    output: {
      defaultImageFormat: readString(output?.defaultImageFormat),
      packageFormat: readString(output?.packageFormat),
      folder: readString(output?.folder),
      reportFormat: readString(output?.reportFormat),
      videoFormat: readString(output?.videoFormat)
    }
  };
}

function readFactoryPlatformOptions(factory: DigitalFactoryManifest): DigitalFactoryPlatformOption[] {
  return factory.platforms?.length ? factory.platforms : defaultFactoryPlatforms;
}

function readFactoryPackageOptions(factory: DigitalFactoryManifest): DigitalFactoryPackageOption[] {
  return factory.packages?.length ? factory.packages : defaultFactoryPackages;
}

function readFactoryQualityModes(factory: DigitalFactoryManifest): DigitalFactoryQualityModeOption[] {
  return factory.qualityCheck?.modes?.length ? factory.qualityCheck.modes : defaultFactoryQualityModes;
}

function readFactoryPromptControlFields(factory: DigitalFactoryManifest): DigitalFactoryPromptControlField[] {
  const manifestFields = factory.promptControls?.fields ?? [];
  const fieldsByKey = new Map<string, DigitalFactoryPromptControlField>();

  for (const field of [...defaultFactoryPromptControlFields, ...manifestFields]) {
    fieldsByKey.set(field.key, field);
  }

  return [...fieldsByKey.values()];
}

function readFactoryAsrDialectOptions(factory: DigitalFactoryManifest): DigitalFactoryAsrDialectOption[] {
  return factory.asr?.dialects?.length ? factory.asr.dialects : defaultFactoryAsrDialects;
}

function readFactoryScreeningProfiles(
  factory: DigitalFactoryManifest,
  roleCode?: string
): FactoryRunScreeningProfileDefinition[] {
  const baseProfiles = normalizeFactoryScreeningProfiles(
    factory.screeningProfiles?.length ? factory.screeningProfiles : defaultFactoryScreeningProfiles,
    []
  );
  const customProfiles = roleCode ? readFactoryCustomScreeningProfiles(roleCode) : [];
  return mergeFactoryScreeningProfiles(baseProfiles, customProfiles);
}

function readFactoryMaxItems(factory: DigitalFactoryManifest) {
  const rawMaxItems = factory.batch?.maxItems;
  if (typeof rawMaxItems !== 'number' || !Number.isInteger(rawMaxItems)) {
    return 50;
  }

  return Math.max(1, Math.min(rawMaxItems, 50));
}

function isFactoryImageAttachment(attachment: ComposerAttachment) {
  if (attachment.type?.toLowerCase().startsWith('image/')) {
    return true;
  }

  const extension = attachment.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return factoryImageExtensions.has(extension);
}

function isFactoryVideoAttachment(attachment: ComposerAttachment) {
  if (attachment.type?.toLowerCase().startsWith('video/')) {
    return true;
  }

  const extension = attachment.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return factoryVideoExtensions.has(extension);
}

function isFactoryTableAttachment(attachment: ComposerAttachment) {
  const extension = attachment.name.split('.').pop()?.trim().toLowerCase() ?? '';
  return factoryTableExtensions.has(extension);
}

function isFactoryImageInputAttachment(attachment: ComposerAttachment) {
  return isFactoryImageAttachment(attachment) || isFactoryTableAttachment(attachment);
}

function readFactoryKind(factory: DigitalFactoryManifest) {
  return factory.kind ?? 'cross_border_product_image_factory';
}

function isMedicalCaseVideoFactory(factory: DigitalFactoryManifest) {
  return readFactoryKind(factory) === 'medical_case_video_screening_factory';
}

function buildFactoryPromptControls(values: FactoryRunFormValues) {
  const promptControls = {
    language: values.promptLanguage?.trim() || undefined,
    style: values.promptStyle?.trim() || undefined,
    desiredEffect: values.promptGoal?.trim() || undefined,
    mustKeep: values.promptMustKeep?.trim() || undefined,
    avoid: values.promptAvoid?.trim() || undefined,
    extraInstruction: values.instruction?.trim() || undefined
  };

  return Object.values(promptControls).some(Boolean) ? promptControls : undefined;
}

function buildFactoryTaskInput({
  template,
  factory,
  values,
  attachments
}: {
  template: DesktopRoleTemplate;
  factory: DigitalFactoryManifest;
  values: FactoryRunFormValues;
  attachments: ComposerAttachment[];
}) {
  const platform = readFactoryPlatformOptions(factory).find((item) => item.key === values.platform);
  const packageOptions = normalizeFactoryPackageDefinitions(
    values.packageDefinitions,
    readFactoryPackageOptions(factory)
  );
  const selectedPackageKeys = values.packageKeys ?? [];
  const selectedPackages = packageOptions.filter((item) => selectedPackageKeys.includes(item.key));
  const qualityMode = readFactoryQualityModes(factory).find((item) => item.key === values.qualityCheckMode);
  const imageAttachments = attachments.filter((attachment) => isFactoryImageAttachment(attachment));
  const tableAttachments = attachments.filter((attachment) => !isFactoryImageAttachment(attachment));
  const promptControls = buildFactoryPromptControls(values);
  const factoryRequest = {
    applicationType: 'digital_factory',
    factoryKind: factory.kind ?? 'cross_border_product_image_factory',
    factoryName: template.name,
    platform: {
      key: platform?.key ?? values.platform ?? 'amazon',
      label: platform?.label ?? values.platform ?? 'Amazon',
      imageRatio: platform?.imageRatio,
      notes: platform?.notes
    },
    packages: selectedPackages.map((item) => ({
      key: item.key,
      label: item.label,
      description: item.description,
      outputType: item.outputType ?? 'image'
    })),
    qualityCheckMode: values.qualityCheckMode ?? 'basic',
    qualityCheckLabel: qualityMode?.label ?? values.qualityCheckMode ?? 'basic',
    itemCount: imageAttachments.length,
    maxItems: readFactoryMaxItems(factory),
    output: {
      imageFormat: factory.output?.defaultImageFormat ?? 'png',
      packageFormat: factory.output?.packageFormat ?? 'url_manifest',
      folder: factory.output?.folder ?? 'product-images'
    },
    promptControls,
    attachments: attachments.map((attachment) => ({
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      localPath: attachment.localPath,
      kind: isFactoryImageAttachment(attachment) ? 'product_image' : 'sku_table'
    })),
    instruction: values.instruction?.trim() || undefined
  };
  const taskBrief = `请运行「${template.name}」，为 ${platform?.label ?? values.platform} 批量生成跨境商品图。`;

  return JSON.stringify(
    {
      taskBrief,
      factory_request: factoryRequest,
      platform: factoryRequest.platform,
      selectedPackages: factoryRequest.packages,
      qualityCheckMode: factoryRequest.qualityCheckMode,
      imageCount: imageAttachments.length,
      tableCount: tableAttachments.length,
      instructions: [
        '按 factory_request 逐项处理每张商品图片。',
        '图片理解和提示词生成在同一个多模态 LLM 节点内完成。',
        '提示词生成必须优先遵守 factory_request.promptControls；不要出现的内容必须写入 negativePrompt。',
        '只生成用户勾选的产物包；不要生成未勾选的图片类型。',
        '生成结果只保存图片 URL 元数据；大图片不经过服务端，PC 端按 URL 展示缩略图。',
        '如果质检方式为 none，跳过额外智能质检；如果为 basic，只做文件数量、格式、命名检查。'
      ]
    },
    null,
    2
  );
}

function buildMedicalCaseVideoFactoryTaskInput({
  template,
  factory,
  values,
  attachments
}: {
  template: DesktopRoleTemplate;
  factory: DigitalFactoryManifest;
  values: FactoryRunFormValues;
  attachments: ComposerAttachment[];
}) {
  const screeningProfiles = readFactoryScreeningProfiles(factory, values.roleCode);
  const screeningProfile =
    screeningProfiles.find((item) => item.key === values.screeningProfileKey) ??
    screeningProfiles.find((item) => item.defaultSelected) ??
    screeningProfiles[0];
  const dialect = readFactoryAsrDialectOptions(factory).find((item) => item.key === values.dialect);
  const editTargetSeconds = values.editTargetSeconds ?? factory.editing?.targetSeconds ?? 30;
  const factoryRequest = {
    applicationType: 'digital_factory',
    factoryKind: 'medical_case_video_screening_factory',
    factoryName: template.name,
    itemCount: attachments.length,
    maxItems: readFactoryMaxItems(factory),
    concurrency: 3,
    screeningProfile: {
      key: screeningProfile?.key ?? 'default_medical_case',
      label: screeningProfile?.label ?? '医疗案例素材标准',
      description: screeningProfile?.description,
      gates: screeningProfile?.gates ?? []
    },
    asr: {
      modelProfileId: values.asrModelProfileId,
      language: factory.asr?.defaultLanguage ?? 'zh',
      dialect: values.dialect ?? factory.asr?.defaultDialect ?? 'auto',
      dialectLabel: dialect?.label ?? values.dialect ?? '自动识别'
    },
    editEnabled: Boolean(values.editEnabled),
    editTargetSeconds,
    output: {
      folder: factory.output?.folder ?? 'case-videos',
      reportFormat: factory.output?.reportFormat ?? 'xlsx',
      videoFormat: factory.output?.videoFormat ?? 'mp4'
    },
    attachments: attachments.map((attachment, index) => ({
      id: attachment.id,
      name: attachment.name,
      size: attachment.size,
      type: attachment.type,
      localPath: attachment.localPath,
      order: index + 1,
      kind: 'case_video'
    })),
    instruction: values.instruction?.trim() || undefined
  };
  const taskBrief = `请运行「${template.name}」，批量筛选 ${attachments.length} 个案例视频。`;

  return JSON.stringify(
    {
      taskBrief,
      factory_request: factoryRequest,
      videoCount: attachments.length,
      screeningProfile: factoryRequest.screeningProfile,
      asr: factoryRequest.asr,
      editEnabled: factoryRequest.editEnabled,
      instructions: [
        '只评价视频素材质量、表达清晰度、剪辑价值和合规风险，不做医疗诊断，不判断药物疗效真实性。',
        '先做筛选，未通过视频直接标记失败原因，不进入评分和初剪。',
        '通过筛选后再根据语音转写内容评分，重点看使用前、使用过程、使用后改善表达是否完整具体。',
        '只有用户开启初剪时才生成视频片段；大视频和生成视频都只保存在本机。'
      ]
    },
    null,
    2
  );
}

function readFactoryPlatformOptionsFromValue(value: unknown): DigitalFactoryPlatformOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const key = readString(item.key);
    const label = readString(item.label);
    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        imageRatio: readString(item.imageRatio),
        notes: readString(item.notes)
      }
    ];
  });
}

function readFactoryPackageOptionsFromValue(value: unknown): DigitalFactoryPackageOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const key = readString(item.key);
    const label = readString(item.label);
    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        description: readString(item.description),
        outputType: readString(item.outputType),
        defaultSelected: typeof item.defaultSelected === 'boolean' ? item.defaultSelected : undefined
      }
    ];
  });
}

function readFactoryQualityModeOptionsFromValue(value: unknown): DigitalFactoryQualityModeOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const key = readFactoryQualityModeKey(item.key);
    const label = readString(item.label);
    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        description: readString(item.description)
      }
    ];
  });
}

function readFactoryPromptControlFieldsFromValue(value: unknown): DigitalFactoryPromptControlField[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const key = readString(item.key);
    const label = readString(item.label);
    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        placeholder: readString(item.placeholder),
        inputType: item.inputType === 'textarea' ? 'textarea' : 'text',
        defaultValue: readString(item.defaultValue)
      }
    ];
  });
}

function readFactoryAsrDialectOptionsFromValue(value: unknown): DigitalFactoryAsrDialectOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const key = readString(item.key);
    const label = readString(item.label);
    return key && label ? [{ key, label }] : [];
  });
}

function readFactoryScreeningProfilesFromValue(value: unknown): DigitalFactoryScreeningProfileOption[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isPlainObject(item)) {
      return [];
    }

    const key = readString(item.key);
    const label = readString(item.label);
    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        description: readString(item.description),
        defaultSelected: typeof item.defaultSelected === 'boolean' ? item.defaultSelected : undefined,
        gates: normalizeFactoryScreeningGates(item.gates, [])
      }
    ];
  });
}

function readFactoryQualityModeKey(value: unknown): FactoryRunFormValues['qualityCheckMode'] | undefined {
  return value === 'none' || value === 'basic' || value === 'smart' ? value : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  return values.length ? values.map((item) => item.trim()) : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readNumberArray(value: unknown): number[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
  return values.length ? values : undefined;
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

function formatModelTestNotice(response: DesktopModelTestResponse): string {
  const checks = response.checks ?? [];
  if (checks.length === 0) {
    return `${response.ok ? '模型测试通过' : '模型测试失败'}：${response.providerName}/${response.modelName}。${response.message}`;
  }
  const passed = checks.filter((check) => check.status === 'passed').length;
  const failed = checks.filter((check) => check.status === 'failed').length;
  const skipped = checks.filter((check) => check.status === 'skipped').length;
  const prefix = response.ok ? '模型测试通过' : '模型测试未全部通过';
  return `${prefix}：${response.providerName}/${response.modelName}，通过 ${passed}，失败 ${failed}，跳过 ${skipped}。`;
}

function isModelNoticeSuccess(value: string): boolean {
  return value.startsWith('模型测试通过') || value.startsWith('模型连接正常') || value.startsWith('已拉取');
}

function modelTestCheckColor(status: NonNullable<DesktopModelTestResponse['checks']>[number]['status']): string {
  if (status === 'passed') return 'green';
  if (status === 'failed') return 'red';
  return 'default';
}

function modelTestCheckLabel(status: NonNullable<DesktopModelTestResponse['checks']>[number]['status']): string {
  if (status === 'passed') return '通过';
  if (status === 'failed') return '失败';
  return '跳过';
}

function formatElapsedMs(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}s`;
  }
  return `${Math.max(0, Math.round(value))}ms`;
}

function modelCapabilitiesMayCreatePaidArtifacts(capabilities: ModelCapability[] | undefined): boolean {
  const values = new Set(capabilities ?? []);
  return (
    values.has('image_generation') ||
    values.has('text_to_image') ||
    values.has('image_to_image') ||
    values.has('image_editing') ||
    values.has('video_generation') ||
    values.has('text_to_video') ||
    values.has('image_to_video')
  );
}

function confirmPaidModelTest(): Promise<boolean> {
  return new Promise((resolve) => {
    Modal.confirm({
      title: '确认测试高成本模型',
      content: '生图、参考图编辑或视频模型测试可能真实调用供应商接口并产生费用。确认后继续测试。',
      okText: '继续测试',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });
}

function readModelCatalogEntryEffectiveCapabilities(model: ProviderModelCatalogEntry): ModelCapability[] {
  return normalizeModelCapabilities(
    [
      ...inferModelCapabilitiesFromName(model.id, 'general'),
      ...(model.label ? inferModelCapabilitiesFromName(model.label, 'general') : []),
      ...(model.capabilities ?? [])
    ],
    'general'
  );
}

function modelCatalogEntrySupportsCapabilities(
  model: ProviderModelCatalogEntry,
  requiredCapabilities: ModelCapability[]
): boolean {
  if (requiredCapabilities.length === 0) {
    return true;
  }

  const inferredProfile: ModelProfile = {
    id: model.id,
    providerId: 'catalog',
    providerName: 'Catalog',
    modelName: model.id,
    purpose: purposeForModelCapabilities(model.capabilities, 'general'),
    capabilities: readModelCatalogEntryEffectiveCapabilities(model)
  };

  return modelProfileSupportsRequiredCapabilities(inferredProfile, requiredCapabilities);
}

function modelCatalogEntrySearchText(model: ProviderModelCatalogEntry): string {
  return [
    model.id,
    model.label,
    model.ownedBy,
    model.source,
    ...readModelCatalogEntryEffectiveCapabilities(model).map(modelCapabilityLabel)
  ]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLowerCase();
}

function prioritizeProviderCatalogModels(input: {
  models: ProviderModelCatalogEntry[];
  selectedModel?: ProviderModelCatalogEntry;
  requiredCapabilities: ModelCapability[];
}): ProviderModelCatalogEntry[] {
  const withSelectedModel =
    input.selectedModel && !input.models.some((model) => model.id === input.selectedModel?.id)
      ? [input.selectedModel, ...input.models]
      : input.models;

  return [...withSelectedModel].sort((left, right) => {
    const leftSelected = left.id === input.selectedModel?.id;
    const rightSelected = right.id === input.selectedModel?.id;
    if (leftSelected !== rightSelected) {
      return leftSelected ? -1 : 1;
    }

    const leftCompatible = modelCatalogEntrySupportsCapabilities(left, input.requiredCapabilities);
    const rightCompatible = modelCatalogEntrySupportsCapabilities(right, input.requiredCapabilities);
    if (leftCompatible !== rightCompatible) {
      return leftCompatible ? -1 : 1;
    }

    const leftPriority = modelCatalogEntryNamePriority(left);
    const rightPriority = modelCatalogEntryNamePriority(right);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.id.localeCompare(right.id, undefined, { numeric: true });
  });
}

function modelCatalogEntryNamePriority(model: ProviderModelCatalogEntry): number {
  const name = `${model.id} ${model.label ?? ''}`.toLowerCase();
  if (/\b(qwen|deepseek|gpt|claude|gemini|kimi|glm|minimax)\b/.test(name)) return 0;
  if (name.includes('asr') || name.includes('vl') || name.includes('image') || name.includes('wanx')) return 1;
  return 2;
}

function modelCatalogSourceLabel(source: NonNullable<ModelProviderCatalog['models'][number]['source']>): string {
  if (source === 'provider') return '供应商';
  if (source === 'built_in') return '内置';
  return '手动';
}

function modelCatalogSourceColor(source: NonNullable<ModelProviderCatalog['models'][number]['source']>): string {
  if (source === 'provider') return 'green';
  if (source === 'built_in') return 'blue';
  return 'default';
}

function findModelProviderCatalog(
  catalogs: ModelProviderCatalog[],
  providerId: string,
  apiBaseUrl?: string
): ModelProviderCatalog | undefined {
  const normalizedApiBaseUrl = normalizeComparableModelCatalogUrl(providerId, apiBaseUrl);
  return catalogs.find(
    (catalog) =>
      catalog.providerId === providerId &&
      (!normalizedApiBaseUrl ||
        normalizeComparableModelCatalogUrl(catalog.providerId, catalog.apiBaseUrl) === normalizedApiBaseUrl)
  );
}

function upsertModelProviderCatalog(
  catalogs: ModelProviderCatalog[],
  catalog: ModelProviderCatalog
): ModelProviderCatalog[] {
  const normalizedApiBaseUrl = normalizeComparableModelCatalogUrl(catalog.providerId, catalog.apiBaseUrl);
  const nextCatalog: ModelProviderCatalog = {
    ...catalog,
    models: [...catalog.models].sort((left, right) => left.id.localeCompare(right.id))
  };
  const existing = catalogs.find(
    (item) =>
      item.providerId === catalog.providerId &&
      normalizeComparableModelCatalogUrl(item.providerId, item.apiBaseUrl) === normalizedApiBaseUrl
  );

  return existing
    ? catalogs.map((item) =>
        item.providerId === catalog.providerId &&
        normalizeComparableModelCatalogUrl(item.providerId, item.apiBaseUrl) === normalizedApiBaseUrl
          ? nextCatalog
          : item
      )
    : [...catalogs, nextCatalog];
}

function normalizeComparableUrl(value?: string) {
  return value?.trim().replace(/\/+$/, '').toLowerCase() ?? '';
}

function normalizeComparableModelCatalogUrl(providerId: string, value?: string) {
  const normalized = normalizeComparableUrl(value);
  if (!normalized || !isAliyunBailianProviderId(providerId)) {
    return normalized;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.hostname === 'dashscope.aliyuncs.com') {
      return parsed.origin;
    }
  } catch {
    return normalized;
  }

  return normalized;
}

function isAliyunBailianProviderId(providerId: string) {
  const normalized = providerId.trim().toLowerCase();
  return normalized === 'aliyun-bailian' || normalized === 'aliyun-asr-compatible' || normalized.includes('aliyun');
}

function createPresetModelFromCatalogEntry(
  model: ModelProviderCatalog['models'][number],
  fallbackPurpose: ModelProfile['purpose'] = 'general'
): ModelProviderPresetModel {
  const capabilities = normalizeModelCapabilities(model.capabilities, fallbackPurpose);
  const purpose = purposeForModelCapabilities(capabilities, fallbackPurpose);

  return {
    label: model.label ?? model.id,
    modelName: model.id,
    purpose,
    capabilities,
    temperature: purpose === 'reasoning' ? 0.2 : 0.4,
    maxTokens: purpose === 'reasoning' ? 8192 : 4096
  };
}

function isPendingModelProviderProfile(profile: ModelProfile): boolean {
  return profile.providerId === 'provider-pending' || profile.providerId === 'provider-local';
}

function isCustomModelConfigurationProfile(profile: ModelProfile): boolean {
  if (isPendingModelProviderProfile(profile)) {
    return false;
  }

  const providerPresetIds = new Set(modelProviderPresets.map((preset) => preset.id));

  return (
    profile.providerId === 'custom' ||
    profile.providerId.startsWith('custom-') ||
    !providerPresetIds.has(profile.providerId)
  );
}

function isNativeProviderModelProfile(profile: ModelProfile, capabilities: string[] = []): boolean {
  const providerId = profile.providerId.trim().toLowerCase();
  const providerName = profile.providerName.trim().toLowerCase();
  const modelName = profile.modelName.trim().toLowerCase();
  const isAudioProfile = capabilities.includes('audio_to_text') || Boolean(profile.capabilities?.includes('audio_to_text'));

  return (
    providerId === 'aliyun-bailian' ||
    providerId === 'aliyun-asr-compatible' ||
    providerId === 'tencent-cloud' ||
    providerId === 'tencent-asr-compatible' ||
    (isAudioProfile && (
      providerId.includes('aliyun') ||
      providerId.includes('tencent') ||
      providerName.includes('阿里云') ||
      providerName.includes('百炼') ||
      providerName.includes('腾讯') ||
      providerName.includes('aliyun') ||
      providerName.includes('tencent') ||
      modelName.includes('fun-asr') ||
      modelName.includes('qwen3-asr') ||
      modelName.includes('paraformer')
    ))
  );
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
  return knowledgeBindingIdFromSource(source);
}

function createKnowledgeSourceFromBindingId(bindingId: string): DesktopKnowledgeSourceSummary {
  const normalizedBindingId = normalizeKnowledgeBindingId(bindingId);
  const catalogEntry = knowledgeBindingCatalogByBindingId.get(normalizedBindingId);

  return {
    id: normalizedBindingId,
    source: catalogEntry?.source ?? knowledgeBindingSourceFromId(normalizedBindingId),
    label: catalogEntry?.label ?? normalizedBindingId,
    enabled: false,
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
  deletedTemplateIds: string[] = [],
  deviceCapacity?: DesktopDeviceCapacitySummary
): DesktopRuntimeState {
  const authorizedRoleCodes = new Set(
    authorizedTemplates
      .filter((template) => canInstallRoleTemplate(template))
      .map((template) => template.roleCode)
  );
  const deletedTemplateIdSet = new Set(deletedTemplateIds);
  const rolePackages = restrictInstalledRolePackagesByDeviceCapacity(
    state.rolePackages.filter((rolePackage) =>
      authorizedRoleCodes.has(rolePackage.roleCode) ||
      isRolePackageTemplateDeleted(rolePackage, deletedTemplateIdSet)
    ),
    deviceCapacity
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
          runtimeModelProfileId: binding?.runtimeModelProfileId ?? modelProfileId,
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
    const runtimeModelProfileId = value?.runtimeModelProfileId?.trim() || modelProfileId;

    if (mode === 'credential_ref' && value?.credentialId) {
      return {
        roleCode,
        modelProfileId,
        runtimeModelProfileId,
        mode,
        credentialId: value.credentialId,
        updatedAt: now
      };
    }

    if (mode === 'inline' && value?.apiKey?.trim()) {
      return {
        roleCode,
        modelProfileId,
        runtimeModelProfileId,
        mode,
        apiBaseUrl: value.apiBaseUrl?.trim() || undefined,
        apiKey: value.apiKey.trim(),
        updatedAt: now
      };
    }

    return {
      roleCode,
      modelProfileId,
      runtimeModelProfileId,
      mode: 'provider_default',
      updatedAt: now
    };
  });
}

function readRuntimeModelProfileIdsFromRoleConfigForm(
  values: RoleConfigFormValues['modelCredentialBindings'] | undefined
): string[] {
  return [
    ...new Set(
      Object.values(values ?? {})
        .map((value) => value?.runtimeModelProfileId?.trim())
        .filter((profileId): profileId is string => Boolean(profileId))
    )
  ];
}

function buildRoleModelCredentialBindingsWithRuntimeModelSelections(
  roleCode: string,
  modelProfileIds: string[],
  currentBindings: RoleModelCredentialBinding[],
  runtimeSelections: RuntimeModelQuickSwitchFormValues['runtimeModels'] | undefined
): RoleModelCredentialBinding[] {
  const now = new Date().toISOString();
  const currentBindingsByModelId = new Map(
    currentBindings
      .filter((binding) => binding.roleCode === roleCode)
      .map((binding) => [binding.modelProfileId, binding])
  );
  const nextRoleBindings = modelProfileIds.map((modelProfileId) => {
    const currentBinding = currentBindingsByModelId.get(modelProfileId);
    const runtimeModelProfileId =
      runtimeSelections?.[modelProfileId]?.trim() ||
      currentBinding?.runtimeModelProfileId ||
      modelProfileId;

    if (currentBinding) {
      return {
        ...currentBinding,
        runtimeModelProfileId,
        updatedAt:
          currentBinding.runtimeModelProfileId === runtimeModelProfileId
            ? currentBinding.updatedAt
            : now
      };
    }

    return {
      roleCode,
      modelProfileId,
      runtimeModelProfileId,
      mode: 'provider_default',
      updatedAt: now
    } satisfies RoleModelCredentialBinding;
  });

  return [
    ...currentBindings.filter((binding) => binding.roleCode !== roleCode),
    ...nextRoleBindings
  ];
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

function buildCompatibleRuntimeModelOptions(
  state: DesktopRuntimeState,
  requirementProfile: ModelProfile,
  roleCode?: string
): Array<{ label: string; value: string }> {
  const requiredCapabilities = readModelProfileCapabilities(requirementProfile);
  const enabledModelIds = new Set(state.localRuntime.enabledModelProfileIds);
  const compatibleProfiles = state.modelProfiles.filter((profile) => {
    const isCurrentRequirement = profile.id === requirementProfile.id;
    const isEnabled = enabledModelIds.has(profile.id);
    const isConfigured = resolveModelProfileCredential({
      profile,
      roleCode,
      credentials: state.modelCredentials,
      roleBindings: state.roleModelCredentialBindings
    }).configured;
    const isSelectableConfiguredProvider =
      isConfigured && !isPendingModelProviderProfile(profile);

    return (
      (isCurrentRequirement || ((isEnabled || isSelectableConfiguredProvider) && isConfigured)) &&
      modelProfileSupportsAnyRequiredCapability(profile, requiredCapabilities)
    );
  });

  const profiles = compatibleProfiles.some((profile) => profile.id === requirementProfile.id)
    ? compatibleProfiles
    : [requirementProfile, ...compatibleProfiles];

  return profiles.map((profile) => ({
    value: profile.id,
    label: `${profile.providerName} / ${profile.modelName} · ${modelCapabilitySummary(profile.capabilities, profile.purpose)}`
  }));
}

function modelProfileSupportsAnyRequiredCapability(profile: ModelProfile, requiredCapabilities: ModelCapability[]): boolean {
  return modelProfileSupportsRequiredCapabilities(profile, requiredCapabilities);
}

function renderModelRequirementStatusLabel(issue: RoleModelRuntimeIssue | undefined): string {
  if (!issue) {
    return '已就绪';
  }

  const labels: Record<RoleModelRuntimeIssue, string> = {
    missing: '待创建',
    disabled: '未启用',
    unconfigured: '待填 Key',
    incompatible: '能力不匹配'
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

function redactDiagnosticText(value: string): string {
  return value
    .replace(/[A-Za-z]:\\(?:[^\\\r\n]+\\)+([^\\\r\n]+)/g, '...\\$1')
    .replace(/\/(?:[^/\r\n]+\/)+([^/\r\n]+)/g, '.../$1')
    .replace(/(api[_-]?key|authorization|token|secret|password)\s*[:=]\s*['"]?[^'"\s,;}]+/gi, '$1=[REDACTED]');
}

function fileNameFromPath(value: string): string {
  const parts = value.split(/[\\/]/).filter(Boolean);
  return parts[parts.length - 1] ?? value;
}
