import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementModule } from '../entitlement/entitlement.module';
import { PrismaModule } from '../../shared/prisma/prisma.module';
import { MockPlatformStoreModule } from '../../shared/mock/mock-platform-store.module';
import { InvitationController, WorkspaceInvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';

@Module({
  imports: [AuthModule, EntitlementModule, MockPlatformStoreModule, PrismaModule],
  controllers: [InvitationController, WorkspaceInvitationController],
  providers: [InvitationService]
})
export class InvitationModule {}
