import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service';
import { InstallRoleRequestDto } from './dto/install-role-request.dto';
import { RoleService } from './role.service';

@ApiTags('roles')
@Controller({
  path: 'workspaces/:workspaceId/roles',
  version: '1'
})
export class RoleController {
  constructor(
    @Inject(RoleService)
    private readonly roleService: RoleService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Get('templates')
  async listTemplates(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.roleService.listTemplates(workspaceId);
  }

  @Get()
  async listRoles(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    return this.roleService.listRoles(workspaceId);
  }

  @Get(':roleId')
  async getRole(
    @Param('workspaceId') workspaceId: string,
    @Param('roleId') roleId: string,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    const role = await this.roleService.getRole(workspaceId, roleId);
    if (!role) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Role was not found.',
          details: { workspaceId, roleId }
        }
      });
    }
    return role;
  }

  @Post('install')
  async installRole(
    @Param('workspaceId') workspaceId: string,
    @Body() body: InstallRoleRequestDto,
    @Req() request: FastifyRequest
  ) {
    await this.authService.requireWorkspaceAccess(workspaceId, request.headers.cookie);
    const role = await this.roleService.installRole(workspaceId, body);
    if (!role) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Role template was not found.',
          details: { workspaceId, templateId: body.templateId }
        }
      });
    }
    return role;
  }
}
