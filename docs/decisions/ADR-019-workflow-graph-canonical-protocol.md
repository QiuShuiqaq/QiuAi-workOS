# ADR-019: Workflow graph canonical protocol

## Status
Accepted

## Date
2026-07-29

## Context
QiuAI WorkOS is still in active product development, and legacy digital employee templates
have been removed from the production authoring surface. Keeping old workflow node types in
the public graph protocol now creates more cost than value:

- Admin-console authors see multiple names for the same concept.
- PC runtime needs extra branches that are no longer product requirements.
- Server validation can accidentally accept and republish old graph shapes.
- Future workflow features become harder to reason about because protocol and UI terms drift.

ADR-018 defined a compact canvas surface while leaving older internal node types available
during transition. That transition is now closed for the product path.

## Decision
`workflowGraph` has one canonical node protocol:

- Model execution is always `llm`.
- Data transformation is always `data`.
- `data.config.dataMode` selects `assign`, `template`, or `code`.
- `llm.config.llmTaskType` selects text, reasoning, structured extraction, long document,
  vision, video understanding, image generation, video generation, embedding, or rerank tasks.
- `list`, `iteration`, `loop`, `aggregator`, `condition`, `tool`, `artifact`, `approval`,
  `input`, `knowledge`, `output`, and `start` remain first-class workflow nodes.

The following node types are no longer valid in stored or published workflow graphs:

- `parameter_extractor`
- `reasoning`
- `assign`
- `template`
- `code`

Template step summaries also use `llm` instead of `reasoning`. The word `reasoning` remains
valid only as a model purpose, model capability, or `llmTaskType` value.

## Consequences
Benefits:

- Admin-console, server, and PC runtime now share one workflow vocabulary.
- Published digital employees cannot reintroduce removed node types.
- PC execution can dispatch by broad node type first and mode second.
- New template design starts from the same protocol that PC runs.

Tradeoffs:

- Existing old workflow JSON is rejected instead of migrated at runtime.
- Development fixtures and tests must be rewritten to the canonical protocol.
- Any future import feature must explicitly map old or third-party DSLs into this protocol
  before saving.

## Implementation Notes
The canonical graph is enforced at the shared contract and server validation layers.
Admin-console authoring creates only the canonical node types. PC parsing and execution expect
the same protocol and run `data` by dispatching on `dataMode`.

This ADR supersedes the transitional compatibility note in ADR-018.
