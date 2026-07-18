import type {
  CurrentAccountResponse,
  ListRoleInstancesResponse,
  ListRoleTemplatesResponse,
  RoleInstanceDetail
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackRoleDetail, fallbackRoles, fallbackRoleTemplates } from './fallback-data';

export interface RolesPageData {
  currentAccount: CurrentAccountResponse;
  roles: ListRoleInstancesResponse;
  templates: ListRoleTemplatesResponse;
  isApiFallback: boolean;
}

export async function loadRolesPageData(requestedWorkspaceId?: string): Promise<RolesPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);
  const apiClient = createServerApiClient();

  try {
    const [roles, templates] = await Promise.all([
      apiClient.listRoles(workspaceId),
      apiClient.listRoleTemplates(workspaceId)
    ]);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      roles,
      templates,
      isApiFallback: false
    };
  } catch {
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      roles: fallbackRoles,
      templates: fallbackRoleTemplates,
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
    const role = await createServerApiClient().getRole(workspaceId, roleId);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      role: role.data,
      isApiFallback: false
    };
  } catch {
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
