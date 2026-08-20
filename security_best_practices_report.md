# QiuAI WorkOS Security Review

## Summary
The two highest-risk trust-boundary issues in the server auth flow have been fixed and verified: client IP extraction no longer trusts spoofed `X-Forwarded-For` chains, and auth rate limiting now persists in Postgres instead of only memory.

## Resolved

### 1. Client IP trust boundary hardened
Location: `apps/server/src/shared/network/client-ip.ts:4-84`, used by `apps/server/src/modules/auth/auth.controller.ts:31-54` and `apps/server/src/modules/desktop-sync/desktop-sync.controller.ts:167-201`

Impact: the app no longer reads the first forwarded IP from a proxy chain. It now accepts `X-Real-IP` first, otherwise the last valid forwarded IP, but only when the direct peer looks like a trusted proxy.

Verification: `apps/server/src/shared/network/client-ip.test.ts:18-38`

### 2. Login/register throttling now survives restarts and multiple workers
Location: `apps/server/src/modules/auth/auth-rate-limit.service.ts:25-199`, `apps/server/prisma/schema.prisma:378-387`, `apps/server/prisma/migrations/20260820093000_auth_rate_limit_buckets/migration.sql:1-15`

Impact: rate-limit buckets are now persisted in Postgres, so PM2 restarts and multiple workers no longer reset the counters.

Verification: `apps/server/src/modules/auth/auth-rate-limit.service.test.ts:74-117`

## Remaining

### 3. Support-login session token is still placed in the URL
Location: `apps/server/src/modules/admin/admin.service.ts:1448-1498, 2896-2904`, `apps/web-console/src/app/support-login/route.ts:1-34`

Impact: the token can still leak through browser history, referer handling, logs, or copy/paste. This is the next high-value hardening item.

### 4. Software-copilot Alipay callback still lacks the merchant-context check used by the main billing path
Location: `apps/server/src/modules/software-copilot/software-copilot.service.ts:531-579`

Impact: this is deferred because software-copilot is not fully developed or formally launched yet. It is not a blocker for the current release, but it should be aligned with the main billing flow before opening software-copilot purchases.

## Verification

The server test suite and server build both passed after the fix.
