# ADR-020: Digital factory application type

## Status
Accepted

## Date
2026-07-30

## Context
QiuAI WorkOS already supports platform-authored digital employees through `RoleTemplate`
and the canonical `workflowGraph` protocol. The next product need is a batch-oriented
application for cross-border ecommerce image production.

This new product shape is different from a digital employee:

- A digital employee usually handles one task and returns one response or deliverable set.
- A digital factory handles a batch, loops over many items, lets users select output packages,
  tracks per-item progress, supports retry, and returns ordered URL preview results.

Several alternatives were discussed:

- Embed or import Dify as the factory/workflow system.
- Create a completely separate factory workflow DSL.
- Build image generation as ordinary chat-style digital employees.
- Add AI points and platform-hosted image model resale in the first version.

The current product boundary favors a simpler, more controllable implementation that fits the
existing system.

## Decision
Add "数字工厂" as a first-class application type while reusing the existing canonical
`workflowGraph` protocol.

Digital factories are represented by:

- A template-level application type, logically `digital_factory`.
- Factory-specific runtime metadata in the dependency/factory manifest.
- Existing canonical graph nodes, especially `input`, `iteration`, `condition`, `llm`, `data`,
  `artifact`, `aggregator`, and `output`.
- PC-side batch operation UX, URL preview rendering, and optional local artifact caching.

No second workflow protocol is introduced.

All model calls in Factory V1 are customer-configured. QiuAI does not proxy, hide, resell, or
charge for LLM/image model calls in this phase. AI points and payment are explicitly deferred.

The first factory is `跨境商品图工厂`, with 7 selectable output packages:

- 白底图
- 商品主图
- 场景图
- 换背景
- 换模特
- 尺寸图
- 卖点图

Quality check is optional:

- `none`: no check
- `basic`: URL metadata and optional local cache checks
- `smart`: customer-configured multimodal model check

The default batch limit is 50 product items.

Large generated images do not pass through the QiuAI server. The server remains the control
plane and stores only metadata such as upstream `remoteUrl` values when synchronization is
needed. PC-side local cache or ZIP export can be added only after images are fetched to the
customer's device.

## Alternatives Considered

### Embed Dify or depend on Dify DSL
- Pros: Mature workflow authoring reference.
- Cons: Adds operational complexity, dependency risk, version drift, and weak control over QiuAI's product model.
- Rejected: QiuAI work canvas remains native. Dify remains a product reference only.

### Separate factory workflow DSL
- Pros: Could model batch production very explicitly.
- Cons: Splits authoring, validation, testing, PC execution, and future maintenance into two protocols.
- Rejected: Factory behavior can be expressed with the existing graph plus manifest/runtime metadata.

### Chat-style image generation digital employees
- Pros: Fastest UI path.
- Cons: Poor fit for batch ecommerce production, package selection, preview, retry, and ZIP export.
- Rejected: Image production should be a factory operation panel, not only a chat task.

### AI points and platform-hosted image generation in V1
- Pros: Creates direct monetization and hides upstream image channels.
- Cons: Requires payment, ledger, risk control, refunds, customer support, and upstream operational risk before product usage is proven.
- Deferred: All models remain customer-configured in Factory V1.

## Consequences
Benefits:

- Digital factory becomes a clear product concept without duplicating workflow protocol.
- Existing digital employees continue to use the same graph/runtime stack.
- PC can offer a workflow-specific batch UI while still running published graph definitions.
- Generated image handling stays out of the server data plane, reducing storage and privacy risk.
- The first version avoids billing and upstream model operations risk.

Tradeoffs:

- Customer setup still requires model credentials for vision and image editing/generation.
- Factory templates need stronger manifest validation than ordinary digital employees.
- PC runtime must add batch execution, URL preview, optional local cache, and result UX on top of the current task runner.
- If monetized platform-hosted models are added later, billing must be designed as a separate layer.

## Implementation Notes
The implementation spec is `docs/QIUAI_DIGITAL_FACTORY_SPEC.md`.

If persistence is changed, existing templates must default to `digital_employee`. When a new
factory definition conflicts with older template semantics inside a factory template, the new
factory definition wins.
