import { RoleDetailPageClient } from '../../../features/roles/RoleDetailPageClient';
import { loadRoleDetailPageData } from '../../../features/roles/load-roles-data';

export default async function RoleDetailPage({ params }: { params: Promise<{ roleId: string }> }) {
  const { roleId } = await params;
  const data = await loadRoleDetailPageData(roleId);

  return <RoleDetailPageClient {...data} />;
}
