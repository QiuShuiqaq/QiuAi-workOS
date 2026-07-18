import type {
  CurrentAccountResponse,
  ListRoleInstancesResponse,
  ListRoleTemplatesResponse,
  RoleInstanceDetail
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadCurrentAccount } from '../common/load-current-account';
import { fallbackRoleDetail, fallbackRoles, fallbackRoleTemplates } from './fallback-data';

export interface RolesPageData {
  currentAccount: CurrentAccountResponse;
  roles: ListRoleInstancesResponse;
  templates: ListRoleTemplatesResponse;
  isApiFallback: boolean;
}

export async function loadRolesPageData(): Promise<RolesPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = currentAccount.activeWorkspaceId;
  const apiClient = createServerApiClient();

  try {
    const [roles, templates] = await Promise.all([
      apiClient.listRoles(workspaceId),
      apiClient.listRoleTemplates(workspaceId)
    ]);
    return { currentAccount, roles, templates, isApiFallback: false };
  } catch {
    return { currentAccount, roles: fallbackRoles, templates: fallbackRoleTemplates, isApiFallback: true };
  }
}

export interface RoleDetailPageData {
  currentAccount: CurrentAccountResponse;
  role: RoleInstanceDetail;
  isApiFallback: boolean;
}

export async function loadRoleDetailPageData(roleId: string): Promise<RoleDetailPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = currentAccount.activeWorkspaceId;

  try {
    const role = await createServerApiClient().getRole(workspaceId, roleId);
    return { currentAccount, role: role.data, isApiFallback: false };
  } catch {
    return { currentAccount, role: fallbackRoleDetail(roleId), isApiFallback: true };
  }
}
