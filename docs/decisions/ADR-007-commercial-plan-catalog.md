# ADR-007: Commercial Plan Catalog

## Status
Accepted

## Date
2026-07-19

## Context
QiuAI WorkOS is moving from a temporary two-plan enterprise model to a production commercial catalog. The product needs a lower entry price for early company operations while preserving a clear upgrade path for larger customers.

The previous `ENTERPRISE_MONTHLY` and `ENTERPRISE_ANNUAL` codes already exist in the database and may be referenced by historical subscriptions or orders.

## Decision
Use the following production subscription catalog:

| Plan | Monthly | Annual |
| --- | ---: | ---: |
| Personal Free | ¥0 | N/A |
| Enterprise Basic | ¥299 | ¥2,990 |
| Enterprise Standard | ¥599 | ¥5,990 |
| Enterprise Professional | ¥980 | ¥9,800 |

The active commercial catalog codes are:

```text
PERSONAL_FREE
ENTERPRISE_BASIC_MONTHLY
ENTERPRISE_BASIC_ANNUAL
ENTERPRISE_STANDARD_MONTHLY
ENTERPRISE_STANDARD_ANNUAL
ENTERPRISE_PRO_MONTHLY
ENTERPRISE_PRO_ANNUAL
ENTERPRISE_CUSTOM
```

Only the six monthly and annual enterprise tier codes are accepted by automatic online billing order creation. `ENTERPRISE_CUSTOM` remains visible in the commercial catalog for contact-sales and private deployment positioning, but it is not accepted by the online payment endpoint.

`ENTERPRISE_MONTHLY` and `ENTERPRISE_ANNUAL` remain in the enum as archived legacy codes for historical compatibility, but they are not exposed as active purchasable plans.

Implementation service starts from ¥9,800 and industry custom starts from ¥29,800. These are service offers, not recurring subscription plans, and should be handled by future service-order or contract workflows rather than automatic subscription renewal.

## Consequences
- Plan prices are seeded from code and verified by deployment readiness checks.
- Production `.env` no longer carries enterprise price variables.
- Billing order creation only accepts active online paid plan codes and rejects mismatched client-submitted amounts.
- Existing historical records using legacy plan codes remain readable.
