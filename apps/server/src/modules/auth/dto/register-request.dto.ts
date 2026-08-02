import { ApiProperty } from '@nestjs/swagger';
import { Equals, IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterRequestDto {
  @ApiProperty({ example: 'founder@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'qiuai-demo-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: '秋 AI 科技' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  workspaceName!: string;

  @ApiProperty({ example: true })
  @Equals(true)
  acceptedTerms!: boolean;
}
