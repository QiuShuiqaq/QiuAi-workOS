import type {
  AuthSessionResponse,
  LoginRequest,
  LoginResponse,
  LogoutResponse,
  ApiErrorResponse,
  CreateTaskRequest,
  CreateTaskResponse,
  CreateDepartmentRequest,
  CreateDepartmentResponse,
  GetRoleInstanceResponse,
  GetTaskResponse,
  GetEnterpriseWorkspaceOverviewResponse,
  CurrentAccountResponse,
  KernelStatusResponse,
  ListRoleInstancesResponse,
  ListRoleTemplatesResponse,
  ListPlansResponse,
  ListTasksResponse,
  InstallRoleRequest,
  InstallRoleResponse,
  PlatformOverviewResponse
} from '@qiuai/api-contract';

export interface QiuApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  defaultHeaders?: HeadersInit;
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

  constructor(options: QiuApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.defaultHeaders = options.defaultHeaders;
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

  private async get<TResponse>(path: string): Promise<TResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.mergeHeaders({
        accept: 'application/json'
      }),
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
