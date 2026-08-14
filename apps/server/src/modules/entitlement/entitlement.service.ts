import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

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

type WorkspaceTypeForEntitlement = 'personal' | 'enterprise';

const PLAN_ORDER: PlanCode[] = [
  'PERSONAL_FREE',
  'PERSONAL_MEMBER_MONTHLY',
  'PERSONAL_MEMBER_ANNUAL',
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
];

@Injectable()
export class EntitlementService {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(MockPlatformStore)
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
    const workspace = this.store.getWorkspace(input.workspaceId);
    const subscription = this.store.getSubscription(input.workspaceId);
    const plan = this.store.getPlan(input.workspaceId);
    const plansForCheck = this.filterPlansByWorkspaceType(
      this.toPlansForCheck(demoPlans),
      workspace?.workspaceType
    );

    if (!subscription || !plan || !this.isSubscriptionUsable(subscription.status)) {
      return {
        allowed: false,
        reason: 'subscription_inactive',
        featureKey: input.featureKey,
        requiredPlan: this.findRequiredPlan(plansForCheck, input.featureKey, input.requestedAmount)
      };
    }

    return this.evaluatePlan({
      plan: {
        code: plan.code as PlanCode,
        entitlements: plan.entitlements
      },
      featureKey: input.featureKey,
      requestedAmount: input.requestedAmount,
      allPlans: plansForCheck
    });
  }

  private async checkDatabase(input: CheckEntitlementRequestDto): Promise<CheckEntitlementResponseDto> {
    const [workspace, subscription, allPlans] = await Promise.all([
      this.prismaService.workspace.findUnique({
        where: {
          id: input.workspaceId
        }
      }),
      this.prismaService.subscription.findFirst({
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
      }),
      this.prismaService.plan.findMany({
        where: {
          status: 'ACTIVE'
        },
        include: {
          entitlements: true
        }
      })
    ]);
    const plansForCheck = this.filterPlansByWorkspaceType(
      this.toPlansForCheck(allPlans),
      workspace?.type === 'ENTERPRISE' ? 'enterprise' : 'personal'
    );

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

  private filterPlansByWorkspaceType(
    plans: PlanForCheck[],
    workspaceType: WorkspaceTypeForEntitlement | undefined
  ): PlanForCheck[] {
    if (workspaceType === 'enterprise') {
      return plans.filter((plan) => !plan.code.startsWith('PERSONAL_'));
    }

    if (workspaceType === 'personal') {
      return plans.filter((plan) => !plan.code.startsWith('ENTERPRISE_'));
    }

    return plans;
  }

  private isSubscriptionUsable(status: string): boolean {
    return ['FREE', 'TRIALING', 'ACTIVE', 'free', 'trialing', 'active'].includes(status);
  }
}
