# ADR-014: Desktop Controlled Tool Calls

## Status
Accepted

## Date
2026-07-21

## Context
The Windows desktop app is the primary enterprise operation surface for QiuAI WorkOS. It must support Dify-like tool usage, but the product should not expose Dify or LangGraph-style workflow builders to end users.

The current desktop runtime is local-first:
- Server storage remains lean and syncs only summaries and metadata.
- Enterprise assets and task artifacts stay on the user's PC.
- Local tools must be constrained to the active workspace.
- The first production target is Windows.

## Decision
Use a simple one-round controlled tool-call contract in the desktop task runner.

The model may request at most one desktop tool call by returning a line beginning with:

```text
QIUAI_DESKTOP_TOOL_CALL:
```

The marker must be followed by compact JSON:

```json
{
  "toolId": "local-filesystem",
  "action": "filesystem.write_text_file",
  "input": {
    "folder": "reports",
    "fileName": "result",
    "content": "..."
  }
}
```

The desktop runner validates the requested tool against the task's enabled tool bindings. If allowed, the renderer passes the call to the Electron bridge, the main process executes the local tool, and the tool result is returned to the model for the final task output.

## Alternatives Considered

### Full workflow engine in the desktop UI
- Pros: More powerful visual orchestration.
- Cons: Slower to ship, higher implementation and support cost, and not aligned with the product goal of hiding workflow complexity from enterprise users.
- Rejected for the initial production path.

### Native provider tool-calling APIs only
- Pros: Cleaner when the model provider supports function calling.
- Cons: Provider-specific behavior and weaker portability across OpenAI-compatible APIs.
- Rejected for the first version, but the current contract can be adapted later.

### Server-side tool execution
- Pros: Centralized control and easier monitoring.
- Cons: Conflicts with local-first storage and the 40G server constraint.
- Rejected for local file and enterprise asset operations.

## Consequences
- Desktop tasks can now execute real local tools without introducing a large agent framework.
- `usedToolIds` means tools actually invoked during a task, not merely bound tools.
- The first supported tool execution path is `local-filesystem`; additional adapters can be added behind the same contract.
- Complex multi-step planning remains out of scope until the one-round path is stable in real use.
