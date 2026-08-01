'use client';

import { CreditCardOutlined, SettingOutlined } from '@ant-design/icons';
import type {
  CurrentAccountResponse,
  EnterpriseWorkspaceOverview
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';

import { ConsoleShell } from '../../shared/console/ConsoleShell';

export interface EnterprisePageClientProps {
  currentAccount: CurrentAccountResponse;
  overview: EnterpriseWorkspaceOverview;
  isApiFallback: boolean;
}

const featureLabels: Record<string, string> = {
  maxRoleInstances: '数字员工数量',
  maxDesktopDevices: '桌面端设备数量'
};

const visiblePlanFeatureKeys = ['maxDesktopDevices', 'maxRoleInstances'];

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

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function usageText(overview: EnterpriseWorkspaceOverview, metricKey: string) {
  const usage = overview.usage.find((item) => item.metricKey === metricKey);
  if (!usage) return '-';
  return usage.limitValue === undefined ? String(usage.usedValue) : `${usage.usedValue}/${usage.limitValue}`;
}

export function EnterprisePageClient({
  currentAccount,
  overview,
  isApiFallback
}: EnterprisePageClientProps) {
  const activeWorkspace =
    currentAccount.workspaces.find((workspace) => workspace.id === currentAccount.activeWorkspaceId) ??
    currentAccount.workspaces[0];
  const settingsHref = `/settings?workspaceId=${encodeURIComponent(activeWorkspace.id)}`;
  const purchaseHref = `/purchase?workspaceId=${encodeURIComponent(activeWorkspace.id)}`;

  const entitlementColumns: ColumnsType<EnterpriseWorkspaceOverview['plan']['entitlements'][number]> = [
    {
      title: '权益',
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

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title="企业控制台"
        description={`单企业账号，管理套餐、设备授权和数字员工使用 · ${activeWorkspace.name}`}
        actions={
          <Space>
            <Button type="primary" icon={<CreditCardOutlined />} href={purchaseHref}>
              购买中心
            </Button>
            <Button icon={<SettingOutlined />} href={settingsHref}>
              设备设置
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {isApiFallback ? (
            <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" />
          ) : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} md={12} xl={6}>
              <QiuMetricCard
                title="企业账号"
                value={overview.organization?.name ?? activeWorkspace.name}
                trend={activeWorkspace.workspaceType === 'enterprise' ? '企业空间' : '个人空间'}
              />
            </Col>
            <Col xs={24} md={12} xl={6}>
              <QiuMetricCard title="当前套餐" value={overview.plan.name} trend={overview.subscription.status} />
            </Col>
            <Col xs={24} md={12} xl={6}>
              <QiuMetricCard
                title="桌面端设备"
                value={usageText(overview, 'desktopDevices.count')}
                trend="授权接入"
              />
            </Col>
            <Col xs={24} md={12} xl={6}>
              <QiuMetricCard
                title="数字员工"
                value={usageText(overview, 'roleInstances.count')}
                trend="PC 端使用"
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Card title="企业信息" bordered={false}>
                <Descriptions column={1} size="small">
                  <Descriptions.Item label="工作区">{activeWorkspace.name}</Descriptions.Item>
                  <Descriptions.Item label="工作区类型">{activeWorkspace.workspaceType}</Descriptions.Item>
                  <Descriptions.Item label="企业名称">{overview.organization?.name ?? activeWorkspace.name}</Descriptions.Item>
                  <Descriptions.Item label="行业">{overview.organization?.industry ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="规模">{overview.organization?.size ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="订阅状态">
                    <QiuStatusTag tone={statusTone(overview.subscription.status)}>
                      {overview.subscription.status}
                    </QiuStatusTag>
                  </Descriptions.Item>
                  <Descriptions.Item label="当前周期">
                    {`${formatDateTime(overview.subscription.currentPeriodStart)} - ${formatDateTime(
                      overview.subscription.currentPeriodEnd
                    )}`}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col xs={24} xl={12}>
              <Card title="套餐容量" bordered={false}>
                <Table
                  rowKey="featureKey"
                  columns={entitlementColumns}
                  dataSource={overview.plan.entitlements.filter((entitlement) =>
                    visiblePlanFeatureKeys.includes(entitlement.featureKey)
                  )}
                  pagination={false}
                />
              </Card>
            </Col>
          </Row>

          <Card title="用量记录" bordered={false}>
            <Row gutter={[16, 16]}>
              {overview.usage
                .filter((item) => ['desktopDevices.count', 'roleInstances.count'].includes(item.metricKey))
                .map((item) => (
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

          <Typography.Text type="secondary">
            当前版本按一个企业一个账号设计。员工协作通过企业内部管理设备授权码完成，不再在系统内维护多成员邀请。
          </Typography.Text>
        </Space>
      </QiuPage>
    </ConsoleShell>
  );
}
