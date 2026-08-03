import { notFound } from "next/navigation";

import { StudioProjectDetailPage } from "@/components/studio/studio-pages";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { getStudioProjectBySlug } from "@/modules/studio/store";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lang = resolveSiteLanguage(query.lang);
  const project = await getStudioProjectBySlug(slug);

  if (!project) {
    notFound();
  }

  return <StudioProjectDetailPage project={project} lang={lang} />;
}
