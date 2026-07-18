import { loadTasksPageData } from '../../features/tasks/load-tasks-data';
import { TasksPageClient } from '../../features/tasks/TasksPageClient';

export default async function TasksPage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, roles, tasks, isApiFallback } = await loadTasksPageData(
    resolvedSearchParams?.workspaceId
  );

  return (
    <TasksPageClient
      currentAccount={currentAccount}
      roles={roles.data}
      initialTasks={tasks.data}
      isApiFallback={isApiFallback}
    />
  );
}
