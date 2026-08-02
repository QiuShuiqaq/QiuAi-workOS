'use client';

import {
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined
} from '@ant-design/icons';
import type {
  CurrentAccountResponse,
  DesktopIssueCategory,
  DesktopIssueMessageSummary,
  DesktopIssueSeverity,
  DesktopIssueStatus,
  ListAdminIssueMessagesQuery,
  PaginationMeta
} from '@qiuai/api-contract';
import { QiuPage } from '@qiuai/ui';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
import Flex from 'antd/es/flex';
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminIssueMessagesPageClientProps {
  currentAccount: CurrentAccountResponse;
  issueMessages: DesktopIssueMessageSummary[];
  pagination: PaginationMeta;
}

const statusOptions: Array<{ value: DesktopIssueStatus; label: string }> = [
  { value: 'NEW', label: '新问题' },
  { value: 'VIEWED', label: '已查看' },
  { value: 'IN_PROGRESS', label: '处理中' },
  { value: 'FIXED', label: '已修复' },
  { value: 'WONT_FIX', label: '不处理' },
  { value: 'CLOSED', label: '已关闭' }
];

const categoryOptions: Array<{ value: DesktopIssueCategory; label: string }> = [
  { value: 'BUG', label: 'Bug' },
  { value: 'USAGE', label: '使用问题' },
  { value: 'FEATURE_REQUEST', label: '功能建议' },
  { value: 'BAD_OUTPUT', label: '结果不好' },
  { value: 'OTHER', label: '其他' }
];

const severityOptions: Array<{ value: DesktopIssueSeverity; label: string }> = [
  { value: 'NORMAL', label: '普通' },
  { value: 'IMPACTING', label: '影响工作' },
  { value: 'BLOCKING', label: '阻塞使用' }
];

export function AdminIssueMessagesPageClient({
  currentAccount,
  issueMessages,
  pagination
}: AdminIssueMessagesPageClientProps) {
  const [rows, setRows] = useState(issueMessages);
  const [pageMeta, setPageMeta] = useState(pagination);
  const [filters, setFilters] = useState<ListAdminIssueMessagesQuery>({
    page: pagination.page,
    pageSize: pagination.pageSize
  });
  const [loading, setLoading] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<DesktopIssueMessageSummary | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [actionId, setActionId] = useState('');

  const counts = useMemo(
    () => ({
      newCount: rows.filter((item) => item.status === 'NEW').length,
      blocking: rows.filter((item) => item.severity === 'BLOCKING').length,
      badOutput: rows.filter((item) => item.category === 'BAD_OUTPUT').length
    }),
    [rows]
  );

  async function loadRows(nextFilters: ListAdminIssueMessagesQuery = filters) {
    setLoading(true);
    try {
      const response = await createBrowserApiClient().listAdminIssueMessages(nextFilters);
      setRows(response.data);
      setPageMeta(response.pagination);
      setFilters(nextFilters);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '加载问题消息失败');
    } finally {
      setLoading(false);
    }
  }

  function openDetail(issue: DesktopIssueMessageSummary) {
    setSelectedIssue(issue);
    setAdminNote(issue.adminNote ?? '');
  }

  function replaceIssue(issue: DesktopIssueMessageSummary) {
    setRows((current) => current.map((item) => (item.id === issue.id ? issue : item)));
    setSelectedIssue((current) => (current?.id === issue.id ? issue : current));
    setAdminNote(issue.adminNote ?? '');
  }

  async function updateIssue(issue: DesktopIssueMessageSummary, input: { status?: DesktopIssueStatus; adminNote?: string | null }) {
    setActionId(issue.id);
    try {
      const response = await createBrowserApiClient().updateAdminIssueMessage(issue.id, input);
      replaceIssue(response.data);
      message.success('问题消息已更新');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '更新问题消息失败');
    } finally {
      setActionId('');
    }
  }

  async function deleteIssue(issue: DesktopIssueMessageSummary) {
    setActionId(issue.id);
    try {
      await createBrowserApiClient().deleteAdminIssueMessage(issue.id);
      setRows((current) => current.filter((item) => item.id !== issue.id));
      if (selectedIssue?.id === issue.id) {
        setSelectedIssue(null);
      }
      message.success('问题消息已删除');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '删除问题消息失败');
    } finally {
      setActionId('');
    }
  }

  const columns: ColumnsType<DesktopIssueMessageSummary> = [
    {
      title: '编号',
      dataIndex: 'issueNo',
      width: 170,
      render: (value: string, issue) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{value}</Typography.Text>
          <Typography.Text type="secondary">{formatDateTime(issue.createdAt)}</Typography.Text>
        </Space>
      )
    },
    {
      title: '问题',
      dataIndex: 'title',
      render: (value: string, issue) => (
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Typography.Text strong ellipsis>{value}</Typography.Text>
          <Typography.Text type="secondary" ellipsis>{issue.description}</Typography.Text>
          <Space size={6} wrap>
            <Tag>{categoryLabel(issue.category)}</Tag>
            <Tag color={severityColor(issue.severity)}>{severityLabel(issue.severity)}</Tag>
          </Space>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (value: DesktopIssueStatus) => (
        <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>
      )
    },
    {
      title: '设备',
      key: 'device',
      width: 220,
      render: (_value, issue) => (
        <Space direction="vertical" size={2}>
          <Typography.Text ellipsis>{issue.workspaceName ?? issue.workspaceId ?? '未绑定企业'}</Typography.Text>
          <Typography.Text type="secondary" ellipsis>
            {issue.deviceName ?? issue.deviceId ?? '-'} · {issue.appVersion ?? '-'}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_value, issue) => (
        <Space wrap>
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(issue)}>
            查看
          </Button>
          <Popconfirm
            title="确认删除这条问题消息？"
            okText="删除"
            cancelText="取消"
            onConfirm={() => deleteIssue(issue)}
          >
            <Button size="small" danger icon={<DeleteOutlined />} loading={actionId === issue.id}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="问题消息"
        description="查看 PC 桌面端用户提交的问题、Bug 和结果质量反馈。"
        actions={
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => loadRows()}>
            刷新
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(160px, 1fr))', gap: 12 }}>
            <Card bordered={false}>
              <Typography.Text type="secondary">当前页问题</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{rows.length}</Typography.Title>
            </Card>
            <Card bordered={false}>
              <Typography.Text type="secondary">新问题</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{counts.newCount}</Typography.Title>
            </Card>
            <Card bordered={false}>
              <Typography.Text type="secondary">阻塞使用</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{counts.blocking}</Typography.Title>
            </Card>
            <Card bordered={false}>
              <Typography.Text type="secondary">结果质量</Typography.Text>
              <Typography.Title level={3} style={{ margin: 0 }}>{counts.badOutput}</Typography.Title>
            </Card>
          </div>

          <Card bordered={false}>
            <Flex align="center" gap={12} wrap="wrap">
              <Input.Search
                allowClear
                placeholder="搜索编号、标题、描述、设备或企业"
                style={{ width: 320 }}
                onSearch={(value) =>
                  loadRows({
                    ...filters,
                    page: 1,
                    query: value.trim() || undefined
                  })
                }
              />
              <Select
                allowClear
                placeholder="状态"
                style={{ width: 140 }}
                options={statusOptions}
                value={filters.status}
                onChange={(value) => loadRows({ ...filters, page: 1, status: value })}
              />
              <Select
                allowClear
                placeholder="分类"
                style={{ width: 150 }}
                options={categoryOptions}
                value={filters.category}
                onChange={(value) => loadRows({ ...filters, page: 1, category: value })}
              />
              <Select
                allowClear
                placeholder="严重程度"
                style={{ width: 150 }}
                options={severityOptions}
                value={filters.severity}
                onChange={(value) => loadRows({ ...filters, page: 1, severity: value })}
              />
            </Flex>
          </Card>

          <Card bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              loading={loading}
              scroll={{ x: 980 }}
              pagination={{
                current: pageMeta.page,
                pageSize: pageMeta.pageSize,
                total: pageMeta.totalItems,
                showSizeChanger: true
              }}
              onChange={(nextPagination: TablePaginationConfig) => {
                loadRows({
                  ...filters,
                  page: nextPagination.current ?? 1,
                  pageSize: nextPagination.pageSize ?? filters.pageSize ?? 20
                });
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Drawer
        title={selectedIssue ? `${selectedIssue.issueNo} · ${selectedIssue.title}` : '问题详情'}
        open={Boolean(selectedIssue)}
        width={760}
        onClose={() => setSelectedIssue(null)}
        destroyOnHidden
      >
        {selectedIssue ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Space wrap>
              <Tag color={statusColor(selectedIssue.status)}>{statusLabel(selectedIssue.status)}</Tag>
              <Tag>{categoryLabel(selectedIssue.category)}</Tag>
              <Tag color={severityColor(selectedIssue.severity)}>{severityLabel(selectedIssue.severity)}</Tag>
            </Space>

            <Card title="用户描述" bordered={false}>
              <Typography.Paragraph>{selectedIssue.description}</Typography.Paragraph>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="联系方式">{selectedIssue.contact ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="提交时间">{formatDateTime(selectedIssue.createdAt)}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="设备上下文" bordered={false}>
              <Descriptions column={1} size="small" bordered>
                <Descriptions.Item label="企业">{selectedIssue.workspaceName ?? selectedIssue.workspaceId ?? '未绑定企业'}</Descriptions.Item>
                <Descriptions.Item label="设备">{selectedIssue.deviceName ?? selectedIssue.deviceId ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="运行 ID">{selectedIssue.runtimeId ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="客户端版本">{selectedIssue.appVersion ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="平台">{selectedIssue.platform ?? '-'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="处理" bordered={false}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Select
                  value={selectedIssue.status}
                  options={statusOptions}
                  style={{ width: 180 }}
                  onChange={(status) => updateIssue(selectedIssue, { status })}
                />
                <Input.TextArea
                  rows={4}
                  value={adminNote}
                  maxLength={2000}
                  showCount
                  placeholder="内部备注，仅 admin-console 可见"
                  onChange={(event) => setAdminNote(event.currentTarget.value)}
                />
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={actionId === selectedIssue.id}
                  onClick={() => updateIssue(selectedIssue, { adminNote: adminNote.trim() || null })}
                >
                  保存备注
                </Button>
              </Space>
            </Card>

            <Card title="诊断信息" bordered={false}>
              {selectedIssue.diagnostics ? (
                <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
                  {JSON.stringify(selectedIssue.diagnostics, null, 2)}
                </pre>
              ) : (
                <Typography.Text type="secondary">暂无诊断信息</Typography.Text>
              )}
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </AdminShell>
  );
}

function statusLabel(status: DesktopIssueStatus): string {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

function categoryLabel(category: DesktopIssueCategory): string {
  return categoryOptions.find((item) => item.value === category)?.label ?? category;
}

function severityLabel(severity: DesktopIssueSeverity): string {
  return severityOptions.find((item) => item.value === severity)?.label ?? severity;
}

function statusColor(status: DesktopIssueStatus): string {
  if (status === 'NEW') return 'red';
  if (status === 'IN_PROGRESS') return 'blue';
  if (status === 'FIXED') return 'green';
  if (status === 'WONT_FIX') return 'orange';
  if (status === 'CLOSED') return 'default';
  return 'geekblue';
}

function severityColor(severity: DesktopIssueSeverity): string {
  if (severity === 'BLOCKING') return 'red';
  if (severity === 'IMPACTING') return 'orange';
  return 'default';
}

function formatDateTime(value?: string): string {
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
