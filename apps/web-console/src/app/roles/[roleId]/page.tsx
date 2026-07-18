import { RoleDetailPageClient } from '../../../features/roles/RoleDetailPageClient';
import { loadRoleDetailPageData } from '../../../features/roles/load-roles-data';

export default async function RoleDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ roleId: string }>;
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const { roleId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const data = await loadRoleDetailPageData(roleId, resolvedSearchParams?.workspaceId);

  return <RoleDetailPageClient {...data} />;
}
