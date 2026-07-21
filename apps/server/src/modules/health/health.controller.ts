import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { HealthResponse } from './health.dto';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller({
  path: 'health',
  version: '1'
})
export class HealthController {
  constructor(@Inject(HealthService) private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({ type: HealthResponse })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
