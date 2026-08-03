import { NextResponse } from "next/server";

import { clearDownloadAdminSession } from "@/modules/site/download-admin-auth";

export const runtime = "nodejs";

export async function POST() {
  await clearDownloadAdminSession();
  return NextResponse.json({ ok: true });
}
