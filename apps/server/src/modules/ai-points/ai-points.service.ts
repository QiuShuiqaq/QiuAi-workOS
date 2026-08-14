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
const defaultTextTimeoutMs = 45_000;
const defaultImageTimeoutMs = 1_800_000;
const defaultVideoTimeoutMs = 1_800_000;
const grsaiSubmitTimeoutMs = 120_000;
const pollRequestTimeoutMs = 30_000;
const grsaiPollInitialIntervalMs = 3_000;
const pollMaxIntervalMs = 20_000;
const minimaxSubmitTimeoutMs = 30_000;
const minimaxPollInitialIntervalMs = 8_000;

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

    const wallet = await this.ensureWallet(workspaceId);
    const [ledgerEntries, quota] = await Promise.all([
      this.prismaService.aiPointLedgerEntry.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        take: 20
      }),
      device ? this.ensureDeviceQuota(device) : undefined
    ]);

    return {
      data: {
        wallet: isLocalDevelopmentUnlimitedEnabled()
          ? this.buildMockWallet(workspaceId)
          : toWalletSummary(wallet),
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
      try {
        const providerResponse = await this.invokeProvider(route, request);
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
      } catch (error) {
        this.logger.error(
          `Official model route poll failed: route=${route.routeKey}, provider=${route.providerId}, model=${route.modelName}`,
          error instanceof Error ? error.stack : String(error)
        );
        throw sanitizeOfficialProviderError(error);
      }
    }

    const reservedPoints = Math.max(1, route.pointPrice);
    const reservation = await this.reservePoints({
      workspaceId,
      desktopDeviceId: device.id,
      routeKey: route.routeKey,
      points: reservedPoints
    });

    try {
      const providerResponse = await this.invokeProvider(route, request);
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
          description: 'Official model route point reservation.'
        }
      });
      return { id: entry.id };
    });
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
      const wallet = await tx.aiPointWallet.update({
        where: { workspaceId: input.workspaceId },
        data: {
          balancePoints: {
            decrement: input.points
          },
          reservedPoints: {
            decrement: input.points
          }
        }
      });
      await tx.desktopDeviceAiQuota.update({
        where: { desktopDeviceId: input.desktopDeviceId },
        data: {
          usedPointsThisMonth: {
            increment: input.points
          },
          reservedPoints: {
            decrement: input.points
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
          points: -input.points,
          balanceAfter: wallet.balancePoints - wallet.reservedPoints,
          description: 'Official model route point settlement.'
        }
      });
      return wallet;
    });
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
      const wallet = await tx.aiPointWallet.update({
        where: { workspaceId: input.workspaceId },
        data: {
          reservedPoints: {
            decrement: input.points
          }
        }
      });
      await tx.desktopDeviceAiQuota.update({
        where: { desktopDeviceId: input.desktopDeviceId },
        data: {
          reservedPoints: {
            decrement: input.points
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
          points: input.points,
          balanceAfter: wallet.balancePoints - wallet.reservedPoints,
          description: 'Official model route reservation released.'
        }
      });
    });
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
    request: OfficialInvokeRequest
  ): Promise<OfficialInvokeProviderResponse> {
    const apiKey = process.env[route.apiKeyEnvName]?.trim();
    if (!apiKey) {
      throw new OfficialProviderUnavailableError('Official API key is not configured.');
    }

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

function toRouteSummary(route: OfficialRouteRecord) {
  return {
    routeKey: route.routeKey,
    displayName: route.displayName,
    capability: route.capability.toLowerCase(),
    status: route.status.toLowerCase(),
    pointPrice: route.pointPrice,
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

function isOfficialResultPollRequest(request: OfficialInvokeRequest): boolean {
  return request.imageGeneration?.asyncMode === 'poll_once';
}

function userFacingRouteModelName(route: OfficialRouteRecord): string {
  return route.displayName.replace(/^官方通道\s*·\s*/, '').trim() || route.displayName;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
