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
