import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  DesktopRuntimeSyncResponse,
  parseDesktopRuntimeSyncRequest
} from './desktop-sync.contract';

@Injectable()
export class DesktopSyncService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService
  ) {}

  async syncRuntime(workspaceId: string, body: unknown): Promise<DesktopRuntimeSyncResponse> {
    const request = parseDesktopRuntimeSyncRequest(body);
    const snapshot = request.data;
    const syncedAt = new Date();

    if (snapshot.workspaceId !== workspaceId) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Workspace id in the request body does not match the route parameter.',
          details: {
            workspaceId,
            snapshotWorkspaceId: snapshot.workspaceId
          }
        }
      });
    }

    if (isDatabasePersistenceEnabled()) {
      const workspace = await this.prismaService.workspace.findUnique({
        where: {
          id: workspaceId
        },
        select: {
          id: true
        }
      });

      if (!workspace) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Workspace was not found.',
            details: {
              workspaceId
            }
          }
        });
      }

      await this.prismaService.desktopRuntimeSync.upsert({
        where: {
          runtimeId: snapshot.runtimeId
        },
        update: {
          workspaceId,
          deviceId: snapshot.deviceId,
          deviceName: snapshot.deviceName,
          platform: snapshot.platform,
          appVersion: snapshot.appVersion,
          runtimeSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          syncedAt
        },
        create: {
          workspaceId,
          runtimeId: snapshot.runtimeId,
          deviceId: snapshot.deviceId,
          deviceName: snapshot.deviceName,
          platform: snapshot.platform,
          appVersion: snapshot.appVersion,
          runtimeSnapshot: snapshot as unknown as Prisma.InputJsonValue,
          syncedAt
        }
      });
    } else {
      if (!this.store.workspaceExists(workspaceId)) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Workspace was not found.',
            details: {
              workspaceId
            }
          }
        });
      }

      this.store.upsertDesktopRuntimeSync({
        workspaceId,
        runtimeId: snapshot.runtimeId,
        deviceId: snapshot.deviceId,
        deviceName: snapshot.deviceName,
        platform: snapshot.platform,
        appVersion: snapshot.appVersion,
        runtimeSnapshot: snapshot as unknown as Record<string, unknown>,
        syncedAt: syncedAt.toISOString()
      });
    }

    return {
      data: {
        accepted: true,
        syncedAt: syncedAt.toISOString(),
        nextSyncAt: new Date(syncedAt.getTime() + 5 * 60 * 1000).toISOString()
      }
    };
  }
}
