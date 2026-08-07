# ADR-021: Separate production runtime data from code-managed catalogs

## Status
Accepted

## Date
2026-08-07

## Context

The production deployment script previously ran the complete Prisma seed after every migration. The seed uses updates and upserts for plans and entitlements, so values edited in `admin-console` were restored to the defaults stored in code during each successful deployment.

The same seed also publishes the curated default digital-employee and digital-factory templates. Those templates are currently developed in the repository and deployed through Codex-assisted releases, so they still need deterministic synchronization.

## Decision

Production data is divided by ownership:

1. Plans, entitlements, accounts, workspaces, organization data, subscriptions, usage, and billing records are runtime data. The full seed may initialize them once, but normal deployments must not overwrite them.
2. Curated default role templates and default asset definitions are code-managed catalogs. Normal deployments synchronize them from the repository.
3. A code-managed template is identified by its stable catalog `templateId`. Synchronization may overwrite the matching default template.
4. Templates created separately in `admin-console` use different IDs and are not modified by catalog synchronization.
5. New default digital employees or factories use new IDs. Existing IDs are reused only for an intentional update to that template.
6. Installed role instances retain their installed template version and copied capability fields; publishing a newer default template does not rewrite those instance records.
7. Deployment readiness checks require the commercial plan records to exist, but do not enforce mutable prices, status, currency, or entitlement values from the source catalog.

The production deployment command runs migrations and the managed-catalog synchronization by default. The complete bootstrap seed is available only through the explicit `WORKOS_RUN_FULL_SEED=true` switch.

## Consequences

- Admin-console changes to plans and entitlements survive server deployments.
- Default digital-employee and digital-factory templates continue to update with code releases.
- Custom admin-console templates remain isolated from repository catalog updates.
- Initial server provisioning must run the full seed once.
- Operators must not leave `WORKOS_RUN_FULL_SEED=true` enabled after bootstrap.
