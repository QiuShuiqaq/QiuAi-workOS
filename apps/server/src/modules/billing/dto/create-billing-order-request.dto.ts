import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateBillingOrderRequestDto {
  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  @IsString()
  planCode!: string;

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
