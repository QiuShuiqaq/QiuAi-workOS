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
  allDigitalEmployeePlanCodes,
  isDigitalEmployeeApplicationType
} from '../../shared/role-template-access-policy';
import {
  buildRoleTemplateDependencyManifest,
  type RoleTemplateDependencyAsset
} from '../../shared/role-template-dependencies';
import {
  buildRoleTemplateExecutionProfile,
  normalizeRoleTemplateExecutionProfile,
  readRoleTemplateExecutionProfile,
  type RoleTemplateExecutionProfileSource,
  type ServerRoleTemplateExecutionProfile
} from '../../shared/role-template-execution-profile';
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
const publicApplicationTypes = ['digital_employee', 'digital_factory'] as const;
const databaseApplicationTypeByPublic = {
  digital_employee: 'DIGITAL_EMPLOYEE',
  digital_factory: 'DIGITAL_FACTORY'
} as const;
const publicApplicationTypeByDatabase = {
  DIGITAL_EMPLOYEE: 'digital_employee',
  DIGITAL_FACTORY: 'digital_factory'
} as const;
const factoryPackageKeys = new Set([
  'white_background',
  'main_image',
  'scene_image',
  'background_replacement',
  'model_replacement',
  'dimension_image',
  'selling_point_image'
]);
const strictPackageFactoryKinds = new Set(['cross_border_product_image_factory']);

type RoleTemplateDate = Date | string;
type RoleTemplateStepType = (typeof workflowStepTypes)[number];
type PublicRoleTemplateApplicationType = (typeof publicApplicationTypes)[number];
type DatabaseRoleTemplateApplicationType = keyof typeof publicApplicationTypeByDatabase;

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
  applicationType?: string | null;
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
  executionProfile?: unknown;
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
  applicationType: DatabaseRoleTemplateApplicationType;
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
  executionProfile?: ServerRoleTemplateExecutionProfile;
  dependencyManifest: ReturnType<typeof buildRoleTemplateDependencyManifest> & {
    applicationType: PublicRoleTemplateApplicationType;
    executionProfile?: ServerRoleTemplateExecutionProfile;
    factory?: unknown;
  };
  sampleInputs: string[];
  outputFormat: string;
  approvalPolicy: string;
  status: RoleTemplateStatus;
  allowedPlanCodes: string[];
  visibleWorkspaceIds: string[];
}

type WorkflowTestCompatibilityStatus = 'passed' | 'warning' | 'failed';
type WorkflowTestRuntimeValue =
  | string
  | number
  | boolean
  | null
  | Record<string, unknown>
  | unknown[];
type WorkflowTestVariablePool = Map<string, WorkflowTestRuntimeValue>;
type WorkflowTestToolRequest = {
  toolId: string;
  action: string;
  input: Record<string, unknown>;
  unresolvedRefs: string[];
};
type WorkflowTestToolCompatibility = {
  status: WorkflowTestCompatibilityStatus;
  message: string;
  checks: string[];
};
type WorkflowTestNodeOutput = {
  text?: string;
  json?: unknown;
  result?: WorkflowTestRuntimeValue;
  file?: Record<string, unknown>;
  outputValue?: WorkflowTestRuntimeValue;
};

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

      if (
        normalizedUpdate.applicationType !== undefined ||
        input.dependencyManifest !== undefined ||
        input.executionProfile !== undefined
      ) {
        const nextApplicationType =
          normalizedUpdate.applicationType ?? this.toDatabaseApplicationTypeFromRecord(current.applicationType);
        const graph = normalizedUpdate.workflowGraph ??
          normalizeWorkflowGraphOrFallback(current.workflowGraph, this.toWorkflowSteps(current.workflowSteps));
        normalizedUpdate.workflowGraph = graph;
        const nextTemplate = {
          ...current,
          ...normalizedUpdate,
          applicationType: nextApplicationType
        };
        normalizedUpdate.dependencyManifest = this.buildDependencyManifest(
          graph,
          nextApplicationType,
          this.normalizeFactoryManifestInput(input.dependencyManifest ?? current.dependencyManifest, nextApplicationType),
          getDefaultAssetDefinitions(),
          normalizedUpdate.executionProfile ?? this.resolveTemplateExecutionProfile(nextTemplate)
        );
      }

      this.normalizeAllowedPlanCodesForApplicationType(
        normalizedUpdate,
        normalizedUpdate.applicationType ??
          this.toDatabaseApplicationTypeFromRecord(current.applicationType)
      );

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

    if (
      normalizedUpdate.applicationType !== undefined ||
      input.dependencyManifest !== undefined ||
      input.executionProfile !== undefined
    ) {
      const nextApplicationType =
        normalizedUpdate.applicationType ?? this.toDatabaseApplicationTypeFromRecord(existing.applicationType);
      const graph = normalizedUpdate.workflowGraph ??
        normalizeWorkflowGraphOrFallback(existing.workflowGraph, this.toWorkflowSteps(existing.workflowSteps));
      normalizedUpdate.workflowGraph = graph;
      const nextTemplate = {
        ...existing,
        ...normalizedUpdate,
        applicationType: nextApplicationType
      };
      normalizedUpdate.dependencyManifest = this.buildDependencyManifest(
        graph,
        nextApplicationType,
        this.normalizeFactoryManifestInput(input.dependencyManifest ?? existing.dependencyManifest, nextApplicationType),
        getDefaultAssetDefinitions(),
        normalizedUpdate.executionProfile ?? this.resolveTemplateExecutionProfile(nextTemplate)
      );
    }

    this.normalizeAllowedPlanCodesForApplicationType(
      normalizedUpdate,
      normalizedUpdate.applicationType ??
        this.toDatabaseApplicationTypeFromRecord(existing.applicationType)
    );

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
      if (!current || current.status === 'DELETED') {
        throw this.templateNotFound(id);
      }
      this.assertTemplatePublishable(current);
      const template = this.store.updateRoleTemplate(id, {
        status: 'PUBLISHED',
        publishedAt: new Date().toISOString(),
        dependencyManifest: this.buildDependencyManifestFromRecord(current, getDefaultAssetDefinitions())
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
    const normalizedWorkflowGraph = normalizeWorkflowGraph(existing.workflowGraph, this.toWorkflowSteps(existing.workflowSteps));
    const dependencyManifest = await this.buildDependencyManifestForRecord({
      ...existing,
      workflowGraph: normalizedWorkflowGraph
    });
    const published = await this.prismaService.$transaction(async (tx) => {
      const template = await tx.roleTemplate.update({
        where: {
          id
        },
        data: {
          status: 'PUBLISHED',
          publishedAt,
          workflowGraph: normalizedWorkflowGraph as unknown as Prisma.InputJsonValue,
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
    const applicationType = this.toDatabaseApplicationType(input.applicationType);
    const recommendedPlanCode = this.requirePlanCode(input.recommendedPlanCode);
    const status = (input.status ?? 'DRAFT') as RoleTemplateStatus;
    const allowedPlanCodes = isDigitalEmployeeApplicationType(applicationType)
      ? [...allDigitalEmployeePlanCodes]
      : input.allowedPlanCodes
        ? this.normalizePlanCodes(input.allowedPlanCodes)
        : this.expandDefaultAllowedPlanCodes(recommendedPlanCode);
    const workflowSteps = this.normalizeWorkflowSteps(input.workflowSteps ?? []);
    const workflowGraph = this.normalizeWorkflowGraphInput(input.workflowGraph, workflowSteps);
    const factoryManifest = this.normalizeFactoryManifestInput(input.dependencyManifest, applicationType);
    const knowledgeSources = this.normalizeStringArray(input.knowledgeSources);
    const tools = this.normalizeStringArray(input.tools);
    const skills = this.normalizeSkills(input.skills);
    const executionProfile = this.resolveExecutionProfileFromInput(input.executionProfile, {
      templateId: input.id,
      applicationType,
      name: input.name,
      industry: input.industry,
      scenario: input.scenario,
      description: input.description,
      businessGoal: input.businessGoal,
      knowledgeSources,
      tools,
      skills,
      outputFormat: input.outputFormat,
      approvalPolicy: input.approvalPolicy
    });

    return {
      applicationType,
      version: this.requireText(input.version, 'Version cannot be empty.'),
      name: this.requireText(input.name, 'Template name cannot be empty.'),
      industry: this.requireText(input.industry, 'Industry cannot be empty.'),
      scenario: this.requireText(input.scenario, 'Scenario cannot be empty.'),
      description: this.requireText(input.description, 'Description cannot be empty.'),
      recommendedPlanCode,
      businessGoal: this.requireText(input.businessGoal, 'Business goal cannot be empty.'),
      knowledgeSources,
      tools,
      skills,
      workflowSteps,
      workflowGraph,
      dependencyManifest: this.buildDependencyManifest(
        workflowGraph,
        applicationType,
        factoryManifest,
        getDefaultAssetDefinitions(),
        executionProfile
      ),
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

    if (input.applicationType !== undefined) {
      normalized.applicationType = this.toDatabaseApplicationType(input.applicationType);
    }
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
    } else if (normalized.workflowSteps !== undefined) {
      normalized.workflowGraph = buildWorkflowGraphFromSteps(normalized.workflowSteps);
    }
    if (input.executionProfile !== undefined) {
      normalized.executionProfile = this.resolveExecutionProfileFromInput(input.executionProfile);
    }
    if (
      normalized.workflowGraph !== undefined ||
      normalized.applicationType !== undefined ||
      input.dependencyManifest !== undefined ||
      input.executionProfile !== undefined
    ) {
      const graph = normalized.workflowGraph;
      if (graph !== undefined) {
        const applicationType = normalized.applicationType ?? this.readDependencyManifestApplicationType(input.dependencyManifest);
        normalized.dependencyManifest = this.buildDependencyManifest(
          graph,
          applicationType ?? 'DIGITAL_EMPLOYEE',
          this.normalizeFactoryManifestInput(input.dependencyManifest, applicationType ?? 'DIGITAL_EMPLOYEE'),
          getDefaultAssetDefinitions(),
          normalized.executionProfile ??
            readRoleTemplateExecutionProfile(this.toRecord(input.dependencyManifest)?.executionProfile)
        );
      }
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

  private normalizeAllowedPlanCodesForApplicationType(
    input: Partial<NormalizedRoleTemplateInput>,
    applicationType: DatabaseRoleTemplateApplicationType
  ): void {
    if (isDigitalEmployeeApplicationType(applicationType)) {
      input.allowedPlanCodes = [...allDigitalEmployeePlanCodes];
    }
  }

  private toCreateData(input: NormalizedRoleTemplateInput) {
    const now = new Date();
    return {
      applicationType: input.applicationType,
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
    if (input.applicationType !== undefined) data.applicationType = input.applicationType;
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
    const dependencyManifest = this.toDependencyManifest(
      template.dependencyManifest,
      workflowGraph,
      this.toDatabaseApplicationTypeFromRecord(template.applicationType),
      this.resolveTemplateExecutionProfile(template)
    );

    return {
      id: template.id,
      applicationType: this.toPublicApplicationType(template.applicationType),
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
      dependencyManifest,
      executionProfile: dependencyManifest.executionProfile,
      sampleInputs: this.toStringArray(template.sampleInputs),
      outputFormat: template.outputFormat?.trim() || '',
      approvalPolicy: template.approvalPolicy,
      status: this.toRoleTemplateStatus(template.status),
      allowedPlanCodes: isDigitalEmployeeApplicationType(template.applicationType)
        ? [...allDigitalEmployeePlanCodes]
        : this.toStringArray(template.allowedPlanCodes),
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
    const graphTrace = this.buildTemplateTestGraphTrace(template, input);
    if (graphTrace.pcCompatibility?.warningCount) {
      warnings.push(graphTrace.pcCompatibility.message);
    }
    if (graphTrace.pcCompatibility?.failedCount) {
      warnings.push(graphTrace.pcCompatibility.message);
    }
    const valid = issues.length === 0 && (graphTrace.pcCompatibility?.failedCount ?? 0) === 0;

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
        graphTrace,
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
    const variablePool = this.createWorkflowTestVariablePool(template, input);

    for (const edge of graph.edges) {
      const targets = outgoingEdgesByNodeId.get(edge.sourceNodeId) ?? [];
      const condition = edge.condition?.type && edge.condition.type !== 'always'
        ? ` when ${edge.condition.type}${edge.condition.variable ? `(${edge.condition.variable})` : ''}`
        : '';
      targets.push(`${edge.targetNodeId}${condition}`);
      outgoingEdgesByNodeId.set(edge.sourceNodeId, targets);
    }

    const nodes = graph.nodes.map((node) => {
      const runtimeInputVariables = this.getWorkflowTestInputVariables(node, variablePool);
      const toolRequest = this.buildWorkflowTestToolRequest(node, variablePool);
      const actionId = toolRequest?.action ?? this.getWorkflowNodeToolActionId(node);
      const actionDefinition = actionId ? getServerToolAction(actionId) : undefined;
      const warnings = this.getWorkflowNodeTraceWarnings(node, templateTools);
      const toolCompatibility = node.type === 'tool' || node.type === 'artifact'
        ? this.checkWorkflowTestToolCompatibility(node, templateTools, toolRequest)
        : undefined;
      const outputVariables = this.writeWorkflowTestNodeOutputs(
        variablePool,
        node,
        this.buildWorkflowTestNodeOutput(node, input, toolRequest)
      );
      const hasFailedCompatibility = toolCompatibility?.status === 'failed';
      const hasWarningCompatibility = toolCompatibility?.status === 'warning';
      const status: WorkflowTestCompatibilityStatus = hasFailedCompatibility
        ? 'failed'
        : warnings.length > 0 || hasWarningCompatibility
          ? 'warning'
          : 'passed';

      return {
        nodeId: node.id,
        nodeName: node.name,
        nodeType: node.type,
        status,
        inputPreview: this.describeWorkflowNodeInput(node, input, knowledgeSources),
        outputPreview: this.describeWorkflowNodeOutput(node, outgoingEdgesByNodeId.get(node.id) ?? []),
        warnings,
        toolActionId: actionId,
        requiredInputTypes: actionDefinition?.input.map((port) => port.type),
        producedOutputTypes: actionDefinition?.output.map((port) => port.type),
        runtimePreview: {
          inputVariables: runtimeInputVariables,
          outputVariables
        },
        resolvedToolInput: toolRequest
          ? {
              toolId: toolRequest.toolId,
              action: toolRequest.action,
              input: toolRequest.input
            }
          : undefined,
        toolCompatibility
      };
    });
    const toolCompatibilityItems = nodes
      .map((node) => node.toolCompatibility)
      .filter((item): item is WorkflowTestToolCompatibility => Boolean(item));
    const failedCount = toolCompatibilityItems.filter((item) => item.status === 'failed').length;
    const warningCount = toolCompatibilityItems.filter((item) => item.status === 'warning').length;
    const passedCount = toolCompatibilityItems.filter((item) => item.status === 'passed').length;
    const pcCompatibilityStatus: WorkflowTestCompatibilityStatus = failedCount > 0
      ? 'failed'
      : warningCount > 0
        ? 'warning'
        : 'passed';

    return {
      entryNodeId: graph.entryNodeId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodes,
      pcCompatibility: {
        status: pcCompatibilityStatus,
        message: failedCount > 0
          ? `PC compatibility check failed for ${failedCount} node(s).`
          : warningCount > 0
            ? `PC compatibility check has ${warningCount} warning node(s).`
            : 'PC compatibility check passed.',
        passedCount,
        warningCount,
        failedCount
      }
    };
  }

  private createWorkflowTestVariablePool(
    template: RoleTemplateRecord,
    input: TestAdminRoleTemplateRequestDto
  ): WorkflowTestVariablePool {
    const sampleInput = input.sampleInput?.trim()
      || this.toStringArray(template.sampleInputs)[0]
      || `测试任务：${template.name}`;
    const taskTitle = this.compactPreview(sampleInput).slice(0, 80) || template.name;
    const sampleDocument = {
      id: 'start-file-1',
      name: 'sample-document.txt',
      kind: 'text',
      uri: 'local://C:\\QiuAI\\test-input\\sample-document.txt',
      mimeType: 'text/plain',
      localPath: 'C:\\QiuAI\\test-input\\sample-document.txt',
      sizeBytes: 2048,
      extractedText: '这是 admin-console 测试用的模拟附件文本。'
    };
    const sampleVideo = {
      id: 'start-video-1',
      name: 'sample-video.mp4',
      kind: 'video',
      uri: 'local://C:\\QiuAI\\test-input\\sample-video.mp4',
      mimeType: 'video/mp4',
      localPath: 'C:\\QiuAI\\test-input\\sample-video.mp4',
      sizeBytes: 5_000_000
    };
    const sampleFiles = [sampleDocument, sampleVideo];

    return new Map<string, WorkflowTestRuntimeValue>([
      ['input', sampleInput],
      ['title', taskTitle],
      ['task.input', sampleInput],
      ['task.title', taskTitle],
      ['task.type', 'general_assist'],
      ['task.roleCode', template.id],
      ['task.roleName', template.name],
      ['start.text', sampleInput],
      ['start.title', taskTitle],
      ['start.files', sampleFiles],
      ['start.documents', [sampleDocument]],
      ['start.videos', [sampleVideo]],
      ['start.images', []],
      ['start.spreadsheets', []],
      ['runtime.current_item', sampleVideo],
      ['runtime.current_item.localPath', sampleVideo.localPath],
      ['runtime.previous_text', sampleInput]
    ]);
  }

  private getWorkflowTestInputVariables(
    node: ServerRoleWorkflowGraphNode,
    pool: WorkflowTestVariablePool
  ): string[] {
    if (node.inputVariables && node.inputVariables.length > 0) {
      return node.inputVariables;
    }
    if (node.type === 'start' || node.type === 'input') {
      return ['start.text', 'start.files'];
    }
    return pool.has('runtime.previous_text') ? ['runtime.previous_text', 'start.text'] : ['start.text'];
  }

  private buildWorkflowTestToolRequest(
    node: ServerRoleWorkflowGraphNode,
    pool: WorkflowTestVariablePool
  ): WorkflowTestToolRequest | undefined {
    const config = node.config ?? {};
    const toolId = this.readWorkflowTestToolId(node);
    if (!toolId) {
      return undefined;
    }

    const configuredAction = typeof config.action === 'string' && config.action.trim()
      ? config.action.trim()
      : undefined;
    if (configuredAction && this.isRecord(config.input)) {
      const resolved = this.resolveWorkflowTestConfigValue(config.input, pool);
      return {
        toolId,
        action: configuredAction,
        input: this.isRecord(resolved.value) ? resolved.value : {},
        unresolvedRefs: resolved.unresolvedRefs
      };
    }

    const variables = this.resolveWorkflowTestVariableRefs(pool, node.inputVariables);
    const query = variables
      .map((variable) => this.previewWorkflowTestValue(variable.value, 1000))
      .join('\n\n')
      .trim();

    if (toolId === 'web-search') {
      return {
        toolId,
        action: 'web.search',
        input: {
          query: query || String(this.getWorkflowTestVariable(pool, 'start.text') ?? ''),
          maxResults: this.readWorkflowTestNumber(config.maxResults, 5)
        },
        unresolvedRefs: []
      };
    }

    if (toolId === 'office-document') {
      const file = this.findFirstWorkflowTestFile(variables)
        ?? this.findFirstWorkflowTestFile([{ ref: 'start.files', value: this.getWorkflowTestVariable(pool, 'start.files') }]);
      if (file) {
        return {
          toolId,
          action: 'document.extract_text',
          input: {
            path: file.localPath,
            maxChars: this.readWorkflowTestNumber(config.maxChars, 30_000)
          },
          unresolvedRefs: []
        };
      }
    }

    if (toolId === 'local-filesystem' && typeof config.path === 'string') {
      const resolvedPath = this.resolveWorkflowTestConfigValue(config.path, pool);
      return {
        toolId,
        action: 'filesystem.read_text_file',
        input: {
          path: String(resolvedPath.value ?? ''),
          maxChars: this.readWorkflowTestNumber(config.maxChars, 30_000)
        },
        unresolvedRefs: resolvedPath.unresolvedRefs
      };
    }

    if (toolId === 'http-request' && typeof config.url === 'string') {
      const resolved = this.resolveWorkflowTestConfigValue(
        {
          method: config.method ?? 'GET',
          url: config.url,
          headers: config.headers ?? {},
          body: config.body,
          maxChars: config.maxChars ?? 24_000,
          timeoutMs: config.timeoutMs,
          allowPrivateNetwork: config.allowPrivateNetwork === true
        },
        pool
      );
      return {
        toolId,
        action: 'http.request',
        input: this.isRecord(resolved.value) ? resolved.value : {},
        unresolvedRefs: resolved.unresolvedRefs
      };
    }

    if (toolId === 'mcp' && typeof config.endpoint === 'string' && typeof config.toolName === 'string') {
      const resolved = this.resolveWorkflowTestConfigValue(
        {
          endpoint: config.endpoint,
          toolName: config.toolName,
          arguments: config.arguments ?? {},
          headers: config.headers ?? {},
          timeoutMs: config.timeoutMs,
          allowPrivateNetwork: config.allowPrivateNetwork === true
        },
        pool
      );
      return {
        toolId,
        action: 'mcp.call',
        input: this.isRecord(resolved.value) ? resolved.value : {},
        unresolvedRefs: resolved.unresolvedRefs
      };
    }

    if (toolId === 'video-processing') {
      const file = this.findFirstWorkflowTestFile(variables)
        ?? this.findFirstWorkflowTestFile([{ ref: 'start.videos', value: this.getWorkflowTestVariable(pool, 'start.videos') }]);
      const resolvedVideoPath = typeof config.videoPath === 'string'
        ? this.resolveWorkflowTestConfigValue(config.videoPath, pool)
        : undefined;
      const videoPath = resolvedVideoPath
        ? String(resolvedVideoPath.value ?? '')
        : file?.localPath;
      if (!videoPath) {
        return undefined;
      }
      return {
        toolId,
        action: 'video.probe',
        input: { videoPath },
        unresolvedRefs: resolvedVideoPath?.unresolvedRefs ?? []
      };
    }

    return undefined;
  }

  private buildWorkflowTestNodeOutput(
    node: ServerRoleWorkflowGraphNode,
    input: TestAdminRoleTemplateRequestDto,
    toolRequest?: WorkflowTestToolRequest
  ): WorkflowTestNodeOutput {
    const sampleInput = input.sampleInput?.trim() || String(this.getWorkflowTestNodeDefaultText(node));

    if (node.type === 'start' || node.type === 'input') {
      return {
        text: sampleInput,
        result: {
          title: this.compactPreview(sampleInput).slice(0, 80),
          input: sampleInput,
          files: []
        }
      };
    }

    if (node.type === 'knowledge') {
      return {
        text: `模拟知识库上下文：${sampleInput}`,
        result: {
          text: `模拟知识库上下文：${sampleInput}`,
          sources: ['admin-console dry-run']
        }
      };
    }

    if (node.type === 'llm') {
      const outputMode = node.config?.outputMode === 'json' || node.config?.responseFormat === 'json'
        || node.config?.llmTaskType === 'structured_extraction'
        ? 'json'
        : 'text';
      if (outputMode === 'json') {
        const json = this.buildWorkflowTestStructuredJson(sampleInput);
        return {
          text: JSON.stringify(json, null, 2),
          json,
          result: json,
          outputValue: json
        };
      }

      const text = `模拟模型输出：已根据任务整理正文。\n\n${sampleInput}`;
      return {
        text,
        result: text,
        outputValue: text
      };
    }

    if (node.type === 'data') {
      return this.buildWorkflowTestDataNodeOutput(node);
    }

    if (node.type === 'tool') {
      return this.buildWorkflowTestToolNodeOutput(node, toolRequest);
    }

    if (node.type === 'artifact') {
      const fileName = `${this.normalizeArtifactFileName(String(toolRequest?.input.fileName ?? node.name))}.${node.artifactType ?? 'artifact'}`;
      const localPath = `C:\\QiuAI\\test-output\\${fileName}`;
      return {
        text: `模拟生成产物：${localPath}`,
        result: {
          localPath,
          fileName,
          artifactType: node.artifactType
        },
        file: {
          id: `${node.id}-file`,
          name: fileName,
          kind: 'artifact',
          localPath
        }
      };
    }

    if (node.type === 'output') {
      return {
        text: '模拟返回：任务已完成，产物已生成。'
      };
    }

    return {
      text: this.getWorkflowTestNodeDefaultText(node)
    };
  }

  private buildWorkflowTestDataNodeOutput(node: ServerRoleWorkflowGraphNode): WorkflowTestNodeOutput {
    const firstOutputVariable = node.outputVariables?.[0]?.trim();
    const value = firstOutputVariable
      ? this.buildWorkflowTestValueForOutputVariable(firstOutputVariable)
      : this.getWorkflowTestNodeDefaultText(node);

    return {
      text: this.previewWorkflowTestValue(value, 2000),
      result: value as WorkflowTestRuntimeValue,
      outputValue: value as WorkflowTestRuntimeValue
    };
  }

  private buildWorkflowTestToolNodeOutput(
    node: ServerRoleWorkflowGraphNode,
    toolRequest?: WorkflowTestToolRequest
  ): WorkflowTestNodeOutput {
    if (!toolRequest) {
      return {
        text: `工具节点 ${node.name} 无法构造请求。`
      };
    }

    if (toolRequest.action === 'web.search') {
      const result = {
        results: [
          {
            title: '模拟搜索结果',
            url: 'https://example.com/qiuai-test',
            snippet: this.previewWorkflowTestValue(toolRequest.input.query ?? '', 160)
          }
        ],
        text: '模拟网页搜索摘要。'
      };
      return {
        text: result.text,
        result,
        outputValue: result
      };
    }

    if (toolRequest.action === 'document.extract_text' || toolRequest.action === 'filesystem.read_text_file') {
      return {
        text: '模拟读取到的文件正文。实际内容会由 PC 端工具读取本地路径。',
        result: {
          text: '模拟读取到的文件正文。',
          localPath: toolRequest.input.path
        }
      };
    }

    if (toolRequest.action.startsWith('video.')) {
      return {
        text: '模拟视频工具输出。实际执行需要 PC 端视频工具和 FFmpeg。',
        result: {
          metadata: {
            videoPath: toolRequest.input.videoPath,
            durationSeconds: 60
          },
          cutPlan: [{ start: 0, end: 15, reason: '保留高质量片段' }]
        }
      };
    }

    return {
      text: `模拟工具输出：${toolRequest.toolId}/${toolRequest.action}`,
      result: {
        ok: true,
        action: toolRequest.action
      }
    };
  }

  private writeWorkflowTestNodeOutputs(
    pool: WorkflowTestVariablePool,
    node: ServerRoleWorkflowGraphNode,
    output: WorkflowTestNodeOutput
  ): string[] {
    const outputRefs: string[] = [];

    if (output.text !== undefined) {
      pool.set(`${node.id}.text`, output.text);
      pool.set('runtime.previous_text', output.text);
      outputRefs.push(`${node.id}.text`);
    }

    if (output.json !== undefined) {
      pool.set(`${node.id}.json`, output.json as WorkflowTestRuntimeValue);
      outputRefs.push(`${node.id}.json`);
    }

    if (output.result !== undefined) {
      pool.set(`${node.id}.result`, output.result);
      outputRefs.push(`${node.id}.result`);
    }

    if (output.file !== undefined) {
      pool.set(`${node.id}.file`, output.file);
      outputRefs.push(`${node.id}.file`);
    }

    for (const outputVariable of node.outputVariables ?? []) {
      const normalizedOutputVariable = outputVariable.trim();
      if (!normalizedOutputVariable) {
        continue;
      }

      const value = Object.prototype.hasOwnProperty.call(output, 'outputValue')
        ? output.outputValue
        : output.text ?? output.result ?? output.file ?? output.json;
      if (value === undefined) {
        continue;
      }

      pool.set(normalizedOutputVariable, value as WorkflowTestRuntimeValue);
      outputRefs.push(normalizedOutputVariable);

      if (!normalizedOutputVariable.includes('.')) {
        pool.set(`${node.id}.${normalizedOutputVariable}`, value as WorkflowTestRuntimeValue);
        outputRefs.push(`${node.id}.${normalizedOutputVariable}`);
      }
    }

    return [...new Set(outputRefs)];
  }

  private checkWorkflowTestToolCompatibility(
    node: ServerRoleWorkflowGraphNode,
    templateTools: Set<string>,
    request?: WorkflowTestToolRequest
  ): WorkflowTestToolCompatibility {
    const checks: string[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];

    if (!request) {
      return {
        status: 'failed',
        message: 'PC 端无法构造这个工具节点的请求，请检查 toolId、action 和 input。',
        checks: ['未生成 toolId/action/input。']
      };
    }

    const actionDefinition = getServerToolAction(request.action);
    if (!actionDefinition) {
      failures.push(`工具动作未在服务端工具目录定义：${request.action}`);
    } else {
      checks.push(`工具动作已定义：${actionDefinition.packageId}/${actionDefinition.actionId}`);
      if (actionDefinition.packageId !== request.toolId) {
        failures.push(`工具动作属于 ${actionDefinition.packageId}，但节点 toolId 是 ${request.toolId}。`);
      }
      if (!templateTools.has(actionDefinition.packageId)) {
        failures.push(`数字员工工具清单未包含 ${actionDefinition.packageId}，PC 安装后可能不会启用该工具。`);
      }
      if (node.type === 'artifact' && node.artifactType && actionDefinition.artifactFormat) {
        const actionArtifactType = actionDefinition.artifactFormat === 'md'
          ? 'markdown'
          : actionDefinition.artifactFormat;
        if (actionArtifactType !== node.artifactType) {
          failures.push(`产物类型是 ${node.artifactType}，但工具动作输出 ${actionArtifactType}。`);
        }
      }

      for (const port of actionDefinition.input.filter((item) => item.required)) {
        if (!this.hasWorkflowTestUsableValue(request.input[port.key])) {
          failures.push(`缺少必填工具参数：${port.key}`);
        }
      }

      if (actionDefinition.requiredDependencies.length > 0) {
        warnings.push(`PC 端需要安装依赖：${actionDefinition.requiredDependencies.join(', ')}。`);
      }
    }

    if (request.unresolvedRefs.length > 0) {
      failures.push(`以下变量没有解析到值：${[...new Set(request.unresolvedRefs)].join(', ')}`);
    }

    this.checkWorkflowTestActionSpecificInput(request, failures, warnings, checks);

    const status: WorkflowTestCompatibilityStatus = failures.length > 0
      ? 'failed'
      : warnings.length > 0
        ? 'warning'
        : 'passed';
    const message = failures[0]
      ?? warnings[0]
      ?? 'PC 端工具请求可以直接执行。';

    return {
      status,
      message,
      checks: [...checks, ...warnings, ...failures]
    };
  }

  private checkWorkflowTestActionSpecificInput(
    request: WorkflowTestToolRequest,
    failures: string[],
    warnings: string[],
    checks: string[]
  ): void {
    if (request.action === 'spreadsheet.write_xlsx') {
      const hasRows = this.hasWorkflowTestUsableValue(request.input.rows);
      const hasSheets = this.hasWorkflowTestUsableValue(request.input.sheets);
      if (!hasRows && !hasSheets) {
        failures.push('Excel 产物缺少 rows/sheets，PC 端会按文本兜底生成内容摘要表，不适合表格交付。');
      } else {
        checks.push(hasSheets ? 'Excel 已绑定 sheets。' : 'Excel 已绑定 rows。');
      }
      return;
    }

    if (request.action === 'spreadsheet.write_csv') {
      if (!this.hasWorkflowTestUsableValue(request.input.rows)) {
        failures.push('CSV 产物必须绑定 rows，不能只传 content。');
      } else {
        checks.push('CSV 已绑定 rows。');
      }
      return;
    }

    if (request.action === 'office.write_docx_document' || request.action === 'office.write_markdown_document') {
      if (!this.hasWorkflowTestUsableValue(request.input.content)) {
        failures.push('文档产物缺少 content，PC 端无法写入正文。');
      } else {
        checks.push('文档产物已绑定 content。');
      }
      return;
    }

    if (request.action === 'presentation.write_pptx') {
      if (this.hasWorkflowTestUsableValue(request.input.slides)) {
        checks.push('PPT 已绑定 slides。');
      } else if (this.hasWorkflowTestUsableValue(request.input.content)) {
        warnings.push('PPT 只绑定 content，PC 端会生成基础演示稿，建议后续改为 slides JSON。');
      } else {
        failures.push('PPT 产物缺少 slides/content。');
      }
      return;
    }

    if (request.action === 'video.compose_clips' || request.action === 'video.export_mp4') {
      if (!this.hasWorkflowTestUsableValue(request.input.videoPath)) {
        failures.push('视频产物缺少 videoPath。');
      }
      if (!this.hasWorkflowTestUsableValue(request.input.cutPlan)) {
        failures.push('视频产物缺少 cutPlan。');
      }
      if (this.hasWorkflowTestUsableValue(request.input.videoPath) && this.hasWorkflowTestUsableValue(request.input.cutPlan)) {
        checks.push('视频产物已绑定 videoPath 和 cutPlan。');
      }
    }
  }

  private resolveWorkflowTestConfigValue(
    value: unknown,
    pool: WorkflowTestVariablePool
  ): { value: unknown; unresolvedRefs: string[] } {
    if (typeof value === 'string') {
      const variableOnly = value.match(/^\$([a-zA-Z0-9_.-]+)$/);
      if (variableOnly) {
        const ref = variableOnly[1] ?? '';
        const resolved = this.getWorkflowTestVariable(pool, ref);
        return resolved === undefined
          ? { value: '', unresolvedRefs: [ref] }
          : { value: resolved, unresolvedRefs: [] };
      }

      const unresolvedRefs: string[] = [];
      const resolvedText = value.replace(/\{\{#?([a-zA-Z0-9_.-]+)#?\}\}/g, (_match, ref: string) => {
        const resolved = this.getWorkflowTestVariable(pool, ref);
        if (resolved === undefined) {
          unresolvedRefs.push(ref);
          return '';
        }
        return this.previewWorkflowTestValue(resolved, 8_000);
      });
      return { value: resolvedText, unresolvedRefs };
    }

    if (Array.isArray(value)) {
      const resolvedItems = value.map((item) => this.resolveWorkflowTestConfigValue(item, pool));
      return {
        value: resolvedItems.map((item) => item.value),
        unresolvedRefs: resolvedItems.flatMap((item) => item.unresolvedRefs)
      };
    }

    if (this.isRecord(value)) {
      const entries = Object.entries(value).map(([key, item]) => {
        const resolved = this.resolveWorkflowTestConfigValue(item, pool);
        return [key, resolved] as const;
      });
      return {
        value: Object.fromEntries(entries.map(([key, resolved]) => [key, resolved.value])),
        unresolvedRefs: entries.flatMap(([, resolved]) => resolved.unresolvedRefs)
      };
    }

    return { value, unresolvedRefs: [] };
  }

  private resolveWorkflowTestVariableRefs(
    pool: WorkflowTestVariablePool,
    refs: string[] | undefined,
    fallbackRefs: string[] = ['start.text']
  ): Array<{ ref: string; value: WorkflowTestRuntimeValue | undefined }> {
    const normalizedRefs = (refs && refs.length > 0 ? refs : fallbackRefs)
      .map((ref) => ref.trim())
      .filter(Boolean);
    return normalizedRefs.map((ref) => ({
      ref,
      value: this.getWorkflowTestVariable(pool, ref)
    }));
  }

  private getWorkflowTestVariable(
    pool: WorkflowTestVariablePool,
    ref: string | undefined
  ): WorkflowTestRuntimeValue | undefined {
    const normalizedRef = ref?.trim();
    if (!normalizedRef) {
      return undefined;
    }

    const exactValue = pool.get(normalizedRef);
    if (exactValue !== undefined) {
      return exactValue;
    }

    const parts = normalizedRef.split('.');
    for (let prefixLength = parts.length - 1; prefixLength > 0; prefixLength -= 1) {
      const prefix = parts.slice(0, prefixLength).join('.');
      const source = pool.get(prefix);
      const nestedValue = this.readNestedWorkflowTestValue(source, parts.slice(prefixLength));
      if (nestedValue !== undefined) {
        return nestedValue as WorkflowTestRuntimeValue;
      }
    }

    return undefined;
  }

  private readNestedWorkflowTestValue(value: unknown, segments: string[]): unknown {
    let current = value;

    for (const segment of segments) {
      if (current === undefined || current === null) {
        return undefined;
      }

      if (Array.isArray(current)) {
        const index = Number(segment);
        if (!Number.isInteger(index) || index < 0 || index >= current.length) {
          return undefined;
        }
        current = current[index];
        continue;
      }

      if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[segment];
        continue;
      }

      return undefined;
    }

    return current;
  }

  private readWorkflowTestToolId(node: ServerRoleWorkflowGraphNode): string | undefined {
    if (node.toolId?.trim()) {
      return node.toolId.trim();
    }

    const toolIds = Array.isArray(node.config?.toolIds)
      ? node.config.toolIds.filter((toolId): toolId is string => typeof toolId === 'string' && toolId.trim().length > 0)
      : [];
    return toolIds[0]?.trim();
  }

  private readWorkflowTestNumber(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }

  private findFirstWorkflowTestFile(
    variables: Array<{ ref: string; value: WorkflowTestRuntimeValue | undefined }>
  ): (Record<string, unknown> & { localPath: string }) | undefined {
    for (const variable of variables) {
      if (this.isWorkflowTestFileValue(variable.value)) {
        return variable.value;
      }

      if (Array.isArray(variable.value)) {
        const file = variable.value.find((item) => this.isWorkflowTestFileValue(item));
        if (file) {
          return file;
        }
      }
    }

    return undefined;
  }

  private isWorkflowTestFileValue(value: unknown): value is Record<string, unknown> & { localPath: string } {
    return this.isRecord(value) && typeof value.localPath === 'string' && value.localPath.trim().length > 0;
  }

  private hasWorkflowTestUsableValue(value: unknown): boolean {
    if (value === undefined || value === null) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value).length > 0;
    }
    return true;
  }

  private buildWorkflowTestStructuredJson(sampleInput: string): Record<string, unknown> {
    return {
      content: `模拟结构化正文：${sampleInput}`,
      rows: [
        ['字段', '内容'],
        ['任务', sampleInput]
      ],
      sheets: [
        {
          name: '整理结果',
          rows: [
            ['字段', '内容'],
            ['任务', sampleInput]
          ]
        }
      ],
      cutPlan: [
        {
          start: 0,
          end: 15,
          reason: '保留最有价值片段'
        }
      ]
    };
  }

  private buildWorkflowTestValueForOutputVariable(variable: string): WorkflowTestRuntimeValue {
    const normalized = variable.toLowerCase();
    if (normalized.includes('sheets')) {
      return [
        {
          name: '整理结果',
          rows: [
            ['字段', '内容'],
            ['示例', '测试值']
          ]
        }
      ];
    }
    if (normalized.includes('rows') || normalized.includes('table')) {
      return [
        ['字段', '内容'],
        ['示例', '测试值']
      ];
    }
    if (normalized.includes('cutplan') || normalized.includes('cut_plan')) {
      return [{ start: 0, end: 15, reason: '保留最有价值片段' }];
    }
    if (normalized.includes('json') || normalized.includes('content')) {
      return this.buildWorkflowTestStructuredJson('测试任务');
    }
    return `模拟变量 ${variable} 的输出。`;
  }

  private getWorkflowTestNodeDefaultText(node: ServerRoleWorkflowGraphNode): string {
    return node.instruction?.trim() || `模拟节点输出：${node.name}`;
  }

  private previewWorkflowTestValue(value: unknown, maxChars = 240): string {
    const text = typeof value === 'string'
      ? value
      : JSON.stringify(value ?? '', null, 2);
    return this.compactPreview(text.length > maxChars ? `${text.slice(0, maxChars - 3)}...` : text);
  }

  private normalizeArtifactFileName(value: string): string {
    const normalized = value
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
      .replace(/\s+/g, '-')
      .replace(/_+/g, '_')
      .replace(/-+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '')
      .trim();
    return normalized.slice(0, 80) || 'qiuai-artifact';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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
    this.validateFactoryManifest(template, issues);

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
          'ENTERPRISE_PRO_ANNUAL'
        ];
      case 'ENTERPRISE_STANDARD_MONTHLY':
      case 'ENTERPRISE_STANDARD_ANNUAL':
        return [
          'ENTERPRISE_STANDARD_MONTHLY',
          'ENTERPRISE_STANDARD_ANNUAL',
          'ENTERPRISE_PRO_MONTHLY',
          'ENTERPRISE_PRO_ANNUAL'
        ];
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

  private toDatabaseApplicationType(
    value: PublicRoleTemplateApplicationType | undefined
  ): DatabaseRoleTemplateApplicationType {
    return value ? databaseApplicationTypeByPublic[value] : 'DIGITAL_EMPLOYEE';
  }

  private toDatabaseApplicationTypeFromRecord(value: unknown): DatabaseRoleTemplateApplicationType {
    return value === 'DIGITAL_FACTORY' ? 'DIGITAL_FACTORY' : 'DIGITAL_EMPLOYEE';
  }

  private toPublicApplicationType(value: unknown): PublicRoleTemplateApplicationType {
    return publicApplicationTypeByDatabase[this.toDatabaseApplicationTypeFromRecord(value)];
  }

  private readDependencyManifestApplicationType(
    value: unknown
  ): DatabaseRoleTemplateApplicationType | undefined {
    const record = this.toRecord(value);
    const applicationType = record?.applicationType;
    if (applicationType === 'digital_factory') return 'DIGITAL_FACTORY';
    if (applicationType === 'digital_employee') return 'DIGITAL_EMPLOYEE';
    return undefined;
  }

  private resolveExecutionProfileFromInput(
    value: unknown,
    fallbackSource?: RoleTemplateExecutionProfileSource
  ): ServerRoleTemplateExecutionProfile | undefined {
    return normalizeRoleTemplateExecutionProfile(value, fallbackSource);
  }

  private resolveTemplateExecutionProfile(
    template: Partial<RoleTemplateRecord> & { templateId?: string }
  ): ServerRoleTemplateExecutionProfile {
    const manifestProfile = readRoleTemplateExecutionProfile(
      this.toRecord(template.dependencyManifest)?.executionProfile
    );
    if (manifestProfile) {
      return manifestProfile;
    }

    const explicitProfile = readRoleTemplateExecutionProfile(template.executionProfile);
    if (explicitProfile) {
      return explicitProfile;
    }

    return buildRoleTemplateExecutionProfile({
      templateId: template.id ?? template.templateId,
      applicationType: template.applicationType,
      name: template.name,
      industry: template.industry,
      scenario: template.scenario,
      description: template.description,
      businessGoal: template.businessGoal,
      knowledgeSources: this.toStringArray(template.knowledgeSources),
      tools: this.toStringArray(template.tools),
      skills: this.toSkillSummaries(template.skills),
      outputFormat: template.outputFormat,
      approvalPolicy: template.approvalPolicy
    });
  }

  private buildDependencyManifest(
    workflowGraph: ServerRoleWorkflowGraph,
    applicationType: DatabaseRoleTemplateApplicationType,
    factoryManifest?: unknown,
    assets: RoleTemplateDependencyAsset[] = getDefaultAssetDefinitions(),
    executionProfile?: ServerRoleTemplateExecutionProfile
  ): ReturnType<typeof buildRoleTemplateDependencyManifest> & {
    applicationType: PublicRoleTemplateApplicationType;
    executionProfile?: ServerRoleTemplateExecutionProfile;
    factory?: unknown;
  } {
    return {
      ...buildRoleTemplateDependencyManifest({
        workflowGraph,
        assets,
        executionProfile
      }),
      applicationType: this.toPublicApplicationType(applicationType),
      ...(factoryManifest === undefined ? {} : { factory: factoryManifest })
    };
  }

  private normalizeFactoryManifestInput(
    value: unknown,
    applicationType: DatabaseRoleTemplateApplicationType
  ): unknown {
    const record = this.toRecord(value);
    const factory = record?.factory;
    if (applicationType !== 'DIGITAL_FACTORY') {
      return undefined;
    }

    if (!factory || typeof factory !== 'object' || Array.isArray(factory)) {
      return {
        kind: 'custom_factory',
        batch: {
          maxItems: 50
        },
        platforms: [],
        packages: [],
        qualityCheck: {
          defaultMode: 'basic',
          modes: ['none', 'basic', 'smart']
        },
        output: {
          cacheDays: 30
        },
        requiredCapabilities: []
      };
    }

    return factory;
  }

  private validateFactoryManifest(template: RoleTemplateRecord, issues: string[]): void {
    if (this.toDatabaseApplicationTypeFromRecord(template.applicationType) !== 'DIGITAL_FACTORY') {
      return;
    }

    const manifest = this.toDependencyManifest(
      template.dependencyManifest,
      normalizeWorkflowGraphOrFallback(template.workflowGraph, this.toWorkflowSteps(template.workflowSteps)),
      'DIGITAL_FACTORY'
    );
    const factory = this.toRecord(manifest.factory);
    if (!factory) {
      issues.push('Digital factory must define dependencyManifest.factory.');
      return;
    }

    const batch = this.toRecord(factory.batch);
    const maxItems = typeof batch?.maxItems === 'number' ? batch.maxItems : undefined;
    if (!Number.isInteger(maxItems) || !maxItems || maxItems <= 0 || maxItems > 50) {
      issues.push('Digital factory batch.maxItems must be an integer from 1 to 50.');
    }

    const packages = Array.isArray(factory.packages) ? factory.packages : [];
    if (packages.length === 0) {
      issues.push('Digital factory must define at least one selectable package.');
    }
    const factoryKind = typeof factory.kind === 'string' ? factory.kind.trim() : '';
    const requiresStrictPackageKeys = strictPackageFactoryKinds.has(factoryKind);
    for (const item of packages) {
      const packageRecord = this.toRecord(item);
      const key = typeof packageRecord?.key === 'string' ? packageRecord.key.trim() : '';
      if (!key) {
        issues.push('Digital factory package key is required.');
      }
      if (requiresStrictPackageKeys && !factoryPackageKeys.has(key)) {
        issues.push(`Digital factory package key is invalid: ${key || '(empty)'}.`);
      }
    }
  }

  private toRecord(value: unknown): Record<string, unknown> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
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
    return this.buildDependencyManifest(
      workflowGraph,
      this.toDatabaseApplicationTypeFromRecord(template.applicationType),
      this.normalizeFactoryManifestInput(template.dependencyManifest, this.toDatabaseApplicationTypeFromRecord(template.applicationType)),
      assets,
      this.resolveTemplateExecutionProfile(template)
    );
  }

  private toDependencyManifest(
    value: unknown,
    workflowGraph: ServerRoleWorkflowGraph,
    applicationType: DatabaseRoleTemplateApplicationType = 'DIGITAL_EMPLOYEE',
    executionProfile?: ServerRoleTemplateExecutionProfile
  ) {
    if (this.isDependencyManifest(value)) {
      const record = value as ReturnType<typeof buildRoleTemplateDependencyManifest> & {
        applicationType?: PublicRoleTemplateApplicationType;
        executionProfile?: ServerRoleTemplateExecutionProfile;
        factory?: unknown;
      };
      return {
        ...record,
        applicationType: this.toPublicApplicationType(applicationType),
        executionProfile:
          readRoleTemplateExecutionProfile(record.executionProfile) ??
          executionProfile ??
          buildRoleTemplateExecutionProfile({
            applicationType
          }),
        ...(applicationType === 'DIGITAL_FACTORY'
          ? { factory: this.normalizeFactoryManifestInput(record, applicationType) }
          : {})
      };
    }

    return this.buildDependencyManifest(
      workflowGraph,
      applicationType,
      this.normalizeFactoryManifestInput(value, applicationType),
      getDefaultAssetDefinitions(),
      executionProfile
    );
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
