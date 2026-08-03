import { NextResponse } from "next/server";

import {
  createDownloadAdminSession,
  hasDownloadAdminConfigured,
  verifyDownloadAdminSecret,
} from "@/modules/site/download-admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { secret?: string } | null;

  if (!hasDownloadAdminConfigured()) {
    return NextResponse.json({ error: "Admin secret hash is not configured." }, { status: 503 });
  }

  if (!body?.secret?.trim()) {
    return NextResponse.json({ error: "Missing secret" }, { status: 400 });
  }

  if (!verifyDownloadAdminSecret(body.secret)) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  await createDownloadAdminSession();
  return NextResponse.json({ ok: true });
}
