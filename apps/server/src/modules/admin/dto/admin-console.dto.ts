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

  @ApiProperty({ example: '企业基础版（月付）' })
  name!: string;

  @ApiProperty({ example: 'MONTHLY' })
  billingCycle!: string;

  @ApiProperty({ example: 28800, required: false })
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

export class DesktopReleaseSummaryDto {
  @ApiProperty({ example: 'release-id' })
  id!: string;

  @ApiProperty({ example: '1.0.1' })
  version!: string;

  @ApiProperty({ enum: ['windows'], example: 'windows' })
  platform!: 'windows';

  @ApiProperty({ enum: ['stable'], example: 'stable' })
  channel!: 'stable';

  @ApiProperty({ example: 'https://workos.qiuaihub.com/downloads/QiuAI-WorkOS-1.0.1.exe' })
  downloadUrl!: string;

  @ApiPropertyOptional({ example: 'Improved workflow execution and desktop stability.' })
  releaseNotes?: string;

  @ApiPropertyOptional({ example: 'sha256-hex' })
  checksumSha256?: string;

  @ApiPropertyOptional({ example: 104857600 })
  fileSizeBytes?: number;

  @ApiProperty({ example: false })
  forceUpdate!: boolean;

  @ApiPropertyOptional({ example: '1.0.0' })
  minimumSupportedVersion?: string;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'], example: 'DRAFT' })
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ example: '2026-07-26T00:00:00.000Z' })
  publishedAt?: string;

  @ApiProperty({ example: '2026-07-26T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-26T00:00:00.000Z' })
  updatedAt!: string;
}

export class ListAdminDesktopReleasesQueryDto {
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

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ enum: ['windows'] })
  @IsOptional()
  @IsIn(['windows'])
  platform?: 'windows';

  @ApiPropertyOptional({ enum: ['stable'] })
  @IsOptional()
  @IsIn(['stable'])
  channel?: 'stable';
}

export class ListAdminDesktopReleasesResponseDto {
  @ApiProperty({ type: [DesktopReleaseSummaryDto] })
  data!: DesktopReleaseSummaryDto[];

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

export class CreateAdminDesktopReleaseRequestDto {
  @ApiProperty({ example: '1.0.1' })
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiPropertyOptional({ enum: ['windows'] })
  @IsOptional()
  @IsIn(['windows'])
  platform?: 'windows';

  @ApiPropertyOptional({ enum: ['stable'] })
  @IsOptional()
  @IsIn(['stable'])
  channel?: 'stable';

  @ApiProperty({ example: 'https://workos.qiuaihub.com/downloads/QiuAI-WorkOS-1.0.1.exe' })
  @IsString()
  @MinLength(1)
  downloadUrl!: string;

  @ApiPropertyOptional({ example: 'Release notes shown to desktop users.' })
  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @ApiPropertyOptional({ example: 'sha256-hex' })
  @IsOptional()
  @IsString()
  checksumSha256?: string;

  @ApiPropertyOptional({ example: 104857600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fileSizeBytes?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  minimumSupportedVersion?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class CreateAdminDesktopReleaseResponseDto {
  @ApiProperty({ type: DesktopReleaseSummaryDto })
  data!: DesktopReleaseSummaryDto;
}

export class UpdateAdminDesktopReleaseRequestDto {
  @ApiPropertyOptional({ example: '1.0.1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  version?: string;

  @ApiPropertyOptional({ enum: ['windows'] })
  @IsOptional()
  @IsIn(['windows'])
  platform?: 'windows';

  @ApiPropertyOptional({ enum: ['stable'] })
  @IsOptional()
  @IsIn(['stable'])
  channel?: 'stable';

  @ApiPropertyOptional({ example: 'https://workos.qiuaihub.com/downloads/QiuAI-WorkOS-1.0.1.exe' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  downloadUrl?: string;

  @ApiPropertyOptional({ example: 'Release notes shown to desktop users.', nullable: true })
  @IsOptional()
  @IsString()
  releaseNotes?: string | null;

  @ApiPropertyOptional({ example: 'sha256-hex', nullable: true })
  @IsOptional()
  @IsString()
  checksumSha256?: string | null;

  @ApiPropertyOptional({ example: 104857600, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  fileSizeBytes?: number | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @ApiPropertyOptional({ example: '1.0.0', nullable: true })
  @IsOptional()
  @IsString()
  minimumSupportedVersion?: string | null;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}

export class UpdateAdminDesktopReleaseResponseDto {
  @ApiProperty({ type: DesktopReleaseSummaryDto })
  data!: DesktopReleaseSummaryDto;
}

export class PublishAdminDesktopReleaseResponseDto {
  @ApiProperty({ type: DesktopReleaseSummaryDto })
  data!: DesktopReleaseSummaryDto;
}

export class ArchiveAdminDesktopReleaseResponseDto {
  @ApiProperty({ type: DesktopReleaseSummaryDto })
  data!: DesktopReleaseSummaryDto;
}

export class DesktopReleaseAssetSummaryDto {
  @ApiProperty({ example: '1784708089422-a1b2c3d4-QiuAI-WorkOS-1.0.1.exe' })
  fileName!: string;

  @ApiProperty({ example: 'QiuAI-WorkOS-1.0.1.exe' })
  originalFileName!: string;

  @ApiProperty({
    example: 'https://workos.qiuaihub.com/api/v1/desktop/releases/downloads/1784708089422-a1b2c3d4-QiuAI-WorkOS-1.0.1.exe'
  })
  downloadUrl!: string;

  @ApiProperty({ example: 'sha256-hex' })
  checksumSha256!: string;

  @ApiProperty({ example: 104857600 })
  fileSizeBytes!: number;

  @ApiProperty({ example: 'application/vnd.microsoft.portable-executable' })
  contentType!: string;
}

export class UploadAdminDesktopReleaseAssetResponseDto {
  @ApiProperty({ type: DesktopReleaseAssetSummaryDto })
  data!: DesktopReleaseAssetSummaryDto;
}

export class DesktopIssueMessageSummaryDto {
  @ApiProperty({ example: 'issue-id' })
  id!: string;

  @ApiProperty({ example: 'ISSUE-20260802-A1B2C3' })
  issueNo!: string;

  @ApiProperty({ enum: ['BUG', 'USAGE', 'FEATURE_REQUEST', 'BAD_OUTPUT', 'OTHER'] })
  category!: 'BUG' | 'USAGE' | 'FEATURE_REQUEST' | 'BAD_OUTPUT' | 'OTHER';

  @ApiProperty({ enum: ['NORMAL', 'IMPACTING', 'BLOCKING'] })
  severity!: 'NORMAL' | 'IMPACTING' | 'BLOCKING';

  @ApiProperty({ enum: ['NEW', 'VIEWED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'] })
  status!: 'NEW' | 'VIEWED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'CLOSED';

  @ApiProperty({ example: '桌面端运行任务失败' })
  title!: string;

  @ApiProperty({ example: '用户描述的问题详情。' })
  description!: string;

  @ApiPropertyOptional({ example: 'user@example.com' })
  contact?: string;

  @ApiPropertyOptional({ example: 'workspace-id' })
  workspaceId?: string;

  @ApiPropertyOptional({ example: '企业名称' })
  workspaceName?: string;

  @ApiPropertyOptional({ example: 'runtime-id' })
  runtimeId?: string;

  @ApiPropertyOptional({ example: 'device-id' })
  deviceId?: string;

  @ApiPropertyOptional({ example: 'DESKTOP-01' })
  deviceName?: string;

  @ApiPropertyOptional({ example: '1.0.0' })
  appVersion?: string;

  @ApiPropertyOptional({ example: 'win32' })
  platform?: string;

  @ApiPropertyOptional({ example: { connectionState: 'online' } })
  diagnostics?: Record<string, unknown>;

  @ApiPropertyOptional({ example: '已安排修复。' })
  adminNote?: string;

  @ApiProperty({ example: '2026-08-02T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-08-02T00:00:00.000Z' })
  updatedAt!: string;
}

export class ListAdminIssueMessagesQueryDto {
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

  @ApiPropertyOptional({ example: '模型配置' })
  @IsOptional()
  @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: ['NEW', 'VIEWED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'] })
  @IsOptional()
  @IsIn(['NEW', 'VIEWED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'])
  status?: 'NEW' | 'VIEWED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'CLOSED';

  @ApiPropertyOptional({ enum: ['BUG', 'USAGE', 'FEATURE_REQUEST', 'BAD_OUTPUT', 'OTHER'] })
  @IsOptional()
  @IsIn(['BUG', 'USAGE', 'FEATURE_REQUEST', 'BAD_OUTPUT', 'OTHER'])
  category?: 'BUG' | 'USAGE' | 'FEATURE_REQUEST' | 'BAD_OUTPUT' | 'OTHER';

  @ApiPropertyOptional({ enum: ['NORMAL', 'IMPACTING', 'BLOCKING'] })
  @IsOptional()
  @IsIn(['NORMAL', 'IMPACTING', 'BLOCKING'])
  severity?: 'NORMAL' | 'IMPACTING' | 'BLOCKING';

  @ApiPropertyOptional({ example: 'workspace-id' })
  @IsOptional()
  @IsUUID()
  workspaceId?: string;
}

export class ListAdminIssueMessagesResponseDto {
  @ApiProperty({ type: [DesktopIssueMessageSummaryDto] })
  data!: DesktopIssueMessageSummaryDto[];

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

export class GetAdminIssueMessageResponseDto {
  @ApiProperty({ type: DesktopIssueMessageSummaryDto })
  data!: DesktopIssueMessageSummaryDto;
}

export class UpdateAdminIssueMessageRequestDto {
  @ApiPropertyOptional({ enum: ['NEW', 'VIEWED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'] })
  @IsOptional()
  @IsIn(['NEW', 'VIEWED', 'IN_PROGRESS', 'FIXED', 'WONT_FIX', 'CLOSED'])
  status?: 'NEW' | 'VIEWED' | 'IN_PROGRESS' | 'FIXED' | 'WONT_FIX' | 'CLOSED';

  @ApiPropertyOptional({ example: '内部处理备注。', nullable: true })
  @IsOptional()
  @IsString()
  adminNote?: string | null;
}

export class UpdateAdminIssueMessageResponseDto {
  @ApiProperty({ type: DesktopIssueMessageSummaryDto })
  data!: DesktopIssueMessageSummaryDto;
}

export class DeleteAdminIssueMessageResponseDto {
  @ApiProperty({
    example: {
      id: 'issue-id',
      deleted: true
    }
  })
  data!: {
    id: string;
    deleted: true;
  };
}

export class CheckDesktopUpdateQueryDto {
  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  currentVersion?: string;

  @ApiPropertyOptional({ enum: ['windows'] })
  @IsOptional()
  @IsIn(['windows'])
  platform?: 'windows';

  @ApiPropertyOptional({ enum: ['stable'] })
  @IsOptional()
  @IsIn(['stable'])
  channel?: 'stable';
}

export class CheckDesktopUpdateResponseDto {
  @ApiProperty({
    example: {
      currentVersion: '1.0.0',
      updateAvailable: true,
      forceUpdate: false
    }
  })
  data!: {
    currentVersion?: string;
    updateAvailable: boolean;
    forceUpdate: boolean;
    latestRelease?: DesktopReleaseSummaryDto;
  };
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
  @ApiPropertyOptional({ example: '企业基础版（月付）' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Basic enterprise workspace for small teams.', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 28800, nullable: true })
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

  @ApiProperty({ example: '企业基础版（月付）', required: false })
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

  @ApiPropertyOptional({ example: '财务电脑授权' })
  label?: string;

  @ApiProperty({ enum: ['PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED'] })
  status!: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';

  @ApiPropertyOptional({ example: '2026-07-22T00:10:00.000Z' })
  expiresAt?: string;

  @ApiProperty({ example: '2026-07-22T00:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({ example: '2026-07-22T00:05:00.000Z' })
  redeemedAt?: string;
}

export class CreateAdminDesktopBindingCodeRequestDto {
  @ApiPropertyOptional({ example: '财务电脑授权' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10080)
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

export class AdminAiPointWalletSummaryDto {
  @ApiProperty({ example: '20000000-0000-4000-8000-000000000002' })
  workspaceId!: string;

  @ApiProperty({ example: 10000 })
  balancePoints!: number;

  @ApiProperty({ example: 0 })
  reservedPoints!: number;

  @ApiProperty({ example: 10000 })
  availablePoints!: number;

  @ApiProperty({ example: '2026-08-14T00:00:00.000Z' })
  updatedAt!: string;
}

export class AdminWorkspaceDetailDto {
  @ApiProperty({ type: AdminWorkspaceSummaryDto })
  workspace!: AdminWorkspaceSummaryDto;

  @ApiProperty({ type: BillingSubscriptionSummaryDto, nullable: true })
  subscription!: BillingSubscriptionSummaryDto | null;

  @ApiProperty({ type: BillingAccountSummaryDto, nullable: true })
  billingAccount!: BillingAccountSummaryDto | null;

  @ApiProperty({ type: AdminAiPointWalletSummaryDto, nullable: true })
  aiPointWallet!: AdminAiPointWalletSummaryDto | null;

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

export class CreateAdminWorkspaceSupportLoginResponseDto {
  @ApiProperty({
    example: {
      workspaceId: '20000000-0000-4000-8000-000000000002',
      workspaceName: 'QiuAI Demo Enterprise',
      ownerEmail: 'enterprise-admin@example.com',
      webConsoleUrl: 'https://workos.qiuaihub.com/support-login?token=...&workspaceId=...',
      expiresAt: '2026-08-05T02:00:00.000Z'
    }
  })
  data!: {
    workspaceId: string;
    workspaceName: string;
    ownerEmail: string;
    webConsoleUrl: string;
    expiresAt: string;
  };
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

export class AdjustAdminWorkspaceAiPointsRequestDto {
  @ApiProperty({ example: 10000 })
  @IsInt()
  @Min(-100000000)
  @Max(100000000)
  @Type(() => Number)
  points!: number;

  @ApiProperty({ example: 'customer prepaid AI points' })
  @IsString()
  @MinLength(1)
  reason!: string;

  @ApiPropertyOptional({ example: '100 AI点 = 1 RMB' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class AdjustAdminWorkspaceAiPointsResponseDto {
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
