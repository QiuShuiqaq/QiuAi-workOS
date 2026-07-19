import { QiuApiClient } from '@qiuai/api-client';
import { headers } from 'next/headers';

export async function createServerApiClient() {
  const requestHeaders = await headers();
  const cookie = requestHeaders.get('cookie') ?? undefined;

  return new QiuApiClient({
    baseUrl: process.env.SERVER_API_BASE_URL ?? 'http://127.0.0.1:4000',
    defaultHeaders: cookie ? { cookie } : undefined
  });
}
