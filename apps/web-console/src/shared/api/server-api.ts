import { QiuApiClient } from '@qiuai/api-client';

export function createServerApiClient() {
  return new QiuApiClient({
    baseUrl: process.env.SERVER_API_BASE_URL ?? 'http://127.0.0.1:4000'
  });
}
