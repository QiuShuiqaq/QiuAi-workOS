import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "qiuai-workos-public-site",
    time: new Date().toISOString(),
  });
}
