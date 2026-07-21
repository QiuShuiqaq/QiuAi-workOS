# ADR-013: Role templates are published as versioned skill packages

## Status
Accepted

## Date
2026-07-20

## Context
QiuAI WorkOS needs a default catalog of mature role templates that can cover common enterprise demand quickly during customer onboarding.

The product constraints are:
- The server should remain a control plane and not store heavy knowledge, files, or execution assets.
- The PC desktop app is the primary enterprise operating surface.
- Normal enterprise users should not face a workflow canvas or a Dify-like builder UI.
- The current codebase already has `RoleTemplate` and `RoleInstance`, but the desktop side still treats templates as mostly local demo data.
- The product needs reusable templates that can be installed repeatedly across enterprises without re-authoring every job from scratch.

The core architectural question is how to model a reusable "job template" so it can be shipped quickly, configured minimally, and still stay stable across versions.

## Decision
Model the product as three layers:

1. **Skill**: the atomic reusable capability unit.
2. **RoleTemplate**: a versioned, publishable catalog item composed from skills, tools, models, knowledge defaults, approval policy, and KPI expectations.
3. **RoleInstance**: an enterprise-installed runtime copy with workspace-specific overrides.

Rules:
- A Skill is not a UI shell and not a workflow product. It is a capability pack with instructions, tool needs, input/output expectations, and guardrails.
- A RoleTemplate may compose multiple skills, but it must remain a business-facing product object, not a free-form canvas.
- A RoleTemplate must be versioned once published. Enterprise installations pin to a specific template version.
- Desktop users install a RoleTemplate as a RolePackageManifest and then tune only the enterprise-specific diff.
- `admin-console` owns platform-level template publishing and review.
- `web-console` owns enterprise ops and template assignment.
- `pc-app` owns installation, local configuration, execution, and local knowledge/tool binding.
- Dify-style workflow graphs may be used as an internal implementation reference or adapter later, but not as the primary user-facing shell.

The initial template catalog should be curated, not huge. Start with a small set of high-frequency job families:
- customer follow-up
- contract review / legal triage
- content operations
- sales assistance
- HR recruiting
- finance invoice / reimbursement
- admin / executive assistant
- data research / reporting

Each template should carry:
- business goal
- default skills
- required tools
- required knowledge sources
- default model profile types
- approval policy
- output artifacts
- KPI expectations
- install notes

## Alternatives Considered

### Use Dify as the product shell
- Pros: fast to borrow existing workflow and tool concepts.
- Cons: workflow-first UI does not match the product boundary; it would make the desktop experience harder to explain and harder to standardize.
- Rejected: Dify should remain a reference or adapter target, not the core shell.

### Keep hardcoded templates in the desktop app
- Pros: quickest short-term path.
- Cons: templates become impossible to govern, version, publish, or reuse across customers.
- Rejected: not suitable for enterprise delivery.

### Expose a free-form prompt builder to enterprise users
- Pros: flexible.
- Cons: too much variance, too much support cost, and weak repeatability.
- Rejected: the product needs installable job products, not arbitrary prompt assemblies.

## Consequences
- The schema and API will need a versioned template catalog, not just a static list of templates.
- Desktop install flows will need to consume template snapshots rather than ad hoc local demo data.
- Template publishing becomes a governed operation, which fits `admin-console`.
- Role installation becomes faster because the user starts from a composed default, then only fills enterprise-specific overrides.
- The server can stay lean because the template catalog stores metadata and policy, while heavy knowledge and runtime state stay local on the PC.

