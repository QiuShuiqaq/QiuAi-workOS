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

async function fetchJson(url, label) {
  const response = await fetch(url, {
    headers: {
      accept: 'application/json'
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

const billingOverview = await fetchJson(
  new URL(`/api/v1/workspaces/${encodeURIComponent(smokeWorkspaceId)}/billing/overview`, apiBaseUrl),
  'Billing overview'
);
if (
  billingOverview.data?.workspaceId !== smokeWorkspaceId ||
  !Array.isArray(billingOverview.data?.paymentProviders)
) {
  fail('Billing overview payload is unexpected.', JSON.stringify(billingOverview, null, 2));
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
console.log(`Billing overview: OK (${smokeWorkspaceId})`);
console.log(`Web health proxy: ${webHealth.status} (${webHealth.service})`);
console.log('Web root HTML: OK');
console.log('Smoke checks passed.');
