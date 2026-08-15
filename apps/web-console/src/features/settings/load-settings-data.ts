import type {
  CurrentAccountResponse,
  ListDesktopBindingCodesResponse,
  ListDesktopDevicesResponse,
  ListPlansResponse,
  ListSoftwareCopilotsResponse
} from '@qiuai/api-contract';

import { createServerApiClient } from '../../shared/api/server-api';
import { rethrowIfFrontendFallbackDisabled } from '../common/api-fallback';
import { loadCurrentAccount } from '../common/load-current-account';
import { resolveWorkspaceId } from '../common/resolve-workspace-id';
import { fallbackPlans } from './fallback-data';

export interface SettingsPageData {
  currentAccount: CurrentAccountResponse;
  plans: ListPlansResponse;
  desktopDevices: ListDesktopDevicesResponse;
  desktopBindingCodes: ListDesktopBindingCodesResponse;
  softwareCopilots: ListSoftwareCopilotsResponse;
  isApiFallback: boolean;
}

export async function loadSettingsPageData(requestedWorkspaceId?: string): Promise<SettingsPageData> {
  const currentAccount = await loadCurrentAccount();
  const workspaceId = resolveWorkspaceId(currentAccount, requestedWorkspaceId);

  try {
    const apiClient = await createServerApiClient();
    const [plans, desktopDevices, desktopBindingCodes, softwareCopilots] = await Promise.all([
      apiClient.listPlans(),
      apiClient.listDesktopDevices(workspaceId),
      apiClient.listDesktopBindingCodes(workspaceId),
      apiClient.listSoftwareCopilots(workspaceId)
    ]);
    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      plans,
      desktopDevices,
      desktopBindingCodes,
      softwareCopilots,
      isApiFallback: false
    };
  } catch (error) {
    rethrowIfFrontendFallbackDisabled(error);

    return {
      currentAccount: {
        ...currentAccount,
        activeWorkspaceId: workspaceId
      },
      plans: fallbackPlans,
      desktopDevices: {
        data: []
      },
      desktopBindingCodes: {
        data: []
      },
      softwareCopilots: {
        workspaceId,
        workspaceType:
          currentAccount.workspaces.find((workspace) => workspace.id === workspaceId)?.workspaceType ??
          'personal',
        data: []
      },
      isApiFallback: true
    };
  }
}
