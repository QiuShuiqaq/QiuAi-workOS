import { DocsPageContent } from "@/components/site/docs-page-content";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { getDocsPageData } from "@/modules/site/public-service";

export default async function GuidePage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; doc?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const data = await getDocsPageData(lang, params.doc);

  return <DocsPageContent data={data} lang={lang} />;
}
