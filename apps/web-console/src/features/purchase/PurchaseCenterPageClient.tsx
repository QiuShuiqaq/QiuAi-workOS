'use client';

import { CreditCardOutlined } from '@ant-design/icons';
import type {
  BillingOrderSummary,
  BillingOverview,
  CurrentAccountResponse,
  PlanDetail
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import message from 'antd/es/message';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';

export interface PurchaseCenterPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: PlanDetail[];
  billing: BillingOverview;
  isApiFallback: boolean;
}

function billingCycleLabel(value: string) {
  return {
    FREE: '免费',
    MONTHLY: '月付',
    ANNUAL: '年付',
    CUSTOM: '定制'
  }[value] ?? value;
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
  return provider === 'ALIPAY' ? '支付宝' : provider;
}

function orderStatusTone(status: string): 'default' | 'success' | 'warning' | 'danger' | 'processing' {
  if (status === 'PAID') return 'success';
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger';
  if (status === 'CLOSED') return 'default';
  return 'processing';
}

function configStatusText(isConfigured?: boolean) {
  if (isConfigured === undefined) return '未配置';
  return isConfigured ? '已配置' : '未完成';
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
  if (!isPaidPlan) return '免费套餐无需购买';
  if (options.isApiFallback) return '后端 API 未连接';
  if (options.workspaceType !== 'enterprise') return '当前仅企业空间可购买套餐';
  if (!options.isAlipayConfigured) return '请先在服务端配置支付宝支付通道';
  if (!plan.priceCents) return '该套餐尚未配置正式价格';
  return undefined;
}

export function PurchaseCenterPageClient({
  currentAccount,
  plans,
  billing,
  isApiFallback
}: PurchaseCenterPageClientProps) {
  const router = useRouter();
  const [payingPlanCode, setPayingPlanCode] = useState<string | null>(null);
  const activeWorkspace =
    currentAccount.workspaces.find((workspace) => workspace.id === currentAccount.activeWorkspaceId) ??
    currentAccount.workspaces[0];
  const currentPlan = plans.find((plan) => plan.code === activeWorkspace.planCode) ?? plans[0];
  const alipayStatus = billing.paymentProviders.find((provider) => provider.provider === 'ALIPAY');
  const missingAlipayKeys = alipayStatus?.missingEnvKeys.join(', ') || '-';
  const purchasablePlans = plans.filter(
    (plan) => plan.billingCycle === 'MONTHLY' || plan.billingCycle === 'ANNUAL'
  );

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
      }

      message.warning('订单已创建，但支付链接未返回');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建支付订单失败');
    } finally {
      setPayingPlanCode(null);
    }
  }

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
      title: '订单号',
      dataIndex: 'orderNo',
      render: (value: string) => <Typography.Text copyable>{value}</Typography.Text>
    },
    {
      title: '订单内容',
      dataIndex: 'subject',
      responsive: ['md']
    },
    {
      title: '金额',
      key: 'amount',
      render: (_value, order) => formatCurrency(order.amountCents, order.currency)
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: string) => <QiuStatusTag tone={orderStatusTone(status)}>{status}</QiuStatusTag>
    },
    {
      title: '支付',
      key: 'payment',
      render: (_value, order) =>
        order.paymentUrl ? (
          <Typography.Link href={order.paymentUrl} target="_blank">
            打开
          </Typography.Link>
        ) : (
          <Typography.Text type="secondary">未生成</Typography.Text>
        )
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      render: (value?: string) => formatDateTime(value)
    }
  ];

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="购买中心" description="购买、续费和查看企业套餐。">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <QiuMetricCard title="当前空间" value={activeWorkspace.name} trend={activeWorkspace.workspaceType === 'enterprise' ? '企业空间' : '个人空间'} />
            </Col>
            <Col xs={24} md={8}>
              <QiuMetricCard title="当前版本" value={currentPlan.name} trend={billingCycleLabel(currentPlan.billingCycle)} />
            </Col>
            <Col xs={24} md={8}>
              <QiuMetricCard title="账号" value={currentAccount.account.status} trend={currentAccount.account.primaryEmail} />
            </Col>
          </Row>

          <Card bordered={false}>
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
                    <QiuStatusTag tone="processing">{billing.subscription?.status ?? '-'}</QiuStatusTag>
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
                      {configStatusText(alipayStatus?.isConfigured)}
                    </QiuStatusTag>
                  </Descriptions.Item>
                  <Descriptions.Item label="网关地址">{alipayStatus?.gatewayUrl ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="异步回调">{alipayStatus?.notifyPath ?? '-'}</Descriptions.Item>
                  <Descriptions.Item label="缺失配置">
                    <Typography.Text type="secondary" style={{ wordBreak: 'break-word' }}>
                      {missingAlipayKeys}
                    </Typography.Text>
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          <Card title="可购买套餐" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="企业套餐正式价格"
                description="企业基础版 588 元/月，企业标准版 1088 元/月，企业专业版 2888 元/月；年付按 10 个月计费。"
              />
              <Table rowKey="code" columns={planColumns} dataSource={purchasablePlans} pagination={false} />
            </Space>
          </Card>

          <Card title="订单记录" bordered={false}>
            <Table
              rowKey="id"
              columns={billingOrderColumns}
              dataSource={billing.recentOrders}
              pagination={false}
              locale={{ emptyText: '暂无订单记录' }}
            />
          </Card>
        </Space>
      </QiuPage>
    </ConsoleShell>
  );
}
