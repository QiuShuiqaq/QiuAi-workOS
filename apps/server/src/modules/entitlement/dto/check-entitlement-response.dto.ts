import { ApiProperty } from '@nestjs/swagger';

import type { EntitlementKey } from '../../../shared/types/entitlement-key';
import type { PlanCode } from '../../../shared/types/plan-code';

export class CheckEntitlementResponseDto {
  @ApiProperty({ example: true })
  allowed!: boolean;

  @ApiProperty({
    example: 'entitlement_required',
    required: false,
    enum: ['entitlement_required', 'quota_exceeded', 'subscription_inactive']
  })
  reason?: 'entitlement_required' | 'quota_exceeded' | 'subscription_inactive';

  @ApiProperty({ example: 'canCreateDepartment', required: false })
  featureKey?: EntitlementKey;

  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY', required: false })
  requiredPlan?: PlanCode;

  @ApiProperty({ example: 3, required: false })
  limitValue?: number;

  @ApiProperty({ example: 4, required: false })
  usedValue?: number;
}
