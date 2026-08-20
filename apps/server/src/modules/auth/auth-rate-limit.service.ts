import { HttpException, HttpStatus, Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { isDatabasePersistenceEnabled } from '../../shared/persistence/persistence-mode';
import { PrismaService } from '../../shared/prisma/prisma.service';

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

interface DatabaseRateLimitBucketRow {
  attemptCount: number;
  resetAt: Date;
}

@Injectable()
export class AuthRateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(@Inject(PrismaService) private readonly prismaService: PrismaService) {}

  onModuleInit() {
    if (!isDatabasePersistenceEnabled()) {
      return;
    }

    void this.pruneDatabaseBuckets().catch(() => undefined);
    this.cleanupTimer = setInterval(() => {
      void this.pruneDatabaseBuckets().catch(() => undefined);
    }, 60 * 60 * 1000);
    this.cleanupTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  async assertLoginAllowed(input: { email: string; ipAddress?: string }) {
    const email = normalizeIdentity(input.email);
    const ipAddress = normalizeIdentity(input.ipAddress ?? 'unknown');
    const windowMs = readPositiveInteger('WORKOS_AUTH_LOGIN_WINDOW_SECONDS', 10 * 60) * 1000;

    await this.assertAllowed([
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

  async assertRegisterAllowed(input: { email: string; ipAddress?: string }) {
    const email = normalizeIdentity(input.email);
    const ipAddress = normalizeIdentity(input.ipAddress ?? 'unknown');
    const windowMs = readPositiveInteger('WORKOS_AUTH_REGISTER_WINDOW_SECONDS', 60 * 60) * 1000;

    await this.assertAllowed([
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

  private async assertAllowed(rules: RateLimitRule[]) {
    if (!isDatabasePersistenceEnabled()) {
      this.assertAllowedInMemory(rules);
      return;
    }

    const now = new Date();
    await this.prismaService.$transaction(async (tx) => {
      for (const rule of rules) {
        const bucket = await this.bumpDatabaseBucket(tx, rule, now);
        if (bucket.attemptCount > rule.limit) {
          throw this.buildRateLimitException(rule.message, bucket.resetAt, now);
        }
      }
    });
  }

  private assertAllowedInMemory(rules: RateLimitRule[]) {
    const now = Date.now();
    this.pruneExpiredBuckets(now);

    for (const rule of rules) {
      const bucket = this.buckets.get(rule.key);
      if (bucket && bucket.resetAt > now && bucket.count >= rule.limit) {
        throw this.buildRateLimitException(
          rule.message,
          new Date(bucket.resetAt),
          new Date(now)
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

  private async bumpDatabaseBucket(
    tx: Prisma.TransactionClient,
    rule: RateLimitRule,
    now: Date
  ): Promise<DatabaseRateLimitBucketRow> {
    const resetAt = new Date(now.getTime() + rule.windowMs);
    const rows = await tx.$queryRaw<DatabaseRateLimitBucketRow[]>(Prisma.sql`
      INSERT INTO "auth_rate_limit_buckets" ("rule_key", "attempt_count", "reset_at", "created_at", "updated_at")
      VALUES (${rule.key}, 1, ${resetAt}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT ("rule_key") DO UPDATE
      SET
        "attempt_count" = CASE
          WHEN "auth_rate_limit_buckets"."reset_at" > ${now} THEN "auth_rate_limit_buckets"."attempt_count" + 1
          ELSE 1
        END,
        "reset_at" = CASE
          WHEN "auth_rate_limit_buckets"."reset_at" > ${now} THEN "auth_rate_limit_buckets"."reset_at"
          ELSE ${resetAt}
        END,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "attempt_count" AS "attemptCount", "reset_at" AS "resetAt"
    `);

    return rows[0] ?? { attemptCount: 1, resetAt };
  }

  private buildRateLimitException(message: string, resetAt: Date, now: Date) {
    return new HttpException(
      {
        error: {
          code: 'RATE_LIMITED',
          message,
          details: {
            retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000))
          }
        }
      },
      HttpStatus.TOO_MANY_REQUESTS
    );
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

  private async pruneDatabaseBuckets() {
    await this.prismaService.authRateLimitBucket.deleteMany({
      where: {
        resetAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000)
        }
      }
    });
  }
}

function normalizeIdentity(value: string) {
  return value.trim().toLowerCase() || 'unknown';
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}
