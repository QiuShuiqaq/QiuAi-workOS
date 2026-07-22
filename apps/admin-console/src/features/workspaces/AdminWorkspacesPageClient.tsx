'use client';

import type {
  AdminPlanDetail,
  AdminWorkspaceDetail,
  AdminWorkspaceStatus,
  AdminWorkspaceSummary,
  CreateAdminDesktopBindingCodeRequest,
  CreateAdminWorkspaceInvitationRequest,
  CreateAdminWorkspaceRequest,
  CurrentAccountResponse,
  GrantAdminWorkspaceAuthorizationRequest,
  PaginationMeta
} from '@qiuai/api-contract';
import {
  CheckCircleOutlined,
  DesktopOutlined,
  EyeOutlined,
  InboxOutlined,
  LinkOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { QiuPage, QiuStatusTag } from '@qiuai/ui';
import Alert from 'antd/es/alert';
import Button from 'antd/es/button';
import Card from 'antd/es/card';
import Descriptions from 'antd/es/descriptions';
import Drawer from 'antd/es/drawer';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import InputNumber from 'antd/es/input-number';
import Modal from 'antd/es/modal';
import Select from 'antd/es/select';
import Space from 'antd/es/space';
import Spin from 'antd/es/spin';
import Table from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import Tag from 'antd/es/tag';
import Typography from 'antd/es/typography';
import message from 'antd/es/message';
import { useMemo, useState } from 'react';

import { createBrowserApiClient } from '../../shared/api/browser-api';
import { AdminShell } from '../../shared/console/AdminShell';

export interface AdminWorkspacesPageClientProps {
  currentAccount: CurrentAccountResponse;
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  pagination: PaginationMeta;
}

type WorkspaceStatusForm = {
  reason: string;
  note?: string;
};

type WorkspaceStatusModalState = {
  workspace: AdminWorkspaceSummary;
  status: AdminWorkspaceStatus;
};

type CreatedWorkspaceNotice = {
  workspaceName: string;
  ownerEmail: string;
  temporaryPassword?: string;
};

type CreatedInvitationNotice = {
  email: string;
  inviteUrl: string;
};

type CreatedBindingCodeNotice = {
  bindingCode: string;
  expiresAt: string;
};

function formatDate(value?: string) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(value));
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

function formatCurrency(amountCents?: number, currency = 'CNY') {
  if (amountCents === undefined || amountCents === null) {
    return '-';
  }

  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency
  }).format(amountCents / 100);
}

function workspaceTone(status: string): 'default' | 'success' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'warning';
  return 'default';
}

function workspaceStatusLabel(status: string) {
  return {
    active: '正常',
    suspended: '已停用',
    archived: '已归档',
    ACTIVE: '正常',
    SUSPENDED: '已停用',
    ARCHIVED: '已归档'
  }[status] ?? status;
}

function defaultStatusReason(status: AdminWorkspaceStatus) {
  return {
    ACTIVE: '恢复企业访问',
    SUSPENDED: '暂停试点或欠费停用',
    ARCHIVED: '企业已结束合作，归档留存'
  }[status];
}

function memberRoleLabel(role: string) {
  return {
    OWNER: '所有者',
    ADMIN: '管理员',
    MEMBER: '成员',
    VIEWER: '只读'
  }[role] ?? role;
}

function invitationRoleLabel(role: string) {
  return {
    admin: '管理员',
    member: '成员',
    viewer: '只读'
  }[role] ?? role;
}

function invitationStatusLabel(status: string) {
  return {
    pending: '待接受',
    accepted: '已接受',
    cancelled: '已取消',
    expired: '已过期'
  }[status] ?? status;
}

function bindingCodeStatusLabel(status: string) {
  return {
    PENDING: '待绑定',
    REDEEMED: '已使用',
    EXPIRED: '已过期',
    CANCELLED: '已取消'
  }[status] ?? status;
}

function deviceStatusLabel(status: string) {
  return {
    ACTIVE: '正常',
    REVOKED: '已撤销'
  }[status] ?? status;
}

export function AdminWorkspacesPageClient({
  currentAccount,
  plans,
  workspaces,
  pagination
}: AdminWorkspacesPageClientProps) {
  const [rows, setRows] = useState(workspaces);
  const [paginationMeta, setPaginationMeta] = useState(pagination);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<AdminWorkspaceDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [authorizing, setAuthorizing] = useState(false);
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [createdNotice, setCreatedNotice] = useState<CreatedWorkspaceNotice | null>(null);
  const [selectedWorkspace, setSelectedWorkspace] = useState<AdminWorkspaceSummary | null>(null);
  const [statusModal, setStatusModal] = useState<WorkspaceStatusModalState | null>(null);
  const [statusChanging, setStatusChanging] = useState(false);
  const [invitationOpen, setInvitationOpen] = useState(false);
  const [creatingInvitation, setCreatingInvitation] = useState(false);
  const [createdInvitationNotice, setCreatedInvitationNotice] = useState<CreatedInvitationNotice | null>(null);
  const [cancellingInvitationId, setCancellingInvitationId] = useState<string | null>(null);
  const [bindingCodeOpen, setBindingCodeOpen] = useState(false);
  const [creatingBindingCode, setCreatingBindingCode] = useState(false);
  const [createdBindingCodeNotice, setCreatedBindingCodeNotice] = useState<CreatedBindingCodeNotice | null>(null);
  const [revokingDeviceId, setRevokingDeviceId] = useState<string | null>(null);
  const [createWorkspaceForm] = Form.useForm<CreateAdminWorkspaceRequest>();
  const [authorizeForm] = Form.useForm<GrantAdminWorkspaceAuthorizationRequest>();
  const [statusForm] = Form.useForm<WorkspaceStatusForm>();
  const [invitationForm] = Form.useForm<CreateAdminWorkspaceInvitationRequest>();
  const [bindingCodeForm] = Form.useForm<CreateAdminDesktopBindingCodeRequest>();

  const enterprisePlans = useMemo(
    () => plans.filter((plan) => plan.billingCycle !== 'FREE'),
    [plans]
  );
  const activeEnterprisePlans = useMemo(
    () => enterprisePlans.filter((plan) => plan.status === 'ACTIVE'),
    [enterprisePlans]
  );

  async function loadWorkspaces(nextPage = paginationMeta.page, nextPageSize = paginationMeta.pageSize, nextQuery = query) {
    setLoading(true);
    try {
      const response = await createBrowserApiClient().listAdminWorkspaces({
        page: nextPage,
        pageSize: nextPageSize,
        query: nextQuery || undefined
      });
      setRows(response.data);
      setPaginationMeta(response.pagination);
      setQuery(nextQuery);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载企业失败';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(workspace: AdminWorkspaceSummary) {
    setDetailOpen(true);
    setDetailLoading(true);
    setCreatedInvitationNotice(null);
    setCreatedBindingCodeNotice(null);
    try {
      const response = await createBrowserApiClient().getAdminWorkspace(workspace.id);
      setDetail(response.data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '加载企业详情失败';
      message.error(errorMessage);
    } finally {
      setDetailLoading(false);
    }
  }

  async function refreshDetail(workspaceId: string) {
    const response = await createBrowserApiClient().getAdminWorkspace(workspaceId);
    setDetail(response.data);
    setRows((current) =>
      current.map((workspace) =>
        workspace.id === workspaceId ? response.data.workspace : workspace
      )
    );
    return response.data;
  }

  function openCreateWorkspace() {
    setCreateWorkspaceOpen(true);
    createWorkspaceForm.setFieldsValue({
      planCode: activeEnterprisePlans[0]?.code,
      durationDays: 30
    });
  }

  async function handleCreateWorkspace(values: CreateAdminWorkspaceRequest) {
    setCreatingWorkspace(true);
    try {
      const response = await createBrowserApiClient().createAdminWorkspace({
        ...values,
        ownerPassword: values.ownerPassword?.trim() || undefined,
        tenantName: values.tenantName?.trim() || undefined,
        industry: values.industry?.trim() || undefined,
        size: values.size?.trim() || undefined,
        note: values.note?.trim() || undefined
      });

      setRows((current) => [response.data.workspace, ...current]);
      setPaginationMeta((current) => ({
        ...current,
        totalItems: current.totalItems + 1,
        totalPages: Math.max(1, Math.ceil((current.totalItems + 1) / current.pageSize))
      }));
      setDetail(response.data);
      setDetailOpen(true);
      setCreatedNotice({
        workspaceName: response.data.workspace.name,
        ownerEmail: response.ownerAccount.primaryEmail,
        temporaryPassword: response.temporaryPassword
      });
      message.success('企业已创建并开通授权');
      setCreateWorkspaceOpen(false);
      createWorkspaceForm.resetFields();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建企业失败';
      message.error(errorMessage);
    } finally {
      setCreatingWorkspace(false);
    }
  }

  function openAuthorization(workspace: AdminWorkspaceSummary) {
    const defaultPlanCode =
      workspace.planCode !== 'PERSONAL_FREE'
        ? workspace.planCode
        : enterprisePlans[0]?.code;

    setSelectedWorkspace(workspace);
    authorizeForm.setFieldsValue({
      planCode: defaultPlanCode,
      durationDays: 30,
      reason: '试点授权',
      note: ''
    });
  }

  function openStatusChange(workspace: AdminWorkspaceSummary, status: AdminWorkspaceStatus) {
    setStatusModal({
      workspace,
      status
    });
    statusForm.setFieldsValue({
      reason: defaultStatusReason(status),
      note: ''
    });
  }

  async function handleAuthorization(values: GrantAdminWorkspaceAuthorizationRequest) {
    if (!selectedWorkspace) {
      return;
    }

    setAuthorizing(true);
    try {
      const response = await createBrowserApiClient().grantAdminWorkspaceAuthorization(
        selectedWorkspace.id,
        values
      );
      setRows((current) =>
        current.map((workspace) =>
          workspace.id === selectedWorkspace.id ? response.data.workspace : workspace
        )
      );
      setDetail((current) =>
        current?.workspace.id === selectedWorkspace.id ? response.data : current
      );
      message.success('手动授权已生效');
      setSelectedWorkspace(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '手动授权失败';
      message.error(errorMessage);
    } finally {
      setAuthorizing(false);
    }
  }

  async function handleStatusChange(values: WorkspaceStatusForm) {
    if (!statusModal) {
      return;
    }

    setStatusChanging(true);
    try {
      const response = await createBrowserApiClient().updateAdminWorkspaceStatus(statusModal.workspace.id, {
        status: statusModal.status,
        reason: values.reason.trim(),
        note: values.note?.trim() || undefined
      });
      setRows((current) =>
        current.map((workspace) =>
          workspace.id === statusModal.workspace.id ? response.data.workspace : workspace
        )
      );
      setDetail((current) =>
        current?.workspace.id === statusModal.workspace.id ? response.data : current
      );
      message.success(`企业状态已更新为${workspaceStatusLabel(response.data.workspace.status)}`);
      setStatusModal(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '更新企业状态失败';
      message.error(errorMessage);
    } finally {
      setStatusChanging(false);
    }
  }

  function openInvitationCreator() {
    if (!detail) {
      return;
    }

    invitationForm.setFieldsValue({
      systemRole: 'member',
      expiresInDays: 7
    });
    setInvitationOpen(true);
    setCreatedInvitationNotice(null);
  }

  async function handleCreateInvitation(values: CreateAdminWorkspaceInvitationRequest) {
    if (!detail) {
      return;
    }

    setCreatingInvitation(true);
    try {
      const response = await createBrowserApiClient().createAdminWorkspaceInvitation(detail.workspace.id, {
        email: values.email.trim(),
        systemRole: values.systemRole ?? 'member',
        departmentId: values.departmentId?.trim() || undefined,
        expiresInDays: values.expiresInDays ?? 7
      });
      setDetail((current) =>
        current?.workspace.id === detail.workspace.id
          ? {
              ...current,
              invitations: [response.data, ...current.invitations]
            }
          : current
      );
      setCreatedInvitationNotice({
        email: response.data.email,
        inviteUrl: response.inviteUrl
      });
      message.success('邀请链接已生成');
      setInvitationOpen(false);
      invitationForm.resetFields();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '创建邀请失败';
      message.error(errorMessage);
    } finally {
      setCreatingInvitation(false);
    }
  }

  function cancelInvitation(invitationId: string, email: string) {
    if (!detail) {
      return;
    }

    const workspaceId = detail.workspace.id;
    Modal.confirm({
      title: '取消邀请',
      content: `确认取消 ${email} 的邀请？`,
      okText: '确认取消',
      okButtonProps: {
        danger: true
      },
      cancelText: '返回',
      onOk: async () => {
        setCancellingInvitationId(invitationId);
        try {
          const response = await createBrowserApiClient().cancelAdminWorkspaceInvitation(workspaceId, invitationId);
          setDetail((current) =>
            current?.workspace.id === workspaceId
              ? {
                  ...current,
                  invitations: current.invitations.map((invitation) =>
                    invitation.id === invitationId ? response.data : invitation
                  )
                }
              : current
          );
          message.success('邀请已取消');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '取消邀请失败';
          message.error(errorMessage);
          throw error;
        } finally {
          setCancellingInvitationId(null);
        }
      }
    });
  }

  function openBindingCodeCreator() {
    if (!detail) {
      return;
    }

    bindingCodeForm.setFieldsValue({
      expiresInMinutes: 10
    });
    setBindingCodeOpen(true);
    setCreatedBindingCodeNotice(null);
  }

  async function handleCreateBindingCode(values: CreateAdminDesktopBindingCodeRequest) {
    if (!detail) {
      return;
    }

    setCreatingBindingCode(true);
    try {
      const response = await createBrowserApiClient().createAdminDesktopBindingCode(detail.workspace.id, {
        expiresInMinutes: values.expiresInMinutes ?? 10
      });
      const { bindingCode, ...bindingSummary } = response.data;
      setDetail((current) =>
        current?.workspace.id === detail.workspace.id
          ? {
              ...current,
              desktopBindingCodes: [bindingSummary, ...current.desktopBindingCodes]
            }
          : current
      );
      setCreatedBindingCodeNotice({
        bindingCode,
        expiresAt: response.data.expiresAt
      });
      message.success('桌面绑定码已生成');
      setBindingCodeOpen(false);
      bindingCodeForm.resetFields();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '生成绑定码失败';
      message.error(errorMessage);
    } finally {
      setCreatingBindingCode(false);
    }
  }

  function revokeDevice(deviceId: string, deviceName: string) {
    if (!detail) {
      return;
    }

    const workspaceId = detail.workspace.id;
    Modal.confirm({
      title: '撤销桌面设备',
      content: `撤销后 ${deviceName} 需要重新绑定才能继续同步。`,
      okText: '确认撤销',
      okButtonProps: {
        danger: true
      },
      cancelText: '返回',
      onOk: async () => {
        setRevokingDeviceId(deviceId);
        try {
          const response = await createBrowserApiClient().revokeAdminDesktopDevice(workspaceId, deviceId);
          setDetail((current) =>
            current?.workspace.id === workspaceId
              ? {
                  ...current,
                  desktopDevices: current.desktopDevices.map((device) =>
                    device.id === deviceId ? response.data : device
                  )
                }
              : current
          );
          message.success('桌面设备已撤销');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '撤销设备失败';
          message.error(errorMessage);
          throw error;
        } finally {
          setRevokingDeviceId(null);
        }
      }
    });
  }

  const columns: ColumnsType<AdminWorkspaceSummary> = [
    {
      title: '企业',
      dataIndex: 'name',
      render: (_value, workspace) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{workspace.name}</Typography.Text>
          <Typography.Text type="secondary" copyable>
            {workspace.id}
          </Typography.Text>
        </Space>
      )
    },
    {
      title: '租户',
      dataIndex: 'tenantName',
      responsive: ['lg']
    },
    {
      title: '所有者',
      dataIndex: 'ownerEmail'
    },
    {
      title: '套餐',
      key: 'plan',
      render: (_value, workspace) => (
        <Space direction="vertical" size={2}>
          <Typography.Text>{workspace.planName ?? workspace.planCode}</Typography.Text>
          <Typography.Text type="secondary">{workspace.subscriptionStatus ?? '-'}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      key: 'status',
      render: (_value, workspace) => (
        <QiuStatusTag tone={workspaceTone(workspace.status)}>
          {workspaceStatusLabel(workspace.status)}
        </QiuStatusTag>
      )
    },
    {
      title: '规模',
      key: 'counts',
      responsive: ['xl'],
      render: (_value, workspace) => (
        <Space wrap>
          <Tag>成员 {workspace.memberCount}</Tag>
          <Tag>岗位 {workspace.roleCount}</Tag>
          <Tag>设备 {workspace.desktopDeviceCount}</Tag>
        </Space>
      )
    },
    {
      title: '到期',
      key: 'expires',
      render: (_value, workspace) => formatDate(workspace.subscriptionPeriodEnd)
    },
    {
      title: '操作',
      key: 'actions',
      render: (_value, workspace) => (
        <Space wrap>
          <Button icon={<EyeOutlined />} onClick={() => openDetail(workspace)}>
            详情
          </Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() => openAuthorization(workspace)}
          >
            手动授权
          </Button>
          {workspace.status === 'active' ? (
            <>
              <Button icon={<StopOutlined />} onClick={() => openStatusChange(workspace, 'SUSPENDED')}>
                停用
              </Button>
              <Button icon={<InboxOutlined />} onClick={() => openStatusChange(workspace, 'ARCHIVED')}>
                归档
              </Button>
            </>
          ) : (
            <Button icon={<CheckCircleOutlined />} onClick={() => openStatusChange(workspace, 'ACTIVE')}>
              恢复
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <AdminShell currentAccount={currentAccount}>
      <QiuPage
        title="企业管理"
        description="查看企业工作空间、桌面设备、订单摘要，并在试点阶段做人工授权兜底。"
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateWorkspace}>
            创建企业
          </Button>
        }
      >
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {createdNotice ? (
            <Alert
              showIcon
              closable
              type="success"
              message={`企业已创建：${createdNotice.workspaceName}`}
              description={
                <Space direction="vertical" size={4}>
                  <Typography.Text>Owner：{createdNotice.ownerEmail}</Typography.Text>
                  {createdNotice.temporaryPassword ? (
                    <Typography.Text copyable={{ text: createdNotice.temporaryPassword }}>
                      临时密码：{createdNotice.temporaryPassword}
                    </Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">Owner 使用已有密码登录。</Typography.Text>
                  )}
                </Space>
              }
              onClose={() => setCreatedNotice(null)}
            />
          ) : null}

          <Alert
            showIcon
            type="warning"
            message="手动授权不是手动改支付成功"
            description="手动授权只更新企业订阅，不伪造支付宝支付结果；后台会记录管理员操作日志。"
          />

          <Card bordered={false}>
            <Input.Search
              allowClear
              placeholder="搜索企业名称、租户、所有者邮箱或 UUID"
              enterButton="搜索"
              onSearch={(value) => void loadWorkspaces(1, paginationMeta.pageSize, value)}
              style={{ maxWidth: 520 }}
            />
          </Card>

          <Card bordered={false}>
            <Table
              rowKey="id"
              columns={columns}
              dataSource={rows}
              loading={loading}
              pagination={{
                current: paginationMeta.page,
                pageSize: paginationMeta.pageSize,
                total: paginationMeta.totalItems,
                showSizeChanger: true
              }}
              onChange={(nextPagination) => {
                void loadWorkspaces(
                  nextPagination.current ?? paginationMeta.page,
                  nextPagination.pageSize ?? paginationMeta.pageSize
                );
              }}
            />
          </Card>
        </Space>
      </QiuPage>

      <Drawer
        title={detail ? detail.workspace.name : '企业详情'}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={900}
        extra={
          detail ? (
            <Space wrap>
              <Button icon={<ReloadOutlined />} onClick={() => void refreshDetail(detail.workspace.id)}>
                刷新
              </Button>
              <Button icon={<TeamOutlined />} onClick={openInvitationCreator}>
                邀请成员
              </Button>
              <Button icon={<DesktopOutlined />} onClick={openBindingCodeCreator}>
                生成绑定码
              </Button>
              <Button type="primary" onClick={() => openAuthorization(detail.workspace)}>
                手动授权
              </Button>
              {detail.workspace.status === 'active' ? (
                <>
                  <Button onClick={() => openStatusChange(detail.workspace, 'SUSPENDED')}>停用</Button>
                  <Button onClick={() => openStatusChange(detail.workspace, 'ARCHIVED')}>归档</Button>
                </>
              ) : (
                <Button icon={<CheckCircleOutlined />} onClick={() => openStatusChange(detail.workspace, 'ACTIVE')}>
                  恢复
                </Button>
              )}
            </Space>
          ) : null
        }
      >
        {detailLoading ? (
          <Spin />
        ) : detail ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions bordered column={1} size="small">
              <Descriptions.Item label="工作空间 ID">{detail.workspace.id}</Descriptions.Item>
              <Descriptions.Item label="所有者">{detail.workspace.ownerEmail}</Descriptions.Item>
              <Descriptions.Item label="当前状态">
                <QiuStatusTag tone={workspaceTone(detail.workspace.status)}>
                  {workspaceStatusLabel(detail.workspace.status)}
                </QiuStatusTag>
              </Descriptions.Item>
              <Descriptions.Item label="当前套餐">
                {detail.workspace.planName ?? detail.workspace.planCode}
              </Descriptions.Item>
              <Descriptions.Item label="订阅状态">
                {detail.subscription?.status ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="订阅到期">
                {formatDate(detail.subscription?.currentPeriodEnd)}
              </Descriptions.Item>
              <Descriptions.Item label="桌面设备">
                {detail.workspace.desktopDeviceCount}
              </Descriptions.Item>
            </Descriptions>

            {createdInvitationNotice ? (
              <Alert
                showIcon
                closable
                type="success"
                message={`邀请链接已生成：${createdInvitationNotice.email}`}
                description={
                  <Typography.Text copyable={{ text: createdInvitationNotice.inviteUrl }}>
                    {createdInvitationNotice.inviteUrl}
                  </Typography.Text>
                }
                onClose={() => setCreatedInvitationNotice(null)}
              />
            ) : null}

            {createdBindingCodeNotice ? (
              <Alert
                showIcon
                closable
                type="success"
                message="桌面绑定码已生成"
                description={
                  <Space direction="vertical" size={4}>
                    <Typography.Text copyable={{ text: createdBindingCodeNotice.bindingCode }}>
                      绑定码：{createdBindingCodeNotice.bindingCode}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      有效期至：{formatDateTime(createdBindingCodeNotice.expiresAt)}
                    </Typography.Text>
                  </Space>
                }
                onClose={() => setCreatedBindingCodeNotice(null)}
              />
            ) : null}

            <Card size="small" title="成员">
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.members}
                columns={[
                  { title: '邮箱', dataIndex: 'primaryEmail' },
                  {
                    title: '角色',
                    key: 'role',
                    render: (_value, member) => <Tag>{memberRoleLabel(member.role)}</Tag>
                  },
                  {
                    title: '部门',
                    key: 'department',
                    render: (_value, member) => member.departmentName ?? '-'
                  },
                  {
                    title: '加入时间',
                    key: 'createdAt',
                    render: (_value, member) => formatDate(member.createdAt)
                  }
                ]}
              />
            </Card>

            <Card
              size="small"
              title="邀请"
              extra={
                <Button size="small" icon={<LinkOutlined />} onClick={openInvitationCreator}>
                  创建邀请
                </Button>
              }
            >
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.invitations}
                columns={[
                  { title: '邮箱', dataIndex: 'email' },
                  {
                    title: '角色',
                    key: 'systemRole',
                    render: (_value, invitation) => <Tag>{invitationRoleLabel(invitation.systemRole)}</Tag>
                  },
                  {
                    title: '状态',
                    key: 'status',
                    render: (_value, invitation) => <Tag>{invitationStatusLabel(invitation.status)}</Tag>
                  },
                  {
                    title: '过期时间',
                    key: 'expiresAt',
                    render: (_value, invitation) => formatDateTime(invitation.expiresAt)
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    render: (_value, invitation) =>
                      invitation.status === 'pending' ? (
                        <Button
                          danger
                          size="small"
                          loading={cancellingInvitationId === invitation.id}
                          onClick={() => cancelInvitation(invitation.id, invitation.email)}
                        >
                          取消
                        </Button>
                      ) : (
                        '-'
                      )
                  }
                ]}
              />
            </Card>

            <Card
              size="small"
              title="桌面绑定码"
              extra={
                <Button size="small" icon={<DesktopOutlined />} onClick={openBindingCodeCreator}>
                  生成绑定码
                </Button>
              }
            >
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.desktopBindingCodes}
                columns={[
                  {
                    title: '状态',
                    key: 'status',
                    render: (_value, bindingCode) => <Tag>{bindingCodeStatusLabel(bindingCode.status)}</Tag>
                  },
                  {
                    title: '过期时间',
                    key: 'expiresAt',
                    render: (_value, bindingCode) => formatDateTime(bindingCode.expiresAt)
                  },
                  {
                    title: '使用时间',
                    key: 'redeemedAt',
                    render: (_value, bindingCode) => formatDateTime(bindingCode.redeemedAt)
                  },
                  {
                    title: '创建时间',
                    key: 'createdAt',
                    render: (_value, bindingCode) => formatDateTime(bindingCode.createdAt)
                  }
                ]}
              />
            </Card>

            <Card size="small" title="最近订单">
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.recentOrders}
                columns={[
                  { title: '订单号', dataIndex: 'orderNo' },
                  { title: '状态', dataIndex: 'status' },
                  {
                    title: '金额',
                    key: 'amount',
                    render: (_value, order) => formatCurrency(order.amountCents, order.currency)
                  },
                  { title: '套餐', dataIndex: 'planName' },
                  {
                    title: '创建时间',
                    key: 'createdAt',
                    render: (_value, order) => formatDate(order.createdAt)
                  }
                ]}
              />
            </Card>

            <Card size="small" title="桌面设备">
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={detail.desktopDevices}
                columns={[
                  { title: '设备', dataIndex: 'deviceName' },
                  { title: '平台', dataIndex: 'platform' },
                  { title: '版本', dataIndex: 'appVersion' },
                  {
                    title: '状态',
                    key: 'status',
                    render: (_value, device) => <Tag>{deviceStatusLabel(device.status)}</Tag>
                  },
                  {
                    title: '最后同步',
                    key: 'lastSyncedAt',
                    render: (_value, device) => formatDateTime(device.lastSyncedAt)
                  },
                  {
                    title: '操作',
                    key: 'actions',
                    render: (_value, device) =>
                      device.status === 'ACTIVE' ? (
                        <Button
                          danger
                          size="small"
                          loading={revokingDeviceId === device.id}
                          onClick={() => revokeDevice(device.id, device.deviceName)}
                        >
                          撤销
                        </Button>
                      ) : (
                        '-'
                      )
                  }
                ]}
              />
            </Card>
          </Space>
        ) : (
          <Typography.Text type="secondary">暂无详情</Typography.Text>
        )}
      </Drawer>

      <Modal
        title={`邀请成员：${detail?.workspace.name ?? ''}`}
        open={invitationOpen}
        onCancel={() => setInvitationOpen(false)}
        onOk={() => invitationForm.submit()}
        confirmLoading={creatingInvitation}
        okText="生成邀请链接"
      >
        <Form layout="vertical" form={invitationForm} onFinish={handleCreateInvitation}>
          <Form.Item
            name="email"
            label="成员邮箱"
            rules={[
              { required: true, message: '请输入成员邮箱' },
              { type: 'email', message: '请输入有效邮箱' }
            ]}
          >
            <Input placeholder="member@example.com" />
          </Form.Item>

          <Form.Item name="systemRole" label="系统角色" rules={[{ required: true, message: '请选择系统角色' }]}>
            <Select
              options={[
                { value: 'member', label: '成员' },
                { value: 'admin', label: '管理员' },
                { value: 'viewer', label: '只读' }
              ]}
            />
          </Form.Item>

          <Form.Item name="departmentId" label="部门 ID">
            <Input placeholder="可选；后续企业组织结构稳定后再填写" />
          </Form.Item>

          <Form.Item name="expiresInDays" label="有效天数" rules={[{ required: true, message: '请输入有效天数' }]}>
            <InputNumber min={1} max={30} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`生成桌面绑定码：${detail?.workspace.name ?? ''}`}
        open={bindingCodeOpen}
        onCancel={() => setBindingCodeOpen(false)}
        onOk={() => bindingCodeForm.submit()}
        confirmLoading={creatingBindingCode}
        okText="生成绑定码"
      >
        <Alert
          showIcon
          type="info"
          message="绑定码只用于企业桌面端首次绑定"
          description="企业用户在桌面端输入绑定码后，桌面端会换取设备 token 并绑定到当前企业。"
          style={{ marginBottom: 16 }}
        />
        <Form layout="vertical" form={bindingCodeForm} onFinish={handleCreateBindingCode}>
          <Form.Item
            name="expiresInMinutes"
            label="有效分钟数"
            rules={[{ required: true, message: '请输入有效分钟数' }]}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="创建企业"
        open={createWorkspaceOpen}
        onCancel={() => setCreateWorkspaceOpen(false)}
        onOk={() => createWorkspaceForm.submit()}
        confirmLoading={creatingWorkspace}
        width={760}
        okText="创建并开通"
      >
        <Form layout="vertical" form={createWorkspaceForm} onFinish={handleCreateWorkspace}>
          <Form.Item
            name="workspaceName"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称' }]}
          >
            <Input placeholder="例如：某某科技有限公司" />
          </Form.Item>

          <Form.Item name="tenantName" label="租户名称">
            <Input placeholder="可不填，默认使用企业名称 + Tenant" />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item
              name="ownerEmail"
              label="Owner 登录邮箱"
              rules={[
                { required: true, message: '请输入 Owner 邮箱' },
                { type: 'email', message: '请输入有效邮箱' }
              ]}
              style={{ flex: 1 }}
            >
              <Input placeholder="customer@example.com" />
            </Form.Item>

            <Form.Item
              name="ownerPassword"
              label="Owner 初始密码"
              rules={[{ min: 8, message: '至少 8 位' }]}
              style={{ flex: 1 }}
              extra="可不填；为空时系统会生成一次性临时密码。"
            >
              <Input.Password placeholder="可选" />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item
              name="planCode"
              label="开通套餐"
              rules={[{ required: true, message: '请选择套餐' }]}
              style={{ flex: 1 }}
            >
              <Select
                options={activeEnterprisePlans.map((plan) => ({
                  value: plan.code,
                  label: `${plan.name} / ${plan.code}`
                }))}
              />
            </Form.Item>

            <Form.Item
              name="durationDays"
              label="授权天数"
              rules={[{ required: true, message: '请输入授权天数' }]}
              style={{ width: 180 }}
            >
              <InputNumber min={1} max={3650} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item name="industry" label="行业" style={{ flex: 1 }}>
              <Input placeholder="例如：制造业 / 教育 / 电商" />
            </Form.Item>
            <Form.Item name="size" label="规模" style={{ flex: 1 }}>
              <Input placeholder="例如：10-50 / 50-200" />
            </Form.Item>
          </Space>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="可选，记录试点背景、客户来源、沟通说明" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`手动授权：${selectedWorkspace?.name ?? ''}`}
        open={Boolean(selectedWorkspace)}
        onCancel={() => setSelectedWorkspace(null)}
        onOk={() => authorizeForm.submit()}
        confirmLoading={authorizing}
        okText="确认授权"
      >
        <Form layout="vertical" form={authorizeForm} onFinish={handleAuthorization}>
          <Form.Item name="planCode" label="授权套餐" rules={[{ required: true, message: '请选择套餐' }]}>
            <Select
              options={enterprisePlans.map((plan) => ({
                value: plan.code,
                label: `${plan.name} / ${plan.code}`
              }))}
            />
          </Form.Item>

          <Form.Item
            name="durationDays"
            label="授权天数"
            rules={[{ required: true, message: '请输入授权天数' }]}
          >
            <InputNumber min={1} max={3650} style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="reason" label="授权原因" rules={[{ required: true, message: '请输入授权原因' }]}>
            <Input placeholder="试点授权 / 线下付款 / 内部演示" />
          </Form.Item>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="可选，记录客户、合同、沟通背景" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`更新企业状态：${statusModal?.workspace.name ?? ''}`}
        open={Boolean(statusModal)}
        onCancel={() => setStatusModal(null)}
        onOk={() => statusForm.submit()}
        confirmLoading={statusChanging}
        okText="确认更新"
      >
        <Form layout="vertical" form={statusForm} onFinish={handleStatusChange}>
          <Form.Item name="reason" label="原因" rules={[{ required: true, message: '请输入原因' }]}>
            <Input placeholder="停用 / 归档 / 恢复原因" />
          </Form.Item>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={3} placeholder="可选，记录补充说明" />
          </Form.Item>
        </Form>
      </Modal>
    </AdminShell>
  );
}
