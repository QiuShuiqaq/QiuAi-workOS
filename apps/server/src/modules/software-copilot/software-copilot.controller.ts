import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { SoftwareCopilotService } from './software-copilot.service';

function readDesktopDeviceToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  const header = request.headers['x-qiuai-device-token'];
  return Array.isArray(header) ? header[0] : header;
}

@ApiTags('software-copilots')
@Controller({
  path: 'workspaces/:workspaceId/software-copilots',
  version: '1'
})
export class WorkspaceSoftwareCopilotController {
  constructor(
    @Inject(SoftwareCopilotService)
    private readonly softwareCopilotService: SoftwareCopilotService
  ) {}

  @Get()
  listSoftwareCopilots(@Param('workspaceId') workspaceId: string, @Req() request: FastifyRequest) {
    return this.softwareCopilotService.listSoftwareCopilots(workspaceId, {
      cookieHeader: request.headers.cookie,
      deviceToken: readDesktopDeviceToken(request)
    });
  }

  @Post('orders')
  createSoftwareCopilotOrder(
    @Param('workspaceId') workspaceId: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.softwareCopilotService.createOrder(workspaceId, body, request.headers.cookie);
  }

  @Post(':productCode/device-bindings')
  bindDevice(
    @Param('workspaceId') workspaceId: string,
    @Param('productCode') productCode: string,
    @Body() body: unknown,
    @Req() request: FastifyRequest
  ) {
    return this.softwareCopilotService.bindDevice(workspaceId, productCode, body, request.headers.cookie);
  }
}

@ApiTags('software-copilots')
@Controller({
  path: 'workspaces/:workspaceId/software-copilot-device-bindings',
  version: '1'
})
export class WorkspaceSoftwareCopilotDeviceBindingController {
  constructor(
    @Inject(SoftwareCopilotService)
    private readonly softwareCopilotService: SoftwareCopilotService
  ) {}

  @Post(':bindingId/revoke')
  revokeDeviceBinding(
    @Param('workspaceId') workspaceId: string,
    @Param('bindingId') bindingId: string,
    @Req() request: FastifyRequest
  ) {
    return this.softwareCopilotService.revokeDeviceBinding(workspaceId, bindingId, request.headers.cookie);
  }
}
