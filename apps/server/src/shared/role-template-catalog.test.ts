import assert from 'node:assert/strict';
import test from 'node:test';

import { serverRoleTemplateCatalog } from './role-template-catalog';

test('server role template catalog is rich and publishable', () => {
  assert.ok(serverRoleTemplateCatalog.length >= 30);

  const ids = new Set(serverRoleTemplateCatalog.map((template) => template.templateId));
  assert.equal(ids.size, serverRoleTemplateCatalog.length);

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
    assert.ok(
      template.workflowGraph.nodes.some(
        (node) =>
          node.type === 'artifact' &&
          Boolean(node.artifactType) &&
          node.toolId === 'office-document' &&
          node.inputVariables?.includes('draft_result.text')
      ),
      `${template.templateId} must define an artifact node wired to draft_result.text`
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
