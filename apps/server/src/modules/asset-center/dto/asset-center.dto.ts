import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const assetDefinitionTypes = ['VARIABLE', 'MODEL', 'TOOL', 'ARTIFACT_TEMPLATE', 'NODE_TEMPLATE'] as const;
const assetDefinitionStatuses = ['ACTIVE', 'DISABLED', 'ARCHIVED'] as const;
const assetDefinitionScopes = ['SYSTEM', 'CUSTOM'] as const;

export class AssetDefinitionDetailDto {
  @ApiProperty({ example: 'asset-id' })
  id!: string;

  @ApiProperty({ enum: assetDefinitionTypes })
  type!: (typeof assetDefinitionTypes)[number];

  @ApiProperty({ example: 'final_content' })
  key!: string;

  @ApiProperty({ example: '最终正文' })
  name!: string;

  @ApiPropertyOptional({ example: '用于写入 Word、Markdown、PDF 的正式正文。' })
  description?: string;

  @ApiProperty({ example: 'document' })
  category!: string;

  @ApiProperty({ enum: assetDefinitionStatuses })
  status!: (typeof assetDefinitionStatuses)[number];

  @ApiProperty({ enum: assetDefinitionScopes })
  scope!: (typeof assetDefinitionScopes)[number];

  @ApiProperty({ example: '1.0.0' })
  version!: string;

  @ApiProperty({ example: { valueType: 'text' } })
  schema!: Record<string, unknown>;

  @ApiProperty({ example: {} })
  defaults!: Record<string, unknown>;

  @ApiProperty({ type: [String], example: ['document', 'text'] })
  tags!: string[];

  @ApiProperty({ example: 1000 })
  sortOrder!: number;

  @ApiProperty({ example: '2026-07-29T00:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-07-29T00:00:00.000Z' })
  updatedAt!: string;
}

export class ListAdminAssetDefinitionsQueryDto {
  @ApiPropertyOptional({ enum: assetDefinitionTypes })
  @IsOptional()
  @IsIn(assetDefinitionTypes)
  type?: (typeof assetDefinitionTypes)[number];

  @ApiPropertyOptional({ enum: assetDefinitionStatuses })
  @IsOptional()
  @IsIn(assetDefinitionStatuses)
  status?: (typeof assetDefinitionStatuses)[number];

  @ApiPropertyOptional({ example: '文档' })
  @IsOptional()
  @IsString()
  query?: string;
}

export class ListAdminAssetDefinitionsResponseDto {
  @ApiProperty({ type: [AssetDefinitionDetailDto] })
  data!: AssetDefinitionDetailDto[];
}

export class CreateAdminAssetDefinitionRequestDto {
  @ApiProperty({ enum: assetDefinitionTypes })
  @IsIn(assetDefinitionTypes)
  type!: (typeof assetDefinitionTypes)[number];

  @ApiProperty({ example: 'final_content' })
  @IsString()
  @MinLength(1)
  key!: string;

  @ApiProperty({ example: '最终正文' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: '用于写入交付文件的正文。' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'document' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: assetDefinitionStatuses })
  @IsOptional()
  @IsIn(assetDefinitionStatuses)
  status?: (typeof assetDefinitionStatuses)[number];

  @ApiPropertyOptional({ enum: assetDefinitionScopes })
  @IsOptional()
  @IsIn(assetDefinitionScopes)
  scope?: (typeof assetDefinitionScopes)[number];

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ example: { valueType: 'text' } })
  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  defaults?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class UpdateAdminAssetDefinitionRequestDto {
  @ApiPropertyOptional({ example: 'final_content' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  key?: string;

  @ApiPropertyOptional({ example: '最终正文' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ example: '用于写入交付文件的正文。', nullable: true })
  @IsOptional()
  @IsString()
  description?: string | null;

  @ApiPropertyOptional({ example: 'document' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ enum: assetDefinitionStatuses })
  @IsOptional()
  @IsIn(assetDefinitionStatuses)
  status?: (typeof assetDefinitionStatuses)[number];

  @ApiPropertyOptional({ enum: assetDefinitionScopes })
  @IsOptional()
  @IsIn(assetDefinitionScopes)
  scope?: (typeof assetDefinitionScopes)[number];

  @ApiPropertyOptional({ example: '1.0.0' })
  @IsOptional()
  @IsString()
  version?: string;

  @ApiPropertyOptional({ example: { valueType: 'text' } })
  @IsOptional()
  @IsObject()
  schema?: Record<string, unknown>;

  @ApiPropertyOptional({ example: {} })
  @IsOptional()
  @IsObject()
  defaults?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  sortOrder?: number;
}

export class CreateAdminAssetDefinitionResponseDto {
  @ApiProperty({ type: AssetDefinitionDetailDto })
  data!: AssetDefinitionDetailDto;
}

export class UpdateAdminAssetDefinitionResponseDto {
  @ApiProperty({ type: AssetDefinitionDetailDto })
  data!: AssetDefinitionDetailDto;
}

export class DeleteAdminAssetDefinitionResponseDto {
  @ApiProperty({ example: { id: 'asset-id', deleted: true } })
  data!: {
    id: string;
    deleted: true;
  };
}
