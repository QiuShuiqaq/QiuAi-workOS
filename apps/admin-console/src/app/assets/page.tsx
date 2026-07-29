import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminAssetsPageClient } from '../../features/assets/AdminAssetsPageClient';
import { loadAdminAssetsPageData } from '../../features/assets/load-admin-assets-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/assets');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminAssetsPageData();
  return <AdminAssetsPageClient {...data} />;
}
