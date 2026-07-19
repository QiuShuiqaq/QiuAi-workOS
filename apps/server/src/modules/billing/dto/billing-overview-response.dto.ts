import { ApiProperty } from '@nestjs/swagger';

export class BillingPlanSummaryDto {
  @ApiProperty({ example: 'ENTERPRISE_MONTHLY' })
  code!: string;

  @ApiProperty({ example: 'Enterprise Monthly' })
  name!: string;

  @ApiProperty({ example: 'MONTHLY' })
  billingCycle!: string;

  @ApiProperty({ example: 29900, required: false })
  priceCents?: number;

  @ApiProperty({ example: 'CNY', required: false })
  currency?: string;

  @ApiProperty({ example: 'Monthly enterprise workspace.', required: false })
  description?: string;
}

export class BillingAccountSummaryDto {
  @ApiProperty({ example: '80000000-0000-4000-8000-000000000002' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 'QiuAI Demo Enterprise', required: false })
  billingName?: string;

  @ApiProperty({ example: '91310000MA1K000000', required: false })
  taxId?: string;

  @ApiProperty({ example: 'admin@qiuai.local', required: false })
  contactEmail?: string;

  @ApiProperty({ example: 'ALIPAY', required: false })
  defaultProvider?: string;

  @ApiProperty({ example: '2026-07-19T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-19T00:00:00.000Z' })
  updatedAt!: string;
}

export class BillingSubscriptionSummaryDto {
  @ApiProperty({ example: '70000000-0000-4000-8000-000000000002' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: 'ENTERPRISE_MONTHLY' })
  planCode!: string;

  @ApiProperty({ example: 'Enterprise Monthly' })
  planName!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: 'MONTHLY' })
  billingCycle!: string;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z', required: false })
  currentPeriodStart?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', required: false })
  currentPeriodEnd?: string;

  @ApiProperty({ example: false })
  cancelAtPeriodEnd!: boolean;
}

export class PaymentProviderConfigStatusDto {
  @ApiProperty({ example: 'ALIPAY' })
  provider!: string;

  @ApiProperty({ example: false })
  isConfigured!: boolean;

  @ApiProperty({ example: 'https://openapi.alipay.com/gateway.do', required: false })
  gatewayUrl?: string;

  @ApiProperty({ example: '/api/v1/billing/alipay/notify' })
  notifyPath!: string;

  @ApiProperty({ example: '/billing/alipay/return' })
  returnPath!: string;

  @ApiProperty({ type: [String] })
  missingEnvKeys!: string[];
}

export class BillingOrderSummaryDto {
  @ApiProperty({ example: '90000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: 'QWOS202607190001' })
  orderNo!: string;

  @ApiProperty({ example: 'ALIPAY' })
  provider!: string;

  @ApiProperty({ example: 'PENDING' })
  status!: string;

  @ApiProperty({ example: 'QiuAI WorkOS Enterprise Monthly' })
  subject!: string;

  @ApiProperty({ example: 29900 })
  amountCents!: number;

  @ApiProperty({ example: 'CNY' })
  currency!: string;

  @ApiProperty({ example: 'MONTHLY' })
  billingCycle!: string;

  @ApiProperty({ example: 'ENTERPRISE_MONTHLY' })
  planCode!: string;

  @ApiProperty({ example: 'Enterprise Monthly' })
  planName!: string;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z', required: false })
  periodStart?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', required: false })
  periodEnd?: string;

  @ApiProperty({ example: 'https://openapi.alipay.com/gateway.do?...', required: false })
  paymentUrl?: string;

  @ApiProperty({ example: '2026071922000000000000000000', required: false })
  providerTradeNo?: string;

  @ApiProperty({ example: '2026-07-19T00:00:00.000Z', required: false })
  paidAt?: string;

  @ApiProperty({ example: '2026-07-19T00:30:00.000Z', required: false })
  expiresAt?: string;

  @ApiProperty({ example: '2026-07-19T00:30:00.000Z', required: false })
  closedAt?: string;

  @ApiProperty({ example: '2026-07-19T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-19T00:00:00.000Z' })
  updatedAt!: string;
}

export class BillingOverviewDto {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ type: BillingAccountSummaryDto, nullable: true })
  billingAccount!: BillingAccountSummaryDto | null;

  @ApiProperty({ type: BillingSubscriptionSummaryDto, nullable: true })
  subscription!: BillingSubscriptionSummaryDto | null;

  @ApiProperty({ type: BillingPlanSummaryDto, nullable: true })
  currentPlan!: BillingPlanSummaryDto | null;

  @ApiProperty({ type: [PaymentProviderConfigStatusDto] })
  paymentProviders!: PaymentProviderConfigStatusDto[];

  @ApiProperty({ type: [BillingOrderSummaryDto] })
  recentOrders!: BillingOrderSummaryDto[];
}

export class GetBillingOverviewResponseDto {
  @ApiProperty({ type: BillingOverviewDto })
  data!: BillingOverviewDto;
}

export class CreateBillingOrderResponseDto {
  @ApiProperty({ type: BillingOrderSummaryDto })
  data!: BillingOrderSummaryDto;
}

export class AlipayNotifyResponseDto {
  @ApiProperty({ example: false })
  success!: boolean;

  @ApiProperty({ example: 'Alipay notification verification is not configured yet.' })
  message!: string;
}
