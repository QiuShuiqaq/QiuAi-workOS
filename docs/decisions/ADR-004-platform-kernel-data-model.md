# ADR-004: Platform Kernel Data Model

## Status

Accepted

## Date

2026-07-18

## Context

The first persistent layer must support QiuAI WorkOS as a commercial platform rather than a single AI workflow product.

The core needs stable records for:

- Accounts
- Tenants
- Workspaces
- Enterprise organizations
- Departments
- Workspace members
- Plans
- Subscriptions
- Entitlements
- Usage meters

## Decision

Use Prisma with PostgreSQL and UUID primary keys for platform kernel tables.

The first schema slice includes:

- `Account`
- `Tenant`
- `Workspace`
- `WorkspaceMember`
- `Organization`
- `Department`
- `Plan`
- `Entitlement`
- `Subscription`
- `UsageMeter`

Database table names use snake_case plural names through Prisma `@@map`. Application model names use domain terms.

## Rules

- `Workspace` is the primary runtime context for user-visible data.
- Personal Free maps to a Personal Workspace.
- Enterprise plans map to an Enterprise Workspace with one Organization.
- Departments are only valid under Enterprise Organizations.
- Commercial limits are modeled through Plan, Subscription, Entitlement, and UsageMeter.
- Server-side application services must enforce entitlement checks before restricted write operations.

## Consequences

- Role and Task tables will be added in later schema slices after the workspace and entitlement boundaries are stable.
- Prisma migrations must be reviewed because they define commercial and tenant isolation boundaries.
- Future API endpoints should use workspace context explicitly rather than infer it from UI state.
