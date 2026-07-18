# ADR-003: Enforce Commercial Entitlements on the Server

## Status

Accepted

## Date

2026-07-18

## Context

QiuAI WorkOS has Personal Free and paid Enterprise plans. Personal Free allows basic use and a small number of AI employees. Enterprise plans support Organization, Department, members, IAM, approval, audit, cost budget, and enterprise dashboards.

Because the product will have Web, PC, and mobile clients, entitlement checks cannot be duplicated in each client.

## Decision

Use server-side entitlement enforcement:

- `Workspace` is the primary runtime context.
- Personal Free maps to `Personal Workspace`.
- Enterprise plans map to `Enterprise Workspace` with `Organization`.
- `Department` is Enterprise-only.
- `Plan`, `Subscription`, `Entitlement`, and `UsageMeter` define commercial capabilities.
- All restricted write operations must call entitlement checks on the server.
- Clients may display upgrade prompts, but cannot be the authority for enforcement.

## Restricted Operations

Examples:

- Create role instance
- Create task after monthly quota is exhausted
- Create department
- Invite member
- Enable approval policy
- Enable audit log
- Connect advanced tool
- Configure cost budget

## Consequences

- API errors must use stable structured codes such as `PLAN_UPGRADE_REQUIRED`, `QUOTA_EXCEEDED`, and `SUBSCRIPTION_INACTIVE`.
- Entitlement checks belong in backend application services, guards, or command handlers.
- Frontend components should consume entitlement state from API responses.
- Tests must cover Personal Free denial paths and Enterprise allowed paths.
