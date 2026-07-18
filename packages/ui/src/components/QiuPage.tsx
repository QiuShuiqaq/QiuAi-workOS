'use client';

import type { ReactNode } from 'react';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';

export interface QiuPageProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function QiuPage({ title, description, actions, children }: QiuPageProps) {
  return (
    <main style={{ minHeight: '100%', padding: 24 }}>
      <Space direction="vertical" size={20} style={{ width: '100%' }}>
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Typography.Title level={2} style={{ margin: 0 }}>
              {title}
            </Typography.Title>
            {description ? (
              <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
                {description}
              </Typography.Paragraph>
            ) : null}
          </div>
          {actions ? <div>{actions}</div> : null}
        </header>
        {children}
      </Space>
    </main>
  );
}
