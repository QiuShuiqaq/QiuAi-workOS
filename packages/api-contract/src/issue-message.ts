import type { PaginationMeta } from './pagination';

export type DesktopIssueCategory = 'BUG' | 'USAGE' | 'FEATURE_REQUEST' | 'BAD_OUTPUT' | 'OTHER';
export type DesktopIssueSeverity = 'NORMAL' | 'IMPACTING' | 'BLOCKING';
export type DesktopIssueStatus = 'NEW' | 'VIEWED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'CLOSED';

export interface DesktopIssueTaskContext {
  taskId?: string;
  taskTitle?: string;
  taskState?: string;
  roleCode?: string;
  roleName?: string;
  updatedAt?: string;
}

export interface DesktopIssueDiagnostics {
  appVersion?: string;
  platform?: string;
  arch?: string;
  deviceName?: string;
  runtimeId?: string;
  deviceId?: string;
  workspaceId?: string;
  serverBaseUrl?: string;
  connectionState?: string;
  task?: DesktopIssueTaskContext;
  logs?: Array<{
    level: string;
    eventType: string;
    message: string;
    createdAt?: string;
  }>;
  models?: Array<{
    providerId?: string;
    providerName?: string;
    modelName?: string;
    purpose?: string;
    enabled?: boolean;
  }>;
  tools?: Array<{
    toolId: string;
    enabled?: boolean;
    actionId?: string;
    status?: string;
    message?: string;
  }>;
  files?: Array<{
    name: string;
    type?: string;
    size?: number;
  }>;
  notes?: string[];
}

export interface CreateDesktopIssueReportRequest {
  category: DesktopIssueCategory;
  severity: DesktopIssueSeverity;
  title: string;
  description: string;
  contact?: string;
  workspaceId?: string;
  runtimeId?: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  diagnostics?: DesktopIssueDiagnostics;
}

export interface DesktopIssueMessageSummary {
  id: string;
  issueNo: string;
  category: DesktopIssueCategory;
  severity: DesktopIssueSeverity;
  status: DesktopIssueStatus;
  title: string;
  description: string;
  contact?: string;
  workspaceId?: string;
  workspaceName?: string;
  runtimeId?: string;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
  platform?: string;
  diagnostics?: DesktopIssueDiagnostics;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDesktopIssueReportResponse {
  data: DesktopIssueMessageSummary;
}

export interface ListAdminIssueMessagesQuery {
  page?: number;
  pageSize?: number;
  query?: string;
  status?: DesktopIssueStatus;
  category?: DesktopIssueCategory;
  severity?: DesktopIssueSeverity;
  workspaceId?: string;
}

export interface ListAdminIssueMessagesResponse {
  data: DesktopIssueMessageSummary[];
  pagination: PaginationMeta;
}

export interface GetAdminIssueMessageResponse {
  data: DesktopIssueMessageSummary;
}

export interface UpdateAdminIssueMessageRequest {
  status?: DesktopIssueStatus;
  adminNote?: string | null;
}

export interface UpdateAdminIssueMessageResponse {
  data: DesktopIssueMessageSummary;
}

export interface DeleteAdminIssueMessageResponse {
  data: {
    id: string;
    deleted: true;
  };
}
