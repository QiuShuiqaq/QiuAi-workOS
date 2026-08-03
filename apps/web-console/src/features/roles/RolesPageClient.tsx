'use client';

import type {
  CurrentAccountResponse,
  RoleInstanceSummary
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Empty from 'antd/es/empty';
import List from 'antd/es/list';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { useMemo } from 'react';

import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { withWorkspaceId } from '../common/workspace-href';

export interface RolesPageClientProps {
  currentAccount: CurrentAccountResponse;
  initialRoles: RoleInstanceSummary[];
  isApiFallback: boolean;
}

function roleTone(status: RoleInstanceSummary['status']) {
  if (status === 'running') return 'success';
  if (status === 'trial') return 'processing';
  if (status === 'paused') return 'default';
  return 'warning';
}

function roleLabel(status: RoleInstanceSummary['status']) {
  return {
    running: '运行中',
    trial: '试运行',
    configuration_required: '待配置',
    paused: '已暂停'
  }[status];
}

export function RolesPageClient({
  currentAccount,
  initialRoles,
  isApiFallback
}: RolesPageClientProps) {
  const roles = initialRoles;
  const workspaceId = currentAccount.activeWorkspaceId;
  const workspaceHref = (href: string) => withWorkspaceId(href, workspaceId);

  const roleCount = roles.length;
  const runningCount = useMemo(() => roles.filter((role) => role.status === 'running').length, [roles]);
  const pendingCount = useMemo(
    () => roles.filter((role) => role.status === 'configuration_required' || role.status === 'trial').length,
    [roles]
  );
  const monthlyCost = useMemo(() => roles.reduce((sum, role) => sum + role.kpis.monthlyCost, 0), [roles]);
  const completedTasks = useMemo(
    () => roles.reduce((sum, role) => sum + role.kpis.taskCompleted, 0),
    [roles]
  );

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="数字员工" description="查看本企业已安装数字员工的可用状态、任务统计和配置风险。安装、模型配置和任务执行在 PC 端完成。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <QiuMetricCard title="已安装" value={String(roleCount)} trend={`${runningCount} 个运行中`} />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="需要关注" value={String(pendingCount)} trend="试运行或待配置" />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="已完成任务" value={String(completedTasks)} trend={`月成本 ¥${monthlyCost.toFixed(2)}`} />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={16}>
            <Card title="已安装数字员工" bordered={false}>
              <List
                dataSource={roles}
                locale={{
                  emptyText: <Empty description="暂无已安装数字员工" />
                }}
                renderItem={(role) => (
                  <List.Item
                    actions={[
                      <Link key="detail" href={workspaceHref(`/roles/${role.id}`)}>
                        查看
                      </Link>
                    ]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{role.name}</Typography.Text>
                          <QiuStatusTag tone={roleTone(role.status)}>{roleLabel(role.status)}</QiuStatusTag>
                          <Tag color="blue">v{role.templateVersion}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Typography.Text type="secondary">
                            {role.departmentName || '未分配部门'} · {role.ownerName} · 完成 {role.kpis.taskCompleted} 个任务
                          </Typography.Text>
                          <Space size={6} wrap>
                            {role.skills.slice(0, 4).map((skill) => (
                              <Tag key={`${role.id}-${skill.code}`}>{skill.name}</Tag>
                            ))}
                          </Space>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={8}>
            <Card title="操作边界" bordered={false}>
              <Space direction="vertical" size={12}>
                <Typography.Text strong>PC 端负责安装和执行</Typography.Text>
                <Typography.Text type="secondary">
                  admin-console 上架的数字员工会进入 PC 端数字市场。企业成员在 PC 端安装、配置模型和工具，并通过对话发布任务。
                </Typography.Text>
                <Typography.Text strong>web-console 负责企业管理</Typography.Text>
                <Typography.Text type="secondary">
                  这里保留运行状态、配置风险、知识库、设备授权和套餐入口，不替代 PC 端的任务操作界面。
                </Typography.Text>
              </Space>
            </Card>
          </Col>
        </Row>
      </QiuPage>
    </ConsoleShell>
  );
}
