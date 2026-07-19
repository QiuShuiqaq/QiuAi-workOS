import { Injectable, UnauthorizedException } from '@nestjs/common';
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
};

@Injectable()
export class AuthService {
  private readonly mockSessions = new Map<string, MockSessionRecord>();

  constructor(private readonly prismaService: PrismaService) {}

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
