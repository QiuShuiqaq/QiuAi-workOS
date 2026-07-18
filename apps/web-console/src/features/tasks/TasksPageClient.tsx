'use client';

import type {
  CreateTaskRequest,
  CurrentAccountResponse,
  RoleInstanceSummary,
  TaskSummary
} from '@qiuai/api-contract';
import { QiuMetricCard, QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Col from 'antd/es/col';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Row from 'antd/es/row';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Typography from 'antd/es/typography';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { ConsoleShell } from '../../shared/console/ConsoleShell';
import { withWorkspaceId } from '../common/workspace-href';
import { taskPriorityLabel, taskStatusLabel, taskStatusTone } from './task-format';

export interface TasksPageClientProps {
  currentAccount: CurrentAccountResponse;
  roles: RoleInstanceSummary[];
  initialTasks: TaskSummary[];
  isApiFallback: boolean;
}

const taskTypeOptions = [
  { label: '案例素材处理', value: 'case_screening' },
  { label: '客户回访整理', value: 'customer_followup' },
  { label: '合同风险审核', value: 'contract_review' },
  { label: '通用业务任务', value: 'general_business_task' }
];

const priorityOptions = [
  { label: '普通', value: 'normal' },
  { label: '高', value: 'high' },
  { label: '紧急', value: 'urgent' },
  { label: '低', value: 'low' }
];

export function TasksPageClient({
  currentAccount,
  roles,
  initialTasks,
  isApiFallback
}: TasksPageClientProps) {
  const router = useRouter();
  const [form] = Form.useForm<CreateTaskRequest>();
  const [tasks, setTasks] = useState(initialTasks);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const workspaceId = currentAccount.activeWorkspaceId;
  const workspaceHref = (href: string) => withWorkspaceId(href, workspaceId);

  const metrics = useMemo(() => {
    const running = tasks.filter((task) => task.status === 'running' || task.status === 'queued').length;
    const waitingApproval = tasks.filter((task) => task.status === 'waiting_approval').length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    return { running, waitingApproval, completed };
  }, [tasks]);

  const columns: ColumnsType<TaskSummary> = [
    {
      title: '任务',
      dataIndex: 'title',
      render: (_value, task) => (
        <Space direction="vertical" size={2}>
          <Link href={workspaceHref(`/tasks/${task.id}`)}>
            <Typography.Text strong>{task.title}</Typography.Text>
          </Link>
          <Typography.Text type="secondary">{task.taskType}</Typography.Text>
        </Space>
      )
    },
    {
      title: 'AI 岗位',
      dataIndex: 'roleName',
      responsive: ['md']
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (status: TaskSummary['status']) => (
        <QiuStatusTag tone={taskStatusTone(status)}>{taskStatusLabel(status)}</QiuStatusTag>
      )
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      render: (priority: TaskSummary['priority']) => taskPriorityLabel(priority)
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      responsive: ['lg'],
      render: (updatedAt: string) => new Date(updatedAt).toLocaleString('zh-CN')
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, task) => <Link href={workspaceHref(`/tasks/${task.id}`)}>查看</Link>
    }
  ];

  async function createTask(values: CreateTaskRequest) {
    setErrorMessage(null);
    setIsCreating(true);
    try {
      const response = await createBrowserApiClient().createTask(workspaceId, values);
      const createdTask = response.data;
      setTasks((current) => [
        {
          id: createdTask.id,
          workspaceId: createdTask.workspaceId,
          roleInstanceId: createdTask.roleInstanceId,
          roleName: createdTask.roleName,
          title: createdTask.title,
          taskType: createdTask.taskType,
          status: createdTask.status,
          priority: createdTask.priority,
          createdAt: createdTask.createdAt,
          updatedAt: createdTask.updatedAt
        },
        ...current
      ]);
      form.resetFields();
      router.push(workspaceHref(`/tasks/${createdTask.id}`));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '创建任务失败，请确认后端服务已启动。');
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <ConsoleShell currentAccount={currentAccount}>
      <QiuPage title="任务中心" description="从岗位发起任务，跟踪执行状态，并进入详情查看产物、日志和成本。">
        {isApiFallback ? <Alert showIcon type="warning" message="后端 API 未连接，当前显示 fallback 数据，创建任务需要启动后端。" /> : null}
        {errorMessage ? <Alert showIcon type="error" message={errorMessage} /> : null}

        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <QiuMetricCard title="全部任务" value={String(tasks.length)} trend="当前工作空间" />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="执行队列" value={String(metrics.running)} trend="排队或运行中" />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="待审批" value={String(metrics.waitingApproval)} trend="需要人工确认" />
          </Col>
          <Col xs={24} md={6}>
            <QiuMetricCard title="已完成" value={String(metrics.completed)} trend="已有可交付结果" />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} xl={8}>
            <Card title="创建任务" bordered={false}>
              <Form
                form={form}
                layout="vertical"
                initialValues={{
                  roleInstanceId: roles[0]?.id,
                  taskType: 'case_screening',
                  priority: 'normal'
                }}
                onFinish={createTask}
              >
                <Form.Item
                  name="roleInstanceId"
                  label="执行岗位"
                  rules={[{ required: true, message: '请选择执行任务的 AI 岗位' }]}
                >
                  <Select
                    placeholder="选择 AI 岗位"
                    options={roles.map((role) => ({
                      label: `${role.name} / ${role.departmentName || '未分配'}`,
                      value: role.id
                    }))}
                  />
                </Form.Item>
                <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}>
                  <Input placeholder="例如：今日案例视频初筛" />
                </Form.Item>
                <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
                  <Select options={taskTypeOptions} />
                </Form.Item>
                <Form.Item name="priority" label="优先级">
                  <Select options={priorityOptions} />
                </Form.Item>
                <Form.Item name="input" label="任务输入" rules={[{ required: true, message: '请输入任务内容' }]}>
                  <Input.TextArea rows={5} placeholder="描述业务目标、输入素材、验收要求或审批要求。" />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={isCreating} block disabled={roles.length === 0}>
                  创建并进入任务
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} xl={16}>
            <Card title="任务列表" bordered={false}>
              <Table rowKey="id" columns={columns} dataSource={tasks} pagination={false} />
            </Card>
          </Col>
        </Row>
      </QiuPage>
    </ConsoleShell>
  );
}
