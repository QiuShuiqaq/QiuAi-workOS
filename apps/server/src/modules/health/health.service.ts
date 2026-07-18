import { Injectable } from '@nestjs/common';

import { HealthResponse } from './health.dto';

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: 'qiuai-workos-server',
      timestamp: new Date().toISOString()
    };
  }
}
