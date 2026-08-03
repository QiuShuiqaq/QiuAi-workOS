import { NextResponse } from "next/server";

import {
  contentAdminError,
  createCollectionCandidate,
  parseCollectionItem,
  readJsonBody,
  requireContentAdminAuth,
  resolveCollectionName,
} from "@/modules/content-admin/api";
import { deleteStudioCollectionItem, updateStudioCollectionItem } from "@/modules/studio/store";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{ resource: string; id: string }>;
  },
) {
  const unauthorized = await requireContentAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { resource, id } = await context.params;
  const collectionName = resolveCollectionName(resource);
  if (!collectionName) {
    return contentAdminError("CONTENT_NOT_FOUND", "内容类型不存在。", 404);
  }

  const body = await readJsonBody(request);
  const parsed = parseCollectionItem(collectionName, {
    ...createCollectionCandidate(collectionName, body),
    id,
  });
  if (!parsed.success) {
    return contentAdminError("VALIDATION_ERROR", "内容字段不完整或格式错误。", 400, parsed.error.flatten());
  }

  try {
    const updated = await updateStudioCollectionItem(collectionName, id, parsed.data);
    if (!updated) {
      return contentAdminError("CONTENT_NOT_FOUND", "内容不存在。", 404);
    }

    return NextResponse.json(updated);
  } catch {
    return contentAdminError("CONTENT_WRITE_FAILED", "保存内容失败。", 500);
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{ resource: string; id: string }>;
  },
) {
  const unauthorized = await requireContentAdminAuth();
  if (unauthorized) {
    return unauthorized;
  }

  const { resource, id } = await context.params;
  const collectionName = resolveCollectionName(resource);
  if (!collectionName) {
    return contentAdminError("CONTENT_NOT_FOUND", "内容类型不存在。", 404);
  }

  try {
    const deleted = await deleteStudioCollectionItem(collectionName, id);
    if (!deleted) {
      return contentAdminError("CONTENT_NOT_FOUND", "内容不存在。", 404);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return contentAdminError("CONTENT_WRITE_FAILED", "删除内容失败。", 500);
  }
}
