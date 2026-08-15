import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { SoftwareCopilotModule } from '../software-copilot/software-copilot.module';
import { AlipayBillingController, WorkspaceBillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [AuthModule, ReferralsModule, SoftwareCopilotModule],
  controllers: [WorkspaceBillingController, AlipayBillingController],
  providers: [BillingService],
  exports: [BillingService]
})
export class BillingModule {}
