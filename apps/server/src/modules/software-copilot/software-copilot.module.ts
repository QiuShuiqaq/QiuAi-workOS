import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import {
  WorkspaceSoftwareCopilotController,
  WorkspaceSoftwareCopilotDeviceBindingController
} from './software-copilot.controller';
import { SoftwareCopilotService } from './software-copilot.service';

@Module({
  imports: [AuthModule],
  controllers: [
    WorkspaceSoftwareCopilotController,
    WorkspaceSoftwareCopilotDeviceBindingController
  ],
  providers: [SoftwareCopilotService],
  exports: [SoftwareCopilotService]
})
export class SoftwareCopilotModule {}
