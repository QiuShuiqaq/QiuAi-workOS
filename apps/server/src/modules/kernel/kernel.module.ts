import { Module } from '@nestjs/common';

import { PrismaModule } from '../../shared/prisma/prisma.module';
import { KernelController } from './kernel.controller';
import { KernelService } from './kernel.service';

@Module({
  imports: [PrismaModule],
  controllers: [KernelController],
  providers: [KernelService]
})
export class KernelModule {}
