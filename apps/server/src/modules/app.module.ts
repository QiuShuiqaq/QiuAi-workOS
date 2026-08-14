import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AdminModule } from './admin/admin.module';
import { AiPointsModule } from './ai-points/ai-points.module';
import { AssetCenterModule } from './asset-center/asset-center.module';
import { AuthModule } from './auth/auth.module';
import { DesktopSyncModule } from './desktop-sync/desktop-sync.module';
import { BillingModule } from './billing/billing.module';
import { CommercialModule } from './commercial/commercial.module';
import { EntitlementModule } from './entitlement/entitlement.module';
import { InvitationModule } from './invitation/invitation.module';
import { HealthModule } from './health/health.module';
import { KernelModule } from './kernel/kernel.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
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
    AiPointsModule,
    AssetCenterModule,
    AuthModule,
    DesktopSyncModule,
    BillingModule,
    MockPlatformStoreModule,
    CommercialModule,
    EntitlementModule,
    InvitationModule,
    HealthModule,
    KernelModule,
    KnowledgeModule,
    OrganizationModule,
    RoleModule,
    RoleTemplateFactoryModule,
    TaskModule,
    WorkspaceModule
  ]
})
export class AppModule {}
