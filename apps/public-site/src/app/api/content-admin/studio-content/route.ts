import { NextResponse } from "next/server";

import { contentAdminError, requireContentAdminAuth } from "@/modules/content-admin/api";
import { readStudioContent } from "@/modules/studio/store";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireContentAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const content = await readStudioContent({ includeHidden: true });
    return NextResponse.json(content);
  } catch {
    return contentAdminError("INTERNAL_ERROR", "读取站点内容失败。", 500);
  }
}
