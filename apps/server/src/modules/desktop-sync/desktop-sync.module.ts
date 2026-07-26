import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { RoleModule } from '../role/role.module';
import {
  DesktopBindingController,
  DesktopReleaseController,
  DesktopSyncController,
  WorkspaceDesktopController
} from './desktop-sync.controller';
import { DesktopSyncService } from './desktop-sync.service';

@Module({
  imports: [AuthModule, EntitlementModule, RoleModule],
  controllers: [
    DesktopBindingController,
    DesktopReleaseController,
    DesktopSyncController,
    WorkspaceDesktopController
  ],
  providers: [DesktopSyncService]
})
export class DesktopSyncModule {}
