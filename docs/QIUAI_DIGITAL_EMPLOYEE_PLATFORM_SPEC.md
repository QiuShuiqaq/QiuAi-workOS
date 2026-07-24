# Spec: QiuAI Digital Employee Platform

## Objective
Build QiuAI WorkOS into a controlled digital-employee platform with three stable user surfaces:

- `admin-console` owns template authoring, template testing, publication, and platform operations.
- `web-console` owns enterprise administration only: members, departments, bindings, usage, audit, and enterprise data.
- `pc-app` is the primary enterprise execution surface: install authorized employees, configure local runtime, run tasks, inspect artifacts/logs, and sync summaries.

The server remains a lean control plane. Heavy files, local knowledge, generated artifacts, logs, and desktop secrets stay on the PC.

Success means:

1. Platform operators can create, version, test, publish, archive, and authorize digital-employee templates from `admin-console`.
2. Enterprise users can only consume templates that the platform has published and authorized for their plan/workspace.
3. The PC app only shows installed or installable employees that are allowed for the current workspace.
4. Ordinary enterprise users do not need to face a workflow canvas.
5. A task can flow end-to-end: template -> install -> configure -> execute locally -> generate artifact -> sync summary.

## Assumptions

- Windows-only desktop remains the first production target.
- Offline mode is not supported.
- Users do not install or configure their own database server.
- Heavy assets and local knowledge remain on the desktop device.
- Dify and Coze are product references, not the customer-facing shell.
- Workflow canvas behavior belongs in `admin-console`, not in the normal enterprise PC surface.

## Tech Stack

- Electron + React + TypeScript for `pc-app`
- Next.js + React + TypeScript for `admin-console` and `web-console`
- NestJS + Prisma + PostgreSQL for `server`
- `sql.js` for the current embedded desktop state layer
- Shared contracts in `packages/api-contract` and shared domain objects in `packages/domain`

## Commands

Dev server:

- API: `npm run dev:server`
- Web console: `npm run dev:web`
- Admin console: `npm run dev:admin`
- PC app: `npm run dev:pc`

Validation:

- Build all: `npm run build`
- Typecheck all: `npm run typecheck`
- Test all: `npm run test`
- Desktop smoke: `npm run check:smoke`
- Admin flow smoke: `npm run check:admin-flow`
- Deploy readiness: `npm run check:deploy`

## Project Structure

Current and target ownership:

```text
apps/
  admin-console/     # platform template factory, template testing, publish and authorization
  web-console/       # enterprise portal, member/org/runtime management
  pc-app/            # desktop execution, local runtime, tool calls, artifacts, sync
  server/            # control plane, template catalog, authorization, billing, audit
  mobile-app/        # lightweight approvals and commands

packages/
  domain/            # role templates, runtime contracts, product vocabulary
  api-contract/      # typed request/response contracts
  api-client/        # client gateway for server APIs
  ui/               # reusable UI primitives
  design-tokens/     # shared design system tokens
  utils/             # shared helpers

docs/
  decisions/        # ADRs
  QIUAI_DIGITAL_EMPLOYEE_PLATFORM_SPEC.md
```

Important current rule:

- `packages/domain/src/role-template-catalog.ts` may remain as a curated fallback seed, but production template authority must move to `admin-console` + `server`.

## Code Style

Use domain-first names and typed contracts. Prefer explicit enums and stable records over ad hoc JSON blobs.

```ts
export interface RoleTemplatePublishRequest {
  templateId: string;
  version: string;
  status: 'draft' | 'review' | 'published' | 'archived';
  allowedPlanCodes: string[];
  visibleWorkspaceIds: string[];
  notes?: string;
}
```

Rules:

- Names should describe business meaning first, implementation detail second.
- Every cross-surface boundary must use a shared TypeScript type.
- Published templates must be versioned and pinned.
- PC-local heavy data must not be promoted to server storage just for convenience.

## Testing Strategy

Current baseline:

- Node test runner with `tsx` for unit/integration tests.
- Existing smoke scripts for end-to-end sanity checks.

Planned coverage:

- Unit tests for template schema, versioning rules, visibility filtering, and runtime authorization.
- Integration tests for template publish -> server catalog -> PC install -> local execution -> summary sync.
- Desktop tests for role installation, tool binding, artifact generation, and local state persistence.
- Admin tests for template CRUD, draft/publish transitions, and authorization targeting.

Verification targets:

- Template publication updates are visible to the right workspace only.
- PC installs only authorized employees.
- Local execution produces logs and artifacts.
- Server sees summaries, audit metadata, and sync state only.

## Boundaries

- Always: keep template authority in `admin-console`, keep heavy data local on PC, keep the server lean, keep all cross-surface data typed, pin published template versions.
- Ask first: adding a new local database engine, changing the template publication model, exposing workflow canvas to enterprise users, adding new runtime dependencies, changing sync semantics.
- Never: store raw secrets or bulk knowledge on the server, force users to install their own database, expose workflow builder to normal enterprise users, duplicate entitlement logic in the client, make PC execution depend on server-hosted heavy assets.

## Delivery Phases

### Phase 1: Template Factory Boundary
- Add authoritative template CRUD and publication flow in `admin-console` and `server`.
- Keep `web-console` read-only for enterprise runtime visibility.
- Make `pc-app` consume only authorized templates from the server.

### Phase 2: Template Testing
- Add a test harness in `admin-console` for model planning, tool-call validation, and template smoke execution.
- Surface logs, artifacts, and failures clearly.

### Phase 3: PC Runtime Consumption
- Install and pin published templates on the desktop.
- Execute tasks locally with visible input -> processing -> output traces.

### Phase 4: Compatibility and Expansion
- Add MCP/OpenAPI tool ingestion, richer local knowledge retrieval, and stronger workflow composition only after the core loop is stable.

## Success Criteria

- `admin-console` can create and edit a digital-employee template.
- `admin-console` can publish, archive, and authorize a template version.
- `server` can expose the authorized template catalog per workspace.
- `pc-app` can list only authorized templates, install one, and execute a task with logs and artifacts.
- `web-console` cannot author templates.
- A complete test run can be performed without hand-editing code between steps.

## Open Questions

- Should the first template test harness be mock-only, or should it support a real PC-backed execution mode from day one?
- Should `server` store only published snapshots, or also draft/review states?
- Should `defaultRoleTemplateCatalog` remain as a dev fallback after admin-managed templates exist, or be reduced to seed data only?
- Which parts of the internal workflow canvas should be form-driven versus graph-driven in `admin-console`?
