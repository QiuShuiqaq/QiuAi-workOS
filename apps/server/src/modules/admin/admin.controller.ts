import { Body, Controller, Get, Inject, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AdminService } from './admin.service';
import {
  CancelAdminWorkspaceInvitationResponseDto,
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
  ListAdminPlansResponseDto,
  ListAdminWorkspacesQueryDto,
  ListAdminWorkspacesResponseDto,
  RevokeAdminDesktopDeviceResponseDto,
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
