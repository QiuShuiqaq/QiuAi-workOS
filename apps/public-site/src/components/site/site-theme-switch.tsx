"use client";

import { useEffect, useState } from "react";

type SiteTheme = "launch" | "graphite" | "ocean";

const themeOptions: Array<{ value: SiteTheme; label: string }> = [
  { value: "launch", label: "默认" },
  { value: "graphite", label: "墨色" },
  { value: "ocean", label: "海蓝" },
];

function applySiteTheme(theme: SiteTheme) {
  document.documentElement.dataset.siteTheme = theme;
}

export function SiteThemeSwitch() {
  const [theme, setTheme] = useState<SiteTheme>("launch");

  useEffect(() => {
    const stored = window.localStorage.getItem("qiuaihub-site-theme");
    const nextTheme = themeOptions.some((item) => item.value === stored) ? (stored as SiteTheme) : "launch";
    setTheme(nextTheme);
    applySiteTheme(nextTheme);
  }, []);

  const handleSelect = (nextTheme: SiteTheme) => {
    setTheme(nextTheme);
    window.localStorage.setItem("qiuaihub-site-theme", nextTheme);
    applySiteTheme(nextTheme);
  };

  return (
    <details className="site-theme-switch">
      <summary>主题</summary>
      <div className="site-theme-switch__menu">
        {themeOptions.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`site-theme-switch__item${theme === item.value ? " site-theme-switch__item--active" : ""}`}
            onClick={() => handleSelect(item.value)}
          >
            <span className={`site-theme-switch__swatch site-theme-switch__swatch--${item.value}`} aria-hidden="true" />
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
