"use client";

import Link from "next/link";
import { Space, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";

import { buildLocalizedHref } from "@/modules/site/i18n";
import type { DocsPageData, SiteDocNode, SiteLanguage } from "@/types/site";

const { Paragraph, Text, Title } = Typography;

function toTreeData(nodes: SiteDocNode[], lang: SiteLanguage): DataNode[] {
  return nodes.map((node) => ({
    key: node.slug,
    title: (
      <Link href={buildLocalizedHref("/guide", lang, { doc: node.slug })} className="guide-tree-link">
        {node.title}
      </Link>
    ),
    children: node.children?.length ? toTreeData(node.children, lang) : undefined,
  }));
}

export function DocsPageContent({
  data,
  lang,
}: {
  data: DocsPageData;
  lang: SiteLanguage;
}) {
  return (
    <Space direction="vertical" size={28} className="public-stack public-stack--compact" style={{ width: "100%" }}>
      <section className="simple-page-hero">
        <span className="site-kicker">{data.eyebrow}</span>
        <Title style={{ margin: 0 }}>{data.title}</Title>
        <Paragraph>{data.summary}</Paragraph>
        <div className="simple-note-row">
          {data.notes.map((note) => (
            <span key={note}>{note}</span>
          ))}
        </div>
      </section>

      <div className="guide-layout">
        <aside className="guide-sidebar">
          <div className="guide-sidebar__inner">
            <Text className="guide-sidebar__label">{lang === "zh" ? "指南目录" : "Guide Menu"}</Text>
            <Tree defaultExpandAll selectedKeys={[data.activeDoc.slug]} treeData={toTreeData(data.tree, lang)} />
          </div>
        </aside>

        <article className="guide-article">
          <header className="guide-article__header">
            <Text className="guide-article__eyebrow">{lang === "zh" ? "当前章节" : "Current Topic"}</Text>
            <Title level={2} style={{ margin: 0 }}>
              {data.activeDoc.title}
            </Title>
            <Paragraph>{data.activeDoc.summary}</Paragraph>
          </header>

          <div className="guide-section-list">
            {data.activeDoc.sections.map((section, index) => (
              <section key={`${section.title}-${index}`} className="guide-section">
                <div className="guide-section__index">{String(index + 1).padStart(2, "0")}</div>
                <div className="guide-section__body">
                  <Title level={4} style={{ margin: 0 }}>
                    {section.title}
                  </Title>
                  <div className="guide-step-list">
                    {section.body.map((entry) => (
                      <Paragraph key={entry}>{entry}</Paragraph>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </Space>
  );
}
