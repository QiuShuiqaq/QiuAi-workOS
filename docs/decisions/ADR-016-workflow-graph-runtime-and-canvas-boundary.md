# ADR-016: Workflow graph runtime and future canvas boundary

## Status
Accepted

## Date
2026-07-26

## Context
QiuAI WorkOS needs Dify-like workflow capability, but the current priority is a stable closed loop:
- `admin-console` authors, tests, publishes digital employee templates.
- `pc-app` installs templates, executes workflows locally, reads local assets, calls tools, and generates local deliverables.
- The server remains the control plane for templates, entitlement, payment, audit, and workspace/device state.
- Ordinary enterprise users should not face a workflow canvas in the PC client.

The system already stores a typed `workflowGraph` on role templates. The graph is now the primary runtime contract between `admin-console`, server, and `pc-app`.

## Decision
Use QiuAI's simplified Dify-style `workflowGraph` as the single workflow contract.

The current supported node types are:
- `start`
- `input`
- `parameter_extractor`
- `list`
- `knowledge`
- `reasoning`
- `llm`
- `assign`
- `template`
- `tool`
- `condition`
- `iteration`
- `loop`
- `aggregator`
- `artifact`
- `approval`
- `output`

The current supported tool-node integrations are:
- `web-search`: web fetch/search through the desktop bridge.
- `office-document`: document extraction and docx/xlsx/csv/pptx generation.
- `local-filesystem`: scoped local file read/write/list.
- `http-request`: controlled HTTP requests.
- `mcp`: JSON-RPC `tools/call` against an explicit MCP gateway endpoint.
- `video-processing`: local video probe, frame extraction, and MP4 export through FFmpeg.

The future workflow canvas, when added, must edit the same `workflowGraph` shape. It must not introduce a second workflow model. The first canvas version should be a visual editor over the existing graph fields:
- nodes
- edges
- entry node
- condition rules
- node config JSON
- runtime policy

## Alternatives Considered

### Full Dify workflow platform clone now
- Pros: Rich canvas and mature mental model.
- Cons: Larger UI/runtime scope, more server and dependency pressure, slower path to pilot stability.
- Rejected for now: the current product needs a controlled closed loop before a full visual builder.

### Keep only structured steps
- Pros: Simple.
- Cons: Cannot represent branching, variable transforms, MCP/HTTP tool nodes, or future canvas editing.
- Rejected: too limited for configurable digital employees.

### Separate canvas workflow schema later
- Pros: Canvas could move independently.
- Cons: Creates migration work and forces `pc-app` to support two runtime modes.
- Rejected: `workflowGraph` must remain the single source of truth.

## Consequences
- `admin-console` can keep using a structured form while still storing a canvas-ready graph.
- `pc-app` adapts to the server/admin graph model; old step-based behavior is fallback only.
- Future Dify/Coze-like canvas work is mostly a UI editor problem, not a runtime rewrite.
- Heavy execution and knowledge assets remain local to the desktop, matching the server capacity constraint.
- New node types must be added to the shared graph contract first, then server validation, then PC execution.

## Implementation Notes
- Template testing returns node-level `graphTrace` so admins can inspect expected inputs and outputs before publishing.
- Desktop runtime logs include optional structured `details.workflowNode` so the chat UI can show node input/output snapshots.
- HTTP and MCP nodes are disabled by default in local runtime state and require explicit tool enablement.
- MCP currently uses a JSON-RPC gateway endpoint. Stdio MCP process management is intentionally deferred.
