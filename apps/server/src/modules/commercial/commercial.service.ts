import { Injectable } from '@nestjs/common';

import { demoPlans } from '../../shared/mock/platform-seed';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { ListPlansResponseDto } from './dto/list-plans-response.dto';

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
      data: plans.map((plan) => ({
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
}
