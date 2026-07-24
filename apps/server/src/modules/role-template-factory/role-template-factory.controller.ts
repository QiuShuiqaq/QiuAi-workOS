import { Body, Controller, Get, Inject, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import {
  ArchiveAdminRoleTemplateResponseDto,
  CreateAdminRoleTemplateRequestDto,
  CreateAdminRoleTemplateResponseDto,
  GetAdminRoleTemplateResponseDto,
  ListAdminRoleTemplatesResponseDto,
  PublishAdminRoleTemplateResponseDto,
  TestAdminRoleTemplateRequestDto,
  TestAdminRoleTemplateResponseDto,
  UpdateAdminRoleTemplateRequestDto,
  UpdateAdminRoleTemplateResponseDto
} from './dto/role-template-factory.dto';
import { RoleTemplateFactoryService } from './role-template-factory.service';

@ApiTags('admin-role-templates')
@Controller({
  path: 'admin/role-templates',
  version: '1'
})
export class RoleTemplateFactoryController {
  constructor(
    @Inject(RoleTemplateFactoryService)
    private readonly templateFactoryService: RoleTemplateFactoryService
  ) {}

  @Get()
  @ApiOkResponse({ type: ListAdminRoleTemplatesResponseDto })
  listTemplates(@Req() request: FastifyRequest): Promise<ListAdminRoleTemplatesResponseDto> {
    return this.templateFactoryService.listTemplates(request.headers.cookie);
  }

  @Post()
  @ApiOkResponse({ type: CreateAdminRoleTemplateResponseDto })
  createTemplate(
    @Body() body: CreateAdminRoleTemplateRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateAdminRoleTemplateResponseDto> {
    return this.templateFactoryService.createTemplate(body, request.headers.cookie);
  }

  @Get(':templateId')
  @ApiOkResponse({ type: GetAdminRoleTemplateResponseDto })
  getTemplate(
    @Param('templateId') templateId: string,
    @Req() request: FastifyRequest
  ): Promise<GetAdminRoleTemplateResponseDto> {
    return this.templateFactoryService.getTemplate(templateId, request.headers.cookie);
  }

  @Patch(':templateId')
  @ApiOkResponse({ type: UpdateAdminRoleTemplateResponseDto })
  updateTemplate(
    @Param('templateId') templateId: string,
    @Body() body: UpdateAdminRoleTemplateRequestDto,
    @Req() request: FastifyRequest
  ): Promise<UpdateAdminRoleTemplateResponseDto> {
    return this.templateFactoryService.updateTemplate(templateId, body, request.headers.cookie);
  }

  @Post(':templateId/test')
  @ApiOkResponse({ type: TestAdminRoleTemplateResponseDto })
  testTemplate(
    @Param('templateId') templateId: string,
    @Body() body: TestAdminRoleTemplateRequestDto,
    @Req() request: FastifyRequest
  ): Promise<TestAdminRoleTemplateResponseDto> {
    return this.templateFactoryService.testTemplate(templateId, body, request.headers.cookie);
  }

  @Post(':templateId/publish')
  @ApiOkResponse({ type: PublishAdminRoleTemplateResponseDto })
  publishTemplate(
    @Param('templateId') templateId: string,
    @Req() request: FastifyRequest
  ): Promise<PublishAdminRoleTemplateResponseDto> {
    return this.templateFactoryService.publishTemplate(templateId, request.headers.cookie);
  }

  @Post(':templateId/archive')
  @ApiOkResponse({ type: ArchiveAdminRoleTemplateResponseDto })
  archiveTemplate(
    @Param('templateId') templateId: string,
    @Req() request: FastifyRequest
  ): Promise<ArchiveAdminRoleTemplateResponseDto> {
    return this.templateFactoryService.archiveTemplate(templateId, request.headers.cookie);
  }
}
