"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Space, Tag, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";

import { buildLocalizedHref } from "@/modules/site/i18n";
import type { DocsPageData, SiteDocNode, SiteLanguage } from "@/types/site";

const { Paragraph, Text, Title } = Typography;

function toTreeData(nodes: SiteDocNode[], lang: SiteLanguage): DataNode[] {
  return nodes.map((node) => ({
    key: node.slug,
    title: (
      <Link href={buildLocalizedHref("/docs", lang, { doc: node.slug })} style={{ color: "var(--foreground)" }}>
        {node.title}
      </Link>
    ),
    children: node.children ? toTreeData(node.children, lang) : undefined,
  }));
}

function toSectionAnchor(title: string, index: number) {
  return `section-${index + 1}-${title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")}`;
}

export function DocsPageContent({
  data,
  lang,
}: {
  data: DocsPageData;
  lang: SiteLanguage;
}) {
  const articleRef = useRef<HTMLDivElement | null>(null);
  const sectionAnchors = useMemo(
    () =>
      data.activeDoc.sections.map((section, index) => ({
        id: toSectionAnchor(section.title, index),
        title: section.title,
        index,
      })),
    [data.activeDoc.sections],
  );
  const [activeSectionId, setActiveSectionId] = useState(sectionAnchors[0]?.id ?? "");

  useEffect(() => {
    setActiveSectionId(sectionAnchors[0]?.id ?? "");
  }, [data.activeDoc.slug, sectionAnchors]);

  useEffect(() => {
    const container = articleRef.current;
    if (!container || sectionAnchors.length === 0) {
      return;
    }

    const sections = sectionAnchors
      .map(({ id }) => document.getElementById(id))
      .filter((node): node is HTMLElement => node instanceof HTMLElement);

    if (sections.length === 0) {
      return;
    }

    const updateActiveSection = () => {
      const containerRect = container.getBoundingClientRect();
      const current =
        sections.find((section) => {
          const rect = section.getBoundingClientRect();
          return rect.top - containerRect.top <= 120 && rect.bottom - containerRect.top >= 120;
        }) ?? sections[0];

      setActiveSectionId(current.id);
    };

    updateActiveSection();
    container.addEventListener("scroll", updateActiveSection, { passive: true });

    return () => {
      container.removeEventListener("scroll", updateActiveSection);
    };
  }, [sectionAnchors]);

  return (
    <Space direction="vertical" size={40} className="public-stack" style={{ width: "100%" }}>
      <section className="page-hero page-hero--docs">
        <span className="site-kicker">{data.eyebrow}</span>
        <Title style={{ margin: 0, fontSize: "clamp(46px, 5vw, 72px)", lineHeight: 0.96 }}>{data.title}</Title>
        <Paragraph
          style={{ maxWidth: 900, margin: 0, fontSize: 18, lineHeight: 1.8, color: "var(--muted)" }}
        >
          {data.summary}
        </Paragraph>
        <div className="hero-note-row">
          {data.notes.map((note) => (
            <div key={note} className="hero-note-chip">
              <Text>{note}</Text>
            </div>
          ))}
        </div>
      </section>

      <div className="docs-layout docs-layout--three-column">
        <aside className="docs-sidebar docs-sidebar--floating">
          <div className="docs-sidebar-panel docs-sidebar-panel--scrollable">
            <Space direction="vertical" size={18} style={{ width: "100%" }}>
              <div className="section-heading section-heading--narrow docs-sidebar-heading">
                <span className="site-kicker">{lang === "zh" ? "目录" : "Directory"}</span>
              </div>
              <Tree defaultExpandAll selectedKeys={[data.activeDoc.slug]} treeData={toTreeData(data.tree, lang)} />
            </Space>
          </div>
        </aside>

        <section className="docs-main-panel docs-main-panel--shell">
          <div className="section-heading docs-main-panel__heading">
            <span className="site-kicker">{lang === "zh" ? "正文" : "Article"}</span>
            <Title level={2} style={{ margin: 0 }}>
              {data.activeDoc.title}
            </Title>
            <Paragraph style={{ margin: 0, fontSize: 17, lineHeight: 1.85, color: "var(--muted)" }}>
              {data.activeDoc.summary}
            </Paragraph>
          </div>

          <div className="docs-meta-rail">
            {data.activeDoc.tags?.length ? (
              <Space size={[8, 8]} wrap>
                {data.activeDoc.tags.map((tag) => (
                  <Tag key={tag}>{tag}</Tag>
                ))}
              </Space>
            ) : (
              <Text type="secondary">{lang === "zh" ? "当前主题未单独标记标签。" : "This topic has no extra tags."}</Text>
            )}
          </div>

          <div ref={articleRef} className="docs-article-stack docs-article-stack--scrollable">
            {data.activeDoc.sections.map((section, index) => {
              const anchor = sectionAnchors[index]?.id ?? toSectionAnchor(section.title, index);
              const isActive = anchor === activeSectionId;

              return (
                <article
                  key={anchor}
                  id={anchor}
                  className={`doc-section-card docs-section-anchor${isActive ? " docs-section-anchor--active" : ""}`}
                >
                  <div className="docs-section-anchor__eyebrow">
                    <span className="docs-section-anchor__index">{String(index + 1).padStart(2, "0")}</span>
                    <span>{lang === "zh" ? "章节" : "Section"}</span>
                  </div>
                  <Title level={4} style={{ margin: "0 0 12px" }}>
                    {section.title}
                  </Title>
                  <Space direction="vertical" size={10} style={{ width: "100%" }}>
                    {section.body.map((entry) => (
                      <Text key={entry} style={{ color: "var(--muted-strong)", fontSize: 16, lineHeight: 1.95 }}>
                        {entry}
                      </Text>
                    ))}
                  </Space>
                </article>
              );
            })}
          </div>
        </section>

        <aside className="docs-anchors-panel">
          <div className="docs-anchors docs-anchors--floating">
            <Text className="docs-anchors__label">{lang === "zh" ? "本页导航" : "On This Page"}</Text>
            <div className="docs-anchors__list docs-anchors__list--vertical">
              {sectionAnchors.map((section) => {
                const isActive = section.id === activeSectionId;
                return (
                  <button
                    key={section.id}
                    type="button"
                    className={`docs-anchors__item${isActive ? " docs-anchors__item--active" : ""}`}
                    onClick={() => {
                      const target = document.getElementById(section.id);
                      if (target) {
                        target.scrollIntoView({ block: "start", behavior: "smooth" });
                      }
                    }}
                  >
                    {String(section.index + 1).padStart(2, "0")} {section.title}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </Space>
  );
}
