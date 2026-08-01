import { loadSettingsPageData } from '../../features/settings/load-settings-data';
import { PurchaseCenterPageClient } from '../../features/purchase/PurchaseCenterPageClient';

export default async function PurchasePage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, plans, billing, isApiFallback } = await loadSettingsPageData(
    resolvedSearchParams?.workspaceId
  );

  return (
    <PurchaseCenterPageClient
      currentAccount={currentAccount}
      plans={plans.data}
      billing={billing.data}
      isApiFallback={isApiFallback}
    />
  );
}
