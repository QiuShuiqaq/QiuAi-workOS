import assert from 'node:assert/strict';

import type { ModelProfile, RoleModelCredentialBinding, RolePackageManifest, ToolManifest } from './desktop-contract.js';
import { runDesktopTask } from './desktop-task-runner.js';
import { createMockTaskDetail } from './workbench-data.js';

const modelProfiles: ModelProfile[] = [
  {
    id: 'qiu-general-default',
    providerId: 'provider-local',
    providerName: 'Local Provider',
    modelName: 'general-chat',
    purpose: 'general',
    apiBaseUrl: 'https://model.example/v1',
    apiKey: 'test-api-key'
  }
];

const tools: ToolManifest[] = [
  {
    id: 'web-search',
    name: 'Web Search',
    version: '1.0.0',
    scope: 'hybrid',
    entryPoint: 'api',
    capabilities: ['web_search'],
    requiresApproval: false,
    actions: [
      {
        action: 'web.search',
        name: 'Web search',
        inputTypes: ['text'],
        outputTypes: ['json', 'text']
      },
      {
        action: 'web.fetch_url',
        name: 'Fetch URL',
        inputTypes: ['text'],
        outputTypes: ['text']
      }
    ]
  },
  {
    id: 'office-document',
    name: 'Office Document',
    version: '1.0.0',
    scope: 'desktop',
    entryPoint: 'bridge',
    capabilities: ['document_edit'],
    requiresApproval: true,
    actions: [
      {
        action: 'document.extract_text',
        name: 'Extract document text',
        inputTypes: ['file'],
        outputTypes: ['text']
      },
      {
        action: 'office.write_markdown_document',
        name: 'Write Markdown',
        inputTypes: ['text'],
        outputTypes: ['artifact']
      },
      {
        action: 'office.write_docx_document',
        name: 'Write Word',
        inputTypes: ['text'],
        outputTypes: ['artifact']
      },
      {
        action: 'spreadsheet.write_csv',
        name: 'Write CSV',
        inputTypes: ['table', 'json'],
        outputTypes: ['artifact']
      },
      {
        action: 'spreadsheet.write_xlsx',
        name: 'Write Excel',
        inputTypes: ['table', 'json'],
        outputTypes: ['artifact']
      },
      {
        action: 'presentation.write_pptx',
        name: 'Write PPT',
        inputTypes: ['json'],
        outputTypes: ['artifact']
      },
      {
        action: 'presentation.write_outline_markdown',
        name: 'Write PPT outline',
        inputTypes: ['json'],
        outputTypes: ['artifact']
      }
    ]
  },
  {
    id: 'local-filesystem',
    name: 'Local Filesystem',
    version: '1.0.0',
    scope: 'desktop',
    entryPoint: 'native',
    capabilities: ['filesystem'],
    requiresApproval: true,
    actions: [
      {
        action: 'filesystem.read_text_file',
        name: 'Read text file',
        inputTypes: ['file'],
        outputTypes: ['text']
      },
      {
        action: 'filesystem.write_text_file',
        name: 'Write text file',
        inputTypes: ['text'],
        outputTypes: ['artifact']
      },
      {
        action: 'filesystem.list_directory',
        name: 'List directory',
        inputTypes: ['file'],
        outputTypes: ['json']
      },
      {
        action: 'filesystem.download_remote_file',
        name: 'Download remote file',
        inputTypes: ['text'],
        outputTypes: ['artifact']
      },
      {
        action: 'filesystem.package_zip',
        name: 'Package ZIP',
        inputTypes: ['file', 'json'],
        outputTypes: ['artifact']
      }
    ]
  },
  {
    id: 'http-request',
    name: 'HTTP Request',
    version: '1.0.0',
    scope: 'desktop',
    entryPoint: 'api',
    capabilities: ['custom_api'],
    requiresApproval: true,
    actions: [
      {
        action: 'http.request',
        name: 'HTTP request',
        inputTypes: ['json'],
        outputTypes: ['json', 'text']
      }
    ]
  },
  {
    id: 'mcp',
    name: 'MCP Gateway',
    version: '1.0.0',
    scope: 'desktop',
    entryPoint: 'mcp',
    capabilities: ['mcp'],
    requiresApproval: true,
    actions: [
      {
        action: 'mcp.call',
        name: 'MCP call',
        inputTypes: ['json'],
        outputTypes: ['json', 'text']
      }
    ]
  },
  {
    id: 'video-processing',
    name: 'Video Processing',
    version: '1.0.0',
    scope: 'desktop',
    entryPoint: 'native',
    capabilities: ['video_processing'],
    requiresApproval: true,
    actions: [
      {
        action: 'video.probe',
        name: 'Probe video',
        inputTypes: ['video'],
        outputTypes: ['json']
      },
      {
        action: 'video.extract_audio',
        name: 'Extract audio',
        inputTypes: ['video'],
        outputTypes: ['artifact']
      },
      {
        action: 'video.extract_frames',
        name: 'Extract frames',
        inputTypes: ['video'],
        outputTypes: ['images']
      },
      {
        action: 'video.compose_clips',
        name: 'Compose clips',
        inputTypes: ['video', 'json'],
        outputTypes: ['artifact']
      },
      {
        action: 'video.export_mp4',
        name: 'Export MP4',
        inputTypes: ['video', 'json'],
        outputTypes: ['artifact']
      }
    ]
  }
];

const task = createMockTaskDetail({
  taskId: 'task-runner-001',
  roleCode: 'ai-ops',
  roleName: 'AI Ops',
  title: 'Prepare weekly customer follow-up summary',
  input: 'Summarize the customer notes and create next actions.',
  state: 'queued',
  artifactCount: 0,
  costCents: 0,
  executionContext: {
    modelProfileIds: ['qiu-general-default'],
    toolIds: ['web-search', 'office-document'],
    knowledgeBindingIds: ['kb-local-folder']
  }
});

const completed = await runDesktopTask({
  task,
  modelProfiles,
  tools,
  knowledgeSources: [
    {
      id: 'kb-local-folder',
      source: 'local_folder',
      label: 'Customer Docs',
      enabled: true,
      createdAt: '2026-07-20T09:55:00.000Z',
      localPath: 'C:\\QiuAI\\CustomerDocs',
      lastIndexedAt: '2026-07-20T09:56:00.000Z',
      summary: 'Customer renewal notes and follow-up SOP.'
    }
  ],
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: ['kb-local-folder'],
  modelInvoker: async (request) => {
    assert.equal(request.profile.id, 'qiu-general-default');
    assert.equal(request.messages.length, 2);
    assert.match(request.messages[1]?.content ?? '', /Customer Docs/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Customer follow-up summary generated by model.',
      inputTokens: 300,
      outputTokens: 180
    };
  },
  completedAt: '2026-07-20T10:00:00.000Z'
});

assert.equal(completed.task.state, 'completed');
assert.equal(completed.task.artifacts.filter((artifact) => artifact.type !== 'report').length, 1);
assert.equal(completed.task.artifacts.filter((artifact) => artifact.type === 'report').length, 1);
assert.equal(completed.task.artifactCount, 1);
assert.match(
  completed.task.artifacts.find((artifact) => artifact.type !== 'report')?.content ?? '',
  /Customer follow-up summary/
);
assert.equal(completed.task.costRecords.length, 1);
assert.equal(completed.task.costRecords[0]?.inputTokens, 300);
assert.deepEqual(completed.usedToolIds, []);
assert.ok(
  completed.task.executionLogs.some((log) => log.eventType === 'TOOL_BINDING_SKIPPED')
);
assert.ok(
  completed.task.executionLogs.some((log) => log.eventType === 'MODEL_RESPONSE_RECEIVED')
);

const workflowRolePackage: RolePackageManifest = {
  roleCode: 'ai-ops',
  name: 'AI Ops',
  version: '1.0.0',
  workflowGraph: {
    version: '1.0.0',
    entryNodeId: 'start',
    runtimePolicy: {
      maxNodeExecutions: 16,
      maxLoopIterations: 4,
      requireApprovalBeforeTools: false
    },
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'research',
        type: 'tool',
        name: 'Research current market signal',
        instruction: 'Search for fresh market context before writing.',
        toolId: 'web-search'
      },
      {
        id: 'write',
        type: 'artifact',
        name: 'Write customer follow-up document',
        instruction: 'Produce an operator-ready follow-up document.',
        artifactType: 'docx'
      }
    ],
    edges: [
      {
        id: 'start-research',
        sourceNodeId: 'start',
        targetNodeId: 'research',
        condition: { type: 'always' }
      },
      {
        id: 'research-write',
        sourceNodeId: 'research',
        targetNodeId: 'write',
        condition: { type: 'always' }
      }
    ]
  },
  modelProfileIds: ['qiu-general-default'],
  toolIds: ['web-search'],
  requiredKnowledgeSources: [],
  defaultTaskTypes: ['customer_follow_up'],
  syncPolicy: 'summary_only'
};

const workflowPromptTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-prompt-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Prepare workflow-backed follow-up',
    input: 'Create a follow-up plan with recent context.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: workflowRolePackage,
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /workflow node executor/);
    assert.match(prompt, /Write customer follow-up document/);
    assert.match(prompt, /Produce an operator-ready follow-up document/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Workflow-backed result generated.'
    };
  },
  completedAt: '2026-07-20T10:00:05.000Z'
});

assert.equal(workflowPromptTask.task.state, 'completed');
assert.ok(
  workflowPromptTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_GRAPH_LOADED')
);

let legacyConcreteModelFallbackUsed = false;
const legacyConcreteWorkflowModelTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-model-missing-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Run workflow with a specific model',
    input: 'Classify this customer request.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'classify',
          type: 'llm',
          name: 'Classify request',
          modelProfileId: 'deepseek-v4-flash'
        }
      ],
      edges: [
        {
          id: 'start-classify',
          sourceNodeId: 'start',
          targetNodeId: 'classify',
          condition: { type: 'always' }
        }
      ]
    },
    modelProfileIds: ['qiu-general-default', 'deepseek-v4-flash']
  },
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    legacyConcreteModelFallbackUsed = true;
    assert.equal(request.profile.id, 'qiu-general-default');
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Classified with the configured text model slot.',
      inputTokens: 120,
      outputTokens: 40
    };
  },
  completedAt: '2026-07-20T10:00:06.000Z'
});

assert.equal(legacyConcreteWorkflowModelTask.task.state, 'completed');
assert.equal(legacyConcreteModelFallbackUsed, true);
assert.ok(
  legacyConcreteWorkflowModelTask.task.executionLogs.every(
    (log) => log.eventType !== 'MODEL_PROFILE_BINDING_MISSING'
  )
);

let runtimeOverrideModelUsed = false;
const runtimeOverrideModelTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-runtime-model-override-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Run workflow with selected runtime model',
    input: 'Classify this customer request.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'classify',
          type: 'llm',
          name: 'Classify request',
          modelProfileId: 'qiu-general-default',
          config: {
            llmTaskType: 'text'
          }
        }
      ],
      edges: [
        {
          id: 'start-classify',
          sourceNodeId: 'start',
          targetNodeId: 'classify',
          condition: { type: 'always' }
        }
      ]
    }
  },
  modelProfiles: modelProfiles.concat([
    {
      id: 'deepseek-v4-flash',
      providerId: 'deepseek',
      providerName: 'DeepSeek',
      modelName: 'deepseek-v4-flash',
      purpose: 'general',
      capabilities: ['text'],
      apiBaseUrl: 'https://api.deepseek.com',
      apiKey: 'deepseek-key'
    }
  ]),
  tools,
  enabledModelProfileIds: ['qiu-general-default', 'deepseek-v4-flash'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  roleModelCredentialBindings: [
    {
      roleCode: 'ai-ops',
      modelProfileId: 'qiu-general-default',
      runtimeModelProfileId: 'deepseek-v4-flash',
      mode: 'provider_default'
    }
  ],
  modelInvoker: async (request) => {
    runtimeOverrideModelUsed = true;
    assert.equal(request.profile.id, 'deepseek-v4-flash');
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Classified with runtime-selected DeepSeek.',
      inputTokens: 120,
      outputTokens: 40
    };
  },
  completedAt: '2026-07-20T10:00:06.500Z'
});
assert.equal(runtimeOverrideModelTask.task.state, 'completed');
assert.equal(runtimeOverrideModelUsed, true);
assert.ok(
  workflowPromptTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_GRAPH_NODE_PLANNED')
);
assert.ok(
  workflowPromptTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_STARTED')
);
assert.ok(
  workflowPromptTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED')
);
const workflowPromptNodeLog = workflowPromptTask.task.executionLogs.find(
  (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Write customer follow-up document/.test(log.message)
);
assert.ok(workflowPromptNodeLog?.details);
const workflowPromptNodeDetail = workflowPromptNodeLog.details.workflowNode as {
  name?: string;
  status?: string;
  outputs?: unknown[];
};
assert.equal(workflowPromptNodeDetail.name, 'Write customer follow-up document');
assert.equal(workflowPromptNodeDetail.status, 'completed');
assert.ok(Array.isArray(workflowPromptNodeDetail.outputs));
assert.match(
  workflowPromptTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /Workflow graph: enabled/
);
assert.match(
  workflowPromptTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /Workflow runtime trace:/
);
assert.match(
  workflowPromptTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /Write customer follow-up document \(artifact\) - completed/
);

let workflowToolModelInvocationCount = 0;
const workflowToolTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-tool-call-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Research competitor updates',
    input: 'Search competitor updates and summarize the key signal.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: workflowRolePackage,
  workspaceId: 'workspace-workflow-tool-call',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowToolModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Write customer follow-up document/);
    assert.match(prompt, /Competitor launch note/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Final research summary after web search.'
    };
  },
  desktopToolInvoker: async (request) => {
    assert.equal(request.workspaceId, 'workspace-workflow-tool-call');
    assert.equal(request.toolId, 'web-search');
    assert.equal(request.action, 'web.search');
    assert.match(String(request.input.query), /Search competitor updates/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        results: [
          {
            title: 'Competitor launch note',
            url: 'https://example.com/competitor',
            snippet: 'Competitor released a new workflow feature.'
          }
        ]
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.500Z'
});

assert.equal(workflowToolModelInvocationCount, 1);
assert.deepEqual(workflowToolTask.usedToolIds, ['web-search']);
assert.doesNotMatch(
  workflowToolTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /Research current market signal \(tool\) - completed \[tools=web-search; tools_not_used=web-search\]/
);
assert.match(
  workflowToolTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /Research current market signal \(tool\) - completed \[tool=web-search/
);

const integrationToolCalls: Array<{ toolId: string; action: string; input: Record<string, unknown> }> = [];
const workflowIntegrationToolTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-integration-tool-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Call integration tools',
    input: 'Fetch lead status and enrich it through MCP.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['http-request', 'mcp'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'http_lead_status',
          type: 'tool',
          name: 'Fetch lead status',
          toolId: 'http-request',
          inputVariables: ['start.text'],
          outputVariables: ['lead_status'],
          config: {
            url: 'https://api.example.com/leads',
            method: 'POST',
            body: {
              query: '{{start.text}}'
            }
          }
        },
        {
          id: 'mcp_enrich',
          type: 'tool',
          name: 'Enrich lead with MCP',
          toolId: 'mcp',
          inputVariables: ['http_lead_status.text'],
          outputVariables: ['enriched_lead'],
          config: {
            endpoint: 'http://127.0.0.1:3001/mcp',
            toolName: 'enrich_lead',
            arguments: {
              lead: '{{http_lead_status.text}}'
            },
            allowPrivateNetwork: true
          }
        },
        {
          id: 'summarize',
          type: 'llm',
          name: 'Summarize integration result',
          instruction: 'Summarize the enriched lead result.',
          inputVariables: ['lead_status', 'enriched_lead']
        }
      ],
      edges: [
        { id: 'start-http', sourceNodeId: 'start', targetNodeId: 'http_lead_status' },
        { id: 'http-mcp', sourceNodeId: 'http_lead_status', targetNodeId: 'mcp_enrich' },
        { id: 'mcp-summarize', sourceNodeId: 'mcp_enrich', targetNodeId: 'summarize' }
      ]
    }
  },
  workspaceId: 'workspace-workflow-integration-tool',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['http-request', 'mcp'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /lead_status/);
    assert.match(prompt, /enriched_lead/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Integration summary generated.'
    };
  },
  desktopToolInvoker: async (request) => {
    integrationToolCalls.push({
      toolId: request.toolId,
      action: request.action,
      input: request.input
    });
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        text: request.toolId === 'http-request' ? 'lead status active' : 'enriched lead score 91'
      }
    };
  },
  completedAt: '2026-07-20T10:00:06.000Z'
});

assert.equal(workflowIntegrationToolTask.task.state, 'completed');
assert.deepEqual(
  integrationToolCalls.map((call) => `${call.toolId}/${call.action}`),
  ['http-request/http.request', 'mcp/mcp.call']
);
assert.equal((integrationToolCalls[0]?.input.body as { query?: string }).query, 'Fetch lead status and enrich it through MCP.');
assert.equal((integrationToolCalls[1]?.input.arguments as { lead?: string }).lead, 'lead status active');
assert.ok(
  workflowIntegrationToolTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Fetch lead status/.test(log.message)
  )
);

let knowledgeRetrievalToolCallCount = 0;
const workflowKnowledgeTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-knowledge-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Use local knowledge',
    input: 'Summarize the customer policy.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    requiredKnowledgeSources: ['local_file'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'gather_context',
          type: 'knowledge',
          name: 'Gather policy knowledge',
          outputVariables: ['knowledge_context']
        },
        {
          id: 'summarize_policy',
          type: 'llm',
          name: 'Summarize policy',
          inputVariables: ['knowledge_context']
        }
      ],
      edges: [
        { id: 'start-knowledge', sourceNodeId: 'start', targetNodeId: 'gather_context' },
        { id: 'knowledge-summary', sourceNodeId: 'gather_context', targetNodeId: 'summarize_policy' }
      ]
    }
  },
  workspaceId: 'workspace-workflow-knowledge',
  modelProfiles,
  tools,
  knowledgeSources: [
    {
      id: 'local_file',
      source: 'local_file',
      label: 'Policy File',
      enabled: true,
      createdAt: '2026-07-20T10:00:00.000Z',
      localPath: 'C:\\QiuAI\\Knowledge\\policy.md',
      summary: 'Customer policy source.'
    }
  ],
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: ['local_file'],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Customer policy snippet/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Policy summary generated.'
    };
  },
  desktopToolInvoker: async (request) => {
    knowledgeRetrievalToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'document.extract_text');
    assert.equal(request.input.path, 'C:\\QiuAI\\Knowledge\\policy.md');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        text: 'Customer policy snippet: approve renewal requests within two business days.'
      }
    };
  },
  completedAt: '2026-07-20T10:00:06.500Z'
});

assert.equal(workflowKnowledgeTask.task.state, 'completed');
assert.equal(knowledgeRetrievalToolCallCount, 1);
assert.ok(
  workflowKnowledgeTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_KNOWLEDGE_RETRIEVED')
);

const workflowVariableTransformTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-variable-transform-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Transform variables',
    input: '{"customer":"Acme","goal":"renewal"}',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'assign_context',
          type: 'data',
          name: 'Assign customer context',
          outputVariables: ['customer_name', 'customer_goal'],
          config: {
            dataMode: 'assign',
            assignments: [
              { name: 'customer_name', from: 'start.customer' },
              { name: 'customer_goal', from: 'start.goal' }
            ]
          }
        },
        {
          id: 'render_brief',
          type: 'data',
          name: 'Render customer brief',
          inputVariables: ['customer_name', 'customer_goal'],
          outputVariables: ['customer_brief'],
          config: {
            dataMode: 'template',
            template: 'Customer: {{customer_name}}\\nGoal: {{customer_goal}}'
          }
        },
        {
          id: 'draft',
          type: 'llm',
          name: 'Draft response',
          inputVariables: ['customer_brief']
        }
      ],
      edges: [
        { id: 'start-assign', sourceNodeId: 'start', targetNodeId: 'assign_context' },
        { id: 'assign-template', sourceNodeId: 'assign_context', targetNodeId: 'render_brief' },
        { id: 'template-draft', sourceNodeId: 'render_brief', targetNodeId: 'draft' }
      ]
    }
  },
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Customer: Acme/);
    assert.match(prompt, /Goal: renewal/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Variable transformed response.'
    };
  },
  completedAt: '2026-07-20T10:00:07.000Z'
});

assert.equal(workflowVariableTransformTask.task.state, 'completed');
assert.ok(
  workflowVariableTransformTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Render customer brief/.test(log.message)
  )
);

let workflowFallbackArtifactToolCallCount = 0;
const workflowArtifactFallbackTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-artifact-fallback-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create customer playbook',
    input: 'Write a customer playbook as a document.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'write-playbook',
          type: 'artifact',
          name: 'Write playbook document',
          instruction: 'Write the final customer playbook document.',
          artifactType: 'docx'
        }
      ],
      edges: [
        {
          id: 'start-write-playbook',
          sourceNodeId: 'start',
          targetNodeId: 'write-playbook',
          condition: { type: 'always' }
        }
      ]
    }
  },
  workspaceId: 'workspace-workflow-artifact-fallback',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /workflow node executor/);
    assert.match(prompt, /Write playbook document/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: '## Customer playbook\n\n- Segment customers\n- Prepare follow-up actions'
    };
  },
  desktopToolInvoker: async (request) => {
    workflowFallbackArtifactToolCallCount += 1;
    assert.equal(request.workspaceId, 'workspace-workflow-artifact-fallback');
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'office.write_docx_document');
    assert.equal(request.input.folder, 'documents');
    assert.match(String(request.input.content), /Customer playbook/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\customer-playbook.docx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.750Z'
});

assert.equal(workflowFallbackArtifactToolCallCount, 1);
assert.equal(workflowArtifactFallbackTask.task.state, 'completed');
assert.deepEqual(workflowArtifactFallbackTask.usedToolIds, ['office-document']);
assert.equal(workflowArtifactFallbackTask.task.artifacts.length, 2);
assert.equal(
  workflowArtifactFallbackTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\documents\\customer-playbook.docx'
);
assert.ok(
  workflowArtifactFallbackTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_ARTIFACT_WRITTEN'
  )
);

let workflowVariableArtifactModelInvocationCount = 0;
let workflowVariableArtifactToolCallCount = 0;
const workflowVariableArtifactTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-variable-artifact-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create renewal proposal',
    input: 'Draft a renewal proposal.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'llm_1',
          type: 'llm',
          name: 'Draft proposal body',
          instruction: 'Draft the proposal body.',
          outputVariables: ['proposal_body']
        },
        {
          id: 'artifact_1',
          type: 'artifact',
          name: 'Write proposal document',
          instruction: 'Write the proposal body into a Word document.',
          toolId: 'office-document',
          artifactType: 'docx',
          inputVariables: ['llm_1.text'],
          config: {
            action: 'office.write_docx_document',
            input: {
              title: 'Renewal Proposal',
              folder: 'custom-documents',
              fileName: 'renewal-proposal-custom',
              content: '{{llm_1.text}}'
            }
          }
        }
      ],
      edges: [
        { id: 'start-llm', sourceNodeId: 'start', targetNodeId: 'llm_1', condition: { type: 'always' } },
        { id: 'llm-artifact', sourceNodeId: 'llm_1', targetNodeId: 'artifact_1', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-variable-artifact',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowVariableArtifactModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Draft proposal body/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'LLM proposal body ready for Word output.'
    };
  },
  desktopToolInvoker: async (request) => {
    workflowVariableArtifactToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'office.write_docx_document');
    assert.equal(request.input.folder, 'custom-documents');
    assert.equal(request.input.fileName, 'renewal-proposal-custom');
    assert.match(String(request.input.content), /LLM proposal body ready/);
    assert.doesNotMatch(String(request.input.content), /Variable: llm_1\.text/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\renewal-proposal.docx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.900Z'
});

assert.equal(workflowVariableArtifactModelInvocationCount, 1);
assert.equal(workflowVariableArtifactToolCallCount, 1);
assert.equal(workflowVariableArtifactTask.task.state, 'completed');
assert.deepEqual(workflowVariableArtifactTask.usedToolIds, ['office-document']);
assert.equal(
  workflowVariableArtifactTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\documents\\renewal-proposal.docx'
);
assert.ok(
  workflowVariableArtifactTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_ARTIFACT_INPUT_RESOLVED'
  )
);

let workflowCleanDocxArtifactToolCallCount = 0;
const workflowCleanDocxTaskTitle = '请把这个文档整理成一份简洁正式的 Word 文档，保留核心内容，结构清晰一点。';
const workflowCleanDocxArtifactTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-clean-docx-artifact-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: workflowCleanDocxTaskTitle,
    input: workflowCleanDocxTaskTitle,
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'draft',
          type: 'llm',
          name: '整理正文',
          instruction: '整理附件正文，产物只保留核心内容。',
          outputVariables: ['deliverable_content']
        },
        {
          id: 'quality_review',
          type: 'llm',
          name: '检查建议',
          instruction: '给用户补充处理建议。',
          outputVariables: ['quality_review']
        },
        {
          id: 'write_doc',
          type: 'artifact',
          name: '生成 Word',
          instruction: '把正式正文写入 Word 文档。',
          toolId: 'office-document',
          artifactType: 'docx',
          inputVariables: ['deliverable_content', 'quality_review']
        }
      ],
      edges: [
        { id: 'start-draft', sourceNodeId: 'start', targetNodeId: 'draft', condition: { type: 'always' } },
        { id: 'draft-review', sourceNodeId: 'draft', targetNodeId: 'quality_review', condition: { type: 'always' } },
        { id: 'review-write', sourceNodeId: 'quality_review', targetNodeId: 'write_doc', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-clean-docx-artifact',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => ({
    provider: request.profile.providerName,
    modelName: request.profile.modelName,
    content: request.messages.map((message) => message.content).join('\n').includes('检查建议')
      ? '建议后续补充产品型号和质保政策。'
      : [
          workflowCleanDocxTaskTitle,
          '',
          '多功能集成浴霸产品技术文档',
          '',
          '摘要',
          '本文件保留产品概述、核心参数、安装规范、维护保养和安全要求。',
          '',
          '后续建议',
          '建议后续补充产品型号和质保政策。'
        ].join('\n')
  }),
  desktopToolInvoker: async (request) => {
    workflowCleanDocxArtifactToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'office.write_docx_document');
    assert.equal(request.input.fileName, '多功能集成浴霸产品技术文档-整理版');
    assert.equal(request.input.title, '多功能集成浴霸产品技术文档');
    assert.match(String(request.input.content), /^多功能集成浴霸产品技术文档/);
    assert.doesNotMatch(String(request.input.content), /请把这个文档整理/);
    assert.doesNotMatch(String(request.input.content), /后续建议/);
    assert.doesNotMatch(String(request.input.content), /产品型号和质保政策/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\多功能集成浴霸产品技术文档-整理版.docx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.905Z'
});

assert.equal(workflowCleanDocxArtifactToolCallCount, 1);
assert.equal(workflowCleanDocxArtifactTask.task.state, 'completed');
assert.match(
  workflowCleanDocxArtifactTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /后续建议/
);
assert.match(
  workflowCleanDocxArtifactTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /产品型号和质保政策/
);

let workflowMismatchedDocxActionToolCallCount = 0;
const workflowMismatchedDocxActionTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-mismatched-docx-action-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: '整理产品文档',
    input: '整理产品文档并输出 Word。',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_content',
          type: 'data',
          name: 'Prepare deliverable content',
          config: {
            dataMode: 'assign',
            values: {
              deliverable_content: '产品文档整理正文。'
            }
          }
        },
        {
          id: 'write_doc',
          type: 'artifact',
          name: 'Write Word deliverable',
          toolId: 'office-document',
          artifactType: 'docx',
          inputVariables: ['deliverable_content'],
          config: {
            action: 'office.write_markdown_document',
            input: {
              title: '错误 Markdown 配置',
              folder: 'documents',
              fileName: 'wrong-markdown-file',
              content: '{{deliverable_content}}'
            }
          }
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_content', condition: { type: 'always' } },
        { id: 'prepare-write', sourceNodeId: 'prepare_content', targetNodeId: 'write_doc', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-mismatched-docx-action',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async () => {
    throw new Error('Mismatched artifact action should be corrected by fallback without invoking model.');
  },
  desktopToolInvoker: async (request) => {
    workflowMismatchedDocxActionToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'office.write_docx_document');
    assert.match(String(request.input.content), /产品文档整理正文/);
    assert.notEqual(request.input.fileName, 'wrong-markdown-file');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\product-doc.docx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.910Z'
});

assert.equal(workflowMismatchedDocxActionToolCallCount, 1);
assert.equal(workflowMismatchedDocxActionTask.task.state, 'completed');
assert.equal(
  workflowMismatchedDocxActionTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\documents\\product-doc.docx'
);

let workflowCleanXlsxArtifactToolCallCount = 0;
const workflowCleanXlsxArtifactTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-clean-xlsx-artifact-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create lead scoring table',
    input: '整理线索评分表。',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_content',
          type: 'data',
          name: 'Prepare deliverable content',
          config: {
            dataMode: 'assign',
            values: {
              deliverable_content: [
                '## 线索评分表',
                '| 客户 | 分数 | 建议 |',
                '| --- | --- | --- |',
                '| Acme | 92 | 优先跟进 |'
              ].join('\n'),
              quality_review: '自检通过：字段完整。'
            }
          }
        },
        {
          id: 'write_table',
          type: 'artifact',
          name: 'Write lead scoring table',
          toolId: 'office-document',
          artifactType: 'xlsx',
          inputVariables: ['deliverable_content', 'quality_review']
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_content', condition: { type: 'always' } },
        { id: 'prepare-write', sourceNodeId: 'prepare_content', targetNodeId: 'write_table', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-clean-xlsx-artifact',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async () => {
    throw new Error('Artifact node with explicit variables should not invoke model.');
  },
  desktopToolInvoker: async (request) => {
    workflowCleanXlsxArtifactToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'spreadsheet.write_xlsx');
    assert.match(String(request.input.content), /线索评分表/);
    assert.match(String(request.input.content), /自检通过/);
    assert.doesNotMatch(String(request.input.content), /Variable: deliverable_content/);
    assert.doesNotMatch(String(request.input.content), /Variable: quality_review/);
    assert.equal(request.input.rows, undefined);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\lead-score.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.910Z'
});

assert.equal(workflowCleanXlsxArtifactToolCallCount, 1);
assert.equal(workflowCleanXlsxArtifactTask.task.state, 'completed');
assert.equal(
  workflowCleanXlsxArtifactTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\spreadsheets\\lead-score.xlsx'
);

let workflowStructuredRowsXlsxToolCallCount = 0;
const workflowStructuredRowsXlsxTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-structured-rows-xlsx-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create structured lead table',
    input: 'Create a structured lead table.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_rows',
          type: 'data',
          name: 'Prepare rows',
          config: {
            dataMode: 'assign',
            values: {
              lead_rows: [
                ['客户', '分数', '建议'],
                ['Acme', '92', '优先跟进'],
                ['Beta', '76', '补充预算信息']
              ]
            }
          },
          outputVariables: ['lead_rows']
        },
        {
          id: 'write_rows_table',
          type: 'artifact',
          name: 'Write rows table',
          toolId: 'office-document',
          artifactType: 'xlsx',
          inputVariables: ['lead_rows'],
          outputVariables: ['lead_table_file'],
          config: {
            action: 'spreadsheet.write_xlsx',
            input: {
              folder: 'spreadsheets',
              fileName: 'structured-leads',
              rows: '$lead_rows'
            }
          }
        }
      ],
      edges: [
        { id: 'start-prepare-rows', sourceNodeId: 'start', targetNodeId: 'prepare_rows', condition: { type: 'always' } },
        { id: 'prepare-rows-write', sourceNodeId: 'prepare_rows', targetNodeId: 'write_rows_table', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-structured-rows-xlsx',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async () => {
    throw new Error('Structured rows xlsx should not invoke model.');
  },
  desktopToolInvoker: async (request) => {
    workflowStructuredRowsXlsxToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'spreadsheet.write_xlsx');
    assert.deepEqual(request.input.rows, [
      ['客户', '分数', '建议'],
      ['Acme', '92', '优先跟进'],
      ['Beta', '76', '补充预算信息']
    ]);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\structured-leads.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.950Z'
});

assert.equal(workflowStructuredRowsXlsxToolCallCount, 1);
assert.equal(workflowStructuredRowsXlsxTask.task.state, 'completed');
assert.equal(
  workflowStructuredRowsXlsxTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\spreadsheets\\structured-leads.xlsx'
);

let workflowJsonToRowsXlsxModelInvocationCount = 0;
let workflowJsonToRowsXlsxToolCallCount = 0;
const workflowJsonToRowsXlsxTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-json-to-rows-xlsx-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Extract leads into Excel',
    input: 'Extract leads and create a spreadsheet.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'extract_leads',
          type: 'llm',
          name: 'Extract leads',
          instruction: 'Return JSON with an items array.',
          config: {
            outputMode: 'json',
            schema: {
              items: [
                {
                  customer: 'string',
                  score: 'number',
                  suggestion: 'string'
                }
              ]
            }
          },
          outputVariables: ['lead_payload']
        },
        {
          id: 'build_rows',
          type: 'data',
          name: 'Build spreadsheet rows',
          inputVariables: ['lead_payload.items'],
          outputVariables: ['lead_rows'],
          config: {
            dataMode: 'assign',
            tableMapping: {
              sourceRef: 'lead_payload.items',
              outputVariable: 'lead_rows',
              columns: [
                { header: 'Customer', path: 'customer' },
                { header: 'Score', path: 'score' },
                { header: 'Suggestion', path: 'suggestion' }
              ]
            }
          }
        },
        {
          id: 'write_leads',
          type: 'artifact',
          name: 'Write leads spreadsheet',
          toolId: 'office-document',
          artifactType: 'xlsx',
          inputVariables: ['lead_rows'],
          outputVariables: ['lead_file'],
          config: {
            action: 'spreadsheet.write_xlsx',
            input: {
              folder: 'spreadsheets',
              fileName: 'lead-table',
              rows: '$lead_rows'
            }
          }
        }
      ],
      edges: [
        { id: 'start-extract-leads', sourceNodeId: 'start', targetNodeId: 'extract_leads', condition: { type: 'always' } },
        { id: 'extract-build-rows', sourceNodeId: 'extract_leads', targetNodeId: 'build_rows', condition: { type: 'always' } },
        { id: 'build-rows-write', sourceNodeId: 'build_rows', targetNodeId: 'write_leads', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-json-to-rows-xlsx',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowJsonToRowsXlsxModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Return valid JSON only/);
    assert.match(prompt, /items/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        items: [
          { customer: 'Acme', score: 92, suggestion: 'Follow up first' },
          { customer: 'Beta', score: 76, suggestion: 'Confirm budget' }
        ]
      })
    };
  },
  desktopToolInvoker: async (request) => {
    workflowJsonToRowsXlsxToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'spreadsheet.write_xlsx');
    assert.deepEqual(request.input.rows, [
      ['Customer', 'Score', 'Suggestion'],
      ['Acme', '92', 'Follow up first'],
      ['Beta', '76', 'Confirm budget']
    ]);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\lead-table.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.970Z'
});

assert.equal(workflowJsonToRowsXlsxModelInvocationCount, 1);
assert.equal(workflowJsonToRowsXlsxToolCallCount, 1);
assert.equal(workflowJsonToRowsXlsxTask.task.state, 'completed');
assert.equal(
  workflowJsonToRowsXlsxTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\spreadsheets\\lead-table.xlsx'
);

let workflowJsonSheetsXlsxModelInvocationCount = 0;
let workflowJsonSheetsXlsxToolCallCount = 0;
const workflowJsonSheetsXlsxTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-json-sheets-xlsx-001',
    roleCode: 'ai-spreadsheet-organizer',
    roleName: 'AI 表格整理专员',
    title: '整理商品名称和价格',
    input: '整理“商品名称”和“价格”，输出 Excel。',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'draft_deliverable',
          type: 'llm',
          name: '生成交付内容',
          instruction: 'Return JSON with sheets for a spreadsheet.',
          config: {
            outputMode: 'json',
            timeoutMs: 60_000,
            schema: {
              sheets: [
                {
                  name: '整理后明细',
                  rows: [
                    ['商品名称', '价格'],
                    ['纯棉毛巾', '19.90']
                  ]
                }
              ]
            }
          },
          outputVariables: ['deliverable_content']
        },
        {
          id: 'write_artifact',
          type: 'artifact',
          name: '生成文件',
          toolId: 'office-document',
          artifactType: 'xlsx',
          inputVariables: ['deliverable_content'],
          outputVariables: ['deliverable_file'],
          config: {
            action: 'spreadsheet.write_xlsx',
            input: {
              folder: 'spreadsheets',
              fileName: 'product-price-table',
              sheets: '$deliverable_content.sheets',
              content: '{{deliverable_content.assistantMessage}}'
            }
          }
        }
      ],
      edges: [
        { id: 'start-draft-sheets', sourceNodeId: 'start', targetNodeId: 'draft_deliverable', condition: { type: 'always' } },
        { id: 'draft-sheets-write', sourceNodeId: 'draft_deliverable', targetNodeId: 'write_artifact', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-json-sheets-xlsx',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowJsonSheetsXlsxModelInvocationCount += 1;
    assert.equal(request.timeoutMs, 60_000);
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Return valid JSON only/);
    assert.match(prompt, /sheets/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        sheets: [
          {
            name: '整理后明细',
            rows: [
              ['商品名称', '价格'],
              ['纯棉毛巾', '19.90'],
              ['无线蓝牙耳机', '129']
            ]
          }
        ],
        assistantMessage: '已整理 2 条商品价格。'
      })
    };
  },
  desktopToolInvoker: async (request) => {
    workflowJsonSheetsXlsxToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'spreadsheet.write_xlsx');
    assert.deepEqual(request.input.sheets, [
      {
        name: '整理后明细',
        rows: [
          ['商品名称', '价格'],
          ['纯棉毛巾', '19.90'],
          ['无线蓝牙耳机', '129']
        ]
      }
    ]);
    assert.notEqual(request.input.sheets, undefined);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\product-price-table.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.975Z'
});

assert.equal(workflowJsonSheetsXlsxModelInvocationCount, 1);
assert.equal(workflowJsonSheetsXlsxToolCallCount, 1);
assert.equal(workflowJsonSheetsXlsxTask.task.state, 'completed');
assert.equal(
  workflowJsonSheetsXlsxTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\spreadsheets\\product-price-table.xlsx'
);

let workflowCodeRowsXlsxModelInvocationCount = 0;
let workflowCodeRowsXlsxToolCallCount = 0;
const workflowCodeRowsXlsxTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-code-rows-xlsx-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Transform leads with code',
    input: 'Extract and score leads.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'extract_leads',
          type: 'llm',
          name: 'Extract leads',
          instruction: 'Return JSON with an items array.',
          config: {
            outputMode: 'json',
            schema: {
              items: [{ customer: 'string', score: 'number', suggestion: 'string' }]
            }
          },
          outputVariables: ['lead_payload']
        },
        {
          id: 'build_rows_with_code',
          type: 'data',
          name: 'Build rows with code',
          inputVariables: ['lead_payload'],
          outputVariables: ['lead_rows'],
          config: {
            dataMode: 'code',
            outputVariable: 'lead_rows',
            code: [
              'const items = Array.isArray(input.lead_payload.items) ? input.lead_payload.items : [];',
              'return helpers.toRows(items, [',
              "  { header: 'Customer', path: 'customer' },",
              "  { header: 'Score', path: 'score' },",
              "  { header: 'Priority', path: 'priority' }",
              '].map((column) => column)).map((row, index) => index === 0 ? row : [row[0], row[1], Number(row[1]) >= 90 ? "High" : "Normal"]);'
            ].join('\n')
          }
        },
        {
          id: 'write_leads',
          type: 'artifact',
          name: 'Write transformed spreadsheet',
          toolId: 'office-document',
          artifactType: 'xlsx',
          inputVariables: ['lead_rows'],
          outputVariables: ['lead_file'],
          config: {
            action: 'spreadsheet.write_xlsx',
            input: {
              folder: 'spreadsheets',
              fileName: 'coded-lead-table',
              rows: '$lead_rows'
            }
          }
        }
      ],
      edges: [
        { id: 'start-extract-code-leads', sourceNodeId: 'start', targetNodeId: 'extract_leads', condition: { type: 'always' } },
        { id: 'extract-code-rows', sourceNodeId: 'extract_leads', targetNodeId: 'build_rows_with_code', condition: { type: 'always' } },
        { id: 'code-rows-write', sourceNodeId: 'build_rows_with_code', targetNodeId: 'write_leads', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-code-rows-xlsx',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowCodeRowsXlsxModelInvocationCount += 1;
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        items: [
          { customer: 'Acme', score: 92, suggestion: 'Follow up first' },
          { customer: 'Beta', score: 76, suggestion: 'Confirm budget' }
        ]
      })
    };
  },
  desktopToolInvoker: async (request) => {
    workflowCodeRowsXlsxToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'spreadsheet.write_xlsx');
    assert.deepEqual(request.input.rows, [
      ['Customer', 'Score', 'Priority'],
      ['Acme', '92', 'High'],
      ['Beta', '76', 'Normal']
    ]);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\coded-lead-table.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.980Z'
});

assert.equal(workflowCodeRowsXlsxModelInvocationCount, 1);
assert.equal(workflowCodeRowsXlsxToolCallCount, 1);
assert.equal(workflowCodeRowsXlsxTask.task.state, 'completed');
assert.equal(
  workflowCodeRowsXlsxTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\spreadsheets\\coded-lead-table.xlsx'
);

let workflowCodeMultiOutputModelInvocationCount = 0;
const workflowCodeMultiOutputTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-code-multi-output-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Split code object output',
    input: 'Split fields.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: [],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'split_payload',
          type: 'data',
          name: 'Split payload',
          outputVariables: ['first_value', 'second_value'],
          config: {
            dataMode: 'code',
            outputVariable: 'first_value',
            code: 'return { first_value: "Alpha", second_value: "Beta" };'
          }
        },
        {
          id: 'final_output',
          type: 'output',
          name: 'Final output',
          inputVariables: ['first_value', 'second_value'],
          outputVariables: ['final_answer']
        }
      ],
      edges: [
        { id: 'start-split-payload', sourceNodeId: 'start', targetNodeId: 'split_payload', condition: { type: 'always' } },
        { id: 'split-payload-final', sourceNodeId: 'split_payload', targetNodeId: 'final_output', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-code-multi-output',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowCodeMultiOutputModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Variable: first_value/);
    assert.match(prompt, /Alpha/);
    assert.match(prompt, /Variable: second_value/);
    assert.match(prompt, /Beta/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Both values are available.'
    };
  },
  completedAt: '2026-07-20T10:00:05.985Z'
});

assert.equal(workflowCodeMultiOutputModelInvocationCount, 1);
assert.equal(workflowCodeMultiOutputTask.task.state, 'completed');

const blockedCodeNodeTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-blocked-code-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Blocked code',
    input: 'Run unsafe code.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'unsafe_code',
          type: 'data',
          name: 'Unsafe code',
          inputVariables: ['start.text'],
          outputVariables: ['unsafe_result'],
          config: {
            dataMode: 'code',
            outputVariable: 'unsafe_result',
            code: 'return process.env;'
          }
        }
      ],
      edges: [
        { id: 'start-unsafe-code', sourceNodeId: 'start', targetNodeId: 'unsafe_code', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-blocked-code',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => ({
    provider: request.profile.providerName,
    modelName: request.profile.modelName,
    content: 'This model response should not be used by the blocked code node.'
  }),
  completedAt: '2026-07-20T10:00:05.990Z'
});

assert.equal(blockedCodeNodeTask.task.state, 'failed');
assert.ok(
  blockedCodeNodeTask.task.executionLogs.some((log) =>
    /blocked token: process/.test(log.message)
  )
);

const academicDemoCompatibilityTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-academic-demo-compat-001',
    roleCode: 'academic-demo-factory',
    roleName: 'AI 学术 Demo 工厂',
    title: 'Academic demo compatibility',
    input: JSON.stringify({
      factory_request: {
        factoryKind: 'academic_project_demo_factory',
        demoParameters: {
          projectType: 'academic_research',
          audience: 'judges'
        }
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: [],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\input\\academic-demo.docx']
    }
  }),
  rolePackage: {
    ...workflowRolePackage,
    roleCode: 'academic-demo-factory',
    name: 'AI 学术 Demo 工厂',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 8,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_academic_materials',
          type: 'data',
          name: 'Prepare materials',
          inputVariables: ['factory_request', 'start.files', 'knowledge_context'],
          outputVariables: ['factory_request', 'academic_materials', 'demo_parameters'],
          config: {
            dataMode: 'code',
            outputVariable: 'academic_materials',
            code:
              'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
              'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
              'return { factory_request: request, academic_materials: files.map((file, index) => ({ order: index + 1, name: file.name || `material-${index + 1}`, localPath: file.localPath || file.path || "", kind: file.kind || "document", file })), demo_parameters: request.demoParameters || {} };'
          }
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_academic_materials', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-academic-demo-compat',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => ({
    provider: request.profile.providerName,
    modelName: request.profile.modelName,
    content: 'Academic demo compatibility response.'
  }),
  completedAt: '2026-07-20T10:00:06.500Z'
});

assert.equal(academicDemoCompatibilityTask.task.state, 'completed');
assert.ok(
  academicDemoCompatibilityTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_ACADEMIC_DEMO_MATERIALS_PREPARED'
  )
);
assert.ok(
  academicDemoCompatibilityTask.task.executionLogs.every(
    (log) => !/blocked token: document/.test(log.message)
  )
);

let academicDemoModelCallCount = 0;
const academicDemoToolActions: string[] = [];
const academicDemoTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-academic-demo-current-001',
    roleCode: 'ai-factory-academic-project-demo-v1',
    roleName: 'AI学术Demo工厂',
    title: 'Academic demo current output',
    input: JSON.stringify({
      factory_request: {
        applicationType: 'digital_factory',
        factoryKind: 'academic_project_demo_factory',
        demoParameters: {
          projectName: '可控学术 Demo',
          sectionEntries: [
            {
              type: 'cover',
              enabled: true,
              order: 1,
              title: '项目首页',
              manualContent: '用户确认的首页草稿。'
            }
          ]
        },
        attachments: [
          {
            id: 'source-1',
            name: 'project.docx',
            localPath: 'C:\\QiuAI\\input\\project.docx',
            kind: 'project_document'
          }
        ]
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['office-document', 'local-filesystem'],
      knowledgeBindingIds: []
    }
  }),
  rolePackage: {
    ...workflowRolePackage,
    roleCode: 'ai-factory-academic-project-demo-v1',
    applicationType: 'digital_factory',
    name: 'AI学术Demo工厂',
    modelProfileIds: ['qiu-general-default'],
    toolIds: ['office-document', 'local-filesystem'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 16,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'extract_academic_sections',
          type: 'llm',
          name: '提取项目结构',
          modelProfileId: 'qiu-general-default',
          inputVariables: ['factory_request', 'start.files', 'knowledge_context'],
          outputVariables: ['academic_extraction'],
          config: {
            llmTaskType: 'structured_extraction',
            outputMode: 'json',
            timeoutMs: 120_000,
            schema: {
              project: { name: 'string' },
              sections: [{ type: 'cover', blocks: [{ title: 'string', body: 'string' }] }],
              formulas: [],
              unresolvedItems: []
            }
          }
        },
        {
          id: 'build_demo_config',
          type: 'llm',
          name: '生成Demo草稿',
          inputVariables: ['academic_extraction'],
          outputVariables: ['academic_demo_config'],
          config: { llmTaskType: 'text', outputMode: 'json' }
        },
        {
          id: 'write_demo_package',
          type: 'tool',
          name: '写入本地演示包',
          toolId: 'local-filesystem',
          inputVariables: ['academic_demo_config'],
          outputVariables: ['academic_demo_package']
        },
        {
          id: 'factory_output',
          type: 'output',
          name: '返回结果',
          inputVariables: ['academic_demo_config', 'academic_demo_package'],
          outputVariables: ['final_answer']
        }
      ],
      edges: [
        { id: 'start-extract', sourceNodeId: 'start', targetNodeId: 'extract_academic_sections', condition: { type: 'always' } },
        { id: 'extract-build', sourceNodeId: 'extract_academic_sections', targetNodeId: 'build_demo_config', condition: { type: 'always' } },
        { id: 'build-write', sourceNodeId: 'build_demo_config', targetNodeId: 'write_demo_package', condition: { type: 'always' } },
        { id: 'write-output', sourceNodeId: 'write_demo_package', targetNodeId: 'factory_output', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-academic-demo-current',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document', 'local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    academicDemoModelCallCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /method_model/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        project: { name: '可控学术 Demo' },
        sections: [
          {
            type: 'cover',
            blocks: [{ title: '模型草稿', body: '模型提取的首页内容。', confidence: 'high' }]
          }
        ],
        formulas: [],
        unresolvedItems: []
      })
    };
  },
  desktopToolInvoker: async (request) => {
    academicDemoToolActions.push(`${request.toolId}/${request.action}`);

    if (request.action === 'document.extract_text') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          text: '项目资料中明确包含研究背景、方法模型和核心结论。'
        }
      };
    }

    if (request.action === 'filesystem.write_text_file') {
      const fileName = String(request.input.fileName ?? '');
      const localFileName = fileName.includes('demo-config')
        ? 'demo-config.json'
        : fileName.includes('-demo')
          ? 'demo.html'
          : fileName.includes('识别报告')
            ? '识别报告.md'
            : '待补充内容.md';
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: `C:\\QiuAI\\workspace\\academic-demo\\${localFileName}`
        }
      };
    }

    assert.equal(request.action, 'filesystem.package_zip');
    assert.equal(request.toolId, 'local-filesystem');
    assert.ok(Array.isArray(request.input.files));
    assert.equal(request.input.files.length, 4);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\academic-demo\\学术Demo演示包.zip'
      }
    };
  },
  completedAt: '2026-07-20T10:00:07.000Z'
});

assert.equal(academicDemoModelCallCount, 1);
assert.equal(academicDemoTask.task.state, 'completed');
assert.deepEqual(
  academicDemoTask.task.factoryOutputs?.map((item) => item.title),
  ['Demo演示页面', '本地演示包 ZIP']
);
assert.deepEqual(
  academicDemoTask.task.artifacts
    .filter((artifact) => artifact.type !== 'report')
    .map((artifact) => artifact.title),
  ['Demo演示页面.html', '学术Demo演示包.zip']
);
assert.ok(academicDemoToolActions.includes('office-document/document.extract_text'));
assert.equal(academicDemoToolActions.filter((item) => item === 'local-filesystem/filesystem.write_text_file').length, 4);
assert.ok(academicDemoToolActions.includes('local-filesystem/filesystem.package_zip'));

const timedOutCodeNodeTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-timed-out-code-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Timed out code',
    input: 'Run a non-terminating transform.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'slow_code',
          type: 'data',
          name: 'Slow code',
          inputVariables: ['start.text'],
          outputVariables: ['slow_result'],
          config: {
            dataMode: 'code',
            outputVariable: 'slow_result',
            timeoutMs: 100,
            code: 'while (true) {}'
          }
        }
      ],
      edges: [
        { id: 'start-slow-code', sourceNodeId: 'start', targetNodeId: 'slow_code', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-timed-out-code',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => ({
    provider: request.profile.providerName,
    modelName: request.profile.modelName,
    content: 'This model response should not be used by the timed out code node.'
  }),
  completedAt: '2026-07-20T10:00:06.000Z'
});

assert.equal(timedOutCodeNodeTask.task.state, 'failed');
assert.ok(
  timedOutCodeNodeTask.task.executionLogs.some((log) =>
    /exceeded timeout 100ms/.test(log.message)
  )
);

let workflowPptxArtifactToolCallCount = 0;
const workflowPptxArtifactTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-pptx-artifact-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create onboarding deck',
    input: 'Create an onboarding PPT.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'llm_1',
          type: 'llm',
          name: 'Draft slides',
          instruction: 'Draft slide titles and bullet points.',
          outputVariables: ['slide_text']
        },
        {
          id: 'artifact_1',
          type: 'artifact',
          name: 'Write PPT deck',
          instruction: 'Write the slide content into a PPTX file.',
          toolId: 'office-document',
          artifactType: 'pptx',
          inputVariables: ['llm_1.text']
        }
      ],
      edges: [
        { id: 'start-llm', sourceNodeId: 'start', targetNodeId: 'llm_1', condition: { type: 'always' } },
        { id: 'llm-artifact', sourceNodeId: 'llm_1', targetNodeId: 'artifact_1', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-pptx-artifact',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => ({
    provider: request.profile.providerName,
    modelName: request.profile.modelName,
    content: '## Pilot Goals\n\n- Reduce repetitive work\n- Confirm measurable outcome'
  }),
  desktopToolInvoker: async (request) => {
    workflowPptxArtifactToolCallCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'presentation.write_pptx');
    assert.match(String(request.input.content), /Pilot Goals/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\presentations\\onboarding-deck.pptx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.920Z'
});

assert.equal(workflowPptxArtifactToolCallCount, 1);
assert.equal(workflowPptxArtifactTask.task.state, 'completed');
assert.equal(
  workflowPptxArtifactTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\presentations\\onboarding-deck.pptx'
);

let workflowAttachmentModelInvocationCount = 0;
let workflowAttachmentExtractionCount = 0;
const workflowAttachmentTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-attachment-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Summarize attached briefing',
    input: 'Read the attached briefing and summarize the renewal risk.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['office-document'],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\input\\renewal-brief.docx']
    }
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'llm_1',
          type: 'llm',
          name: 'Summarize briefing',
          instruction: 'Summarize the attached renewal briefing.',
          inputVariables: ['start.text', 'start.files']
        }
      ],
      edges: [
        { id: 'start-llm', sourceNodeId: 'start', targetNodeId: 'llm_1', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-attachment',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowAttachmentModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Renewal risk extracted from briefing/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Attachment summary generated.'
    };
  },
  desktopToolInvoker: async (request) => {
    workflowAttachmentExtractionCount += 1;
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'document.extract_text');
    assert.equal(request.input.path, 'C:\\QiuAI\\input\\renewal-brief.docx');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        text: 'Renewal risk extracted from briefing.'
      }
    };
  },
  completedAt: '2026-07-20T10:00:05.950Z'
});

assert.equal(workflowAttachmentModelInvocationCount, 1);
assert.equal(workflowAttachmentExtractionCount, 1);
assert.equal(workflowAttachmentTask.task.state, 'completed');
assert.deepEqual(workflowAttachmentTask.usedToolIds, ['office-document']);
assert.ok(
  workflowAttachmentTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_FILE_CONTEXT_EXTRACTED'
  )
);

const branchingRolePackage: RolePackageManifest = {
  ...workflowRolePackage,
  workflowGraph: {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'route',
        type: 'condition',
        name: 'Route by requested artifact',
        instruction: 'Choose the output format requested by the user.'
      },
      {
        id: 'ppt',
        type: 'artifact',
        name: 'Create PPT outline',
        instruction: 'Create slide-by-slide PPT content.',
        artifactType: 'pptx'
      },
      {
        id: 'doc',
        type: 'artifact',
        name: 'Create Word brief',
        instruction: 'Create a Word-style document brief.',
        artifactType: 'docx'
      }
    ],
    edges: [
      { id: 'start-route', sourceNodeId: 'start', targetNodeId: 'route', condition: { type: 'always' } },
      {
        id: 'route-ppt',
        sourceNodeId: 'route',
        targetNodeId: 'ppt',
        condition: { type: 'contains', variable: 'task.input', value: 'PPT' }
      },
      { id: 'route-doc', sourceNodeId: 'route', targetNodeId: 'doc', condition: { type: 'always' } }
    ]
  }
};

const branchingTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-branch-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create training material',
    input: 'Please create a PPT for onboarding.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: branchingRolePackage,
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Create PPT outline/);
    assert.doesNotMatch(prompt, /Create Word brief/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Branch-specific PPT result generated.'
    };
  },
  completedAt: '2026-07-20T10:00:06.000Z'
});

assert.equal(branchingTask.task.state, 'completed');
assert.ok(
  branchingTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_GRAPH_NODE_PLANNED')
);

let runtimeJsonBranchModelInvocationCount = 0;
const runtimeJsonBranchToolRequests: Array<{ toolId: string; action: string; input: Record<string, unknown> }> = [];
const runtimeJsonBranchTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-json-branch-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Create proposal from classified intent',
    input: '客户要一份企业 AI 入门方案，请联网补充信息并写成 Word。',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: [],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'classify',
          type: 'llm',
          name: 'Classify intent',
          instruction: 'Return JSON with intent and query fields.',
          config: {
            outputMode: 'json',
            schema: {
              intent: 'string',
              query: 'string'
            }
          },
          outputVariables: ['intent_payload']
        },
        {
          id: 'route',
          type: 'condition',
          name: 'Route by model JSON',
          instruction: 'Use classify.json.intent to choose the branch.'
        },
        {
          id: 'research',
          type: 'tool',
          name: 'Research proposal context',
          toolId: 'web-search',
          config: {
            action: 'web.search',
            input: {
              query: '{{intent_payload.query}}',
              maxResults: 3
            }
          },
          inputVariables: ['intent_payload.query'],
          outputVariables: ['research_context']
        },
        {
          id: 'draft',
          type: 'llm',
          name: 'Draft proposal body',
          instruction: 'Draft the final proposal body using research context.',
          inputVariables: ['classify.json.query', 'research.text'],
          outputVariables: ['proposal_body']
        },
        {
          id: 'write_doc',
          type: 'artifact',
          name: 'Write proposal document',
          toolId: 'office-document',
          artifactType: 'docx',
          inputVariables: ['draft.text'],
          outputVariables: ['proposal_file']
        },
        {
          id: 'fallback',
          type: 'output',
          name: 'Fallback answer',
          instruction: 'Explain that no proposal branch matched.'
        }
      ],
      edges: [
        { id: 'start-classify', sourceNodeId: 'start', targetNodeId: 'classify', condition: { type: 'always' } },
        { id: 'classify-route', sourceNodeId: 'classify', targetNodeId: 'route', condition: { type: 'always' } },
        {
          id: 'route-research',
          sourceNodeId: 'route',
          targetNodeId: 'research',
          condition: { type: 'equals', variable: 'intent_payload.intent', value: 'proposal' }
        },
        { id: 'route-fallback', sourceNodeId: 'route', targetNodeId: 'fallback', condition: { type: 'always' } },
        { id: 'research-draft', sourceNodeId: 'research', targetNodeId: 'draft', condition: { type: 'always' } },
        { id: 'draft-write-doc', sourceNodeId: 'draft', targetNodeId: 'write_doc', condition: { type: 'always' } }
      ],
      runtimePolicy: {
        maxNodeExecutions: 16,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      }
    }
  },
  workspaceId: 'workspace-workflow-json-branch',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search', 'office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    runtimeJsonBranchModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');

    if (runtimeJsonBranchModelInvocationCount === 1) {
      assert.match(prompt, /Classify intent/);
      assert.match(prompt, /Return valid JSON only/);
      assert.match(prompt, /"intent": "string"/);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: ['模型分类如下：', '```json', '{"intent":"proposal","query":"enterprise AI onboarding"}', '```'].join('\n')
      };
    }

    assert.match(prompt, /Draft proposal body/);
    assert.match(prompt, /enterprise AI onboarding/);
    assert.match(prompt, /Acme found enterprise onboarding demand/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Proposal Word body with researched context.'
    };
  },
  desktopToolInvoker: async (request) => {
    runtimeJsonBranchToolRequests.push({
      toolId: request.toolId,
      action: request.action,
      input: request.input
    });

    if (request.action === 'web.search') {
      assert.equal(request.toolId, 'web-search');
      assert.equal(request.input.query, 'enterprise AI onboarding');
      assert.equal(request.input.maxResults, 3);
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          text: 'Acme found enterprise onboarding demand in manufacturing and education.'
        }
      };
    }

    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'office.write_docx_document');
    assert.match(String(request.input.content), /Proposal Word body/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\proposal-from-json-branch.docx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:06.500Z'
});

assert.equal(runtimeJsonBranchModelInvocationCount, 2);
assert.deepEqual(
  runtimeJsonBranchToolRequests.map((request) => `${request.toolId}/${request.action}`),
  ['web-search/web.search', 'office-document/office.write_docx_document']
);
assert.equal(runtimeJsonBranchTask.task.state, 'completed');
assert.deepEqual(runtimeJsonBranchTask.usedToolIds, ['web-search', 'office-document']);
assert.equal(
  runtimeJsonBranchTask.task.artifacts[0]?.localPath,
  'C:\\QiuAI\\workspace\\documents\\proposal-from-json-branch.docx'
);
assert.ok(
  runtimeJsonBranchTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Research proposal context/.test(log.message)
  )
);
assert.ok(
  runtimeJsonBranchTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Write proposal document/.test(log.message)
  )
);
assert.doesNotMatch(
  runtimeJsonBranchTask.task.artifacts.find((artifact) => artifact.type === 'report')?.content ?? '',
  /Fallback answer/
);

const invalidJsonOutputTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-invalid-json-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Extract structured payload',
    input: 'Return structured lead information.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'extract_json',
          type: 'llm',
          name: 'Extract JSON',
          instruction: 'Extract lead fields as JSON.',
          config: {
            outputMode: 'json',
            schema: {
              name: 'string',
              need: 'string'
            }
          },
          outputVariables: ['lead_payload']
        }
      ],
      edges: [
        { id: 'start-extract', sourceNodeId: 'start', targetNodeId: 'extract_json', condition: { type: 'always' } }
      ]
    }
  },
  workspaceId: 'workspace-workflow-invalid-json',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.match(prompt, /Return valid JSON only/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'I found a lead, but this is not JSON.'
    };
  },
  completedAt: '2026-07-20T10:00:06.700Z'
});

assert.equal(invalidJsonOutputTask.task.state, 'failed');
assert.ok(
  invalidJsonOutputTask.task.executionLogs.some(
    (log) =>
      log.eventType === 'WORKFLOW_RUNTIME_NODE_FAILED' &&
      /expected JSON output/.test(log.message)
  )
);

let workflowStructureModelInvocationCount = 0;
const workflowStructureTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-structure-001',
    roleCode: 'ai-video-reviewer',
    roleName: 'AI Video Reviewer',
    title: 'Review uploaded videos',
    input: 'Cut uploaded videos to 15 seconds and keep product highlights.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: [],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\input\\demo.mp4', 'C:\\QiuAI\\input\\cover.png']
    }
  }),
  rolePackage: {
    ...workflowRolePackage,
    modelProfileIds: ['qiu-general-default'],
    toolIds: [],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'extract_params',
          type: 'llm',
          name: 'Extract video task parameters',
          instruction: 'Extract targetDuration and priority fields.',
          modelProfileId: 'qiu-general-default',
          config: {
            llmTaskType: 'structured_extraction',
            outputMode: 'json',
            schema: {
              targetDuration: 'number',
              priority: 'string[]'
            }
          },
          outputVariables: ['video_params']
        },
        {
          id: 'video_list',
          type: 'list',
          name: 'Collect video files',
          inputVariables: ['start.files'],
          outputVariables: ['video_files'],
          config: {
            sourceRef: 'start.files',
            kind: 'video',
            limit: 10
          }
        },
        {
          id: 'next_video',
          type: 'iteration',
          name: 'Prepare current video',
          inputVariables: ['video_list.items'],
          outputVariables: ['current_video'],
          config: {
            sourceRef: 'video_list.items'
          }
        },
        {
          id: 'merge_context',
          type: 'aggregator',
          name: 'Merge video context',
          inputVariables: ['extract_params.json', 'next_video.current'],
          outputVariables: ['video_context'],
          config: {
            mode: 'object'
          }
        },
        {
          id: 'final_output',
          type: 'output',
          name: 'Return workflow result',
          instruction: 'Summarize the prepared video context.',
          inputVariables: ['merge_context.json']
        }
      ],
      edges: [
        { id: 'start-params', sourceNodeId: 'start', targetNodeId: 'extract_params', condition: { type: 'always' } },
        { id: 'params-list', sourceNodeId: 'extract_params', targetNodeId: 'video_list', condition: { type: 'always' } },
        { id: 'list-iterate', sourceNodeId: 'video_list', targetNodeId: 'next_video', condition: { type: 'always' } },
        { id: 'iterate-merge', sourceNodeId: 'next_video', targetNodeId: 'merge_context', condition: { type: 'always' } },
        { id: 'merge-output', sourceNodeId: 'merge_context', targetNodeId: 'final_output', condition: { type: 'always' } }
      ],
      runtimePolicy: {
        maxNodeExecutions: 12,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      }
    }
  },
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    workflowStructureModelInvocationCount += 1;
    const prompt = request.messages.map((message) => message.content).join('\n');

    if (workflowStructureModelInvocationCount === 1) {
      assert.match(prompt, /Extract video task parameters/);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: '{"targetDuration":15,"priority":["product highlights"]}'
      };
    }

    assert.match(prompt, /demo.mp4/);
    assert.match(prompt, /targetDuration/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Video context prepared for demo.mp4.'
    };
  },
  completedAt: '2026-07-20T10:00:06.750Z'
});

assert.equal(workflowStructureModelInvocationCount, 2);
assert.equal(workflowStructureTask.task.state, 'completed');
assert.ok(
  workflowStructureTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Collect video files/.test(log.message)
  )
);
assert.ok(
  workflowStructureTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_COMPLETED' && /Prepare current video/.test(log.message)
  )
);
assert.match(workflowStructureTask.task.artifacts.find((artifact) => artifact.type === 'text')?.content ?? '', /demo\.mp4/);

const malformedWorkflowTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-malformed-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Fallback from malformed graph',
    input: 'Run with standard prompt.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: {
    ...workflowRolePackage,
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'missing',
      nodes: [],
      edges: []
    }
  },
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.doesNotMatch(prompt, /Workflow graph selected execution path/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Fallback result generated.'
    };
  },
  completedAt: '2026-07-20T10:00:07.000Z'
});

assert.equal(malformedWorkflowTask.task.state, 'completed');
assert.ok(
  malformedWorkflowTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_GRAPH_SKIPPED')
);

const failedWorkflowRunTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-workflow-failed-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Fail workflow-backed run',
    input: 'Trigger model failure.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0
  }),
  rolePackage: workflowRolePackage,
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async () => {
    throw new Error('model unavailable');
  },
  completedAt: '2026-07-20T10:00:08.000Z'
});

assert.equal(failedWorkflowRunTask.task.state, 'failed');
assert.ok(
  failedWorkflowRunTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_STARTED')
);
assert.ok(
  failedWorkflowRunTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_FAILED')
);
assert.ok(
  failedWorkflowRunTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_NODE_FAILED' && /model unavailable/.test(log.message)
  )
);

let toolCallingModelInvocationCount = 0;
const toolCallingProgressSnapshots: string[][] = [];
const toolCallingProgressArtifactPaths: string[][] = [];
const toolCallingTask = await runDesktopTask({
  task: {
    ...task,
    taskId: 'task-runner-tool-call-001',
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['local-filesystem'],
      knowledgeBindingIds: []
    }
  },
  workspaceId: 'workspace-tool-call',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    toolCallingModelInvocationCount += 1;
    if (toolCallingModelInvocationCount === 1) {
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content:
          'QIUAI_DESKTOP_TOOL_CALL: {"toolId":"local-filesystem","action":"filesystem.write_text_file","input":{"folder":"reports","fileName":"weekly-summary","content":"Generated weekly summary"}}',
        inputTokens: 120,
        outputTokens: 60
      };
    }

    assert.match(request.messages.at(-1)?.content ?? '', /Desktop tool result/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Final result generated after local filesystem tool execution.',
      inputTokens: 160,
      outputTokens: 90
    };
  },
  desktopToolInvoker: async (request) => {
    assert.equal(request.workspaceId, 'workspace-tool-call');
    assert.equal(request.toolId, 'local-filesystem');
    assert.equal(request.action, 'filesystem.write_text_file');
    assert.equal(request.input.fileName, 'weekly-summary');

    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\reports\\weekly-summary.md'
      }
    };
  },
  onProgress: (progressTask) => {
    toolCallingProgressSnapshots.push(progressTask.executionLogs.map((log) => log.eventType));
    toolCallingProgressArtifactPaths.push(
      progressTask.artifacts.flatMap((artifact) => (artifact.localPath ? [artifact.localPath] : []))
    );
  },
  completedAt: '2026-07-20T10:00:10.000Z'
});

assert.equal(toolCallingModelInvocationCount, 2);
assert.equal(toolCallingTask.task.state, 'completed');
assert.deepEqual(toolCallingTask.usedToolIds, ['local-filesystem']);
assert.equal(toolCallingTask.task.artifacts.length, 2);
assert.equal(toolCallingTask.task.artifacts[0]?.localPath, 'C:\\QiuAI\\workspace\\reports\\weekly-summary.md');
assert.match(toolCallingTask.task.artifacts[1]?.content ?? '', /after local filesystem tool execution/);
assert.ok(toolCallingTask.task.executionLogs.some((log) => log.eventType === 'TOOL_CALL_DETECTED'));
assert.ok(toolCallingTask.task.executionLogs.some((log) => log.eventType === 'TOOL_INVOKED'));
assert.ok(toolCallingTask.task.executionLogs.some((log) => log.eventType === 'TOOL_RESULT_RETURNED_TO_MODEL'));
assert.ok(toolCallingProgressSnapshots.some((events) => events.includes('MODEL_REQUEST_STARTED')));
assert.ok(toolCallingProgressSnapshots.some((events) => events.includes('TOOL_CALL_DETECTED')));
assert.ok(toolCallingProgressSnapshots.some((events) => events.includes('TOOL_INVOKED')));
assert.ok(toolCallingProgressSnapshots.some((events) => events.includes('TOOL_RESULT_RETURNED_TO_MODEL')));
assert.ok(
  toolCallingProgressSnapshots.at(-1)?.filter((eventType) => eventType === 'MODEL_REQUEST_STARTED').length === 1
);
assert.ok(
  toolCallingProgressArtifactPaths.some((paths) =>
    paths.includes('C:\\QiuAI\\workspace\\reports\\weekly-summary.md')
  )
);

let officeToolModelInvocationCount = 0;
const officeToolCallingTask = await runDesktopTask({
  task: {
    ...task,
    taskId: 'task-runner-office-tool-call-001',
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['office-document'],
      knowledgeBindingIds: []
    }
  },
  workspaceId: 'workspace-office-tool-call',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    officeToolModelInvocationCount += 1;
    if (officeToolModelInvocationCount === 1) {
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content:
          'QIUAI_DESKTOP_TOOL_CALL: {"toolId":"office-document","action":"office.write_markdown_document","input":{"title":"Follow-up Plan","folder":"documents","fileName":"follow-up-plan","content":"## Next actions\\n\\n- Call customer owner"}}'
      };
    }

    assert.match(request.messages.at(-1)?.content ?? '', /Desktop tool result/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Final result generated after office document tool execution.'
    };
  },
  desktopToolInvoker: async (request) => {
    assert.equal(request.workspaceId, 'workspace-office-tool-call');
    assert.equal(request.toolId, 'office-document');
    assert.equal(request.action, 'office.write_markdown_document');
    assert.equal(request.input.fileName, 'follow-up-plan');

    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\follow-up-plan.md'
      }
    };
  },
  completedAt: '2026-07-20T10:00:12.000Z'
});

assert.equal(officeToolModelInvocationCount, 2);
assert.equal(officeToolCallingTask.task.state, 'completed');
assert.deepEqual(officeToolCallingTask.usedToolIds, ['office-document']);
assert.equal(officeToolCallingTask.task.artifacts.length, 2);
assert.equal(officeToolCallingTask.task.artifacts[0]?.localPath, 'C:\\QiuAI\\workspace\\documents\\follow-up-plan.md');
assert.match(officeToolCallingTask.task.artifacts[1]?.content ?? '', /office document tool execution/);

let multiToolModelInvocationCount = 0;
const multiToolRequests: Array<{ toolId: string; action: string }> = [];
const multiToolTask = await runDesktopTask({
  task: {
    ...task,
    taskId: 'task-runner-multi-tool-call-001',
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['local-filesystem', 'office-document'],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\input\\customer-notes.txt']
    }
  },
  workspaceId: 'workspace-multi-tool-call',
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['local-filesystem', 'office-document'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    multiToolModelInvocationCount += 1;

    if (multiToolModelInvocationCount === 1) {
      assert.match(request.messages[1]?.content ?? '', /Attached file text context/);
      assert.match(request.messages[1]?.content ?? '', /Customer note content/);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: [
          '```json',
          '{"toolId":"local-filesystem","action":"filesystem.read_text_file","input":{"path":"C:\\\\QiuAI\\\\input\\\\customer-notes.txt"}}',
          '```'
        ].join('\n')
      };
    }

    if (multiToolModelInvocationCount === 2) {
      assert.match(request.messages.at(-1)?.content ?? '', /Customer note content/);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content:
          'QIUAI_DESKTOP_TOOL_CALL: {"toolId":"office-document","action":"office.write_markdown_document","input":{"title":"Customer Summary","folder":"documents","fileName":"customer-summary","content":"## Summary\\n\\nCustomer note content processed."}}'
      };
    }

    assert.match(request.messages.at(-1)?.content ?? '', /customer-summary.md/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Final result generated after reading input and writing office document.'
    };
  },
  desktopToolInvoker: async (request) => {
    multiToolRequests.push({ toolId: request.toolId, action: request.action });

    if (request.action === 'document.extract_text') {
      assert.equal(request.toolId, 'office-document');
      assert.equal(request.allowedRootPaths?.includes('C:\\QiuAI\\input\\customer-notes.txt'), true);
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          path: request.input.path,
          text: 'Customer note content'
        }
      };
    }

    if (request.action === 'filesystem.read_text_file') {
      assert.equal(request.allowedRootPaths?.includes('C:\\QiuAI\\input\\customer-notes.txt'), true);
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          path: request.input.path,
          content: 'Customer note content'
        }
      };
    }

    assert.equal(request.action, 'office.write_markdown_document');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\documents\\customer-summary.md'
      }
    };
  },
  completedAt: '2026-07-20T10:00:13.000Z'
});

assert.equal(multiToolModelInvocationCount, 3);
assert.equal(multiToolTask.task.state, 'completed');
assert.deepEqual(multiToolTask.usedToolIds, ['office-document', 'local-filesystem']);
assert.deepEqual(multiToolRequests, [
  { toolId: 'office-document', action: 'document.extract_text' },
  { toolId: 'local-filesystem', action: 'filesystem.read_text_file' },
  { toolId: 'office-document', action: 'office.write_markdown_document' }
]);
assert.equal(multiToolTask.task.artifacts.length, 2);
assert.equal(multiToolTask.task.artifacts[0]?.localPath, 'C:\\QiuAI\\workspace\\documents\\customer-summary.md');
assert.match(multiToolTask.task.artifacts[1]?.content ?? '', /reading input and writing office document/);
assert.ok(multiToolTask.task.executionLogs.some((log) => log.eventType === 'ATTACHMENT_CONTEXT_EXTRACTED'));

let factoryActiveModelCalls = 0;
let factoryMaxActiveModelCalls = 0;
let factoryModelInvocationCount = 0;
let factorySubmitModelCallCount = 0;
let factoryPollModelCallCount = 0;
let factoryDownloadCallCount = 0;
const factoryTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-factory-image-batch-001',
    roleCode: 'cross-border-image-factory',
    roleName: 'Cross Border Image Factory',
    title: 'Generate marketplace product images',
    input: JSON.stringify({
      factory_request: {
        platform: { key: 'amazon', label: 'Amazon', imageRatio: '1:1' },
        packages: [
          { key: 'main_image', label: 'Main image', description: 'Marketplace main product image.' },
          { key: 'white_background', label: 'White background', description: 'Pure white product image.' }
        ],
        promptControls: {
          language: 'English',
          avoid: 'watermark, malformed logo'
        }
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['local-filesystem'],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\sku-1.png', 'C:\\QiuAI\\factory\\sku-2.png']
    }
  }),
  rolePackage: {
    roleCode: 'cross-border-image-factory',
    applicationType: 'digital_factory',
    name: 'Cross Border Image Factory',
    version: '1.0.0',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 8,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_batch',
          type: 'data',
          name: 'Prepare batch',
          inputVariables: ['start.files', 'factory_request'],
          outputVariables: [
            'factory_items',
            'selected_packages',
            'target_platform',
            'package_instructions'
          ],
          config: {
            dataMode: 'code',
            outputVariable: 'factory_items',
            code:
              'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
              'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
              'const packages = Array.isArray(request.packages) ? request.packages : [];\n' +
              'return {\n' +
              '  factory_items: files.map((file, index) => ({ sku: `SKU-${index + 1}`, image: file, sourceName: file.name })),\n' +
              '  selected_packages: packages,\n' +
              '  target_platform: request.platform,\n' +
              '  package_instructions: { items: [] }\n' +
              '};'
          }
        },
        {
          id: 'generate_images',
          type: 'llm',
          name: 'Generate images',
          modelProfileId: 'qiu-image-editing-default',
          inputVariables: ['factory_items', 'selected_packages', 'target_platform', 'package_instructions'],
          outputVariables: ['factory_generated_images'],
          config: {
            llmTaskType: 'image_editing',
            concurrency: 2,
            maxRetries: 0,
            timeoutMs: 20_000
          }
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_batch' },
        { id: 'prepare-generate', sourceNodeId: 'prepare_batch', targetNodeId: 'generate_images' }
      ]
    },
    modelProfileIds: ['qiu-image-editing-default'],
    toolIds: ['local-filesystem'],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_image_batch'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-image-editing-default',
      providerId: 'grsai',
      providerName: 'GrsAI',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation', 'image_to_image', 'image_editing'],
      apiBaseUrl: 'https://grsai.dakka.com.cn/v1',
      apiKey: 'image-api-key'
    }
  ]),
  tools,
  workspaceId: 'workspace-factory-image-batch',
  enabledModelProfileIds: ['qiu-general-default', 'qiu-image-editing-default'],
  enabledToolIds: ['local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    factoryActiveModelCalls += 1;
    factoryMaxActiveModelCalls = Math.max(factoryMaxActiveModelCalls, factoryActiveModelCalls);
    factoryModelInvocationCount += 1;
    assert.equal(request.profile.id, 'qiu-image-editing-default');
    assert.equal(request.taskKind, 'image_generation');
    const asyncMode = request.imageGeneration?.asyncMode;
    const invocationId = factoryModelInvocationCount;
    try {
      if (asyncMode === 'submit_only') {
        factorySubmitModelCallCount += 1;
        assert.ok(request.imageGeneration?.prompt);
        assert.match(request.imageGeneration?.prompt ?? '', /Text language: English/);
        assert.equal(request.imageGeneration?.negativePrompt, 'watermark, malformed logo');
        assert.equal(request.imageGeneration?.aspectRatio, '1:1');
        assert.match(request.imageGeneration?.sourceImagePath ?? '', /sku-[12]\.png/);
        assert.match(request.messages[1]?.content ?? '', /Source image local path/);
        assert.match(request.messages[1]?.content ?? '', /Package:/);
        assert.equal(request.timeoutMs, 120_000);
        await new Promise((resolve) => setTimeout(resolve, 25));
        return {
          provider: request.profile.providerName,
          modelName: request.profile.modelName,
          content: JSON.stringify({
            pending: true,
            providerJobId: `grsai-job-${invocationId}`,
            providerStatus: 'pending'
          }),
          artifacts: [
            {
              type: 'image',
              providerJobId: `grsai-job-${invocationId}`,
              providerStatus: 'pending'
            }
          ]
        };
      }

      assert.equal(asyncMode, 'poll_once');
      factoryPollModelCallCount += 1;
      assert.equal(factorySubmitModelCallCount, 4);
      assert.match(request.imageGeneration?.providerJobId ?? '', /^grsai-job-\d+$/);
      assert.equal(request.timeoutMs, 30_000);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: JSON.stringify({
          remoteUrl: `https://cdn.example.test/factory/image-${invocationId}.png`,
          thumbnailPath: `https://cdn.example.test/factory/thumb-${invocationId}.png`,
          providerJobId: request.imageGeneration?.providerJobId,
          providerStatus: 'succeeded'
        }),
        artifacts: [
          {
            type: 'image',
            remoteUrl: `https://cdn.example.test/factory/image-${invocationId}.png`,
            thumbnailPath: `https://cdn.example.test/factory/thumb-${invocationId}.png`,
            providerJobId: request.imageGeneration?.providerJobId,
            providerStatus: 'succeeded'
          }
        ]
      };
    } finally {
      factoryActiveModelCalls -= 1;
    }
  },
  desktopToolInvoker: async (request) => {
    factoryDownloadCallCount += 1;
    assert.equal(request.toolId, 'local-filesystem');
    assert.equal(request.action, 'filesystem.download_remote_file');
    assert.equal(request.input.mediaKind, 'image');
    assert.equal(request.input.folder, 'product-images');
    assert.match(String(request.input.url ?? ''), /^https:\/\/cdn\.example\.test\/factory\/image-\d+\.png$/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: `C:\\QiuAI\\workspace\\product-images\\image-${factoryDownloadCallCount}.png`,
        sourceUrl: request.input.url
      }
    };
  },
  completedAt: '2026-07-20T10:00:14.000Z'
});

const factoryPreviewArtifact = factoryTask.task.artifacts.find((artifact) => artifact.factoryPreview);
assert.equal(factoryTask.task.state, 'completed');
assert.equal(factoryModelInvocationCount, 8);
assert.equal(factorySubmitModelCallCount, 4);
assert.equal(factoryPollModelCallCount, 4);
assert.equal(factoryDownloadCallCount, 4);
assert.equal(factoryMaxActiveModelCalls > 1, true);
assert.equal(factoryMaxActiveModelCalls <= 2, true);
assert.equal(factoryPreviewArtifact?.factoryPreview?.total, 4);
assert.equal(factoryPreviewArtifact?.factoryPreview?.completed, 4);
assert.equal(factoryPreviewArtifact?.factoryPreview?.failed, 0);
assert.deepEqual(
  factoryPreviewArtifact?.factoryPreview?.items.map((item) => item.order),
  [1, 2, 3, 4]
);
assert.deepEqual(
  factoryPreviewArtifact?.factoryPreview?.items.map((item) => item.sourceName),
  ['sku-1.png', 'sku-1.png', 'sku-2.png', 'sku-2.png']
);
assert.ok(
  factoryPreviewArtifact?.factoryPreview?.items.every((item) => item.remoteUrl?.startsWith('https://cdn.example.test/'))
);
assert.ok(
  factoryPreviewArtifact?.factoryPreview?.items.every((item) => item.localPath?.startsWith('C:\\QiuAI\\workspace\\product-images\\'))
);
assert.ok(
  factoryPreviewArtifact?.factoryPreview?.items.every((item) => item.attempts === 1)
);
assert.ok(
  factoryTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_FACTORY_BATCH_COMPLETED')
);
assert.ok(
  factoryTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_FACTORY_REMOTE_ASSETS_SAVED')
);

let fallbackFactoryImageCalls = 0;
const fallbackFactoryTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-factory-image-optional-vision-fallback-001',
    roleCode: 'cross-border-image-factory',
    roleName: 'Cross Border Image Factory',
    title: 'Generate product images without vision model',
    input: JSON.stringify({
      factory_request: {
        platform: { key: 'amazon', label: 'Amazon', imageRatio: '1:1' },
        packages: [
          { key: 'main_image', label: 'Main image', description: 'Marketplace main product image.' }
        ],
        promptControls: {
          language: 'English',
          style: 'clean ecommerce',
          avoid: 'watermark'
        }
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-vision-default', 'qiu-image-editing-default'],
      toolIds: [],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\fallback-sku.png']
    }
  }),
  rolePackage: {
    roleCode: 'cross-border-image-factory',
    applicationType: 'digital_factory',
    name: 'Cross Border Image Factory',
    version: '1.0.0',
    templateId: 'factory_cross_border_product_images_v1',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 8,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_batch',
          type: 'data',
          name: 'Prepare batch',
          inputVariables: ['start.files', 'factory_request'],
          outputVariables: ['factory_items', 'selected_packages', 'target_platform'],
          config: {
            dataMode: 'code',
            outputVariable: 'factory_items',
            code:
              'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
              'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
              'const packages = Array.isArray(request.packages) ? request.packages : [];\n' +
              'return {\n' +
              '  factory_items: files.map((file, index) => ({ sku: `SKU-${index + 1}`, image: file, sourceName: file.name })),\n' +
              '  selected_packages: packages,\n' +
              '  target_platform: request.platform\n' +
              '};'
          }
        },
        {
          id: 'generate_package_prompts',
          type: 'llm',
          name: 'Understand image and generate prompts',
          modelProfileId: 'qiu-vision-default',
          inputVariables: ['factory_items', 'selected_packages', 'target_platform'],
          outputVariables: ['package_instructions'],
          config: {
            llmTaskType: 'vision',
            outputMode: 'json'
          }
        },
        {
          id: 'generate_images',
          type: 'llm',
          name: 'Generate images',
          modelProfileId: 'qiu-image-editing-default',
          inputVariables: ['factory_items', 'selected_packages', 'target_platform', 'package_instructions'],
          outputVariables: ['factory_generated_images'],
          config: {
            llmTaskType: 'image_editing',
            concurrency: 1,
            maxRetries: 0,
            timeoutMs: 20_000
          }
        },
        {
          id: 'quality_check',
          type: 'llm',
          name: 'Optional quality check',
          modelProfileId: 'qiu-vision-default',
          inputVariables: ['factory_generated_images'],
          outputVariables: ['quality_report'],
          config: {
            llmTaskType: 'vision',
            optionalModel: true,
            outputMode: 'json'
          }
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_batch' },
        { id: 'prepare-prompts', sourceNodeId: 'prepare_batch', targetNodeId: 'generate_package_prompts' },
        { id: 'prompts-generate', sourceNodeId: 'generate_package_prompts', targetNodeId: 'generate_images' },
        { id: 'generate-quality', sourceNodeId: 'generate_images', targetNodeId: 'quality_check' }
      ]
    },
    modelProfileIds: ['qiu-vision-default', 'qiu-image-editing-default'],
    toolIds: [],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_image_batch'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-vision-default',
      providerId: 'aliyun-bailian',
      providerName: 'Aliyun Bailian',
      modelName: 'qwen3-asr-flash',
      purpose: 'vision',
      capabilities: ['image_understanding', 'vision_text'],
      apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'aliyun-key'
    },
    {
      id: 'qiu-image-editing-default',
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation', 'image_to_image', 'image_editing'],
      apiBaseUrl: 'https://image.example/v1',
      apiKey: 'image-api-key'
    }
  ]),
  tools,
  enabledModelProfileIds: ['qiu-vision-default', 'qiu-image-editing-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    fallbackFactoryImageCalls += 1;
    assert.equal(request.profile.id, 'qiu-image-editing-default');
    assert.equal(request.taskKind, 'image_generation');
    assert.match(request.imageGeneration?.prompt ?? '', /Image style: clean ecommerce/);
    assert.match(request.imageGeneration?.prompt ?? '', /Text language: English/);
    assert.equal(request.imageGeneration?.negativePrompt, 'watermark');
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        remoteUrl: 'https://cdn.example.test/factory/fallback-image.png',
        thumbnailPath: 'https://cdn.example.test/factory/fallback-thumb.png'
      }),
      artifacts: [
        {
          type: 'image',
          remoteUrl: 'https://cdn.example.test/factory/fallback-image.png',
          thumbnailPath: 'https://cdn.example.test/factory/fallback-thumb.png'
        }
      ]
    };
  },
  completedAt: '2026-07-20T10:00:14.250Z'
});
const fallbackFactoryPreviewArtifact = fallbackFactoryTask.task.artifacts.find((artifact) => artifact.factoryPreview);
assert.equal(fallbackFactoryTask.task.state, 'completed');
assert.equal(fallbackFactoryImageCalls, 1);
assert.equal(fallbackFactoryPreviewArtifact?.factoryPreview?.completed, 1);
assert.ok(
  fallbackFactoryTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_OPTIONAL_VISION_SKIPPED'
  )
);
assert.ok(
  fallbackFactoryTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_OPTIONAL_VISION_SKIPPED' && /未开启/.test(log.message)
  )
);

let enabledVisionCalls = 0;
let enabledVisionImageCalls = 0;
const enabledVisionFactoryTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-factory-image-enabled-vision-001',
    roleCode: 'cross-border-image-factory',
    roleName: 'Cross Border Image Factory',
    title: 'Generate product images with vision prompt enhancement',
    input: JSON.stringify({
      factory_request: {
        enableImageUnderstanding: true,
        platform: { key: 'amazon', label: 'Amazon', imageRatio: '1:1' },
        packages: [
          { key: 'main_image', label: 'Main image', description: 'Marketplace main product image.' }
        ],
        promptControls: {
          language: 'English',
          style: 'clean ecommerce'
        }
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-vision-default', 'qiu-image-editing-default'],
      toolIds: [],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\vision-sku.png']
    }
  }),
  rolePackage: {
    roleCode: 'cross-border-image-factory',
    applicationType: 'digital_factory',
    name: 'Cross Border Image Factory',
    version: '1.0.0',
    templateId: 'factory_cross_border_product_images_v1',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 8,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_batch',
          type: 'data',
          name: 'Prepare batch',
          inputVariables: ['start.files', 'factory_request'],
          outputVariables: ['factory_items', 'selected_packages', 'target_platform'],
          config: {
            dataMode: 'code',
            outputVariable: 'factory_items',
            code:
              'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
              'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
              'const packages = Array.isArray(request.packages) ? request.packages : [];\n' +
              'return {\n' +
              '  factory_request: request,\n' +
              '  factory_items: files.map((file, index) => ({ sku: `SKU-${index + 1}`, image: file, sourceName: file.name })),\n' +
              '  selected_packages: packages,\n' +
              '  target_platform: request.platform\n' +
              '};'
          }
        },
        {
          id: 'generate_package_prompts',
          type: 'llm',
          name: 'Understand image and generate prompts',
          modelProfileId: 'qiu-vision-default',
          inputVariables: ['factory_request', 'factory_items', 'selected_packages', 'target_platform'],
          outputVariables: ['package_instructions'],
          config: {
            llmTaskType: 'vision',
            optionalModel: true,
            outputMode: 'json'
          }
        },
        {
          id: 'generate_images',
          type: 'llm',
          name: 'Generate images',
          modelProfileId: 'qiu-image-editing-default',
          inputVariables: ['factory_items', 'selected_packages', 'target_platform', 'package_instructions'],
          outputVariables: ['factory_generated_images'],
          config: {
            llmTaskType: 'image_editing',
            concurrency: 1,
            maxRetries: 0,
            timeoutMs: 20_000
          }
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_batch' },
        { id: 'prepare-prompts', sourceNodeId: 'prepare_batch', targetNodeId: 'generate_package_prompts' },
        { id: 'prompts-generate', sourceNodeId: 'generate_package_prompts', targetNodeId: 'generate_images' }
      ]
    },
    modelProfileIds: ['qiu-image-editing-default'],
    toolIds: [],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_image_batch'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-vision-default',
      providerId: 'aliyun-bailian',
      providerName: 'Aliyun Bailian',
      modelName: 'qwen-vl-max',
      purpose: 'vision',
      capabilities: ['image_understanding', 'vision_text'],
      apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey: 'aliyun-key'
    },
    {
      id: 'qiu-image-editing-default',
      providerId: 'openai-compatible',
      providerName: 'OpenAI Compatible',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation', 'image_to_image', 'image_editing'],
      apiBaseUrl: 'https://image.example/v1',
      apiKey: 'image-api-key'
    }
  ]),
  tools,
  enabledModelProfileIds: ['qiu-vision-default', 'qiu-image-editing-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    if (request.profile.id === 'qiu-vision-default') {
      enabledVisionCalls += 1;
      assert.equal(request.visionInputs?.length, 1);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: JSON.stringify({
          items: [
            {
              sku: 'SKU-1',
              productName: 'Cup',
              packages: [
                {
                  key: 'main_image',
                  prompt: 'Vision enhanced prompt for a premium ecommerce cup main image.',
                  negativePrompt: 'watermark'
                }
              ]
            }
          ]
        })
      };
    }

    enabledVisionImageCalls += 1;
    assert.equal(request.profile.id, 'qiu-image-editing-default');
    assert.match(request.imageGeneration?.prompt ?? '', /Vision enhanced prompt/);
    assert.equal(request.imageGeneration?.negativePrompt, 'watermark');
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        remoteUrl: 'https://cdn.example.test/factory/vision-image.png',
        thumbnailPath: 'https://cdn.example.test/factory/vision-thumb.png'
      }),
      artifacts: [
        {
          type: 'image',
          remoteUrl: 'https://cdn.example.test/factory/vision-image.png',
          thumbnailPath: 'https://cdn.example.test/factory/vision-thumb.png'
        }
      ]
    };
  },
  completedAt: '2026-07-20T10:00:14.500Z'
});
assert.equal(enabledVisionFactoryTask.task.state, 'completed');
assert.equal(enabledVisionCalls, 1);
assert.equal(enabledVisionImageCalls, 1);
assert.equal(
  enabledVisionFactoryTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_OPTIONAL_VISION_SKIPPED'
  ),
  false
);

let legacyImageFactoryModelUsed = false;
const legacyImageFactoryTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-legacy-image-factory-model-slot-001',
    roleCode: 'legacy-cross-border-image-factory',
    roleName: 'Legacy Cross Border Image Factory',
    title: 'Generate product image with legacy package',
    input: JSON.stringify({
      factory_request: {
        platform: { key: 'amazon', label: 'Amazon', imageRatio: '1:1' },
        packages: [
          { key: 'character_illustration', label: '角色立绘', description: 'Anime character illustration.' }
        ]
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['openai-gpt-image-2'],
      toolIds: [],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\legacy-sku.png']
    }
  }),
  rolePackage: {
    roleCode: 'legacy-cross-border-image-factory',
    applicationType: 'digital_factory',
    name: 'Legacy Cross Border Image Factory',
    version: '1.0.0',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_batch',
          type: 'data',
          name: 'Prepare batch',
          inputVariables: ['start.files', 'factory_request'],
          outputVariables: ['factory_items', 'selected_packages', 'target_platform', 'package_instructions'],
          config: {
            dataMode: 'code',
            outputVariable: 'factory_items',
            code:
              'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
              'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
              'const packages = Array.isArray(request.packages) ? request.packages : [];\n' +
              'return {\n' +
              '  factory_items: files.map((file, index) => ({ sku: `SKU-${index + 1}`, image: file, sourceName: file.name })),\n' +
              '  selected_packages: packages,\n' +
              '  target_platform: request.platform,\n' +
              '  package_instructions: { items: files.map((file, index) => ({ sku: `SKU-${index + 1}`, packages: packages.map((item) => ({ key: item.key, prompt: `Generate ${item.label} for SKU-${index + 1}` })) })) }\n' +
              '};'
          }
        },
        {
          id: 'generate_images',
          type: 'llm',
          name: 'Generate images',
          modelProfileId: 'openai-gpt-image-2',
          inputVariables: ['factory_items', 'package_instructions'],
          outputVariables: ['factory_generated_images'],
          config: {
            llmTaskType: 'image_generation',
            concurrency: 1,
            maxRetries: 0,
            timeoutMs: 20_000
          }
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_batch' },
        { id: 'prepare-generate', sourceNodeId: 'prepare_batch', targetNodeId: 'generate_images' }
      ]
    },
    dependencyManifest: {
      version: '1.0.0',
      generatedAt: '2026-07-29T00:00:00.000Z',
      variables: [],
      modelAssets: [
        {
          key: 'openai-gpt-image-2',
          name: 'OpenAI GPT Image 2',
          providerId: 'openai',
          providerName: 'OpenAI',
          modelId: 'gpt-image-2',
          modelProfileId: 'openai-gpt-image-2',
          capabilities: ['image_generation', 'image_editing'],
          inputTypes: ['text', 'image'],
          outputTypes: ['image'],
          credentialFields: ['apiKey', 'apiBaseUrl'],
          required: true,
          nodeIds: ['generate_images']
        }
      ],
      toolActions: [],
      artifactTemplates: [],
      nodeTemplates: [],
      warnings: []
    },
    modelProfileIds: ['openai-gpt-image-2'],
    toolIds: [],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_image_batch'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-image-editing-default',
      providerId: 'provider-pending',
      providerName: 'Pending Model Provider',
      modelName: 'image-editing-default',
      purpose: 'vision',
      capabilities: ['image_editing', 'image_to_image']
    },
    {
      id: 'grsai-gpt-image-2',
      providerId: 'custom-grsai',
      providerName: 'GrsAI',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation', 'image_to_image', 'image_editing'],
      apiBaseUrl: 'https://grsai.example/v1',
      apiKey: 'grsai-key'
    }
  ]),
  tools,
  enabledModelProfileIds: ['qiu-image-editing-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  roleModelCredentialBindings: [
    {
      roleCode: 'legacy-cross-border-image-factory',
      modelProfileId: 'qiu-image-editing-default',
      runtimeModelProfileId: 'grsai-gpt-image-2',
      mode: 'provider_default',
      updatedAt: '2026-07-27T00:00:00.000Z'
    }
  ],
  modelInvoker: async (request) => {
    legacyImageFactoryModelUsed = true;
    assert.equal(request.profile.id, 'grsai-gpt-image-2');
    assert.equal(request.profile.apiBaseUrl, 'https://grsai.example/v1');
    assert.equal(request.taskKind, 'image_generation');
    assert.match(request.imageGeneration?.sourceImagePath ?? '', /legacy-sku\.png/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        remoteUrl: 'https://cdn.example.test/factory/legacy-image.png',
        thumbnailPath: 'https://cdn.example.test/factory/legacy-thumb.png'
      }),
      artifacts: [
        {
          type: 'image',
          remoteUrl: 'https://cdn.example.test/factory/legacy-image.png',
          thumbnailPath: 'https://cdn.example.test/factory/legacy-thumb.png'
        }
      ]
    };
  },
  completedAt: '2026-07-20T10:00:14.500Z'
});
const legacyImageFactoryPreviewArtifact = legacyImageFactoryTask.task.artifacts.find(
  (artifact) => artifact.factoryPreview
);
assert.equal(legacyImageFactoryTask.task.state, 'completed');
assert.equal(legacyImageFactoryModelUsed, true);
assert.equal(legacyImageFactoryPreviewArtifact?.factoryPreview?.completed, 1);
assert.equal(
  legacyImageFactoryTask.task.executionLogs.some((log) => log.eventType === 'MODEL_API_CONFIG_MISSING'),
  false
);

let imageFactoryOutputImageCalls = 0;
let imageFactoryOutputUnexpectedModelCalls = 0;
const imageFactoryOutputTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-image-factory-output-no-model-001',
    roleCode: 'anime-image-factory',
    roleName: 'AI动漫图片工厂',
    title: 'Return generated anime image without extra model call',
    input: JSON.stringify({
      factory_request: {
        factoryKind: 'anime_image_factory',
        factoryName: 'AI动漫图片工厂',
        qualityCheckMode: 'basic',
        platform: { key: 'amazon', label: 'Amazon', imageRatio: '1:1' },
        packages: [
          { key: 'main_image', label: 'Main image', description: 'Marketplace main product image.' }
        ]
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default', 'qiu-image-editing-default'],
      toolIds: [],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\output-cup.png']
    }
  }),
  rolePackage: {
    roleCode: 'anime-image-factory',
    applicationType: 'digital_factory',
    name: 'AI动漫图片工厂',
    version: '1.0.0',
    templateId: 'factory_anime_images_v1',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 8,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'prepare_batch',
          type: 'data',
          name: 'Prepare batch',
          inputVariables: ['start.files', 'factory_request'],
          outputVariables: ['factory_request', 'factory_items', 'selected_packages', 'target_platform', 'quality_check_mode'],
          config: {
            dataMode: 'code',
            outputVariable: 'factory_items',
            code:
              'const files = Array.isArray(input["start.files"]) ? input["start.files"] : [];\n' +
              'const request = input.factory_request && typeof input.factory_request === "object" ? input.factory_request : {};\n' +
              'return {\n' +
              '  factory_request: request,\n' +
              '  factory_items: files.map((file, index) => ({ sku: `SKU-${index + 1}`, image: file, sourceName: file.name })),\n' +
              '  selected_packages: Array.isArray(request.packages) ? request.packages : [],\n' +
              '  target_platform: request.platform,\n' +
              '  quality_check_mode: request.qualityCheckMode\n' +
              '};'
          }
        },
        {
          id: 'generate_images',
          type: 'llm',
          name: 'Generate images',
          modelProfileId: 'qiu-image-editing-default',
          inputVariables: ['factory_items', 'selected_packages', 'target_platform'],
          outputVariables: ['factory_generated_images'],
          config: {
            llmTaskType: 'image_editing',
            concurrency: 1,
            maxRetries: 0
          }
        },
        {
          id: 'quality_check',
          type: 'llm',
          name: 'Optional quality check',
          modelProfileId: 'qiu-vision-default',
          inputVariables: ['factory_generated_images', 'quality_check_mode'],
          outputVariables: ['quality_report'],
          config: {
            llmTaskType: 'vision',
            optionalModel: true,
            outputMode: 'json'
          }
        },
        {
          id: 'factory_output',
          type: 'output',
          name: 'Return result',
          inputVariables: ['factory_generated_images', 'quality_report'],
          outputVariables: ['final_answer']
        }
      ],
      edges: [
        { id: 'start-prepare', sourceNodeId: 'start', targetNodeId: 'prepare_batch' },
        { id: 'prepare-generate', sourceNodeId: 'prepare_batch', targetNodeId: 'generate_images' },
        { id: 'generate-quality', sourceNodeId: 'generate_images', targetNodeId: 'quality_check' },
        { id: 'quality-output', sourceNodeId: 'quality_check', targetNodeId: 'factory_output' }
      ]
    },
    modelProfileIds: ['qiu-general-default', 'qiu-image-editing-default'],
    toolIds: [],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_image_batch'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-image-editing-default',
      providerId: 'openai-compatible',
      providerName: 'Image Provider',
      modelName: 'gpt-image-2',
      purpose: 'vision',
      capabilities: ['image_generation', 'image_to_image', 'image_editing'],
      apiBaseUrl: 'https://image.example/v1',
      apiKey: 'image-api-key'
    }
  ]),
  tools,
  enabledModelProfileIds: ['qiu-general-default', 'qiu-image-editing-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    if (request.taskKind === 'image_generation') {
      imageFactoryOutputImageCalls += 1;
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: JSON.stringify({
          remoteUrl: 'https://cdn.example.test/factory/output-cup.png'
        }),
        artifacts: [
          {
            type: 'image',
            remoteUrl: 'https://cdn.example.test/factory/output-cup.png'
          }
        ]
      };
    }

    imageFactoryOutputUnexpectedModelCalls += 1;
    throw new Error('Model API returned HTTP 402: Insufficient Balance');
  },
  completedAt: '2026-08-06T10:56:56.000Z'
});
const imageFactoryOutputPreview = imageFactoryOutputTask.task.artifacts.find((artifact) => artifact.factoryPreview);
assert.equal(imageFactoryOutputTask.task.state, 'completed');
assert.equal(imageFactoryOutputImageCalls, 1);
assert.equal(imageFactoryOutputUnexpectedModelCalls, 0);
assert.equal(imageFactoryOutputPreview?.factoryPreview?.completed, 1);
assert.ok(
  imageFactoryOutputTask.task.executionLogs.some(
    (log) => log.eventType === 'WORKFLOW_RUNTIME_FACTORY_OUTPUT_COMPLETED'
  )
);

const videoFactoryModelProfiles: ModelProfile[] = [
  {
    id: 'qiu-asr-default',
    providerId: 'tencent-asr-compatible',
    providerName: 'Tencent Cloud',
    modelName: '16k_zh_dialect',
    purpose: 'audio',
    capabilities: ['audio_to_text'],
    apiBaseUrl: 'https://asr.example/v1',
    apiKey: 'test-asr-key'
  },
  ...modelProfiles
];
let videoFactoryAsrCalls = 0;
let videoFactoryScoringCalls = 0;
let videoFactoryOutputCalls = 0;
const videoFactoryToolRequests: Array<{ toolId: string; action: string }> = [];
const videoFactoryTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-factory-video-screening-001',
    roleCode: 'case-video-factory',
    roleName: 'Case Video Factory',
    title: 'Screen medical case videos',
    input: JSON.stringify({
      factory_request: {
        factoryKind: 'medical_case_video_screening_factory',
        asr: {
          modelProfileId: 'qiu-asr-default',
          language: 'zh',
          dialect: 'sichuan_chongqing'
        },
        editEnabled: true,
        editTargetSeconds: 30
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-asr-default', 'qiu-general-default'],
      toolIds: ['video-processing', 'office-document', 'local-filesystem'],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\case-video-1.mp4']
    }
  }),
  rolePackage: {
    roleCode: 'case-video-factory',
    applicationType: 'digital_factory',
    name: 'Case Video Factory',
    version: '1.0.0',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 8,
        maxLoopIterations: 4,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'screen_score_and_edit',
          type: 'llm',
          name: 'Screen score and edit',
          modelProfileId: 'qiu-general-default',
          inputVariables: ['factory_request', 'start.files'],
          outputVariables: ['video_screening_results', 'screening_summary'],
          config: {
            llmTaskType: 'video_screening_batch',
            outputMode: 'json',
            concurrency: 2
          }
        },
        {
          id: 'factory_output',
          type: 'output',
          name: 'Return result',
          inputVariables: [
            'qualified_video_paths',
            'edited_video_folder',
            'video_screening_results',
            'screening_summary'
          ],
          outputVariables: ['final_answer']
        }
      ],
      edges: [
        { id: 'start-screen', sourceNodeId: 'start', targetNodeId: 'screen_score_and_edit' },
        { id: 'screen-output', sourceNodeId: 'screen_score_and_edit', targetNodeId: 'factory_output' }
      ]
    },
    modelProfileIds: ['qiu-asr-default', 'qiu-general-default'],
    toolIds: ['video-processing', 'office-document', 'local-filesystem'],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_video_screening'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: videoFactoryModelProfiles,
  tools,
  workspaceId: 'workspace-video-factory',
  enabledModelProfileIds: ['qiu-general-default', 'qiu-asr-default'],
  enabledToolIds: ['video-processing', 'office-document', 'local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    if (request.taskKind === 'audio_transcription') {
      videoFactoryAsrCalls += 1;
      assert.equal(request.profile.id, 'qiu-asr-default');
      assert.equal(request.audioTranscription?.audioPath, 'C:\\QiuAI\\workspace\\asr-audio\\case-video-1-audio.mp3');
      assert.equal(request.audioTranscription?.dialect, 'sichuan_chongqing');
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content:
          '使用前我经常咳嗽不舒服，说话也没有精神。后来按要求使用产品一段时间后，咳嗽明显缓解，晚上睡觉更踏实，整个人状态改善很多。我能清楚说明使用前的问题、使用过程和使用后的变化。'
      };
    }

    assert.equal(request.profile.id, 'qiu-general-default');
    const prompt = request.messages.map((message) => message.content).join('\n');
    if (!/scoringRules|案例视频素材质检员/.test(prompt)) {
      videoFactoryOutputCalls += 1;
      assert.match(prompt, /qualified_video_paths|screening_summary|Return result/);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content: 'Video screening completed. Qualified list, report and optional edited clips are ready.'
      };
    }
    videoFactoryScoringCalls += 1;
    assert.match(prompt, /案例视频素材质检员/);
    assert.match(prompt, /beforeAfterCompleteness/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({
        score: 82,
        beforeAfterCompleteness: 0.2,
        summary: '表达整体清楚，但使用前后改善表述偏简略，仍可进入评分和人工确认。',
        risks: [],
        editPlan: [
          { start: 0, end: 8, label: '使用前症状', reason: '开头交代问题' },
          { start: 22, end: 34, label: '使用过程', reason: '说明使用过程' },
          { start: 48, end: 60, label: '使用后变化', reason: '保留改善表述' }
        ]
      })
    };
  },
  desktopToolInvoker: async (request) => {
    videoFactoryToolRequests.push({ toolId: request.toolId, action: request.action });

    if (request.action === 'video.probe') {
      assert.equal(request.toolId, 'video-processing');
      assert.equal(request.input.videoPath, 'C:\\QiuAI\\factory\\case-video-1.mp4');
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          probeAvailable: true,
          width: 1920,
          height: 1080,
          durationSeconds: 60,
          hasVideo: true,
          hasAudio: true,
          audioStreamCount: 1
        }
      };
    }

    if (request.action === 'video.extract_audio') {
      assert.equal(request.toolId, 'video-processing');
      assert.equal(request.input.videoPath, 'C:\\QiuAI\\factory\\case-video-1.mp4');
      assert.equal(request.input.audioFormat, 'mp3');
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\asr-audio\\case-video-1-audio.mp3'
        }
      };
    }

    if (request.action === 'spreadsheet.write_xlsx') {
      assert.equal(request.toolId, 'office-document');
      const sheets = request.input.sheets as Array<{ rows: string[][] }>;
      assert.match(sheets[0]?.rows[1]?.[1] ?? '', /case-video-1/);
      assert.equal(sheets[0]?.rows[1]?.[2], '已剪辑');
      assert.equal(sheets[0]?.rows[1]?.[5], '88');
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\video-screening.xlsx'
        }
      };
    }

    if (request.action === 'filesystem.write_text_file') {
      assert.equal(request.toolId, 'local-filesystem');
      assert.equal(request.input.folder, 'qualified-videos');
      assert.match(String(request.input.fileName ?? ''), /合格视频地址清单/);
      assert.match(String(request.input.content ?? ''), /合格视频地址清单/);
      assert.match(String(request.input.content ?? ''), /C:\\QiuAI\\factory\\case-video-1\.mp4/);
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\qualified-videos\\qualified-list.md'
        }
      };
    }

    assert.equal(request.action, 'video.compose_clips');
    assert.equal(request.toolId, 'video-processing');
    assert.equal(request.input.videoPath, 'C:\\QiuAI\\factory\\case-video-1.mp4');
    assert.ok(Array.isArray(request.input.cutPlan));
    assert.match(String(request.input.folder ?? ''), /^video-cuts-/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\video-cuts\\case-video-1-cut.mp4'
      }
    };
  },
  completedAt: '2026-07-20T10:00:14.500Z'
});

assert.equal(
  videoFactoryTask.task.state,
  'completed',
  JSON.stringify(videoFactoryTask.task.executionLogs.slice(-6), null, 2)
);
assert.equal(videoFactoryAsrCalls, 1);
assert.equal(videoFactoryScoringCalls, 0);
assert.equal(videoFactoryOutputCalls, 0);
assert.equal(videoFactoryTask.task.artifactCount, 3);
assert.equal(videoFactoryTask.task.factoryOutputs?.length, 1);
assert.equal(videoFactoryTask.task.factoryOutputs?.[0]?.status, 'qualified');
assert.equal(videoFactoryTask.task.factoryOutputs?.[0]?.sourcePath, 'C:\\QiuAI\\factory\\case-video-1.mp4');
assert.equal(videoFactoryTask.task.factoryOutputs?.[0]?.outputPath, 'C:\\QiuAI\\workspace\\video-cuts\\case-video-1-cut.mp4');
assert.equal(videoFactoryTask.task.factoryOutputs?.[0]?.score, 88);
assert.deepEqual(videoFactoryToolRequests, [
  { toolId: 'video-processing', action: 'video.probe' },
  { toolId: 'video-processing', action: 'video.extract_audio' },
  { toolId: 'video-processing', action: 'video.compose_clips' },
  { toolId: 'local-filesystem', action: 'filesystem.write_text_file' },
  { toolId: 'office-document', action: 'spreadsheet.write_xlsx' }
]);
assert.ok(
  videoFactoryTask.task.artifacts.some((artifact) => artifact.localPath?.endsWith('qualified-list.md'))
);
assert.ok(
  videoFactoryTask.task.artifacts.some((artifact) => artifact.localPath?.endsWith('video-screening.xlsx'))
);
assert.ok(
  videoFactoryTask.task.artifacts.some((artifact) => artifact.localPath?.endsWith('case-video-1-cut.mp4'))
);
assert.ok(
  videoFactoryTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_VIDEO_FACTORY_COMPLETED')
);

const boundAliyunAsrProfile: ModelProfile = {
  id: 'aliyun-qwen3-asr-flash-filetrans',
  providerId: 'aliyun-bailian',
  providerName: '阿里云百炼',
  modelName: 'qwen3-asr-flash',
  purpose: 'audio',
  capabilities: ['audio_to_text'],
  apiBaseUrl: 'https://dashscope.aliyuncs.com/api/v1',
  apiKey: 'aliyun-asr-key'
};
const boundAsrRolePackage: RolePackageManifest = {
  roleCode: 'case-video-factory-bound-asr',
  applicationType: 'digital_factory',
  name: 'Case Video Factory Bound ASR',
  version: '1.0.0',
  workflowGraph: {
    version: '1.0.0',
    entryNodeId: 'start',
    nodes: [
      { id: 'start', type: 'start', name: 'Start' },
      {
        id: 'screen_score_and_edit',
        type: 'llm',
        name: 'Screen score and edit',
        modelProfileId: 'qiu-general-default',
        inputVariables: ['factory_request', 'start.files'],
        outputVariables: ['video_screening_results', 'screening_summary'],
        config: {
          llmTaskType: 'video_screening_batch',
          outputMode: 'json',
          concurrency: 1,
          requiredModelProfileIds: ['qiu-asr-default']
        }
      },
      {
        id: 'factory_output',
        type: 'output',
        name: 'Return result',
        inputVariables: ['video_screening_results', 'screening_summary'],
        outputVariables: ['final_answer']
      }
    ],
    edges: [
      { id: 'start-screen', sourceNodeId: 'start', targetNodeId: 'screen_score_and_edit' },
      { id: 'screen-output', sourceNodeId: 'screen_score_and_edit', targetNodeId: 'factory_output' }
    ]
  },
  dependencyManifest: {
    version: '1.0.0',
    generatedAt: '2026-07-29T00:00:00.000Z',
    variables: [],
    modelAssets: [
      {
        key: 'qiu-asr-default',
        name: 'Legacy ASR Slot',
        providerId: 'provider-pending',
        providerName: 'Pending',
        modelId: 'qiu-asr-default',
        modelProfileId: 'qiu-asr-default',
        capabilities: ['text'],
        inputTypes: ['text'],
        outputTypes: ['text'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['screen_score_and_edit']
      },
      {
        key: 'qiu-general-default',
        name: 'Text Slot',
        providerId: 'provider-pending',
        providerName: 'Pending',
        modelId: 'qiu-general-default',
        modelProfileId: 'qiu-general-default',
        capabilities: ['text'],
        inputTypes: ['text'],
        outputTypes: ['text', 'json'],
        credentialFields: ['apiKey', 'apiBaseUrl'],
        required: true,
        nodeIds: ['screen_score_and_edit']
      }
    ],
    toolActions: [],
    artifactTemplates: [],
    nodeTemplates: [],
    warnings: []
  },
  modelProfileIds: ['qiu-general-default', 'qiu-asr-default'],
  toolIds: ['video-processing', 'office-document', 'local-filesystem'],
  requiredKnowledgeSources: [],
  defaultTaskTypes: ['factory_video_screening'],
  syncPolicy: 'summary_only'
};
const boundAsrBinding: RoleModelCredentialBinding = {
  roleCode: boundAsrRolePackage.roleCode,
  modelProfileId: 'qiu-asr-default',
  runtimeModelProfileId: boundAliyunAsrProfile.id,
  mode: 'provider_default',
  updatedAt: '2026-07-29T00:00:00.000Z'
};
let boundAsrCalls = 0;
const boundAsrTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-factory-video-bound-asr-001',
    roleCode: boundAsrRolePackage.roleCode,
    roleName: boundAsrRolePackage.name,
    title: 'Screen videos with bound ASR profile',
    input: JSON.stringify({
      factory_request: {
        factoryKind: 'medical_case_video_screening_factory',
        asr: {
          modelProfileId: 'qiu-asr-default',
          language: 'zh',
          dialect: 'auto'
        },
        editEnabled: false
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default', 'qiu-asr-default'],
      toolIds: ['video-processing', 'office-document', 'local-filesystem'],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\bound-asr-video.mp4']
    }
  }),
  rolePackage: boundAsrRolePackage,
  modelProfiles: [boundAliyunAsrProfile, ...modelProfiles],
  roleModelCredentialBindings: [boundAsrBinding],
  tools,
  workspaceId: 'workspace-video-factory',
  enabledModelProfileIds: ['qiu-general-default', boundAliyunAsrProfile.id],
  enabledToolIds: ['video-processing', 'office-document', 'local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    if (request.taskKind === 'audio_transcription') {
      boundAsrCalls += 1;
      assert.equal(request.profile.id, boundAliyunAsrProfile.id);
      return {
        provider: request.profile.providerName,
        modelName: request.profile.modelName,
        content:
          '使用前我的症状比较明显，晚上经常疼痛不舒服，睡眠也不好，说话时能清楚描述原来的问题。后来按照要求使用产品并坚持了一段时间，使用后现在疼痛缓解很多，睡眠改善明显，精神状态也好了。我能完整说明使用前的问题、使用过程和使用后的变化，内容表达比较连贯。'
      };
    }

    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Bound ASR video screening completed.'
    };
  },
  desktopToolInvoker: async (request) => {
    if (request.action === 'video.probe') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          width: 1920,
          height: 1080,
          durationSeconds: 45,
          hasVideo: true,
          hasAudio: true,
          audioStreamCount: 1
        }
      };
    }

    if (request.action === 'video.extract_audio') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\asr-audio\\bound-asr-video-audio.mp3'
        }
      };
    }

    if (request.action === 'filesystem.write_text_file') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\qualified-videos\\bound-asr-qualified-list.md'
        }
      };
    }

    assert.equal(request.action, 'spreadsheet.write_xlsx');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\bound-asr-video-screening.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:14.700Z'
});

assert.equal(boundAsrTask.task.state, 'completed');
assert.equal(boundAsrCalls, 1);
assert.equal(boundAsrTask.task.factoryOutputs?.[0]?.status, 'qualified');
assert.equal(
  boundAsrTask.task.executionLogs.some((log) => log.eventType === 'MODEL_API_CONFIG_MISSING'),
  false
);

let videoFactoryAsrFailureCalls = 0;
let videoFactoryFailureOutputCalls = 0;
const videoFactoryFailureRows: string[][][] = [];
const videoFactoryFailureTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-factory-video-asr-failure-001',
    roleCode: 'case-video-factory',
    roleName: 'Case Video Factory',
    title: 'Screen videos with ASR failure',
    input: JSON.stringify({
      factory_request: {
        factoryKind: 'medical_case_video_screening_factory',
        asr: {
          modelProfileId: 'qiu-asr-default',
          language: 'zh',
          dialect: 'auto',
          retryDelaysMs: [0, 0]
        },
        editEnabled: false
      }
    }),
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-asr-default', 'qiu-general-default'],
      toolIds: ['video-processing', 'office-document', 'local-filesystem'],
      knowledgeBindingIds: [],
      attachmentPaths: ['C:\\QiuAI\\factory\\asr-failure-video.mp4']
    }
  }),
  rolePackage: {
    roleCode: 'case-video-factory',
    applicationType: 'digital_factory',
    name: 'Case Video Factory',
    version: '1.0.0',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      runtimePolicy: {
        maxNodeExecutions: 6,
        maxLoopIterations: 2,
        requireApprovalBeforeTools: false
      },
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'screen_score_and_edit',
          type: 'llm',
          name: 'Screen score and edit',
          modelProfileId: 'qiu-general-default',
          inputVariables: ['factory_request', 'start.files'],
          outputVariables: ['video_screening_results', 'screening_summary'],
          config: {
            llmTaskType: 'video_screening_batch',
            outputMode: 'json',
            concurrency: 1
          }
        },
        {
          id: 'factory_output',
          type: 'output',
          name: 'Return result',
          inputVariables: ['video_screening_results', 'screening_summary'],
          outputVariables: ['final_answer']
        }
      ],
      edges: [
        { id: 'start-screen', sourceNodeId: 'start', targetNodeId: 'screen_score_and_edit' },
        { id: 'screen-output', sourceNodeId: 'screen_score_and_edit', targetNodeId: 'factory_output' }
      ]
    },
    modelProfileIds: ['qiu-asr-default', 'qiu-general-default'],
    toolIds: ['video-processing', 'office-document', 'local-filesystem'],
    requiredKnowledgeSources: [],
    defaultTaskTypes: ['factory_video_screening'],
    syncPolicy: 'summary_only'
  },
  modelProfiles: videoFactoryModelProfiles,
  tools,
  workspaceId: 'workspace-video-factory',
  enabledModelProfileIds: ['qiu-general-default', 'qiu-asr-default'],
  enabledToolIds: ['video-processing', 'office-document', 'local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    if (request.taskKind === 'audio_transcription') {
      videoFactoryAsrFailureCalls += 1;
      assert.equal(request.audioTranscription?.audioPath, 'C:\\QiuAI\\workspace\\asr-audio\\asr-failure-audio.mp3');
      throw new Error(
        "Error invoking remote method 'qiuai:desktop:invoke-model-chat': Error: Model API returned HTTP 400: <400> InternalError.Algo.InvalidParameter: The dedicated task `asr` corresponding to the current service does not support this input."
      );
    }

    videoFactoryFailureOutputCalls += 1;
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'ASR failed and the video was routed to manual review.'
    };
  },
  desktopToolInvoker: async (request) => {
    if (request.action === 'video.probe') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          width: 1920,
          height: 1080,
          durationSeconds: 45,
          hasVideo: true,
          hasAudio: true,
          audioStreamCount: 1
        }
      };
    }

    if (request.action === 'video.extract_audio') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\asr-audio\\asr-failure-audio.mp3'
        }
      };
    }

    if (request.action === 'filesystem.write_text_file') {
      return {
        toolId: request.toolId,
        action: request.action,
        ok: true,
        output: {
          localPath: 'C:\\QiuAI\\workspace\\qualified-videos\\asr-failure-qualified-list.md'
        }
      };
    }

    assert.equal(request.action, 'spreadsheet.write_xlsx');
    const sheets = request.input.sheets as Array<{ rows: string[][] }>;
    videoFactoryFailureRows.push(sheets[0]?.rows ?? []);
    assert.equal(sheets[0]?.rows[1]?.[2], '处理异常');
    assert.equal(sheets[0]?.rows[1]?.[3], '语音识别');
    assert.match(sheets[0]?.rows[1]?.[4] ?? '', /ASR 服务调用失败/);
    assert.doesNotMatch(sheets[0]?.rows[1]?.[4] ?? '', /Error invoking/);
    assert.match(sheets[0]?.rows[1]?.[9] ?? '', /当前 ASR 模型不支持这个输入格式/);
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\spreadsheets\\asr-failure-video-screening.xlsx'
      }
    };
  },
  completedAt: '2026-07-20T10:00:14.800Z'
});

assert.equal(videoFactoryFailureTask.task.state, 'completed');
assert.equal(videoFactoryAsrFailureCalls, 1);
assert.equal(videoFactoryFailureOutputCalls, 0);
assert.equal(videoFactoryFailureTask.task.artifactCount, 2);
assert.equal(videoFactoryFailureRows.length, 1);
assert.equal(videoFactoryFailureTask.task.factoryOutputs?.[0]?.status, 'processing_error');
assert.equal(
  videoFactoryFailureTask.task.factoryOutputs?.[0]?.reason,
  'ASR 服务调用失败，已标记为处理异常，建议检查配置后重试'
);

const unconfiguredKnowledge = await runDesktopTask({
  task,
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: ['kb-local-folder'],
  modelInvoker: async (request) => ({
    provider: request.profile.providerName,
    modelName: request.profile.modelName,
    content: 'Generated without configured local knowledge source.'
  }),
  completedAt: '2026-07-20T10:00:15.000Z'
});

assert.equal(unconfiguredKnowledge.task.state, 'completed');
assert.ok(
  unconfiguredKnowledge.task.executionLogs.some((log) => log.eventType === 'KNOWLEDGE_SOURCE_UNCONFIGURED')
);

let disabledKnowledgeReadCalls = 0;
const disabledKnowledgeTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-knowledge-disabled-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Skip knowledge by task option',
    input: 'Create a short follow-up summary.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: ['office-document'],
      knowledgeBindingIds: ['local_file'],
      useKnowledge: false
    }
  }),
  rolePackage: {
    ...workflowRolePackage,
    toolIds: ['office-document'],
    requiredKnowledgeSources: ['local_file'],
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'gather_context',
          type: 'knowledge',
          name: 'Gather optional knowledge',
          outputVariables: ['knowledge_context']
        },
        {
          id: 'summarize',
          type: 'llm',
          name: 'Summarize',
          inputVariables: ['knowledge_context']
        }
      ],
      edges: [
        { id: 'start-knowledge', sourceNodeId: 'start', targetNodeId: 'gather_context' },
        { id: 'knowledge-summary', sourceNodeId: 'gather_context', targetNodeId: 'summarize' }
      ]
    }
  },
  workspaceId: 'workspace-knowledge-disabled',
  modelProfiles,
  tools,
  knowledgeSources: [
    {
      id: 'local_file',
      source: 'local_file',
      label: 'Policy File',
      enabled: true,
      createdAt: '2026-07-20T10:00:00.000Z',
      localPath: 'C:\\QiuAI\\Knowledge\\policy.md',
      summary: 'Customer policy source.'
    }
  ],
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['office-document'],
  enabledKnowledgeBindingIds: ['local_file'],
  modelInvoker: async (request) => {
    const prompt = request.messages.map((message) => message.content).join('\n');
    assert.doesNotMatch(prompt, /Customer policy snippet/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: 'Summary without knowledge.'
    };
  },
  desktopToolInvoker: async (request) => {
    disabledKnowledgeReadCalls += 1;
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        text: 'Customer policy snippet should not be read.'
      }
    };
  },
  completedAt: '2026-07-20T10:00:15.500Z'
});

assert.equal(disabledKnowledgeTask.task.state, 'completed');
assert.equal(disabledKnowledgeReadCalls, 0);
assert.ok(
  disabledKnowledgeTask.task.executionLogs.some((log) => log.eventType === 'WORKFLOW_RUNTIME_KNOWLEDGE_SKIPPED')
);
assert.ok(
  disabledKnowledgeTask.task.executionLogs.every(
    (log) =>
      log.eventType !== 'KNOWLEDGE_BINDING_MISSING' &&
      log.eventType !== 'KNOWLEDGE_SOURCE_UNCONFIGURED'
  )
);

let explicitKnowledgeModelCalled = false;
const explicitKnowledgeUnavailableTask = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-knowledge-unavailable-001',
    roleCode: 'ai-ops',
    roleName: 'AI Ops',
    title: 'Require configured knowledge',
    input: 'Use enterprise policy to prepare a reply.',
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-general-default'],
      toolIds: [],
      knowledgeBindingIds: ['kb-enterprise'],
      useKnowledge: true
    }
  }),
  modelProfiles,
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: [],
  enabledKnowledgeBindingIds: ['kb-enterprise'],
  modelInvoker: async () => {
    explicitKnowledgeModelCalled = true;
    throw new Error('model should not run when enabled knowledge is unavailable');
  },
  completedAt: '2026-07-20T10:00:15.750Z'
});

assert.equal(explicitKnowledgeUnavailableTask.task.state, 'failed');
assert.equal(explicitKnowledgeModelCalled, false);
assert.match(
  explicitKnowledgeUnavailableTask.task.executionLogs.at(-1)?.message ?? '',
  /本次任务已启用知识库/
);

const unconfigured = await runDesktopTask({
  task,
  modelProfiles: modelProfiles.map((profile) => ({
    ...profile,
    apiBaseUrl: undefined,
    apiKey: undefined
  })),
  tools,
  enabledModelProfileIds: ['qiu-general-default'],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: ['kb-local-folder'],
  modelInvoker: async () => {
    throw new Error('should not invoke unconfigured model');
  },
  completedAt: '2026-07-20T10:00:30.000Z'
});

assert.equal(unconfigured.task.state, 'failed');
assert.ok(unconfigured.task.executionLogs.some((log) => log.eventType === 'MODEL_API_CONFIG_MISSING'));
assert.ok(unconfigured.task.executionLogs.some((log) => log.eventType === 'LOCAL_RUN_FAILED'));

const failed = await runDesktopTask({
  task,
  modelProfiles,
  tools,
  enabledModelProfileIds: [],
  enabledToolIds: ['web-search'],
  enabledKnowledgeBindingIds: ['kb-local-folder'],
  modelInvoker: async () => {
    throw new Error('should not invoke disabled model');
  },
  completedAt: '2026-07-20T10:01:00.000Z'
});

assert.equal(failed.task.state, 'failed');
assert.equal(failed.task.artifacts.length, 0);
assert.equal(failed.task.currentRun?.status, 'failed');
assert.ok(failed.task.executionLogs.some((log) => log.eventType === 'LOCAL_RUN_FAILED'));

let singleImageModelCalled = false;
let singleImageDownloadCalled = false;
const singleImageResult = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-single-image-001',
    roleCode: 'ai-image-generation-assistant',
    roleName: 'AI 生图助手',
    title: '生成单张图片',
    input: '参考图片生成一张 16:9 的科技产品宣传封面，不要文字。',
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      attachmentPaths: ['C:\\QiuAI\\input\\reference.png'],
      modelProfileIds: ['qiu-image-generation-default'],
      toolIds: ['local-filesystem'],
      knowledgeBindingIds: []
    }
  }),
  rolePackage: createSingleMediaRolePackage({
    roleCode: 'ai-image-generation-assistant',
    name: 'AI 生图助手',
    modelProfileId: 'qiu-image-generation-default',
    llmTaskType: 'image_generation',
    artifactType: 'png',
    mediaKind: 'image',
    folder: 'generated-images',
    aspectRatio: '1:1'
  }),
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-image-generation-default',
      providerId: 'official',
      providerName: 'QiuAI Official',
      modelName: 'image-line-1',
      purpose: 'vision',
      capabilities: ['image_generation', 'image_to_image'],
      apiBaseUrl: 'https://model.example/v1',
      apiKey: 'image-key'
    }
  ]),
  tools,
  workspaceId: 'workspace-single-image',
  enabledModelProfileIds: ['qiu-image-generation-default'],
  enabledToolIds: ['local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    singleImageModelCalled = true;
    assert.equal(request.profile.id, 'qiu-image-generation-default');
    assert.equal(request.taskKind, 'image_generation');
    assert.equal(request.imageGeneration?.aspectRatio, '16:9');
    assert.equal(request.imageGeneration?.sourceImagePath, 'C:\\QiuAI\\input\\reference.png');
    assert.match(request.imageGeneration?.prompt ?? '', /单张图片/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({ remoteUrl: 'https://cdn.example.test/single/image.png' }),
      artifacts: [
        {
          type: 'image',
          remoteUrl: 'https://cdn.example.test/single/image.png',
          thumbnailPath: 'https://cdn.example.test/single/image.png'
        }
      ]
    };
  },
  desktopToolInvoker: async (request) => {
    singleImageDownloadCalled = true;
    assert.equal(request.toolId, 'local-filesystem');
    assert.equal(request.action, 'filesystem.download_remote_file');
    assert.equal(request.input.url, 'https://cdn.example.test/single/image.png');
    assert.equal(request.input.folder, 'generated-images');
    assert.equal(request.input.mediaKind, 'image');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\generated-images\\single-image.png',
        sourceUrl: request.input.url
      }
    };
  },
  completedAt: '2026-07-20T10:02:00.000Z'
});

assert.equal(singleImageResult.task.state, 'completed');
assert.equal(singleImageModelCalled, true);
assert.equal(singleImageDownloadCalled, true);
assert.ok(
  singleImageResult.task.artifacts.some(
    (artifact) => artifact.type === 'image' && artifact.localPath?.endsWith('single-image.png')
  )
);

let singleVideoModelCalled = false;
let singleVideoDownloadCalled = false;
const singleVideoResult = await runDesktopTask({
  task: createMockTaskDetail({
    taskId: 'task-runner-single-video-001',
    roleCode: 'ai-video-generation-assistant',
    roleName: 'AI 生视频助手',
    title: '生成单条视频',
    input: '生成一条 8秒 16:9 的品牌宣传短视频，镜头缓慢推进。',
    state: 'queued',
    artifactCount: 0,
    costCents: 0,
    executionContext: {
      modelProfileIds: ['qiu-video-generation-default'],
      toolIds: ['local-filesystem'],
      knowledgeBindingIds: []
    }
  }),
  rolePackage: createSingleMediaRolePackage({
    roleCode: 'ai-video-generation-assistant',
    name: 'AI 生视频助手',
    modelProfileId: 'qiu-video-generation-default',
    llmTaskType: 'video_generation',
    artifactType: 'mp4',
    mediaKind: 'video',
    folder: 'generated-videos',
    aspectRatio: '9:16',
    durationSeconds: 6
  }),
  modelProfiles: modelProfiles.concat([
    {
      id: 'qiu-video-generation-default',
      providerId: 'official',
      providerName: 'QiuAI Official',
      modelName: 'video-line-1',
      purpose: 'vision',
      capabilities: ['video_generation', 'text_to_video', 'image_to_video'],
      apiBaseUrl: 'https://model.example/v1',
      apiKey: 'video-key'
    }
  ]),
  tools,
  workspaceId: 'workspace-single-video',
  enabledModelProfileIds: ['qiu-video-generation-default'],
  enabledToolIds: ['local-filesystem'],
  enabledKnowledgeBindingIds: [],
  modelInvoker: async (request) => {
    singleVideoModelCalled = true;
    assert.equal(request.profile.id, 'qiu-video-generation-default');
    assert.equal(request.taskKind, 'video_generation');
    assert.equal(request.videoGeneration?.aspectRatio, '16:9');
    assert.equal(request.videoGeneration?.durationSeconds, 8);
    assert.equal(request.videoGeneration?.sourceImagePath, undefined);
    assert.match(request.videoGeneration?.prompt ?? '', /单条短视频/);
    return {
      provider: request.profile.providerName,
      modelName: request.profile.modelName,
      content: JSON.stringify({ remoteUrl: 'https://cdn.example.test/single/video.mp4' }),
      artifacts: [
        {
          type: 'video',
          remoteUrl: 'https://cdn.example.test/single/video.mp4',
          thumbnailPath: 'https://cdn.example.test/single/video-cover.jpg'
        }
      ]
    };
  },
  desktopToolInvoker: async (request) => {
    singleVideoDownloadCalled = true;
    assert.equal(request.toolId, 'local-filesystem');
    assert.equal(request.action, 'filesystem.download_remote_file');
    assert.equal(request.input.url, 'https://cdn.example.test/single/video.mp4');
    assert.equal(request.input.folder, 'generated-videos');
    assert.equal(request.input.mediaKind, 'video');
    return {
      toolId: request.toolId,
      action: request.action,
      ok: true,
      output: {
        localPath: 'C:\\QiuAI\\workspace\\generated-videos\\single-video.mp4',
        sourceUrl: request.input.url
      }
    };
  },
  completedAt: '2026-07-20T10:03:00.000Z'
});

assert.equal(singleVideoResult.task.state, 'completed');
assert.equal(singleVideoModelCalled, true);
assert.equal(singleVideoDownloadCalled, true);
assert.ok(
  singleVideoResult.task.artifacts.some(
    (artifact) => artifact.type === 'video' && artifact.localPath?.endsWith('single-video.mp4')
  )
);

console.log('Desktop local task runner passed.');

function createSingleMediaRolePackage(input: {
  roleCode: string;
  name: string;
  modelProfileId: string;
  llmTaskType: 'image_generation' | 'video_generation';
  artifactType: 'png' | 'mp4';
  mediaKind: 'image' | 'video';
  folder: string;
  aspectRatio: string;
  durationSeconds?: number;
}): RolePackageManifest {
  return {
    roleCode: input.roleCode,
    applicationType: 'digital_employee',
    name: input.name,
    version: '1.0.0',
    workflowGraph: {
      version: '1.0.0',
      entryNodeId: 'start',
      nodes: [
        { id: 'start', type: 'start', name: 'Start' },
        {
          id: 'receive_input',
          type: 'input',
          name: 'Receive input',
          inputVariables: ['start.text', 'start.images'],
          outputVariables: ['media_request']
        },
        {
          id: 'generate_media',
          type: 'llm',
          name: 'Generate media',
          modelProfileId: input.modelProfileId,
          inputVariables: ['media_request', 'start.images'],
          outputVariables: ['generated_media'],
          config: {
            llmTaskType: input.llmTaskType,
            outputMode: 'json',
            aspectRatio: input.aspectRatio,
            ...(input.durationSeconds ? { durationSeconds: input.durationSeconds } : {})
          }
        },
        {
          id: 'save_media',
          type: 'artifact',
          name: 'Save media',
          toolId: 'local-filesystem',
          artifactType: input.artifactType,
          inputVariables: ['generated_media'],
          outputVariables: ['media_file'],
          config: {
            action: 'filesystem.download_remote_file',
            input: {
              url: '$generated_media.remoteUrl',
              folder: input.folder,
              fileName: '{{task.title}}',
              mediaKind: input.mediaKind
            }
          }
        }
      ],
      edges: [
        { id: 'start-receive', sourceNodeId: 'start', targetNodeId: 'receive_input' },
        { id: 'receive-generate', sourceNodeId: 'receive_input', targetNodeId: 'generate_media' },
        { id: 'generate-save', sourceNodeId: 'generate_media', targetNodeId: 'save_media' }
      ]
    },
    modelProfileIds: [input.modelProfileId],
    toolIds: ['local-filesystem'],
    requiredKnowledgeSources: [],
    defaultTaskTypes: [input.llmTaskType],
    syncPolicy: 'summary_only'
  };
}
