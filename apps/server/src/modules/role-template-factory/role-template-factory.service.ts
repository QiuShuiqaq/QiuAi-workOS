import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type { Prisma, RoleTemplateStatus } from '@prisma/client';

import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import type { CurrentAccountResponseDto } from '../workspace/dto/current-account-response.dto';
import {
  AdminRoleTemplateDetailDto,
  CreateAdminRoleTemplateRequestDto,
  CreateAdminRoleTemplateResponseDto,
  GetAdminRoleTemplateResponseDto,
  ListAdminRoleTemplatesResponseDto,
  PublishAdminRoleTemplateResponseDto,
  TestAdminRoleTemplateRequestDto,
  TestAdminRoleTemplateResponseDto,
  UpdateAdminRoleTemplateRequestDto,
  UpdateAdminRoleTemplateResponseDto
} from './dto/role-template-factory.dto';

const planCodes = [
  'PERSONAL_FREE',
  'ENTERPRISE_BASIC_MONTHLY',
  'ENTERPRISE_BASIC_ANNUAL',
  'ENTERPRISE_STANDARD_MONTHLY',
  'ENTERPRISE_STANDARD_ANNUAL',
  'ENTERPRISE_PRO_MONTHLY',
  'ENTERPRISE_PRO_ANNUAL',
  'ENTERPRISE_MONTHLY',
  'ENTERPRISE_ANNUAL',
  'ENTERPRISE_CUSTOM'
] as const;

const planCodeSet = new Set<string>(planCodes);

type RoleTemplateDate = Date | string;

type RoleTemplateRecord = {
  id: string;
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: unknown;
  tools: unknown;
  skills: unknown;
  approvalPolicy: string;
  status: string;
  allowedPlanCodes: unknown;
  visibleWorkspaceIds: unknown;
  publishedAt?: RoleTemplateDate | null;
  lastTestedAt?: RoleTemplateDate | null;
  createdAt: RoleTemplateDate;
  updatedAt: RoleTemplateDate;
};

interface NormalizedRoleTemplateInput {
  version: string;
  name: string;
  industry: string;
  scenario: string;
  description: string;
  recommendedPlanCode: string;
  businessGoal: string;
  knowledgeSources: string[];
  tools: string[];
  skills: Array<{
    code: string;
    name: string;
    summary: string;
  }>;
  approvalPolicy: string;
  status: RoleTemplateStatus;
  allowedPlanCodes: string[];
  visibleWorkspaceIds: string[];
}

@Injectable()
export class RoleTemplateFactoryService {
  constructor(
    @Inject(AuthService)
    private readonly authService: AuthService,
    @Inject(PrismaService)
    private readonly prismaService: PrismaService,
    @Inject(MockPlatformStore)
    private readonly store: MockPlatformStore
  ) {}

  async listTemplates(cookieHeader?: string): Promise<ListAdminRoleTemplatesResponseDto> {
    await this.requireAdminOperator(cookieHeader);

    if (!isDatabasePersistenceEnabled()) {
      return {
        data: this.store.listRoleTemplates().map((template) => this.toAdminTemplateDetail(template))
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      orderBy: [
        {
          updatedAt: 'desc'
        }
      ]
    });

    return {
      data: templates.map((template) => this.toAdminTemplateDetail(template))
    };
  }

  async getTemplate(
    templateId: string,
    cookieHeader?: string
  ): Promise<GetAdminRoleTemplateResponseDto> {
    await this.requireAdminOperator(cookieHeader);

    if (!isDatabasePersistenceEnabled()) {
      const template = this.store.getRoleTemplate(templateId);
      if (!template) {
        throw this.templateNotFound(templateId);
      }

      return {
        data: this.toAdminTemplateDetail(template)
      };
    }

    const template = await this.prismaService.roleTemplate.findUnique({
      where: {
        id: templateId
      }
    });

    if (!template) {
      throw this.templateNotFound(templateId);
    }

    return {
      data: this.toAdminTemplateDetail(template)
    };
  }

  async createTemplate(
    input: CreateAdminRoleTemplateRequestDto,
    cookieHeader?: string
  ): Promise<CreateAdminRoleTemplateResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const normalized = this.normalizeCreateInput(input);

    if (normalized.status === 'PUBLISHED') {
      this.assertTemplatePublishable({
        id: input.id.trim(),
        ...normalized,
        publishedAt: null,
        lastTestedAt: null,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    if (!isDatabasePersistenceEnabled()) {
      const created = this.store.createRoleTemplate({
        id: input.id.trim(),
        ...normalized,
        publishedAt: normalized.status === 'PUBLISHED' ? new Date().toISOString() : undefined,
        lastTestedAt: undefined
      });
      if (!created) {
        throw this.templateConflict(input.id);
      }
      return {
        data: this.toAdminTemplateDetail(created)
      };
    }

    const existing = await this.prismaService.roleTemplate.findUnique({
      where: {
        id: input.id.trim()
      }
    });
    if (existing) {
      throw this.templateConflict(input.id);
    }

    const created = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.create({
        data: {
          id: input.id.trim(),
          ...this.toCreateData(normalized)
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'CREATE_ROLE_TEMPLATE',
        targetType: 'role_template',
        targetId: template.id,
        summary: `Created role template ${template.name}`,
        metadata: {
          status: template.status,
          allowedPlanCodes: this.toStringArray(template.allowedPlanCodes),
          visibleWorkspaceIds: this.toStringArray(template.visibleWorkspaceIds)
        }
      });

      return template;
    });

    return {
      data: this.toAdminTemplateDetail(created)
    };
  }

  async updateTemplate(
    templateId: string,
    input: UpdateAdminRoleTemplateRequestDto,
    cookieHeader?: string
  ): Promise<UpdateAdminRoleTemplateResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = templateId.trim();
    const normalizedUpdate = this.normalizeUpdateInput(input);

    if (!isDatabasePersistenceEnabled()) {
      const current = this.store.getRoleTemplate(id);
      if (!current) {
        throw this.templateNotFound(id);
      }

      if ((normalizedUpdate.status ?? current.status) === 'PUBLISHED') {
        this.assertTemplatePublishable({
          ...current,
          ...normalizedUpdate,
          status: 'PUBLISHED'
        });
      }

      const updated = this.store.updateRoleTemplate(id, normalizedUpdate);
      return {
        data: this.toAdminTemplateDetail(updated!)
      };
    }

    const existing = await this.prismaService.roleTemplate.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      throw this.templateNotFound(id);
    }

    const updateData = this.toUpdateData(normalizedUpdate);
    if (Object.keys(updateData).length === 0) {
      return {
        data: this.toAdminTemplateDetail(existing)
      };
    }

    if ((normalizedUpdate.status ?? existing.status) === 'PUBLISHED') {
      this.assertTemplatePublishable({
        ...existing,
        ...normalizedUpdate,
        status: 'PUBLISHED'
      });
    }

    const updated = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.update({
        where: {
          id
        },
        data: updateData
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'UPDATE_ROLE_TEMPLATE',
        targetType: 'role_template',
        targetId: template.id,
        summary: `Updated role template ${template.name}`,
        metadata: input
      });

      return template;
    });

    return {
      data: this.toAdminTemplateDetail(updated)
    };
  }

  async publishTemplate(
    templateId: string,
    cookieHeader?: string
  ): Promise<PublishAdminRoleTemplateResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = templateId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const template = this.store.updateRoleTemplate(id, {
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString()
      });
      if (!template) {
        throw this.templateNotFound(id);
      }
      return {
        data: this.toAdminTemplateDetail(template)
      };
    }

    const existing = await this.prismaService.roleTemplate.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      throw this.templateNotFound(id);
    }

    this.assertTemplatePublishable(existing);

    const publishedAt = new Date();
    const published = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.update({
        where: {
          id
        },
        data: {
          status: 'PUBLISHED',
          publishedAt
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'PUBLISH_ROLE_TEMPLATE',
        targetType: 'role_template',
        targetId: template.id,
        summary: `Published role template ${template.name}`,
        metadata: {
          version: template.version,
          allowedPlanCodes: this.toStringArray(template.allowedPlanCodes),
          visibleWorkspaceIds: this.toStringArray(template.visibleWorkspaceIds)
        }
      });

      return template;
    });

    return {
      data: this.toAdminTemplateDetail(published)
    };
  }

  async archiveTemplate(
    templateId: string,
    cookieHeader?: string
  ): Promise<PublishAdminRoleTemplateResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = templateId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const template = this.store.updateRoleTemplate(id, {
        status: 'ARCHIVED'
      });
      if (!template) {
        throw this.templateNotFound(id);
      }
      return {
        data: this.toAdminTemplateDetail(template)
      };
    }

    const existing = await this.prismaService.roleTemplate.findUnique({
      where: {
        id
      }
    });
    if (!existing) {
      throw this.templateNotFound(id);
    }

    const archived = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.update({
        where: {
          id
        },
        data: {
          status: 'ARCHIVED'
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'ARCHIVE_ROLE_TEMPLATE',
        targetType: 'role_template',
        targetId: template.id,
        summary: `Archived role template ${template.name}`,
        metadata: {
          version: template.version
        }
      });

      return template;
    });

    return {
      data: this.toAdminTemplateDetail(archived)
    };
  }

  async testTemplate(
    templateId: string,
    input: TestAdminRoleTemplateRequestDto,
    cookieHeader?: string
  ): Promise<TestAdminRoleTemplateResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = templateId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const template = this.store.getRoleTemplate(id);
      if (!template) {
        throw this.templateNotFound(id);
      }
      const testedAt = new Date().toISOString();
      this.store.updateRoleTemplate(id, {
        lastTestedAt: testedAt
      });
      return this.toTemplateTestResponse(template, input);
    }

    const testedAt = new Date();
    const template = await this.prismaService.$transaction(async (tx) => {
      const current = await tx.roleTemplate.findUnique({
        where: {
          id
        }
      });
      if (!current) {
        throw this.templateNotFound(id);
      }

      const updated = await tx.roleTemplate.update({
        where: {
          id
        },
        data: {
          lastTestedAt: testedAt
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'TEST_ROLE_TEMPLATE',
        targetType: 'role_template',
        targetId: updated.id,
        summary: `Tested role template ${updated.name}`,
        metadata: {
          sampleInput: input.sampleInput?.trim(),
          sampleWorkspaceId: input.sampleWorkspaceId?.trim()
        }
      });

      return updated;
    });

    return this.toTemplateTestResponse(template, input);
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

  private normalizeCreateInput(input: CreateAdminRoleTemplateRequestDto): NormalizedRoleTemplateInput {
    const recommendedPlanCode = this.requirePlanCode(input.recommendedPlanCode);
    const status = (input.status ?? 'DRAFT') as RoleTemplateStatus;
    const allowedPlanCodes = input.allowedPlanCodes
      ? this.normalizePlanCodes(input.allowedPlanCodes)
      : this.expandDefaultAllowedPlanCodes(recommendedPlanCode);

    return {
      version: this.requireText(input.version, 'Version cannot be empty.'),
      name: this.requireText(input.name, 'Template name cannot be empty.'),
      industry: this.requireText(input.industry, 'Industry cannot be empty.'),
      scenario: this.requireText(input.scenario, 'Scenario cannot be empty.'),
      description: this.requireText(input.description, 'Description cannot be empty.'),
      recommendedPlanCode,
      businessGoal: this.requireText(input.businessGoal, 'Business goal cannot be empty.'),
      knowledgeSources: this.normalizeStringArray(input.knowledgeSources),
      tools: this.normalizeStringArray(input.tools),
      skills: this.normalizeSkills(input.skills),
      approvalPolicy: this.requireText(input.approvalPolicy, 'Approval policy cannot be empty.'),
      status,
      allowedPlanCodes,
      visibleWorkspaceIds: this.normalizeStringArray(input.visibleWorkspaceIds ?? [])
    };
  }

  private normalizeUpdateInput(input: UpdateAdminRoleTemplateRequestDto): Partial<NormalizedRoleTemplateInput> & {
    publishedAt?: string;
    lastTestedAt?: string;
  } {
    const normalized: Partial<NormalizedRoleTemplateInput> & {
      publishedAt?: string;
      lastTestedAt?: string;
    } = {};

    if (input.version !== undefined) normalized.version = this.requireText(input.version, 'Version cannot be empty.');
    if (input.name !== undefined) normalized.name = this.requireText(input.name, 'Template name cannot be empty.');
    if (input.industry !== undefined) normalized.industry = this.requireText(input.industry, 'Industry cannot be empty.');
    if (input.scenario !== undefined) normalized.scenario = this.requireText(input.scenario, 'Scenario cannot be empty.');
    if (input.description !== undefined) {
      normalized.description = this.requireText(input.description, 'Description cannot be empty.');
    }
    if (input.recommendedPlanCode !== undefined) normalized.recommendedPlanCode = this.requirePlanCode(input.recommendedPlanCode);
    if (input.businessGoal !== undefined) {
      normalized.businessGoal = this.requireText(input.businessGoal, 'Business goal cannot be empty.');
    }
    if (input.knowledgeSources !== undefined) normalized.knowledgeSources = this.normalizeStringArray(input.knowledgeSources);
    if (input.tools !== undefined) normalized.tools = this.normalizeStringArray(input.tools);
    if (input.skills !== undefined) normalized.skills = this.normalizeSkills(input.skills);
    if (input.approvalPolicy !== undefined) {
      normalized.approvalPolicy = this.requireText(input.approvalPolicy, 'Approval policy cannot be empty.');
    }
    if (input.status !== undefined) normalized.status = input.status as RoleTemplateStatus;
    if (input.allowedPlanCodes !== undefined) normalized.allowedPlanCodes = this.normalizePlanCodes(input.allowedPlanCodes);
    if (input.visibleWorkspaceIds !== undefined) {
      normalized.visibleWorkspaceIds = this.normalizeStringArray(input.visibleWorkspaceIds);
    }

    return normalized;
  }

  private toCreateData(input: NormalizedRoleTemplateInput) {
    const now = new Date();
    return {
      version: input.version,
      name: input.name,
      industry: input.industry,
      scenario: input.scenario,
      description: input.description,
      recommendedPlanCode: input.recommendedPlanCode,
      businessGoal: input.businessGoal,
      knowledgeSources: input.knowledgeSources,
      tools: input.tools,
      skills: input.skills,
      approvalPolicy: input.approvalPolicy,
      status: input.status,
      allowedPlanCodes: input.allowedPlanCodes,
      visibleWorkspaceIds: input.visibleWorkspaceIds,
      publishedAt: input.status === 'PUBLISHED' ? now : null
    };
  }

  private toUpdateData(
    input: Partial<NormalizedRoleTemplateInput>
  ): Prisma.RoleTemplateUpdateInput {
    const data: Prisma.RoleTemplateUpdateInput = {};

    if (input.version !== undefined) data.version = input.version;
    if (input.name !== undefined) data.name = input.name;
    if (input.industry !== undefined) data.industry = input.industry;
    if (input.scenario !== undefined) data.scenario = input.scenario;
    if (input.description !== undefined) data.description = input.description;
    if (input.recommendedPlanCode !== undefined) data.recommendedPlanCode = input.recommendedPlanCode;
    if (input.businessGoal !== undefined) data.businessGoal = input.businessGoal;
    if (input.knowledgeSources !== undefined) data.knowledgeSources = input.knowledgeSources;
    if (input.tools !== undefined) data.tools = input.tools;
    if (input.skills !== undefined) data.skills = input.skills;
    if (input.approvalPolicy !== undefined) data.approvalPolicy = input.approvalPolicy;
    if (input.status !== undefined) {
      data.status = input.status;
      if (input.status === 'PUBLISHED') {
        data.publishedAt = new Date();
      }
    }
    if (input.allowedPlanCodes !== undefined) data.allowedPlanCodes = input.allowedPlanCodes;
    if (input.visibleWorkspaceIds !== undefined) data.visibleWorkspaceIds = input.visibleWorkspaceIds;

    return data;
  }

  private toAdminTemplateDetail(template: RoleTemplateRecord): AdminRoleTemplateDetailDto {
    return {
      id: template.id,
      version: template.version,
      name: template.name,
      industry: template.industry,
      scenario: template.scenario,
      description: template.description,
      recommendedPlanCode: template.recommendedPlanCode,
      businessGoal: template.businessGoal,
      knowledgeSources: this.toStringArray(template.knowledgeSources),
      tools: this.toStringArray(template.tools),
      skills: this.toSkillSummaries(template.skills),
      approvalPolicy: template.approvalPolicy,
      status: this.toRoleTemplateStatus(template.status),
      allowedPlanCodes: this.toStringArray(template.allowedPlanCodes),
      visibleWorkspaceIds: this.toStringArray(template.visibleWorkspaceIds),
      publishedAt: this.toIsoDateString(template.publishedAt),
      lastTestedAt: this.toIsoDateString(template.lastTestedAt),
      createdAt: this.toRequiredIsoDateString(template.createdAt),
      updatedAt: this.toRequiredIsoDateString(template.updatedAt)
    };
  }

  private toTemplateTestResponse(
    template: RoleTemplateRecord,
    input: TestAdminRoleTemplateRequestDto
  ): TestAdminRoleTemplateResponseDto {
    const issues = this.validateTemplateForPublish(template);
    const warnings = [...issues];

    if (this.toStringArray(template.knowledgeSources).length === 0) {
      warnings.push('Template has no knowledge source requirement.');
    }
    if (this.toStringArray(template.tools).length === 0) {
      warnings.push('Template has no tool requirement.');
    }
    if (!input.sampleInput?.trim()) {
      warnings.push('No sample input was provided; only structural validation was performed.');
    }

    const valid = issues.length === 0;

    return {
      data: {
        templateId: template.id,
        valid,
        status: valid ? 'passed' : 'failed',
        message: valid
          ? 'Template passed basic factory validation.'
          : 'Template failed basic factory validation.',
        warnings,
        sampleInput: input.sampleInput?.trim()
      }
    };
  }

  private validateTemplateForPublish(template: RoleTemplateRecord): string[] {
    const issues: string[] = [];

    if (this.toSkillSummaries(template.skills).length === 0) {
      issues.push('Template must define at least one skill.');
    }
    if (
      this.toStringArray(template.allowedPlanCodes).length === 0 &&
      this.toStringArray(template.visibleWorkspaceIds).length === 0
    ) {
      issues.push('Template must be visible to at least one plan or workspace before publication.');
    }
    if (!planCodeSet.has(template.recommendedPlanCode)) {
      issues.push(`Recommended plan code is invalid: ${template.recommendedPlanCode}.`);
    }

    return issues;
  }

  private assertTemplatePublishable(template: RoleTemplateRecord): void {
    const issues = this.validateTemplateForPublish(template);
    if (issues.length > 0) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Role template cannot be published until validation issues are fixed.',
          details: {
            templateId: template.id,
            issues
          }
        }
      });
    }
  }

  private normalizePlanCodes(values: string[]): string[] {
    return this.normalizeStringArray(values).map((value) => this.requirePlanCode(value));
  }

  private requirePlanCode(value: string): string {
    const code = value.trim().toUpperCase();
    if (!planCodeSet.has(code)) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Plan code is invalid.',
          details: {
            planCode: value
          }
        }
      });
    }

    return code;
  }

  private expandDefaultAllowedPlanCodes(planCode: string): string[] {
    switch (planCode) {
      case 'ENTERPRISE_BASIC_MONTHLY':
      case 'ENTERPRISE_BASIC_ANNUAL':
        return ['ENTERPRISE_BASIC_MONTHLY', 'ENTERPRISE_BASIC_ANNUAL'];
      case 'ENTERPRISE_STANDARD_MONTHLY':
      case 'ENTERPRISE_STANDARD_ANNUAL':
        return ['ENTERPRISE_STANDARD_MONTHLY', 'ENTERPRISE_STANDARD_ANNUAL'];
      case 'ENTERPRISE_PRO_MONTHLY':
      case 'ENTERPRISE_PRO_ANNUAL':
        return ['ENTERPRISE_PRO_MONTHLY', 'ENTERPRISE_PRO_ANNUAL'];
      case 'ENTERPRISE_MONTHLY':
      case 'ENTERPRISE_ANNUAL':
        return ['ENTERPRISE_MONTHLY', 'ENTERPRISE_ANNUAL'];
      default:
        return [planCode];
    }
  }

  private normalizeStringArray(values: string[]): string[] {
    return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  }

  private normalizeSkills(values: Array<{ code: string; name: string; summary: string }>) {
    return values.map((skill) => ({
      code: this.requireText(skill.code, 'Skill code cannot be empty.'),
      name: this.requireText(skill.name, 'Skill name cannot be empty.'),
      summary: this.requireText(skill.summary, 'Skill summary cannot be empty.')
    }));
  }

  private requireText(value: string, message: string): string {
    const normalized = value.trim();
    if (!normalized) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message
        }
      });
    }

    return normalized;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === 'string');
  }

  private toSkillSummaries(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.flatMap((item) => {
      if (typeof item !== 'object' || item === null || Array.isArray(item)) {
        return [];
      }

      const record = item as Record<string, unknown>;
      const code = typeof record.code === 'string' ? record.code.trim() : '';
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const summary = typeof record.summary === 'string' ? record.summary.trim() : '';

      if (!code || !name || !summary) {
        return [];
      }

      return [{ code, name, summary }];
    });
  }

  private toRoleTemplateStatus(value: string): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' {
    if (value === 'DRAFT' || value === 'ARCHIVED') {
      return value;
    }

    return 'PUBLISHED';
  }

  private toIsoDateString(value: RoleTemplateDate | null | undefined): string | undefined {
    if (!value) {
      return undefined;
    }

    return value instanceof Date ? value.toISOString() : value;
  }

  private toRequiredIsoDateString(value: RoleTemplateDate): string {
    return this.toIsoDateString(value) ?? new Date(0).toISOString();
  }

  private async recordAdminAction(
    tx: Prisma.TransactionClient,
    input: {
      operatorAccountId: string;
      action: string;
      targetType: string;
      targetId: string;
      summary: string;
      metadata?: unknown;
    }
  ): Promise<void> {
    await tx.adminActionLog.create({
      data: {
        operatorAccountId: input.operatorAccountId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        summary: input.summary,
        metadata: input.metadata === undefined ? undefined : this.toMetadataRecord(input.metadata)
      }
    });
  }

  private toMetadataRecord(value: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private templateNotFound(templateId: string) {
    return new NotFoundException({
      error: {
        code: 'NOT_FOUND',
        message: 'Role template was not found.',
        details: {
          templateId
        }
      }
    });
  }

  private templateConflict(templateId: string) {
    return new ConflictException({
      error: {
        code: 'CONFLICT',
        message: 'Role template already exists.',
        details: {
          templateId
        }
      }
    });
  }
}
