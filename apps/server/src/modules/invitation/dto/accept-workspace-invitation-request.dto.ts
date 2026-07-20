import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class AcceptWorkspaceInvitationRequestDto {
  @ApiProperty({ example: 'qiuai-demo-password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  rememberMe?: boolean;
}
