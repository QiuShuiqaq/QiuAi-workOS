# ADR-008: Desktop Runtime Is the Primary Execution Plane

## Status
Accepted

## Date
2026-07-20

## Context
QiuAI WorkOS is a commercial digital workforce platform, but the current server is small and should not carry large knowledge bases, model assets, or heavy execution data. The product also needs a clear role:

- Web is the personal operations console
- Desktop is the enterprise operating and execution surface
- Mobile is a lightweight command and approval surface
- Server is the control plane and summary store

The desktop client must support model access, tool use, file operations, office document workflows, and local employee execution without forcing the product to become a visual workflow builder.

## Decision
Make the desktop runtime the primary execution plane for digital employees.

Use these rules:
- Keep heavy knowledge, files, secrets, and execution artifacts local to the desktop whenever possible
- Store only summaries, metadata, billing, audit, and sync state on the server
- Model/provider/tool concepts may borrow Dify-style capability boundaries, but QiuAI keeps its own product language: Role, Workspace, ModelProfile, ToolManifest, and LocalRuntime
- The PC client may expose a higher-level "digital employee" layer on top of these capabilities
- Normal users should not need to draw workflow graphs to use the product

## Alternatives Considered

### Make the server the primary runtime
- Pros: simpler centralized management
- Cons: too much storage and execution pressure for the current server, larger operational cost, weaker local asset control
- Rejected: contradicts the local-first product boundary

### Embed Dify as the product shell
- Pros: faster access to model/tool/workflow primitives
- Cons: product language becomes workflow-first, not role-first; desktop and enterprise boundaries become harder to own
- Rejected: Dify should inform capability design, not define the product shell

### Rebuild every tool and workflow primitive from scratch
- Pros: full control
- Cons: slower delivery and duplicated infrastructure work
- Rejected: QiuAI should reuse the capability pattern, not reinvent every primitive

## Consequences
- Desktop development becomes a first-class product stream, not a thin wrapper
- The server stays affordable and focused
- Tool integrations such as document editing, search, and file operations can be implemented as local bridges
- The desktop app needs secure local persistence, sync rules, and packaging discipline
- Future Dify compatibility should be considered as an adapter path, not a core dependency

