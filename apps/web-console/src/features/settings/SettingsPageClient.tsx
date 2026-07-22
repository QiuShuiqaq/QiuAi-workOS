'use client';

import { CreditCardOutlined, DesktopOutlined, ReloadOutlined } from '@ant-design/icons';
import type {
  BillingOrderSummary,
  BillingOverview,
  CurrentAccountResponse,
  CreateDesktopBindingCodeResponse,
  DesktopDeviceSummary,
  EntitlementSummary,
  PaymentProviderConfigStatus,
  PlanDetail
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';

export interface SettingsPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: PlanDetail[];
  billing: BillingOverview;
  desktopDevices: DesktopDeviceSummary[];
  isApiFallback: boolean;
}

const featureLabels: Record<string, string> = {
  maxRoleInstances: 'AI \u5c97\u4f4d\u6570\u91cf',
  maxTasksPerMonth: '\u6708\u4efb\u52a1\u989d\u5ea6',
  maxKnowledgeBases: '\u77e5\u8bc6\u5e93\u6570\u91cf',
  maxStorageGB: '\u5b58\u50a8\u7a7a\u95f4',
  maxMembers: '\u6210\u5458\u6570\u91cf',
  canCreateDepartment: '\u90e8\u95e8\u7ba1\u7406',
  canInviteMember: '\u6210\u5458\u9080\u8bf7',
  canUseApprovalPolicy: '\u5ba1\u6279\u7b56\u7565',
  canUseAuditLog: '\u5ba1\u8ba1\u65e5\u5fd7',
  canUseAdvancedToolConnector: '\u9ad8\u7ea7\u5de5\u5177\u8fde\u63a5\u5668',
  canUseCostBudget: '\u6210\u672c\u9884\u7b97',
  canUseEnterpriseKPIDashboard: '\u4f01\u4e1a KPI \u770b\u677f'
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

function formatCurrency(amountCents: number, currency: string) {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency
  }).format(amountCents / 100);
}

function planPriceText(plan: PlanDetail) {
  if (plan.billingCycle === 'FREE') return '免费';
  if (!plan.priceCents) return '待配置';
  return formatCurrency(plan.priceCents, plan.currency ?? 'CNY');
}

function formatDateTime(value?: string) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function paymentProviderLabel(provider: string) {
  return provider === 'ALIPAY' ? '\u652f\u4ed8\u5b9d' : provider;
}

function orderStatusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'processing' {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger';
  if (status === 'CLOSED') return 'default';
  return 'processing';
}

function configStatusText(provider?: PaymentProviderConfigStatus) {
  if (!provider) return '\u672a\u914d\u7f6e';
  return provider.isConfigured ? '\u5df2\u914d\u7f6e' : '\u672a\u5b8c\u6210';
}

function getPlanPaymentDisabledReason(
  plan: PlanDetail,
  options: {
    isApiFallback: boolean;
    workspaceType: string;
    isAlipayConfigured: boolean;
  }
) {
  const isPaidPlan = plan.billingCycle === 'MONTHLY' || plan.billingCycle === 'ANNUAL';

  if (options.isApiFallback) return '后端 API 未连接';
  if (options.workspaceType !== 'enterprise') return '个人空间不能购买企业套餐';
  if (!isPaidPlan) return '该套餐不支持在线支付';
  if (!plan.priceCents) return '请先配置正式价格';
  if (!options.isAlipayConfigured) return '请先完成支付宝配置';
  return undefined;
}

export function SettingsPageClient({
  currentAccount,
  plans,
  billing,
  desktopDevices,
  isApiFallback
}: SettingsPageClientProps) {
  const router = useRouter();
  const [payingPlanCode, setPayingPlanCode] = useState<string | null>(null);
  const [isCreatingBindingCode, setIsCreatingBindingCode] = useState(false);
  const [latestBindingCode, setLatestBindingCode] =
    useState<CreateDesktopBindingCodeResponse['data'] | null>(null);
  const activeWorkspace = currentAccount.workspaces.find(
    (workspace) => workspace.id === currentAccount.activeWorkspaceId
  ) ?? currentAccount.workspaces[0];
  const currentPlan = plans.find((plan) => plan.code === activeWorkspace.planCode) ?? plans[0];
  const alipayStatus = billing.paymentProviders.find((provider) => provider.provider === 'ALIPAY');
  const missingAlipayKeys = alipayStatus?.missingEnvKeys.join(', ') || '-';

  async function createAlipayOrder(plan: PlanDetail) {
    if (!plan.priceCents) {
      message.warning('该套餐还没有配置正式价格');
      return;
    }

    setPayingPlanCode(plan.code);
    try {
      const response = await createBrowserApiClient().createBillingOrder(activeWorkspace.id, {
        planCode: plan.code,
        provider: 'ALIPAY'
      });

      if (response.data.paymentUrl) {
        message.success('支付订单已创建');
        window.location.assign(response.data.paymentUrl);
        return;
      } else {
        message.warning('订单已创建，但支付链接未返回');
      }

      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建支付订单失败');
    } finally {
      setPayingPlanCode(null);
    }
  }

  async function createDesktopBindingCode() {
    if (isApiFallback) {
      message.warning('后端 API 未连接，无法生成绑定码');
      return;
    }

    setIsCreatingBindingCode(true);
    try {
      const response = await createBrowserApiClient().createDesktopBindingCode(activeWorkspace.id, {
        expiresInMinutes: 10
      });
      setLatestBindingCode(response.data);
      message.success('绑定码已生成');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成绑定码失败');
    } finally {
      setIsCreatingBindingCode(false);
    }
  }

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
      title: '价格',
      key: 'price',
      render: (_value, plan) => planPriceText(plan)
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
    },
    {
      title: '操作',
      key: 'action',
      render: (_value, plan) => {
        const disabledReason = getPlanPaymentDisabledReason(plan, {
          isApiFallback,
          workspaceType: activeWorkspace.workspaceType,
          isAlipayConfigured: Boolean(alipayStatus?.isConfigured)
        });

        return (
          <Button
            icon={<CreditCardOutlined />}
            size="small"
            type={plan.code === activeWorkspace.planCode ? 'default' : 'primary'}
            disabled={Boolean(disabledReason)}
            title={disabledReason}
            loading={payingPlanCode === plan.code}
            onClick={() => void createAlipayOrder(plan)}
          >
            {plan.code === activeWorkspace.planCode ? '续费' : '购买'}
          </Button>
        );
      }
    }
  ];

  const billingOrderColumns: ColumnsType<BillingOrderSummary> = [
    {
      title: '\u8ba2\u5355\u53f7',
      dataIndex: 'orderNo',
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>
    },
    {
      title: '\u8ba2\u5355\u5185\u5bb9',
      dataIndex: 'subject',
      responsive: ['md']
    },
    {
      title: '\u91d1\u989d',
      key: 'amount',
      render: (_value, order) => formatCurrency(order.amountCents, order.currency)
    },
    {
      title: '\u72b6\u6001',
      dataIndex: 'status',
      render: (status: string) => <QiuStatusTag tone={orderStatusTone(status)}>{status}</QiuStatusTag>
    },
    {
      title: '\u652f\u4ed8',
      key: 'payment',
      render: (_value, order) =>
        order.paymentUrl ? (
          <Typography.Link href={order.paymentUrl} target="_blank">
            {'\u6253\u5f00'}
          </Typography.Link>
        ) : (
          <Typography.Text type="secondary">{'\u672a\u751f\u6210'}</Typography.Text>
        )
    },
    {
      title: '\u521b\u5efa\u65f6\u95f4',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (value: string) => formatDateTime(value)
    }
  ];

  const desktopDeviceColumns: ColumnsType<DesktopDeviceSummary> = [
    {
      title: '设备',
      key: 'device',
      render: (_value, device) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{device.deviceName}</Typography.Text>
          <Typography.Text type="secondary">{device.deviceId}</Typography.Text>
        </Space>
      )
    },
    {
      title: '运行标识',
      dataIndex: 'runtimeId',
      responsive: ['md'],
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>
    },
    {
      title: '平台',
      dataIndex: 'platform'
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <QiuStatusTag tone={status === 'ACTIVE' ? 'success' : 'danger'}>{status}</QiuStatusTag>
    },
    {
      title: '最近同步',
      dataIndex: 'lastSyncedAt',
      responsive: ['lg'],
      render: (value: string | undefined) => formatDateTime(value)
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

        <Card title="计费与支付" bordered={false}>
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <Descriptions column={1} title="订阅与付款主体">
                <Descriptions.Item label="计费主体">
                  {billing.billingAccount?.billingName ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="联系邮箱">
                  {billing.billingAccount?.contactEmail ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="订阅状态">
                  <QiuStatusTag tone="processing">
                    {billing.subscription?.status ?? '-'}
                  </QiuStatusTag>
                </Descriptions.Item>
                <Descriptions.Item label="当前周期">
                  {`${formatDateTime(billing.subscription?.currentPeriodStart)} - ${formatDateTime(
                    billing.subscription?.currentPeriodEnd
                  )}`}
                </Descriptions.Item>
                <Descriptions.Item label="当前套餐">
                  {billing.currentPlan?.name ?? currentPlan.name}
                </Descriptions.Item>
              </Descriptions>
            </Col>
            <Col xs={24} xl={12}>
              <Descriptions column={1} title="支付通道">
                <Descriptions.Item label="默认通道">
                  {paymentProviderLabel(alipayStatus?.provider ?? 'ALIPAY')}
                </Descriptions.Item>
                <Descriptions.Item label="配置状态">
                  <QiuStatusTag tone={alipayStatus?.isConfigured ? 'success' : 'warning'}>
                    {configStatusText(alipayStatus)}
                  </QiuStatusTag>
                </Descriptions.Item>
                <Descriptions.Item label="网关地址">
                  {alipayStatus?.gatewayUrl ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="异步回调">
                  {alipayStatus?.notifyPath ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="缺失配置">
                  <Typography.Text type="secondary" style={{ wordBreak: 'break-word' }}>
                    {missingAlipayKeys}
                  </Typography.Text>
                </Descriptions.Item>
              </Descriptions>
            </Col>
          </Row>

          <Table
            rowKey="id"
            columns={billingOrderColumns}
            dataSource={billing.recentOrders}
            pagination={false}
            locale={{ emptyText: '暂无订单记录' }}
          />
        </Card>

        <Card title="商业版本" bordered={false}>
          <Table rowKey="code" columns={planColumns} dataSource={plans} pagination={false} />
        </Card>
        <Card
          title="桌面端绑定"
          bordered={false}
          extra={
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => void router.refresh()}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<DesktopOutlined />}
                loading={isCreatingBindingCode}
                onClick={() => void createDesktopBindingCode()}
              >
                生成绑定码
              </Button>
            </Space>
          }
        >
          <Alert
            showIcon
            type="info"
            message="桌面端首次启动后，请在这里生成一次性绑定码，让企业 PC 自动接入当前工作区。"
          />
          <Table
            rowKey="id"
            columns={desktopDeviceColumns}
            dataSource={desktopDevices}
            pagination={false}
            locale={{ emptyText: '当前还没有绑定的桌面设备' }}
          />
        </Card>

        <Modal
          title="桌面端绑定码"
          open={Boolean(latestBindingCode)}
          onCancel={() => setLatestBindingCode(null)}
          onOk={() => setLatestBindingCode(null)}
          okText="关闭"
          cancelButtonProps={{ style: { display: 'none' } }}
        >
          {latestBindingCode ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Paragraph>
                将下面的绑定码输入到桌面端完成一次性绑定，10 分钟后自动失效。
              </Typography.Paragraph>
              <Typography.Title level={3} style={{ margin: 0 }} copyable>
                {latestBindingCode.bindingCode}
              </Typography.Title>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="工作区">{latestBindingCode.workspaceId}</Descriptions.Item>
                <Descriptions.Item label="过期时间">
                  {formatDateTime(latestBindingCode.expiresAt)}
                </Descriptions.Item>
                <Descriptions.Item label="状态">{latestBindingCode.status}</Descriptions.Item>
              </Descriptions>
            </Space>
          ) : null}
        </Modal>
      </QiuPage>
    </ConsoleShell>
  );
}
