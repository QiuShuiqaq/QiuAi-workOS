import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginRequestDto {
  @ApiProperty({ example: 'admin@qiuai.local' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'qiuai-demo' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  rememberMe?: boolean;
}
