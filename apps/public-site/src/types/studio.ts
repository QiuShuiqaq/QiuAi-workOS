import type { SiteLanguage } from "@/types/site";

export interface StudioLocalizedText {
  zh: string;
  en: string;
}

export interface StudioBaseRecord {
  id: string;
  sortOrder: number;
  isVisible: boolean;
  updatedAt: string;
}

export interface StudioHomeContent {
  eyebrow: StudioLocalizedText;
  title: StudioLocalizedText;
  subtitle: StudioLocalizedText;
  primaryCta: StudioLocalizedText;
  secondaryCta: StudioLocalizedText;
  tertiaryCta: StudioLocalizedText;
}

export interface StudioMetric extends StudioBaseRecord {
  label: StudioLocalizedText;
  value: string;
  note: StudioLocalizedText;
}

export interface StudioTrustedLogo extends StudioBaseRecord {
  name: StudioLocalizedText;
  category: StudioLocalizedText;
}

export interface StudioSolution extends StudioBaseRecord {
  iconKey: string;
  title: StudioLocalizedText;
  summary: StudioLocalizedText;
  problems: StudioLocalizedText[];
  capabilities: StudioLocalizedText[];
  tags: string[];
}

export interface StudioProject extends StudioBaseRecord {
  slug: string;
  title: StudioLocalizedText;
  subtitle: StudioLocalizedText;
  summary: StudioLocalizedText;
  problem: StudioLocalizedText;
  value: StudioLocalizedText;
  architecture: StudioLocalizedText;
  techStack: string[];
  coverImage: string | null;
  screenshots: string[];
  demoUrl: string | null;
  githubUrl: string | null;
  status: StudioLocalizedText;
  tags: string[];
}

export interface StudioCaseStudy extends StudioBaseRecord {
  slug: string;
  title: StudioLocalizedText;
  industry: StudioLocalizedText;
  background: StudioLocalizedText;
  painPoints: StudioLocalizedText[];
  solution: StudioLocalizedText;
  architecture: StudioLocalizedText;
  results: StudioLocalizedText[];
  businessValue: StudioLocalizedText;
  reusableCapabilities: StudioLocalizedText[];
  coverImage: string | null;
  screenshots: string[];
  metrics: StudioMetric[];
  tags: string[];
  isAnonymized: boolean;
}

export interface StudioOpenSourceProject extends StudioBaseRecord {
  slug: string;
  name: string;
  summary: StudioLocalizedText;
  techStack: string[];
  githubUrl: string;
  demoUrl: string | null;
  starsLabel: string;
  latestUpdate: string;
  status: StudioLocalizedText;
  tags: string[];
}

export interface StudioService extends StudioBaseRecord {
  slug: string;
  title: StudioLocalizedText;
  summary: StudioLocalizedText;
  deliverables: StudioLocalizedText[];
  fitFor: StudioLocalizedText[];
  tags: string[];
}

export interface StudioTeamMember extends StudioBaseRecord {
  slug: string;
  name: StudioLocalizedText;
  role: StudioLocalizedText;
  summary: StudioLocalizedText;
  avatarUrl: string | null;
  links: Array<{
    label: string;
    href: string;
  }>;
  tags: string[];
}

export interface StudioAboutContent {
  title: StudioLocalizedText;
  summary: StudioLocalizedText;
  focusAreas: StudioLocalizedText[];
  capabilities: StudioLocalizedText[];
  stack: string[];
  experience: StudioLocalizedText[];
}

export interface StudioContactContent {
  title: StudioLocalizedText;
  summary: StudioLocalizedText;
  emails: Array<{
    label: string;
    value: string;
  }>;
  links: Array<{
    label: string;
    href: string;
  }>;
}

export interface StudioWorkStep extends StudioBaseRecord {
  title: StudioLocalizedText;
  summary: StudioLocalizedText;
}

export interface StudioContent {
  version: number;
  updatedAt: string;
  home: StudioHomeContent;
  metrics: StudioMetric[];
  trustedLogos: StudioTrustedLogo[];
  solutions: StudioSolution[];
  projects: StudioProject[];
  caseStudies: StudioCaseStudy[];
  openSource: StudioOpenSourceProject[];
  services: StudioService[];
  team: StudioTeamMember[];
  workSteps: StudioWorkStep[];
  about: StudioAboutContent;
  contact: StudioContactContent;
}

export type StudioCollectionName =
  | "metrics"
  | "trustedLogos"
  | "solutions"
  | "projects"
  | "caseStudies"
  | "openSource"
  | "services"
  | "team"
  | "workSteps";

export type StudioCollectionItem<TName extends StudioCollectionName> = StudioContent[TName][number];

export function readStudioText(text: StudioLocalizedText, lang: SiteLanguage) {
  return lang === "zh" ? text.zh : text.en;
}
