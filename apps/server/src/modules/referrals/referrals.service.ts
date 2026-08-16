import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma, type SubscriptionStatus } from '@prisma/client';

import { readCookie, WORKOS_SESSION_COOKIE_NAME } from '../../shared/auth/session-cookie';
import { hashDesktopToken } from '../desktop-sync/desktop-auth-token';
import { AuthService } from '../auth/auth.service';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { ValidateReferralCodeRequestDto } from './dto/validate-referral-code-request.dto';
import {
  GetReferralOverviewResponseDto,
  ReferralOverviewDto,
  ReferralRewardPolicyDto,
  ValidateReferralCodeResponseDto
} from './dto/referral-response.dto';

const referralRewardPolicy: ReferralRewardPolicyDto = {
  inviteeRewardPoints: 300,
  inviterRewardPoints: 500,
  rewardExpiresInDays: 90
};

type ReferralWorkspaceContext = {
  workspaceId: string;
  accountId: string;
  planCode: string;
  subscriptionStatus?: SubscriptionStatus | string;
  currentPeriodEnd?: Date | null;
};

type ReferralCodeRecord = {
  id: string;
  ownerAccountId: string;
  ownerWorkspaceId: string;
  code: string;
  status: string;
  ownerWorkspace: {
    subscriptions: Array<{
      status: SubscriptionStatus | string;
      currentPeriodEnd: Date | null;
      plan: {
        code: string;
      };
    }>;
  };
};

@Injectable()
export class ReferralsService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async getMyReferralOverview(
    workspaceId: string,
    deviceToken?: string,
    cookieHeader?: string
  ): Promise<GetReferralOverviewResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      if (!deviceToken) {
        await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);
      }
      return {
        data: this.buildMockOverview(workspaceId)
      };
    }

    const context = await this.requireWorkspaceContext(workspaceId, deviceToken, cookieHeader);
    const accountStatus = this.resolveAccountPlanStatus(context);
    const canInvite = accountStatus === 'member';
    const referralCode = canInvite ? await this.ensureReferralCode(context.accountId, context.workspaceId) : undefined;
    const stats = canInvite
      ? await this.loadReferralStats(context.accountId)
      : { invitedPaidCount: 0, earnedPoints: 0 };

    return {
      data: {
        workspaceId,
        accountStatus,
        canInvite,
        referralCode,
        invitedPaidCount: stats.invitedPaidCount,
        earnedPoints: stats.earnedPoints,
        policy: referralRewardPolicy
      }
    };
  }

  async validateReferralCode(
    workspaceId: string,
    input: ValidateReferralCodeRequestDto,
    cookieHeader?: string
  ): Promise<ValidateReferralCodeResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);
      return this.invalidValidation('当前服务未启用在线账号，暂不能使用邀请码。');
    }

    const context = await this.requireWorkspaceContext(workspaceId, undefined, cookieHeader);
    const result = await this.validateReferralCodeForInvitee(input.referralCode, context);
    return result.ok
      ? {
          data: {
            valid: true,
            message: '邀请码有效，开通会员后双方可获得 AI 点数。',
            policy: referralRewardPolicy
          }
        }
      : this.invalidValidation(result.message);
  }

  async createPendingInviteForOrder(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      billingOrderId: string;
      planCode: string;
      referralCode?: string;
    }
  ): Promise<void> {
    const normalizedCode = normalizeReferralCode(input.referralCode);
    if (!normalizedCode || !isPersonalMemberPlanCode(input.planCode)) {
      return;
    }

    const workspace = await tx.workspace.findUnique({
      where: { id: input.workspaceId },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId: input.workspaceId }
        }
      });
    }

    const inviteeContext: ReferralWorkspaceContext = {
      workspaceId: workspace.id,
      accountId: workspace.ownerAccountId,
      planCode: workspace.subscriptions[0]?.plan.code ?? 'PERSONAL_FREE',
      subscriptionStatus: workspace.subscriptions[0]?.status,
      currentPeriodEnd: workspace.subscriptions[0]?.currentPeriodEnd
    };
    const validation = await this.validateReferralCodeForInviteeInTransaction(tx, normalizedCode, inviteeContext);
    if (!validation.ok || !validation.code) {
      throw new BadRequestException({
        error: {
          code: 'REFERRAL_CODE_INVALID',
          message: validation.message
        }
      });
    }

    await tx.referralInvite.create({
      data: {
        referralCodeId: validation.code.id,
        inviterAccountId: validation.code.ownerAccountId,
        inviterWorkspaceId: validation.code.ownerWorkspaceId,
        inviteeAccountId: inviteeContext.accountId,
        inviteeWorkspaceId: inviteeContext.workspaceId,
        billingOrderId: input.billingOrderId,
        status: 'PENDING',
        inviteeRewardPoints: referralRewardPolicy.inviteeRewardPoints,
        inviterRewardPoints: referralRewardPolicy.inviterRewardPoints,
        metadata: {
          source: 'member-billing-order',
          referralCode: normalizedCode
        }
      }
    });
  }

  async grantRewardsForPaidOrder(
    tx: Prisma.TransactionClient,
    input: {
      billingOrderId: string;
      paidAt: Date;
    }
  ): Promise<void> {
    const invite = await tx.referralInvite.findUnique({
      where: {
        billingOrderId: input.billingOrderId
      }
    });
    if (!invite || invite.status === 'REWARDED' || invite.status === 'REJECTED') {
      return;
    }

    const alreadyRewarded = await tx.referralInvite.findFirst({
      where: {
        inviteeAccountId: invite.inviteeAccountId,
        status: 'REWARDED',
        id: {
          not: invite.id
        }
      },
      select: {
        id: true
      }
    });
    if (alreadyRewarded) {
      await tx.referralInvite.update({
        where: { id: invite.id },
        data: {
          status: 'REJECTED',
          rejectedAt: input.paidAt,
          paidAt: input.paidAt,
          metadata: {
            ...toJsonObject(invite.metadata),
            rejectReason: 'invitee_already_rewarded'
          }
        }
      });
      return;
    }

    await this.grantReferralPoints(tx, {
      workspaceId: invite.inviteeWorkspaceId,
      points: invite.inviteeRewardPoints,
      billingOrderId: input.billingOrderId,
      referralInviteId: invite.id,
      rewardRole: 'invitee',
      description: '会员邀请码奖励'
    });
    await this.grantReferralPoints(tx, {
      workspaceId: invite.inviterWorkspaceId,
      points: invite.inviterRewardPoints,
      billingOrderId: input.billingOrderId,
      referralInviteId: invite.id,
      rewardRole: 'inviter',
      description: '会员邀请奖励'
    });

    await tx.referralInvite.update({
      where: { id: invite.id },
      data: {
        status: 'REWARDED',
        paidAt: input.paidAt,
        rewardedAt: input.paidAt
      }
    });
  }

  private async requireWorkspaceContext(
    workspaceId: string,
    deviceToken?: string,
    cookieHeader?: string
  ): Promise<ReferralWorkspaceContext> {
    if (deviceToken) {
      return this.requireDesktopWorkspaceContext(workspaceId, deviceToken);
    }

    const sessionToken = readCookie(cookieHeader, WORKOS_SESSION_COOKIE_NAME);
    if (!sessionToken) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.'
        }
      });
    }

    const currentAccount = await this.authService.requireWorkspaceAccess(workspaceId, cookieHeader);
    const workspace = await this.prismaService.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        subscriptions: {
          include: {
            plan: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 1
        }
      }
    });
    if (!workspace) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Workspace was not found.',
          details: { workspaceId }
        }
      });
    }

    return {
      workspaceId: workspace.id,
      accountId: currentAccount.account.id,
      planCode: workspace.subscriptions[0]?.plan.code ?? 'PERSONAL_FREE',
      subscriptionStatus: workspace.subscriptions[0]?.status,
      currentPeriodEnd: workspace.subscriptions[0]?.currentPeriodEnd
    };
  }

  private async requireDesktopWorkspaceContext(
    workspaceId: string,
    deviceToken: string
  ): Promise<ReferralWorkspaceContext> {
    const device = await this.prismaService.desktopDevice.findUnique({
      where: {
        tokenHash: hashDesktopToken(deviceToken)
      },
      include: {
        workspace: {
          include: {
            subscriptions: {
              include: {
                plan: true
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
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
      workspaceId: device.workspace.id,
      accountId: device.workspace.ownerAccountId,
      planCode: device.workspace.subscriptions[0]?.plan.code ?? 'PERSONAL_FREE',
      subscriptionStatus: device.workspace.subscriptions[0]?.status,
      currentPeriodEnd: device.workspace.subscriptions[0]?.currentPeriodEnd
    };
  }

  private async ensureReferralCode(accountId: string, workspaceId: string): Promise<string> {
    const existing = await this.prismaService.referralCode.findUnique({
      where: {
        ownerAccountId: accountId
      }
    });
    if (existing) {
      if (existing.status === 'DISABLED') {
        return existing.code;
      }
      return existing.code;
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = createReferralCode();
      try {
        const created = await this.prismaService.referralCode.create({
          data: {
            ownerAccountId: accountId,
            ownerWorkspaceId: workspaceId,
            code,
            status: 'ACTIVE'
          }
        });
        return created.code;
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }
      }
    }

    throw new BadRequestException({
      error: {
        code: 'REFERRAL_CODE_CREATE_FAILED',
        message: '邀请码生成失败，请稍后重试。'
      }
    });
  }

  private async loadReferralStats(accountId: string): Promise<{ invitedPaidCount: number; earnedPoints: number }> {
    const invites = await this.prismaService.referralInvite.findMany({
      where: {
        inviterAccountId: accountId,
        status: 'REWARDED'
      },
      select: {
        inviterRewardPoints: true
      }
    });
    return {
      invitedPaidCount: invites.length,
      earnedPoints: invites.reduce((sum, invite) => sum + Math.max(0, invite.inviterRewardPoints), 0)
    };
  }

  private async validateReferralCodeForInvitee(
    referralCode: string | undefined,
    inviteeContext: ReferralWorkspaceContext
  ): Promise<{ ok: boolean; message: string; code?: ReferralCodeRecord }> {
    return this.validateReferralCodeForInviteeInTransaction(
      this.prismaService,
      normalizeReferralCode(referralCode),
      inviteeContext
    );
  }

  private async validateReferralCodeForInviteeInTransaction(
    tx: Prisma.TransactionClient | PrismaService,
    referralCode: string,
    inviteeContext: ReferralWorkspaceContext
  ): Promise<{ ok: boolean; message: string; code?: ReferralCodeRecord }> {
    if (!referralCode) {
      return {
        ok: false,
        message: '请输入邀请码。'
      };
    }

    if (this.resolveAccountPlanStatus(inviteeContext) === 'enterprise') {
      return {
        ok: false,
        message: '企业版账号不参与会员邀请奖励。'
      };
    }

    if (this.resolveAccountPlanStatus(inviteeContext) === 'member') {
      return {
        ok: false,
        message: '当前账号已经是会员版，不能重复使用邀请码。'
      };
    }

    const code = await tx.referralCode.findUnique({
      where: { code: referralCode },
      include: {
        ownerWorkspace: {
          include: {
            subscriptions: {
              include: {
                plan: true
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 1
            }
          }
        }
      }
    });
    if (!code || code.status !== 'ACTIVE') {
      return {
        ok: false,
        message: '邀请码无效或暂不可用。'
      };
    }

    if (code.ownerAccountId === inviteeContext.accountId) {
      return {
        ok: false,
        message: '不能使用自己的邀请码。'
      };
    }

    const inviterSubscription = code.ownerWorkspace.subscriptions[0];
    if (
      !inviterSubscription ||
      !isActivePersonalMemberSubscription({
        planCode: inviterSubscription.plan.code,
        status: inviterSubscription.status,
        currentPeriodEnd: inviterSubscription.currentPeriodEnd
      })
    ) {
      return {
        ok: false,
        message: '邀请人当前不是有效会员，邀请码暂不可用。'
      };
    }

    const existingRewardedInvite = await tx.referralInvite.findFirst({
      where: {
        inviteeAccountId: inviteeContext.accountId,
        status: 'REWARDED'
      },
      select: {
        id: true
      }
    });
    if (existingRewardedInvite) {
      return {
        ok: false,
        message: '当前账号已经使用过邀请码奖励。'
      };
    }

    return {
      ok: true,
      message: '邀请码有效，开通会员后双方可获得 AI 点数。',
      code
    };
  }

  private async grantReferralPoints(
    tx: Prisma.TransactionClient,
    input: {
      workspaceId: string;
      points: number;
      billingOrderId: string;
      referralInviteId: string;
      rewardRole: 'invitee' | 'inviter';
      description: string;
    }
  ): Promise<void> {
    if (input.points <= 0) {
      return;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + referralRewardPolicy.rewardExpiresInDays * 24 * 60 * 60 * 1000);
    const creditBucket = await tx.aiPointCreditBucket.createMany({
      data: {
        workspaceId: input.workspaceId,
        sourceType: 'REFERRAL_REWARD',
        billingOrderId: input.billingOrderId,
        idempotencyKey: `referral:${input.referralInviteId}:${input.rewardRole}`,
        totalPoints: input.points,
        availablePoints: input.points,
        reservedPoints: 0,
        startsAt: now,
        expiresAt,
        status: 'ACTIVE',
        metadata: {
          source: 'member-referral',
          referralInviteId: input.referralInviteId,
          rewardRole: input.rewardRole
        }
      },
      skipDuplicates: true
    });
    if (creditBucket.count === 0) {
      return;
    }

    const wallet = await tx.aiPointWallet.upsert({
      where: { workspaceId: input.workspaceId },
      update: {
        balancePoints: {
          increment: input.points
        }
      },
      create: {
        workspaceId: input.workspaceId,
        balancePoints: input.points,
        reservedPoints: 0
      }
    });

    await tx.aiPointLedgerEntry.create({
      data: {
        workspaceId: input.workspaceId,
        type: 'GRANT',
        status: 'COMPLETED',
        points: input.points,
        balanceAfter: wallet.balancePoints - wallet.reservedPoints,
        description: input.description,
        metadata: {
          source: 'member-referral',
          billingOrderId: input.billingOrderId,
          referralInviteId: input.referralInviteId,
          rewardRole: input.rewardRole,
          expiresAt: expiresAt.toISOString()
        }
      }
    });
  }

  private resolveAccountPlanStatus(
    context: Pick<ReferralWorkspaceContext, 'planCode' | 'subscriptionStatus' | 'currentPeriodEnd'>
  ): ReferralOverviewDto['accountStatus'] {
    if (isEnterprisePlanCode(context.planCode)) {
      return 'enterprise';
    }
    if (isActivePersonalMemberSubscription(context)) {
      return 'member';
    }
    return 'free';
  }

  private invalidValidation(message: string): ValidateReferralCodeResponseDto {
    return {
      data: {
        valid: false,
        message,
        policy: referralRewardPolicy
      }
    };
  }

  private buildMockOverview(workspaceId: string): ReferralOverviewDto {
    const planCode = this.store.getPlan(workspaceId)?.code ?? 'PERSONAL_FREE';
    const accountStatus = isEnterprisePlanCode(planCode)
      ? 'enterprise'
      : isPersonalMemberPlanCode(planCode)
        ? 'member'
        : 'free';
    return {
      workspaceId,
      accountStatus,
      canInvite: accountStatus === 'member',
      referralCode: accountStatus === 'member' ? 'QIUAI-DEMO' : undefined,
      invitedPaidCount: 0,
      earnedPoints: 0,
      policy: referralRewardPolicy
    };
  }
}

function normalizeReferralCode(value: string | undefined): string {
  return value?.trim().replace(/\s+/g, '').toUpperCase() ?? '';
}

function createReferralCode(): string {
  return `QIUAI${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function isPersonalMemberPlanCode(planCode: string | undefined): boolean {
  return planCode === 'PERSONAL_MEMBER_MONTHLY' || planCode === 'PERSONAL_MEMBER_ANNUAL';
}

function isEnterprisePlanCode(planCode: string | undefined): boolean {
  return Boolean(planCode?.startsWith('ENTERPRISE_'));
}

function isActivePersonalMemberSubscription(input: {
  planCode?: string;
  status?: SubscriptionStatus | string;
  currentPeriodEnd?: Date | null;
}): boolean {
  if (!isPersonalMemberPlanCode(input.planCode)) {
    return false;
  }
  if (input.status && input.status !== 'ACTIVE' && input.status !== 'TRIALING') {
    return false;
  }
  return !input.currentPeriodEnd || input.currentPeriodEnd.getTime() > Date.now();
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function toJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
