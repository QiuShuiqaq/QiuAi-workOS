import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
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

export class AdminRoleTemplateWorkflowStepDto {
  @ApiProperty({ example: 'receive_input' })
  id!: string;

  @ApiProperty({ example: 1 })
  order!: number;

  @ApiProperty({ enum: ['input', 'reasoning', 'knowledge', 'tool', 'approval', 'output'] })
  type!: 'input' | 'reasoning' | 'knowledge' | 'tool' | 'approval' | 'output';

  @ApiProperty({ example: '接收任务' })
  name!: string;

  @ApiProperty({ example: '确认用户输入、目标、边界和交付物要求。' })
  instruction!: string;

  @ApiPropertyOptional({ type: [String], example: ['web-search'] })
  toolIds?: string[];

  @ApiPropertyOptional({ example: true })
  requiresApproval?: boolean;
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

  @ApiProperty({ type: [AdminRoleTemplateWorkflowStepDto] })
  workflowSteps!: AdminRoleTemplateWorkflowStepDto[];

  @ApiPropertyOptional({ type: Object })
  workflowGraph?: unknown;

  @ApiProperty({ type: [String] })
  sampleInputs!: string[];

  @ApiProperty({ example: 'Markdown report with summary, findings, risks, next actions, and local artifact links.' })
  outputFormat!: string;

  @ApiProperty({ example: '正式对外发送前需要销售负责人确认。' })
  approvalPolicy!: string;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'ARCHIVED', 'DELETED'] })
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED';

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

export class AdminRoleTemplateWorkflowStepInputDto {
  @ApiProperty({ example: 'receive_input' })
  @IsString()
  @MinLength(1)
  id!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  order!: number;

  @ApiProperty({ enum: ['input', 'reasoning', 'knowledge', 'tool', 'approval', 'output'] })
  @IsIn(['input', 'reasoning', 'knowledge', 'tool', 'approval', 'output'])
  type!: 'input' | 'reasoning' | 'knowledge' | 'tool' | 'approval' | 'output';

  @ApiProperty({ example: '接收任务' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: '确认用户输入、目标、边界和交付物要求。' })
  @IsString()
  @MinLength(1)
  instruction!: string;

  @ApiPropertyOptional({ type: [String], example: ['web-search'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  toolIds?: string[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
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

  @ApiPropertyOptional({ type: [AdminRoleTemplateWorkflowStepInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminRoleTemplateWorkflowStepInputDto)
  workflowSteps?: AdminRoleTemplateWorkflowStepInputDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  workflowGraph?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleInputs?: string[];

  @ApiPropertyOptional({ example: 'Markdown report with summary, findings, risks, next actions, and local artifact links.' })
  @IsOptional()
  @IsString()
  outputFormat?: string;

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

  @ApiPropertyOptional({ type: [AdminRoleTemplateWorkflowStepInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AdminRoleTemplateWorkflowStepInputDto)
  workflowSteps?: AdminRoleTemplateWorkflowStepInputDto[];

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  workflowGraph?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sampleInputs?: string[];

  @ApiPropertyOptional({ example: 'Markdown report with summary, findings, risks, next actions, and local artifact links.' })
  @IsOptional()
  @IsString()
  outputFormat?: string;

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

export class DeleteAdminRoleTemplateResponseDto {
  @ApiProperty({
    example: {
      id: 'template_sales_assist'
    }
  })
  data!: {
    id: string;
  };
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

export class AdminRoleTemplateTestNodeTraceDto {
  @ApiProperty({ example: 'draft_result' })
  nodeId!: string;

  @ApiProperty({ example: 'Draft result' })
  nodeName!: string;

  @ApiProperty({ example: 'llm' })
  nodeType!: string;

  @ApiProperty({ enum: ['passed', 'warning', 'failed'] })
  status!: 'passed' | 'warning' | 'failed';

  @ApiProperty({ example: 'Reads start.text and gather_context.text.' })
  inputPreview!: string;

  @ApiProperty({ example: 'Writes draft_text.' })
  outputPreview!: string;

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiProperty({ required: false, example: 'web.search' })
  toolActionId?: string;

  @ApiProperty({ required: false, type: [String], example: ['text'] })
  requiredInputTypes?: string[];

  @ApiProperty({ required: false, type: [String], example: ['text', 'json'] })
  producedOutputTypes?: string[];
}

export class AdminRoleTemplateTestGraphTraceDto {
  @ApiProperty({ example: 'start' })
  entryNodeId!: string;

  @ApiProperty({ example: 5 })
  nodeCount!: number;

  @ApiProperty({ example: 4 })
  edgeCount!: number;

  @ApiProperty({ type: [AdminRoleTemplateTestNodeTraceDto] })
  nodes!: AdminRoleTemplateTestNodeTraceDto[];
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
    graphTrace?: AdminRoleTemplateTestGraphTraceDto;
    requiredToolActions?: string[];
  };
}
