import assert from 'node:assert/strict';
import test from 'node:test';

import {
  productionRoleTemplateIds,
  retiredServerRoleTemplateIds,
  serverRoleTemplateCatalog
} from './role-template-catalog';
import {
  allDigitalEmployeePlanCodes,
  isDigitalEmployeeApplicationType
} from './role-template-access-policy';
import {
  buildRoleTemplateDependencyManifest,
  validateRoleTemplateModelContracts
} from './role-template-dependencies';
import { resolveRoleTemplateOutputCategory } from './role-template-output-category';
import { normalizeWorkflowGraph } from './workflow-graph';

test('digital factory market categories follow final output type', () => {
  assert.equal(
    resolveRoleTemplateOutputCategory({
      applicationType: 'DIGITAL_FACTORY',
      templateId: 'factory_cross_border_product_images_v1',
      dependencyManifestFactory: {
        kind: 'cross_border_product_image_factory'
      }
    }),
    '图片生成'
  );
  assert.equal(
    resolveRoleTemplateOutputCategory({
      applicationType: 'DIGITAL_FACTORY',
      templateId: 'factory_operation_video_v1',
      dependencyManifestFactory: {
        kind: 'operation_video_factory'
      }
    }),
    '视频生成'
  );
  assert.equal(
    resolveRoleTemplateOutputCategory({
      applicationType: 'DIGITAL_FACTORY',
      templateId: 'factory_medical_case_video_screening_v1',
      dependencyManifestFactory: {
        kind: 'medical_case_video_screening_factory'
      }
    }),
    '视频质检'
  );
  assert.equal(
    resolveRoleTemplateOutputCategory({
      applicationType: 'DIGITAL_FACTORY',
      templateId: 'factory_academic_project_demo_v1',
      dependencyManifestFactory: {
        kind: 'academic_project_demo_factory'
      }
    }),
    '演示 Demo'
  );
  assert.equal(
    resolveRoleTemplateOutputCategory({
      applicationType: 'DIGITAL_EMPLOYEE',
      templateId: 'template_document_assistant',
      outputFormat: 'Word 文档'
    }),
    undefined
  );
});

test('workflow graph llm task type controls semantic model slots', () => {
  const graph = normalizeWorkflowGraph({
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'generate_videos',
        type: 'llm',
        name: 'Generate videos',
        modelProfileId: 'qiu-vision-default',
        config: {
          llmTaskType: 'video_generation',
          outputMode: 'json'
        }
      }
    ],
    edges: []
  });

  assert.equal(
    graph.nodes.find((node) => node.id === 'generate_videos')?.modelProfileId,
    'qiu-video-generation-default'
  );
  assert.throws(
    () =>
      normalizeWorkflowGraph({
        version: '1.0.0',
        entryNodeId: 'start',
        nodes: [
          { id: 'start', type: 'start', name: 'Start' },
          {
            id: 'bad_model_node',
            type: 'llm',
            name: 'Bad model node',
            config: {
              llmTaskType: 'unknown_media_task'
            }
          }
        ],
        edges: []
      }),
    /llmTaskType is invalid/
  );
});

test('workflow model contracts ignore stale node model ids and preserve explicit auxiliary models', () => {
  const textGraph = normalizeWorkflowGraph({
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'draft',
        type: 'llm',
        name: 'Draft',
        modelProfileId: 'qiu-video-generation-default',
        config: {
          llmTaskType: 'text'
        }
      }
    ],
    edges: []
  });
  const textManifest = buildRoleTemplateDependencyManifest({ workflowGraph: textGraph });
  assert.deepEqual(
    textManifest.modelAssets.map((asset) => asset.modelProfileId),
    ['qiu-general-default']
  );

  const screeningGraph = normalizeWorkflowGraph({
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'screen',
        type: 'llm',
        name: 'Screen videos',
        modelProfileId: 'qiu-general-default',
        config: {
          llmTaskType: 'video_screening_batch',
          requiredModelProfileIds: ['qiu-asr-default']
        }
      }
    ],
    edges: []
  });
  const screeningManifest = buildRoleTemplateDependencyManifest({ workflowGraph: screeningGraph });
  assert.deepEqual(
    screeningManifest.modelAssets.map((asset) => asset.modelProfileId),
    ['qiu-asr-default', 'qiu-general-default']
  );

  const videoGraph = normalizeWorkflowGraph({
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'generate',
        type: 'llm',
        name: 'Generate video',
        modelProfileId: 'qiu-general-default',
        config: {
          llmTaskType: 'video_generation'
        }
      }
    ],
    edges: []
  });
  const videoManifest = buildRoleTemplateDependencyManifest({ workflowGraph: videoGraph });
  assert.deepEqual(
    videoManifest.modelAssets.map((asset) => asset.modelProfileId),
    ['qiu-video-generation-default']
  );

  assert.deepEqual(
    validateRoleTemplateModelContracts({
      workflowGraph: textGraph,
      dependencyManifest: {
        ...textManifest,
        modelAssets: [
          ...textManifest.modelAssets,
          {
            ...textManifest.modelAssets[0],
            key: 'qiu-video-generation-default',
            modelId: 'qiu-video-generation-default',
            modelProfileId: 'qiu-video-generation-default'
          }
        ]
      }
    }),
    ['Dependency manifest contains stale model contract qiu-video-generation-default.']
  );
});

test('server role template catalog only exposes the approved production set', () => {
  const expectedTemplateIds = [...productionRoleTemplateIds];
  const expectedFactoryTemplateIds = expectedTemplateIds.filter((templateId) => templateId.startsWith('factory_'));
  const expectedEmployeeTemplateIds = expectedTemplateIds.filter((templateId) => !templateId.startsWith('factory_'));

  assert.deepEqual(expectedEmployeeTemplateIds, [
    'template_document_assistant',
    'core_enterprise_researcher_v1',
    'core_customer_support_agent_v1',
    'core_after_sales_ticket_v1',
    'core_contract_review_v1',
    'core_recruiting_v1',
    'core_employee_policy_v1',
    'core_reimbursement_v1',
    'core_ecommerce_copywriter_v1',
    'core_requirement_analyst_v1'
  ]);
  assert.equal(expectedFactoryTemplateIds.length, 15);
  assert.equal(serverRoleTemplateCatalog.length, expectedTemplateIds.length);
  assert.deepEqual(serverRoleTemplateCatalog.map((template) => template.templateId), expectedTemplateIds);

  const ids = new Set(serverRoleTemplateCatalog.map((template) => template.templateId));
  assert.equal(ids.size, serverRoleTemplateCatalog.length);
  assert.ok(serverRoleTemplateCatalog.every((template) => !template.templateId.startsWith('sales_')));

  for (const templateId of [
    'basic_document_organizer_v1',
    'basic_spreadsheet_organizer_v1',
    'basic_meeting_minutes_v1',
    'basic_translation_polish_v1',
    'core_receivables_followup_v1',
    'core_project_proposal_v1',
    'core_procurement_assistant_v1',
    'template_quality_inspector',
    'template_video_quality_editor'
  ]) {
    assert.ok(retiredServerRoleTemplateIds.includes(templateId), `${templateId} must be retired`);
  }

  const templateById = new Map(serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const));
  assert.ok(templateById.get('template_document_assistant'), 'template_document_assistant must exist');
  assert.equal(templateById.get('template_document_assistant')?.recommendedPlanCode, 'PERSONAL_FREE');
  assert.equal(templateById.get('template_document_assistant')?.executionProfile?.mode, 'conversation');
  for (const templateId of expectedEmployeeTemplateIds) {
    const template = templateById.get(templateId);
    assert.ok(template, `${templateId} must exist`);
    assert.equal(template.executionProfile?.mode, 'conversation', `${templateId} must be a conversation employee`);
    assert.equal(
      template.tools.includes('browser-automation'),
      false,
      `${templateId} conversation employee must not expose RPA browser automation`
    );
  }
  assert.deepEqual(
    templateById.get('template_document_assistant')?.workflowGraph.nodes
      .filter((node) => node.type === 'llm')
      .map((node) => node.config?.llmTaskType),
    ['structured_extraction', 'reasoning', 'text', 'text']
  );

  const factoryManifestKinds = new Set([
    'cross_border_product_image_factory',
    'anime_image_factory',
    'game_image_factory',
    'poster_image_factory',
    'portrait_image_factory',
    'ui_icon_image_factory',
    'industrial_product_image_factory',
    'graphic_content_image_factory',
    'artistic_creation_image_factory',
    'ecommerce_product_video_factory',
    'digital_spokesperson_video_factory',
    'ad_social_media_video_factory',
    'medical_case_video_screening_factory',
    'operation_video_factory',
    'academic_project_demo_factory'
  ]);
  const enterpriseFactoryAllowedPlanCodes = [
    'ENTERPRISE_BASIC_MONTHLY',
    'ENTERPRISE_BASIC_ANNUAL',
    'ENTERPRISE_STANDARD_MONTHLY',
    'ENTERPRISE_STANDARD_ANNUAL',
    'ENTERPRISE_PRO_MONTHLY',
    'ENTERPRISE_PRO_ANNUAL'
  ];

  for (const template of serverRoleTemplateCatalog) {
    const isDigitalFactory = template.applicationType === 'DIGITAL_FACTORY';

    assert.ok(template.name.trim(), `${template.templateId} must have a name`);
    assert.ok(template.industry.trim(), `${template.templateId} must have an industry`);
    assert.ok(template.scenario.trim(), `${template.templateId} must have a scenario`);
    assert.ok(template.businessGoal.trim(), `${template.templateId} must have a business goal`);
    assert.ok(template.skills.length >= 3, `${template.templateId} must define at least 3 skills`);
    assert.ok(template.workflowGraph.nodes.length >= 2, `${template.templateId} must define graph nodes`);
    assert.ok(template.workflowGraph.edges.length >= 1, `${template.templateId} must define graph edges`);
    assert.equal(template.workflowGraph.entryNodeId, 'start', `${template.templateId} must define graph entry`);
    assert.ok(
      template.workflowGraph.nodes.some((node) => node.type === 'llm'),
      `${template.templateId} must define an LLM workflow node`
    );
    for (const node of template.workflowGraph.nodes) {
      if (node.type !== 'llm') {
        continue;
      }
      assert.ok(
        node.modelProfileId && isSemanticModelProfileId(node.modelProfileId),
        `${template.templateId}/${node.id} must use a qiu semantic model slot`
      );
      assert.equal(
        typeof node.config?.llmTaskType,
        'string',
        `${template.templateId}/${node.id} must explicitly define llmTaskType`
      );
      const requiredModelProfileIds = Array.isArray(node.config?.requiredModelProfileIds)
        ? node.config.requiredModelProfileIds
        : [];
      for (const profileId of requiredModelProfileIds) {
        assert.equal(
          typeof profileId === 'string' && isSemanticModelProfileId(profileId),
          true,
          `${template.templateId}/${node.id} required model profile must use a qiu semantic model slot`
        );
      }
    }

    const dependencyManifest = buildRoleTemplateDependencyManifest({
      workflowGraph: template.workflowGraph,
      generatedAt: '2026-07-30T00:00:00.000Z'
    });
    for (const modelAsset of dependencyManifest.modelAssets) {
      assert.ok(
        isSemanticModelProfileId(modelAsset.modelProfileId),
        `${template.templateId}/${modelAsset.key} dependency model asset must use a qiu semantic model slot`
      );
    }

    const artifactNode = template.workflowGraph.nodes.find((node) => node.type === 'artifact');
    const requiredDependencyModelProfileIds = dependencyManifest.modelAssets
      .filter((modelAsset) => modelAsset.required !== false)
      .map((modelAsset) => modelAsset.modelProfileId);
    if (isDigitalFactory) {
      const factoryManifest = readRecord(template.dependencyManifestFactory);
      assert.ok(factoryManifest, `${template.templateId} must define a factory dependency manifest`);
      assert.ok(
        factoryManifestKinds.has(String(factoryManifest.kind)),
        `${template.templateId} must define a known factory manifest kind`
      );
      const batch = readRecord(factoryManifest.batch);
      const expectedMaxItems = template.templateId === 'factory_academic_project_demo_v1' ? 5 : 50;
      assert.equal(
        batch?.maxItems,
        expectedMaxItems,
        `${template.templateId} factory batch maxItems must be ${expectedMaxItems}`
      );
      if (
        factoryManifest.kind === 'cross_border_product_image_factory' ||
        String(factoryManifest.kind).endsWith('_image_factory')
      ) {
        assert.equal(factoryManifest.promptControls, undefined, `${template.templateId} should not expose prompt controls`);
        const workflowSource = JSON.stringify(template.workflowGraph);
        assert.match(workflowSource, /imageTextLanguage/, `${template.templateId} must expose image text language in request`);
        assert.doesNotMatch(workflowSource, /Negative prompt:/, `${template.templateId} should not append a separate negative prompt block`);
        assert.doesNotMatch(workflowSource, /Package template:/, `${template.templateId} should not mix prompt metadata labels into prompts`);
        assert.doesNotMatch(workflowSource, /Required image ratio:/, `${template.templateId} should pass ratio as a clean prompt requirement`);
        assert.equal(
          template.workflowGraph.nodes.some((node) => node.id === 'generate_package_prompts'),
          false,
          `${template.templateId} should not require an image understanding prompt node`
        );
        assert.deepEqual(
          requiredDependencyModelProfileIds,
          ['qiu-image-editing-default'],
          `${template.templateId} should only require the image generation model`
        );
        const platforms = Array.isArray(factoryManifest.platforms) ? factoryManifest.platforms : [];
        assert.ok(
          platforms.length >= 5 && platforms.every((item) => readRecord(item)?.imageRatio),
          `${template.templateId} must expose image ratio options`
        );
        if (factoryManifest.kind !== 'cross_border_product_image_factory') {
          assert.equal(
            platforms.some((item) => /amazon|tiktok|temu|shopee|lazada|ebay|walmart|shein/i.test(String(readRecord(item)?.label ?? ''))),
            false,
            `${template.templateId} generic image factory must not expose ecommerce platform labels`
          );
        }
      }
      if (
        factoryManifest.kind === 'ecommerce_product_video_factory' ||
        factoryManifest.kind === 'digital_spokesperson_video_factory' ||
        factoryManifest.kind === 'ad_social_media_video_factory'
      ) {
        assert.equal(factoryManifest.promptControls, undefined, `${template.templateId} video factory should not expose prompt controls`);
        const batch = readRecord(factoryManifest.batch);
        assert.deepEqual(
          batch?.inputFileKinds,
          ['image'],
          `${template.templateId} reference video factory should only accept image inputs`
        );
        const platforms = Array.isArray(factoryManifest.platforms) ? factoryManifest.platforms.map(readRecord) : [];
        assert.deepEqual(
          platforms.map((item) => item?.key),
          ['default_video_ratio'],
          `${template.templateId} reference video factory should use the internal video ratio platform`
        );
        assert.deepEqual(
          requiredDependencyModelProfileIds,
          ['qiu-video-generation-default'],
          `${template.templateId} should only require the video generation model`
        );
        const workflowSource = JSON.stringify(template.workflowGraph);
        assert.doesNotMatch(workflowSource, /factory_request\.promptControls/, `${template.templateId} should not depend on prompt controls`);
      }
      assert.ok(
        template.workflowGraph.nodes.some((node) => node.type === 'input'),
        `${template.templateId} digital factory must define an input node`
      );
      assert.ok(
        template.workflowGraph.nodes.some((node) => node.type === 'output'),
        `${template.templateId} digital factory must define an output node`
      );
      assert.deepEqual(
        template.allowedPlanCodes,
        enterpriseFactoryAllowedPlanCodes,
        `${template.templateId} must default to the three enterprise plan tiers`
      );
      assert.deepEqual(findUnreachableNodeIds(template.workflowGraph), [], `${template.templateId} must not define detached nodes`);
    } else {
      assert.ok(artifactNode, `${template.templateId} must define an artifact node`);
      assert.ok(artifactNode.artifactType, `${template.templateId} artifact node must define artifact type`);
      if (artifactNode.artifactType !== 'mp4') {
        assert.equal(
          requiredDependencyModelProfileIds.includes('qiu-video-generation-default'),
          false,
          `${template.templateId} non-video digital employee must not require a video generation model`
        );
      }
      assert.equal(
        artifactNode.toolId,
        artifactNode.artifactType === 'mp4' ? 'video-processing' : 'office-document',
        `${template.templateId} artifact node must use the matching writer tool`
      );
      assert.ok(
        artifactNode.inputVariables?.length,
        `${template.templateId} artifact node must define input variables`
      );
      assert.deepEqual(
        template.allowedPlanCodes,
        [...allDigitalEmployeePlanCodes],
        `${template.templateId} digital employee must be installable on every plan`
      );
    }

    assert.ok(template.sampleInputs.length >= 1, `${template.templateId} must define sample inputs`);
    assert.ok(template.outputFormat.trim(), `${template.templateId} must define an output format`);
    assert.ok(template.allowedPlanCodes.length >= 1, `${template.templateId} must define plan visibility`);

    const orderedSteps = [...template.workflowSteps].sort((left, right) => left.order - right.order);
    assert.deepEqual(
      orderedSteps.map((step) => step.order),
      template.workflowSteps.map((step) => step.order),
      `${template.templateId} workflow steps must stay ordered`
    );

    const graphNodeIds = new Set(template.workflowGraph.nodes.map((node) => node.id));
    assert.ok(graphNodeIds.has(template.workflowGraph.entryNodeId), `${template.templateId} graph entry must exist`);
    for (const edge of template.workflowGraph.edges) {
      assert.ok(graphNodeIds.has(edge.sourceNodeId), `${template.templateId} graph edge source must exist`);
      assert.ok(graphNodeIds.has(edge.targetNodeId), `${template.templateId} graph edge target must exist`);
    }

    const attachmentNode = template.workflowGraph.nodes.find((node) => node.id === 'read_attachments');
    if (attachmentNode) {
      assert.ok(
        template.workflowGraph.edges.some(
          (edge) =>
            edge.sourceNodeId === 'gather_context' &&
            edge.targetNodeId === 'read_attachments' &&
            edge.condition?.type === 'exists' &&
            edge.condition.variable === 'start.files'
        ),
        `${template.templateId} must read attachments only when start.files exists`
      );
      assert.ok(
        template.workflowGraph.edges.some(
          (edge) =>
            edge.sourceNodeId === 'gather_context' &&
            edge.targetNodeId !== 'read_attachments' &&
            edge.condition?.type === 'always'
        ),
        `${template.templateId} must bypass attachment reading when no file is uploaded`
      );
    }

    if (!isDigitalFactory) {
      assert.equal(
        template.workflowGraph.nodes.some((node) => node.type === 'artifact'),
        true,
        `${template.templateId} must define an artifact node`
      );
      const artifactAction = artifactNode?.config?.action;
      assert.equal(typeof artifactAction, 'string', `${template.templateId} artifact must define a concrete tool action`);
      assert.equal(
        artifactAction,
        expectedArtifactAction(artifactNode?.artifactType),
        `${template.templateId} artifact action must match artifact type`
      );
      const artifactInput = readRecord(artifactNode?.config?.input);
      assert.ok(artifactInput, `${template.templateId} artifact must define writer input`);
      assert.equal(typeof artifactInput.folder, 'string', `${template.templateId} artifact must define output folder`);
      assert.equal(typeof artifactInput.fileName, 'string', `${template.templateId} artifact must define file name`);
      if (artifactNode?.artifactType === 'docx' || artifactNode?.artifactType === 'markdown') {
        assert.equal(typeof artifactInput.title, 'string', `${template.templateId} document artifact must define title`);
        assert.equal(typeof artifactInput.content, 'string', `${template.templateId} document artifact must define content`);
      }
      if (typeof artifactInput.content === 'string') {
        assert.notEqual(
          artifactInput.content,
          '{{runtime.previous_text}}',
          `${template.templateId} artifact must bind content to a stable upstream output`
        );
      }
    }
  }
});

function expectedArtifactAction(artifactType: string | undefined): string | undefined {
  switch (artifactType) {
    case 'docx':
      return 'office.write_docx_document';
    case 'markdown':
      return 'office.write_markdown_document';
    case 'xlsx':
      return 'spreadsheet.write_xlsx';
    case 'csv':
      return 'spreadsheet.write_csv';
    case 'pptx':
      return 'presentation.write_pptx';
    case 'mp4':
      return 'video.compose_clips';
    default:
      return undefined;
  }
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function isSemanticModelProfileId(profileId: string): boolean {
  return profileId.trim().startsWith('qiu-');
}

function findUnreachableNodeIds(graph: {
  entryNodeId: string;
  nodes: Array<{ id: string }>;
  edges: Array<{ sourceNodeId: string; targetNodeId: string }>;
}) {
  const reachable = new Set<string>([graph.entryNodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of graph.edges) {
      if (!reachable.has(edge.sourceNodeId) || reachable.has(edge.targetNodeId)) {
        continue;
      }
      reachable.add(edge.targetNodeId);
      changed = true;
    }
  }

  return graph.nodes
    .map((node) => node.id)
    .filter((nodeId) => !reachable.has(nodeId));
}
