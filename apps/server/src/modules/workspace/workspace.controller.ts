import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentAccountResponseDto } from './dto/current-account-response.dto';
import { PlatformOverviewResponseDto } from './dto/platform-overview-response.dto';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspaces')
@Controller({
  path: 'workspaces',
  version: '1'
})
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('current')
  @ApiOkResponse({ type: CurrentAccountResponseDto })
  getCurrentAccount(): CurrentAccountResponseDto {
    return this.workspaceService.getCurrentAccount();
  }

  @Get(':workspaceId/overview')
  @ApiOkResponse({ type: PlatformOverviewResponseDto })
  getOverview(@Param('workspaceId') workspaceId: string): PlatformOverviewResponseDto {
    return this.workspaceService.getOverview(workspaceId);
  }
}
