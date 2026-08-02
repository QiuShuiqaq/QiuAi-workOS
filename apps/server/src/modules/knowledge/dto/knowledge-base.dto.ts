import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBase64, IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class EnterpriseKnowledgeProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  businessScope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productsAndServices?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  targetCustomers?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerPersona?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  salesGuidelines?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serviceBoundaries?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  forbiddenClaims?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  commonQuestions?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pricingAndDelivery?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  afterSalesPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactInfo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class KnowledgeBaseVersionSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  versionNumber!: number;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  fileSizeBytes!: number;

  @ApiProperty()
  sourceSha256!: string;

  @ApiProperty({ enum: ['processing', 'ready', 'failed', 'archived'] })
  status!: 'processing' | 'ready' | 'failed' | 'archived';

  @ApiProperty()
  isEnabled!: boolean;

  @ApiProperty()
  summary!: string;

  @ApiProperty()
  textPreview!: string;

  @ApiPropertyOptional()
  failureMessage?: string;

  @ApiPropertyOptional()
  activatedAt?: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class EnterpriseKnowledgeBaseSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  workspaceId!: string;

  @ApiProperty({ enum: ['enterprise'] })
  scope!: 'enterprise';

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ['active', 'disabled'] })
  status!: 'active' | 'disabled';

  @ApiProperty({ type: EnterpriseKnowledgeProfileDto })
  profile!: EnterpriseKnowledgeProfileDto;

  @ApiPropertyOptional({ type: KnowledgeBaseVersionSummaryDto })
  currentVersion?: KnowledgeBaseVersionSummaryDto;

  @ApiProperty({ type: [KnowledgeBaseVersionSummaryDto] })
  versions!: KnowledgeBaseVersionSummaryDto[];

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class GetEnterpriseKnowledgeBaseResponseDto {
  @ApiProperty({ type: EnterpriseKnowledgeBaseSummaryDto })
  data!: EnterpriseKnowledgeBaseSummaryDto;
}

export class UpdateEnterpriseKnowledgeProfileRequestDto {
  @ApiProperty({ type: EnterpriseKnowledgeProfileDto })
  @IsObject()
  profile!: EnterpriseKnowledgeProfileDto;
}

export class UploadEnterpriseKnowledgePdfRequestDto {
  @ApiProperty({ example: 'enterprise-knowledge-v1.pdf' })
  @IsString()
  @MinLength(1)
  fileName!: string;

  @ApiProperty()
  @IsBase64()
  contentBase64!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activate?: boolean;
}

export class UpdateEnterpriseKnowledgeStatusRequestDto {
  @ApiProperty()
  @IsBoolean()
  enabled!: boolean;
}

export class EnterpriseKnowledgeBaseDocumentDto {
  @ApiProperty()
  versionId!: string;

  @ApiProperty()
  fileName!: string;

  @ApiProperty()
  mimeType!: string;

  @ApiProperty()
  fileSizeBytes!: number;

  @ApiProperty()
  contentBase64!: string;
}

export class GetEnterpriseKnowledgeDocumentResponseDto {
  @ApiProperty({ type: EnterpriseKnowledgeBaseDocumentDto })
  data!: EnterpriseKnowledgeBaseDocumentDto;
}

export class EnterpriseKnowledgeRuntimeContextDto {
  @ApiProperty()
  workspaceId!: string;

  @ApiProperty()
  enabled!: boolean;

  @ApiPropertyOptional()
  versionId?: string;

  @ApiPropertyOptional()
  versionNumber?: number;

  @ApiPropertyOptional()
  title?: string;

  @ApiPropertyOptional()
  fileName?: string;

  @ApiProperty()
  contextText!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class GetEnterpriseKnowledgeRuntimeContextResponseDto {
  @ApiProperty({ type: EnterpriseKnowledgeRuntimeContextDto })
  data!: EnterpriseKnowledgeRuntimeContextDto;
}
