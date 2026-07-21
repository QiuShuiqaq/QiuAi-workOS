import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import type { BillingCycle, PaymentProvider, PlanCode, Prisma } from '@prisma/client';

import { demoPlans } from '../../shared/mock/platform-seed';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
  buildAlipayCheckoutUrl,
  formatAmountCny,
  getAlipayGatewayUrl,
  getAlipayNotifyPath,
  getAlipayReturnPath,
  getMissingAlipayEnvKeys,
  isAlipayConfigured,
  isAlipayTradeClosed,
  isAlipayTradePaid,
  normalizeAlipayNotifyBody,
  parseAlipayDecodedBody,
  parseAlipayRawBody,
  queryAlipayTradeByOrderNo,
  validateAlipayAppContext,
  verifyAlipayNotifySignature
} from './alipay-gateway';
import { CreateBillingOrderRequestDto } from './dto/create-billing-order-request.dto';
import {
  BillingAccountSummaryDto,
  BillingOrderSummaryDto,
  BillingOverviewDto,
  BillingPlanSummaryDto,
  BillingSubscriptionSummaryDto,
  CreateBillingOrderResponseDto,
  GetBillingOverviewResponseDto,
  PaymentProviderConfigStatusDto
} from './dto/billing-overview-response.dto';

const ONLINE_BILLING_PLAN_CODES = [
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL'
] as const;

export interface AlipayNotifyProcessingResult {
  success: boolean;
  message: string;
  httpStatus: number;
}

export interface AlipayOrderSyncResult {
  data: {
    kind: 'not_found' | 'pending' | 'paid' | 'closed';
    orderNo: string;
    tradeStatus?: string;
    order?: BillingOrderSummaryDto;
  };
}

type BillingOrderWithPlan = Prisma.BillingOrderGetPayload<{
  include: {
    plan: true;
  };
}>;

@Injectable()
export class BillingService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async getOverview(workspaceId: string, cookieHeader?: string): Promise<GetBillingOverviewResponseDto> {
    await this.requireWorkspaceAccess(workspaceId, cookieHeader);

    const data = isDatabasePersistenceEnabled()
      ? await this.buildDatabaseOverview(workspaceId)
      : this.buildMockOverview(workspaceId);

    return { data };
  }

  async createOrder(
    workspaceId: string,
    input: CreateBillingOrderRequestDto,
    cookieHeader?: string
  ): Promise<CreateBillingOrderResponseDto> {
    await this.requireWorkspaceAccess(workspaceId, cookieHeader);

    const data = isDatabasePersistenceEnabled()
      ? await this.createDatabaseOrder(workspaceId, input)
      : this.createMockOrder(workspaceId, input);

    return { data };
  }

  async handleAlipayNotify(rawBody: unknown): Promise<AlipayNotifyProcessingResult> {
    if (!isDatabasePersistenceEnabled()) {
      return {
        success: false,
        message: 'Alipay notifications require database persistence mode.',
        httpStatus: 503
      };
    }

    if (!isAlipayConfigured()) {
      return {
        success: false,
        message: 'Alipay is not configured.',
        httpStatus: 503
      };
    }

    try {
      const body = normalizeAlipayNotifyBody(rawBody);
      const rawPayload = parseAlipayRawBody(body);
      const payload = parseAlipayDecodedBody(body);
      const signatureVerified = verifyAlipayNotifySignature({
        rawPayload,
        decodedPayload: payload
      });

      if (!signatureVerified) {
        return {
          success: false,
          message: 'Alipay notification signature verification failed.',
          httpStatus: 400
        };
      }

      await this.applyAlipayTradeUpdate({
        orderNo: payload.out_trade_no ?? '',
        tradeNo: payload.trade_no ?? null,
        tradeStatus: payload.trade_status ?? null,
        totalAmount: payload.total_amount ?? null,
        appId: payload.app_id ?? null,
        sellerId: payload.seller_id ?? null,
        rawPayload: payload,
        source: 'notify'
      });

      return {
        success: true,
        message: 'Alipay notification processed.',
        httpStatus: 200
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Alipay notification processing failed.',
        httpStatus: 500
      };
    }
  }

  async syncAlipayOrder(orderNo: string, cookieHeader?: string): Promise<AlipayOrderSyncResult> {
    if (!isDatabasePersistenceEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PERSISTENCE_MODE_REQUIRED',
          message: 'Alipay order sync requires database persistence mode.'
        }
      });
    }

    if (!isAlipayConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'ALIPAY_NOT_CONFIGURED',
          message: 'Alipay is not configured.',
          details: {
            missingEnvKeys: getMissingAlipayEnvKeys()
          }
        }
      });
    }

    const localOrder = await this.prismaService.billingOrder.findUnique({
      where: {
        orderNo
      },
      select: {
        workspaceId: true
      }
    });
    if (!localOrder) {
      return {
        data: {
          kind: 'not_found',
          orderNo
        }
      };
    }

    await this.requireWorkspaceAccess(localOrder.workspaceId, cookieHeader);

    const trade = await queryAlipayTradeByOrderNo(orderNo);
    if (!trade) {
      return {
        data: {
          kind: 'not_found',
          orderNo
        }
      };
    }

    const order = await this.applyAlipayTradeUpdate({
      orderNo: trade.orderNo,
      tradeNo: trade.tradeNo,
      tradeStatus: trade.tradeStatus,
      totalAmount: trade.totalAmount,
      appId: this.readStringField(trade.raw, 'appId', 'app_id'),
      sellerId: this.readStringField(trade.raw, 'sellerId', 'seller_id'),
      rawPayload: trade.raw,
      source: 'return'
    });

    if (isAlipayTradePaid(trade.tradeStatus)) {
      return {
        data: {
          kind: 'paid',
          orderNo: trade.orderNo,
          tradeStatus: trade.tradeStatus ?? undefined,
          order: order ? this.toBillingOrderSummary(order) : undefined
        }
      };
    }

    if (isAlipayTradeClosed(trade.tradeStatus)) {
      return {
        data: {
          kind: 'closed',
          orderNo: trade.orderNo,
          tradeStatus: trade.tradeStatus ?? undefined,
          order: order ? this.toBillingOrderSummary(order) : undefined
        }
      };
    }

    return {
      data: {
        kind: 'pending',
        orderNo: trade.orderNo,
        tradeStatus: trade.tradeStatus ?? undefined,
        order: order ? this.toBillingOrderSummary(order) : undefined
      }
    };
  }

  private async requireWorkspaceAccess(workspaceId: string, cookieHeader?: string) {
    await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);
  }

  private buildMockOverview(workspaceId: string): BillingOverviewDto {
    const workspace = this.store.getWorkspace(workspaceId);
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const plan = this.store.getPlan(workspaceId);
    const subscription = this.store.getSubscription(workspaceId);
    const now = '2026-07-19T00:00:00.000Z';

    return {
      workspaceId,
      billingAccount: {
        id: `billing_${workspaceId}`,
        workspaceId,
        status: 'ACTIVE',
        billingName: workspace.name,
        contactEmail: 'admin@qiuai.local',
        defaultProvider: workspace.workspaceType === 'enterprise' ? 'ALIPAY' : undefined,
        createdAt: now,
        updatedAt: now
      },
      subscription: subscription
        ? {
            id: subscription.id,
            workspaceId: subscription.workspaceId,
            planCode: subscription.planCode,
            planName: plan?.name ?? subscription.planCode,
            status: subscription.status.toUpperCase(),
            billingCycle: subscription.billingCycle.toUpperCase(),
            currentPeriodStart: subscription.currentPeriodStart,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
          }
        : null,
      currentPlan: plan ? this.toPlanSummary(plan) : null,
      paymentProviders: this.getPaymentProviderStatuses(),
      recentOrders: []
    };
  }

  private async buildDatabaseOverview(workspaceId: string): Promise<BillingOverviewDto> {
    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        billingAccount: true,
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        },
        billingOrders: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 20
        }
      }
    });

    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const subscription = workspace.subscriptions[0];

    return {
      workspaceId,
      billingAccount: workspace.billingAccount
        ? this.toBillingAccountSummary(workspace.billingAccount)
        : null,
      subscription: subscription ? this.toSubscriptionSummary(subscription) : null,
      currentPlan: subscription ? this.toPlanSummary(subscription.plan) : null,
      paymentProviders: this.getPaymentProviderStatuses(),
      recentOrders: workspace.billingOrders.map((order) => this.toBillingOrderSummary(order))
    };
  }

  private createMockOrder(
    workspaceId: string,
    input: CreateBillingOrderRequestDto
  ): BillingOrderSummaryDto {
    if (!this.isSupportedPlanCode(input.planCode)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Unsupported planCode.',
          details: { planCode: input.planCode }
        }
      });
    }

    const workspace = this.store.getWorkspace(workspaceId);
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const plan = demoPlans.find((item) => item.code === input.planCode);
    if (!plan) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan was not found.',
          details: { planCode: input.planCode }
        }
      });
    }
    this.requirePurchasablePlan(plan);

    const amountCents = this.resolveOrderAmount(input.amountCents, plan.priceCents, plan.billingCycle);
    const now = new Date();

    return {
      id: `order_${Date.now()}`,
      workspaceId,
      orderNo: this.generateOrderNo(now),
      provider: input.provider ?? 'ALIPAY',
      status: 'PENDING',
      subject: this.resolveSubject(input.subject, plan.name),
      amountCents,
      currency: input.currency ?? plan.currency ?? 'CNY',
      billingCycle: plan.billingCycle,
      planCode: plan.code,
      planName: plan.name,
      paymentUrl: undefined,
      expiresAt: this.addMinutes(now, 30).toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
  }

  private async createDatabaseOrder(
    workspaceId: string,
    input: CreateBillingOrderRequestDto
  ): Promise<BillingOrderSummaryDto> {
    if (!this.isSupportedPlanCode(input.planCode)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Unsupported planCode.',
          details: { planCode: input.planCode }
        }
      });
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        billingAccount: true,
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    const plan = await this.prismaService.plan.findUnique({
      where: { code: input.planCode as PlanCode }
    });

    if (!plan) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Plan was not found.',
          details: { planCode: input.planCode }
        }
      });
    }
    this.requirePurchasablePlan(plan);

    const billingAccount =
      workspace.billingAccount ??
      (await this.prismaService.billingAccount.create({
        data: {
          workspaceId,
          status: 'ACTIVE',
          billingName: workspace.name,
          defaultProvider: 'ALIPAY'
        }
      }));

    const provider = (input.provider ?? billingAccount.defaultProvider ?? 'ALIPAY') as PaymentProvider;
    this.requirePaymentProviderConfigured(provider);

    const amountCents = this.resolveOrderAmount(
      input.amountCents,
      plan.priceCents ?? undefined,
      plan.billingCycle
    );
    const now = new Date();
    const orderNo = this.generateOrderNo(now);
    const subject = this.resolveSubject(input.subject, plan.name);
    const period = this.resolveNextBillingPeriod(
      plan.billingCycle,
      workspace.subscriptions[0]?.currentPeriodEnd ?? now
    );
    const currency = input.currency ?? plan.currency ?? 'CNY';
    const paymentUrl =
      provider === 'ALIPAY'
        ? buildAlipayCheckoutUrl({
            orderNo,
            amountCents,
            subject,
            body: `${workspace.name} ${plan.name}`
          })
        : undefined;

    const order = await this.prismaService.billingOrder.create({
      data: {
        workspaceId,
        billingAccountId: billingAccount.id,
        planId: plan.id,
        subscriptionId: workspace.subscriptions[0]?.id,
        orderNo,
        provider,
        status: 'PENDING',
        subject,
        amountCents,
        currency,
        billingCycle: plan.billingCycle,
        periodStart: period?.start,
        periodEnd: period?.end,
        paymentUrl,
        expiresAt: this.addMinutes(now, 30),
        metadata: {
          paymentProviderReady: true,
          paymentIntegrationStage: 'ALIPAY_PAGE_PAY_READY',
          alipayNotifyPath: getAlipayNotifyPath(),
          alipayReturnPath: getAlipayReturnPath()
        },
        transactions: {
          create: {
            provider,
            status: 'INITIATED',
            amountCents,
            currency
          }
        }
      },
      include: {
        plan: true
      }
    });

    return this.toBillingOrderSummary(order);
  }

  private getPaymentProviderStatuses(): PaymentProviderConfigStatusDto[] {
    return [this.getProviderStatus('ALIPAY')];
  }

  private getProviderStatus(provider: PaymentProvider): PaymentProviderConfigStatusDto {
    if (provider !== 'ALIPAY') {
      return {
        provider,
        isConfigured: false,
        notifyPath: '',
        returnPath: '',
        missingEnvKeys: []
      };
    }

    const missingEnvKeys = getMissingAlipayEnvKeys();

    return {
      provider: 'ALIPAY',
      isConfigured: missingEnvKeys.length === 0,
      gatewayUrl: getAlipayGatewayUrl(),
      notifyPath: getAlipayNotifyPath(),
      returnPath: getAlipayReturnPath(),
      missingEnvKeys: [...missingEnvKeys]
    };
  }

  private requirePaymentProviderConfigured(provider: PaymentProvider): void {
    if (provider !== 'ALIPAY') {
      throw new BadRequestException({
        error: {
          code: 'UNSUPPORTED_PAYMENT_PROVIDER',
          message: 'Unsupported payment provider.',
          details: { provider }
        }
      });
    }

    const missingEnvKeys = getMissingAlipayEnvKeys();
    if (missingEnvKeys.length > 0) {
      throw new ServiceUnavailableException({
        error: {
          code: 'ALIPAY_NOT_CONFIGURED',
          message: 'Alipay is not configured.',
          details: {
            missingEnvKeys
          }
        }
      });
    }
  }

  private async applyAlipayTradeUpdate(input: {
    orderNo: string;
    tradeNo: string | null;
    tradeStatus: string | null;
    totalAmount: string | null;
    appId?: string | null;
    sellerId?: string | null;
    rawPayload: Record<string, unknown>;
    source: 'notify' | 'return';
  }): Promise<BillingOrderWithPlan | null> {
    const orderNo = input.orderNo.trim();
    if (!orderNo) {
      throw new Error('ALIPAY_ORDER_NO_REQUIRED');
    }

    validateAlipayAppContext({
      appId: input.appId,
      sellerId: input.sellerId
    });

    const order = await this.prismaService.billingOrder.findUnique({
      where: {
        orderNo
      },
      include: {
        plan: true
      }
    });
    if (!order) {
      throw new Error('BILLING_ORDER_NOT_FOUND');
    }

    this.ensureAlipayAmountMatches(order, input.totalAmount);

    if (isAlipayTradeClosed(input.tradeStatus)) {
      return this.markBillingOrderClosedFromAlipay(order, input);
    }

    if (!isAlipayTradePaid(input.tradeStatus)) {
      await this.recordAlipayTransaction(order, {
        tradeNo: input.tradeNo,
        status: 'INITIATED',
        notifyPayload: input.rawPayload
      });

      return order;
    }

    return this.markBillingOrderPaidFromAlipay(order, input);
  }

  private async markBillingOrderPaidFromAlipay(
    order: BillingOrderWithPlan,
    input: {
      tradeNo: string | null;
      tradeStatus: string | null;
      rawPayload: Record<string, unknown>;
      source: 'notify' | 'return';
    }
  ): Promise<BillingOrderWithPlan> {
    const now = new Date();

    return this.prismaService.$transaction(async (tx) => {
      await this.recordAlipayTransaction(
        order,
        {
          tradeNo: input.tradeNo,
          status: 'SUCCEEDED',
          notifyPayload: {
            ...input.rawPayload,
            workosSource: input.source
          },
          completedAt: now
        },
        tx
      );

      const subscriptionId = await this.activateSubscriptionForPaidOrder(order, tx);

      return tx.billingOrder.update({
        where: {
          id: order.id
        },
        data: {
          status: 'PAID',
          providerTradeNo: input.tradeNo ?? order.providerTradeNo,
          subscriptionId,
          paidAt: order.paidAt ?? now,
          metadata: {
            ...this.toJsonObject(order.metadata),
            alipayTradeStatus: input.tradeStatus,
            paymentSource: input.source
          }
        },
        include: {
          plan: true
        }
      });
    });
  }

  private async markBillingOrderClosedFromAlipay(
    order: BillingOrderWithPlan,
    input: {
      tradeNo: string | null;
      rawPayload: Record<string, unknown>;
    }
  ): Promise<BillingOrderWithPlan> {
    const now = new Date();

    return this.prismaService.$transaction(async (tx) => {
      await this.recordAlipayTransaction(
        order,
        {
          tradeNo: input.tradeNo,
          status: 'CANCELLED',
          notifyPayload: input.rawPayload,
          completedAt: now
        },
        tx
      );

      return tx.billingOrder.update({
        where: {
          id: order.id
        },
        data: {
          status: order.status === 'PAID' ? 'PAID' : 'CLOSED',
          providerTradeNo: input.tradeNo ?? order.providerTradeNo,
          closedAt: order.closedAt ?? now
        },
        include: {
          plan: true
        }
      });
    });
  }

  private async activateSubscriptionForPaidOrder(
    order: BillingOrderWithPlan,
    tx: Prisma.TransactionClient
  ): Promise<string> {
    const data = {
      workspaceId: order.workspaceId,
      planId: order.planId,
      status: 'ACTIVE' as const,
      billingCycle: order.billingCycle,
      currentPeriodStart: order.periodStart,
      currentPeriodEnd: order.periodEnd,
      cancelAtPeriodEnd: false
    };

    if (order.subscriptionId) {
      const subscription = await tx.subscription.update({
        where: {
          id: order.subscriptionId
        },
        data
      });

      return subscription.id;
    }

    const subscription = await tx.subscription.create({
      data
    });

    return subscription.id;
  }

  private async recordAlipayTransaction(
    order: BillingOrderWithPlan,
    input: {
      tradeNo: string | null;
      status: 'INITIATED' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
      notifyPayload: Record<string, unknown>;
      completedAt?: Date;
    },
    tx: Prisma.TransactionClient | PrismaService = this.prismaService
  ): Promise<void> {
    const data = {
      orderId: order.id,
      provider: 'ALIPAY' as const,
      status: input.status,
      amountCents: order.amountCents,
      currency: order.currency,
      providerTradeNo: input.tradeNo,
      notifyPayload: input.notifyPayload as Prisma.InputJsonValue,
      notifiedAt: new Date(),
      completedAt: input.completedAt
    };

    if (input.tradeNo) {
      await tx.paymentTransaction.upsert({
        where: {
          provider_providerTradeNo: {
            provider: 'ALIPAY',
            providerTradeNo: input.tradeNo
          }
        },
        update: data,
        create: data
      });
      return;
    }

    await tx.paymentTransaction.create({
      data
    });
  }

  private ensureAlipayAmountMatches(
    order: {
      amountCents: number;
      orderNo: string;
    },
    totalAmount: string | null
  ): void {
    if (!totalAmount) {
      return;
    }

    if (formatAmountCny(order.amountCents) !== formatAmountCny(Math.round(Number(totalAmount) * 100))) {
      throw new Error('ALIPAY_AMOUNT_MISMATCH');
    }
  }

  private readStringField(record: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
      if (typeof record[key] === 'string') {
        return record[key] as string;
      }
    }

    return null;
  }

  private toJsonObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private resolveOrderAmount(
    inputAmountCents: number | undefined,
    catalogAmountCents: number | undefined,
    billingCycle: string
  ): number {
    if (billingCycle === 'FREE') {
      throw new BadRequestException({
        error: {
          code: 'BILLING_ORDER_NOT_REQUIRED',
          message: 'Free plans do not require a billing order.'
        }
      });
    }

    if (!catalogAmountCents || catalogAmountCents <= 0) {
      throw new BadRequestException({
        error: {
          code: 'PLAN_PRICE_REQUIRED',
          message: 'A configured server-side plan price is required before creating paid orders.'
        }
      });
    }

    if (inputAmountCents !== undefined && inputAmountCents !== catalogAmountCents) {
      throw new BadRequestException({
        error: {
          code: 'PAYMENT_AMOUNT_MISMATCH',
          message: 'The submitted amount does not match the configured plan price.'
        }
      });
    }

    return catalogAmountCents;
  }

  private requirePurchasablePlan(plan: {
    code: string;
    billingCycle: string;
    priceCents?: number | null;
    status?: string | null;
  }): void {
    if (plan.status && plan.status !== 'ACTIVE') {
      throw new BadRequestException({
        error: {
          code: 'PLAN_NOT_PURCHASABLE',
          message: 'This plan is not available for new billing orders.',
          details: { planCode: plan.code, status: plan.status }
        }
      });
    }

    if (plan.billingCycle !== 'MONTHLY' && plan.billingCycle !== 'ANNUAL') {
      throw new BadRequestException({
        error: {
          code: 'PLAN_NOT_PURCHASABLE',
          message: 'This plan is not available for automatic online payment.',
          details: { planCode: plan.code, billingCycle: plan.billingCycle }
        }
      });
    }

    if (!plan.priceCents || plan.priceCents <= 0) {
      throw new BadRequestException({
        error: {
          code: 'PLAN_PRICE_REQUIRED',
          message: 'A configured server-side plan price is required before creating paid orders.',
          details: { planCode: plan.code }
        }
      });
    }
  }

  private resolveSubject(inputSubject: string | undefined, planName: string): string {
    const subject = inputSubject?.trim();
    return subject || `QiuAI WorkOS ${planName}`;
  }

  private resolveNextBillingPeriod(
    billingCycle: BillingCycle,
    anchorDate: Date
  ): { start: Date; end: Date } | undefined {
    if (billingCycle !== 'MONTHLY' && billingCycle !== 'ANNUAL') {
      return undefined;
    }

    const start = new Date(anchorDate);
    const end = new Date(start);
    if (billingCycle === 'MONTHLY') {
      end.setMonth(end.getMonth() + 1);
    } else {
      end.setFullYear(end.getFullYear() + 1);
    }

    return { start, end };
  }

  private generateOrderNo(now: Date): string {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `QWOS${year}${month}${day}${suffix}`;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private isSupportedPlanCode(planCode: string): planCode is PlanCode {
    return ONLINE_BILLING_PLAN_CODES.includes(planCode as (typeof ONLINE_BILLING_PLAN_CODES)[number]);
  }

  private toBillingAccountSummary(account: {
    id: string;
    workspaceId: string;
    status: string;
    billingName: string | null;
    taxId: string | null;
    contactEmail: string | null;
    defaultProvider: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): BillingAccountSummaryDto {
    return {
      id: account.id,
      workspaceId: account.workspaceId,
      status: account.status,
      billingName: account.billingName ?? undefined,
      taxId: account.taxId ?? undefined,
      contactEmail: account.contactEmail ?? undefined,
      defaultProvider: account.defaultProvider ?? undefined,
      createdAt: account.createdAt.toISOString(),
      updatedAt: account.updatedAt.toISOString()
    };
  }

  private toSubscriptionSummary(subscription: {
    id: string;
    workspaceId: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    plan: {
      code: string;
      name: string;
    };
  }): BillingSubscriptionSummaryDto {
    return {
      id: subscription.id,
      workspaceId: subscription.workspaceId,
      planCode: subscription.plan.code,
      planName: subscription.plan.name,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    };
  }

  private toPlanSummary(plan: {
    code: string;
    name: string;
    billingCycle: string;
    priceCents?: number | null;
    currency?: string | null;
    description?: string | null;
  }): BillingPlanSummaryDto {
    return {
      code: plan.code,
      name: plan.name,
      billingCycle: plan.billingCycle,
      priceCents: plan.priceCents ?? undefined,
      currency: plan.currency ?? undefined,
      description: plan.description ?? undefined
    };
  }

  private toBillingOrderSummary(order: {
    id: string;
    workspaceId: string;
    orderNo: string;
    provider: string;
    status: string;
    subject: string;
    amountCents: number;
    currency: string;
    billingCycle: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    paymentUrl: string | null;
    providerTradeNo: string | null;
    paidAt: Date | null;
    expiresAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    plan: {
      code: string;
      name: string;
    };
  }): BillingOrderSummaryDto {
    return {
      id: order.id,
      workspaceId: order.workspaceId,
      orderNo: order.orderNo,
      provider: order.provider,
      status: order.status,
      subject: order.subject,
      amountCents: order.amountCents,
      currency: order.currency,
      billingCycle: order.billingCycle,
      planCode: order.plan.code,
      planName: order.plan.name,
      periodStart: order.periodStart?.toISOString(),
      periodEnd: order.periodEnd?.toISOString(),
      paymentUrl: order.paymentUrl ?? undefined,
      providerTradeNo: order.providerTradeNo ?? undefined,
      paidAt: order.paidAt?.toISOString(),
      expiresAt: order.expiresAt?.toISOString(),
      closedAt: order.closedAt?.toISOString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    };
  }
}
