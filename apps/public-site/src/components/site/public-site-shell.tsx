import { AppShell } from "@/components/shell/app-shell";
import { SiteFooterCard } from "@/components/site/site-footer-card";
import { SiteLanguageSwitch } from "@/components/site/site-language-switch";
import { buildLocalizedHref, getSiteShellText } from "@/modules/site/i18n";
import { getSiteFooterData } from "@/modules/site/public-service";
import type { SiteLanguage } from "@/types/site";

export function PublicSiteShell({
  lang,
  currentKey,
  children,
}: {
  lang: SiteLanguage;
  currentKey: "home" | "downloads" | "docs" | "developer" | "secondary";
  children: React.ReactNode;
}) {
  const text = getSiteShellText(lang);
  const footer = getSiteFooterData(lang);
  const navItems = [
    { key: "home", href: buildLocalizedHref("/", lang), label: text.nav.home },
    { key: "downloads", href: buildLocalizedHref("/downloads", lang), label: text.nav.downloads },
    { key: "docs", href: buildLocalizedHref("/docs", lang), label: text.nav.docs },
    { key: "developer", href: buildLocalizedHref("/developer", lang), label: text.nav.developer },
  ] as const;
  const pathnameByKey = {
    home: "/",
    downloads: "/downloads",
    docs: "/docs",
    developer: "/developer",
    secondary: "/",
  } as const;

  return (
    <AppShell
      title={text.title}
      subtitle={text.subtitle}
      variant="public"
      items={navItems.map((item) => ({
        key: item.key,
        href: item.href,
        label: item.label,
      }))}
      selectedKeys={[currentKey]}
      brandHref={buildLocalizedHref("/", lang)}
      actions={<SiteLanguageSwitch lang={lang} pathname={pathnameByKey[currentKey]} search={`lang=${lang}`} />}
    >
      <>
        {children}
        <SiteFooterCard
          siteName={footer.siteName}
          title={footer.title}
          description={footer.description}
          contacts={footer.contacts}
          footerLinks={footer.footerLinks}
          footerLabels={footer.footerLabels}
          beianText={footer.beianText}
          beianUrl={footer.beianUrl}
          publicSecurityBeianText={footer.publicSecurityBeianText}
          publicSecurityBeianUrl={footer.publicSecurityBeianUrl}
        />
      </>
    </AppShell>
  );
}
