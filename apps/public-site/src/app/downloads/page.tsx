import { DownloadsPageContent } from "@/components/site/downloads-page-content";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { getDownloadsPageData } from "@/modules/site/public-service";

export default async function DownloadsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const data = await getDownloadsPageData(lang);

  return <DownloadsPageContent data={data} lang={lang} />;
}
