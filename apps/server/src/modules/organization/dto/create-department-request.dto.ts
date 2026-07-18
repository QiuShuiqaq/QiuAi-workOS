import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateDepartmentRequestDto {
  @ApiProperty({ example: '增长运营部' })
  @IsString()
  name!: string;

  @ApiProperty({ example: 'dept_operations', required: false })
  @IsOptional()
  @IsString()
  parentDepartmentId?: string;

  @ApiProperty({ example: 'member_ops_lead', required: false })
  @IsOptional()
  @IsString()
  ownerUserId?: string;
}
