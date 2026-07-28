# Spec: QiuAI Workflow Canvas 1.0

## Objective

Build QiuAI's own workflow canvas into a practical Dify-style authoring surface for platform-managed digital employees.

The goal is not to clone every Dify feature. The goal is to make the platform operator able to build, test, publish, and maintain enterprise digital employees with a clear visual workflow, typed node inputs/outputs, reliable local execution, and business-ready deliverables.

Primary user:

- QiuAI platform operator using `admin-console`.

Secondary users:

- Enterprise PC users who install and run published digital employees.
- Enterprise admins in `web-console` who manage device binding and enterprise data, but do not author digital employees.

Success means:

1. The admin workflow canvas feels like a real workflow product: clear node cards, clean canvas, right-side node editor, visible input/output variables, and node-level run state.
2. A digital employee can be built from nodes, tested in `admin-console`, published through the server, installed in `pc-app`, and executed with the same graph contract.
3. The PC runtime can execute the published graph with local files, model calls, tools, branching, iteration, code transforms, and artifact generation.
4. Generated artifacts are controlled by node configuration and structured outputs, not by vague LLM summaries.
5. The system remains QiuAI-owned and does not depend on Dify runtime, Dify DSL, or Dify UI internals.

## Assumptions

- Dify and Coze are product references only. QiuAI will not embed Dify Docker Compose, Dify runtime, or copied Dify frontend code.
- `workflowGraph` remains the single workflow contract across `admin-console`, `server`, and `pc-app`.
- `admin-console` remains the only digital employee authoring surface.
- `pc-app` remains the primary execution surface and owns local files, local tools, local artifacts, and model credentials configured on the desktop.
- `web-console` does not author or install digital employees. It owns enterprise account, device/binding-code, knowledge, and usage views.
- Large files are transported through local asset references, not by copying raw bytes through server or node payloads.
- The first production target is Windows desktop.

## Non-Goals

- Do not build a complete Dify clone.
- Do not expose the workflow builder to normal enterprise users.
- Do not require customers to deploy Dify, Docker, PostgreSQL, Redis, or any external workflow service.
- Do not make the server execute heavy local-file workflows.
- Do not store platform secrets or customer model API keys inside template JSON.
- Do not support arbitrary unrestricted code execution in the first version.

## Tech Stack

- `admin-console`: Next.js, React, TypeScript, Ant Design, `@xyflow/react`
- `pc-app`: Electron, React, TypeScript, local desktop IPC, `sql.js`
- `server`: NestJS, Prisma, PostgreSQL
- Shared contracts: `packages/api-contract`, `packages/domain`
- Existing workflow contract: `workflowGraph` version `1.0.0`

## Commands

Development:

```powershell
npm run dev:server
npm run dev:admin
npm run dev:pc
```

Validation:

```powershell
npm run typecheck
npm run test
npm run build
```

Focused validation:

```powershell
npm run typecheck -w @qiuai/admin-console
npm run typecheck -w @qiuai/pc-app
npm run test -w @qiuai/pc-app
npm run check:admin-flow
```

Server deployment validation:

```bash
WORKOS_API_URL=http://127.0.0.1:4100 npm run check:admin-flow
```

## Project Structure

Expected ownership:

```text
apps/admin-console/
  src/app/templates/canvas/                  # workflow canvas route
  src/features/templates/                    # digital employee authoring UI

apps/server/
  src/shared/workflow-graph.ts               # server-side graph validation and helpers
  src/modules/role-templates/                # template CRUD, publish, visibility, test APIs
  prisma/                                    # schema and migrations if persistence changes

apps/pc-app/
  src/shared/desktop-workflow-graph.ts       # desktop graph parser and execution plan helpers
  src/shared/workflow-runtime.ts             # typed variable/file runtime helpers
  src/shared/desktop-task-runner.ts          # local graph execution
  src/main/desktop-tool.ts                   # local tool implementations
  src/renderer/                              # chat, digital employee install, result UX

packages/api-contract/
  src/workflow-graph.ts                      # shared public workflow graph contract

packages/domain/
  src/workflow-graph.ts                      # domain graph helpers

docs/
  QIUAI_WORKFLOW_CANVAS_1_SPEC.md            # this spec
  decisions/ADR-016-*.md                     # graph/canvas boundary decision
  decisions/ADR-017-*.md                     # local asset reference decision
```

## Product Model

### Surfaces

`admin-console`:

- Creates and edits digital employee templates.
- Provides workflow canvas authoring.
- Provides draft test runs and node-level traces.
- Publishes immutable template versions.
- Controls plan visibility and workspace whitelist.

`server`:

- Stores template drafts and published snapshots.
- Validates graph structure.
- Exposes authorized template catalog to PC clients.
- Stores audit, usage summaries, and publication metadata.
- Does not execute heavy local workflows.

`pc-app`:

- Pulls authorized published templates.
- Installs digital employees.
- Guides model/tool/API-key configuration.
- Executes workflow graphs locally.
- Reads user-dropped files through local file refs.
- Generates local artifacts and shows result download cards.

`web-console`:

- Manages enterprise account, binding codes, devices, and enterprise data.
- Does not author digital employees.

### Digital Employee Template

A digital employee template must have:

- Basic info: name, icon, category, summary, business scenario.
- Permission info: recommended plan, allowed plans, optional workspace whitelist.
- Runtime info: workflow graph, required model profiles, required tools, required knowledge bindings.
- Installation info: user-facing setup checklist for PC.
- Publication info: draft/published/archived state and immutable version.

## Workflow Graph Contract

The existing `workflowGraph` remains the source of truth. Canvas UI, server validation, and PC runtime must edit and execute this same shape.

Current graph:

```ts
export interface RoleWorkflowGraph {
  version: '1.0.0';
  nodes: RoleWorkflowGraphNode[];
  edges: RoleWorkflowGraphEdge[];
  entryNodeId: string;
  variables?: RoleWorkflowGraphVariable[];
  runtimePolicy?: RoleWorkflowGraphRuntimePolicy;
}
```

Canvas 1.0 extends usage rules without introducing a second graph model.

Required node contract:

```ts
export interface QiuWorkflowNodeRuntimeContract {
  id: string;
  type: RoleWorkflowGraphNodeType;
  title: string;
  inputPorts: QiuWorkflowPort[];
  outputPorts: QiuWorkflowPort[];
  config: Record<string, unknown>;
  runtime: {
    status: 'idle' | 'running' | 'success' | 'failed' | 'skipped';
    durationMs?: number;
    inputPreview?: Record<string, unknown>;
    outputPreview?: Record<string, unknown>;
    errorMessage?: string;
  };
}

export interface QiuWorkflowPort {
  name: string;
  type: 'text' | 'number' | 'boolean' | 'json' | 'asset' | 'asset[]' | 'table' | 'artifact';
  required?: boolean;
  description?: string;
}
```

This runtime contract is a UI/runtime projection of `workflowGraph`; it must not be stored as a separate canonical model unless explicitly versioned later.

## Variable And Asset Protocol

Variables must be typed and selectable in the UI. Admin users should not need to memorize variable names like `draft_result.text`.

Supported values:

- `text`: plain text or markdown-like content.
- `number`: numeric values for scoring, costs, thresholds.
- `boolean`: branch flags.
- `json`: structured objects and arrays.
- `asset`: one local file reference.
- `asset[]`: multiple local file references.
- `table`: workbook/sheet/row data intended for spreadsheet outputs.
- `artifact`: generated local file reference.

Large files must move through references:

```ts
export interface QiuAssetRef {
  id: string;
  name: string;
  kind: 'text' | 'document' | 'spreadsheet' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  mimeType?: string;
  localPath?: string;
  uri?: string;
  sizeBytes?: number;
  extractedText?: string;
  metadata?: Record<string, unknown>;
}
```

Structured spreadsheet output must use a table contract:

```ts
export interface QiuTableValue {
  sheets: Array<{
    name: string;
    rows: string[][];
  }>;
}
```

Rule:

- LLM nodes may produce `json` or `table` values.
- Code nodes may transform `json` into `table`.
- Artifact nodes generating `xlsx/csv` should prefer `table` input over plain text.
- If only plain text is available for `xlsx`, the canvas must show a warning before publish.

## Node Types

### Start

Purpose:

- Defines user task input, uploaded files, and optional form fields.

Required UI:

- Input field list.
- File input rules.
- Default variables: `start.text`, `start.files`, `start.images`, `start.videos`, `start.documents`, `start.spreadsheets`.

### Parameter Extractor

Purpose:

- Converts natural language task text into structured JSON parameters.

Required UI:

- Extraction rules in Chinese.
- JSON Schema editor or field table.
- Missing-field behavior: `null`, default value, or ask user.

### LLM

Purpose:

- Calls a selected model for analysis, generation, classification, or JSON output.

Required UI:

- Model profile selector.
- System prompt.
- User prompt.
- Context variable picker.
- Output mode: `text` or `json`.
- Optional JSON Schema.
- Retry count and timeout.

Publish rule:

- If output mode is `json`, the schema must validate in draft test before publish.

### Tool

Purpose:

- Calls a registered tool such as web search, Office document, local filesystem, HTTP, MCP, or video processing.

Required UI:

- Tool selector.
- Action selector.
- Parameter form generated from tool action definition.
- Input variable bindings.
- Output variables.
- Approval toggle for risky actions.

### Code

Purpose:

- Runs controlled transformation logic for JSON cleanup, field mapping, scoring, filtering, table building, and small business rules.

Initial language:

- JavaScript in Canvas 1.0.

Execution boundary:

- No network by default.
- No unrestricted filesystem access.
- Time limit required.
- Input is read-only.
- Output must be JSON-serializable.

Typical use:

```js
function main(input) {
  const items = input.items || [];
  return {
    rows: [
      ['商品名称', '售价', '类型', '核心卖点', '适用场景', '风险'],
      ...items.map(item => [
        item.name || '待补充',
        item.price || '待补充',
        item.type || '待补充',
        item.selling_point || '待补充',
        item.scene || '待补充',
        item.risk || ''
      ])
    ]
  };
}
```

### Condition

Purpose:

- Routes execution based on structured variables.

Required UI:

- Variable selector.
- Operator: exists, equals, contains, greater than, less than, expression.
- Branch labels on edges.
- Default branch.

### Iteration

Purpose:

- Processes each item in an array, such as files, products, customers, invoices, or videos.

Required UI:

- Source array variable.
- Current item variable name.
- Max iterations.
- Continue-on-error option.
- Aggregated output variable.

### Aggregator

Purpose:

- Combines multiple branch or iteration outputs into one structured value.

Required UI:

- Input variables.
- Merge strategy: append array, object merge, text join, table append.

### Knowledge

Purpose:

- Reads enterprise or local knowledge context relevant to the task.

Required UI:

- Knowledge source selector.
- Query variable binding.
- Max chunks/characters.
- Missing source behavior.

### Artifact

Purpose:

- Generates a downloadable local deliverable.

Required UI:

- Artifact type: `docx`, `xlsx`, `csv`, `pdf`, `markdown`, `png`, `jpg`, `mp4`, `zip`.
- Input variable selector.
- File name template.
- Output folder/category.
- Format-specific config.

Format-specific rules:

- `xlsx/csv`: prefer `table` input. Warn if input is plain text.
- `docx/pdf/markdown`: accept structured document text.
- `mp4`: require asset/video path or cut plan.
- `png/jpg`: require image generation or image transform tool support.

### Output

Purpose:

- Defines the final PC chat response.

Required UI:

- Text summary template.
- Download artifact variables.
- Next-action suggestions.
- Failure fallback message.

## Canvas UX Requirements

The canvas must feel closer to a mature workflow product than a form editor.

### Layout

- Left side: compact node library grouped by category.
- Center: full canvas with grid, pan, zoom, minimap, and fit-to-view.
- Right side: selected node configuration panel.
- Top bar: template name, autosave status, test run, publish, version history.

### Node Card

Each node card must show:

- Type icon and color.
- Node name.
- Key runtime binding such as model/tool/artifact type.
- Input/output count.
- Warning badge if incomplete.
- Last run state after test.

Cards must be compact. Long instructions belong in the right panel, not on the card.

### Right Panel

The right panel must have:

- Node title and type.
- Settings tab.
- Last Run tab.
- Input/output variable section.
- Warning section.
- Delete/duplicate actions.

Panel text must be Chinese-first. Keep technical terms such as `deepseek`, `JSON`, `API`, `MCP`, `HTTP`, `FFmpeg`.

### Variable Picker

Every field that accepts a variable must provide a picker:

- Search variables by node/name/type.
- Show type badge.
- Insert variable token.
- Prevent incompatible variable types where possible.

### Edge Editing

Edges must support:

- Drag connection between node ports.
- Label for condition branch.
- Click edge to edit condition.
- Delete edge.
- Prevent cycles unless node type is explicitly loop/iteration.

### Autosave

Autosave must show:

- Saving.
- Saved at time.
- Unsaved changes.
- Save failed with retry.

Autosave must not publish. Publish remains explicit.

## Runtime And Debugging

Admin test runs must show the same mental model as PC execution.

### Test Run

Canvas test run must support:

- Task text input.
- Optional test files.
- Real or mock model/tool mode.
- Streaming node status.
- Stop run.
- Re-run from selected node if cached upstream outputs exist.

### Node Trace

Each run should store or display:

- Node status.
- Started/completed time.
- Duration.
- Input variables snapshot.
- Output variables snapshot.
- Token usage if model node.
- Cost estimate if available.
- Tool action request/response summary.
- Error message and retry count.

Trace storage may be summarized on server. Heavy local file content must not be uploaded.

### Error Handling

Errors must be actionable:

- Missing model API key: show required model profile.
- Missing tool: show required tool and setup path.
- Invalid JSON: show node and parsing error.
- Invalid table input: show expected `table` contract.
- Missing local file: show file path/ref and recovery suggestion.
- FFmpeg missing: show setup guidance.

## PC Runtime Requirements

The PC app must execute published `workflowGraph` versions and adapt to admin-console behavior.

Required behavior:

- Install only authorized published templates.
- Show required model/tool setup during install.
- Preserve local model credentials.
- Accept dragged files in chat.
- Convert dragged files into `QiuAssetRef`.
- Execute nodes locally where local access is needed.
- Display node progress in chat without overwhelming users.
- Show final artifact cards with type icons and save/download action.

PC user experience:

- Users should not see the full workflow canvas.
- Users should see enough execution trace to trust the employee: reading file, analyzing, generating artifact, done.
- Advanced logs remain accessible from task detail/history.

## Admin Publication Requirements

Before publish, the system must validate:

- Template has name, category, summary, and scenario.
- Graph has one valid entry node.
- Every edge references existing nodes.
- Required nodes have required config.
- LLM nodes reference model profiles.
- Tool nodes reference enabled tool IDs and actions.
- Artifact nodes have artifact type and compatible input.
- Conditions have default/fallback where multiple branches exist.
- Iteration has max iteration limit.
- Code node has timeout and restricted mode.
- Published version is immutable after publish.

Publish output:

- Immutable template version.
- Authorized plan list.
- Optional workspace whitelist.
- Required setup checklist for PC.
- Runtime compatibility version.

## Data Model Requirements

Avoid database changes until needed, but the spec expects these logical fields:

```ts
export interface PublishedWorkflowTemplateSnapshot {
  templateId: string;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  workflowGraph: RoleWorkflowGraph;
  requiredModelProfileIds: string[];
  requiredToolIds: string[];
  requiredKnowledgeBindingIds: string[];
  requiredArtifactTypes: RoleWorkflowGraphArtifactType[];
  runtimeCompatibility: {
    minPcVersion?: string;
    graphVersion: '1.0.0';
  };
}
```

If existing database fields can store this safely, prefer reusing them. Add migrations only when current persistence cannot support draft/version/test metadata cleanly.

## Code Style

Use typed contracts at boundaries. Avoid stringly-typed behavior when a union type or schema is available.

Good:

```ts
type ArtifactInputCompatibility =
  | { ok: true }
  | { ok: false; reason: 'MISSING_INPUT' | 'TYPE_MISMATCH' | 'PLAIN_TEXT_TO_TABLE_RISK' };

function validateArtifactNodeInput(
  node: RoleWorkflowGraphNode,
  variableTypes: Map<string, RoleWorkflowGraphVariableType>
): ArtifactInputCompatibility {
  if (node.artifactType === 'xlsx') {
    const firstInput = node.inputVariables?.[0];
    if (!firstInput) return { ok: false, reason: 'MISSING_INPUT' };
    if (variableTypes.get(firstInput) !== 'table') {
      return { ok: false, reason: 'PLAIN_TEXT_TO_TABLE_RISK' };
    }
  }

  return { ok: true };
}
```

Naming rules:

- Use `workflowGraph` for the canonical graph.
- Use `nodeTrace` for runtime debugging output.
- Use `assetRef` for local files.
- Use `table` for spreadsheet-ready structured data.
- Do not name QiuAI-native concepts after Dify internals.

## Testing Strategy

Unit tests:

- Graph validation.
- Variable type compatibility.
- Condition evaluation.
- Code node sandbox limits.
- Artifact input compatibility.
- Table-to-xlsx generation.

Integration tests:

- Admin creates draft graph and validates publish readiness.
- Admin test run produces node traces.
- Server exposes authorized published template.
- PC installs template and reports missing setup.
- PC executes text-to-xlsx workflow with structured rows.
- PC executes file-to-docx workflow with local asset refs.
- PC handles missing model/tool with clear error.

Manual acceptance tests:

1. Build "商品资料整理专员":
   - Input: dragged `.txt` product list.
   - Flow: read file -> LLM extract JSON -> code build table -> artifact xlsx -> output.
   - Expected: one product per row with business columns.
2. Build "合同审查专员":
   - Input: dragged `.docx`.
   - Flow: read document -> LLM extract clauses -> condition risk level -> docx report.
3. Build "短视频质检专员":
   - Input: dragged video.
   - Flow: video probe -> frame extraction -> LLM analysis -> score JSON -> output report.

Validation commands:

```powershell
npm run typecheck -w @qiuai/admin-console
npm run typecheck -w @qiuai/pc-app
npm run test -w @qiuai/pc-app
npm run build:packages
```

## Delivery Phases

### Phase 1: Canvas UX Foundation

Scope:

- Redesign admin canvas layout toward compact Dify-style UX.
- Add cleaner node cards.
- Move all node editing into right panel.
- Add node warning badges.
- Improve variable picker UI.

Acceptance:

- The canvas main area is the dominant surface.
- Adding, selecting, moving, connecting, and deleting nodes is clear.
- Node cards do not expose long configuration text.

### Phase 2: Typed Variable And Port Model

Scope:

- Add derived input/output ports for each node type.
- Show variable types visually.
- Validate incompatible connections.
- Add variable picker to prompt/tool/artifact fields.

Acceptance:

- Admin can see what each node consumes and produces.
- Artifact nodes warn when `xlsx` uses plain text instead of table.

### Phase 3: LLM JSON Output And Structured Extraction

Scope:

- Add LLM output mode: text/json.
- Add JSON Schema config.
- Add publish/test validation for JSON outputs.

Acceptance:

- A product extraction LLM node can output structured product rows.
- Invalid JSON is shown as a node-level failure.

### Phase 4: Code Node

Scope:

- Add JavaScript code node to transform JSON/table/text.
- Restrict execution.
- Add timeout and output validation.

Acceptance:

- Admin can convert extracted JSON into table rows for xlsx.
- Code errors are visible in node trace.

### Phase 5: Artifact Pipeline Upgrade

Scope:

- Make artifact nodes format-aware.
- Prefer table input for xlsx/csv.
- Improve docx/pdf/markdown inputs.
- Keep local artifact cache and download UX.

Acceptance:

- Text file to xlsx produces multi-row structured spreadsheets.
- Artifact nodes no longer silently turn arbitrary summaries into weak tables without warning.

### Phase 6: Node-Level Test Run

Scope:

- Add admin test run panel.
- Stream node status.
- Show selected node "Last Run" input/output.
- Add rerun-from-node where feasible.

Acceptance:

- Operator can debug why a digital employee produced poor output before publishing.

### Phase 7: PC Runtime Compatibility

Scope:

- Ensure PC runtime supports the new node contracts.
- Add setup checklist from published template.
- Improve chat progress display for multi-node workflows.

Acceptance:

- A published Canvas 1.0 employee installs and runs on PC with local files and artifact output.

### Phase 8: High-Quality Pilot Templates

Scope:

- Build fewer, better templates using the upgraded canvas.
- Initial candidates:
  - 商品资料整理专员
  - 合同审查专员
  - 报价分析专员
  - 文档整理归档专员
  - 短视频质检专员

Acceptance:

- Each pilot template has a real sample input, successful test run, and expected downloadable artifact.

## Boundaries

Always:

- Keep `workflowGraph` as the only canonical workflow contract.
- Validate graph changes before publish.
- Keep PC local files and heavy artifacts local.
- Use typed variable and artifact contracts.
- Make errors visible at node level.
- Prefer quality of a few templates over quantity.

Ask first:

- Adding a database migration.
- Adding a new runtime dependency.
- Adding Python execution.
- Bundling FFmpeg.
- Changing model credential ownership.
- Making server execute workflows.

Never:

- Depend on Dify runtime or copied Dify UI internals.
- Store customer model API keys in template definitions.
- Upload large local files to the server by default.
- Let normal enterprise users edit workflow graphs.
- Hide node failures behind generic "task failed" messages.
- Generate xlsx/csv from vague text without warning when table input is expected.

## Success Criteria

Workflow Canvas 1.0 is done when:

1. Admin can build a multi-node digital employee with LLM, tool, condition, code, and artifact nodes.
2. Admin can visually inspect each node's inputs, outputs, status, and warnings.
3. Admin can test-run a workflow and see node-level traces.
4. Admin can publish an immutable version after validation passes.
5. PC can install and execute that published version.
6. PC can process dragged local files through asset refs.
7. PC can generate at least `docx`, `xlsx`, `csv`, `markdown`, and `mp4` artifact paths where tool prerequisites are met.
8. The "txt product list -> structured xlsx" scenario produces one row per product, not a one-row document summary.
9. Missing model/tool/key/file errors are actionable.
10. Existing admin flow and PC runtime tests still pass.

## Open Questions

- Should code node start with JavaScript only, or should Python be included in the first implementation?
- Should admin test runs execute on the server in mock mode first, or require a PC-backed runner for real local file/tool behavior?
- Should published templates pin a minimum PC app version immediately?
- Should image generation/output be implemented in Canvas 1.0 or deferred behind docx/xlsx/video stability?
- Should advanced loop nodes be exposed in UI immediately, or should iteration cover the first production use cases?

