import type {
  AuthSessionResponse,
  CreateBillingOrderRequest,
  CreateBillingOrderResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  SyncAlipayOrderResponse,
  ApiErrorResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  CreateDepartmentRequest,
  CreateDepartmentResponse,
  CancelAdminWorkspaceInvitationResponse,
  CreateAdminDesktopBindingCodeRequest,
  CreateAdminDesktopBindingCodeResponse,
  EntitlementCheckRequest,
  EntitlementCheckResult,
  GetRoleInstanceResponse,
  GetTaskResponse,
  GetBillingOverviewResponse,
  GetEnterpriseWorkspaceOverviewResponse,
  AcceptWorkspaceInvitationRequest,
  AcceptWorkspaceInvitationResponse,
  CreateAdminWorkspaceRequest,
  CreateAdminWorkspaceResponse,
  CreateAdminWorkspaceInvitationRequest,
  CreateAdminWorkspaceInvitationResponse,
  GrantAdminWorkspaceAuthorizationRequest,
  GrantAdminWorkspaceAuthorizationResponse,
  ListAdminActionLogsResponse,
  CancelWorkspaceInvitationResponse,
  CreateDesktopBindingCodeRequest,
  CreateDesktopBindingCodeResponse,
  CreateWorkspaceInvitationRequest,
  CreateWorkspaceInvitationResponse,
  CurrentAccountResponse,
  GetAdminWorkspaceResponse,
  ListDesktopDevicesResponse,
  ListAdminPlansResponse,
  ListAdminWorkspacesResponse,
  GetPublicInvitationResponse,
  KernelStatusResponse,
  ListWorkspaceInvitationsResponse,
  ListRoleInstancesResponse,
  ListRoleTemplatesResponse,
  ListPlansResponse,
  ListTasksResponse,
  InstallRoleRequest,
  InstallRoleResponse,
  RedeemDesktopBindingCodeRequest,
  RedeemDesktopBindingCodeResponse,
  PlatformOverviewResponse,
  RevokeAdminDesktopDeviceResponse,
  UpdateAdminWorkspaceStatusRequest,
  UpdateAdminWorkspaceStatusResponse,
  UpdateAdminPlanRequest,
  UpdateAdminPlanResponse
} from '@qiuai/api-contract';

export interface QiuApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: HeadersInit;
  credentials?: RequestCredentials;
}

export class QiuApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorResponse
  ) {
    super(body.error.message);
  }
}

export class QiuApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: HeadersInit | undefined;
  private readonly credentials: RequestCredentials;

  constructor(options: QiuApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    const resolvedFetch = options.fetchImpl ?? globalThis.fetch;
    this.fetchImpl = ((input, init) => resolvedFetch.call(globalThis, input, init)) as typeof fetch;
    this.defaultHeaders = options.defaultHeaders;
    this.credentials = options.credentials ?? 'same-origin';
  }

  getAuthSession(): Promise<AuthSessionResponse> {
    return this.get('/api/v1/auth/session');
  }

  login(input: LoginRequest): Promise<LoginResponse> {
    return this.post('/api/v1/auth/login', input);
  }

  logout(): Promise<LogoutResponse> {
    return this.post('/api/v1/auth/logout', {});
  }

  getKernelStatus(): Promise<KernelStatusResponse> {
    return this.get('/api/v1/kernel/status');
  }

  getCurrentAccount(): Promise<CurrentAccountResponse> {
    return this.get('/api/v1/workspaces/current');
  }

  listPlans(): Promise<ListPlansResponse> {
    return this.get('/api/v1/commercial/plans');
  }

  listAdminPlans(): Promise<ListAdminPlansResponse> {
    return this.get('/api/v1/admin/plans');
  }

  createAdminWorkspace(input: CreateAdminWorkspaceRequest): Promise<CreateAdminWorkspaceResponse> {
    return this.post('/api/v1/admin/workspaces', input);
  }

  createAdminWorkspaceInvitation(
    workspaceId: string,
    input: CreateAdminWorkspaceInvitationRequest
  ): Promise<CreateAdminWorkspaceInvitationResponse> {
    return this.post(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/invitations`, input);
  }

  cancelAdminWorkspaceInvitation(
    workspaceId: string,
    invitationId: string
  ): Promise<CancelAdminWorkspaceInvitationResponse> {
    return this.post(
      `/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
      {}
    );
  }

  createAdminDesktopBindingCode(
    workspaceId: string,
    input: CreateAdminDesktopBindingCodeRequest
  ): Promise<CreateAdminDesktopBindingCodeResponse> {
    return this.post(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/desktop-binding-codes`, input);
  }

  revokeAdminDesktopDevice(
    workspaceId: string,
    deviceId: string
  ): Promise<RevokeAdminDesktopDeviceResponse> {
    return this.post(
      `/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/desktop-devices/${encodeURIComponent(deviceId)}/revoke`,
      {}
    );
  }

  updateAdminPlan(planCode: string, input: UpdateAdminPlanRequest): Promise<UpdateAdminPlanResponse> {
    return this.patch(`/api/v1/admin/plans/${encodeURIComponent(planCode)}`, input);
  }

  listAdminWorkspaces(params?: {
    page?: number;
    pageSize?: number;
    query?: string;
  }): Promise<ListAdminWorkspacesResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.pageSize !== undefined) {
      searchParams.set('pageSize', String(params.pageSize));
    }
    if (params?.query) {
      searchParams.set('query', params.query);
    }

    const queryString = searchParams.toString();
    return this.get(`/api/v1/admin/workspaces${queryString ? `?${queryString}` : ''}`);
  }

  getAdminWorkspace(workspaceId: string): Promise<GetAdminWorkspaceResponse> {
    return this.get(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}`);
  }

  grantAdminWorkspaceAuthorization(
    workspaceId: string,
    input: GrantAdminWorkspaceAuthorizationRequest
  ): Promise<GrantAdminWorkspaceAuthorizationResponse> {
    return this.post(
      `/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/manual-authorizations`,
      input
    );
  }

  updateAdminWorkspaceStatus(
    workspaceId: string,
    input: UpdateAdminWorkspaceStatusRequest
  ): Promise<UpdateAdminWorkspaceStatusResponse> {
    return this.patch(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/status`, input);
  }

  listAdminActionLogs(params?: {
    page?: number;
    pageSize?: number;
    query?: string;
    action?: string;
    targetType?: string;
  }): Promise<ListAdminActionLogsResponse> {
    const searchParams = new URLSearchParams();
    if (params?.page !== undefined) {
      searchParams.set('page', String(params.page));
    }
    if (params?.pageSize !== undefined) {
      searchParams.set('pageSize', String(params.pageSize));
    }
    if (params?.query) {
      searchParams.set('query', params.query);
    }
    if (params?.action) {
      searchParams.set('action', params.action);
    }
    if (params?.targetType) {
      searchParams.set('targetType', params.targetType);
    }

    const queryString = searchParams.toString();
    return this.get(`/api/v1/admin/action-logs${queryString ? `?${queryString}` : ''}`);
  }

  getBillingOverview(workspaceId: string): Promise<GetBillingOverviewResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/billing/overview`);
  }

  createBillingOrder(
    workspaceId: string,
    input: CreateBillingOrderRequest
  ): Promise<CreateBillingOrderResponse> {
    return this.post(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/billing/orders`, input);
  }

  syncAlipayOrder(orderNo: string): Promise<SyncAlipayOrderResponse> {
    return this.post(`/api/v1/billing/alipay/orders/${encodeURIComponent(orderNo)}/sync`, {});
  }

  checkEntitlement(input: EntitlementCheckRequest): Promise<EntitlementCheckResult> {
    return this.post('/api/v1/entitlements/check', input);
  }

  getPlatformOverview(workspaceId: string): Promise<PlatformOverviewResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/overview`);
  }

  getEnterpriseWorkspaceOverview(workspaceId: string): Promise<GetEnterpriseWorkspaceOverviewResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/organization/overview`);
  }

  listRoleTemplates(workspaceId: string): Promise<ListRoleTemplatesResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles/templates`);
  }

  listRoles(workspaceId: string): Promise<ListRoleInstancesResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles`);
  }

  getRole(workspaceId: string, roleId: string): Promise<GetRoleInstanceResponse> {
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles/${encodeURIComponent(roleId)}`
    );
  }

  installRole(workspaceId: string, input: InstallRoleRequest): Promise<InstallRoleResponse> {
    return this.post(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/roles/install`, input);
  }

  createDepartment(
    workspaceId: string,
    input: CreateDepartmentRequest
  ): Promise<CreateDepartmentResponse> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/organization/departments`,
      input
    );
  }

  listWorkspaceInvitations(workspaceId: string): Promise<ListWorkspaceInvitationsResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`);
  }

  createWorkspaceInvitation(
    workspaceId: string,
    input: CreateWorkspaceInvitationRequest
  ): Promise<CreateWorkspaceInvitationResponse> {
    return this.post(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations`, input);
  }

  cancelWorkspaceInvitation(
    workspaceId: string,
    invitationId: string
  ): Promise<CancelWorkspaceInvitationResponse> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitationId)}/cancel`,
      {}
    );
  }

  getPublicInvitation(token: string): Promise<GetPublicInvitationResponse> {
    return this.get(`/api/v1/invitations/${encodeURIComponent(token)}`);
  }

  acceptWorkspaceInvitation(
    token: string,
    input: AcceptWorkspaceInvitationRequest
  ): Promise<AcceptWorkspaceInvitationResponse> {
    return this.post(`/api/v1/invitations/${encodeURIComponent(token)}/accept`, input);
  }

  listTasks(workspaceId: string): Promise<ListTasksResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks`);
  }

  getTask(workspaceId: string, taskId: string): Promise<GetTaskResponse> {
    return this.get(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}`
    );
  }

  createTask(workspaceId: string, input: CreateTaskRequest): Promise<CreateTaskResponse> {
    return this.post(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks`, input);
  }

  runTask(workspaceId: string, taskId: string): Promise<GetTaskResponse> {
    return this.post(
      `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tasks/${encodeURIComponent(taskId)}/run`,
      {}
    );
  }

  listDesktopDevices(workspaceId: string): Promise<ListDesktopDevicesResponse> {
    return this.get(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/devices`);
  }

  createDesktopBindingCode(
    workspaceId: string,
    input: CreateDesktopBindingCodeRequest
  ): Promise<CreateDesktopBindingCodeResponse> {
    return this.post(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/binding-codes`, input);
  }

  redeemDesktopBindingCode(input: RedeemDesktopBindingCodeRequest): Promise<RedeemDesktopBindingCodeResponse> {
    return this.post('/api/v1/desktop/bindings/redeem', input);
  }

  private async get<TResponse>(path: string): Promise<TResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.mergeHeaders({
        accept: 'application/json'
      }),
      credentials: this.credentials,
      cache: 'no-store'
    });

    const body = (await response.json()) as TResponse | ApiErrorResponse;

    if (!response.ok) {
      throw new QiuApiError(response.status, body as ApiErrorResponse);
    }

    return body as TResponse;
  }

  private async post<TResponse>(path: string, payload: unknown): Promise<TResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.mergeHeaders({
        accept: 'application/json',
        'content-type': 'application/json'
      }),
      body: JSON.stringify(payload),
      credentials: this.credentials,
      cache: 'no-store'
    });

    const body = (await response.json()) as TResponse | ApiErrorResponse;

    if (!response.ok) {
      throw new QiuApiError(response.status, body as ApiErrorResponse);
    }

    return body as TResponse;
  }

  private async patch<TResponse>(path: string, payload: unknown): Promise<TResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: this.mergeHeaders({
        accept: 'application/json',
        'content-type': 'application/json'
      }),
      body: JSON.stringify(payload),
      credentials: this.credentials,
      cache: 'no-store'
    });

    const body = (await response.json()) as TResponse | ApiErrorResponse;

    if (!response.ok) {
      throw new QiuApiError(response.status, body as ApiErrorResponse);
    }

    return body as TResponse;
  }

  private mergeHeaders(headers: HeadersInit): Headers {
    const merged = new Headers(this.defaultHeaders);
    new Headers(headers).forEach((value, key) => {
      merged.set(key, value);
    });
    return merged;
  }
}
