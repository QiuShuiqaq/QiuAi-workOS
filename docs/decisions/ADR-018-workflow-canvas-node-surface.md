# ADR-018: Workflow canvas compact node surface

## Status
Accepted. Transitional compatibility notes are superseded by ADR-019.

## Date
2026-07-29

## Context
The workflow canvas must become the primary authoring surface for QiuAI digital employees.
The previous graph capability design exposed too many low-level concepts as nodes, such as
parameter extraction, reasoning, assignment, templates, list processing, aggregation, and code.
This made the canvas look powerful but harder to understand and easy to misuse.

The product direction is to feel close to mature workflow tools while remaining simpler for
enterprise customization work:

- Operators should see a small set of clear business-level nodes.
- Model capability differences should live inside the LLM node configuration.
- Tool differences should live inside the tool action selector.
- Artifact differences should live inside the artifact generator.
- Runtime correctness should come from typed assets, variables, and input/output contracts.

## Decision
The admin workflow canvas will expose a compact semantic node surface by default.

Default visible node concepts:

- `接收输入`: receives user task text, form fields, and local file references.
- `LLM 大模型`: calls any configured model capability, including text, reasoning,
  long-document understanding, image understanding, video understanding, image generation,
  video generation, embedding, and rerank where supported.
- `工具`: calls a concrete tool action, such as web search, document reading, OCR,
  spreadsheet handling, local file access, MCP, HTTP, or video processing.
- `知识库`: reads enterprise or local knowledge context.
- `条件分支`: routes execution by variable value or expression.
- `批处理`: iterates over files, rows, arrays, or other lists with bounded execution.
- `数据处理`: cleans variables, maps JSON, builds rows, formats snippets, or performs
  controlled code transforms.
- `产物生成`: writes final deliverables such as docx, xlsx, csv, markdown, pdf, png, jpg,
  pptx, mp4, or zip.
- `返回结果`: prepares the PC-side final message, artifact cards, and next action hints.
- `人工确认`: optional control point for high-risk steps.

Existing internal `workflowGraph` node types remain supported for now, but they should be
treated as implementation details or advanced modes where possible:

- `reasoning` and `parameter_extractor` are model-node modes.
- `list`, `iteration`, `aggregator`, `assign`, `template`, and `code` are data-processing
  modes or advanced helpers.
- `artifact` remains a first-class node because deliverable generation is a user-visible
  outcome.

This keeps `workflowGraph` as the only canonical contract while allowing the authoring UI
to be simpler than the runtime implementation.

## Consequences
Benefits:

- The operator can build common workflows faster without memorizing many technical node names.
- The model library can grow to text, image, video, audio, embedding, and rerank models without
  adding a separate visible node for every model category.
- Tool packages can grow behind a stable `工具` node through action-level definitions.
- PC installation can continue to derive required model/tool/artifact setup from the published
  dependency manifest.

Tradeoffs:

- The right-side node configuration becomes more important because it chooses the specific
  model capability, tool action, data mode, or artifact type.
- The system must validate input/output compatibility more strongly, since the visible node
  type is broader.
- Some existing templates may still contain older internal node types during development.
  New authoring flows should prefer the compact node surface.

## Implementation Notes
The first implementation slice updates admin-console canvas wording and node library grouping
without changing the stored graph contract.

Later slices should:

- Move model capability selection into the `LLM 大模型` node configuration.
- Filter selectable models by input/output capability from model assets.
- Move tool selection to action-level assets with explicit input/output definitions.
- Consolidate assignment, template, list, aggregation, and code helpers under a clearer
  `数据处理` authoring experience.
- Keep large media and documents flowing through local asset references, not raw node payloads.
- Keep PC execution behavior aligned with admin test behavior.
