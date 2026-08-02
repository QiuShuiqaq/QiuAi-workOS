import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service';
import {
  GetEnterpriseKnowledgeBaseResponseDto,
  GetEnterpriseKnowledgeDocumentResponseDto,
  GetEnterpriseKnowledgeRuntimeContextResponseDto,
  UpdateEnterpriseKnowledgeProfileRequestDto,
  UpdateEnterpriseKnowledgeStatusRequestDto,
  UploadEnterpriseKnowledgePdfRequestDto
} from './dto/knowledge-base.dto';
import { KnowledgeService } from './knowledge.service';

@ApiTags('knowledge')
@Controller({
  path: 'workspaces/:workspaceId/knowledge-base',
  version: '1'
})
export class KnowledgeController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(KnowledgeService) private readonly knowledgeService: KnowledgeService
  ) {}

  @Get()
  @ApiOkResponse({ type: GetEnterpriseKnowledgeBaseResponseDto })
  async getEnterpriseKnowledgeBase(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.getEnterpriseKnowledgeBase(workspaceId);
  }

  @Patch('profile')
  @ApiOkResponse({ type: GetEnterpriseKnowledgeBaseResponseDto })
  async updateEnterpriseKnowledgeProfile(
    @Param('workspaceId') workspaceId: string,
    @Body() body: UpdateEnterpriseKnowledgeProfileRequestDto,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.updateEnterpriseKnowledgeProfile(workspaceId, body);
  }

  @Post('versions')
  @ApiOkResponse({ type: GetEnterpriseKnowledgeBaseResponseDto })
  async uploadEnterpriseKnowledgePdf(
    @Param('workspaceId') workspaceId: string,
    @Body() body: UploadEnterpriseKnowledgePdfRequestDto,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.uploadEnterpriseKnowledgePdf(workspaceId, body);
  }

  @Post('versions/:versionId/activate')
  @ApiOkResponse({ type: GetEnterpriseKnowledgeBaseResponseDto })
  async activateEnterpriseKnowledgeVersion(
    @Param('workspaceId') workspaceId: string,
    @Param('versionId') versionId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.activateEnterpriseKnowledgeVersion(workspaceId, versionId);
  }

  @Patch('status')
  @ApiOkResponse({ type: GetEnterpriseKnowledgeBaseResponseDto })
  async updateEnterpriseKnowledgeStatus(
    @Param('workspaceId') workspaceId: string,
    @Body() body: UpdateEnterpriseKnowledgeStatusRequestDto,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.updateEnterpriseKnowledgeStatus(workspaceId, body.enabled);
  }

  @Get('versions/:versionId/document')
  @ApiOkResponse({ type: GetEnterpriseKnowledgeDocumentResponseDto })
  async getEnterpriseKnowledgeDocument(
    @Param('workspaceId') workspaceId: string,
    @Param('versionId') versionId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.getEnterpriseKnowledgeDocument(workspaceId, versionId);
  }

  @Get('runtime-context')
  @ApiOkResponse({ type: GetEnterpriseKnowledgeRuntimeContextResponseDto })
  async getEnterpriseKnowledgeRuntimeContext(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.knowledgeService.getEnterpriseKnowledgeRuntimeContext(workspaceId);
  }
}
