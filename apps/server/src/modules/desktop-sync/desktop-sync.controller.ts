import { Body, Controller, Inject, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { DesktopSyncService } from './desktop-sync.service';

@ApiTags('desktop')
@Controller({
  path: 'workspaces/:workspaceId/desktop/runtimes',
  version: '1'
})
export class DesktopSyncController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Post('sync')
  syncRuntime(@Param('workspaceId') workspaceId: string, @Body() body: unknown) {
    return this.desktopSyncService.syncRuntime(workspaceId, body);
  }
}
