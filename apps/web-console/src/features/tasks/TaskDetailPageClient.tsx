'use client';

import type { CurrentAccountResponse, TaskDetail } from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Descriptions from 'antd/es/descriptions';
import List from 'antd/es/list';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Timeline from 'antd/es/timeline';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { formatCurrency, taskPriorityLabel, taskStatusLabel, taskStatusTone } from './task-format';

export interface TaskDetailPageClientProps {
  currentAccount: CurrentAccountResponse;
  initialTask: TaskDetail;
  isApiFallback: boolean;
}

function logColor(level: TaskDetail['executionLogs'][number]['level']) {
  if (level === 'error') return 'red';
  if (level === 'warning') return 'gold';
  return 'blue';
}

export function TaskDetailPageClient({
  currentAccount,
  initialTask,
  isApiFallback
}: TaskDetailPageClientProps) {
  const [task, setTask] = useState(initialTask);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const workspaceId = currentAccount.activeWorkspaceId;

  const totalCost = useMemo(
    () => task.costRecords.reduce((sum, item) => sum + item.totalCost, 0),
    [task.costRecords]
  );

  const costColumns: ColumnsType<TaskDetail['costRecords'][number]> = [
    { title: '模型', dataIndex: 'modelName' },
    { title: '输入 Token', dataIndex: 'inputTokens', responsive: ['md'] },
    { title: '输出 Token', dataIndex: 'outputTokens', responsive: ['md'] },
    {
      title: '成本',
      dataIndex: 'totalCost',
      render: (value: number, record) => formatCurrency(value, record.currency)
    },
    {
      title: '时间',
      dataIndex: 'createdAt',
      responsive: ['lg'],
      render: (value: string) => new Date(value).toLocaleString('zh-CN')
    }
  ];

  async function runTask() {
    setErrorMessage(null);
    setIsRunning(true);
    try {
      const response = await createBrowserApiClient().runTask(workspaceId, task.id);
      setTask(response.data);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '执行任务失败，请确认后端服务已启动。');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title={task.title}
        description={`${task.roleName} · ${task.taskType}`}
        actions={
          <Space>
            <Link href="/tasks">返回任务中心</Link>
            <Button type="primary" onClick={runTask} loading={isRunning}>
              Mock 执行
            </Button>
          </Space>
        }
      >
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据，执行任务需要启动后端。" /> : null}
        {errorMessage ? <Alert showIcon type="error" message={errorMessage} /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <QiuMetricCard title="任务状态" value={taskStatusLabel(task.status)} />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="产物数量" value={String(task.artifacts.length)} />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="日志数量" value={String(task.executionLogs.length)} />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="任务成本" value={formatCurrency(totalCost, task.costRecords[0]?.currency)} />
          </Col>
        </Row>

        <Card bordered={false}>
          <Descriptions
            column={2}
            title={
              <Space>
                任务信息
                <QiuStatusTag tone={taskStatusTone(task.status)}>{taskStatusLabel(task.status)}</QiuStatusTag>
              </Space>
            }
          >
            <Descriptions.Item label="执行岗位">{task.roleName}</Descriptions.Item>
            <Descriptions.Item label="优先级">{taskPriorityLabel(task.priority)}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{new Date(task.createdAt).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{new Date(task.updatedAt).toLocaleString('zh-CN')}</Descriptions.Item>
            <Descriptions.Item label="当前 Run">{task.currentRun?.id || '尚未创建'}</Descriptions.Item>
            <Descriptions.Item label="Run 状态">{task.currentRun?.status || '无'}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={10}>
            <Card title="任务输入" bordered={false}>
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {task.input}
              </Typography.Paragraph>
            </Card>
          </Col>
          <Col xs={24} xl={14}>
            <Card title="执行日志" bordered={false}>
              <Timeline
                items={task.executionLogs.map((log) => ({
                  color: logColor(log.level),
                  children: (
                    <Space direction="vertical" size={2}>
                      <Typography.Text strong>{log.eventType}</Typography.Text>
                      <Typography.Text>{log.message}</Typography.Text>
                      <Typography.Text type="secondary">{new Date(log.createdAt).toLocaleString('zh-CN')}</Typography.Text>
                    </Space>
                  )
                }))}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="执行产物" bordered={false}>
              <List
                locale={{ emptyText: '暂无产物，点击 Mock 执行后生成。' }}
                dataSource={task.artifacts}
                renderItem={(artifact) => (
                  <List.Item>
                    <List.Item.Meta
                      title={`${artifact.title} / ${artifact.type}`}
                      description={
                        <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                          {artifact.content}
                        </Typography.Paragraph>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="成本记录" bordered={false}>
              <Table
                rowKey="id"
                columns={costColumns}
                dataSource={task.costRecords}
                pagination={false}
                locale={{ emptyText: '暂无成本记录。' }}
              />
            </Card>
          </Col>
        </Row>
      </QiuPage>
    </ConsoleShell>
  );
}
