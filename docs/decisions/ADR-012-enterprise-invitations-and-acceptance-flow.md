# ADR-012: Enterprise Invitations and Token-Based Acceptance

## Status
Accepted

## Date
2026-07-20

## Context
QiuAI WorkOS needs a production-grade enterprise entry flow.
Requirements:
- No public signup
- No separate password-reset flow for the first version
- Workspace owners/admins must be able to invite members
- Invited users must be able to join without extra database setup
- The flow must work on the web console and stay compatible with the Windows desktop-first product plan

## Decision
Use a workspace-scoped invitation model with token-based acceptance.

Key properties:
- Invitations are created only by authenticated workspace owners/admins
- The invite link is a public, tokenized URL on the web console
- Accepting an invitation creates or reuses the account, sets a password when needed, creates workspace membership, and signs the user in
- Invitation state is stored in PostgreSQL and exposed through typed REST APIs
- The enterprise page shows invitation management alongside departments and members

## Alternatives Considered

### Public signup
- Rejected: conflicts with enterprise-controlled onboarding and increases support risk

### Admin-console-only invite management
- Rejected: admin-console is reserved for platform-level operations, not customer workspace operations

### Manual account creation on the server
- Rejected: too much operational overhead and poor customer experience

## Consequences
- The product can onboard enterprise users without exposing public registration
- Invitation links become a first-class public entry surface
- Backend must keep invitation tokens secure and one-time
- The enterprise console now owns member onboarding, which matches the product boundary
