import { NextResponse } from "next/server";

import {
  contentAdminError,
  createCollectionCandidate,
  parseCollectionItem,
  parsePageContent,
  readJsonBody,
  requireContentAdminAuth,
  resolveCollectionName,
  resolvePageName,
} from "@/modules/content-admin/api";
import {
  createStudioCollectionItem,
  readStudioCollection,
  readStudioContent,
  updateStudioPageContent,
} from "@/modules/studio/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ resource: string }>;
  },
) {
  const unauthorized = await requireContentAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { resource } = await context.params;
  const collectionName = resolveCollectionName(resource);
  if (collectionName) {
    const items = await readStudioCollection(collectionName, { includeHidden: true });
    return NextResponse.json(items);
  }

  const pageName = resolvePageName(resource);
  if (pageName) {
    const content = await readStudioContent({ includeHidden: true });
    return NextResponse.json(content[pageName]);
  }

  return contentAdminError("CONTENT_NOT_FOUND", "内容类型不存在。", 404);
}

export async function POST(
  request: Request,
  context: {
    params: Promise<{ resource: string }>;
  },
) {
  const unauthorized = await requireContentAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { resource } = await context.params;
  const collectionName = resolveCollectionName(resource);
  if (!collectionName) {
    return contentAdminError("CONTENT_NOT_FOUND", "内容类型不存在或不支持新增。", 404);
  }

  const body = await readJsonBody(request);
  const parsed = parseCollectionItem(collectionName, createCollectionCandidate(collectionName, body));
  if (!parsed.success) {
    return contentAdminError("VALIDATION_ERROR", "内容字段不完整或格式错误。", 400, parsed.error.flatten());
  }

  try {
    const created = await createStudioCollectionItem(collectionName, parsed.data);
    return NextResponse.json(created, { status: 201 });
  } catch {
    return contentAdminError("CONTENT_WRITE_FAILED", "新增内容失败。", 500);
  }
}

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ resource: string }>;
  },
) {
  const unauthorized = await requireContentAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { resource } = await context.params;
  const pageName = resolvePageName(resource);
  if (!pageName) {
    return contentAdminError("CONTENT_NOT_FOUND", "内容类型不存在或不支持直接修改。", 404);
  }

  const body = await readJsonBody(request);
  const parsed = parsePageContent(pageName, body);
  if (!parsed.success) {
    return contentAdminError("VALIDATION_ERROR", "页面字段不完整或格式错误。", 400, parsed.error.flatten());
  }

  try {
    const updated = await updateStudioPageContent(pageName, parsed.data);
    return NextResponse.json(updated);
  } catch {
    return contentAdminError("CONTENT_WRITE_FAILED", "保存页面内容失败。", 500);
  }
}
