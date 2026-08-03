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
import Tag from 'antd/es/tag';
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

function orderStatusLabel(status: string) {
  return {
    PENDING: '待支付',
    PAID: '已支付',
    CLOSED: '已关闭',
    CANCELLED: '已取消',
    FAILED: '支付失败'
  }[status] ?? status;
}

function entitlementText(plan: PlanDetail | undefined, featureKey: string, fallback = '-') {
  const entitlement = plan?.entitlements.find((item) => item.featureKey === featureKey);
  if (!entitlement?.enabled) return fallback;
  if (entitlement.limitValue === undefined) return '已开放';
  return `${entitlement.limitValue.toLocaleString('zh-CN')} ${entitlement.limitUnit ?? ''}`.trim();
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
  if (!options.isAlipayConfigured) return '在线支付暂不可用，请联系服务商开通或线下处理';
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
  const planGroups = [
    {
      key: 'BASIC',
      name: '企业基础版',
      fitFor: '适合小团队试点 AI 工作流。',
      monthly: plans.find((plan) => plan.code === 'ENTERPRISE_BASIC_MONTHLY'),
      annual: plans.find((plan) => plan.code === 'ENTERPRISE_BASIC_ANNUAL'),
      highlight: false
    },
    {
      key: 'STANDARD',
      name: '企业标准版',
      fitFor: '适合多个部门正常使用数字员工和数字工厂。',
      monthly: plans.find((plan) => plan.code === 'ENTERPRISE_STANDARD_MONTHLY'),
      annual: plans.find((plan) => plan.code === 'ENTERPRISE_STANDARD_ANNUAL'),
      highlight: true
    },
    {
      key: 'PRO',
      name: '企业专业版',
      fitFor: '适合高频生产、多设备和批量工厂场景。',
      monthly: plans.find((plan) => plan.code === 'ENTERPRISE_PRO_MONTHLY'),
      annual: plans.find((plan) => plan.code === 'ENTERPRISE_PRO_ANNUAL'),
      highlight: false
    }
  ];
  const customPlan = plans.find((plan) => plan.code === 'ENTERPRISE_CUSTOM');

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
      render: (status: string) => <QiuStatusTag tone={orderStatusTone(status)}>{orderStatusLabel(status)}</QiuStatusTag>
    },
    {
      title: '支付',
      key: 'payment',
      render: (_value, order) =>
        order.paymentUrl ? (
          <Typography.Link href={order.paymentUrl} target="_blank">
            继续支付
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
      <QiuPage
        title="套餐与购买"
        description="为当前企业空间选择套餐。购买后，套餐容量会同步到该企业绑定的 PC 设备。"
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <QiuMetricCard title="当前空间" value={activeWorkspace.name} trend={activeWorkspace.workspaceType === 'enterprise' ? '企业空间' : '个人空间'} />
            </Col>
            <Col xs={24} md={8}>
              <QiuMetricCard title="当前套餐" value={currentPlan.name} trend={billingCycleLabel(currentPlan.billingCycle)} />
            </Col>
            <Col xs={24} md={8}>
              <QiuMetricCard title="账号" value={currentAccount.account.status} trend={currentAccount.account.primaryEmail} />
            </Col>
          </Row>

          <Card bordered={false}>
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={12}>
                <Descriptions column={1} title="当前订阅">
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
                <Descriptions column={1} title="套餐容量说明">
                  <Descriptions.Item label="授权范围">按企业空间购买</Descriptions.Item>
                  <Descriptions.Item label="设备规则">企业绑定的每台 PC 设备单独遵守套餐容量</Descriptions.Item>
                  <Descriptions.Item label="模型费用">模型 API 由 PC 端自行配置，实际费用以模型供应商账单为准</Descriptions.Item>
                  <Descriptions.Item label="在线支付">{paymentProviderLabel(alipayStatus?.provider ?? 'ALIPAY')}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          <Card title="选择企业套餐" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="套餐费用不包含模型 API 调用费"
                description="QiuAI WorkOS 负责企业权限、设备容量、数字员工、数字工厂、知识库和任务管理；模型调用由用户在 PC 端自行配置供应商。年付按 10 个月计费。"
              />
              {!alipayStatus?.isConfigured ? (
                <Alert
                  showIcon
                  type="warning"
                  message="在线支付暂不可用"
                  description="请联系服务商开通或线下处理，企业端不会展示支付网关和服务器环境变量。"
                />
              ) : null}
              <Row gutter={[16, 16]}>
                {planGroups.map((group) => {
                  const basePlan = group.monthly ?? group.annual;
                  const isCurrentGroup = activeWorkspace.planCode.includes(group.key);
                  return (
                    <Col key={group.key} xs={24} lg={8}>
                      <Card
                        bordered
                        title={
                          <Space size={8} wrap>
                            <Typography.Text strong>{group.name}</Typography.Text>
                            {group.highlight ? <Tag color="blue">推荐</Tag> : null}
                            {isCurrentGroup ? <Tag color="green">当前套餐</Tag> : null}
                          </Space>
                        }
                      >
                        <Space direction="vertical" size={12} style={{ width: '100%' }}>
                          <Typography.Text type="secondary">{group.fitFor}</Typography.Text>
                          <Typography.Title level={3} style={{ margin: 0 }}>
                            {group.monthly ? `${planPriceText(group.monthly)} / 月` : '待配置'}
                          </Typography.Title>
                          <Space direction="vertical" size={4}>
                            <Typography.Text>绑定设备：{entitlementText(basePlan, 'maxDesktopDevices')}</Typography.Text>
                            <Typography.Text>每台设备数字员工：{entitlementText(basePlan, 'maxRoleInstances')}</Typography.Text>
                            <Typography.Text>每台设备数字工厂：{entitlementText(basePlan, 'maxDigitalFactories')}</Typography.Text>
                          </Space>
                          <Space wrap>
                            {[group.monthly, group.annual].filter(Boolean).map((plan) => {
                              const targetPlan = plan as PlanDetail;
                              const disabledReason = getPlanPaymentDisabledReason(targetPlan, {
                                isApiFallback,
                                workspaceType: activeWorkspace.workspaceType,
                                isAlipayConfigured: Boolean(alipayStatus?.isConfigured)
                              });
                              const isCurrentPlan = targetPlan.code === activeWorkspace.planCode;
                              return (
                                <Button
                                  key={targetPlan.code}
                                  icon={<CreditCardOutlined />}
                                  type={isCurrentPlan ? 'default' : 'primary'}
                                  disabled={Boolean(disabledReason)}
                                  title={disabledReason}
                                  loading={payingPlanCode === targetPlan.code}
                                  onClick={() => void createAlipayOrder(targetPlan)}
                                >
                                  {isCurrentPlan ? `续费${billingCycleLabel(targetPlan.billingCycle)}` : `开通${billingCycleLabel(targetPlan.billingCycle)}`}
                                </Button>
                              );
                            })}
                          </Space>
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
              {customPlan ? (
                <Card bordered>
                  <Row gutter={[16, 16]} align="middle">
                    <Col xs={24} lg={18}>
                      <Typography.Title level={4} style={{ marginTop: 0 }}>
                        企业定制版
                      </Typography.Title>
                      <Typography.Text type="secondary">
                        适合私有化部署、行业数字员工、深度数字工厂和企业流程改造。
                      </Typography.Text>
                    </Col>
                    <Col xs={24} lg={6}>
                      <Button block href="mailto:3431752914@qq.com">
                        联系开通
                      </Button>
                    </Col>
                  </Row>
                </Card>
              ) : null}
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
