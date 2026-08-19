'use client';

import { CreditCardOutlined } from '@ant-design/icons';
import type {
  BillingOrderSummary,
  BillingOverview,
  CurrentAccountResponse,
  PlanDetail,
  ListSoftwareCopilotsResponse,
  SoftwareCopilotBillingCycle,
  SoftwareCopilotCatalogItem
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
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
  softwareCopilots: ListSoftwareCopilotsResponse;
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

function softwareCopilotPriceText(amountCents: number, currency = 'CNY') {
  return formatCurrency(amountCents, currency);
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

function digitalFactoryAccessText(planGroupKey: string) {
  return {
    FREE: '暂不开放',
    BASIC: '全部开放',
    STANDARD: '全部开放',
    PRO: '全部开放'
  }[planGroupKey] ?? '按套餐开放';
}

function isPersonalMemberPlanCode(planCode: string | undefined) {
  return planCode === 'PERSONAL_MEMBER_MONTHLY' || planCode === 'PERSONAL_MEMBER_ANNUAL';
}

function isEnterprisePlanCode(planCode: string | undefined) {
  return Boolean(planCode?.startsWith('ENTERPRISE_'));
}

const aiPointPurchaseOptions = [1000, 3000, 10000, 30000, 100000];
const aiPointPurchaseMin = 100;
const aiPointPurchaseMax = 1_000_000;
const aiPointPurchaseStep = 100;
const aiPointProductExamples = [
  { label: '图片线路一（1K）', points: 15, unit: '张' },
  { label: '图片线路二（1K）', points: 30, unit: '张' },
  { label: '图片线路二（2K）', points: 45, unit: '张' },
  { label: '图片线路二（4K）', points: 65, unit: '张' },
  { label: '图片线路三（1K）', points: 20, unit: '张' },
  { label: '图片线路三（2K）', points: 30, unit: '张' },
  { label: '图片线路三（4K）', points: 45, unit: '张' },
  { label: '图片线路四（1K）', points: 10, unit: '张' },
  { label: '视频线路一（6 秒）', points: 200, unit: '个' },
  { label: '视频线路一（10 秒）', points: 280, unit: '个' },
  { label: '视频线路二（6 秒）', points: 300, unit: '个' },
  { label: '视频线路二（10 秒）', points: 500, unit: '个' },
  { label: '文本线路一', points: 1, unit: '次' },
  { label: '推理线路一', points: 3, unit: '次' }
] as const;

function aiPointPriceText(points: number) {
  return formatCurrency(points, 'CNY');
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
  if (options.workspaceType !== 'enterprise' && !isPersonalMemberPlanCode(plan.code)) {
    return '当前仅企业空间可购买套餐';
  }
  if (!options.isAlipayConfigured) return '在线支付暂不可用，请联系服务商开通或线下处理';
  if (!plan.priceCents) return '该套餐尚未配置正式价格';
  return undefined;
}

export function PurchaseCenterPageClient({
  currentAccount,
  plans,
  billing,
  softwareCopilots,
  isApiFallback
}: PurchaseCenterPageClientProps) {
  const router = useRouter();
  const [payingPlanCode, setPayingPlanCode] = useState<string | null>(null);
  const [payingAiPointAmount, setPayingAiPointAmount] = useState<number | null>(null);
  const [customAiPointAmount, setCustomAiPointAmount] = useState<number>(10000);
  const [payingSoftwareCopilotKey, setPayingSoftwareCopilotKey] = useState<string | null>(null);
  const [softwareCopilotSeatCounts, setSoftwareCopilotSeatCounts] = useState<Record<string, number>>({});
  const [memberReferralCode, setMemberReferralCode] = useState('');
  const [referralNotice, setReferralNotice] = useState('');
  const [isValidatingReferralCode, setIsValidatingReferralCode] = useState(false);
  const activeWorkspace =
    currentAccount.workspaces.find((workspace) => workspace.id === currentAccount.activeWorkspaceId) ??
    currentAccount.workspaces[0];
  const currentPlan = plans.find((plan) => plan.code === activeWorkspace.planCode) ?? plans[0];
  const alipayStatus = billing.paymentProviders.find((provider) => provider.provider === 'ALIPAY');
  const personalMemberPlans = [
    plans.find((plan) => plan.code === 'PERSONAL_MEMBER_MONTHLY'),
    plans.find((plan) => plan.code === 'PERSONAL_MEMBER_ANNUAL')
  ].filter(Boolean) as PlanDetail[];
  const planGroups = [
    {
      key: 'BASIC',
      name: '企业基础版',
      fitFor: '适合小团队试点 AI 工作流，支持 10 台设备。',
      monthly: plans.find((plan) => plan.code === 'ENTERPRISE_BASIC_MONTHLY'),
      annual: plans.find((plan) => plan.code === 'ENTERPRISE_BASIC_ANNUAL'),
      highlight: false
    },
    {
      key: 'STANDARD',
      name: '企业标准版',
      fitFor: '适合多个岗位正常使用数字员工和数字工厂，支持 30 台设备。',
      monthly: plans.find((plan) => plan.code === 'ENTERPRISE_STANDARD_MONTHLY'),
      annual: plans.find((plan) => plan.code === 'ENTERPRISE_STANDARD_ANNUAL'),
      highlight: true
    },
    {
      key: 'PRO',
      name: '企业专业版',
      fitFor: '适合高频生产和较大团队使用，支持 80 台设备。',
      monthly: plans.find((plan) => plan.code === 'ENTERPRISE_PRO_MONTHLY'),
      annual: plans.find((plan) => plan.code === 'ENTERPRISE_PRO_ANNUAL'),
      highlight: false
    }
  ];
  const customPlan = plans.find((plan) => plan.code === 'ENTERPRISE_CUSTOM');

  async function validateMemberReferralCode() {
    const code = memberReferralCode.trim();
    if (!code) {
      setReferralNotice('邀请码为选填项，不填写也可以直接开通会员。');
      return;
    }

    setIsValidatingReferralCode(true);
    setReferralNotice('');
    try {
      const response = await createBrowserApiClient().validateReferralCode(activeWorkspace.id, {
        referralCode: code
      });
      setReferralNotice(response.data.message);
      if (response.data.valid) {
        message.success(response.data.message);
      } else {
        message.warning(response.data.message);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '邀请码验证失败';
      setReferralNotice(errorMessage);
      message.error(errorMessage);
    } finally {
      setIsValidatingReferralCode(false);
    }
  }

  async function createAlipayOrder(plan: PlanDetail) {
    if (!plan.priceCents) {
      message.warning('该套餐还没有配置正式价格');
      return;
    }

    setPayingPlanCode(plan.code);
    try {
      const response = await createBrowserApiClient().createBillingOrder(activeWorkspace.id, {
        planCode: plan.code,
        provider: 'ALIPAY',
        referralCode: isPersonalMemberPlanCode(plan.code) ? memberReferralCode.trim() || undefined : undefined
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

  function getAiPointPaymentDisabledReason() {
    if (isApiFallback) return '后端 API 未连接';
    if (!alipayStatus?.isConfigured) return '在线支付暂不可用，请联系服务商开通或线下处理';
    return undefined;
  }

  async function createAiPointOrder(points: number) {
    const disabledReason = getAiPointPaymentDisabledReason();
    if (disabledReason) {
      message.warning(disabledReason);
      return;
    }

    if (
      !Number.isInteger(points) ||
      points < aiPointPurchaseMin ||
      points > aiPointPurchaseMax ||
      points % aiPointPurchaseStep !== 0
    ) {
      message.warning(
        `AI 点数需为 ${aiPointPurchaseMin.toLocaleString()}-${aiPointPurchaseMax.toLocaleString()} 的整数，且按 ${aiPointPurchaseStep} 点递增`
      );
      return;
    }

    setPayingAiPointAmount(points);
    try {
      const response = await createBrowserApiClient().createBillingOrder(activeWorkspace.id, {
        orderKind: 'AI_POINTS',
        aiPointAmount: points,
        amountCents: points,
        provider: 'ALIPAY',
        subject: `QiuAI WorkOS AI 点数充值（${points} 点）`
      });

      if (response.data.paymentUrl) {
        message.success('支付订单已创建');
        window.location.assign(response.data.paymentUrl);
        return;
      }

      message.warning('订单已创建，但支付链接未返回');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建 AI 点数订单失败');
    } finally {
      setPayingAiPointAmount(null);
    }
  }

  function getSoftwareCopilotPaymentDisabledReason(item: SoftwareCopilotCatalogItem) {
    if (item.product.status !== 'ACTIVE') return '该软件副驾暂未开放购买。';
    if (isApiFallback) return '后端 API 未连接';
    if (!alipayStatus?.isConfigured) return '在线支付暂不可用，请联系服务商开通或线下处理';
    if (!item.entitlement.canPurchase) return item.entitlement.reason ?? '当前账号不能购买该软件副驾';
    return undefined;
  }

  async function createSoftwareCopilotAlipayOrder(
    item: SoftwareCopilotCatalogItem,
    billingCycle: SoftwareCopilotBillingCycle
  ) {
    const disabledReason = getSoftwareCopilotPaymentDisabledReason(item);
    if (disabledReason) {
      message.warning(disabledReason);
      return;
    }

    const key = `${item.product.code}:${billingCycle}`;
    const seatCount =
      activeWorkspace.workspaceType === 'enterprise'
        ? softwareCopilotSeatCounts[item.product.code] ?? 1
        : 1;

    setPayingSoftwareCopilotKey(key);
    try {
      const response = await createBrowserApiClient().createSoftwareCopilotOrder(activeWorkspace.id, {
        productCode: item.product.code,
        billingCycle,
        seatCount,
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
      message.error(error instanceof Error ? error.message : '创建软件副驾订单失败');
    } finally {
      setPayingSoftwareCopilotKey(null);
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
                  <Descriptions.Item label="模型费用">官方通道消耗 AI 点数，自配模型以供应商账单为准</Descriptions.Item>
                  <Descriptions.Item label="在线支付">{paymentProviderLabel(alipayStatus?.provider ?? 'ALIPAY')}</Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>

          <Card title="AI 点数" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="官方通道按 AI 点数使用，充值点数长期有效"
                description="100 点 = 1 元。会员每月赠送的 1500 点按月发放，月底未使用会自动失效；充值点数不会过期。"
              />
              <Card size="small" type="inner" title="点数大约可以做什么">
                <Space direction="vertical" size={6} style={{ width: '100%' }}>
                  <Typography.Text type="secondary">
                    以 1000 点为例，以下为理论最多数量，实际会受失败重试、任务配置和产物数量影响。
                  </Typography.Text>
                  <Space wrap size={[6, 6]}>
                    {aiPointProductExamples.map((item) => (
                      <Tag key={`${item.label}-${item.points}`}>
                        {item.label}：约 {Math.floor(1000 / item.points)}
                        {item.unit}
                      </Tag>
                    ))}
                  </Space>
                </Space>
              </Card>
              <Space wrap>
                {aiPointPurchaseOptions.map((points) => (
                  <Button
                    key={points}
                    icon={<CreditCardOutlined />}
                    type="primary"
                    disabled={Boolean(getAiPointPaymentDisabledReason())}
                    title={getAiPointPaymentDisabledReason()}
                    loading={payingAiPointAmount === points}
                    onClick={() => void createAiPointOrder(points)}
                  >
                    {points.toLocaleString()} 点 · {aiPointPriceText(points)}
                  </Button>
                ))}
              </Space>
              <Space.Compact style={{ maxWidth: 520, width: '100%' }}>
                <InputNumber
                  min={aiPointPurchaseMin}
                  max={aiPointPurchaseMax}
                  step={aiPointPurchaseStep}
                  value={customAiPointAmount}
                  addonAfter="点"
                  style={{ flex: 1 }}
                  onChange={(value) => {
                    if (typeof value === 'number') {
                      setCustomAiPointAmount(value);
                    }
                  }}
                />
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  disabled={Boolean(getAiPointPaymentDisabledReason())}
                  title={getAiPointPaymentDisabledReason()}
                  loading={payingAiPointAmount === customAiPointAmount}
                  onClick={() => void createAiPointOrder(customAiPointAmount)}
                >
                  自定义充值
                </Button>
              </Space.Compact>
            </Space>
          </Card>

          {!isEnterprisePlanCode(currentPlan.code) && personalMemberPlans.length > 0 ? (
            <Card title="个人会员" bordered={false}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Alert
                  showIcon
                  type="info"
                  message="开通会员后可使用数字工厂，每月含 1500 点月度 AI 点数。"
                  description="邀请码为选填项。使用有效会员邀请码开通会员，双方可获得 AI 点数奖励。"
                />
                <Input.Search
                  allowClear
                  value={memberReferralCode}
                  placeholder="邀请码（选填）"
                  enterButton="验证"
                  loading={isValidatingReferralCode}
                  onChange={(event) => {
                    setMemberReferralCode(event.target.value);
                    setReferralNotice('');
                  }}
                  onSearch={() => void validateMemberReferralCode()}
                />
                {referralNotice ? <Typography.Text type="secondary">{referralNotice}</Typography.Text> : null}
                <Row gutter={[16, 16]}>
                  {personalMemberPlans.map((plan) => {
                    const disabledReason = getPlanPaymentDisabledReason(plan, {
                      isApiFallback,
                      workspaceType: activeWorkspace.workspaceType,
                      isAlipayConfigured: Boolean(alipayStatus?.isConfigured)
                    });
                    const isCurrentPlan = plan.code === activeWorkspace.planCode;
                    return (
                      <Col key={plan.code} xs={24} md={12}>
                        <Card bordered size="small">
                          <Space direction="vertical" size={8} style={{ width: '100%' }}>
                            <Space size={8} wrap>
                              <Typography.Text strong>{plan.name}</Typography.Text>
                              {isCurrentPlan ? <Tag color="green">当前套餐</Tag> : null}
                            </Space>
                            <Typography.Title level={3} style={{ margin: 0 }}>
                              {planPriceText(plan)} / {billingCycleLabel(plan.billingCycle)}
                            </Typography.Title>
                            <Typography.Text type="secondary">
                              适合个人用户使用数字员工、数字工厂和官方通道 AI 能力。
                            </Typography.Text>
                            <Button
                              block
                              type={isCurrentPlan ? 'default' : 'primary'}
                              icon={<CreditCardOutlined />}
                              disabled={Boolean(disabledReason)}
                              title={disabledReason}
                              loading={payingPlanCode === plan.code}
                              onClick={() => void createAlipayOrder(plan)}
                            >
                              {isCurrentPlan ? `续费${billingCycleLabel(plan.billingCycle)}` : `开通${billingCycleLabel(plan.billingCycle)}`}
                            </Button>
                          </Space>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </Space>
            </Card>
          ) : null}

          <Card title="选择企业套餐" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="套餐费用不包含模型 API 调用费"
                description="QiuAI WorkOS 负责企业权限、设备容量、数字员工、数字工厂、知识库和任务管理；模型调用由用户在 PC 端自行配置供应商。年付按 10 个月计费，并可定制 1 个数字工厂。"
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
                            <Typography.Text>数字员工：全部开放</Typography.Text>
                            <Typography.Text>数字工厂：{digitalFactoryAccessText(group.key)}</Typography.Text>
                            <Typography.Text>年付权益：可定制 1 个数字工厂</Typography.Text>
                            <Typography.Text type="secondary">解释权以运营方为准</Typography.Text>
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

          <Card title="软件副驾" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="软件副驾正在接入中"
                description="当前仅展示产品目录，待真实软件连接器完成验证后再开放购买和设备授权。"
              />
              <Row gutter={[16, 16]}>
                {softwareCopilots.data.map((item) => {
                  const isPurchasable = item.product.status === 'ACTIVE';
                  const disabledReason = isPurchasable
                    ? getSoftwareCopilotPaymentDisabledReason(item)
                    : undefined;
                  const seatCount = softwareCopilotSeatCounts[item.product.code] ?? 1;
                  const monthlyPrice =
                    activeWorkspace.workspaceType === 'enterprise'
                      ? item.product.enterpriseMonthlyUnitPriceCents
                      : item.product.personalMonthlyPriceCents;
                  const annualPrice =
                    activeWorkspace.workspaceType === 'enterprise'
                      ? item.product.enterpriseAnnualUnitPriceCents
                      : item.product.personalAnnualPriceCents;

                  return (
                    <Col key={item.product.code} xs={24} md={12} xl={8}>
                      <Card bordered size="small">
                        <Space direction="vertical" size={10} style={{ width: '100%' }}>
                          <Space size={8} wrap>
                            <Typography.Text strong>{item.product.name}</Typography.Text>
                            <Tag>{item.product.category}</Tag>
                            {!isPurchasable ? <Tag color="gold">即将开放</Tag> : null}
                            {item.entitlement.seatLimit > 0 ? <Tag color="green">已购</Tag> : null}
                          </Space>
                          <Typography.Text type="secondary">{item.product.description}</Typography.Text>
                          <Space size={6} wrap>
                            {item.product.capabilities.map((capability) => (
                              <Tag key={capability}>{capability}</Tag>
                            ))}
                          </Space>
                          {isPurchasable ? (
                            <>
                              <Descriptions size="small" column={1}>
                                <Descriptions.Item label="月付">
                                  {softwareCopilotPriceText(monthlyPrice, item.product.currency)}
                                  {activeWorkspace.workspaceType === 'enterprise' ? ' / 设备' : ''}
                                </Descriptions.Item>
                                <Descriptions.Item label="年付">
                                  {softwareCopilotPriceText(annualPrice, item.product.currency)}
                                  {activeWorkspace.workspaceType === 'enterprise' ? ' / 设备' : ''}
                                </Descriptions.Item>
                                <Descriptions.Item label="席位">
                                  {item.entitlement.seatLimit > 0
                                    ? `${item.entitlement.assignedSeatCount}/${item.entitlement.seatLimit} 已分配`
                                    : '未购买'}
                                </Descriptions.Item>
                              </Descriptions>
                              {activeWorkspace.workspaceType === 'enterprise' ? (
                                <InputNumber
                                  min={1}
                                  max={500}
                                  value={seatCount}
                                  addonBefore="设备数量"
                                  style={{ width: '100%' }}
                                  onChange={(value) =>
                                    setSoftwareCopilotSeatCounts((current) => ({
                                      ...current,
                                      [item.product.code]: typeof value === 'number' ? value : 1
                                    }))
                                  }
                                />
                              ) : null}
                              <Space wrap>
                                <Button
                                  type="primary"
                                  icon={<CreditCardOutlined />}
                                  disabled={Boolean(disabledReason)}
                                  title={disabledReason}
                                  loading={payingSoftwareCopilotKey === `${item.product.code}:MONTHLY`}
                                  onClick={() => void createSoftwareCopilotAlipayOrder(item, 'MONTHLY')}
                                >
                                  月付购买
                                </Button>
                                <Button
                                  icon={<CreditCardOutlined />}
                                  disabled={Boolean(disabledReason)}
                                  title={disabledReason}
                                  loading={payingSoftwareCopilotKey === `${item.product.code}:ANNUAL`}
                                  onClick={() => void createSoftwareCopilotAlipayOrder(item, 'ANNUAL')}
                                >
                                  年付购买
                                </Button>
                              </Space>
                              {disabledReason ? (
                                <Typography.Text type="secondary">{disabledReason}</Typography.Text>
                              ) : null}
                            </>
                          ) : null}
                        </Space>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
              {softwareCopilots.data.length === 0 ? (
                <Alert showIcon type="warning" message="暂未读取到软件副驾目录" />
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
