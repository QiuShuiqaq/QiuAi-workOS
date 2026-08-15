import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req, Res, StreamableFile } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { DesktopSyncService } from './desktop-sync.service';
import { openDesktopReleaseAsset } from '../../shared/desktop-release-assets';
import { KnowledgeService } from '../knowledge/knowledge.service';
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

function readClientIpAddress(request: FastifyRequest): string | undefined {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const firstForwardedIp = forwardedValue?.split(',')[0]?.trim();
  return firstForwardedIp || request.ip;
}

function readUserAgent(request: FastifyRequest): string | undefined {
  const userAgent = request.headers['user-agent'];
  return Array.isArray(userAgent) ? userAgent[0] : userAgent;
}

function parseInstalledTemplateIds(value: unknown): string[] {
  const values = Array.isArray(value) ? value : value === undefined ? [] : [value];
  return [
    ...new Set(
      values
        .flatMap((item) => (typeof item === 'string' ? item.split(',') : []))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ];
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
  constructor(
    @Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService,
    @Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService
  ) {}

  @Get('tools')
  listTools(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.desktopSyncService.listDesktopToolActionCatalog(workspaceId, readDesktopDeviceToken(request));
  }

  @Get('knowledge-base/runtime-context')
  async getEnterpriseKnowledgeRuntimeContext(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ) {
    await this.desktopSyncService.requireDesktopDeviceWorkspaceAccess(workspaceId, readDesktopDeviceToken(request));
    return this.knowledgeService.getEnterpriseKnowledgeRuntimeContext(workspaceId);
  }

  @Get('role-templates')
  listRoleTemplates(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest,
    @Query('installedTemplateIds') installedTemplateIds: string | string[] | undefined
  ) {
    return this.desktopSyncService.listAuthorizedRoleTemplates(
      workspaceId,
      readDesktopDeviceToken(request),
      parseInstalledTemplateIds(installedTemplateIds)
    );
  }

  @Get('devices')
  listDevices(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.desktopSyncService.listDevices(workspaceId, request.headers.cookie);
  }

  @Post('devices/:deviceId/revoke')
  revokeDevice(
    @Param('workspaceId') workspaceId: string,
    @Param('deviceId') deviceId: string,
    @Req() request: FastifyRequest
  ) {
    return this.desktopSyncService.revokeDevice(workspaceId, deviceId, request.headers.cookie);
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
  path: 'desktop/agreement-acceptances',
  version: '1'
})
export class DesktopAgreementAcceptanceController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Get('status')
  getAcceptanceStatus(@Query() query: Record<string, unknown>) {
    return this.desktopSyncService.getDesktopAgreementAcceptanceStatus(query);
  }

  @Post()
  acceptAgreement(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.desktopSyncService.acceptDesktopAgreement(body, {
      deviceToken: readDesktopDeviceToken(request),
      ipAddress: readClientIpAddress(request),
      userAgent: readUserAgent(request)
    });
  }
}

@ApiTags('desktop')
@Controller({
  path: 'desktop/issue-reports',
  version: '1'
})
export class DesktopIssueReportController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Post()
  submitIssueReport(@Body() body: unknown, @Req() request: FastifyRequest) {
    return this.desktopSyncService.createDesktopIssueReport(body, {
      deviceToken: readDesktopDeviceToken(request)
    });
  }
}

@ApiTags('desktop')
@Controller({
  path: 'desktop/role-templates',
  version: '1'
})
export class DesktopRoleTemplateController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Get('free')
  listPublicFreeRoleTemplates(
    @Query('installedTemplateIds') installedTemplateIds: string | string[] | undefined
  ) {
    return this.desktopSyncService.listPublicFreeRoleTemplates(
      parseInstalledTemplateIds(installedTemplateIds)
    );
  }
}

@ApiTags('desktop')
@Controller({
  path: 'desktop/tools',
  version: '1'
})
export class DesktopToolCatalogController {
  constructor(@Inject(DesktopSyncService) private readonly desktopSyncService: DesktopSyncService) {}

  @Get()
  listPublicTools() {
    return this.desktopSyncService.listDesktopToolActionCatalog();
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
