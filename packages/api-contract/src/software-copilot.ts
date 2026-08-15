import type { PaymentProvider } from './billing';

export type SoftwareCopilotBillingCycle = 'MONTHLY' | 'ANNUAL';

export type SoftwareCopilotProductStatus = 'ACTIVE' | 'COMING_SOON' | 'ARCHIVED';

export type SoftwareCopilotLicenseStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export type SoftwareCopilotDeviceBindingStatus = 'ACTIVE' | 'REVOKED';

export type SoftwareCopilotOrderStatus = 'PENDING' | 'PAID' | 'CLOSED' | 'CANCELLED' | 'FAILED';

export type SoftwareCopilotWorkspaceType = 'personal' | 'enterprise';

export interface SoftwareCopilotProductSummary {
  code: string;
  name: string;
  softwareName: string;
  category: string;
  description: string;
  status: SoftwareCopilotProductStatus;
  platforms: string[];
  capabilities: string[];
  personalMonthlyPriceCents: number;
  personalAnnualPriceCents: number;
  enterpriseMonthlyUnitPriceCents: number;
  enterpriseAnnualUnitPriceCents: number;
  currency: string;
  sortOrder: number;
}

export interface SoftwareCopilotLicenseSummary {
  id: string;
  workspaceId: string;
  productCode: string;
  productName: string;
  status: SoftwareCopilotLicenseStatus;
  billingCycle: SoftwareCopilotBillingCycle;
  seatLimit: number;
  assignedSeatCount: number;
  availableSeatCount: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SoftwareCopilotDeviceBindingSummary {
  id: string;
  workspaceId: string;
  licenseId: string;
  productCode: string;
  productName: string;
  desktopDeviceId: string;
  deviceName: string;
  deviceId: string;
  runtimeId: string;
  status: SoftwareCopilotDeviceBindingStatus;
  boundAt: string;
  revokedAt?: string;
}

export interface SoftwareCopilotEntitlementSummary {
  canPurchase: boolean;
  canUse: boolean;
  reason?: string;
  seatLimit: number;
  assignedSeatCount: number;
  availableSeatCount: number;
}

export interface SoftwareCopilotCatalogItem {
  product: SoftwareCopilotProductSummary;
  licenses: SoftwareCopilotLicenseSummary[];
  deviceBinding?: SoftwareCopilotDeviceBindingSummary;
  activeBindings: SoftwareCopilotDeviceBindingSummary[];
  entitlement: SoftwareCopilotEntitlementSummary;
}

export interface ListSoftwareCopilotsResponse {
  data: SoftwareCopilotCatalogItem[];
  workspaceId: string;
  workspaceType: SoftwareCopilotWorkspaceType;
}

export interface CreateSoftwareCopilotOrderRequest {
  productCode: string;
  billingCycle: SoftwareCopilotBillingCycle;
  seatCount?: number;
  provider?: PaymentProvider;
}

export interface SoftwareCopilotOrderSummary {
  id: string;
  workspaceId: string;
  orderNo: string;
  provider: PaymentProvider;
  status: SoftwareCopilotOrderStatus;
  subject: string;
  amountCents: number;
  currency: string;
  billingCycle: SoftwareCopilotBillingCycle;
  productCode: string;
  productName: string;
  seatCount: number;
  periodStart?: string;
  periodEnd?: string;
  paymentUrl?: string;
  providerTradeNo?: string;
  paidAt?: string;
  expiresAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSoftwareCopilotOrderResponse {
  data: SoftwareCopilotOrderSummary;
}

export interface BindSoftwareCopilotDeviceRequest {
  desktopDeviceId: string;
  licenseId?: string;
}

export interface BindSoftwareCopilotDeviceResponse {
  data: SoftwareCopilotDeviceBindingSummary;
}

export interface RevokeSoftwareCopilotDeviceBindingResponse {
  data: SoftwareCopilotDeviceBindingSummary;
}
