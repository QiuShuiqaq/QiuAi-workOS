import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminOfficialRoutesPageClient } from '../../features/official-routes/AdminOfficialRoutesPageClient';
import { loadAdminOfficialRoutesPageData } from '../../features/official-routes/load-admin-official-routes-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function OfficialRoutesPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/official-routes');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminOfficialRoutesPageData();
  return <AdminOfficialRoutesPageClient {...data} />;
}
