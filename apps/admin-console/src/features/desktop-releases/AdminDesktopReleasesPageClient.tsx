'use client';

import {
  CheckCircleOutlined,
  CloudDownloadOutlined,
  EditOutlined,
  InboxOutlined,
  PlusOutlined,
  UploadOutlined
} from '@ant-design/icons';
import type {
  CreateAdminDesktopReleaseRequest,
  CurrentAccountResponse,
  DesktopReleaseStatus,
  DesktopReleaseSummary,
  UpdateAdminDesktopReleaseRequest
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
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
import Switch from 'antd/es/switch';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import type { ChangeEvent } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminDesktopReleasesPageClientProps {
  currentAccount: CurrentAccountResponse;
  releases: DesktopReleaseSummary[];
}

type DesktopReleaseFormValues = {
  version: string;
  downloadUrl: string;
  releaseNotes?: string;
  checksumSha256?: string;
  fileSizeBytes?: number | null;
  forceUpdate?: boolean;
  minimumSupportedVersion?: string;
  status?: DesktopReleaseStatus;
};

function statusTone(status: DesktopReleaseStatus): 'default' | 'processing' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'warning';
  return 'processing';
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

function formatFileSize(value?: number) {
  if (value === undefined || value === null) {
    return '-';
  }

  if (value < 1024 * 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function normalizeCreatePayload(values: DesktopReleaseFormValues): CreateAdminDesktopReleaseRequest {
  return {
    version: values.version.trim(),
    downloadUrl: values.downloadUrl.trim(),
    releaseNotes: values.releaseNotes?.trim() || undefined,
    checksumSha256: values.checksumSha256?.trim() || undefined,
    fileSizeBytes: values.fileSizeBytes ?? undefined,
    forceUpdate: values.forceUpdate ?? false,
    minimumSupportedVersion: values.minimumSupportedVersion?.trim() || undefined,
    status: values.status ?? 'DRAFT'
  };
}

function normalizeUpdatePayload(values: DesktopReleaseFormValues): UpdateAdminDesktopReleaseRequest {
  return {
    version: values.version.trim(),
    downloadUrl: values.downloadUrl.trim(),
    releaseNotes: values.releaseNotes?.trim() || null,
    checksumSha256: values.checksumSha256?.trim() || null,
    fileSizeBytes: values.fileSizeBytes ?? null,
    forceUpdate: values.forceUpdate ?? false,
    minimumSupportedVersion: values.minimumSupportedVersion?.trim() || null,
    status: values.status ?? 'DRAFT'
  };
}

export function AdminDesktopReleasesPageClient({
  currentAccount,
  releases
}: AdminDesktopReleasesPageClientProps) {
  const [rows, setRows] = useState(releases);
  const [editingRelease, setEditingRelease] = useState<DesktopReleaseSummary | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionReleaseId, setActionReleaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form] = Form.useForm<DesktopReleaseFormValues>();

  useEffect(() => {
    setRows(releases);
  }, [releases]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((item) => item.status === 'PUBLISHED').length,
      draft: rows.filter((item) => item.status === 'DRAFT').length,
      archived: rows.filter((item) => item.status === 'ARCHIVED').length
    }),
    [rows]
  );

  function openCreateModal() {
    setEditingRelease(null);
    form.setFieldsValue({
      version: '',
      downloadUrl: '',
      releaseNotes: '',
      checksumSha256: '',
      fileSizeBytes: null,
      forceUpdate: false,
      minimumSupportedVersion: '',
      status: 'DRAFT'
    });
    setModalOpen(true);
  }

  function openEditModal(release: DesktopReleaseSummary) {
    setEditingRelease(release);
    form.setFieldsValue({
      version: release.version,
      downloadUrl: release.downloadUrl,
      releaseNotes: release.releaseNotes ?? '',
      checksumSha256: release.checksumSha256 ?? '',
      fileSizeBytes: release.fileSizeBytes ?? null,
      forceUpdate: release.forceUpdate,
      minimumSupportedVersion: release.minimumSupportedVersion ?? '',
      status: release.status
    });
    setModalOpen(true);
  }

  function replaceRow(release: DesktopReleaseSummary) {
    setRows((current) => {
      const exists = current.some((item) => item.id === release.id);
      if (!exists) {
        return [release, ...current];
      }

      return current.map((item) => (item.id === release.id ? release : item));
    });
  }

  async function handleSave(values: DesktopReleaseFormValues) {
    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const response = editingRelease
        ? await apiClient.updateAdminDesktopRelease(
            editingRelease.id,
            normalizeUpdatePayload(values)
          )
        : await apiClient.createAdminDesktopRelease(normalizeCreatePayload(values));

      replaceRow(response.data);
      message.success(editingRelease ? '版本已更新' : '版本已创建');
      setModalOpen(false);
      setEditingRelease(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleInstallerFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    setUploading(true);
    try {
      const response = await createBrowserApiClient().uploadAdminDesktopReleaseAsset(file);
      form.setFieldsValue({
        downloadUrl: response.data.downloadUrl,
        checksumSha256: response.data.checksumSha256,
        fileSizeBytes: response.data.fileSizeBytes
      });
      message.success(`安装包已上传：${response.data.originalFileName}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '安装包上传失败');
    } finally {
      setUploading(false);
    }
  }

  async function handlePublish(release: DesktopReleaseSummary) {
    setActionReleaseId(release.id);
    try {
      const response = await createBrowserApiClient().publishAdminDesktopRelease(release.id);
      replaceRow(response.data);
      message.success('版本已发布');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '发布失败');
    } finally {
      setActionReleaseId(null);
    }
  }

  async function handleArchive(release: DesktopReleaseSummary) {
    setActionReleaseId(release.id);
    try {
      const response = await createBrowserApiClient().archiveAdminDesktopRelease(release.id);
      replaceRow(response.data);
      message.success('版本已归档');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '归档失败');
    } finally {
      setActionReleaseId(null);
    }
  }

  const columns: ColumnsType<DesktopReleaseSummary> = [
    {
      title: '版本',
      dataIndex: 'version',
      width: 120,
      render: (value: string, release) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{release.platform}/{release.channel}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: DesktopReleaseStatus) => (
        <QiuStatusTag tone={statusTone(value)}>{value}</QiuStatusTag>
      )
    },
    {
      title: '安装包地址',
      dataIndex: 'downloadUrl',
      render: (value: string) => (
        <Typography.Text copyable ellipsis style={{ maxWidth: 460 }}>
          {value}
        </Typography.Text>
      )
    },
    {
      title: '大小',
      dataIndex: 'fileSizeBytes',
      width: 120,
      render: (value?: number) => formatFileSize(value)
    },
    {
      title: '强制',
      dataIndex: 'forceUpdate',
      width: 90,
      render: (value: boolean) => (value ? <Tag color="red">是</Tag> : <Tag>否</Tag>)
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      width: 170,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 260,
      render: (_value, release) => (
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => openEditModal(release)}>
            编辑
          </Button>
          {release.status === 'PUBLISHED' ? (
            <Popconfirm
              title="确认归档这个桌面版本？"
              okText="归档"
              cancelText="取消"
              onConfirm={() => handleArchive(release)}
            >
              <Button danger icon={<InboxOutlined />} loading={actionReleaseId === release.id}>
                归档
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={actionReleaseId === release.id}
              onClick={() => handlePublish(release)}
            >
              发布
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="桌面版本"
        description="维护 Windows 桌面端安装包版本，PC 客户端会从这里检查更新。"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
            新建版本
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message="第一版更新机制是提醒下载"
            description="可以直接上传 Windows 安装包，系统会自动生成下载地址、文件大小和 SHA256。PC 端会提示用户下载新版，安装时会保留本地数据、模型 Key 和任务历史。"
          />

          <Card bordered={false}>
            <Space size={32} wrap>
              <Typography.Text>总版本：{counts.total}</Typography.Text>
              <Typography.Text>已发布：{counts.published}</Typography.Text>
              <Typography.Text>草稿：{counts.draft}</Typography.Text>
              <Typography.Text>已归档：{counts.archived}</Typography.Text>
            </Space>
          </Card>

          <Card title="版本列表" bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 12 }}
              scroll={{ x: 1180 }}
              expandable={{
                expandedRowRender: (release) => (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">
                      最低支持版本：{release.minimumSupportedVersion ?? '-'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      SHA256：{release.checksumSha256 ?? '-'}
                    </Typography.Text>
                    <Typography.Paragraph style={{ margin: 0 }}>
                      {release.releaseNotes || '暂无发布说明'}
                    </Typography.Paragraph>
                  </Space>
                )
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Modal
        title={editingRelease ? `编辑版本 ${editingRelease.version}` : '新建桌面版本'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          setEditingRelease(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        okButtonProps={{ disabled: uploading }}
        width={760}
        okText="保存"
      >
        <Form layout="vertical" form={form} onFinish={handleSave}>
          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item
              name="version"
              label="版本号"
              rules={[{ required: true, message: '请输入版本号' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="1.0.1" />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 180 }}>
              <Select
                options={[
                  { value: 'DRAFT', label: 'DRAFT' },
                  { value: 'PUBLISHED', label: 'PUBLISHED' },
                  { value: 'ARCHIVED', label: 'ARCHIVED' }
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item label="上传安装包">
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Button
                  icon={<UploadOutlined />}
                  loading={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  选择 .exe/.msi/.zip
                </Button>
                <Typography.Text type="secondary">
                  上传成功后会自动回填下载地址、文件大小和 SHA256
                </Typography.Text>
              </Space>
              <input
                ref={fileInputRef}
                hidden
                type="file"
                accept=".exe,.msi,.zip"
                onChange={handleInstallerFileChange}
              />
            </Space>
          </Form.Item>

          <Form.Item
            name="downloadUrl"
            label="安装包下载地址"
            rules={[{ required: true, message: '请输入安装包下载地址' }]}
          >
            <Input prefix={<CloudDownloadOutlined />} placeholder="https://..." />
          </Form.Item>

          <Form.Item name="releaseNotes" label="发布说明">
            <Input.TextArea rows={4} placeholder="写给客户看的更新内容" />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item name="minimumSupportedVersion" label="最低支持版本" style={{ flex: 1 }}>
              <Input placeholder="1.0.0" />
            </Form.Item>
            <Form.Item name="fileSizeBytes" label="文件大小(byte)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="forceUpdate" label="强制更新" valuePropName="checked" style={{ width: 120 }}>
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item name="checksumSha256" label="SHA256 校验值">
            <Input placeholder="可选，后续用于安装包校验" />
          </Form.Item>
        </Form>
      </Modal>
    </AdminShell>
  );
}
