import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { RoleTemplateFactoryController } from './role-template-factory.controller';
import { RoleTemplateFactoryService } from './role-template-factory.service';

@Module({
  imports: [AuthModule],
  controllers: [RoleTemplateFactoryController],
  providers: [RoleTemplateFactoryService]
})
export class RoleTemplateFactoryModule {}
