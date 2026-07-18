'use client';

import type { CurrentAccountResponse, TaskDetail } from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Empty from 'antd/es/empty';
import List from 'antd/es/list';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { useMemo } from 'react';

import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { taskPriorityLabel, taskStatusLabel, taskStatusTone } from '../tasks/task-format';

export interface ApprovalsPageClientProps {
  currentAccount: CurrentAccountResponse;
  taskDetails: TaskDetail[];
  isApiFallback: boolean;
}

export function ApprovalsPageClient({
  currentAccount,
  taskDetails,
  isApiFallback
}: ApprovalsPageClientProps) {
  const waitingTasks = useMemo(
    () => taskDetails.filter((task) => task.status === 'waiting_approval'),
    [taskDetails]
  );
  const urgentCount = waitingTasks.filter((task) => task.priority === 'urgent').length;
  const approvalArtifacts = waitingTasks.reduce((sum, task) => sum + task.artifacts.length, 0);

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="审批中心" description="集中查看需要人工确认的 AI 岗位任务和可验收产物。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <QiuMetricCard title="待审批任务" value={String(waitingTasks.length)} trend="waiting_approval" />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="紧急审批" value={String(urgentCount)} trend="优先处理" />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="待验收产物" value={String(approvalArtifacts)} trend="来自任务执行结果" />
          </Col>
        </Row>

        <Card title="审批队列" bordered={false}>
          {waitingTasks.length === 0 ? (
            <Empty description="暂无待审批任务" />
          ) : (
            <List
              dataSource={waitingTasks}
              renderItem={(task) => (
                <List.Item
                  actions={[
                    <Link key="detail" href={`/tasks/${task.id}`}>
                      查看任务
                    </Link>
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space wrap>
                        <Typography.Text strong>{task.title}</Typography.Text>
                        <QiuStatusTag tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</QiuStatusTag>
                        <Typography.Text type="secondary">优先级：{taskPriorityLabel(task.priority)}</Typography.Text>
                      </Space>
                    }
                    description={`${task.roleName} · ${task.artifacts.length} 个产物 · ${new Date(task.updatedAt).toLocaleString('zh-CN')}`}
                  />
                </List.Item>
              )}
            />
          )}
        </Card>
      </QiuPage>
    </ConsoleShell>
  );
}
