import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyRequest } from 'fastify';

import { BillingService } from './billing.service';
import { CreateBillingOrderRequestDto } from './dto/create-billing-order-request.dto';
import {
  AlipayNotifyResponseDto,
  CreateBillingOrderResponseDto,
  GetBillingOverviewResponseDto
} from './dto/billing-overview-response.dto';

@ApiTags('billing')
@Controller({
  path: 'workspaces/:workspaceId/billing',
  version: '1'
})
export class WorkspaceBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('overview')
  @ApiOkResponse({ type: GetBillingOverviewResponseDto })
  getOverview(@Param('workspaceId') workspaceId: string): Promise<GetBillingOverviewResponseDto> {
    return this.billingService.getOverview(workspaceId);
  }

  @Post('orders')
  @ApiOkResponse({ type: CreateBillingOrderResponseDto })
  createOrder(
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateBillingOrderRequestDto,
    @Req() request: FastifyRequest
  ): Promise<CreateBillingOrderResponseDto> {
    return this.billingService.createOrder(workspaceId, body, request.headers.cookie);
  }
}

@ApiTags('billing')
@Controller({
  path: 'billing/alipay',
  version: '1'
})
export class AlipayBillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('notify')
  @ApiOkResponse({ type: AlipayNotifyResponseDto })
  notify(): AlipayNotifyResponseDto {
    return this.billingService.handleAlipayNotify();
  }
}
