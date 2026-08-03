import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import type { z } from "zod";

import { isContentAdminAuthenticated } from "@/modules/content-admin/auth";
import { studioCollectionSchemas, studioPageSchemas } from "@/modules/studio/schema";
import type { StudioCollectionItem, StudioCollectionName, StudioContent } from "@/types/studio";

export type ContentAdminErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "CONTENT_NOT_FOUND"
  | "CONTENT_WRITE_FAILED"
  | "INTERNAL_ERROR";

const collectionRouteMap = {
  metrics: "metrics",
  "trusted-logos": "trustedLogos",
  solutions: "solutions",
  projects: "projects",
  "case-studies": "caseStudies",
  "open-source": "openSource",
  services: "services",
  team: "team",
  "work-steps": "workSteps",
} as const satisfies Record<string, StudioCollectionName>;

const pageRouteMap = {
  home: "home",
  about: "about",
  contact: "contact",
} as const satisfies Record<string, keyof typeof studioPageSchemas>;

type StudioPageName = keyof typeof studioPageSchemas;
type AnySchema = z.ZodType<unknown>;
type ParseResult<T> = { success: true; data: T } | { success: false; error: z.ZodError };

export function contentAdminError(
  code: ContentAdminErrorCode,
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

export async function requireContentAdminAuth() {
  const authenticated = await isContentAdminAuthenticated();
  if (!authenticated) {
    return contentAdminError("UNAUTHORIZED", "请先登录内容管理后台。", 401);
  }

  return null;
}

export async function readJsonBody(request: Request) {
  return request.json().catch(() => null);
}

export function resolveCollectionName(routeValue: string): StudioCollectionName | null {
  return collectionRouteMap[routeValue as keyof typeof collectionRouteMap] ?? null;
}

export function resolvePageName(routeValue: string): StudioPageName | null {
  return pageRouteMap[routeValue as keyof typeof pageRouteMap] ?? null;
}

export function createCollectionCandidate(collectionName: StudioCollectionName, body: unknown) {
  const source = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  return {
    ...source,
    id: typeof source.id === "string" && source.id.trim() ? source.id : `${collectionName}-${randomUUID()}`,
    updatedAt: new Date().toISOString(),
  };
}

export function parseCollectionItem(collectionName: StudioCollectionName, body: unknown) {
  const schema = studioCollectionSchemas[collectionName] as AnySchema;
  return schema.safeParse(body) as ParseResult<StudioCollectionItem<typeof collectionName>>;
}

export function parsePageContent<TName extends StudioPageName>(pageName: TName, body: unknown) {
  const schema = studioPageSchemas[pageName] as unknown as z.ZodType<StudioContent[TName]>;
  return schema.safeParse(body) as ParseResult<StudioContent[TName]>;
}
