'use client';

import {
  CloudSyncOutlined,
  DatabaseOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  ReloadOutlined,
  SaveOutlined,
  UploadOutlined
} from '@ant-design/icons';
import type {
  CurrentAccountResponse,
  EnterpriseKnowledgeBaseSummary,
  EnterpriseKnowledgeProfile,
  KnowledgeBaseVersionSummary
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';

export interface KnowledgePageClientProps {
  currentAccount: CurrentAccountResponse;
  knowledgeBase: EnterpriseKnowledgeBaseSummary;
  isApiFallback: boolean;
}

const maxPdfBytes = 15 * 1024 * 1024;

const profileFields: Array<{
  name: keyof EnterpriseKnowledgeProfile;
  label: string;
  placeholder: string;
  rows?: number;
}> = [
  { name: 'companyName', label: '企业名称', placeholder: '例如：杭州某某科技有限公司' },
  { name: 'industry', label: '行业', placeholder: '例如：跨境电商、医疗健康、教育培训' },
  { name: 'businessScope', label: '主营业务', placeholder: '企业主要做什么', rows: 3 },
  { name: 'productsAndServices', label: '产品/服务', placeholder: '核心产品、服务内容、交付方式', rows: 3 },
  { name: 'targetCustomers', label: '目标客户', placeholder: '客户类型、行业、地区、规模', rows: 3 },
  { name: 'customerPersona', label: '客户画像', placeholder: '典型客户痛点、决策人、关注点', rows: 3 },
  { name: 'salesGuidelines', label: '销售话术', placeholder: '常用表达、转化重点、沟通节奏', rows: 4 },
  { name: 'serviceBoundaries', label: '服务边界', placeholder: '能承诺什么，不能承诺什么', rows: 3 },
  { name: 'forbiddenClaims', label: '禁用表述', placeholder: '不能使用的宣传、承诺或敏感表达', rows: 3 },
  { name: 'commonQuestions', label: '常见问题', placeholder: '客户常问问题与标准回答', rows: 4 },
  { name: 'pricingAndDelivery', label: '价格/交付', placeholder: '报价方式、交付周期、付款规则', rows: 3 },
  { name: 'afterSalesPolicy', label: '售后政策', placeholder: '质保、退换、服务响应规则', rows: 3 },
  { name: 'contactInfo', label: '联系方式', placeholder: '对外联系信息或转接规则', rows: 2 },
  { name: 'notes', label: '补充说明', placeholder: '其他需要数字员工长期遵守的信息', rows: 3 }
];

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function versionTone(status: KnowledgeBaseVersionSummary['status']) {
  if (status === 'ready') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'processing') return 'processing';
  return 'default';
}

function versionStatusLabel(status: KnowledgeBaseVersionSummary['status']) {
  return {
    ready: '可用',
    failed: '失败',
    processing: '处理中',
    archived: '已归档'
  }[status];
}

export function KnowledgePageClient({
  currentAccount,
  knowledgeBase,
  isApiFallback
}: KnowledgePageClientProps) {
  const router = useRouter();
  const [form] = Form.useForm<EnterpriseKnowledgeProfile>();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [activatingVersionId, setActivatingVersionId] = useState('');
  const [downloadingVersionId, setDownloadingVersionId] = useState('');
  const activeWorkspace = currentAccount.workspaces.find(
    (workspace) => workspace.id === currentAccount.activeWorkspaceId
  ) ?? currentAccount.workspaces[0];
  const currentVersion = knowledgeBase.currentVersion;
  const hasProfile = Object.values(knowledgeBase.profile).some((value) => Boolean(value?.trim()));

  useEffect(() => {
    form.setFieldsValue(knowledgeBase.profile);
  }, [form, knowledgeBase.profile]);

  async function saveProfile(values: EnterpriseKnowledgeProfile) {
    if (isApiFallback) {
      message.warning('后端 API 未连接，无法保存企业知识库。');
      return;
    }

    setIsSavingProfile(true);
    try {
      await createBrowserApiClient().updateEnterpriseKnowledgeProfile(activeWorkspace.id, { profile: values });
      message.success('企业基础信息已保存');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function uploadPdf(file: File) {
    if (isApiFallback) {
      message.warning('后端 API 未连接，无法上传企业知识库。');
      return;
    }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      message.error('企业知识库只支持 PDF 文件。');
      return;
    }
    if (file.size > maxPdfBytes) {
      message.error(`PDF 不能超过 ${formatBytes(maxPdfBytes)}。`);
      return;
    }

    setIsUploadingPdf(true);
    try {
      const contentBase64 = await readFileAsBase64(file);
      await createBrowserApiClient().uploadEnterpriseKnowledgePdf(activeWorkspace.id, {
        fileName: file.name,
        contentBase64,
        activate: true
      });
      message.success('PDF 已上传并启用');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上传失败');
    } finally {
      setIsUploadingPdf(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  async function setKnowledgeEnabled(enabled: boolean) {
    if (isApiFallback) {
      message.warning('后端 API 未连接，无法修改状态。');
      return;
    }

    setIsTogglingStatus(true);
    try {
      await createBrowserApiClient().updateEnterpriseKnowledgeStatus(activeWorkspace.id, { enabled });
      message.success(enabled ? '企业知识库已启用' : '企业知识库已停用');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '状态更新失败');
    } finally {
      setIsTogglingStatus(false);
    }
  }

  async function activateVersion(versionId: string) {
    setActivatingVersionId(versionId);
    try {
      await createBrowserApiClient().activateEnterpriseKnowledgeVersion(activeWorkspace.id, versionId);
      message.success('知识库版本已启用');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '启用失败');
    } finally {
      setActivatingVersionId('');
    }
  }

  async function downloadVersion(version: KnowledgeBaseVersionSummary) {
    setDownloadingVersionId(version.id);
    try {
      const response = await createBrowserApiClient().getEnterpriseKnowledgeDocument(activeWorkspace.id, version.id);
      downloadBase64File(response.data.contentBase64, response.data.mimeType, response.data.fileName);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '下载失败');
    } finally {
      setDownloadingVersionId('');
    }
  }

  const versionColumns: ColumnsType<KnowledgeBaseVersionSummary> = [
    {
      title: '版本',
      dataIndex: 'versionNumber',
      render: (value: number, version) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>V{value} · {version.title}</Typography.Text>
          <Typography.Text type="secondary">{version.fileName}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: KnowledgeBaseVersionSummary['status'], version) => (
        <Space>
          <QiuStatusTag tone={versionTone(status)}>{versionStatusLabel(status)}</QiuStatusTag>
          {version.isEnabled ? <Tag color="green">当前启用</Tag> : null}
        </Space>
      )
    },
    {
      title: '大小',
      dataIndex: 'fileSizeBytes',
      responsive: ['md'],
      render: (value: number) => formatBytes(value)
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (value: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, version) => (
        <Space>
          <Button
            size="small"
            disabled={version.isEnabled || version.status !== 'ready'}
            loading={activatingVersionId === version.id}
            onClick={() => void activateVersion(version.id)}
          >
            启用
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={downloadingVersionId === version.id}
            onClick={() => void downloadVersion(version)}
          >
            下载
          </Button>
        </Space>
      )
    }
  ];

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title="企业知识库"
        description={`维护企业基础信息和一份启用中的完整 PDF 知识文档，并同步给已绑定 PC 设备 · ${activeWorkspace.name}`}
        actions={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => router.refresh()}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={isUploadingPdf}
              onClick={() => fileInputRef.current?.click()}
            >
              上传 PDF
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) {
                  void uploadPdf(file);
                }
              }}
            />
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {isApiFallback ? (
            <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" />
          ) : null}

          <Alert
            showIcon
            type="info"
            message="企业知识库不会强制参与每一次任务"
            description="这里维护的是企业共享知识资产。同步到 PC 设备后，数字员工和数字工厂在执行任务时会让用户选择是否启用知识库。"
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={8}>
              <Card bordered={false}>
                <Descriptions column={1} size="small" title="知识库状态">
                  <Descriptions.Item label="知识库">
                    <Space>
                      <DatabaseOutlined />
                      {knowledgeBase.name}
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label="启用状态">
                    <Switch
                      checked={knowledgeBase.status === 'active'}
                      checkedChildren="启用"
                      unCheckedChildren="停用"
                      loading={isTogglingStatus}
                      onChange={(checked) => void setKnowledgeEnabled(checked)}
                    />
                  </Descriptions.Item>
                  <Descriptions.Item label="基础信息">
                    {hasProfile ? <Tag color="green">已填写</Tag> : <Tag>未填写</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="PDF 版本">
                    {currentVersion ? <Tag color="green">V{currentVersion.versionNumber}</Tag> : <Tag>未上传</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="最近更新">
                    {formatDateTime(knowledgeBase.updatedAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="同步范围">
                    当前企业已绑定的 PC 设备
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col xs={24} lg={16}>
              <Card
                bordered={false}
                title={
                  <Space>
                    <FilePdfOutlined />
                    当前启用 PDF
                  </Space>
                }
              >
                {currentVersion ? (
                  <Descriptions column={1} size="small">
                    <Descriptions.Item label="标题">{currentVersion.title}</Descriptions.Item>
                    <Descriptions.Item label="文件名">{currentVersion.fileName}</Descriptions.Item>
                    <Descriptions.Item label="大小">{formatBytes(currentVersion.fileSizeBytes)}</Descriptions.Item>
                    <Descriptions.Item label="启用时间">{formatDateTime(currentVersion.activatedAt)}</Descriptions.Item>
                    <Descriptions.Item label="内容预览">
                      <Typography.Paragraph ellipsis={{ rows: 4 }} style={{ marginBottom: 0 }}>
                        {currentVersion.textPreview || currentVersion.summary}
                      </Typography.Paragraph>
                    </Descriptions.Item>
                  </Descriptions>
                ) : (
                  <Alert
                    showIcon
                    type="info"
                    message="尚未上传企业知识 PDF"
                    description="请上传一份完整的企业知识文档。后续更新时上传新版完整 PDF，并启用最新版本即可。"
                  />
                )}
              </Card>
            </Col>
          </Row>

          <Card
            bordered={false}
            title="企业基础信息"
            extra={
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={isSavingProfile}
                onClick={() => form.submit()}
              >
                保存
              </Button>
            }
          >
            <Form form={form} layout="vertical" onFinish={(values) => void saveProfile(values)}>
              <Row gutter={16}>
                {profileFields.map((field) => (
                  <Col key={field.name} xs={24} md={field.rows ? 12 : 8}>
                    <Form.Item name={field.name} label={field.label}>
                      {field.rows ? (
                        <Input.TextArea rows={field.rows} placeholder={field.placeholder} showCount maxLength={12000} />
                      ) : (
                        <Input placeholder={field.placeholder} maxLength={240} />
                      )}
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </Form>
          </Card>

          <Card
            bordered={false}
            title={
              <Space>
                <CloudSyncOutlined />
                PDF 版本
              </Space>
            }
          >
            <Table
              rowKey="id"
              columns={versionColumns}
              dataSource={knowledgeBase.versions}
              pagination={false}
              locale={{ emptyText: '尚未上传 PDF 版本' }}
            />
          </Card>
        </Space>
      </QiuPage>
    </ConsoleShell>
  );
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      const commaIndex = value.indexOf(',');
      resolve(commaIndex >= 0 ? value.slice(commaIndex + 1) : value);
    };
    reader.readAsDataURL(file);
  });
}

function downloadBase64File(contentBase64: string, mimeType: string, fileName: string) {
  const binary = window.atob(contentBase64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
