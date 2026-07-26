import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { DesktopSyncService } from './desktop-sync.service';
import { openDesktopReleaseAsset } from '../../shared/desktop-release-assets';
import {
  CheckDesktopUpdateQueryDto,
  CheckDesktopUpdateResponseDto
} from '../admin/dto/admin-console.dto';

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

  @Get('binding-codes')
  listBindingCodes(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.desktopSyncService.listBindingCodes(workspaceId, request.headers.cookie);
  }

  @Post('binding-codes')
  createBindingCode(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.desktopSyncService.createBindingCode(workspaceId, body, request.headers.cookie);
  }

  @Patch('binding-codes/:bindingCodeId')
  updateBindingCode(
    @Param('workspaceId') workspaceId: string,
    @Param('bindingCodeId') bindingCodeId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.desktopSyncService.updateBindingCode(workspaceId, bindingCodeId, body, request.headers.cookie);
  }

  @Post('binding-codes/:bindingCodeId/cancel')
  cancelBindingCode(
    @Param('workspaceId') workspaceId: string,
    @Param('bindingCodeId') bindingCodeId: string,
    @Req() request: FastifyRequest
  ) {
    return this.desktopSyncService.cancelBindingCode(workspaceId, bindingCodeId, request.headers.cookie);
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

@ApiTags('desktop')
@Controller({
  path: 'desktop/releases',
  version: '1'
})
export class DesktopReleaseController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Get('latest')
  @ApiOkResponse({ type: CheckDesktopUpdateResponseDto })
  checkLatestRelease(@Query() query: CheckDesktopUpdateQueryDto): Promise<CheckDesktopUpdateResponseDto> {
    return this.desktopSyncService.checkDesktopUpdate(query);
  }

  @Get('downloads/:fileName')
  async downloadReleaseAsset(
    @Param('fileName') fileName: string,
    @Res({ passthrough: true }) response: FastifyReply
  ): Promise<StreamableFile> {
    const asset = await openDesktopReleaseAsset(fileName);
    response.header('content-type', asset.contentType);
    response.header('content-length', String(asset.fileSizeBytes));
    response.header('content-disposition', `attachment; filename="${asset.fileName}"`);
    return new StreamableFile(asset.stream);
  }
}
