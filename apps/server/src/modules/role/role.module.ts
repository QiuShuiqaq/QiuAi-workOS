import { Module } from '@nestjs/common';

import { EntitlementModule } from '../entitlement/entitlement.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [EntitlementModule, PrismaModule],
  controllers: [RoleController],
  providers: [RoleService]
})
export class RoleModule {}
