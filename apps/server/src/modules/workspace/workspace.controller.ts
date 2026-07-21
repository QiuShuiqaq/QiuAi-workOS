import { Controller, Get, Inject, Param, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { CurrentAccountResponseDto } from './dto/current-account-response.dto';
import { PlatformOverviewResponseDto } from './dto/platform-overview-response.dto';
import { WorkspaceService } from './workspace.service';

@ApiTags('workspaces')
@Controller({
  path: 'workspaces',
  version: '1'
})
export class WorkspaceController {
  constructor(@Inject(WorkspaceService) private readonly workspaceService: WorkspaceService) {}

  @Get('current')
  @ApiOkResponse({ type: CurrentAccountResponseDto })
  async getCurrentAccount(@Req() request: FastifyRequest): Promise<CurrentAccountResponseDto> {
    return this.workspaceService.getCurrentAccount(request.headers.cookie);
  }

  @Get(':workspaceId/overview')
  @ApiOkResponse({ type: PlatformOverviewResponseDto })
  async getOverview(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<PlatformOverviewResponseDto> {
    return this.workspaceService.getOverview(workspaceId, request.headers.cookie);
  }
}
