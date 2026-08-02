import type {
  CurrentAccountResponse,
  TaskDetail
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackTaskDetails } from './fallback-data';

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
