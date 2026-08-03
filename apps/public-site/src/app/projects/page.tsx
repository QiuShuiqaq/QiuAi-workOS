import { StudioProjectsPage } from "@/components/studio/studio-pages";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { readStudioContent } from "@/modules/studio/store";

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const content = await readStudioContent();

  return <StudioProjectsPage projects={content.projects} lang={lang} />;
}
