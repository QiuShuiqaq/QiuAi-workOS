'use client';

import {
  ApartmentOutlined,
  AuditOutlined,
  DollarOutlined,
  RobotOutlined,
  SettingOutlined,
  UnorderedListOutlined
} from '@ant-design/icons';
import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { QiuWorkspaceSwitcher } from '@qiuai/ui';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  if (pathname.startsWith('/settings')) return 'settings';
  return 'dashboard';
}

export function ConsoleShell({ currentAccount, children }: ConsoleShellProps) {
  const pathname = usePathname();

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
            value={currentAccount.activeWorkspaceId}
            workspaces={currentAccount.workspaces.map((workspace) => ({
              id: workspace.id,
              name: workspace.name
            }))}
            onChange={() => {}}
          />
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey(pathname)]}
          items={[
            { key: 'dashboard', icon: <ApartmentOutlined />, label: <Link href="/">工作台</Link> },
            { key: 'roles', icon: <RobotOutlined />, label: <Link href="/roles">AI 岗位</Link> },
            { key: 'tasks', icon: <UnorderedListOutlined />, label: <Link href="/tasks">任务中心</Link> },
            { key: 'approvals', icon: <AuditOutlined />, label: <Link href="/approvals">审批中心</Link> },
            { key: 'costs', icon: <DollarOutlined />, label: <Link href="/costs">成本中心</Link> },
            { key: 'settings', icon: <SettingOutlined />, label: <Link href="/settings">企业设置</Link> }
          ]}
        />
      </Layout.Sider>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
