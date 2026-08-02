import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type KnowledgeBaseVersion } from '@prisma/client';

import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';
import type {
  EnterpriseKnowledgeProfileDto,
  EnterpriseKnowledgeBaseSummaryDto,
  EnterpriseKnowledgeRuntimeContextDto,
  UpdateEnterpriseKnowledgeProfileRequestDto,
  UploadEnterpriseKnowledgePdfRequestDto
} from './dto/knowledge-base.dto';

type DatabaseKnowledgeBase = Prisma.KnowledgeBaseGetPayload<{
  include: {
    currentVersion: true;
    versions: true;
  };
}>;

interface MockKnowledgeBase {
  id: string;
  workspaceId: string;
  name: string;
  status: 'ACTIVE' | 'DISABLED';
  profile: EnterpriseKnowledgeProfileDto;
  currentVersionId?: string;
  createdAt: Date;
  updatedAt: Date;
  versions: MockKnowledgeBaseVersion[];
}

interface MockKnowledgeBaseVersion {
  id: string;
  versionNumber: number;
  title: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  sourceSha256: string;
  fileDataBase64: string;
  textContent: string;
  summary: string;
  status: 'READY' | 'FAILED' | 'PROCESSING' | 'ARCHIVED';
  isEnabled: boolean;
  activatedAt?: Date;
  failureMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const maxEnterpriseKnowledgePdfBytes = 15 * 1024 * 1024;
const maxRuntimeContextChars = 80_000;
const maxSummaryChars = 1_200;
const maxPreviewChars = 1_600;

type PdfParseResult = {
  text: string;
};

type PdfParse = (buffer: Buffer) => Promise<PdfParseResult>;

let cachedPdfParse: PdfParse | undefined;

@Injectable()
export class KnowledgeService {
  private readonly mockBases = new Map<string, MockKnowledgeBase>();

  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  async getEnterpriseKnowledgeBase(workspaceId: string) {
    return {
      data: isDatabasePersistenceEnabled()
        ? this.toEnterpriseKnowledgeBaseSummary(await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId))
        : this.toMockEnterpriseKnowledgeBaseSummary(this.ensureMockEnterpriseKnowledgeBase(workspaceId))
    };
  }

  async updateEnterpriseKnowledgeProfile(
    workspaceId: string,
    input: UpdateEnterpriseKnowledgeProfileRequestDto
  ) {
    const profile = sanitizeEnterpriseProfile(input.profile);

    if (isDatabasePersistenceEnabled()) {
      const base = await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId);
      const updated = await this.prismaService.knowledgeBase.update({
        where: { id: base.id },
        data: { profile: profile as Prisma.InputJsonValue },
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: 'desc' } }
        }
      });
      return { data: this.toEnterpriseKnowledgeBaseSummary(updated) };
    }

    const base = this.ensureMockEnterpriseKnowledgeBase(workspaceId);
    base.profile = profile;
    base.updatedAt = new Date();
    return { data: this.toMockEnterpriseKnowledgeBaseSummary(base) };
  }

  async uploadEnterpriseKnowledgePdf(
    workspaceId: string,
    input: UploadEnterpriseKnowledgePdfRequestDto
  ) {
    const parsed = await parseKnowledgePdfUpload(input);
    const activate = input.activate !== false;

    if (isDatabasePersistenceEnabled()) {
      const base = await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId);
      const nextVersionNumber = (base.versions[0]?.versionNumber ?? 0) + 1;
      const uploaded = await this.prismaService.$transaction(async (tx) => {
        const version = await tx.knowledgeBaseVersion.create({
          data: {
            knowledgeBaseId: base.id,
            versionNumber: nextVersionNumber,
            title: parsed.title,
            fileName: parsed.fileName,
            mimeType: parsed.mimeType,
            fileSizeBytes: parsed.fileSizeBytes,
            sourceSha256: parsed.sourceSha256,
            fileDataBase64: parsed.contentBase64,
            textContent: parsed.textContent,
            summary: parsed.summary,
            status: 'READY',
            isEnabled: false
          }
        });

        if (activate) {
          await tx.knowledgeBaseVersion.updateMany({
            where: { knowledgeBaseId: base.id },
            data: { isEnabled: false }
          });
          await tx.knowledgeBaseVersion.update({
            where: { id: version.id },
            data: { isEnabled: true, activatedAt: new Date() }
          });
          await tx.knowledgeBase.update({
            where: { id: base.id },
            data: { currentVersionId: version.id, status: 'ACTIVE' }
          });
        }

        return tx.knowledgeBase.findUniqueOrThrow({
          where: { id: base.id },
          include: {
            currentVersion: true,
            versions: { orderBy: { versionNumber: 'desc' } }
          }
        });
      });

      return { data: this.toEnterpriseKnowledgeBaseSummary(uploaded) };
    }

    const base = this.ensureMockEnterpriseKnowledgeBase(workspaceId);
    const version: MockKnowledgeBaseVersion = {
      id: randomUUID(),
      versionNumber: (base.versions[0]?.versionNumber ?? 0) + 1,
      title: parsed.title,
      fileName: parsed.fileName,
      mimeType: parsed.mimeType,
      fileSizeBytes: parsed.fileSizeBytes,
      sourceSha256: parsed.sourceSha256,
      fileDataBase64: parsed.contentBase64,
      textContent: parsed.textContent,
      summary: parsed.summary,
      status: 'READY',
      isEnabled: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    base.versions.unshift(version);
    if (activate) {
      for (const item of base.versions) item.isEnabled = false;
      version.isEnabled = true;
      version.activatedAt = new Date();
      base.currentVersionId = version.id;
      base.status = 'ACTIVE';
    }
    base.updatedAt = new Date();

    return { data: this.toMockEnterpriseKnowledgeBaseSummary(base) };
  }

  async activateEnterpriseKnowledgeVersion(workspaceId: string, versionId: string) {
    if (isDatabasePersistenceEnabled()) {
      const base = await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId);
      const version = base.versions.find((item) => item.id === versionId);
      if (!version) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Knowledge base version was not found.',
            details: { workspaceId, versionId }
          }
        });
      }
      if (version.status !== 'READY') {
        throw new BadRequestException({
          error: {
            code: 'INVALID_KNOWLEDGE_VERSION',
            message: 'Only ready knowledge versions can be enabled.',
            details: { workspaceId, versionId, status: version.status }
          }
        });
      }

      const updated = await this.prismaService.$transaction(async (tx) => {
        await tx.knowledgeBaseVersion.updateMany({
          where: { knowledgeBaseId: base.id },
          data: { isEnabled: false }
        });
        await tx.knowledgeBaseVersion.update({
          where: { id: versionId },
          data: { isEnabled: true, activatedAt: new Date() }
        });
        await tx.knowledgeBase.update({
          where: { id: base.id },
          data: { currentVersionId: versionId, status: 'ACTIVE' }
        });
        return tx.knowledgeBase.findUniqueOrThrow({
          where: { id: base.id },
          include: {
            currentVersion: true,
            versions: { orderBy: { versionNumber: 'desc' } }
          }
        });
      });

      return { data: this.toEnterpriseKnowledgeBaseSummary(updated) };
    }

    const base = this.ensureMockEnterpriseKnowledgeBase(workspaceId);
    const version = base.versions.find((item) => item.id === versionId);
    if (!version) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base version was not found.',
          details: { workspaceId, versionId }
        }
      });
    }
    for (const item of base.versions) item.isEnabled = false;
    version.isEnabled = true;
    version.activatedAt = new Date();
    version.updatedAt = new Date();
    base.currentVersionId = version.id;
    base.status = 'ACTIVE';
    base.updatedAt = new Date();

    return { data: this.toMockEnterpriseKnowledgeBaseSummary(base) };
  }

  async updateEnterpriseKnowledgeStatus(workspaceId: string, enabled: boolean) {
    if (isDatabasePersistenceEnabled()) {
      const base = await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId);
      const updated = await this.prismaService.knowledgeBase.update({
        where: { id: base.id },
        data: { status: enabled ? 'ACTIVE' : 'DISABLED' },
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: 'desc' } }
        }
      });
      return { data: this.toEnterpriseKnowledgeBaseSummary(updated) };
    }

    const base = this.ensureMockEnterpriseKnowledgeBase(workspaceId);
    base.status = enabled ? 'ACTIVE' : 'DISABLED';
    base.updatedAt = new Date();
    return { data: this.toMockEnterpriseKnowledgeBaseSummary(base) };
  }

  async getEnterpriseKnowledgeDocument(workspaceId: string, versionId: string) {
    if (isDatabasePersistenceEnabled()) {
      const base = await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId);
      const version = base.versions.find((item) => item.id === versionId);
      if (!version) {
        throw new NotFoundException({
          error: {
            code: 'NOT_FOUND',
            message: 'Knowledge base version was not found.',
            details: { workspaceId, versionId }
          }
        });
      }
      return {
        data: {
          versionId: version.id,
          fileName: version.fileName,
          mimeType: version.mimeType,
          fileSizeBytes: version.fileSizeBytes,
          contentBase64: version.fileDataBase64
        }
      };
    }

    const base = this.ensureMockEnterpriseKnowledgeBase(workspaceId);
    const version = base.versions.find((item) => item.id === versionId);
    if (!version) {
      throw new NotFoundException({
        error: {
          code: 'NOT_FOUND',
          message: 'Knowledge base version was not found.',
          details: { workspaceId, versionId }
        }
      });
    }

    return {
      data: {
        versionId: version.id,
        fileName: version.fileName,
        mimeType: version.mimeType,
        fileSizeBytes: version.fileSizeBytes,
        contentBase64: version.fileDataBase64
      }
    };
  }

  async getEnterpriseKnowledgeRuntimeContext(workspaceId: string) {
    if (isDatabasePersistenceEnabled()) {
      const base = await this.ensureDatabaseEnterpriseKnowledgeBase(workspaceId);
      return {
        data: this.toRuntimeContext(
          workspaceId,
          base.status === 'ACTIVE',
          readProfile(base.profile),
          base.currentVersion ?? undefined,
          base.updatedAt
        )
      };
    }

    const base = this.ensureMockEnterpriseKnowledgeBase(workspaceId);
    const currentVersion = base.versions.find((item) => item.id === base.currentVersionId);
    return {
      data: this.toRuntimeContext(
        workspaceId,
        base.status === 'ACTIVE',
        base.profile,
        currentVersion,
        base.updatedAt
      )
    };
  }

  private async ensureDatabaseEnterpriseKnowledgeBase(workspaceId: string): Promise<DatabaseKnowledgeBase> {
    const existing = await this.prismaService.knowledgeBase.findUnique({
      where: {
        workspaceId_scope: {
          workspaceId,
          scope: 'ENTERPRISE'
        }
      },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: 'desc' } }
      }
    });
    if (existing) {
      return existing;
    }

    return this.prismaService.knowledgeBase.create({
      data: {
        workspaceId,
        scope: 'ENTERPRISE',
        name: '企业知识库',
        profile: {} as Prisma.InputJsonValue
      },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: 'desc' } }
      }
    });
  }

  private ensureMockEnterpriseKnowledgeBase(workspaceId: string): MockKnowledgeBase {
    const existing = this.mockBases.get(workspaceId);
    if (existing) {
      return existing;
    }

    const base: MockKnowledgeBase = {
      id: randomUUID(),
      workspaceId,
      name: '企业知识库',
      status: 'ACTIVE',
      profile: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      versions: []
    };
    this.mockBases.set(workspaceId, base);
    return base;
  }

  private toEnterpriseKnowledgeBaseSummary(base: DatabaseKnowledgeBase): EnterpriseKnowledgeBaseSummaryDto {
    return {
      id: base.id,
      workspaceId: base.workspaceId,
      scope: 'enterprise',
      name: base.name,
      status: base.status === 'ACTIVE' ? 'active' : 'disabled',
      profile: readProfile(base.profile),
      currentVersion: base.currentVersion ? this.toKnowledgeBaseVersionSummary(base.currentVersion) : undefined,
      versions: base.versions.map((version) => this.toKnowledgeBaseVersionSummary(version)),
      createdAt: base.createdAt.toISOString(),
      updatedAt: base.updatedAt.toISOString()
    };
  }

  private toMockEnterpriseKnowledgeBaseSummary(base: MockKnowledgeBase): EnterpriseKnowledgeBaseSummaryDto {
    const currentVersion = base.versions.find((item) => item.id === base.currentVersionId);
    return {
      id: base.id,
      workspaceId: base.workspaceId,
      scope: 'enterprise',
      name: base.name,
      status: base.status === 'ACTIVE' ? 'active' : 'disabled',
      profile: base.profile,
      currentVersion: currentVersion ? this.toMockKnowledgeBaseVersionSummary(currentVersion) : undefined,
      versions: base.versions.map((version) => this.toMockKnowledgeBaseVersionSummary(version)),
      createdAt: base.createdAt.toISOString(),
      updatedAt: base.updatedAt.toISOString()
    };
  }

  private toKnowledgeBaseVersionSummary(version: KnowledgeBaseVersion) {
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      fileName: version.fileName,
      mimeType: version.mimeType,
      fileSizeBytes: version.fileSizeBytes,
      sourceSha256: version.sourceSha256,
      status: mapKnowledgeVersionStatus(version.status),
      isEnabled: version.isEnabled,
      summary: version.summary,
      textPreview: truncateText(version.textContent, maxPreviewChars),
      failureMessage: version.failureMessage ?? undefined,
      activatedAt: version.activatedAt?.toISOString(),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString()
    };
  }

  private toMockKnowledgeBaseVersionSummary(version: MockKnowledgeBaseVersion) {
    return {
      id: version.id,
      versionNumber: version.versionNumber,
      title: version.title,
      fileName: version.fileName,
      mimeType: version.mimeType,
      fileSizeBytes: version.fileSizeBytes,
      sourceSha256: version.sourceSha256,
      status: mapKnowledgeVersionStatus(version.status),
      isEnabled: version.isEnabled,
      summary: version.summary,
      textPreview: truncateText(version.textContent, maxPreviewChars),
      failureMessage: version.failureMessage,
      activatedAt: version.activatedAt?.toISOString(),
      createdAt: version.createdAt.toISOString(),
      updatedAt: version.updatedAt.toISOString()
    };
  }

  private toRuntimeContext(
    workspaceId: string,
    enabled: boolean,
    profile: EnterpriseKnowledgeProfileDto,
    version: Pick<KnowledgeBaseVersion, 'id' | 'versionNumber' | 'title' | 'fileName' | 'textContent'> | MockKnowledgeBaseVersion | undefined,
    updatedAt: Date
  ): EnterpriseKnowledgeRuntimeContextDto {
    const profileText = buildEnterpriseProfileText(profile);
    const versionText = version?.textContent
      ? [
          `[企业知识PDF] ${version.fileName}`,
          version.textContent
        ].join('\n')
      : '';
    const contextText = enabled
      ? truncateText([profileText, versionText].filter(Boolean).join('\n\n---\n\n'), maxRuntimeContextChars)
      : '';

    return {
      workspaceId,
      enabled,
      versionId: version?.id,
      versionNumber: version?.versionNumber,
      title: version?.title,
      fileName: version?.fileName,
      contextText,
      updatedAt: updatedAt.toISOString()
    };
  }
}

async function parseKnowledgePdfUpload(input: UploadEnterpriseKnowledgePdfRequestDto) {
  const fileName = sanitizeFileName(input.fileName);
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Only PDF files can be uploaded as an enterprise knowledge base.'
      }
    });
  }

  const contentBase64 = stripDataUrlPrefix(input.contentBase64);
  const buffer = Buffer.from(contentBase64, 'base64');
  if (buffer.length === 0 || buffer.length > maxEnterpriseKnowledgePdfBytes) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: `PDF size must be between 1 byte and ${Math.floor(maxEnterpriseKnowledgePdfBytes / 1024 / 1024)} MB.`
      }
    });
  }

  if (!buffer.subarray(0, 5).toString('utf8').startsWith('%PDF')) {
    throw new BadRequestException({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Uploaded knowledge file is not a valid PDF.'
      }
    });
  }

  let text = '';
  try {
    const pdfParse = loadPdfParse();
    const parsed = await pdfParse(buffer);
    text = normalizeKnowledgeText(parsed.text);
  } catch (error) {
    throw new BadRequestException({
      error: {
        code: 'PDF_PARSE_FAILED',
        message: 'PDF text could not be extracted. Use a text-based PDF instead of a scanned image PDF.',
        details: {
          reason: error instanceof Error ? error.message : 'unknown'
        }
      }
    });
  }

  if (!text) {
    throw new BadRequestException({
      error: {
        code: 'PDF_TEXT_EMPTY',
        message: 'PDF text could not be extracted. Use a text-based PDF instead of a scanned image PDF.'
      }
    });
  }

  const title = sanitizeText(input.title) || fileName.replace(/\.pdf$/i, '');
  const summary = buildPdfSummary(title, text);
  const sourceSha256 = createHash('sha256').update(buffer).digest('hex');

  return {
    title,
    fileName,
    mimeType: 'application/pdf',
    fileSizeBytes: buffer.length,
    sourceSha256,
    contentBase64,
    textContent: text,
    summary
  };
}

function sanitizeEnterpriseProfile(input: EnterpriseKnowledgeProfileDto | undefined): EnterpriseKnowledgeProfileDto {
  const profile = input ?? {};
  return {
    companyName: sanitizeText(profile.companyName),
    industry: sanitizeText(profile.industry),
    businessScope: sanitizeText(profile.businessScope),
    productsAndServices: sanitizeText(profile.productsAndServices),
    targetCustomers: sanitizeText(profile.targetCustomers),
    customerPersona: sanitizeText(profile.customerPersona),
    salesGuidelines: sanitizeText(profile.salesGuidelines),
    serviceBoundaries: sanitizeText(profile.serviceBoundaries),
    forbiddenClaims: sanitizeText(profile.forbiddenClaims),
    commonQuestions: sanitizeText(profile.commonQuestions),
    pricingAndDelivery: sanitizeText(profile.pricingAndDelivery),
    afterSalesPolicy: sanitizeText(profile.afterSalesPolicy),
    contactInfo: sanitizeText(profile.contactInfo),
    notes: sanitizeText(profile.notes)
  };
}

function readProfile(value: unknown): EnterpriseKnowledgeProfileDto {
  return sanitizeEnterpriseProfile(
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as EnterpriseKnowledgeProfileDto)
      : {}
  );
}

function buildEnterpriseProfileText(profile: EnterpriseKnowledgeProfileDto): string {
  const rows = [
    ['企业名称', profile.companyName],
    ['行业', profile.industry],
    ['主营业务', profile.businessScope],
    ['产品/服务', profile.productsAndServices],
    ['目标客户', profile.targetCustomers],
    ['客户画像', profile.customerPersona],
    ['销售话术', profile.salesGuidelines],
    ['服务边界', profile.serviceBoundaries],
    ['禁用表述', profile.forbiddenClaims],
    ['常见问题', profile.commonQuestions],
    ['价格/交付', profile.pricingAndDelivery],
    ['售后政策', profile.afterSalesPolicy],
    ['联系方式', profile.contactInfo],
    ['补充说明', profile.notes]
  ].filter((row): row is [string, string] => Boolean(row[1]?.trim()));

  if (rows.length === 0) {
    return '';
  }

  return [
    '[企业基础信息]',
    ...rows.map(([label, value]) => `${label}: ${value}`)
  ].join('\n');
}

function buildPdfSummary(title: string, text: string): string {
  return truncateText([
    `企业知识PDF: ${title}`,
    text.slice(0, maxSummaryChars)
  ].join('\n'), maxSummaryChars);
}

function normalizeKnowledgeText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sanitizeText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 12_000) : undefined;
}

function sanitizeFileName(value: string): string {
  return value.trim().replace(/[\\/:*?"<>|]/g, '_').slice(0, 180) || 'enterprise-knowledge.pdf';
}

function stripDataUrlPrefix(value: string): string {
  const trimmed = value.trim();
  const commaIndex = trimmed.indexOf(',');
  return trimmed.startsWith('data:') && commaIndex >= 0 ? trimmed.slice(commaIndex + 1) : trimmed;
}

function truncateText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function mapKnowledgeVersionStatus(status: string): 'processing' | 'ready' | 'failed' | 'archived' {
  if (status === 'PROCESSING') return 'processing';
  if (status === 'FAILED') return 'failed';
  if (status === 'ARCHIVED') return 'archived';
  return 'ready';
}

function loadPdfParse(): PdfParse {
  cachedPdfParse ??= require('pdf-parse/lib/pdf-parse.js') as PdfParse;
  return cachedPdfParse;
}
