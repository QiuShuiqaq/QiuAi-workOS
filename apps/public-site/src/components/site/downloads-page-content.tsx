"use client";

import { FileProtectOutlined, LaptopOutlined } from "@ant-design/icons";
import { Empty, Space, Typography } from "antd";

import { ResourceDownloadButton } from "@/components/site/resource-download-button";
import type { DownloadsPageData, SiteLanguage } from "@/types/site";

const { Paragraph, Text, Title } = Typography;

export function DownloadsPageContent({
  data,
  lang,
}: {
  data: DownloadsPageData;
  lang: SiteLanguage;
}) {
  return (
    <Space direction="vertical" size={28} className="public-stack public-stack--compact" style={{ width: "100%" }}>
      <section className="simple-page-hero">
        <span className="site-kicker">{data.eyebrow}</span>
        <Title style={{ margin: 0 }}>{data.title}</Title>
        <Paragraph>{data.summary}</Paragraph>
      </section>

      <section className="simple-section">
        <div className="simple-section__header">
          <div>
            <span className="site-kicker">{lang === "zh" ? "安装包" : "Installers"}</span>
            <Title level={2} style={{ margin: "10px 0 0" }}>
              {lang === "zh" ? "可下载文件" : "Available Downloads"}
            </Title>
          </div>
          <Text className="simple-section__hint">
            {lang === "zh" ? "安装包由后台统一维护，选择需要的版本下载即可。" : "Installers are maintained centrally. Download the version you need."}
          </Text>
        </div>

        {data.items.length ? (
          <div className="installer-list">
            {data.items.map((item) => (
              <article key={item.slug} className="installer-row">
                <div className="installer-row__icon" aria-hidden="true">
                  {item.platform.toLowerCase().includes("windows") ? <LaptopOutlined /> : <FileProtectOutlined />}
                </div>
                <div className="installer-row__main">
                  <div className="installer-row__title-line">
                    <Title level={4} style={{ margin: 0 }}>
                      {item.title}
                    </Title>
                    <Text className="installer-row__file">{item.fileName}</Text>
                  </div>
                  <div className="installer-row__meta" aria-label={lang === "zh" ? "安装包信息" : "Installer metadata"}>
                    <Text>{item.platform}</Text>
                    <Text>{item.format}</Text>
                    <Text>{item.version}</Text>
                    <Text>{item.fileSize}</Text>
                    <Text>{item.updatedAt}</Text>
                  </div>
                  {item.notes.length ? (
                    <Paragraph className="installer-row__note">
                      {item.notes.slice(0, 2).join(lang === "zh" ? " " : " ")}
                    </Paragraph>
                  ) : null}
                </div>
                <div className="installer-row__action">
                  <ResourceDownloadButton href={item.downloadPath} lang={lang} disabled={!item.downloadPath} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty description={lang === "zh" ? "暂无可下载安装包" : "No installers are available"} />
        )}
      </section>
    </Space>
  );
}
