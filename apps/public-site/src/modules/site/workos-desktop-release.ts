import { z } from "zod";

import type { SiteLanguage, SiteResourceItem } from "@/types/site";

const WORKOS_WINDOWS_DOWNLOAD_SLUG = "qiuai-workos-windows";

const desktopReleaseSchema = z.object({
  id: z.string(),
  version: z.string(),
  platform: z.literal("windows"),
  channel: z.literal("stable"),
  downloadUrl: z.string(),
  releaseNotes: z.string().optional(),
  checksumSha256: z.string().optional(),
  fileSizeBytes: z.number().optional(),
  forceUpdate: z.boolean(),
  minimumSupportedVersion: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  publishedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const desktopUpdateResponseSchema = z.object({
  data: z.object({
    currentVersion: z.string().optional(),
    updateAvailable: z.boolean(),
    forceUpdate: z.boolean(),
    latestRelease: desktopReleaseSchema.optional(),
  }),
});

export type PublicDesktopRelease = z.infer<typeof desktopReleaseSchema>;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function getServerBaseUrl() {
  return normalizeBaseUrl(
    process.env.SERVER_INTERNAL_BASE_URL?.trim() ||
      process.env.SERVER_API_BASE_URL?.trim() ||
      "http://127.0.0.1:4100",
  );
}

function getWorkosPublicBaseUrl() {
  return normalizeBaseUrl(
    process.env.WORKOS_PUBLIC_BASE_URL?.trim() ||
      process.env.NEXT_PUBLIC_WORKOS_CONSOLE_URL?.trim() ||
      "https://workos.qiuaihub.com",
  );
}

function formatBytes(size?: number) {
  if (!Number.isFinite(size) || !size || size <= 0) {
    return "Unknown";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 100 || unitIndex === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function inferFormat(downloadUrl?: string) {
  const lower = (downloadUrl ?? "").toLowerCase();
  if (lower.includes(".msi")) return "MSI";
  if (lower.includes(".zip")) return "ZIP";
  return "EXE";
}

function inferFileName(downloadUrl?: string, version?: string) {
  if (downloadUrl) {
    try {
      const source = downloadUrl.startsWith("http") ? new URL(downloadUrl).pathname : downloadUrl;
      const encodedName = source.split("/").filter(Boolean).pop();
      if (encodedName) {
        return decodeURIComponent(encodedName);
      }
    } catch {
      // Fall through to the stable product filename.
    }
  }

  return `QiuAI WorkOS Setup ${version || "latest"}.exe`;
}

export function resolveDesktopReleaseDownloadUrl(downloadUrl: string) {
  if (/^https?:\/\//i.test(downloadUrl)) {
    const parsed = new URL(downloadUrl);
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
      return `${getWorkosPublicBaseUrl()}${parsed.pathname}${parsed.search}`;
    }

    return parsed.toString();
  }

  const normalizedPath = downloadUrl.startsWith("/") ? downloadUrl : `/${downloadUrl}`;
  return `${getWorkosPublicBaseUrl()}${normalizedPath}`;
}

export async function fetchLatestDesktopRelease(): Promise<PublicDesktopRelease | null> {
  const url = new URL("/api/v1/desktop/releases/latest", getServerBaseUrl());
  url.searchParams.set("platform", "windows");
  url.searchParams.set("channel", "stable");

  let response: Response;
  try {
    response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  const body = await response.json().catch(() => null);
  const parsed = desktopUpdateResponseSchema.safeParse(body);
  if (!parsed.success) {
    return null;
  }

  return parsed.data.data.latestRelease ?? null;
}

export async function buildWorkosWindowsDownloadItem(lang: SiteLanguage): Promise<SiteResourceItem> {
  const release = await fetchLatestDesktopRelease();
  const isZh = lang === "zh";

  return {
    slug: WORKOS_WINDOWS_DOWNLOAD_SLUG,
    title: isZh ? "QiuAI WorkOS Windows 客户端" : "QiuAI WorkOS Windows Client",
    summary: isZh
      ? "面向企业数字员工与数字工厂的 Windows 桌面端，支持本地文件、Office 文档、模型配置、知识库和批量产物处理。"
      : "Windows desktop client for enterprise digital workers and digital factories, with local files, Office documents, model setup, knowledge bases, and batch artifact workflows.",
    format: inferFormat(release?.downloadUrl),
    platform: "Windows",
    version: release?.version ?? (isZh ? "暂未发布" : "Not published"),
    fileSize: formatBytes(release?.fileSizeBytes),
    updatedAt: (release?.publishedAt ?? release?.updatedAt ?? new Date().toISOString()).slice(0, 10),
    fileName: inferFileName(release?.downloadUrl, release?.version),
    downloadPath: release ? `/api/download-items/${WORKOS_WINDOWS_DOWNLOAD_SLUG}/download?kind=app` : null,
    tutorialPdfName: null,
    tutorialPdfPath: null,
    notes: release
      ? isZh
        ? ["适用于 Windows 10/11 x64。", "安装后先绑定企业账号。", "安装包由 admin-console 的桌面版本统一维护。"]
        : ["For Windows 10/11 x64.", "Bind the enterprise account after installation.", "Installers are maintained from admin-console desktop releases."]
      : isZh
        ? ["当前还没有已发布的 Windows stable 安装包。", "请先在 admin-console 的桌面版本中上传并发布安装包。"]
        : ["No published Windows stable installer is available yet.", "Upload and publish an installer from admin-console desktop releases first."],
    metrics: {
      views: 0,
      likes: 0,
      downloads: 0,
    },
  };
}

export async function getWorkosWindowsReleaseDownloadUrl() {
  const release = await fetchLatestDesktopRelease();
  return release ? resolveDesktopReleaseDownloadUrl(release.downloadUrl) : null;
}
