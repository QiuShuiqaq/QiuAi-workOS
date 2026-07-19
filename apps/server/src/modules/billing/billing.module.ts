import { Module } from '@nestjs/common';

import { AlipayBillingController, WorkspaceBillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  controllers: [WorkspaceBillingController, AlipayBillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}
