import { ApiProperty } from '@nestjs/swagger';

export class CurrentAccountDto {
  @ApiProperty({ example: 'account_demo' })
  id!: string;

  @ApiProperty({ example: 'admin@qiuai.local' })
  primaryEmail!: string;

  @ApiProperty({ example: 'active' })
  status!: 'active' | 'disabled';
}

export class WorkspaceSummaryDto {
  @ApiProperty({ example: 'enterprise' })
  id!: string;

  @ApiProperty({ example: 'tenant_enterprise' })
  tenantId!: string;

  @ApiProperty({ example: 'enterprise' })
  workspaceType!: 'personal' | 'enterprise';

  @ApiProperty({ example: '秋艾科技' })
  name!: string;

  @ApiProperty({ example: 'account_demo' })
  ownerAccountId!: string;

  @ApiProperty({ example: 'active' })
  status!: 'active' | 'suspended' | 'archived';

  @ApiProperty({ example: 'ENTERPRISE_MONTHLY' })
  planCode!: string;
}

export class CurrentAccountResponseDto {
  @ApiProperty({ type: CurrentAccountDto })
  account!: CurrentAccountDto;

  @ApiProperty({ type: [WorkspaceSummaryDto] })
  workspaces!: WorkspaceSummaryDto[];

  @ApiProperty({ example: 'enterprise' })
  activeWorkspaceId!: string;
}
