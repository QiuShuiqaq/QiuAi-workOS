import {
  ApiOutlined,
  CloudSyncOutlined,
  ControlOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
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

import type { DesktopBackupSummary, DesktopRuntimeState } from '../shared/desktop-api';
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
import { syncDesktopRuntimeSnapshot } from '../shared/desktop-sync-client';
import { createDesktopRuntimePreviewState } from '../shared/desktop-state';
import {
  createMockTaskDetail,
  createTaskDetailFromSummary,
  toDesktopTaskSummary
} from '../shared/workbench-data';
import { runDesktopTask } from '../shared/desktop-task-runner';

type SectionKey = 'workbench' | 'roles' | 'models' | 'tools' | 'knowledge' | 'runtime' | 'sync';

type DesktopRoleTemplate = RoleTemplateCatalogEntry;

interface TaskFormValues {
  roleCode: string;
  title: string;
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
  workspaceId: string;
}

interface RoleConfigFormValues {
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeSources: KnowledgeBindingSource[];
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
  { key: 'models', icon: <ApiOutlined />, label: '模型中心' },
  { key: 'tools', icon: <ToolOutlined />, label: '工具中心' },
  { key: 'knowledge', icon: <FolderOpenOutlined />, label: '本地知识' },
  { key: 'runtime', icon: <DatabaseOutlined />, label: '运行摘要' },
  { key: 'sync', icon: <CloudSyncOutlined />, label: '同步设置' }
];

const desktopRoleTemplates: DesktopRoleTemplate[] = defaultRoleTemplateCatalog;
const desktopRoleTemplateByRoleCode = new Map(
  desktopRoleTemplates.map((template) => [template.roleCode, template] as const)
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

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0
});
const pendingWorkspaceId = 'workspace_pending_login';

export default function App() {
  const [runtimeState, setRuntimeState] = useState<DesktopRuntimeState>(
    createDesktopRuntimePreviewState()
  );
  const [selectedSection, setSelectedSection] = useState<SectionKey>('workbench');
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isBackupBusy, setIsBackupBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [backupNotice, setBackupNotice] = useState('');
  const [modelTestNotice, setModelTestNotice] = useState('');
  const [isTestingModel, setIsTestingModel] = useState(false);
  const [localActionNotice, setLocalActionNotice] = useState('');
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState(false);
  const [workspaceBackups, setWorkspaceBackups] = useState<DesktopBackupSummary[]>([]);
  const [taskForm] = Form.useForm<TaskFormValues>();
  const [modelForm] = Form.useForm<ModelFormValues>();
  const [onboardingForm] = Form.useForm<OnboardingFormValues>();
  const [roleConfigForm] = Form.useForm<RoleConfigFormValues>();
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [roleConfigModalOpen, setRoleConfigModalOpen] = useState(false);
  const [roleConfigMode, setRoleConfigMode] = useState<'install' | 'configure'>('install');
  const [roleConfigRoleCode, setRoleConfigRoleCode] = useState('');

  useEffect(() => {
    void loadRuntimeState();
  }, []);

  useEffect(() => {
    if (!hasLoadedPersistedState) {
      return;
    }

    void loadWorkspaceBackups();
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
      onboardingForm.setFieldsValue({ workspaceId: '' });
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
      const result = await syncDesktopRuntimeSnapshot(
        runtimeState.app.serverBaseUrl,
        runtimeState.localRuntime.workspaceId,
        runtimeState.runtimeSnapshot
      );
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

  function submitOnboarding(values: OnboardingFormValues) {
    const workspaceId = values.workspaceId.trim();
    if (!workspaceId) {
      return;
    }

    setRuntimeState((current) => ({
      ...current,
      localRuntime: {
        ...current.localRuntime,
        workspaceId
      },
      runtimeSnapshot: {
        ...current.runtimeSnapshot,
        workspaceId
      }
    }));
    setOnboardingOpen(false);
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

  const enabledModelCount = runtimeState.localRuntime.enabledModelProfileIds.length;
  const enabledToolCount = runtimeState.localRuntime.enabledToolIds.length;
  const knowledgeBindingCount = runtimeState.localRuntime.knowledgeBindingIds.length;
  const requiresOnboarding = runtimeState.localRuntime.workspaceId === pendingWorkspaceId;

  const connectionTone = useMemo(() => {
    if (runtimeState.serverConnection.state === 'online') return 'success';
    if (runtimeState.serverConnection.state === 'offline') return 'error';
    return 'default';
  }, [runtimeState.serverConnection.state]);

  return (
    <ConfigProvider locale={zhCN} theme={qiuAntTheme}>
      <AppProvider>
        <Layout className="desktop-shell">
          <Layout.Sider width={248} theme="light" className="desktop-sidebar">
            <div className="brand-block">
              <Typography.Title level={4} className="brand-title">
                QiuAI WorkOS
              </Typography.Title>
              <Typography.Text type="secondary">企业桌面运行台</Typography.Text>
            </div>

            <Menu
              mode="inline"
              selectedKeys={[selectedSection]}
              items={sectionItems}
              onClick={({ key }) => setSelectedSection(key as SectionKey)}
            />

            <div className="sidebar-footer">
              <Space direction="vertical" size={4}>
                <Typography.Text strong>{runtimeState.app.deviceName}</Typography.Text>
                <Typography.Text type="secondary">{runtimeState.app.serverBaseUrl}</Typography.Text>
              </Space>
            </div>
          </Layout.Sider>

          <Layout.Content className="desktop-content">
            <Space direction="vertical" size={18} className="content-stack">
              <Flex align="center" justify="space-between" gap={16} wrap="wrap">
                <div>
                  <Typography.Title level={2} className="page-title">
                    {sectionTitle(selectedSection)}
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    {runtimeState.app.deviceName} · {runtimeState.localRuntime.workspaceId}
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

              {selectedSection === 'workbench' ? renderWorkbench() : null}
              {selectedSection === 'roles' ? renderRoles() : null}
              {selectedSection === 'models' ? renderModels() : null}
              {selectedSection === 'tools' ? renderTools() : null}
              {selectedSection === 'knowledge' ? renderKnowledge() : null}
              {selectedSection === 'runtime' ? renderRuntime() : null}
              {selectedSection === 'sync' ? renderSync() : null}
            </Space>
          </Layout.Content>
        </Layout>
        {renderOnboardingModal()}
      </AppProvider>
    </ConfigProvider>
  );

  function renderOnboardingModal() {
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
    return (
      <>
        <div className="metric-grid">
          <Card bordered={false}>
            <Statistic title="已安装角色" value={runtimeState.rolePackages.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="已启用模型" value={enabledModelCount} />
          </Card>
          <Card bordered={false}>
            <Statistic title="已启用工具" value={enabledToolCount} />
          </Card>
          <Card bordered={false}>
            <Statistic title="本地任务" value={runtimeState.runtimeSnapshot.tasks.length} />
          </Card>
        </div>

        <div className="main-grid">
          <Card title="创建任务" bordered={false}>
            <Form<TaskFormValues>
              form={taskForm}
              layout="vertical"
              initialValues={{
                roleCode: runtimeState.localRuntime.activeRoleCode ?? runtimeState.rolePackages[0]?.roleCode
              }}
              onFinish={createTask}
            >
              <Form.Item
                name="roleCode"
                label="执行角色"
                rules={[{ required: true, message: '请选择一个已安装角色' }]}
              >
                <Select
                  options={runtimeState.rolePackages.map((rolePackage) => ({
                    label: `${rolePackage.name} · ${rolePackage.version}`,
                    value: rolePackage.roleCode
                  }))}
                />
              </Form.Item>
              <Form.Item
                name="title"
                label="任务标题"
                rules={[{ required: true, message: '请输入任务标题' }]}
              >
                <Input placeholder="例如：今日案例筛选" />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                block
                icon={<PlayCircleOutlined />}
                disabled={runtimeState.rolePackages.length === 0}
              >
                生成本地任务
              </Button>
            </Form>
          </Card>

          <Card title="当前运行" bordered={false}>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="激活角色">
                {activeRolePackage ? activeRolePackage.name : '未激活'}
              </Descriptions.Item>
              <Descriptions.Item label="同步策略">
                {runtimeState.localRuntime.syncPolicy}
              </Descriptions.Item>
              <Descriptions.Item label="知识绑定">
                {knowledgeBindingCount}
              </Descriptions.Item>
              <Descriptions.Item label="本地目录">
                {runtimeState.app.userDataPath}
              </Descriptions.Item>
              <Descriptions.Item label="控制端">
                {runtimeState.serverConnection.serverBaseUrl}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </div>

        <div className="main-grid">
          <Card title="任务队列" bordered={false}>
            <List
              dataSource={orderedTasks}
              locale={{ emptyText: '暂无任务' }}
              renderItem={(task) => {
                const detail =
                  taskDetails.find((item) => item.taskId === task.taskId) ??
                  createTaskDetailFromSummary(
                    task,
                    resolveRoleName(runtimeState.rolePackages, task.roleCode)
                  );
                const isSelected = selectedTask?.taskId === task.taskId;

                return (
                  <List.Item
                    className={isSelected ? 'task-list-item task-list-item-selected' : 'task-list-item'}
                    onClick={() => setSelectedTaskId(task.taskId)}
                    actions={[
                      task.state === 'completed' ? (
                        <Tag key="done" color="green">
                          已完成
                        </Tag>
                      ) : (
                        <Button
                          key="run"
                          type="link"
                          icon={<PlayCircleOutlined />}
                          loading={task.state === 'running'}
                          disabled={task.state === 'running'}
                          onClick={(event) => {
                            event.stopPropagation();
                            void completeTask(task.taskId);
                          }}
                        >
                          模拟完成
                        </Button>
                      )
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<DatabaseOutlined className="list-icon" />}
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{task.title}</Typography.Text>
                          {isSelected ? <Tag color="processing">当前查看</Tag> : null}
                          <Tag color={taskStateColor(task.state)}>{taskStateLabel(task.state)}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          <Space size={8} wrap>
                            <Typography.Text type="secondary">{detail.roleName}</Typography.Text>
                            <Typography.Text type="secondary">{detail.taskType}</Typography.Text>
                          </Space>
                          <Space size={8} wrap>
                            <Typography.Text type="secondary">产物 {task.artifactCount ?? 0}</Typography.Text>
                            <Typography.Text type="secondary">
                              成本 {formatCents(task.costCents)}
                            </Typography.Text>
                            <Typography.Text type="secondary">{formatDate(task.updatedAt)}</Typography.Text>
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>

          <Card title="任务明细" bordered={false}>
            {selectedTask ? (
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="任务标题">{selectedTask.title}</Descriptions.Item>
                  <Descriptions.Item label="执行角色">
                    {resolveRoleName(runtimeState.rolePackages, selectedTask.roleCode)}
                  </Descriptions.Item>
                  <Descriptions.Item label="任务类型">{selectedTask.taskType}</Descriptions.Item>
                  <Descriptions.Item label="状态">{taskStateLabel(selectedTask.state)}</Descriptions.Item>
                  <Descriptions.Item label="优先级">{selectedTask.priority}</Descriptions.Item>
                  <Descriptions.Item label="输入">{selectedTask.input}</Descriptions.Item>
                  <Descriptions.Item label="产物">{selectedTask.artifacts.length}</Descriptions.Item>
                  <Descriptions.Item label="成本">{formatCents(selectedTask.costCents)}</Descriptions.Item>
                  <Descriptions.Item label="创建时间">{formatDate(selectedTask.createdAt)}</Descriptions.Item>
                  <Descriptions.Item label="更新时间">{formatDate(selectedTask.updatedAt)}</Descriptions.Item>
                  <Descriptions.Item label="当前运行">
                    {selectedTask.currentRun
                      ? `${selectedTask.currentRun.status} · ${formatDate(selectedTask.currentRun.startedAt)}`
                      : '—'}
                  </Descriptions.Item>
                </Descriptions>
                {selectedTask.executionContext ? (
                  <div>
                    <Typography.Title level={5}>鎵ц閰嶇疆</Typography.Title>
                    <Space direction="vertical" size={10} style={{ width: '100%' }}>
                      <div>
                        <Typography.Text type="secondary">妯″瀷</Typography.Text>
                        <Space size={6} wrap>
                          {selectedTask.executionContext.modelProfileIds.map((profileId) => (
                            <Tag key={profileId}>
                              {resolveModelProfileLabel(runtimeState.modelProfiles, profileId)}
                            </Tag>
                          ))}
                        </Space>
                      </div>
                      <div>
                        <Typography.Text type="secondary">宸ュ叿</Typography.Text>
                        <Space size={6} wrap>
                          {selectedTask.executionContext.toolIds.map((toolId) => (
                            <Tag key={toolId}>{resolveToolLabel(runtimeState.tools, toolId)}</Tag>
                          ))}
                        </Space>
                      </div>
                      <div>
                        <Typography.Text type="secondary">鐭ヨ瘑</Typography.Text>
                        <Space size={6} wrap>
                          {selectedTask.executionContext.knowledgeBindingIds.map((bindingId) => (
                            <Tag key={bindingId}>{resolveKnowledgeBindingLabel(bindingId)}</Tag>
                          ))}
                        </Space>
                      </div>
                    </Space>
                  </div>
                ) : null}

                <div>
                  <Typography.Title level={5}>执行日志</Typography.Title>
                  <List
                    size="small"
                    dataSource={selectedTask.executionLogs}
                    locale={{ emptyText: '暂无日志' }}
                    renderItem={(log) => (
                      <List.Item>
                        <Space direction="vertical" size={2}>
                          <Space size={8} wrap>
                            <Tag color={logLevelColor(log.level)}>{log.level}</Tag>
                            <Typography.Text strong>{log.eventType}</Typography.Text>
                            <Typography.Text type="secondary">{formatDate(log.createdAt)}</Typography.Text>
                          </Space>
                          <Typography.Text type="secondary">{log.message}</Typography.Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>

                <div>
                  <Typography.Title level={5}>产物</Typography.Title>
                  <List
                    size="small"
                    dataSource={selectedTask.artifacts}
                    locale={{ emptyText: '暂无产物' }}
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
                                  打开文件
                                </Button>
                              ]
                            : undefined
                        }
                      >
                        <Space direction="vertical" size={2}>
                          <Space size={8} wrap>
                            <Tag>{artifact.type}</Tag>
                            <Typography.Text strong>{artifact.title}</Typography.Text>
                          </Space>
                          <Typography.Text type="secondary">{artifact.content}</Typography.Text>
                          {artifact.localPath ? (
                            <Typography.Text type="secondary">{artifact.localPath}</Typography.Text>
                          ) : null}
                          <Typography.Text type="secondary">{formatDate(artifact.createdAt)}</Typography.Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                  {localActionNotice ? (
                    <Typography.Text type="warning">{localActionNotice}</Typography.Text>
                  ) : null}
                </div>

                <div>
                  <Typography.Title level={5}>成本记录</Typography.Title>
                  <List
                    size="small"
                    dataSource={selectedTask.costRecords}
                    locale={{ emptyText: '暂无成本记录' }}
                    renderItem={(record) => (
                      <List.Item>
                        <Space direction="vertical" size={2}>
                          <Space size={8} wrap>
                            <Typography.Text strong>{record.provider}</Typography.Text>
                            <Typography.Text type="secondary">{record.modelName}</Typography.Text>
                            <Typography.Text type="secondary">{formatDate(record.createdAt)}</Typography.Text>
                          </Space>
                          <Typography.Text type="secondary">
                            输入 {record.inputTokens} · 输出 {record.outputTokens} · 成本 {formatCents(record.costCents)}
                          </Typography.Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </div>
              </Space>
            ) : (
              <Empty description="请选择任务查看明细" />
            )}
          </Card>
        </div>
      </>
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
                              {rolePackage.roleCode} 路 {rolePackage.version}
                            </Typography.Text>
                            <Typography.Text type="secondary">
                              浠诲姟 {summary?.taskCount ?? 0}
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
            <List
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
    return (
      <>
        <div className="metric-grid">
          <Card bordered={false}>
            <Statistic title="模型总数" value={runtimeState.modelProfiles.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="已启用" value={enabledModelCount} />
          </Card>
          <Card bordered={false}>
            <Statistic title="当前选择" value={selectedModelProfile?.modelName ?? '未选择'} />
          </Card>
          <Card bordered={false}>
            <Statistic title="默认回退" value={selectedModelProfile?.fallbackProfileId ?? '无'} />
          </Card>
        </div>

        <div className="main-grid">
          <Card title="模型列表" bordered={false}>
            <List
              dataSource={runtimeState.modelProfiles}
              renderItem={(profile) => {
                const enabled = runtimeState.localRuntime.enabledModelProfileIds.includes(profile.id);

                return (
                  <List.Item
                    actions={[
                      <Switch
                        key="enabled"
                        checked={enabled}
                        onChange={(checked) => toggleModelProfile(profile.id, checked)}
                      />
                    ]}
                  >
                    <List.Item.Meta
                      avatar={<ApiOutlined className="list-icon" />}
                      title={
                        <Space size={8} wrap>
                          <Button type="link" onClick={() => setSelectedModelId(profile.id)}>
                            {profile.modelName}
                          </Button>
                          <Tag color={enabled ? 'green' : 'default'}>
                            {enabled ? '已启用' : '已停用'}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={2}>
                          <Typography.Text type="secondary">
                            {profile.providerName} · {profile.purpose}
                          </Typography.Text>
                          <Typography.Text type="secondary">
                            温度 {profile.temperature ?? '默认'} · 上限 {profile.maxTokens ?? '默认'}
                          </Typography.Text>
                        </Space>
                      }
                    />
                  </List.Item>
                );
              }}
            />
          </Card>

          <Card title="模型配置" bordered={false}>
            {selectedModelProfile ? (
              <Form<ModelFormValues>
                form={modelForm}
                layout="vertical"
                onFinish={saveModelProfile}
              >
                <Form.Item name="providerName" label="提供方" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="modelName" label="模型名称" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="purpose" label="用途" rules={[{ required: true }]}>
                  <Select
                    options={[
                      { label: '通用', value: 'general' },
                      { label: '推理', value: 'reasoning' },
                      { label: '视觉', value: 'vision' },
                      { label: '向量', value: 'embeddings' },
                      { label: '文档', value: 'document' }
                    ]}
                  />
                </Form.Item>
                <Form.Item name="apiBaseUrl" label="API Base URL">
                  <Input placeholder="https://api.openai.com/v1" />
                </Form.Item>
                <Form.Item name="apiKey" label="API Key">
                  <Input.Password placeholder="Stored locally" />
                </Form.Item>
                <Form.Item name="temperature" label="温度">
                  <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="maxTokens" label="最大输出">
                  <InputNumber min={0} step={256} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="monthlyBudgetCents" label="月度预算（分）">
                  <InputNumber min={0} step={100} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="fallbackProfileId" label="回退模型">
                  <Select
                    allowClear
                    options={runtimeState.modelProfiles
                      .filter((profile) => profile.id !== selectedModelProfile.id)
                      .map((profile) => ({
                        label: `${profile.modelName} · ${profile.providerName}`,
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
            ) : null}
          </Card>
        </div>
      </>
    );
  }

  function renderTools() {
    return (
      <>
        <div className="metric-grid">
          <Card bordered={false}>
            <Statistic title="注册工具" value={runtimeState.tools.length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="已启用" value={enabledToolCount} />
          </Card>
          <Card bordered={false}>
            <Statistic title="需审批" value={runtimeState.tools.filter((tool) => tool.requiresApproval).length} />
          </Card>
          <Card bordered={false}>
            <Statistic title="桌面桥接" value={runtimeState.tools.filter((tool) => tool.entryPoint === 'bridge').length} />
          </Card>
        </div>

        <Card title="工具中心" bordered={false}>
          <List
            dataSource={runtimeState.tools}
            renderItem={(tool) => {
              const enabled = runtimeState.localRuntime.enabledToolIds.includes(tool.id);

              return (
                <List.Item
                  actions={[
                    <Switch
                      key="toggle"
                      checked={enabled}
                      onChange={(checked) => toggleTool(tool.id, checked)}
                    />
                  ]}
                >
                  <List.Item.Meta
                    avatar={<ToolOutlined className="list-icon" />}
                    title={
                      <Space size={8} wrap>
                        <Typography.Text strong>{tool.name}</Typography.Text>
                        <Tag color={enabled ? 'green' : 'default'}>
                          {enabled ? '已启用' : '已停用'}
                        </Tag>
                        {tool.requiresApproval ? <Tag color="gold">需审批</Tag> : null}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={2}>
                        <Typography.Text type="secondary">
                          {tool.scope} · {tool.entryPoint}
                        </Typography.Text>
                        <Space size={6} wrap>
                          {tool.capabilities.map((capability) => (
                            <Tag key={capability}>{capability}</Tag>
                          ))}
                        </Space>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      </>
    );
  }

  function renderKnowledge() {
    return (
      <>
        <div className="metric-grid">
          <Card bordered={false}>
            <Statistic title="绑定数量" value={knowledgeBindingCount} />
          </Card>
          <Card bordered={false}>
            <Statistic
              title="可用来源"
              value={knowledgeBindingCatalog.length}
            />
          </Card>
          <Card bordered={false}>
            <Statistic title="同步策略" value={runtimeState.localRuntime.syncPolicy} />
          </Card>
          <Card bordered={false}>
            <Statistic title="本地优先" value="是" />
          </Card>
        </div>

        <div className="main-grid">
          <Card title="当前绑定" bordered={false}>
            <List
              dataSource={runtimeState.knowledgeSources.length > 0
                ? runtimeState.knowledgeSources
                : runtimeState.localRuntime.knowledgeBindingIds.map((bindingId) =>
                    createKnowledgeSourceFromBindingId(bindingId)
                  )}
              locale={{ emptyText: '尚未绑定本地知识' }}
              renderItem={(source) => (
                <List.Item>
                  <List.Item.Meta
                    avatar={<FolderOpenOutlined className="list-icon" />}
                    title={source.label}
                    description={source.localPath ?? source.summary ?? source.id}
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="添加来源" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {knowledgeBindingCatalog.map((option) => {
                const isBound = runtimeState.localRuntime.knowledgeBindingIds.includes(option.bindingId);

                return (
                  <Flex key={option.bindingId} align="center" justify="space-between" gap={12}>
                    <Typography.Text>{option.label}</Typography.Text>
                    <Button
                      type="link"
                      disabled={isBound}
                      onClick={() => void addKnowledgeBinding(option)}
                    >
                      {isBound ? '已绑定' : '绑定'}
                    </Button>
                  </Flex>
                );
              })}
            </Space>
          </Card>
        </div>
      </>
    );
  }

  function renderRuntime() {
    return (
      <div className="main-grid">
        <Card title="运行摘要" bordered={false}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Runtime ID">{runtimeState.localRuntime.runtimeId}</Descriptions.Item>
            <Descriptions.Item label="Device ID">{runtimeState.localRuntime.deviceId}</Descriptions.Item>
            <Descriptions.Item label="激活角色">
              {activeRolePackage ? activeRolePackage.name : '未激活'}
            </Descriptions.Item>
            <Descriptions.Item label="应用版本">{runtimeState.app.appVersion}</Descriptions.Item>
            <Descriptions.Item label="同步时间">
              {runtimeState.localRuntime.lastSyncedAt ? formatDate(runtimeState.localRuntime.lastSyncedAt) : '未同步'}
            </Descriptions.Item>
            <Descriptions.Item label="本地目录">{runtimeState.app.userDataPath}</Descriptions.Item>
            <Descriptions.Item label="控制端">{runtimeState.serverConnection.serverBaseUrl}</Descriptions.Item>
          </Descriptions>
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
              {backupNotice || '备份保存在当前工作区本地，可用于导出、迁移和恢复。'}
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
                        <Typography.Text strong>{backup.bundleId}</Typography.Text>
                        <Tag color="blue">{formatDate(backup.createdAt)}</Tag>
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={2}>
                        <Typography.Text type="secondary">{backup.appVersion}</Typography.Text>
                        <Typography.Text type="secondary">{backup.bundlePath}</Typography.Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Space>
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
    const taskDetail = createMockTaskDetail({
      roleCode,
      roleName,
      title,
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
    taskForm.resetFields(['title']);
  }

  async function completeTask(taskId: string) {
    const sourceState = runtimeState;
    const startedAt = new Date().toISOString();

    setRuntimeState((current) => {
      const taskDetails = (current.taskDetails ?? current.runtimeSnapshot.tasks.map((task) =>
        createTaskDetailFromSummary(task, resolveRoleName(current.rolePackages, task.roleCode))
      )).map((detail) =>
        detail.taskId === taskId
          ? {
              ...detail,
              state: 'running' as const,
              updatedAt: startedAt,
              currentRun: {
                id: detail.currentRun?.id ?? `${detail.taskId}-run-1`,
                taskId: detail.taskId,
                status: 'running' as const,
                startedAt
              }
            }
          : detail
      );
      const tasks = taskDetails.map(toDesktopTaskSummary);

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

    const completedAt = new Date().toISOString();
    const sourceTaskDetails = sourceState.taskDetails ?? sourceState.runtimeSnapshot.tasks.map((task) =>
      createTaskDetailFromSummary(task, resolveRoleName(sourceState.rolePackages, task.roleCode))
    );
    const targetTask = sourceTaskDetails.find((detail) => detail.taskId === taskId);

    if (!targetTask) {
      return;
    }

    const result = await runDesktopTask({
      task: {
        ...targetTask,
        state: 'running',
        updatedAt: startedAt,
        currentRun: {
          id: targetTask.currentRun?.id ?? `${targetTask.taskId}-run-1`,
          taskId: targetTask.taskId,
          status: 'running',
          startedAt
        }
      },
      workspaceId: sourceState.localRuntime.workspaceId,
      rolePackage: sourceState.rolePackages.find((rolePackage) => rolePackage.roleCode === targetTask.roleCode),
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
      completedAt
    );

    setRuntimeState((current) => {
      const taskDetails = (current.taskDetails ?? current.runtimeSnapshot.tasks.map((task) =>
        createTaskDetailFromSummary(task, resolveRoleName(current.rolePackages, task.roleCode))
      )).map((detail) => (detail.taskId === taskId ? persistedTask : detail));
      const tasks = taskDetails.map(toDesktopTaskSummary);
      const usedToolIdSet = new Set(result.usedToolIds);

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
          ),
          tools: rebuildToolSummaries(
            current.tools,
            current.localRuntime.enabledToolIds,
            current.runtimeSnapshot.tools
          ).map((tool) =>
            usedToolIdSet.has(tool.toolId) ? { ...tool, lastUsedAt: completedAt } : tool
          )
        }
      };
    });
  }
}

function sectionTitle(section: SectionKey) {
  const titles: Record<SectionKey, string> = {
    workbench: '桌面工作台',
    roles: '数字员工',
    models: '模型中心',
    tools: '工具中心',
    knowledge: '本地知识',
    runtime: '运行摘要',
    sync: '同步设置'
  };

  return titles[section];
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

function formatCents(value?: number) {
  if (value === undefined || value === null) {
    return '—';
  }

  return currencyFormatter.format(value / 100);
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
