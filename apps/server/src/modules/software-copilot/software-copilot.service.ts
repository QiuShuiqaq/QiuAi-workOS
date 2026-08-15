import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from '@nestjs/common';
import type {
  BillingCycle,
  PaymentProvider,
  Prisma,
  SoftwareCopilotDeviceBinding,
  SoftwareCopilotLicense,
  SoftwareCopilotProduct,
  SoftwareCopilotOrder
} from '@prisma/client';

import {
  buildAlipayCheckoutUrl,
  formatAmountCny,
  getAlipayNotifyPath,
  getAlipayReturnPath,
  getMissingAlipayEnvKeys,
  isAlipayConfigured,
  isAlipayTradeClosed,
  isAlipayTradePaid
} from '../billing/alipay-gateway';
import { AuthService } from '../auth/auth.service';
import { hashDesktopToken } from '../desktop-sync/desktop-auth-token';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { softwareCopilotProductSeeds } from '../../shared/software-copilot-catalog';

type WorkspaceAccessContext = {
  cookieHeader?: string;
  deviceToken?: string;
};

type WorkspaceAccess = {
  workspaceType: 'personal' | 'enterprise';
  planCode: string;
  desktopDeviceId?: string;
  accountId?: string;
};

type ProductWithBindings = SoftwareCopilotProduct & {
  licenses?: Array<SoftwareCopilotLicense & {
    product: SoftwareCopilotProduct;
    deviceBindings: DeviceBindingWithRelations[];
  }>;
};

type DeviceBindingWithRelations = SoftwareCopilotDeviceBinding & {
  product: SoftwareCopilotProduct;
  license: SoftwareCopilotLicense;
  desktopDevice: {
    id: string;
    deviceName: string;
    deviceId: string;
    runtimeId: string;
  };
};

type OrderWithProduct = SoftwareCopilotOrder & {
  product: SoftwareCopilotProduct;
};

const validBillingCycles = ['MONTHLY', 'ANNUAL'] as const;

@Injectable()
export class SoftwareCopilotService {
  constructor(
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(AuthService)
    private readonly authService: AuthService
  ) {}

  async listSoftwareCopilots(workspaceId: string, context: WorkspaceAccessContext) {
    const access = await this.requireWorkspaceAccess(workspaceId, context);

    if (!isDatabasePersistenceEnabled()) {
      return {
        workspaceId,
        workspaceType: access.workspaceType,
        data: softwareCopilotProductSeeds.map((product) => {
          const canPurchase = this.canPurchaseForPlan(access.workspaceType, access.planCode);
          return {
            product: {
              ...product,
              status: 'ACTIVE',
              currency: product.currency
            },
            licenses: [],
            activeBindings: [],
            entitlement: {
              canPurchase,
              canUse: false,
              reason: canPurchase ? undefined : this.purchaseBlockedReason(access.workspaceType),
              seatLimit: 0,
              assignedSeatCount: 0,
              availableSeatCount: 0
            }
          };
        })
      };
    }

    await this.expireExpiredLicenses();

    const [products, licenses] = await Promise.all([
      this.prismaService.softwareCopilotProduct.findMany({
        where: {
          status: {
            not: 'ARCHIVED'
          }
        },
        orderBy: [
          {
            sortOrder: 'asc'
          },
          {
            createdAt: 'asc'
          }
        ]
      }),
      this.prismaService.softwareCopilotLicense.findMany({
        where: {
          workspaceId,
          status: 'ACTIVE'
        },
        include: {
          product: true,
          deviceBindings: {
            where: {
              status: 'ACTIVE'
            },
            include: {
              product: true,
              license: true,
              desktopDevice: {
                select: {
                  id: true,
                  deviceName: true,
                  deviceId: true,
                  runtimeId: true
                }
              }
            },
            orderBy: {
              boundAt: 'desc'
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })
    ]);

    const canPurchase = this.canPurchaseForPlan(access.workspaceType, access.planCode);

    return {
      workspaceId,
      workspaceType: access.workspaceType,
      data: products.map((product) => {
        const productLicenses = licenses.filter((license) => license.productId === product.id);
        const activeBindings = productLicenses.flatMap((license) => license.deviceBindings);
        const seatLimit = productLicenses.reduce((sum, license) => sum + license.seatLimit, 0);
        const assignedSeatCount = activeBindings.length;
        const deviceBinding = access.desktopDeviceId
          ? activeBindings.find((binding) => binding.desktopDeviceId === access.desktopDeviceId)
          : undefined;

        return {
          product: this.toProductSummary(product),
          licenses: productLicenses.map((license) => this.toLicenseSummary(license)),
          deviceBinding: deviceBinding ? this.toDeviceBindingSummary(deviceBinding) : undefined,
          activeBindings: activeBindings.map((binding) => this.toDeviceBindingSummary(binding)),
          entitlement: {
            canPurchase: product.status === 'ACTIVE' && canPurchase,
            canUse: access.desktopDeviceId ? Boolean(deviceBinding) : seatLimit > 0,
            reason:
              product.status !== 'ACTIVE'
                ? '该软件副驾暂未开放购买。'
                : canPurchase
                  ? undefined
                  : this.purchaseBlockedReason(access.workspaceType),
            seatLimit,
            assignedSeatCount,
            availableSeatCount: Math.max(0, seatLimit - assignedSeatCount)
          }
        };
      })
    };
  }

  async createOrder(workspaceId: string, body: unknown, cookieHeader?: string) {
    const request = this.parseCreateOrderRequest(body);

    if (!isDatabasePersistenceEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PERSISTENCE_MODE_REQUIRED',
          message: '软件副驾购买需要服务端数据库模式。'
        }
      });
    }

    const access = await this.requirePurchaseAccess(workspaceId, cookieHeader);
    const product = await this.prismaService.softwareCopilotProduct.findUnique({
      where: {
        code: request.productCode
      }
    });
    if (!product || product.status === 'ARCHIVED') {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: '软件副驾不存在。',
          details: {
            productCode: request.productCode
          }
        }
      });
    }
    if (product.status !== 'ACTIVE') {
      throw new BadRequestException({
        error: {
          code: 'SOFTWARE_COPILOT_NOT_PURCHASABLE',
          message: '该软件副驾暂未开放购买。'
        }
      });
    }
    if (!this.canPurchaseForPlan(access.workspaceType, access.planCode)) {
      throw new ForbiddenException({
        error: {
          code: 'SOFTWARE_COPILOT_PURCHASE_FORBIDDEN',
          message: this.purchaseBlockedReason(access.workspaceType)
        }
      });
    }

    const provider = request.provider ?? 'ALIPAY';
    this.requirePaymentProviderConfigured(provider);

    const seatCount = access.workspaceType === 'enterprise' ? request.seatCount ?? 1 : 1;
    const unitPriceCents = this.resolveUnitPrice(product, access.workspaceType, request.billingCycle);
    const amountCents = unitPriceCents * seatCount;
    const now = new Date();
    const period = this.resolveBillingPeriod(request.billingCycle, now);
    const orderNo = this.generateOrderNo(now);
    const subject = `QiuAI ${product.name} ${this.billingCycleLabel(request.billingCycle)} ${seatCount} 台`;
    const paymentUrl = buildAlipayCheckoutUrl({
      orderNo,
      amountCents,
      subject,
      body: `QiuAI WorkOS ${product.name}`
    });

    const order = await this.prismaService.softwareCopilotOrder.create({
      data: {
        workspaceId,
        productId: product.id,
        orderNo,
        provider,
        status: 'PENDING',
        subject,
        amountCents,
        currency: product.currency,
        billingCycle: request.billingCycle,
        seatCount,
        periodStart: period.start,
        periodEnd: period.end,
        paymentUrl,
        expiresAt: this.addMinutes(now, 30),
        metadata: {
          paymentProviderReady: true,
          paymentIntegrationStage: 'ALIPAY_PAGE_PAY_READY',
          alipayNotifyPath: getAlipayNotifyPath(),
          alipayReturnPath: getAlipayReturnPath(),
          workspaceType: access.workspaceType
        }
      },
      include: {
        product: true
      }
    });

    return {
      data: this.toOrderSummary(order)
    };
  }

  async findOrderWorkspaceId(orderNo: string): Promise<string | undefined> {
    if (!isDatabasePersistenceEnabled()) {
      return undefined;
    }

    const order = await this.prismaService.softwareCopilotOrder.findUnique({
      where: {
        orderNo
      },
      select: {
        workspaceId: true
      }
    });

    return order?.workspaceId;
  }

  async applyAlipayTradeUpdate(input: {
    orderNo: string;
    tradeNo: string | null;
    tradeStatus: string | null;
    totalAmount: string | null;
    rawPayload: Record<string, unknown>;
    source: 'notify' | 'return';
  }): Promise<OrderWithProduct | null> {
    const orderNo = input.orderNo.trim();
    if (!orderNo) {
      return null;
    }

    const order = await this.prismaService.softwareCopilotOrder.findUnique({
      where: {
        orderNo
      },
      include: {
        product: true
      }
    });
    if (!order) {
      return null;
    }

    this.ensureAlipayAmountMatches(order, input.totalAmount);

    if (isAlipayTradeClosed(input.tradeStatus)) {
      return this.closeOrderFromAlipay(order, input);
    }

    if (!isAlipayTradePaid(input.tradeStatus)) {
      return order;
    }

    return this.markOrderPaidFromAlipay(order, input);
  }

  async bindDevice(workspaceId: string, productCode: string, body: unknown, cookieHeader?: string) {
    const request = this.parseBindDeviceRequest(body);

    if (!isDatabasePersistenceEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PERSISTENCE_MODE_REQUIRED',
          message: '软件副驾设备授权需要服务端数据库模式。'
        }
      });
    }

    await this.requireWorkspaceManagementAccess(workspaceId, cookieHeader);
    await this.expireExpiredLicenses();

    const [product, desktopDevice] = await Promise.all([
      this.prismaService.softwareCopilotProduct.findUnique({
        where: {
          code: productCode
        }
      }),
      this.prismaService.desktopDevice.findFirst({
        where: {
          id: request.desktopDeviceId,
          workspaceId,
          status: 'ACTIVE'
        }
      })
    ]);

    if (!product || product.status === 'ARCHIVED') {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: '软件副驾不存在。',
          details: {
            productCode
          }
        }
      });
    }
    if (!desktopDevice) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'PC 设备不存在或已解绑。'
        }
      });
    }

    const existingActiveBinding = await this.prismaService.softwareCopilotDeviceBinding.findFirst({
      where: {
        workspaceId,
        productId: product.id,
        desktopDeviceId: desktopDevice.id,
        status: 'ACTIVE'
      },
      include: this.deviceBindingInclude()
    });
    if (existingActiveBinding) {
      return {
        data: this.toDeviceBindingSummary(existingActiveBinding)
      };
    }

    const license = request.licenseId
      ? await this.findUsableLicenseById(workspaceId, product.id, request.licenseId)
      : await this.findFirstAvailableLicense(workspaceId, product.id);
    if (!license) {
      throw new ConflictException({
        error: {
          code: 'SOFTWARE_COPILOT_SEAT_REQUIRED',
          message: '该软件副驾没有可分配的设备席位，请先购买或增加设备数量。'
        }
      });
    }

    const existingLicenseDeviceBinding =
      await this.prismaService.softwareCopilotDeviceBinding.findUnique({
        where: {
          licenseId_desktopDeviceId: {
            licenseId: license.id,
            desktopDeviceId: desktopDevice.id
          }
        }
      });

    const binding = existingLicenseDeviceBinding
      ? await this.prismaService.softwareCopilotDeviceBinding.update({
          where: {
            id: existingLicenseDeviceBinding.id
          },
          data: {
            status: 'ACTIVE',
            revokedAt: null,
            boundAt: new Date()
          },
          include: this.deviceBindingInclude()
        })
      : await this.prismaService.softwareCopilotDeviceBinding.create({
          data: {
            workspaceId,
            productId: product.id,
            licenseId: license.id,
            desktopDeviceId: desktopDevice.id,
            status: 'ACTIVE'
          },
          include: this.deviceBindingInclude()
        });

    return {
      data: this.toDeviceBindingSummary(binding)
    };
  }

  async revokeDeviceBinding(workspaceId: string, bindingId: string, cookieHeader?: string) {
    if (!isDatabasePersistenceEnabled()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'PERSISTENCE_MODE_REQUIRED',
          message: '软件副驾设备授权需要服务端数据库模式。'
        }
      });
    }

    await this.requireWorkspaceManagementAccess(workspaceId, cookieHeader);
    const existing = await this.prismaService.softwareCopilotDeviceBinding.findFirst({
      where: {
        id: bindingId,
        workspaceId
      },
      include: this.deviceBindingInclude()
    });
    if (!existing) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: '软件副驾设备授权不存在。'
        }
      });
    }

    const binding =
      existing.status === 'ACTIVE'
        ? await this.prismaService.softwareCopilotDeviceBinding.update({
            where: {
              id: existing.id
            },
            data: {
              status: 'REVOKED',
              revokedAt: new Date()
            },
            include: this.deviceBindingInclude()
          })
        : existing;

    return {
      data: this.toDeviceBindingSummary(binding)
    };
  }

  private async markOrderPaidFromAlipay(
    order: OrderWithProduct,
    input: {
      tradeNo: string | null;
      tradeStatus: string | null;
      rawPayload: Record<string, unknown>;
      source: 'notify' | 'return';
    }
  ): Promise<OrderWithProduct> {
    if (order.status === 'PAID' && order.licenseId) {
      return order;
    }

    const now = new Date();
    return this.prismaService.$transaction(async (tx) => {
      const license = order.licenseId
        ? await tx.softwareCopilotLicense.update({
            where: {
              id: order.licenseId
            },
            data: {
              status: 'ACTIVE',
              seatLimit: order.seatCount,
              billingCycle: order.billingCycle,
              periodStart: order.periodStart,
              periodEnd: order.periodEnd
            }
          })
        : await tx.softwareCopilotLicense.create({
            data: {
              workspaceId: order.workspaceId,
              productId: order.productId,
              status: 'ACTIVE',
              billingCycle: order.billingCycle,
              seatLimit: order.seatCount,
              periodStart: order.periodStart,
              periodEnd: order.periodEnd,
              metadata: {
                sourceOrderNo: order.orderNo
              }
            }
          });

      return tx.softwareCopilotOrder.update({
        where: {
          id: order.id
        },
        data: {
          status: 'PAID',
          licenseId: license.id,
          providerTradeNo: input.tradeNo ?? order.providerTradeNo,
          paidAt: order.paidAt ?? now,
          metadata: {
            ...this.toJsonObject(order.metadata),
            alipayTradeStatus: input.tradeStatus,
            paymentSource: input.source
          }
        },
        include: {
          product: true
        }
      });
    });
  }

  private async closeOrderFromAlipay(
    order: OrderWithProduct,
    input: {
      tradeNo: string | null;
      rawPayload: Record<string, unknown>;
    }
  ): Promise<OrderWithProduct> {
    if (order.status === 'PAID') {
      return order;
    }

    return this.prismaService.softwareCopilotOrder.update({
      where: {
        id: order.id
      },
      data: {
        status: 'CLOSED',
        providerTradeNo: input.tradeNo ?? order.providerTradeNo,
        closedAt: order.closedAt ?? new Date()
      },
      include: {
        product: true
      }
    });
  }

  private async findUsableLicenseById(workspaceId: string, productId: string, licenseId: string) {
    const license = await this.prismaService.softwareCopilotLicense.findFirst({
      where: {
        id: licenseId,
        workspaceId,
        productId,
        status: 'ACTIVE'
      },
      include: {
        deviceBindings: {
          where: {
            status: 'ACTIVE'
          }
        }
      }
    });
    if (!license) {
      return undefined;
    }

    return license.deviceBindings.length < license.seatLimit ? license : undefined;
  }

  private async findFirstAvailableLicense(workspaceId: string, productId: string) {
    const licenses = await this.prismaService.softwareCopilotLicense.findMany({
      where: {
        workspaceId,
        productId,
        status: 'ACTIVE'
      },
      include: {
        deviceBindings: {
          where: {
            status: 'ACTIVE'
          }
        }
      },
      orderBy: [
        {
          periodEnd: 'asc'
        },
        {
          createdAt: 'asc'
        }
      ]
    });

    return licenses.find((license) => license.deviceBindings.length < license.seatLimit);
  }

  private async expireExpiredLicenses() {
    await this.prismaService.softwareCopilotLicense.updateMany({
      where: {
        status: 'ACTIVE',
        periodEnd: {
          not: null,
          lt: new Date()
        }
      },
      data: {
        status: 'EXPIRED'
      }
    });
  }

  private async requireWorkspaceAccess(
    workspaceId: string,
    context: WorkspaceAccessContext
  ): Promise<WorkspaceAccess> {
    if (!isDatabasePersistenceEnabled()) {
      const workspace = this.store.getWorkspace(workspaceId);
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
      return {
        workspaceType: workspace.workspaceType,
        planCode: workspace.planCode
      };
    }

    if (context.deviceToken) {
      const device = await this.prismaService.desktopDevice.findUnique({
        where: {
          tokenHash: hashDesktopToken(context.deviceToken)
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
        where: {
          id: device.id
        },
        data: {
          lastSeenAt: new Date()
        }
      });

      return {
        workspaceType: this.toWorkspaceType(device.workspace.type),
        planCode: device.workspace.subscriptions[0]?.plan.code ?? 'PERSONAL_FREE',
        desktopDeviceId: device.id
      };
    }

    const currentAccount = await this.authService.requireWorkspaceAccess(workspaceId, context.cookieHeader);
    const activeWorkspace = currentAccount.workspaces.find((workspace) => workspace.id === workspaceId);
    if (!activeWorkspace) {
      throw new ForbiddenException({
        error: {
          code: 'WORKSPACE_ACCESS_DENIED',
          message: 'You do not have access to this workspace.'
        }
      });
    }

    return {
      workspaceType: activeWorkspace.workspaceType,
      planCode: activeWorkspace.planCode,
      accountId: currentAccount.account.id
    };
  }

  private async requirePurchaseAccess(workspaceId: string, cookieHeader?: string) {
    const access = await this.requireWorkspaceManagementAccess(workspaceId, cookieHeader);
    return access;
  }

  private async requireWorkspaceManagementAccess(workspaceId: string, cookieHeader?: string) {
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
        },
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
          message: '该操作需要工作空间管理员权限。'
        }
      });
    }

    return {
      workspaceType: this.toWorkspaceType(workspace.type),
      planCode: workspace.subscriptions[0]?.plan.code ?? 'PERSONAL_FREE',
      accountId: currentAccount.account.id
    };
  }

  private requirePaymentProviderConfigured(provider: PaymentProvider): void {
    if (provider !== 'ALIPAY') {
      throw new BadRequestException({
        error: {
          code: 'UNSUPPORTED_PAYMENT_PROVIDER',
          message: 'Unsupported payment provider.',
          details: {
            provider
          }
        }
      });
    }

    if (!isAlipayConfigured()) {
      throw new ServiceUnavailableException({
        error: {
          code: 'ALIPAY_NOT_CONFIGURED',
          message: '在线支付暂不可用。',
          details: {
            missingEnvKeys: getMissingAlipayEnvKeys()
          }
        }
      });
    }
  }

  private parseCreateOrderRequest(input: unknown) {
    const record = this.requireRecord(input, 'softwareCopilotOrder');
    const productCode = this.requireString(record.productCode, 'softwareCopilotOrder.productCode');
    const billingCycle = this.requireEnum(
      record.billingCycle,
      'softwareCopilotOrder.billingCycle',
      validBillingCycles
    );
    const seatCount = this.optionalBoundedInteger(
      record.seatCount,
      'softwareCopilotOrder.seatCount',
      1,
      500
    );
    const provider = record.provider === undefined || record.provider === null
      ? undefined
      : this.requireEnum(record.provider, 'softwareCopilotOrder.provider', ['ALIPAY']);

    return {
      productCode,
      billingCycle,
      seatCount,
      provider
    };
  }

  private parseBindDeviceRequest(input: unknown) {
    const record = this.requireRecord(input, 'softwareCopilotDeviceBinding');
    return {
      desktopDeviceId: this.requireString(
        record.desktopDeviceId,
        'softwareCopilotDeviceBinding.desktopDeviceId'
      ),
      licenseId: this.optionalString(record.licenseId, 'softwareCopilotDeviceBinding.licenseId')
    };
  }

  private resolveUnitPrice(
    product: SoftwareCopilotProduct,
    workspaceType: 'personal' | 'enterprise',
    billingCycle: BillingCycle
  ): number {
    if (workspaceType === 'enterprise') {
      return billingCycle === 'ANNUAL'
        ? product.enterpriseAnnualUnitPriceCents
        : product.enterpriseMonthlyUnitPriceCents;
    }

    return billingCycle === 'ANNUAL'
      ? product.personalAnnualPriceCents
      : product.personalMonthlyPriceCents;
  }

  private canPurchaseForPlan(workspaceType: 'personal' | 'enterprise', planCode: string): boolean {
    if (workspaceType === 'enterprise') {
      return true;
    }

    return planCode === 'PERSONAL_MEMBER_MONTHLY' || planCode === 'PERSONAL_MEMBER_ANNUAL';
  }

  private purchaseBlockedReason(workspaceType: 'personal' | 'enterprise'): string {
    return workspaceType === 'enterprise'
      ? '当前企业账号暂不可购买软件副驾。'
      : '免费版不能购买软件副驾，请先开通会员。';
  }

  private resolveBillingPeriod(billingCycle: BillingCycle, start: Date) {
    const end = new Date(start);
    if (billingCycle === 'ANNUAL') {
      end.setFullYear(end.getFullYear() + 1);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    return {
      start,
      end
    };
  }

  private billingCycleLabel(billingCycle: BillingCycle): string {
    return billingCycle === 'ANNUAL' ? '年付' : '月付';
  }

  private ensureAlipayAmountMatches(order: { amountCents: number; orderNo: string }, totalAmount: string | null) {
    if (!totalAmount) {
      return;
    }

    if (formatAmountCny(order.amountCents) !== formatAmountCny(Math.round(Number(totalAmount) * 100))) {
      throw new Error('ALIPAY_AMOUNT_MISMATCH');
    }
  }

  private generateOrderNo(now: Date): string {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    const suffix = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return `QCOP${year}${month}${day}${suffix}`;
  }

  private addMinutes(date: Date, minutes: number): Date {
    return new Date(date.getTime() + minutes * 60 * 1000);
  }

  private deviceBindingInclude() {
    return {
      product: true,
      license: true,
      desktopDevice: {
        select: {
          id: true,
          deviceName: true,
          deviceId: true,
          runtimeId: true
        }
      }
    } satisfies Prisma.SoftwareCopilotDeviceBindingInclude;
  }

  private toProductSummary(product: SoftwareCopilotProduct) {
    return {
      code: product.code,
      name: product.name,
      softwareName: product.softwareName,
      category: product.category,
      description: product.description,
      status: product.status,
      platforms: this.toStringArray(product.platforms),
      capabilities: this.toStringArray(product.capabilities),
      personalMonthlyPriceCents: product.personalMonthlyPriceCents,
      personalAnnualPriceCents: product.personalAnnualPriceCents,
      enterpriseMonthlyUnitPriceCents: product.enterpriseMonthlyUnitPriceCents,
      enterpriseAnnualUnitPriceCents: product.enterpriseAnnualUnitPriceCents,
      currency: product.currency,
      sortOrder: product.sortOrder
    };
  }

  private toLicenseSummary(
    license: SoftwareCopilotLicense & {
      product: SoftwareCopilotProduct;
      deviceBindings: Array<{ status: string }>;
    }
  ) {
    const assignedSeatCount = license.deviceBindings.filter((binding) => binding.status === 'ACTIVE').length;
    return {
      id: license.id,
      workspaceId: license.workspaceId,
      productCode: license.product.code,
      productName: license.product.name,
      status: license.status,
      billingCycle: license.billingCycle,
      seatLimit: license.seatLimit,
      assignedSeatCount,
      availableSeatCount: Math.max(0, license.seatLimit - assignedSeatCount),
      periodStart: license.periodStart?.toISOString(),
      periodEnd: license.periodEnd?.toISOString(),
      createdAt: license.createdAt.toISOString(),
      updatedAt: license.updatedAt.toISOString()
    };
  }

  private toDeviceBindingSummary(binding: DeviceBindingWithRelations) {
    return {
      id: binding.id,
      workspaceId: binding.workspaceId,
      licenseId: binding.licenseId,
      productCode: binding.product.code,
      productName: binding.product.name,
      desktopDeviceId: binding.desktopDeviceId,
      deviceName: binding.desktopDevice.deviceName,
      deviceId: binding.desktopDevice.deviceId,
      runtimeId: binding.desktopDevice.runtimeId,
      status: binding.status,
      boundAt: binding.boundAt.toISOString(),
      revokedAt: binding.revokedAt?.toISOString()
    };
  }

  toOrderSummary(order: OrderWithProduct) {
    return {
      id: order.id,
      workspaceId: order.workspaceId,
      orderNo: order.orderNo,
      provider: order.provider,
      status: order.status,
      subject: order.subject,
      amountCents: order.amountCents,
      currency: order.currency,
      billingCycle: order.billingCycle,
      productCode: order.product.code,
      productName: order.product.name,
      seatCount: order.seatCount,
      periodStart: order.periodStart?.toISOString(),
      periodEnd: order.periodEnd?.toISOString(),
      paymentUrl: order.paymentUrl ?? undefined,
      providerTradeNo: order.providerTradeNo ?? undefined,
      paidAt: order.paidAt?.toISOString(),
      expiresAt: order.expiresAt?.toISOString(),
      closedAt: order.closedAt?.toISOString(),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString()
    };
  }

  private toWorkspaceType(value: string): 'personal' | 'enterprise' {
    return value === 'ENTERPRISE' ? 'enterprise' : 'personal';
  }

  private toJsonObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private requireRecord(input: unknown, label: string): Record<string, unknown> {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${label} must be an object.`
        }
      });
    }

    return input as Record<string, unknown>;
  }

  private requireString(value: unknown, fieldName: string): string {
    const normalized = this.optionalString(value, fieldName);
    if (!normalized) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${fieldName} must be a non-empty string.`
        }
      });
    }

    return normalized;
  }

  private optionalString(value: unknown, fieldName: string): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${fieldName} must be a string.`
        }
      });
    }

    const normalized = value.trim();
    return normalized ? normalized : undefined;
  }

  private optionalBoundedInteger(value: unknown, fieldName: string, min: number, max: number): number | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${fieldName} must be an integer between ${min} and ${max}.`
        }
      });
    }

    return value;
  }

  private requireEnum<T extends string>(value: unknown, fieldName: string, allowed: readonly T[]): T {
    if (typeof value !== 'string' || !allowed.includes(value.trim() as T)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: `${fieldName} must be one of: ${allowed.join(', ')}.`
        }
      });
    }

    return value.trim() as T;
  }
}
