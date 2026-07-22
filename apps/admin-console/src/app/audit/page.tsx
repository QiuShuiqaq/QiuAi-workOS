import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminAuditPageClient } from '../../features/audit/AdminAuditPageClient';
import { loadAdminAuditLogsPageData } from '../../features/audit/load-admin-audit-logs-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/audit');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminAuditLogsPageData();
  return <AdminAuditPageClient {...data} />;
}
