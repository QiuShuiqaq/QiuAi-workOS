import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AlipayBillingController, WorkspaceBillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule],
  controllers: [WorkspaceBillingController, AlipayBillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}
