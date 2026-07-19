import { ApiProperty } from '@nestjs/swagger';

import type { PlanCode } from '../../../shared/types/plan-code';

export class AuthAccountSummaryDto {
  @ApiProperty({ example: 'account_demo' })
  id!: string;

  @ApiProperty({ example: 'admin@qiuai.local' })
  primaryEmail!: string;

  @ApiProperty({ example: 'active' })
  status!: 'active' | 'disabled';
}

export class AuthWorkspaceSummaryDto {
  @ApiProperty({ example: 'enterprise' })
  id!: string;

  @ApiProperty({ example: 'tenant_enterprise' })
  tenantId!: string;

  @ApiProperty({ example: 'enterprise' })
  workspaceType!: 'personal' | 'enterprise';

  @ApiProperty({ example: '秋壹科技' })
  name!: string;

  @ApiProperty({ example: 'account_demo' })
  ownerAccountId!: string;

  @ApiProperty({ example: 'active' })
  status!: 'active' | 'suspended' | 'archived';

  @ApiProperty({ example: 'ENTERPRISE_MONTHLY' })
  planCode!: PlanCode;
}

export class AuthSessionResponseDto {
  @ApiProperty({ example: true })
  authenticated!: boolean;

  @ApiProperty({ example: 'mock' })
  persistenceMode!: 'mock' | 'database';

  @ApiProperty({ type: AuthAccountSummaryDto, required: false })
  account?: AuthAccountSummaryDto;

  @ApiProperty({ type: [AuthWorkspaceSummaryDto], required: false })
  workspaces?: AuthWorkspaceSummaryDto[];

  @ApiProperty({ example: 'enterprise', required: false })
  activeWorkspaceId?: string;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z', required: false })
  expiresAt?: string;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  ok!: true;
}
