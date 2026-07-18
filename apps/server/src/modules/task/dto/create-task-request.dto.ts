import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

export class CreateTaskRequestDto {
  @ApiProperty({ example: 'role_case_ops' })
  @IsString()
  roleInstanceId!: string;

  @ApiProperty({ example: '新案例素材分析' })
  @IsString()
  title!: string;

  @ApiProperty({ example: 'case_screening' })
  @IsString()
  taskType!: string;

  @ApiProperty({ example: '请分析今天上传的案例素材。' })
  @IsString()
  input!: string;

  @ApiProperty({ example: 'normal', required: false })
  @IsOptional()
  @IsIn(['low', 'normal', 'high', 'urgent'])
  priority?: 'low' | 'normal' | 'high' | 'urgent';
}
