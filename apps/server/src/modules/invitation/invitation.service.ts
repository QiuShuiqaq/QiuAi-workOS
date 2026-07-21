import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import type { InvitationStatus, WorkspaceMemberRole } from '@prisma/client';

import { AuthService } from '../auth/auth.service';
import { EntitlementService } from '../entitlement/entitlement.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { buildInvitationUrl, createInvitationToken, hashInvitationToken } from './invitation-token';
import { hashPassword, verifyPassword } from '../../shared/auth/password-hash';
import type { AcceptWorkspaceInvitationRequestDto } from './dto/accept-workspace-invitation-request.dto';
import type { CreateWorkspaceInvitationRequestDto } from './dto/create-workspace-invitation-request.dto';
import type {
  CancelWorkspaceInvitationResponseDto,
  CreateWorkspaceInvitationResponseDto,
  GetPublicInvitationResponseDto,
  ListWorkspaceInvitationsResponseDto,
  PublicInvitationDetailDto,
  WorkspaceInvitationSummaryDto
} from './dto/workspace-invitation-response.dto';
import type { AuthSessionResponseDto } from '../auth/dto/auth-session-response.dto';

type InvitationRecord = {
  id: string;
  workspaceId: string;
  departmentId: string | null;
  email: string;
  role: WorkspaceMemberRole;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedByAccountId: string | null;
  createdByAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
  department?: {
    name: string;
  } | null;
};

@Injectable()
export class InvitationService {
  private readonly mockTokens = new Map<string, string>();

  constructor(
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(EntitlementService)
    private readonly entitlementService: EntitlementService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async listWorkspaceInvitations(
    workspaceId: string,
    cookieHeader?: string
  ): Promise<ListWorkspaceInvitationsResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      this.assertMockInvitationAccess(workspaceId);
      this.assertMockInvitationFeature(workspaceId);
      return {
        data: this.store.listInvitations(workspaceId).map((invitation) => this.toMockSummary(workspaceId, invitation))
      };
    }

    await this.assertWorkspaceInvitationAccess(workspaceId, cookieHeader);
    await this.assertWorkspaceInvitationFeature(workspaceId);
    await this.expireDatabaseInvitations(workspaceId);

    const invitations = await this.prismaService.invitation.findMany({
      where: {
        workspaceId
      },
      include: {
        department: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return {
      data: invitations.map((invitation) => this.toDatabaseSummary(invitation))
    };
  }

  async createWorkspaceInvitation(
    workspaceId: string,
    input: CreateWorkspaceInvitationRequestDto,
    cookieHeader?: string
  ): Promise<CreateWorkspaceInvitationResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      this.assertMockInvitationAccess(workspaceId);
      this.assertMockInvitationFeature(workspaceId);
      const created = this.store.createInvitation(workspaceId, {
        email: input.email,
        systemRole: input.systemRole ?? 'member',
        departmentId: input.departmentId,
        expiresInDays: input.expiresInDays ?? 7
      });
      if (!created) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Workspace was not found.',
            details: { workspaceId }
          }
        });
      }

      const token = createInvitationToken();
      this.mockTokens.set(token, created.id);

      return {
        data: this.toMockSummary(workspaceId, created),
        inviteUrl: buildInvitationUrl(token)
      };
    }

    const access = await this.assertWorkspaceInvitationAccess(workspaceId, cookieHeader);
    await this.assertWorkspaceInvitationFeature(workspaceId);

    await this.expireDatabaseInvitations(workspaceId);

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        memberships: true
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

    const memberCount = workspace.memberships.length;
    const pendingCount = await this.prismaService.invitation.count({
      where: {
        workspaceId,
        status: 'PENDING'
      }
    });
    await this.entitlementService.requireAllowed(
      {
        workspaceId,
        featureKey: 'maxMembers',
        requestedAmount: memberCount + pendingCount + 1
      },
      'Member invitations exceed the current plan limit.'
    );

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

    const token = createInvitationToken();
    const tokenHash = hashInvitationToken(token);
    const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 7) * 24 * 60 * 60 * 1000);

    const invitation = await this.prismaService.invitation.create({
      data: {
        workspaceId,
        departmentId: department?.id ?? null,
        email: normalizedEmail,
        role: this.toMemberRole(input.systemRole ?? 'member'),
        tokenHash,
        status: 'PENDING',
        expiresAt,
        createdByAccountId: access.accountId
      },
      include: {
        department: true
      }
    });

    return {
      data: this.toDatabaseSummary(invitation),
      inviteUrl: buildInvitationUrl(token)
    };
  }

  async cancelWorkspaceInvitation(
    workspaceId: string,
    invitationId: string,
    cookieHeader?: string
  ): Promise<CancelWorkspaceInvitationResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      this.assertMockInvitationAccess(workspaceId);
      this.assertMockInvitationFeature(workspaceId);
      const invitation = this.store.cancelInvitation(workspaceId, invitationId);
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

      return {
        data: this.toMockSummary(workspaceId, invitation)
      };
    }

    await this.assertWorkspaceInvitationAccess(workspaceId, cookieHeader);
    const invitation = await this.prismaService.invitation.findFirst({
      where: {
        id: invitationId,
        workspaceId
      },
      include: {
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

    const cancelled = await this.prismaService.invitation.update({
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

    return {
      data: this.toDatabaseSummary(cancelled)
    };
  }

  async getPublicInvitation(token: string): Promise<GetPublicInvitationResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      const invitation = this.store.getInvitationByToken(this.mockTokens.get(token) ?? token);
      if (!invitation) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Invitation was not found.',
            details: { token }
          }
        });
      }

      return {
        data: this.toMockDetail(invitation.workspaceId, invitation)
      };
    }

    await this.expireDatabaseInvitationByToken(token);
    const invitation = await this.loadDatabaseInvitationByToken(token);
    if (!invitation) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Invitation was not found.',
          details: { token }
        }
      });
    }

    return {
      data: this.toPublicDetail(invitation)
    };
  }

  async acceptWorkspaceInvitation(
    token: string,
    input: AcceptWorkspaceInvitationRequestDto,
    requestMeta?: { userAgent?: string; ipAddress?: string }
  ): Promise<{ sessionToken: string; maxAgeSeconds: number; response: AuthSessionResponseDto }> {
    if (!isDatabasePersistenceEnabled()) {
      const invitationId = this.mockTokens.get(token) ?? token;
      const invitation = this.store.acceptInvitationByToken(invitationId);
      if (!invitation) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Invitation was not found.',
            details: { token }
          }
        });
      }

      return this.authService.login(
        {
          email: invitation.email,
          password: input.password,
          rememberMe: input.rememberMe
        },
        requestMeta
      );
    }

    const invitation = await this.expireDatabaseInvitationByToken(token);
    if (!invitation || invitation.status !== 'PENDING') {
      throw new ConflictException({
        error: {
          code: 'CONFLICT',
          message: 'Invitation is no longer available.',
          details: { token }
        }
      });
    }

    const normalizedEmail = this.normalizeEmail(invitation.email);
    await this.prismaService.$transaction(async (tx) => {
      const account = await tx.account.findUnique({
        where: {
          primaryEmail: normalizedEmail
        }
      });

      let accountId: string;
      if (account) {
        if (account.status !== 'ACTIVE') {
          throw new ForbiddenException({
            error: {
              code: 'FORBIDDEN',
              message: 'This account is disabled.'
            }
          });
        }

        if (account.passwordHash && !verifyPassword(input.password, account.passwordHash)) {
          throw new UnauthorizedException({
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Invalid email or password.'
            }
          });
        }

        if (!account.passwordHash) {
          const updatedAccount = await tx.account.update({
            where: {
              id: account.id
            },
            data: {
              passwordHash: hashPassword(input.password)
            }
          });
          accountId = updatedAccount.id;
        } else {
          accountId = account.id;
        }
      } else {
        const createdAccount = await tx.account.create({
          data: {
            primaryEmail: normalizedEmail,
            status: 'ACTIVE',
            passwordHash: hashPassword(input.password)
          }
        });
        accountId = createdAccount.id;
      }

      const existingMember = await tx.workspaceMember.findFirst({
        where: {
          workspaceId: invitation.workspaceId,
          accountId
        }
      });

      if (!existingMember) {
        await tx.workspaceMember.create({
          data: {
            workspaceId: invitation.workspaceId,
            accountId,
            role: invitation.role,
            departmentId: invitation.departmentId
          }
        });
      }

      const accepted = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          status: 'PENDING'
        },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          acceptedByAccountId: accountId
        }
      });

      if (accepted.count === 0) {
        throw new ConflictException({
          error: {
            code: 'CONFLICT',
            message: 'Invitation is no longer available.',
            details: { token }
          }
        });
      }
    });

    return this.authService.login(
      {
        email: normalizedEmail,
        password: input.password,
        rememberMe: input.rememberMe
      },
      requestMeta
    );
  }

  private async assertWorkspaceInvitationAccess(workspaceId: string, cookieHeader?: string) {
    const session = await this.authService.getSession(cookieHeader);
    if (!session.authenticated || !session.account) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.'
        }
      });
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      include: {
        memberships: {
          where: {
            accountId: session.account.id
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
      workspace.ownerAccountId === session.account.id || ['OWNER', 'ADMIN'].includes(membership?.role ?? '');

    if (!canManage) {
      throw new ForbiddenException({
        error: {
          code: 'FORBIDDEN',
          message: 'Invitation management requires workspace owner or admin access.'
        }
      });
    }

    return {
      accountId: session.account.id,
      workspace
    };
  }

  private async expireDatabaseInvitations(workspaceId: string) {
    await this.prismaService.invitation.updateMany({
      where: {
        workspaceId,
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

  private async expireDatabaseInvitationByToken(token: string) {
    const tokenHash = hashInvitationToken(token);
    const invitation = await this.loadDatabaseInvitationByToken(token);
    if (!invitation) {
      return null;
    }

    if (invitation.status === 'PENDING' && invitation.expiresAt.getTime() < Date.now()) {
      return this.prismaService.invitation.update({
        where: {
          tokenHash
        },
        data: {
          status: 'EXPIRED'
        },
        include: {
          department: true
        }
      });
    }

    return invitation;
  }

  private async loadDatabaseInvitationByToken(token: string) {
    return this.prismaService.invitation.findUnique({
      where: {
        tokenHash: hashInvitationToken(token)
      },
      include: {
        department: true,
        workspace: {
          include: {
            organization: true
          }
        }
      }
    });
  }

  private toDatabaseSummary(invitation: InvitationRecord): WorkspaceInvitationSummaryDto {
    return {
      id: invitation.id,
      workspaceId: invitation.workspaceId,
      email: invitation.email,
      systemRole: this.toSummaryRole(invitation.role),
      departmentId: invitation.departmentId ?? undefined,
      departmentName: invitation.department?.name,
      status: this.toSummaryStatus(invitation.status),
      expiresAt: invitation.expiresAt.toISOString(),
      acceptedAt: invitation.acceptedAt?.toISOString(),
      createdAt: invitation.createdAt.toISOString()
    };
  }

  private toPublicDetail(invitation: InvitationRecord & { workspace: { name: string; organization?: { name: string } | null } }): PublicInvitationDetailDto {
    return {
      email: invitation.email,
      workspaceId: invitation.workspaceId,
      workspaceName: invitation.workspace.name,
      organizationName: invitation.workspace.organization?.name ?? undefined,
      systemRole: this.toSummaryRole(invitation.role),
      departmentName: invitation.department?.name,
      status: this.toSummaryStatus(invitation.status),
      expiresAt: invitation.expiresAt.toISOString()
    };
  }

  private toMockSummary(workspaceId: string, invitation: { id: string; email: string; systemRole: 'admin' | 'member' | 'viewer'; departmentId?: string; departmentName?: string; status: 'pending' | 'accepted' | 'cancelled' | 'expired'; expiresAt: string; acceptedAt?: string; createdAt: string }): WorkspaceInvitationSummaryDto {
    return {
      id: invitation.id,
      workspaceId,
      email: invitation.email,
      systemRole: invitation.systemRole,
      departmentId: invitation.departmentId,
      departmentName: invitation.departmentName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      createdAt: invitation.createdAt
    };
  }

  private toMockDetail(
    workspaceId: string,
    invitation: {
      email: string;
      systemRole: 'admin' | 'member' | 'viewer';
      departmentName?: string;
      status: 'pending' | 'accepted' | 'cancelled' | 'expired';
      expiresAt: string;
    }
  ): PublicInvitationDetailDto {
    const workspace = this.store.getWorkspace(workspaceId);
    const organization = this.store.getOrganization(workspaceId);

    return {
      email: invitation.email,
      workspaceId,
      workspaceName: workspace?.name ?? workspaceId,
      organizationName: organization?.name ?? undefined,
      systemRole: invitation.systemRole,
      departmentName: invitation.departmentName,
      status: invitation.status,
      expiresAt: invitation.expiresAt
    };
  }

  private assertMockInvitationAccess(workspaceId: string) {
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

  private async assertWorkspaceInvitationFeature(workspaceId: string) {
    await this.entitlementService.requireAllowed(
      {
        workspaceId,
        featureKey: 'canInviteMember'
      },
      'Member invitations require an Enterprise plan.'
    );
  }

  private assertMockInvitationFeature(workspaceId: string) {
    const entitlement = this.store.hasEntitlement(workspaceId, 'canInviteMember');
    if (!entitlement?.enabled) {
      throw new ForbiddenException({
        error: {
          code: 'PLAN_UPGRADE_REQUIRED',
          message: 'Member invitations require an Enterprise plan.',
          details: {
            featureKey: 'canInviteMember',
            requiredPlan: 'ENTERPRISE_BASIC_MONTHLY'
          }
        }
      });
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
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

  private toSummaryRole(value: WorkspaceMemberRole | string): 'admin' | 'member' | 'viewer' {
    switch (value) {
      case 'ADMIN':
        return 'admin';
      case 'VIEWER':
        return 'viewer';
      default:
        return 'member';
    }
  }

  private toSummaryStatus(value: InvitationStatus | string): 'pending' | 'accepted' | 'cancelled' | 'expired' {
    switch (value) {
      case 'ACCEPTED':
      case 'accepted':
        return 'accepted';
      case 'CANCELLED':
      case 'cancelled':
        return 'cancelled';
      case 'EXPIRED':
      case 'expired':
        return 'expired';
      default:
        return 'pending';
    }
  }
}
