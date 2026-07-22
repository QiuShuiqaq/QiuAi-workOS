'use client';

import {
  ApartmentOutlined,
  AuditOutlined,
  DashboardOutlined,
  DollarOutlined,
  LogoutOutlined,
  SafetyOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { QiuStatusTag } from '@qiuai/ui';
import Button from 'antd/es/button';
import Flex from 'antd/es/flex';
import Layout from 'antd/es/layout';
import Menu from 'antd/es/menu';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { createBrowserApiClient } from '../api/browser-api';

export interface AdminShellProps {
  currentAccount: CurrentAccountResponse;
  children: ReactNode;
}

function selectedKey(pathname: string) {
  if (pathname.startsWith('/plans')) return 'plans';
  if (pathname.startsWith('/workspaces')) return 'workspaces';
  if (pathname.startsWith('/audit')) return 'audit';
  return 'dashboard';
}

export function AdminShell({ currentAccount, children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const activeWorkspace = useMemo(
    () =>
      currentAccount.workspaces.find((workspace) => workspace.id === currentAccount.activeWorkspaceId) ??
      currentAccount.workspaces[0],
    [currentAccount]
  );

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await createBrowserApiClient().logout();
    } finally {
      setIsLoggingOut(false);
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      router.refresh();
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Sider width={252} theme="light" style={{ borderRight: '1px solid #d0d7de' }}>
        <div style={{ padding: 20 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>
            QiuAI Admin
          </Typography.Title>
          <Typography.Text type="secondary">平台运营后台</Typography.Text>
        </div>
        <div style={{ padding: '0 16px 16px' }}>
          <Flex vertical gap={8} style={{ padding: 12, border: '1px solid #d0d7de', borderRadius: 8 }}>
            <Flex align="center" gap={8}>
              <UserOutlined />
              <Typography.Text strong ellipsis>
                {currentAccount.account.primaryEmail}
              </Typography.Text>
            </Flex>
            <QiuStatusTag tone={currentAccount.account.status === 'active' ? 'success' : 'warning'}>
              {currentAccount.account.status}
            </QiuStatusTag>
            <Typography.Text type="secondary" ellipsis>
              {activeWorkspace ? activeWorkspace.name : '平台运营空间'}
            </Typography.Text>
            <Button icon={<LogoutOutlined />} loading={isLoggingOut} onClick={handleLogout} block>
              退出登录
            </Button>
          </Flex>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey(pathname)]}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: <Link href="/">平台总览</Link>
            },
            {
              key: 'plans',
              icon: <DollarOutlined />,
              label: <Link href="/plans">套餐目录</Link>
            },
            {
              key: 'workspaces',
              icon: <ApartmentOutlined />,
              label: <Link href="/workspaces">企业管理</Link>
            },
            {
              key: 'audit',
              icon: <AuditOutlined />,
              label: <Link href="/audit">审计日志</Link>
            }
          ]}
        />
        <div style={{ padding: '12px 16px 20px' }}>
          <Flex align="center" gap={8}>
            <SafetyOutlined />
            <Typography.Text type="secondary">仅平台内部使用</Typography.Text>
          </Flex>
        </div>
      </Layout.Sider>
      <Layout.Content>{children}</Layout.Content>
    </Layout>
  );
}
