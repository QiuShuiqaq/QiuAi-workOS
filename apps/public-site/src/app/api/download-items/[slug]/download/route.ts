import { NextResponse } from "next/server";

import { getDownloadItemBySlug, resolveDownloadUrl } from "@/lib/downloads";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const item = await getDownloadItemBySlug(slug);

  if (!item) {
    return NextResponse.json(
      { error: "Download item not found" },
      { status: 404 },
    );
  }

  try {
    const downloadUrl = await resolveDownloadUrl(item);
    return NextResponse.redirect(downloadUrl, 302);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Download unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
