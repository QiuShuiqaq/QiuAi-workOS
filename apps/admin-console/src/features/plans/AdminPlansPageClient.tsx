'use client';

import type {
  AdminPlanDetail,
  CurrentAccountResponse,
  UpdateAdminPlanRequest
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Divider from 'antd/es/divider';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Switch from 'antd/es/switch';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminPlansPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: AdminPlanDetail[];
}

type EditablePlanForm = UpdateAdminPlanRequest;

function formatCurrency(amountCents?: number, currency = 'CNY') {
  if (amountCents === undefined || amountCents === null) {
    return '-';
  }

  if (amountCents === 0) {
    return '免费';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency
  }).format(amountCents / 100);
}

function billingCycleLabel(value: string) {
  return {
    FREE: '免费',
    MONTHLY: '月付',
    ANNUAL: '年付',
    CUSTOM: '定制'
  }[value] ?? value;
}

function planTone(plan: AdminPlanDetail): 'default' | 'processing' | 'warning' {
  if (plan.status === 'ARCHIVED') return 'warning';
  if (plan.billingCycle === 'FREE') return 'default';
  if (plan.billingCycle === 'CUSTOM') return 'warning';
  return 'processing';
}

export function AdminPlansPageClient({ currentAccount, plans }: AdminPlansPageClientProps) {
  const [rows, setRows] = useState(plans);
  const [editingPlan, setEditingPlan] = useState<AdminPlanDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm<EditablePlanForm>();

  useEffect(() => {
    setRows(plans);
  }, [plans]);

  useEffect(() => {
    if (!editingPlan) {
      form.resetFields();
      return;
    }

    form.setFieldsValue({
      name: editingPlan.name,
      description: editingPlan.description,
      priceCents: editingPlan.priceCents,
      currency: editingPlan.currency ?? 'CNY',
      status: editingPlan.status,
      entitlements: editingPlan.entitlements.map((item) => ({
        featureKey: item.featureKey,
        enabled: item.enabled,
        limitValue: item.limitValue,
        limitUnit: item.limitUnit
      }))
    });
  }, [editingPlan, form]);

  async function handleSave(values: EditablePlanForm) {
    if (!editingPlan) {
      return;
    }

    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const response = await apiClient.updateAdminPlan(editingPlan.code, values);
      setRows((current) =>
        current.map((plan) => (plan.code === editingPlan.code ? response.data : plan))
      );
      message.success('套餐已更新');
      setEditingPlan(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新失败';
      message.error(errorMessage);
    } finally {
      setSaving(false);
    }
  }

  const paidPlans = useMemo(
    () => rows.filter((plan) => plan.billingCycle === 'MONTHLY' || plan.billingCycle === 'ANNUAL'),
    [rows]
  );

  const columns: ColumnsType<AdminPlanDetail> = [
    {
      title: '套餐',
      dataIndex: 'name',
      render: (_value, plan) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{plan.name}</Typography.Text>
          <Typography.Text type="secondary">{plan.code}</Typography.Text>
        </Space>
      )
    },
    {
      title: '计费',
      dataIndex: 'billingCycle',
      render: (value: string) => billingCycleLabel(value)
    },
    {
      title: '价格',
      key: 'price',
      render: (_value, plan) => formatCurrency(plan.priceCents, plan.currency ?? 'CNY')
    },
    {
      title: '状态',
      key: 'status',
      render: (_value, plan) => <QiuStatusTag tone={planTone(plan)}>{plan.status}</QiuStatusTag>
    },
    {
      title: '权益数',
      key: 'entitlements',
      render: (_value, plan) => plan.entitlements.length
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, plan) => (
        <Button icon={<EditOutlined />} onClick={() => setEditingPlan(plan)}>
          编辑
        </Button>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="套餐目录"
        description="这里直接维护平台套餐的名称、价格、状态和权益。"
        actions={<Button href="/">返回总览</Button>}
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message="套餐代码是固定的"
            description="当前版本支持编辑已存在套餐的内容和价格；如果要新增一个全新的套餐代码，需要后续再补 schema 和枚举。"
          />

          <Card bordered={false}>
            <Space size={24} wrap>
              <Typography.Text>总套餐数：{rows.length}</Typography.Text>
              <Typography.Text>付费套餐：{paidPlans.length}</Typography.Text>
              <Typography.Text>已归档：{rows.filter((plan) => plan.status === 'ARCHIVED').length}</Typography.Text>
            </Space>
          </Card>

          <Card title="完整套餐目录" bordered={false}>
            <Table
              rowKey="code"
              columns={columns}
              dataSource={rows}
              pagination={false}
              expandable={{
                expandedRowRender: (plan) => (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">{plan.description ?? '-'}</Typography.Text>
                    <Space wrap>
                      {plan.entitlements.map((item) => (
                        <Tag key={`${plan.code}-${item.featureKey}`}>
                          {item.featureKey}
                          {item.enabled ? ':on' : ':off'}
                          {item.limitValue !== undefined ? `(${item.limitValue}${item.limitUnit ?? ''})` : ''}
                        </Tag>
                      ))}
                    </Space>
                  </Space>
                )
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Modal
        title={`编辑套餐：${editingPlan?.name ?? ''}`}
        open={Boolean(editingPlan)}
        onCancel={() => setEditingPlan(null)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={760}
        okText="保存"
      >
        <Form layout="vertical" form={form} onFinish={handleSave}>
          <Form.Item name="name" label="套餐名称" rules={[{ required: true, message: '请输入套餐名称' }]}>
            <Input />
          </Form.Item>

          <Form.Item name="description" label="套餐说明">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item name="priceCents" label="价格(分)" style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="currency" label="币种" style={{ width: 160 }}>
              <Select
                options={[
                  { value: 'CNY', label: 'CNY' },
                  { value: 'USD', label: 'USD' }
                ]}
              />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ width: 160 }}>
              <Select
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'ARCHIVED', label: 'ARCHIVED' }
                ]}
              />
            </Form.Item>
          </Space>

          <Divider style={{ margin: '16px 0' }}>权益</Divider>

          <Form.List name="entitlements">
            {(fields, { add, remove }) => (
              <Space direction="vertical" style={{ width: '100%' }} size={12}>
                {fields.map((field) => (
                  <Card key={field.key} size="small" bordered>
                    <Space direction="vertical" style={{ width: '100%' }} size={12}>
                      <Space align="start" style={{ width: '100%' }} size={12}>
                        <Form.Item
                          {...field}
                          name={[field.name, 'featureKey']}
                          label="featureKey"
                          rules={[{ required: true, message: '请输入 featureKey' }]}
                          style={{ flex: 2 }}
                        >
                          <Input placeholder="maxRoleInstances" />
                        </Form.Item>
                        <Form.Item
                          {...field}
                          name={[field.name, 'enabled']}
                          label="启用"
                          valuePropName="checked"
                          initialValue
                          style={{ width: 110 }}
                        >
                          <Switch />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'limitValue']} label="limitValue" style={{ flex: 1 }}>
                          <InputNumber min={0} style={{ width: '100%' }} />
                        </Form.Item>
                        <Form.Item {...field} name={[field.name, 'limitUnit']} label="limitUnit" style={{ width: 120 }}>
                          <Input placeholder="count" />
                        </Form.Item>
                        <Button
                          danger
                          icon={<DeleteOutlined />}
                          style={{ marginTop: 30 }}
                          onClick={() => remove(field.name)}
                        >
                          删除
                        </Button>
                      </Space>
                    </Space>
                  </Card>
                ))}
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => add({ enabled: true })}
                  block
                >
                  添加权益
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </AdminShell>
  );
}
