import { redirect } from "next/navigation";

import { resolveSiteLanguage } from "@/modules/site/i18n";

export default async function DocsPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string; doc?: string }>;
}) {
  const params = await searchParams;
  const lang = resolveSiteLanguage(params.lang);
  const search = new URLSearchParams({ lang });
  if (params.doc) {
    search.set("doc", params.doc);
  }

  redirect(`/guide?${search.toString()}`);
}
