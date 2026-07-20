'use client';

import type { CurrentAccountResponse, PlanDetail } from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Button from 'antd/es/button';
import Descriptions from 'antd/es/descriptions';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';

import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminPlansPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: PlanDetail[];
  isApiFallback: boolean;
}

function formatCurrency(amountCents?: number, currency = 'CNY') {
  if (!amountCents) {
    return '免费';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency
  }).format(amountCents / 100);
}

function billingCycleLabel(value: string) {
  return {
    FREE: '免费',
    MONTHLY: '月付',
    ANNUAL: '年付',
    CUSTOM: '定制'
  }[value] ?? value;
}

function planTone(plan: PlanDetail): 'default' | 'processing' | 'warning' {
  if (plan.billingCycle === 'FREE') return 'default';
  if (plan.billingCycle === 'CUSTOM') return 'warning';
  return 'processing';
}

export function AdminPlansPageClient({
  currentAccount,
  plans,
  isApiFallback
}: AdminPlansPageClientProps) {
  const paidPlans = plans.filter((plan) => plan.billingCycle === 'MONTHLY' || plan.billingCycle === 'ANNUAL');
  const customPlans = plans.filter((plan) => plan.billingCycle === 'CUSTOM');

  const columns: ColumnsType<PlanDetail> = [
    {
      title: '套餐',
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
      render: (_value, plan) => formatCurrency(plan.priceCents, plan.currency ?? 'CNY')
    },
    {
      title: '权益数',
      key: 'entitlements',
      render: (_value, plan) => plan.entitlements.length
    },
    {
      title: '状态',
      key: 'tone',
      render: (_value, plan) => <QiuStatusTag tone={planTone(plan)}>{billingCycleLabel(plan.billingCycle)}</QiuStatusTag>
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="套餐目录"
        description="套餐、权益和价格直接由服务端目录驱动。"
        actions={
          <Button href="/">返回总览</Button>
        }
      >
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <Card bordered={false}>
              <Descriptions column={1}>
                <Descriptions.Item label="套餐总数">{plans.length}</Descriptions.Item>
                <Descriptions.Item label="付费套餐">{paidPlans.length}</Descriptions.Item>
                <Descriptions.Item label="定制套餐">{customPlans.length}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card bordered={false}>
              <Typography.Text type="secondary">
                这是平台的商业目录视图，后续会继续承接模板、权限和套餐运营动作。
              </Typography.Text>
            </Card>
          </Col>
        </Row>

        <Card title="完整套餐目录" bordered={false}>
          <Table
            rowKey="code"
            columns={columns}
            dataSource={plans}
            pagination={false}
            expandable={{
              expandedRowRender: (plan) => (
                <Card bordered={false} size="small" style={{ background: '#f6f8fa' }}>
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="说明" span={2}>
                      {plan.description ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="适用版本">
                      {billingCycleLabel(plan.billingCycle)}
                    </Descriptions.Item>
                    <Descriptions.Item label="权益明细">
                      {plan.entitlements
                        .map((item) =>
                          `${item.featureKey}:${item.enabled ? 'on' : 'off'}${
                            item.limitValue !== undefined ? `(${item.limitValue}${item.limitUnit ?? ''})` : ''
                          }`
                        )
                        .join('，')}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              )
            }}
          />
        </Card>
      </QiuPage>
    </AdminShell>
  );
}
