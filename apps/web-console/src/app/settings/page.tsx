import { loadSettingsPageData } from '../../features/settings/load-settings-data';
import { SettingsPageClient } from '../../features/settings/SettingsPageClient';

export default async function SettingsPage({
  searchParams
}: {
  searchParams?: Promise<{ workspaceId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const {
    currentAccount,
    plans,
    desktopDevices,
    desktopBindingCodes,
    softwareCopilots,
    isApiFallback
  } = await loadSettingsPageData(resolvedSearchParams?.workspaceId);

  return (
    <SettingsPageClient
      currentAccount={currentAccount}
      plans={plans.data}
      desktopDevices={desktopDevices.data}
      desktopBindingCodes={desktopBindingCodes.data}
      softwareCopilots={softwareCopilots}
      isApiFallback={isApiFallback}
    />
  );
}
