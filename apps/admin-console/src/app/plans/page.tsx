import { redirect } from 'next/navigation';

import { AdminPlansPageClient } from '../../features/plans/AdminPlansPageClient';
import { loadAdminDashboardData } from '../../features/dashboard/load-admin-data';
import { createServerApiClient } from '../../shared/api/server-api';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  try {
    const session = await (await createServerApiClient()).getAuthSession();
    if (!session.authenticated) {
      redirect('/login?next=/plans');
    }
  } catch {
    // Fall through to fallback data when the backend is unavailable.
  }

  const data = await loadAdminDashboardData();
  return <AdminPlansPageClient {...data} />;
}
