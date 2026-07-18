import { ApiProperty } from '@nestjs/swagger';

export class EntitlementSummaryDto {
  @ApiProperty({ example: 'maxRoleInstances' })
  featureKey!: string;

  @ApiProperty({ example: true })
  enabled!: boolean;

  @ApiProperty({ example: 3, required: false })
  limitValue?: number;

  @ApiProperty({ example: 'count', required: false })
  limitUnit?: string;
}

export class PlanDetailDto {
  @ApiProperty({ example: 'PERSONAL_FREE' })
  code!: string;

  @ApiProperty({ example: 'Personal Free' })
  name!: string;

  @ApiProperty({ example: 'FREE' })
  billingCycle!: string;

  @ApiProperty({ example: 0, required: false })
  priceCents?: number;

  @ApiProperty({ example: 'CNY', required: false })
  currency?: string;

  @ApiProperty({ example: '个人免费版，支持基础 AI 员工搭建。', required: false })
  description?: string;

  @ApiProperty({ type: [EntitlementSummaryDto] })
  entitlements!: EntitlementSummaryDto[];
}

export class ListPlansResponseDto {
  @ApiProperty({ type: [PlanDetailDto] })
  data!: PlanDetailDto[];
}
