import { ForbiddenException, Injectable } from '@nestjs/common';

import { demoPlans } from '../../shared/mock/platform-seed';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { EntitlementKey } from '../../shared/types/entitlement-key';
import type { PlanCode } from '../../shared/types/plan-code';
import type { CheckEntitlementRequestDto } from './dto/check-entitlement-request.dto';
import type { CheckEntitlementResponseDto } from './dto/check-entitlement-response.dto';

type EntitlementForCheck = {
  featureKey: string;
  enabled: boolean;
  limitValue?: number | null;
};

type PlanForCheck = {
  code: PlanCode;
  entitlements: EntitlementForCheck[];
};

const PLAN_ORDER: PlanCode[] = [
  'PERSONAL_FREE',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
];

@Injectable()
export class EntitlementService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly store: MockPlatformStore
  ) {}

  async check(input: CheckEntitlementRequestDto): Promise<CheckEntitlementResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      return this.checkMock(input);
    }

    return this.checkDatabase(input);
  }

  async requireAllowed(input: CheckEntitlementRequestDto, message = 'Workspace entitlement is required.') {
    const result = await this.check(input);
    if (result.allowed) {
      return;
    }

    throw new ForbiddenException({
      error: {
        code:
          result.reason === 'quota_exceeded'
            ? 'QUOTA_EXCEEDED'
            : result.reason === 'subscription_inactive'
              ? 'SUBSCRIPTION_INACTIVE'
              : 'PLAN_UPGRADE_REQUIRED',
        message,
        details: result
      }
    });
  }

  private checkMock(input: CheckEntitlementRequestDto): CheckEntitlementResponseDto {
    const subscription = this.store.getSubscription(input.workspaceId);
    const plan = this.store.getPlan(input.workspaceId);

    if (!subscription || !plan || !this.isSubscriptionUsable(subscription.status)) {
      return {
        allowed: false,
        reason: 'subscription_inactive',
        featureKey: input.featureKey,
        requiredPlan: this.findRequiredPlan(this.toPlansForCheck(demoPlans), input.featureKey, input.requestedAmount)
      };
    }

    return this.evaluatePlan({
      plan: {
        code: plan.code as PlanCode,
        entitlements: plan.entitlements
      },
      featureKey: input.featureKey,
      requestedAmount: input.requestedAmount,
      allPlans: this.toPlansForCheck(demoPlans)
    });
  }

  private async checkDatabase(input: CheckEntitlementRequestDto): Promise<CheckEntitlementResponseDto> {
    const subscription = await this.prismaService.subscription.findFirst({
      where: {
        workspaceId: input.workspaceId
      },
      include: {
        plan: {
          include: {
            entitlements: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const allPlans = await this.prismaService.plan.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        entitlements: true
      }
    });
    const plansForCheck = this.toPlansForCheck(allPlans);

    if (!subscription || !this.isSubscriptionUsable(subscription.status)) {
      return {
        allowed: false,
        reason: 'subscription_inactive',
        featureKey: input.featureKey,
        requiredPlan: this.findRequiredPlan(plansForCheck, input.featureKey, input.requestedAmount)
      };
    }

    return this.evaluatePlan({
      plan: {
        code: subscription.plan.code as PlanCode,
        entitlements: subscription.plan.entitlements
      },
      featureKey: input.featureKey,
      requestedAmount: input.requestedAmount,
      allPlans: plansForCheck
    });
  }

  private evaluatePlan(input: {
    plan: PlanForCheck;
    featureKey: EntitlementKey;
    requestedAmount?: number;
    allPlans: PlanForCheck[];
  }): CheckEntitlementResponseDto {
    const entitlement = input.plan.entitlements.find((item) => item.featureKey === input.featureKey);
    const requiredPlan = this.findRequiredPlan(input.allPlans, input.featureKey, input.requestedAmount);

    if (!entitlement?.enabled) {
      return {
        allowed: false,
        reason: 'entitlement_required',
        featureKey: input.featureKey,
        requiredPlan
      };
    }

    if (
      input.requestedAmount !== undefined &&
      entitlement.limitValue !== undefined &&
      entitlement.limitValue !== null &&
      input.requestedAmount > entitlement.limitValue
    ) {
      return {
        allowed: false,
        reason: 'quota_exceeded',
        featureKey: input.featureKey,
        requiredPlan,
        limitValue: entitlement.limitValue,
        usedValue: input.requestedAmount
      };
    }

    return {
      allowed: true
    };
  }

  private findRequiredPlan(
    plans: PlanForCheck[],
    featureKey: EntitlementKey,
    requestedAmount?: number
  ): PlanCode | undefined {
    return plans
      .slice()
      .sort((left, right) => PLAN_ORDER.indexOf(left.code) - PLAN_ORDER.indexOf(right.code))
      .find((plan) => {
        const entitlement = plan.entitlements.find((item) => item.featureKey === featureKey);
        if (!entitlement?.enabled) {
          return false;
        }

        if (
          requestedAmount !== undefined &&
          entitlement.limitValue !== undefined &&
          entitlement.limitValue !== null &&
          requestedAmount > entitlement.limitValue
        ) {
          return false;
        }

        return true;
      })?.code;
  }

  private toPlansForCheck(
    plans: Array<{ code: string; entitlements: EntitlementForCheck[] }>
  ): PlanForCheck[] {
    return plans.map((plan) => ({
      code: plan.code as PlanCode,
      entitlements: plan.entitlements
    }));
  }

  private isSubscriptionUsable(status: string): boolean {
    return ['FREE', 'TRIALING', 'ACTIVE', 'free', 'trialing', 'active'].includes(status);
  }
}
