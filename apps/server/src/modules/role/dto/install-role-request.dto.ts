import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class InstallRoleRequestDto {
  @ApiProperty({ example: 'template_case_ops' })
  @IsString()
  templateId!: string;

  @ApiProperty({ example: 'AI案例运营专员', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: '运营部', required: false })
  @IsOptional()
  @IsString()
  departmentName?: string;
}
