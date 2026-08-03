"use client";

import Link from "next/link";
import { Button, Space, Tag, Typography } from "antd";
import { useState } from "react";

import { HomeEngagementStrip } from "@/components/site/home-engagement-strip";
import { buildLocalizedHref } from "@/modules/site/i18n";
import type {
  HomePageData,
  LocalizedHomeFeedItem,
  LocalizedHomeFeedSection,
  SiteLanguage,
} from "@/types/site";

const { Paragraph, Text, Title } = Typography;

const techTopics = [
  "AI Agent",
  "Codex",
  "Claude Code",
  "OpenCode",
  "Skills",
  "Ollama",
  "TensorFlow",
  "PyTorch",
  "Scikit-learn",
  "Machine Learning",
  "LangChain",
  "NLP",
  "OpenCV",
  "Selenium",
];

function renderMetric(item: LocalizedHomeFeedItem, lang: SiteLanguage) {
  if (item.kind !== "GITHUB") {
    return (
      <span className="home-feed-card__metric">
        {lang === "zh" ? "热度" : "Heat"} {Math.round(item.heatScore)}
      </span>
    );
  }

  const stars = item.metrics?.githubStars ?? 0;
  const forks = item.metrics?.githubForks ?? 0;
  const delta = item.metrics?.githubStarDelta30d ?? 0;

  return (
    <span className="home-feed-card__metric">
      Star {stars.toLocaleString()} / Fork {forks.toLocaleString()} / +30d {delta.toLocaleString()}
    </span>
  );
}

function FeedSection({
  section,
  lang,
}: {
  section: LocalizedHomeFeedSection;
  lang: SiteLanguage;
}) {
  const items = section.items;
  const [page, setPage] = useState(0);
  const itemsPerPage = 5;
  const totalPages = Math.max(1, Math.ceil(items.length / itemsPerPage));
  const safePage = Math.min(page, totalPages - 1);
  const pageItems = items.slice(safePage * itemsPerPage, safePage * itemsPerPage + itemsPerPage);

  return (
    <section className="home-feed-section">
      <div className="home-feed-section__header">
        <div className="home-feed-section__title">
          <span className="site-kicker">{section.title}</span>
          <Title level={2} style={{ margin: 0 }}>
            {section.title}
          </Title>
        </div>
        <div className="home-feed-section__toolbar">
          <Text className="home-feed-section__updated">
            {lang === "zh" ? "更新于" : "Updated"} {section.updatedAt.slice(0, 10)}
          </Text>
          <div className="home-feed-section__pager">
            <button
              type="button"
              className="home-feed-section__pager-button"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              aria-label={lang === "zh" ? "上一页" : "Previous page"}
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
              onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              aria-label={lang === "zh" ? "下一页" : "Next page"}
            >
              ▶
            </button>
          </div>
        </div>
      </div>

      <div className="home-feed-list home-feed-list--stacked">
        {pageItems.map((item, index) => {
          const order = safePage * itemsPerPage + index + 1;
          return (
            <a
              key={item.id}
              href={item.externalUrl}
              target="_blank"
              rel="noreferrer"
              className="home-feed-list-item"
            >
              <div className="home-feed-list-item__index">{String(order).padStart(2, "0")}</div>
              <div className="home-feed-list-item__body">
                <Title level={4} style={{ margin: 0 }}>
                  {item.title}
                </Title>
                <Paragraph style={{ margin: 0, color: "var(--muted)", lineHeight: 1.75 }}>
                  {item.summary}
                </Paragraph>
                <div className="home-feed-list-item__meta">
                  <span className="hero-route-card__meta">{item.sourceName}</span>
                  <span>{item.publishedAt.slice(0, 10)}</span>
                  <div className="home-feed-tags">
                    {item.tags.slice(0, 4).map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              </div>
              <div className="home-feed-list-item__metric">
                {renderMetric(item, lang)}
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
}

export function HomePageContent({
  data,
  lang,
}: {
  data: HomePageData;
  lang: SiteLanguage;
}) {
  const guideSteps = [
    lang === "zh" ? "先看站点入口" : "Start from the site entry",
    lang === "zh" ? "需要文件就去下载" : "Go to downloads for files",
    lang === "zh" ? "需要教程就去文档" : "Go to docs for guides",
  ];

  return (
    <Space direction="vertical" size={40} className="public-stack" style={{ width: "100%" }}>
      <section className="home-hero">
        <div className="home-hero__copy">
          <span className="site-kicker">{data.eyebrow}</span>
          <Title
            style={{ margin: 0, maxWidth: 980, fontSize: "clamp(52px, 7vw, 96px)", lineHeight: 0.94 }}
          >
            {data.title}
          </Title>
          <Paragraph
            style={{ maxWidth: 900, margin: 0, fontSize: 18, lineHeight: 1.9, color: "var(--muted)" }}
          >
            {data.summary}
          </Paragraph>
          <div className="home-hero__workflow">
            {guideSteps.map((item, index) => (
              <div key={item} className="home-hero__workflow-item">
                <Text className="home-hero__workflow-index">{String(index + 1).padStart(2, "0")}</Text>
                <Text>{item}</Text>
              </div>
            ))}
          </div>
          <HomeEngagementStrip lang={lang} />
          <Space size={12} wrap className="home-hero__actions">
            <Link href={buildLocalizedHref("/downloads", lang)}>
              <Button type="primary" size="large">
                {data.primaryActionLabel}
              </Button>
            </Link>
            <Link href={buildLocalizedHref("/docs", lang)}>
              <Button size="large">{data.secondaryActionLabel}</Button>
            </Link>
          </Space>
        </div>
      </section>

      <section className="tech-marquee" aria-label={lang === "zh" ? "技术主题" : "Tech topics"}>
        <div className="tech-marquee__track">
          {[...techTopics, ...techTopics].map((topic, index) => (
            <div key={`${topic}-${index}`} className="tech-marquee__item">
              <span className="tech-marquee__dot" />
              <span>{topic}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="section-band section-band--wide">
        <div className="section-split">
          <div className="section-heading">
            <span className="site-kicker">{lang === "zh" ? "首页内容" : "Homepage Feed"}</span>
            <Title level={2} style={{ margin: 0 }}>
              {lang === "zh" ? "AI 资讯、技术和热门仓库" : "AI news, tech, and repositories"}
            </Title>
          </div>
          <Paragraph className="section-rail-copy" style={{ margin: 0 }}>
            {lang === "zh"
              ? `当前快照日期 ${data.feedGeneratedAt}，资讯与技术按周更新，GitHub 项目按月更新。`
              : `Snapshot date ${data.feedGeneratedAt}; news and tech update weekly, GitHub monthly.`}
          </Paragraph>
        </div>

        <div className="home-feed-stack">
          {data.feedSections.map((section) => (
            <FeedSection key={section.key} section={section} lang={lang} />
          ))}
        </div>
      </section>
    </Space>
  );
}
