import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  AssetDefinitionScope,
  AssetDefinitionStatus,
  AssetDefinitionType,
  Prisma
} from '@prisma/client';

import {
  getDefaultAssetDefinitions,
  type ServerAssetDefinitionSeed
} from '../../shared/asset-center-catalog';
import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CurrentAccountResponseDto } from '../workspace/dto/current-account-response.dto';
import {
  AssetDefinitionDetailDto,
  CreateAdminAssetDefinitionRequestDto,
  CreateAdminAssetDefinitionResponseDto,
  DeleteAdminAssetDefinitionResponseDto,
  ListAdminAssetDefinitionsQueryDto,
  ListAdminAssetDefinitionsResponseDto,
  UpdateAdminAssetDefinitionRequestDto,
  UpdateAdminAssetDefinitionResponseDto
} from './dto/asset-center.dto';

const assetDefinitionTypeSet = new Set(['VARIABLE', 'MODEL', 'TOOL', 'ARTIFACT_TEMPLATE', 'NODE_TEMPLATE']);
const assetDefinitionStatusSet = new Set(['ACTIVE', 'DISABLED', 'ARCHIVED']);
const assetDefinitionScopeSet = new Set(['SYSTEM', 'CUSTOM']);

type AssetDefinitionDate = Date | string;

type AssetDefinitionRecord = {
  id: string;
  type: string;
  key: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  scope: string;
  version: string;
  schema: unknown;
  defaults: unknown;
  tags: unknown;
  sortOrder: number;
  createdAt: AssetDefinitionDate;
  updatedAt: AssetDefinitionDate;
};

type NormalizedAssetCreateInput = {
  type: AssetDefinitionType;
  key: string;
  name: string;
  description?: string;
  category: string;
  status: AssetDefinitionStatus;
  scope: AssetDefinitionScope;
  version: string;
  schema: Prisma.InputJsonObject;
  defaults: Prisma.InputJsonObject;
  tags: string[];
  sortOrder: number;
};

type NormalizedAssetUpdateInput = {
  key: string;
  name?: string;
  description?: string | null;
  category?: string;
  status?: AssetDefinitionStatus;
  scope?: AssetDefinitionScope;
  version?: string;
  schema?: Prisma.InputJsonObject;
  defaults?: Prisma.InputJsonObject;
  tags?: string[];
  sortOrder?: number;
};

@Injectable()
export class AssetCenterService {
  private readonly mockAssets = getDefaultAssetDefinitions().map((asset, index) =>
    this.seedToRecord(asset, `mock-asset-${index + 1}`)
  );

  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService
  ) {}

  async listAssets(
    query: ListAdminAssetDefinitionsQueryDto,
    cookieHeader?: string
  ): Promise<ListAdminAssetDefinitionsResponseDto> {
    await this.requireAdminOperator(cookieHeader);

    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.filterAndSortAssets(this.mockAssets, query).map((asset) => this.toAssetDetail(asset))
      };
    }

    const where: Prisma.AssetDefinitionWhereInput = {};
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }
    const search = query.query?.trim();
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } }
      ];
    }

    const assets = await this.prismaService.assetDefinition.findMany({
      where,
      orderBy: [
        { type: 'asc' },
        { sortOrder: 'asc' },
        { updatedAt: 'desc' }
      ]
    });

    return {
      data: assets.map((asset) => this.toAssetDetail(asset))
    };
  }

  async createAsset(
    input: CreateAdminAssetDefinitionRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminAssetDefinitionResponseDto> {
    await this.requireAdminOperator(cookieHeader);
    const normalized = this.normalizeCreateInput(input);

    if (!isDatabasePersistenceEnabled()) {
      if (this.mockAssets.some((asset) => asset.type === normalized.type && asset.key === normalized.key)) {
        throw this.assetConflict(normalized.type, normalized.key);
      }

      const record: AssetDefinitionRecord = {
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
        ...normalized
      };
      this.mockAssets.unshift(record);
      return {
        data: this.toAssetDetail(record)
      };
    }

    try {
      const created = await this.prismaService.assetDefinition.create({
        data: normalized
      });
      return {
        data: this.toAssetDetail(created)
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.assetConflict(normalized.type, normalized.key);
      }
      throw error;
    }
  }

  async updateAsset(
    assetId: string,
    input: UpdateAdminAssetDefinitionRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminAssetDefinitionResponseDto> {
    await this.requireAdminOperator(cookieHeader);

    if (!isDatabasePersistenceEnabled()) {
      const asset = this.mockAssets.find((item) => item.id === assetId);
      if (!asset) {
        throw this.assetNotFound(assetId);
      }

      const normalized = this.normalizeUpdateInput(input, asset);
      const conflict = this.mockAssets.find(
        (item) => item.id !== assetId && item.type === asset.type && item.key === normalized.key
      );
      if (conflict) {
        throw this.assetConflict(asset.type, normalized.key);
      }

      Object.assign(asset, normalized, { updatedAt: new Date() });
      return {
        data: this.toAssetDetail(asset)
      };
    }

    const existing = await this.prismaService.assetDefinition.findUnique({
      where: {
        id: assetId
      }
    });
    if (!existing) {
      throw this.assetNotFound(assetId);
    }

    const normalized = this.normalizeUpdateInput(input, existing);
    try {
      const updated = await this.prismaService.assetDefinition.update({
        where: {
          id: assetId
        },
        data: normalized
      });
      return {
        data: this.toAssetDetail(updated)
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw this.assetConflict(existing.type, normalized.key ?? existing.key);
      }
      throw error;
    }
  }

  async deleteAsset(
    assetId: string,
    cookieHeader?: string
  ): Promise<DeleteAdminAssetDefinitionResponseDto> {
    await this.requireAdminOperator(cookieHeader);

    if (!isDatabasePersistenceEnabled()) {
      const index = this.mockAssets.findIndex((asset) => asset.id === assetId);
      if (index < 0) {
        throw this.assetNotFound(assetId);
      }
      this.mockAssets.splice(index, 1);
      return {
        data: {
          id: assetId,
          deleted: true
        }
      };
    }

    try {
      await this.prismaService.assetDefinition.delete({
        where: {
          id: assetId
        }
      });
    } catch (error) {
      if (this.isRecordNotFoundError(error)) {
        throw this.assetNotFound(assetId);
      }
      throw error;
    }

    return {
      data: {
        id: assetId,
        deleted: true
      }
    };
  }

  private normalizeCreateInput(input: CreateAdminAssetDefinitionRequestDto): NormalizedAssetCreateInput {
    const type = this.requireAssetType(input.type);
    return {
      type,
      key: this.normalizeAssetKey(input.key),
      name: this.requireText(input.name, 'Asset name cannot be empty.'),
      description: this.optionalText(input.description),
      category: this.optionalText(input.category) ?? this.defaultCategoryForType(type),
      status: this.requireAssetStatus(input.status ?? 'ACTIVE'),
      scope: this.requireAssetScope(input.scope ?? 'CUSTOM'),
      version: this.optionalText(input.version) ?? '1.0.0',
      schema: this.normalizeJsonObject(input.schema),
      defaults: this.normalizeJsonObject(input.defaults),
      tags: this.normalizeTags(input.tags ?? []),
      sortOrder: input.sortOrder ?? 1000
    };
  }

  private normalizeUpdateInput(
    input: UpdateAdminAssetDefinitionRequestDto,
    existing: Pick<AssetDefinitionRecord, 'type' | 'key'>
  ): NormalizedAssetUpdateInput {
    const normalized: Partial<NormalizedAssetUpdateInput> = {};
    if (input.key !== undefined) {
      normalized.key = this.normalizeAssetKey(input.key);
    }
    if (input.name !== undefined) {
      normalized.name = this.requireText(input.name, 'Asset name cannot be empty.');
    }
    if (input.description !== undefined) {
      normalized.description = input.description === null ? null : this.optionalText(input.description);
    }
    if (input.category !== undefined) {
      normalized.category = this.optionalText(input.category) ?? this.defaultCategoryForType(existing.type);
    }
    if (input.status !== undefined) {
      normalized.status = this.requireAssetStatus(input.status);
    }
    if (input.scope !== undefined) {
      normalized.scope = this.requireAssetScope(input.scope);
    }
    if (input.version !== undefined) {
      normalized.version = this.optionalText(input.version) ?? '1.0.0';
    }
    if (input.schema !== undefined) {
      normalized.schema = this.normalizeJsonObject(input.schema);
    }
    if (input.defaults !== undefined) {
      normalized.defaults = this.normalizeJsonObject(input.defaults);
    }
    if (input.tags !== undefined) {
      normalized.tags = this.normalizeTags(input.tags);
    }
    if (input.sortOrder !== undefined) {
      normalized.sortOrder = input.sortOrder;
    }

    if (!normalized.key) {
      normalized.key = existing.key;
    }

    return normalized as NormalizedAssetUpdateInput;
  }

  private filterAndSortAssets(
    assets: AssetDefinitionRecord[],
    query: ListAdminAssetDefinitionsQueryDto
  ): AssetDefinitionRecord[] {
    const search = query.query?.trim().toLowerCase();
    return assets
      .filter((asset) => !query.type || asset.type === query.type)
      .filter((asset) => !query.status || asset.status === query.status)
      .filter((asset) => {
        if (!search) {
          return true;
        }
        return [asset.key, asset.name, asset.description, asset.category]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(search));
      })
      .sort((left, right) => {
        const typeCompare = left.type.localeCompare(right.type);
        if (typeCompare !== 0) {
          return typeCompare;
        }
        return left.sortOrder - right.sortOrder || left.name.localeCompare(right.name);
      });
  }

  private toAssetDetail(asset: AssetDefinitionRecord): AssetDefinitionDetailDto {
    return {
      id: asset.id,
      type: this.requireAssetType(asset.type),
      key: asset.key,
      name: asset.name,
      description: asset.description ?? undefined,
      category: asset.category,
      status: this.requireAssetStatus(asset.status),
      scope: this.requireAssetScope(asset.scope),
      version: asset.version,
      schema: this.toJsonObject(asset.schema),
      defaults: this.toJsonObject(asset.defaults),
      tags: this.toStringArray(asset.tags),
      sortOrder: asset.sortOrder,
      createdAt: this.toRequiredIsoDateString(asset.createdAt),
      updatedAt: this.toRequiredIsoDateString(asset.updatedAt)
    };
  }

  private seedToRecord(seed: ServerAssetDefinitionSeed, id: string): AssetDefinitionRecord {
    const now = new Date();
    return {
      id,
      type: seed.type,
      key: seed.key,
      name: seed.name,
      description: seed.description,
      category: seed.category,
      status: seed.status,
      scope: seed.scope,
      version: seed.version,
      schema: seed.schema,
      defaults: seed.defaults,
      tags: seed.tags,
      sortOrder: seed.sortOrder,
      createdAt: now,
      updatedAt: now
    };
  }

  private normalizeAssetKey(value: string): string {
    const key = this.requireText(value, 'Asset key cannot be empty.');
    if (!/^[a-zA-Z][a-zA-Z0-9_.:-]*$/.test(key)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Asset key must start with a letter and only contain letters, numbers, underscore, dot, colon, or hyphen.',
          details: {
            key
          }
        }
      });
    }
    return key;
  }

  private requireAssetType(value: string): AssetDefinitionType {
    if (!assetDefinitionTypeSet.has(value)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Asset type is invalid.',
          details: {
            type: value
          }
        }
      });
    }
    return value as AssetDefinitionType;
  }

  private requireAssetStatus(value: string): AssetDefinitionStatus {
    if (!assetDefinitionStatusSet.has(value)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Asset status is invalid.',
          details: {
            status: value
          }
        }
      });
    }
    return value as AssetDefinitionStatus;
  }

  private requireAssetScope(value: string): AssetDefinitionScope {
    if (!assetDefinitionScopeSet.has(value)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Asset scope is invalid.',
          details: {
            scope: value
          }
        }
      });
    }
    return value as AssetDefinitionScope;
  }

  private defaultCategoryForType(type: string): string {
    switch (type) {
      case 'VARIABLE':
        return 'general';
      case 'MODEL':
        return 'provider';
      case 'TOOL':
        return 'tool';
      case 'ARTIFACT_TEMPLATE':
        return 'document';
      case 'NODE_TEMPLATE':
        return 'workflow';
      default:
        return 'general';
    }
  }

  private normalizeJsonObject(value: Record<string, unknown> | undefined): Prisma.InputJsonObject {
    if (value === undefined) {
      return {};
    }
    return this.toJsonObject(value) as Prisma.InputJsonObject;
  }

  private toJsonObject(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private normalizeTags(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private toStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private requireText(value: string, message: string): string {
    const text = value.trim();
    if (!text) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message
        }
      });
    }
    return text;
  }

  private optionalText(value: string | null | undefined): string | undefined {
    const text = value?.trim();
    return text || undefined;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
  }

  private isRecordNotFoundError(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025';
  }

  private assetConflict(type: string, key: string) {
    return new ConflictException({
      error: {
        code: 'ASSET_DEFINITION_CONFLICT',
        message: 'Asset definition already exists.',
        details: {
          type,
          key
        }
      }
    });
  }

  private assetNotFound(assetId: string) {
    return new NotFoundException({
      error: {
        code: 'ASSET_DEFINITION_NOT_FOUND',
        message: 'Asset definition was not found.',
        details: {
          assetId
        }
      }
    });
  }

  private async requireAdminOperator(cookieHeader?: string): Promise<CurrentAccountResponseDto> {
    const currentAccount = await this.authService.getCurrentAccount(cookieHeader);
    const operatorEmails = this.getOperatorEmails();
    const email = currentAccount.account.primaryEmail.trim().toLowerCase();

    if (!operatorEmails.has(email)) {
      throw new ForbiddenException({
        error: {
          code: 'ADMIN_ACCESS_DENIED',
          message: 'Admin console access is restricted to platform operators.'
        }
      });
    }

    return currentAccount;
  }

  private getOperatorEmails(): Set<string> {
    const configuredEmails = process.env.ADMIN_CONSOLE_OPERATOR_EMAILS;
    const fallbackEmail = process.env.WORKOS_BOOTSTRAP_ADMIN_EMAIL ?? 'admin@qiuai.local';
    const source = configuredEmails?.trim() ? configuredEmails : fallbackEmail;

    return new Set(
      source
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean)
    );
  }

  private toRequiredIsoDateString(value: AssetDefinitionDate): string {
    return value instanceof Date ? value.toISOString() : value;
  }
}
