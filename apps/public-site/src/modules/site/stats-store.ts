import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { DownloadStatsMap, HomeEngagementStats, SiteTrendPoint } from "@/types/site";

interface SiteStatsFile {
  home: {
    views: number;
    likes: number;
    dailyViews: Record<string, number>;
    likedHashesByDay: Record<string, string[]>;
  };
  downloads: Record<string, { downloads: number }>;
}

const DEFAULT_SITE_STATS: SiteStatsFile = {
  home: {
    views: 0,
    likes: 0,
    dailyViews: {},
    likedHashesByDay: {},
  },
  downloads: {},
};

const HOME_TREND_DAYS = 21;
const LIKE_RETENTION_DAYS = 45;

function getStatsFilePath() {
  return process.env.SITE_STATS_PATH?.trim() || path.join(process.cwd(), "data", "site-stats.json");
}

function getTodayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getDayDifference(left: string, right: string) {
  const leftTime = Date.parse(`${left}T00:00:00.000Z`);
  const rightTime = Date.parse(`${right}T00:00:00.000Z`);
  return Math.floor((leftTime - rightTime) / 86_400_000);
}

function buildTrend(dailyViews: Record<string, number>): SiteTrendPoint[] {
  const entries = Object.entries(dailyViews)
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-HOME_TREND_DAYS);

  return entries.map(([date, value]) => ({
    date,
    value,
  }));
}

async function ensureStatsFile() {
  const filePath = getStatsFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await readFile(filePath, "utf8");
  } catch {
    await writeFile(filePath, JSON.stringify(DEFAULT_SITE_STATS, null, 2), "utf8");
  }

  return filePath;
}

function sanitizeStats(input: unknown): SiteStatsFile {
  if (!input || typeof input !== "object") {
    return structuredClone(DEFAULT_SITE_STATS);
  }

  const candidate = input as Partial<SiteStatsFile>;

  return {
    home: {
      views: Number.isFinite(candidate.home?.views) ? Number(candidate.home?.views) : 0,
      likes: Number.isFinite(candidate.home?.likes) ? Number(candidate.home?.likes) : 0,
      dailyViews:
        candidate.home?.dailyViews && typeof candidate.home.dailyViews === "object"
          ? Object.fromEntries(
              Object.entries(candidate.home.dailyViews).map(([key, value]) => [
                key,
                Number.isFinite(value) ? Number(value) : 0,
              ]),
            )
          : {},
      likedHashesByDay:
        candidate.home?.likedHashesByDay && typeof candidate.home.likedHashesByDay === "object"
          ? Object.fromEntries(
              Object.entries(candidate.home.likedHashesByDay).map(([key, value]) => [
                key,
                Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [],
              ]),
            )
          : {},
    },
    downloads:
      candidate.downloads && typeof candidate.downloads === "object"
        ? Object.fromEntries(
            Object.entries(candidate.downloads).map(([slug, value]) => [
              slug,
              {
                downloads: Number.isFinite(value?.downloads) ? Number(value.downloads) : 0,
              },
            ]),
          )
        : {},
  };
}

async function readStatsFile() {
  const filePath = await ensureStatsFile();
  const source = await readFile(filePath, "utf8");

  try {
    return sanitizeStats(JSON.parse(source));
  } catch {
    return structuredClone(DEFAULT_SITE_STATS);
  }
}

function pruneStats(stats: SiteStatsFile, today: string) {
  for (const date of Object.keys(stats.home.likedHashesByDay)) {
    if (getDayDifference(today, date) > LIKE_RETENTION_DAYS) {
      delete stats.home.likedHashesByDay[date];
    }
  }

  for (const date of Object.keys(stats.home.dailyViews)) {
    if (getDayDifference(today, date) > HOME_TREND_DAYS * 2) {
      delete stats.home.dailyViews[date];
    }
  }
}

async function writeStatsFile(stats: SiteStatsFile) {
  const filePath = await ensureStatsFile();
  const tempPath = `${filePath}.tmp`;
  await writeFile(tempPath, JSON.stringify(stats, null, 2), "utf8");
  await rename(tempPath, filePath);
}

export function createViewerHash(ip: string, date = getTodayKey()) {
  const salt = process.env.SITE_STATS_SALT?.trim() || "qiuaihub-site-stats";
  return createHash("sha256").update(`${salt}:${date}:${ip}`).digest("hex");
}

export async function getHomeEngagementStats(viewerHash?: string): Promise<HomeEngagementStats> {
  const today = getTodayKey();
  const stats = await readStatsFile();
  pruneStats(stats, today);

  return {
    views: stats.home.views,
    likes: stats.home.likes,
    trend: buildTrend(stats.home.dailyViews),
    likedToday: viewerHash ? (stats.home.likedHashesByDay[today] ?? []).includes(viewerHash) : false,
  };
}

export async function incrementHomeView(viewerHash?: string) {
  const today = getTodayKey();
  const stats = await readStatsFile();
  pruneStats(stats, today);

  stats.home.views += 1;
  stats.home.dailyViews[today] = (stats.home.dailyViews[today] ?? 0) + 1;

  await writeStatsFile(stats);

  return getHomeEngagementStats(viewerHash);
}

export async function registerHomeLike(viewerHash: string) {
  const today = getTodayKey();
  const stats = await readStatsFile();
  pruneStats(stats, today);

  const todayHashes = new Set(stats.home.likedHashesByDay[today] ?? []);
  if (!todayHashes.has(viewerHash)) {
    todayHashes.add(viewerHash);
    stats.home.likes += 1;
    stats.home.likedHashesByDay[today] = [...todayHashes];
    await writeStatsFile(stats);
  }

  return getHomeEngagementStats(viewerHash);
}

export async function getDownloadStats(slugs?: string[]): Promise<DownloadStatsMap> {
  const stats = await readStatsFile();
  const keys = slugs?.length ? slugs : Object.keys(stats.downloads);

  return Object.fromEntries(keys.map((slug) => [slug, stats.downloads[slug]?.downloads ?? 0]));
}

export async function incrementDownloadCount(slug: string) {
  const stats = await readStatsFile();
  const current = stats.downloads[slug]?.downloads ?? 0;
  stats.downloads[slug] = { downloads: current + 1 };
  await writeStatsFile(stats);

  return stats.downloads[slug].downloads;
}
