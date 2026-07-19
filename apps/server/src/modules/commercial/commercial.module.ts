import { Module } from '@nestjs/common';

import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';
import { PrismaModule } from '../../shared/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CommercialController],
  providers: [CommercialService],
  exports: [CommercialService]
})
export class CommercialModule {}
