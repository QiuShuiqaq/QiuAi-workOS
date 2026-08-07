import { StudioProjectsPage } from "@/components/studio/studio-pages";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { fetchPublicPlans } from "@/modules/site/workos-plans";
import { readStudioContent } from "@/modules/studio/store";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const [content, plans] = await Promise.all([readStudioContent(), fetchPublicPlans()]);

  return <StudioProjectsPage projects={content.projects} plans={plans} lang={lang} />;
}
