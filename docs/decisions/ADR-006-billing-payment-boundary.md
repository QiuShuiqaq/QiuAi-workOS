# ADR-006: Billing and Payment Boundary

## Status

Accepted

## Date

2026-07-19

## Context

QiuAI WorkOS is a commercial product with Personal Free and paid Enterprise plans. The platform needs billing data that is stable, auditable, and independent from the legacy platform payment flow.

Key constraints:

- WorkOS must remain independent from the legacy `qiuai-platform` payment callbacks.
- Web, Electron, and mobile clients must use the same billing API contract.
- Real Alipay secrets must never be committed or copied into chat.
- The system must show subscription, billing account, payment configuration, order state, and payment handoff status without exposing secrets.

## Decision

Add a dedicated billing boundary under the WorkOS platform kernel:

- `BillingAccount` stores workspace billing identity and preferred provider.
- `BillingOrder` stores WorkOS business orders.
- `PaymentTransaction` stores provider-level payment attempts and notifications.
- Payment provider configuration is reported as status only, never as secret values.
- Alipay callback paths are reserved under `workos.qiuaihub.com`:
  - `/api/v1/billing/alipay/notify`
  - `/billing/alipay/return`

WorkOS now uses Alipay computer website payment for paid Enterprise orders:

- Payment interface: `alipay.trade.page.pay`
- Product code: `FAST_INSTANT_TRADE_PAY`
- SDK handoff: server generates a signed checkout URL through `pageExecute`
- Notification handling: `/api/v1/billing/alipay/notify` verifies the Alipay signature before changing any WorkOS order or subscription state
- Return handling: `/billing/alipay/return` synchronizes the order from Alipay for authenticated workspace users and then redirects users back to settings
- Pricing authority: when a paid plan has `priceCents`, the server uses that catalog price and rejects mismatched client-submitted amounts

## Alternatives Considered

### Put payment fields directly on `Subscription`

- Pros: fewer tables.
- Cons: subscriptions would mix entitlement state with provider payment state.
- Rejected: order and transaction history must be auditable independently.

### Reuse the legacy platform payment callback paths

- Pros: fewer payment console settings.
- Cons: route ownership becomes ambiguous and risks breaking the existing platform.
- Rejected: WorkOS has its own hostname and API boundary.

### Keep Alipay disabled until a later release

- Pros: avoids payment integration risk.
- Cons: blocks production subscription sales.
- Rejected: billing tables, environment boundaries, and deployment flow are now stable enough to add signed payment handoff safely.

## Consequences

- Billing UI can show subscription state, billing identity, Alipay readiness, and recent orders.
- Billing UI can create real Alipay orders only for enterprise workspaces, configured Alipay credentials, and paid plans with server-side prices.
- `npm run check:smoke` verifies billing overview without creating server-side test orders.
- Future payment provider support should add new providers behind the same `PaymentProvider`, `BillingOrder`, and `PaymentTransaction` boundary.
- Alipay must be configured with `WORKOS_PUBLIC_BASE_URL`, `PAYMENT_ALIPAY_APP_ID`, `PAYMENT_ALIPAY_PRIVATE_KEY`, `PAYMENT_ALIPAY_PUBLIC_KEY`, and optional seller ID validation.
- Order creation fails with `ALIPAY_NOT_CONFIGURED` when the paid provider is incomplete; WorkOS does not create fake payable orders in database mode.
- Order creation fails with `PLAN_PRICE_REQUIRED` for unpriced paid plans. Client-submitted amounts are only accepted as an optional consistency check against the server-side plan price.
- Alipay notification processing validates signature, app ID, seller ID, and amount before marking `BillingOrder` as `PAID` and activating or updating `Subscription`.
- Alipay return synchronization requires normal workspace access; only signed provider notifications can update payments without a user session.
