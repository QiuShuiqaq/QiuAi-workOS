import assert from 'node:assert/strict';
import test from 'node:test';

import {
  retiredServerRoleTemplateIds,
  serverRoleTemplateCatalog
} from './role-template-catalog';

test('server role template catalog is focused and production-oriented', () => {
  const freeTemplateIds = [
    'basic_document_organizer_v1',
    'basic_spreadsheet_organizer_v1',
    'basic_meeting_minutes_v1',
    'basic_translation_polish_v1'
  ];

  assert.deepEqual(serverRoleTemplateCatalog.slice(0, 4).map((template) => template.templateId), freeTemplateIds);
  assert.ok(serverRoleTemplateCatalog.length >= 80);
  assert.ok(retiredServerRoleTemplateIds.length >= 1);
  assert.ok(retiredServerRoleTemplateIds.includes('template_case_ops'));
  assert.ok(retiredServerRoleTemplateIds.includes('template_video_quality_editor'));

  const ids = new Set(serverRoleTemplateCatalog.map((template) => template.templateId));
  assert.equal(ids.size, serverRoleTemplateCatalog.length);
  const templateById = new Map(serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const));

  const artifactExpectations = [
    ['basic_document_organizer_v1', 'docx'],
    ['basic_spreadsheet_organizer_v1', 'xlsx'],
    ['basic_meeting_minutes_v1', 'docx'],
    ['core_after_sales_ticket_v1', 'xlsx'],
    ['core_reimbursement_v1', 'xlsx'],
    ['sales_sales_quote_v1', 'xlsx'],
    ['sales_saas_sales_v1', 'docx'],
    ['sales_medical_device_sales_v1', 'docx'],
    ['sales_government_project_sales_v1', 'docx']
  ] as const;

  for (const [templateId, artifactType] of artifactExpectations) {
    const template = templateById.get(templateId);
    assert.ok(template, `${templateId} must exist`);
    assert.equal(
      template.workflowGraph.nodes.find((node) => node.type === 'artifact')?.artifactType,
      artifactType,
      `${templateId} must generate the intended artifact type`
    );
    assert.ok(
      template.workflowGraph.nodes.some((node) => node.type === 'llm') ||
        template.workflowGraph.nodes.some((node) => node.type === 'list'),
      `${templateId} must do structured input preparation before drafting`
    );
    assert.ok(
      template.workflowGraph.nodes.filter((node) => node.type === 'llm').length >= 1,
      `${templateId} must include at least one LLM work node`
    );
  }

  const salesTemplates = serverRoleTemplateCatalog.filter((template) => template.templateId.startsWith('sales_'));
  assert.ok(salesTemplates.length >= 70);
  assert.ok(salesTemplates.some((template) => template.industry.includes('软件与企业服务')));
  assert.ok(salesTemplates.some((template) => template.industry.includes('医疗健康')));
  assert.ok(salesTemplates.some((template) => template.industry.includes('制造工业')));
  assert.ok(salesTemplates.some((template) => template.industry.includes('政企项目')));

  for (const template of serverRoleTemplateCatalog) {
    assert.ok(template.name.trim(), `${template.templateId} must have a name`);
    assert.ok(template.industry.trim(), `${template.templateId} must have an industry`);
    assert.ok(template.scenario.trim(), `${template.templateId} must have a scenario`);
    assert.ok(template.businessGoal.trim(), `${template.templateId} must have a business goal`);
    assert.ok(template.skills.length >= 3, `${template.templateId} must define at least 3 skills`);
    assert.ok(template.workflowSteps.length >= 5, `${template.templateId} must define workflow steps`);
    assert.ok(template.workflowGraph.nodes.length >= 2, `${template.templateId} must define graph nodes`);
    assert.ok(template.workflowGraph.edges.length >= 1, `${template.templateId} must define graph edges`);
    assert.equal(template.workflowGraph.entryNodeId, 'start', `${template.templateId} must define graph entry`);
    assert.ok(
      template.workflowGraph.nodes.some((node) => node.type === 'llm'),
      `${template.templateId} must define an LLM workflow node`
    );
    const artifactNode = template.workflowGraph.nodes.find((node) => node.type === 'artifact');
    assert.ok(artifactNode, `${template.templateId} must define an artifact node`);
    assert.ok(artifactNode.artifactType, `${template.templateId} artifact node must define artifact type`);
    assert.equal(
      artifactNode.toolId,
      artifactNode.artifactType === 'mp4' ? 'video-processing' : 'office-document',
      `${template.templateId} artifact node must use the matching writer tool`
    );
    assert.ok(
      artifactNode.inputVariables?.length,
      `${template.templateId} artifact node must define input variables`
    );
    assert.ok(template.sampleInputs.length >= 1, `${template.templateId} must define sample inputs`);
    assert.ok(template.outputFormat.trim(), `${template.templateId} must define an output format`);
    assert.ok(template.allowedPlanCodes.length >= 1, `${template.templateId} must define plan visibility`);

    if (freeTemplateIds.includes(template.templateId)) {
      assert.equal(template.recommendedPlanCode, 'PERSONAL_FREE', `${template.templateId} must be free`);
      assert.ok(template.allowedPlanCodes.includes('PERSONAL_FREE'), `${template.templateId} must be installable for free`);
    } else {
      assert.ok(
        !template.allowedPlanCodes.includes('PERSONAL_FREE'),
        `${template.templateId} enterprise template must not be visible to free users`
      );
      assert.ok(
        template.knowledgeSources.some((source) => source.includes('企业知识库')),
        `${template.templateId} enterprise template must bind enterprise knowledge by default`
      );
      assert.ok(
        template.workflowGraph.nodes.some((node) => node.type === 'knowledge'),
        `${template.templateId} enterprise template must include a knowledge node`
      );
    }

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

    const artifactAction = artifactNode.config?.action;
    assert.equal(typeof artifactAction, 'string', `${template.templateId} artifact must define a concrete tool action`);
  }
});
