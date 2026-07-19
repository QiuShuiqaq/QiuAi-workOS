import { ApiProperty } from '@nestjs/swagger';

import { PlanDetailDto } from '../../commercial/dto/list-plans-response.dto';
import { WorkspaceSummaryDto } from '../../workspace/dto/current-account-response.dto';
import type { PlanCode } from '../../../shared/types/plan-code';

export class OrganizationSummaryDto {
  @ApiProperty({ example: 'org_enterprise' })
  id!: string;

  @ApiProperty({ example: 'tenant_enterprise' })
  tenantId!: string;

  @ApiProperty({ example: 'enterprise' })
  workspaceId!: string;

  @ApiProperty({ example: '秋壹科技' })
  name!: string;

  @ApiProperty({ example: '内容运营与企业服务', required: false })
  industry?: string;

  @ApiProperty({ example: '50-200人', required: false })
  size?: string;

  @ApiProperty({ example: 'active' })
  status!: 'active' | 'suspended' | 'archived';

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt!: string;
}

export class DepartmentSummaryDto {
  @ApiProperty({ example: 'dept_operations' })
  id!: string;

  @ApiProperty({ example: 'org_enterprise' })
  organizationId!: string;

  @ApiProperty({ example: 'dept_growth', required: false })
  parentDepartmentId?: string;

  @ApiProperty({ example: '增长运营部', required: false })
  parentDepartmentName?: string;

  @ApiProperty({ example: '运营部' })
  name!: string;

  @ApiProperty({ example: 'member_ops_lead', required: false })
  ownerUserId?: string;

  @ApiProperty({ example: '王运营', required: false })
  ownerName?: string;

  @ApiProperty({ example: 2 })
  memberCount!: number;

  @ApiProperty({ example: 1 })
  roleInstanceCount!: number;

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z' })
  createdAt!: string;
}

export class MemberSummaryDto {
  @ApiProperty({ example: 'member_ops_lead' })
  id!: string;

  @ApiProperty({ example: 'account_ops_lead' })
  accountId!: string;

  @ApiProperty({ example: '王运营' })
  name!: string;

  @ApiProperty({ example: 'ops@qiuai.local' })
  email!: string;

  @ApiProperty({ example: 'dept_operations', required: false })
  departmentId?: string;

  @ApiProperty({ example: '运营部', required: false })
  departmentName?: string;

  @ApiProperty({ example: 'admin' })
  systemRole!: 'owner' | 'admin' | 'member' | 'viewer';

  @ApiProperty({ example: 'active' })
  status!: 'active' | 'invited' | 'disabled';

  @ApiProperty({ example: '2026-07-02T00:00:00.000Z' })
  joinedAt!: string;
}

export class SubscriptionSummaryDto {
  @ApiProperty({ example: 'sub_enterprise' })
  id!: string;

  @ApiProperty({ example: 'enterprise' })
  workspaceId!: string;

  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  planCode!: PlanCode;

  @ApiProperty({ example: 'active' })
  status!: 'free' | 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired';

  @ApiProperty({ example: 'monthly' })
  billingCycle!: 'free' | 'monthly' | 'annual' | 'custom';

  @ApiProperty({ example: '2026-07-01T00:00:00.000Z', required: false })
  currentPeriodStart?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', required: false })
  currentPeriodEnd?: string;

  @ApiProperty({ example: false })
  cancelAtPeriodEnd!: boolean;
}

export class UsageMeterSummaryDto {
  @ApiProperty({ example: 'roleInstances.count' })
  metricKey!: string;

  @ApiProperty({ example: 'AI 岗位数量' })
  title!: string;

  @ApiProperty({ example: 3 })
  usedValue!: number;

  @ApiProperty({ example: 50, required: false })
  limitValue?: number;

  @ApiProperty({ example: 'count', required: false })
  limitUnit?: string;
}

export class EnterpriseWorkspaceOverviewResponseDto {
  @ApiProperty({ type: WorkspaceSummaryDto })
  workspace!: WorkspaceSummaryDto;

  @ApiProperty({ type: OrganizationSummaryDto, required: false, nullable: true })
  organization!: OrganizationSummaryDto | null;

  @ApiProperty({ type: PlanDetailDto })
  plan!: PlanDetailDto;

  @ApiProperty({ type: SubscriptionSummaryDto })
  subscription!: SubscriptionSummaryDto;

  @ApiProperty({ type: [DepartmentSummaryDto] })
  departments!: DepartmentSummaryDto[];

  @ApiProperty({ type: [MemberSummaryDto] })
  members!: MemberSummaryDto[];

  @ApiProperty({ type: [UsageMeterSummaryDto] })
  usage!: UsageMeterSummaryDto[];
}

export class GetEnterpriseWorkspaceOverviewResponseDto {
  @ApiProperty({ type: EnterpriseWorkspaceOverviewResponseDto })
  data!: EnterpriseWorkspaceOverviewResponseDto;
}

export class CreateDepartmentResponseDto {
  @ApiProperty({ type: DepartmentSummaryDto })
  data!: DepartmentSummaryDto;
}
