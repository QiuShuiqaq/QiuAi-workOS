import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminDesktopReleasesPageClient } from '../../features/desktop-releases/AdminDesktopReleasesPageClient';
import { loadAdminDesktopReleasesPageData } from '../../features/desktop-releases/load-admin-desktop-releases-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function DesktopReleasesPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/desktop-releases');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminDesktopReleasesPageData();
  return <AdminDesktopReleasesPageClient {...data} />;
}
