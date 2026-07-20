'use client';

import type { CurrentAccountResponse, KernelStatusResponse, PlanDetail } from '@qiuai/api-contract';
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

import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminDashboardProps {
  currentAccount: CurrentAccountResponse;
  kernelStatus: KernelStatusResponse;
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

export function AdminDashboard({
  currentAccount,
  kernelStatus,
  plans,
  isApiFallback
}: AdminDashboardProps) {
  const activeWorkspace =
    currentAccount.workspaces.find((workspace) => workspace.id === currentAccount.activeWorkspaceId) ??
    currentAccount.workspaces[0];

  const planColumns: ColumnsType<PlanDetail> = [
    {
      title: '套餐代码',
      dataIndex: 'code'
    },
    {
      title: '名称',
      dataIndex: 'name'
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
      title: '说明',
      dataIndex: 'description',
      responsive: ['lg']
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="平台总览"
        description="平台运营后台只给内部使用，管理租户、套餐、部署和健康状态。"
        actions={
          <Space>
            <Button href="/plans">查看套餐目录</Button>
            <Button type="primary" href="/login?next=/">
              重新登录
            </Button>
          </Space>
        }
      >
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="平台状态"
              value={kernelStatus.status}
              trend={kernelStatus.databaseReady ? '数据库已就绪' : '数据库未就绪'}
            />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="持久化模式"
              value={kernelStatus.persistenceMode ?? 'unknown'}
              trend={kernelStatus.databaseProvider}
            />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard
              title="租户 / 工作空间"
              value={`${kernelStatus.databaseTenantCount ?? 0} / ${kernelStatus.databaseWorkspaceCount ?? 0}`}
              trend="数据库摘要"
            />
          </Col>
          <Col xs={24} md={12} xl={6}>
            <QiuMetricCard title="套餐目录" value={String(plans.length)} trend="可售版本" />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="Kernel 摘要" bordered={false}>
              <Descriptions column={1}>
                <Descriptions.Item label="数据模型版本">{kernelStatus.dataModelVersion}</Descriptions.Item>
                <Descriptions.Item label="Prisma 客户端版本">
                  {kernelStatus.prismaClientVersion}
                </Descriptions.Item>
                <Descriptions.Item label="数据库提供方">{kernelStatus.databaseProvider}</Descriptions.Item>
                <Descriptions.Item label="数据库计划数">
                  {kernelStatus.databasePlanCount ?? kernelStatus.plans.length}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="当前账号" bordered={false}>
              <Descriptions column={1}>
                <Descriptions.Item label="邮箱">{currentAccount.account.primaryEmail}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <QiuStatusTag tone={currentAccount.account.status === 'active' ? 'success' : 'warning'}>
                    {currentAccount.account.status}
                  </QiuStatusTag>
                </Descriptions.Item>
                <Descriptions.Item label="激活工作空间">
                  {activeWorkspace?.name ?? '-'}
                </Descriptions.Item>
                <Descriptions.Item label="工作空间数量">
                  {currentAccount.workspaces.length}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>

        <Card
          title="商业套餐预览"
          bordered={false}
          extra={<Typography.Text type="secondary">完整目录请进入套餐页面</Typography.Text>}
        >
          <Table rowKey="code" columns={planColumns} dataSource={plans.slice(0, 4)} pagination={false} />
        </Card>
      </QiuPage>
    </AdminShell>
  );
}
