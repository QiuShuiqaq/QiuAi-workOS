# PC Desktop Runtime Spec: QiuAI Digital Employee

## Objective
Build the PC desktop client as the primary enterprise operating surface for QiuAI WorkOS. The desktop app is not a flowchart editor and not a chat shell. It is the place where an enterprise installs, configures, runs, and monitors digital employees.

The web console remains the personal operations console for the owner/admin. The mobile app remains a lightweight command and approval surface. The server remains a control plane for accounts, workspaces, plans, audits, billing, and summarized execution state.

Success means an enterprise user can:
- install a role package on desktop
- configure model providers and tool access without building raw workflows
- bind local knowledge and local assets
- run a digital employee locally
- inspect logs, artifacts, and costs on desktop
- sync only the necessary metadata and summaries back to the server

## Core Product Shape

### Desktop responsibilities
- Role package installation and upgrade
- Model provider onboarding and credential validation
- Model profile selection and fallback policy
- Tool registration and permission scoping
- Local knowledge binding and indexing
- Task launch, monitoring, retry, and cancellation
- Artifact creation and local storage
- Summary sync to the server

### Server responsibilities
- Authentication and workspace membership
- Tenant, organization, and department metadata
- Plan, subscription, entitlement, and billing
- Role template catalog and role instance summaries
- Audit log, cost summary, and usage summary
- Cross-device sync state

### Web responsibilities
- Personal operations console
- My account, billing, and deployment visibility
- Global runtime overview
- Operational audit and financial control

## Tech Stack
- Electron for the desktop shell
- TypeScript across shared packages and clients
- Shared domain and API contracts from `packages/domain` and `packages/api-contract`
- Shared UI primitives from `packages/ui`
- Existing NestJS API server remains the backend control plane
- Local persistence is a desktop concern and should be chosen separately from server storage

## Commands
- Dev desktop shell: `npm run dev:pc`
- Dev web console: `npm run dev:web`
- Dev API server: `npm run dev:server`
- Build everything: `npm run build`
- Run tests: `npm test`
- Typecheck all workspaces: `npm run typecheck`
- Desktop-specific build later: `npm run build -w @qiuai/pc-app`
- Deployment readiness: `npm run check:deploy`
- Smoke check: `npm run check:smoke`

## Project Structure

Target structure for the desktop client:

```text
apps/pc-app/
  src/
    main/            # Electron main process, window, lifecycle, updates
    preload/         # Safe bridge into renderer
    renderer/        # UI entry, routes, layout, state
    features/
      role-packages/ # install, update, validate, version compare
      model-center/  # provider, credential, profile, fallback
      tool-center/   # tool registry, permissions, local bridges
      knowledge/     # local assets, indexing, search binding
      runtime/       # task runner, logs, artifacts, retries
      sync/          # server summary sync, conflict handling
      settings/      # device settings, encryption, update policy
    shared/          # local types, helpers, IPC contracts
```

Shared repo boundaries:
- `packages/domain` holds domain language and invariants
- `packages/api-contract` holds server-facing contracts
- `packages/api-client` stays the client-side gateway for server APIs
- `packages/ui` remains reusable UI primitives, not business logic

## Code Style
- Domain names come first: `RolePackage`, `ModelProfile`, `ToolManifest`, `LocalRuntime`, `TaskRun`
- All desktop/server communication must use typed contracts
- UI should describe jobs and employees, not workflows and nodes
- Secrets and local assets stay off the server unless explicitly summarized

Example:

```ts
export interface ToolManifest {
  id: string;
  name: string;
  scope: 'local' | 'server';
  capabilities: Array<'web_search' | 'document_edit' | 'presentation_edit' | 'file_extract'>;
}

export interface RolePackageManifest {
  roleCode: string;
  version: string;
  modelProfileIds: string[];
  toolIds: string[];
  knowledgeBindings: string[];
}
```

## Testing Strategy
- Unit tests: manifest parsing, role package validation, model profile resolution, tool permission checks
- Integration tests: main/preload/renderer bridge, task execution loop, sync payloads
- End-to-end tests: install a role package, configure models, run a local task, inspect logs and artifacts
- Contract tests: desktop client must not drift from `@qiuai/api-contract`

Verification should cover:
- desktop launch
- role package installation
- tool registration
- local task execution
- summary sync
- server-side visibility of synced summaries

## Boundaries
- Always: keep heavy assets on the desktop, keep the server as control plane, use typed contracts, keep Dify-like concepts behind QiuAI abstractions
- Ask first: new background services, new local database engine, new runtime dependency, new auto-update flow, new encryption scheme, new tool sandbox
- Never: store private keys or bulk knowledge on the server, expose workflow canvas to normal enterprise users, duplicate entitlement logic in the client, couple the desktop app to a single execution framework

## Success Criteria
- A desktop user can install a role package from a template
- The user can choose and validate a model provider
- The user can register and enable tools such as web search and office document operations
- The user can launch a digital employee locally and see logs, artifacts, and cost records
- The server receives only summaries, status, and audit metadata
- The web console can show enterprise runtime state without owning execution

## Open Questions
- Local persistence choice: SQLite, embedded store, or file-backed structured store
- Office document strategy: direct file generation, installed Office automation, or remote connector
- Tool sandboxing model: native child process, isolated worker, or external bridge
- Sync conflict model when the same role changes on multiple devices
- Whether to offer Dify import/export as a compatibility path later

## Implementation Plan

### Phase 1: Boundary and contracts
- Define `RolePackageManifest`, `ModelProfile`, `ToolManifest`, and local runtime contract
- Add desktop/server sync payload shapes to shared contracts
- Write validation rules for package install and model/tool registration

### Phase 2: Desktop shell foundation
- Scaffold Electron main, preload, and renderer entry points
- Establish secure IPC and session bootstrap
- Load server summary data and local runtime state separately

### Phase 3: Role package and model center
- Build install/update flow for role packages
- Build model provider onboarding and profile selection
- Add fallback and policy controls

### Phase 4: Tool center
- Build tool registry and permission model
- Add local bridges for web search, document editing, and file operations
- Add audit records for tool usage

### Phase 5: Local runtime
- Build task execution loop and progress events
- Create logs, artifacts, and cost records locally
- Sync summarized results back to the server

### Phase 6: Hardening
- Add encryption for local secrets
- Add packaging and update strategy
- Add recovery and backup guidance

### Checkpoints
- After Phase 2: desktop launches and authenticates
- After Phase 4: tools can be registered and invoked
- After Phase 5: a role can run end-to-end locally
- After Phase 6: the desktop flow is production-oriented and recoverable

