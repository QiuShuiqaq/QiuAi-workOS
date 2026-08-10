# ADR-024: Use Workflow Nodes as the Model Contract Source

## Status
Accepted

## Date
2026-08-10

## Context

Digital employee and digital factory templates can contain stale model profile
ids in `dependencyManifest.modelAssets` or the top-level `modelProfileIds`.
Those fields are compiled metadata and must not decide which model slots a
template exposes at runtime.

## Decision

The workflow graph is the only source of model requirements:

- Every `llm` node declares its semantic task through `config.llmTaskType`.
- The task type maps to a Qiu semantic model slot.
- `requiredModelProfileIds` is reserved for explicit auxiliary model
  requirements, such as ASR used by a video screening node.
- Dependency manifests and top-level model profile arrays are regenerated or
  normalized from the workflow and are never used to add model requirements.
- Template publication validates that the dependency manifest matches the
  compiled workflow model contracts.

## Consequences

- A text-only template cannot expose a video-generation model because an old
  manifest still contains one.
- Video generation and video screening continue to expose their real video and
  ASR requirements.
- PC runtime model summaries, readiness checks, quick switching, and execution
  plans use the same workflow-derived contracts.
- Templates with invalid or incomplete workflow graphs must be corrected rather
  than relying on stale dependency metadata.
