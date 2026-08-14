import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class ValidateReferralCodeRequestDto {
  @ApiProperty({ example: 'QIUAI8K2P' })
  @IsString()
  @MaxLength(32)
  referralCode!: string;
}
