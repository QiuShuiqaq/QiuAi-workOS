import { NextResponse } from "next/server";

import { isDownloadAdminAuthenticated } from "@/modules/site/download-admin-auth";
import {
  createManagedDownloadItem,
  createManagedDownloadItemFromDraft,
  getManagedDownloadItems,
  localizeManagedDownloadItem,
} from "@/modules/site/download-items-store";
import { resolveGithubReleaseAssets } from "@/modules/site/github-release";
import { downloadAdminDraftSchema } from "@/modules/site/schemas";

export const runtime = "nodejs";

async function requireAuth() {
  const authenticated = await isDownloadAdminAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const items = await getManagedDownloadItems({ includeHidden: true });
  return NextResponse.json(
    items.map((item) => ({
      ...item,
      publicItem: localizeManagedDownloadItem(item, "zh"),
    })),
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const body = await request.json().catch(() => null);
  const parsed = downloadAdminDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const resolved = await resolveGithubReleaseAssets({
      repo: parsed.data.githubRepo,
      tag: parsed.data.releaseTag,
      appAssetName: parsed.data.appAssetName,
      pdfAssetName: parsed.data.pdfAssetName,
    });

    const item = createManagedDownloadItemFromDraft(parsed.data, resolved);
    await createManagedDownloadItem(item);

    return NextResponse.json({
      ...item,
      publicItem: localizeManagedDownloadItem(item, "zh"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve GitHub release assets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
