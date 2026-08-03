export type SiteLanguage = "zh" | "en";

export type SiteContentType = "SHOWCASE" | "RESOURCE";
export type SiteManagedContentKey =
  | "DEVELOPER_PROFILE"
  | "HOME_PAGE"
  | "DEMO_PAGE"
  | "RESOURCES_PAGE"
  | "DOCS_PAGE"
  | "SHOWCASE_ITEMS"
  | "RESOURCE_ITEMS"
  | "DOC_ITEMS"
  | "HOME_FEED_SNAPSHOT"
  | "HOME_FEED_SETTINGS"
  | "HOME_FEED_GITHUB_HISTORY";

export interface SiteStatRecord {
  views: number;
  likes: number;
  downloads: number;
}

export interface SiteTrendPoint {
  date: string;
  value: number;
}

export interface HomeEngagementStats {
  views: number;
  likes: number;
  trend: SiteTrendPoint[];
  likedToday: boolean;
}

export interface DownloadStatsMap {
  [slug: string]: number;
}

export interface ManagedDownloadItem {
  id: string;
  slug: string;
  projectName: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  platformZh: string;
  platformEn: string;
  formatZh: string;
  formatEn: string;
  version: string;
  githubRepo: string;
  releaseTag: string;
  appAssetName: string;
  pdfAssetName: string | null;
  appDownloadUrl: string | null;
  pdfDownloadUrl: string | null;
  fileSize: string;
  pdfFileSize: string | null;
  updatedAt: string;
  notesZh: string[];
  notesEn: string[];
  isVisible: boolean;
  sortOrder: number;
}

export interface DownloadAdminItem extends ManagedDownloadItem {
  publicItem: SiteResourceItem;
}

export interface DownloadAdminDraft {
  projectName: string;
  summaryZh: string;
  summaryEn?: string;
  platform: "windows" | "macos" | "linux" | "cross-platform" | "android" | "ios";
  packageType: "exe" | "msi" | "zip" | "dmg" | "pkg" | "appimage" | "tar.gz" | "pdf" | "other";
  version: string;
  githubRepo: string;
  releaseTag: string;
  appAssetName: string;
  pdfAssetName?: string | null;
  notesZh?: string[];
  notesEn?: string[];
  isVisible?: boolean;
  sortOrder?: number;
}

export interface SiteShowcaseSummary {
  slug: string;
  title: string;
  summary: string;
  category: string;
  status: string;
  tags: string[];
  metrics: SiteStatRecord;
}

export interface SiteShowcaseDetail extends SiteShowcaseSummary {
  heroTitle: string;
  heroDescription: string;
  primaryCtaLabel: string;
  sections: Array<{
    title: string;
    paragraphs: string[];
  }>;
  highlights: string[];
  gallery: Array<{
    title: string;
    description: string;
  }>;
}

export interface SiteResourceItem {
  slug: string;
  title: string;
  summary: string;
  format: string;
  platform: string;
  category?: string;
  siteName?: string;
  sourceUrl?: string;
  coverImage?: string | null;
  tags?: string[];
  highlights?: string[];
  version: string;
  fileSize: string;
  updatedAt: string;
  fileName: string;
  downloadPath: string | null;
  tutorialPdfName?: string | null;
  tutorialPdfPath?: string | null;
  notes: string[];
  metrics: SiteStatRecord;
}

export interface SiteDocNode {
  slug: string;
  title: string;
  summary: string;
  sourceUrl?: string;
  tags?: string[];
  sections: Array<{
    title: string;
    body: string[];
  }>;
  children?: SiteDocNode[];
}

export type HomeFeedKind = "NEWS" | "TECH" | "GITHUB";

export type HomeFeedSectionKey = "news" | "tech" | "github";

export interface HomeFeedItemMetrics {
  sourceWeight?: number;
  githubStars?: number;
  githubForks?: number;
  githubStarDelta30d?: number;
}

export interface HomeFeedItem {
  id: string;
  kind: HomeFeedKind;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  sourceName: string;
  sourceUrl: string;
  externalUrl: string;
  publishedAt: string;
  heatScore: number;
  tags: string[];
  coverImage?: string | null;
  metrics?: HomeFeedItemMetrics;
}

export interface HomeFeedSection {
  key: HomeFeedSectionKey;
  titleZh: string;
  titleEn: string;
  updatedAt: string;
  featuredItem: HomeFeedItem | null;
  items: HomeFeedItem[];
}

export interface HomeFeedSnapshot {
  generatedAt: string;
  news: HomeFeedSection;
  tech: HomeFeedSection;
  github: HomeFeedSection;
}

export interface HomeFeedSettings {
  newsLimit: number;
  techLimit: number;
  githubLimit: number;
  weeklySources: string[];
  monthlySources: string[];
  sourceWeights: Record<string, number>;
}

export interface HomeFeedGithubHistoryItem {
  repository: string;
  stars: number;
  forks: number;
  pushedAt: string;
}

export interface HomeFeedGithubHistory {
  capturedAt: string;
  items: HomeFeedGithubHistoryItem[];
}

export interface LocalizedHomeFeedItem {
  id: string;
  kind: HomeFeedKind;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  externalUrl: string;
  publishedAt: string;
  heatScore: number;
  tags: string[];
  coverImage?: string | null;
  metrics?: HomeFeedItemMetrics;
}

export interface LocalizedHomeFeedSection {
  key: HomeFeedSectionKey;
  title: string;
  updatedAt: string;
  featuredItem: LocalizedHomeFeedItem | null;
  items: LocalizedHomeFeedItem[];
}

export interface HomePageData {
  title: string;
  eyebrow: string;
  summary: string;
  publicAppName: string;
  primaryActionLabel: string;
  secondaryActionLabel: string;
  positioning: Array<{
    title: string;
    description: string;
  }>;
  feedGeneratedAt: string;
  feedSections: LocalizedHomeFeedSection[];
  contact?: {
    title: string;
    description: string;
    email: string;
    beianText: string;
    beianUrl?: string;
    publicSecurityBeianText?: string;
    publicSecurityBeianUrl?: string;
  };
}

export interface SiteFooterContact {
  label: string;
  value: string;
  href?: string;
}

export interface SiteFooterData {
  siteName: string;
  title: string;
  description: string;
  contacts: SiteFooterContact[];
  footerLinks?: SiteFooterContact[];
  footerLabels?: {
    contact: string;
    resources: string;
    filing: string;
  };
  beianText: string;
  beianUrl?: string;
  publicSecurityBeianText?: string;
  publicSecurityBeianUrl?: string;
}

export interface DeveloperProfileContent {
  projects: Array<{
    slug: string;
    nameZh: string;
    nameEn: string;
    summaryZh: string;
    summaryEn: string;
    githubUrl: string;
  }>;
  name: string;
  roleZh: string;
  roleEn: string;
  summaryZh: string;
  summaryEn: string;
  longBioZh: string;
  longBioEn: string;
  email: string;
  location: string;
  websiteLabel: string;
  websiteUrl: string;
  githubUrl: string;
  notesZh: string;
  notesEn: string;
}

export interface EditableHomeContent {
  eyebrowZh: string;
  eyebrowEn: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  primaryActionLabelZh: string;
  primaryActionLabelEn: string;
  secondaryActionLabelZh: string;
  secondaryActionLabelEn: string;
  contactTitleZh: string;
  contactTitleEn: string;
  contactDescriptionZh: string;
  contactDescriptionEn: string;
  icpText: string;
}

export interface EditablePageIntroContent {
  eyebrowZh: string;
  eyebrowEn: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
}

export interface EditableShowcaseItem {
  slug: string;
  categoryZh: string;
  categoryEn: string;
  statusZh: string;
  statusEn: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  heroTitleZh: string;
  heroTitleEn: string;
  heroDescriptionZh: string;
  heroDescriptionEn: string;
  primaryCtaLabelZh: string;
  primaryCtaLabelEn: string;
  tags: string[];
  highlightsZh: string[];
  highlightsEn: string[];
  gallery: Array<{
    titleZh: string;
    titleEn: string;
    descriptionZh: string;
    descriptionEn: string;
  }>;
  sections: Array<{
    titleZh: string;
    titleEn: string;
    paragraphsZh: string[];
    paragraphsEn: string[];
  }>;
}

export interface EditableResourceItem {
  slug: string;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  formatZh: string;
  formatEn: string;
  platformZh: string;
  platformEn: string;
  version: string;
  fileSize: string;
  updatedAt: string;
  fileName: string;
  downloadPath: string | null;
  tutorialPdfName: string | null;
  tutorialPdfPath: string | null;
  notesZh: string[];
  notesEn: string[];
}

export interface EditableDocItem {
  slug: string;
  parentSlug: string | null;
  sortOrder: number;
  titleZh: string;
  titleEn: string;
  summaryZh: string;
  summaryEn: string;
  sections: Array<{
    titleZh: string;
    titleEn: string;
    bodyZh: string[];
    bodyEn: string[];
  }>;
}

export interface DemoIndexData {
  title: string;
  eyebrow: string;
  summary: string;
  items: SiteShowcaseSummary[];
}

export interface ResourcesPageData {
  title: string;
  eyebrow: string;
  summary: string;
  items: SiteResourceItem[];
  categories?: Array<{
    category: string;
    count: number;
  }>;
  featuredTags?: Array<{
    tag: string;
    count: number;
  }>;
}

export interface DownloadsPageData {
  title: string;
  eyebrow: string;
  summary: string;
  notes: string[];
  items: SiteResourceItem[];
}

export interface DocsPageData {
  title: string;
  eyebrow: string;
  summary: string;
  notes: string[];
  tree: SiteDocNode[];
  activeDoc: SiteDocNode;
}

export interface DeveloperPageData {
  profile: {
    name: string;
    role: string;
    summary: string;
    longBio: string;
    projects: Array<{
      slug: string;
      name: string;
      summary: string;
      githubUrl: string;
    }>;
    email: string;
    location: string;
    websiteLabel: string;
    websiteUrl: string;
    githubUrl: string;
    notes: string;
  };
  repositoryGroups: Array<{
    key: string;
    title: string;
    description: string;
    items: Array<{
      slug: string;
      name: string;
      summary: string;
      githubUrl: string;
    }>;
  }>;
  manifesto: {
    title: string;
    paragraphs: string[];
  };
  editorContent: {
    developerProfile: DeveloperProfileContent;
    homePage: EditableHomeContent;
    resourcesPage: EditablePageIntroContent;
    docsPage: EditablePageIntroContent;
    resourceItems: EditableResourceItem[];
    docItems: EditableDocItem[];
  };
}
