import type { PlanSummary } from './commercial';

export type PaymentProvider = 'ALIPAY';

export type BillingAccountStatus = 'ACTIVE' | 'DISABLED';

export type BillingOrderStatus = 'PENDING' | 'PAID' | 'CLOSED' | 'CANCELLED' | 'FAILED';

export type PaymentTransactionStatus = 'INITIATED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface BillingAccountSummary {
  id: string;
  workspaceId: string;
  status: BillingAccountStatus;
  billingName?: string;
  taxId?: string;
  contactEmail?: string;
  defaultProvider?: PaymentProvider;
  createdAt: string;
  updatedAt: string;
}

export interface BillingSubscriptionSummary {
  id: string;
  workspaceId: string;
  planCode: string;
  planName: string;
  status: string;
  billingCycle: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd: boolean;
}

export interface PaymentProviderConfigStatus {
  provider: PaymentProvider;
  isConfigured: boolean;
  gatewayUrl?: string;
  notifyPath: string;
  returnPath: string;
  missingEnvKeys: string[];
}

export interface BillingOrderSummary {
  id: string;
  workspaceId: string;
  orderNo: string;
  provider: PaymentProvider;
  status: BillingOrderStatus;
  subject: string;
  amountCents: number;
  currency: string;
  billingCycle: string;
  planCode: string;
  planName: string;
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

export interface BillingOverview {
  workspaceId: string;
  billingAccount: BillingAccountSummary | null;
  subscription: BillingSubscriptionSummary | null;
  currentPlan: PlanSummary | null;
  paymentProviders: PaymentProviderConfigStatus[];
  recentOrders: BillingOrderSummary[];
}

export interface GetBillingOverviewResponse {
  data: BillingOverview;
}

export interface CreateBillingOrderRequest {
  planCode: string;
  provider?: PaymentProvider;
  amountCents?: number;
  currency?: string;
  subject?: string;
}

export interface CreateBillingOrderResponse {
  data: BillingOrderSummary;
}

export interface AlipayNotifyResponse {
  success: boolean;
  message: string;
}
