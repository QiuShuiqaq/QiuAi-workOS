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

  @ApiProperty({ example: 29900, required: false })
  @IsOptional()
  @IsNumber()
  @Min(1)
  amountCents?: number;

  @ApiProperty({ example: 'CNY', required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ example: 'QiuAI WorkOS Enterprise Basic Monthly', required: false })
  @IsOptional()
  @IsString()
  subject?: string;
}
