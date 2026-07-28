import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AdminService } from './admin.service';
import {
  ArchiveAdminDesktopReleaseResponseDto,
  CancelAdminWorkspaceInvitationResponseDto,
  CreateAdminDesktopReleaseRequestDto,
  CreateAdminDesktopReleaseResponseDto,
  CreateAdminDesktopBindingCodeRequestDto,
  CreateAdminDesktopBindingCodeResponseDto,
  CreateAdminWorkspaceInvitationRequestDto,
  CreateAdminWorkspaceInvitationResponseDto,
  CreateAdminWorkspaceRequestDto,
  CreateAdminWorkspaceResponseDto,
  GetAdminWorkspaceResponseDto,
  GrantAdminWorkspaceAuthorizationRequestDto,
  GrantAdminWorkspaceAuthorizationResponseDto,
  ListAdminActionLogsQueryDto,
  ListAdminActionLogsResponseDto,
  ListAdminDesktopReleasesQueryDto,
  ListAdminDesktopReleasesResponseDto,
  ListAdminPlansResponseDto,
  ListAdminWorkspacesQueryDto,
  ListAdminWorkspacesResponseDto,
  PublishAdminDesktopReleaseResponseDto,
  RevokeAdminDesktopDeviceResponseDto,
  UpdateAdminDesktopReleaseRequestDto,
  UpdateAdminDesktopReleaseResponseDto,
  UploadAdminDesktopReleaseAssetResponseDto,
  UpdateAdminPlanRequestDto,
  UpdateAdminPlanResponseDto,
  UpdateAdminWorkspaceStatusRequestDto,
  UpdateAdminWorkspaceStatusResponseDto
} from './dto/admin-console.dto';

@ApiTags('admin')
@Controller({
  path: 'admin',
  version: '1'
})
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  @Get('tool-actions')
  listToolActionCatalog(@Req() request: FastifyRequest) {
    return this.adminService.listToolActionCatalog(request.headers.cookie);
  }

  @Get('plans')
  @ApiOkResponse({ type: ListAdminPlansResponseDto })
  listPlans(@Req() request: FastifyRequest): Promise<ListAdminPlansResponseDto> {
    return this.adminService.listPlans(request.headers.cookie);
  }

  @Patch('plans/:planCode')
  @ApiOkResponse({ type: UpdateAdminPlanResponseDto })
  updatePlan(
    @Param('planCode') planCode: string,
    @Body() body: UpdateAdminPlanRequestDto,
    @Req() request: FastifyRequest
  ): Promise<UpdateAdminPlanResponseDto> {
    return this.adminService.updatePlan(planCode, body, request.headers.cookie);
  }

  @Get('desktop-releases')
  @ApiOkResponse({ type: ListAdminDesktopReleasesResponseDto })
  listDesktopReleases(
    @Query() query: ListAdminDesktopReleasesQueryDto,
    @Req() request: FastifyRequest
  ): Promise<ListAdminDesktopReleasesResponseDto> {
    return this.adminService.listDesktopReleases(query, request.headers.cookie);
  }

  @Post('desktop-releases')
  @ApiOkResponse({ type: CreateAdminDesktopReleaseResponseDto })
  createDesktopRelease(
    @Body() body: CreateAdminDesktopReleaseRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateAdminDesktopReleaseResponseDto> {
    return this.adminService.createDesktopRelease(body, request.headers.cookie);
  }

  @Patch('desktop-releases/:releaseId')
  @ApiOkResponse({ type: UpdateAdminDesktopReleaseResponseDto })
  updateDesktopRelease(
    @Param('releaseId') releaseId: string,
    @Body() body: UpdateAdminDesktopReleaseRequestDto,
    @Req() request: FastifyRequest
  ): Promise<UpdateAdminDesktopReleaseResponseDto> {
    return this.adminService.updateDesktopRelease(releaseId, body, request.headers.cookie);
  }

  @Post('desktop-releases/:releaseId/publish')
  @ApiOkResponse({ type: PublishAdminDesktopReleaseResponseDto })
  publishDesktopRelease(
    @Param('releaseId') releaseId: string,
    @Req() request: FastifyRequest
  ): Promise<PublishAdminDesktopReleaseResponseDto> {
    return this.adminService.publishDesktopRelease(releaseId, request.headers.cookie);
  }

  @Post('desktop-releases/:releaseId/archive')
  @ApiOkResponse({ type: ArchiveAdminDesktopReleaseResponseDto })
  archiveDesktopRelease(
    @Param('releaseId') releaseId: string,
    @Req() request: FastifyRequest
  ): Promise<ArchiveAdminDesktopReleaseResponseDto> {
    return this.adminService.archiveDesktopRelease(releaseId, request.headers.cookie);
  }

  @Post('desktop-release-assets')
  @ApiConsumes('application/octet-stream')
  @ApiOkResponse({ type: UploadAdminDesktopReleaseAssetResponseDto })
  uploadDesktopReleaseAsset(
    @Body() body: Buffer,
    @Req() request: FastifyRequest
  ): Promise<UploadAdminDesktopReleaseAssetResponseDto> {
    return this.adminService.uploadDesktopReleaseAsset({
      cookieHeader: request.headers.cookie,
      fileName: readSingleHeader(request.headers['x-qiuai-file-name']) ?? 'QiuAI-WorkOS-Setup.exe',
      contentType: readSingleHeader(request.headers['content-type']),
      body: Buffer.isBuffer(body) ? body : Buffer.alloc(0)
    });
  }

  @Get('workspaces')
  @ApiOkResponse({ type: ListAdminWorkspacesResponseDto })
  listWorkspaces(
    @Query() query: ListAdminWorkspacesQueryDto,
    @Req() request: FastifyRequest
  ): Promise<ListAdminWorkspacesResponseDto> {
    return this.adminService.listWorkspaces(query, request.headers.cookie);
  }

  @Post('workspaces')
  @ApiOkResponse({ type: CreateAdminWorkspaceResponseDto })
  createWorkspace(
    @Body() body: CreateAdminWorkspaceRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateAdminWorkspaceResponseDto> {
    return this.adminService.createWorkspace(body, request.headers.cookie);
  }

  @Get('workspaces/:workspaceId')
  @ApiOkResponse({ type: GetAdminWorkspaceResponseDto })
  getWorkspace(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<GetAdminWorkspaceResponseDto> {
    return this.adminService.getWorkspace(workspaceId, request.headers.cookie);
  }

  @Post('workspaces/:workspaceId/invitations')
  @ApiOkResponse({ type: CreateAdminWorkspaceInvitationResponseDto })
  createWorkspaceInvitation(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateAdminWorkspaceInvitationRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateAdminWorkspaceInvitationResponseDto> {
    return this.adminService.createWorkspaceInvitation(workspaceId, body, request.headers.cookie);
  }

  @Post('workspaces/:workspaceId/invitations/:invitationId/cancel')
  @ApiOkResponse({ type: CancelAdminWorkspaceInvitationResponseDto })
  cancelWorkspaceInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: FastifyRequest
  ): Promise<CancelAdminWorkspaceInvitationResponseDto> {
    return this.adminService.cancelWorkspaceInvitation(workspaceId, invitationId, request.headers.cookie);
  }

  @Post('workspaces/:workspaceId/desktop-binding-codes')
  @ApiOkResponse({ type: CreateAdminDesktopBindingCodeResponseDto })
  createDesktopBindingCode(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateAdminDesktopBindingCodeRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateAdminDesktopBindingCodeResponseDto> {
    return this.adminService.createDesktopBindingCode(workspaceId, body, request.headers.cookie);
  }

  @Post('workspaces/:workspaceId/desktop-devices/:deviceId/revoke')
  @ApiOkResponse({ type: RevokeAdminDesktopDeviceResponseDto })
  revokeDesktopDevice(
    @Param('workspaceId') workspaceId: string,
    @Param('deviceId') deviceId: string,
    @Req() request: FastifyRequest
  ): Promise<RevokeAdminDesktopDeviceResponseDto> {
    return this.adminService.revokeDesktopDevice(workspaceId, deviceId, request.headers.cookie);
  }

  @Patch('workspaces/:workspaceId/status')
  @ApiOkResponse({ type: UpdateAdminWorkspaceStatusResponseDto })
  updateWorkspaceStatus(
    @Param('workspaceId') workspaceId: string,
    @Body() body: UpdateAdminWorkspaceStatusRequestDto,
    @Req() request: FastifyRequest
  ): Promise<UpdateAdminWorkspaceStatusResponseDto> {
    return this.adminService.updateWorkspaceStatus(workspaceId, body, request.headers.cookie);
  }

  @Post('workspaces/:workspaceId/manual-authorizations')
  @ApiOkResponse({ type: GrantAdminWorkspaceAuthorizationResponseDto })
  grantWorkspaceAuthorization(
    @Param('workspaceId') workspaceId: string,
    @Body() body: GrantAdminWorkspaceAuthorizationRequestDto,
    @Req() request: FastifyRequest
  ): Promise<GrantAdminWorkspaceAuthorizationResponseDto> {
    return this.adminService.grantWorkspaceAuthorization(workspaceId, body, request.headers.cookie);
  }

  @Get('action-logs')
  @ApiOkResponse({ type: ListAdminActionLogsResponseDto })
  listActionLogs(
    @Query() query: ListAdminActionLogsQueryDto,
    @Req() request: FastifyRequest
  ): Promise<ListAdminActionLogsResponseDto> {
    return this.adminService.listActionLogs(query, request.headers.cookie);
  }
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
