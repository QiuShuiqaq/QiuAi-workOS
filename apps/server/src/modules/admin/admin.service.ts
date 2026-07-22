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
import type { BillingCycle, PlanCode, Prisma, WorkspaceMemberRole } from '@prisma/client';

import { hashPassword } from '../../shared/auth/password-hash';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import {
  createDesktopBindingCode,
  hashDesktopToken,
  normalizeDesktopBindingCode
} from '../desktop-sync/desktop-auth-token';
import { buildInvitationUrl, createInvitationToken, hashInvitationToken } from '../invitation/invitation-token';
import type { CurrentAccountResponseDto } from '../workspace/dto/current-account-response.dto';
import {
  AdminPlanDetailDto,
  AdminWorkspaceDetailDto,
  AdminWorkspaceInvitationSummaryDto,
  AdminWorkspaceSummaryDto,
  CancelAdminWorkspaceInvitationResponseDto,
  CreateAdminDesktopBindingCodeRequestDto,
  CreateAdminDesktopBindingCodeResponseDto,
  CreateAdminWorkspaceInvitationRequestDto,
  CreateAdminWorkspaceInvitationResponseDto,
  CreateAdminWorkspaceRequestDto,
  CreateAdminWorkspaceResponseDto,
  GetAdminWorkspaceResponseDto,
  GrantAdminWorkspaceAuthorizationRequestDto,
  GrantAdminWorkspaceAuthorizationResponseDto,
  ListAdminActionLogsQueryDto,
  ListAdminActionLogsResponseDto,
  ListAdminPlansResponseDto,
  ListAdminWorkspacesQueryDto,
  ListAdminWorkspacesResponseDto,
  RevokeAdminDesktopDeviceResponseDto,
  UpdateAdminWorkspaceStatusRequestDto,
  UpdateAdminWorkspaceStatusResponseDto,
  UpdateAdminPlanRequestDto,
  UpdateAdminPlanResponseDto
} from './dto/admin-console.dto';

const PLAN_DISPLAY_ORDER = [
  'PERSONAL_FREE',
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
    status: string;
    expiresAt: Date;
    createdAt: Date;
    redeemedAt: Date | null;
  }>;
};

@Injectable()
export class AdminService {
  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

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

  async listWorkspaces(
    query: ListAdminWorkspacesQueryDto,
    cookieHeader?: string
  ): Promise<ListAdminWorkspacesResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    this.requireDatabaseMode();

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWorkspaceWhere(query.query);

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

    return {
      data: workspaces.map((workspace) => this.toAdminWorkspaceSummary(workspace)),
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

    const bindingCode = createDesktopBindingCode();
    const expiresAt = new Date(Date.now() + (input.expiresInMinutes ?? 10) * 60 * 1000);
    const created = await this.prismaService.$transaction(async (tx) => {
      const binding = await tx.desktopBindingCode.create({
        data: {
          workspaceId,
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
          expiresAt: expiresAt.toISOString()
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

  private buildWorkspaceWhere(query?: string): Prisma.WorkspaceWhereInput {
    const value = query?.trim();
    if (!value) {
      return {};
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

    return {
      OR: search
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

  private workspaceSummaryInclude() {
    return {
      tenant: true,
      ownerAccount: true,
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

    const summary = this.toAdminWorkspaceSummary(workspace);
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

  private toAdminWorkspaceSummary(workspace: WorkspaceSummaryRecord): AdminWorkspaceSummaryDto {
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
      updatedAt: workspace.updatedAt.toISOString()
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
    status: string;
    expiresAt: Date;
    createdAt: Date;
    redeemedAt: Date | null;
  }) {
    return {
      id: bindingCode.id,
      workspaceId: bindingCode.workspaceId,
      status: this.toDesktopBindingCodeStatus(bindingCode.status),
      expiresAt: bindingCode.expiresAt.toISOString(),
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

  private async recordAdminAction(
    tx: Prisma.TransactionClient,
    input: {
      operatorAccountId: string;
      action: string;
      targetType: string;
      targetId: string;
      summary: string;
      metadata?: Record<string, unknown>;
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

  private workspaceNotFound(workspaceId: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Workspace was not found.',
        details: { workspaceId }
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
