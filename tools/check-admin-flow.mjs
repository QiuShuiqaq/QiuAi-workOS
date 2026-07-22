import process from 'node:process';

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

function parseBaseUrl(value, fallback, label) {
  try {
    return new URL(value ?? fallback);
  } catch {
    fail(`${label} is not a valid URL.`, `Received: ${value ?? fallback}`);
  }
}

async function requestJson(url, label, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      accept: 'application/json',
      ...(options.payload ? { 'content-type': 'application/json' } : {}),
      ...options.headers
    },
    body: options.payload ? JSON.stringify(options.payload) : undefined
  });
  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    fail(`${label} returned a non-OK response.`, `${url} -> ${response.status} ${response.statusText}\n${JSON.stringify(body, null, 2)}`);
  }

  return {
    body,
    setCookie: response.headers.get('set-cookie') ?? undefined
  };
}

function requireData(value, label) {
  if (!value?.data) {
    fail(`${label} payload is missing data.`, JSON.stringify(value, null, 2));
  }

  return value.data;
}

function extractInvitationToken(inviteUrl) {
  try {
    const url = new URL(inviteUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    const invitationsIndex = parts.indexOf('invitations');
    const token = invitationsIndex >= 0 ? parts[invitationsIndex + 1] : undefined;
    if (token) {
      return token;
    }
  } catch {
    // Fall through to fail below.
  }

  fail('Invitation URL does not contain an invitation token.', inviteUrl);
}

const apiBaseUrl = parseBaseUrl(
  process.env.WORKOS_API_URL ?? process.env.SERVER_INTERNAL_BASE_URL ?? 'http://127.0.0.1:4100',
  'http://127.0.0.1:4100',
  'WORKOS_API_URL'
);

const adminEmail =
  process.env.WORKOS_ADMIN_FLOW_EMAIL ??
  process.env.WORKOS_BOOTSTRAP_ADMIN_EMAIL ??
  process.env.WORKOS_SMOKE_EMAIL ??
  'admin@qiuai.local';
const adminPassword =
  process.env.WORKOS_ADMIN_FLOW_PASSWORD ??
  process.env.WORKOS_BOOTSTRAP_ADMIN_PASSWORD ??
  process.env.WORKOS_SMOKE_PASSWORD;

if (!adminPassword) {
  fail(
    'Admin flow checks require an admin password.',
    'Set WORKOS_ADMIN_FLOW_PASSWORD or WORKOS_BOOTSTRAP_ADMIN_PASSWORD before running `npm run check:admin-flow`.'
  );
}

const runId = `${Date.now()}`;
const nowIso = new Date().toISOString();
const ownerEmail = `workos-flow-owner-${runId}@qiuai.local`;
const memberEmail = `workos-flow-member-${runId}@qiuai.local`;
const workspaceName = `QiuAI Flow Test ${runId}`;
const runtimeId = `flow-runtime-${runId}`;
const deviceId = `flow-device-${runId}`;

const login = await requestJson(new URL('/api/v1/auth/login', apiBaseUrl), 'Admin login', {
  method: 'POST',
  payload: {
    email: adminEmail,
    password: adminPassword
  }
});
if (!login.body?.authenticated || !login.setCookie) {
  fail('Admin login payload is unexpected.', JSON.stringify(login.body, null, 2));
}

const cookie = login.setCookie.split(';')[0];
const authHeaders = {
  cookie
};

const plansResponse = await requestJson(new URL('/api/v1/admin/plans', apiBaseUrl), 'List admin plans', {
  headers: authHeaders
});
const plan = plansResponse.body.data?.find(
  (item) =>
    item.status === 'ACTIVE' &&
    item.billingCycle !== 'FREE' &&
    item.billingCycle !== 'CUSTOM' &&
    typeof item.priceCents === 'number'
);
if (!plan) {
  fail('No active paid enterprise plan is available for admin flow checks.', JSON.stringify(plansResponse.body, null, 2));
}

const createdWorkspaceResponse = await requestJson(new URL('/api/v1/admin/workspaces', apiBaseUrl), 'Create workspace', {
  method: 'POST',
  headers: authHeaders,
  payload: {
    workspaceName,
    tenantName: `${workspaceName} Tenant`,
    ownerEmail,
    ownerPassword: `QiuAI-${runId}!`,
    planCode: plan.code,
    durationDays: 7,
    industry: 'Flow verification',
    size: '1-10',
    note: 'Created by check:admin-flow.'
  }
});
const workspaceDetail = requireData(createdWorkspaceResponse.body, 'Create workspace');
const workspaceId = workspaceDetail.workspace?.id;
if (!workspaceId || workspaceDetail.workspace.status !== 'active') {
  fail('Created workspace payload is unexpected.', JSON.stringify(createdWorkspaceResponse.body, null, 2));
}

const invitationResponse = await requestJson(
  new URL(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/invitations`, apiBaseUrl),
  'Create workspace invitation',
  {
    method: 'POST',
    headers: authHeaders,
    payload: {
      email: memberEmail,
      systemRole: 'member',
      expiresInDays: 7
    }
  }
);
const invitation = requireData(invitationResponse.body, 'Create workspace invitation');
if (invitation.email !== memberEmail || invitation.status !== 'pending' || !invitationResponse.body.inviteUrl) {
  fail('Invitation payload is unexpected.', JSON.stringify(invitationResponse.body, null, 2));
}

const invitationToken = extractInvitationToken(invitationResponse.body.inviteUrl);
const publicInvitationResponse = await requestJson(
  new URL(`/api/v1/invitations/${encodeURIComponent(invitationToken)}`, apiBaseUrl),
  'Public invitation lookup'
);
if (publicInvitationResponse.body.data?.email !== memberEmail) {
  fail('Public invitation lookup payload is unexpected.', JSON.stringify(publicInvitationResponse.body, null, 2));
}

const bindingCodeResponse = await requestJson(
  new URL(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/desktop-binding-codes`, apiBaseUrl),
  'Create desktop binding code',
  {
    method: 'POST',
    headers: authHeaders,
    payload: {
      expiresInMinutes: 10
    }
  }
);
const bindingCode = requireData(bindingCodeResponse.body, 'Create desktop binding code');
if (!bindingCode.bindingCode || bindingCode.status !== 'PENDING') {
  fail('Desktop binding code payload is unexpected.', JSON.stringify(bindingCodeResponse.body, null, 2));
}

const redeemedResponse = await requestJson(new URL('/api/v1/desktop/bindings/redeem', apiBaseUrl), 'Redeem desktop binding code', {
  method: 'POST',
  payload: {
    bindingCode: bindingCode.bindingCode,
    runtimeId,
    deviceId,
    deviceName: 'Flow Test Windows PC',
    platform: 'windows',
    appVersion: '1.0.0'
  }
});
const redeemed = requireData(redeemedResponse.body, 'Redeem desktop binding code');
if (redeemed.workspaceId !== workspaceId || !redeemed.deviceToken || redeemed.device?.status !== 'ACTIVE') {
  fail('Desktop binding redeem payload is unexpected.', JSON.stringify(redeemedResponse.body, null, 2));
}

const syncResponse = await requestJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/desktop/runtimes/sync`, apiBaseUrl),
  'Sync desktop runtime',
  {
    method: 'POST',
    headers: {
      authorization: `Bearer ${redeemed.deviceToken}`
    },
    payload: {
      data: {
        runtimeId,
        deviceId,
        deviceName: 'Flow Test Windows PC',
        platform: 'windows',
        workspaceId,
        appVersion: '1.0.0',
        lastSyncedAt: nowIso,
        rolePackages: [
          {
            roleCode: 'sales-assistant',
            version: '1.0.0',
            state: 'installed',
            installedAt: nowIso,
            taskCount: 0,
            skills: [
              {
                code: 'customer-research',
                name: 'Customer Research',
                summary: 'Flow verification skill.'
              }
            ]
          }
        ],
        tools: [
          {
            toolId: 'web-search',
            enabled: true,
            lastUsedAt: nowIso
          }
        ],
        tasks: []
      }
    }
  }
);
if (syncResponse.body.data?.accepted !== true) {
  fail('Desktop runtime sync payload is unexpected.', JSON.stringify(syncResponse.body, null, 2));
}

const detailAfterSyncResponse = await requestJson(
  new URL(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}`, apiBaseUrl),
  'Get admin workspace detail after sync',
  {
    headers: authHeaders
  }
);
const detailAfterSync = requireData(detailAfterSyncResponse.body, 'Get admin workspace detail after sync');
const activeDevice = detailAfterSync.desktopDevices?.find((item) => item.runtimeId === runtimeId);
if (!activeDevice || activeDevice.status !== 'ACTIVE' || !activeDevice.lastSyncedAt) {
  fail('Admin workspace detail does not include the synced desktop device.', JSON.stringify(detailAfterSyncResponse.body, null, 2));
}

const revokeResponse = await requestJson(
  new URL(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/desktop-devices/${encodeURIComponent(activeDevice.id)}/revoke`, apiBaseUrl),
  'Revoke desktop device',
  {
    method: 'POST',
    headers: authHeaders,
    payload: {}
  }
);
if (revokeResponse.body.data?.status !== 'REVOKED') {
  fail('Revoke desktop device payload is unexpected.', JSON.stringify(revokeResponse.body, null, 2));
}

const cancelInvitationResponse = await requestJson(
  new URL(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/invitations/${encodeURIComponent(invitation.id)}/cancel`, apiBaseUrl),
  'Cancel workspace invitation',
  {
    method: 'POST',
    headers: authHeaders,
    payload: {}
  }
);
if (cancelInvitationResponse.body.data?.status !== 'cancelled') {
  fail('Cancel invitation payload is unexpected.', JSON.stringify(cancelInvitationResponse.body, null, 2));
}

await requestJson(new URL(`/api/v1/admin/workspaces/${encodeURIComponent(workspaceId)}/status`, apiBaseUrl), 'Archive flow workspace', {
  method: 'PATCH',
  headers: authHeaders,
  payload: {
    status: 'ARCHIVED',
    reason: 'Admin flow verification completed',
    note: 'Archived automatically by check:admin-flow.'
  }
});

const logsUrl = new URL('/api/v1/admin/action-logs', apiBaseUrl);
logsUrl.searchParams.set('page', '1');
logsUrl.searchParams.set('pageSize', '20');
logsUrl.searchParams.set('query', workspaceId);
const logsResponse = await requestJson(logsUrl, 'List admin action logs', {
  headers: authHeaders
});
const deviceLogsUrl = new URL('/api/v1/admin/action-logs', apiBaseUrl);
deviceLogsUrl.searchParams.set('page', '1');
deviceLogsUrl.searchParams.set('pageSize', '20');
deviceLogsUrl.searchParams.set('query', activeDevice.id);
deviceLogsUrl.searchParams.set('targetType', 'desktop_device');
const deviceLogsResponse = await requestJson(deviceLogsUrl, 'List admin desktop device action logs', {
  headers: authHeaders
});
const actions = new Set([
  ...(logsResponse.body.data ?? []).map((item) => item.action),
  ...(deviceLogsResponse.body.data ?? []).map((item) => item.action)
]);
for (const expectedAction of [
  'CREATE_WORKSPACE',
  'CREATE_WORKSPACE_INVITATION',
  'CREATE_DESKTOP_BINDING_CODE',
  'REVOKE_DESKTOP_DEVICE',
  'CANCEL_WORKSPACE_INVITATION',
  'UPDATE_WORKSPACE_STATUS'
]) {
  if (!actions.has(expectedAction)) {
    fail(`Admin action log is missing ${expectedAction}.`, JSON.stringify(logsResponse.body, null, 2));
  }
}

console.log(`Admin login: OK (${adminEmail})`);
console.log(`Plan selected: ${plan.code}`);
console.log(`Workspace created: OK (${workspaceId})`);
console.log(`Invitation created and cancelled: OK (${memberEmail})`);
console.log(`Desktop binding, sync, revoke: OK (${activeDevice.id})`);
console.log('Audit logs: OK');
console.log('Admin flow checks passed.');
