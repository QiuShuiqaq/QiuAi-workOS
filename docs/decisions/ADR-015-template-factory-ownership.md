# ADR-015: Admin console owns digital-employee template authoring, testing, and publication

## Status
Accepted

## Date
2026-07-24

## Context

QiuAI WorkOS is moving from a demo-like multi-surface shell into a controlled digital-employee platform.

The product boundaries are now clear:

- `admin-console` is the platform operator surface.
- `web-console` is the enterprise operations surface.
- `pc-app` is the primary execution surface for enterprise users.
- `server` remains a lean control plane.

The system already has curated template data in `packages/domain/src/role-template-catalog.ts` and a versioned `RoleTemplate` / `RoleInstance` data model on the server. However, if template creation stays scattered between code, PC runtime defaults, and enterprise surfaces, the product will drift into an ungoverned prompt-builder pattern.

The product needs one authoritative place where platform operators can:

- author a digital-employee template
- test the template
- publish a version
- assign plan/workspace visibility
- archive older versions without breaking installed enterprise instances

## Decision

`admin-console` is the authoritative owner of digital-employee template authoring, testing, publication, and authorization.

Rules:

1. Platform operators create and edit template drafts in `admin-console`.
2. Template testing is also initiated from `admin-console`.
3. Published templates are versioned and pinned for enterprise installs.
4. `web-console` does not author or test templates; it only manages enterprise-side data and visibility.
5. `pc-app` does not own template generation logic; it consumes the server-authorized catalog and installs allowed templates locally.
6. The server stores published template state, authorization scope, and summary metadata, but not heavyweight local assets.
7. Dify/Coze-like workflow concepts may be used internally inside `admin-console`, but they are not the normal enterprise user shell.

The curated fallback catalog in `packages/domain/src/role-template-catalog.ts` may remain for development and initial seeding, but it is not the production source of truth once the template factory workflow is live.

## Alternatives Considered

### Keep templates hardcoded in the shared domain package
- Pros: simplest bootstrap.
- Cons: impossible to govern, version, test, authorize, or deprecate cleanly.
- Rejected: not suitable for a real platform.

### Let `web-console` own template authoring
- Pros: enterprise admins could configure everything in one place.
- Cons: mixes enterprise operations with platform operations and weakens platform governance.
- Rejected: `web-console` should stay enterprise-facing only.

### Let `pc-app` self-manage templates
- Pros: local execution could feel flexible.
- Cons: fragments template truth across end-user devices and makes support harder.
- Rejected: the PC should execute templates, not govern them.

## Consequences

- The platform gains a single template governance point.
- Enterprise installs become deterministic because versions are pinned.
- Template testing can evolve without exposing builder complexity to normal users.
- The server remains lightweight because heavy runtime assets still stay on the PC.
- Future compatibility layers for Dify-like workflows, MCP tools, and template import/export become easier to add in one place.
