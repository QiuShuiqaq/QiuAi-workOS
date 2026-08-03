import { NextResponse } from "next/server";

import {
  createViewerHash,
  getDownloadStats,
  getHomeEngagementStats,
  incrementDownloadCount,
  incrementHomeView,
  registerHomeLike,
} from "@/modules/site/stats-store";

export const runtime = "nodejs";

function getViewerIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope");

  if (scope === "home") {
    const viewerHash = createViewerHash(getViewerIp(request));
    const stats = await getHomeEngagementStats(viewerHash);
    return NextResponse.json(stats);
  }

  if (scope === "downloads") {
    const slugs = url.searchParams.get("slugs")?.split(",").map((item) => item.trim()).filter(Boolean);
    const stats = await getDownloadStats(slugs);
    return NextResponse.json(stats);
  }

  return NextResponse.json({ error: "Unsupported scope" }, { status: 400 });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        action?: string;
        slug?: string;
      }
    | null;

  if (!body?.action) {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  const viewerHash = createViewerHash(getViewerIp(request));

  if (body.action === "home:view") {
    const stats = await incrementHomeView(viewerHash);
    return NextResponse.json(stats);
  }

  if (body.action === "home:like") {
    const stats = await registerHomeLike(viewerHash);
    return NextResponse.json(stats);
  }

  if (body.action === "download:track") {
    if (!body.slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const downloads = await incrementDownloadCount(body.slug);
    return NextResponse.json({ slug: body.slug, downloads });
  }

  return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
}
