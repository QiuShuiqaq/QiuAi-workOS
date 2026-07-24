'use client';

import type {
  CurrentAccountResponse,
  ListRoleTemplatesResponse,
  RoleInstanceSummary
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
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
  templates: ListRoleTemplatesResponse;
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
  templates,
  isApiFallback
}: RolesPageClientProps) {
  const roles = initialRoles;
  const workspaceId = currentAccount.activeWorkspaceId;
  const workspaceHref = (href: string) => withWorkspaceId(href, workspaceId);

  const roleCount = roles.length;
  const runningCount = useMemo(() => roles.filter((role) => role.status === 'running').length, [roles]);
  const monthlyCost = useMemo(() => roles.reduce((sum, role) => sum + role.kpis.monthlyCost, 0), [roles]);

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="数字员工" description="查看本企业已安装和可用的数字员工。安装和执行在 PC 端完成。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <QiuMetricCard title="已安装" value={String(roleCount)} trend={`${runningCount} 个运行中`} />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="可用" value={String(templates.data.length)} trend="由平台上架" />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="月成本" value={`¥${monthlyCost.toFixed(2)}`} trend="来自任务记录" />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card title="已安装" bordered={false}>
              <List
                dataSource={roles}
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
          <Col xs={24} xl={10}>
            <Card title="可用员工" bordered={false}>
              <List
                dataSource={templates.data}
                renderItem={(template) => (
                  <List.Item
                    actions={[<Typography.Text key="install-on-pc" type="secondary">PC 端安装</Typography.Text>]}
                  >
                    <List.Item.Meta
                      title={
                        <Space size={8} wrap>
                          <Typography.Text strong>{template.name}</Typography.Text>
                          <Tag color="blue">v{template.version}</Tag>
                          <Tag color="geekblue">{template.recommendedPlanCode}</Tag>
                        </Space>
                      }
                      description={
                        <Space direction="vertical" size={4}>
                          <Typography.Text type="secondary">
                            {template.industry} · {template.scenario}
                          </Typography.Text>
                          <Typography.Text type="secondary">{template.description}</Typography.Text>
                          <Space size={6} wrap>
                            {template.skills.slice(0, 4).map((skill) => (
                              <Tag key={`${template.id}-${skill.code}`}>{skill.name}</Tag>
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
        </Row>
      </QiuPage>
    </ConsoleShell>
  );
}
