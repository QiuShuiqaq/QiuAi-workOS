import type { DesktopReferralOverview } from '../shared/desktop-api';

export type DesktopAccountStatus = DesktopReferralOverview['accountStatus'];
export type DesktopAuthorizationCatalogSource = 'server' | 'local_fallback';

export function resolveAccountPlanStatus(
  planCode: string | undefined,
  isUnbound: boolean
): DesktopAccountStatus {
  if (isUnbound) return 'unregistered';
  if (planCode?.startsWith('ENTERPRISE_')) return 'enterprise';
  if (planCode?.startsWith('PERSONAL_MEMBER_')) return 'member';
  return 'free';
}

export function resolveDisplayedAccountStatus(
  planCode: string | undefined,
  isUnbound: boolean,
  referralStatus?: DesktopAccountStatus,
  catalogSource?: DesktopAuthorizationCatalogSource
): DesktopAccountStatus {
  const catalogStatus = resolveAccountPlanStatus(planCode, isUnbound);
  if (catalogStatus === 'unregistered' || catalogSource === 'server') {
    return catalogStatus;
  }

  return referralStatus ?? catalogStatus;
}

export function canBindEnterpriseWorkspace(status: DesktopAccountStatus): boolean {
  return status === 'unregistered';
}
