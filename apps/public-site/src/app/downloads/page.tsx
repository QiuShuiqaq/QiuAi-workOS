import Link from "next/link";

import { getDownloadItems } from "@/lib/downloads";

export default async function DownloadsPage() {
  const items = await getDownloadItems();

  return (
    <main>
      <section className="page-hero">
        <span className="eyebrow">Download Center</span>
        <h1>下载 QiuAI WorkOS</h1>
        <p>
          这里维护正式发布给用户的客户端安装包。发布新版本时，请同步 GitHub
          Release 的 tag 和安装包文件名。
        </p>
      </section>

      <section className="section">
        <div className="download-list">
          {items.map((item) => (
            <article className="download-item" key={item.slug}>
              <div>
                <span className="download-platform">
                  {item.platformZh} · {item.formatZh}
                </span>
                <h2>{item.titleZh}</h2>
                <p>{item.summaryZh}</p>
                <dl>
                  <div>
                    <dt>版本</dt>
                    <dd>{item.version}</dd>
                  </div>
                  <div>
                    <dt>文件名</dt>
                    <dd>{item.appAssetName}</dd>
                  </div>
                  <div>
                    <dt>更新日期</dt>
                    <dd>{item.updatedAt}</dd>
                  </div>
                </dl>
                <ul>
                  {item.notesZh.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
              <div className="download-actions">
                <a
                  className="button button-primary"
                  href={`/api/download-items/${item.slug}/download`}
                >
                  下载客户端
                </a>
                <a
                  className="button button-secondary"
                  href={`https://github.com/${item.githubRepo}/releases/tag/${item.releaseTag}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看 Release
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section note-section">
        <h2>下载页维护方式</h2>
        <p>
          当前下载配置由主仓库的{" "}
          <code>apps/public-site/data/download-items.json</code>{" "}
          维护。正式发布安装包后，确保
          <code>githubRepo</code>、<code>releaseTag</code> 和{" "}
          <code>appAssetName</code> 与 GitHub Release 完全一致。
        </p>
        <Link href="/docs">查看安装与发布说明</Link>
      </section>
    </main>
  );
}
