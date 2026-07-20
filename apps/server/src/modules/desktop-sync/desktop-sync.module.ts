import { Module } from '@nestjs/common';

import { DesktopSyncController } from './desktop-sync.controller';
import { DesktopSyncService } from './desktop-sync.service';

@Module({
  controllers: [DesktopSyncController],
  providers: [DesktopSyncService]
})
export class DesktopSyncModule {}
