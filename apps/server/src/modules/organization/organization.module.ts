import { Module } from '@nestjs/common';

import { EntitlementModule } from '../entitlement/entitlement.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [EntitlementModule],
  controllers: [OrganizationController],
  providers: [OrganizationService]
})
export class OrganizationModule {}
