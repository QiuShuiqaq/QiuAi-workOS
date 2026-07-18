import type { TaskSummary } from '@qiuai/api-contract';
import type { QiuStatusTone } from '@qiuai/ui';
import type { BadgeProps } from 'antd/es/badge';

export function taskStatusLabel(status: TaskSummary['status']) {
  return {
    queued: '排队中',
    running: '执行中',
    waiting_approval: '待审批',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消'
  }[status];
}

export function taskStatusTone(status: TaskSummary['status']): QiuStatusTone {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'processing';
  if (status === 'failed' || status === 'cancelled') return 'danger';
  return 'warning';
}

export function taskBadgeStatus(status: TaskSummary['status']): BadgeProps['status'] {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'processing';
  if (status === 'failed' || status === 'cancelled') return 'error';
  return 'warning';
}

export function taskPriorityLabel(priority: TaskSummary['priority']) {
  return {
    low: '低',
    normal: '普通',
    high: '高',
    urgent: '紧急'
  }[priority];
}

export function formatCurrency(value: number, currency = 'CNY') {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2
  }).format(value);
}
