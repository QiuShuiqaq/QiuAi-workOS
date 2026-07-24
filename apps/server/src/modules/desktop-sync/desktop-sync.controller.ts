import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { DesktopSyncService } from './desktop-sync.service';

function readDesktopDeviceToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  const header = request.headers['x-qiuai-device-token'];
  return Array.isArray(header) ? header[0] : header;
}

@ApiTags('desktop')
@Controller({
  path: 'workspaces/:workspaceId/desktop/runtimes',
  version: '1'
})
export class DesktopSyncController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Post('sync')
  syncRuntime(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.desktopSyncService.syncRuntime(workspaceId, body, readDesktopDeviceToken(request));
  }
}

@ApiTags('desktop')
@Controller({
  path: 'workspaces/:workspaceId/desktop',
  version: '1'
})
export class WorkspaceDesktopController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Get('role-templates')
  listRoleTemplates(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.desktopSyncService.listAuthorizedRoleTemplates(
      workspaceId,
      readDesktopDeviceToken(request)
    );
  }

  @Get('devices')
  listDevices(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.desktopSyncService.listDevices(workspaceId, request.headers.cookie);
  }

  @Post('binding-codes')
  createBindingCode(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.desktopSyncService.createBindingCode(workspaceId, body, request.headers.cookie);
  }
}

@ApiTags('desktop')
@Controller({
  path: 'desktop/bindings',
  version: '1'
})
export class DesktopBindingController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Post('redeem')
  redeemBindingCode(@Body() body: unknown) {
    return this.desktopSyncService.redeemBindingCode(body);
  }
}
