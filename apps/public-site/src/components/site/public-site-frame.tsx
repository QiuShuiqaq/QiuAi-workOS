"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { AppShell } from "@/components/shell/app-shell";
import { SiteEditSwitch } from "@/components/site/site-edit-switch";
import { SiteFooterCard } from "@/components/site/site-footer-card";
import { SiteLanguageSwitch } from "@/components/site/site-language-switch";
import { SiteThemeSwitch } from "@/components/site/site-theme-switch";
import type { SiteFooterData, SiteLanguage } from "@/types/site";

const SITE_SHELL_COPY = {
  title: {
    zh: "QiuAI WorkOS",
    en: "QiuAI WorkOS",
  },
  subtitle: {
    zh: "企业 AI 工作系统",
    en: "Enterprise AI Work System",
  },
  nav: {
    home: { zh: "首页", en: "Home" },
    projects: { zh: "产品", en: "Product" },
    caseStudies: { zh: "行业案例", en: "Cases" },
    openSource: { zh: "开源", en: "Open" },
    services: { zh: "企业服务", en: "Services" },
    downloads: { zh: "下载", en: "Download" },
    docs: { zh: "文档", en: "Docs" },
    team: { zh: "团队", en: "Team" },
    about: { zh: "关于", en: "About" },
    contact: { zh: "联系", en: "Contact" },
  },
  footerLinks: {
    downloads: { zh: "下载", en: "Downloads" },
    docs: { zh: "文档", en: "Docs" },
    developer: { zh: "开发者", en: "Developer" },
  },
} as const;

type PublicNavKey =
  | "home"
  | "projects"
  | "caseStudies"
  | "openSource"
  | "services"
  | "downloads"
  | "docs"
  | "team"
  | "about"
  | "contact";

function readText(value: { zh: string; en: string }, lang: SiteLanguage) {
  return lang === "zh" ? value.zh : value.en;
}

function resolveSiteLanguage(input?: string | null): SiteLanguage {
  return input === "en" ? "en" : "zh";
}

function buildLocalizedHref(pathname: string, lang: SiteLanguage) {
  const search = new URLSearchParams({ lang });
  return `${pathname}?${search.toString()}`;
}

function getSiteShellText(lang: SiteLanguage) {
  return {
    title: process.env.NEXT_PUBLIC_APP_NAME?.trim() || readText(SITE_SHELL_COPY.title, lang),
    subtitle: readText(SITE_SHELL_COPY.subtitle, lang),
    nav: {
      home: readText(SITE_SHELL_COPY.nav.home, lang),
      projects: readText(SITE_SHELL_COPY.nav.projects, lang),
      caseStudies: readText(SITE_SHELL_COPY.nav.caseStudies, lang),
      openSource: readText(SITE_SHELL_COPY.nav.openSource, lang),
      services: readText(SITE_SHELL_COPY.nav.services, lang),
      downloads: readText(SITE_SHELL_COPY.nav.downloads, lang),
      docs: readText(SITE_SHELL_COPY.nav.docs, lang),
      team: readText(SITE_SHELL_COPY.nav.team, lang),
      about: readText(SITE_SHELL_COPY.nav.about, lang),
      contact: readText(SITE_SHELL_COPY.nav.contact, lang),
    },
  };
}

function getSiteFooterData(lang: SiteLanguage): SiteFooterData {
  const beianText = process.env.NEXT_PUBLIC_ICP_BEIAN?.trim() || "浙ICP备2026043969号-1";
  const beianUrl = process.env.NEXT_PUBLIC_ICP_BEIAN_URL?.trim() || "https://beian.miit.gov.cn/";

  return {
    siteName: process.env.NEXT_PUBLIC_APP_NAME?.trim() || "QiuAI WorkOS",
    title: lang === "zh" ? "产品入口与联系" : "Product access and contact",
    description:
      lang === "zh"
        ? "QiuAI WorkOS 面向企业提供 Windows 桌面端、数字员工、数字工厂、模型配置、知识库和稳定产物交付。"
        : "QiuAI WorkOS provides Windows desktop execution, digital workers, digital factories, model configuration, knowledge bases, and artifact delivery for enterprise teams.",
    contacts: [
      { label: "QQ", value: "3431752914@qq.com", href: "mailto:3431752914@qq.com" },
      { label: "163", value: "15005828899@163.com", href: "mailto:15005828899@163.com" },
      { label: "Gmail", value: "qiushui1210@gmail.com", href: "mailto:qiushui1210@gmail.com" },
    ],
    footerLinks: [
      {
        label: readText(SITE_SHELL_COPY.footerLinks.downloads, lang),
        value: "/downloads",
        href: buildLocalizedHref("/downloads", lang),
      },
      {
        label: readText(SITE_SHELL_COPY.footerLinks.docs, lang),
        value: "/docs",
        href: buildLocalizedHref("/docs", lang),
      },
      {
        label: readText(SITE_SHELL_COPY.footerLinks.developer, lang),
        value: "/developer",
        href: buildLocalizedHref("/developer", lang),
      },
    ],
    footerLabels: {
      contact: lang === "zh" ? "联系方式" : "Contact",
      resources: lang === "zh" ? "资源入口" : "Resources",
      filing: lang === "zh" ? "备案信息" : "Filing",
    },
    beianText,
    beianUrl,
    publicSecurityBeianText: lang === "zh" ? "浙公网安备33052302001399号" : "Zhejiang Public Security Filing 33052302001399",
    publicSecurityBeianUrl: "https://beian.mps.gov.cn/",
  };
}

function resolveCurrentKey(pathname: string): PublicNavKey {
  if (pathname.startsWith("/projects")) {
    return "projects";
  }

  if (pathname.startsWith("/case-studies")) {
    return "caseStudies";
  }

  if (pathname.startsWith("/open-source")) {
    return "openSource";
  }

  if (pathname.startsWith("/services")) {
    return "services";
  }

  if (pathname.startsWith("/downloads")) {
    return "downloads";
  }

  if (pathname.startsWith("/docs")) {
    return "docs";
  }

  if (pathname.startsWith("/team")) {
    return "team";
  }

  if (pathname.startsWith("/about")) {
    return "about";
  }

  if (pathname.startsWith("/contact")) {
    return "contact";
  }

  return "home";
}

function PublicSiteFrameSync({
  onSync,
}: {
  onSync: (payload: { lang: SiteLanguage; search: string }) => void;
}) {
  const searchParams = useSearchParams();

  useEffect(() => {
    onSync({
      lang: resolveSiteLanguage(searchParams.get("lang")),
      search: searchParams.toString(),
    });
  }, [onSync, searchParams]);

  return null;
}

function PublicSiteFrameInner({
  lang,
  currentKey,
  pathname,
  search,
  children,
}: Readonly<{
  lang: SiteLanguage;
  currentKey: PublicNavKey;
  pathname: string;
  search?: string;
  children: React.ReactNode;
}>) {
  const shellText = getSiteShellText(lang);
  const footer = getSiteFooterData(lang);
  const navItems = [
    { key: "home", href: buildLocalizedHref("/", lang), label: shellText.nav.home },
    { key: "projects", href: buildLocalizedHref("/projects", lang), label: shellText.nav.projects },
    { key: "caseStudies", href: buildLocalizedHref("/case-studies", lang), label: shellText.nav.caseStudies },
    { key: "services", href: buildLocalizedHref("/services", lang), label: shellText.nav.services },
    { key: "downloads", href: buildLocalizedHref("/downloads", lang), label: shellText.nav.downloads },
    { key: "docs", href: buildLocalizedHref("/docs", lang), label: shellText.nav.docs },
    { key: "contact", href: buildLocalizedHref("/contact", lang), label: shellText.nav.contact },
  ];

  return (
    <AppShell
      title={shellText.title}
      subtitle={shellText.subtitle}
      variant="public"
      items={navItems}
      selectedKeys={[currentKey]}
      brandHref={buildLocalizedHref("/", lang)}
      actions={
        <>
          <SiteThemeSwitch />
          <SiteLanguageSwitch lang={lang} pathname={pathname} search={search} />
          <SiteEditSwitch lang={lang} />
        </>
      }
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

export function PublicSiteFrame({
  initialLang,
  children,
}: Readonly<{
  initialLang: SiteLanguage;
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [lang, setLang] = useState<SiteLanguage>(initialLang);
  const [search, setSearch] = useState(() => `lang=${initialLang}`);
  const currentKey = resolveCurrentKey(pathname);
  const handleSync = useCallback(({ lang: nextLang, search: nextSearch }: { lang: SiteLanguage; search: string }) => {
    setLang(nextLang);
    setSearch(nextSearch);
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PublicSiteFrameSync onSync={handleSync} />
      </Suspense>
      <PublicSiteFrameInner lang={lang} currentKey={currentKey} pathname={pathname} search={search}>
        {children}
      </PublicSiteFrameInner>
    </>
  );
}
