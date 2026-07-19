import { ApiProperty } from '@nestjs/swagger';

export class KernelPlanSummary {
  @ApiProperty({ example: 'PERSONAL_FREE' })
  code!: string;

  @ApiProperty({ example: 'Personal Free' })
  name!: string;

  @ApiProperty({ example: 'FREE' })
  billingCycle!: string;
}

export class KernelStatusResponse {
  @ApiProperty({ example: 'ready' })
  status!: 'ready';

  @ApiProperty({ example: 'platform-kernel-v1' })
  dataModelVersion!: string;

  @ApiProperty({ example: 'postgresql' })
  databaseProvider!: string;

  @ApiProperty({ example: 'mock', required: false })
  persistenceMode?: 'mock' | 'database';

  @ApiProperty({ example: true, required: false })
  databaseReady?: boolean;

  @ApiProperty({ example: '6.19.3' })
  prismaClientVersion!: string;

  @ApiProperty({ type: [KernelPlanSummary] })
  plans!: KernelPlanSummary[];

  @ApiProperty({ example: 4, required: false })
  databasePlanCount?: number;

  @ApiProperty({ example: 2, required: false })
  databaseTenantCount?: number;

  @ApiProperty({ example: 2, required: false })
  databaseWorkspaceCount?: number;
}
