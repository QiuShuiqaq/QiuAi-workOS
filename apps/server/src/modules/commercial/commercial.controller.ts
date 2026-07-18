import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CommercialService } from './commercial.service';
import { ListPlansResponseDto } from './dto/list-plans-response.dto';

@ApiTags('commercial')
@Controller({
  path: 'commercial',
  version: '1'
})
export class CommercialController {
  constructor(private readonly commercialService: CommercialService) {}

  @Get('plans')
  @ApiOkResponse({ type: ListPlansResponseDto })
  listPlans(): ListPlansResponseDto {
    return this.commercialService.listPlans();
  }
}
