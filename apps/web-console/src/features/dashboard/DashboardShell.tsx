'use client';

import type { CurrentAccountResponse, PlatformOverviewResponse } from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Badge from 'antd/es/badge';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Flex from 'antd/es/flex';
import List from 'antd/es/list';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import Link from 'next/link';

import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { withWorkspaceId } from '../common/workspace-href';

export interface DashboardShellProps {
  currentAccount: CurrentAccountResponse;
  overview: PlatformOverviewResponse;
  isApiFallback: boolean;
}

function roleTone(status: PlatformOverviewResponse['roles'][number]['status']) {
  if (status === 'running') return 'success';
  if (status === 'trial') return 'processing';
  if (status === 'paused') return 'default';
  return 'warning';
}

function roleStatusLabel(status: PlatformOverviewResponse['roles'][number]['status']) {
  const labels = {
    running: '运行中',
    trial: '试运行',
    configuration_required: '待配置',
    paused: '已暂停'
  };
  return labels[status];
}

function taskBadgeStatus(state: PlatformOverviewResponse['tasks'][number]['state']) {
  if (state === 'completed') return 'success';
  if (state === 'running') return 'processing';
  if (state === 'failed') return 'error';
  return 'warning';
}

function taskStateLabel(state: PlatformOverviewResponse['tasks'][number]['state']) {
  const labels = {
    completed: '已完成',
    running: '执行中',
    waiting_approval: '待审批',
    failed: '失败'
  };
  return labels[state];
}

export function DashboardShell({ currentAccount, overview, isApiFallback }: DashboardShellProps) {
  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title="企业工作台"
        description={`当前空间：${overview.workspace.name} · ${overview.workspace.planCode}`}
        actions={
          <Link href={withWorkspaceId('/roles', currentAccount.activeWorkspaceId)}>
            <Button type="primary">安装 AI 岗位</Button>
          </Link>
        }
      >
        {isApiFallback ? (
          <Alert showIcon type="warning" message="后端 API 未连接，当前显示前端 fallback 数据。" />
        ) : null}

        <Row gutter={[16, 16]}>
          {overview.metrics.map((metric) => (
            <Col key={metric.key} xs={24} md={12} xl={6}>
              <QiuMetricCard title={metric.title} value={metric.value} trend={metric.trend} />
            </Col>
          ))}
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="岗位运行" bordered={false}>
              <List
                dataSource={overview.roles}
                renderItem={(role) => (
                  <List.Item>
                    <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                      <Space direction="vertical" size={2}>
                        <Typography.Text strong>{role.name}</Typography.Text>
                        <Typography.Text type="secondary">{role.departmentName}</Typography.Text>
                      </Space>
                      <QiuStatusTag tone={roleTone(role.status)}>{roleStatusLabel(role.status)}</QiuStatusTag>
                    </Flex>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={12}>
            <Card title="最近任务" bordered={false}>
              <List
                dataSource={overview.tasks}
                renderItem={(task) => (
                  <List.Item>
                    <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                      <Space direction="vertical" size={2}>
                        <Link href={withWorkspaceId(`/tasks/${task.id}`, currentAccount.activeWorkspaceId)}>
                          <Typography.Text strong>{task.title}</Typography.Text>
                        </Link>
                        <Typography.Text type="secondary">{task.roleName}</Typography.Text>
                      </Space>
                      <Badge status={taskBadgeStatus(task.state)} text={taskStateLabel(task.state)} />
                    </Flex>
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
      </QiuPage>
    </ConsoleShell>
  );
}
