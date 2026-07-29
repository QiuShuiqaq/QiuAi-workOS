import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AssetCenterController } from './asset-center.controller';
import { AssetCenterService } from './asset-center.service';

@Module({
  imports: [AuthModule],
  controllers: [AssetCenterController],
  providers: [AssetCenterService]
})
export class AssetCenterModule {}
