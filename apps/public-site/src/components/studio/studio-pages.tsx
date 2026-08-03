import Link from "next/link";
import type { ReactNode } from "react";

import type { SiteLanguage } from "@/types/site";
import type {
  StudioCaseStudy,
  StudioContent,
  StudioLocalizedText,
  StudioOpenSourceProject,
  StudioProject,
  StudioService,
  StudioSolution,
  StudioTeamMember,
} from "@/types/studio";
import { readStudioText } from "@/types/studio";

const workosConsoleUrl = process.env.NEXT_PUBLIC_WORKOS_CONSOLE_URL?.trim() || "https://workos.qiuaihub.com";

function localizedHref(pathname: string, lang: SiteLanguage) {
  return `${pathname}?${new URLSearchParams({ lang }).toString()}`;
}

function text(value: StudioLocalizedText, lang: SiteLanguage) {
  return readStudioText(value, lang);
}

function compactText(value: StudioLocalizedText, lang: SiteLanguage, zhLength = 34, enLength = 86) {
  const source = text(value, lang).trim();
  const maxLength = lang === "zh" ? zhLength : enLength;

  if (source.length <= maxLength) {
    return source;
  }

  return `${source.slice(0, maxLength).replace(/[，,。.\s]+$/u, "")}…`;
}

function Tags({ tags }: { tags: string[] }) {
  if (!tags.length) {
    return null;
  }

  return (
    <div className="studio-tags" aria-label="Tags">
      {tags.slice(0, 3).map((tag) => (
        <span key={tag}>{tag}</span>
      ))}
    </div>
  );
}

function LaunchButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  return (
    <Link className={`launch-button launch-button--${variant}`} href={href}>
      {children}
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function LaunchSection({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const isHero = className.split(" ").includes("launch-hero");

  return (
    <section className={`launch-section${isHero ? " launch-section--hero" : ""}`}>
      <div className={`launch-section__inner ${className}`}>{children}</div>
    </section>
  );
}

function LaunchHeading({
  title,
  summary,
}: {
  title: string;
  summary?: string;
}) {
  return (
    <div className="launch-heading">
      <h2>{title}</h2>
      {summary ? <p>{summary}</p> : null}
    </div>
  );
}

function LaunchItemIcon({ item }: { item: StudioSolution }) {
  const label = item.iconKey.slice(0, 2).toUpperCase();

  return (
    <span className="launch-item__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M5 12h14" />
        <path d="M12 5v14" />
        <circle cx="12" cy="12" r="8" />
      </svg>
      <span>{label}</span>
    </span>
  );
}

function HeroMockup({ lang }: { lang: SiteLanguage }) {
  const labels =
    lang === "zh"
      ? ["数字市场", "数字员工", "数字工厂", "模型配置", "知识库", "输出队列"]
      : ["Marketplace", "Workers", "Factories", "Models", "Knowledge", "Outputs"];

  return (
    <div className="launch-mockup-frame" aria-hidden="true">
      <div className="launch-mockup">
        <div className="launch-mockup__bar">
          <span />
          <span />
          <span />
        </div>
        <div className="launch-mockup__body">
          <div className="launch-mockup__sidebar">
            {labels.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
          <div className="launch-mockup__main">
            <div className="launch-mockup__hero" />
            <div className="launch-mockup__grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
      <div className="launch-glow" />
    </div>
  );
}

function StudioIndexHero({ eyebrow, title, summary }: { eyebrow: string; title: string; summary: string }) {
  return (
    <LaunchSection className="launch-page-hero">
      <span className="launch-badge">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{summary}</p>
    </LaunchSection>
  );
}

function ProjectCard({ project, lang }: { project: StudioProject; lang: SiteLanguage }) {
  return (
    <Link className="launch-card launch-card--link" href={localizedHref(`/projects/${project.slug}`, lang)}>
      <div className="launch-card__meta">
        <span>{text(project.status, lang)}</span>
        <span>{project.techStack.slice(0, 2).join(" / ")}</span>
      </div>
      <h3>{text(project.title, lang)}</h3>
      <p>{compactText(project.summary, lang)}</p>
      <Tags tags={project.tags} />
    </Link>
  );
}

function CaseCard({ item, lang }: { item: StudioCaseStudy; lang: SiteLanguage }) {
  return (
    <Link className="launch-card launch-card--link" href={localizedHref(`/case-studies/${item.slug}`, lang)}>
      <div className="launch-card__meta">
        <span>{text(item.industry, lang)}</span>
        {item.isAnonymized ? <span>{lang === "zh" ? "匿名" : "Anonymized"}</span> : null}
      </div>
      <h3>{text(item.title, lang)}</h3>
      <p>{compactText(item.businessValue, lang)}</p>
      <Tags tags={item.tags} />
    </Link>
  );
}

function DetailSection({ title, body }: { title: string; body: string }) {
  return (
    <section className="launch-detail-section">
      <h2>{title}</h2>
      <p>{body}</p>
    </section>
  );
}

function ListPageLayout({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="launch-page">
      <StudioIndexHero eyebrow={eyebrow} title={title} summary={summary} />
      {children}
    </main>
  );
}

export function StudioHomePage({ content, lang }: { content: StudioContent; lang: SiteLanguage }) {
  const isZh = lang === "zh";
  const featureItems = content.solutions.slice(0, 8);
  const logos = content.trustedLogos.slice(0, 6);
  const caseItems = content.caseStudies.slice(0, 3);
  const serviceItems = content.services.slice(0, 4);
  const scenarioItems = [
    {
      title: isZh ? "办公资料整理" : "Office material processing",
      summary: isZh
        ? "把文档、表格、会议记录和业务资料整理成 Word、Excel 或清单，减少重复办公。"
        : "Turn documents, spreadsheets, meeting notes, and business materials into Word files, Excel sheets, and clean checklists.",
      tags: ["Office", "Word", "Excel"],
    },
    {
      title: isZh ? "企业知识应用" : "Enterprise knowledge use",
      summary: isZh
        ? "把企业 PDF 知识库同步到设备，让数字员工结合产品、制度、话术和 FAQ 输出结果。"
        : "Sync enterprise PDF knowledge to devices so workers can use product, policy, script, and FAQ context.",
      tags: ["Knowledge", "PDF", "RAG"],
    },
    {
      title: isZh ? "跨境商品图生产" : "Cross-border product images",
      summary: isZh
        ? "上传商品参考图，批量生成主图、白底图、尺寸图、场景图、换背景和换模特素材。"
        : "Upload product references and batch-generate main images, white-background images, size charts, scenes, background changes, and model changes.",
      tags: ["Commerce", "Image", "Batch"],
    },
    {
      title: isZh ? "视频质检剪辑" : "Video QA and rough cuts",
      summary: isZh
        ? "批量筛选视频，结合 ASR 转写和规则判断质量，输出合格视频清单和可选初剪产物。"
        : "Screen videos in batches, combine ASR transcripts with rules, and output qualified lists plus optional rough cuts.",
      tags: ["Video", "ASR", "Factory"],
    },
    {
      title: isZh ? "企业岗位辅助" : "Role-based business assistance",
      summary: isZh
        ? "面向销售、客服、人事、法务、项目等岗位，生成可复核的表格、报告、话术和行动清单。"
        : "Support sales, service, HR, legal, and project roles with reviewable sheets, reports, scripts, and action lists.",
      tags: ["Worker", "Business", "Review"],
    },
  ];

  return (
    <main className="launch-page launch-page--home">
      <LaunchSection className="launch-hero">
        <div className="launch-hero__copy">
          <div className="launch-badge">
            <span>{text(content.home.eyebrow, lang)}</span>
            <Link href={localizedHref("/downloads", lang)}>{isZh ? "下载客户端" : "Download"} →</Link>
          </div>
          <h1>{text(content.home.title, lang)}</h1>
          <p>{text(content.home.subtitle, lang)}</p>
          <div className="launch-actions">
            <LaunchButton href={localizedHref("/downloads", lang)}>{text(content.home.primaryCta, lang)}</LaunchButton>
            <LaunchButton href={localizedHref("/services", lang)} variant="secondary">
              {text(content.home.secondaryCta, lang)}
            </LaunchButton>
            <LaunchButton href={workosConsoleUrl} variant="secondary">
              {text(content.home.tertiaryCta, lang)}
            </LaunchButton>
          </div>
        </div>
        <HeroMockup lang={lang} />
      </LaunchSection>

      <LaunchSection className="launch-audience">
        <div className="launch-badge launch-badge--quiet">
          {isZh ? "面向企业团队" : "Built for enterprise teams"}
        </div>
        <h2>{isZh ? "适合有本地文件、批量任务、企业知识库和部门协作需求的团队" : "For teams with local files, batch work, enterprise knowledge, and cross-department workflows"}</h2>
        <div className="launch-audience-grid">
          {logos.map((item) => (
            <article key={item.id} className="launch-audience-item">
              <strong>{text(item.name, lang)}</strong>
              <span>{text(item.category, lang)}</span>
            </article>
          ))}
        </div>
      </LaunchSection>

      <LaunchSection>
        <LaunchHeading
          title={isZh ? "企业可以直接落地的 AI 应用场景" : "AI scenarios companies can use directly"}
          summary={
            isZh
              ? "围绕办公资料、企业知识、商品图片、视频素材和岗位协作，把 AI 能力放进可执行的企业场景。"
              : "Apply AI to executable enterprise scenarios across office materials, knowledge, product images, video assets, and role-based collaboration."
          }
        />
        <div className="launch-card-grid">
          {scenarioItems.map((item) => (
            <article className="launch-card" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.summary}</p>
              <Tags tags={item.tags} />
            </article>
          ))}
        </div>
      </LaunchSection>

      <LaunchSection>
        <LaunchHeading
          title={isZh ? "从模型配置到稳定产物，能力收在一套系统里" : "From model setup to reliable artifacts in one system"}
          summary={
            isZh
              ? "QiuAI WorkOS 不只提供聊天入口，而是把模型、知识库、工具、日志和交付文件放进同一套工作系统。"
              : "QiuAI WorkOS is not just a chat entry point; it connects models, knowledge, tools, logs, and deliverable files."
          }
        />
        <div className="launch-item-grid">
          {featureItems.map((item) => (
            <article className="launch-item" key={item.id}>
              <div className="launch-item__title">
                <LaunchItemIcon item={item} />
                <h3>{text(item.title, lang)}</h3>
              </div>
              <p>{compactText(item.summary, lang)}</p>
            </article>
          ))}
        </div>
      </LaunchSection>

      <LaunchSection className="launch-stats">
        {content.metrics.slice(0, 4).map((metric) => (
          <div key={metric.id} className="launch-stat">
            <span>{text(metric.label, lang)}</span>
            <strong>{metric.value}</strong>
            <p>{text(metric.note, lang)}</p>
          </div>
        ))}
      </LaunchSection>

      <LaunchSection>
        <LaunchHeading
          title={isZh ? "已经沉淀的行业场景" : "Practical scenarios already shaped"}
          summary={
            isZh
              ? "从已落地和已验证的场景开始，展示数字员工与数字工厂在真实业务中的使用方式。"
              : "Start from shaped and validated scenarios to show how digital workers and factories support real work."
          }
        />
        <div className="launch-card-grid">
          {caseItems.map((item) => (
            <CaseCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
        <div className="launch-section-actions">
          <LaunchButton href={localizedHref("/case-studies", lang)} variant="secondary">
            {isZh ? "查看行业案例" : "View cases"}
          </LaunchButton>
        </div>
      </LaunchSection>

      <LaunchSection>
        <LaunchHeading
          title={isZh ? "企业 AI 升级可以从这几件事开始" : "Start enterprise AI upgrades from these services"}
          summary={
            isZh
              ? "如果企业需要部署、搭建数字员工、落地数字工厂或整理知识库，可以先从企业服务入口沟通。"
              : "For deployment, worker setup, factory rollout, or knowledge-base work, start from the enterprise services entry."
          }
        />
        <div className="launch-card-grid">
          {serviceItems.map((service) => (
            <article key={service.id} className="launch-card">
              <h3>{text(service.title, lang)}</h3>
              <p>{compactText(service.summary, lang)}</p>
              <Tags tags={service.tags} />
            </article>
          ))}
        </div>
        <div className="launch-section-actions">
          <LaunchButton href={localizedHref("/services", lang)} variant="secondary">
            {isZh ? "了解企业服务" : "Explore services"}
          </LaunchButton>
        </div>
      </LaunchSection>

      <LaunchSection className="launch-cta">
        <h2>{isZh ? "安装桌面端，开始把 AI 接入企业真实工作" : "Install the desktop client and bring AI into real work"}</h2>
        <LaunchButton href={localizedHref("/downloads", lang)}>{isZh ? "下载客户端" : "Download client"}</LaunchButton>
        <div className="launch-glow" />
      </LaunchSection>
    </main>
  );
}

export function StudioProjectsPage({ projects, lang }: { projects: StudioProject[]; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout
      eyebrow="Product"
      title={isZh ? "产品能力" : "Product capabilities"}
      summary={isZh ? "围绕桌面端、数字员工、数字工厂、模型配置和知识库组织能力。" : "Capabilities around the desktop client, digital workers, digital factories, model setup, and knowledge bases."}
    >
      <LaunchSection>
        <div className="launch-card-grid">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} lang={lang} />
          ))}
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}

export function StudioProjectDetailPage({ project, lang }: { project: StudioProject; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <main className="launch-page">
      <StudioIndexHero eyebrow={text(project.status, lang)} title={text(project.title, lang)} summary={text(project.subtitle, lang)} />
      <LaunchSection className="launch-detail">
        <aside>
          <h2>{isZh ? "技术栈" : "Tech stack"}</h2>
          <Tags tags={project.techStack} />
        </aside>
        <div>
          <DetailSection title={isZh ? "背景" : "Background"} body={text(project.summary, lang)} />
          <DetailSection title={isZh ? "问题" : "Problem"} body={text(project.problem, lang)} />
          <DetailSection title={isZh ? "价值" : "Value"} body={text(project.value, lang)} />
          <DetailSection title={isZh ? "架构" : "Architecture"} body={text(project.architecture, lang)} />
        </div>
      </LaunchSection>
    </main>
  );
}

export function StudioCaseStudiesPage({ caseStudies, lang }: { caseStudies: StudioCaseStudy[]; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout
      eyebrow="Case Studies"
      title={isZh ? "行业案例" : "Industry cases"}
      summary={isZh ? "优先展示已经适合企业使用的数字员工和数字工厂场景。" : "Practical digital worker and digital factory scenarios for enterprise teams."}
    >
      <LaunchSection>
        <div className="launch-card-grid">
          {caseStudies.map((item) => (
            <CaseCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}

export function StudioCaseStudyDetailPage({ item, lang }: { item: StudioCaseStudy; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <main className="launch-page">
      <StudioIndexHero eyebrow={text(item.industry, lang)} title={text(item.title, lang)} summary={text(item.background, lang)} />
      <LaunchSection className="launch-detail">
        <aside>
          <h2>{isZh ? "标签" : "Tags"}</h2>
          <Tags tags={item.tags} />
        </aside>
        <div>
          <DetailSection title={isZh ? "痛点" : "Pain points"} body={item.painPoints.map((point) => text(point, lang)).join(" / ")} />
          <DetailSection title={isZh ? "方案" : "Solution"} body={text(item.solution, lang)} />
          <DetailSection title={isZh ? "架构" : "Architecture"} body={text(item.architecture, lang)} />
          <DetailSection title={isZh ? "价值" : "Business value"} body={text(item.businessValue, lang)} />
        </div>
      </LaunchSection>
    </main>
  );
}

export function StudioOpenSourcePage({
  items,
  lang,
}: {
  items: StudioOpenSourceProject[];
  lang: SiteLanguage;
}) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout
      eyebrow="Engineering"
      title={isZh ? "工程底座" : "Engineering foundation"}
      summary={isZh ? "记录 WorkOS 相关的产品化平台、桌面端和模型接入工程。" : "Engineering notes around the WorkOS platform, desktop client, and model integration."}
    >
      <LaunchSection>
        <div className="launch-card-grid">
          {items.map((item) => (
            <a key={item.id} className="launch-card launch-card--link" href={item.githubUrl} target="_blank" rel="noreferrer">
              <div className="launch-card__meta">
                <span>{text(item.status, lang)}</span>
                <span>{item.starsLabel}</span>
              </div>
              <h3>{item.name}</h3>
              <p>{compactText(item.summary, lang)}</p>
              <Tags tags={item.tags} />
            </a>
          ))}
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}

export function StudioServicesPage({ services, lang }: { services: StudioService[]; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout
      eyebrow="Services"
      title={isZh ? "企业服务" : "Enterprise services"}
      summary={isZh ? "围绕 WorkOS 的部署、数字员工搭建、数字工厂落地和企业知识库整理提供支持。" : "Support for WorkOS deployment, digital worker setup, digital factory rollout, and enterprise knowledge bases."}
    >
      <LaunchSection>
        <div className="launch-card-grid">
          {services.map((service) => (
            <article key={service.id} className="launch-card">
              <h3>{text(service.title, lang)}</h3>
              <p>{compactText(service.summary, lang)}</p>
              <Tags tags={service.tags} />
            </article>
          ))}
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}

export function StudioTeamPage({ team, lang }: { team: StudioTeamMember[]; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout
      eyebrow="Team"
      title={isZh ? "团队" : "Team"}
      summary={isZh ? "按项目目标组织 AI 产品、工程与交付能力。" : "Project-based AI product, engineering, and delivery capability."}
    >
      <LaunchSection>
        <div className="launch-card-grid">
          {team.map((member) => (
            <article key={member.id} className="launch-card launch-team-card">
              <div className="launch-team-card__avatar" aria-hidden="true">
                {text(member.name, lang).slice(0, 1)}
              </div>
              <div className="launch-card__meta">
                <span>{text(member.role, lang)}</span>
              </div>
              <h3>{text(member.name, lang)}</h3>
              <p>{compactText(member.summary, lang)}</p>
              {member.links.length ? (
                <div className="launch-team-card__links">
                  {member.links.slice(0, 3).map((link) => (
                    <a key={link.href} href={link.href} target="_blank" rel="noreferrer">
                      {link.label}
                    </a>
                  ))}
                </div>
              ) : null}
              <Tags tags={member.tags} />
            </article>
          ))}
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}

export function StudioAboutPage({ content, lang }: { content: StudioContent; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout eyebrow="About" title={text(content.about.title, lang)} summary={text(content.about.summary, lang)}>
      <LaunchSection>
        <div className="launch-card-grid">
          <article className="launch-card">
            <h3>{isZh ? "方向" : "Focus"}</h3>
            <p>{content.about.focusAreas.map((item) => text(item, lang)).slice(0, 3).join(" / ")}</p>
          </article>
          <article className="launch-card">
            <h3>{isZh ? "能力" : "Capabilities"}</h3>
            <p>{content.about.capabilities.map((item) => text(item, lang)).slice(0, 3).join(" / ")}</p>
          </article>
          <article className="launch-card">
            <h3>{isZh ? "技术栈" : "Stack"}</h3>
            <Tags tags={content.about.stack.slice(0, 6)} />
          </article>
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}

export function StudioContactPage({ content, lang }: { content: StudioContent; lang: SiteLanguage }) {
  const isZh = lang === "zh";

  return (
    <ListPageLayout eyebrow="Contact" title={text(content.contact.title, lang)} summary={text(content.contact.summary, lang)}>
      <LaunchSection>
        <div className="launch-card-grid">
          <article className="launch-card">
            <h3>Email</h3>
            {content.contact.emails.map((item) => (
              <a key={item.value} className="studio-contact-link" href={`mailto:${item.value}`}>
                {item.label}: {item.value}
              </a>
            ))}
          </article>
          <article className="launch-card">
            <h3>{isZh ? "链接" : "Links"}</h3>
            {content.contact.links.map((item) => (
              <a key={item.href} className="studio-contact-link" href={item.href} target="_blank" rel="noreferrer">
                {item.label}
              </a>
            ))}
          </article>
        </div>
      </LaunchSection>
    </ListPageLayout>
  );
}
