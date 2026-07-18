'use client';

import {
  ApartmentOutlined,
  AuditOutlined,
  DollarOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { QiuWorkspaceSwitcher } from '@qiuai/ui';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ReactNode } from 'react';

export interface ConsoleShellProps {
  currentAccount: CurrentAccountResponse;
  children: ReactNode;
}

function selectedKey(pathname: string) {
  if (pathname.startsWith('/roles')) return 'roles';
  if (pathname.startsWith('/tasks')) return 'tasks';
  if (pathname.startsWith('/approvals')) return 'approvals';
  if (pathname.startsWith('/costs')) return 'costs';
  if (pathname.startsWith('/enterprise')) return 'enterprise';
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export function ConsoleShell({ currentAccount, children }: ConsoleShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeWorkspaceId = searchParams.get('workspaceId') ?? currentAccount.activeWorkspaceId;

  function withWorkspaceId(href: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('workspaceId', activeWorkspaceId);
    const query = params.toString();
    return query ? `${href}?${query}` : href;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={252} theme="light" style={{ borderRight: '1px solid #d0d7de' }}>
        <div style={{ padding: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            QiuAI WorkOS
          </Typography.Title>
          <Typography.Text type="secondary">企业数字劳动力平台</Typography.Text>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <QiuWorkspaceSwitcher
            value={activeWorkspaceId}
            workspaces={currentAccount.workspaces.map((workspace) => ({
              id: workspace.id,
              name: workspace.name
            }))}
            onChange={(workspaceId) => {
              const params = new URLSearchParams(searchParams.toString());
              params.set('workspaceId', workspaceId);
              router.push(`${pathname}?${params.toString()}`);
            }}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey(pathname)]}
          items={[
            {
              key: 'dashboard',
              icon: <ApartmentOutlined />,
              label: <Link href={withWorkspaceId('/')}>工作台</Link>
            },
            {
              key: 'roles',
              icon: <RobotOutlined />,
              label: <Link href={withWorkspaceId('/roles')}>AI 岗位</Link>
            },
            {
              key: 'tasks',
              icon: <UnorderedListOutlined />,
              label: <Link href={withWorkspaceId('/tasks')}>任务中心</Link>
            },
            {
              key: 'approvals',
              icon: <AuditOutlined />,
              label: <Link href={withWorkspaceId('/approvals')}>审批中心</Link>
            },
            {
              key: 'costs',
              icon: <DollarOutlined />,
              label: <Link href={withWorkspaceId('/costs')}>成本中心</Link>
            },
            {
              key: 'enterprise',
              icon: <TeamOutlined />,
              label: <Link href={withWorkspaceId('/enterprise')}>企业控制面</Link>
            },
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: <Link href={withWorkspaceId('/settings')}>企业设置</Link>
            }
          ]}
        />
      </Layout.Sider>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
