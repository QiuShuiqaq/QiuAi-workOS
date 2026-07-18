import { QiuApiClient } from '@qiuai/api-client';

export function createBrowserApiClient() {
  return new QiuApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:4000'
  });
}
