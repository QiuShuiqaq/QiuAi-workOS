import { z } from "zod";

const entitlementSchema = z.object({
  featureKey: z.string(),
  enabled: z.boolean(),
  limitValue: z.number().optional(),
  limitUnit: z.string().optional(),
});

const planSchema = z.object({
  code: z.string(),
  name: z.string(),
  billingCycle: z.string(),
  priceCents: z.number().optional(),
  currency: z.string().optional(),
  description: z.string().optional(),
  entitlements: z.array(entitlementSchema),
});

const planResponseSchema = z.object({
  data: z.array(planSchema),
});

export type PublicPlan = z.infer<typeof planSchema>;

function normalizeBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function getServerBaseUrl() {
  return normalizeBaseUrl(
    process.env.SERVER_INTERNAL_BASE_URL?.trim() ||
      process.env.SERVER_API_BASE_URL?.trim() ||
      "http://127.0.0.1:4100",
  );
}

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(new URL("/api/v1/commercial/plans", getServerBaseUrl()), {
      cache: "no-store",
      headers: {
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const body = await response.json().catch(() => null);
    const parsed = planResponseSchema.safeParse(body);
    return parsed.success ? parsed.data.data : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
