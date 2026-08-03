import { NextResponse } from "next/server";

import { clearContentAdminSession } from "@/modules/content-admin/auth";

export const runtime = "nodejs";

export async function POST() {
  await clearContentAdminSession();
  return NextResponse.json({ ok: true });
}
