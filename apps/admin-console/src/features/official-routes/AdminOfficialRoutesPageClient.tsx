'use client';

import type {
  AdminOfficialModelApiKeyStatus,
  AdminOfficialModelApiKeySummary,
  AdminOfficialModelRouteSummary,
  CreateAdminOfficialModelApiKeyRequest,
  CurrentAccountResponse,
  UpdateAdminOfficialModelApiKeyRequest
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import {
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Flex from 'antd/es/flex';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminOfficialRoutesPageClientProps {
  currentAccount: CurrentAccountResponse;
  routes: AdminOfficialModelRouteSummary[];
}

type KeyFormValues = {
  label?: string;
  apiKey?: string;
  status?: AdminOfficialModelApiKeyStatus;
  maxConcurrency?: number;
  rpmLimit?: number | null;
  sortOrder?: number;
};

type EditingState =
  | {
      mode: 'create';
      route: AdminOfficialModelRouteSummary;
    }
  | {
      mode: 'edit';
      route: AdminOfficialModelRouteSummary;
      apiKey: AdminOfficialModelApiKeySummary;
    };

const statusOptions = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
  { label: '冷却', value: 'cooldown' }
];

const capabilityLabels: Record<AdminOfficialModelRouteSummary['capability'], string> = {
  text: '文本',
  reasoning: '推理',
  image: '图片',
  video: '视频'
  ,audio: '口播'
};

function statusTone(status: AdminOfficialModelApiKeyStatus): 'success' | 'warning' | 'default' {
  if (status === 'active') return 'success';
  if (status === 'cooldown') return 'warning';
  return 'default';
}

function routeStatusTone(status: AdminOfficialModelRouteSummary['status']): 'success' | 'warning' {
  return status === 'active' ? 'success' : 'warning';
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function defaultMaxConcurrency(providerId: string) {
  if (providerId === 'deepseek') return 500;
  if (providerId === 'grsai') return 16;
  if (providerId === 'minimax') return 4;
  return 1;
}

function defaultRpmLimit(providerId: string) {
  return providerId === 'minimax' ? 16 : undefined;
}

function normalizeCreatePayload(values: KeyFormValues): CreateAdminOfficialModelApiKeyRequest {
  return {
    label: values.label?.trim() || undefined,
    apiKey: values.apiKey?.trim() ?? '',
    status: values.status ?? 'active',
    maxConcurrency: values.maxConcurrency,
    rpmLimit: values.rpmLimit ?? null,
    sortOrder: values.sortOrder
  };
}

function normalizeUpdatePayload(values: KeyFormValues): UpdateAdminOfficialModelApiKeyRequest {
  const apiKey = values.apiKey?.trim();
  return {
    label: values.label?.trim() || undefined,
    apiKey: apiKey || undefined,
    status: values.status,
    maxConcurrency: values.maxConcurrency,
    rpmLimit: values.rpmLimit ?? null,
    sortOrder: values.sortOrder
  };
}

export function AdminOfficialRoutesPageClient({
  currentAccount,
  routes
}: AdminOfficialRoutesPageClientProps) {
  const [rows, setRows] = useState(routes);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionKeyId, setActionKeyId] = useState<string | null>(null);
  const [form] = Form.useForm<KeyFormValues>();

  useEffect(() => {
    setRows(routes);
  }, [routes]);

  useEffect(() => {
    if (!editing) {
      form.resetFields();
      return;
    }

    if (editing.mode === 'create') {
      form.setFieldsValue({
        label: '',
        apiKey: '',
        status: 'active',
        maxConcurrency: defaultMaxConcurrency(editing.route.providerId),
        rpmLimit: defaultRpmLimit(editing.route.providerId),
        sortOrder: 1000
      });
      return;
    }

    form.setFieldsValue({
      label: editing.apiKey.label,
      apiKey: '',
      status: editing.apiKey.status,
      maxConcurrency: editing.apiKey.maxConcurrency,
      rpmLimit: editing.apiKey.rpmLimit ?? null,
      sortOrder: editing.apiKey.sortOrder
    });
  }, [editing, form]);

  const totals = useMemo(
    () => ({
      routes: rows.length,
      activeKeys: rows.reduce((total, route) => total + route.activeKeyCount, 0),
      totalConcurrency: rows.reduce((total, route) => total + route.totalMaxConcurrency, 0),
      currentConcurrency: rows.reduce((total, route) => total + route.currentConcurrency, 0)
    }),
    [rows]
  );

  async function reloadRoutes() {
    setLoading(true);
    try {
      const response = await createBrowserApiClient().listAdminOfficialModelRoutes();
      setRows(response.data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '刷新失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(values: KeyFormValues) {
    if (!editing) {
      return;
    }

    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      if (editing.mode === 'create') {
        await apiClient.createAdminOfficialModelApiKey(editing.route.routeKey, normalizeCreatePayload(values));
        message.success('API Key 已添加');
      } else {
        await apiClient.updateAdminOfficialModelApiKey(editing.apiKey.id, normalizeUpdatePayload(values));
        message.success('API Key 已更新');
      }
      setEditing(null);
      await reloadRoutes();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function reclaimExpiredLeases(apiKey: AdminOfficialModelApiKeySummary) {
    setActionKeyId(apiKey.id);
    try {
      const response = await createBrowserApiClient().reclaimExpiredAdminOfficialModelApiKeyLeases(apiKey.id);
      message.success(`已释放 ${response.data.releasedLeaseCount} 个过期占用`);
      await reloadRoutes();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '释放过期占用失败');
    } finally {
      setActionKeyId(null);
    }
  }

  function forceReleaseLeases(apiKey: AdminOfficialModelApiKeySummary) {
    Modal.confirm({
      title: '强制释放并暂停此 Key？',
      icon: <WarningOutlined />,
      content: '此操作只释放本地并发占用，不会取消供应商侧任务，也不会自动退款或重试。完成后 Key 会暂停，需要确认供应商侧无任务后再恢复调度。',
      okText: '强制释放并暂停',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setActionKeyId(apiKey.id);
        try {
          const response = await createBrowserApiClient().forceReleaseAdminOfficialModelApiKeyLeases(apiKey.id);
          message.success(`已强制释放 ${response.data.releasedLeaseCount} 个占用，Key 已暂停`);
          await reloadRoutes();
        } catch (error) {
          message.error(error instanceof Error ? error.message : '强制释放失败');
          throw error;
        } finally {
          setActionKeyId(null);
        }
      }
    });
  }

  async function resumeKey(apiKey: AdminOfficialModelApiKeySummary) {
    setActionKeyId(apiKey.id);
    try {
      await createBrowserApiClient().updateAdminOfficialModelApiKey(apiKey.id, { status: 'active' });
      message.success('Key 已恢复调度');
      await reloadRoutes();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '恢复调度失败');
    } finally {
      setActionKeyId(null);
    }
  }

  const columns: ColumnsType<AdminOfficialModelApiKeySummary> = [
    {
      title: 'Key',
      dataIndex: 'label',
      render: (_value, item) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{item.label}</Typography.Text>
          <Typography.Text type="secondary">尾号 {item.apiKeyLastFour}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: AdminOfficialModelApiKeyStatus) => (
        <QiuStatusTag tone={statusTone(status)}>{status === 'active' ? '启用' : status === 'cooldown' ? '冷却' : '停用'}</QiuStatusTag>
      )
    },
    {
      title: '并发',
      key: 'concurrency',
      width: 110,
      render: (_value, item) => `${item.currentConcurrency}/${item.maxConcurrency}`
    },
    {
      title: '提交速率',
      dataIndex: 'rpmLimit',
      width: 110,
      render: (value?: number) => (value ? `${value}/分钟` : '不限制')
    },
    {
      title: '最近使用',
      dataIndex: 'lastUsedAt',
      width: 130,
      render: formatDateTime
    },
    {
      title: '错误',
      dataIndex: 'lastError',
      render: (value?: string) => (
        <Typography.Text type={value ? 'danger' : 'secondary'} ellipsis style={{ maxWidth: 280 }}>
          {value || '-'}
        </Typography.Text>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 250,
      render: (_value, item) => (
        <Space wrap size={[4, 4]}>
          <Button
            size="small"
            icon={<EditOutlined />}
            disabled={actionKeyId === item.id}
            onClick={() => {
              const route = rows.find((candidate) => candidate.routeKey === item.routeKey);
              if (route) {
                setEditing({ mode: 'edit', route, apiKey: item });
              }
            }}
          >
            编辑
          </Button>
          {item.status === 'disabled' ? (
            <Button
              size="small"
              type="link"
              icon={<PlayCircleOutlined />}
              loading={actionKeyId === item.id}
              onClick={() => void resumeKey(item)}
            >
              恢复调度
            </Button>
          ) : (
            <>
              <Button
                size="small"
                type="link"
                icon={<ReloadOutlined />}
                loading={actionKeyId === item.id}
                onClick={() => void reclaimExpiredLeases(item)}
              >
                释放过期
              </Button>
              <Button
                size="small"
                danger
                type="link"
                icon={<PauseCircleOutlined />}
                loading={actionKeyId === item.id}
                onClick={() => forceReleaseLeases(item)}
              >
                强制释放
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="官方线路"
        description="管理 QiuAI 官方通道的 API Key 池、并发上限和提交速率。"
        actions={
          <Button icon={<ReloadOutlined />} loading={loading} onClick={reloadRoutes}>
            刷新
          </Button>
        }
      >
        <Alert
          type="info"
          showIcon
          message="这里仅供运营后台使用。PC 桌面端不会展示真实供应商、模型名或 API Key。"
        />

        <Flex gap={12} wrap="wrap">
          <Metric label="线路" value={totals.routes} />
          <Metric label="活跃 Key" value={totals.activeKeys} />
          <Metric label="总并发" value={totals.totalConcurrency} />
          <Metric label="当前占用" value={totals.currentConcurrency} />
        </Flex>

        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {rows.map((route) => (
            <Card
              key={route.routeKey}
              title={
                <Space wrap>
                  <Typography.Text strong>{route.displayName}</Typography.Text>
                  <Tag>{capabilityLabels[route.capability]}</Tag>
                  <QiuStatusTag tone={routeStatusTone(route.status)}>
                    {route.status === 'active' ? '启用' : '停用'}
                  </QiuStatusTag>
                </Space>
              }
              extra={
                <Button icon={<PlusOutlined />} onClick={() => setEditing({ mode: 'create', route })}>
                  添加 Key
                </Button>
              }
            >
              <Flex gap={12} wrap="wrap" style={{ marginBottom: 16 }}>
                <RouteMeta label="供应商" value={route.providerName} />
                <RouteMeta label="模型" value={route.modelName} />
                <RouteMeta label="点数" value={`${route.pointPrice}/次`} />
                <RouteMeta label="并发" value={`${route.currentConcurrency}/${route.totalMaxConcurrency}`} />
                <RouteMeta label="Key" value={`${route.activeKeyCount}/${route.apiKeys.length}`} />
              </Flex>
              <Table
                rowKey="id"
                size="small"
                columns={columns}
                dataSource={route.apiKeys}
                pagination={false}
                locale={{ emptyText: '还没有配置 API Key' }}
              />
            </Card>
          ))}
        </Space>

        <Modal
          title={editing?.mode === 'create' ? '添加官方 API Key' : '编辑官方 API Key'}
          open={Boolean(editing)}
          confirmLoading={saving}
          okText="保存"
          cancelText="取消"
          onCancel={() => setEditing(null)}
          onOk={() => form.submit()}
          destroyOnHidden
        >
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item label="线路">
              <Input value={editing?.route.displayName ?? ''} disabled />
            </Form.Item>
            <Form.Item label="名称" name="label">
              <Input placeholder="例如：图片线路一 · 主 key" />
            </Form.Item>
            <Form.Item
              label={editing?.mode === 'create' ? 'API Key' : '替换 API Key'}
              name="apiKey"
              rules={editing?.mode === 'create' ? [{ required: true, message: '请填写 API Key' }] : undefined}
            >
              <Input.Password placeholder={editing?.mode === 'create' ? '填写完整 API Key' : '留空则不修改'} />
            </Form.Item>
            <Form.Item label="状态" name="status">
              <Select options={statusOptions} />
            </Form.Item>
            <Flex gap={12}>
              <Form.Item label="并发上限" name="maxConcurrency" style={{ flex: 1 }}>
                <InputNumber min={1} max={1000} precision={0} style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item label="提交速率/分钟" name="rpmLimit" style={{ flex: 1 }}>
                <InputNumber min={0} max={10000} precision={0} style={{ width: '100%' }} placeholder="0 为不限制" />
              </Form.Item>
              <Form.Item label="排序" name="sortOrder" style={{ flex: 1 }}>
                <InputNumber min={0} max={100000} precision={0} style={{ width: '100%' }} />
              </Form.Item>
            </Flex>
          </Form>
        </Modal>
      </QiuPage>
    </AdminShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ minWidth: 140, border: '1px solid #d0d7de', borderRadius: 8, padding: '12px 14px' }}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {value}
      </Typography.Title>
    </div>
  );
}

function RouteMeta({ label, value }: { label: string; value: string }) {
  return (
    <Space size={4}>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <Typography.Text>{value}</Typography.Text>
    </Space>
  );
}
