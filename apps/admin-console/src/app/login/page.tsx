import { redirect } from 'next/navigation';

import { LoginPageClient } from '../../features/auth/LoginPageClient';
import { createServerApiClient } from '../../shared/api/server-api';

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const nextPath = resolvedSearchParams?.next?.startsWith('/') ? resolvedSearchParams.next : '/';
  let isAuthenticated = false;

  try {
    const session = await (await createServerApiClient()).getAuthSession();
    isAuthenticated = session.authenticated;
  } catch {
    // Fall through to the login form when the backend is unavailable.
  }

  if (isAuthenticated) {
    redirect(nextPath);
  }

  return <LoginPageClient nextPath={nextPath} />;
}
