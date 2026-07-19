'use client';

import type {
  CurrentAccountResponse,
  ListRoleTemplatesResponse,
  RoleInstanceSummary
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import List from 'antd/es/list';
import Row from 'antd/es/row';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { createBrowserApiClient } from '../../shared/api/browser-api';
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
  const [roles, setRoles] = useState(initialRoles);
  const [installingTemplateId, setInstallingTemplateId] = useState<string | null>(null);
  const workspaceId = currentAccount.activeWorkspaceId;
  const workspaceHref = (href: string) => withWorkspaceId(href, workspaceId);

  const roleCount = roles.length;
  const runningCount = useMemo(() => roles.filter((role) => role.status === 'running').length, [roles]);
  const monthlyCost = useMemo(
    () => roles.reduce((sum, role) => sum + role.kpis.monthlyCost, 0),
    [roles]
  );

  async function installRole(templateId: string) {
    setInstallingTemplateId(templateId);
    try {
      const response = await createBrowserApiClient().installRole(workspaceId, { templateId });
      setRoles((current) => [response.data, ...current]);
    } finally {
      setInstallingTemplateId(null);
    }
  }

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="AI 岗位" description="企业以岗位为核心安装、配置和管理数字员工。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据。" /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={8}>
            <QiuMetricCard title="已安装岗位" value={String(roleCount)} trend={`${runningCount} 个运行中`} />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="可安装模板" value={String(templates.data.length)} trend="行业岗位模板" />
          </Col>
          <Col xs={24} md={8}>
            <QiuMetricCard title="岗位月成本" value={`¥${monthlyCost.toFixed(2)}`} trend="来自真实成本记录" />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={14}>
            <Card title="已安装 AI 岗位" bordered={false}>
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
                      title={<Space><Typography.Text strong>{role.name}</Typography.Text><QiuStatusTag tone={roleTone(role.status)}>{roleLabel(role.status)}</QiuStatusTag></Space>}
                      description={`${role.departmentName || '未分配部门'} · ${role.ownerName} · 完成 ${role.kpis.taskCompleted} 个任务`}
                    />
                  </List.Item>
                )}
              />
            </Card>
          </Col>
          <Col xs={24} xl={10}>
            <Card title="岗位模板" bordered={false}>
              <List
                dataSource={templates.data}
                renderItem={(template) => (
                  <List.Item
                    actions={[
                      <Button
                        key="install"
                        type="link"
                        loading={installingTemplateId === template.id}
                        onClick={() => installRole(template.id)}
                      >
                        安装
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={template.name}
                      description={`${template.industry} · ${template.scenario}`}
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
