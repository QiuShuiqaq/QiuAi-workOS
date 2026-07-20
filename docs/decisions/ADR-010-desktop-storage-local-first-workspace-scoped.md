# ADR-010: Desktop storage is local-first and workspace-scoped

## Status
Accepted

## Date
2026-07-20

## Context
QiuAI WorkOS is a commercial digital workforce platform. The PC client is the primary execution surface, and the target users will run it on their own computers. The server is intentionally small and should stay focused on control-plane concerns such as auth, plans, billing, audit summaries, and sync metadata.

The desktop side needs to store several different kinds of data:
- local runtime identity and workspace state
- role/runtime configuration
- large files and generated artifacts
- indexes and caches
- logs and debugging traces
- secrets and credentials
- backup bundles

Putting all of that into a single file or into the server would create scaling, cost, and ownership problems.

## Decision
Use a workspace-scoped local storage root under Electron `userData`.

The desktop storage layout is:
- `workspaces/<workspaceId>/state/` for small structured runtime state
- `workspaces/<workspaceId>/db/` reserved for an embedded local database later
- `workspaces/<workspaceId>/assets/` for documents, exports, and generated files
- `workspaces/<workspaceId>/indexes/` for search and retrieval indexes
- `workspaces/<workspaceId>/logs/` for runtime and debug logs
- `workspaces/<workspaceId>/secrets/` for encrypted local secrets
- `workspaces/<workspaceId>/cache/` for temporary cache data
- `workspaces/<workspaceId>/backups/` for export and recovery bundles

Within `state/`, the desktop keeps separate files for:
- workspace profile
- workspace catalog
- runtime snapshot
- legacy compatibility snapshot during migration

The application will:
- create this layout automatically
- keep the server out of heavy storage
- migrate legacy root-level runtime state into the workspace directory
- keep storage paths stable across app restarts

## Alternatives Considered

### Single JSON file for everything
- Pros: simplest to start
- Cons: impossible to scale cleanly; hard to separate assets, logs, secrets, and indexes
- Rejected

### Server-hosted storage
- Pros: centralized
- Cons: too much load on the server; conflicts with local-first desktop execution
- Rejected

### User-installed database server
- Pros: familiar to some backend workflows
- Cons: unacceptable for desktop users; adds setup burden and support cost
- Rejected

### Monolithic embedded database only
- Pros: structured data management
- Cons: still needs a file layout for artifacts, logs, and indexes
- Rejected as the only storage layer

## Consequences
- Desktop storage becomes explicit and predictable
- Knowledge, files, and runtime data stay on the user machine
- The server remains a control plane, not a bulk data store
- Later embedded database choice can be added inside `db/` without changing the broader topology
- Backup and migration can be handled per workspace
