import { AdminAccessDenied } from '../../features/auth/AdminAccessDenied';
import { AdminRoleTemplatesPageClient } from '../../features/templates/AdminRoleTemplatesPageClient';
import { loadAdminRoleTemplatesPageData } from '../../features/templates/load-admin-role-templates-data';
import { loadAdminSession } from '../../shared/auth/load-admin-session';

export const dynamic = 'force-dynamic';

export default async function FactoriesPage() {
  const { currentAccount, isAdminOperator } = await loadAdminSession('/factories');
  if (!isAdminOperator) {
    return <AdminAccessDenied currentAccount={currentAccount} />;
  }

  const data = await loadAdminRoleTemplatesPageData();
  return (
    <AdminRoleTemplatesPageClient
      {...data}
      applicationTypeFilter="digital_factory"
      pageTitle="数字工厂"
      pageDescription="管理批量化、流程化的数字工厂模板。PC 端会同步已上架且有权限的数字工厂。"
      itemLabel="数字工厂"
      listTitle="工厂列表"
    />
  );
}
