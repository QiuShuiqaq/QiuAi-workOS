export interface PlanSummary {
  code: string;
  name: string;
  billingCycle: string;
  priceCents?: number;
  currency?: string;
  description?: string;
}

export interface EntitlementSummary {
  featureKey: string;
  enabled: boolean;
  limitValue?: number;
  limitUnit?: string;
}

export interface PlanDetail extends PlanSummary {
  entitlements: EntitlementSummary[];
}

export interface ListPlansResponse {
  data: PlanDetail[];
}
