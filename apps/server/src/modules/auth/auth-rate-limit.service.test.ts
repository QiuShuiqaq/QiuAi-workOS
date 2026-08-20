import assert from 'node:assert/strict';
import { test } from 'node:test';

import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import type { PrismaService } from '../../shared/prisma/prisma.service';
import { AuthRateLimitService } from './auth-rate-limit.service';

type StoredBucket = {
  attemptCount: number;
  resetAt: Date;
};

function createDatabasePrismaMock() {
  const buckets = new Map<string, StoredBucket>();

  const prisma = {
    async $transaction<T>(callback: (tx: { $queryRaw: <TRow>(query: Prisma.Sql) => Promise<TRow[]> }) => Promise<T>) {
      return callback({
        async $queryRaw<TRow>(query: Prisma.Sql) {
          const [ruleKey, resetAtValue, nowValue] = query.values as [string, Date, Date, Date, Date];
          const resetAt = new Date(resetAtValue);
          const now = new Date(nowValue);
          const current = buckets.get(ruleKey);

          const nextBucket =
            current && current.resetAt > now
              ? {
                  attemptCount: current.attemptCount + 1,
                  resetAt: current.resetAt
                }
              : {
                  attemptCount: 1,
                  resetAt
                };

          buckets.set(ruleKey, nextBucket);

          return [
            {
              attemptCount: nextBucket.attemptCount,
              resetAt: nextBucket.resetAt
            }
          ] as TRow[];
        }
      });
    },
    authRateLimitBucket: {
      async deleteMany(input: { where: { resetAt: { lt: Date } } }) {
        for (const [key, bucket] of buckets.entries()) {
          if (bucket.resetAt < input.where.resetAt.lt) {
            buckets.delete(key);
          }
        }

        return { count: 0 };
      }
    }
  };

  return { prisma: prisma as unknown as PrismaService, buckets };
}

async function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

test('database-backed auth rate limiting persists across service instances', async () => {
  const previousMode = process.env.WORKOS_PERSISTENCE_MODE;
  const previousLimit = process.env.WORKOS_AUTH_LOGIN_IP_LIMIT;
  const previousEmailLimit = process.env.WORKOS_AUTH_LOGIN_EMAIL_LIMIT;
  const previousWindow = process.env.WORKOS_AUTH_LOGIN_WINDOW_SECONDS;

  process.env.WORKOS_PERSISTENCE_MODE = 'database';
  process.env.WORKOS_AUTH_LOGIN_IP_LIMIT = '2';
  process.env.WORKOS_AUTH_LOGIN_EMAIL_LIMIT = '10';
  process.env.WORKOS_AUTH_LOGIN_WINDOW_SECONDS = '60';

  const { prisma } = createDatabasePrismaMock();
  const serviceOne = new AuthRateLimitService(prisma);
  const serviceTwo = new AuthRateLimitService(prisma);

  try {
    await serviceOne.assertLoginAllowed({
      email: 'first@example.com',
      ipAddress: '203.0.113.10'
    });
    await serviceOne.assertLoginAllowed({
      email: 'second@example.com',
      ipAddress: '203.0.113.10'
    });

    await assert.rejects(
      serviceTwo.assertLoginAllowed({
        email: 'third@example.com',
        ipAddress: '203.0.113.10'
      }),
      (error: unknown) => {
        assert(error instanceof HttpException);
        assert.equal(error.getStatus(), 429);
        const response = error.getResponse() as { error?: { code?: string; details?: { retryAfterSeconds?: number } } };
        assert.equal(response.error?.code, 'RATE_LIMITED');
        assert.equal(typeof response.error?.details?.retryAfterSeconds, 'number');
        return true;
      }
    );
  } finally {
    await restoreEnv('WORKOS_PERSISTENCE_MODE', previousMode);
    await restoreEnv('WORKOS_AUTH_LOGIN_IP_LIMIT', previousLimit);
    await restoreEnv('WORKOS_AUTH_LOGIN_EMAIL_LIMIT', previousEmailLimit);
    await restoreEnv('WORKOS_AUTH_LOGIN_WINDOW_SECONDS', previousWindow);
  }
});
