import { loadSettingsPageData } from '../../features/settings/load-settings-data';
import { SettingsPageClient } from '../../features/settings/SettingsPageClient';

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const { currentAccount, plans, billing, desktopDevices, isApiFallback } = await loadSettingsPageData(
    resolvedSearchParams?.workspaceId
  );

  return (
    <SettingsPageClient
      currentAccount={currentAccount}
      plans={plans.data}
      billing={billing.data}
      desktopDevices={desktopDevices.data}
      isApiFallback={isApiFallback}
    />
  );
}
