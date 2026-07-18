'use client';

import Tag from 'antd/es/tag';

export type QiuStatusTone = 'default' | 'processing' | 'success' | 'warning' | 'danger';

export interface QiuStatusTagProps {
  tone?: QiuStatusTone;
  children: string;
}

const toneColor: Record<QiuStatusTone, string | undefined> = {
  default: undefined,
  processing: 'blue',
  success: 'green',
  warning: 'gold',
  danger: 'red'
};

export function QiuStatusTag({ tone = 'default', children }: QiuStatusTagProps) {
  return <Tag color={toneColor[tone]}>{children}</Tag>;
}
