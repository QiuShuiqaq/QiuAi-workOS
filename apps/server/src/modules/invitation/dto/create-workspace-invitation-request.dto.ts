import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class CreateWorkspaceInvitationRequestDto {
  @ApiProperty({ example: 'ops2@qiuai.local' })
  @IsEmail()
  email!: string;

  @ApiPropertyOptional({ enum: ['admin', 'member', 'viewer'], default: 'member' })
  @IsOptional()
  systemRole?: 'admin' | 'member' | 'viewer';

  @ApiPropertyOptional({ example: 'dept_operations', nullable: true })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ example: 7, minimum: 1, maximum: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  expiresInDays?: number;
}
