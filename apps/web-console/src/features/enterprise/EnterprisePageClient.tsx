'use client';

import type { CurrentAccountResponse, EnterpriseWorkspaceOverview } from '@qiuai/api-contract';
import { QiuApiError } from '@qiuai/api-client';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import { PlusOutlined } from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
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
  canUseAdvancedToolConnector: '高级工具连接器',
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

export function EnterprisePageClient({
  currentAccount,
  overview,
  isApiFallback
}: EnterprisePageClientProps) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{
    name: string;
    parentDepartmentId?: string;
    ownerUserId?: string;
  }>();

  const activeWorkspace = currentAccount.workspaces.find(
    (workspace) => workspace.id === currentAccount.activeWorkspaceId
  ) ?? currentAccount.workspaces[0];

  const canCreateDepartment = useMemo(
    () => overview.plan.entitlements.some((entitlement) => entitlement.featureKey === 'canCreateDepartment' && entitlement.enabled),
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
      render: (value: string) => <QiuStatusTag tone={value === 'owner' ? 'success' : 'processing'}>{value}</QiuStatusTag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (value: string) => <QiuStatusTag tone={statusTone(value)}>{value}</QiuStatusTag>
    }
  ];

  const entitlementColumns: ColumnsType<EnterpriseWorkspaceOverview['plan']['entitlements'][number]> = [
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
  ];

  async function handleCreateDepartment(values: {
    name: string;
    parentDepartmentId?: string;
    ownerUserId?: string;
  }) {
    setSubmitting(true);
    try {
      await createBrowserApiClient().createDepartment(activeWorkspace.id, values);
      message.success('部门已创建');
      setDrawerOpen(false);
      form.resetFields();
      router.refresh();
    } catch (error) {
      if (error instanceof QiuApiError) {
        message.error(error.body.error.message);
      } else {
        message.error('创建部门失败');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title="企业控制面"
        description={`组织、部门、成员和订阅统一管理 · ${activeWorkspace.name}`}
        actions={
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => setDrawerOpen(true)}
            disabled={!canCreateDepartment}
          >
            创建部门
          </Button>
        }
      >
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}
        {!canCreateDepartment ? (
          <Alert
            showIcon
            type="info"
            message="当前套餐不支持部门管理"
            description="升级到企业版后可启用部门、成员邀请和更完整的组织治理能力。"
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
            <QiuMetricCard
              title="部门数量"
              value={String(overview.departments.length)}
              trend={`${overview.plan.code} 套餐`}
            />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="成员数量"
              value={String(overview.members.length)}
              trend={overview.subscription.status}
            />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="岗位数量"
              value={String(overview.usage.find((item) => item.metricKey === 'roleInstances.count')?.usedValue ?? 0)}
              trend="岗位驱动"
            />
          </Col>
        </Row>

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
                columns={entitlementColumns}
                dataSource={overview.plan.entitlements}
                pagination={false}
              />
            </Card>
          </Col>
        </Row>

        <Card title="部门管理" bordered={false} style={{ marginTop: 16 }}>
          <Table
            rowKey="id"
            columns={departmentColumns}
            dataSource={overview.departments}
            pagination={false}
          />
        </Card>

        <Card title="成员管理" bordered={false} style={{ marginTop: 16 }}>
          <Table rowKey="id" columns={memberColumns} dataSource={overview.members} pagination={false} />
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
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
        width={440}
      >
        <Form layout="vertical" form={form} onFinish={handleCreateDepartment}>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
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
            <Button
              htmlType="submit"
              type="primary"
              block
              loading={submitting}
              disabled={!canCreateDepartment}
            >
              创建
            </Button>
          </Form.Item>
        </Form>
      </Drawer>
    </ConsoleShell>
  );
}
