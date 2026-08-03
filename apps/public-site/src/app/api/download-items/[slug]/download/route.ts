import { NextResponse } from "next/server";

import { getManagedDownloadItemBySlug } from "@/modules/site/download-items-store";
import { resolveGithubReleaseAssets } from "@/modules/site/github-release";
import { incrementDownloadCount } from "@/modules/site/stats-store";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: {
    params: Promise<{ slug: string }>;
  },
) {
  const { slug } = await context.params;
  const item = await getManagedDownloadItemBySlug(slug);

  if (!item || !item.isVisible) {
    return NextResponse.json({ error: "Download item not found" }, { status: 404 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "pdf" ? "pdf" : "app";
  let target = kind === "pdf" ? item.pdfDownloadUrl : item.appDownloadUrl;

  if (!target) {
    if (kind === "pdf" && !item.pdfAssetName) {
      return NextResponse.json({ error: "File is not available" }, { status: 404 });
    }

    try {
      const resolved = await resolveGithubReleaseAssets({
        repo: item.githubRepo,
        tag: item.releaseTag,
        appAssetName: item.appAssetName,
        pdfAssetName: item.pdfAssetName,
      });
      target = kind === "pdf" ? resolved.pdfDownloadUrl : resolved.appDownloadUrl;
    } catch (error) {
      const message = error instanceof Error ? error.message : "File is not available";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (!target) {
    return NextResponse.json({ error: "File is not available" }, { status: 404 });
  }

  await incrementDownloadCount(item.slug);
  return NextResponse.redirect(target, { status: 307 });
}
