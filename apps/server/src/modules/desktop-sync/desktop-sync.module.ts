import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { RoleModule } from '../role/role.module';
import {
  DesktopAccountAuthController,
  DesktopAgreementAcceptanceController,
  DesktopBindingController,
  DesktopIssueReportController,
  DesktopReleaseController,
  DesktopRoleTemplateController,
  DesktopToolCatalogController,
  DesktopSyncController,
  WorkspaceDesktopController
} from './desktop-sync.controller';
import { DesktopSyncService } from './desktop-sync.service';

@Module({
  imports: [AuthModule, EntitlementModule, KnowledgeModule, RoleModule],
  controllers: [
    DesktopAccountAuthController,
    DesktopAgreementAcceptanceController,
    DesktopBindingController,
    DesktopIssueReportController,
    DesktopReleaseController,
    DesktopRoleTemplateController,
    DesktopToolCatalogController,
    DesktopSyncController,
    WorkspaceDesktopController
  ],
  providers: [DesktopSyncService]
})
export class DesktopSyncModule {}
