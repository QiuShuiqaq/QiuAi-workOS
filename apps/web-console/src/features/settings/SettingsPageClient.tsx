'use client';

import { CreditCardOutlined, DesktopOutlined, EditOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons';
import type {
  BillingOrderSummary,
  BillingOverview,
  CurrentAccountResponse,
  CreateDesktopBindingCodeResponse,
  DesktopBindingCodeSummary,
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
import Input from 'antd/es/input';
import message from 'antd/es/message';
import Modal from 'antd/es/modal';
import Popconfirm from 'antd/es/popconfirm';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { withWorkspaceId } from '../common/workspace-href';

export interface SettingsPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: PlanDetail[];
  billing: BillingOverview;
  desktopDevices: DesktopDeviceSummary[];
  desktopBindingCodes: DesktopBindingCodeSummary[];
  isApiFallback: boolean;
}

const featureLabels: Record<string, string> = {
  maxRoleInstances: '数字员工数量',
  maxDesktopDevices: '桌面端设备数量'
};

const visiblePlanFeatureKeys = ['maxDesktopDevices', 'maxRoleInstances'];

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

function bindingCodeStatusTone(status: DesktopBindingCodeSummary['status']) {
  if (status === 'PENDING') return 'processing';
  if (status === 'REDEEMED') return 'success';
  if (status === 'EXPIRED') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'default';
}

function configStatusText(provider?: PaymentProviderConfigStatus) {
  if (!provider) return '未配置';
  return provider.isConfigured ? '已配置' : '未完成';
}

export function SettingsPageClient({
  currentAccount,
  plans,
  billing,
  desktopDevices,
  desktopBindingCodes,
  isApiFallback
}: SettingsPageClientProps) {
  const router = useRouter();
  const [isCreatingBindingCode, setIsCreatingBindingCode] = useState(false);
  const [latestBindingCode, setLatestBindingCode] =
    useState<CreateDesktopBindingCodeResponse['data'] | null>(null);
  const activeWorkspace = currentAccount.workspaces.find(
    (workspace) => workspace.id === currentAccount.activeWorkspaceId
  ) ?? currentAccount.workspaces[0];
  const currentPlan = plans.find((plan) => plan.code === activeWorkspace.planCode) ?? plans[0];
  const alipayStatus = billing.paymentProviders.find((provider) => provider.provider === 'ALIPAY');
  const missingAlipayKeys = alipayStatus?.missingEnvKeys.join(', ') || '-';
  const purchaseHref = withWorkspaceId('/purchase', activeWorkspace.id);

  async function createDesktopBindingCode() {
    if (isApiFallback) {
      message.warning('后端 API 未连接，无法生成授权码');
      return;
    }

    setIsCreatingBindingCode(true);
    try {
      const response = await createBrowserApiClient().createDesktopBindingCode(activeWorkspace.id, {
        label: `设备授权 ${new Intl.DateTimeFormat('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(new Date())}`
      });
      setLatestBindingCode(response.data);
      message.success('授权码已生成');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '生成授权码失败');
    } finally {
      setIsCreatingBindingCode(false);
    }
  }

  function renameDesktopBindingCode(bindingCode: DesktopBindingCodeSummary) {
    let nextLabel = bindingCode.label ?? '';

    Modal.confirm({
      title: '修改授权码备注',
      content: (
        <Input
          defaultValue={nextLabel}
          placeholder="例如：财务电脑、前台电脑、销售电脑"
          onChange={(event) => {
            nextLabel = event.target.value;
          }}
        />
      ),
      okText: '保存',
      cancelText: '取消',
      async onOk() {
        try {
          await createBrowserApiClient().updateDesktopBindingCode(activeWorkspace.id, bindingCode.id, {
            label: nextLabel.trim() || undefined
          });
          message.success('备注已更新');
          router.refresh();
        } catch (error) {
          message.error(error instanceof Error ? error.message : '更新备注失败');
          throw error;
        }
      }
    });
  }

  async function cancelDesktopBindingCode(bindingCode: DesktopBindingCodeSummary) {
    try {
      await createBrowserApiClient().cancelDesktopBindingCode(activeWorkspace.id, bindingCode.id);
      message.success('授权码已作废');
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '作废授权码失败');
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
      responsive: ['lg'],
      render: (value: string) => formatDateTime(value)
    }
  ];

  const desktopBindingCodeColumns: ColumnsType<DesktopBindingCodeSummary> = [
    {
      title: '备注',
      key: 'label',
      render: (_value, bindingCode) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{bindingCode.label ?? '未命名授权码'}</Typography.Text>
          <Typography.Text type="secondary">{bindingCode.id}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: DesktopBindingCodeSummary['status']) => (
        <QiuStatusTag tone={bindingCodeStatusTone(status)}>{status}</QiuStatusTag>
      )
    },
    {
      title: '有效期',
      dataIndex: 'expiresAt',
      responsive: ['md'],
      render: (value?: string) => (value ? formatDateTime(value) : '长期有效')
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (value: string) => formatDateTime(value)
    },
    {
      title: '使用时间',
      dataIndex: 'redeemedAt',
      responsive: ['lg'],
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, bindingCode) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            size="small"
            disabled={bindingCode.status !== 'PENDING'}
            onClick={() => renameDesktopBindingCode(bindingCode)}
          >
            备注
          </Button>
          <Popconfirm
            title="确认作废这个授权码？"
            description="作废后，桌面端不能再用这个码完成绑定。"
            okText="作废"
            cancelText="取消"
            disabled={bindingCode.status !== 'PENDING'}
            onConfirm={() => cancelDesktopBindingCode(bindingCode)}
          >
            <Button
              danger
              icon={<StopOutlined />}
              size="small"
              disabled={bindingCode.status !== 'PENDING'}
            >
              作废
            </Button>
          </Popconfirm>
        </Space>
      )
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
      <QiuPage title="企业设置" description="管理工作空间信息和桌面端设备授权。">
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
                  dataSource={currentPlan.entitlements.filter((entitlement) =>
                    visiblePlanFeatureKeys.includes(entitlement.featureKey)
                  )}
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

          <Card title="购买中心" bordered={false}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="购买和续费已迁移到独立页面。"
                description="套餐购买、续费、支付订单和支付状态统一在购买中心维护；企业设置只保留设备授权和基础信息。"
              />
              <Button type="primary" icon={<CreditCardOutlined />} href={purchaseHref}>
                打开购买中心
              </Button>
            </Space>
          </Card>

          <Card
            title="设备授权码"
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
                  生成授权码
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Alert
                showIcon
                type="info"
                message="授权码长期有效，兑换后自动标记为已使用。完整授权码只在创建成功时显示一次。"
              />
              <Table
                rowKey="id"
                columns={desktopBindingCodeColumns}
                dataSource={desktopBindingCodes}
                pagination={false}
                locale={{ emptyText: '当前还没有设备授权码' }}
              />
            </Space>
          </Card>

          <Card title="已绑定设备" bordered={false}>
            <Table
              rowKey="id"
              columns={desktopDeviceColumns}
              dataSource={desktopDevices}
              pagination={false}
              locale={{ emptyText: '当前还没有绑定的桌面设备' }}
            />
          </Card>
        </Space>

        <Modal
          title="设备授权码"
          open={Boolean(latestBindingCode)}
          onCancel={() => setLatestBindingCode(null)}
          onOk={() => setLatestBindingCode(null)}
          okText="关闭"
          cancelButtonProps={{ style: { display: 'none' } }}
        >
          {latestBindingCode ? (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Typography.Paragraph>
                将下面的授权码输入到桌面端完成绑定。请现在复制保存，关闭后不会再次显示完整码。
              </Typography.Paragraph>
              <Typography.Title level={3} style={{ margin: 0 }} copyable>
                {latestBindingCode.bindingCode}
              </Typography.Title>
              <Descriptions size="small" column={1}>
                <Descriptions.Item label="备注">{latestBindingCode.label ?? '-'}</Descriptions.Item>
                <Descriptions.Item label="工作区">{latestBindingCode.workspaceId}</Descriptions.Item>
                <Descriptions.Item label="有效期">
                  {latestBindingCode.expiresAt ? formatDateTime(latestBindingCode.expiresAt) : '长期有效'}
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
