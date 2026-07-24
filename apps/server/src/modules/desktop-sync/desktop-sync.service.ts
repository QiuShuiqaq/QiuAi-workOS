import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { RoleService } from '../role/role.service';
import {
  createDesktopBindingCode,
  createDesktopDeviceToken,
  hashDesktopToken,
  normalizeDesktopBindingCode
} from './desktop-auth-token';
import {
  CreateDesktopBindingCodeResponse,
  DesktopDeviceSummary,
  DesktopRuntimeSyncResponse,
  ListDesktopDevicesResponse,
  RedeemDesktopBindingCodeResponse,
  parseCreateDesktopBindingCodeRequest,
  parseDesktopRuntimeSyncRequest,
  parseRedeemDesktopBindingCodeRequest
} from './desktop-sync.contract';

interface MockDesktopBindingCodeRecord {
  id: string;
  workspaceId: string;
  codeHash: string;
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt: string;
  createdAt: string;
  redeemedAt?: string;
  redeemedDeviceId?: string;
}

interface MockDesktopDeviceRecord extends DesktopDeviceSummary {
  tokenHash: string;
}

@Injectable()
export class DesktopSyncService {
  private readonly mockBindingCodes: MockDesktopBindingCodeRecord[] = [];
  private readonly mockDevices: MockDesktopDeviceRecord[] = [];

  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(RoleService)
    private readonly roleService: RoleService
  ) {}

  async listAuthorizedRoleTemplates(workspaceId: string, deviceToken?: string) {
    if (isDatabasePersistenceEnabled()) {
      await this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
      return this.roleService.listTemplates(workspaceId);
    }

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
    this.requireMockDeviceTokenForWorkspace(workspaceId, deviceToken, new Date());
    return this.roleService.listTemplates(workspaceId);
  }

  async listDevices(workspaceId: string, cookieHeader?: string): Promise<ListDesktopDevicesResponse> {
    if (!isDatabasePersistenceEnabled()) {
      this.assertMockWorkspace(workspaceId);
      return {
        data: this.mockDevices
          .filter((device) => device.workspaceId === workspaceId)
          .map(({ tokenHash: _tokenHash, ...device }) => device)
      };
    }

    await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);

    const devices = await this.prismaService.desktopDevice.findMany({
      where: {
        workspaceId
      },
      orderBy: [
        {
          lastSeenAt: 'desc'
        },
        {
          boundAt: 'desc'
        }
      ]
    });

    return {
      data: devices.map((device) => this.toDeviceSummary(device))
    };
  }

  async createBindingCode(
    workspaceId: string,
    body: unknown,
    cookieHeader?: string
  ): Promise<CreateDesktopBindingCodeResponse> {
    const request = parseCreateDesktopBindingCodeRequest(body);
    const expiresInMinutes = request.expiresInMinutes ?? 10;
    const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

    if (!isDatabasePersistenceEnabled()) {
      this.assertMockWorkspace(workspaceId);
      const bindingCode = createDesktopBindingCode();
      const now = new Date().toISOString();
      const record: MockDesktopBindingCodeRecord = {
        id: `desktop_binding_${Date.now()}`,
        workspaceId,
        codeHash: hashDesktopToken(normalizeDesktopBindingCode(bindingCode)),
        status: 'PENDING',
        expiresAt: expiresAt.toISOString(),
        createdAt: now
      };
      this.mockBindingCodes.unshift(record);

      return {
        data: {
          id: record.id,
          workspaceId: record.workspaceId,
          status: record.status,
          expiresAt: record.expiresAt,
          createdAt: record.createdAt,
          bindingCode
        }
      };
    }

    const access = await this.requireDesktopDeviceManagementAccess(workspaceId, cookieHeader);
    const bindingCode = createDesktopBindingCode();
    const created = await this.prismaService.desktopBindingCode.create({
      data: {
        workspaceId,
        codeHash: hashDesktopToken(normalizeDesktopBindingCode(bindingCode)),
        status: 'PENDING',
        expiresAt,
        createdByAccountId: access.accountId
      }
    });

    return {
      data: {
        id: created.id,
        workspaceId: created.workspaceId,
        status: created.status,
        expiresAt: created.expiresAt.toISOString(),
        createdAt: created.createdAt.toISOString(),
        redeemedAt: created.redeemedAt?.toISOString(),
        bindingCode
      }
    };
  }

  async redeemBindingCode(body: unknown): Promise<RedeemDesktopBindingCodeResponse> {
    const request = parseRedeemDesktopBindingCodeRequest(body);
    const normalizedCode = normalizeDesktopBindingCode(request.bindingCode);
    const codeHash = hashDesktopToken(normalizedCode);
    const now = new Date();

    if (!isDatabasePersistenceEnabled()) {
      const bindingCode = this.mockBindingCodes.find((item) => item.codeHash === codeHash);
      if (!bindingCode) {
        throw this.bindingCodeNotFound();
      }

      if (bindingCode.status === 'PENDING' && new Date(bindingCode.expiresAt).getTime() <= now.getTime()) {
        bindingCode.status = 'EXPIRED';
      }

      if (bindingCode.status !== 'PENDING') {
        throw this.bindingCodeUnavailable(bindingCode.status);
      }

      const deviceToken = createDesktopDeviceToken();
      const device: MockDesktopDeviceRecord = {
        id: `desktop_device_${Date.now()}`,
        workspaceId: bindingCode.workspaceId,
        runtimeId: request.runtimeId,
        deviceId: request.deviceId,
        deviceName: request.deviceName,
        platform: request.platform,
        appVersion: request.appVersion,
        status: 'ACTIVE',
        boundAt: now.toISOString(),
        lastSeenAt: now.toISOString(),
        tokenHash: hashDesktopToken(deviceToken)
      };

      const existingIndex = this.mockDevices.findIndex(
        (item) => item.workspaceId === device.workspaceId && item.runtimeId === device.runtimeId
      );
      let storedDevice = device;
      if (existingIndex >= 0) {
        storedDevice = {
          ...this.mockDevices[existingIndex],
          ...device,
          id: this.mockDevices[existingIndex].id,
          boundAt: this.mockDevices[existingIndex].boundAt
        };
        this.mockDevices[existingIndex] = storedDevice;
      } else {
        this.mockDevices.unshift(device);
      }

      bindingCode.status = 'REDEEMED';
      bindingCode.redeemedAt = now.toISOString();
      bindingCode.redeemedDeviceId = storedDevice.id;

      const { tokenHash: _tokenHash, ...deviceSummary } = storedDevice;

      return {
        data: {
          workspaceId: bindingCode.workspaceId,
          deviceToken,
          device: deviceSummary
        }
      };
    }

    await this.expireDatabaseBindingCodes();

    const bindingCode = await this.prismaService.desktopBindingCode.findUnique({
      where: {
        codeHash
      },
      include: {
        workspace: true
      }
    });
    if (!bindingCode) {
      throw this.bindingCodeNotFound();
    }

    if (bindingCode.status !== 'PENDING') {
      throw this.bindingCodeUnavailable(bindingCode.status);
    }

    if (bindingCode.expiresAt.getTime() <= now.getTime()) {
      await this.prismaService.desktopBindingCode.update({
        where: {
          id: bindingCode.id
        },
        data: {
          status: 'EXPIRED'
        }
      });
      throw this.bindingCodeUnavailable('EXPIRED');
    }

    if (bindingCode.workspace.status !== 'ACTIVE') {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Workspace is not active.',
          details: {
            workspaceId: bindingCode.workspaceId
          }
        }
      });
    }

    const deviceToken = createDesktopDeviceToken();
    const deviceTokenHash = hashDesktopToken(deviceToken);
    const device = await this.prismaService.$transaction(async (tx) => {
      const createdDevice = await tx.desktopDevice.upsert({
        where: {
          workspaceId_runtimeId: {
            workspaceId: bindingCode.workspaceId,
            runtimeId: request.runtimeId
          }
        },
        update: {
          deviceId: request.deviceId,
          deviceName: request.deviceName,
          platform: request.platform,
          appVersion: request.appVersion,
          tokenHash: deviceTokenHash,
          status: 'ACTIVE',
          lastSeenAt: now
        },
        create: {
          workspaceId: bindingCode.workspaceId,
          runtimeId: request.runtimeId,
          deviceId: request.deviceId,
          deviceName: request.deviceName,
          platform: request.platform,
          appVersion: request.appVersion,
          tokenHash: deviceTokenHash,
          status: 'ACTIVE',
          lastSeenAt: now
        }
      });

      const redeemed = await tx.desktopBindingCode.updateMany({
        where: {
          id: bindingCode.id,
          status: 'PENDING'
        },
        data: {
          status: 'REDEEMED',
          redeemedAt: now,
          redeemedDeviceId: createdDevice.id
        }
      });

      if (redeemed.count === 0) {
        throw this.bindingCodeUnavailable('REDEEMED');
      }

      return createdDevice;
    });

    return {
      data: {
        workspaceId: bindingCode.workspaceId,
        deviceToken,
        device: this.toDeviceSummary(device)
      }
    };
  }

  async syncRuntime(
    workspaceId: string,
    body: unknown,
    deviceToken?: string
  ): Promise<DesktopRuntimeSyncResponse> {
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
      const device = await this.requireDatabaseDeviceToken(workspaceId, snapshot, deviceToken);
      const workspace = await this.prismaService.workspace.findUnique({
        where: {
          id: workspaceId
        },
        select: {
          id: true,
          status: true
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

      if (workspace.status !== 'ACTIVE') {
        throw new ForbiddenException({
          error: {
            code: 'WORKSPACE_NOT_ACTIVE',
            message: 'Workspace is not active.',
            details: {
              workspaceId,
              status: workspace.status
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
      await this.prismaService.desktopDevice.update({
        where: {
          id: device.id
        },
        data: {
          deviceId: snapshot.deviceId,
          deviceName: snapshot.deviceName,
          platform: snapshot.platform,
          appVersion: snapshot.appVersion,
          lastSeenAt: syncedAt,
          lastSyncedAt: syncedAt
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
      this.requireMockDeviceToken(workspaceId, snapshot.runtimeId, snapshot.deviceId, deviceToken, syncedAt);

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

  private async requireDesktopDeviceManagementAccess(workspaceId: string, cookieHeader?: string) {
    const currentAccount = await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        memberships: {
          where: {
            accountId: currentAccount.account.id
          }
        }
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

    const membership = workspace.memberships[0];
    const canManage =
      workspace.ownerAccountId === currentAccount.account.id || ['OWNER', 'ADMIN'].includes(membership?.role ?? '');

    if (!canManage) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device binding requires workspace owner or admin access.'
        }
      });
    }

    return {
      accountId: currentAccount.account.id
    };
  }

  private async requireDatabaseDeviceToken(
    workspaceId: string,
    snapshot: { runtimeId: string; deviceId: string },
    deviceToken?: string
  ) {
    if (!deviceToken) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is required.'
        }
      });
    }

    const device = await this.prismaService.desktopDevice.findUnique({
      where: {
        tokenHash: hashDesktopToken(deviceToken)
      }
    });

    if (!device || device.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is invalid.'
        }
      });
    }

    if (device.workspaceId !== workspaceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device is not bound to this workspace.',
          details: {
            workspaceId
          }
        }
      });
    }

    if (device.runtimeId !== snapshot.runtimeId || device.deviceId !== snapshot.deviceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device token does not match this runtime.'
        }
      });
    }

    return device;
  }

  private async requireDatabaseDeviceTokenForWorkspace(workspaceId: string, deviceToken?: string) {
    if (!deviceToken) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is required.'
        }
      });
    }

    const device = await this.prismaService.desktopDevice.findUnique({
      where: {
        tokenHash: hashDesktopToken(deviceToken)
      }
    });

    if (!device || device.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is invalid.'
        }
      });
    }

    if (device.workspaceId !== workspaceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device is not bound to this workspace.',
          details: {
            workspaceId
          }
        }
      });
    }

    await this.prismaService.desktopDevice.update({
      where: {
        id: device.id
      },
      data: {
        lastSeenAt: new Date()
      }
    });

    return device;
  }

  private requireMockDeviceToken(
    workspaceId: string,
    runtimeId: string,
    deviceId: string,
    deviceToken: string | undefined,
    syncedAt: Date
  ) {
    if (!deviceToken) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is required.'
        }
      });
    }

    const device = this.mockDevices.find((item) => item.tokenHash === hashDesktopToken(deviceToken));
    if (!device || device.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is invalid.'
        }
      });
    }

    if (device.workspaceId !== workspaceId || device.runtimeId !== runtimeId || device.deviceId !== deviceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device token does not match this runtime.'
        }
      });
    }

    device.lastSeenAt = syncedAt.toISOString();
    device.lastSyncedAt = syncedAt.toISOString();
  }

  private requireMockDeviceTokenForWorkspace(
    workspaceId: string,
    deviceToken: string | undefined,
    seenAt: Date
  ) {
    if (!deviceToken) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is required.'
        }
      });
    }

    const device = this.mockDevices.find((item) => item.tokenHash === hashDesktopToken(deviceToken));
    if (!device || device.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Desktop device token is invalid.'
        }
      });
    }

    if (device.workspaceId !== workspaceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device token does not match this workspace.'
        }
      });
    }

    device.lastSeenAt = seenAt.toISOString();
  }

  private async expireDatabaseBindingCodes() {
    await this.prismaService.desktopBindingCode.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: {
          lt: new Date()
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });
  }

  private assertMockWorkspace(workspaceId: string) {
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
  }

  private bindingCodeNotFound() {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Desktop binding code was not found.'
      }
    });
  }

  private bindingCodeUnavailable(status: string) {
    return new ConflictException({
      error: {
        code: 'CONFLICT',
        message: 'Desktop binding code is no longer available.',
        details: {
          status
        }
      }
    });
  }

  private toDeviceSummary(device: {
    id: string;
    workspaceId: string;
    runtimeId: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    status: 'ACTIVE' | 'REVOKED';
    boundAt: Date;
    lastSeenAt: Date | null;
    lastSyncedAt: Date | null;
  }): DesktopDeviceSummary {
    return {
      id: device.id,
      workspaceId: device.workspaceId,
      runtimeId: device.runtimeId,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: this.toDesktopPlatform(device.platform),
      appVersion: device.appVersion,
      status: device.status,
      boundAt: device.boundAt.toISOString(),
      lastSeenAt: device.lastSeenAt?.toISOString(),
      lastSyncedAt: device.lastSyncedAt?.toISOString()
    };
  }

  private toDesktopPlatform(value: string): DesktopDeviceSummary['platform'] {
    if (value === 'macos' || value === 'linux') {
      return value;
    }

    return 'windows';
  }
}
