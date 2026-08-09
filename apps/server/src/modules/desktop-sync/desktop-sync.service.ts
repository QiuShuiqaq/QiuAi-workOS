import { randomBytes } from 'node:crypto';

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
import { demoPlans } from '../../shared/mock/platform-seed';
import { isLocalDevelopmentUnlimitedEnabled } from '../../shared/local-development-mode';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { listServerToolActionCatalog } from '../../shared/tool-action-catalog';
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
  AcceptDesktopAgreementResponse,
  CancelDesktopBindingCodeResponse,
  CreateDesktopIssueReportResponse,
  CreateDesktopBindingCodeResponse,
  DesktopAgreementAcceptanceStatusResponse,
  DesktopAgreementAcceptanceSummary,
  DesktopDeviceSummary,
  DesktopIssueReportSummary,
  DesktopRuntimeSnapshot,
  DesktopRuntimeSyncResponse,
  ListDesktopBindingCodesResponse,
  ListDesktopDevicesResponse,
  RedeemDesktopBindingCodeResponse,
  UpdateDesktopBindingCodeResponse,
  parseAcceptDesktopAgreementRequest,
  parseAgreementAcceptanceStatusQuery,
  parseCreateDesktopIssueReportRequest,
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

type DesktopAgreementAcceptanceRecord = {
  id: string;
  agreementKey: string;
  agreementVersion: string;
  contentHash: string;
  runtimeId: string;
  deviceId: string;
  workspaceId?: string | null;
  consentMethod: string;
  minimumReadSeconds?: number | null;
  actualReadSeconds?: number | null;
  acceptedAt: DesktopReleaseDate;
};

type DesktopIssueReportRecord = {
  id: string;
  issueNo: string;
  category: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  contact?: string | null;
  workspaceId?: string | null;
  runtimeId?: string | null;
  deviceId?: string | null;
  deviceName?: string | null;
  appVersion?: string | null;
  platform?: string | null;
  diagnostics?: unknown;
  adminNote?: string | null;
  createdAt: DesktopReleaseDate;
  updatedAt: DesktopReleaseDate;
  workspace?: {
    name: string;
  } | null;
};

type DesktopApplicationType = 'digital_employee' | 'digital_factory';

type DesktopDeviceCapacitySummary = {
  planCode: string;
  maxDesktopDevices?: number;
  maxRoleInstances?: number;
  maxDigitalFactories?: number;
};

type PlanEntitlementForCapacity = {
  featureKey: string;
  enabled: boolean;
  limitValue?: number | null;
};

type PlanForCapacity = {
  code: string;
  entitlements: PlanEntitlementForCapacity[];
};

const freePlanCode = 'PERSONAL_FREE';
const usableDesktopCapacitySubscriptionStatuses = new Set(['FREE', 'TRIALING', 'ACTIVE']);

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

  async listDesktopToolActionCatalog(workspaceId?: string, deviceToken?: string) {
    if (workspaceId) {
      if (isDatabasePersistenceEnabled()) {
        await this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
      } else {
        this.assertMockWorkspace(workspaceId);
        this.requireMockDeviceTokenForWorkspace(workspaceId, deviceToken, new Date());
      }
    }

    return {
      data: listServerToolActionCatalog()
    };
  }

  async listAuthorizedRoleTemplates(
    workspaceId: string,
    deviceToken?: string,
    installedTemplateIds: string[] = []
  ) {
    const deletedTemplateIds = await this.roleService.listDeletedTemplateIds(installedTemplateIds);

    if (isLocalDevelopmentUnlimitedEnabled()) {
      if (isDatabasePersistenceEnabled()) {
        await this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
      } else {
        this.assertMockWorkspace(workspaceId);
        this.requireMockDeviceTokenForWorkspace(workspaceId, deviceToken, new Date());
      }

      return {
        ...(await this.roleService.listAllPublishedTemplatesForLocalDevelopment()),
        deletedTemplateIds
      };
    }

    if (isDatabasePersistenceEnabled()) {
      await this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
      const [response, deviceCapacity] = await Promise.all([
        this.roleService.listPublishedTemplatesForDesktop(workspaceId),
        this.resolveDesktopDeviceCapacity(workspaceId)
      ]);
      return {
        ...response,
        deviceCapacity,
        deletedTemplateIds
      };
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
    const [response, deviceCapacity] = await Promise.all([
      this.roleService.listPublishedTemplatesForDesktop(workspaceId),
      this.resolveDesktopDeviceCapacity(workspaceId)
    ]);
    return {
      ...response,
      deviceCapacity,
      deletedTemplateIds
    };
  }

  async listPublicFreeRoleTemplates(installedTemplateIds: string[] = []) {
    if (isLocalDevelopmentUnlimitedEnabled()) {
      const [response, deletedTemplateIds] = await Promise.all([
        this.roleService.listAllPublishedTemplatesForLocalDevelopment(),
        this.roleService.listDeletedTemplateIds(installedTemplateIds)
      ]);
      return {
        ...response,
        deletedTemplateIds
      };
    }

    const [response, deletedTemplateIds, deviceCapacity] = await Promise.all([
      this.roleService.listPublicFreeTemplatesForDesktop(),
      this.roleService.listDeletedTemplateIds(installedTemplateIds),
      this.resolvePublicFreeDesktopDeviceCapacity()
    ]);
    return {
      ...response,
      deviceCapacity,
      deletedTemplateIds
    };
  }

  async requireDesktopDeviceWorkspaceAccess(workspaceId: string, deviceToken?: string) {
    if (isDatabasePersistenceEnabled()) {
      return this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
    }

    this.assertMockWorkspace(workspaceId);
    this.requireMockDeviceTokenForWorkspace(workspaceId, deviceToken, new Date());
    return undefined;
  }

  async getDesktopAgreementAcceptanceStatus(
    query: Record<string, unknown>
  ): Promise<DesktopAgreementAcceptanceStatusResponse> {
    const request = parseAgreementAcceptanceStatusQuery(query);

    if (isDatabasePersistenceEnabled()) {
      const acceptance = await this.prismaService.desktopAgreementAcceptance.findUnique({
        where: {
          agreementKey_agreementVersion_contentHash_runtimeId: {
            agreementKey: request.agreementKey,
            agreementVersion: request.agreementVersion,
            contentHash: request.contentHash,
            runtimeId: request.runtimeId
          }
        }
      });

      if (!acceptance || acceptance.deviceId !== request.deviceId) {
        return {
          data: {
            accepted: false
          }
        };
      }

      return {
        data: {
          accepted: true,
          acceptance: this.toDesktopAgreementAcceptanceSummary(acceptance)
        }
      };
    }

    const acceptance = this.store.findDesktopAgreementAcceptance(request);
    return {
      data: acceptance
        ? {
            accepted: true,
            acceptance: this.toDesktopAgreementAcceptanceSummary(acceptance)
          }
        : {
            accepted: false
          }
    };
  }

  async acceptDesktopAgreement(
    body: unknown,
    context: {
      deviceToken?: string;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<AcceptDesktopAgreementResponse> {
    const request = parseAcceptDesktopAgreementRequest(body);
    if (
      request.minimumReadSeconds !== undefined &&
      request.actualReadSeconds !== undefined &&
      request.actualReadSeconds < request.minimumReadSeconds
    ) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Agreement must be readable for the required duration before acceptance.',
          details: {
            minimumReadSeconds: request.minimumReadSeconds,
            actualReadSeconds: request.actualReadSeconds
          }
        }
      });
    }

    const acceptedAt = new Date();

    if (isDatabasePersistenceEnabled()) {
      const desktopDevice = await this.findOptionalDatabaseDeviceForAgreementAcceptance(
        request,
        context.deviceToken
      );
      const acceptance = await this.prismaService.desktopAgreementAcceptance.upsert({
        where: {
          agreementKey_agreementVersion_contentHash_runtimeId: {
            agreementKey: request.agreementKey,
            agreementVersion: request.agreementVersion,
            contentHash: request.contentHash,
            runtimeId: request.runtimeId
          }
        },
        update: {
          deviceId: request.deviceId,
          deviceName: request.deviceName,
          platform: request.platform,
          appVersion: request.appVersion,
          workspaceId: request.workspaceId,
          desktopDeviceId: desktopDevice?.id,
          consentMethod: request.consentMethod,
          minimumReadSeconds: request.minimumReadSeconds,
          actualReadSeconds: request.actualReadSeconds,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        },
        create: {
          agreementKey: request.agreementKey,
          agreementVersion: request.agreementVersion,
          contentHash: request.contentHash,
          runtimeId: request.runtimeId,
          deviceId: request.deviceId,
          deviceName: request.deviceName,
          platform: request.platform,
          appVersion: request.appVersion,
          workspaceId: request.workspaceId,
          desktopDeviceId: desktopDevice?.id,
          consentMethod: request.consentMethod,
          minimumReadSeconds: request.minimumReadSeconds,
          actualReadSeconds: request.actualReadSeconds,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          acceptedAt
        }
      });

      return {
        data: this.toDesktopAgreementAcceptanceSummary(acceptance)
      };
    }

    const acceptance = this.store.upsertDesktopAgreementAcceptance({
      agreementKey: request.agreementKey,
      agreementVersion: request.agreementVersion,
      contentHash: request.contentHash,
      runtimeId: request.runtimeId,
      deviceId: request.deviceId,
      deviceName: request.deviceName,
      platform: request.platform,
      appVersion: request.appVersion,
      workspaceId: request.workspaceId,
      consentMethod: request.consentMethod,
      minimumReadSeconds: request.minimumReadSeconds,
      actualReadSeconds: request.actualReadSeconds,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      acceptedAt: acceptedAt.toISOString()
    });

    return {
      data: this.toDesktopAgreementAcceptanceSummary(acceptance)
    };
  }

  async createDesktopIssueReport(
    body: unknown,
    context: {
      deviceToken?: string;
    } = {}
  ): Promise<CreateDesktopIssueReportResponse> {
    const request = parseCreateDesktopIssueReportRequest(body);
    const now = new Date();
    const diagnostics = sanitizeDesktopIssueDiagnostics(request.diagnostics);

    if (isDatabasePersistenceEnabled()) {
      const verifiedDevice = request.workspaceId && context.deviceToken
        ? await this.tryResolveDatabaseDeviceForIssueReport(request.workspaceId, context.deviceToken)
        : undefined;
      const workspaceId = verifiedDevice?.workspaceId;
      const created = await this.createDatabaseIssueReportWithUniqueNo({
        category: request.category,
        severity: request.severity,
        title: request.title,
        description: request.description,
        contact: request.contact ?? null,
        workspaceId,
        desktopDeviceId: verifiedDevice?.id,
        runtimeId: request.runtimeId ?? verifiedDevice?.runtimeId ?? null,
        deviceId: request.deviceId ?? verifiedDevice?.deviceId ?? null,
        deviceName: request.deviceName ?? verifiedDevice?.deviceName ?? null,
        appVersion: request.appVersion ?? verifiedDevice?.appVersion ?? null,
        platform: request.platform ?? verifiedDevice?.platform ?? null,
        diagnostics,
        now
      });

      return {
        data: this.toDesktopIssueReportSummary(created)
      };
    }

    const created = this.store.createDesktopIssueReport({
      issueNo: this.createIssueNo(now),
      category: request.category,
      severity: request.severity,
      title: request.title,
      description: request.description,
      contact: request.contact ?? null,
      workspaceId: request.workspaceId ?? null,
      runtimeId: request.runtimeId ?? null,
      deviceId: request.deviceId ?? null,
      deviceName: request.deviceName ?? null,
      appVersion: request.appVersion ?? null,
      platform: request.platform ?? null,
      diagnostics: diagnostics as Record<string, unknown> | null
    });

    return {
      data: this.toDesktopIssueReportSummary(created)
    };
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
    if (isLocalDevelopmentUnlimitedEnabled()) {
      return snapshot;
    }

    const [authorizedTemplates, deviceCapacity] = await Promise.all([
      this.roleService.listPublishedTemplatesForDesktop(workspaceId),
      this.resolveDesktopDeviceCapacity(workspaceId)
    ]);
    const authorizedTemplateById = new Map(
      authorizedTemplates.data
        .filter((template) => template.canInstall !== false)
        .map((template) => [template.id, template] as const)
    );
    const rolePackages = this.restrictRolePackagesByDeviceCapacity(
      snapshot.rolePackages.filter(
        (rolePackage) => rolePackage.templateId && authorizedTemplateById.has(rolePackage.templateId)
      ),
      authorizedTemplateById,
      deviceCapacity
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

  private restrictRolePackagesByDeviceCapacity(
    rolePackages: DesktopRuntimeSnapshot['rolePackages'],
    authorizedTemplateById: Map<string, { applicationType?: string }>,
    deviceCapacity?: DesktopDeviceCapacitySummary
  ): DesktopRuntimeSnapshot['rolePackages'] {
    const limits: Record<DesktopApplicationType, number | undefined> = {
      digital_employee: deviceCapacity?.maxRoleInstances,
      digital_factory: deviceCapacity?.maxDigitalFactories
    };
    const used: Record<DesktopApplicationType, number> = {
      digital_employee: 0,
      digital_factory: 0
    };

    return rolePackages.filter((rolePackage) => {
      if (rolePackage.state === 'deleted') {
        return true;
      }

      const template = rolePackage.templateId ? authorizedTemplateById.get(rolePackage.templateId) : undefined;
      const applicationType = this.toDesktopApplicationType(template?.applicationType);
      const limit = limits[applicationType];
      if (limit !== undefined && used[applicationType] >= limit) {
        return false;
      }

      used[applicationType] += 1;
      return true;
    });
  }

  private async resolveDesktopDeviceCapacity(workspaceId: string): Promise<DesktopDeviceCapacitySummary | undefined> {
    if (!isDatabasePersistenceEnabled()) {
      const subscription = this.store.getSubscription(workspaceId);
      const plan =
        subscription &&
        this.isDesktopCapacitySubscriptionUsable(subscription.status, subscription.currentPeriodEnd)
          ? demoPlans.find((item) => item.code === subscription.planCode)
          : demoPlans.find((item) => item.code === freePlanCode);

      return this.toDesktopDeviceCapacity(plan);
    }

    const subscription = await this.prismaService.subscription.findFirst({
      where: {
        workspaceId
      },
      include: {
        plan: {
          include: {
            entitlements: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    if (
      subscription &&
      this.isDesktopCapacitySubscriptionUsable(subscription.status, subscription.currentPeriodEnd)
    ) {
      return this.toDesktopDeviceCapacity(subscription.plan);
    }

    const freePlan = await this.prismaService.plan.findUnique({
      where: {
        code: freePlanCode
      },
      include: {
        entitlements: true
      }
    });

    return this.toDesktopDeviceCapacity(freePlan ?? undefined);
  }

  private async resolvePublicFreeDesktopDeviceCapacity(): Promise<DesktopDeviceCapacitySummary | undefined> {
    if (!isDatabasePersistenceEnabled()) {
      return this.toDesktopDeviceCapacity(demoPlans.find((plan) => plan.code === freePlanCode));
    }

    const freePlan = await this.prismaService.plan.findUnique({
      where: {
        code: freePlanCode
      },
      include: {
        entitlements: true
      }
    });

    return this.toDesktopDeviceCapacity(freePlan ?? undefined);
  }

  private toDesktopDeviceCapacity(plan: PlanForCapacity | undefined): DesktopDeviceCapacitySummary | undefined {
    if (!plan) {
      return undefined;
    }

    return {
      planCode: plan.code,
      maxDesktopDevices: this.readCapacityLimit(plan.entitlements, 'maxDesktopDevices'),
      maxRoleInstances: this.readCapacityLimit(plan.entitlements, 'maxRoleInstances'),
      maxDigitalFactories: this.readCapacityLimit(plan.entitlements, 'maxDigitalFactories')
    };
  }

  private readCapacityLimit(entitlements: PlanEntitlementForCapacity[], featureKey: string): number | undefined {
    const entitlement = entitlements.find((item) => item.featureKey === featureKey);
    if (!entitlement) {
      return undefined;
    }

    if (!entitlement.enabled) {
      return 0;
    }

    return entitlement.limitValue ?? undefined;
  }

  private isDesktopCapacitySubscriptionUsable(
    status: string,
    currentPeriodEnd?: string | Date | null
  ): boolean {
    if (!usableDesktopCapacitySubscriptionStatuses.has(status.toUpperCase())) {
      return false;
    }

    if (!currentPeriodEnd) {
      return true;
    }

    const periodEnd = currentPeriodEnd instanceof Date ? currentPeriodEnd.getTime() : Date.parse(currentPeriodEnd);
    if (Number.isNaN(periodEnd)) {
      return true;
    }

    return periodEnd > Date.now();
  }

  private toDesktopApplicationType(value: string | undefined): DesktopApplicationType {
    return value === 'digital_factory' ? 'digital_factory' : 'digital_employee';
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

  private async findOptionalDatabaseDeviceForAgreementAcceptance(
    request: { runtimeId: string; deviceId: string; workspaceId?: string },
    deviceToken?: string
  ) {
    if (!deviceToken) {
      return undefined;
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

    if (request.workspaceId && device.workspaceId !== request.workspaceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device is not bound to this workspace.',
          details: {
            workspaceId: request.workspaceId
          }
        }
      });
    }

    if (device.runtimeId !== request.runtimeId || device.deviceId !== request.deviceId) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Desktop device token does not match this runtime.'
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

  private async tryResolveDatabaseDeviceForIssueReport(workspaceId: string, deviceToken: string) {
    try {
      return await this.requireDatabaseDeviceTokenForWorkspace(workspaceId, deviceToken);
    } catch {
      return undefined;
    }
  }

  private async createDatabaseIssueReportWithUniqueNo(input: {
    category: string;
    severity: string;
    title: string;
    description: string;
    contact: string | null;
    workspaceId?: string | null;
    desktopDeviceId?: string | null;
    runtimeId?: string | null;
    deviceId?: string | null;
    deviceName?: string | null;
    appVersion?: string | null;
    platform?: string | null;
    diagnostics: Record<string, unknown> | null;
    now: Date;
  }) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        return await this.prismaService.desktopIssueReport.create({
          data: {
            issueNo: this.createIssueNo(input.now),
            category: input.category as never,
            severity: input.severity as never,
            title: input.title,
            description: input.description,
            contact: input.contact,
            workspaceId: input.workspaceId,
            desktopDeviceId: input.desktopDeviceId,
            runtimeId: input.runtimeId,
            deviceId: input.deviceId,
            deviceName: input.deviceName,
            appVersion: input.appVersion,
            platform: input.platform,
            diagnostics: input.diagnostics
              ? (input.diagnostics as Prisma.InputJsonValue)
              : Prisma.JsonNull
          },
          include: {
            workspace: {
              select: {
                name: true
              }
            }
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
          throw error;
        }
      }
    }

    throw new ConflictException({
      error: {
        code: 'CONFLICT',
        message: 'Failed to allocate a unique issue number.'
      }
    });
  }

  private createIssueNo(date: Date): string {
    const day = date.toISOString().slice(0, 10).replace(/-/g, '');
    return `ISSUE-${day}-${randomBytes(3).toString('hex').toUpperCase()}`;
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

  private toDesktopAgreementAcceptanceSummary(
    acceptance: DesktopAgreementAcceptanceRecord
  ): DesktopAgreementAcceptanceSummary {
    return {
      id: acceptance.id,
      agreementKey: acceptance.agreementKey,
      agreementVersion: acceptance.agreementVersion,
      contentHash: acceptance.contentHash,
      runtimeId: acceptance.runtimeId,
      deviceId: acceptance.deviceId,
      workspaceId: acceptance.workspaceId ?? undefined,
      acceptedAt: this.toRequiredIsoDateString(acceptance.acceptedAt),
      consentMethod: acceptance.consentMethod,
      minimumReadSeconds: acceptance.minimumReadSeconds ?? undefined,
      actualReadSeconds: acceptance.actualReadSeconds ?? undefined
    };
  }

  private toDesktopIssueReportSummary(report: DesktopIssueReportRecord): DesktopIssueReportSummary {
    const summary = {
      id: report.id,
      issueNo: report.issueNo,
      category: this.toDesktopIssueCategory(report.category),
      severity: this.toDesktopIssueSeverity(report.severity),
      status: this.toDesktopIssueStatus(report.status),
      title: report.title,
      description: report.description,
      contact: report.contact ?? undefined,
      workspaceId: report.workspaceId ?? undefined,
      workspaceName: report.workspace?.name,
      runtimeId: report.runtimeId ?? undefined,
      deviceId: report.deviceId ?? undefined,
      deviceName: report.deviceName ?? undefined,
      appVersion: report.appVersion ?? undefined,
      platform: report.platform ?? undefined,
      diagnostics: isRecord(report.diagnostics)
        ? (report.diagnostics as Record<string, unknown>)
        : undefined,
      adminNote: report.adminNote ?? undefined,
      createdAt: this.toRequiredIsoDateString(report.createdAt),
      updatedAt: this.toRequiredIsoDateString(report.updatedAt)
    };

    return summary;
  }

  private toDesktopIssueCategory(value: string): DesktopIssueReportSummary['category'] {
    if (
      value === 'BUG' ||
      value === 'USAGE' ||
      value === 'FEATURE_REQUEST' ||
      value === 'BAD_OUTPUT' ||
      value === 'OTHER'
    ) {
      return value;
    }

    return 'OTHER';
  }

  private toDesktopIssueSeverity(value: string): DesktopIssueReportSummary['severity'] {
    if (value === 'IMPACTING' || value === 'BLOCKING') {
      return value;
    }

    return 'NORMAL';
  }

  private toDesktopIssueStatus(value: string): DesktopIssueReportSummary['status'] {
    if (
      value === 'VIEWED' ||
      value === 'IN_PROGRESS' ||
      value === 'FIXED' ||
      value === 'WONT_FIX' ||
      value === 'CLOSED'
    ) {
      return value;
    }

    return 'NEW';
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

function sanitizeDesktopIssueDiagnostics(
  diagnostics: Record<string, unknown> | undefined
): Record<string, unknown> | null {
  if (!diagnostics) {
    return null;
  }

  return sanitizeJsonRecord(diagnostics, 0);
}

function sanitizeJsonRecord(input: Record<string, unknown>, depth: number): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  const entries = Object.entries(input).slice(0, 80);

  for (const [key, value] of entries) {
    const normalizedKey = key.trim().slice(0, 80);
    if (!normalizedKey || isSensitiveDiagnosticKey(normalizedKey)) {
      continue;
    }

    const sanitizedValue = sanitizeJsonValue(value, depth + 1);
    if (sanitizedValue !== undefined) {
      output[normalizedKey] = sanitizedValue;
    }
  }

  return output;
}

function sanitizeJsonValue(value: unknown, depth: number): unknown {
  if (depth > 5 || value === undefined || typeof value === 'function' || typeof value === 'symbol') {
    return undefined;
  }

  if (value === null || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }

  if (typeof value === 'string') {
    return redactLocalPath(value).slice(0, 1200);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 60)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    return sanitizeJsonRecord(value, depth + 1);
  }

  return undefined;
}

function isSensitiveDiagnosticKey(key: string): boolean {
  return /api[_-]?key|secret|token|authorization|password|credential/i.test(key);
}

function redactLocalPath(value: string): string {
  return value
    .replace(/[A-Za-z]:\\(?:[^\\\r\n]+\\)+([^\\\r\n]+)/g, '...\\$1')
    .replace(/\/(?:[^/\r\n]+\/)+([^/\r\n]+)/g, '.../$1');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
