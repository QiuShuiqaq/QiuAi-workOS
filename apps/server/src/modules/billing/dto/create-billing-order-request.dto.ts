import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateBillingOrderRequestDto {
  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY', required: false })
  @IsOptional()
  @IsString()
  planCode?: string;

  @ApiProperty({ example: 'AI_POINTS', required: false, enum: ['PLAN', 'AI_POINTS'] })
  @IsOptional()
  @IsIn(['PLAN', 'AI_POINTS'])
  orderKind?: 'PLAN' | 'AI_POINTS';

  @ApiProperty({ example: 10000, required: false, description: 'AI points to purchase.' })
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(1_000_000)
  aiPointAmount?: number;

  @ApiProperty({ example: 'ALIPAY', required: false })
  @IsOptional()
  @IsIn(['ALIPAY'])
  provider?: 'ALIPAY';

  @ApiProperty({ example: 28800, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amountCents?: number;

  @ApiProperty({ example: 'CNY', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'QiuAI WorkOS 企业基础版（月付）', required: false })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({ example: 'QIUAI8K2P', required: false })
  @IsOptional()
  @IsString()
  referralCode?: string;
}
