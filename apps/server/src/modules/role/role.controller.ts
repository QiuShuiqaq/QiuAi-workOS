import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { InstallRoleRequestDto } from './dto/install-role-request.dto';
import { RoleService } from './role.service';

@ApiTags('roles')
@Controller({
  path: 'workspaces/:workspaceId/roles',
  version: '1'
})
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('templates')
  listTemplates() {
    return this.roleService.listTemplates();
  }

  @Get()
  listRoles(@Param('workspaceId') workspaceId: string) {
    return this.roleService.listRoles(workspaceId);
  }

  @Get(':roleId')
  getRole(@Param('workspaceId') workspaceId: string, @Param('roleId') roleId: string) {
    const role = this.roleService.getRole(workspaceId, roleId);
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
  installRole(@Param('workspaceId') workspaceId: string, @Body() body: InstallRoleRequestDto) {
    const role = this.roleService.installRole(workspaceId, body);
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
