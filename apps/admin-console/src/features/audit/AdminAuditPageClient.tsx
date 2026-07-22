'use client';

import type { AdminActionLogSummary, CurrentAccountResponse, PaginationMeta } from '@qiuai/api-contract';
import { EyeOutlined, HistoryOutlined } from '@ant-design/icons';
import { QiuPage } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminAuditPageClientProps {
  currentAccount: CurrentAccountResponse;
  actionLogs: AdminActionLogSummary[];
  pagination: PaginationMeta;
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
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function prettyJson(value?: Record<string, unknown>) {
  if (!value || Object.keys(value).length === 0) {
    return '-';
  }

  return JSON.stringify(value, null, 2);
}

export function AdminAuditPageClient({
  currentAccount,
  actionLogs,
  pagination
}: AdminAuditPageClientProps) {
  const [rows, setRows] = useState(actionLogs);
  const [paginationMeta, setPaginationMeta] = useState(pagination);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<string | undefined>();
  const [targetType, setTargetType] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AdminActionLogSummary | null>(null);

  const actionOptions = useMemo(
    () => [
      { value: 'CREATE_WORKSPACE', label: '创建企业' },
      { value: 'CREATE_WORKSPACE_INVITATION', label: '创建企业邀请' },
      { value: 'CANCEL_WORKSPACE_INVITATION', label: '取消企业邀请' },
      { value: 'CREATE_DESKTOP_BINDING_CODE', label: '创建桌面绑定码' },
      { value: 'REVOKE_DESKTOP_DEVICE', label: '撤销桌面设备' },
      { value: 'UPDATE_PLAN', label: '更新套餐' },
      { value: 'UPDATE_WORKSPACE_STATUS', label: '更新企业状态' },
      { value: 'MANUAL_AUTHORIZE_WORKSPACE', label: '手动授权企业' }
    ],
    []
  );

  const targetTypeOptions = useMemo(
    () => [
      { value: 'plan', label: '套餐' },
      { value: 'workspace', label: '企业' },
      { value: 'billing_account', label: '账务' },
      { value: 'desktop_device', label: '桌面设备' }
    ],
    []
  );

  async function loadActionLogs(
    nextPage = paginationMeta.page,
    nextPageSize = paginationMeta.pageSize,
    nextQuery = query,
    nextAction = action,
    nextTargetType = targetType
  ) {
    setLoading(true);
    try {
      const response = await createBrowserApiClient().listAdminActionLogs({
        page: nextPage,
        pageSize: nextPageSize,
        query: nextQuery || undefined,
        action: nextAction || undefined,
        targetType: nextTargetType || undefined
      });
      setRows(response.data);
      setPaginationMeta(response.pagination);
      setQuery(nextQuery);
      setAction(nextAction);
      setTargetType(nextTargetType);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载审计日志失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  const columns: ColumnsType<AdminActionLogSummary> = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      render: (value) => formatDateTime(value)
    },
    {
      title: '动作',
      dataIndex: 'action',
      responsive: ['lg']
    },
    {
      title: '目标',
      key: 'target',
      render: (_value, log) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{log.targetType}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {log.targetId}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: '操作者',
      key: 'operator',
      render: (_value, log) => log.operatorEmail ?? log.operatorAccountId ?? '-'
    },
    {
      title: '摘要',
      dataIndex: 'summary'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, log) => (
        <Button icon={<EyeOutlined />} onClick={() => setSelectedLog(log)}>
          详情
        </Button>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="审计日志"
        description="查看管理员对套餐、企业状态和授权动作的历史记录。"
        actions={
          <Button icon={<HistoryOutlined />} onClick={() => void loadActionLogs()}>
            刷新
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message="这里记录的是可追踪的管理操作"
            description="你做的套餐调整、企业停用/恢复、手动授权都会出现在这里。"
          />

          <Card bordered={false}>
            <Space wrap size={12} style={{ width: '100%' }}>
              <Input.Search
                allowClear
                placeholder="搜索动作、摘要、目标 ID 或操作者邮箱"
                enterButton="搜索"
                onSearch={(value) => void loadActionLogs(1, paginationMeta.pageSize, value)}
                style={{ width: 360 }}
              />
              <Select
                allowClear
                placeholder="动作"
                value={action}
                options={actionOptions}
                style={{ width: 220 }}
                onChange={(value) => void loadActionLogs(1, paginationMeta.pageSize, query, value, targetType)}
              />
              <Select
                allowClear
                placeholder="目标类型"
                value={targetType}
                options={targetTypeOptions}
                style={{ width: 180 }}
                onChange={(value) => void loadActionLogs(1, paginationMeta.pageSize, query, action, value)}
              />
            </Space>
          </Card>

          <Card bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              loading={loading}
              pagination={{
                current: paginationMeta.page,
                pageSize: paginationMeta.pageSize,
                total: paginationMeta.totalItems,
                showSizeChanger: true
              }}
              onChange={(nextPagination) => {
                void loadActionLogs(
                  nextPagination.current ?? paginationMeta.page,
                  nextPagination.pageSize ?? paginationMeta.pageSize
                );
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Drawer
        title={selectedLog ? selectedLog.summary : '审计详情'}
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        width={720}
      >
        {selectedLog ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="时间">{formatDateTime(selectedLog.createdAt)}</Descriptions.Item>
              <Descriptions.Item label="动作">{selectedLog.action}</Descriptions.Item>
              <Descriptions.Item label="目标类型">{selectedLog.targetType}</Descriptions.Item>
              <Descriptions.Item label="目标 ID">{selectedLog.targetId}</Descriptions.Item>
              <Descriptions.Item label="操作者">
                {selectedLog.operatorEmail ?? selectedLog.operatorAccountId ?? '-'}
              </Descriptions.Item>
            </Descriptions>

            <Card size="small" title="摘要">
              <Typography.Paragraph style={{ marginBottom: 0 }}>
                {selectedLog.summary}
              </Typography.Paragraph>
            </Card>

            <Card size="small" title="元数据">
              <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }} copyable>
                {prettyJson(selectedLog.metadata)}
              </Typography.Paragraph>
            </Card>
          </Space>
        ) : null}
      </Drawer>
    </AdminShell>
  );
}
