import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminWorkspacesPageClient } from '../../features/workspaces/AdminWorkspacesPageClient';
import { loadAdminWorkspacesPageData } from '../../features/workspaces/load-admin-workspaces-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function WorkspacesPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/workspaces');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminWorkspacesPageData();
  return <AdminWorkspacesPageClient {...data} />;
}
