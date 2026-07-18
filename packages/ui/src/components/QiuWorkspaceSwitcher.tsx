'use client';

import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Typography from 'antd/es/typography';

export interface QiuWorkspaceOption {
  id: string;
  name: string;
}

export interface QiuWorkspaceSwitcherProps {
  value: string;
  workspaces: QiuWorkspaceOption[];
  onChange: (workspaceId: string) => void;
}

export function QiuWorkspaceSwitcher({ value, workspaces, onChange }: QiuWorkspaceSwitcherProps) {
  return (
    <Space direction="vertical" size={4} style={{ width: '100%' }}>
      <Typography.Text type="secondary">Workspace</Typography.Text>
      <Select
        value={value}
        onChange={onChange}
        style={{ width: '100%' }}
        options={workspaces.map((workspace) => ({
          value: workspace.id,
          label: workspace.name
        }))}
      />
    </Space>
  );
}
