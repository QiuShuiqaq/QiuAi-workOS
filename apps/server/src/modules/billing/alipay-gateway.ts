import { AlipaySdk } from 'alipay-sdk';

const ALIPAY_GATEWAY_URL = 'https://openapi.alipay.com/gateway.do';
const ALIPAY_NOTIFY_PATH = '/api/v1/billing/alipay/notify';
const ALIPAY_RETURN_PATH = '/billing/alipay/return';
const ALIPAY_ORDER_TIMEOUT_EXPRESS = '30m';

const REQUIRED_ENV_KEYS = [
  'PAYMENT_ALIPAY_APP_ID',
  'PAYMENT_ALIPAY_PRIVATE_KEY',
  'PAYMENT_ALIPAY_PUBLIC_KEY'
] as const;

type AlipayKeyType = 'PKCS1' | 'PKCS8';

export interface AlipayCheckoutInput {
  orderNo: string;
  amountCents: number;
  subject: string;
  body?: string;
  timeoutExpress?: string;
}

export interface AlipayTradeStatusResult {
  orderNo: string;
  tradeNo: string | null;
  tradeStatus: string | null;
  totalAmount: string | null;
  raw: Record<string, unknown>;
}

let cachedSdk: AlipaySdk | null = null;

export function getMissingAlipayEnvKeys(): string[] {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => {
    const value = process.env[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (!getPublicBaseUrl()) {
    return ['WORKOS_PUBLIC_BASE_URL', ...missingKeys];
  }

  return [...missingKeys];
}

export function isAlipayConfigured(): boolean {
  return getMissingAlipayEnvKeys().length === 0;
}

export function buildAlipayCheckoutUrl(input: AlipayCheckoutInput): string {
  const sdk = getAlipaySdk();

  return sdk.pageExecute('alipay.trade.page.pay', 'GET', {
    notifyUrl: buildAbsoluteUrl(getRequiredPublicBaseUrl(), getAlipayNotifyPath()),
    returnUrl: buildAbsoluteUrl(getRequiredPublicBaseUrl(), getAlipayReturnPath(), {
      out_trade_no: input.orderNo
    }),
    bizContent: {
      out_trade_no: input.orderNo,
      product_code: 'FAST_INSTANT_TRADE_PAY',
      total_amount: formatAmountCny(input.amountCents),
      subject: input.subject,
      body: input.body,
      timeout_express: input.timeoutExpress ?? ALIPAY_ORDER_TIMEOUT_EXPRESS
    }
  });
}

export function verifyAlipayNotifySignature(input: {
  rawPayload: Record<string, string>;
  decodedPayload: Record<string, string>;
}): boolean {
  const sdk = getAlipaySdk();

  if (sdk.checkNotifySignV2(input.rawPayload)) {
    return true;
  }

  return sdk.checkNotifySign(input.decodedPayload);
}

export async function queryAlipayTradeByOrderNo(orderNo: string): Promise<AlipayTradeStatusResult | null> {
  const result = await getAlipaySdk().exec('alipay.trade.query', {
    bizContent: {
      out_trade_no: orderNo
    }
  });

  if (result.code !== '10000') {
    if (result.code === '40004') {
      return null;
    }

    throw new Error(result.sub_msg || result.msg || 'ALIPAY_QUERY_FAILED');
  }

  const raw = result as Record<string, unknown>;

  return {
    orderNo: readStringField(raw, 'outTradeNo', 'out_trade_no') ?? orderNo,
    tradeNo: readStringField(raw, 'tradeNo', 'trade_no'),
    tradeStatus: readStringField(raw, 'tradeStatus', 'trade_status'),
    totalAmount: readStringField(raw, 'totalAmount', 'total_amount'),
    raw
  };
}

export function parseAlipayRawBody(body: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const segment of body.split('&')) {
    if (!segment) {
      continue;
    }

    const separatorIndex = segment.indexOf('=');
    const rawKey = separatorIndex >= 0 ? segment.slice(0, separatorIndex) : segment;
    const rawValue = separatorIndex >= 0 ? segment.slice(separatorIndex + 1) : '';
    const key = decodeURIComponent(rawKey.replace(/\+/g, '%20'));

    result[key] = rawValue;
  }

  return result;
}

export function parseAlipayDecodedBody(body: string): Record<string, string> {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(body);

  params.forEach((value, key) => {
    result[key] = value;
  });

  return result;
}

export function normalizeAlipayNotifyBody(body: unknown): string {
  if (typeof body === 'string') {
    return body;
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return '';
  }

  return new URLSearchParams(
    Object.entries(body).reduce<Record<string, string>>((result, [key, value]) => {
      if (typeof value === 'string') {
        result[key] = value;
      }
      return result;
    }, {})
  ).toString();
}

export function isAlipayTradePaid(tradeStatus: string | null | undefined): boolean {
  return tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED';
}

export function isAlipayTradeClosed(tradeStatus: string | null | undefined): boolean {
  return tradeStatus === 'TRADE_CLOSED';
}

export function validateAlipayAppContext(input: {
  appId?: string | null;
  sellerId?: string | null;
}): void {
  if (input.appId && input.appId !== requireEnv('PAYMENT_ALIPAY_APP_ID')) {
    throw new Error('ALIPAY_APP_ID_MISMATCH');
  }

  const sellerId = process.env.PAYMENT_ALIPAY_SELLER_ID?.trim();
  if (sellerId && input.sellerId && input.sellerId !== sellerId) {
    throw new Error('ALIPAY_SELLER_ID_MISMATCH');
  }
}

export function getAlipayGatewayUrl(): string {
  return process.env.PAYMENT_ALIPAY_GATEWAY_URL?.trim() || ALIPAY_GATEWAY_URL;
}

export function getAlipayNotifyPath(): string {
  return process.env.PAYMENT_ALIPAY_NOTIFY_PATH?.trim() || ALIPAY_NOTIFY_PATH;
}

export function getAlipayReturnPath(): string {
  return process.env.PAYMENT_ALIPAY_RETURN_PATH?.trim() || ALIPAY_RETURN_PATH;
}

export function getAlipayNotifyUrl(): string {
  return buildAbsoluteUrl(getRequiredPublicBaseUrl(), getAlipayNotifyPath());
}

export function getAlipayReturnUrl(orderNo?: string): string {
  return buildAbsoluteUrl(
    getRequiredPublicBaseUrl(),
    getAlipayReturnPath(),
    orderNo ? { out_trade_no: orderNo } : undefined
  );
}

export function formatAmountCny(amountCents: number): string {
  return (amountCents / 100).toFixed(2);
}

function getAlipaySdk(): AlipaySdk {
  if (!cachedSdk) {
    cachedSdk = new AlipaySdk({
      appId: requireEnv('PAYMENT_ALIPAY_APP_ID'),
      privateKey: normalizePem(requireEnv('PAYMENT_ALIPAY_PRIVATE_KEY')),
      alipayPublicKey: normalizePem(requireEnv('PAYMENT_ALIPAY_PUBLIC_KEY')),
      keyType: getAlipayKeyType(),
      gateway: getAlipayGatewayUrl()
    });
  }

  return cachedSdk;
}

function getAlipayKeyType(): AlipayKeyType {
  return process.env.PAYMENT_ALIPAY_KEY_TYPE === 'PKCS1' ? 'PKCS1' : 'PKCS8';
}

function getPublicBaseUrl(): string | undefined {
  return process.env.WORKOS_PUBLIC_BASE_URL?.trim() || process.env.APP_BASE_URL?.trim() || undefined;
}

function getRequiredPublicBaseUrl(): string {
  const baseUrl = getPublicBaseUrl();
  if (!baseUrl) {
    throw new Error('WORKOS_PUBLIC_BASE_URL is required for Alipay.');
  }

  return baseUrl;
}

function buildAbsoluteUrl(baseUrl: string, path: string, extraParams?: Record<string, string>): string {
  const url = new URL(path, baseUrl);

  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${key} is required for Alipay.`);
  }

  return value.trim();
}

function normalizePem(value: string): string {
  return value.replace(/\\n/g, '\n').trim();
}

function readStringField(record: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    if (typeof record[key] === 'string') {
      return record[key] as string;
    }
  }

  return null;
}
