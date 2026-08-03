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
}: {
  title: string;
}) {
  return (
    <div className="launch-heading">
      <h2>{title}</h2>
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
      ? ["知识库", "Agent", "工作流", "视觉 AI"]
      : ["Knowledge", "Agent", "Workflow", "Vision AI"];

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
  const logos = content.trustedLogos.slice(0, 5);

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
            <LaunchButton href={workosConsoleUrl} variant="secondary">
              {text(content.home.secondaryCta, lang)}
            </LaunchButton>
          </div>
        </div>
        <HeroMockup lang={lang} />
      </LaunchSection>

      <LaunchSection className="launch-logos">
        <div className="launch-badge launch-badge--quiet">
          {isZh ? "适用场景" : "Scenario fit"}
        </div>
        <h2>{isZh ? "面向企业、教育、科研与设计团队" : "For business, education, research and design teams"}</h2>
        <div className="launch-logo-row">
          {logos.map((item) => (
            <span key={item.id}>{text(item.name, lang)}</span>
          ))}
        </div>
      </LaunchSection>

      <LaunchSection>
        <LaunchHeading
          title={isZh ? "需要的能力，保持简单" : "Everything needed. Nothing extra."}
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

      <LaunchSection className="launch-cta">
        <h2>{isZh ? "开始部署 QiuAI WorkOS" : "Start with QiuAI WorkOS"}</h2>
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
      eyebrow="Projects"
      title={isZh ? "项目" : "Projects"}
      summary={isZh ? "用产品视角展示可复用能力。" : "Reusable product capabilities."}
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
      title={isZh ? "案例库" : "Case studies"}
      summary={isZh ? "用短案例说明 AI 如何进入业务。" : "Short cases showing AI in real workflows."}
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
      eyebrow="Open Source"
      title={isZh ? "开源项目" : "Open source"}
      summary={isZh ? "展示公开工程作品。" : "Public engineering work."}
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
      title={isZh ? "服务" : "Services"}
      summary={isZh ? "可以独立交付，也可以长期合作。" : "Standalone delivery or long-term collaboration."}
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
