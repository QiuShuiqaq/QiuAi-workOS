import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const envFilePath = path.resolve(root, process.env.WORKOS_ENV_FILE ?? '.env');
const env = {
  ...(existsSync(envFilePath) ? parseEnvFile(envFilePath) : {}),
  ...process.env
};
const deployTarget =
  env.WORKOS_DEPLOY_TARGET || (env.NODE_ENV === 'production' ? 'alicloud-ecs' : 'local');
const isProductionEcs = deployTarget === 'alicloud-ecs';

function parseEnvFile(filePath) {
  const result = {};
  const content = readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    result[key] = unquoteEnvValue(rawValue);
  }

  return result;
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function getNpmVersion() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return run(process.execPath, [process.env.npm_execpath, '-v']);
  }

  return run('npm', ['-v']);
}

function fail(message, details) {
  console.error(message);
  if (details) {
    console.error(details.trim());
  }
  process.exit(1);
}

function requireValue(key) {
  const value = env[key]?.trim();
  if (!value || isPlaceholder(value)) {
    fail(`${key} is required for ${deployTarget} deployment.`);
  }

  return value;
}

function isPlaceholder(value) {
  return /^(CHANGE_THIS|REPLACE_|OPTIONAL_|YOUR_|你的)/i.test(value);
}

function requireUrl(key, options = {}) {
  const value = requireValue(key);

  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${key} must be a valid URL.`);
  }

  if (options.protocol && url.protocol !== `${options.protocol}:`) {
    fail(`${key} must use ${options.protocol.toUpperCase()}.`);
  }

  return url;
}

function requirePath(key, expected) {
  const value = requireValue(key);
  if (!value.startsWith('/')) {
    fail(`${key} must be an absolute path.`);
  }

  if (expected && value !== expected) {
    fail(`${key} must be ${expected}.`, `Received: ${value}`);
  }

  return value;
}

function requireFile(relativePath, label) {
  const resolved = path.resolve(root, relativePath);
  if (!existsSync(resolved)) {
    fail(`${label} is missing.`, `Expected file: ${relativePath}`);
  }
}

function checkCommonRuntime() {
  console.log(`deploy-target: ${deployTarget}`);
  console.log(`env-file: ${existsSync(envFilePath) ? path.relative(root, envFilePath) : 'not found'}`);
  console.log(`node: ${process.version}`);
  console.log(`npm: ${getNpmVersion()}`);
}

function checkDockerDeployment() {
  const composeFile = path.resolve(root, 'infra/docker/compose.deploy.yml');

  try {
    console.log(`docker-cli: ${run('docker', ['--version'])}`);
  } catch {
    fail('Docker CLI is not available in PATH.');
  }

  try {
    run('docker', ['compose', '-f', composeFile, 'config']);
    console.log('compose-config: OK');
  } catch {
    fail('Docker Compose configuration is invalid.');
  }

  try {
    console.log(`docker-daemon: ${run('docker', ['info', '--format', '{{.Server.Version}}'])}`);
  } catch {
    fail(
      'Docker daemon is not running.',
      'Start Docker Desktop or the Docker service, then rerun `npm run check:deploy`.'
    );
  }
}

function checkProductionEnvironment() {
  if (env.NODE_ENV !== 'production') {
    fail('NODE_ENV must be production for alicloud-ecs deployment.');
  }

  const publicBaseUrl = requireUrl('WORKOS_PUBLIC_BASE_URL', { protocol: 'https' });
  const persistenceMode = requireValue('WORKOS_PERSISTENCE_MODE');
  if (persistenceMode !== 'database') {
    fail('WORKOS_PERSISTENCE_MODE must be database for production deployment.');
  }

  const serverPort = requireValue('SERVER_PORT');
  if (serverPort !== '4100') {
    fail('SERVER_PORT must be 4100 for the qiuaihub.com WorkOS deployment.');
  }

  const serverHost = requireValue('SERVER_HOST');
  if (serverHost !== '127.0.0.1') {
    fail('SERVER_HOST must be 127.0.0.1 so the API is only exposed through Nginx.');
  }

  requireUrl('SERVER_API_BASE_URL');
  requireUrl('SERVER_INTERNAL_BASE_URL');
  requireValue('DATABASE_URL');
  requireValue('WORKOS_BOOTSTRAP_ADMIN_PASSWORD');

  console.log(`public-base-url: ${publicBaseUrl.origin}`);
  console.log('production-env: OK');
}

function checkPaymentEnvironment() {
  const requirePaymentReady = env.WORKOS_REQUIRE_PAYMENT_READY !== 'false';
  if (!requirePaymentReady) {
    console.log('payment-env: skipped (WORKOS_REQUIRE_PAYMENT_READY=false)');
    return;
  }

  requireValue('PAYMENT_ALIPAY_APP_ID');
  requireValue('PAYMENT_ALIPAY_PRIVATE_KEY');
  requireValue('PAYMENT_ALIPAY_PUBLIC_KEY');
  requireUrl('PAYMENT_ALIPAY_GATEWAY_URL', { protocol: 'https' });
  const notifyPath = requirePath('PAYMENT_ALIPAY_NOTIFY_PATH', '/api/v1/billing/alipay/notify');
  const returnPath = requirePath('PAYMENT_ALIPAY_RETURN_PATH', '/billing/alipay/return');
  const keyType = requireValue('PAYMENT_ALIPAY_KEY_TYPE');
  if (keyType !== 'PKCS8' && keyType !== 'PKCS1') {
    fail('PAYMENT_ALIPAY_KEY_TYPE must be PKCS8 or PKCS1.');
  }

  const sellerId = env.PAYMENT_ALIPAY_SELLER_ID?.trim();
  if (sellerId && isPlaceholder(sellerId)) {
    fail('PAYMENT_ALIPAY_SELLER_ID is still a placeholder.');
  }

  const publicBaseUrl = requireUrl('WORKOS_PUBLIC_BASE_URL', { protocol: 'https' });
  console.log(`alipay-notify-url: ${new URL(notifyPath, publicBaseUrl).toString()}`);
  console.log(`alipay-return-url: ${new URL(returnPath, publicBaseUrl).toString()}`);
  console.log('payment-env: OK');
}

function checkBuildArtifacts() {
  requireFile('package-lock.json', 'package lock');
  requireFile('apps/server/dist/main.js', 'server build artifact');
  requireFile('apps/web-console/.next/BUILD_ID', 'web build artifact');
  requireFile('apps/server/prisma/schema.prisma', 'Prisma schema');
  console.log('build-artifacts: OK');
}

async function checkDatabase() {
  if (!isProductionEcs || env.WORKOS_CHECK_DATABASE === 'false') {
    return;
  }

  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    const expectedPaidPlans = new Map([
      ['ENTERPRISE_BASIC_MONTHLY', 29900],
      ['ENTERPRISE_BASIC_ANNUAL', 299000],
      ['ENTERPRISE_STANDARD_MONTHLY', 59900],
      ['ENTERPRISE_STANDARD_ANNUAL', 599000],
      ['ENTERPRISE_PRO_MONTHLY', 98000],
      ['ENTERPRISE_PRO_ANNUAL', 980000]
    ]);

    const [planCount, workspaceCount, enterprisePlans] = await Promise.all([
      prisma.plan.count(),
      prisma.workspace.count(),
      prisma.plan.findMany({
        where: {
          code: {
            in: [...expectedPaidPlans.keys()]
          }
        },
        select: {
          code: true,
          priceCents: true,
          currency: true,
          status: true
        }
      })
    ]);

    if (enterprisePlans.length !== expectedPaidPlans.size) {
      fail(
        'Enterprise paid plans are not fully seeded in the database.',
        `Expected ${[...expectedPaidPlans.keys()].join(', ')}, received ${enterprisePlans.length}.`
      );
    }

    const mispricedPlans = enterprisePlans.filter(
      (plan) => plan.priceCents !== expectedPaidPlans.get(plan.code)
    );
    if (mispricedPlans.length > 0) {
      fail(
        'Enterprise paid plan prices do not match the production catalog.',
        mispricedPlans
          .map((plan) => `${plan.code}: ${plan.priceCents ?? 'null'} expected ${expectedPaidPlans.get(plan.code)}`)
          .join('\n')
      );
    }

    const nonCnyPlans = enterprisePlans.filter((plan) => plan.currency !== 'CNY');
    if (nonCnyPlans.length > 0) {
      fail(
        'Enterprise paid plan currency must be CNY.',
        nonCnyPlans.map((plan) => `${plan.code}: ${plan.currency ?? 'null'}`).join('\n')
      );
    }

    const inactivePlans = enterprisePlans.filter((plan) => plan.status !== 'ACTIVE');
    if (inactivePlans.length > 0) {
      fail(
        'Enterprise paid plans must be ACTIVE.',
        inactivePlans.map((plan) => `${plan.code}: ${plan.status}`).join('\n')
      );
    }

    console.log(`database: OK (plans=${planCount}, workspaces=${workspaceCount})`);
  } catch (error) {
    fail(
      'Database readiness check failed.',
      error instanceof Error ? error.message : String(error)
    );
  } finally {
    await prisma.$disconnect();
  }
}

checkCommonRuntime();

if (deployTarget === 'docker') {
  checkDockerDeployment();
  console.log('Deployment readiness checks passed.');
  process.exit(0);
}

if (!isProductionEcs) {
  console.log('local-readiness: OK');
  console.log('Set WORKOS_DEPLOY_TARGET=alicloud-ecs for production ECS checks.');
  process.exit(0);
}

checkProductionEnvironment();
checkPaymentEnvironment();
checkBuildArtifacts();
await checkDatabase();

console.log('Deployment readiness checks passed.');
