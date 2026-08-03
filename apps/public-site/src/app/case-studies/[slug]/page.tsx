import { notFound } from "next/navigation";

import { StudioCaseStudyDetailPage } from "@/components/studio/studio-pages";
import { resolveSiteLanguage } from "@/modules/site/i18n";
import { getStudioCaseStudyBySlug } from "@/modules/studio/store";

export const dynamic = "force-dynamic";

export default async function CaseStudyDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const lang = resolveSiteLanguage(query.lang);
  const item = await getStudioCaseStudyBySlug(slug);

  if (!item) {
    notFound();
  }

  return <StudioCaseStudyDetailPage item={item} lang={lang} />;
}
