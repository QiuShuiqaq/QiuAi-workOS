# ADR-005: Separate WorkOS Production Boundary on `qiuaihub.com`

## Status

Accepted

## Date

2026-07-19

## Context

QiuAI WorkOS must ship as a commercial product while remaining operationally separate from the existing `qiuaihub.com` platform.

The current server already hosts legacy services on the same ECS machine, and the WorkOS first version needs:

- its own public hostname
- its own PM2 processes
- its own internal ports
- a same-origin browser API path
- a separate database namespace when persistence is enabled
- no secret copying from the legacy `qiuai-platform` repository

The deployment boundary must stay stable so later Web, Electron, and mobile clients can reuse the same server contracts without rethinking the host layout.

## Decision

Deploy QiuAI WorkOS as an independent service on the existing `qiuaihub.com` infrastructure with this shape:

```text
workos.qiuaihub.com
  -> Nginx
  -> 127.0.0.1:3100 Web Console
  -> /api/v1 proxy
  -> 127.0.0.1:4100 API Server
```

Use these operating rules:

- Keep WorkOS under `/opt/qiuai-workos` on the server.
- Keep WorkOS PM2 process names distinct from the legacy platform.
- Keep WorkOS ports distinct from the legacy platform.
- Keep WorkOS database and credentials distinct from the legacy platform.
- Keep browser API calls same-origin through `/api/v1`.
- Clear inherited shell `DATABASE_URL` and `REDIS_URL` before starting PM2.

## Alternatives Considered

### Reuse the existing `qiuaihub.com` root API and paths

- Pros: fewer DNS records
- Cons: route collisions, unclear ownership, and higher risk to the existing platform
- Rejected: WorkOS must not inherit the legacy platform's public API shape

### Deploy WorkOS on a separate server

- Pros: hard isolation
- Cons: unnecessary infrastructure split for the current stage
- Rejected: the user already has suitable ECS capacity and wants to reuse it

### Put WorkOS behind Dify as the production boundary

- Pros: faster agent/workflow iteration
- Cons: the product boundary would be defined by an execution tool, not by QiuAI's enterprise operating model
- Rejected: Dify remains an execution adapter, not the platform boundary

## Consequences

- `docs/QIUAIHUB_DEPLOYMENT.md` becomes the canonical production deployment guide for WorkOS.
- `deploy/alicloud-ecs/*` must remain aligned with this hostname, port, and process layout.
- Future billing callback paths must stay under `workos.qiuaihub.com` and not mix with the legacy platform.
- Server-side verification should use `127.0.0.1:4100`, `127.0.0.1:3100`, and `https://workos.qiuaihub.com`.

