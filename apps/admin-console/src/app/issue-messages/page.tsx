import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminIssueMessagesPageClient } from '../../features/issue-messages/AdminIssueMessagesPageClient';
import { loadAdminIssueMessagesPageData } from '../../features/issue-messages/load-admin-issue-messages-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function IssueMessagesPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/issue-messages');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminIssueMessagesPageData();
  return <AdminIssueMessagesPageClient {...data} />;
}
