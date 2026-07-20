'use client';

import type { PublicInvitationDetail } from '@qiuai/api-contract';
import { QiuApiError } from '@qiuai/api-client';
import { Button, Card, Checkbox, Flex, Form, Input, message, Space, Typography } from 'antd';
import { LockOutlined, LoginOutlined } from '@ant-design/icons';
import { useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';

export interface InvitationAcceptPageClientProps {
  token: string;
  invitation: PublicInvitationDetail;
  isApiFallback: boolean;
}

export function InvitationAcceptPageClient({
  token,
  invitation,
  isApiFallback
}: InvitationAcceptPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm<{ password: string; rememberMe?: boolean }>();

  const isPending = invitation.status === 'pending';

  async function handleSubmit(values: { password: string; rememberMe?: boolean }) {
    setLoading(true);
    try {
      const response = await createBrowserApiClient().acceptWorkspaceInvitation(token, values);
      message.success('已加入工作区');
      window.location.assign(`/enterprise?workspaceId=${response.activeWorkspaceId}`);
    } catch (error) {
      if (error instanceof QiuApiError) {
        message.error(error.body.error.message);
      } else {
        message.error('接受邀请失败');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Flex
      align="center"
      justify="center"
      style={{
        minHeight: '100vh',
        padding: 24,
        background: 'linear-gradient(180deg, #f6f8fa 0%, #ffffff 100%)'
      }}
    >
      <Card style={{ width: '100%', maxWidth: 460 }} bordered>
        <Space size={16} direction="vertical" style={{ display: 'flex' }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              加入 {invitation.workspaceName}
            </Typography.Title>
            <Typography.Text type="secondary">
              {invitation.organizationName ?? invitation.workspaceName} · {invitation.departmentName ?? '未指定部门'}
            </Typography.Text>
          </div>

          {isApiFallback ? <Typography.Text type="secondary">当前显示 fallback 邀请数据。</Typography.Text> : null}
          {!isPending ? (
            <Typography.Text type="danger">
              当前邀请已失效，请联系工作区管理员重新发送。
            </Typography.Text>
          ) : null}

          <Form layout="vertical" form={form} onFinish={handleSubmit} disabled={!isPending}>
            <Form.Item label="受邀邮箱">
              <Input value={invitation.email} readOnly />
            </Form.Item>
            <Form.Item label="邀请角色">
              <Input value={invitation.systemRole} readOnly />
            </Form.Item>
            <Form.Item
              name="password"
              label="设置密码"
              rules={[{ required: true, min: 8, message: '请输入至少 8 位密码' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="设置登录密码" autoComplete="new-password" />
            </Form.Item>
            <Form.Item name="rememberMe" valuePropName="checked" initialValue={false}>
              <Checkbox>保持登录</Checkbox>
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<LoginOutlined />} loading={loading} block disabled={!isPending}>
              接受邀请并进入
            </Button>
          </Form>
        </Space>
      </Card>
    </Flex>
  );
}
