import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { KernelStatusResponse } from './kernel.dto';
import { KernelService } from './kernel.service';

@ApiTags('kernel')
@Controller({
  path: 'kernel',
  version: '1'
})
export class KernelController {
  constructor(private readonly kernelService: KernelService) {}

  @Get('status')
  @ApiOkResponse({ type: KernelStatusResponse })
  async getStatus(): Promise<KernelStatusResponse> {
    return this.kernelService.getStatus();
  }
}
