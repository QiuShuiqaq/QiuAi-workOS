import { redirect } from 'next/navigation';

import { AdminDashboard } from '../features/dashboard/AdminDashboard';
import { loadAdminDashboardData } from '../features/dashboard/load-admin-data';
import { createServerApiClient } from '../shared/api/server-api';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const session = await (await createServerApiClient()).getAuthSession();
    if (!session.authenticated) {
      redirect('/login?next=/');
    }
  } catch {
    // Fall through to fallback data when the backend is unavailable.
  }

  const data = await loadAdminDashboardData();
  return <AdminDashboard {...data} />;
}
