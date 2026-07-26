'use client';

import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import type {
  AdminPlanDetail,
  AdminRoleTemplateDetail,
  AdminWorkspaceSummary,
  CreateAdminRoleTemplateRequest,
  CurrentAccountResponse,
  RoleWorkflowGraph,
  RoleWorkflowGraphNode,
  RoleWorkflowGraphSourceStep,
  UpdateAdminRoleTemplateRequest
} from '@qiuai/api-contract';
import { buildRoleWorkflowGraphFromSteps } from '@qiuai/api-contract';
import { QiuPage } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminCreateRoleTemplatePageClientProps {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  templateId?: string;
}

type WorkflowPreset = 'standard' | 'document' | 'research';

type SkillForm = {
  code?: string;
  name?: string;
  summary?: string;
};

type CreateRoleTemplateFormValues = {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  businessGoal: string;
  recommendedPlanCode: string;
  approvalPolicy: string;
  outputFormat?: string;
  workflowPreset: WorkflowPreset;
  knowledgeSources?: string[];
  tools?: string[];
  skills?: SkillForm[];
  sampleInputs?: string[];
  allowedPlanCodes?: string[];
  visibleWorkspaceIds?: string[];
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
  'http-request',
  'mcp'
].map((value) => ({ value, label: value }));

const workflowPresetOptions: Array<{ value: WorkflowPreset; label: string; description: string }> = [
  {
    value: 'standard',
    label: '标准任务',
    description: '输入任务、读取知识、LLM 起草、生成文档、返回结果。'
  },
  {
    value: 'document',
    label: '文档处理',
    description: '读取附件、分析内容、生成 Word/表格/PPT 类产物。'
  },
  {
    value: 'research',
    label: '调研任务',
    description: '先做网页搜索，再综合分析，输出调研报告。'
  }
];

function uniqueTags(values?: string[]) {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function normalizeSkills(values?: SkillForm[]) {
  return (values ?? [])
    .map((skill) => ({
      code: skill.code?.trim() ?? '',
      name: skill.name?.trim() ?? '',
      summary: skill.summary?.trim() ?? ''
    }))
    .filter((skill) => skill.code && skill.name && skill.summary);
}

function createWorkflowSteps(preset: WorkflowPreset): RoleWorkflowGraphSourceStep[] {
  if (preset === 'document') {
    return [
      {
        id: 'receive_file',
        order: 1,
        type: 'input',
        name: '接收任务和附件',
        instruction: '确认用户目标、附件、输出格式和约束。'
      },
      {
        id: 'extract_file',
        order: 2,
        type: 'tool',
        name: '读取文件',
        instruction: '读取用户拖入的文档、表格或资料，并提取可分析文本。',
        toolIds: ['office-document', 'local-filesystem']
      },
      {
        id: 'analyze_content',
        order: 3,
        type: 'reasoning',
        name: '分析内容',
        instruction: '结合任务目标分析附件内容，提炼结论、风险和下一步动作。'
      },
      {
        id: 'write_result',
        order: 4,
        type: 'tool',
        name: '生成产物',
        instruction: '生成用户可下载的业务文档、表格或演示稿。',
        toolIds: ['office-document']
      },
      {
        id: 'final_reply',
        order: 5,
        type: 'output',
        name: '返回结果',
        instruction: '在对话中总结完成情况，并给出下载入口。'
      }
    ];
  }

  if (preset === 'research') {
    return [
      {
        id: 'receive_topic',
        order: 1,
        type: 'input',
        name: '接收调研主题',
        instruction: '确认调研主题、范围、行业、输出深度和引用要求。'
      },
      {
        id: 'search_context',
        order: 2,
        type: 'tool',
        name: '网页搜索',
        instruction: '搜索公开资料，整理可引用的背景信息和关键事实。',
        toolIds: ['web-search']
      },
      {
        id: 'gather_knowledge',
        order: 3,
        type: 'knowledge',
        name: '读取企业知识',
        instruction: '结合企业本地知识、历史资料和业务约束。'
      },
      {
        id: 'draft_report',
        order: 4,
        type: 'reasoning',
        name: '生成调研报告',
        instruction: '形成结构化调研报告，包含结论、证据、风险和建议。'
      },
      {
        id: 'final_reply',
        order: 5,
        type: 'output',
        name: '返回结果',
        instruction: '在对话中返回摘要，并给出完整报告下载入口。'
      }
    ];
  }

  return [
    {
      id: 'receive_task',
      order: 1,
      type: 'input',
      name: '接收任务',
      instruction: '确认用户目标、背景、输入资料、输出格式和限制条件。'
    },
    {
      id: 'gather_context',
      order: 2,
      type: 'knowledge',
      name: '读取知识',
      instruction: '读取企业知识库、本地资料和历史经验。'
    },
    {
      id: 'draft_result',
      order: 3,
      type: 'reasoning',
      name: '分析生成',
      instruction: '完成任务分析，生成可直接交付的初稿。'
    },
    {
      id: 'write_artifact',
      order: 4,
      type: 'tool',
      name: '生成产物',
      instruction: '把最终内容写入可下载的文件。',
      toolIds: ['office-document']
    },
    {
      id: 'final_reply',
      order: 5,
      type: 'output',
      name: '返回结果',
      instruction: '总结完成情况、产物路径和建议的下一步动作。'
    }
  ];
}

function createWorkflowGraph(preset: WorkflowPreset): RoleWorkflowGraph {
  return buildRoleWorkflowGraphFromSteps(createWorkflowSteps(preset), {
    runtimePolicy: {
      maxNodeExecutions: 64,
      maxLoopIterations: 8,
      requireApprovalBeforeTools: false
    }
  });
}

function nodeTone(type: RoleWorkflowGraphNode['type']) {
  if (type === 'llm' || type === 'reasoning') return 'blue';
  if (type === 'tool' || type === 'artifact') return 'purple';
  if (type === 'knowledge') return 'green';
  if (type === 'output') return 'gold';
  return 'default';
}

function buildPayload(values: CreateRoleTemplateFormValues): CreateAdminRoleTemplateRequest {
  const workflowSteps = createWorkflowSteps(values.workflowPreset);
  const workflowGraph = createWorkflowGraph(values.workflowPreset);
  const inferredTools = workflowSteps.flatMap((step) => step.toolIds ?? []);

  return {
    id: values.id.trim(),
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: uniqueTags(values.knowledgeSources),
    tools: uniqueTags([...uniqueTags(values.tools), ...inferredTools]),
    skills: normalizeSkills(values.skills),
    workflowSteps,
    workflowGraph,
    sampleInputs: uniqueTags(values.sampleInputs),
    outputFormat: values.outputFormat?.trim(),
    approvalPolicy: values.approvalPolicy.trim(),
    status: 'DRAFT',
    allowedPlanCodes: uniqueTags(values.allowedPlanCodes),
    visibleWorkspaceIds: uniqueTags(values.visibleWorkspaceIds)
  };
}

function buildUpdatePayload(
  values: CreateRoleTemplateFormValues,
  template: AdminRoleTemplateDetail
): UpdateAdminRoleTemplateRequest {
  const workflowSteps = template.workflowSteps.length ? template.workflowSteps : createWorkflowSteps(values.workflowPreset);
  const workflowGraph = template.workflowGraph?.nodes.length ? template.workflowGraph : createWorkflowGraph(values.workflowPreset);
  const inferredTools = workflowSteps.flatMap((step) => step.toolIds ?? []);

  return {
    version: values.version.trim(),
    name: values.name.trim(),
    industry: values.industry.trim(),
    scenario: values.scenario.trim(),
    description: values.description.trim(),
    recommendedPlanCode: values.recommendedPlanCode,
    businessGoal: values.businessGoal.trim(),
    knowledgeSources: uniqueTags(values.knowledgeSources),
    tools: uniqueTags([...uniqueTags(values.tools), ...inferredTools]),
    skills: normalizeSkills(values.skills),
    workflowSteps,
    workflowGraph,
    sampleInputs: uniqueTags(values.sampleInputs),
    outputFormat: values.outputFormat?.trim(),
    approvalPolicy: values.approvalPolicy.trim(),
    allowedPlanCodes: uniqueTags(values.allowedPlanCodes),
    visibleWorkspaceIds: uniqueTags(values.visibleWorkspaceIds)
  };
}

function inferInitialPreset(template?: AdminRoleTemplateDetail): WorkflowPreset {
  const text = [
    template?.id,
    template?.name,
    template?.scenario,
    ...(template?.tools ?? []),
    ...(template?.workflowSteps.flatMap((step) => [step.id, step.name, step.instruction, ...(step.toolIds ?? [])]) ?? [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (text.includes('web-search') || text.includes('research') || text.includes('调研')) {
    return 'research';
  }
  if (text.includes('file') || text.includes('document') || text.includes('文档') || text.includes('附件')) {
    return 'document';
  }
  return 'standard';
}

export function AdminCreateRoleTemplatePageClient({
  currentAccount,
  templates,
  plans,
  workspaces,
  templateId
}: AdminCreateRoleTemplatePageClientProps) {
  const router = useRouter();
  const [form] = Form.useForm<CreateRoleTemplateFormValues>();
  const [saving, setSaving] = useState(false);
  const editingTemplate = useMemo(
    () => templates.find((template) => template.id === templateId),
    [templateId, templates]
  );
  const selectedPreset = Form.useWatch('workflowPreset', form) ?? 'standard';
  const previewGraph = useMemo(
    () => editingTemplate?.workflowGraph ?? createWorkflowGraph(selectedPreset),
    [editingTemplate, selectedPreset]
  );

  const activeEnterprisePlans = useMemo(
    () => plans.filter((plan) => plan.status === 'ACTIVE' && plan.billingCycle !== 'FREE'),
    [plans]
  );
  const defaultPlanCode = activeEnterprisePlans[0]?.code ?? plans[0]?.code ?? '';

  const planOptions = useMemo(
    () => plans.map((plan) => ({ value: plan.code, label: `${plan.name} / ${plan.code}` })),
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

  const initialValues = useMemo<CreateRoleTemplateFormValues>(() => {
    if (editingTemplate) {
      return {
        id: editingTemplate.id,
        version: editingTemplate.version,
        name: editingTemplate.name,
        industry: editingTemplate.industry,
        scenario: editingTemplate.scenario,
        description: editingTemplate.description,
        businessGoal: editingTemplate.businessGoal,
        recommendedPlanCode: editingTemplate.recommendedPlanCode,
        approvalPolicy: editingTemplate.approvalPolicy,
        outputFormat: editingTemplate.outputFormat,
        workflowPreset: inferInitialPreset(editingTemplate),
        knowledgeSources: editingTemplate.knowledgeSources,
        tools: editingTemplate.tools,
        skills: editingTemplate.skills,
        sampleInputs: editingTemplate.sampleInputs,
        allowedPlanCodes: editingTemplate.allowedPlanCodes,
        visibleWorkspaceIds: editingTemplate.visibleWorkspaceIds
      };
    }

    return {
      id: `template_custom_${Date.now()}`,
      version: '1.0.0',
      workflowPreset: 'standard',
      recommendedPlanCode: defaultPlanCode,
      allowedPlanCodes: activeEnterprisePlans.map((plan) => plan.code),
      knowledgeSources: ['workspace_library', 'local_folder'],
      tools: ['office-document', 'local-filesystem'],
      skills: [
        { code: 'task_analysis', name: '任务分析', summary: '拆解目标、输入、约束和交付要求。' },
        { code: 'deliverable_generation', name: '产物生成', summary: '生成可下载、可复用的业务产物。' }
      ],
      outputFormat: '对话摘要 + 可下载的业务文档/表格/演示稿。',
      approvalPolicy: '涉及对外发布、合同、财务、医疗、法律或重大经营决策时必须人工确认。'
    } as CreateRoleTemplateFormValues;
  }, [activeEnterprisePlans, defaultPlanCode, editingTemplate]);

  async function handleSave(values: CreateRoleTemplateFormValues) {
    setSaving(true);
    try {
      const apiClient = createBrowserApiClient();
      const response = editingTemplate
        ? await apiClient.updateAdminRoleTemplate(editingTemplate.id, buildUpdatePayload(values, editingTemplate))
        : await apiClient.createAdminRoleTemplate(buildPayload(values));
      message.success(editingTemplate ? '工作画布已保存' : '数字员工草稿已创建');
      router.push(`/templates?${editingTemplate ? 'updated' : 'created'}=${encodeURIComponent(response.data.id)}`);
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建失败');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="工作画布"
        description={editingTemplate ? `编辑：${editingTemplate.name}` : '创建一个可测试、可上架、可被 PC 端同步安装的数字员工模板。'}
        actions={
          <Space>
            <Button icon={<ArrowLeftOutlined />} href="/templates">
              返回列表
            </Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => form.submit()}>
              {editingTemplate ? '保存画布' : '保存草稿'}
            </Button>
          </Space>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Alert
            showIcon
            type="info"
            message={editingTemplate ? '当前正在编辑已有数字员工' : '先创建草稿，再到数字员工列表中测试和上架'}
            description="工作画布会维护数字员工的基础信息、能力配置、工作流预览和发布范围。复杂节点、条件和工具参数后续继续强化。"
          />

          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={initialValues}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16 }}>
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="基础信息" bordered={false}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}>
                    <Form.Item name="id" label="员工 ID" rules={[{ required: true, message: '请输入员工 ID' }]}>
                      <Input disabled={Boolean(editingTemplate)} placeholder="template_sales_assistant" />
                    </Form.Item>
                    <Form.Item name="version" label="版本" rules={[{ required: true, message: '请输入版本号' }]}>
                      <Input placeholder="1.0.0" />
                    </Form.Item>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                      <Input placeholder="AI 销售助理" />
                    </Form.Item>
                    <Form.Item name="industry" label="行业/部门" rules={[{ required: true, message: '请输入行业或部门' }]}>
                      <Input placeholder="销售支持" />
                    </Form.Item>
                  </div>
                  <Form.Item name="scenario" label="使用场景" rules={[{ required: true, message: '请输入使用场景' }]}>
                    <Input placeholder="线索调研、客户跟进、方案草拟" />
                  </Form.Item>
                  <Form.Item name="description" label="说明" rules={[{ required: true, message: '请输入说明' }]}>
                    <Input.TextArea rows={3} />
                  </Form.Item>
                  <Form.Item name="businessGoal" label="业务目标" rules={[{ required: true, message: '请输入业务目标' }]}>
                    <Input.TextArea rows={2} />
                  </Form.Item>
                </Card>

                <Card title="能力配置" bordered={false}>
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
                          <Card key={field.key} size="small" bordered>
                            <div style={{ display: 'grid', gridTemplateColumns: '160px 180px 1fr 72px', gap: 12 }}>
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
                                <Input placeholder="线索调研" />
                              </Form.Item>
                              <Form.Item
                                {...field}
                                name={[field.name, 'summary']}
                                label="说明"
                                rules={[{ required: true, message: '请输入说明' }]}
                              >
                                <Input placeholder="搜索并整理潜在线索背景。" />
                              </Form.Item>
                              <Button danger style={{ marginTop: 30 }} onClick={() => remove(field.name)}>
                                删除
                              </Button>
                            </div>
                          </Card>
                        ))}
                        <Button type="dashed" onClick={() => add({ code: '', name: '', summary: '' })} block>
                          添加技能
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                </Card>

                <Card title="发布范围" bordered={false}>
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
                </Card>
              </Space>

              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                <Card title="简易工作流" bordered={false}>
                  <Form.Item name="workflowPreset" label="流程预设" rules={[{ required: true }]}>
                    <Select
                      disabled={Boolean(editingTemplate)}
                      options={workflowPresetOptions.map((option) => ({
                        value: option.value,
                        label: option.label
                      }))}
                    />
                  </Form.Item>
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {workflowPresetOptions
                      .filter((option) => option.value === selectedPreset)
                      .map((option) => (
                        <Typography.Text key={option.value} type="secondary">
                          {option.description}
                        </Typography.Text>
                      ))}
                    {previewGraph.nodes.map((node, index) => (
                      <Card key={node.id} size="small" bordered>
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          <Space wrap>
                            <Tag>{index + 1}</Tag>
                            <Typography.Text strong>{node.name}</Typography.Text>
                            <Tag color={nodeTone(node.type)}>{node.type}</Tag>
                          </Space>
                          <Typography.Text type="secondary">{node.instruction ?? node.description ?? '-'}</Typography.Text>
                        </Space>
                      </Card>
                    ))}
                  </Space>
                </Card>

                <Card title="测试与输出" bordered={false}>
                  <Form.Item name="sampleInputs" label="测试样例">
                    <Select mode="tags" tokenSeparators={[',']} placeholder="输入一个样例任务后回车" />
                  </Form.Item>
                  <Form.Item name="outputFormat" label="输出格式">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item
                    name="approvalPolicy"
                    label="审批策略"
                    rules={[{ required: true, message: '请输入审批策略' }]}
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Card>

                <Card bordered={false}>
                  <Space direction="vertical" size={8}>
                    <Typography.Text strong>保存后下一步</Typography.Text>
                    <Typography.Text type="secondary">
                      到 <Link href="/templates">数字员工</Link> 列表中测试节点 trace，确认通过后再上架。
                    </Typography.Text>
                  </Space>
                </Card>
              </Space>
            </div>
          </Form>
        </Space>
      </QiuPage>
    </AdminShell>
  );
}
