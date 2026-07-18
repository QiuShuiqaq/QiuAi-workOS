import { CostsPageClient } from '../../features/costs/CostsPageClient';
import { loadTaskDetailsForWorkspace } from '../../features/tasks/load-tasks-data';

export default async function CostsPage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, taskDetails, isApiFallback } = await loadTaskDetailsForWorkspace(
    resolvedSearchParams?.workspaceId
  );

  return (
    <CostsPageClient
      currentAccount={currentAccount}
      taskDetails={taskDetails}
      isApiFallback={isApiFallback}
    />
  );
}
