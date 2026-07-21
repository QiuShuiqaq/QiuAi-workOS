import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service';
import { CreateDepartmentRequestDto } from './dto/create-department-request.dto';
import {
  CreateDepartmentResponseDto,
  GetEnterpriseWorkspaceOverviewResponseDto
} from './dto/enterprise-workspace-overview-response.dto';
import { OrganizationService } from './organization.service';

@ApiTags('organization')
@Controller({
  path: 'workspaces/:workspaceId/organization',
  version: '1'
})
export class OrganizationController {
  constructor(
    @Inject(OrganizationService)
    private readonly organizationService: OrganizationService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Get('overview')
  @ApiOkResponse({ type: GetEnterpriseWorkspaceOverviewResponseDto })
  async getOverview(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<GetEnterpriseWorkspaceOverviewResponseDto> {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.organizationService.getOverview(workspaceId);
  }

  @Post('departments')
  @ApiOkResponse({ type: CreateDepartmentResponseDto })
  async createDepartment(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateDepartmentRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateDepartmentResponseDto> {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.organizationService.createDepartment(workspaceId, body);
  }
}
