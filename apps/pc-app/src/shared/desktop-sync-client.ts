import type {
  DesktopAuthorizedRoleTemplateSummary,
  DesktopDeviceCapacitySummary,
  DesktopUpdateCheckResult,
  DesktopAgreementAcceptanceSummary,
  DesktopIssueReportSubmitRequest,
  DesktopIssueReportSubmitResult
} from './desktop-api.js';

import type {
  DesktopRuntimeSnapshot,
  ModelProfile,
  ListDesktopServerToolActionCatalogResponse
} from './desktop-contract.js';
import type {
  InvokeOfficialModelRequest,
  InvokeOfficialModelResponse,
  GetAiPointOverviewResponse,
  ListOfficialModelRoutesResponse
} from '@qiuai/api-contract/ai-points';
import type { GetReferralOverviewResponse } from '@qiuai/api-contract/referral';

interface RedeemDesktopBindingCodeRequest {
  bindingCode: string;
  runtimeId: string;
  deviceId: string;
  deviceName: string;
  platform: DesktopRuntimeSnapshot['platform'];
  appVersion: string;
}

interface RedeemDesktopBindingCodeResponse {
  data: {
    workspaceId: string;
    deviceToken: string;
    device: {
      id: string;
      workspaceId: string;
      runtimeId: string;
      deviceId: string;
      deviceName: string;
      platform: DesktopRuntimeSnapshot['platform'];
      appVersion: string;
      status: 'ACTIVE' | 'REVOKED';
      boundAt: string;
      lastSeenAt?: string;
      lastSyncedAt?: string;
    };
  };
}

interface SyncDesktopRuntimeRequest {
  data: DesktopRuntimeSnapshot;
}

interface SyncDesktopRuntimeResponse {
  data: {
    accepted: true;
    syncedAt: string;
    nextSyncAt?: string;
  };
}

interface ListAuthorizedRoleTemplatesResponse {
  data: DesktopAuthorizedRoleTemplateSummary[];
  deviceCapacity?: DesktopDeviceCapacitySummary;
  deletedTemplateIds?: string[];
}

interface CheckDesktopUpdateInput {
  currentVersion?: string;
  platform?: 'windows';
  channel?: 'stable';
}

interface CheckDesktopUpdateResponse {
  data: DesktopUpdateCheckResult;
}

interface EnterpriseKnowledgeRuntimeContextResponse {
  data: {
    workspaceId: string;
    enabled: boolean;
    versionId?: string;
    versionNumber?: number;
    title?: string;
    fileName?: string;
    contextText: string;
    updatedAt: string;
  };
}

export interface DesktopAgreementAcceptanceStatusInput {
  agreementKey: string;
  agreementVersion: string;
  contentHash: string;
  runtimeId: string;
  deviceId: string;
}

export interface AcceptDesktopAgreementInput extends DesktopAgreementAcceptanceStatusInput {
  workspaceId?: string;
  deviceName?: string;
  platform?: DesktopRuntimeSnapshot['platform'];
  appVersion?: string;
  consentMethod: string;
  minimumReadSeconds?: number;
  actualReadSeconds?: number;
  deviceToken?: string;
}

interface DesktopAgreementAcceptanceStatusResponse {
  data: {
    accepted: boolean;
    acceptance?: DesktopAgreementAcceptanceSummary;
  };
}

interface AcceptDesktopAgreementResponse {
  data: DesktopAgreementAcceptanceSummary;
}

export interface SubmitDesktopIssueReportInput extends DesktopIssueReportSubmitRequest {
  deviceToken?: string;
}

export async function syncDesktopRuntimeSnapshot(
  baseUrl: string,
  workspaceId: string,
  snapshot: DesktopRuntimeSnapshot,
  deviceToken?: string
): Promise<SyncDesktopRuntimeResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/runtimes/sync`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        ...(deviceToken ? { 'x-qiuai-device-token': deviceToken } : {})
      },
      body: JSON.stringify({
        data: snapshot
      } satisfies SyncDesktopRuntimeRequest)
    }
  );

  const body = (await response.json()) as SyncDesktopRuntimeResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as SyncDesktopRuntimeResponse;
}

export async function redeemDesktopBindingCode(
  baseUrl: string,
  input: RedeemDesktopBindingCodeRequest
): Promise<RedeemDesktopBindingCodeResponse> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/desktop/bindings/redeem`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  const body = (await response.json()) as RedeemDesktopBindingCodeResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as RedeemDesktopBindingCodeResponse;
}

export async function listAuthorizedRoleTemplates(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string,
  installedTemplateIds: string[] = []
): Promise<ListAuthorizedRoleTemplatesResponse> {
  const searchParams = new URLSearchParams();
  if (installedTemplateIds.length > 0) {
    searchParams.set('installedTemplateIds', installedTemplateIds.join(','));
  }
  const queryString = searchParams.toString();
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/role-templates${queryString ? `?${queryString}` : ''}`,
    {
      headers: {
        accept: 'application/json',
        'x-qiuai-device-token': deviceToken
      }
    }
  );

  const body = (await response.json()) as ListAuthorizedRoleTemplatesResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as ListAuthorizedRoleTemplatesResponse;
}

export async function listPublicFreeRoleTemplates(
  baseUrl: string,
  installedTemplateIds: string[] = []
): Promise<ListAuthorizedRoleTemplatesResponse> {
  const searchParams = new URLSearchParams();
  if (installedTemplateIds.length > 0) {
    searchParams.set('installedTemplateIds', installedTemplateIds.join(','));
  }
  const queryString = searchParams.toString();
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/desktop/role-templates/free${queryString ? `?${queryString}` : ''}`, {
    headers: {
      accept: 'application/json'
    }
  });

  const body = (await response.json()) as ListAuthorizedRoleTemplatesResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as ListAuthorizedRoleTemplatesResponse;
}

export async function fetchPublicDesktopToolActionCatalog(
  baseUrl: string
): Promise<ListDesktopServerToolActionCatalogResponse> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/desktop/tools`, {
    headers: {
      accept: 'application/json'
    }
  });

  const body = (await response.json()) as ListDesktopServerToolActionCatalogResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as ListDesktopServerToolActionCatalogResponse;
}

export async function fetchWorkspaceDesktopToolActionCatalog(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string
): Promise<ListDesktopServerToolActionCatalogResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/tools`,
    {
      headers: {
        accept: 'application/json',
        'x-qiuai-device-token': deviceToken
      }
    }
  );

  const body = (await response.json()) as ListDesktopServerToolActionCatalogResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as ListDesktopServerToolActionCatalogResponse;
}

export async function fetchAiPointOverview(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string
): Promise<GetAiPointOverviewResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/ai-points/overview`,
    {
      headers: {
        accept: 'application/json',
        'x-qiuai-device-token': deviceToken
      }
    }
  );

  const body = (await response.json()) as GetAiPointOverviewResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as GetAiPointOverviewResponse;
}

export async function fetchReferralOverview(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string
): Promise<GetReferralOverviewResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/referrals/me`,
    {
      headers: {
        accept: 'application/json',
        'x-qiuai-device-token': deviceToken
      }
    }
  );

  const body = (await response.json()) as GetReferralOverviewResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as GetReferralOverviewResponse;
}

export async function fetchOfficialModelRoutes(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string
): Promise<ListOfficialModelRoutesResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/ai-points/routes`,
    {
      headers: {
        accept: 'application/json',
        'x-qiuai-device-token': deviceToken
      }
    }
  );

  const body = (await response.json()) as ListOfficialModelRoutesResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as ListOfficialModelRoutesResponse;
}

export async function invokeOfficialModelRoute(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string,
  profile: ModelProfile,
  request: Omit<InvokeOfficialModelRequest, 'officialRouteKey'>
): Promise<InvokeOfficialModelResponse> {
  const officialRouteKey = profile.officialRouteKey?.trim();
  if (!officialRouteKey) {
    throw new Error('Official route key is missing.');
  }

  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/official-model/invoke`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'x-qiuai-device-token': deviceToken
      },
      body: JSON.stringify({
        ...request,
        officialRouteKey
      } satisfies InvokeOfficialModelRequest)
    }
  );

  const body = (await response.json()) as InvokeOfficialModelResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as InvokeOfficialModelResponse;
}

export async function fetchEnterpriseKnowledgeRuntimeContext(
  baseUrl: string,
  workspaceId: string,
  deviceToken: string
): Promise<EnterpriseKnowledgeRuntimeContextResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/knowledge-base/runtime-context`,
    {
      headers: {
        accept: 'application/json',
        'x-qiuai-device-token': deviceToken
      }
    }
  );

  const body = (await response.json()) as EnterpriseKnowledgeRuntimeContextResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as EnterpriseKnowledgeRuntimeContextResponse;
}

export async function checkDesktopUpdate(
  baseUrl: string,
  input: CheckDesktopUpdateInput
): Promise<CheckDesktopUpdateResponse> {
  const searchParams = new URLSearchParams();
  if (input.currentVersion) {
    searchParams.set('currentVersion', input.currentVersion);
  }
  if (input.platform) {
    searchParams.set('platform', input.platform);
  }
  if (input.channel) {
    searchParams.set('channel', input.channel);
  }

  const queryString = searchParams.toString();
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/desktop/releases/latest${queryString ? `?${queryString}` : ''}`,
    {
      headers: {
        accept: 'application/json'
      }
    }
  );

  const body = (await response.json()) as CheckDesktopUpdateResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as CheckDesktopUpdateResponse;
}

export async function fetchDesktopAgreementAcceptanceStatus(
  baseUrl: string,
  input: DesktopAgreementAcceptanceStatusInput
): Promise<DesktopAgreementAcceptanceStatusResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('agreementKey', input.agreementKey);
  searchParams.set('agreementVersion', input.agreementVersion);
  searchParams.set('contentHash', input.contentHash);
  searchParams.set('runtimeId', input.runtimeId);
  searchParams.set('deviceId', input.deviceId);

  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/desktop/agreement-acceptances/status?${searchParams.toString()}`,
    {
      headers: {
        accept: 'application/json'
      }
    }
  );

  const body = (await response.json()) as DesktopAgreementAcceptanceStatusResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as DesktopAgreementAcceptanceStatusResponse;
}

export async function acceptDesktopAgreement(
  baseUrl: string,
  input: AcceptDesktopAgreementInput
): Promise<AcceptDesktopAgreementResponse> {
  const { deviceToken, ...payload } = input;
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/desktop/agreement-acceptances`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(deviceToken ? { 'x-qiuai-device-token': deviceToken } : {})
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as AcceptDesktopAgreementResponse | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as AcceptDesktopAgreementResponse;
}

export async function submitDesktopIssueReport(
  baseUrl: string,
  input: SubmitDesktopIssueReportInput
): Promise<DesktopIssueReportSubmitResult> {
  const { deviceToken, ...payload } = input;
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/desktop/issue-reports`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(deviceToken ? { 'x-qiuai-device-token': deviceToken } : {})
    },
    body: JSON.stringify(payload)
  });

  const body = (await response.json()) as DesktopIssueReportSubmitResult | { error?: { message?: string } };
  if (!response.ok) {
    const errorBody = body as { error?: { message?: string } };
    const message = errorBody.error?.message ?? `HTTP ${response.status}`;
    throw new Error(message);
  }

  return body as DesktopIssueReportSubmitResult;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}
