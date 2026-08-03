import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function redirectToAdminDomain(request: NextRequest) {
  const target = new URL(request.nextUrl.pathname + request.nextUrl.search, "https://admin-workos.qiuaihub.com");
  return NextResponse.redirect(target, 308);
}

export function GET(request: NextRequest) {
  return redirectToAdminDomain(request);
}

export function HEAD(request: NextRequest) {
  return redirectToAdminDomain(request);
}
