import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CommercialModule } from './commercial/commercial.module';
import { HealthModule } from './health/health.module';
import { KernelModule } from './kernel/kernel.module';
import { RoleModule } from './role/role.module';
import { TaskModule } from './task/task.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { MockPlatformStoreModule } from '../shared/mock/mock-platform-store.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    MockPlatformStoreModule,
    CommercialModule,
    HealthModule,
    KernelModule,
    RoleModule,
    TaskModule,
    WorkspaceModule
  ]
})
export class AppModule {}
