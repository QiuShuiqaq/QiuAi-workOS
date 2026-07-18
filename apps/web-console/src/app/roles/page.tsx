import { RolesPageClient } from '../../features/roles/RolesPageClient';
import { loadRolesPageData } from '../../features/roles/load-roles-data';

export default async function RolesPage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const data = await loadRolesPageData(resolvedSearchParams?.workspaceId);

  return (
    <RolesPageClient
      currentAccount={data.currentAccount}
      initialRoles={data.roles.data}
      templates={data.templates}
      isApiFallback={data.isApiFallback}
    />
  );
}
