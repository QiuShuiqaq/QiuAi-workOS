import { formatBytes } from "@/modules/site/download-items-store";

interface GithubReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
  updated_at?: string;
}

interface GithubReleaseResponse {
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  assets?: GithubReleaseAsset[];
}

function createGithubHeaders() {
  const token = process.env.GITHUB_TOKEN?.trim();
  return {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "User-Agent": "qiuaihub-download-admin",
  };
}

export async function resolveGithubReleaseAssets(input: {
  repo: string;
  tag: string;
  appAssetName: string;
  pdfAssetName?: string | null;
}) {
  const url = `https://api.github.com/repos/${input.repo}/releases/tags/${encodeURIComponent(input.tag)}`;
  const response = await fetch(url, {
    headers: createGithubHeaders(),
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`GitHub release lookup failed: ${response.status}`);
  }

  const payload = (await response.json()) as GithubReleaseResponse;
  const assets = payload.assets ?? [];
  const appAsset = assets.find((asset) => asset.name === input.appAssetName);

  if (!appAsset) {
    throw new Error(`App asset not found in release: ${input.appAssetName}`);
  }

  const pdfAsset = input.pdfAssetName ? assets.find((asset) => asset.name === input.pdfAssetName) ?? null : null;
  if (input.pdfAssetName && !pdfAsset) {
    throw new Error(`PDF asset not found in release: ${input.pdfAssetName}`);
  }

  const updatedAt = appAsset.updated_at || payload.published_at || payload.updated_at || payload.created_at || new Date().toISOString();

  return {
    appDownloadUrl: appAsset.browser_download_url,
    pdfDownloadUrl: pdfAsset?.browser_download_url ?? null,
    fileSize: formatBytes(appAsset.size),
    pdfFileSize: pdfAsset ? formatBytes(pdfAsset.size) : null,
    updatedAt: updatedAt.slice(0, 10),
  };
}
