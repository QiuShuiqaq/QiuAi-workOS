import { readFile } from "node:fs/promises";
import path from "node:path";

export interface DownloadItem {
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

interface GithubReleaseAsset {
  name: string;
  browser_download_url: string;
}

interface GithubReleaseResponse {
  assets?: GithubReleaseAsset[];
}

function getDownloadItemsPath() {
  return path.join(process.cwd(), "data", "download-items.json");
}

function createGithubHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim();
  return {
    Accept: "application/vnd.github+json",
    "User-Agent": "qiuai-workos-public-site",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getDownloadItems() {
  const source = await readFile(getDownloadItemsPath(), "utf8");
  const items = JSON.parse(source) as DownloadItem[];

  return items
    .filter((item) => item.isVisible)
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.projectName.localeCompare(right.projectName),
    );
}

export async function getDownloadItemBySlug(slug: string) {
  const items = await getDownloadItems();
  return items.find((item) => item.slug === slug) ?? null;
}

export async function resolveDownloadUrl(item: DownloadItem) {
  if (item.appDownloadUrl) {
    return item.appDownloadUrl;
  }

  const releaseUrl = `https://api.github.com/repos/${item.githubRepo}/releases/tags/${encodeURIComponent(item.releaseTag)}`;
  const response = await fetch(releaseUrl, {
    headers: createGithubHeaders(),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: ${response.status}`);
  }

  const payload = (await response.json()) as GithubReleaseResponse;
  const asset = (payload.assets ?? []).find(
    (candidate) => candidate.name === item.appAssetName,
  );

  if (!asset) {
    throw new Error(`Installer asset not found: ${item.appAssetName}`);
  }

  return asset.browser_download_url;
}
