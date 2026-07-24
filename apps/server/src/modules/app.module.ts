import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { DesktopSyncModule } from './desktop-sync/desktop-sync.module';
import { BillingModule } from './billing/billing.module';
import { CommercialModule } from './commercial/commercial.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { InvitationModule } from './invitation/invitation.module';
import { HealthModule } from './health/health.module';
import { KernelModule } from './kernel/kernel.module';
import { OrganizationModule } from './organization/organization.module';
import { RoleModule } from './role/role.module';
import { RoleTemplateFactoryModule } from './role-template-factory/role-template-factory.module';
import { TaskModule } from './task/task.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { MockPlatformStoreModule } from '../shared/mock/mock-platform-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    AdminModule,
    AuthModule,
    DesktopSyncModule,
    BillingModule,
    MockPlatformStoreModule,
    CommercialModule,
    EntitlementModule,
    InvitationModule,
    HealthModule,
    KernelModule,
    OrganizationModule,
    RoleModule,
    RoleTemplateFactoryModule,
    TaskModule,
    WorkspaceModule
  ]
})
export class AppModule {}
