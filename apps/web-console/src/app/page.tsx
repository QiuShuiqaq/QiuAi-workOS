import { DashboardShell } from '../features/dashboard/DashboardShell';
import { loadDashboardData } from '../features/dashboard/load-dashboard-data';

export default async function HomePage() {
  const dashboardData = await loadDashboardData();

  return <DashboardShell {...dashboardData} />;
}
