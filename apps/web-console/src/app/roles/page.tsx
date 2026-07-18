import { RolesPageClient } from '../../features/roles/RolesPageClient';
import { loadRolesPageData } from '../../features/roles/load-roles-data';

export default async function RolesPage() {
  const data = await loadRolesPageData();

  return (
    <RolesPageClient
      currentAccount={data.currentAccount}
      initialRoles={data.roles.data}
      templates={data.templates}
      isApiFallback={data.isApiFallback}
    />
  );
}
