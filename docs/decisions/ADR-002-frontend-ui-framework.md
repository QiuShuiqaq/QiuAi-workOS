# ADR-002: Use Ant Design Ecosystem for Product UI

## Status

Accepted

## Date

2026-07-18

## Context

QiuAI WorkOS needs enterprise-grade interfaces for:

- Workspace switching
- Enterprise organization and department management
- Role installation and configuration
- Task center
- Approval center
- Audit logs
- Cost and KPI dashboards
- Model, tool, and knowledge configuration

The UI system must support Web Console, future Electron desktop client, and mobile client without fragmenting product language.

## Decision

Use Ant Design as the primary UI ecosystem:

- Ant Design for core components
- Ant Design Pro layout patterns for enterprise console structure
- Ant Design X for AI interaction and streaming surfaces
- Ant Design Mobile only for mobile H5 scenarios when needed
- React Native + Expo for native mobile app UI
- `packages/ui` for QiuAI business components
- `packages/design-tokens` for shared theme tokens

QiuAI pages should prefer business components such as `QiuPage`, `QiuStatusTag`, `QiuWorkspaceSwitcher`, and future `QiuTable`, `QiuForm`, `QiuRoleCard`, and `QiuTaskTimeline`.

## Alternatives Considered

### shadcn/ui

- Pros: Modern, flexible, good for custom SaaS interfaces
- Cons: More product-level component and enterprise admin patterns must be designed manually
- Rejected: QiuAI WorkOS needs dense enterprise operations more than highly custom marketing-style UI.

### Generic dashboard templates

- Pros: Fast visual start
- Cons: Weak long-term consistency, usually page-oriented rather than domain-oriented
- Rejected: The platform needs a durable design system, not a one-off dashboard skin.

### Refine or React Admin

- Pros: Strong CRUD productivity
- Cons: Product may become CRUD-admin-shaped instead of WorkOS-shaped
- Rejected: Useful references, but not the primary UI architecture.

## Consequences

- `packages/ui` should wrap recurring Ant Design compositions into QiuAI business components.
- Business pages should not directly copy large template pages.
- AI-specific UI should use Ant Design X only where it naturally fits.
- Mobile UI can share domain and API contracts, but should use mobile-native interaction patterns.
