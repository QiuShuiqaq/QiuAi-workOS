import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CommercialModule } from './commercial/commercial.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { HealthModule } from './health/health.module';
import { KernelModule } from './kernel/kernel.module';
import { OrganizationModule } from './organization/organization.module';
import { RoleModule } from './role/role.module';
import { TaskModule } from './task/task.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { MockPlatformStoreModule } from '../shared/mock/mock-platform-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AuthModule,
    BillingModule,
    MockPlatformStoreModule,
    CommercialModule,
    EntitlementModule,
    HealthModule,
    KernelModule,
    OrganizationModule,
    RoleModule,
    TaskModule,
    WorkspaceModule
  ]
})
export class AppModule {}
