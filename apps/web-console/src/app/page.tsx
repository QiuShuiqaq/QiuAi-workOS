import { DashboardShell } from '../features/dashboard/DashboardShell';
import { loadDashboardData } from '../features/dashboard/load-dashboard-data';

export default async function HomePage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const dashboardData = await loadDashboardData(resolvedSearchParams?.workspaceId);

  return <DashboardShell {...dashboardData} />;
}
