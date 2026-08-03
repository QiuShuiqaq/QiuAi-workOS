import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { managedDownloadItemsSchema } from "@/modules/site/schemas";
import { defaultResourceItems } from "@/modules/site/content";
import type {
  DownloadAdminDraft,
  ManagedDownloadItem,
  SiteLanguage,
  SiteResourceItem,
} from "@/types/site";

function getDownloadItemsPath() {
  return process.env.DOWNLOAD_ITEMS_PATH?.trim() || path.join(process.cwd(), "data", "download-items.json");
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function formatBytes(size: number) {
  if (!Number.isFinite(size) || size <= 0) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  const digits = value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function inferFormat(fileName: string) {
  const lower = fileName.toLowerCase();
  const known = [".tar.gz", ".appimage", ".dmg", ".pkg", ".msi", ".exe", ".zip", ".pdf"];
  const match = known.find((item) => lower.endsWith(item));
  if (match) {
    const label = match.startsWith(".") ? match.slice(1) : match;
    return {
      zh: label.toUpperCase(),
      en: label.toUpperCase(),
      type:
        label === "tar.gz"
          ? "tar.gz"
          : (label.toLowerCase() as DownloadAdminDraft["packageType"]),
    };
  }

  return {
    zh: "安装包",
    en: "Package",
    type: "other" as const,
  };
}

function convertLegacyItem(item: (typeof defaultResourceItems)[number], index: number): ManagedDownloadItem {
  const format = inferFormat(item.fileName);
  const projectName = item.titleEn || item.titleZh;

  return {
    id: `seed-${item.slug}`,
    slug: item.slug,
    projectName,
    titleZh: item.titleZh,
    titleEn: item.titleEn,
    summaryZh: item.summaryZh,
    summaryEn: item.summaryEn,
    platformZh: item.platformZh,
    platformEn: item.platformEn,
    formatZh: item.formatZh || format.zh,
    formatEn: item.formatEn || format.en,
    version: item.version,
    githubRepo: "QiuShuiqaq/QiuAi",
    releaseTag: item.version,
    appAssetName: item.fileName,
    pdfAssetName: item.tutorialPdfName,
    appDownloadUrl: item.downloadPath,
    pdfDownloadUrl: item.tutorialPdfPath,
    fileSize: item.fileSize,
    pdfFileSize: null,
    updatedAt: item.updatedAt,
    notesZh: item.notesZh,
    notesEn: item.notesEn,
    isVisible: true,
    sortOrder: (index + 1) * 10,
  };
}

async function ensureStoreFile() {
  const filePath = getDownloadItemsPath();
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    const seeded = defaultResourceItems.map(convertLegacyItem);
    await writeFile(filePath, JSON.stringify(seeded, null, 2), "utf8");
  }

  return filePath;
}

async function readStore() {
  const filePath = await ensureStoreFile();
  const source = await readFile(filePath, "utf8");

  try {
    const parsed = JSON.parse(source);
    const validated = managedDownloadItemsSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
  } catch {
    // noop
  }

  const seeded = defaultResourceItems.map(convertLegacyItem);
  await writeStore(seeded);
  return seeded;
}

async function writeStore(items: ManagedDownloadItem[]) {
  const filePath = await ensureStoreFile();
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(items, null, 2), "utf8");
  await rename(tempPath, filePath);
}

export function localizeManagedDownloadItem(item: ManagedDownloadItem, lang: SiteLanguage): SiteResourceItem {
  return {
    slug: item.slug,
    title: lang === "zh" ? item.titleZh : item.titleEn,
    summary: lang === "zh" ? item.summaryZh : item.summaryEn,
    format: lang === "zh" ? item.formatZh : item.formatEn,
    platform: lang === "zh" ? item.platformZh : item.platformEn,
    version: item.version,
    fileSize: item.fileSize,
    updatedAt: item.updatedAt,
    fileName: item.appAssetName,
    downloadPath: `/api/download-items/${item.slug}/download?kind=app`,
    tutorialPdfName: item.pdfAssetName,
    tutorialPdfPath: item.pdfAssetName ? `/api/download-items/${item.slug}/download?kind=pdf` : null,
    notes: lang === "zh" ? item.notesZh : item.notesEn,
    metrics: {
      views: 0,
      likes: 0,
      downloads: 0,
    },
  };
}

export async function getManagedDownloadItems(options?: { includeHidden?: boolean }) {
  const items = await readStore();
  const includeHidden = options?.includeHidden ?? false;

  return items
    .filter((item) => includeHidden || item.isVisible)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.projectName.localeCompare(right.projectName));
}

export async function getManagedDownloadItemBySlug(slug: string) {
  const items = await readStore();
  return items.find((item) => item.slug === slug) ?? null;
}

export async function createManagedDownloadItem(item: ManagedDownloadItem) {
  const items = await readStore();
  items.push(item);
  await writeStore(items);
  return item;
}

export async function updateManagedDownloadItem(id: string, updater: (item: ManagedDownloadItem) => ManagedDownloadItem) {
  const items = await readStore();
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) {
    return null;
  }

  items[index] = updater(items[index]!);
  await writeStore(items);
  return items[index]!;
}

export async function deleteManagedDownloadItem(id: string) {
  const items = await readStore();
  const next = items.filter((item) => item.id !== id);
  if (next.length === items.length) {
    return false;
  }

  await writeStore(next);
  return true;
}

export function createManagedDownloadItemFromDraft(
  draft: DownloadAdminDraft,
  resolved: {
    appDownloadUrl: string;
    pdfDownloadUrl: string | null;
    fileSize: string;
    pdfFileSize: string | null;
    updatedAt: string;
  },
  existing?: ManagedDownloadItem,
) {
  const projectName = draft.projectName.trim();
  const slug = existing?.slug || slugify(projectName);
  const titleEn = projectName;
  const titleZh = projectName;
  const summaryZh = draft.summaryZh.trim();
  const summaryEn = draft.summaryEn?.trim() || summaryZh;
  const platformMap: Record<DownloadAdminDraft["platform"], { zh: string; en: string }> = {
    windows: { zh: "Windows", en: "Windows" },
    macos: { zh: "macOS", en: "macOS" },
    linux: { zh: "Linux", en: "Linux" },
    "cross-platform": { zh: "跨平台", en: "Cross-platform" },
    android: { zh: "Android", en: "Android" },
    ios: { zh: "iOS", en: "iOS" },
  };
  const formatLabel =
    draft.packageType === "other" ? "Package" : draft.packageType === "tar.gz" ? "TAR.GZ" : draft.packageType.toUpperCase();

  return {
    id: existing?.id || `download-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    slug,
    projectName,
    titleZh,
    titleEn,
    summaryZh,
    summaryEn,
    platformZh: platformMap[draft.platform].zh,
    platformEn: platformMap[draft.platform].en,
    formatZh: formatLabel,
    formatEn: formatLabel,
    version: draft.version.trim(),
    githubRepo: draft.githubRepo.trim(),
    releaseTag: draft.releaseTag.trim(),
    appAssetName: draft.appAssetName.trim(),
    pdfAssetName: draft.pdfAssetName?.trim() || null,
    appDownloadUrl: resolved.appDownloadUrl,
    pdfDownloadUrl: resolved.pdfDownloadUrl,
    fileSize: resolved.fileSize,
    pdfFileSize: resolved.pdfFileSize,
    updatedAt: resolved.updatedAt,
    notesZh: (draft.notesZh ?? []).map((item) => item.trim()).filter(Boolean),
    notesEn: (draft.notesEn ?? draft.notesZh ?? []).map((item) => item.trim()).filter(Boolean),
    isVisible: draft.isVisible ?? existing?.isVisible ?? true,
    sortOrder: draft.sortOrder ?? existing?.sortOrder ?? 999,
  } satisfies ManagedDownloadItem;
}

export { formatBytes };
