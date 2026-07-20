import { EnterprisePageClient } from '../../features/enterprise/EnterprisePageClient';
import { loadEnterprisePageData } from '../../features/enterprise/load-enterprise-data';

export default async function EnterprisePage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, overview, invitations, isApiFallback } = await loadEnterprisePageData(
    resolvedSearchParams?.workspaceId
  );

  return (
    <EnterprisePageClient
      currentAccount={currentAccount}
      overview={overview}
      invitations={invitations}
      isApiFallback={isApiFallback}
    />
  );
}
