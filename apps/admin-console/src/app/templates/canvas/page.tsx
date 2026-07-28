import { AdminAccessDenied } from '../../../features/auth/AdminAccessDenied';
import { AdminCreateRoleTemplatePageClient } from '../../../features/templates/AdminCreateRoleTemplatePageClient';
import { createServerApiClient } from '../../../shared/api/server-api';
import { loadAdminSession } from '../../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function TemplateCanvasPage({
  searchParams
}: {
  searchParams?: Promise<{ templateId?: string }>;
}) {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/templates/canvas');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const resolvedSearchParams = await searchParams;
  const apiClient = await createServerApiClient();
  const [templates, plans, workspaces, toolCatalog] = await Promise.all([
    apiClient.listAdminRoleTemplates(),
    apiClient.listAdminPlans(),
    apiClient.listAdminWorkspaces({ page: 1, pageSize: 100 }),
    apiClient.listAdminToolActionCatalog()
  ]);

  return (
    <AdminCreateRoleTemplatePageClient
      currentAccount={currentAccount}
      templates={templates.data}
      plans={plans.data}
      workspaces={workspaces.data}
      toolCatalog={toolCatalog.data}
      templateId={resolvedSearchParams?.templateId}
    />
  );
}
