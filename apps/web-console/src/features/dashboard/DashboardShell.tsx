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

interface ReadinessItem {
  title: string;
  description: string;
  href: string;
  action: string;
  status: string;
  tone: 'success' | 'warning' | 'processing';
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
  const workspaceId = currentAccount.activeWorkspaceId;
  const workspaceHref = (href: string) => withWorkspaceId(href, workspaceId);
  const failedTaskCount = overview.tasks.filter((task) => task.state === 'failed').length;
  const waitingTaskCount = overview.tasks.filter((task) => task.state === 'waiting_approval').length;
  const pendingRoleCount = overview.roles.filter((role) => role.status === 'configuration_required').length;
  const runningRoleCount = overview.roles.filter((role) => role.status === 'running').length;
  const readinessItems: ReadinessItem[] = [
    {
      title: '确认企业套餐',
      description: '查看当前企业空间的套餐、有效期和每台设备可使用的容量。',
      href: workspaceHref('/purchase'),
      action: '查看套餐',
      status: overview.workspace.planCode === 'PERSONAL_FREE' ? '建议升级' : '已开通',
      tone: overview.workspace.planCode === 'PERSONAL_FREE' ? 'warning' : 'success'
    },
    {
      title: '绑定 PC 设备',
      description: '在企业端生成设备授权码，再到 PC 桌面端完成绑定。',
      href: workspaceHref('/settings'),
      action: '管理设备',
      status: '需要确认',
      tone: 'processing'
    },
    {
      title: '维护企业知识库',
      description: '上传一份完整 PDF，并在 PC 端任务执行时按需启用知识库。',
      href: workspaceHref('/knowledge'),
      action: '配置知识库',
      status: '建议配置',
      tone: 'processing'
    },
    {
      title: '检查数字员工状态',
      description: '重点处理待配置、执行失败和需要人工复核的任务。',
      href: workspaceHref('/roles'),
      action: '查看数字员工',
      status: pendingRoleCount > 0 ? `${pendingRoleCount} 个待配置` : `${runningRoleCount} 个运行中`,
      tone: pendingRoleCount > 0 ? 'warning' : 'success'
    }
  ];

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage
        title="企业工作台"
        description={`查看企业套餐、设备授权、知识库、数字员工和任务状态 · ${overview.workspace.name}`}
        actions={
          <Space>
            <Link href={workspaceHref('/purchase')}>
              <Button type="primary">套餐与购买</Button>
            </Link>
            <Link href={workspaceHref('/settings')}>
              <Button>设备与授权</Button>
            </Link>
          </Space>
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
          <Col xs={24} xl={16}>
            <Card title="企业上线检查" bordered={false}>
              <List
                dataSource={readinessItems}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      <Link key={item.href} href={item.href}>
                        {item.action}
                      </Link>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <QiuStatusTag tone={item.tone}>{item.status}</QiuStatusTag>
                        </Space>
                      }
                      description={item.description}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card title="需要关注" bordered={false}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Flex justify="space-between">
                  <Typography.Text type="secondary">待人工处理任务</Typography.Text>
                  <Typography.Text strong>{waitingTaskCount}</Typography.Text>
                </Flex>
                <Flex justify="space-between">
                  <Typography.Text type="secondary">失败任务</Typography.Text>
                  <Typography.Text strong>{failedTaskCount}</Typography.Text>
                </Flex>
                <Flex justify="space-between">
                  <Typography.Text type="secondary">待配置数字员工</Typography.Text>
                  <Typography.Text strong>{pendingRoleCount}</Typography.Text>
                </Flex>
                <Typography.Text type="secondary">
                  企业端负责看状态和管授权，具体任务执行、模型配置和产物下载仍在 PC 桌面端完成。
                </Typography.Text>
              </Space>
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={12}>
            <Card title="数字员工状态" bordered={false}>
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
            <Card title="最近任务状态" bordered={false}>
              <List
                dataSource={overview.tasks}
                renderItem={(task) => (
                  <List.Item>
                    <Flex justify="space-between" align="center" style={{ width: '100%' }}>
                      <Space direction="vertical" size={2}>
                        <Typography.Text strong>{task.title}</Typography.Text>
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
