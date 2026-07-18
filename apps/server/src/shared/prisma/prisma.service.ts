import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  readonly clientVersion = Prisma.prismaVersion.client;

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
