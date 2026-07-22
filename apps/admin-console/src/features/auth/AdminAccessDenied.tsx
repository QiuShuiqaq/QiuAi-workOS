'use client';

import type { CurrentAccountResponse } from '@qiuai/api-contract';
import { QiuPage } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';

import { AdminShell } from '../../shared/console/AdminShell';

export function AdminAccessDenied({ currentAccount }: { currentAccount: CurrentAccountResponse }) {
  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="无权访问"
        description="当前账号不是平台管理员，无法进入 QiuAI Admin Console。"
        actions={<Button href="/login?next=/">切换账号</Button>}
      >
        <Alert
          showIcon
          type="error"
          message="管理员权限不足"
          description="请确认该账号已配置在 ADMIN_CONSOLE_OPERATOR_EMAILS 中。"
        />
      </QiuPage>
    </AdminShell>
  );
}
