import { redirect } from 'next/navigation';

import { RegisterPageClient } from '../../features/auth/RegisterPageClient';
import { createServerApiClient } from '../../shared/api/server-api';

export default async function RegisterPage({
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
    // Fall through to the register form when the backend is unavailable.
  }

  if (isAuthenticated) {
    redirect(nextPath);
  }

  return <RegisterPageClient nextPath={nextPath} />;
}
