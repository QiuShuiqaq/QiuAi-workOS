'use client';

import type { LoginRequest } from '@qiuai/api-contract';
import { createBrowserApiClient } from '../../shared/api/browser-api';
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Flex,
  Form,
  Input,
  message,
  Space,
  Typography
} from 'antd';
import { LockOutlined, LoginOutlined, MailOutlined } from '@ant-design/icons';
import { useState } from 'react';

export interface LoginPageClientProps {
  nextPath: string;
}

export function LoginPageClient({ nextPath }: LoginPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(values: LoginRequest) {
    setLoading(true);
    setErrorMessage(undefined);
    try {
      const apiClient = createBrowserApiClient();
      await apiClient.login(values);
      const session = await apiClient.getAuthSession();

      if (!session.authenticated) {
        throw new Error('登录成功，但浏览器会话没有生效。请确认使用 HTTPS 访问并允许本站 Cookie。');
      }

      message.success('登录成功');
      window.location.assign(nextPath.startsWith('/login') ? '/' : nextPath);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '登录失败';
      setErrorMessage(messageText);
      message.error(messageText);
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
      <Card style={{ width: '100%', maxWidth: 420 }} bordered>
        <Space size={12} direction="vertical" style={{ display: 'flex' }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              QiuAI Admin Console
            </Typography.Title>
            <Typography.Text type="secondary">平台运营后台</Typography.Text>
          </div>
          {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
          <Form layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="email"
              label="邮箱"
              initialValue="admin@qiuai.local"
              rules={[{ required: true, type: 'email' }]}
            >
              <Input prefix={<MailOutlined />} placeholder="admin@qiuai.local" autoComplete="email" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 8 }]}>
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
                autoComplete="current-password"
              />
            </Form.Item>
            <Form.Item name="rememberMe" valuePropName="checked" initialValue={false}>
              <Checkbox>保持登录</Checkbox>
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              icon={<LoginOutlined />}
              loading={loading}
              block
            >
              登录
            </Button>
          </Form>
        </Space>
      </Card>
    </Flex>
  );
}
