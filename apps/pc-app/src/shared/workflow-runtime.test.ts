import assert from 'node:assert/strict';

import {
  createWorkflowNodeTrace,
  createWorkflowVariablePoolFromTask,
  formatWorkflowTraceForReport,
  normalizeWorkflowAttachmentPaths,
  resolveWorkflowVariableRefs,
  writeWorkflowNodeOutputs
} from './workflow-runtime.js';
import { createMockTaskDetail } from './workbench-data.js';

const attachments = normalizeWorkflowAttachmentPaths([
  'C:\\QiuAI\\input\\brief.docx',
  'C:\\QiuAI\\input\\chart.png',
  'C:\\QiuAI\\input\\finance.xlsx'
]);

assert.equal(attachments[0]?.kind, 'document');
assert.equal(attachments[1]?.kind, 'image');
assert.equal(attachments[2]?.kind, 'spreadsheet');

const task = createMockTaskDetail({
  taskId: 'workflow-runtime-001',
  roleCode: 'ai-ops',
  roleName: 'AI Ops',
  title: 'Create proposal',
  input: '{"customer":"Acme","goal":"renewal"}',
  executionContext: {
    modelProfileIds: ['qiu-general-default'],
    toolIds: ['office-document'],
    knowledgeBindingIds: [],
    attachmentPaths: attachments.map((attachment) => attachment.localPath)
  }
});

const pool = createWorkflowVariablePoolFromTask(task);
assert.equal(pool.get('task.title'), 'Create proposal');
assert.equal(pool.get('start.customer'), 'Acme');
assert.equal(resolveWorkflowVariableRefs(pool, ['start.text', 'start.images']).length, 2);

const outputRefs = writeWorkflowNodeOutputs({
  pool,
  node: {
    id: 'llm_1',
    type: 'llm',
    name: 'Draft proposal',
    outputVariables: ['proposal']
  },
  text: 'Proposal draft'
});

assert.deepEqual(outputRefs, ['llm_1.text', 'proposal', 'llm_1.proposal']);
assert.equal(pool.get('proposal'), 'Proposal draft');
assert.equal(pool.get('llm_1.proposal'), 'Proposal draft');

writeWorkflowNodeOutputs({
  pool,
  node: {
    id: 'classify_1',
    type: 'llm',
    name: 'Classify request'
  },
  json: {
    intent: 'ppt',
    route: {
      target: 'presentation'
    },
    items: [{ name: 'first' }]
  }
});

assert.equal(pool.get('classify_1.json.intent'), 'ppt');
assert.equal(pool.get('classify_1.json.route.target'), 'presentation');
assert.equal(pool.get('classify_1.json.items.0.name'), 'first');

const report = formatWorkflowTraceForReport([
  createWorkflowNodeTrace({
    node: {
      id: 'llm_1',
      type: 'llm',
      name: 'Draft proposal',
      modelProfileId: 'qiu-general-default'
    },
    status: 'completed',
    startedAt: '2026-07-20T10:00:00.000Z',
    finishedAt: '2026-07-20T10:00:01.000Z',
    inputVariables: ['start.text'],
    outputVariables: outputRefs
  })
]);

assert.match(report, /Draft proposal \(llm\) - completed/);
assert.match(report, /outputs=llm_1.text,proposal,llm_1.proposal/);

console.log('Workflow runtime helpers passed.');
