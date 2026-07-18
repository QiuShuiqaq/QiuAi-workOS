import { CostsPageClient } from '../../features/costs/CostsPageClient';
import { loadTaskDetailsForWorkspace } from '../../features/tasks/load-tasks-data';

export default async function CostsPage() {
  const { currentAccount, taskDetails, isApiFallback } = await loadTaskDetailsForWorkspace();

  return (
    <CostsPageClient
      currentAccount={currentAccount}
      taskDetails={taskDetails}
      isApiFallback={isApiFallback}
    />
  );
}
