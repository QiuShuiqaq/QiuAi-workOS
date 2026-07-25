import type {
  CurrentAccountResponse,
  ListRoleInstancesResponse,
  RoleInstanceDetail
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackRoleDetail, fallbackRoles } from './fallback-data';

export interface RolesPageData {
  currentAccount: CurrentAccountResponse;
  roles: ListRoleInstancesResponse;
  isApiFallback: boolean;
}

export async function loadRolesPageData(requestedWorkspaceId?: string): Promise<RolesPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);
  const apiClient = await createServerApiClient();

  try {
    const roles = await apiClient.listRoles(workspaceId);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      roles,
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
      isApiFallback: true
    };
  }
}

export interface RoleDetailPageData {
  currentAccount: CurrentAccountResponse;
  role: RoleInstanceDetail;
  isApiFallback: boolean;
}

export async function loadRoleDetailPageData(
  roleId: string,
  requestedWorkspaceId?: string
): Promise<RoleDetailPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const role = await (await createServerApiClient()).getRole(workspaceId, roleId);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      role: role.data,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      role: fallbackRoleDetail(roleId),
      isApiFallback: true
    };
  }
}
