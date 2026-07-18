# ADR-001: Platform Technical Baseline

## Status

Accepted

## Date

2026-07-18

## Context

QiuAI WorkOS is a commercial Enterprise Digital Workforce Platform. The system must support:

- Personal Free and paid Enterprise plans
- Multi-tenant workspace boundaries
- Enterprise Organization and Department management
- Stable API contracts for Web, PC, and Mobile clients
- Future deployment to a user-owned server
- AI execution through replaceable runtime adapters

The project should avoid scattering development tools and generated files outside the repository. Local tooling caches should remain project-scoped where possible.

## Decision

Use the following baseline:

- Monorepo with npm workspaces
- TypeScript across server, web, shared packages, Electron, and mobile
- Modular monolith backend first
- NestJS + Fastify for the main API server
- PostgreSQL as primary database
- Prisma as ORM and migration tool
- Redis for queues, cache, and execution coordination
- Docker Compose as the first deployment and local infrastructure target
- Next.js + Ant Design for Web Console
- Ant Design X for AI interaction surfaces
- Electron for PC desktop client
- React Native + Expo for mobile client
- Mock Execution Runtime first, then Dify Adapter
- Private GitHub repository for commercial development
- Manual Enterprise activation first; payment gateway integration later

## Alternatives Considered

### Fastify-only backend

- Pros: Lightweight and direct
- Cons: More internal conventions must be built manually for modules, validation, dependency injection, guards, and OpenAPI
- Rejected: NestJS gives stronger structure for a long-lived enterprise platform.

### Microservices from day one

- Pros: Explicit service boundaries
- Cons: More deployment, observability, contract, and distributed transaction overhead too early
- Rejected: Modular monolith gives stable boundaries while preserving future extraction paths.

### MySQL

- Pros: Common and easy to deploy
- Cons: PostgreSQL is stronger for relational modeling, JSONB configuration, full-text search, and future analytical queries
- Rejected: PostgreSQL is a better fit for workspace, role, task, audit, and entitlement data.

### Full Dify-based product

- Pros: Faster access to workflow, agent, RAG, and model orchestration
- Cons: Product core would be shaped by Dify's App/Workflow abstractions instead of QiuAI's Role/Workspace/Enterprise abstractions
- Rejected: Dify should be an execution adapter, not the platform core.

## Consequences

- Server code must enforce entitlement, IAM, tenant, and workspace rules.
- Web, PC, and mobile clients must consume shared API contracts rather than duplicate business rules.
- Runtime execution must be behind an adapter interface.
- Docker Compose deployment files should use project-relative paths and environment variables.
- Dependency installation should use project-local npm wrapper scripts on Windows.
