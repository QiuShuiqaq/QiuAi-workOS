import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { RoleModule } from '../role/role.module';
import {
  DesktopAgreementAcceptanceController,
  DesktopBindingController,
  DesktopReleaseController,
  DesktopRoleTemplateController,
  DesktopToolCatalogController,
  DesktopSyncController,
  WorkspaceDesktopController
} from './desktop-sync.controller';
import { DesktopSyncService } from './desktop-sync.service';

@Module({
  imports: [AuthModule, EntitlementModule, RoleModule],
  controllers: [
    DesktopAgreementAcceptanceController,
    DesktopBindingController,
    DesktopReleaseController,
    DesktopRoleTemplateController,
    DesktopToolCatalogController,
    DesktopSyncController,
    WorkspaceDesktopController
  ],
  providers: [DesktopSyncService]
})
export class DesktopSyncModule {}
