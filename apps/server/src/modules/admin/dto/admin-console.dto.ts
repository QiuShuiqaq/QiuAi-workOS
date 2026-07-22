import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  BillingAccountSummaryDto,
  BillingOrderSummaryDto,
  BillingSubscriptionSummaryDto
} from '../../billing/dto/billing-overview-response.dto';

export class AdminEntitlementDto {
  @ApiProperty({ example: 'maxRoleInstances' })
  featureKey!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 10, required: false })
  limitValue?: number;

  @ApiProperty({ example: 'count', required: false })
  limitUnit?: string;
}

export class AdminPlanDetailDto {
  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  code!: string;

  @ApiProperty({ example: 'Enterprise Basic Monthly' })
  name!: string;

  @ApiProperty({ example: 'MONTHLY' })
  billingCycle!: string;

  @ApiProperty({ example: 29900, required: false })
  priceCents?: number;

  @ApiProperty({ example: 'CNY', required: false })
  currency?: string;

  @ApiProperty({ example: 'Basic enterprise workspace for small teams.', required: false })
  description?: string;

  @ApiProperty({ enum: ['ACTIVE', 'ARCHIVED'] })
  status!: 'ACTIVE' | 'ARCHIVED';

  @ApiProperty({ type: [AdminEntitlementDto] })
  entitlements!: AdminEntitlementDto[];
}

export class ListAdminPlansResponseDto {
  @ApiProperty({ type: [AdminPlanDetailDto] })
  data!: AdminPlanDetailDto[];
}

export class AdminEntitlementInputDto {
  @ApiProperty({ example: 'maxRoleInstances' })
  @IsString()
  featureKey!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled!: boolean;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  limitValue?: number;

  @ApiPropertyOptional({ example: 'count' })
  @IsOptional()
  @IsString()
  limitUnit?: string;
}

export class UpdateAdminPlanRequestDto {
  @ApiPropertyOptional({ example: 'Enterprise Basic Monthly' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Basic enterprise workspace for small teams.', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 29900, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  priceCents?: number | null;

  @ApiPropertyOptional({ example: 'CNY', nullable: true })
  @IsOptional()
  @IsString()
  currency?: string | null;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'ARCHIVED';

  @ApiPropertyOptional({ type: [AdminEntitlementInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminEntitlementInputDto)
  entitlements?: AdminEntitlementInputDto[];
}

export class UpdateAdminPlanResponseDto {
  @ApiProperty({ type: AdminPlanDetailDto })
  data!: AdminPlanDetailDto;
}

export class ListAdminWorkspacesQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;

  @ApiPropertyOptional({ example: 'Demo Enterprise' })
  @IsOptional()
  @IsString()
  query?: string;
}

export class AdminWorkspaceSummaryDto {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  id!: string;

  @ApiProperty({ example: '10000000-0000-4000-8000-000000000002' })
  tenantId!: string;

  @ApiProperty({ example: 'QiuAI Demo Tenant' })
  tenantName!: string;

  @ApiProperty({ enum: ['personal', 'enterprise'] })
  workspaceType!: 'personal' | 'enterprise';

  @ApiProperty({ example: 'QiuAI Demo Enterprise' })
  name!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001' })
  ownerAccountId!: string;

  @ApiProperty({ example: 'admin@qiuai.local' })
  ownerEmail!: string;

  @ApiProperty({ enum: ['active', 'suspended', 'archived'] })
  status!: 'active' | 'suspended' | 'archived';

  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  planCode!: string;

  @ApiProperty({ example: 'Enterprise Basic Monthly', required: false })
  planName?: string;

  @ApiProperty({ example: 'ACTIVE', required: false })
  subscriptionStatus?: string;

  @ApiProperty({ example: '2026-08-22T00:00:00.000Z', required: false })
  subscriptionPeriodEnd?: string;

  @ApiProperty({ example: 3 })
  memberCount!: number;

  @ApiProperty({ example: 2 })
  roleCount!: number;

  @ApiProperty({ example: 12 })
  taskCount!: number;

  @ApiProperty({ example: 1 })
  desktopDeviceCount!: number;

  @ApiProperty({ example: 4 })
  billingOrderCount!: number;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  updatedAt!: string;
}

export class AdminWorkspaceMemberSummaryDto {
  @ApiProperty({ example: '30000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001' })
  accountId!: string;

  @ApiProperty({ example: 'owner@example.com' })
  primaryEmail!: string;

  @ApiProperty({ enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] })
  role!: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

  @ApiPropertyOptional({ example: '50000000-0000-4000-8000-000000000001' })
  departmentId?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  departmentName?: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  createdAt!: string;
}

export class ListAdminWorkspacesResponseDto {
  @ApiProperty({ type: [AdminWorkspaceSummaryDto] })
  data!: AdminWorkspaceSummaryDto[];

  @ApiProperty({
    example: {
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1
    }
  })
  pagination!: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

export class CreateAdminWorkspaceRequestDto {
  @ApiProperty({ example: 'QiuAI Demo Enterprise' })
  @IsString()
  @MinLength(1)
  workspaceName!: string;

  @ApiProperty({ example: 'enterprise-admin@example.com' })
  @IsEmail()
  ownerEmail!: string;

  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  @Type(() => Number)
  durationDays?: number;

  @ApiPropertyOptional({ example: '2026-07-22T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2026-08-22T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  periodEnd?: string;

  @ApiPropertyOptional({ example: 'Temp@123456' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  ownerPassword?: string;

  @ApiPropertyOptional({ example: 'QiuAI Demo Enterprise Tenant' })
  @IsOptional()
  @IsString()
  tenantName?: string;

  @ApiPropertyOptional({ example: 'Digital workforce operations' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ example: '50-200' })
  @IsOptional()
  @IsString()
  size?: string;

  @ApiPropertyOptional({ example: 'Trial enterprise created by admin console.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class CreateAdminWorkspaceInvitationRequestDto {
  @ApiProperty({ example: 'member@example.com' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ['admin', 'member', 'viewer'], default: 'member' })
  @IsOptional()
  @IsIn(['admin', 'member', 'viewer'])
  systemRole?: 'admin' | 'member' | 'viewer';

  @ApiPropertyOptional({ example: '50000000-0000-4000-8000-000000000001', nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(30)
  @Type(() => Number)
  expiresInDays?: number;
}

export class AdminWorkspaceInvitationSummaryDto {
  @ApiProperty({ example: '90000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: 'member@example.com' })
  email!: string;

  @ApiProperty({ enum: ['admin', 'member', 'viewer'] })
  systemRole!: 'admin' | 'member' | 'viewer';

  @ApiPropertyOptional({ example: '50000000-0000-4000-8000-000000000001' })
  departmentId?: string;

  @ApiPropertyOptional({ example: 'Operations' })
  departmentName?: string;

  @ApiProperty({ enum: ['pending', 'accepted', 'cancelled', 'expired'] })
  status!: 'pending' | 'accepted' | 'cancelled' | 'expired';

  @ApiProperty({ example: '2026-07-29T00:00:00.000Z' })
  expiresAt!: string;

  @ApiPropertyOptional({ example: '2026-07-22T00:00:00.000Z' })
  acceptedAt?: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  createdAt!: string;
}

export class CreateAdminWorkspaceInvitationResponseDto {
  @ApiProperty({ type: AdminWorkspaceInvitationSummaryDto })
  data!: AdminWorkspaceInvitationSummaryDto;

  @ApiProperty({ example: 'https://workos.qiuaihub.com/invitations/token' })
  inviteUrl!: string;
}

export class CancelAdminWorkspaceInvitationResponseDto {
  @ApiProperty({ type: AdminWorkspaceInvitationSummaryDto })
  data!: AdminWorkspaceInvitationSummaryDto;
}

export class AdminDesktopDeviceSummaryDto {
  @ApiProperty({ example: '30000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: 'runtime_local' })
  runtimeId!: string;

  @ApiProperty({ example: 'device_local' })
  deviceId!: string;

  @ApiProperty({ example: 'Office PC' })
  deviceName!: string;

  @ApiProperty({ example: 'win32' })
  platform!: string;

  @ApiProperty({ example: '1.0.0' })
  appVersion!: string;

  @ApiProperty({ example: 'ACTIVE' })
  status!: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  boundAt!: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z', required: false })
  lastSeenAt?: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z', required: false })
  lastSyncedAt?: string;
}

export class AdminDesktopBindingCodeSummaryDto {
  @ApiProperty({ example: 'binding-id' })
  id!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ enum: ['PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED'] })
  status!: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';

  @ApiProperty({ example: '2026-07-22T00:10:00.000Z' })
  expiresAt!: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-07-22T00:05:00.000Z' })
  redeemedAt?: string;
}

export class CreateAdminDesktopBindingCodeRequestDto {
  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  @Type(() => Number)
  expiresInMinutes?: number;
}

export class CreateAdminDesktopBindingCodeResponseDto {
  @ApiProperty({ type: AdminDesktopBindingCodeSummaryDto })
  data!: AdminDesktopBindingCodeSummaryDto & {
    bindingCode: string;
  };
}

export class RevokeAdminDesktopDeviceResponseDto {
  @ApiProperty({ type: AdminDesktopDeviceSummaryDto })
  data!: AdminDesktopDeviceSummaryDto;
}

export class AdminWorkspaceDetailDto {
  @ApiProperty({ type: AdminWorkspaceSummaryDto })
  workspace!: AdminWorkspaceSummaryDto;

  @ApiProperty({ type: BillingSubscriptionSummaryDto, nullable: true })
  subscription!: BillingSubscriptionSummaryDto | null;

  @ApiProperty({ type: BillingAccountSummaryDto, nullable: true })
  billingAccount!: BillingAccountSummaryDto | null;

  @ApiProperty({ type: [AdminWorkspaceMemberSummaryDto] })
  members!: AdminWorkspaceMemberSummaryDto[];

  @ApiProperty({ type: [AdminWorkspaceInvitationSummaryDto] })
  invitations!: AdminWorkspaceInvitationSummaryDto[];

  @ApiProperty({ type: [BillingOrderSummaryDto] })
  recentOrders!: BillingOrderSummaryDto[];

  @ApiProperty({ type: [AdminDesktopDeviceSummaryDto] })
  desktopDevices!: AdminDesktopDeviceSummaryDto[];

  @ApiProperty({ type: [AdminDesktopBindingCodeSummaryDto] })
  desktopBindingCodes!: AdminDesktopBindingCodeSummaryDto[];
}

export class GetAdminWorkspaceResponseDto {
  @ApiProperty({ type: AdminWorkspaceDetailDto })
  data!: AdminWorkspaceDetailDto;
}

export class CreateAdminWorkspaceResponseDto {
  @ApiProperty({ type: AdminWorkspaceDetailDto })
  data!: AdminWorkspaceDetailDto;

  @ApiProperty({
    example: {
      id: '00000000-0000-4000-8000-000000000005',
      primaryEmail: 'enterprise-admin@example.com',
      passwordMode: 'generated'
    }
  })
  ownerAccount!: {
    id: string;
    primaryEmail: string;
    passwordMode: 'existing' | 'provided' | 'generated';
  };

  @ApiPropertyOptional({ example: 'Temp@123456' })
  temporaryPassword?: string;
}

export class GrantAdminWorkspaceAuthorizationRequestDto {
  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  @IsString()
  planCode!: string;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  @Type(() => Number)
  durationDays?: number;

  @ApiPropertyOptional({ example: '2026-07-22T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  periodStart?: string;

  @ApiPropertyOptional({ example: '2026-08-22T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  periodEnd?: string;

  @ApiProperty({ example: 'pilot' })
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({ example: '30-day pilot authorization before Alipay full rollout.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class GrantAdminWorkspaceAuthorizationResponseDto {
  @ApiProperty({ type: AdminWorkspaceDetailDto })
  data!: AdminWorkspaceDetailDto;
}

export class UpdateAdminWorkspaceStatusRequestDto {
  @ApiProperty({ enum: ['ACTIVE', 'SUSPENDED', 'ARCHIVED'] })
  @IsIn(['ACTIVE', 'SUSPENDED', 'ARCHIVED'])
  status!: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';

  @ApiProperty({ example: 'pilot ended' })
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({ example: 'Customer requested a pause before renewal.' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateAdminWorkspaceStatusResponseDto {
  @ApiProperty({ type: AdminWorkspaceDetailDto })
  data!: AdminWorkspaceDetailDto;
}

export class ListAdminActionLogsQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  pageSize?: number;

  @ApiPropertyOptional({ example: 'MANUAL_AUTHORIZE_WORKSPACE' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'workspace' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({ example: 'QiuAI Demo Enterprise' })
  @IsOptional()
  @IsString()
  query?: string;
}

export class AdminActionLogSummaryDto {
  @ApiProperty({ example: '40000000-0000-4000-8000-000000000001' })
  id!: string;

  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001', required: false })
  operatorAccountId?: string;

  @ApiProperty({ example: 'admin@qiuai.local', required: false })
  operatorEmail?: string;

  @ApiProperty({ example: 'MANUAL_AUTHORIZE_WORKSPACE' })
  action!: string;

  @ApiProperty({ example: 'workspace' })
  targetType!: string;

  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  targetId!: string;

  @ApiProperty({ example: 'Manual authorization for QiuAI Demo Enterprise to ENTERPRISE_BASIC_MONTHLY' })
  summary!: string;

  @ApiPropertyOptional({ example: { reason: 'pilot' } })
  metadata?: Record<string, unknown>;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  createdAt!: string;
}

export class ListAdminActionLogsResponseDto {
  @ApiProperty({ type: [AdminActionLogSummaryDto] })
  data!: AdminActionLogSummaryDto[];

  @ApiProperty({
    example: {
      page: 1,
      pageSize: 20,
      totalItems: 1,
      totalPages: 1
    }
  })
  pagination!: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}
