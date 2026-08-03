import { NextResponse } from "next/server";

import {
  hasDownloadAdminConfigured,
  isDownloadAdminAuthenticated,
} from "@/modules/site/download-admin-auth";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: hasDownloadAdminConfigured(),
    authenticated: await isDownloadAdminAuthenticated(),
  });
}
