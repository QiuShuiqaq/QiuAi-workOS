import { loadTaskDetailPageData } from '../../../features/tasks/load-tasks-data';
import { TaskDetailPageClient } from '../../../features/tasks/TaskDetailPageClient';

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const { currentAccount, task, isApiFallback } = await loadTaskDetailPageData(taskId);

  return <TaskDetailPageClient currentAccount={currentAccount} initialTask={task} isApiFallback={isApiFallback} />;
}
