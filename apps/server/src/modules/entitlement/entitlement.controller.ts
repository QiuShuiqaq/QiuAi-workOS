import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CheckEntitlementRequestDto } from './dto/check-entitlement-request.dto';
import { CheckEntitlementResponseDto } from './dto/check-entitlement-response.dto';
import { EntitlementService } from './entitlement.service';

@ApiTags('entitlements')
@Controller({
  path: 'entitlements',
  version: '1'
})
export class EntitlementController {
  constructor(private readonly entitlementService: EntitlementService) {}

  @Post('check')
  @ApiOkResponse({ type: CheckEntitlementResponseDto })
  check(@Body() body: CheckEntitlementRequestDto): Promise<CheckEntitlementResponseDto> {
    return this.entitlementService.check(body);
  }
}
