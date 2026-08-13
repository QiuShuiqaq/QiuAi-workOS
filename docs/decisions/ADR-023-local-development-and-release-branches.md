# ADR-023: Separate Local Development from Production Releases

## Status

Accepted

## Date

2026-08-10

## Context

QiuAI WorkOS is developed on a Windows workstation while real enterprise users use the production services hosted on the ECS server. Treating local changes as production-ready caused two problems:

- local PC testing inherited production-style plan and installation limits;
- updating web or admin code during unfinished development could affect real users.

The project needs a small, durable release boundary without introducing a separate staging server at the current scale.

## Decision

Use two long-lived Git branches and two isolated runtime environments:

- `dev` is the daily development branch and is tested only against the local API, local database, local consoles, and local PC desktop runtime.
- `main` contains only verified release commits. The production server pulls only `main`; Windows release packages are built from the same verified `main` commit.
- Local PostgreSQL, Redis, logs, desktop development state, caches, and temporary files live under `F:\Dev\projects\qiuai-workos`. They are never committed.
- The local API may enable `WORKOS_LOCAL_DEV_UNLIMITED=true` only when it is explicitly configured as a local, development, loopback process. In that mode, desktop template catalog access and per-device installation limits are unrestricted for local testing.
- Production keeps the switch disabled. Production authorization, subscriptions, device tokens, and quotas remain server-side requirements.
- A deployment continues to run migrations and managed catalog synchronization, but does not run the full seed unless explicitly requested.

## Alternatives Considered

### Develop directly on `main`

- Pros: fewer Git commands.
- Cons: unfinished code can be deployed accidentally and is difficult to distinguish from a releasable build.
- Rejected: the production boundary is too weak for an installed desktop product.

### Add a remote staging server now

- Pros: environment parity with production.
- Cons: adds cost, credentials, deployment work, and another database to operate.
- Rejected for now: a local Docker-backed environment is sufficient until collaboration or release volume requires a shared staging server.

### Bypass authorization only in the PC renderer

- Pros: small client-only change.
- Cons: not reliable, does not cover server synchronization, and could be copied into a production build.
- Rejected: local unlimited access is enforced by the local server and requires multiple environment checks.

## Consequences

- Pushes to `dev` never require a server update.
- A release requires a deliberate `dev` to `main` merge, production deployment, production verification, and then desktop packaging.
- Developers can test every published digital employee and digital factory locally without editing plan records or binding a test enterprise.
- The local runtime data directory is disposable development state. It must not contain production data or production model credentials.
