import assert from 'node:assert/strict';
import test from 'node:test';

import {
  retiredServerRoleTemplateIds,
  serverRoleTemplateCatalog
} from './role-template-catalog';

test('server role template catalog is focused and production-oriented', () => {
  const productionTemplateExpectations = [
    ['template_enterprise_researcher', 'docx'],
    ['template_document_organizer', 'xlsx'],
    ['template_spreadsheet_analyst', 'xlsx'],
    ['template_customer_support_agent', 'docx'],
    ['template_video_quality_editor', 'mp4']
  ] as const;

  assert.deepEqual(
    serverRoleTemplateCatalog.map((template) => template.templateId),
    productionTemplateExpectations.map(([templateId]) => templateId)
  );
  assert.ok(retiredServerRoleTemplateIds.length >= 1);
  assert.ok(retiredServerRoleTemplateIds.includes('template_case_ops'));

  const ids = new Set(serverRoleTemplateCatalog.map((template) => template.templateId));
  assert.equal(ids.size, serverRoleTemplateCatalog.length);
  const templateById = new Map(serverRoleTemplateCatalog.map((template) => [template.templateId, template] as const));

  for (const [templateId, artifactType] of productionTemplateExpectations) {
    const template = templateById.get(templateId);
    assert.ok(template, `${templateId} must exist`);
    assert.equal(
      template.workflowGraph.nodes.find((node) => node.type === 'artifact')?.artifactType,
      artifactType,
      `${templateId} must generate the intended artifact type`
    );
    assert.ok(
      template.workflowGraph.nodes.some((node) => node.type === 'parameter_extractor') ||
        template.workflowGraph.nodes.some((node) => node.type === 'list'),
      `${templateId} must do structured input preparation before drafting`
    );
    assert.ok(
      template.workflowGraph.nodes.filter((node) => node.type === 'llm').length >= 1,
      `${templateId} must include at least one LLM work node`
    );
  }

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
  }
});
