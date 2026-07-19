import { randomUUID } from 'node:crypto';

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { BillingCycle, PaymentProvider, PlanCode } from '@prisma/client';

import { demoPlans } from '../../shared/mock/platform-seed';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateBillingOrderRequestDto } from './dto/create-billing-order-request.dto';
import {
  AlipayNotifyResponseDto,
  BillingAccountSummaryDto,
  BillingOrderSummaryDto,
  BillingOverviewDto,
  BillingPlanSummaryDto,
  BillingSubscriptionSummaryDto,
  CreateBillingOrderResponseDto,
  GetBillingOverviewResponseDto,
  PaymentProviderConfigStatusDto
} from './dto/billing-overview-response.dto';

const PLAN_CODES = [
  'PERSONAL_FREE',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
] as const;

const ALIPAY_REQUIRED_ENV_KEYS = [
  'PAYMENT_ALIPAY_APP_ID',
  'PAYMENT_ALIPAY_PRIVATE_KEY',
  'PAYMENT_ALIPAY_PUBLIC_KEY'
] as const;

@Injectable()
export class BillingService {
  constructor(
    private readonly store: MockPlatformStore,
    private readonly prismaService: PrismaService
  ) {}

  async getOverview(workspaceId: string): Promise<GetBillingOverviewResponseDto> {
    const data = isDatabasePersistenceEnabled()
      ? await this.buildDatabaseOverview(workspaceId)
      : this.buildMockOverview(workspaceId);

    return { data };
  }

  async createOrder(
    workspaceId: string,
    input: CreateBillingOrderRequestDto
  ): Promise<CreateBillingOrderResponseDto> {
    const data = isDatabasePersistenceEnabled()
      ? await this.createDatabaseOrder(workspaceId, input)
      : this.createMockOrder(workspaceId, input);

    return { data };
  }

  handleAlipayNotify(): AlipayNotifyResponseDto {
    return {
      success: false,
      message: 'Alipay notification verification is reserved and not enabled yet.'
    };
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
    const amountCents = this.resolveOrderAmount(
      input.amountCents,
      plan.priceCents ?? undefined,
      plan.billingCycle
    );
    const now = new Date();
    const period = this.resolveNextBillingPeriod(
      plan.billingCycle,
      workspace.subscriptions[0]?.currentPeriodEnd ?? now
    );
    const currency = input.currency ?? plan.currency ?? 'CNY';

    const order = await this.prismaService.billingOrder.create({
      data: {
        workspaceId,
        billingAccountId: billingAccount.id,
        planId: plan.id,
        subscriptionId: workspace.subscriptions[0]?.id,
        orderNo: this.generateOrderNo(now),
        provider,
        status: 'PENDING',
        subject: this.resolveSubject(input.subject, plan.name),
        amountCents,
        currency,
        billingCycle: plan.billingCycle,
        periodStart: period?.start,
        periodEnd: period?.end,
        expiresAt: this.addMinutes(now, 30),
        metadata: {
          paymentProviderReady: this.getProviderStatus(provider).isConfigured,
          paymentIntegrationStage: 'CONFIG_RESERVED'
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

    const missingEnvKeys = ALIPAY_REQUIRED_ENV_KEYS.filter((key) => !process.env[key]);

    return {
      provider: 'ALIPAY',
      isConfigured: missingEnvKeys.length === 0,
      gatewayUrl: process.env.PAYMENT_ALIPAY_GATEWAY_URL ?? 'https://openapi.alipay.com/gateway.do',
      notifyPath: process.env.PAYMENT_ALIPAY_NOTIFY_PATH ?? '/api/v1/billing/alipay/notify',
      returnPath: process.env.PAYMENT_ALIPAY_RETURN_PATH ?? '/billing/alipay/return',
      missingEnvKeys: [...missingEnvKeys]
    };
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

    const amountCents = inputAmountCents ?? catalogAmountCents;
    if (!amountCents || amountCents <= 0) {
      throw new BadRequestException({
        error: {
          code: 'PAYMENT_AMOUNT_REQUIRED',
          message: 'A positive amountCents is required for this plan.'
        }
      });
    }

    return amountCents;
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
    return PLAN_CODES.includes(planCode as (typeof PLAN_CODES)[number]);
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
