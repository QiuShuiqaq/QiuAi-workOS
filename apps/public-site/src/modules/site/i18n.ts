import { readText, siteShellCopy } from "@/modules/site/content";
import type { SiteLanguage } from "@/types/site";

export function resolveSiteLanguage(input?: string | null): SiteLanguage {
  return input === "en" ? "en" : "zh";
}

export function buildLocalizedHref(
  pathname: string,
  lang: SiteLanguage,
  extra?: Record<string, string>,
) {
  const search = new URLSearchParams({ lang, ...(extra ?? {}) });
  return `${pathname}?${search.toString()}`;
}

export function getSiteShellText(lang: SiteLanguage) {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || readText(siteShellCopy.title, lang);
  const nav = siteShellCopy.nav as typeof siteShellCopy.nav & {
    developer?: typeof siteShellCopy.nav.home;
  };

  return {
    title: appName,
    subtitle: readText(siteShellCopy.subtitle, lang),
    nav: {
      home: readText(siteShellCopy.nav.home, lang),
      downloads: readText(siteShellCopy.nav.downloads, lang),
      docs: readText(siteShellCopy.nav.docs, lang),
      developer: nav.developer ? readText(nav.developer, lang) : lang === "zh" ? "开发者" : "Developer",
    },
  };
}
