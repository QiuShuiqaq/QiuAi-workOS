# ADR-006: Billing and Payment Boundary

## Status

Accepted

## Date

2026-07-19

## Context

QiuAI WorkOS is a commercial product with Personal Free and paid Enterprise plans. The platform needs billing data that is stable before real payment signing is enabled.

Key constraints:

- WorkOS must remain independent from the legacy `qiuai-platform` payment callbacks.
- Web, Electron, and mobile clients must use the same billing API contract.
- Real Alipay secrets must never be committed or copied into chat.
- The system must be able to show subscription, billing account, payment configuration, and order state before external payment is fully enabled.

## Decision

Add a dedicated billing boundary under the WorkOS platform kernel:

- `BillingAccount` stores workspace billing identity and preferred provider.
- `BillingOrder` stores WorkOS business orders.
- `PaymentTransaction` stores provider-level payment attempts and notifications.
- Payment provider configuration is reported as status only, never as secret values.
- Alipay callback paths are reserved under `workos.qiuaihub.com`:
  - `/api/v1/billing/alipay/notify`
  - `/billing/alipay/return`

The first implementation creates internal pending orders and initialized payment transactions. It does not generate real Alipay payment URLs until signing and callback verification are implemented.

## Alternatives Considered

### Put payment fields directly on `Subscription`

- Pros: fewer tables.
- Cons: subscriptions would mix entitlement state with provider payment state.
- Rejected: order and transaction history must be auditable independently.

### Reuse the legacy platform payment callback paths

- Pros: fewer payment console settings.
- Cons: route ownership becomes ambiguous and risks breaking the existing platform.
- Rejected: WorkOS has its own hostname and API boundary.

### Implement Alipay signing immediately

- Pros: faster path to live payment.
- Cons: increases secret-handling risk before the billing model and deployment flow are verified.
- Rejected for this slice: signing should be added after environment configuration and callback verification are reviewed.

## Consequences

- Billing UI can show subscription state, billing identity, Alipay readiness, and recent orders.
- `npm run check:smoke` verifies billing overview without creating server-side test orders.
- Future payment provider support should add new providers behind the same `PaymentProvider`, `BillingOrder`, and `PaymentTransaction` boundary.
- Real Alipay integration must validate provider notifications before changing order or subscription state.
