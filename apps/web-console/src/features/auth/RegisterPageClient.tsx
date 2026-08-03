'use client';

import type { RegisterRequest } from '@qiuai/api-contract';
import { LockOutlined, MailOutlined, ShopOutlined, UserAddOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Checkbox, Flex, Form, Input, message, Space, Typography } from 'antd';
import Link from 'next/link';
import { useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';

interface RegisterPageClientProps {
  nextPath: string;
}

interface RegisterFormValues extends RegisterRequest {
  confirmPassword: string;
}

export function RegisterPageClient({ nextPath }: RegisterPageClientProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>();

  async function handleSubmit(values: RegisterFormValues) {
    setLoading(true);
    setErrorMessage(undefined);
    try {
      const apiClient = createBrowserApiClient();
      await apiClient.register({
        email: values.email,
        password: values.password,
        workspaceName: values.workspaceName,
        acceptedTerms: values.acceptedTerms
      });
      const session = await apiClient.getAuthSession();

      if (!session.authenticated) {
        throw new Error('注册成功，但浏览器会话没有生效。请确认使用 HTTPS 访问并允许本站 Cookie。');
      }

      message.success('注册成功');
      window.location.assign(nextPath.startsWith('/login') || nextPath.startsWith('/register') ? '/' : nextPath);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : '注册失败';
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
      <Card style={{ width: '100%', maxWidth: 460 }} bordered>
        <Space size={12} direction="vertical" style={{ display: 'flex' }}>
          <div>
            <Typography.Title level={2} style={{ marginBottom: 8 }}>
              注册 QiuAI WorkOS
            </Typography.Title>
            <Typography.Text type="secondary">创建免费企业工作空间，后续可在套餐与购买中升级。</Typography.Text>
          </div>
          {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}
          <Form<RegisterFormValues> layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="workspaceName"
              label="企业或团队名称"
              rules={[
                { required: true, message: '请输入企业或团队名称' },
                { min: 2, message: '名称至少 2 个字符' },
                { max: 80, message: '名称最多 80 个字符' }
              ]}
            >
              <Input prefix={<ShopOutlined />} placeholder="例如：秋 AI 科技" autoComplete="organization" />
            </Form.Item>
            <Form.Item
              name="email"
              label="邮箱"
              rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
            >
              <Input prefix={<MailOutlined />} placeholder="name@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              name="password"
              label="密码"
              rules={[
                { required: true, message: '请输入密码' },
                { min: 8, message: '密码至少 8 位' },
                { max: 128, message: '密码最多 128 位' }
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="至少 8 位" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="确认密码"
              dependencies={['password']}
              rules={[
                { required: true, message: '请再次输入密码' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error('两次输入的密码不一致'));
                  }
                })
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="再次输入密码" autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="acceptedTerms"
              valuePropName="checked"
              initialValue={false}
              rules={[
                {
                  validator: (_, value) =>
                    value ? Promise.resolve() : Promise.reject(new Error('请先同意用户协议'))
                }
              ]}
            >
              <Checkbox>我已阅读并同意 QiuAI WorkOS 用户协议</Checkbox>
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<UserAddOutlined />} loading={loading} block>
              注册并进入系统
            </Button>
          </Form>
          <Flex justify="center" gap={8}>
            <Typography.Text type="secondary">已有账号？</Typography.Text>
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`}>去登录</Link>
          </Flex>
        </Space>
      </Card>
    </Flex>
  );
}
