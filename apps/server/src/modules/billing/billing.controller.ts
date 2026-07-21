import { Body, Controller, Get, Header, Inject, Param, Post, Req, Res } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { BillingService } from './billing.service';
import { CreateBillingOrderRequestDto } from './dto/create-billing-order-request.dto';
import {
  CreateBillingOrderResponseDto,
  GetBillingOverviewResponseDto
} from './dto/billing-overview-response.dto';

@ApiTags('billing')
@Controller({
  path: 'workspaces/:workspaceId/billing',
  version: '1'
})
export class WorkspaceBillingController {
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Get('overview')
  @ApiOkResponse({ type: GetBillingOverviewResponseDto })
  getOverview(
    @Param('workspaceId') workspaceId: string,
    @Req() request: FastifyRequest
  ): Promise<GetBillingOverviewResponseDto> {
    return this.billingService.getOverview(workspaceId, request.headers.cookie);
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
  constructor(@Inject(BillingService) private readonly billingService: BillingService) {}

  @Post('notify')
  @Header('content-type', 'text/plain; charset=utf-8')
  async notify(@Body() body: unknown, @Res({ passthrough: true }) reply: FastifyReply): Promise<string> {
    const result = await this.billingService.handleAlipayNotify(body);
    reply.status(result.httpStatus);
    return result.success ? 'success' : 'failure';
  }

  @Post('orders/:orderNo/sync')
  syncOrder(@Param('orderNo') orderNo: string, @Req() request: FastifyRequest) {
    return this.billingService.syncAlipayOrder(orderNo, request.headers.cookie);
  }
}
