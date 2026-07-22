import { AdminAccessDenied } from '../features/auth/AdminAccessDenied';
import { AdminDashboard } from '../features/dashboard/AdminDashboard';
import { loadAdminDashboardData } from '../features/dashboard/load-admin-data';
import { loadAdminSession } from '../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminDashboardData();
  return <AdminDashboard {...data} />;
}
