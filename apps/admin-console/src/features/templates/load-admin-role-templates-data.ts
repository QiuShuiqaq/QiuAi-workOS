import type {
  AdminPlanDetail,
  AssetDefinitionDetail,
  AdminRoleTemplateDetail,
  AdminWorkspaceSummary,
  CurrentAccountResponse
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export interface AdminRoleTemplatesPageData {
  currentAccount: CurrentAccountResponse;
  templates: AdminRoleTemplateDetail[];
  plans: AdminPlanDetail[];
  workspaces: AdminWorkspaceSummary[];
  assets: AssetDefinitionDetail[];
}

export async function loadAdminRoleTemplatesPageData(): Promise<AdminRoleTemplatesPageData> {
  const { currentAccount } = await loadAdminSession('/templates');
  const apiClient = await createServerApiClient();
  const [templates, plans, workspaces, assets] = await Promise.all([
    apiClient.listAdminRoleTemplates(),
    apiClient.listAdminPlans(),
    apiClient.listAdminWorkspaces({ page: 1, pageSize: 100 }),
    apiClient.listAdminAssets({ status: 'ACTIVE' })
  ]);

  return {
    currentAccount,
    templates: templates.data,
    plans: plans.data,
    workspaces: workspaces.data,
    assets: assets.data
  };
}
