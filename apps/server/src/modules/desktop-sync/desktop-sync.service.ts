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
import { EntitlementService } from '../entitlement/entitlement.service';
import { RoleService } from '../role/role.service';
import {
  CheckDesktopUpdateQueryDto,
  CheckDesktopUpdateResponseDto
} from '../admin/dto/admin-console.dto';
import {
  createDesktopBindingCode,
  createDesktopDeviceToken,
  hashDesktopToken,
  normalizeDesktopBindingCode
} from './desktop-auth-token';
import {
  CancelDesktopBindingCodeResponse,
  CreateDesktopBindingCodeResponse,
  DesktopDeviceSummary,
  DesktopRuntimeSnapshot,
  DesktopRuntimeSyncResponse,
  ListDesktopBindingCodesResponse,
  ListDesktopDevicesResponse,
  RedeemDesktopBindingCodeResponse,
  UpdateDesktopBindingCodeResponse,
  parseCreateDesktopBindingCodeRequest,
  parseDesktopRuntimeSyncRequest,
  parseRedeemDesktopBindingCodeRequest,
  parseUpdateDesktopBindingCodeRequest
} from './desktop-sync.contract';

interface MockDesktopBindingCodeRecord {
  id: string;
  workspaceId: string;
  label?: string;
  codeHash: string;
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  expiresAt?: string;
  createdAt: string;
  redeemedAt?: string;
  redeemedDeviceId?: string;
}

interface MockDesktopDeviceRecord extends DesktopDeviceSummary {
  tokenHash: string;
}

type DesktopReleaseDate = Date | string;

type DesktopReleaseRecord = {
  id: string;
  version: string;
  platform: string;
  channel: string;
  downloadUrl: string;
  releaseNotes?: string | null;
  checksumSha256?: string | null;
  fileSizeBytes?: number | null;
  forceUpdate: boolean;
  minimumSupportedVersion?: string | null;
  status: string;
  publishedAt?: DesktopReleaseDate | null;
  createdAt: DesktopReleaseDate;
  updatedAt: DesktopReleaseDate;
};

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
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(RoleService)
    private readonly roleService: RoleService
  ) {}

  async listAuthorizedRoleTemplates(workspaceId: string, deviceToken?: string) {
    if (isDatabasePersistenceEnabled()) {
      await this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
      return this.roleService.listPublishedTemplatesForDesktop(workspaceId);
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
    return this.roleService.listPublishedTemplatesForDesktop(workspaceId);
  }

  async listPublicFreeRoleTemplates() {
    return this.roleService.listPublicFreeTemplatesForDesktop();
  }

  async checkDesktopUpdate(
    query: CheckDesktopUpdateQueryDto
  ): Promise<CheckDesktopUpdateResponseDto> {
    const platform = query.platform ?? 'windows';
    const channel = query.channel ?? 'stable';
    const currentVersion = query.currentVersion?.trim() || undefined;
    const releases = isDatabasePersistenceEnabled()
      ? await this.prismaService.desktopRelease.findMany({
          where: {
            platform,
            channel,
            status: 'PUBLISHED'
          }
        })
      : this.store
          .listDesktopReleases()
          .filter(
            (release) =>
              release.platform === platform &&
              release.channel === channel &&
              release.status === 'PUBLISHED'
          );

    const latestRelease = releases
      .sort((left, right) => this.compareDesktopReleaseOrder(right, left))[0];

    if (!latestRelease) {
      return {
        data: {
          currentVersion,
          updateAvailable: false,
          forceUpdate: false
        }
      };
    }

    const updateAvailable = currentVersion
      ? this.compareDesktopVersions(latestRelease.version, currentVersion) > 0
      : false;
    const belowMinimumSupported =
      Boolean(currentVersion && latestRelease.minimumSupportedVersion) &&
      this.compareDesktopVersions(currentVersion!, latestRelease.minimumSupportedVersion!) < 0;

    return {
      data: {
        currentVersion,
        updateAvailable,
        forceUpdate: belowMinimumSupported || (updateAvailable && latestRelease.forceUpdate),
        latestRelease: this.toDesktopReleaseSummary(latestRelease)
      }
    };
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

  async listBindingCodes(
    workspaceId: string,
    cookieHeader?: string
  ): Promise<ListDesktopBindingCodesResponse> {
    if (!isDatabasePersistenceEnabled()) {
      this.assertMockWorkspace(workspaceId);
      this.expireMockBindingCodes(new Date());
      return {
        data: this.mockBindingCodes
          .filter((bindingCode) => bindingCode.workspaceId === workspaceId)
          .map((bindingCode) => this.toMockBindingCodeSummary(bindingCode))
      };
    }

    await this.requireDesktopDeviceManagementAccess(workspaceId, cookieHeader);
    await this.expireDatabaseBindingCodes();

    const bindingCodes = await this.prismaService.desktopBindingCode.findMany({
      where: {
        workspaceId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      data: bindingCodes.map((bindingCode) => this.toBindingCodeSummary(bindingCode))
    };
  }

  async createBindingCode(
    workspaceId: string,
    body: unknown,
    cookieHeader?: string
  ): Promise<CreateDesktopBindingCodeResponse> {
    const request = parseCreateDesktopBindingCodeRequest(body);
    const expiresAt =
      request.expiresInMinutes === undefined
        ? undefined
        : new Date(Date.now() + request.expiresInMinutes * 60 * 1000);

    if (!isDatabasePersistenceEnabled()) {
      this.assertMockWorkspace(workspaceId);
      const bindingCode = createDesktopBindingCode();
      const now = new Date().toISOString();
      const record: MockDesktopBindingCodeRecord = {
        id: `desktop_binding_${Date.now()}`,
        workspaceId,
        label: request.label,
        codeHash: hashDesktopToken(normalizeDesktopBindingCode(bindingCode)),
        status: 'PENDING',
        expiresAt: expiresAt?.toISOString(),
        createdAt: now
      };
      this.mockBindingCodes.unshift(record);

      return {
        data: {
          ...this.toMockBindingCodeSummary(record),
          bindingCode
        }
      };
    }

    const access = await this.requireDesktopDeviceManagementAccess(workspaceId, cookieHeader);
    const bindingCode = createDesktopBindingCode();
    const created = await this.prismaService.desktopBindingCode.create({
      data: {
        workspaceId,
        label: request.label,
        codeHash: hashDesktopToken(normalizeDesktopBindingCode(bindingCode)),
        status: 'PENDING',
        expiresAt,
        createdByAccountId: access.accountId
      }
    });

    return {
      data: {
        ...this.toBindingCodeSummary(created),
        bindingCode
      }
    };
  }

  async updateBindingCode(
    workspaceId: string,
    bindingCodeId: string,
    body: unknown,
    cookieHeader?: string
  ): Promise<UpdateDesktopBindingCodeResponse> {
    const request = parseUpdateDesktopBindingCodeRequest(body);

    if (!isDatabasePersistenceEnabled()) {
      this.assertMockWorkspace(workspaceId);
      const bindingCode = this.mockBindingCodes.find(
        (item) => item.workspaceId === workspaceId && item.id === bindingCodeId
      );
      if (!bindingCode) {
        throw this.bindingCodeNotFound();
      }
      if (bindingCode.status !== 'PENDING') {
        throw this.bindingCodeUnavailable(bindingCode.status);
      }
      bindingCode.label = request.label;
      return {
        data: this.toMockBindingCodeSummary(bindingCode)
      };
    }

    await this.requireDesktopDeviceManagementAccess(workspaceId, cookieHeader);
    const existing = await this.prismaService.desktopBindingCode.findFirst({
      where: {
        id: bindingCodeId,
        workspaceId
      }
    });
    if (!existing) {
      throw this.bindingCodeNotFound();
    }
    if (existing.status !== 'PENDING') {
      throw this.bindingCodeUnavailable(existing.status);
    }

    const updated = await this.prismaService.desktopBindingCode.update({
      where: {
        id: bindingCodeId
      },
      data: {
        label: request.label ?? null
      }
    });

    return {
      data: this.toBindingCodeSummary(updated)
    };
  }

  async cancelBindingCode(
    workspaceId: string,
    bindingCodeId: string,
    cookieHeader?: string
  ): Promise<CancelDesktopBindingCodeResponse> {
    if (!isDatabasePersistenceEnabled()) {
      this.assertMockWorkspace(workspaceId);
      const bindingCode = this.mockBindingCodes.find(
        (item) => item.workspaceId === workspaceId && item.id === bindingCodeId
      );
      if (!bindingCode) {
        throw this.bindingCodeNotFound();
      }
      if (bindingCode.status === 'PENDING') {
        bindingCode.status = 'CANCELLED';
      }
      return {
        data: this.toMockBindingCodeSummary(bindingCode)
      };
    }

    await this.requireDesktopDeviceManagementAccess(workspaceId, cookieHeader);
    const existing = await this.prismaService.desktopBindingCode.findFirst({
      where: {
        id: bindingCodeId,
        workspaceId
      }
    });
    if (!existing) {
      throw this.bindingCodeNotFound();
    }

    const updated =
      existing.status === 'PENDING'
        ? await this.prismaService.desktopBindingCode.update({
            where: {
              id: bindingCodeId
            },
            data: {
              status: 'CANCELLED'
            }
          })
        : existing;

    return {
      data: this.toBindingCodeSummary(updated)
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

      if (
        bindingCode.status === 'PENDING' &&
        bindingCode.expiresAt &&
        new Date(bindingCode.expiresAt).getTime() <= now.getTime()
      ) {
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

    if (bindingCode.expiresAt && bindingCode.expiresAt.getTime() <= now.getTime()) {
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
    const existingDevice = await this.prismaService.desktopDevice.findUnique({
      where: {
        workspaceId_runtimeId: {
          workspaceId: bindingCode.workspaceId,
          runtimeId: request.runtimeId
        }
      }
    });
    const activeDeviceCount = await this.prismaService.desktopDevice.count({
      where: {
        workspaceId: bindingCode.workspaceId,
        status: 'ACTIVE'
      }
    });
    const requestedDeviceCount = existingDevice?.status === 'ACTIVE' ? activeDeviceCount : activeDeviceCount + 1;
    await this.entitlementService.requireAllowed(
      {
        workspaceId: bindingCode.workspaceId,
        featureKey: 'maxDesktopDevices',
        requestedAmount: requestedDeviceCount
      },
      'Desktop device quota has been reached.'
    );

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

      const persistedSnapshot = await this.restrictRuntimeSnapshotToAuthorizedTemplates(workspaceId, snapshot);
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
          runtimeSnapshot: persistedSnapshot as unknown as Prisma.InputJsonValue,
          syncedAt
        },
        create: {
          workspaceId,
          runtimeId: snapshot.runtimeId,
          deviceId: snapshot.deviceId,
          deviceName: snapshot.deviceName,
          platform: snapshot.platform,
          appVersion: snapshot.appVersion,
          runtimeSnapshot: persistedSnapshot as unknown as Prisma.InputJsonValue,
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

      const persistedSnapshot = await this.restrictRuntimeSnapshotToAuthorizedTemplates(workspaceId, snapshot);
      this.store.upsertDesktopRuntimeSync({
        workspaceId,
        runtimeId: snapshot.runtimeId,
        deviceId: snapshot.deviceId,
        deviceName: snapshot.deviceName,
        platform: snapshot.platform,
        appVersion: snapshot.appVersion,
        runtimeSnapshot: persistedSnapshot as unknown as Record<string, unknown>,
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

  private async restrictRuntimeSnapshotToAuthorizedTemplates(
    workspaceId: string,
    snapshot: DesktopRuntimeSnapshot
  ): Promise<DesktopRuntimeSnapshot> {
    const authorizedTemplates = await this.roleService.listPublishedTemplatesForDesktop(workspaceId);
    const authorizedTemplateIds = new Set(authorizedTemplates.data.map((template) => template.id));
    const rolePackages = snapshot.rolePackages.filter(
      (rolePackage) => rolePackage.templateId && authorizedTemplateIds.has(rolePackage.templateId)
    );

    if (rolePackages.length === snapshot.rolePackages.length) {
      return snapshot;
    }

    const authorizedRoleCodes = new Set(rolePackages.map((rolePackage) => rolePackage.roleCode));
    return {
      ...snapshot,
      rolePackages,
      tasks: snapshot.tasks.filter((task) => authorizedRoleCodes.has(task.roleCode))
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
          not: null,
          lt: new Date()
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });
  }

  private expireMockBindingCodes(now: Date) {
    for (const bindingCode of this.mockBindingCodes) {
      if (
        bindingCode.status === 'PENDING' &&
        bindingCode.expiresAt &&
        new Date(bindingCode.expiresAt).getTime() <= now.getTime()
      ) {
        bindingCode.status = 'EXPIRED';
      }
    }
  }

  private compareDesktopReleaseOrder(left: DesktopReleaseRecord, right: DesktopReleaseRecord): number {
    const versionOrder = this.compareDesktopVersions(left.version, right.version);
    if (versionOrder !== 0) {
      return versionOrder;
    }

    return (
      this.toDateTimeMs(left.publishedAt ?? left.updatedAt) -
      this.toDateTimeMs(right.publishedAt ?? right.updatedAt)
    );
  }

  private compareDesktopVersions(left: string, right: string): number {
    const leftParts = this.toVersionParts(left);
    const rightParts = this.toVersionParts(right);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
      const diff = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }

    return left.localeCompare(right);
  }

  private toVersionParts(value: string): number[] {
    return value.match(/\d+/g)?.map((item) => Number(item)) ?? [0];
  }

  private toDateTimeMs(value: DesktopReleaseDate | null | undefined): number {
    if (!value) {
      return 0;
    }

    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  }

  private toIsoDateString(value: DesktopReleaseDate | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return value instanceof Date ? value.toISOString() : value;
  }

  private toRequiredIsoDateString(value: DesktopReleaseDate): string {
    return this.toIsoDateString(value) ?? new Date(0).toISOString();
  }

  private toDesktopReleaseSummary(release: DesktopReleaseRecord) {
    return {
      id: release.id,
      version: release.version,
      platform: 'windows' as const,
      channel: 'stable' as const,
      downloadUrl: release.downloadUrl,
      releaseNotes: release.releaseNotes ?? undefined,
      checksumSha256: release.checksumSha256 ?? undefined,
      fileSizeBytes: release.fileSizeBytes ?? undefined,
      forceUpdate: release.forceUpdate,
      minimumSupportedVersion: release.minimumSupportedVersion ?? undefined,
      status: this.toDesktopReleaseStatus(release.status),
      publishedAt: this.toIsoDateString(release.publishedAt),
      createdAt: this.toRequiredIsoDateString(release.createdAt),
      updatedAt: this.toRequiredIsoDateString(release.updatedAt)
    };
  }

  private toDesktopReleaseStatus(value: string): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' {
    if (value === 'PUBLISHED' || value === 'ARCHIVED') {
      return value;
    }

    return 'DRAFT';
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

  private toMockBindingCodeSummary(bindingCode: MockDesktopBindingCodeRecord) {
    return {
      id: bindingCode.id,
      workspaceId: bindingCode.workspaceId,
      label: bindingCode.label,
      status: bindingCode.status,
      expiresAt: bindingCode.expiresAt,
      createdAt: bindingCode.createdAt,
      redeemedAt: bindingCode.redeemedAt
    };
  }

  private toBindingCodeSummary(bindingCode: {
    id: string;
    workspaceId: string;
    label: string | null;
    status: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
    expiresAt: Date | null;
    createdAt: Date;
    redeemedAt: Date | null;
  }) {
    return {
      id: bindingCode.id,
      workspaceId: bindingCode.workspaceId,
      label: bindingCode.label ?? undefined,
      status: bindingCode.status,
      expiresAt: bindingCode.expiresAt?.toISOString(),
      createdAt: bindingCode.createdAt.toISOString(),
      redeemedAt: bindingCode.redeemedAt?.toISOString()
    };
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
