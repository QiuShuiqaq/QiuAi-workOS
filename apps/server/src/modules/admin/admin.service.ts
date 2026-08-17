import { randomBytes } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from '@nestjs/common';
import type { AiPointWallet, BillingCycle, PlanCode, Prisma, WorkspaceMemberRole } from '@prisma/client';

import { hashPassword } from '../../shared/auth/password-hash';
import {
  getDesktopReleaseAssetMetadata,
  saveDesktopReleaseAsset
} from '../../shared/desktop-release-assets';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { listServerToolActionCatalog } from '../../shared/tool-action-catalog';
import { AuthService } from '../auth/auth.service';
import { EntitlementService } from '../entitlement/entitlement.service';
import {
  createDesktopBindingCode,
  hashDesktopToken,
  normalizeDesktopBindingCode
} from '../desktop-sync/desktop-auth-token';
import { buildInvitationUrl, createInvitationToken, hashInvitationToken } from '../invitation/invitation-token';
import type { CurrentAccountResponseDto } from '../workspace/dto/current-account-response.dto';
import {
  AdminPlanDetailDto,
  AdminWorkspaceAiPointUsageSummaryDto,
  AdminOfficialModelApiKeySummaryDto,
  AdminOfficialModelRouteSummaryDto,
  AdminWorkspaceDetailDto,
  AdminWorkspaceInvitationSummaryDto,
  AdminWorkspaceSummaryDto,
  ArchiveAdminDesktopReleaseResponseDto,
  AdjustAdminWorkspaceAiPointsRequestDto,
  AdjustAdminWorkspaceAiPointsResponseDto,
  CancelAdminWorkspaceInvitationResponseDto,
  CreateAdminOfficialModelApiKeyRequestDto,
  CreateAdminOfficialModelApiKeyResponseDto,
  CreateAdminDesktopReleaseRequestDto,
  CreateAdminDesktopReleaseResponseDto,
  CreateAdminDesktopBindingCodeRequestDto,
  CreateAdminDesktopBindingCodeResponseDto,
  CreateAdminWorkspaceInvitationRequestDto,
  CreateAdminWorkspaceInvitationResponseDto,
  CreateAdminWorkspaceRequestDto,
  CreateAdminWorkspaceResponseDto,
  CreateAdminWorkspaceSupportLoginResponseDto,
  GetAdminWorkspaceResponseDto,
  GrantAdminWorkspaceAuthorizationRequestDto,
  GrantAdminWorkspaceAuthorizationResponseDto,
  DeleteAdminIssueMessageResponseDto,
  GetAdminIssueMessageResponseDto,
  ListAdminActionLogsQueryDto,
  ListAdminActionLogsResponseDto,
  ListAdminDesktopReleasesQueryDto,
  ListAdminDesktopReleasesResponseDto,
  ListAdminIssueMessagesQueryDto,
  ListAdminIssueMessagesResponseDto,
  ListAdminOfficialModelRoutesResponseDto,
  ListAdminPlansResponseDto,
  ListAdminWorkspacesQueryDto,
  ListAdminWorkspacesResponseDto,
  PublishAdminDesktopReleaseResponseDto,
  RevokeAdminDesktopDeviceResponseDto,
  UpdateAdminIssueMessageRequestDto,
  UpdateAdminIssueMessageResponseDto,
  UpdateAdminOfficialModelApiKeyRequestDto,
  UpdateAdminOfficialModelApiKeyResponseDto,
  UpdateAdminDesktopReleaseRequestDto,
  UpdateAdminDesktopReleaseResponseDto,
  UpdateAdminWorkspaceStatusRequestDto,
  UpdateAdminWorkspaceStatusResponseDto,
  UploadAdminDesktopReleaseAssetResponseDto,
  UpdateAdminPlanRequestDto,
  UpdateAdminPlanResponseDto
} from './dto/admin-console.dto';

const PLAN_DISPLAY_ORDER = [
  'PERSONAL_FREE',
  'PERSONAL_MEMBER_MONTHLY',
  'PERSONAL_MEMBER_ANNUAL',
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
] as const;

const PLAN_CODES = new Set<string>(PLAN_DISPLAY_ORDER);
const SUPPORT_LOGIN_MAX_AGE_SECONDS = 60 * 60 * 2;

type WorkspaceSummaryRecord = {
  id: string;
  tenantId: string;
  type: string;
  name: string;
  ownerAccountId: string;
  status: string;
  updatedAt: Date;
  tenant: {
    name: string;
  };
  ownerAccount: {
    primaryEmail: string;
  };
  aiPointWallet: {
    workspaceId: string;
    balancePoints: number;
    reservedPoints: number;
    updatedAt: Date;
  } | null;
  subscriptions: Array<{
    status: string;
    currentPeriodEnd: Date | null;
    plan: {
      code: string;
      name: string;
    };
  }>;
  _count: {
    memberships: number;
    roleInstances: number;
    tasks: number;
    desktopDevices: number;
    billingOrders: number;
  };
};

type WorkspaceDetailRecord = WorkspaceSummaryRecord & {
  memberships: Array<{
    id: string;
    workspaceId: string;
    accountId: string;
    role: string;
    departmentId: string | null;
    createdAt: Date;
    account: {
      primaryEmail: string;
    };
    department: {
      name: string;
    } | null;
  }>;
  subscriptions: Array<{
    id: string;
    workspaceId: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    plan: {
      code: string;
      name: string;
    };
  }>;
  billingAccount: {
    id: string;
    workspaceId: string;
    status: string;
    billingName: string | null;
    taxId: string | null;
    contactEmail: string | null;
    defaultProvider: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  aiPointWallet: {
    workspaceId: string;
    balancePoints: number;
    reservedPoints: number;
    updatedAt: Date;
  } | null;
  billingOrders: Array<{
    id: string;
    workspaceId: string;
    orderNo: string;
    provider: string;
    status: string;
    subject: string;
    amountCents: number;
    currency: string;
    billingCycle: string;
    periodStart: Date | null;
    periodEnd: Date | null;
    paymentUrl: string | null;
    providerTradeNo: string | null;
    paidAt: Date | null;
    expiresAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    plan: {
      code: string;
      name: string;
    };
  }>;
  invitations: Array<{
    id: string;
    workspaceId: string;
    departmentId: string | null;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
    department: {
      name: string;
    } | null;
  }>;
  desktopDevices: Array<{
    id: string;
    workspaceId: string;
    runtimeId: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    status: string;
    boundAt: Date;
    lastSeenAt: Date | null;
    lastSyncedAt: Date | null;
  }>;
  desktopBindingCodes: Array<{
    id: string;
    workspaceId: string;
    label: string | null;
    status: string;
    expiresAt: Date | null;
    createdAt: Date;
    redeemedAt: Date | null;
  }>;
};

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

type DesktopIssueMessageRecord = {
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

type AdminAiPointBucketForDeduction = {
  id: string;
  sourceType: string;
  availablePoints: number;
  expiresAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore
  ) {}

  async listToolActionCatalog(cookieHeader?: string) {
    await this.requireAdminOperator(cookieHeader);
    return {
      data: listServerToolActionCatalog()
    };
  }

  async listPlans(cookieHeader?: string): Promise<ListAdminPlansResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const plans = await this.prismaService.plan.findMany({
      include: {
        entitlements: {
          orderBy: {
            featureKey: 'asc'
          }
        }
      }
    });

    return {
      data: plans
        .sort((left, right) => this.getPlanDisplayIndex(left.code) - this.getPlanDisplayIndex(right.code))
        .map((plan) => this.toAdminPlanDetail(plan))
    };
  }

  async updatePlan(
    planCode: string,
    input: UpdateAdminPlanRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminPlanResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const code = this.requirePlanCode(planCode);
    const existingPlan = await this.prismaService.plan.findUnique({
      where: {
        code
      }
    });

    if (!existingPlan) {
      throw this.planNotFound(code);
    }

    const planData = this.buildPlanUpdateData(input);
    const entitlements = input.entitlements
      ? this.normalizeEntitlementInputs(input.entitlements)
      : undefined;

    const updated = await this.prismaService.$transaction(async (tx) => {
      await tx.plan.update({
        where: {
          code
        },
        data: planData
      });

      if (entitlements) {
        await tx.entitlement.deleteMany({
          where: {
            planId: existingPlan.id
          }
        });

        if (entitlements.length > 0) {
          await tx.entitlement.createMany({
            data: entitlements.map((entitlement) => ({
              planId: existingPlan.id,
              ...entitlement
            }))
          });
        }
      }

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'UPDATE_PLAN',
        targetType: 'plan',
        targetId: code,
        summary: `Updated plan ${code}`,
        metadata: {
          input: this.toJsonValue(input)
        }
      });

      const plan = await tx.plan.findUnique({
        where: {
          code
        },
        include: {
          entitlements: {
            orderBy: {
              featureKey: 'asc'
            }
          }
        }
      });

      if (!plan) {
        throw this.planNotFound(code);
      }

      return plan;
    });

    return {
      data: this.toAdminPlanDetail(updated)
    };
  }

  async listOfficialModelRoutes(cookieHeader?: string): Promise<ListAdminOfficialModelRoutesResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const routes = await this.prismaService.officialModelRoute.findMany({
      include: {
        apiKeys: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
        }
      },
      orderBy: [{ sortOrder: 'asc' }, { routeKey: 'asc' }]
    });

    return {
      data: routes.map((route) => this.toAdminOfficialModelRouteSummary(route))
    };
  }

  async createOfficialModelApiKey(
    routeKey: string,
    input: CreateAdminOfficialModelApiKeyRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminOfficialModelApiKeyResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const normalizedRouteKey = routeKey.trim();
    const route = await this.prismaService.officialModelRoute.findUnique({
      where: { routeKey: normalizedRouteKey }
    });
    if (!route) {
      throw this.officialRouteNotFound(normalizedRouteKey);
    }

    const apiKeySecret = this.requireOfficialApiKeySecret(input.apiKey);
    const created = await this.prismaService.$transaction(async (tx) => {
      const key = await tx.officialModelApiKey.create({
        data: {
          routeKey: route.routeKey,
          label: input.label?.trim() || `${route.displayName} · key`,
          providerId: route.providerId,
          apiKeySecret,
          apiKeyLastFour: this.maskOfficialApiKeyLastFour(apiKeySecret),
          status: this.toOfficialApiKeyStatus(input.status) ?? 'ACTIVE',
          maxConcurrency: input.maxConcurrency ?? this.defaultOfficialApiKeyConcurrency(route.providerId),
          rpmLimit: this.normalizeOfficialRpmLimit(
            input.rpmLimit === undefined ? this.defaultOfficialApiKeyRpmLimit(route.providerId) : input.rpmLimit
          ),
          sortOrder: input.sortOrder ?? 1000,
          metadata: {
            source: 'admin'
          }
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CREATE_OFFICIAL_MODEL_API_KEY',
        targetType: 'official_model_api_key',
        targetId: key.id,
        summary: `Created official model API key for ${route.routeKey}`,
        metadata: {
          routeKey: route.routeKey,
          providerId: route.providerId,
          apiKeyLastFour: key.apiKeyLastFour,
          maxConcurrency: key.maxConcurrency,
          rpmLimit: key.rpmLimit
        }
      });

      return key;
    });

    return {
      data: this.toAdminOfficialModelApiKeySummary(created)
    };
  }

  async updateOfficialModelApiKey(
    apiKeyId: string,
    input: UpdateAdminOfficialModelApiKeyRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminOfficialModelApiKeyResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const id = apiKeyId.trim();
    const current = await this.prismaService.officialModelApiKey.findUnique({
      where: { id },
      include: { route: true }
    });
    if (!current) {
      throw this.officialApiKeyNotFound(id);
    }

    const data = this.buildOfficialApiKeyUpdateData(input);
    const updated = await this.prismaService.$transaction(async (tx) => {
      const key = await tx.officialModelApiKey.update({
        where: { id },
        data
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'UPDATE_OFFICIAL_MODEL_API_KEY',
        targetType: 'official_model_api_key',
        targetId: key.id,
        summary: `Updated official model API key for ${current.routeKey}`,
        metadata: {
          routeKey: current.routeKey,
          providerId: current.providerId,
          apiKeyLastFour: key.apiKeyLastFour,
          status: key.status,
          maxConcurrency: key.maxConcurrency,
          rpmLimit: key.rpmLimit,
          replacedSecret: Boolean(input.apiKey?.trim())
        }
      });

      return key;
    });

    return {
      data: this.toAdminOfficialModelApiKeySummary(updated)
    };
  }

  async listDesktopReleases(
    query: ListAdminDesktopReleasesQueryDto,
    cookieHeader?: string
  ): Promise<ListAdminDesktopReleasesResponseDto> {
    await this.requireAdminOperator(cookieHeader);

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    if (!isDatabasePersistenceEnabled()) {
      const filtered = this.store
        .listDesktopReleases()
        .filter((release) => this.matchesDesktopReleaseQuery(release, query))
        .sort((left, right) => this.compareDesktopReleaseOrder(right, left));
      const totalItems = filtered.length;

      return {
        data: filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((release) => this.toDesktopReleaseSummary(release)),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
        }
      };
    }

    const where = this.buildDesktopReleaseWhere(query);
    const [totalItems, releases] = await this.prismaService.$transaction([
      this.prismaService.desktopRelease.count({ where }),
      this.prismaService.desktopRelease.findMany({
        where,
        orderBy: [
          {
            publishedAt: 'desc'
          },
          {
            updatedAt: 'desc'
          }
        ],
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      data: releases.map((release) => this.toDesktopReleaseSummary(release)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async createDesktopRelease(
    input: CreateAdminDesktopReleaseRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminDesktopReleaseResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const normalized = this.normalizeCreateDesktopReleaseInput(input);
    await this.hydrateDesktopReleaseAssetMetadata(normalized, normalized.downloadUrl);

    if (!isDatabasePersistenceEnabled()) {
      const created = this.store.createDesktopRelease({
        id: `desktop_release_${Date.now()}`,
        ...normalized,
        publishedAt: normalized.status === 'PUBLISHED' ? new Date().toISOString() : undefined
      });
      if (!created) {
        throw this.desktopReleaseConflict(normalized.version);
      }

      return {
        data: this.toDesktopReleaseSummary(created)
      };
    }

    await this.assertDesktopReleaseUnique(
      normalized.platform,
      normalized.channel,
      normalized.version
    );

    const created = await this.prismaService.$transaction(async (tx) => {
      const release = await tx.desktopRelease.create({
        data: {
          ...normalized,
          publishedAt: normalized.status === 'PUBLISHED' ? new Date() : null
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CREATE_DESKTOP_RELEASE',
        targetType: 'desktop_release',
        targetId: release.id,
        summary: `Created desktop release ${release.version}`,
        metadata: {
          version: release.version,
          platform: release.platform,
          channel: release.channel,
          status: release.status
        }
      });

      return release;
    });

    return {
      data: this.toDesktopReleaseSummary(created)
    };
  }

  async updateDesktopRelease(
    releaseId: string,
    input: UpdateAdminDesktopReleaseRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminDesktopReleaseResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = releaseId.trim();
    const normalized = this.normalizeUpdateDesktopReleaseInput(input);

    if (!isDatabasePersistenceEnabled()) {
      const current = this.store.getDesktopRelease(id);
      if (!current) {
        throw this.desktopReleaseNotFound(id);
      }

      const next = {
        ...normalized
      };
      await this.hydrateDesktopReleaseAssetMetadata(next, normalized.downloadUrl ?? current.downloadUrl);
      if (normalized.status === 'PUBLISHED' && current.status !== 'PUBLISHED') {
        next.publishedAt = new Date().toISOString();
      }

      const updated = this.store.updateDesktopRelease(id, next);
      if (updated === undefined) {
        throw this.desktopReleaseNotFound(id);
      }
      if (updated === null) {
        throw this.desktopReleaseConflict(normalized.version ?? current.version);
      }

      return {
        data: this.toDesktopReleaseSummary(updated)
      };
    }

    const current = await this.prismaService.desktopRelease.findUnique({
      where: {
        id
      }
    });
    if (!current) {
      throw this.desktopReleaseNotFound(id);
    }

    const nextPlatform = normalized.platform ?? current.platform;
    const nextChannel = normalized.channel ?? current.channel;
    const nextVersion = normalized.version ?? current.version;
    await this.assertDesktopReleaseUnique(nextPlatform, nextChannel, nextVersion, id);
    await this.hydrateDesktopReleaseAssetMetadata(
      normalized,
      normalized.downloadUrl ?? current.downloadUrl
    );

    const updateData = {
      ...normalized
    } as Prisma.DesktopReleaseUpdateInput;
    if (normalized.status === 'PUBLISHED' && current.status !== 'PUBLISHED') {
      updateData.publishedAt = new Date();
    }

    const updated = await this.prismaService.$transaction(async (tx) => {
      const release = await tx.desktopRelease.update({
        where: {
          id
        },
        data: updateData
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'UPDATE_DESKTOP_RELEASE',
        targetType: 'desktop_release',
        targetId: release.id,
        summary: `Updated desktop release ${release.version}`,
        metadata: input
      });

      return release;
    });

    return {
      data: this.toDesktopReleaseSummary(updated)
    };
  }

  async publishDesktopRelease(
    releaseId: string,
    cookieHeader?: string
  ): Promise<PublishAdminDesktopReleaseResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = releaseId.trim();
    const publishedAt = new Date();

    if (!isDatabasePersistenceEnabled()) {
      const updated = this.store.updateDesktopRelease(id, {
        status: 'PUBLISHED',
        publishedAt: publishedAt.toISOString()
      });
      if (!updated) {
        throw this.desktopReleaseNotFound(id);
      }

      return {
        data: this.toDesktopReleaseSummary(updated)
      };
    }

    const current = await this.prismaService.desktopRelease.findUnique({
      where: {
        id
      }
    });
    if (!current) {
      throw this.desktopReleaseNotFound(id);
    }

    const published = await this.prismaService.$transaction(async (tx) => {
      const release = await tx.desktopRelease.update({
        where: {
          id
        },
        data: {
          status: 'PUBLISHED',
          publishedAt
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'PUBLISH_DESKTOP_RELEASE',
        targetType: 'desktop_release',
        targetId: release.id,
        summary: `Published desktop release ${release.version}`,
        metadata: {
          version: release.version,
          platform: release.platform,
          channel: release.channel,
          forceUpdate: release.forceUpdate
        }
      });

      return release;
    });

    return {
      data: this.toDesktopReleaseSummary(published)
    };
  }

  async archiveDesktopRelease(
    releaseId: string,
    cookieHeader?: string
  ): Promise<ArchiveAdminDesktopReleaseResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = releaseId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const updated = this.store.updateDesktopRelease(id, {
        status: 'ARCHIVED'
      });
      if (!updated) {
        throw this.desktopReleaseNotFound(id);
      }

      return {
        data: this.toDesktopReleaseSummary(updated)
      };
    }

    const current = await this.prismaService.desktopRelease.findUnique({
      where: {
        id
      }
    });
    if (!current) {
      throw this.desktopReleaseNotFound(id);
    }

    const archived = await this.prismaService.$transaction(async (tx) => {
      const release = await tx.desktopRelease.update({
        where: {
          id
        },
        data: {
          status: 'ARCHIVED'
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'ARCHIVE_DESKTOP_RELEASE',
        targetType: 'desktop_release',
        targetId: release.id,
        summary: `Archived desktop release ${release.version}`,
        metadata: {
          version: release.version,
          platform: release.platform,
          channel: release.channel
        }
      });

      return release;
    });

    return {
      data: this.toDesktopReleaseSummary(archived)
    };
  }

  async uploadDesktopReleaseAsset(input: {
    cookieHeader?: string;
    fileName: string;
    contentType?: string;
    body: Buffer;
  }): Promise<UploadAdminDesktopReleaseAssetResponseDto> {
    await this.requireAdminOperator(input.cookieHeader);

    return {
      data: await saveDesktopReleaseAsset({
        fileName: input.fileName,
        contentType: input.contentType,
        body: input.body
      })
    };
  }

  async listIssueMessages(
    query: ListAdminIssueMessagesQueryDto,
    cookieHeader?: string
  ): Promise<ListAdminIssueMessagesResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    if (!isDatabasePersistenceEnabled()) {
      const filtered = this.store
        .listDesktopIssueReports()
        .filter((report) => this.matchesIssueMessageQuery(report, query))
        .sort((left, right) => this.toDateTimeMs(right.createdAt) - this.toDateTimeMs(left.createdAt));
      const totalItems = filtered.length;

      return {
        data: filtered
          .slice((page - 1) * pageSize, page * pageSize)
          .map((report) => this.toIssueMessageSummary(report)),
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
        }
      };
    }

    const where = this.buildIssueMessageWhere(query);
    const [totalItems, reports] = await this.prismaService.$transaction([
      this.prismaService.desktopIssueReport.count({ where }),
      this.prismaService.desktopIssueReport.findMany({
        where,
        include: {
          workspace: {
            select: {
              name: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      data: reports.map((report) => this.toIssueMessageSummary(report)),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async getIssueMessage(
    issueId: string,
    cookieHeader?: string
  ): Promise<GetAdminIssueMessageResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    const id = issueId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const report = this.store.getDesktopIssueReport(id);
      if (!report) {
        throw this.issueMessageNotFound(id);
      }

      return {
        data: this.toIssueMessageSummary(report)
      };
    }

    const report = await this.prismaService.desktopIssueReport.findUnique({
      where: {
        id
      },
      include: {
        workspace: {
          select: {
            name: true
          }
        }
      }
    });

    if (!report) {
      throw this.issueMessageNotFound(id);
    }

    return {
      data: this.toIssueMessageSummary(report)
    };
  }

  async updateIssueMessage(
    issueId: string,
    input: UpdateAdminIssueMessageRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminIssueMessageResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = issueId.trim();
    const updateData = this.normalizeIssueMessageUpdate(input);

    if (!isDatabasePersistenceEnabled()) {
      const updated = this.store.updateDesktopIssueReport(id, updateData);
      if (!updated) {
        throw this.issueMessageNotFound(id);
      }

      return {
        data: this.toIssueMessageSummary(updated)
      };
    }

    const current = await this.prismaService.desktopIssueReport.findUnique({
      where: {
        id
      }
    });
    if (!current) {
      throw this.issueMessageNotFound(id);
    }

    const updated = await this.prismaService.$transaction(async (tx) => {
      const report = await tx.desktopIssueReport.update({
        where: {
          id
        },
        data: updateData as Prisma.DesktopIssueReportUpdateInput,
        include: {
          workspace: {
            select: {
              name: true
            }
          }
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'UPDATE_DESKTOP_ISSUE_MESSAGE',
        targetType: 'desktop_issue_report',
        targetId: report.id,
        summary: `Updated issue message ${report.issueNo}`,
        metadata: input
      });

      return report;
    });

    return {
      data: this.toIssueMessageSummary(updated)
    };
  }

  async deleteIssueMessage(
    issueId: string,
    cookieHeader?: string
  ): Promise<DeleteAdminIssueMessageResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = issueId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const deleted = this.store.deleteDesktopIssueReport(id);
      if (!deleted) {
        throw this.issueMessageNotFound(id);
      }

      return {
        data: {
          id,
          deleted: true
        }
      };
    }

    const current = await this.prismaService.desktopIssueReport.findUnique({
      where: {
        id
      }
    });
    if (!current) {
      throw this.issueMessageNotFound(id);
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.desktopIssueReport.delete({
        where: {
          id
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'DELETE_DESKTOP_ISSUE_MESSAGE',
        targetType: 'desktop_issue_report',
        targetId: id,
        summary: `Deleted issue message ${current.issueNo}`,
        metadata: {
          issueNo: current.issueNo,
          title: current.title,
          status: current.status
        }
      });
    });

    return {
      data: {
        id,
        deleted: true
      }
    };
  }

  async listWorkspaces(
    query: ListAdminWorkspacesQueryDto,
    cookieHeader?: string
  ): Promise<ListAdminWorkspacesResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWorkspaceWhere(query.query, query.workspaceType);

    const [totalItems, workspaces] = await this.prismaService.$transaction([
      this.prismaService.workspace.count({ where }),
      this.prismaService.workspace.findMany({
        where,
        include: this.workspaceSummaryInclude(),
        orderBy: {
          updatedAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const usageByWorkspaceId = await this.getWorkspaceAiPointUsageByWorkspaceIds(
      workspaces.map((workspace) => workspace.id)
    );

    return {
      data: workspaces.map((workspace) =>
        this.toAdminWorkspaceSummary(workspace, usageByWorkspaceId.get(workspace.id))
      ),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  async createWorkspace(
    input: CreateAdminWorkspaceRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminWorkspaceResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const workspaceName = this.requireNonEmptyText(input.workspaceName, 'Workspace name cannot be empty.');
    const tenantName = input.tenantName?.trim() || `${workspaceName} Tenant`;
    const ownerEmail = this.normalizeEmail(input.ownerEmail);
    const planCode = this.requirePlanCode(input.planCode);
    const plan = await this.prismaService.plan.findUnique({
      where: {
        code: planCode
      }
    });

    if (!plan) {
      throw this.planNotFound(planCode);
    }

    this.requireWorkspaceCreationPlan(plan);

    const period = this.resolveAuthorizationPeriod(input, plan.billingCycle);
    const result = await this.prismaService.$transaction(async (tx) => {
      const existingAccount = await tx.account.findUnique({
        where: {
          primaryEmail: ownerEmail
        }
      });
      const requestedPassword = input.ownerPassword?.trim();
      let temporaryPassword: string | undefined;
      let passwordMode: 'existing' | 'provided' | 'generated';
      let passwordHash: string | undefined;

      if (requestedPassword) {
        passwordMode = 'provided';
        passwordHash = hashPassword(requestedPassword);
      } else if (!existingAccount?.passwordHash) {
        passwordMode = 'generated';
        temporaryPassword = this.generateTemporaryPassword();
        passwordHash = hashPassword(temporaryPassword);
      } else {
        passwordMode = 'existing';
      }

      const ownerAccount = existingAccount
        ? await tx.account.update({
            where: {
              id: existingAccount.id
            },
            data: {
              status: 'ACTIVE',
              ...(passwordHash ? { passwordHash } : {})
            }
          })
        : await tx.account.create({
            data: {
              primaryEmail: ownerEmail,
              status: 'ACTIVE',
              passwordHash
            }
          });

      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
          type: 'ENTERPRISE',
          status: 'ACTIVE'
        }
      });

      const workspace = await tx.workspace.create({
        data: {
          tenantId: tenant.id,
          type: 'ENTERPRISE',
          name: workspaceName,
          ownerAccountId: ownerAccount.id,
          status: 'ACTIVE'
        }
      });

      await tx.workspaceMember.create({
        data: {
          workspaceId: workspace.id,
          accountId: ownerAccount.id,
          role: 'OWNER'
        }
      });

      await tx.organization.create({
        data: {
          tenantId: tenant.id,
          workspaceId: workspace.id,
          name: workspaceName,
          industry: input.industry?.trim() || null,
          size: input.size?.trim() || null,
          settings: {
            createdBy: 'admin-console'
          }
        }
      });

      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle: plan.billingCycle,
          currentPeriodStart: period.start,
          currentPeriodEnd: period.end,
          cancelAtPeriodEnd: false
        }
      });

      await tx.billingAccount.create({
        data: {
          workspaceId: workspace.id,
          status: 'ACTIVE',
          billingName: workspaceName,
          contactEmail: ownerEmail,
          defaultProvider: 'ALIPAY'
        }
      });

      const usagePeriod = this.toUsagePeriod(period.start);
      await tx.usageMeter.createMany({
        data: [
          {
            workspaceId: workspace.id,
            metricKey: 'roleInstances.count',
            period: usagePeriod,
            usedValue: 0
          },
          {
            workspaceId: workspace.id,
            metricKey: 'tasks.monthlyCount',
            period: usagePeriod,
            usedValue: 0
          }
        ]
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CREATE_WORKSPACE',
        targetType: 'workspace',
        targetId: workspace.id,
        summary: `Created enterprise workspace ${workspace.name} with ${plan.code}`,
        metadata: {
          workspaceName,
          tenantName,
          ownerEmail,
          planCode: plan.code,
          passwordMode,
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString(),
          note: input.note?.trim() || undefined
        }
      });

      return {
        workspaceId: workspace.id,
        ownerAccount: {
          id: ownerAccount.id,
          primaryEmail: ownerAccount.primaryEmail,
          passwordMode
        },
        temporaryPassword
      };
    });

    return {
      data: await this.getWorkspaceDetailData(result.workspaceId),
      ownerAccount: result.ownerAccount,
      temporaryPassword: result.temporaryPassword
    };
  }

  async getWorkspace(workspaceId: string, cookieHeader?: string): Promise<GetAdminWorkspaceResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    return {
      data: await this.getWorkspaceDetailData(workspaceId)
    };
  }

  async createWorkspaceSupportLogin(
    workspaceId: string,
    cookieHeader?: string
  ): Promise<CreateAdminWorkspaceSupportLoginResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        ownerAccount: true
      }
    });

    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }
    if (workspace.type !== 'ENTERPRISE') {
      throw new BadRequestException({
        error: {
          code: 'WORKSPACE_TYPE_NOT_SUPPORTED',
          message: 'Support login is only available for enterprise workspaces.',
          details: {
            workspaceId,
            workspaceType: workspace.type
          }
        }
      });
    }
    this.requireActiveWorkspace(workspace);

    if (workspace.ownerAccount.status !== 'ACTIVE') {
      throw new ForbiddenException({
        error: {
          code: 'OWNER_ACCOUNT_NOT_ACTIVE',
          message: 'Workspace owner account is not active.',
          details: {
            workspaceId,
            ownerAccountId: workspace.ownerAccountId
          }
        }
      });
    }

    const session = await this.authService.createSessionForAccount(workspace.ownerAccountId, {
      maxAgeSeconds: SUPPORT_LOGIN_MAX_AGE_SECONDS,
      userAgent: `admin-support:${operator.account.primaryEmail}`
    });
    const webConsoleUrl = this.buildSupportLoginUrl(session.sessionToken, workspace.id);
    const expiresAt =
      session.response.expiresAt ??
      new Date(Date.now() + SUPPORT_LOGIN_MAX_AGE_SECONDS * 1000).toISOString();

    await this.prismaService.adminActionLog.create({
      data: {
        operatorAccountId: operator.account.id,
        action: 'ADMIN_SUPPORT_LOGIN',
        targetType: 'workspace',
        targetId: workspace.id,
        summary: `Created support login for ${workspace.name}`,
        metadata: this.toJsonValue({
          workspaceName: workspace.name,
          ownerAccountId: workspace.ownerAccountId,
          ownerEmail: workspace.ownerAccount.primaryEmail,
          expiresAt,
          reason: 'support_maintenance'
        })
      }
    });

    return {
      data: {
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        ownerEmail: workspace.ownerAccount.primaryEmail,
        webConsoleUrl,
        expiresAt
      }
    };
  }

  async createWorkspaceInvitation(
    workspaceId: string,
    input: CreateAdminWorkspaceInvitationRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminWorkspaceInvitationResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      }
    });
    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }
    this.requireActiveWorkspace(workspace);

    const normalizedEmail = this.normalizeEmail(input.email);
    const existingMember = await this.prismaService.workspaceMember.findFirst({
      where: {
        workspaceId,
        account: {
          primaryEmail: normalizedEmail
        }
      }
    });
    if (existingMember) {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'This email is already a workspace member.',
          details: {
            workspaceId,
            email: normalizedEmail
          }
        }
      });
    }

    const existingPendingInvitation = await this.prismaService.invitation.findFirst({
      where: {
        workspaceId,
        email: {
          equals: normalizedEmail,
          mode: 'insensitive'
        },
        status: 'PENDING'
      }
    });
    if (existingPendingInvitation) {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'An invitation already exists for this email.',
          details: {
            workspaceId,
            email: normalizedEmail
          }
        }
      });
    }

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = this.addDays(new Date(), input.expiresInDays ?? 7);
    const department = input.departmentId
      ? await this.prismaService.department.findFirst({
          where: {
            id: input.departmentId,
            organization: {
              workspaceId
            }
          }
        })
      : null;
    if (input.departmentId && !department) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Department was not found.',
          details: {
            workspaceId,
            departmentId: input.departmentId
          }
        }
      });
    }

    const invitation = await this.prismaService.$transaction(async (tx) => {
      const created = await tx.invitation.create({
        data: {
          workspaceId,
          departmentId: department?.id ?? null,
          email: normalizedEmail,
          role: this.toMemberRole(input.systemRole ?? 'member'),
          tokenHash,
          status: 'PENDING',
          expiresAt,
          createdByAccountId: operator.account.id
        },
        include: {
          department: true
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CREATE_WORKSPACE_INVITATION',
        targetType: 'workspace',
        targetId: workspaceId,
        summary: `Created invitation for ${normalizedEmail} in ${workspace.name}`,
        metadata: {
          invitationId: created.id,
          email: normalizedEmail,
          systemRole: input.systemRole ?? 'member',
          departmentId: department?.id,
          expiresAt: expiresAt.toISOString()
        }
      });

      return created;
    });

    return {
      data: this.toAdminInvitationSummary(invitation),
      inviteUrl: buildInvitationUrl(token)
    };
  }

  async cancelWorkspaceInvitation(
    workspaceId: string,
    invitationId: string,
    cookieHeader?: string
  ): Promise<CancelAdminWorkspaceInvitationResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const invitation = await this.prismaService.invitation.findFirst({
      where: {
        id: invitationId,
        workspaceId
      },
      include: {
        workspace: true,
        department: true
      }
    });
    if (!invitation) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Invitation was not found.',
          details: {
            workspaceId,
            invitationId
          }
        }
      });
    }

    if (invitation.status !== 'PENDING') {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'Only pending invitations can be cancelled.',
          details: {
            workspaceId,
            invitationId,
            status: invitation.status
          }
        }
      });
    }

    const cancelled = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.invitation.update({
        where: {
          id: invitation.id
        },
        data: {
          status: 'CANCELLED'
        },
        include: {
          department: true
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CANCEL_WORKSPACE_INVITATION',
        targetType: 'workspace',
        targetId: workspaceId,
        summary: `Cancelled invitation for ${invitation.email} in ${invitation.workspace.name}`,
        metadata: {
          invitationId: invitation.id,
          email: invitation.email
        }
      });

      return updated;
    });

    return {
      data: this.toAdminInvitationSummary(cancelled)
    };
  }

  async createDesktopBindingCode(
    workspaceId: string,
    input: CreateAdminDesktopBindingCodeRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminDesktopBindingCodeResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      }
    });
    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }
    this.requireActiveWorkspace(workspace);
    const activeDeviceCount = await this.prismaService.desktopDevice.count({
      where: {
        workspaceId,
        status: 'ACTIVE'
      }
    });
    await this.entitlementService.requireAllowed(
      {
        workspaceId,
        featureKey: 'maxDesktopDevices',
        requestedAmount: activeDeviceCount + 1
      },
      'Desktop device quota has been reached.'
    );

    const bindingCode = createDesktopBindingCode();
    const expiresAt =
      input.expiresInMinutes === undefined
        ? undefined
        : new Date(Date.now() + input.expiresInMinutes * 60 * 1000);
    const created = await this.prismaService.$transaction(async (tx) => {
      const binding = await tx.desktopBindingCode.create({
        data: {
          workspaceId,
          label: input.label,
          codeHash: hashDesktopToken(normalizeDesktopBindingCode(bindingCode)),
          status: 'PENDING',
          expiresAt,
          createdByAccountId: operator.account.id
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CREATE_DESKTOP_BINDING_CODE',
        targetType: 'workspace',
        targetId: workspaceId,
        summary: `Created desktop binding code for ${workspace.name}`,
        metadata: {
          bindingCodeId: binding.id,
          expiresAt: expiresAt?.toISOString()
        }
      });

      return binding;
    });

    return {
      data: {
        ...this.toDesktopBindingCodeSummary(created),
        bindingCode
      }
    };
  }

  async revokeDesktopDevice(
    workspaceId: string,
    deviceId: string,
    cookieHeader?: string
  ): Promise<RevokeAdminDesktopDeviceResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const device = await this.prismaService.desktopDevice.findFirst({
      where: {
        id: deviceId,
        workspaceId
      },
      include: {
        workspace: true
      }
    });
    if (!device) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Desktop device was not found.',
          details: {
            workspaceId,
            deviceId
          }
        }
      });
    }

    const revoked = await this.prismaService.$transaction(async (tx) => {
      const updated = await tx.desktopDevice.update({
        where: {
          id: device.id
        },
        data: {
          status: 'REVOKED'
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'REVOKE_DESKTOP_DEVICE',
        targetType: 'desktop_device',
        targetId: device.id,
        summary: `Revoked desktop device ${device.deviceName} for ${device.workspace.name}`,
        metadata: {
          workspaceId,
          runtimeId: device.runtimeId,
          deviceId: device.deviceId
        }
      });

      return updated;
    });

    return {
      data: this.toAdminDesktopDeviceSummary(revoked)
    };
  }

  async grantWorkspaceAuthorization(
    workspaceId: string,
    input: GrantAdminWorkspaceAuthorizationRequestDto,
    cookieHeader?: string
  ): Promise<GrantAdminWorkspaceAuthorizationResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const planCode = this.requirePlanCode(input.planCode);
    const plan = await this.prismaService.plan.findUnique({
      where: {
        code: planCode
      }
    });

    if (!plan) {
      throw this.planNotFound(planCode);
    }

    if (plan.billingCycle === 'FREE') {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Manual authorization requires a non-free enterprise plan.',
          details: { planCode }
        }
      });
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        tenant: true,
        subscriptions: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });

    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }

    const period = this.resolveAuthorizationPeriod(input, plan.billingCycle);
    const latestSubscription = workspace.subscriptions[0];

    await this.prismaService.$transaction(async (tx) => {
      const subscriptionData = {
        workspaceId,
        planId: plan.id,
        status: 'ACTIVE' as const,
        billingCycle: plan.billingCycle,
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
        cancelAtPeriodEnd: false
      };

      if (latestSubscription) {
        await tx.subscription.update({
          where: {
            id: latestSubscription.id
          },
          data: subscriptionData
        });
      } else {
        await tx.subscription.create({
          data: subscriptionData
        });
      }

      if (workspace.status !== 'ACTIVE') {
        await tx.workspace.update({
          where: {
            id: workspaceId
          },
          data: {
            status: 'ACTIVE'
          }
        });
      }

      if (workspace.tenant.status !== 'ACTIVE') {
        await tx.tenant.update({
          where: {
            id: workspace.tenantId
          },
          data: {
            status: 'ACTIVE'
          }
        });
      }

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'MANUAL_AUTHORIZE_WORKSPACE',
        targetType: 'workspace',
        targetId: workspaceId,
        summary: `Manual authorization for ${workspace.name} to ${plan.code}`,
        metadata: {
          planCode: plan.code,
          reason: input.reason.trim(),
          note: input.note?.trim(),
          periodStart: period.start.toISOString(),
          periodEnd: period.end.toISOString()
        }
      });
    });

    return {
      data: await this.getWorkspaceDetailData(workspaceId)
    };
  }

  async adjustWorkspaceAiPoints(
    workspaceId: string,
    input: AdjustAdminWorkspaceAiPointsRequestDto,
    cookieHeader?: string
  ): Promise<AdjustAdminWorkspaceAiPointsResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const points = Math.trunc(Number(input.points));
    if (!Number.isFinite(points) || points === 0) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'AI points adjustment must be a non-zero integer.'
        }
      });
    }
    const reason = this.requireNonEmptyText(input.reason, 'AI points adjustment reason cannot be empty.');
    const note = input.note?.trim() || undefined;

    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId }
    });
    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }

    await this.prismaService.$transaction(async (tx) => {
      const currentWallet = await tx.aiPointWallet.upsert({
        where: { workspaceId },
        update: {},
        create: {
          workspaceId,
          balancePoints: 0,
          reservedPoints: 0
        }
      });
      const nextBalancePoints = currentWallet.balancePoints + points;
      if (nextBalancePoints < currentWallet.reservedPoints) {
        throw new BadRequestException({
          error: {
            code: 'AI_POINTS_BALANCE_INVALID',
            message: 'AI 点数余额不能低于正在使用中的冻结点数。'
          }
        });
      }

      const wallet = await tx.aiPointWallet.update({
        where: { workspaceId },
        data: {
          balancePoints: nextBalancePoints
        }
      });

      if (points > 0) {
        await tx.aiPointCreditBucket.create({
          data: {
            workspaceId,
            sourceType: 'ADMIN_GRANT',
            totalPoints: points,
            availablePoints: points,
            reservedPoints: 0,
            startsAt: new Date(),
            metadata: this.toJsonValue({
              note,
              reason,
              source: 'admin-console'
            })
          }
        });
      } else {
        await this.ensureAdminAiPointBucketCoverage(tx, workspaceId, currentWallet);
        await this.deductAdminAiPointBuckets(tx, workspaceId, Math.abs(points));
      }

      await tx.aiPointLedgerEntry.create({
        data: {
          workspaceId,
          type: points > 0 ? 'GRANT' : 'ADJUSTMENT',
          status: 'COMPLETED',
          points,
          balanceAfter: wallet.balancePoints - wallet.reservedPoints,
          description: reason,
          metadata: this.toJsonValue({
            note,
            source: 'admin-console'
          })
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'ADJUST_AI_POINTS',
        targetType: 'workspace',
        targetId: workspaceId,
        summary: `Adjusted AI points for ${workspace.name}: ${points}`,
        metadata: {
          points,
          reason,
          note,
          balancePoints: wallet.balancePoints,
          reservedPoints: wallet.reservedPoints,
          availablePoints: wallet.balancePoints - wallet.reservedPoints
        }
      });
    });

    return {
      data: await this.getWorkspaceDetailData(workspaceId)
    };
  }

  async updateWorkspaceStatus(
    workspaceId: string,
    input: UpdateAdminWorkspaceStatusRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminWorkspaceStatusResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const reason = this.requireNonEmptyText(input.reason, 'Status change reason cannot be empty.');
    const note = input.note?.trim() || undefined;
    const nextStatus = input.status;

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        tenant: true
      }
    });

    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.workspace.update({
        where: {
          id: workspaceId
        },
        data: {
          status: nextStatus
        }
      });

      if (workspace.tenant.status !== nextStatus) {
        await tx.tenant.update({
          where: {
            id: workspace.tenantId
          },
          data: {
            status: nextStatus
          }
        });
      }

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'UPDATE_WORKSPACE_STATUS',
        targetType: 'workspace',
        targetId: workspaceId,
        summary: `Changed workspace ${workspace.name} status from ${workspace.status} to ${nextStatus}`,
        metadata: {
          previousStatus: workspace.status,
          nextStatus,
          reason,
          note
        }
      });
    });

    return {
      data: await this.getWorkspaceDetailData(workspaceId)
    };
  }

  async listActionLogs(
    query: ListAdminActionLogsQueryDto,
    cookieHeader?: string
  ): Promise<ListAdminActionLogsResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildActionLogWhere(query);

    const [totalItems, logs] = await this.prismaService.$transaction([
      this.prismaService.adminActionLog.count({ where }),
      this.prismaService.adminActionLog.findMany({
        where,
        include: {
          operator: {
            select: {
              primaryEmail: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        operatorAccountId: log.operatorAccountId ?? undefined,
        operatorEmail: log.operator?.primaryEmail,
        action: log.action,
        targetType: log.targetType,
        targetId: log.targetId,
        summary: log.summary,
        metadata: this.toMetadataRecord(log.metadata),
        createdAt: log.createdAt.toISOString()
      })),
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / pageSize))
      }
    };
  }

  private async requireAdminOperator(cookieHeader?: string): Promise<CurrentAccountResponseDto> {
    const currentAccount = await this.authService.getCurrentAccount(cookieHeader);
    const operatorEmails = this.getOperatorEmails();
    const email = this.normalizeEmail(currentAccount.account.primaryEmail);

    if (!operatorEmails.has(email)) {
      throw new ForbiddenException({
        error: {
          code: 'ADMIN_ACCESS_DENIED',
          message: 'Admin console access is restricted to platform operators.'
        }
      });
    }

    return currentAccount;
  }

  private getOperatorEmails(): Set<string> {
    const configuredEmails = process.env.ADMIN_CONSOLE_OPERATOR_EMAILS;
    const fallbackEmail = process.env.WORKOS_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@qiuai.local';
    const source = configuredEmails?.trim() ? configuredEmails : fallbackEmail;

    return new Set(
      source
        .split(',')
        .map((email) => this.normalizeEmail(email))
        .filter(Boolean)
    );
  }

  private requireDatabaseMode(): void {
    if (!isDatabasePersistenceEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PERSISTENCE_MODE_REQUIRED',
          message: 'Admin console operations require database persistence mode.'
        }
      });
    }
  }

  private requirePlanCode(planCode: string): PlanCode {
    const code = planCode.trim().toUpperCase();
    if (!PLAN_CODES.has(code)) {
      throw this.planNotFound(code);
    }
    return code as PlanCode;
  }

  private buildPlanUpdateData(input: UpdateAdminPlanRequestDto): Prisma.PlanUpdateInput {
    const data: Prisma.PlanUpdateInput = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Plan name cannot be empty.'
          }
        });
      }
      data.name = name;
    }

    if (input.description !== undefined) {
      data.description = input.description?.trim() || null;
    }

    if (input.priceCents !== undefined) {
      data.priceCents = input.priceCents;
    }

    if (input.currency !== undefined) {
      data.currency = input.currency?.trim().toUpperCase() || null;
    }

    if (input.status !== undefined) {
      data.status = input.status;
    }

    return data;
  }

  private buildOfficialApiKeyUpdateData(input: UpdateAdminOfficialModelApiKeyRequestDto): Prisma.OfficialModelApiKeyUpdateInput {
    const data: Prisma.OfficialModelApiKeyUpdateInput = {};

    if (input.label !== undefined) {
      const label = input.label.trim();
      if (!label) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'API key label cannot be empty.'
          }
        });
      }
      data.label = label;
    }

    if (input.apiKey !== undefined) {
      const apiKeySecret = this.requireOfficialApiKeySecret(input.apiKey);
      data.apiKeySecret = apiKeySecret;
      data.apiKeyLastFour = this.maskOfficialApiKeyLastFour(apiKeySecret);
    }

    const status = this.toOfficialApiKeyStatus(input.status);
    if (status) {
      data.status = status;
      if (status === 'ACTIVE' || status === 'DISABLED') {
        data.cooldownUntil = null;
      }
      if (status === 'COOLDOWN') {
        data.cooldownUntil = new Date(Date.now() + 60_000);
      }
    }

    if (input.maxConcurrency !== undefined) {
      data.maxConcurrency = input.maxConcurrency;
    }

    if (input.rpmLimit !== undefined) {
      data.rpmLimit = this.normalizeOfficialRpmLimit(input.rpmLimit);
    }

    if (input.sortOrder !== undefined) {
      data.sortOrder = input.sortOrder;
    }

    return data;
  }

  private requireOfficialApiKeySecret(value: string | undefined): string {
    const apiKey = value?.trim() ?? '';
    if (!apiKey) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'API key cannot be empty.'
        }
      });
    }
    return apiKey;
  }

  private toOfficialApiKeyStatus(value: string | undefined): 'ACTIVE' | 'DISABLED' | 'COOLDOWN' | undefined {
    if (value === 'active') {
      return 'ACTIVE';
    }
    if (value === 'disabled') {
      return 'DISABLED';
    }
    if (value === 'cooldown') {
      return 'COOLDOWN';
    }
    return undefined;
  }

  private normalizeOfficialRpmLimit(value: number | null | undefined): number | null {
    return value && value > 0 ? value : null;
  }

  private maskOfficialApiKeyLastFour(apiKey: string): string {
    return apiKey.slice(-4) || '****';
  }

  private defaultOfficialApiKeyConcurrency(providerId: string): number {
    switch (providerId) {
      case 'deepseek':
        return 500;
      case 'grsai':
        return 16;
      case 'minimax':
        return 4;
      default:
        return 1;
    }
  }

  private defaultOfficialApiKeyRpmLimit(providerId: string): number | undefined {
    return providerId === 'minimax' ? 16 : undefined;
  }

  private normalizeEntitlementInputs(input: UpdateAdminPlanRequestDto['entitlements']) {
    const entitlements = input ?? [];
    const seen = new Set<string>();

    return entitlements.map((entitlement) => {
      const featureKey = entitlement.featureKey.trim();
      if (!featureKey) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Entitlement featureKey cannot be empty.'
          }
        });
      }

      if (seen.has(featureKey)) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Duplicate entitlement featureKey.',
            details: { featureKey }
          }
        });
      }
      seen.add(featureKey);

      return {
        featureKey,
        enabled: entitlement.enabled,
        limitValue: entitlement.limitValue ?? null,
        limitUnit: entitlement.limitUnit?.trim() || null
      };
    });
  }

  private buildDesktopReleaseWhere(
    query: ListAdminDesktopReleasesQueryDto
  ): Prisma.DesktopReleaseWhereInput {
    const where: Prisma.DesktopReleaseWhereInput = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.platform) {
      where.platform = query.platform;
    }
    if (query.channel) {
      where.channel = query.channel;
    }

    return where;
  }

  private matchesDesktopReleaseQuery(
    release: { status: string; platform: string; channel: string },
    query: ListAdminDesktopReleasesQueryDto
  ): boolean {
    return (
      (!query.status || release.status === query.status) &&
      (!query.platform || release.platform === query.platform) &&
      (!query.channel || release.channel === query.channel)
    );
  }

  private buildIssueMessageWhere(
    query: ListAdminIssueMessagesQueryDto
  ): Prisma.DesktopIssueReportWhereInput {
    const filters: Prisma.DesktopIssueReportWhereInput[] = [];
    const search = query.query?.trim();

    if (query.status) {
      filters.push({ status: query.status as never });
    }
    if (query.category) {
      filters.push({ category: query.category as never });
    }
    if (query.severity) {
      filters.push({ severity: query.severity as never });
    }
    if (query.workspaceId) {
      filters.push({ workspaceId: query.workspaceId });
    }
    if (search) {
      filters.push({
        OR: [
          {
            issueNo: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            title: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            description: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            deviceName: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            appVersion: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            workspace: {
              name: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        ]
      });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  private matchesIssueMessageQuery(
    report: {
      issueNo: string;
      category: string;
      severity: string;
      status: string;
      title: string;
      description: string;
      deviceName?: string | null;
      appVersion?: string | null;
      workspaceId?: string | null;
    },
    query: ListAdminIssueMessagesQueryDto
  ): boolean {
    const search = query.query?.trim().toLowerCase();
    return (
      (!query.status || report.status === query.status) &&
      (!query.category || report.category === query.category) &&
      (!query.severity || report.severity === query.severity) &&
      (!query.workspaceId || report.workspaceId === query.workspaceId) &&
      (!search ||
        [
          report.issueNo,
          report.title,
          report.description,
          report.deviceName,
          report.appVersion
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(search)))
    );
  }

  private normalizeIssueMessageUpdate(input: UpdateAdminIssueMessageRequestDto) {
    const update: {
      status?: string;
      adminNote?: string | null;
    } = {};

    if (input.status !== undefined) {
      update.status = input.status;
    }
    if (input.adminNote !== undefined) {
      const note = input.adminNote?.trim() ?? '';
      if (note.length > 2000) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Admin note must be at most 2000 characters.'
          }
        });
      }
      update.adminNote = note || null;
    }

    if (Object.keys(update).length === 0) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'At least one issue message field must be provided.'
        }
      });
    }

    return update;
  }

  private normalizeCreateDesktopReleaseInput(input: CreateAdminDesktopReleaseRequestDto) {
    const version = this.requireNonEmptyText(input.version, 'Desktop release version is required.');
    const downloadUrl = this.requireNonEmptyText(
      input.downloadUrl,
      'Desktop release downloadUrl is required.'
    );

    return {
      version,
      platform: input.platform ?? 'windows',
      channel: input.channel ?? 'stable',
      downloadUrl,
      releaseNotes: this.toNullableTrimmedText(input.releaseNotes),
      checksumSha256: this.toNullableTrimmedText(input.checksumSha256),
      fileSizeBytes: input.fileSizeBytes ?? null,
      forceUpdate: input.forceUpdate ?? false,
      minimumSupportedVersion: this.toNullableTrimmedText(input.minimumSupportedVersion),
      status: input.status ?? 'DRAFT'
    };
  }

  private normalizeUpdateDesktopReleaseInput(
    input: UpdateAdminDesktopReleaseRequestDto
  ): Partial<DesktopReleaseRecord> {
    const update: Partial<DesktopReleaseRecord> = {};

    if (input.version !== undefined) {
      update.version = this.requireNonEmptyText(input.version, 'Desktop release version cannot be empty.');
    }
    if (input.platform !== undefined) {
      update.platform = input.platform;
    }
    if (input.channel !== undefined) {
      update.channel = input.channel;
    }
    if (input.downloadUrl !== undefined) {
      update.downloadUrl = this.requireNonEmptyText(
        input.downloadUrl,
        'Desktop release downloadUrl cannot be empty.'
      );
    }
    if (input.releaseNotes !== undefined) {
      update.releaseNotes = this.toNullableTrimmedText(input.releaseNotes);
    }
    if (input.checksumSha256 !== undefined) {
      update.checksumSha256 = this.toNullableTrimmedText(input.checksumSha256);
    }
    if (input.fileSizeBytes !== undefined) {
      update.fileSizeBytes = input.fileSizeBytes;
    }
    if (input.forceUpdate !== undefined) {
      update.forceUpdate = input.forceUpdate;
    }
    if (input.minimumSupportedVersion !== undefined) {
      update.minimumSupportedVersion = this.toNullableTrimmedText(input.minimumSupportedVersion);
    }
    if (input.status !== undefined) {
      update.status = input.status;
    }

    return update;
  }

  private async hydrateDesktopReleaseAssetMetadata(
    target: { fileSizeBytes?: number | null },
    downloadUrl?: string | null
  ) {
    if (target.fileSizeBytes !== undefined && target.fileSizeBytes !== null) {
      return;
    }

    const fileName = this.extractDesktopReleaseAssetFileName(downloadUrl);
    if (!fileName) {
      return;
    }

    try {
      const metadata = await getDesktopReleaseAssetMetadata(fileName);
      target.fileSizeBytes = metadata.fileSizeBytes;
    } catch {
      // External URLs or deleted local upload files should not block release metadata edits.
    }
  }

  private extractDesktopReleaseAssetFileName(downloadUrl?: string | null): string | undefined {
    if (!downloadUrl) {
      return undefined;
    }

    let pathname: string;
    try {
      pathname = new URL(downloadUrl, 'http://qiuai.local').pathname;
    } catch {
      return undefined;
    }

    const match = pathname.match(/\/api\/v1\/desktop\/releases\/downloads\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : undefined;
  }

  private async assertDesktopReleaseUnique(
    platform: string,
    channel: string,
    version: string,
    exceptId?: string
  ) {
    const existing = await this.prismaService.desktopRelease.findFirst({
      where: {
        platform,
        channel,
        version,
        ...(exceptId
          ? {
              id: {
                not: exceptId
              }
            }
          : {})
      }
    });

    if (existing) {
      throw this.desktopReleaseConflict(version);
    }
  }

  private toNullableTrimmedText(value: string | null | undefined): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    return value.trim() || null;
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

  private buildWorkspaceWhere(
    query?: string,
    workspaceType?: 'personal' | 'enterprise'
  ): Prisma.WorkspaceWhereInput {
    const filters: Prisma.WorkspaceWhereInput[] = [];
    if (workspaceType) {
      filters.push({
        type: workspaceType === 'enterprise' ? 'ENTERPRISE' : 'PERSONAL'
      });
    }

    const value = query?.trim();
    if (!value) {
      return filters.length ? { AND: filters } : {};
    }

    const search: Prisma.WorkspaceWhereInput[] = [
      {
        name: {
          contains: value,
          mode: 'insensitive'
        }
      },
      {
        tenant: {
          name: {
            contains: value,
            mode: 'insensitive'
          }
        }
      },
      {
        ownerAccount: {
          primaryEmail: {
            contains: value,
            mode: 'insensitive'
          }
        }
      }
    ];

    if (this.isUuid(value)) {
      search.push(
        { id: value },
        { tenantId: value },
        { ownerAccountId: value }
      );
    }

    filters.push({
      OR: search
    });

    return {
      AND: filters
    };
  }

  private buildActionLogWhere(query: ListAdminActionLogsQueryDto): Prisma.AdminActionLogWhereInput {
    const filters: Prisma.AdminActionLogWhereInput[] = [];
    const action = query.action?.trim();
    const targetType = query.targetType?.trim();
    const search = query.query?.trim();

    if (action) {
      filters.push({
        action: {
          equals: action,
          mode: 'insensitive'
        }
      });
    }

    if (targetType) {
      filters.push({
        targetType: {
          equals: targetType,
          mode: 'insensitive'
        }
      });
    }

    if (search) {
      filters.push({
        OR: [
          {
            action: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            targetType: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            targetId: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            summary: {
              contains: search,
              mode: 'insensitive'
            }
          },
          {
            operator: {
              primaryEmail: {
                contains: search,
                mode: 'insensitive'
              }
            }
          }
        ]
      });
    }

    return filters.length > 0 ? { AND: filters } : {};
  }

  private buildSupportLoginUrl(sessionToken: string, workspaceId: string): string {
    const baseUrl = (
      process.env.WORKOS_PUBLIC_BASE_URL ??
      process.env.NEXT_PUBLIC_WORKOS_CONSOLE_URL ??
      'http://127.0.0.1:3000'
    )
      .trim()
      .replace(/\/$/, '');
    const url = new URL('/support-login', baseUrl);
    url.searchParams.set('token', sessionToken);
    url.searchParams.set('workspaceId', workspaceId);
    return url.toString();
  }

  private workspaceSummaryInclude() {
    return {
      tenant: true,
      ownerAccount: true,
      aiPointWallet: true,
      subscriptions: {
        include: {
          plan: true
        },
        orderBy: {
          createdAt: 'desc' as const
        },
        take: 1
      },
      _count: {
        select: {
          memberships: true,
          roleInstances: true,
          tasks: true,
          desktopDevices: true,
          billingOrders: true
        }
      }
    };
  }

  private workspaceDetailInclude() {
    return {
      ...this.workspaceSummaryInclude(),
      memberships: {
        include: {
          account: true,
          department: true
        },
        orderBy: {
          createdAt: 'asc' as const
        }
      },
      billingAccount: true,
      billingOrders: {
        include: {
          plan: true
        },
        orderBy: {
          createdAt: 'desc' as const
        },
        take: 20
      },
      invitations: {
        include: {
          department: true
        },
        orderBy: {
          createdAt: 'desc' as const
        },
        take: 20
      },
      aiPointWallet: true,
      desktopDevices: {
        orderBy: {
          boundAt: 'desc' as const
        },
        take: 20
      },
      desktopBindingCodes: {
        orderBy: {
          createdAt: 'desc' as const
        },
        take: 10
      }
    };
  }

  private async getWorkspaceDetailData(workspaceId: string): Promise<AdminWorkspaceDetailDto> {
    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: this.workspaceDetailInclude()
    });

    if (!workspace) {
      throw this.workspaceNotFound(workspaceId);
    }

    const aiPointUsage = await this.getWorkspaceAiPointUsageSummary(workspaceId);
    const summary = this.toAdminWorkspaceSummary(workspace, aiPointUsage);
    const subscription = workspace.subscriptions[0];

    return {
      workspace: summary,
      subscription: subscription
        ? {
            id: subscription.id,
            workspaceId: subscription.workspaceId,
            planCode: subscription.plan.code,
            planName: subscription.plan.name,
            status: subscription.status,
            billingCycle: subscription.billingCycle,
            currentPeriodStart: subscription.currentPeriodStart?.toISOString(),
            currentPeriodEnd: subscription.currentPeriodEnd?.toISOString(),
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd
          }
        : null,
      billingAccount: workspace.billingAccount
        ? {
            id: workspace.billingAccount.id,
            workspaceId: workspace.billingAccount.workspaceId,
            status: workspace.billingAccount.status,
            billingName: workspace.billingAccount.billingName ?? undefined,
            taxId: workspace.billingAccount.taxId ?? undefined,
            contactEmail: workspace.billingAccount.contactEmail ?? undefined,
            defaultProvider: workspace.billingAccount.defaultProvider ?? undefined,
            createdAt: workspace.billingAccount.createdAt.toISOString(),
            updatedAt: workspace.billingAccount.updatedAt.toISOString()
          }
        : null,
      aiPointWallet: workspace.aiPointWallet
        ? this.toAdminAiPointWalletSummary(workspace.aiPointWallet)
        : null,
      aiPointUsage,
      members: workspace.memberships.map((member) => ({
        id: member.id,
        workspaceId: member.workspaceId,
        accountId: member.accountId,
        primaryEmail: member.account.primaryEmail,
        role: this.toAdminMemberRole(member.role),
        departmentId: member.departmentId ?? undefined,
        departmentName: member.department?.name,
        createdAt: member.createdAt.toISOString()
      })),
      invitations: workspace.invitations.map((invitation) => this.toAdminInvitationSummary(invitation)),
      recentOrders: workspace.billingOrders.map((order) => ({
        id: order.id,
        workspaceId: order.workspaceId,
        orderNo: order.orderNo,
        provider: order.provider,
        status: order.status,
        subject: order.subject,
        amountCents: order.amountCents,
        currency: order.currency,
        billingCycle: order.billingCycle,
        planCode: order.plan.code,
        planName: order.plan.name,
        periodStart: order.periodStart?.toISOString(),
        periodEnd: order.periodEnd?.toISOString(),
        paymentUrl: order.paymentUrl ?? undefined,
        providerTradeNo: order.providerTradeNo ?? undefined,
        paidAt: order.paidAt?.toISOString(),
        expiresAt: order.expiresAt?.toISOString(),
        closedAt: order.closedAt?.toISOString(),
        createdAt: order.createdAt.toISOString(),
        updatedAt: order.updatedAt.toISOString()
      })),
      desktopDevices: workspace.desktopDevices.map((device) => this.toAdminDesktopDeviceSummary(device)),
      desktopBindingCodes: workspace.desktopBindingCodes.map((bindingCode) =>
        this.toDesktopBindingCodeSummary(bindingCode)
      )
    };
  }

  private toAdminPlanDetail(plan: {
    code: string;
    name: string;
    billingCycle: string;
    priceCents: number | null;
    currency: string | null;
    description: string | null;
    status: string;
    entitlements: Array<{
      featureKey: string;
      enabled: boolean;
      limitValue: number | null;
      limitUnit: string | null;
    }>;
  }): AdminPlanDetailDto {
    return {
      code: plan.code,
      name: plan.name,
      billingCycle: plan.billingCycle,
      priceCents: plan.priceCents ?? undefined,
      currency: plan.currency ?? undefined,
      description: plan.description ?? undefined,
      status: plan.status === 'ARCHIVED' ? 'ARCHIVED' : 'ACTIVE',
      entitlements: plan.entitlements.map((entitlement) => ({
        featureKey: entitlement.featureKey,
        enabled: entitlement.enabled,
        limitValue: entitlement.limitValue ?? undefined,
        limitUnit: entitlement.limitUnit ?? undefined
      }))
    };
  }

  private toAdminOfficialModelRouteSummary(route: {
    routeKey: string;
    displayName: string;
    capability: string;
    status: string;
    pointPrice: number;
    providerId: string;
    providerName: string;
    modelName: string;
    apiBaseUrl: string;
    apiKeyEnvName: string;
    sortOrder: number;
    apiKeys: Array<{
      id: string;
      routeKey: string;
      label: string;
      providerId: string;
      apiKeyLastFour: string;
      status: string;
      maxConcurrency: number;
      currentConcurrency: number;
      rpmLimit: number | null;
      cooldownUntil: Date | null;
      failureCount: number;
      lastUsedAt: Date | null;
      lastError: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
    }>;
  }): AdminOfficialModelRouteSummaryDto {
    const activeKeys = route.apiKeys.filter((key) => key.status !== 'DISABLED');
    return {
      routeKey: route.routeKey,
      displayName: route.displayName,
      capability: route.capability.toLowerCase() as AdminOfficialModelRouteSummaryDto['capability'],
      status: route.status.toLowerCase() as AdminOfficialModelRouteSummaryDto['status'],
      pointPrice: route.pointPrice,
      providerId: route.providerId,
      providerName: route.providerName,
      modelName: route.modelName,
      apiBaseUrl: route.apiBaseUrl,
      apiKeyEnvName: route.apiKeyEnvName,
      sortOrder: route.sortOrder,
      activeKeyCount: activeKeys.length,
      totalMaxConcurrency: activeKeys.reduce((total, key) => total + key.maxConcurrency, 0),
      currentConcurrency: activeKeys.reduce((total, key) => total + key.currentConcurrency, 0),
      apiKeys: route.apiKeys.map((key) => this.toAdminOfficialModelApiKeySummary(key))
    };
  }

  private toAdminOfficialModelApiKeySummary(key: {
    id: string;
    routeKey: string;
    label: string;
    providerId: string;
    apiKeyLastFour: string;
    status: string;
    maxConcurrency: number;
    currentConcurrency: number;
    rpmLimit: number | null;
    cooldownUntil: Date | null;
    failureCount: number;
    lastUsedAt: Date | null;
    lastError: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): AdminOfficialModelApiKeySummaryDto {
    return {
      id: key.id,
      routeKey: key.routeKey,
      label: key.label,
      providerId: key.providerId,
      apiKeyLastFour: key.apiKeyLastFour,
      status: key.status.toLowerCase() as AdminOfficialModelApiKeySummaryDto['status'],
      maxConcurrency: key.maxConcurrency,
      currentConcurrency: key.currentConcurrency,
      rpmLimit: key.rpmLimit ?? undefined,
      cooldownUntil: key.cooldownUntil?.toISOString(),
      failureCount: key.failureCount,
      lastUsedAt: key.lastUsedAt?.toISOString(),
      lastError: key.lastError ?? undefined,
      sortOrder: key.sortOrder,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString()
    };
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

  private toIssueMessageSummary(report: DesktopIssueMessageRecord) {
    return {
      id: report.id,
      issueNo: report.issueNo,
      category: this.toIssueCategory(report.category),
      severity: this.toIssueSeverity(report.severity),
      status: this.toIssueStatus(report.status),
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
      diagnostics: this.toMetadataRecord(report.diagnostics as Prisma.JsonValue | null),
      adminNote: report.adminNote ?? undefined,
      createdAt: this.toRequiredIsoDateString(report.createdAt),
      updatedAt: this.toRequiredIsoDateString(report.updatedAt)
    };
  }

  private toAdminWorkspaceSummary(
    workspace: WorkspaceSummaryRecord,
    aiPointUsage?: AdminWorkspaceAiPointUsageSummaryDto
  ): AdminWorkspaceSummaryDto {
    const subscription = workspace.subscriptions[0];

    return {
      id: workspace.id,
      tenantId: workspace.tenantId,
      tenantName: workspace.tenant.name,
      workspaceType: workspace.type === 'ENTERPRISE' ? 'enterprise' : 'personal',
      name: workspace.name,
      ownerAccountId: workspace.ownerAccountId,
      ownerEmail: workspace.ownerAccount.primaryEmail,
      status: this.toWorkspaceStatus(workspace.status),
      planCode: subscription?.plan.code ?? 'PERSONAL_FREE',
      planName: subscription?.plan.name,
      subscriptionStatus: subscription?.status,
      subscriptionPeriodEnd: subscription?.currentPeriodEnd?.toISOString(),
      memberCount: workspace._count.memberships,
      roleCount: workspace._count.roleInstances,
      taskCount: workspace._count.tasks,
      desktopDeviceCount: workspace._count.desktopDevices,
      billingOrderCount: workspace._count.billingOrders,
      aiPointWallet: workspace.aiPointWallet
        ? this.toAdminAiPointWalletSummary(workspace.aiPointWallet)
        : null,
      aiPointUsage: aiPointUsage ?? this.emptyAdminAiPointUsageSummary(),
      updatedAt: workspace.updatedAt.toISOString()
    };
  }

  private async getWorkspaceAiPointUsageSummary(
    workspaceId: string
  ): Promise<AdminWorkspaceAiPointUsageSummaryDto> {
    const usageByWorkspaceId = await this.getWorkspaceAiPointUsageByWorkspaceIds([workspaceId]);
    return usageByWorkspaceId.get(workspaceId) ?? this.emptyAdminAiPointUsageSummary();
  }

  private async getWorkspaceAiPointUsageByWorkspaceIds(
    workspaceIds: string[]
  ): Promise<Map<string, AdminWorkspaceAiPointUsageSummaryDto>> {
    if (!workspaceIds.length) {
      return new Map();
    }

    const now = new Date();
    const last24hStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7dStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const usageByWorkspaceId = new Map<string, AdminWorkspaceAiPointUsageSummaryDto>(
      workspaceIds.map((workspaceId) => [workspaceId, this.emptyAdminAiPointUsageSummary()])
    );

    const entries = await this.prismaService.aiPointLedgerEntry.findMany({
      where: {
        workspaceId: {
          in: workspaceIds
        },
        type: 'SETTLE',
        status: 'COMPLETED',
        createdAt: {
          gte: last7dStart
        }
      },
      select: {
        workspaceId: true,
        points: true,
        createdAt: true
      }
    });

    for (const entry of entries) {
      const usage = usageByWorkspaceId.get(entry.workspaceId) ?? this.emptyAdminAiPointUsageSummary();
      const spentPoints = Math.abs(entry.points);
      usage.spentLast7dPoints += spentPoints;
      usage.settledLast7dCount += 1;
      if (entry.createdAt >= last24hStart) {
        usage.spentLast24hPoints += spentPoints;
        usage.settledLast24hCount += 1;
      }
      if (!usage.lastSettledAt || entry.createdAt > new Date(usage.lastSettledAt)) {
        usage.lastSettledAt = entry.createdAt.toISOString();
      }
      usageByWorkspaceId.set(entry.workspaceId, usage);
    }

    return usageByWorkspaceId;
  }

  private emptyAdminAiPointUsageSummary(): AdminWorkspaceAiPointUsageSummaryDto {
    return {
      spentLast24hPoints: 0,
      spentLast7dPoints: 0,
      settledLast24hCount: 0,
      settledLast7dCount: 0
    };
  }

  private toAdminAiPointWalletSummary(
    wallet: Pick<AiPointWallet, 'workspaceId' | 'balancePoints' | 'reservedPoints' | 'updatedAt'>
  ) {
    return {
      workspaceId: wallet.workspaceId,
      balancePoints: wallet.balancePoints,
      reservedPoints: wallet.reservedPoints,
      availablePoints: wallet.balancePoints - wallet.reservedPoints,
      updatedAt: wallet.updatedAt.toISOString()
    };
  }

  private toAdminInvitationSummary(invitation: {
    id: string;
    workspaceId: string;
    departmentId: string | null;
    email: string;
    role: string;
    status: string;
    expiresAt: Date;
    acceptedAt: Date | null;
    createdAt: Date;
    department?: {
      name: string;
    } | null;
  }): AdminWorkspaceInvitationSummaryDto {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      systemRole: this.toInvitationSystemRole(invitation.role),
      departmentId: invitation.departmentId ?? undefined,
      departmentName: invitation.department?.name,
      status: this.toInvitationStatus(invitation.status),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString(),
      createdAt: invitation.createdAt.toISOString()
    };
  }

  private toAdminDesktopDeviceSummary(device: {
    id: string;
    workspaceId: string;
    runtimeId: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    appVersion: string;
    status: string;
    boundAt: Date;
    lastSeenAt: Date | null;
    lastSyncedAt: Date | null;
  }) {
    return {
      id: device.id,
      workspaceId: device.workspaceId,
      runtimeId: device.runtimeId,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      appVersion: device.appVersion,
      status: device.status,
      boundAt: device.boundAt.toISOString(),
      lastSeenAt: device.lastSeenAt?.toISOString(),
      lastSyncedAt: device.lastSyncedAt?.toISOString()
    };
  }

  private toDesktopBindingCodeSummary(bindingCode: {
    id: string;
    workspaceId: string;
    label: string | null;
    status: string;
    expiresAt: Date | null;
    createdAt: Date;
    redeemedAt: Date | null;
  }) {
    return {
      id: bindingCode.id,
      workspaceId: bindingCode.workspaceId,
      label: bindingCode.label ?? undefined,
      status: this.toDesktopBindingCodeStatus(bindingCode.status),
      expiresAt: bindingCode.expiresAt?.toISOString(),
      createdAt: bindingCode.createdAt.toISOString(),
      redeemedAt: bindingCode.redeemedAt?.toISOString()
    };
  }

  private resolveAuthorizationPeriod(
    input: { periodStart?: string; periodEnd?: string; durationDays?: number },
    billingCycle: BillingCycle
  ): { start: Date; end: Date } {
    const start = input.periodStart ? new Date(input.periodStart) : new Date();
    const end = input.periodEnd
      ? new Date(input.periodEnd)
      : this.addDays(start, input.durationDays ?? this.defaultDurationDays(billingCycle));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Authorization period dates are invalid.'
        }
      });
    }

    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Authorization periodEnd must be after periodStart.'
        }
      });
    }

    return {
      start,
      end
    };
  }

  private requireWorkspaceCreationPlan(plan: {
    code: string;
    status: string;
    billingCycle: BillingCycle;
  }): void {
    if (plan.status !== 'ACTIVE') {
      throw new BadRequestException({
        error: {
          code: 'PLAN_NOT_AVAILABLE',
          message: 'Only active plans can be used for new enterprise workspaces.',
          details: {
            planCode: plan.code,
            status: plan.status
          }
        }
      });
    }

    if (plan.billingCycle === 'FREE') {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'New enterprise workspaces require an enterprise plan.',
          details: {
            planCode: plan.code
          }
        }
      });
    }
  }

  private requireNonEmptyText(value: string, message: string): string {
    const text = value.trim();
    if (!text) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message
        }
      });
    }

    return text;
  }

  private defaultDurationDays(billingCycle: BillingCycle): number {
    if (billingCycle === 'ANNUAL') {
      return 365;
    }

    return 30;
  }

  private generateTemporaryPassword(): string {
    return `QiuAI-${randomBytes(12).toString('base64url')}`;
  }

  private toUsagePeriod(date: Date): string {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  }

  private async ensureAdminAiPointBucketCoverage(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    wallet: {
      balancePoints: number;
      reservedPoints: number;
    }
  ): Promise<void> {
    const availablePoints = Math.max(0, wallet.balancePoints - wallet.reservedPoints);
    if (availablePoints <= 0) {
      return;
    }

    const activeBuckets = await tx.aiPointCreditBucket.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        availablePoints: {
          gt: 0
        },
        OR: [
          { expiresAt: null },
          {
            expiresAt: {
              gt: new Date()
            }
          }
        ]
      },
      select: {
        availablePoints: true
      }
    });
    const bucketAvailablePoints = activeBuckets.reduce(
      (total, bucket) => total + Math.max(0, bucket.availablePoints),
      0
    );
    const missingPoints = availablePoints - bucketAvailablePoints;
    if (missingPoints <= 0) {
      return;
    }

    await tx.aiPointCreditBucket.create({
      data: {
        workspaceId,
        sourceType: 'MIGRATED_BALANCE',
        totalPoints: missingPoints,
        availablePoints: missingPoints,
        reservedPoints: 0,
        startsAt: new Date(),
        metadata: {
          source: 'admin-adjustment-legacy-wallet-balance'
        }
      }
    });
  }

  private async deductAdminAiPointBuckets(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    points: number
  ): Promise<void> {
    const buckets = await tx.aiPointCreditBucket.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        availablePoints: {
          gt: 0
        },
        OR: [
          { expiresAt: null },
          {
            expiresAt: {
              gt: new Date()
            }
          }
        ]
      },
      select: {
        id: true,
        sourceType: true,
        availablePoints: true,
        expiresAt: true,
        createdAt: true
      }
    });

    let remainingPoints = points;
    for (const bucket of buckets.sort(compareAdminAiPointBucketsForDeduction)) {
      if (remainingPoints <= 0) {
        break;
      }
      const pointsToDeduct = Math.min(bucket.availablePoints, remainingPoints);
      await tx.aiPointCreditBucket.update({
        where: { id: bucket.id },
        data: {
          availablePoints: {
            decrement: pointsToDeduct
          }
        }
      });
      remainingPoints -= pointsToDeduct;
    }

    if (remainingPoints > 0) {
      throw new BadRequestException({
        error: {
          code: 'AI_POINTS_BUCKET_BALANCE_INVALID',
          message: 'AI point bucket balance is not enough for this adjustment.'
        }
      });
    }
  }

  private async recordAdminAction(
    tx: Prisma.TransactionClient,
    input: {
      operatorAccountId: string;
      action: string;
      targetType: string;
      targetId: string;
      summary: string;
      metadata?: unknown;
    }
  ): Promise<void> {
    await tx.adminActionLog.create({
      data: {
        operatorAccountId: input.operatorAccountId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        summary: input.summary,
        metadata: input.metadata ? this.toJsonValue(input.metadata) : undefined
      }
    });
  }

  private planNotFound(planCode: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Plan was not found.',
        details: { planCode }
      }
    });
  }

  private officialRouteNotFound(routeKey: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Official model route was not found.',
        details: { routeKey }
      }
    });
  }

  private officialApiKeyNotFound(apiKeyId: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Official model API key was not found.',
        details: { apiKeyId }
      }
    });
  }

  private workspaceNotFound(workspaceId: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Workspace was not found.',
        details: { workspaceId }
      }
    });
  }

  private desktopReleaseNotFound(releaseId: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Desktop release was not found.',
        details: { releaseId }
      }
    });
  }

  private issueMessageNotFound(issueId: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Issue message was not found.',
        details: { issueId }
      }
    });
  }

  private desktopReleaseConflict(version: string) {
    return new ConflictException({
      error: {
        code: 'CONFLICT',
        message: 'Desktop release version already exists for this platform and channel.',
        details: { version }
      }
    });
  }

  private getPlanDisplayIndex(planCode: string): number {
    const index = PLAN_DISPLAY_ORDER.indexOf(planCode as (typeof PLAN_DISPLAY_ORDER)[number]);
    return index >= 0 ? index : PLAN_DISPLAY_ORDER.length;
  }

  private toWorkspaceStatus(value: string): 'active' | 'suspended' | 'archived' {
    if (value === 'SUSPENDED') {
      return 'suspended';
    }
    if (value === 'ARCHIVED') {
      return 'archived';
    }
    return 'active';
  }

  private requireActiveWorkspace(workspace: { id: string; status: string }): void {
    if (workspace.status !== 'ACTIVE') {
      throw new ForbiddenException({
        error: {
          code: 'WORKSPACE_NOT_ACTIVE',
          message: 'Workspace is not active.',
          details: {
            workspaceId: workspace.id,
            status: workspace.status
          }
        }
      });
    }
  }

  private toMemberRole(value: 'admin' | 'member' | 'viewer'): WorkspaceMemberRole {
    switch (value) {
      case 'admin':
        return 'ADMIN';
      case 'viewer':
        return 'VIEWER';
      default:
        return 'MEMBER';
    }
  }

  private toInvitationSystemRole(value: string): 'admin' | 'member' | 'viewer' {
    switch (value) {
      case 'ADMIN':
        return 'admin';
      case 'VIEWER':
        return 'viewer';
      default:
        return 'member';
    }
  }

  private toInvitationStatus(value: string): 'pending' | 'accepted' | 'cancelled' | 'expired' {
    switch (value) {
      case 'ACCEPTED':
        return 'accepted';
      case 'CANCELLED':
        return 'cancelled';
      case 'EXPIRED':
        return 'expired';
      default:
        return 'pending';
    }
  }

  private toAdminMemberRole(value: string): 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' {
    if (value === 'OWNER' || value === 'ADMIN' || value === 'VIEWER') {
      return value;
    }

    return 'MEMBER';
  }

  private toDesktopBindingCodeStatus(value: string): 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED' {
    if (value === 'REDEEMED' || value === 'EXPIRED' || value === 'CANCELLED') {
      return value;
    }

    return 'PENDING';
  }

  private toDesktopReleaseStatus(value: string): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' {
    if (value === 'PUBLISHED' || value === 'ARCHIVED') {
      return value;
    }

    return 'DRAFT';
  }

  private toIssueCategory(value: string): 'BUG' | 'USAGE' | 'FEATURE_REQUEST' | 'BAD_OUTPUT' | 'OTHER' {
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

  private toIssueSeverity(value: string): 'NORMAL' | 'IMPACTING' | 'BLOCKING' {
    if (value === 'IMPACTING' || value === 'BLOCKING') {
      return value;
    }

    return 'NORMAL';
  }

  private toIssueStatus(value: string): 'NEW' | 'VIEWED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'CLOSED' {
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

  private toIsoDateString(value: DesktopReleaseDate | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return value instanceof Date ? value.toISOString() : value;
  }

  private toRequiredIsoDateString(value: DesktopReleaseDate): string {
    return this.toIsoDateString(value) ?? new Date(0).toISOString();
  }

  private toDateTimeMs(value: DesktopReleaseDate | null | undefined): number {
    if (!value) {
      return 0;
    }

    return value instanceof Date ? value.getTime() : new Date(value).getTime();
  }

  private toJsonValue(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private toMetadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    return value as Record<string, unknown>;
  }

  private addDays(date: Date, days: number): Date {
    return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }
}

function compareAdminAiPointBucketsForDeduction(
  left: AdminAiPointBucketForDeduction,
  right: AdminAiPointBucketForDeduction
): number {
  const priorityDiff = getAdminAiPointBucketDeductionPriority(left.sourceType) -
    getAdminAiPointBucketDeductionPriority(right.sourceType);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const leftExpiresAt = left.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightExpiresAt = right.expiresAt?.getTime() ?? Number.POSITIVE_INFINITY;
  if (leftExpiresAt !== rightExpiresAt) {
    return leftExpiresAt - rightExpiresAt;
  }

  return left.createdAt.getTime() - right.createdAt.getTime();
}

function getAdminAiPointBucketDeductionPriority(sourceType: string): number {
  switch (sourceType) {
    case 'SUBSCRIPTION_MONTHLY':
      return 0;
    case 'ADMIN_GRANT':
      return 1;
    case 'MIGRATED_BALANCE':
      return 2;
    case 'PURCHASE_PERMANENT':
      return 3;
    default:
      return 99;
  }
}
