import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, EntitlementModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
