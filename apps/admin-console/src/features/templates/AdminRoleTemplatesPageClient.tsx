'use client';

import {
  CheckCircleOutlined,
  EditOutlined,
  InboxOutlined,
  PlayCircleOutlined,
  PlusOutlined
} from '@ant-design/icons';
import type {
  AdminPlanDetail,
  AdminRoleTemplateDetail,
  AdminWorkspaceSummary,
  CreateAdminRoleTemplateRequest,
  CurrentAccountResponse,
  UpdateAdminRoleTemplateRequest
} from '@qiuai/api-contract';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Divider from 'antd/es/divider';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Popconfirm from 'antd/es/popconfirm';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useEffect, useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminRoleTemplatesPageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
}

type RoleTemplateSkillForm = {
  code?: string;
  name?: string;
  summary?: string;
};

type RoleTemplateFormValues = {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources?: string[];
  tools?: string[];
  skills?: RoleTemplateSkillForm[];
  approvalPolicy: string;
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
};

type TemplateTestNotice = {
  templateName: string;
  valid: boolean;
  status: 'passed' | 'failed';
  message: string;
  warnings: string[];
  sampleInput?: string;
};

const knowledgeOptions = [
  'local_folder',
  'local_file',
  'workspace_library',
  'server_summary'
].map((value) => ({ value, label: value }));

const toolOptions = [
  'web-search',
  'office-document',
  'local-filesystem',
  'browser-automation',
  'mcp'
].map((value) => ({ value, label: value }));

function normalizeTags(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalizeSkills(values?: RoleTemplateSkillForm[]) {
  return (values ?? [])
    .map((skill) => ({
      code: skill.code?.trim() ?? '',
      name: skill.name?.trim() ?? '',
      summary: skill.summary?.trim() ?? ''
    }))
    .filter((skill) => skill.code && skill.name && skill.summary);
}

function formatDateTime(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function statusTone(status: string): 'default' | 'processing' | 'success' | 'warning' {
  if (status === 'PUBLISHED') return 'success';
  if (status === 'ARCHIVED') return 'warning';
  if (status === 'DRAFT') return 'processing';
  return 'default';
}

function buildCreatePayload(values: RoleTemplateFormValues): CreateAdminRoleTemplateRequest {
  const allowedPlanCodes = normalizeTags(values.allowedPlanCodes);
  const visibleWorkspaceIds = normalizeTags(values.visibleWorkspaceIds);

  return {
    id: values.id.trim(),
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: normalizeTags(values.knowledgeSources),
    tools: normalizeTags(values.tools),
    skills: normalizeSkills(values.skills),
    approvalPolicy: values.approvalPolicy.trim(),
    allowedPlanCodes: allowedPlanCodes.length ? allowedPlanCodes : undefined,
    visibleWorkspaceIds: visibleWorkspaceIds.length ? visibleWorkspaceIds : undefined
  };
}

function buildUpdatePayload(values: RoleTemplateFormValues): UpdateAdminRoleTemplateRequest {
  return {
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: normalizeTags(values.knowledgeSources),
    tools: normalizeTags(values.tools),
    skills: normalizeSkills(values.skills),
    approvalPolicy: values.approvalPolicy.trim(),
    allowedPlanCodes: normalizeTags(values.allowedPlanCodes),
    visibleWorkspaceIds: normalizeTags(values.visibleWorkspaceIds)
  };
}

export function AdminRoleTemplatesPageClient({
  currentAccount,
  templates,
  plans,
  workspaces
}: AdminRoleTemplatesPageClientProps) {
  const [rows, setRows] = useState(templates);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<AdminRoleTemplateDetail | null>(null);
  const [saving, setSaving] = useState(false);
  const [testingTemplateId, setTestingTemplateId] = useState<string | null>(null);
  const [actionTemplateId, setActionTemplateId] = useState<string | null>(null);
  const [testNotice, setTestNotice] = useState<TemplateTestNotice | null>(null);
  const [form] = Form.useForm<RoleTemplateFormValues>();

  useEffect(() => {
    setRows(templates);
  }, [templates]);

  const activePaidPlanCode = useMemo(
    () =>
      plans.find((plan) => plan.status === 'ACTIVE' && plan.billingCycle !== 'FREE')?.code ??
      plans[0]?.code ??
      '',
    [plans]
  );

  const planOptions = useMemo(
    () =>
      plans.map((plan) => ({
        value: plan.code,
        label: `${plan.name} / ${plan.code}`
      })),
    [plans]
  );

  const workspaceOptions = useMemo(
    () =>
      workspaces.map((workspace) => ({
        value: workspace.id,
        label: `${workspace.name} / ${workspace.ownerEmail}`
      })),
    [workspaces]
  );

  const planNameByCode = useMemo(
    () => new Map(plans.map((plan) => [plan.code, plan.name] as const)),
    [plans]
  );

  const workspaceNameById = useMemo(
    () => new Map(workspaces.map((workspace) => [workspace.id, workspace.name] as const)),
    [workspaces]
  );

  const counts = useMemo(
    () => ({
      total: rows.length,
      published: rows.filter((item) => item.status === 'PUBLISHED').length,
      draft: rows.filter((item) => item.status === 'DRAFT').length,
      archived: rows.filter((item) => item.status === 'ARCHIVED').length
    }),
    [rows]
  );

  function setEditorValues(template: AdminRoleTemplateDetail | null) {
    if (template) {
      form.setFieldsValue({
        id: template.id,
        version: template.version,
        name: template.name,
        industry: template.industry,
        scenario: template.scenario,
        description: template.description,
        recommendedPlanCode: template.recommendedPlanCode,
        businessGoal: template.businessGoal,
        knowledgeSources: template.knowledgeSources,
        tools: template.tools,
        skills: template.skills,
        approvalPolicy: template.approvalPolicy,
        allowedPlanCodes: template.allowedPlanCodes,
        visibleWorkspaceIds: template.visibleWorkspaceIds
      });
      return;
    }

    form.setFieldsValue({
      id: 'template_',
      version: '1.0.0',
      name: '',
      industry: '',
      scenario: '',
      description: '',
      recommendedPlanCode: activePaidPlanCode,
      businessGoal: '',
      knowledgeSources: [],
      tools: [],
      skills: [{ code: '', name: '', summary: '' }],
      approvalPolicy: '',
      allowedPlanCodes: activePaidPlanCode ? [activePaidPlanCode] : [],
      visibleWorkspaceIds: []
    });
  }

  function openCreate() {
    setEditingTemplate(null);
    form.resetFields();
    setEditorValues(null);
    setDrawerOpen(true);
  }

  function openEdit(template: AdminRoleTemplateDetail) {
    setEditingTemplate(template);
    form.resetFields();
    setEditorValues(template);
    setDrawerOpen(true);
  }

  function closeEditor() {
    setDrawerOpen(false);
    setEditingTemplate(null);
    form.resetFields();
  }

  function replaceRow(template: AdminRoleTemplateDetail) {
    setRows((current) => {
      const exists = current.some((item) => item.id === template.id);
      if (!exists) {
        return [template, ...current];
      }
      return current.map((item) => (item.id === template.id ? template : item));
    });
  }

  async function handleSave(values: RoleTemplateFormValues) {
    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const response = editingTemplate
        ? await apiClient.updateAdminRoleTemplate(editingTemplate.id, buildUpdatePayload(values))
        : await apiClient.createAdminRoleTemplate(buildCreatePayload(values));

      replaceRow(response.data);
      message.success(editingTemplate ? '模板已更新' : '模板已创建');
      closeEditor();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模板保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(template: AdminRoleTemplateDetail) {
    setTestingTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().testAdminRoleTemplate(template.id, {
        sampleInput: template.businessGoal
      });
      setTestNotice({
        templateName: template.name,
        ...response.data
      });
      message.success(response.data.valid ? '模板测试通过' : '模板测试未通过');
      replaceRow({
        ...template,
        lastTestedAt: new Date().toISOString()
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模板测试失败');
    } finally {
      setTestingTemplateId(null);
    }
  }

  async function handlePublish(template: AdminRoleTemplateDetail) {
    setActionTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().publishAdminRoleTemplate(template.id);
      replaceRow(response.data);
      message.success('模板已发布');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模板发布失败');
    } finally {
      setActionTemplateId(null);
    }
  }

  async function handleArchive(template: AdminRoleTemplateDetail) {
    setActionTemplateId(template.id);
    try {
      const response = await createBrowserApiClient().archiveAdminRoleTemplate(template.id);
      replaceRow(response.data);
      message.success('模板已归档');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '模板归档失败');
    } finally {
      setActionTemplateId(null);
    }
  }

  function renderPlans(values: string[]) {
    if (values.length === 0) {
      return <Typography.Text type="secondary">未限定套餐</Typography.Text>;
    }

    return (
      <Space size={[4, 4]} wrap>
        {values.slice(0, 3).map((code) => (
          <Tag key={code}>{planNameByCode.get(code) ?? code}</Tag>
        ))}
        {values.length > 3 ? <Tag>+{values.length - 3}</Tag> : null}
      </Space>
    );
  }

  function renderWorkspaces(values: string[]) {
    if (values.length === 0) {
      return <Typography.Text type="secondary">无白名单</Typography.Text>;
    }

    return (
      <Space size={[4, 4]} wrap>
        {values.slice(0, 2).map((id) => (
          <Tag key={id}>{workspaceNameById.get(id) ?? id}</Tag>
        ))}
        {values.length > 2 ? <Tag>+{values.length - 2}</Tag> : null}
      </Space>
    );
  }

  const columns: ColumnsType<AdminRoleTemplateDetail> = [
    {
      title: '数字员工模板',
      key: 'template',
      width: 260,
      render: (_value, template) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{template.name}</Typography.Text>
          <Typography.Text type="secondary">{template.id}</Typography.Text>
        </Space>
      )
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 90
    },
    {
      title: '场景',
      key: 'scenario',
      render: (_value, template) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{template.industry}</Typography.Text>
          <Typography.Text type="secondary">{template.scenario}</Typography.Text>
        </Space>
      )
    },
    {
      title: '推荐套餐',
      dataIndex: 'recommendedPlanCode',
      width: 170,
      render: (code: string) => <Tag color="blue">{planNameByCode.get(code) ?? code}</Tag>
    },
    {
      title: '可见范围',
      key: 'visibility',
      width: 260,
      render: (_value, template) => (
        <Space direction="vertical" size={4}>
          {renderPlans(template.allowedPlanCodes)}
          {renderWorkspaces(template.visibleWorkspaceIds)}
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (status: string) => <QiuStatusTag tone={statusTone(status)}>{status}</QiuStatusTag>
    },
    {
      title: '最近测试',
      dataIndex: 'lastTestedAt',
      width: 160,
      render: (value?: string) => formatDateTime(value)
    },
    {
      title: '操作',
      key: 'actions',
      width: 310,
      render: (_value, template) => (
        <Space wrap>
          <Button icon={<EditOutlined />} onClick={() => openEdit(template)}>
            编辑
          </Button>
          <Button
            icon={<PlayCircleOutlined />}
            loading={testingTemplateId === template.id}
            onClick={() => handleTest(template)}
          >
            测试
          </Button>
          {template.status === 'PUBLISHED' ? (
            <Popconfirm
              title="确认归档这个模板？"
              okText="归档"
              cancelText="取消"
              onConfirm={() => handleArchive(template)}
            >
              <Button danger icon={<InboxOutlined />} loading={actionTemplateId === template.id}>
                归档
              </Button>
            </Popconfirm>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={actionTemplateId === template.id}
              onClick={() => handlePublish(template)}
            >
              发布
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="模板工厂"
        description="统一维护数字员工模板、发布状态，以及套餐和企业白名单。"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建模板
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card bordered={false}>
            <Space size={32} wrap>
              <Typography.Text>总模板：{counts.total}</Typography.Text>
              <Typography.Text>已发布：{counts.published}</Typography.Text>
              <Typography.Text>草稿：{counts.draft}</Typography.Text>
              <Typography.Text>已归档：{counts.archived}</Typography.Text>
            </Space>
          </Card>

          {testNotice ? (
            <Alert
              showIcon
              type={testNotice.valid ? 'success' : 'warning'}
              message={`${testNotice.templateName}：${testNotice.message}`}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text>状态：{testNotice.status}</Typography.Text>
                  {testNotice.warnings.length ? (
                    <Typography.Text type="secondary">
                      提示：{testNotice.warnings.join('；')}
                    </Typography.Text>
                  ) : null}
                </Space>
              }
            />
          ) : null}

          <Card title="模板目录" bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              pagination={{ pageSize: 12 }}
              scroll={{ x: 1280 }}
              expandable={{
                expandedRowRender: (template) => (
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text>{template.description}</Typography.Text>
                    <Typography.Text type="secondary">目标：{template.businessGoal}</Typography.Text>
                    <Space wrap>
                      {template.skills.map((skill) => (
                        <Tag key={skill.code}>{skill.name}</Tag>
                      ))}
                    </Space>
                  </Space>
                )
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Drawer
        title={editingTemplate ? `编辑模板：${editingTemplate.name}` : '新建数字员工模板'}
        width={960}
        open={drawerOpen}
        onClose={closeEditor}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={closeEditor}>取消</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              保存
            </Button>
          </Space>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
            <Form.Item name="id" label="模板 ID" rules={[{ required: true, message: '请输入模板 ID' }]}>
              <Input disabled={Boolean(editingTemplate)} placeholder="template_sales_assistant" />
            </Form.Item>
            <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
              <Input placeholder="1.0.0" />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入模板名称' }]}>
              <Input placeholder="AI 销售助理" />
            </Form.Item>
            <Form.Item name="industry" label="行业/部门" rules={[{ required: true, message: '请输入行业或部门' }]}>
              <Input placeholder="销售支持" />
            </Form.Item>
          </div>

          <Form.Item name="scenario" label="使用场景" rules={[{ required: true, message: '请输入使用场景' }]}>
            <Input placeholder="线索研究、外联文案和提案支持" />
          </Form.Item>

          <Form.Item name="description" label="模板说明" rules={[{ required: true, message: '请输入模板说明' }]}>
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item name="businessGoal" label="业务目标" rules={[{ required: true, message: '请输入业务目标' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="approvalPolicy" label="审批策略" rules={[{ required: true, message: '请输入审批策略' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Divider orientation="left">能力配置</Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="knowledgeSources" label="知识来源">
              <Select mode="tags" tokenSeparators={[',']} options={knowledgeOptions} />
            </Form.Item>
            <Form.Item name="tools" label="工具">
              <Select mode="tags" tokenSeparators={[',']} options={toolOptions} />
            </Form.Item>
          </div>

          <Form.List name="skills">
            {(fields, { add, remove }) => (
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                {fields.map((field) => (
                  <Card
                    key={field.key}
                    size="small"
                    title={`技能 ${field.name + 1}`}
                    extra={
                      <Button type="link" danger onClick={() => remove(field.name)}>
                        删除
                      </Button>
                    }
                  >
                    <div style={{ display: 'grid', gridTemplateColumns: '160px 180px 1fr', gap: 12 }}>
                      <Form.Item
                        {...field}
                        name={[field.name, 'code']}
                        label="code"
                        rules={[{ required: true, message: '请输入 code' }]}
                      >
                        <Input placeholder="lead_research" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'name']}
                        label="名称"
                        rules={[{ required: true, message: '请输入名称' }]}
                      >
                        <Input placeholder="线索研究" />
                      </Form.Item>
                      <Form.Item
                        {...field}
                        name={[field.name, 'summary']}
                        label="说明"
                        rules={[{ required: true, message: '请输入说明' }]}
                      >
                        <Input placeholder="搜索并整理潜在线索背景" />
                      </Form.Item>
                    </div>
                  </Card>
                ))}
                <Button type="dashed" onClick={() => add({ code: '', name: '', summary: '' })} block>
                  添加技能
                </Button>
              </Space>
            )}
          </Form.List>

          <Divider orientation="left">发布范围</Divider>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              name="recommendedPlanCode"
              label="推荐套餐"
              rules={[{ required: true, message: '请选择推荐套餐' }]}
            >
              <Select options={planOptions} showSearch optionFilterProp="label" />
            </Form.Item>
            <Form.Item name="allowedPlanCodes" label="允许套餐">
              <Select mode="multiple" options={planOptions} showSearch optionFilterProp="label" />
            </Form.Item>
          </div>

          <Form.Item name="visibleWorkspaceIds" label="企业白名单">
            <Select mode="multiple" options={workspaceOptions} showSearch optionFilterProp="label" />
          </Form.Item>
        </Form>
      </Drawer>
    </AdminShell>
  );
}
