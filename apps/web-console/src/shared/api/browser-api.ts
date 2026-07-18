import { QiuApiClient } from '@qiuai/api-client';

export function createBrowserApiClient() {
  return new QiuApiClient({
    baseUrl: ''
  });
}
