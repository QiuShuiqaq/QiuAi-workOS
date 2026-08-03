import { NextResponse } from "next/server";

import { isDownloadAdminAuthenticated } from "@/modules/site/download-admin-auth";
import {
  createManagedDownloadItemFromDraft,
  deleteManagedDownloadItem,
  getManagedDownloadItems,
  localizeManagedDownloadItem,
  updateManagedDownloadItem,
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

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const unauthorized = await requireAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = downloadAdminDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload", issues: parsed.error.issues }, { status: 400 });
  }

  const items = await getManagedDownloadItems({ includeHidden: true });
  const existing = items.find((item) => item.id === id);
  if (!existing) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  try {
    const resolved = await resolveGithubReleaseAssets({
      repo: parsed.data.githubRepo,
      tag: parsed.data.releaseTag,
      appAssetName: parsed.data.appAssetName,
      pdfAssetName: parsed.data.pdfAssetName,
    });

    const next = createManagedDownloadItemFromDraft(parsed.data, resolved, existing);
    const updated = await updateManagedDownloadItem(id, () => next);
    if (!updated) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...updated,
      publicItem: localizeManagedDownloadItem(updated, "zh"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve GitHub release assets";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const unauthorized = await requireAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { id } = await context.params;
  const deleted = await deleteManagedDownloadItem(id);
  if (!deleted) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
