import { QiuApiError } from '@qiuai/api-client';
import { redirect } from 'next/navigation';

export function rethrowIfFrontendFallbackDisabled(error: unknown): void {
  if (error instanceof QiuApiError && error.status === 401) {
    redirect('/login');
  }

  const fallbackEnabled =
    process.env.WORKOS_ALLOW_FRONTEND_FALLBACK === 'true' ||
    (process.env.NODE_ENV !== 'production' && process.env.WORKOS_PERSISTENCE_MODE !== 'database');

  if (!fallbackEnabled) {
    throw error;
  }
}
