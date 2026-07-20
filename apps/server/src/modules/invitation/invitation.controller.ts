import { Body, Controller, Get, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { AcceptWorkspaceInvitationRequestDto } from './dto/accept-workspace-invitation-request.dto';
import {
  CancelWorkspaceInvitationResponseDto,
  CreateWorkspaceInvitationResponseDto,
  GetPublicInvitationResponseDto,
  ListWorkspaceInvitationsResponseDto
} from './dto/workspace-invitation-response.dto';
import { CreateWorkspaceInvitationRequestDto } from './dto/create-workspace-invitation-request.dto';
import { serializeSessionCookie } from '../../shared/auth/session-cookie';
import { InvitationService } from './invitation.service';
import { AuthSessionResponseDto } from '../auth/dto/auth-session-response.dto';

@ApiTags('invitations')
@Controller({
  path: 'invitations',
  version: '1'
})
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get(':token')
  @ApiOkResponse({ type: GetPublicInvitationResponseDto })
  getPublicInvitation(@Param('token') token: string): Promise<GetPublicInvitationResponseDto> {
    return this.invitationService.getPublicInvitation(token);
  }

  @Post(':token/accept')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  async acceptInvitation(
    @Param('token') token: string,
    @Body() body: AcceptWorkspaceInvitationRequestDto,
    @Res({ passthrough: true }) reply: FastifyReply,
    @Req() request: FastifyRequest
  ) {
    const result = await this.invitationService.acceptWorkspaceInvitation(token, body, {
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip
    });

    reply.header('set-cookie', serializeSessionCookie(result.sessionToken, result.maxAgeSeconds));
    return result.response;
  }
}

@ApiTags('workspace invitations')
@Controller({
  path: 'workspaces/:workspaceId/invitations',
  version: '1'
})
export class WorkspaceInvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Get()
  @ApiOkResponse({ type: ListWorkspaceInvitationsResponseDto })
  listWorkspaceInvitations(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<ListWorkspaceInvitationsResponseDto> {
    return this.invitationService.listWorkspaceInvitations(workspaceId, request.headers.cookie);
  }

  @Post()
  @ApiOkResponse({ type: CreateWorkspaceInvitationResponseDto })
  createWorkspaceInvitation(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateWorkspaceInvitationRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateWorkspaceInvitationResponseDto> {
    return this.invitationService.createWorkspaceInvitation(workspaceId, body, request.headers.cookie);
  }

  @Post(':invitationId/cancel')
  @ApiOkResponse({ type: CancelWorkspaceInvitationResponseDto })
  cancelWorkspaceInvitation(
    @Param('workspaceId') workspaceId: string,
    @Param('invitationId') invitationId: string,
    @Req() request: FastifyRequest
  ): Promise<CancelWorkspaceInvitationResponseDto> {
    return this.invitationService.cancelWorkspaceInvitation(workspaceId, invitationId, request.headers.cookie);
  }
}
