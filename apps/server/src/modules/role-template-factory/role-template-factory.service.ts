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
import { getDefaultAssetDefinitions } from '../../shared/asset-center-catalog';
import { MockPlatformStore } from '../../shared/mock/mock-platform-store.service';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  buildRoleTemplateDependencyManifest,
  type RoleTemplateDependencyAsset
} from '../../shared/role-template-dependencies';
import { getServerToolAction } from '../../shared/tool-action-catalog';
import {
  buildWorkflowGraphFromSteps,
  normalizeWorkflowGraph,
  normalizeWorkflowGraphOrFallback,
  type ServerRoleWorkflowGraph,
  type ServerRoleWorkflowGraphNode
} from '../../shared/workflow-graph';
import { AuthService } from '../auth/auth.service';
import type { CurrentAccountResponseDto } from '../workspace/dto/current-account-response.dto';
import {
  AdminRoleTemplateDetailDto,
  CreateAdminRoleTemplateRequestDto,
  CreateAdminRoleTemplateResponseDto,
  DeleteAdminRoleTemplateResponseDto,
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
const workflowStepTypes = ['input', 'llm', 'knowledge', 'tool', 'approval', 'output'] as const;
const workflowStepTypeSet = new Set<string>(workflowStepTypes);

type RoleTemplateDate = Date | string;
type RoleTemplateStepType = (typeof workflowStepTypes)[number];

type RoleTemplateWorkflowStep = {
  id: string;
  order: number;
  type: RoleTemplateStepType;
  name: string;
  instruction: string;
  toolIds?: string[];
  requiresApproval?: boolean;
};

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
  workflowSteps: unknown;
  workflowGraph: unknown;
  dependencyManifest?: unknown;
  sampleInputs: unknown;
  outputFormat?: string | null;
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
  workflowSteps: RoleTemplateWorkflowStep[];
  workflowGraph: ServerRoleWorkflowGraph;
  dependencyManifest: ReturnType<typeof buildRoleTemplateDependencyManifest>;
  sampleInputs: string[];
  outputFormat: string;
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
        data: this.store
          .listRoleTemplates()
          .filter((template) => template.status !== 'DELETED')
          .map((template) => this.toAdminTemplateDetail(template))
      };
    }

    const templates = await this.prismaService.roleTemplate.findMany({
      where: {
        status: {
          not: 'DELETED'
        }
      },
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
      if (!template || template.status === 'DELETED') {
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

    if (!template || template.status === 'DELETED') {
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
      if (!current || current.status === 'DELETED') {
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
    if (!existing || existing.status === 'DELETED') {
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
      const current = this.store.getRoleTemplate(id);
      const template = this.store.updateRoleTemplate(id, {
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        dependencyManifest: current
          ? this.buildDependencyManifestFromRecord(current, getDefaultAssetDefinitions())
          : undefined
      });
      if (!template || template.status === 'DELETED') {
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
    if (!existing || existing.status === 'DELETED') {
      throw this.templateNotFound(id);
    }

    this.assertTemplatePublishable(existing);

    const publishedAt = new Date();
    const dependencyManifest = await this.buildDependencyManifestForRecord(existing);
    const published = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.update({
        where: {
          id
        },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          dependencyManifest: dependencyManifest as unknown as Prisma.InputJsonValue
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
      if (!template || template.status === 'DELETED') {
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
    if (!existing || existing.status === 'DELETED') {
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

  async deleteTemplate(
    templateId: string,
    cookieHeader?: string
  ): Promise<DeleteAdminRoleTemplateResponseDto> {
    const operator = await this.requireAdminOperator(cookieHeader);
    const id = templateId.trim();

    if (!isDatabasePersistenceEnabled()) {
      const template = this.store.getRoleTemplate(id);
      if (!template) {
        throw this.templateNotFound(id);
      }
      if (template.status === 'DELETED') {
        return {
          data: {
            id
          }
        };
      }

      this.store.updateRoleTemplate(id, {
        status: 'DELETED'
      });
      return {
        data: {
          id
        }
      };
    }

    const deletedId = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.findUnique({
        where: {
          id
        }
      });
      if (!template) {
        throw this.templateNotFound(id);
      }
      if (template.status === 'DELETED') {
        return template.id;
      }

      const deleted = await tx.roleTemplate.update({
        where: {
          id
        },
        data: {
          status: 'DELETED'
        }
      });

      await this.recordAdminAction(tx, {
        operatorAccountId: operator.account.id,
        action: 'DELETE_ROLE_TEMPLATE',
        targetType: 'role_template',
        targetId: template.id,
        summary: `Deleted role template ${template.name}`,
        metadata: {
          version: template.version,
          previousStatus: template.status,
          status: deleted.status
        }
      });

      return template.id;
    });

    return {
      data: {
        id: deletedId
      }
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
      if (!template || template.status === 'DELETED') {
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
      if (!current || current.status === 'DELETED') {
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
    const workflowSteps = this.normalizeWorkflowSteps(input.workflowSteps ?? []);
    const workflowGraph = this.normalizeWorkflowGraphInput(input.workflowGraph, workflowSteps);

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
      workflowSteps,
      workflowGraph,
      dependencyManifest: buildRoleTemplateDependencyManifest({
        workflowGraph,
        assets: getDefaultAssetDefinitions()
      }),
      sampleInputs: this.normalizeStringArray(input.sampleInputs ?? []),
      outputFormat: this.normalizeOptionalText(
        input.outputFormat,
        'Markdown report with summary, findings, risks, next actions, and local artifact links.'
      ),
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
    if (input.workflowSteps !== undefined) normalized.workflowSteps = this.normalizeWorkflowSteps(input.workflowSteps);
    if (input.workflowGraph !== undefined) {
      normalized.workflowGraph = this.normalizeWorkflowGraphInput(
        input.workflowGraph,
        normalized.workflowSteps ?? []
      );
      normalized.dependencyManifest = buildRoleTemplateDependencyManifest({
        workflowGraph: normalized.workflowGraph,
        assets: getDefaultAssetDefinitions()
      });
    } else if (normalized.workflowSteps !== undefined) {
      normalized.workflowGraph = buildWorkflowGraphFromSteps(normalized.workflowSteps);
      normalized.dependencyManifest = buildRoleTemplateDependencyManifest({
        workflowGraph: normalized.workflowGraph,
        assets: getDefaultAssetDefinitions()
      });
    }
    if (input.sampleInputs !== undefined) normalized.sampleInputs = this.normalizeStringArray(input.sampleInputs);
    if (input.outputFormat !== undefined) {
      normalized.outputFormat = this.normalizeOptionalText(
        input.outputFormat,
        'Markdown report with summary, findings, risks, next actions, and local artifact links.'
      );
    }
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
      workflowSteps: input.workflowSteps,
      workflowGraph: input.workflowGraph as unknown as Prisma.InputJsonValue,
      dependencyManifest: input.dependencyManifest as unknown as Prisma.InputJsonValue,
      sampleInputs: input.sampleInputs,
      outputFormat: input.outputFormat,
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
    if (input.workflowSteps !== undefined) data.workflowSteps = input.workflowSteps;
    if (input.workflowGraph !== undefined) {
      data.workflowGraph = input.workflowGraph as unknown as Prisma.InputJsonValue;
    }
    if (input.dependencyManifest !== undefined) {
      data.dependencyManifest = input.dependencyManifest as unknown as Prisma.InputJsonValue;
    }
    if (input.sampleInputs !== undefined) data.sampleInputs = input.sampleInputs;
    if (input.outputFormat !== undefined) data.outputFormat = input.outputFormat;
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
    const workflowSteps = this.toWorkflowSteps(template.workflowSteps);
    const workflowGraph = normalizeWorkflowGraphOrFallback(template.workflowGraph, workflowSteps);

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
      workflowSteps,
      workflowGraph,
      dependencyManifest: this.toDependencyManifest(template.dependencyManifest, workflowGraph),
      sampleInputs: this.toStringArray(template.sampleInputs),
      outputFormat: template.outputFormat?.trim() || '',
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
    if (this.toStringArray(template.sampleInputs).length === 0) {
      warnings.push('Template has no sample input.');
    }
    if (!template.outputFormat?.trim()) {
      warnings.push('Template has no output format.');
    }
    if (!input.sampleInput?.trim()) {
      warnings.push('No sample input was provided; only structural validation was performed.');
    }

    const graph = this.getTemplateWorkflowGraphForInspection(template);
    const requiredToolActions = graph ? this.getRequiredWorkflowToolActionIds(graph) : [];
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
        sampleInput: input.sampleInput?.trim(),
        graphTrace: this.buildTemplateTestGraphTrace(template, input),
        requiredToolActions
      }
    };
  }

  private buildTemplateTestGraphTrace(
    template: RoleTemplateRecord,
    input: TestAdminRoleTemplateRequestDto
  ): NonNullable<TestAdminRoleTemplateResponseDto['data']['graphTrace']> {
    const workflowSteps = this.toWorkflowSteps(template.workflowSteps);
    const graph = normalizeWorkflowGraphOrFallback(template.workflowGraph, workflowSteps);
    const templateTools = new Set(this.toStringArray(template.tools));
    const knowledgeSources = this.toStringArray(template.knowledgeSources);
    const outgoingEdgesByNodeId = new Map<string, string[]>();

    for (const edge of graph.edges) {
      const targets = outgoingEdgesByNodeId.get(edge.sourceNodeId) ?? [];
      const condition = edge.condition?.type && edge.condition.type !== 'always'
        ? ` when ${edge.condition.type}${edge.condition.variable ? `(${edge.condition.variable})` : ''}`
        : '';
      targets.push(`${edge.targetNodeId}${condition}`);
      outgoingEdgesByNodeId.set(edge.sourceNodeId, targets);
    }

    return {
      entryNodeId: graph.entryNodeId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodes: graph.nodes.map((node) => {
        const actionId = this.getWorkflowNodeToolActionId(node);
        const actionDefinition = actionId ? getServerToolAction(actionId) : undefined;
        const warnings = this.getWorkflowNodeTraceWarnings(node, templateTools);
        return {
          nodeId: node.id,
          nodeName: node.name,
          nodeType: node.type,
          status: warnings.length > 0 ? 'warning' : 'passed',
          inputPreview: this.describeWorkflowNodeInput(node, input, knowledgeSources),
          outputPreview: this.describeWorkflowNodeOutput(node, outgoingEdgesByNodeId.get(node.id) ?? []),
          warnings,
          toolActionId: actionId,
          requiredInputTypes: actionDefinition?.input.map((port) => port.type),
          producedOutputTypes: actionDefinition?.output.map((port) => port.type)
        };
      })
    };
  }

  private getWorkflowNodeTraceWarnings(
    node: ServerRoleWorkflowGraphNode,
    templateTools: Set<string>
  ): string[] {
    const warnings: string[] = [];

    if (node.type === 'tool' || node.type === 'artifact') {
      if (!node.toolId) {
        warnings.push(`${node.type} node has no toolId.`);
      }

      const actionId = this.getWorkflowNodeToolActionId(node);
      if (!actionId) {
        warnings.push(`${node.type} node has no tool action.`);
      } else {
        const actionDefinition = getServerToolAction(actionId);
        if (!actionDefinition) {
          warnings.push(`Tool action ${actionId} is not defined in the server tool catalog.`);
        } else {
          if (node.toolId && actionDefinition.packageId !== node.toolId) {
            warnings.push(
              `Tool action ${actionId} belongs to ${actionDefinition.packageId}, but node toolId is ${node.toolId}.`
            );
          }
          if (!templateTools.has(actionDefinition.packageId)) {
            warnings.push(
              `Template tools list does not include required tool package ${actionDefinition.packageId}.`
            );
          }
          if (node.type === 'artifact' && node.artifactType && actionDefinition.artifactFormat) {
            const actionArtifactType = actionDefinition.artifactFormat === 'md'
              ? 'markdown'
              : actionDefinition.artifactFormat;
            if (actionArtifactType !== node.artifactType) {
              warnings.push(
                `Artifact node outputs ${node.artifactType}, but tool action ${actionId} outputs ${actionArtifactType}.`
              );
            }
          }
        }
      }
    }

    if (node.type === 'artifact' && !node.artifactType) {
      warnings.push('Artifact node has no artifactType.');
    }

    if (node.type === 'llm' && !node.instruction?.trim()) {
      warnings.push('LLM node has no instruction.');
    }

    if (node.type === 'data' && this.getWorkflowDataMode(node) === 'template') {
      const template = typeof node.config?.template === 'string' ? node.config.template.trim() : '';
      if (!template) {
        warnings.push('Data node template mode has no template.');
      }
    }

    if (node.type === 'data' && this.getWorkflowDataMode(node) === 'assign') {
      const assignments = Array.isArray(node.config?.assignments) ? node.config.assignments : [];
      if (assignments.length === 0) {
        warnings.push('Data node assign mode has no assignments.');
      }
    }

    if (node.type === 'data' && this.getWorkflowDataMode(node) === 'code') {
      const code = typeof node.config?.code === 'string' ? node.config.code.trim() : '';
      const outputVariable = typeof node.config?.outputVariable === 'string'
        ? node.config.outputVariable.trim()
        : node.outputVariables?.[0]?.trim();
      const timeoutMs = typeof node.config?.timeoutMs === 'number' ? node.config.timeoutMs : 0;
      if (!code) {
        warnings.push('Data node code mode has no script.');
      }
      if (!outputVariable) {
        warnings.push('Data node code mode has no output variable.');
      }
      if (!timeoutMs) {
        warnings.push('Data node code mode has no timeoutMs.');
      } else if (timeoutMs > 10000) {
        warnings.push('Data node code mode timeoutMs must not exceed 10000.');
      }
    }

    return warnings;
  }

  private getWorkflowNodeToolActionId(node: ServerRoleWorkflowGraphNode): string | undefined {
    const action = typeof node.config?.action === 'string' ? node.config.action.trim() : '';
    return action || undefined;
  }

  private getWorkflowDataMode(node: ServerRoleWorkflowGraphNode): 'assign' | 'template' | 'code' {
    const mode = typeof node.config?.dataMode === 'string' ? node.config.dataMode.trim() : '';
    return mode === 'template' || mode === 'code' ? mode : 'assign';
  }

  private getTemplateWorkflowGraphForInspection(template: RoleTemplateRecord): ServerRoleWorkflowGraph | undefined {
    try {
      return normalizeWorkflowGraphOrFallback(template.workflowGraph, this.toWorkflowSteps(template.workflowSteps));
    } catch {
      return undefined;
    }
  }

  private getRequiredWorkflowToolActionIds(graph: ServerRoleWorkflowGraph): string[] {
    return [
      ...new Set(
        graph.nodes
          .filter((node) => node.type === 'tool' || node.type === 'artifact')
          .map((node) => this.getWorkflowNodeToolActionId(node))
          .filter((actionId): actionId is string => Boolean(actionId))
      )
    ];
  }

  private validateWorkflowGraphToolActions(
    graph: ServerRoleWorkflowGraph,
    templateTools: Set<string>
  ): string[] {
    return graph.nodes.flatMap((node) => this.getWorkflowNodeTraceWarnings(node, templateTools));
  }

  private describeWorkflowNodeInput(
    node: ServerRoleWorkflowGraphNode,
    input: TestAdminRoleTemplateRequestDto,
    knowledgeSources: string[]
  ): string {
    const variables = this.joinPreviewList(node.inputVariables ?? []);
    const sampleInput = input.sampleInput?.trim();

    switch (node.type) {
      case 'start':
      case 'input':
        return sampleInput
          ? `Sample task: ${this.compactPreview(sampleInput)}`
          : variables || 'No sample task was provided.';
      case 'knowledge':
        return [
          variables,
          knowledgeSources.length > 0 ? `Knowledge sources: ${this.joinPreviewList(knowledgeSources)}` : ''
        ].filter(Boolean).join(' ');
      case 'tool':
        return [
          variables,
          node.toolId ? `Tool: ${node.toolId}.` : 'Tool: missing.',
          this.describeNodeConfig(node.config)
        ].filter(Boolean).join(' ');
      case 'condition':
        return variables || this.describeNodeConfig(node.config) || 'Reads workflow state for branch selection.';
      case 'data':
        return this.describeNodeConfig(node.config) || variables || `Processes workflow data with ${this.getWorkflowDataMode(node)} mode.`;
      case 'artifact':
        return [
          variables,
          node.artifactType ? `Target artifact: ${node.artifactType}.` : ''
        ].filter(Boolean).join(' ');
      default:
        return variables || node.instruction || 'Uses workflow state.';
    }
  }

  private describeWorkflowNodeOutput(
    node: ServerRoleWorkflowGraphNode,
    outgoingTargets: string[]
  ): string {
    const variables = this.joinPreviewList(node.outputVariables ?? []);
    const targetText = outgoingTargets.length > 0 ? `Next: ${this.joinPreviewList(outgoingTargets)}` : '';

    switch (node.type) {
      case 'start':
        return targetText || 'Workflow starts.';
      case 'knowledge':
        return variables || 'Prepares knowledge context.';
      case 'tool':
        return variables || 'Prepares tool result for later nodes.';
      case 'condition':
        return targetText || 'Chooses the next branch.';
      case 'data':
        return variables || `Writes ${this.getWorkflowDataMode(node)} mode result.`;
      case 'artifact':
        return variables || `Generates local ${node.artifactType ?? 'artifact'} deliverable.`;
      case 'output':
        return variables || 'Returns final response to the desktop client.';
      default:
        return [variables || 'Produces node result.', targetText].filter(Boolean).join(' ');
    }
  }

  private describeNodeConfig(config: Record<string, unknown> | undefined): string {
    if (!config) {
      return '';
    }

    const action = typeof config.action === 'string' ? config.action.trim() : '';
    if (action) {
      return `Action: ${action}.`;
    }

    return `Config: ${this.compactPreview(JSON.stringify(config))}`;
  }

  private joinPreviewList(values: string[]): string {
    const normalized = values.map((value) => value.trim()).filter(Boolean);
    if (normalized.length === 0) {
      return '';
    }

    return normalized.slice(0, 6).join(', ') + (normalized.length > 6 ? `, +${normalized.length - 6}` : '');
  }

  private compactPreview(value: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
  }

  private validateTemplateForPublish(template: RoleTemplateRecord): string[] {
    const issues: string[] = [];

    if (this.toSkillSummaries(template.skills).length === 0) {
      issues.push('Template must define at least one skill.');
    }
    const workflowSteps = this.toWorkflowSteps(template.workflowSteps);
    if (workflowSteps.length === 0) {
      issues.push('Template must define at least one workflow step.');
    }
    try {
      const graph = normalizeWorkflowGraph(template.workflowGraph, workflowSteps);
      issues.push(
        ...this.validateWorkflowGraphToolActions(graph, new Set(this.toStringArray(template.tools)))
      );
    } catch (error) {
      issues.push(error instanceof Error ? error.message : 'Template workflow graph is invalid.');
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
        return [
          'ENTERPRISE_BASIC_MONTHLY',
          'ENTERPRISE_BASIC_ANNUAL',
          'ENTERPRISE_STANDARD_MONTHLY',
          'ENTERPRISE_STANDARD_ANNUAL',
          'ENTERPRISE_PRO_MONTHLY',
          'ENTERPRISE_PRO_ANNUAL',
          'ENTERPRISE_CUSTOM'
        ];
      case 'ENTERPRISE_STANDARD_MONTHLY':
      case 'ENTERPRISE_STANDARD_ANNUAL':
        return [
          'ENTERPRISE_STANDARD_MONTHLY',
          'ENTERPRISE_STANDARD_ANNUAL',
          'ENTERPRISE_PRO_MONTHLY',
          'ENTERPRISE_PRO_ANNUAL',
          'ENTERPRISE_CUSTOM'
        ];
      case 'ENTERPRISE_PRO_MONTHLY':
      case 'ENTERPRISE_PRO_ANNUAL':
        return ['ENTERPRISE_PRO_MONTHLY', 'ENTERPRISE_PRO_ANNUAL', 'ENTERPRISE_CUSTOM'];
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

  private normalizeWorkflowSteps(
    values: Array<{
      id: string;
      order: number;
      type: string;
      name: string;
      instruction: string;
      toolIds?: string[];
      requiresApproval?: boolean;
    }>
  ): RoleTemplateWorkflowStep[] {
    const stepIds = new Set<string>();
    const normalized = values.map((step, index) => {
      const id = this.requireText(step.id, 'Workflow step id cannot be empty.');
      if (stepIds.has(id)) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Workflow step id must be unique.',
            details: {
              stepId: id
            }
          }
        });
      }
      stepIds.add(id);

      if (!workflowStepTypeSet.has(step.type)) {
        throw new BadRequestException({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Workflow step type is invalid.',
            details: {
              stepId: id,
              type: step.type
            }
          }
        });
      }

      const order = Number.isInteger(step.order) && step.order > 0 ? step.order : index + 1;
      return {
        id,
        order,
        type: step.type as RoleTemplateStepType,
        name: this.requireText(step.name, 'Workflow step name cannot be empty.'),
        instruction: this.requireText(step.instruction, 'Workflow step instruction cannot be empty.'),
        toolIds: this.normalizeStringArray(step.toolIds ?? []),
        requiresApproval: step.requiresApproval ?? step.type === 'approval'
      };
    });

    return normalized.sort((left, right) => left.order - right.order);
  }

  private normalizeWorkflowGraphInput(
    value: unknown,
    fallbackSteps: RoleTemplateWorkflowStep[]
  ): ServerRoleWorkflowGraph {
    try {
      return normalizeWorkflowGraph(value, fallbackSteps);
    } catch (error) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Workflow graph is invalid.'
        }
      });
    }
  }

  private normalizeOptionalText(value: string | undefined, fallback: string): string {
    const normalized = value?.trim();
    return normalized || fallback;
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

  private async buildDependencyManifestForRecord(template: RoleTemplateRecord) {
    const assets = await this.prismaService.assetDefinition.findMany();
    return this.buildDependencyManifestFromRecord(template, assets);
  }

  private buildDependencyManifestFromRecord(
    template: RoleTemplateRecord,
    assets: RoleTemplateDependencyAsset[]
  ) {
    const workflowSteps = this.toWorkflowSteps(template.workflowSteps);
    const workflowGraph = normalizeWorkflowGraphOrFallback(template.workflowGraph, workflowSteps);
    return buildRoleTemplateDependencyManifest({
      workflowGraph,
      assets
    });
  }

  private toDependencyManifest(value: unknown, workflowGraph: ServerRoleWorkflowGraph) {
    if (this.isDependencyManifest(value)) {
      return value;
    }

    return buildRoleTemplateDependencyManifest({
      workflowGraph,
      assets: getDefaultAssetDefinitions()
    });
  }

  private isDependencyManifest(value: unknown): value is ReturnType<typeof buildRoleTemplateDependencyManifest> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const record = value as Record<string, unknown>;
    return (
      record.version === '1.0.0' &&
      typeof record.generatedAt === 'string' &&
      Array.isArray(record.variables) &&
      Array.isArray(record.modelAssets) &&
      Array.isArray(record.toolActions) &&
      Array.isArray(record.artifactTemplates) &&
      Array.isArray(record.nodeTemplates) &&
      Array.isArray(record.warnings)
    );
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

  private toWorkflowSteps(value: unknown): RoleTemplateWorkflowStep[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .flatMap((item) => {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
          return [];
        }

        const record = item as Record<string, unknown>;
        const id = typeof record.id === 'string' ? record.id.trim() : '';
        const type = typeof record.type === 'string' ? record.type.trim() : '';
        const name = typeof record.name === 'string' ? record.name.trim() : '';
        const instruction =
          typeof record.instruction === 'string' ? record.instruction.trim() : '';
        const order = typeof record.order === 'number' && Number.isInteger(record.order) ? record.order : 0;

        if (!id || !workflowStepTypeSet.has(type) || !name || !instruction || order <= 0) {
          return [];
        }

        return [
          {
            id,
            order,
            type: type as RoleTemplateStepType,
            name,
            instruction,
            toolIds: this.toStringArray(record.toolIds),
            requiresApproval:
              typeof record.requiresApproval === 'boolean'
                ? record.requiresApproval
                : type === 'approval'
          }
        ];
      })
      .sort((left, right) => left.order - right.order);
  }

  private toRoleTemplateStatus(value: string): 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | 'DELETED' {
    if (value === 'DRAFT' || value === 'ARCHIVED' || value === 'DELETED') {
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
