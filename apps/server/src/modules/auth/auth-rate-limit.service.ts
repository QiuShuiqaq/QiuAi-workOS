import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface RateLimitRule {
  key: string;
  limit: number;
  windowMs: number;
  message: string;
}

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class AuthRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  assertLoginAllowed(input: { email: string; ipAddress?: string }) {
    const email = normalizeIdentity(input.email);
    const ipAddress = normalizeIdentity(input.ipAddress ?? 'unknown');
    const windowMs = readPositiveInteger('WORKOS_AUTH_LOGIN_WINDOW_SECONDS', 10 * 60) * 1000;

    this.assertAllowed([
      {
        key: `auth:login:ip:${ipAddress}`,
        limit: readPositiveInteger('WORKOS_AUTH_LOGIN_IP_LIMIT', 30),
        windowMs,
        message: 'Too many login attempts. Please wait and try again.'
      },
      {
        key: `auth:login:email:${email}`,
        limit: readPositiveInteger('WORKOS_AUTH_LOGIN_EMAIL_LIMIT', 10),
        windowMs,
        message: 'Too many login attempts for this account. Please wait and try again.'
      }
    ]);
  }

  assertRegisterAllowed(input: { email: string; ipAddress?: string }) {
    const email = normalizeIdentity(input.email);
    const ipAddress = normalizeIdentity(input.ipAddress ?? 'unknown');
    const windowMs = readPositiveInteger('WORKOS_AUTH_REGISTER_WINDOW_SECONDS', 60 * 60) * 1000;

    this.assertAllowed([
      {
        key: `auth:register:ip:${ipAddress}`,
        limit: readPositiveInteger('WORKOS_AUTH_REGISTER_IP_LIMIT', 8),
        windowMs,
        message: 'Too many registration attempts. Please wait and try again.'
      },
      {
        key: `auth:register:email:${email}`,
        limit: readPositiveInteger('WORKOS_AUTH_REGISTER_EMAIL_LIMIT', 3),
        windowMs,
        message: 'Too many registration attempts for this email. Please wait and try again.'
      }
    ]);
  }

  private assertAllowed(rules: RateLimitRule[]) {
    const now = Date.now();
    this.pruneExpiredBuckets(now);

    for (const rule of rules) {
      const bucket = this.buckets.get(rule.key);
      if (bucket && bucket.resetAt > now && bucket.count >= rule.limit) {
        throw new HttpException(
          {
            error: {
              code: 'RATE_LIMITED',
              message: rule.message,
              details: {
                retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
              }
            }
          },
          HttpStatus.TOO_MANY_REQUESTS
        );
      }
    }

    for (const rule of rules) {
      const bucket = this.buckets.get(rule.key);
      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(rule.key, {
          count: 1,
          resetAt: now + rule.windowMs
        });
        continue;
      }

      bucket.count += 1;
    }
  }

  private pruneExpiredBuckets(now: number) {
    if (this.buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase() || 'unknown';
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
