import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminPlansPageClient } from '../../features/plans/AdminPlansPageClient';
import { loadAdminPlansPageData } from '../../features/plans/load-admin-plans-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function PlansPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/plans');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminPlansPageData();
  return <AdminPlansPageClient {...data} />;
}
