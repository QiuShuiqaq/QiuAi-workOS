'use client';

import type { CurrentAccountResponse, EntitlementSummary, PlanDetail } from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';

import { ConsoleShell } from '../../shared/console/ConsoleShell';

export interface SettingsPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: PlanDetail[];
  isApiFallback: boolean;
}

const featureLabels: Record<string, string> = {
  maxRoleInstances: 'AI 岗位数量',
  maxTasksPerMonth: '月任务额度',
  canCreateDepartment: '部门管理',
  canInviteMember: '成员邀请',
  canUseAuditLog: '审计日志',
  canUseCostBudget: '成本预算'
};

function billingCycleLabel(value: string) {
  return {
    FREE: '免费',
    MONTHLY: '月付',
    ANNUAL: '年付',
    CUSTOM: '定制'
  }[value] ?? value;
}

function entitlementValue(entitlement: EntitlementSummary) {
  if (!entitlement.enabled) return '未启用';
  if (entitlement.limitValue === undefined) return '已启用';
  return `${entitlement.limitValue.toLocaleString('zh-CN')} ${entitlement.limitUnit ?? ''}`.trim();
}

export function SettingsPageClient({
  currentAccount,
  plans,
  isApiFallback
}: SettingsPageClientProps) {
  const activeWorkspace = currentAccount.workspaces.find(
    (workspace) => workspace.id === currentAccount.activeWorkspaceId
  ) ?? currentAccount.workspaces[0];
  const currentPlan = plans.find((plan) => plan.code === activeWorkspace.planCode) ?? plans[0];

  const entitlementColumns: ColumnsType<EntitlementSummary> = [
    {
      title: '能力',
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

  const planColumns: ColumnsType<PlanDetail> = [
    {
      title: '版本',
      dataIndex: 'name',
      render: (_value, plan) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{plan.name}</Typography.Text>
          <Typography.Text type="secondary">{plan.code}</Typography.Text>
        </Space>
      )
    },
    {
      title: '计费',
      dataIndex: 'billingCycle',
      render: (value: string) => billingCycleLabel(value)
    },
    {
      title: '说明',
      dataIndex: 'description',
      responsive: ['md']
    },
    {
      title: '当前',
      key: 'current',
      render: (_value, plan) =>
        plan.code === activeWorkspace.planCode ? <QiuStatusTag tone="processing">当前版本</QiuStatusTag> : null
    }
  ];

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="企业设置" description="管理工作空间、账户和商业版本边界。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <QiuMetricCard title="当前空间" value={activeWorkspace.name} trend={activeWorkspace.workspaceType === 'enterprise' ? '企业空间' : '个人空间'} />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="当前版本" value={currentPlan.name} trend={billingCycleLabel(currentPlan.billingCycle)} />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="账户" value={currentAccount.account.status} trend={currentAccount.account.primaryEmail} />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={10}>
            <Card bordered={false}>
              <Descriptions column={1} title="工作空间">
                <Descriptions.Item label="空间 ID">{activeWorkspace.id}</Descriptions.Item>
                <Descriptions.Item label="租户 ID">{activeWorkspace.tenantId}</Descriptions.Item>
                <Descriptions.Item label="空间类型">{activeWorkspace.workspaceType}</Descriptions.Item>
                <Descriptions.Item label="状态">{activeWorkspace.status}</Descriptions.Item>
                <Descriptions.Item label="版本">{activeWorkspace.planCode}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} xl={14}>
            <Card title="当前版本权益" bordered={false}>
              <Table
                rowKey="featureKey"
                columns={entitlementColumns}
                dataSource={currentPlan.entitlements}
                pagination={false}
              />
            </Card>
          </Col>
        </Row>

        <Card title="商业版本" bordered={false}>
          <Table rowKey="code" columns={planColumns} dataSource={plans} pagination={false} />
        </Card>
      </QiuPage>
    </ConsoleShell>
  );
}
