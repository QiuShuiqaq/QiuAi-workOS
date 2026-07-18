'use client';

import Card from 'antd/es/card';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';

export interface QiuMetricCardProps {
  title: string;
  value: string;
  trend?: string;
}

export function QiuMetricCard({ title, value, trend }: QiuMetricCardProps) {
  return (
    <Card bordered={false} styles={{ body: { minHeight: 116 } }}>
      <Space direction="vertical" size={6}>
        <Typography.Text type="secondary">{title}</Typography.Text>
        <Typography.Title level={2} style={{ margin: 0 }}>
          {value}
        </Typography.Title>
        {trend ? <Typography.Text type="secondary">{trend}</Typography.Text> : null}
      </Space>
    </Card>
  );
}
