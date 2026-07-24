import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RoleModule } from '../role/role.module';
import {
  DesktopBindingController,
  DesktopSyncController,
  WorkspaceDesktopController
} from './desktop-sync.controller';
import { DesktopSyncService } from './desktop-sync.service';

@Module({
  imports: [AuthModule, RoleModule],
  controllers: [DesktopBindingController, DesktopSyncController, WorkspaceDesktopController],
  providers: [DesktopSyncService]
})
export class DesktopSyncModule {}
