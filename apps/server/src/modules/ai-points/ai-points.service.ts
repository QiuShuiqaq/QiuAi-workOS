import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { hashDesktopToken } from '../desktop-sync/desktop-auth-token';
import { AuthService } from '../auth/auth.service';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isLocalDevelopmentUnlimitedEnabled } from '../../shared/local-development-mode';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { officialModelRouteSeeds } from './official-model-routes';

type OfficialCapability = 'TEXT' | 'REASONING' | 'IMAGE' | 'VIDEO';
type OfficialRouteStatus = 'ACTIVE' | 'DISABLED';
type AiPointCreditBucketSourceType =
  | 'SUBSCRIPTION_MONTHLY'
  | 'PURCHASE_PERMANENT'
  | 'ADMIN_GRANT'
  | 'REFERRAL_REWARD'
  | 'MIGRATED_BALANCE';

interface AiPointBucketAllocation {
  bucketId: string;
  sourceType: AiPointCreditBucketSourceType;
  points: number;
  expiresAt?: string;
}

interface OfficialRouteRecord {
  routeKey: string;
  displayName: string;
  capability: OfficialCapability;
  status: OfficialRouteStatus;
  pointPrice: number;
  providerId: string;
  providerName: string;
  modelName: string;
  apiBaseUrl: string;
  apiKeyEnvName: string;
  providerConfig: unknown;
  sortOrder: number;
}

interface VerifiedDesktopDevice {
  id: string;
  workspaceId: string;
  runtimeId: string;
  deviceId: string;
}

interface OfficialMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OfficialInvokeRequest {
  officialRouteKey: string;
  messages: OfficialMessage[];
  timeoutMs?: number;
  taskKind?: 'chat' | 'image_generation' | 'video_generation' | 'audio_transcription';
  visionInputs?: Array<{
    imageDataUrl?: string;
    mimeType?: string;
  }>;
  imageGeneration?: {
    prompt: string;
    negativePrompt?: string;
    sourceImageDataUrl?: string;
    size?: string;
    aspectRatio?: string;
    responseFormat?: 'url';
    asyncMode?: 'wait' | 'submit_only' | 'poll_once';
    providerJobId?: string;
  };
  videoGeneration?: {
    prompt: string;
    negativePrompt?: string;
    sourceImageDataUrl?: string;
    durationSeconds?: number;
    aspectRatio?: string;
    responseFormat?: 'url';
  };
}

interface OfficialInvokeProviderResponse {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  artifacts?: Array<{
    type: 'image' | 'video' | 'file';
    title?: string;
    remoteUrl?: string;
    localPath?: string;
    thumbnailPath?: string;
    mimeType?: string;
    providerJobId?: string;
    providerStatus?: string;
    metadata?: Record<string, unknown>;
  }>;
}

const qiuaiOfficialProviderName = 'QiuAI官方通道';
interface OfficialApiCredential {
  source: 'key_pool' | 'env';
  apiKey: string;
  apiKeyId?: string;
  leaseId?: string;
}

interface PendingPointsReservation {
  id: string;
  desktopDeviceId: string;
  points: number;
  metadata: Prisma.JsonValue | null;
}

const defaultTextTimeoutMs = 45_000;
const defaultImageTimeoutMs = 1_800_000;
const defaultVideoTimeoutMs = 1_800_000;
const grsaiSubmitTimeoutMs = 120_000;
const pollRequestTimeoutMs = 30_000;
const grsaiPollInitialIntervalMs = 3_000;
const pollMaxIntervalMs = 20_000;
const minimaxSubmitTimeoutMs = 30_000;
const minimaxPollInitialIntervalMs = 8_000;
const officialRouteBusyRetryMs = 750;
const personalMemberMonthlyAiPoints = 1500;
const officialRouteQueueWaitMsByCapability: Record<OfficialCapability, number> = {
  TEXT: 10_000,
  REASONING: 10_000,
  IMAGE: 60_000,
  VIDEO: 60_000
};

@Injectable()
export class AiPointsService {
  private readonly logger = new Logger(AiPointsService.name);

  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async getOverview(workspaceId: string, deviceToken?: string, cookieHeader?: string) {
    const device = await this.requireWorkspaceAccess(workspaceId, deviceToken, cookieHeader);
    const routes = await this.listRouteRecords();
    if (!isDatabasePersistenceEnabled()) {
      return {
        data: {
          wallet: this.buildMockWallet(workspaceId),
          deviceQuota: device ? this.buildMockDeviceQuota(device.id) : undefined,
          recentLedgerEntries: [],
          routes: routes.map(toRouteSummary)
        }
      };
    }

    await this.ensureActivePersonalMemberMonthlyCredits(workspaceId);
    await this.ensureWallet(workspaceId);
    await this.expireWorkspaceCreditBuckets(workspaceId);
    const [ledgerEntries, quota, creditBuckets] = await Promise.all([
      this.prismaService.aiPointLedgerEntry.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      device ? this.ensureDeviceQuota(device) : undefined,
      this.prismaService.aiPointCreditBucket.findMany({
        where: {
          workspaceId,
          status: {
            not: 'CANCELLED'
          }
        },
        orderBy: [
          { status: 'asc' },
          { expiresAt: 'asc' },
          { createdAt: 'desc' }
        ],
        take: 20
      })
    ]);
    const refreshedWallet = await this.ensureWallet(workspaceId);

    return {
      data: {
        wallet: isLocalDevelopmentUnlimitedEnabled()
          ? this.buildMockWallet(workspaceId)
          : toWalletSummary(refreshedWallet),
        deviceQuota: quota ? toDeviceQuotaSummary(quota) : undefined,
        recentLedgerEntries: ledgerEntries.map((entry) => ({
          id: entry.id,
          workspaceId: entry.workspaceId,
          desktopDeviceId: entry.desktopDeviceId ?? undefined,
          routeKey: entry.routeKey ?? undefined,
          type: entry.type.toLowerCase(),
          status: entry.status.toLowerCase(),
          points: entry.points,
          balanceAfter: entry.balanceAfter ?? undefined,
          description: entry.description ?? undefined,
          createdAt: entry.createdAt.toISOString()
        })),
        creditBuckets: creditBuckets.map(toCreditBucketSummary),
        routes: routes.map(toRouteSummary)
      }
    };
  }

  async listRoutes(workspaceId: string, deviceToken?: string, cookieHeader?: string) {
    await this.requireWorkspaceAccess(workspaceId, deviceToken, cookieHeader);
    const routes = await this.listRouteRecords();
    return {
      data: routes.map(toRouteSummary)
    };
  }

  async invokeOfficialModel(workspaceId: string, deviceToken: string | undefined, body: unknown) {
    const request = parseOfficialInvokeRequest(body);
    const route = await this.findRouteRecord(request.officialRouteKey);
    if (!route) {
      throw new NotFoundException({
        error: {
          code: 'OFFICIAL_ROUTE_NOT_FOUND',
          message: '官方通道线路不存在。'
        }
      });
    }

    if (route.status !== 'ACTIVE') {
      throw new ServiceUnavailableException({
        error: {
          code: 'OFFICIAL_ROUTE_DISABLED',
          message: '这条官方通道线路暂未开通。'
        }
      });
    }

    const device = await this.requireDesktopDevice(workspaceId, deviceToken);
    if (isOfficialResultPollRequest(request)) {
      const providerJobId = request.imageGeneration?.providerJobId?.trim();
      const pendingReservation = providerJobId
        ? await this.findPendingPointsReservation(workspaceId, route.routeKey, providerJobId)
        : undefined;
      let credential: OfficialApiCredential | undefined;
      try {
        credential = await this.acquireOfficialApiCredential(route, request);
        const providerResponse = await this.invokeProvider(route, request, credential.apiKey);
        const isPending = isPendingGenerationProviderResponse(providerResponse);
        if (!isPending) {
          await this.releaseOfficialApiCredential(credential, {
            status: 'RELEASED'
          });
        }
        const wallet = pendingReservation && !isPending
          ? await this.settlePoints({
              workspaceId,
              desktopDeviceId: pendingReservation.desktopDeviceId,
              routeKey: route.routeKey,
              reservationId: pendingReservation.id,
              points: pendingReservation.points
            })
          : isDatabasePersistenceEnabled()
            ? await this.ensureWallet(workspaceId)
            : undefined;

        return {
          data: {
            provider: qiuaiOfficialProviderName,
            modelName: userFacingRouteModelName(route),
            content: providerResponse.content,
            inputTokens: providerResponse.inputTokens,
            outputTokens: providerResponse.outputTokens,
            pointsCharged: pendingReservation && !isPending ? pendingReservation.points : 0,
            wallet: this.toResponseWallet(workspaceId, wallet),
            artifacts: providerResponse.artifacts
          }
        };
      } catch (error) {
        if (credential) {
          await this.releaseOfficialApiCredential(credential, {
            status: 'FAILED',
            error
          });
        }
        if (pendingReservation) {
          await this.releasePoints({
            workspaceId,
            desktopDeviceId: pendingReservation.desktopDeviceId,
            routeKey: route.routeKey,
            reservationId: pendingReservation.id,
            points: pendingReservation.points
          });
        }
        this.logger.error(
          `Official model route poll failed: route=${route.routeKey}, provider=${route.providerId}, model=${route.modelName}`,
          error instanceof Error ? error.stack : String(error)
        );
        throw sanitizeOfficialProviderError(error);
      }
    }

    const reservedPoints = resolveOfficialRoutePointPrice(route, request);
    const reservation = await this.reservePoints({
      workspaceId,
      desktopDeviceId: device.id,
      routeKey: route.routeKey,
      points: reservedPoints
    });

    let credential: OfficialApiCredential | undefined;
    try {
      credential = await this.acquireOfficialApiCredential(route, request);
      const providerResponse = await this.invokeProvider(route, request, credential.apiKey);
      if (isPendingGenerationProviderResponse(providerResponse)) {
        await this.attachProviderJobIdToOfficialApiCredential(credential, providerResponse);
        const providerJobId = readProviderJobIdFromResponse(providerResponse);
        if (!providerJobId) {
          throw new ServiceUnavailableException({
            error: {
              code: 'OFFICIAL_ROUTE_TASK_ID_MISSING',
              message: 'Official route did not return a task id.'
            }
          });
        }
        await this.attachProviderJobIdToPointsReservation(reservation.id, providerJobId);
        const wallet = isDatabasePersistenceEnabled()
          ? await this.ensureWallet(workspaceId)
          : undefined;

        return {
          data: {
            provider: qiuaiOfficialProviderName,
            modelName: userFacingRouteModelName(route),
            content: providerResponse.content,
            inputTokens: providerResponse.inputTokens,
            outputTokens: providerResponse.outputTokens,
            pointsCharged: 0,
            wallet: this.toResponseWallet(workspaceId, wallet),
            artifacts: providerResponse.artifacts
          }
        };
      } else {
        await this.releaseOfficialApiCredential(credential, {
          status: 'RELEASED'
        });
      }
      const wallet = await this.settlePoints({
        workspaceId,
        desktopDeviceId: device.id,
        routeKey: route.routeKey,
        reservationId: reservation.id,
        points: reservedPoints
      });

      return {
        data: {
          provider: qiuaiOfficialProviderName,
          modelName: userFacingRouteModelName(route),
          content: providerResponse.content,
          inputTokens: providerResponse.inputTokens,
          outputTokens: providerResponse.outputTokens,
          pointsCharged: reservedPoints,
          wallet: this.toResponseWallet(workspaceId, wallet),
          artifacts: providerResponse.artifacts
        }
      };
    } catch (error) {
      if (credential) {
        await this.releaseOfficialApiCredential(credential, {
          status: 'FAILED',
          error
        });
      }
      await this.releasePoints({
        workspaceId,
        desktopDeviceId: device.id,
        routeKey: route.routeKey,
        reservationId: reservation.id,
        points: reservedPoints
      });
      this.logger.error(
        `Official model route failed: route=${route.routeKey}, provider=${route.providerId}, model=${route.modelName}`,
        error instanceof Error ? error.stack : String(error)
      );
      throw sanitizeOfficialProviderError(error);
    }
  }

  private async requireWorkspaceAccess(workspaceId: string, deviceToken?: string, cookieHeader?: string) {
    if (deviceToken) {
      return this.requireDesktopDevice(workspaceId, deviceToken);
    }

    if (!isDatabasePersistenceEnabled()) {
      if (!this.store.workspaceExists(workspaceId)) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Workspace was not found.'
          }
        });
      }
      return undefined;
    }

    await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);
    return undefined;
  }

  private async requireDesktopDevice(workspaceId: string, deviceToken?: string): Promise<VerifiedDesktopDevice> {
    if (!deviceToken) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: '请先绑定设备后再使用官方通道。'
        }
      });
    }

    if (!isDatabasePersistenceEnabled()) {
      if (!this.store.workspaceExists(workspaceId)) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Workspace was not found.'
          }
        });
      }
      return {
        id: `mock-device-${workspaceId}`,
        workspaceId,
        runtimeId: 'mock-runtime',
        deviceId: 'mock-device'
      };
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
          message: 'Desktop device is not bound to this workspace.'
        }
      });
    }

    await this.prismaService.desktopDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() }
    });

    return {
      id: device.id,
      workspaceId: device.workspaceId,
      runtimeId: device.runtimeId,
      deviceId: device.deviceId
    };
  }

  private async listRouteRecords(): Promise<OfficialRouteRecord[]> {
    if (!isDatabasePersistenceEnabled()) {
      return officialModelRouteSeeds;
    }

    const routes = await this.prismaService.officialModelRoute.findMany({
      orderBy: [{ sortOrder: 'asc' }, { routeKey: 'asc' }]
    });
    return routes.length > 0 ? routes : officialModelRouteSeeds;
  }

  private async findRouteRecord(routeKey: string): Promise<OfficialRouteRecord | undefined> {
    if (!isDatabasePersistenceEnabled()) {
      return officialModelRouteSeeds.find((route) => route.routeKey === routeKey);
    }

    const route = await this.prismaService.officialModelRoute.findUnique({
      where: { routeKey }
    });
    return route ?? officialModelRouteSeeds.find((item) => item.routeKey === routeKey);
  }

  private async acquireOfficialApiCredential(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest
  ): Promise<OfficialApiCredential> {
    if (isOfficialResultPollRequest(request)) {
      return this.resolveOfficialPollApiCredential(route, request);
    }

    if (!isDatabasePersistenceEnabled()) {
      return this.requireEnvOfficialApiCredential(route);
    }

    const deadline = Date.now() + officialRouteQueueWaitMsByCapability[route.capability];
    for (;;) {
      const credential = await this.tryAcquireOfficialApiCredential(route, request);
      if (credential) {
        return credential;
      }

      if (Date.now() >= deadline) {
        throw new ServiceUnavailableException({
          error: {
            code: 'OFFICIAL_ROUTE_BUSY',
            message: '官方通道当前繁忙，请稍后重试。'
          }
        });
      }

      await sleep(officialRouteBusyRetryMs);
    }
  }

  private async tryAcquireOfficialApiCredential(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest
  ): Promise<OfficialApiCredential | undefined> {
    await this.expireOfficialApiKeyLeases();

    const now = new Date();
    const [totalKeyCount, keys] = await Promise.all([
      this.prismaService.officialModelApiKey.count({
        where: {
          routeKey: route.routeKey
        }
      }),
      this.prismaService.officialModelApiKey.findMany({
        where: {
          routeKey: route.routeKey,
          status: {
            in: ['ACTIVE', 'COOLDOWN']
          }
        },
        orderBy: [{ currentConcurrency: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
      })
    ]);

    if (keys.length === 0) {
      return totalKeyCount === 0 ? this.requireEnvOfficialApiCredential(route) : undefined;
    }

    for (const key of keys) {
      if (key.cooldownUntil && key.cooldownUntil > now) {
        continue;
      }
      const activeLeaseCount = await this.prismaService.officialModelApiKeyLease.count({
        where: {
          status: 'ACTIVE',
          apiKey: {
            apiKeySecret: key.apiKeySecret
          }
        }
      });
      if (activeLeaseCount >= key.maxConcurrency) {
        continue;
      }
      if (key.rpmLimit && key.rpmLimit > 0) {
        const recentSubmissionCount = await this.prismaService.officialModelApiKeyLease.count({
          where: {
            apiKey: {
              apiKeySecret: key.apiKeySecret
            },
            acquiredAt: {
              gte: new Date(now.getTime() - 60_000)
            }
          }
        });
        if (recentSubmissionCount >= key.rpmLimit) {
          continue;
        }
      }

      const lease = await this.prismaService.$transaction(async (tx) => {
        const activeLeasesForSecret = await tx.officialModelApiKeyLease.count({
          where: {
            status: 'ACTIVE',
            apiKey: {
              apiKeySecret: key.apiKeySecret
            }
          }
        });
        if (activeLeasesForSecret >= key.maxConcurrency) {
          return undefined;
        }

        const updated = await tx.officialModelApiKey.updateMany({
          where: {
            id: key.id,
            status: {
              in: ['ACTIVE', 'COOLDOWN']
            },
            currentConcurrency: {
              lt: key.maxConcurrency
            },
            OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: now } }]
          },
          data: {
            currentConcurrency: {
              increment: 1
            },
            status: 'ACTIVE',
            lastUsedAt: now
          }
        });
        if (updated.count === 0) {
          return undefined;
        }

        return tx.officialModelApiKeyLease.create({
          data: {
            apiKeyId: key.id,
            routeKey: route.routeKey,
            requestKind: request.taskKind ?? route.capability.toLowerCase(),
            expiresAt: this.resolveOfficialLeaseExpiresAt(route, request, now),
            metadata: {
              source: 'official-route'
            }
          }
        });
      });

      if (lease) {
        return {
          source: 'key_pool',
          apiKey: key.apiKeySecret,
          apiKeyId: key.id,
          leaseId: lease.id
        };
      }
    }

    return undefined;
  }

  private async resolveOfficialPollApiCredential(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest
  ): Promise<OfficialApiCredential> {
    if (!isDatabasePersistenceEnabled()) {
      return this.requireEnvOfficialApiCredential(route);
    }

    const providerJobId = request.imageGeneration?.providerJobId?.trim();
    if (providerJobId) {
      const lease = await this.prismaService.officialModelApiKeyLease.findFirst({
        where: {
          routeKey: route.routeKey,
          providerJobId,
          status: 'ACTIVE'
        },
        include: {
          apiKey: true
        },
        orderBy: {
          acquiredAt: 'desc'
        }
      });
      if (lease && lease.apiKey.status !== 'DISABLED') {
        return {
          source: 'key_pool',
          apiKey: lease.apiKey.apiKeySecret,
          apiKeyId: lease.apiKeyId,
          leaseId: lease.id
        };
      }
    }

    const fallbackKey = await this.prismaService.officialModelApiKey.findFirst({
      where: {
        routeKey: route.routeKey,
        status: {
          in: ['ACTIVE', 'COOLDOWN']
        },
        OR: [{ cooldownUntil: null }, { cooldownUntil: { lte: new Date() } }]
      },
      orderBy: [{ currentConcurrency: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }]
    });
    if (fallbackKey) {
      return {
        source: 'key_pool',
        apiKey: fallbackKey.apiKeySecret,
        apiKeyId: fallbackKey.id
      };
    }

    const totalKeyCount = await this.prismaService.officialModelApiKey.count({
      where: {
        routeKey: route.routeKey
      }
    });
    if (totalKeyCount === 0) {
      return this.requireEnvOfficialApiCredential(route);
    }

    throw new ServiceUnavailableException({
      error: {
        code: 'OFFICIAL_ROUTE_BUSY',
        message: '官方通道当前繁忙，请稍后重试。'
      }
    });
  }

  private requireEnvOfficialApiCredential(route: OfficialRouteRecord): OfficialApiCredential {
    const apiKey = process.env[route.apiKeyEnvName]?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException({
        error: {
          code: 'OFFICIAL_API_KEY_NOT_CONFIGURED',
          message: '官方通道暂未配置可用线路。'
        }
      });
    }

    return {
      source: 'env',
      apiKey
    };
  }

  private resolveOfficialLeaseExpiresAt(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest,
    now: Date
  ): Date {
    const timeoutMs = request.timeoutMs ??
      (route.capability === 'VIDEO'
        ? defaultVideoTimeoutMs
        : route.capability === 'IMAGE'
          ? defaultImageTimeoutMs
          : defaultTextTimeoutMs);

    return new Date(now.getTime() + timeoutMs + 5 * 60_000);
  }

  private async attachProviderJobIdToOfficialApiCredential(
    credential: OfficialApiCredential,
    providerResponse: OfficialInvokeProviderResponse
  ): Promise<void> {
    if (!credential.leaseId) {
      return;
    }

    const providerJobId = readProviderJobIdFromResponse(providerResponse);
    if (!providerJobId) {
      return;
    }

    await this.prismaService.officialModelApiKeyLease.updateMany({
      where: {
        id: credential.leaseId,
        status: 'ACTIVE'
      },
      data: {
        providerJobId,
        metadata: {
          source: 'official-route',
          providerJobId
        }
      }
    });
  }

  private async attachProviderJobIdToPointsReservation(
    reservationId: string,
    providerJobId: string
  ): Promise<void> {
    if (!isDatabasePersistenceEnabled()) {
      return;
    }

    const reservation = await this.prismaService.aiPointLedgerEntry.findUnique({
      where: { id: reservationId },
      select: {
        metadata: true
      }
    });
    if (!reservation) {
      return;
    }

    const metadata = readRecord(reservation.metadata) ?? {};
    await this.prismaService.aiPointLedgerEntry.update({
      where: {
        id: reservationId
      },
      data: {
        metadata: JSON.parse(JSON.stringify({
          ...metadata,
          providerJobId
        })) as Prisma.InputJsonValue
      }
    });
  }

  private async findPendingPointsReservation(
    workspaceId: string,
    routeKey: string,
    providerJobId: string
  ): Promise<PendingPointsReservation | undefined> {
    if (!isDatabasePersistenceEnabled()) {
      return undefined;
    }

    const reservations = await this.prismaService.aiPointLedgerEntry.findMany({
      where: {
        workspaceId,
        routeKey,
        type: 'RESERVE',
        status: 'PENDING'
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 100,
      select: {
        id: true,
        desktopDeviceId: true,
        points: true,
        metadata: true
      }
    });

    const reservation = reservations.find(
      (item) =>
        Boolean(item.desktopDeviceId) &&
        readReservationProviderJobId(item.metadata) === providerJobId
    );
    return reservation?.desktopDeviceId
      ? {
          id: reservation.id,
          desktopDeviceId: reservation.desktopDeviceId,
          points: reservation.points,
          metadata: reservation.metadata
        }
      : undefined;
  }

  private async releaseOfficialApiCredential(
    credential: OfficialApiCredential,
    input: {
      status: 'RELEASED' | 'FAILED';
      error?: unknown;
    }
  ): Promise<void> {
    if (!credential.leaseId || !credential.apiKeyId) {
      return;
    }

    const now = new Date();
    const updatedLease = await this.prismaService.officialModelApiKeyLease.updateMany({
      where: {
        id: credential.leaseId,
        status: 'ACTIVE'
      },
      data: {
        status: input.status,
        releasedAt: now,
        metadata: {
          source: 'official-route',
          releaseReason: input.status.toLowerCase()
        }
      }
    });
    if (updatedLease.count === 0) {
      return;
    }

    const errorMessage = input.error ? truncateText(readErrorMessage(input.error), 500) : undefined;
    const shouldCooldown = input.status === 'FAILED' && shouldCooldownOfficialApiKey(input.error);
    const keyUpdateData: Prisma.OfficialModelApiKeyUpdateManyMutationInput = {
      currentConcurrency: {
        decrement: 1
      },
      ...(input.status === 'FAILED'
        ? {
            failureCount: {
              increment: 1
            },
            lastError: errorMessage,
            ...(shouldCooldown
              ? {
                  cooldownUntil: new Date(now.getTime() + officialKeyCooldownMs(input.error)),
                  status: 'COOLDOWN' as const
                }
              : {})
          }
        : {
            failureCount: 0,
            lastError: null,
            cooldownUntil: null,
            status: 'ACTIVE' as const
          })
    };
    await this.prismaService.officialModelApiKey.updateMany({
      where: {
        id: credential.apiKeyId,
        currentConcurrency: {
          gt: 0
        }
      },
      data: keyUpdateData
    });
  }

  private async expireOfficialApiKeyLeases(routeKey?: string): Promise<void> {
    const expiredLeases = await this.prismaService.officialModelApiKeyLease.findMany({
      where: {
        ...(routeKey ? { routeKey } : {}),
        status: 'ACTIVE',
        expiresAt: {
          lt: new Date()
        }
      },
      select: {
        id: true,
        apiKeyId: true
      },
      take: 100
    });

    for (const lease of expiredLeases) {
      const updatedLease = await this.prismaService.officialModelApiKeyLease.updateMany({
        where: {
          id: lease.id,
          status: 'ACTIVE'
        },
        data: {
          status: 'EXPIRED',
          releasedAt: new Date()
        }
      });
      if (updatedLease.count > 0) {
        await this.prismaService.officialModelApiKey.updateMany({
          where: {
            id: lease.apiKeyId,
            currentConcurrency: {
              gt: 0
            }
          },
          data: {
            currentConcurrency: {
              decrement: 1
            },
            lastError: 'Official route lease expired before release.'
          }
        });
      }
    }
  }

  private async ensureWallet(workspaceId: string) {
    return this.prismaService.aiPointWallet.upsert({
      where: { workspaceId },
      update: {},
      create: {
        workspaceId,
        balancePoints: 0,
        reservedPoints: 0
      }
    });
  }

  private async ensureActivePersonalMemberMonthlyCredits(
    workspaceId: string,
    now = new Date()
  ): Promise<void> {
    if (!isDatabasePersistenceEnabled() || isLocalDevelopmentUnlimitedEnabled()) {
      return;
    }

    await this.prismaService.$transaction(async (tx) => {
      await this.ensureActivePersonalMemberMonthlyCreditsInTransaction(tx, workspaceId, now);
    });
  }

  private async ensureActivePersonalMemberMonthlyCreditsInTransaction(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    now: Date
  ): Promise<void> {
    const subscription = await tx.subscription.findFirst({
      where: {
        workspaceId,
        status: 'ACTIVE'
      },
      include: {
        plan: true
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });
    if (!subscription) {
      return;
    }

    if (
      subscription.plan.code !== 'PERSONAL_MEMBER_MONTHLY' &&
      subscription.plan.code !== 'PERSONAL_MEMBER_ANNUAL'
    ) {
      return;
    }
    if (subscription.currentPeriodStart && subscription.currentPeriodStart > now) {
      return;
    }
    if (subscription.currentPeriodEnd && subscription.currentPeriodEnd <= now) {
      return;
    }

    const { start: monthStart, end: monthEnd, period } = getCurrentMonthRange(now);
    const existingBucket = await tx.aiPointCreditBucket.findFirst({
      where: {
        workspaceId,
        subscriptionId: subscription.id,
        sourceType: 'SUBSCRIPTION_MONTHLY',
        startsAt: {
          gte: monthStart,
          lt: monthEnd
        },
        status: {
          not: 'CANCELLED'
        }
      },
      select: {
        id: true
      }
    });
    if (existingBucket) {
      return;
    }

    const startsAt =
      subscription.currentPeriodStart && subscription.currentPeriodStart > monthStart
        ? subscription.currentPeriodStart
        : monthStart;
    const expiresAt =
      subscription.currentPeriodEnd && subscription.currentPeriodEnd < monthEnd
        ? subscription.currentPeriodEnd
        : monthEnd;
    if (expiresAt <= startsAt) {
      return;
    }

    const points = personalMemberMonthlyAiPoints;
    const creditBucket = await tx.aiPointCreditBucket.createMany({
      data: {
        workspaceId,
        sourceType: 'SUBSCRIPTION_MONTHLY',
        subscriptionId: subscription.id,
        idempotencyKey: `subscription-monthly:${subscription.id}:${period}`,
        totalPoints: points,
        availablePoints: points,
        reservedPoints: 0,
        startsAt,
        expiresAt,
        status: 'ACTIVE',
        metadata: {
          source: 'personal-member-monthly',
          period,
          planCode: subscription.plan.code
        }
      },
      skipDuplicates: true
    });
    if (creditBucket.count === 0) {
      return;
    }

    const wallet = await tx.aiPointWallet.upsert({
      where: { workspaceId },
      update: {
        balancePoints: {
          increment: points
        }
      },
      create: {
        workspaceId,
        balancePoints: points,
        reservedPoints: 0
      }
    });

    await tx.aiPointLedgerEntry.create({
      data: {
        workspaceId,
        type: 'GRANT',
        status: 'COMPLETED',
        points,
        balanceAfter: wallet.balancePoints - wallet.reservedPoints,
        description: '会员月度 AI 点数发放',
        metadata: {
          source: 'personal-member-monthly',
          subscriptionId: subscription.id,
          period,
          expiresAt: expiresAt.toISOString()
        }
      }
    });
  }

  private async expireWorkspaceCreditBuckets(workspaceId: string, now = new Date()): Promise<void> {
    if (!isDatabasePersistenceEnabled() || isLocalDevelopmentUnlimitedEnabled()) {
      return;
    }

    await this.prismaService.$transaction(async (tx) => {
      await tx.aiPointWallet.upsert({
        where: { workspaceId },
        update: {},
        create: {
          workspaceId,
          balancePoints: 0,
          reservedPoints: 0
        }
      });
      await this.expireWorkspaceCreditBucketsInTransaction(tx, workspaceId, now);
    });
  }

  private async expireWorkspaceCreditBucketsInTransaction(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    now: Date
  ): Promise<void> {
    const expiredBuckets = await tx.aiPointCreditBucket.findMany({
      where: {
        workspaceId,
        status: 'ACTIVE',
        expiresAt: {
          lte: now
        }
      },
      select: {
        id: true,
        availablePoints: true
      }
    });

    if (expiredBuckets.length === 0) {
      return;
    }

    const wallet = await tx.aiPointWallet.upsert({
      where: { workspaceId },
      update: {},
      create: {
        workspaceId,
        balancePoints: 0,
        reservedPoints: 0
      }
    });
    const expiringAvailablePoints = expiredBuckets.reduce(
      (total, bucket) => total + Math.max(0, bucket.availablePoints),
      0
    );
    const pointsToExpire = Math.min(
      expiringAvailablePoints,
      Math.max(0, wallet.balancePoints - wallet.reservedPoints)
    );

    await tx.aiPointCreditBucket.updateMany({
      where: {
        id: {
          in: expiredBuckets.map((bucket) => bucket.id)
        }
      },
      data: {
        availablePoints: 0,
        status: 'EXPIRED'
      }
    });

    if (pointsToExpire <= 0) {
      return;
    }

    const updatedWallet = await tx.aiPointWallet.update({
      where: { workspaceId },
      data: {
        balancePoints: {
          decrement: pointsToExpire
        }
      }
    });

    await tx.aiPointLedgerEntry.create({
      data: {
        workspaceId,
        type: 'ADJUSTMENT',
        status: 'COMPLETED',
        points: -pointsToExpire,
        balanceAfter: updatedWallet.balancePoints - updatedWallet.reservedPoints,
        description: 'Expired unused AI point credits.',
        metadata: {
          source: 'ai-point-credit-bucket-expiry',
          bucketIds: expiredBuckets.map((bucket) => bucket.id)
        }
      }
    });
  }

  private async ensureLegacyWalletCoveredByBucketsInTransaction(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    wallet: {
      balancePoints: number;
      reservedPoints: number;
    },
    now: Date
  ): Promise<void> {
    const walletAvailablePoints = Math.max(0, wallet.balancePoints - wallet.reservedPoints);
    if (walletAvailablePoints <= 0) {
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
              gt: now
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
    const missingPoints = walletAvailablePoints - bucketAvailablePoints;
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
        startsAt: now,
        metadata: {
          source: 'legacy-wallet-balance'
        }
      }
    });
  }

  private async ensureDeviceQuota(device: VerifiedDesktopDevice) {
    const period = currentMonthPeriod();
    const existing = await this.prismaService.desktopDeviceAiQuota.findUnique({
      where: { desktopDeviceId: device.id }
    });
    if (existing && existing.period === period) {
      return existing;
    }

    if (existing) {
      return this.prismaService.desktopDeviceAiQuota.update({
        where: { desktopDeviceId: device.id },
        data: {
          period,
          usedPointsThisMonth: 0,
          reservedPoints: 0
        }
      });
    }

    return this.prismaService.desktopDeviceAiQuota.create({
      data: {
        workspaceId: device.workspaceId,
        desktopDeviceId: device.id,
        period,
        status: 'ACTIVE'
      }
    });
  }

  private async reservePoints(input: {
    workspaceId: string;
    desktopDeviceId: string;
    routeKey: string;
    points: number;
  }): Promise<{ id: string }> {
    if (!isDatabasePersistenceEnabled()) {
      return { id: `mock-reserve-${Date.now()}` };
    }

    if (isLocalDevelopmentUnlimitedEnabled()) {
      const entry = await this.prismaService.aiPointLedgerEntry.create({
        data: {
          workspaceId: input.workspaceId,
          desktopDeviceId: input.desktopDeviceId,
          routeKey: input.routeKey,
          type: 'RESERVE',
          status: 'PENDING',
          points: input.points,
          description: 'Local development official channel reservation.'
        }
      });
      return { id: entry.id };
    }

    return this.prismaService.$transaction(async (tx) => {
      const now = new Date();
      await this.ensureActivePersonalMemberMonthlyCreditsInTransaction(tx, input.workspaceId, now);
      await this.expireWorkspaceCreditBucketsInTransaction(tx, input.workspaceId, now);
      const wallet = await tx.aiPointWallet.upsert({
        where: { workspaceId: input.workspaceId },
        update: {},
        create: {
          workspaceId: input.workspaceId,
          balancePoints: 0,
          reservedPoints: 0
        }
      });
      const availablePoints = wallet.balancePoints - wallet.reservedPoints;
      if (availablePoints < input.points) {
        throw new ForbiddenException({
          error: {
            code: 'AI_POINTS_INSUFFICIENT',
          message: 'AI 点数不足，请先购买或联系管理员分配。'
          }
        });
      }
      await this.ensureLegacyWalletCoveredByBucketsInTransaction(tx, input.workspaceId, wallet, now);

      const quota = await this.ensureDeviceQuotaInTransaction(tx, input.workspaceId, input.desktopDeviceId);
      if (quota.status !== 'ACTIVE') {
        throw new ForbiddenException({
          error: {
            code: 'AI_POINTS_DEVICE_QUOTA_DISABLED',
            message: '当前设备的 AI 点数使用额度已停用。'
          }
        });
      }
      if (
        quota.monthlyLimitPoints !== null &&
        quota.monthlyLimitPoints !== undefined &&
        quota.monthlyLimitPoints - quota.usedPointsThisMonth - quota.reservedPoints < input.points
      ) {
        throw new ForbiddenException({
          error: {
            code: 'AI_POINTS_DEVICE_QUOTA_EXCEEDED',
            message: '当前设备本月 AI 点数额度不足。'
          }
        });
      }

      const bucketAllocations = await this.reserveCreditBucketsInTransaction(tx, {
        workspaceId: input.workspaceId,
        points: input.points,
        now
      });
      const updatedWallet = await tx.aiPointWallet.update({
        where: { workspaceId: input.workspaceId },
        data: {
          reservedPoints: {
            increment: input.points
          }
        }
      });
      await tx.desktopDeviceAiQuota.update({
        where: { desktopDeviceId: input.desktopDeviceId },
        data: {
          reservedPoints: {
            increment: input.points
          }
        }
      });
      const entry = await tx.aiPointLedgerEntry.create({
        data: {
          workspaceId: input.workspaceId,
          desktopDeviceId: input.desktopDeviceId,
          routeKey: input.routeKey,
          type: 'RESERVE',
          status: 'PENDING',
          points: input.points,
          balanceAfter: updatedWallet.balancePoints - updatedWallet.reservedPoints,
          description: 'Official model route point reservation.',
          metadata: toReservationMetadata(bucketAllocations)
        }
      });
      return { id: entry.id };
    });
  }

  private async reserveCreditBucketsInTransaction(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      points: number;
      now: Date;
    }
  ): Promise<AiPointBucketAllocation[]> {
    const buckets = await tx.aiPointCreditBucket.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: 'ACTIVE',
        availablePoints: {
          gt: 0
        },
        startsAt: {
          lte: input.now
        },
        OR: [
          { expiresAt: null },
          {
            expiresAt: {
              gt: input.now
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

    const allocations: AiPointBucketAllocation[] = [];
    let remainingPoints = input.points;
    for (const bucket of buckets.sort(compareCreditBucketsForDeduction)) {
      if (remainingPoints <= 0) {
        break;
      }

      const points = Math.min(bucket.availablePoints, remainingPoints);
      const updated = await tx.aiPointCreditBucket.updateMany({
        where: {
          id: bucket.id,
          availablePoints: {
            gte: points
          }
        },
        data: {
          availablePoints: {
            decrement: points
          },
          reservedPoints: {
            increment: points
          }
        }
      });
      if (updated.count !== 1) {
        throw new ServiceUnavailableException({
          error: {
            code: 'AI_POINTS_RESERVATION_CONFLICT',
            message: 'AI points are being used by another task. Please retry.'
          }
        });
      }

      allocations.push({
        bucketId: bucket.id,
        sourceType: bucket.sourceType as AiPointCreditBucketSourceType,
        points,
        expiresAt: bucket.expiresAt?.toISOString()
      });
      remainingPoints -= points;
    }

    if (remainingPoints > 0) {
      throw new ForbiddenException({
        error: {
          code: 'AI_POINTS_INSUFFICIENT',
          message: 'AI 点数不足，请先购买或联系管理员分配。'
        }
      });
    }

    return allocations;
  }

  private async settlePoints(input: {
    workspaceId: string;
    desktopDeviceId: string;
    routeKey: string;
    reservationId: string;
    points: number;
  }) {
    if (!isDatabasePersistenceEnabled()) {
      return undefined;
    }

    if (isLocalDevelopmentUnlimitedEnabled()) {
      await this.prismaService.aiPointLedgerEntry.update({
        where: { id: input.reservationId },
        data: { status: 'COMPLETED' }
      }).catch(() => undefined);
      return this.ensureWallet(input.workspaceId);
    }

    return this.prismaService.$transaction(async (tx) => {
      const reservation = await tx.aiPointLedgerEntry.findUnique({
        where: { id: input.reservationId },
        select: {
          metadata: true,
          status: true,
          points: true
        }
      });
      if (!reservation || reservation.status !== 'PENDING') {
        return tx.aiPointWallet.findUniqueOrThrow({
          where: { workspaceId: input.workspaceId }
        });
      }
      const bucketAllocations = readReservationBucketAllocations(reservation?.metadata);
      const points = reservation.points;
      await this.settleReservedCreditBucketsInTransaction(tx, bucketAllocations);

      const wallet = await tx.aiPointWallet.update({
        where: { workspaceId: input.workspaceId },
        data: {
          balancePoints: {
            decrement: points
          },
          reservedPoints: {
            decrement: points
          }
        }
      });
      await tx.desktopDeviceAiQuota.update({
        where: { desktopDeviceId: input.desktopDeviceId },
        data: {
          usedPointsThisMonth: {
            increment: points
          },
          reservedPoints: {
            decrement: points
          }
        }
      });
      await tx.aiPointLedgerEntry.update({
        where: { id: input.reservationId },
        data: {
          status: 'COMPLETED',
          balanceAfter: wallet.balancePoints - wallet.reservedPoints
        }
      });
      await tx.aiPointLedgerEntry.create({
        data: {
          workspaceId: input.workspaceId,
          desktopDeviceId: input.desktopDeviceId,
          routeKey: input.routeKey,
          type: 'SETTLE',
          status: 'COMPLETED',
          points: -points,
          balanceAfter: wallet.balancePoints - wallet.reservedPoints,
          description: 'Official model route point settlement.',
          metadata: toReservationMetadata(bucketAllocations)
        }
      });
      return wallet;
    });
  }

  private async settleReservedCreditBucketsInTransaction(
    tx: Prisma.TransactionClient,
    allocations: AiPointBucketAllocation[]
  ): Promise<void> {
    for (const allocation of allocations) {
      if (allocation.points <= 0) {
        continue;
      }

      await tx.aiPointCreditBucket.updateMany({
        where: {
          id: allocation.bucketId,
          reservedPoints: {
            gte: allocation.points
          }
        },
        data: {
          reservedPoints: {
            decrement: allocation.points
          }
        }
      });
    }
  }

  private async releasePoints(input: {
    workspaceId: string;
    desktopDeviceId: string;
    routeKey: string;
    reservationId: string;
    points: number;
  }) {
    if (!isDatabasePersistenceEnabled()) {
      return;
    }

    if (isLocalDevelopmentUnlimitedEnabled()) {
      await this.prismaService.aiPointLedgerEntry.update({
        where: { id: input.reservationId },
        data: { status: 'CANCELLED' }
      }).catch(() => undefined);
      return;
    }

    await this.prismaService.$transaction(async (tx) => {
      const now = new Date();
      const reservation = await tx.aiPointLedgerEntry.findUnique({
        where: { id: input.reservationId },
        select: {
          metadata: true,
          status: true,
          points: true
        }
      });
      if (!reservation || reservation.status !== 'PENDING') {
        return;
      }
      const bucketAllocations = readReservationBucketAllocations(reservation?.metadata);
      const points = reservation.points;
      const expiredReleasedPoints = await this.releaseReservedCreditBucketsInTransaction(tx, bucketAllocations, now);
      const wallet = await tx.aiPointWallet.update({
        where: { workspaceId: input.workspaceId },
        data: {
          ...(expiredReleasedPoints > 0
            ? {
                balancePoints: {
                  decrement: expiredReleasedPoints
                }
              }
            : {}),
          reservedPoints: {
            decrement: points
          }
        }
      });
      await tx.desktopDeviceAiQuota.update({
        where: { desktopDeviceId: input.desktopDeviceId },
        data: {
          reservedPoints: {
            decrement: points
          }
        }
      }).catch(() => undefined);
      await tx.aiPointLedgerEntry.update({
        where: { id: input.reservationId },
        data: {
          status: 'CANCELLED',
          balanceAfter: wallet.balancePoints - wallet.reservedPoints
        }
      }).catch(() => undefined);
      await tx.aiPointLedgerEntry.create({
        data: {
          workspaceId: input.workspaceId,
          desktopDeviceId: input.desktopDeviceId,
          routeKey: input.routeKey,
          type: 'RELEASE',
          status: 'COMPLETED',
          points,
          balanceAfter: wallet.balancePoints - wallet.reservedPoints,
          description: 'Official model route reservation released.',
          metadata: toReservationMetadata(bucketAllocations)
        }
      });
    });
  }

  private async releaseReservedCreditBucketsInTransaction(
    tx: Prisma.TransactionClient,
    allocations: AiPointBucketAllocation[],
    now: Date
  ): Promise<number> {
    let expiredReleasedPoints = 0;
    for (const allocation of allocations) {
      if (allocation.points <= 0) {
        continue;
      }

      const bucket = await tx.aiPointCreditBucket.findUnique({
        where: { id: allocation.bucketId },
        select: {
          id: true,
          status: true,
          expiresAt: true
        }
      });
      if (!bucket) {
        continue;
      }

      const isStillUsable = bucket.status === 'ACTIVE' && (!bucket.expiresAt || bucket.expiresAt > now);
      const updated = await tx.aiPointCreditBucket.updateMany({
        where: {
          id: bucket.id,
          reservedPoints: {
            gte: allocation.points
          }
        },
        data: {
          ...(isStillUsable
            ? {
                availablePoints: {
                  increment: allocation.points
                }
              }
            : {
                status: 'EXPIRED' as const
              }),
          reservedPoints: {
            decrement: allocation.points
          }
        }
      });

      if (updated.count === 1 && !isStillUsable) {
        expiredReleasedPoints += allocation.points;
      }
    }

    return expiredReleasedPoints;
  }

  private async ensureDeviceQuotaInTransaction(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    desktopDeviceId: string
  ) {
    const period = currentMonthPeriod();
    const existing = await tx.desktopDeviceAiQuota.findUnique({
      where: { desktopDeviceId }
    });
    if (existing && existing.period === period) {
      return existing;
    }

    if (existing) {
      return tx.desktopDeviceAiQuota.update({
        where: { desktopDeviceId },
        data: {
          period,
          usedPointsThisMonth: 0,
          reservedPoints: 0
        }
      });
    }

    return tx.desktopDeviceAiQuota.create({
      data: {
        workspaceId,
        desktopDeviceId,
        period,
        status: 'ACTIVE'
      }
    });
  }

  private async invokeProvider(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest,
    apiKey: string
  ): Promise<OfficialInvokeProviderResponse> {
    const mode = readProviderMode(route.providerConfig);
    if (mode === 'openai_chat') {
      return this.invokeOpenAiChat(route, request, apiKey);
    }
    if (mode === 'grsai_image') {
      return this.invokeGrsaiImage(route, request, apiKey);
    }
    if (mode === 'minimax_video') {
      return this.invokeMiniMaxVideo(route, request, apiKey);
    }

    throw new OfficialProviderUnavailableError('Official route adapter is not available.');
  }

  private async invokeOpenAiChat(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest,
    apiKey: string
  ): Promise<OfficialInvokeProviderResponse> {
    const endpoint = `${normalizeApiBaseUrl(route.apiBaseUrl)}/chat/completions`;
    const response = await fetchJson(endpoint, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: route.modelName,
        messages: request.messages,
        temperature: route.capability === 'REASONING' ? 0.2 : 0.4,
        max_tokens: route.capability === 'REASONING' ? 8192 : 4096
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? defaultTextTimeoutMs)
    }, 'Official text route');

    const content = readAssistantContent(response.body);
    if (!content) {
      throw new OfficialProviderUnavailableError('Official text route returned empty content.');
    }

    return {
      content,
      inputTokens: readTokenCount(readRecord(response.body)?.usage, 'prompt_tokens'),
      outputTokens: readTokenCount(readRecord(response.body)?.usage, 'completion_tokens')
    };
  }

  private async invokeGrsaiImage(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest,
    apiKey: string
  ): Promise<OfficialInvokeProviderResponse> {
    const imageRequest = request.imageGeneration;
    const prompt = imageRequest?.prompt?.trim() || lastUserMessageContent(request.messages);
    if (!prompt) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: '图片生成需要提示词。'
        }
      });
    }

    const asyncMode = imageRequest?.asyncMode ?? 'wait';
    const timeoutMs = request.timeoutMs ?? defaultImageTimeoutMs;
    const apiBaseUrl = normalizeApiBaseUrl(route.apiBaseUrl);
    if (asyncMode === 'poll_once') {
      const providerJobId = imageRequest?.providerJobId?.trim();
      if (!providerJobId) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: '查询图片生成结果需要任务编号。'
          }
        });
      }
      const result = await queryGrsaiResult({
        apiBaseUrl,
        apiKey,
        providerJobId,
        timeoutMs
      });
      if (!result.remoteUrl) {
        return pendingGenerationResponse({
          route,
          providerJobId,
          providerStatus: result.providerStatus,
          type: 'image'
        });
      }
      return generationResponse({
        route,
        remoteUrl: result.remoteUrl,
        providerJobId,
        providerStatus: result.providerStatus,
        type: 'image'
      });
    }

    const submitResponse = await fetchJson(`${apiBaseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(buildGrsaiImagePayload(route, request, prompt)),
      signal: AbortSignal.timeout(Math.min(timeoutMs, grsaiSubmitTimeoutMs))
    }, 'Official image route submit');

    const submittedUrl = readMediaUrlFromUnknown(submitResponse.body, 'image');
    const providerJobId = readProviderJobId(submitResponse.body);
    const submittedStatus = readProviderStatus(submitResponse.body);
    if (isFailedStatus(submittedStatus)) {
      throw new OfficialProviderUnavailableError('Official image route task failed.');
    }
    if (submittedUrl) {
      return generationResponse({
        route,
        remoteUrl: submittedUrl,
        providerJobId,
        providerStatus: submittedStatus,
        type: 'image'
      });
    }
    if (!providerJobId) {
      throw new OfficialProviderUnavailableError('Official image route did not return a task id.');
    }
    if (asyncMode === 'submit_only') {
      return pendingGenerationResponse({
        route,
        providerJobId,
        providerStatus: submittedStatus,
        type: 'image'
      });
    }

    const result = await pollGrsaiResult({
      apiBaseUrl,
      apiKey,
      providerJobId,
      timeoutMs,
      startedAt: Date.now()
    });
    return generationResponse({
      route,
      remoteUrl: result.remoteUrl,
      providerJobId,
      providerStatus: result.providerStatus,
      type: 'image'
    });
  }

  private async invokeMiniMaxVideo(
    route: OfficialRouteRecord,
    request: OfficialInvokeRequest,
    apiKey: string
  ): Promise<OfficialInvokeProviderResponse> {
    const videoRequest = request.videoGeneration;
    const prompt = videoRequest?.prompt?.trim() || lastUserMessageContent(request.messages);
    if (!prompt) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: '视频生成需要提示词。'
        }
      });
    }

    const timeoutMs = request.timeoutMs ?? defaultVideoTimeoutMs;
    const apiBaseUrl = normalizeMiniMaxApiBaseUrl(route.apiBaseUrl);
    const submitResponse = await fetchJson(`${apiBaseUrl}/video_generation`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(buildMiniMaxVideoPayload(route, request, prompt)),
      signal: AbortSignal.timeout(Math.min(timeoutMs, minimaxSubmitTimeoutMs))
    }, 'Official video route submit');

    const providerError = readMiniMaxProviderError(submitResponse.body);
    if (providerError) {
      throw new OfficialProviderUnavailableError('Official video route task failed.');
    }
    const directUrl = readMediaUrlFromUnknown(submitResponse.body, 'video');
    const providerJobId = readProviderJobId(submitResponse.body);
    const submittedStatus = readProviderStatus(submitResponse.body);
    if (directUrl) {
      return generationResponse({
        route,
        remoteUrl: directUrl,
        providerJobId,
        providerStatus: submittedStatus,
        type: 'video'
      });
    }
    if (!providerJobId) {
      throw new OfficialProviderUnavailableError('Official video route did not return a task id.');
    }

    const result = await pollMiniMaxResult({
      apiBaseUrl,
      apiKey,
      providerJobId,
      timeoutMs,
      startedAt: Date.now()
    });
    return generationResponse({
      route,
      remoteUrl: result.remoteUrl,
      providerJobId,
      providerStatus: result.providerStatus,
      type: 'video'
    });
  }

  private buildMockWallet(workspaceId: string) {
    return {
      workspaceId,
      balancePoints: isLocalDevelopmentUnlimitedEnabled() ? 999999 : 0,
      reservedPoints: 0,
      availablePoints: isLocalDevelopmentUnlimitedEnabled() ? 999999 : 0,
      updatedAt: new Date().toISOString()
    };
  }

  private buildMockDeviceQuota(desktopDeviceId: string) {
    return {
      desktopDeviceId,
      period: currentMonthPeriod(),
      usedPointsThisMonth: 0,
      reservedPoints: 0,
      availablePoints: undefined,
      status: 'active'
    };
  }

  private toResponseWallet(workspaceId: string, wallet?: {
    workspaceId: string;
    balancePoints: number;
    reservedPoints: number;
    updatedAt: Date;
  }) {
    if (isLocalDevelopmentUnlimitedEnabled()) {
      return this.buildMockWallet(workspaceId);
    }

    return wallet ? toWalletSummary(wallet) : this.buildMockWallet(workspaceId);
  }
}

class OfficialProviderUnavailableError extends Error {}

function parseOfficialInvokeRequest(body: unknown): OfficialInvokeRequest {
  if (!isRecord(body)) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: '官方通道请求格式不正确。'
      }
    });
  }

  const routeKey = typeof body.officialRouteKey === 'string' ? body.officialRouteKey.trim() : '';
  const messages = Array.isArray(body.messages)
    ? body.messages.flatMap((item): OfficialMessage[] => {
        if (!isRecord(item)) {
          return [];
        }
        const role = item.role;
        const content = typeof item.content === 'string' ? item.content : '';
        if ((role === 'system' || role === 'user' || role === 'assistant') && content.trim()) {
          return [{ role, content }];
        }
        return [];
      })
    : [];

  if (!routeKey) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: '官方通道线路不能为空。'
      }
    });
  }

  if (messages.length === 0) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: '官方通道请求需要至少一条消息。'
      }
    });
  }

  return {
    officialRouteKey: routeKey,
    messages,
    timeoutMs: readOptionalPositiveInteger(body.timeoutMs),
    taskKind: readTaskKind(body.taskKind),
    imageGeneration: readImageGenerationRequest(body.imageGeneration),
    videoGeneration: readVideoGenerationRequest(body.videoGeneration)
  };
}

function readTaskKind(value: unknown): OfficialInvokeRequest['taskKind'] {
  return value === 'chat' ||
    value === 'image_generation' ||
    value === 'video_generation' ||
    value === 'audio_transcription'
    ? value
    : undefined;
}

function readImageGenerationRequest(value: unknown): OfficialInvokeRequest['imageGeneration'] {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    negativePrompt: typeof value.negativePrompt === 'string' ? value.negativePrompt : undefined,
    sourceImageDataUrl: typeof value.sourceImageDataUrl === 'string' ? value.sourceImageDataUrl : undefined,
    size: typeof value.size === 'string' ? value.size : undefined,
    aspectRatio: typeof value.aspectRatio === 'string' ? value.aspectRatio : undefined,
    responseFormat: value.responseFormat === 'url' ? 'url' : undefined,
    asyncMode:
      value.asyncMode === 'wait' || value.asyncMode === 'submit_only' || value.asyncMode === 'poll_once'
        ? value.asyncMode
        : undefined,
    providerJobId: typeof value.providerJobId === 'string' ? value.providerJobId : undefined
  };
}

function readVideoGenerationRequest(value: unknown): OfficialInvokeRequest['videoGeneration'] {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    prompt: typeof value.prompt === 'string' ? value.prompt : '',
    negativePrompt: typeof value.negativePrompt === 'string' ? value.negativePrompt : undefined,
    sourceImageDataUrl: typeof value.sourceImageDataUrl === 'string' ? value.sourceImageDataUrl : undefined,
    durationSeconds: readOptionalPositiveInteger(value.durationSeconds),
    aspectRatio: typeof value.aspectRatio === 'string' ? value.aspectRatio : undefined,
    responseFormat: value.responseFormat === 'url' ? 'url' : undefined
  };
}

function readOptionalPositiveInteger(value: unknown): number | undefined {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? Math.round(numberValue) : undefined;
}

const legacyOfficialRoutePricing: Record<
  string,
  {
    basePointPrice: number;
    durationPoints?: Record<string, number>;
  }
> = {
  'official-text-1': {
    basePointPrice: 1
  },
  'official-reasoning-1': {
    basePointPrice: 3
  },
  'official-image-1': {
    basePointPrice: 15
  },
  'official-image-2': {
    basePointPrice: 25
  },
  'official-video-1': {
    basePointPrice: 200,
    durationPoints: {
      '6': 200,
      '10': 280
    }
  },
  'official-video-2': {
    basePointPrice: 300,
    durationPoints: {
      '6': 300,
      '10': 500
    }
  },
  'official-video-3': {
    basePointPrice: 0
  }
};

function resolveOfficialRoutePricing(route: OfficialRouteRecord): {
  basePointPrice: number;
  durationPoints?: Record<string, number>;
} {
  const fallback = legacyOfficialRoutePricing[route.routeKey];
  const providerConfig = readRecord(route.providerConfig);
  const pricing = readRecord(providerConfig?.pricing);
  const rawDurationPoints = readRecord(pricing?.durationPoints);
  const durationPoints = rawDurationPoints
    ? Object.fromEntries(
        Object.entries(rawDurationPoints).flatMap(([key, value]) => {
          const points = Number(value);
          return Number.isFinite(points) && points >= 0 ? [[key, Math.trunc(points)]] : [];
        })
      )
    : undefined;

  if (durationPoints && Object.keys(durationPoints).length > 0) {
    const configuredBase = Number(route.pointPrice);
    return {
      basePointPrice:
        Number.isFinite(configuredBase) && configuredBase >= 0
          ? Math.trunc(configuredBase)
          : Math.min(...Object.values(durationPoints)),
      durationPoints
    };
  }

  if (fallback) {
    return fallback;
  }

  return {
    basePointPrice: Math.max(0, Math.trunc(route.pointPrice))
  };
}

function resolveOfficialRoutePointPrice(route: OfficialRouteRecord, request: OfficialInvokeRequest): number {
  const pricing = resolveOfficialRoutePricing(route);
  if (route.capability !== 'VIDEO' || !pricing.durationPoints) {
    return Math.max(0, pricing.basePointPrice);
  }

  const durationSeconds = normalizeMiniMaxVideoDurationSeconds(request.videoGeneration?.durationSeconds) ?? 6;
  return Math.max(
    0,
    pricing.durationPoints[String(durationSeconds)] ??
      pricing.durationPoints['6'] ??
      pricing.basePointPrice
  );
}

function toRouteSummary(route: OfficialRouteRecord) {
  const pricing = resolveOfficialRoutePricing(route);
  return {
    routeKey: route.routeKey,
    displayName: route.displayName,
    capability: route.capability.toLowerCase(),
    status: route.status.toLowerCase(),
    pointPrice: pricing.basePointPrice,
    ...(pricing.durationPoints
      ? {
          pointPricesByDurationSeconds: pricing.durationPoints
        }
      : {}),
    sortOrder: route.sortOrder
  };
}

function toWalletSummary(wallet: {
  workspaceId: string;
  balancePoints: number;
  reservedPoints: number;
  updatedAt: Date;
}) {
  return {
    workspaceId: wallet.workspaceId,
    balancePoints: wallet.balancePoints,
    reservedPoints: wallet.reservedPoints,
    availablePoints: wallet.balancePoints - wallet.reservedPoints,
    updatedAt: wallet.updatedAt.toISOString()
  };
}

function toCreditBucketSummary(bucket: {
  id: string;
  workspaceId: string;
  sourceType: string;
  totalPoints: number;
  availablePoints: number;
  reservedPoints: number;
  startsAt: Date;
  expiresAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: bucket.id,
    workspaceId: bucket.workspaceId,
    sourceType: bucket.sourceType.toLowerCase(),
    totalPoints: bucket.totalPoints,
    availablePoints: bucket.availablePoints,
    reservedPoints: bucket.reservedPoints,
    startsAt: bucket.startsAt.toISOString(),
    expiresAt: bucket.expiresAt?.toISOString(),
    status: bucket.status.toLowerCase(),
    createdAt: bucket.createdAt.toISOString(),
    updatedAt: bucket.updatedAt.toISOString()
  };
}

function toDeviceQuotaSummary(quota: {
  desktopDeviceId: string;
  period: string;
  monthlyLimitPoints: number | null;
  usedPointsThisMonth: number;
  reservedPoints: number;
  status: string;
}) {
  const monthlyLimitPoints = quota.monthlyLimitPoints ?? undefined;
  return {
    desktopDeviceId: quota.desktopDeviceId,
    period: quota.period,
    monthlyLimitPoints,
    usedPointsThisMonth: quota.usedPointsThisMonth,
    reservedPoints: quota.reservedPoints,
    availablePoints:
      monthlyLimitPoints === undefined
        ? undefined
        : monthlyLimitPoints - quota.usedPointsThisMonth - quota.reservedPoints,
    status: quota.status.toLowerCase()
  };
}

function currentMonthPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function getCurrentMonthRange(now: Date): {
  start: Date;
  end: Date;
  period: string;
} {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    start,
    end,
    period: start.toISOString().slice(0, 7)
  };
}

function isOfficialResultPollRequest(request: OfficialInvokeRequest): boolean {
  return request.imageGeneration?.asyncMode === 'poll_once';
}

function isPendingGenerationProviderResponse(response: OfficialInvokeProviderResponse): boolean {
  const artifacts = response.artifacts ?? [];
  if (artifacts.some((artifact) => artifact.metadata?.pending === true)) {
    return true;
  }
  if (artifacts.some((artifact) => artifact.providerJobId && !artifact.remoteUrl && !artifact.localPath)) {
    return true;
  }

  const content = parseJsonBody(response.content);
  const record = readRecord(content);
  return record?.pending === true || Boolean(record?.providerJobId && !record?.remoteUrl);
}

function readProviderJobIdFromResponse(response: OfficialInvokeProviderResponse): string | undefined {
  for (const artifact of response.artifacts ?? []) {
    const providerJobId = artifact.providerJobId?.trim();
    if (providerJobId) {
      return providerJobId;
    }
    const metadataJobId = typeof artifact.metadata?.providerJobId === 'string'
      ? artifact.metadata.providerJobId.trim()
      : '';
    if (metadataJobId) {
      return metadataJobId;
    }
  }

  const content = parseJsonBody(response.content);
  const record = readRecord(content);
  const providerJobId = typeof record?.providerJobId === 'string' ? record.providerJobId.trim() : '';
  return providerJobId || undefined;
}

function userFacingRouteModelName(route: OfficialRouteRecord): string {
  return route.displayName.replace(/^官方通道\s*[·路]\s*/, '').trim() || route.displayName;
}

function toReservationMetadata(
  allocations: AiPointBucketAllocation[],
  providerJobId?: string
): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify({
    bucketAllocations: allocations,
    ...(providerJobId ? { providerJobId } : {})
  })) as Prisma.InputJsonValue;
}

function readReservationProviderJobId(metadata: Prisma.JsonValue | null | undefined): string | undefined {
  const record = readRecord(metadata);
  const providerJobId = typeof record?.providerJobId === 'string' ? record.providerJobId.trim() : '';
  return providerJobId || undefined;
}

function readReservationBucketAllocations(metadata: Prisma.JsonValue | null | undefined): AiPointBucketAllocation[] {
  const record = readRecord(metadata);
  const rawAllocations = record?.bucketAllocations;
  if (!Array.isArray(rawAllocations)) {
    return [];
  }

  return rawAllocations.flatMap((item): AiPointBucketAllocation[] => {
    const record = readRecord(item);
    const bucketId = typeof record?.bucketId === 'string' ? record.bucketId.trim() : '';
    const sourceType = readCreditBucketSourceType(record?.sourceType);
    const points = Number(record?.points);
    if (!bucketId || !sourceType || !Number.isFinite(points) || points <= 0) {
      return [];
    }

    return [
      {
        bucketId,
        sourceType,
        points: Math.trunc(points),
        expiresAt: typeof record?.expiresAt === 'string' ? record.expiresAt : undefined
      }
    ];
  });
}

function readCreditBucketSourceType(value: unknown): AiPointCreditBucketSourceType | undefined {
  if (
    value === 'SUBSCRIPTION_MONTHLY' ||
    value === 'PURCHASE_PERMANENT' ||
    value === 'ADMIN_GRANT' ||
    value === 'REFERRAL_REWARD' ||
    value === 'MIGRATED_BALANCE'
  ) {
    return value;
  }

  return undefined;
}

function compareCreditBucketsForDeduction(
  left: {
    sourceType: string;
    expiresAt: Date | null;
    createdAt: Date;
  },
  right: {
    sourceType: string;
    expiresAt: Date | null;
    createdAt: Date;
  }
): number {
  const priorityDiff = getCreditBucketDeductionPriority(left.sourceType) -
    getCreditBucketDeductionPriority(right.sourceType);
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

function getCreditBucketDeductionPriority(sourceType: string): number {
  switch (sourceType) {
    case 'SUBSCRIPTION_MONTHLY':
      return 0;
    case 'ADMIN_GRANT':
      return 1;
    case 'REFERRAL_REWARD':
      return 2;
    case 'MIGRATED_BALANCE':
      return 3;
    case 'PURCHASE_PERMANENT':
      return 4;
    default:
      return 99;
  }
}

function sanitizeOfficialProviderError(error: unknown) {
  if (
    error instanceof BadRequestException ||
    error instanceof ForbiddenException ||
    error instanceof UnauthorizedException ||
    error instanceof NotFoundException ||
    error instanceof ServiceUnavailableException
  ) {
    return error;
  }

  return new ServiceUnavailableException({
    error: {
      code: 'OFFICIAL_MODEL_ROUTE_FAILED',
      message: '官方通道调用失败，请稍后重试或切换其他线路。'
    }
  });
}

function shouldCooldownOfficialApiKey(error: unknown): boolean {
  if (!(error instanceof OfficialProviderUnavailableError)) {
    return false;
  }

  const message = readErrorMessage(error).toLowerCase();
  return [
    '429',
    'too many',
    'rate limit',
    'ratelimit',
    'concurrency',
    'busy',
    'timeout',
    'timed out',
    'aborted',
    'service unavailable',
    '503',
    'insufficient balance',
    'insufficient_balance',
    '402'
  ].some((pattern) => message.includes(pattern));
}

function officialKeyCooldownMs(error: unknown): number {
  const message = readErrorMessage(error).toLowerCase();
  if (message.includes('insufficient balance') || message.includes('insufficient_balance') || message.includes('402')) {
    return 5 * 60_000;
  }
  if (message.includes('429') || message.includes('rate limit') || message.includes('ratelimit')) {
    return 2 * 60_000;
  }
  if (message.includes('timeout') || message.includes('timed out') || message.includes('aborted')) {
    return 60_000;
  }
  return 90_000;
}

async function fetchJson(endpoint: string, init: RequestInit, label: string): Promise<{ body: unknown }> {
  let response: Response;
  try {
    response = await fetch(endpoint, init);
  } catch (error) {
    throw new OfficialProviderUnavailableError(`${label} request failed: ${readErrorMessage(error)}`);
  }

  const bodyText = await response.text();
  const body = parseJsonBody(bodyText);
  if (!response.ok) {
    throw new OfficialProviderUnavailableError(`${label} returned HTTP ${response.status}`);
  }

  return { body };
}

function buildGrsaiImagePayload(
  route: OfficialRouteRecord,
  request: OfficialInvokeRequest,
  prompt: string
): Record<string, unknown> {
  const sourceImage = request.imageGeneration?.sourceImageDataUrl?.trim();
  const aspectRatio = normalizeImageAspectRatio(request.imageGeneration?.aspectRatio)
    ?? inferAspectRatioFromSize(request.imageGeneration?.size);
  const payload: Record<string, unknown> = {
    model: route.modelName,
    prompt,
    images: sourceImage ? [sourceImage] : [],
    replyType: 'json'
  };
  const grsaiRatio = resolveGrsaiImageAspectRatio(route.modelName, aspectRatio);
  if (grsaiRatio) {
    payload.aspectRatio = grsaiRatio;
  }
  const imageSize = resolveGrsaiImageSize(route.modelName);
  if (imageSize) {
    payload.imageSize = imageSize;
  }
  return payload;
}

function buildMiniMaxVideoPayload(
  route: OfficialRouteRecord,
  request: OfficialInvokeRequest,
  prompt: string
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    model: route.modelName,
    prompt,
    prompt_optimizer: true
  };
  const sourceImage = request.videoGeneration?.sourceImageDataUrl?.trim();
  if (sourceImage) {
    payload.first_frame_image = sourceImage;
  }
  const duration = normalizeMiniMaxVideoDurationSeconds(request.videoGeneration?.durationSeconds);
  if (duration) {
    payload.duration = duration;
  }
  return payload;
}

async function queryGrsaiResult(input: {
  apiBaseUrl: string;
  apiKey: string;
  providerJobId: string;
  timeoutMs: number;
}): Promise<{ remoteUrl?: string; providerStatus?: string }> {
  const response = await fetchJson(
    `${input.apiBaseUrl}/api/result?id=${encodeURIComponent(input.providerJobId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${input.apiKey}`
      },
      signal: AbortSignal.timeout(Math.min(pollRequestTimeoutMs, input.timeoutMs))
    },
    'Official image route result'
  );
  const status = readProviderStatus(response.body);
  if (isFailedStatus(status)) {
    throw new OfficialProviderUnavailableError('Official image route task failed.');
  }
  const remoteUrl = readMediaUrlFromUnknown(response.body, 'image');
  return { remoteUrl, providerStatus: status };
}

async function pollGrsaiResult(input: {
  apiBaseUrl: string;
  apiKey: string;
  providerJobId: string;
  timeoutMs: number;
  startedAt: number;
}): Promise<{ remoteUrl: string; providerStatus?: string }> {
  let intervalMs = grsaiPollInitialIntervalMs;
  let lastStatus: string | undefined;
  while (Date.now() - input.startedAt < input.timeoutMs) {
    await sleep(intervalMs);
    const result = await queryGrsaiResult({
      apiBaseUrl: input.apiBaseUrl,
      apiKey: input.apiKey,
      providerJobId: input.providerJobId,
      timeoutMs: Math.max(1, input.timeoutMs - (Date.now() - input.startedAt))
    });
    lastStatus = result.providerStatus ?? lastStatus;
    if (result.remoteUrl && (!lastStatus || !isPendingStatus(lastStatus))) {
      return { remoteUrl: result.remoteUrl, providerStatus: lastStatus };
    }
    intervalMs = Math.min(pollMaxIntervalMs, Math.ceil(intervalMs * 1.5));
  }

  throw new OfficialProviderUnavailableError('Official image route timed out.');
}

async function pollMiniMaxResult(input: {
  apiBaseUrl: string;
  apiKey: string;
  providerJobId: string;
  timeoutMs: number;
  startedAt: number;
}): Promise<{ remoteUrl: string; providerStatus?: string }> {
  let intervalMs = minimaxPollInitialIntervalMs;
  let lastStatus: string | undefined;
  while (Date.now() - input.startedAt < input.timeoutMs) {
    await sleep(intervalMs);
    const remainingMs = Math.max(1, input.timeoutMs - (Date.now() - input.startedAt));
    const response = await fetchJson(
      `${input.apiBaseUrl}/query/video_generation?task_id=${encodeURIComponent(input.providerJobId)}`,
      {
        method: 'GET',
        headers: {
          authorization: `Bearer ${input.apiKey}`
        },
        signal: AbortSignal.timeout(Math.min(pollRequestTimeoutMs, remainingMs))
      },
      'Official video route result'
    );
    const providerError = readMiniMaxProviderError(response.body);
    if (providerError) {
      throw new OfficialProviderUnavailableError('Official video route task failed.');
    }
    lastStatus = readProviderStatus(response.body) ?? lastStatus;
    if (isFailedStatus(lastStatus)) {
      throw new OfficialProviderUnavailableError('Official video route task failed.');
    }
    const directUrl = readMediaUrlFromUnknown(response.body, 'video');
    if (directUrl && (!lastStatus || !isPendingStatus(lastStatus))) {
      return { remoteUrl: directUrl, providerStatus: lastStatus };
    }
    if (isSucceededStatus(lastStatus)) {
      const fileId = readMiniMaxFileId(response.body);
      if (!fileId) {
        throw new OfficialProviderUnavailableError('Official video route result is missing file id.');
      }
      const remoteUrl = await retrieveMiniMaxVideoUrl({
        apiBaseUrl: input.apiBaseUrl,
        apiKey: input.apiKey,
        fileId,
        timeoutMs: remainingMs
      });
      return { remoteUrl, providerStatus: lastStatus };
    }
    intervalMs = Math.min(pollMaxIntervalMs, Math.ceil(intervalMs * 1.5));
  }

  throw new OfficialProviderUnavailableError('Official video route timed out.');
}

async function retrieveMiniMaxVideoUrl(input: {
  apiBaseUrl: string;
  apiKey: string;
  fileId: string;
  timeoutMs: number;
}): Promise<string> {
  const response = await fetchJson(
    `${input.apiBaseUrl}/files/retrieve?file_id=${encodeURIComponent(input.fileId)}`,
    {
      method: 'GET',
      headers: {
        authorization: `Bearer ${input.apiKey}`
      },
      signal: AbortSignal.timeout(Math.min(pollRequestTimeoutMs, input.timeoutMs))
    },
    'Official video route file retrieve'
  );
  const url = readMediaUrlFromUnknown(response.body, 'video');
  if (!url) {
    throw new OfficialProviderUnavailableError('Official video route did not return a download URL.');
  }
  return url;
}

function generationResponse(input: {
  route: OfficialRouteRecord;
  remoteUrl: string;
  type: 'image' | 'video';
  providerJobId?: string;
  providerStatus?: string;
}): OfficialInvokeProviderResponse {
  return {
    content: JSON.stringify({ remoteUrl: input.remoteUrl }),
    artifacts: [
      {
        type: input.type,
        remoteUrl: input.remoteUrl,
        thumbnailPath: input.type === 'image' ? input.remoteUrl : undefined,
        providerJobId: input.providerJobId,
        providerStatus: input.providerStatus
      }
    ]
  };
}

function pendingGenerationResponse(input: {
  route: OfficialRouteRecord;
  type: 'image' | 'video';
  providerJobId: string;
  providerStatus?: string;
}): OfficialInvokeProviderResponse {
  return {
    content: JSON.stringify({
      pending: true,
      providerJobId: input.providerJobId,
      providerStatus: input.providerStatus
    }),
    artifacts: [
      {
        type: input.type,
        providerJobId: input.providerJobId,
        providerStatus: input.providerStatus,
        metadata: {
          pending: true
        }
      }
    ]
  };
}

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/g, '');
}

function normalizeMiniMaxApiBaseUrl(value: string): string {
  const normalized = normalizeApiBaseUrl(value);
  try {
    const url = new URL(normalized);
    let pathname = url.pathname.replace(/\/+$/g, '');
    for (const suffix of ['/query/video_generation', '/video_generation', '/files/retrieve', '/models']) {
      if (pathname.toLowerCase().endsWith(suffix)) {
        pathname = pathname.slice(0, -suffix.length).replace(/\/+$/g, '');
        break;
      }
    }
    if ((!pathname || pathname === '/') && ['api.minimaxi.com', 'api.minimax.io'].includes(url.hostname)) {
      pathname = '/v1';
    }
    url.pathname = pathname || '/';
    url.search = '';
    url.hash = '';
    return url.toString().replace(/\/+$/g, '');
  } catch {
    return normalized;
  }
}

function normalizeImageAspectRatio(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, '');
  return normalized && /^\d+:\d+$/.test(normalized) ? normalized : undefined;
}

function inferAspectRatioFromSize(value: string | undefined): string | undefined {
  const match = value?.trim().match(/^(\d+)x(\d+)$/i);
  if (!match) {
    return undefined;
  }
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return undefined;
  }
  const divisor = greatestCommonDivisor(width, height);
  return `${width / divisor}:${height / divisor}`;
}

function resolveGrsaiImageAspectRatio(modelName: string, aspectRatio: string | undefined): string | undefined {
  if (!aspectRatio) {
    return undefined;
  }
  if (!modelName.trim().toLowerCase().includes('gpt-image-2')) {
    return aspectRatio;
  }
  const pixelSizeByRatio: Record<string, string> = {
    '1:1': '1024x1024',
    '16:9': '1672x941',
    '9:16': '941x1672',
    '4:3': '1443x1090',
    '3:4': '1090x1443',
    '3:2': '1536x1024',
    '2:3': '1024x1536',
    '5:4': '1408x1120',
    '4:5': '1120x1408',
    '21:9': '1920x832',
    '9:21': '832x1920',
    '1:2': '896x1792',
    '2:1': '1792x896'
  };
  return pixelSizeByRatio[aspectRatio] ?? aspectRatio;
}

function resolveGrsaiImageSize(modelName: string): '1K' | '2K' | '4K' | undefined {
  const normalized = modelName.trim().toLowerCase();
  if (!normalized.includes('nano-banana-2')) {
    return undefined;
  }
  if (normalized.includes('4k')) {
    return '4K';
  }
  if (normalized.includes('2k')) {
    return '2K';
  }
  return '1K';
}

function normalizeMiniMaxVideoDurationSeconds(value: number | undefined): number | undefined {
  if (!Number.isFinite(value) || Number(value) <= 0) {
    return undefined;
  }
  const rounded = Math.round(Number(value));
  const allowedDurations = [6, 10];
  return allowedDurations.includes(rounded)
    ? rounded
    : [...allowedDurations].reverse().find((duration) => duration <= rounded) ?? allowedDurations[0];
}

function greatestCommonDivisor(left: number, right: number): number {
  let a = Math.abs(left);
  let b = Math.abs(right);
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a || 1;
}

function readProviderMode(value: unknown): string {
  return isRecord(value) && typeof value.mode === 'string' ? value.mode : '';
}

function lastUserMessageContent(messages: OfficialMessage[]): string {
  return [...messages].reverse().find((message) => message.role === 'user')?.content.trim() ?? '';
}

function readAssistantContent(value: unknown): string | undefined {
  const record = readRecord(value);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  for (const choice of choices) {
    const choiceRecord = readRecord(choice);
    const message = readRecord(choiceRecord?.message);
    const content = typeof message?.content === 'string' ? message.content.trim() : '';
    if (content) {
      return content;
    }
    const text = typeof choiceRecord?.text === 'string' ? choiceRecord.text.trim() : '';
    if (text) {
      return text;
    }
  }
  for (const key of ['output_text', 'text', 'content']) {
    const text = typeof record?.[key] === 'string' ? record[key].trim() : '';
    if (text) {
      return text;
    }
  }
  return undefined;
}

function readTokenCount(value: unknown, key: string): number | undefined {
  const record = readRecord(value);
  const numberValue = Number(record?.[key]);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue) : undefined;
}

function readProviderJobId(value: unknown): string | undefined {
  const record = readRecord(value);
  for (const key of ['id', 'task_id', 'taskId', 'job_id', 'jobId']) {
    const id = typeof record?.[key] === 'string' ? record[key].trim() : '';
    if (id) {
      return id;
    }
  }
  const data = readRecord(record?.data);
  for (const key of ['id', 'task_id', 'taskId', 'job_id', 'jobId']) {
    const id = typeof data?.[key] === 'string' ? data[key].trim() : '';
    if (id) {
      return id;
    }
  }
  return undefined;
}

function readMiniMaxFileId(value: unknown): string | undefined {
  const record = readRecord(value);
  const fileId = typeof record?.file_id === 'string' ? record.file_id.trim() : '';
  if (fileId) {
    return fileId;
  }
  const file = readRecord(record?.file);
  return typeof file?.file_id === 'string' && file.file_id.trim() ? file.file_id.trim() : undefined;
}

function readProviderStatus(value: unknown): string | undefined {
  const record = readRecord(value);
  for (const key of ['status', 'task_status', 'taskStatus', 'state']) {
    const status = typeof record?.[key] === 'string' ? record[key].trim() : '';
    if (status) {
      return status;
    }
  }
  const data = readRecord(record?.data);
  for (const key of ['status', 'task_status', 'taskStatus', 'state']) {
    const status = typeof data?.[key] === 'string' ? data[key].trim() : '';
    if (status) {
      return status;
    }
  }
  return undefined;
}

function readMiniMaxProviderError(value: unknown): string | undefined {
  const record = readRecord(value);
  const baseResp = readRecord(record?.base_resp);
  const statusCode = Number(baseResp?.status_code);
  if (Number.isFinite(statusCode) && statusCode !== 0) {
    return typeof baseResp?.status_msg === 'string' ? baseResp.status_msg : `status_code=${statusCode}`;
  }
  return undefined;
}

function readMediaUrlFromUnknown(value: unknown, type: 'image' | 'video', depth = 0): string | undefined {
  if (depth > 6 || value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^https?:\/\//i.test(normalized) && looksLikeMediaUrl(normalized, type)) {
      return normalized;
    }
    return undefined;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const url = readMediaUrlFromUnknown(item, type, depth + 1);
      if (url) {
        return url;
      }
    }
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const preferredKeys = type === 'image'
    ? ['url', 'image_url', 'imageUrl', 'output_url', 'outputUrl']
    : ['url', 'video_url', 'videoUrl', 'download_url', 'downloadUrl', 'file_url', 'fileUrl'];
  for (const key of preferredKeys) {
    const url = readMediaUrlFromUnknown(value[key], type, depth + 1);
    if (url) {
      return url;
    }
  }
  for (const item of Object.values(value)) {
    const url = readMediaUrlFromUnknown(item, type, depth + 1);
    if (url) {
      return url;
    }
  }
  return undefined;
}

function looksLikeMediaUrl(value: string, type: 'image' | 'video'): boolean {
  if (type === 'image') {
    return /\.(png|jpe?g|webp|gif)(\?|#|$)/i.test(value) || /image|img|file|aitohumanize/i.test(value);
  }
  return /\.(mp4|mov|webm|m4v)(\?|#|$)/i.test(value) || /video|file|minimax/i.test(value);
}

function isPendingStatus(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && ['pending', 'queued', 'running', 'processing', 'in_progress', 'submitted', 'preparing'].includes(normalized));
}

function isSucceededStatus(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && ['success', 'succeeded', 'completed', 'complete', 'done', 'finished'].includes(normalized));
}

function isFailedStatus(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return Boolean(normalized && ['failed', 'fail', 'error', 'cancelled', 'canceled', 'rejected'].includes(normalized));
}

function parseJsonBody(bodyText: string): unknown {
  try {
    return JSON.parse(bodyText);
  } catch {
    return undefined;
  }
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
