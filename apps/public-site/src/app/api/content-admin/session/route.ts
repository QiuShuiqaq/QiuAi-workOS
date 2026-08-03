import { NextResponse } from "next/server";

import {
  createContentAdminSession,
  hasContentAdminConfigured,
  isContentAdminAuthenticated,
  verifyContentAdminSecret,
} from "@/modules/content-admin/auth";
import { contentAdminError, readJsonBody } from "@/modules/content-admin/api";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    configured: hasContentAdminConfigured(),
    authenticated: await isContentAdminAuthenticated(),
  });
}

export async function POST(request: Request) {
  const body = (await readJsonBody(request)) as { secret?: string } | null;

  if (!hasContentAdminConfigured()) {
    return contentAdminError("INTERNAL_ERROR", "内容管理密码未配置。", 503);
  }

  if (!body?.secret?.trim()) {
    return contentAdminError("VALIDATION_ERROR", "请输入开发者密码。", 400);
  }

  if (!verifyContentAdminSecret(body.secret)) {
    return contentAdminError("UNAUTHORIZED", "开发者密码不正确。", 401);
  }

  await createContentAdminSession();
  return NextResponse.json({ ok: true });
}
