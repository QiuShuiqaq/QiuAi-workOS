import { StudioTeamPage } from "@/components/studio/studio-pages";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { readStudioContent } from "@/modules/studio/store";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const content = await readStudioContent();

  return <StudioTeamPage team={content.team} lang={lang} />;
}
