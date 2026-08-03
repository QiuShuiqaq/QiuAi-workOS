import { loadPurchasePageData } from '../../features/purchase/load-purchase-data';
import { PurchaseCenterPageClient } from '../../features/purchase/PurchaseCenterPageClient';

export default async function PurchasePage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, plans, billing, isApiFallback } = await loadPurchasePageData(
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
