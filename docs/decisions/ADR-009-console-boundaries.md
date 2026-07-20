# ADR-009: Define console boundaries for admin, web, PC, and mobile

## Status
Accepted

## Date
2026-07-20

## Context
QiuAI WorkOS is a multi-surface product:

- `admin-console` for platform operators
- `web-console` for enterprise owners and normal enterprise users
- `pc-app` for the primary digital-employee workbench
- `mobile-app` for lightweight command and approval flows
- `server` as the control plane

The project must stay architecture-first, with a small server footprint and desktop-local heavy assets. The user-facing boundaries need to stay stable so later work does not drift into ambiguous UI ownership.

## Decision

We will use the following canonical surface split:

### `admin-console`
Internal platform operations only.

### `web-console`
Enterprise portal and control console.

### `pc-app`
Primary desktop runtime for digital employees.

### `mobile-app`
Lightweight mobile command and approval surface.

### `server`
Control plane only.

We will also treat Dify-like capabilities as internal execution building blocks, not the product shell for ordinary enterprise users.

## Alternatives Considered

### One large web application with role-based menus
- Pros: simplest routing
- Cons: boundaries blur quickly; enterprise execution and platform ops become mixed

### Dify-style UI as the primary shell
- Pros: faster for technical prototyping
- Cons: the product becomes tool-centric instead of role-centric

### Server-centric storage and execution
- Pros: easy to reason about at first
- Cons: too much heavy data on a small server; conflicts with the local-first desktop strategy

## Consequences

- App responsibilities are stable and easy to explain
- Web can stay focused on portal and governance views
- PC can become the main enterprise operating surface
- Server stays lightweight and cheaper to run
- Future extraction of execution, tools, and model adapters becomes easier

