import { loadTasksPageData } from '../../features/tasks/load-tasks-data';
import { TasksPageClient } from '../../features/tasks/TasksPageClient';

export default async function TasksPage() {
  const { currentAccount, roles, tasks, isApiFallback } = await loadTasksPageData();

  return (
    <TasksPageClient
      currentAccount={currentAccount}
      roles={roles.data}
      initialTasks={tasks.data}
      isApiFallback={isApiFallback}
    />
  );
}
