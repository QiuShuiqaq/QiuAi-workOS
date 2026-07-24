import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';

@Module({
  imports: [AuthModule, EntitlementModule, PrismaModule],
  controllers: [RoleController],
  providers: [RoleService],
  exports: [RoleService]
})
export class RoleModule {}
