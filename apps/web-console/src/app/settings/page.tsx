import { loadSettingsPageData } from '../../features/settings/load-settings-data';
import { SettingsPageClient } from '../../features/settings/SettingsPageClient';

export default async function SettingsPage() {
  const { currentAccount, plans, isApiFallback } = await loadSettingsPageData();

  return (
    <SettingsPageClient
      currentAccount={currentAccount}
      plans={plans.data}
      isApiFallback={isApiFallback}
    />
  );
}
