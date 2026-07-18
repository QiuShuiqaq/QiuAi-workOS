import { Global, Module } from '@nestjs/common';

import { MockPlatformStore } from './mock-platform-store.service';

@Global()
@Module({
  providers: [MockPlatformStore],
  exports: [MockPlatformStore]
})
export class MockPlatformStoreModule {}
