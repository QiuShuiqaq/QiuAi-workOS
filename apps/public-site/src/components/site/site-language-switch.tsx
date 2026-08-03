import type { SiteLanguage } from "@/types/site";

export function SiteLanguageSwitch({
  lang,
  pathname,
  search,
}: {
  lang: SiteLanguage;
  pathname: string;
  search?: string;
}) {
  const buildHref = (nextLang: SiteLanguage) => {
    const nextParams = new URLSearchParams(search ?? "");
    nextParams.set("lang", nextLang);
    return `${pathname}?${nextParams.toString()}`;
  };

  return (
    <div className="site-language-switch" role="group" aria-label="Language switch">
      <a
        href={buildHref("zh")}
        className={`site-language-switch__item${lang === "zh" ? " site-language-switch__item--active" : ""}`}
        aria-current={lang === "zh" ? "page" : undefined}
      >
        中文
      </a>
      <a
        href={buildHref("en")}
        className={`site-language-switch__item${lang === "en" ? " site-language-switch__item--active" : ""}`}
        aria-current={lang === "en" ? "page" : undefined}
      >
        EN
      </a>
    </div>
  );
}
