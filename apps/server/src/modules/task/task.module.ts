import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';

@Module({
  imports: [AuthModule, EntitlementModule, PrismaModule],
  controllers: [TaskController],
  providers: [TaskService]
})
export class TaskModule {}
