"use client";

import { DownloadOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { useTransition } from "react";

import type { SiteLanguage } from "@/types/site";

export function ResourceDownloadButton({
  href,
  lang,
  disabled,
  onTracked,
}: {
  href: string | null;
  lang: SiteLanguage;
  disabled?: boolean;
  onTracked?: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="primary"
      size="large"
      icon={<DownloadOutlined />}
      disabled={disabled || !href || isPending}
      onClick={(event) => {
        if (!href || disabled) {
          return;
        }

        event.preventDefault();

        startTransition(() => {
          onTracked?.();
          window.open(href, "_blank", "noopener,noreferrer");
        });
      }}
    >
      {disabled || !href ? (lang === "zh" ? "即将提供" : "Coming Soon") : lang === "zh" ? "下载" : "Download"}
    </Button>
  );
}
