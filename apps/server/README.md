# Server

Main QiuAI WorkOS API server.

Architecture direction:

- Modular monolith first
- TypeScript
- Contract-first API
- Server-side entitlement enforcement
- Future extraction path for execution, model gateway, and workers

Planned module layout lives under `src/modules`.

## First Endpoint

After dependencies are installed:

```bash
npm run dev -w @qiuai/server
```

Health check:

```text
GET /api/v1/health
```

Kernel status:

```text
GET /api/v1/kernel/status
```

Entitlement check:

```text
POST /api/v1/entitlements/check
```

Enterprise workspace overview:

```text
GET /api/v1/workspaces/:workspaceId/organization/overview
```

## Database Commands

Platform kernel persistence uses Prisma migrations under `prisma/migrations`.

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

The server defaults to `WORKOS_PERSISTENCE_MODE=mock`. Set `WORKOS_PERSISTENCE_MODE=database` after the PostgreSQL database is created, migrated, and seeded.

Set `WORKOS_BOOTSTRAP_ADMIN_PASSWORD` before running `npm run db:seed` to create the first `admin@qiuai.local` login password.
