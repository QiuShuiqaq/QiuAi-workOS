import { Body, Controller, HttpCode, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { AuthService } from '../auth/auth.service';
import { CheckEntitlementRequestDto } from './dto/check-entitlement-request.dto';
import { CheckEntitlementResponseDto } from './dto/check-entitlement-response.dto';
import { EntitlementService } from './entitlement.service';

@ApiTags('entitlements')
@Controller({
  path: 'entitlements',
  version: '1'
})
export class EntitlementController {
  constructor(
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  @Post('check')
  @HttpCode(200)
  @ApiOkResponse({ type: CheckEntitlementResponseDto })
  async check(
    @Body() body: CheckEntitlementRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CheckEntitlementResponseDto> {
    await this.authService.requireWorkspaceAccess(body.workspaceId, request.headers.cookie);
    return this.entitlementService.check(body);
  }
}
