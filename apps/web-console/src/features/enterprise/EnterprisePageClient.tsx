'use client';

import type {
  CurrentAccountResponse,
  EnterpriseWorkspaceOverview,
  WorkspaceInvitationSummary
} from '@qiuai/api-contract';
import { QiuApiError } from '@qiuai/api-client';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import { CopyOutlined, PlusOutlined, UserAddOutlined } from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Popconfirm from 'antd/es/popconfirm';
import Row from 'antd/es/row';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';

export interface EnterprisePageClientProps {
  currentAccount: CurrentAccountResponse;
  overview: EnterpriseWorkspaceOverview;
  invitations: WorkspaceInvitationSummary[];
  isApiFallback: boolean;
}

const featureLabels: Record<string, string> = {
  maxRoleInstances: 'AI 岗位数量',
  maxTasksPerMonth: '月任务数',
  maxKnowledgeBases: '知识库数量',
  maxStorageGB: '存储空间',
  maxMembers: '成员数量',
  canCreateDepartment: '部门管理',
  canInviteMember: '成员邀请',
  canUseApprovalPolicy: '审批策略',
  canUseAuditLog: '审计日志',
  canUseAdvancedToolConnector: '高级工具连接',
  canUseCostBudget: '成本预算',
  canUseEnterpriseKPIDashboard: '企业 KPI 看板'
};

function entitlementValue(value: EnterpriseWorkspaceOverview['plan']['entitlements'][number]) {
  if (!value.enabled) return '未启用';
  if (value.limitValue === undefined) return '已启用';
  return `${value.limitValue.toLocaleString('zh-CN')} ${value.limitUnit ?? ''}`.trim();
}

function statusTone(status: string) {
  if (status === 'active') return 'success';
  if (status === 'trialing') return 'processing';
  if (status === 'free') return 'default';
  if (status === 'suspended' || status === 'past_due') return 'warning';
  return 'default';
}

function invitationTone(status: WorkspaceInvitationSummary['status']) {
  if (status === 'accepted') return 'success';
  if (status === 'pending') return 'processing';
  if (status === 'expired') return 'warning';
  return 'default';
}

function roleTone(role: WorkspaceInvitationSummary['systemRole']) {
  if (role === 'admin') return 'processing';
  if (role === 'viewer') return 'warning';
  return 'default';
}

export function EnterprisePageClient({
  currentAccount,
  overview,
  invitations,
  isApiFallback
}: EnterprisePageClientProps) {
  const router = useRouter();
  const [departmentDrawerOpen, setDepartmentDrawerOpen] = useState(false);
  const [inviteDrawerOpen, setInviteDrawerOpen] = useState(false);
  const [departmentSubmitting, setDepartmentSubmitting] = useState(false);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [latestInviteUrl, setLatestInviteUrl] = useState<string>();
  const [departmentForm] = Form.useForm<{
    name: string;
    parentDepartmentId?: string;
    ownerUserId?: string;
  }>();
  const [inviteForm] = Form.useForm<{
    email: string;
    systemRole?: 'admin' | 'member' | 'viewer';
    departmentId?: string;
    expiresInDays?: number;
  }>();

  const activeWorkspace =
    currentAccount.workspaces.find((workspace) => workspace.id === currentAccount.activeWorkspaceId) ??
    currentAccount.workspaces[0];

  const canCreateDepartment = useMemo(
    () =>
      overview.plan.entitlements.some(
        (entitlement) => entitlement.featureKey === 'canCreateDepartment' && entitlement.enabled
      ),
    [overview.plan.entitlements]
  );

  const canInviteMember = useMemo(
    () =>
      overview.plan.entitlements.some(
        (entitlement) => entitlement.featureKey === 'canInviteMember' && entitlement.enabled
      ),
    [overview.plan.entitlements]
  );

  const departmentColumns: ColumnsType<EnterpriseWorkspaceOverview['departments'][number]> = [
    {
      title: '部门',
      dataIndex: 'name',
      render: (_value, department) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{department.name}</Typography.Text>
          <Typography.Text type="secondary">{department.parentDepartmentName ?? '顶层部门'}</Typography.Text>
        </Space>
      )
    },
    {
      title: '负责人',
      dataIndex: 'ownerName',
      render: (ownerName: string | undefined) => ownerName ?? '未设置'
    },
    {
      title: '成员数',
      dataIndex: 'memberCount'
    },
    {
      title: '岗位数',
      dataIndex: 'roleInstanceCount'
    }
  ];

  const memberColumns: ColumnsType<EnterpriseWorkspaceOverview['members'][number]> = [
    {
      title: '成员',
      dataIndex: 'name',
      render: (_value, member) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{member.name}</Typography.Text>
          <Typography.Text type="secondary">{member.email}</Typography.Text>
        </Space>
      )
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      render: (departmentName: string | undefined) => departmentName ?? '未分配'
    },
    {
      title: '角色',
      dataIndex: 'systemRole',
      render: (value: string) => (
        <QiuStatusTag tone={value === 'owner' ? 'success' : 'processing'}>{value}</QiuStatusTag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <QiuStatusTag tone={statusTone(value)}>{value}</QiuStatusTag>
    }
  ];

  const invitationColumns: ColumnsType<WorkspaceInvitationSummary> = [
    {
      title: '邮箱',
      dataIndex: 'email',
      render: (_value, invitation) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{invitation.email}</Typography.Text>
          <Typography.Text type="secondary">{invitation.createdAt}</Typography.Text>
        </Space>
      )
    },
    {
      title: '角色',
      dataIndex: 'systemRole',
      render: (value: WorkspaceInvitationSummary['systemRole']) => (
        <QiuStatusTag tone={roleTone(value)}>{value}</QiuStatusTag>
      )
    },
    {
      title: '部门',
      dataIndex: 'departmentName',
      render: (departmentName: string | undefined) => departmentName ?? '未指定'
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: WorkspaceInvitationSummary['status']) => (
        <QiuStatusTag tone={invitationTone(value)}>{value}</QiuStatusTag>
      )
    },
    {
      title: '到期',
      dataIndex: 'expiresAt'
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, invitation) => (
        <Space size={8}>
          <Popconfirm
            title="确定取消这个邀请吗？"
            description="取消后该链接将立即失效。"
            onConfirm={() => handleCancelInvitation(invitation.id)}
            okText="取消邀请"
            cancelText="返回"
            disabled={invitation.status !== 'pending'}
          >
            <Button danger size="small" disabled={invitation.status !== 'pending'}>
              取消
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  async function handleCreateDepartment(values: {
    name: string;
    parentDepartmentId?: string;
    ownerUserId?: string;
  }) {
    setDepartmentSubmitting(true);
    try {
      await createBrowserApiClient().createDepartment(activeWorkspace.id, values);
      message.success('部门已创建');
      setDepartmentDrawerOpen(false);
      departmentForm.resetFields();
      router.refresh();
    } catch (error) {
      if (error instanceof QiuApiError) {
        message.error(error.body.error.message);
      } else {
        message.error('创建部门失败');
      }
    } finally {
      setDepartmentSubmitting(false);
    }
  }

  async function handleCreateInvitation(values: {
    email: string;
    systemRole?: 'admin' | 'member' | 'viewer';
    departmentId?: string;
    expiresInDays?: number;
  }) {
    setInviteSubmitting(true);
    try {
      const result = await createBrowserApiClient().createWorkspaceInvitation(activeWorkspace.id, values);
      setLatestInviteUrl(result.inviteUrl);
      message.success('邀请已创建');
      setInviteDrawerOpen(false);
      inviteForm.resetFields();
      router.refresh();
    } catch (error) {
      if (error instanceof QiuApiError) {
        message.error(error.body.error.message);
      } else {
        message.error('创建邀请失败');
      }
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function handleCancelInvitation(invitationId: string) {
    try {
      await createBrowserApiClient().cancelWorkspaceInvitation(activeWorkspace.id, invitationId);
      message.success('邀请已取消');
      router.refresh();
    } catch (error) {
      if (error instanceof QiuApiError) {
        message.error(error.body.error.message);
      } else {
        message.error('取消邀请失败');
      }
    }
  }

  async function handleCopyInviteUrl() {
    if (!latestInviteUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      message.success('邀请链接已复制');
    } catch {
      message.error('复制失败');
    }
  }

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title="企业控制台"
        description={`组织、部门、成员、邀请与订阅统一管理 · ${activeWorkspace.name}`}
        actions={
          <Space>
            <Button
              icon={<UserAddOutlined />}
              type="primary"
              onClick={() => setInviteDrawerOpen(true)}
              disabled={!canInviteMember}
            >
              邀请成员
            </Button>
            <Button
              icon={<PlusOutlined />}
              onClick={() => setDepartmentDrawerOpen(true)}
              disabled={!canCreateDepartment}
            >
              创建部门
            </Button>
          </Space>
        }
      >
        {isApiFallback ? (
          <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" />
        ) : null}
        {!canInviteMember ? (
          <Alert
            showIcon
            type="info"
            message="当前套餐不支持成员邀请"
            description="升级到企业套餐后可使用邀请成员、部门管理和更完整的组织治理能力。"
            style={{ marginTop: 16 }}
          />
        ) : null}
        {!canCreateDepartment ? (
          <Alert
            showIcon
            type="info"
            message="当前套餐不支持部门管理"
            description="升级到企业套餐后可启用部门、成员邀请和更完整的组织治理能力。"
            style={{ marginTop: 16 }}
          />
        ) : null}

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="组织状态"
              value={overview.organization?.name ?? activeWorkspace.name}
              trend={overview.organization?.status ?? activeWorkspace.workspaceType}
            />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard title="部门数量" value={String(overview.departments.length)} trend={`${overview.plan.code} 套餐`} />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard title="成员数量" value={String(overview.members.length)} trend={overview.subscription.status} />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="岗位数量"
              value={String(overview.usage.find((item) => item.metricKey === 'roleInstances.count')?.usedValue ?? 0)}
              trend="岗位驱动"
            />
          </Col>
        </Row>

        {latestInviteUrl ? (
          <Card title="最新邀请链接" bordered={false} style={{ marginTop: 16 }}>
            <Space direction="vertical" size={12} style={{ display: 'flex' }}>
              <Typography.Text type="secondary">
                这是最新生成的邀请链接，复制后发给对应成员即可。
              </Typography.Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input value={latestInviteUrl} readOnly />
                <Button icon={<CopyOutlined />} onClick={handleCopyInviteUrl}>
                  复制
                </Button>
              </Space.Compact>
            </Space>
          </Card>
        ) : null}

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} xl={12}>
            <Card title="组织与订阅" bordered={false}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="工作区">{activeWorkspace.name}</Descriptions.Item>
                <Descriptions.Item label="工作区类型">{activeWorkspace.workspaceType}</Descriptions.Item>
                <Descriptions.Item label="组织名称">{overview.organization?.name ?? '个人工作区'}</Descriptions.Item>
                <Descriptions.Item label="行业">{overview.organization?.industry ?? '未设置'}</Descriptions.Item>
                <Descriptions.Item label="订阅状态">
                  <QiuStatusTag tone={statusTone(overview.subscription.status)}>{overview.subscription.status}</QiuStatusTag>
                </Descriptions.Item>
                <Descriptions.Item label="套餐">{overview.plan.name}</Descriptions.Item>
                <Descriptions.Item label="计费周期">{overview.subscription.billingCycle}</Descriptions.Item>
                <Descriptions.Item label="周期截止">{overview.subscription.currentPeriodEnd ?? '未设置'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="套餐与权限" bordered={false}>
              <Table
                rowKey="featureKey"
                columns={[
                  {
                    title: '功能',
                    dataIndex: 'featureKey',
                    render: (featureKey: string) => featureLabels[featureKey] ?? featureKey
                  },
                  {
                    title: '状态',
                    dataIndex: 'enabled',
                    render: (enabled: boolean) => (
                      <QiuStatusTag tone={enabled ? 'success' : 'default'}>{enabled ? '启用' : '未启用'}</QiuStatusTag>
                    )
                  },
                  {
                    title: '额度',
                    key: 'limit',
                    render: (_value, entitlement) => entitlementValue(entitlement)
                  }
                ]}
                dataSource={overview.plan.entitlements}
                pagination={false}
              />
            </Card>
          </Col>
        </Row>

        <Card title="部门管理" bordered={false} style={{ marginTop: 16 }}>
          <Table rowKey="id" columns={departmentColumns} dataSource={overview.departments} pagination={false} />
        </Card>

        <Card title="成员管理" bordered={false} style={{ marginTop: 16 }}>
          <Table rowKey="id" columns={memberColumns} dataSource={overview.members} pagination={false} />
        </Card>

        <Card title="邀请管理" bordered={false} style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            columns={invitationColumns}
            dataSource={invitations}
            pagination={false}
            locale={{
              emptyText: '当前没有待处理的邀请'
            }}
          />
        </Card>

        <Card title="执行用量" bordered={false} style={{ marginTop: 16 }}>
          <Row gutter={[16, 16]}>
            {overview.usage.map((item) => (
              <Col key={item.metricKey} xs={24} md={12} xl={8}>
                <QiuMetricCard
                  title={item.title}
                  value={item.limitValue === undefined ? String(item.usedValue) : `${item.usedValue}/${item.limitValue}`}
                  trend={item.limitUnit ?? 'used'}
                />
              </Col>
            ))}
          </Row>
        </Card>
      </QiuPage>

      <Drawer
        title="创建部门"
        open={departmentDrawerOpen}
        onClose={() => setDepartmentDrawerOpen(false)}
        destroyOnClose
        width={440}
      >
        <Form layout="vertical" form={departmentForm} onFinish={handleCreateDepartment} initialValues={{}}>
          <Form.Item name="name" label="部门名称" rules={[{ required: true, message: '请输入部门名称' }]}>
            <Input placeholder="例如：增长运营部" />
          </Form.Item>
          <Form.Item name="parentDepartmentId" label="上级部门">
            <Select
              allowClear
              placeholder="可选"
              options={overview.departments.map((department) => ({
                value: department.id,
                label: department.name
              }))}
            />
          </Form.Item>
          <Form.Item name="ownerUserId" label="负责人">
            <Select
              allowClear
              placeholder="可选"
              options={overview.members.map((member) => ({
                value: member.id,
                label: `${member.name} · ${member.email}`
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Button htmlType="submit" type="primary" block loading={departmentSubmitting} disabled={!canCreateDepartment}>
              创建部门
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title="邀请成员"
        open={inviteDrawerOpen}
        onClose={() => setInviteDrawerOpen(false)}
        destroyOnClose
        width={440}
      >
        <Form
          layout="vertical"
          form={inviteForm}
          onFinish={handleCreateInvitation}
          initialValues={{ systemRole: 'member', expiresInDays: 7 }}
        >
          <Form.Item name="email" label="成员邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input placeholder="new.member@qiuai.local" autoComplete="email" />
          </Form.Item>
          <Form.Item name="systemRole" label="邀请角色">
            <Select
              options={[
                { value: 'admin', label: 'admin' },
                { value: 'member', label: 'member' },
                { value: 'viewer', label: 'viewer' }
              ]}
            />
          </Form.Item>
          <Form.Item name="departmentId" label="部门">
            <Select
              allowClear
              placeholder="可选"
              options={overview.departments.map((department) => ({
                value: department.id,
                label: department.name
              }))}
            />
          </Form.Item>
          <Form.Item
            name="expiresInDays"
            label="有效期（天）"
            rules={[{ required: true, message: '请输入有效天数' }]}
          >
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item>
            <Button htmlType="submit" type="primary" block loading={inviteSubmitting} disabled={!canInviteMember}>
              生成邀请链接
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </ConsoleShell>
  );
}
