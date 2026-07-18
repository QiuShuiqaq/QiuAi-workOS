import type {
  CurrentAccountResponse,
  ListRoleInstancesResponse,
  ListTasksResponse,
  TaskDetail
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadCurrentAccount } from '../common/load-current-account';
import { fallbackRoles } from '../roles/fallback-data';
import { fallbackTaskDetail, fallbackTaskDetails, fallbackTasks } from './fallback-data';

export interface TasksPageData {
  currentAccount: CurrentAccountResponse;
  roles: ListRoleInstancesResponse;
  tasks: ListTasksResponse;
  isApiFallback: boolean;
}

export async function loadTasksPageData(): Promise<TasksPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = currentAccount.activeWorkspaceId;
  const apiClient = createServerApiClient();

  try {
    const [roles, tasks] = await Promise.all([
      apiClient.listRoles(workspaceId),
      apiClient.listTasks(workspaceId)
    ]);
    return { currentAccount, roles, tasks, isApiFallback: false };
  } catch {
    return { currentAccount, roles: fallbackRoles, tasks: fallbackTasks, isApiFallback: true };
  }
}

export interface TaskDetailPageData {
  currentAccount: CurrentAccountResponse;
  task: TaskDetail;
  isApiFallback: boolean;
}

export async function loadTaskDetailPageData(taskId: string): Promise<TaskDetailPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = currentAccount.activeWorkspaceId;

  try {
    const response = await createServerApiClient().getTask(workspaceId, taskId);
    return { currentAccount, task: response.data, isApiFallback: false };
  } catch {
    return { currentAccount, task: fallbackTaskDetail(taskId), isApiFallback: true };
  }
}

export interface TaskDetailsPageData {
  currentAccount: CurrentAccountResponse;
  taskDetails: TaskDetail[];
  isApiFallback: boolean;
}

export async function loadTaskDetailsForWorkspace(): Promise<TaskDetailsPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = currentAccount.activeWorkspaceId;
  const apiClient = createServerApiClient();

  try {
    const tasks = await apiClient.listTasks(workspaceId);
    const details = await Promise.all(
      tasks.data.map(async (task) => {
        const response = await apiClient.getTask(workspaceId, task.id);
        return response.data;
      })
    );
    return { currentAccount, taskDetails: details, isApiFallback: false };
  } catch {
    return { currentAccount, taskDetails: fallbackTaskDetails, isApiFallback: true };
  }
}
