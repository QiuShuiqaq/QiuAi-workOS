import { z } from "zod";

const localizedTextSchema = z.object({
  zh: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const baseRecordSchema = z.object({
  id: z.string().trim().min(1),
  sortOrder: z.coerce.number().int(),
  isVisible: z.boolean(),
  updatedAt: z.string().datetime(),
});

const nullableUrlSchema = z.string().trim().url().nullable();

export const studioHomeContentSchema = z.object({
  eyebrow: localizedTextSchema,
  title: localizedTextSchema,
  subtitle: localizedTextSchema,
  primaryCta: localizedTextSchema,
  secondaryCta: localizedTextSchema,
  tertiaryCta: localizedTextSchema,
});

export const studioMetricSchema = baseRecordSchema.extend({
  label: localizedTextSchema,
  value: z.string().trim().min(1),
  note: localizedTextSchema,
});

export const studioTrustedLogoSchema = baseRecordSchema.extend({
  name: localizedTextSchema,
  category: localizedTextSchema,
});

export const studioSolutionSchema = baseRecordSchema.extend({
  iconKey: z.string().trim().min(1),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  problems: z.array(localizedTextSchema),
  capabilities: z.array(localizedTextSchema),
  tags: z.array(z.string().trim().min(1)),
});

export const studioProjectSchema = baseRecordSchema.extend({
  slug: z.string().trim().min(1),
  title: localizedTextSchema,
  subtitle: localizedTextSchema,
  summary: localizedTextSchema,
  problem: localizedTextSchema,
  value: localizedTextSchema,
  architecture: localizedTextSchema,
  techStack: z.array(z.string().trim().min(1)),
  coverImage: nullableUrlSchema,
  screenshots: z.array(z.string().trim().url()),
  demoUrl: nullableUrlSchema,
  githubUrl: nullableUrlSchema,
  status: localizedTextSchema,
  tags: z.array(z.string().trim().min(1)),
});

export const studioCaseStudySchema = baseRecordSchema.extend({
  slug: z.string().trim().min(1),
  title: localizedTextSchema,
  industry: localizedTextSchema,
  background: localizedTextSchema,
  painPoints: z.array(localizedTextSchema),
  solution: localizedTextSchema,
  architecture: localizedTextSchema,
  results: z.array(localizedTextSchema),
  businessValue: localizedTextSchema,
  reusableCapabilities: z.array(localizedTextSchema),
  coverImage: nullableUrlSchema,
  screenshots: z.array(z.string().trim().url()),
  metrics: z.array(studioMetricSchema),
  tags: z.array(z.string().trim().min(1)),
  isAnonymized: z.boolean(),
});

export const studioOpenSourceProjectSchema = baseRecordSchema.extend({
  slug: z.string().trim().min(1),
  name: z.string().trim().min(1),
  summary: localizedTextSchema,
  techStack: z.array(z.string().trim().min(1)),
  githubUrl: z.string().trim().url(),
  demoUrl: nullableUrlSchema,
  starsLabel: z.string().trim().min(1),
  latestUpdate: z.string().trim().min(1),
  status: localizedTextSchema,
  tags: z.array(z.string().trim().min(1)),
});

export const studioServiceSchema = baseRecordSchema.extend({
  slug: z.string().trim().min(1),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  deliverables: z.array(localizedTextSchema),
  fitFor: z.array(localizedTextSchema),
  tags: z.array(z.string().trim().min(1)),
});

export const studioTeamMemberSchema = baseRecordSchema.extend({
  slug: z.string().trim().min(1),
  name: localizedTextSchema,
  role: localizedTextSchema,
  summary: localizedTextSchema,
  avatarUrl: nullableUrlSchema,
  links: z.array(
    z.object({
      label: z.string().trim().min(1),
      href: z.string().trim().url(),
    }),
  ),
  tags: z.array(z.string().trim().min(1)),
});

export const studioWorkStepSchema = baseRecordSchema.extend({
  title: localizedTextSchema,
  summary: localizedTextSchema,
});

export const studioAboutContentSchema = z.object({
  title: localizedTextSchema,
  summary: localizedTextSchema,
  focusAreas: z.array(localizedTextSchema),
  capabilities: z.array(localizedTextSchema),
  stack: z.array(z.string().trim().min(1)),
  experience: z.array(localizedTextSchema),
});

export const studioContactContentSchema = z.object({
  title: localizedTextSchema,
  summary: localizedTextSchema,
  emails: z.array(
    z.object({
      label: z.string().trim().min(1),
      value: z.string().trim().email(),
    }),
  ),
  links: z.array(
    z.object({
      label: z.string().trim().min(1),
      href: z.string().trim().url(),
    }),
  ),
});

export const studioContentSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string().datetime(),
  home: studioHomeContentSchema,
  metrics: z.array(studioMetricSchema),
  trustedLogos: z.array(studioTrustedLogoSchema),
  solutions: z.array(studioSolutionSchema),
  projects: z.array(studioProjectSchema),
  caseStudies: z.array(studioCaseStudySchema),
  openSource: z.array(studioOpenSourceProjectSchema),
  services: z.array(studioServiceSchema),
  team: z.array(studioTeamMemberSchema),
  workSteps: z.array(studioWorkStepSchema),
  about: studioAboutContentSchema,
  contact: studioContactContentSchema,
});

export const studioCollectionSchemas = {
  metrics: studioMetricSchema,
  trustedLogos: studioTrustedLogoSchema,
  solutions: studioSolutionSchema,
  projects: studioProjectSchema,
  caseStudies: studioCaseStudySchema,
  openSource: studioOpenSourceProjectSchema,
  services: studioServiceSchema,
  team: studioTeamMemberSchema,
  workSteps: studioWorkStepSchema,
} as const;

export const studioPageSchemas = {
  home: studioHomeContentSchema,
  about: studioAboutContentSchema,
  contact: studioContactContentSchema,
} as const;
