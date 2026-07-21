import { Inject, Injectable } from '@nestjs/common';

import { demoPlans } from '../../shared/mock/platform-seed';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { KernelStatusResponse } from './kernel.dto';

@Injectable()
export class KernelService {
  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async getStatus(): Promise<KernelStatusResponse> {
    if (!isDatabasePersistenceEnabled()) {
      return {
        status: 'ready',
        dataModelVersion: 'platform-kernel-v1',
        databaseProvider: 'postgresql',
        persistenceMode: 'mock',
        databaseReady: false,
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

    const [planCount, tenantCount, workspaceCount] = await this.prismaService.$transaction([
      this.prismaService.plan.count(),
      this.prismaService.tenant.count(),
      this.prismaService.workspace.count()
    ]);

    return {
      status: 'ready',
      dataModelVersion: 'platform-kernel-v1',
      databaseProvider: 'postgresql',
      persistenceMode: 'database',
      databaseReady: true,
      prismaClientVersion: this.prismaService.clientVersion,
      plans: await this.loadDatabasePlans(),
      databasePlanCount: planCount,
      databaseTenantCount: tenantCount,
      databaseWorkspaceCount: workspaceCount
    };
  }

  private async loadDatabasePlans() {
    const plans = await this.prismaService.plan.findMany({
      orderBy: {
        code: 'asc'
      }
    });

    return plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      billingCycle: plan.billingCycle,
      priceCents: plan.priceCents ?? undefined,
      currency: plan.currency ?? undefined,
      description: plan.description ?? undefined
    }));
  }
}
