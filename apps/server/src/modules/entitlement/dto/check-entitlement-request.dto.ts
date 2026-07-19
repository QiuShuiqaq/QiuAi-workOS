import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { ENTITLEMENT_KEYS, type EntitlementKey } from '../../../shared/types/entitlement-key';

export class CheckEntitlementRequestDto {
  @ApiProperty({ example: 'enterprise' })
  @IsString()
  workspaceId!: string;

  @ApiProperty({ example: 'canCreateDepartment', enum: ENTITLEMENT_KEYS })
  @IsIn(ENTITLEMENT_KEYS)
  featureKey!: EntitlementKey;

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  requestedAmount?: number;
}
