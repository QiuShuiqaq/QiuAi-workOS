import { Injectable } from '@nestjs/common';

import { demoPlans } from '../../shared/mock/platform-seed';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { ListPlansResponseDto } from './dto/list-plans-response.dto';

const PLAN_DISPLAY_ORDER = [
  'PERSONAL_FREE',
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL',
  'ENTERPRISE_CUSTOM'
];

@Injectable()
export class CommercialService {
  constructor(private readonly prismaService: PrismaService) {}

  async listPlans(): Promise<ListPlansResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      return {
        data: demoPlans
      };
    }

    const plans = await this.prismaService.plan.findMany({
      where: {
        status: 'ACTIVE'
      },
      include: {
        entitlements: {
          orderBy: {
            featureKey: 'asc'
          }
        }
      },
      orderBy: {
        code: 'asc'
      }
    });

    return {
      data: plans
        .sort((left, right) => this.getPlanDisplayIndex(left.code) - this.getPlanDisplayIndex(right.code))
        .map((plan) => ({
          code: plan.code,
          name: plan.name,
          billingCycle: plan.billingCycle,
          priceCents: plan.priceCents ?? undefined,
          currency: plan.currency ?? undefined,
          description: plan.description ?? undefined,
          entitlements: plan.entitlements.map((entitlement) => ({
            featureKey: entitlement.featureKey,
            enabled: entitlement.enabled,
            limitValue: entitlement.limitValue ?? undefined,
            limitUnit: entitlement.limitUnit ?? undefined
          }))
        }))
    };
  }

  private getPlanDisplayIndex(planCode: string): number {
    const index = PLAN_DISPLAY_ORDER.indexOf(planCode);
    return index >= 0 ? index : PLAN_DISPLAY_ORDER.length;
  }
}
