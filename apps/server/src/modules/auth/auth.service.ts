import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import { Prisma, type AccountStatus, type WorkspaceStatus, type WorkspaceType } from '@prisma/client';

import { demoCurrentAccount } from '../../shared/mock/platform-seed';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type { PlanCode } from '../../shared/types/plan-code';
import {
  createSessionToken,
  hashSessionToken,
  readCookie,
  WORKOS_SESSION_COOKIE_NAME
} from '../../shared/auth/session-cookie';
import { hashPassword, verifyPassword } from '../../shared/auth/password-hash';
import type { CurrentAccountResponseDto, WorkspaceSummaryDto } from '../workspace/dto/current-account-response.dto';
import { LoginRequestDto } from './dto/login-request.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { AuthSessionResponseDto } from './dto/auth-session-response.dto';

type DatabaseAccount = Prisma.AccountGetPayload<{
  include: {
    memberships: {
      include: {
        workspace: {
          include: {
            subscriptions: {
              include: {
                plan: true;
              };
              orderBy: {
                createdAt: 'desc';
              };
              take: 1;
            };
          };
        };
      };
    };
  };
}>;

type MockSessionRecord = {
  expiresAt: Date;
  response?: AuthSessionResponseDto;
};

@Injectable()
export class AuthService {
  private readonly mockSessions = new Map<string, MockSessionRecord>();

  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async login(input: LoginRequestDto, requestMeta?: { userAgent?: string; ipAddress?: string }) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const rememberMe = input.rememberMe ?? false;
    const maxAgeSeconds = rememberMe ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

    if (!isDatabasePersistenceEnabled()) {
      const mockEmail = this.normalizeEmail(process.env.WORKOS_MOCK_ADMIN_EMAIL ?? demoCurrentAccount.account.primaryEmail);
      const mockPassword =
        process.env.WORKOS_MOCK_ADMIN_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'qiuai-demo');

      if (normalizedEmail !== mockEmail || input.password !== mockPassword) {
        throw new UnauthorizedException({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Invalid email or password.'
          }
        });
      }

      const sessionToken = createSessionToken();
      this.mockSessions.set(sessionToken, { expiresAt });

      return {
        sessionToken,
        maxAgeSeconds,
        response: {
          authenticated: true,
          persistenceMode: 'mock' as const,
          account: {
            id: demoCurrentAccount.account.id,
            primaryEmail: demoCurrentAccount.account.primaryEmail,
            status: this.toAccountStatus(demoCurrentAccount.account.status)
          },
          workspaces: demoCurrentAccount.workspaces.map((workspace) => this.toWorkspaceSummary(workspace)),
          activeWorkspaceId: demoCurrentAccount.activeWorkspaceId,
          expiresAt: expiresAt.toISOString()
        } satisfies AuthSessionResponseDto
      };
    }

    const account = await this.prismaService.account.findUnique({
      where: { primaryEmail: normalizedEmail },
      include: {
        memberships: {
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
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!account || account.status !== 'ACTIVE') {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Invalid email or password.'
        }
      });
    }

    let passwordHash = account.passwordHash;
    const bootstrapEmail = this.normalizeEmail(process.env.WORKOS_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@qiuai.local');
    const bootstrapPassword = process.env.WORKOS_BOOTSTRAP_ADMIN_PASSWORD;

    if (!passwordHash) {
      if (normalizedEmail !== bootstrapEmail || !bootstrapPassword || bootstrapPassword !== input.password) {
        throw new UnauthorizedException({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Invalid email or password.'
          }
        });
      }

      passwordHash = hashPassword(input.password);
      await this.prismaService.account.update({
        where: { id: account.id },
        data: {
          passwordHash
        }
      });
    } else if (!verifyPassword(input.password, passwordHash)) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Invalid email or password.'
        }
      });
    }

    const sessionToken = createSessionToken();
    await this.prismaService.authSession.create({
      data: {
        accountId: account.id,
        sessionTokenHash: hashSessionToken(sessionToken),
        expiresAt,
        userAgent: requestMeta?.userAgent,
        ipAddress: requestMeta?.ipAddress
      }
    });

    return {
      sessionToken,
      maxAgeSeconds,
      response: this.buildDatabaseSessionResponse(account, expiresAt)
    };
  }

  async register(input: RegisterRequestDto, requestMeta?: { userAgent?: string; ipAddress?: string }) {
    const normalizedEmail = this.normalizeEmail(input.email);
    const workspaceName = input.workspaceName.trim();
    const maxAgeSeconds = 60 * 60 * 24 * 30;
    const expiresAt = new Date(Date.now() + maxAgeSeconds * 1000);

    if (workspaceName.length < 2) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Workspace name must be at least 2 characters.'
        }
      });
    }

    if (!isDatabasePersistenceEnabled()) {
      const sessionToken = createSessionToken();
      const response = this.buildMockRegisteredSessionResponse({
        email: normalizedEmail,
        workspaceName,
        expiresAt
      });
      this.mockSessions.set(sessionToken, { expiresAt, response });

      return {
        sessionToken,
        maxAgeSeconds,
        response
      };
    }

    const existingAccount = await this.prismaService.account.findUnique({
      where: {
        primaryEmail: normalizedEmail
      },
      select: {
        id: true
      }
    });

    if (existingAccount) {
      throw new ConflictException({
        error: {
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'This email has already been registered.'
        }
      });
    }

    const freePlan = await this.prismaService.plan.findUnique({
      where: {
        code: 'PERSONAL_FREE'
      }
    });

    if (!freePlan) {
      throw new ServiceUnavailableException({
        error: {
          code: 'FREE_PLAN_NOT_CONFIGURED',
          message: 'The free plan is not configured.'
        }
      });
    }

    try {
      const accountId = await this.prismaService.$transaction(async (tx) => {
        const account = await tx.account.create({
          data: {
            primaryEmail: normalizedEmail,
            passwordHash: hashPassword(input.password),
            status: 'ACTIVE'
          }
        });

        const tenant = await tx.tenant.create({
          data: {
            name: workspaceName,
            type: 'ENTERPRISE',
            status: 'ACTIVE'
          }
        });

        const workspace = await tx.workspace.create({
          data: {
            tenantId: tenant.id,
            type: 'ENTERPRISE',
            name: workspaceName,
            ownerAccountId: account.id,
            status: 'ACTIVE',
            subscriptions: {
              create: {
                planId: freePlan.id,
                status: 'FREE',
                billingCycle: 'FREE',
                cancelAtPeriodEnd: false
              }
            },
            billingAccount: {
              create: {
                status: 'ACTIVE',
                billingName: workspaceName,
                contactEmail: normalizedEmail,
                defaultProvider: 'ALIPAY'
              }
            },
            usageMeters: {
              create: [
                {
                  metricKey: 'roleInstances.count',
                  period: this.currentMonthPeriod(),
                  usedValue: 0
                },
                {
                  metricKey: 'tasks.monthlyCount',
                  period: this.currentMonthPeriod(),
                  usedValue: 0
                }
              ]
            }
          }
        });

        await tx.workspaceMember.create({
          data: {
            workspaceId: workspace.id,
            accountId: account.id,
            role: 'OWNER'
          }
        });

        await tx.organization.create({
          data: {
            tenantId: tenant.id,
            workspaceId: workspace.id,
            name: workspaceName,
            settings: {}
          }
        });

        return account.id;
      });

      const account = await this.loadDatabaseAccount(accountId);
      const sessionToken = createSessionToken();
      await this.prismaService.authSession.create({
        data: {
          accountId: account.id,
          sessionTokenHash: hashSessionToken(sessionToken),
          expiresAt,
          userAgent: requestMeta?.userAgent,
          ipAddress: requestMeta?.ipAddress
        }
      });

      return {
        sessionToken,
        maxAgeSeconds,
        response: this.buildDatabaseSessionResponse(account, expiresAt)
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          error: {
            code: 'EMAIL_ALREADY_REGISTERED',
            message: 'This email has already been registered.'
          }
        });
      }

      throw error;
    }
  }

  async logout(cookieHeader?: string) {
    if (!isDatabasePersistenceEnabled()) {
      const sessionToken = this.readSessionToken(cookieHeader);
      if (sessionToken) {
        this.mockSessions.delete(sessionToken);
      }

      return {
        response: {
          ok: true as const
        }
      };
    }

    const sessionToken = this.readSessionToken(cookieHeader);
    if (sessionToken) {
      await this.prismaService.authSession.updateMany({
        where: {
          sessionTokenHash: hashSessionToken(sessionToken),
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
      });
    }

    return {
      response: {
        ok: true as const
      }
    };
  }

  async createSessionForAccount(
    accountId: string,
    options: {
      maxAgeSeconds: number;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    if (!isDatabasePersistenceEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PERSISTENCE_MODE_REQUIRED',
          message: 'Database persistence is required to create account sessions.'
        }
      });
    }

    const account = await this.loadDatabaseAccount(accountId);
    if (account.status !== 'ACTIVE') {
      throw new ForbiddenException({
        error: {
          code: 'ACCOUNT_NOT_ACTIVE',
          message: 'Account is not active.',
          details: { accountId }
        }
      });
    }

    const expiresAt = new Date(Date.now() + options.maxAgeSeconds * 1000);
    const sessionToken = createSessionToken();
    await this.prismaService.authSession.create({
      data: {
        accountId: account.id,
        sessionTokenHash: hashSessionToken(sessionToken),
        expiresAt,
        userAgent: options.userAgent,
        ipAddress: options.ipAddress
      }
    });

    return {
      sessionToken,
      maxAgeSeconds: options.maxAgeSeconds,
      response: this.buildDatabaseSessionResponse(account, expiresAt)
    };
  }

  async getSession(cookieHeader?: string): Promise<AuthSessionResponseDto> {
    if (!isDatabasePersistenceEnabled()) {
      const sessionToken = this.readSessionToken(cookieHeader);
      const session = sessionToken ? this.mockSessions.get(sessionToken) : undefined;

      if (!session || session.expiresAt.getTime() <= Date.now()) {
        return {
          authenticated: false,
          persistenceMode: 'mock'
        };
      }

      if (session.response) {
        return {
          ...session.response,
          expiresAt: session.expiresAt.toISOString()
        };
      }

      return {
        authenticated: true,
        persistenceMode: 'mock',
        account: {
          id: demoCurrentAccount.account.id,
          primaryEmail: demoCurrentAccount.account.primaryEmail,
          status: this.toAccountStatus(demoCurrentAccount.account.status)
        },
        workspaces: demoCurrentAccount.workspaces.map((workspace) => this.toWorkspaceSummary(workspace)),
        activeWorkspaceId: demoCurrentAccount.activeWorkspaceId,
        expiresAt: session.expiresAt.toISOString()
      };
    }

    const sessionToken = this.readSessionToken(cookieHeader);
    if (!sessionToken) {
      return {
        authenticated: false,
        persistenceMode: 'database'
      };
    }

    const session = await this.prismaService.authSession.findUnique({
      where: {
        sessionTokenHash: hashSessionToken(sessionToken)
      },
      include: {
        account: {
          include: {
            memberships: {
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
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now() || session.account.status !== 'ACTIVE') {
      return {
        authenticated: false,
        persistenceMode: 'database'
      };
    }

    await this.prismaService.authSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() }
    });

    return this.buildDatabaseSessionResponse(session.account, session.expiresAt);
  }

  private async loadDatabaseAccount(accountId: string): Promise<DatabaseAccount> {
    const account = await this.prismaService.account.findUnique({
      where: {
        id: accountId
      },
      include: {
        memberships: {
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
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!account) {
      throw new ServiceUnavailableException({
        error: {
          code: 'REGISTERED_ACCOUNT_NOT_FOUND',
          message: 'The registered account could not be loaded.'
        }
      });
    }

    return account;
  }

  async getCurrentAccount(cookieHeader?: string): Promise<CurrentAccountResponseDto> {
    const session = await this.getSession(cookieHeader);
    if (!session.authenticated || !session.account || !session.workspaces || !session.activeWorkspaceId) {
      throw new UnauthorizedException({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication is required.'
        }
      });
    }

    return {
      account: session.account,
      workspaces: session.workspaces,
      activeWorkspaceId: session.activeWorkspaceId
    };
  }

  async requireWorkspaceAccess(
    workspaceId: string,
    cookieHeader?: string
  ): Promise<CurrentAccountResponseDto> {
    const currentAccount = await this.getCurrentAccount(cookieHeader);
    const workspaceSummary = currentAccount.workspaces.find((workspace) => workspace.id === workspaceId);

    if (!workspaceSummary) {
      throw new ForbiddenException({
        error: {
          code: 'WORKSPACE_ACCESS_DENIED',
          message: 'You do not have access to this workspace.',
          details: { workspaceId }
        }
      });
    }

    if (!isDatabasePersistenceEnabled()) {
      if (workspaceSummary.status !== 'active') {
        throw new ForbiddenException({
          error: {
            code: 'WORKSPACE_NOT_ACTIVE',
            message: 'Workspace is not active.',
            details: {
              workspaceId,
              status: workspaceSummary.status
            }
          }
        });
      }

      return currentAccount;
    }

    const workspace = await this.prismaService.workspace.findUnique({
      where: {
        id: workspaceId
      },
      select: {
        id: true,
        status: true,
        memberships: {
          where: {
            accountId: currentAccount.account.id
          },
          select: {
            id: true
          }
        }
      }
    });

    if (!workspace || workspace.memberships.length === 0) {
      throw new ForbiddenException({
        error: {
          code: 'WORKSPACE_ACCESS_DENIED',
          message: 'You do not have access to this workspace.',
          details: { workspaceId }
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
            status: this.toWorkspaceStatus(workspace.status)
          }
        }
      });
    }

    return currentAccount;
  }

  private buildDatabaseSessionResponse(account: DatabaseAccount, expiresAt: Date): AuthSessionResponseDto {
    const workspaces = account.memberships
      .map((membership) => membership.workspace)
      .filter((workspace): workspace is DatabaseAccount['memberships'][number]['workspace'] => Boolean(workspace))
      .map((workspace) => this.toWorkspaceSummary({
        id: workspace.id,
        tenantId: workspace.tenantId,
        workspaceType: this.toWorkspaceType(workspace.type),
        name: workspace.name,
        ownerAccountId: workspace.ownerAccountId,
        status: this.toWorkspaceStatus(workspace.status),
        planCode: (workspace.subscriptions[0]?.plan.code ?? 'PERSONAL_FREE') as PlanCode
      }))
      .sort((left, right) => {
        if (left.workspaceType === right.workspaceType) {
          return left.name.localeCompare(right.name, 'zh-CN');
        }

        return left.workspaceType === 'enterprise' ? -1 : 1;
      });

    const activeWorkspace = workspaces.find((workspace) => workspace.workspaceType === 'enterprise') ?? workspaces[0];

    return {
      authenticated: true,
      persistenceMode: 'database',
      account: {
        id: account.id,
        primaryEmail: account.primaryEmail,
        status: this.toAccountStatus(account.status)
      },
      workspaces,
      activeWorkspaceId: activeWorkspace?.id,
      expiresAt: expiresAt.toISOString()
    };
  }

  private toWorkspaceSummary(workspace: {
    id: string;
    tenantId: string;
    workspaceType: 'personal' | 'enterprise';
    name: string;
    ownerAccountId: string;
    status: 'active' | 'suspended' | 'archived';
    planCode: PlanCode;
  }): WorkspaceSummaryDto {
    return {
      id: workspace.id,
      tenantId: workspace.tenantId,
      workspaceType: workspace.workspaceType,
      name: workspace.name,
      ownerAccountId: workspace.ownerAccountId,
      status: workspace.status,
      planCode: workspace.planCode
    };
  }

  private toWorkspaceType(value: WorkspaceType): 'personal' | 'enterprise' {
    return value === 'ENTERPRISE' ? 'enterprise' : 'personal';
  }

  private toWorkspaceStatus(value: WorkspaceStatus): 'active' | 'suspended' | 'archived' {
    switch (value) {
      case 'SUSPENDED':
        return 'suspended';
      case 'ARCHIVED':
        return 'archived';
      default:
        return 'active';
    }
  }

  private buildMockRegisteredSessionResponse(input: {
    email: string;
    workspaceName: string;
    expiresAt: Date;
  }): AuthSessionResponseDto {
    const accountId = `mock_account_${randomUUID()}`;
    const tenantId = `mock_tenant_${randomUUID()}`;
    const workspaceId = `mock_workspace_${randomUUID()}`;

    return {
      authenticated: true,
      persistenceMode: 'mock',
      account: {
        id: accountId,
        primaryEmail: input.email,
        status: 'active'
      },
      workspaces: [
        {
          id: workspaceId,
          tenantId,
          workspaceType: 'enterprise',
          name: input.workspaceName,
          ownerAccountId: accountId,
          status: 'active',
          planCode: 'PERSONAL_FREE'
        }
      ],
      activeWorkspaceId: workspaceId,
      expiresAt: input.expiresAt.toISOString()
    };
  }

  private currentMonthPeriod() {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private toAccountStatus(value: AccountStatus | 'active' | 'disabled'): 'active' | 'disabled' {
    return value === 'DISABLED' || value === 'disabled' ? 'disabled' : 'active';
  }

  private readSessionToken(cookieHeader?: string) {
    const token = readCookie(cookieHeader, WORKOS_SESSION_COOKIE_NAME);
    if (!token) {
      return undefined;
    }

    try {
      return decodeURIComponent(token);
    } catch {
      return undefined;
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
