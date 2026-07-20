import type { DesktopRuntimeSnapshot } from './desktop-contract.js';

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

export async function syncDesktopRuntimeSnapshot(
  baseUrl: string,
  workspaceId: string,
  snapshot: DesktopRuntimeSnapshot
): Promise<SyncDesktopRuntimeResponse> {
  const response = await fetch(
    `${normalizeBaseUrl(baseUrl)}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/runtimes/sync`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json'
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

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}
