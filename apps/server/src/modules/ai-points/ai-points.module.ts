import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AiPointsController, DesktopOfficialModelController } from './ai-points.controller';
import { AiPointsService } from './ai-points.service';

@Module({
  imports: [AuthModule],
  controllers: [AiPointsController, DesktopOfficialModelController],
  providers: [AiPointsService],
  exports: [AiPointsService]
})
export class AiPointsModule {}
