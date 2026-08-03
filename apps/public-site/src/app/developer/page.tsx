import { DeveloperPageContent } from "@/components/site/developer-page-content";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { getDeveloperPageData } from "@/modules/site/public-service";

export default async function DeveloperPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const data = await getDeveloperPageData(lang);

  return <DeveloperPageContent data={data} lang={lang} />;
}
