import { Injectable } from '@nestjs/common';

import { demoPlans } from '../../shared/mock/platform-seed';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KernelStatusResponse } from './kernel.dto';

@Injectable()
export class KernelService {
  constructor(private readonly prismaService: PrismaService) {}

  getStatus(): KernelStatusResponse {
    return {
      status: 'ready',
      dataModelVersion: 'platform-kernel-v1',
      databaseProvider: 'postgresql',
      prismaClientVersion: this.prismaService.clientVersion,
      plans: demoPlans.map((plan) => ({
        code: plan.code,
        name: plan.name,
        billingCycle: plan.billingCycle,
        priceCents: plan.priceCents,
        currency: plan.currency,
        description: plan.description
      }))
    };
  }
}
