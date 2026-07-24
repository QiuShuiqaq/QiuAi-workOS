import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminRoleTemplateSkillDto {
  @ApiProperty({ example: 'lead_research' })
  code!: string;

  @ApiProperty({ example: '线索研究' })
  name!: string;

  @ApiProperty({ example: '搜索并整理潜在线索背景。' })
  summary!: string;
}

export class AdminRoleTemplateDetailDto {
  @ApiProperty({ example: 'template_sales_assist' })
  id!: string;

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: 'AI 销售助理' })
  name!: string;

  @ApiProperty({ example: '销售支持' })
  industry!: string;

  @ApiProperty({ example: '线索研究、外联文案和提案支撑' })
  scenario!: string;

  @ApiProperty({ example: '协助销售搜集线索、整理卖点并输出跟进文案。' })
  description!: string;

  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  recommendedPlanCode!: string;

  @ApiProperty({ example: '帮助销售快速完成线索研究和外联准备。' })
  businessGoal!: string;

  @ApiProperty({ type: [String] })
  knowledgeSources!: string[];

  @ApiProperty({ type: [String] })
  tools!: string[];

  @ApiProperty({ type: [AdminRoleTemplateSkillDto] })
  skills!: AdminRoleTemplateSkillDto[];

  @ApiProperty({ example: '正式对外发送前需要销售负责人确认。' })
  approvalPolicy!: string;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiProperty({ type: [String], example: ['ENTERPRISE_BASIC_MONTHLY'] })
  allowedPlanCodes!: string[];

  @ApiProperty({ type: [String], example: [] })
  visibleWorkspaceIds!: string[];

  @ApiPropertyOptional({ example: '2026-07-24T00:00:00.000Z' })
  publishedAt?: string;

  @ApiPropertyOptional({ example: '2026-07-24T00:00:00.000Z' })
  lastTestedAt?: string;

  @ApiProperty({ example: '2026-07-24T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-24T00:00:00.000Z' })
  updatedAt!: string;
}

export class ListAdminRoleTemplatesResponseDto {
  @ApiProperty({ type: [AdminRoleTemplateDetailDto] })
  data!: AdminRoleTemplateDetailDto[];
}

export class GetAdminRoleTemplateResponseDto {
  @ApiProperty({ type: AdminRoleTemplateDetailDto })
  data!: AdminRoleTemplateDetailDto;
}

export class AdminRoleTemplateSkillInputDto {
  @ApiProperty({ example: 'lead_research' })
  @IsString()
  @MinLength(1)
  code!: string;

  @ApiProperty({ example: '线索研究' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '搜索并整理潜在线索背景。' })
  @IsString()
  @MinLength(1)
  summary!: string;
}

export class CreateAdminRoleTemplateRequestDto {
  @ApiProperty({ example: 'template_sales_assist' })
  @IsString()
  @MinLength(1)
  id!: string;

  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MinLength(1)
  version!: string;

  @ApiProperty({ example: 'AI 销售助理' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '销售支持' })
  @IsString()
  @MinLength(1)
  industry!: string;

  @ApiProperty({ example: '线索研究、外联文案和提案支撑' })
  @IsString()
  @MinLength(1)
  scenario!: string;

  @ApiProperty({ example: '协助销售搜集线索、整理卖点并输出跟进文案。' })
  @IsString()
  @MinLength(1)
  description!: string;

  @ApiProperty({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  @IsString()
  @MinLength(1)
  recommendedPlanCode!: string;

  @ApiProperty({ example: '帮助销售快速完成线索研究和外联准备。' })
  @IsString()
  @MinLength(1)
  businessGoal!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  knowledgeSources!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  tools!: string[];

  @ApiProperty({ type: [AdminRoleTemplateSkillInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminRoleTemplateSkillInputDto)
  skills!: AdminRoleTemplateSkillInputDto[];

  @ApiProperty({ example: '正式对外发送前需要销售负责人确认。' })
  @IsString()
  @MinLength(1)
  approvalPolicy!: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPlanCodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleWorkspaceIds?: string[];
}

export class UpdateAdminRoleTemplateRequestDto {
  @ApiPropertyOptional({ example: '1.0.1' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  version?: string;

  @ApiPropertyOptional({ example: 'AI 销售助理' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: '销售支持' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  industry?: string;

  @ApiPropertyOptional({ example: '线索研究、外联文案和提案支撑' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  scenario?: string;

  @ApiPropertyOptional({ example: '协助销售搜集线索、整理卖点并输出跟进文案。' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  description?: string;

  @ApiPropertyOptional({ example: 'ENTERPRISE_BASIC_MONTHLY' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  recommendedPlanCode?: string;

  @ApiPropertyOptional({ example: '帮助销售快速完成线索研究和外联准备。' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  businessGoal?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  knowledgeSources?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tools?: string[];

  @ApiPropertyOptional({ type: [AdminRoleTemplateSkillInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminRoleTemplateSkillInputDto)
  skills?: AdminRoleTemplateSkillInputDto[];

  @ApiPropertyOptional({ example: '正式对外发送前需要销售负责人确认。' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  approvalPolicy?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedPlanCodes?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  visibleWorkspaceIds?: string[];
}

export class CreateAdminRoleTemplateResponseDto {
  @ApiProperty({ type: AdminRoleTemplateDetailDto })
  data!: AdminRoleTemplateDetailDto;
}

export class UpdateAdminRoleTemplateResponseDto {
  @ApiProperty({ type: AdminRoleTemplateDetailDto })
  data!: AdminRoleTemplateDetailDto;
}

export class PublishAdminRoleTemplateResponseDto {
  @ApiProperty({ type: AdminRoleTemplateDetailDto })
  data!: AdminRoleTemplateDetailDto;
}

export class ArchiveAdminRoleTemplateResponseDto {
  @ApiProperty({ type: AdminRoleTemplateDetailDto })
  data!: AdminRoleTemplateDetailDto;
}

export class TestAdminRoleTemplateRequestDto {
  @ApiPropertyOptional({ example: '请帮我研究这个客户并输出跟进话术。' })
  @IsOptional()
  @IsString()
  sampleInput?: string;

  @ApiPropertyOptional({ example: '20000000-0000-4000-8000-000000000002' })
  @IsOptional()
  @IsString()
  sampleWorkspaceId?: string;
}

export class TestAdminRoleTemplateResponseDto {
  @ApiProperty({
    example: {
      templateId: 'template_sales_assist',
      valid: true,
      status: 'passed',
      message: 'Template passed basic factory validation.',
      warnings: [],
      sampleInput: '请帮我研究这个客户并输出跟进话术。'
    }
  })
  data!: {
    templateId: string;
    valid: boolean;
    status: 'passed' | 'failed';
    message: string;
    warnings: string[];
    sampleInput?: string;
  };
}
