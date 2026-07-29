'use client';

import type {
  AssetDefinitionDetail,
  AssetDefinitionStatus,
  AssetDefinitionType,
  CreateAdminAssetDefinitionRequest,
  CurrentAccountResponse,
  UpdateAdminAssetDefinitionRequest
} from '@qiuai/api-contract';
import { QiuPage } from '@qiuai/ui';
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined
} from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tabs from 'antd/es/tabs';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminAssetsPageClientProps {
  currentAccount: CurrentAccountResponse;
  assets: AssetDefinitionDetail[];
}

type AssetFormValues = {
  type: AssetDefinitionType;
  key: string;
  name: string;
  description?: string;
  category: string;
  status: AssetDefinitionStatus;
  scope: 'SYSTEM' | 'CUSTOM';
  version: string;
  tagsText?: string;
  sortOrder: number;
  schemaText: string;
  defaultsText: string;
};

const assetTabs: Array<{
  type: AssetDefinitionType;
  label: string;
  description: string;
}> = [
  {
    type: 'VARIABLE',
    label: '变量库',
    description: '统一管理工作画布里的输入、输出和中间变量。'
  },
  {
    type: 'MODEL',
    label: '模型库',
    description: '管理模型能力定义，API Key 仍由 PC 端配置。'
  },
  {
    type: 'TOOL',
    label: '工具库',
    description: '管理 PC 端可执行的具体工具动作和输入输出。'
  },
  {
    type: 'ARTIFACT_TEMPLATE',
    label: '产物模板库',
    description: '定义 Word、Excel、Markdown、PDF 等交付格式。'
  },
  {
    type: 'NODE_TEMPLATE',
    label: '节点模板库',
    description: '沉淀常用节点配置，减少重复搭建工作。'
  }
];

const assetTypeLabels: Record<AssetDefinitionType, string> = Object.fromEntries(
  assetTabs.map((tab) => [tab.type, tab.label])
) as Record<AssetDefinitionType, string>;

const statusOptions = [
  { label: '启用', value: 'ACTIVE' },
  { label: '停用', value: 'DISABLED' },
  { label: '归档', value: 'ARCHIVED' }
] as const;

const scopeOptions = [
  { label: '系统内置', value: 'SYSTEM' },
  { label: '自定义', value: 'CUSTOM' }
] as const;

function statusColor(status: AssetDefinitionStatus) {
  if (status === 'ACTIVE') return 'green';
  if (status === 'DISABLED') return 'orange';
  return 'default';
}

function formatJson(value: Record<string, unknown>) {
  return JSON.stringify(value ?? {}, null, 2);
}

function parseJsonObject(value: string, label: string): Record<string, unknown> {
  const text = value.trim();
  if (!text) {
    return {};
  }

  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${label} 必须是 JSON 对象`);
  }
  return parsed as Record<string, unknown>;
}

function tagsFromText(value?: string): string[] {
  return [...new Set((value ?? '').split(/[,\n，]/).map((item) => item.trim()).filter(Boolean))];
}

function assetToFormValues(asset: AssetDefinitionDetail): AssetFormValues {
  return {
    type: asset.type,
    key: asset.key,
    name: asset.name,
    description: asset.description,
    category: asset.category,
    status: asset.status,
    scope: asset.scope,
    version: asset.version,
    tagsText: asset.tags.join(', '),
    sortOrder: asset.sortOrder,
    schemaText: formatJson(asset.schema),
    defaultsText: formatJson(asset.defaults)
  };
}

function defaultFormValues(type: AssetDefinitionType): AssetFormValues {
  return {
    type,
    key: '',
    name: '',
    description: '',
    category: '',
    status: 'ACTIVE',
    scope: 'CUSTOM',
    version: '1.0.0',
    tagsText: '',
    sortOrder: 1000,
    schemaText: '{}',
    defaultsText: '{}'
  };
}

export function AdminAssetsPageClient({ currentAccount, assets }: AdminAssetsPageClientProps) {
  const [rows, setRows] = useState(assets);
  const [activeType, setActiveType] = useState<AssetDefinitionType>('VARIABLE');
  const [query, setQuery] = useState('');
  const [editingAsset, setEditingAsset] = useState<AssetDefinitionDetail | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialValues, setCreateInitialValues] = useState<AssetFormValues | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<AssetFormValues>();

  useEffect(() => {
    setRows(assets);
  }, [assets]);

  useEffect(() => {
    if (editingAsset) {
      form.setFieldsValue(assetToFormValues(editingAsset));
      return;
    }

    if (isCreateOpen) {
      form.setFieldsValue(createInitialValues ?? defaultFormValues(activeType));
      return;
    }

    form.resetFields();
  }, [activeType, createInitialValues, editingAsset, form, isCreateOpen]);

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase();
    return rows
      .filter((asset) => asset.type === activeType)
      .filter((asset) => {
        if (!search) return true;
        return [asset.key, asset.name, asset.description, asset.category, asset.tags.join(' ')]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  }, [activeType, query, rows]);

  const activeTab = assetTabs.find((tab) => tab.type === activeType) ?? assetTabs[0];

  async function handleSave(values: AssetFormValues) {
    setSaving(true);
    try {
      const payload = toAssetPayload(values);
      const apiClient = createBrowserApiClient();

      if (editingAsset) {
        const response = await apiClient.updateAdminAsset(editingAsset.id, payload);
        setRows((current) => current.map((asset) => (asset.id === editingAsset.id ? response.data : asset)));
        message.success('资产已更新');
      } else {
        const response = await apiClient.createAdminAsset({
          type: values.type,
          ...payload
        });
        setRows((current) => [response.data, ...current]);
        message.success('资产已创建');
      }

      setEditingAsset(null);
      setIsCreateOpen(false);
      setCreateInitialValues(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '保存失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(asset: AssetDefinitionDetail) {
    try {
      await createBrowserApiClient().deleteAdminAsset(asset.id);
      setRows((current) => current.filter((item) => item.id !== asset.id));
      message.success('资产已删除');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '删除失败';
      message.error(errorMessage);
    }
  }

  function handleDuplicate(asset: AssetDefinitionDetail) {
    setEditingAsset(null);
    setActiveType(asset.type);
    setCreateInitialValues({
      ...assetToFormValues(asset),
      key: `${asset.key}-copy`,
      name: `${asset.name} 副本`,
      scope: 'CUSTOM'
    });
    setIsCreateOpen(true);
  }

  const columns: ColumnsType<AssetDefinitionDetail> = [
    {
      title: '资产',
      key: 'asset',
      render: (_value, asset) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{asset.name}</Typography.Text>
          <Typography.Text type="secondary">{asset.key}</Typography.Text>
        </Space>
      )
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 120,
      render: (value: string) => <Tag>{value}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: AssetDefinitionStatus) => <Tag color={statusColor(value)}>{value}</Tag>
    },
    {
      title: '来源',
      dataIndex: 'scope',
      width: 110,
      render: (value: string) => <Tag color={value === 'SYSTEM' ? 'blue' : 'purple'}>{value}</Tag>
    },
    {
      title: '标签',
      key: 'tags',
      render: (_value, asset) => (
        <Space size={[4, 4]} wrap>
          {asset.tags.slice(0, 4).map((tag) => (
            <Tag key={`${asset.id}-${tag}`}>{tag}</Tag>
          ))}
        </Space>
      )
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      width: 160,
      render: (value: string) => new Date(value).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_value, asset) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => setEditingAsset(asset)}>
            编辑
          </Button>
          <Button icon={<CopyOutlined />} onClick={() => handleDuplicate(asset)}>
            复制
          </Button>
          <Popconfirm title="确认删除这个资产？" onConfirm={() => handleDelete(asset)}>
            <Button danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="资产中心"
        description="统一管理变量、模型、工具、产物模板和节点模板，后续工作画布优先引用这里的标准资产。"
        actions={
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => {
              setCreateInitialValues(null);
              setIsCreateOpen(true);
            }}
          >
            新建资产
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message="资产中心是工作画布的新标准源头"
            description="新链路会优先使用资产定义；旧的手写变量、工具推断和模型推断只作为迁移来源。当前先完成五类资产的标准化管理。"
          />

          <Card bordered={false}>
            <Space size={24} wrap>
              <Typography.Text>全部资产：{rows.length}</Typography.Text>
              <Typography.Text>启用：{rows.filter((asset) => asset.status === 'ACTIVE').length}</Typography.Text>
              <Typography.Text>系统内置：{rows.filter((asset) => asset.scope === 'SYSTEM').length}</Typography.Text>
              <Typography.Text>自定义：{rows.filter((asset) => asset.scope === 'CUSTOM').length}</Typography.Text>
            </Space>
          </Card>

          <Card bordered={false}>
            <Tabs
              activeKey={activeType}
              onChange={(key) => setActiveType(key as AssetDefinitionType)}
              items={assetTabs.map((tab) => ({
                key: tab.type,
                label: `${tab.label} ${rows.filter((asset) => asset.type === tab.type).length}`
              }))}
            />

            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
                <Typography.Text type="secondary">{activeTab.description}</Typography.Text>
                <Input.Search
                  allowClear
                  placeholder={`搜索${activeTab.label}`}
                  style={{ width: 280 }}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </Space>

              <Table
                rowKey="id"
                columns={columns}
                dataSource={filteredRows}
                pagination={{ pageSize: 10 }}
              />
            </Space>
          </Card>
        </Space>

        <Modal
          title={editingAsset ? `编辑${assetTypeLabels[editingAsset.type]}` : `新建${assetTypeLabels[activeType]}`}
          open={isCreateOpen || Boolean(editingAsset)}
          width={860}
          okText="保存"
          cancelText="取消"
          confirmLoading={saving}
          onCancel={() => {
            setEditingAsset(null);
            setIsCreateOpen(false);
            setCreateInitialValues(null);
          }}
          onOk={() => form.submit()}
          destroyOnHidden
        >
          <Form<AssetFormValues> form={form} layout="vertical" onFinish={handleSave}>
            <Space size={12} style={{ width: '100%' }} align="start">
              <Form.Item name="type" label="资产类型" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select
                  disabled={Boolean(editingAsset)}
                  options={assetTabs.map((tab) => ({ label: tab.label, value: tab.type }))}
                />
              </Form.Item>
              <Form.Item name="status" label="状态" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select options={[...statusOptions]} />
              </Form.Item>
              <Form.Item name="scope" label="来源" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Select options={[...scopeOptions]} />
              </Form.Item>
            </Space>

            <Space size={12} style={{ width: '100%' }} align="start">
              <Form.Item name="key" label="资产 Key" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Input placeholder="final_content" />
              </Form.Item>
              <Form.Item name="name" label="名称" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Input placeholder="最终正文" />
              </Form.Item>
            </Space>

            <Space size={12} style={{ width: '100%' }} align="start">
              <Form.Item name="category" label="分类" rules={[{ required: true }]} style={{ flex: 1 }}>
                <Input placeholder="document" />
              </Form.Item>
              <Form.Item name="version" label="版本" rules={[{ required: true }]} style={{ width: 160 }}>
                <Input placeholder="1.0.0" />
              </Form.Item>
              <Form.Item name="sortOrder" label="排序" style={{ width: 140 }}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Space>

            <Form.Item name="description" label="说明">
              <Input.TextArea rows={2} placeholder="这个资产解决什么问题，什么时候使用。" />
            </Form.Item>

            <Form.Item name="tagsText" label="标签">
              <Input placeholder="document, text, artifact" />
            </Form.Item>

            <Space size={12} style={{ width: '100%' }} align="start">
              <Form.Item
                name="schemaText"
                label="结构定义 JSON"
                style={{ flex: 1 }}
                rules={[{ required: true }, { validator: validateJsonObject('结构定义 JSON') }]}
              >
                <Input.TextArea rows={12} spellCheck={false} />
              </Form.Item>
              <Form.Item
                name="defaultsText"
                label="默认值 JSON"
                style={{ flex: 1 }}
                rules={[{ required: true }, { validator: validateJsonObject('默认值 JSON') }]}
              >
                <Input.TextArea rows={12} spellCheck={false} />
              </Form.Item>
            </Space>
          </Form>
        </Modal>
      </QiuPage>
    </AdminShell>
  );
}

function validateJsonObject(label: string) {
  return async (_rule: unknown, value: string) => {
    parseJsonObject(value ?? '{}', label);
  };
}

function toAssetPayload(
  values: AssetFormValues
): UpdateAdminAssetDefinitionRequest & Omit<CreateAdminAssetDefinitionRequest, 'type'> {
  return {
    key: values.key.trim(),
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    category: values.category.trim(),
    status: values.status,
    scope: values.scope,
    version: values.version.trim() || '1.0.0',
    schema: parseJsonObject(values.schemaText, '结构定义 JSON'),
    defaults: parseJsonObject(values.defaultsText, '默认值 JSON'),
    tags: tagsFromText(values.tagsText),
    sortOrder: values.sortOrder ?? 1000
  };
}
