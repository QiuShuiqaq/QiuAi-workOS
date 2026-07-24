import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminRoleTemplatesPageClient } from '../../features/templates/AdminRoleTemplatesPageClient';
import { loadAdminRoleTemplatesPageData } from '../../features/templates/load-admin-role-templates-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function TemplatesPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/templates');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminRoleTemplatesPageData();
  return <AdminRoleTemplatesPageClient {...data} />;
}
