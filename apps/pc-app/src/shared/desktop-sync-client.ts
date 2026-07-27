import type {
  DesktopAuthorizedRoleTemplateSummary,
  DesktopUpdateCheckResult
} from './desktop-api.js';
import type { DesktopRuntimeSnapshot } from './desktop-contract.js';

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
}

interface CheckDesktopUpdateInput {
  currentVersion?: string;
  platform?: 'windows';
  channel?: 'stable';
}

interface CheckDesktopUpdateResponse {
  data: DesktopUpdateCheckResult;
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
  deviceToken: string
): Promise<ListAuthorizedRoleTemplatesResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/role-templates`,
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
  baseUrl: string
): Promise<ListAuthorizedRoleTemplatesResponse> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/v1/desktop/role-templates/free`, {
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

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}
