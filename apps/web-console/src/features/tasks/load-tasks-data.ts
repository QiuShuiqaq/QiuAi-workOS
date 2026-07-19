import type {
  CurrentAccountResponse,
  ListRoleInstancesResponse,
  ListTasksResponse,
  TaskDetail
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackRoles } from '../roles/fallback-data';
import { fallbackTaskDetail, fallbackTaskDetails, fallbackTasks } from './fallback-data';

export interface TasksPageData {
  currentAccount: CurrentAccountResponse;
  roles: ListRoleInstancesResponse;
  tasks: ListTasksResponse;
  isApiFallback: boolean;
}

export async function loadTasksPageData(requestedWorkspaceId?: string): Promise<TasksPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);
  const apiClient = await createServerApiClient();

  try {
    const [roles, tasks] = await Promise.all([
      apiClient.listRoles(workspaceId),
      apiClient.listTasks(workspaceId)
    ]);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      roles,
      tasks,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      roles: fallbackRoles,
      tasks: fallbackTasks,
      isApiFallback: true
    };
  }
}

export interface TaskDetailPageData {
  currentAccount: CurrentAccountResponse;
  task: TaskDetail;
  isApiFallback: boolean;
}

export async function loadTaskDetailPageData(
  taskId: string,
  requestedWorkspaceId?: string
): Promise<TaskDetailPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const response = await (await createServerApiClient()).getTask(workspaceId, taskId);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      task: response.data,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      task: fallbackTaskDetail(taskId),
      isApiFallback: true
    };
  }
}

export interface TaskDetailsPageData {
  currentAccount: CurrentAccountResponse;
  taskDetails: TaskDetail[];
  isApiFallback: boolean;
}

export async function loadTaskDetailsForWorkspace(requestedWorkspaceId?: string): Promise<TaskDetailsPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);
  const apiClient = await createServerApiClient();

  try {
    const tasks = await apiClient.listTasks(workspaceId);
    const details = await Promise.all(
      tasks.data.map(async (task) => {
        const response = await apiClient.getTask(workspaceId, task.id);
        return response.data;
      })
    );
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      taskDetails: details,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      taskDetails: fallbackTaskDetails,
      isApiFallback: true
    };
  }
}
