import { loadTaskDetailPageData } from '../../../features/tasks/load-tasks-data';
import { TaskDetailPageClient } from '../../../features/tasks/TaskDetailPageClient';

export default async function TaskDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ taskId: string }>;
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const { taskId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, task, isApiFallback } = await loadTaskDetailPageData(
    taskId,
    resolvedSearchParams?.workspaceId
  );

  return <TaskDetailPageClient currentAccount={currentAccount} initialTask={task} isApiFallback={isApiFallback} />;
}
