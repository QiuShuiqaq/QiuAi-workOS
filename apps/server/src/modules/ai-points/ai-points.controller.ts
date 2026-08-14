import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AiPointsService } from './ai-points.service';

function readDesktopDeviceToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  const header = request.headers['x-qiuai-device-token'];
  return Array.isArray(header) ? header[0] : header;
}

@ApiTags('ai-points')
@Controller({
  path: 'workspaces/:workspaceId/ai-points',
  version: '1'
})
export class AiPointsController {
  constructor(@Inject(AiPointsService) private readonly aiPointsService: AiPointsService) {}

  @Get('overview')
  getOverview(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.aiPointsService.getOverview(workspaceId, readDesktopDeviceToken(request), request.headers.cookie);
  }

  @Get('routes')
  listRoutes(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.aiPointsService.listRoutes(workspaceId, readDesktopDeviceToken(request), request.headers.cookie);
  }
}

@ApiTags('ai-points')
@Controller({
  path: 'workspaces/:workspaceId/desktop/official-model',
  version: '1'
})
export class DesktopOfficialModelController {
  constructor(@Inject(AiPointsService) private readonly aiPointsService: AiPointsService) {}

  @Post('invoke')
  invokeOfficialModel(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.aiPointsService.invokeOfficialModel(
      workspaceId,
      readDesktopDeviceToken(request),
      body
    );
  }
}
