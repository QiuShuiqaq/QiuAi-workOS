import { Injectable } from '@nestjs/common';

import { demoPlans } from '../../shared/mock/platform-seed';
import { ListPlansResponseDto } from './dto/list-plans-response.dto';

@Injectable()
export class CommercialService {
  listPlans(): ListPlansResponseDto {
    return {
      data: demoPlans
    };
  }
}
