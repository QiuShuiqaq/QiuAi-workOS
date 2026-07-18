'use client';

import type { ReactNode } from 'react';
import App from 'antd/es/app';
import ConfigProvider from 'antd/es/config-provider';
import zhCN from 'antd/es/locale/zh_CN';
import { qiuAntTheme } from '@qiuai/design-tokens';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ConfigProvider locale={zhCN} theme={qiuAntTheme}>
      <App>{children}</App>
    </ConfigProvider>
  );
}
