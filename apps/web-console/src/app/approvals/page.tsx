import { ApprovalsPageClient } from '../../features/approvals/ApprovalsPageClient';
import { loadTaskDetailsForWorkspace } from '../../features/tasks/load-tasks-data';

export default async function ApprovalsPage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, taskDetails, isApiFallback } = await loadTaskDetailsForWorkspace(
    resolvedSearchParams?.workspaceId
  );

  return (
    <ApprovalsPageClient
      currentAccount={currentAccount}
      taskDetails={taskDetails}
      isApiFallback={isApiFallback}
    />
  );
}
