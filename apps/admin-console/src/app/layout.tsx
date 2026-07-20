import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AntdRegistry } from '@ant-design/nextjs-registry';

import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'QiuAI Admin Console',
  description: 'QiuAI WorkOS Platform Operator Console'
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}
