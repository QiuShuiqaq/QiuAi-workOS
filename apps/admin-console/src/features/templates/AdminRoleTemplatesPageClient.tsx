'use client';

import {
  CheckCircleOutlined,
  EditOutlined,
  InboxOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import type {
  AdminPlanDetail,
  AdminRoleTemplateDetail,
  AdminRoleTemplateTestGraphTrace,
  AdminWorkspaceSummary,
  CurrentAccountResponse
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Popconfirm from 'antd/es/popconfirm';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminRoleTemplatesPageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
}

type TemplateTestNotice = {
  templateName: string;
  valid: boolean;
  status: 'passed' | 'failed';
  message: string;
  warnings: string[];
  sampleInput?: string;
  graphTrace?: AdminRoleTemplateTestGraphTrace;
};

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

function statusTone(status: string): 'default' | 'processing' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'warning';
  if (status === 'DRAFT') return 'processing';
  return 'default';
}

export function AdminRoleTemplatesPageClient({
  currentAccount,
  templates,
  plans,
  workspaces
}: AdminRoleTemplatesPageClientProps) {
  const [rows, setRows] = useState(templates);
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);
  const [actionTemplateId, setActionTemplateId] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<TemplateTestNotice | null>(null);

  useEffect(() => {
    setRows(templates);
  }, [templates]);

  const planNameByCode = useMemo(
    () => new Map(plans.map((plan) => [plan.code, plan.name] as const)),
    [plans]
  );

  const workspaceNameById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name] as const)),
    [workspaces]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((item) => item.status === 'PUBLISHED').length,
      draft: rows.filter((item) => item.status === 'DRAFT').length,
      archived: rows.filter((item) => item.status === 'ARCHIVED').length
    }),
    [rows]
  );

  function replaceRow(template: AdminRoleTemplateDetail) {
    setRows((current) => current.map((item) => (item.id === template.id ? template : item)));
  }

  async function handleTest(template: AdminRoleTemplateDetail) {
    setTestingTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().testAdminRoleTemplate(template.id, {
        sampleInput: template.sampleInputs[0] ?? template.businessGoal
      });
      setTestNotice({
        templateName: template.name,
        ...response.data
      });
      message.success(response.data.valid ? '测试通过' : '测试未通过');
      replaceRow({
        ...template,
        lastTestedAt: new Date().toISOString()
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '测试失败');
    } finally {
      setTestingTemplateId(null);
    }
  }

  async function handlePublish(template: AdminRoleTemplateDetail) {
    setActionTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().publishAdminRoleTemplate(template.id);
      replaceRow(response.data);
      message.success('已上架');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '上架失败');
    } finally {
      setActionTemplateId(null);
    }
  }

  async function handleArchive(template: AdminRoleTemplateDetail) {
    setActionTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().archiveAdminRoleTemplate(template.id);
      replaceRow(response.data);
      message.success('已下架');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '下架失败');
    } finally {
      setActionTemplateId(null);
    }
  }

  function renderPlans(values: string[]) {
    if (values.length === 0) {
      return <Typography.Text type="secondary">未限定套餐</Typography.Text>;
    }

    return (
      <Space size={[4, 4]} wrap>
        {values.slice(0, 3).map((code) => (
          <Tag key={code}>{planNameByCode.get(code) ?? code}</Tag>
        ))}
        {values.length > 3 ? <Tag>+{values.length - 3}</Tag> : null}
      </Space>
    );
  }

  function renderWorkspaces(values: string[]) {
    if (values.length === 0) {
      return <Typography.Text type="secondary">所有企业可见</Typography.Text>;
    }

    return (
      <Space size={[4, 4]} wrap>
        {values.slice(0, 2).map((id) => (
          <Tag key={id}>{workspaceNameById.get(id) ?? id}</Tag>
        ))}
        {values.length > 2 ? <Tag>+{values.length - 2}</Tag> : null}
      </Space>
    );
  }

  const columns: ColumnsType<AdminRoleTemplateDetail> = [
    {
      title: '数字员工',
      key: 'template',
      width: 260,
      render: (_value, template) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{template.name}</Typography.Text>
          <Typography.Text type="secondary">{template.id}</Typography.Text>
        </Space>
      )
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 90
    },
    {
      title: '场景',
      key: 'scenario',
      render: (_value, template) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{template.industry}</Typography.Text>
          <Typography.Text type="secondary">{template.scenario}</Typography.Text>
        </Space>
      )
    },
    {
      title: '推荐套餐',
      dataIndex: 'recommendedPlanCode',
      width: 170,
      render: (code: string) => <Tag color="blue">{planNameByCode.get(code) ?? code}</Tag>
    },
    {
      title: '可见范围',
      key: 'visibility',
      width: 260,
      render: (_value, template) => (
        <Space direction="vertical" size={4}>
          {renderPlans(template.allowedPlanCodes)}
          {renderWorkspaces(template.visibleWorkspaceIds)}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => <QiuStatusTag tone={statusTone(status)}>{status}</QiuStatusTag>
    },
    {
      title: '最近测试',
      dataIndex: 'lastTestedAt',
      width: 160,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 310,
      render: (_value, template) => (
        <Space wrap>
          <Button icon={<EditOutlined />} href={`/templates/canvas?templateId=${encodeURIComponent(template.id)}`}>
            编辑
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            loading={testingTemplateId === template.id}
            onClick={() => handleTest(template)}
          >
            测试
          </Button>
          {template.status === 'PUBLISHED' ? (
            <Popconfirm
              title="确认下架这个数字员工？"
              okText="下架"
              cancelText="取消"
              onConfirm={() => handleArchive(template)}
            >
              <Button danger icon={<InboxOutlined />} loading={actionTemplateId === template.id}>
                下架
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={actionTemplateId === template.id}
              onClick={() => handlePublish(template)}
            >
              上架
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="数字员工"
        description="查看、测试、上架。PC 端会同步已上架且有权限的员工。"
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card bordered={false}>
            <Space size={32} wrap>
              <Typography.Text>总数：{counts.total}</Typography.Text>
              <Typography.Text>已上架：{counts.published}</Typography.Text>
              <Typography.Text>草稿：{counts.draft}</Typography.Text>
              <Typography.Text>已下架：{counts.archived}</Typography.Text>
            </Space>
          </Card>

          {testNotice ? (
            <Alert
              showIcon
              type={testNotice.valid ? 'success' : 'warning'}
              message={`${testNotice.templateName}：${testNotice.message}`}
              description={
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Typography.Text>状态：{testNotice.status}</Typography.Text>
                  {testNotice.warnings.length ? (
                    <Typography.Text type="secondary">
                      提示：{testNotice.warnings.join('；')}
                    </Typography.Text>
                  ) : null}
                  {testNotice.graphTrace ? (
                    <Space direction="vertical" size={8} style={{ width: '100%' }}>
                      <Typography.Text strong>
                        节点预览：{testNotice.graphTrace.nodeCount} 个节点 /{' '}
                        {testNotice.graphTrace.edgeCount} 条连线
                      </Typography.Text>
                      <Space direction="vertical" size={6} style={{ width: '100%' }}>
                        {testNotice.graphTrace.nodes.map((node) => (
                          <Card key={node.nodeId} size="small" bordered>
                            <Space direction="vertical" size={4} style={{ width: '100%' }}>
                              <Space wrap>
                                <Typography.Text strong>{node.nodeName}</Typography.Text>
                                <Tag>{node.nodeType}</Tag>
                                <Tag color={node.status === 'passed' ? 'green' : 'gold'}>
                                  {node.status}
                                </Tag>
                              </Space>
                              <Typography.Text type="secondary">输入：{node.inputPreview}</Typography.Text>
                              <Typography.Text type="secondary">输出：{node.outputPreview}</Typography.Text>
                              {node.warnings.length ? (
                                <Typography.Text type="warning">
                                  警告：{node.warnings.join('；')}
                                </Typography.Text>
                              ) : null}
                            </Space>
                          </Card>
                        ))}
                      </Space>
                    </Space>
                  ) : null}
                </Space>
              }
            />
          ) : null}

          <Card title="员工列表" bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 12 }}
              scroll={{ x: 1280 }}
              expandable={{
                expandedRowRender: (template) => (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text>{template.description}</Typography.Text>
                    <Typography.Text type="secondary">目标：{template.businessGoal}</Typography.Text>
                    <Space wrap>
                      {template.skills.map((skill) => (
                        <Tag key={skill.code}>{skill.name}</Tag>
                      ))}
                    </Space>
                    <Space wrap>
                      {template.workflowSteps.map((step) => (
                        <Tag key={step.id}>
                          {step.order}. {step.name}
                        </Tag>
                      ))}
                    </Space>
                    <Typography.Text type="secondary">
                      工作流：{template.workflowGraph?.nodes.length ?? 0} 个节点 /{' '}
                      {template.workflowGraph?.edges.length ?? 0} 条连线
                    </Typography.Text>
                    <Typography.Text type="secondary">输出格式：{template.outputFormat || '-'}</Typography.Text>
                  </Space>
                )
              }}
            />
          </Card>
        </Space>
      </QiuPage>
    </AdminShell>
  );
}
