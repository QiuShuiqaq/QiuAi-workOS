import { z } from "zod";

export const siteLanguageSchema = z.enum(["zh", "en"]);

export const siteContentTypeSchema = z.enum(["SHOWCASE", "RESOURCE"]);

export const engagementActionSchema = z.enum(["VIEW", "LIKE"]);

export const recordEngagementSchema = z.object({
  contentType: siteContentTypeSchema,
  slug: z.string().min(1),
  action: engagementActionSchema,
});

export const developerProfileContentSchema = z.object({
  projects: z.array(
    z.object({
      slug: z.string().min(1),
      nameZh: z.string().min(1),
      nameEn: z.string().min(1),
      summaryZh: z.string().min(1),
      summaryEn: z.string().min(1),
      githubUrl: z.string().url(),
    }),
  ),
  name: z.string().min(1),
  roleZh: z.string().min(1),
  roleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  longBioZh: z.string().min(1),
  longBioEn: z.string().min(1),
  email: z.string().email(),
  location: z.string().min(1),
  websiteLabel: z.string().min(1),
  websiteUrl: z.string().url(),
  githubUrl: z.string().url(),
  notesZh: z.string().min(1),
  notesEn: z.string().min(1),
});

export const editableHomeContentSchema = z.object({
  eyebrowZh: z.string().min(1),
  eyebrowEn: z.string().min(1),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  primaryActionLabelZh: z.string().min(1),
  primaryActionLabelEn: z.string().min(1),
  secondaryActionLabelZh: z.string().min(1),
  secondaryActionLabelEn: z.string().min(1),
  contactTitleZh: z.string().min(1),
  contactTitleEn: z.string().min(1),
  contactDescriptionZh: z.string().min(1),
  contactDescriptionEn: z.string().min(1),
  icpText: z.string().min(1),
});

export const editablePageIntroContentSchema = z.object({
  eyebrowZh: z.string().min(1),
  eyebrowEn: z.string().min(1),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
});

export const editableShowcaseItemSchema = z.object({
  slug: z.string().min(1),
  categoryZh: z.string().min(1),
  categoryEn: z.string().min(1),
  statusZh: z.string().min(1),
  statusEn: z.string().min(1),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  heroTitleZh: z.string().min(1),
  heroTitleEn: z.string().min(1),
  heroDescriptionZh: z.string().min(1),
  heroDescriptionEn: z.string().min(1),
  primaryCtaLabelZh: z.string().min(1),
  primaryCtaLabelEn: z.string().min(1),
  tags: z.array(z.string().min(1)),
  highlightsZh: z.array(z.string().min(1)),
  highlightsEn: z.array(z.string().min(1)),
  gallery: z.array(
    z.object({
      titleZh: z.string().min(1),
      titleEn: z.string().min(1),
      descriptionZh: z.string().min(1),
      descriptionEn: z.string().min(1),
    }),
  ),
  sections: z.array(
    z.object({
      titleZh: z.string().min(1),
      titleEn: z.string().min(1),
      paragraphsZh: z.array(z.string().min(1)),
      paragraphsEn: z.array(z.string().min(1)),
    }),
  ),
});

export const editableResourceItemSchema = z.object({
  slug: z.string().min(1),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  formatZh: z.string().min(1),
  formatEn: z.string().min(1),
  platformZh: z.string().min(1),
  platformEn: z.string().min(1),
  version: z.string().min(1),
  fileSize: z.string().min(1),
  updatedAt: z.string().min(1),
  fileName: z.string().min(1),
  downloadPath: z.string().min(1).nullable(),
  tutorialPdfName: z.string().min(1).nullable(),
  tutorialPdfPath: z.string().min(1).nullable(),
  notesZh: z.array(z.string().min(1)),
  notesEn: z.array(z.string().min(1)),
});

export const managedDownloadItemSchema = z.object({
  id: z.string().min(1),
  slug: z.string().min(1),
  projectName: z.string().min(1),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  platformZh: z.string().min(1),
  platformEn: z.string().min(1),
  formatZh: z.string().min(1),
  formatEn: z.string().min(1),
  version: z.string().min(1),
  githubRepo: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  releaseTag: z.string().min(1),
  appAssetName: z.string().min(1),
  pdfAssetName: z.string().min(1).nullable(),
  appDownloadUrl: z.string().url().nullable(),
  pdfDownloadUrl: z.string().url().nullable(),
  fileSize: z.string().min(1),
  pdfFileSize: z.string().min(1).nullable(),
  updatedAt: z.string().min(1),
  notesZh: z.array(z.string().min(1)),
  notesEn: z.array(z.string().min(1)),
  isVisible: z.boolean(),
  sortOrder: z.number().int(),
});

export const managedDownloadItemsSchema = z.array(managedDownloadItemSchema);

export const downloadAdminDraftSchema = z.object({
  projectName: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().optional(),
  platform: z.enum(["windows", "macos", "linux", "cross-platform", "android", "ios"]),
  packageType: z.enum(["exe", "msi", "zip", "dmg", "pkg", "appimage", "tar.gz", "pdf", "other"]),
  version: z.string().min(1),
  githubRepo: z.string().regex(/^[^/\s]+\/[^/\s]+$/),
  releaseTag: z.string().min(1),
  appAssetName: z.string().min(1),
  pdfAssetName: z.string().min(1).nullable().optional(),
  notesZh: z.array(z.string().min(1)).optional(),
  notesEn: z.array(z.string().min(1)).optional(),
  isVisible: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const editableDocItemSchema = z.object({
  slug: z.string().min(1),
  parentSlug: z.string().min(1).nullable(),
  sortOrder: z.coerce.number().int(),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  sections: z.array(
    z.object({
      titleZh: z.string().min(1),
      titleEn: z.string().min(1),
      bodyZh: z.array(z.string().min(1)),
      bodyEn: z.array(z.string().min(1)),
    }),
  ),
});

const homeFeedItemMetricsSchema = z.object({
  sourceWeight: z.number().finite().optional(),
  githubStars: z.number().int().nonnegative().optional(),
  githubForks: z.number().int().nonnegative().optional(),
  githubStarDelta30d: z.number().int().nonnegative().optional(),
});

const homeFeedItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["NEWS", "TECH", "GITHUB"]),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  summaryZh: z.string().min(1),
  summaryEn: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url(),
  externalUrl: z.string().url(),
  publishedAt: z.string().datetime(),
  heatScore: z.number().finite(),
  tags: z.array(z.string().min(1)),
  coverImage: z.string().url().nullable().optional(),
  metrics: homeFeedItemMetricsSchema.optional(),
});

const homeFeedSectionSchema = z.object({
  key: z.enum(["news", "tech", "github"]),
  titleZh: z.string().min(1),
  titleEn: z.string().min(1),
  updatedAt: z.string().datetime(),
  featuredItem: homeFeedItemSchema.nullable(),
  items: z.array(homeFeedItemSchema),
});

export const homeFeedSnapshotSchema = z.object({
  generatedAt: z.string().datetime(),
  news: homeFeedSectionSchema,
  tech: homeFeedSectionSchema,
  github: homeFeedSectionSchema,
});

export const homeFeedSettingsSchema = z.object({
  newsLimit: z.number().int().positive(),
  techLimit: z.number().int().positive(),
  githubLimit: z.number().int().positive(),
  weeklySources: z.array(z.string().min(1)),
  monthlySources: z.array(z.string().min(1)),
  sourceWeights: z.record(z.string(), z.number().finite()),
});

export const homeFeedGithubHistorySchema = z.object({
  capturedAt: z.string().datetime(),
  items: z.array(
    z.object({
      repository: z.string().min(1),
      stars: z.number().int().nonnegative(),
      forks: z.number().int().nonnegative(),
      pushedAt: z.string().datetime(),
    }),
  ),
});

export const managedContentUpdateSchema = z.discriminatedUnion("key", [
  z.object({
    key: z.literal("DEVELOPER_PROFILE"),
    content: developerProfileContentSchema,
  }),
  z.object({
    key: z.literal("HOME_PAGE"),
    content: editableHomeContentSchema,
  }),
  z.object({
    key: z.literal("DEMO_PAGE"),
    content: editablePageIntroContentSchema,
  }),
  z.object({
    key: z.literal("RESOURCES_PAGE"),
    content: editablePageIntroContentSchema,
  }),
  z.object({
    key: z.literal("DOCS_PAGE"),
    content: editablePageIntroContentSchema,
  }),
  z.object({
    key: z.literal("SHOWCASE_ITEMS"),
    content: z.array(editableShowcaseItemSchema).min(1),
  }),
  z.object({
    key: z.literal("RESOURCE_ITEMS"),
    content: z.array(editableResourceItemSchema).min(1),
  }),
  z.object({
    key: z.literal("DOC_ITEMS"),
    content: z.array(editableDocItemSchema).min(1),
  }),
  z.object({
    key: z.literal("HOME_FEED_SNAPSHOT"),
    content: homeFeedSnapshotSchema,
  }),
  z.object({
    key: z.literal("HOME_FEED_SETTINGS"),
    content: homeFeedSettingsSchema,
  }),
  z.object({
    key: z.literal("HOME_FEED_GITHUB_HISTORY"),
    content: homeFeedGithubHistorySchema,
  }),
]);
