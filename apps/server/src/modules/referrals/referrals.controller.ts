import { Body, Controller, Get, Inject, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { ValidateReferralCodeRequestDto } from './dto/validate-referral-code-request.dto';
import {
  GetReferralOverviewResponseDto,
  ValidateReferralCodeResponseDto
} from './dto/referral-response.dto';
import { ReferralsService } from './referrals.service';

function readDesktopDeviceToken(request: FastifyRequest): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice('bearer '.length).trim();
  }

  const header = request.headers['x-qiuai-device-token'];
  return Array.isArray(header) ? header[0] : header;
}

@ApiTags('referrals')
@Controller({
  path: 'workspaces/:workspaceId/referrals',
  version: '1'
})
export class ReferralsController {
  constructor(@Inject(ReferralsService) private readonly referralsService: ReferralsService) {}

  @Get('me')
  @ApiOkResponse({ type: GetReferralOverviewResponseDto })
  getMyReferralOverview(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<GetReferralOverviewResponseDto> {
    return this.referralsService.getMyReferralOverview(
      workspaceId,
      readDesktopDeviceToken(request),
      request.headers.cookie
    );
  }

  @Post('validate')
  @ApiOkResponse({ type: ValidateReferralCodeResponseDto })
  validateReferralCode(
    @Param('workspaceId') workspaceId: string,
    @Body() body: ValidateReferralCodeRequestDto,
    @Req() request: FastifyRequest
  ): Promise<ValidateReferralCodeResponseDto> {
    return this.referralsService.validateReferralCode(workspaceId, body, request.headers.cookie);
  }
}
