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

async function fetchJson(url, label, headers = {}) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json',
      ...headers
    }
  });

  if (!response.ok) {
    fail(`${label} returned a non-OK response.`, `${url} -> ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    fail(`${label} did not return JSON.`, `${url} -> content-type: ${contentType || '(missing)'}`);
  }

  return response.json();
}

async function postJson(url, label, payload, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(payload)
  });

  const contentType = response.headers.get('content-type') ?? '';
  const body = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    fail(`${label} returned a non-OK response.`, `${url} -> ${response.status} ${response.statusText}`);
  }

  return {
    body,
    setCookie: response.headers.get('set-cookie') ?? undefined
  };
}

async function fetchHtml(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: 'text/html'
    }
  });

  if (!response.ok) {
    fail(`${label} returned a non-OK response.`, `${url} -> ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    fail(`${label} did not return HTML.`, `${url} -> content-type: ${contentType || '(missing)'}`);
  }

  return response.text();
}

const apiBaseUrl = parseBaseUrl(
  process.env.WORKOS_API_URL ?? process.env.SERVER_INTERNAL_BASE_URL ?? 'http://127.0.0.1:4000',
  'http://127.0.0.1:4000',
  'WORKOS_API_URL'
);

const webBaseUrl = parseBaseUrl(
  process.env.WORKOS_WEB_URL ?? 'http://127.0.0.1:3000',
  'http://127.0.0.1:3000',
  'WORKOS_WEB_URL'
);

const apiHealth = await fetchJson(new URL('/api/v1/health', apiBaseUrl), 'API health');
if (apiHealth.status !== 'ok' || apiHealth.service !== 'qiuai-workos-server') {
  fail('API health payload is unexpected.', JSON.stringify(apiHealth, null, 2));
}

const kernelStatus = await fetchJson(new URL('/api/v1/kernel/status', apiBaseUrl), 'Kernel status');
const smokeWorkspaceId =
  process.env.WORKOS_SMOKE_WORKSPACE_ID ??
  (kernelStatus.persistenceMode === 'database'
    ? '20000000-0000-4000-8000-000000000002'
    : 'enterprise');

const smokeEmail =
  process.env.WORKOS_SMOKE_EMAIL ??
  process.env.WORKOS_BOOTSTRAP_ADMIN_EMAIL ??
  process.env.WORKOS_MOCK_ADMIN_EMAIL ??
  'admin@qiuai.local';
const smokePassword =
  process.env.WORKOS_SMOKE_PASSWORD ??
  process.env.WORKOS_BOOTSTRAP_ADMIN_PASSWORD ??
  process.env.WORKOS_MOCK_ADMIN_PASSWORD ??
  (process.env.NODE_ENV === 'production' ? undefined : 'qiuai-demo');

if (!smokePassword) {
  fail(
    'Smoke checks require a login password for protected workspace APIs.',
    'Set WORKOS_SMOKE_PASSWORD or WORKOS_BOOTSTRAP_ADMIN_PASSWORD before running `npm run check:smoke`.'
  );
}

const login = await postJson(new URL('/api/v1/auth/login', apiBaseUrl), 'Smoke login', {
  email: smokeEmail,
  password: smokePassword
});
if (!login.body?.authenticated || !login.setCookie) {
  fail('Smoke login payload is unexpected.', JSON.stringify(login.body, null, 2));
}

const sessionCookie = login.setCookie.split(';')[0];
const authHeaders = {
  cookie: sessionCookie
};

const billingOverview = await fetchJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(smokeWorkspaceId)}/billing/overview`, apiBaseUrl),
  'Billing overview',
  authHeaders
);
if (
  billingOverview.data?.workspaceId !== smokeWorkspaceId ||
  !Array.isArray(billingOverview.data?.paymentProviders)
) {
  fail('Billing overview payload is unexpected.', JSON.stringify(billingOverview, null, 2));
}

const platformOverview = await fetchJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(smokeWorkspaceId)}/overview`, apiBaseUrl),
  'Platform overview',
  authHeaders
);
if (
  platformOverview.workspace?.id !== smokeWorkspaceId ||
  !Array.isArray(platformOverview.metrics) ||
  !Array.isArray(platformOverview.roles) ||
  !Array.isArray(platformOverview.tasks)
) {
  fail('Platform overview payload is unexpected.', JSON.stringify(platformOverview, null, 2));
}

const roleTemplates = await fetchJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(smokeWorkspaceId)}/roles/templates`, apiBaseUrl),
  'Role templates',
  authHeaders
);
if (!Array.isArray(roleTemplates.data) || roleTemplates.data.length === 0) {
  fail('Role templates payload is unexpected.', JSON.stringify(roleTemplates, null, 2));
}

const roles = await fetchJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(smokeWorkspaceId)}/roles`, apiBaseUrl),
  'Role instances',
  authHeaders
);
if (!Array.isArray(roles.data)) {
  fail('Role instances payload is unexpected.', JSON.stringify(roles, null, 2));
}

const tasks = await fetchJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(smokeWorkspaceId)}/tasks`, apiBaseUrl),
  'Tasks',
  authHeaders
);
if (!Array.isArray(tasks.data)) {
  fail('Tasks payload is unexpected.', JSON.stringify(tasks, null, 2));
}

const webHealth = await fetchJson(new URL('/api/v1/health', webBaseUrl), 'Web proxy health');
if (webHealth.status !== apiHealth.status || webHealth.service !== apiHealth.service) {
  fail(
    'Web proxy health does not match the API health response.',
    JSON.stringify({ apiHealth, webHealth }, null, 2)
  );
}

const webRoot = await fetchHtml(new URL('/', webBaseUrl), 'Web root page');
if (!webRoot.includes('QiuAI WorkOS')) {
  fail('Web root HTML does not include the product title.', 'Expected to find: QiuAI WorkOS');
}

console.log(`API health: ${apiHealth.status} (${apiHealth.service})`);
console.log(`Smoke login: OK (${smokeEmail})`);
console.log(`Billing overview: OK (${smokeWorkspaceId})`);
console.log(`Platform overview: OK (${smokeWorkspaceId})`);
console.log(`Role templates: OK (${roleTemplates.data.length})`);
console.log(`Role instances: OK (${roles.data.length})`);
console.log(`Tasks: OK (${tasks.data.length})`);
console.log(`Web health proxy: ${webHealth.status} (${webHealth.service})`);
console.log('Web root HTML: OK');
console.log('Smoke checks passed.');
