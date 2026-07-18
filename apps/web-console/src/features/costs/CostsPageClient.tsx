'use client';

import type { CostRecordSummary, CurrentAccountResponse, TaskDetail } from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Row from 'antd/es/row';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { useMemo } from 'react';

import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { formatCurrency } from '../tasks/task-format';

export interface CostsPageClientProps {
  currentAccount: CurrentAccountResponse;
  taskDetails: TaskDetail[];
  isApiFallback: boolean;
}

interface CostRow extends CostRecordSummary {
  taskId: string;
  taskTitle: string;
  roleName: string;
}

export function CostsPageClient({ currentAccount, taskDetails, isApiFallback }: CostsPageClientProps) {
  const rows = useMemo(
    () =>
      taskDetails.flatMap((task) =>
        task.costRecords.map((record) => ({
          ...record,
          taskId: task.id,
          taskTitle: task.title,
          roleName: task.roleName
        }))
      ),
    [taskDetails]
  );

  const totalCost = rows.reduce((sum, row) => sum + row.totalCost, 0);
  const totalInputTokens = rows.reduce((sum, row) => sum + row.inputTokens, 0);
  const totalOutputTokens = rows.reduce((sum, row) => sum + row.outputTokens, 0);
  const currency = rows[0]?.currency ?? 'CNY';

  const columns: ColumnsType<CostRow> = [
    {
      title: '任务',
      dataIndex: 'taskTitle',
      render: (_value, row) => (
        <Link href={`/tasks/${row.taskId}`}>
          <Typography.Text strong>{row.taskTitle}</Typography.Text>
        </Link>
      )
    },
    { title: 'AI 岗位', dataIndex: 'roleName', responsive: ['md'] },
    { title: '模型', dataIndex: 'modelName' },
    { title: '输入 Token', dataIndex: 'inputTokens', responsive: ['lg'] },
    { title: '输出 Token', dataIndex: 'outputTokens', responsive: ['lg'] },
    {
      title: '成本',
      dataIndex: 'totalCost',
      render: (value: number, row) => formatCurrency(value, row.currency)
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      responsive: ['xl'],
      render: (value: string) => new Date(value).toLocaleString('zh-CN')
    }
  ];

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="成本中心" description="按任务汇总模型调用、Token 消耗和执行成本。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <QiuMetricCard title="总成本" value={formatCurrency(totalCost, currency)} trend="当前任务样本" />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="调用记录" value={String(rows.length)} trend="costRecords" />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="输入 Token" value={totalInputTokens.toLocaleString('zh-CN')} />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="输出 Token" value={totalOutputTokens.toLocaleString('zh-CN')} />
          </Col>
        </Row>

        <Card title="成本明细" bordered={false}>
          <Table rowKey="id" columns={columns} dataSource={rows} pagination={false} />
        </Card>
      </QiuPage>
    </ConsoleShell>
  );
}
