import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

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
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('overview')
  @ApiOkResponse({ type: GetEnterpriseWorkspaceOverviewResponseDto })
  getOverview(@Param('workspaceId') workspaceId: string): Promise<GetEnterpriseWorkspaceOverviewResponseDto> {
    return this.organizationService.getOverview(workspaceId);
  }

  @Post('departments')
  @ApiOkResponse({ type: CreateDepartmentResponseDto })
  createDepartment(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateDepartmentRequestDto
  ): Promise<CreateDepartmentResponseDto> {
    return this.organizationService.createDepartment(workspaceId, body);
  }
}
