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

const capacityFeatureLabels: Record<string, string> = {
  maxDesktopDevices: '设备',
  maxRoleInstances: '单设备数字员工',
  maxDigitalFactories: '单设备数字工厂'
};

const capacityFeatureOrder = ['maxDesktopDevices', 'maxRoleInstances', 'maxDigitalFactories'];
const editableEntitlementLabels: Record<string, string> = {
  maxDesktopDevices: '企业可绑定设备数',
  maxRoleInstances: '单设备数字员工',
  maxDigitalFactories: '单设备数字工厂',
  maxTasksPerMonth: '月任务额度'
};
const editableEntitlementOrder = ['maxDesktopDevices', 'maxRoleInstances', 'maxDigitalFactories', 'maxTasksPerMonth'];
const editableEntitlementKeys = new Set(editableEntitlementOrder);

function capacityEntitlements(plan: AdminPlanDetail) {
  return plan.entitlements
    .filter((item) => item.enabled && capacityFeatureLabels[item.featureKey])
    .sort((left, right) => capacityFeatureOrder.indexOf(left.featureKey) - capacityFeatureOrder.indexOf(right.featureKey));
}

function entitlementValue(value: AdminPlanDetail['entitlements'][number]) {
  if (value.limitValue === undefined) {
    return '不限';
  }

  return value.limitValue.toLocaleString('zh-CN');
}

function editableEntitlements(plan: AdminPlanDetail) {
  return plan.entitlements
    .filter((item) => editableEntitlementKeys.has(item.featureKey))
    .sort((left, right) => editableEntitlementOrder.indexOf(left.featureKey) - editableEntitlementOrder.indexOf(right.featureKey))
    .map((item) => ({
      featureKey: item.featureKey,
      enabled: item.enabled,
      limitValue: item.limitValue,
      limitUnit: item.limitUnit
    }));
}

function mergeHiddenEntitlements(editingPlan: AdminPlanDetail, values: EditablePlanForm): EditablePlanForm {
  const editedByKey = new Map(
    (values.entitlements ?? [])
      .filter((item) => item.featureKey && editableEntitlementKeys.has(item.featureKey))
      .map((item) => [item.featureKey, item])
  );
  const hiddenEntitlements = editingPlan.entitlements
    .filter((item) => !editableEntitlementKeys.has(item.featureKey))
    .map((item) => ({
      featureKey: item.featureKey,
      enabled: item.enabled,
      limitValue: item.limitValue,
      limitUnit: item.limitUnit
    }));
  const editedEntitlements = editableEntitlementOrder
    .map((featureKey) => editedByKey.get(featureKey))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      featureKey: item.featureKey,
      enabled: Boolean(item.enabled),
      limitValue: item.limitValue,
      limitUnit: item.limitUnit
    }));

  return {
    ...values,
    entitlements: [...hiddenEntitlements, ...editedEntitlements]
  };
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
      entitlements: editableEntitlements(editingPlan)
    });
  }, [editingPlan, form]);

  async function handleSave(values: EditablePlanForm) {
    if (!editingPlan) {
      return;
    }

    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const response = await apiClient.updateAdminPlan(editingPlan.code, mergeHiddenEntitlements(editingPlan, values));
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
      title: '容量',
      key: 'entitlements',
      render: (_value, plan) => (
        <Space wrap>
          {capacityEntitlements(plan).map((item) => (
            <Tag key={`${plan.code}-${item.featureKey}`}>
              {capacityFeatureLabels[item.featureKey]}：{entitlementValue(item)}
            </Tag>
          ))}
        </Space>
      )
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
                      {capacityEntitlements(plan).map((item) => (
                        <Tag key={`${plan.code}-${item.featureKey}`}>
                          {capacityFeatureLabels[item.featureKey]}：{entitlementValue(item)}
                        </Tag>
                      ))}
                    </Space>
                    <Typography.Text type="secondary">
                      企业版基础能力保持一致；设备数量按企业计算，数字员工和数字工厂容量按每台绑定设备分别计算。
                    </Typography.Text>
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
          <Alert
            showIcon
            type="info"
            message="这里只展示当前产品化的套餐权益"
            description="可编辑项为 maxDesktopDevices、maxRoleInstances、maxDigitalFactories、maxTasksPerMonth。canUseXXX、maxMembers 等历史预留字段会自动隐藏并在保存时按原值保留。"
            style={{ marginBottom: 16 }}
          />

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
                          rules={[{ required: true, message: '请选择 featureKey' }]}
                          style={{ flex: 2 }}
                        >
                          <Select
                            options={editableEntitlementOrder.map((featureKey) => ({
                              value: featureKey,
                              label: `${editableEntitlementLabels[featureKey]} (${featureKey})`
                            }))}
                          />
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
                  onClick={() => add({ featureKey: 'maxTasksPerMonth', enabled: true, limitUnit: 'count' })}
                  block
                >
                  添加可编辑权益
                </Button>
              </Space>
            )}
          </Form.List>
        </Form>
      </Modal>
    </AdminShell>
  );
}
