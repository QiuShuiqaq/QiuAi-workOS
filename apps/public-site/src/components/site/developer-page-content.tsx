"use client";

import Link from "next/link";
import { Segmented, Space, Typography } from "antd";
import { useMemo, useState } from "react";

import { SectionCard } from "@/components/ui/section-card";
import type { DeveloperPageData, SiteLanguage } from "@/types/site";

const { Paragraph, Text, Title } = Typography;

const PAGE_SIZE = 5;

export function DeveloperPageContent({
  data,
  lang,
}: {
  data: DeveloperPageData;
  lang: SiteLanguage;
}) {
  const [activeGroupKey, setActiveGroupKey] = useState(data.repositoryGroups[0]?.key ?? "project");
  const [pageByGroup, setPageByGroup] = useState<Record<string, number>>({});

  const activeGroup = useMemo(
    () => data.repositoryGroups.find((group) => group.key === activeGroupKey) ?? data.repositoryGroups[0],
    [activeGroupKey, data.repositoryGroups],
  );

  if (!activeGroup) {
    return null;
  }

  const currentPage = pageByGroup[activeGroup.key] ?? 0;
  const totalPages = Math.max(1, Math.ceil(activeGroup.items.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages - 1);
  const visibleItems = activeGroup.items.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <Space direction="vertical" size={32} className="public-stack" style={{ width: "100%" }}>
      <section className="page-hero developer-hero">
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Text className="developer-kicker">{lang === "zh" ? "开发者" : "Developer"}</Text>
          <Title style={{ margin: 0, maxWidth: 980, fontSize: "clamp(42px, 5vw, 70px)", lineHeight: 0.96 }}>
            {data.profile.name}
          </Title>
          <Paragraph style={{ margin: 0, maxWidth: 860, fontSize: 18, color: "var(--muted-strong)" }}>
            {data.profile.role}
          </Paragraph>
          <Paragraph style={{ margin: 0, maxWidth: 860, fontSize: 18, color: "var(--muted)" }}>
            {data.profile.summary}
          </Paragraph>
          <Space size={12} wrap>
            <Link href={data.profile.websiteUrl}>{data.profile.websiteLabel}</Link>
            <Link href={data.profile.githubUrl} target="_blank" rel="noreferrer">
              GitHub
            </Link>
            <Text>{data.profile.email}</Text>
            <Text>{data.profile.location}</Text>
          </Space>
        </Space>
      </section>

      <div className="developer-column developer-column--full">
        <SectionCard
          title={lang === "zh" ? "仓库" : "Repositories"}
          description={lang === "zh" ? "只展示公开仓库，按分类查看并支持换页。" : "Public repositories only, grouped and paged."}
          extra={
            <Segmented
              options={data.repositoryGroups.map((group) => ({
                label: group.key,
                value: group.key,
              }))}
              value={activeGroup.key}
              onChange={(value) => {
                setActiveGroupKey(String(value));
              }}
            />
          }
        >
          <div className="developer-repository-toolbar">
            <div className="developer-repository-toolbar__copy">
              <Text strong>{activeGroup.title}</Text>
              <Text type="secondary">{activeGroup.description}</Text>
            </div>
            <div className="home-feed-section__pager">
              <button
                type="button"
                className="home-feed-section__pager-button"
                disabled={safePage === 0}
                onClick={() => {
                  setPageByGroup((current) => ({
                    ...current,
                    [activeGroup.key]: Math.max(0, safePage - 1),
                  }));
                }}
              >
                ◀
              </button>
              <Text className="home-feed-section__pager-index">
                {safePage + 1} / {totalPages}
              </Text>
              <button
                type="button"
                className="home-feed-section__pager-button"
                disabled={safePage >= totalPages - 1}
                onClick={() => {
                  setPageByGroup((current) => ({
                    ...current,
                    [activeGroup.key]: Math.min(totalPages - 1, safePage + 1),
                  }));
                }}
              >
                ▶
              </button>
            </div>
          </div>

          <div className="developer-repository-list">
            {visibleItems.map((item, index) => {
              const order = safePage * PAGE_SIZE + index + 1;
              return (
                <div key={item.slug} className="developer-repository-item">
                  <div className="developer-repository-item__index">{String(order).padStart(2, "0")}</div>
                  <div className="developer-repository-item__body">
                    <Title level={4} style={{ margin: 0 }}>
                      {item.name}
                    </Title>
                    <Paragraph style={{ margin: 0, color: "var(--muted)", lineHeight: 1.8 }}>
                      {item.summary}
                    </Paragraph>
                    <Link href={item.githubUrl} target="_blank" rel="noreferrer">
                      {item.githubUrl}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        <SectionCard
          title={data.manifesto.title}
          description={
            lang === "zh"
              ? "关于 AI 应用方向、社会价值与长期愿景的公开表达。"
              : "A public note on AI, social value, and long-term direction."
          }
        >
          <div className="developer-manifesto">
            {data.manifesto.paragraphs.map((paragraph) => (
              <Paragraph key={paragraph} style={{ margin: 0, color: "var(--muted-strong)", lineHeight: 1.95 }}>
                {paragraph}
              </Paragraph>
            ))}
          </div>
        </SectionCard>
      </div>
    </Space>
  );
}
