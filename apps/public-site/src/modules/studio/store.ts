import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { defaultStudioContent } from "@/modules/studio/default-content";
import { studioCollectionSchemas, studioContentSchema, studioPageSchemas } from "@/modules/studio/schema";
import type {
  StudioCollectionItem,
  StudioCollectionName,
  StudioContent,
} from "@/types/studio";

function getStudioContentPath() {
  return process.env.STUDIO_CONTENT_PATH?.trim() || path.join(process.cwd(), "data", "studio-content.json");
}

function cloneDefaultContent(): StudioContent {
  return JSON.parse(JSON.stringify(defaultStudioContent)) as StudioContent;
}

function mergeWithDefaultContent(candidate: unknown): unknown {
  if (typeof candidate !== "object" || candidate === null) {
    return candidate;
  }

  return {
    ...cloneDefaultContent(),
    ...(candidate as Record<string, unknown>),
  };
}

function touchContent(content: StudioContent): StudioContent {
  return {
    ...content,
    updatedAt: new Date().toISOString(),
  };
}

function sortVisible<T extends { sortOrder: number; isVisible: boolean }>(items: T[], includeHidden = false) {
  return items
    .filter((item) => includeHidden || item.isVisible)
    .slice()
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

async function writeStudioContentFile(content: StudioContent) {
  const filePath = getStudioContentPath();
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(content, null, 2), "utf8");
  await rename(tempPath, filePath);
}

async function ensureStudioContentFile() {
  const filePath = getStudioContentPath();
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeStudioContentFile(cloneDefaultContent());
  }

  return filePath;
}

export async function readStudioContent(options?: { includeHidden?: boolean }): Promise<StudioContent> {
  const filePath = await ensureStudioContentFile();
  const source = await readFile(filePath, "utf8");

  try {
    const parsed = mergeWithDefaultContent(JSON.parse(source));
    const validated = studioContentSchema.safeParse(parsed);
    if (validated.success) {
      const includeHidden = options?.includeHidden ?? false;
      return {
        ...validated.data,
        metrics: sortVisible(validated.data.metrics, includeHidden),
        trustedLogos: sortVisible(validated.data.trustedLogos, includeHidden),
        solutions: sortVisible(validated.data.solutions, includeHidden),
        projects: sortVisible(validated.data.projects, includeHidden),
        caseStudies: sortVisible(validated.data.caseStudies, includeHidden),
        openSource: sortVisible(validated.data.openSource, includeHidden),
        services: sortVisible(validated.data.services, includeHidden),
        team: sortVisible(validated.data.team, includeHidden),
        workSteps: sortVisible(validated.data.workSteps, includeHidden),
      };
    }
  } catch {
    // Invalid JSON falls back to the safe default content below.
  }

  const fallback = cloneDefaultContent();
  await writeStudioContentFile(fallback);
  return readStudioContent(options);
}

export async function replaceStudioContent(content: StudioContent) {
  const validated = studioContentSchema.parse(touchContent(content));
  await writeStudioContentFile(validated);
  return validated;
}

export async function readStudioCollection<TName extends StudioCollectionName>(
  collectionName: TName,
  options?: { includeHidden?: boolean },
) {
  const content = await readStudioContent({ includeHidden: options?.includeHidden ?? true });
  const items = content[collectionName] as Array<
    StudioCollectionItem<TName> & { sortOrder: number; isVisible: boolean }
  >;
  return sortVisible(items, options?.includeHidden ?? false) as StudioCollectionItem<TName>[];
}

export async function createStudioCollectionItem<TName extends StudioCollectionName>(
  collectionName: TName,
  item: StudioCollectionItem<TName>,
) {
  const content = await readStudioContent({ includeHidden: true });
  const schema = studioCollectionSchemas[collectionName];
  const parsed = schema.parse({
    ...item,
    updatedAt: new Date().toISOString(),
  }) as StudioCollectionItem<TName>;
  const nextCollection = [...content[collectionName], parsed] as StudioContent[TName];
  const nextContent = touchContent({
    ...content,
    [collectionName]: nextCollection,
  });

  await writeStudioContentFile(studioContentSchema.parse(nextContent));
  return parsed;
}

export async function updateStudioCollectionItem<TName extends StudioCollectionName>(
  collectionName: TName,
  id: string,
  item: StudioCollectionItem<TName>,
) {
  const content = await readStudioContent({ includeHidden: true });
  const index = content[collectionName].findIndex((record) => record.id === id);
  if (index < 0) {
    return null;
  }

  const schema = studioCollectionSchemas[collectionName];
  const parsed = schema.parse({
    ...item,
    id,
    updatedAt: new Date().toISOString(),
  }) as StudioCollectionItem<TName>;
  const nextCollection = content[collectionName].slice() as StudioCollectionItem<TName>[];
  nextCollection[index] = parsed;
  const nextContent = touchContent({
    ...content,
    [collectionName]: nextCollection,
  });

  await writeStudioContentFile(studioContentSchema.parse(nextContent));
  return parsed;
}

export async function deleteStudioCollectionItem(collectionName: StudioCollectionName, id: string) {
  const content = await readStudioContent({ includeHidden: true });
  const nextCollection = content[collectionName].filter((record) => record.id !== id);
  if (nextCollection.length === content[collectionName].length) {
    return false;
  }

  const nextContent = touchContent({
    ...content,
    [collectionName]: nextCollection,
  });
  await writeStudioContentFile(studioContentSchema.parse(nextContent));
  return true;
}

export async function updateStudioPageContent<TName extends keyof typeof studioPageSchemas>(
  pageName: TName,
  value: StudioContent[TName],
) {
  const content = await readStudioContent({ includeHidden: true });
  const schema = studioPageSchemas[pageName];
  const parsed = schema.parse(value) as StudioContent[TName];
  const nextContent = touchContent({
    ...content,
    [pageName]: parsed,
  });
  await writeStudioContentFile(studioContentSchema.parse(nextContent));
  return parsed;
}

export async function getStudioProjectBySlug(slug: string) {
  const content = await readStudioContent();
  return content.projects.find((item) => item.slug === slug) ?? null;
}

export async function getStudioCaseStudyBySlug(slug: string) {
  const content = await readStudioContent();
  return content.caseStudies.find((item) => item.slug === slug) ?? null;
}
