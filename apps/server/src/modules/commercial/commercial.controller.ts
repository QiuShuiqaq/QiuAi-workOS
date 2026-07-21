import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CommercialService } from './commercial.service';
import { ListPlansResponseDto } from './dto/list-plans-response.dto';

@ApiTags('commercial')
@Controller({
  path: 'commercial',
  version: '1'
})
export class CommercialController {
  constructor(@Inject(CommercialService) private readonly commercialService: CommercialService) {}

  @Get('plans')
  @ApiOkResponse({ type: ListPlansResponseDto })
  async listPlans(): Promise<ListPlansResponseDto> {
    return this.commercialService.listPlans();
  }
}
