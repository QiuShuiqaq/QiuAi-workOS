import Link from "next/link";

import {
  factoryExamples,
  productMetrics,
  productPillars,
  workosConsoleUrl,
} from "@/lib/site-data";

export default function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">QiuAI WorkOS</span>
          <h1>企业 AI 数字员工与数字工厂工作系统</h1>
          <p>
            把数字员工、数字工厂、企业知识库、模型配置和桌面端本地工具整合到一套可安装、可管理、可交付产物的工作系统里。
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/downloads">
              下载 Windows 客户端
            </Link>
            <a className="button button-secondary" href={workosConsoleUrl}>
              进入企业控制台
            </a>
          </div>
        </div>
        <div className="product-shot" aria-label="QiuAI WorkOS 产品界面示意">
          <div className="product-shot-top">
            <span />
            <span />
            <span />
            <strong>数字市场</strong>
          </div>
          <div className="product-shot-body">
            <aside>
              <span className="active">数字员工</span>
              <span>数字工厂</span>
              <span>模型配置</span>
              <span>知识库</span>
            </aside>
            <section>
              <div className="task-row">
                <strong>跨境商品图工厂</strong>
                <small>图片产物 7 组 · 并发处理</small>
              </div>
              <div className="progress-line">
                <span />
              </div>
              <div className="output-grid">
                <span>主图</span>
                <span>白底图</span>
                <span>尺寸图</span>
                <span>场景图</span>
              </div>
              <div className="log-row">
                模型状态正常 · 输出队列可审查 · 产物可定位
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="metric-band">
        {productMetrics.map((metric) => (
          <article key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <p>{metric.note}</p>
          </article>
        ))}
      </section>

      <section className="section">
        <div className="section-heading">
          <span className="eyebrow">Product Structure</span>
          <h2>把企业 AI 使用链路收束成四个清晰入口</h2>
        </div>
        <div className="pillar-grid">
          {productPillars.map((pillar) => (
            <article className="pillar" key={pillar.title}>
              <h3>{pillar.title}</h3>
              <p>{pillar.summary}</p>
              <ul>
                {pillar.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="section split-section">
        <div>
          <span className="eyebrow">Digital Factory</span>
          <h2>第一批数字工厂聚焦真实企业批量工作</h2>
          <p>
            数字工厂不是聊天界面，而是面向上传、参数、队列、输出物、日志和人工复核的生产界面，适合复杂、批量、可审查的企业任务。
          </p>
        </div>
        <div className="factory-list">
          {factoryExamples.map((factory) => (
            <article key={factory.name}>
              <strong>{factory.name}</strong>
              <span>{factory.audience}</span>
              <p>{factory.output}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <div>
          <h2>准备把 QiuAI WorkOS 接入你的企业流程</h2>
          <p>
            从 Windows
            客户端开始，完成账号、企业、模型和知识库配置后，即可安装数字员工和数字工厂。
          </p>
        </div>
        <Link className="button button-primary" href="/downloads">
          获取安装包
        </Link>
      </section>
    </main>
  );
}
