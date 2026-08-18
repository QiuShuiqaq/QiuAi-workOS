import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  forceReleaseOfficialModelApiKeyLeases,
  reapExpiredOfficialModelApiKeyLeases,
  type OfficialModelApiKeyLeaseCleanupPrisma,
  type OfficialModelApiKeyForceReleasePrisma
} from './official-model-api-key-lease-cleanup';

type LeaseState = {
  id: string;
  apiKeyId: string;
  routeKey: string;
  status: 'ACTIVE' | 'EXPIRED' | 'FORCE_RELEASED';
  acquiredAt: Date;
  releasedAt: Date | null;
  expiresAt: Date;
};

type KeyState = {
  id: string;
  currentConcurrency: number;
  lastError: string | null;
};

test('reaps all expired official model API key leases across batches', async () => {
  const now = new Date('2026-08-18T00:00:00.000Z');
  const expiredAt = new Date(now.getTime() - 60_000);
  const futureAt = new Date(now.getTime() + 60_000);

  const keyState: KeyState[] = [{ id: 'key-1', currentConcurrency: 102, lastError: null }];
  const leaseState: LeaseState[] = [
    ...Array.from({ length: 101 }, (_, index) => ({
      id: `lease-${index + 1}`,
      apiKeyId: 'key-1',
      routeKey: 'official-image-1',
      status: 'ACTIVE' as LeaseState['status'],
      acquiredAt: expiredAt,
      releasedAt: null,
      expiresAt: expiredAt
    })),
    {
      id: 'lease-future',
      apiKeyId: 'key-1',
      routeKey: 'official-image-1',
      status: 'ACTIVE' as LeaseState['status'],
      acquiredAt: expiredAt,
      releasedAt: null,
      expiresAt: futureAt
    }
  ];

  const prisma = {
    officialModelApiKeyLease: {
      async findMany(input: {
        where: {
          routeKey?: string;
          status?: string;
          expiresAt?: { lt?: Date };
        };
        take?: number;
      }) {
        const rows = leaseState.filter((lease) => {
          if (input.where.routeKey && lease.routeKey !== input.where.routeKey) {
            return false;
          }
          if (input.where.status && lease.status !== input.where.status) {
            return false;
          }
          const expiresBefore = input.where.expiresAt?.lt;
          if (expiresBefore && !(lease.expiresAt < expiresBefore)) {
            return false;
          }
          return true;
        });
        return rows.slice(0, input.take ?? rows.length).map((lease) => ({
          id: lease.id,
          apiKeyId: lease.apiKeyId
        }));
      },
      async updateMany(input: {
        where: { id?: string; status?: string };
        data: { status?: string; releasedAt?: Date };
      }) {
        const lease = leaseState.find((item) => item.id === input.where.id && item.status === input.where.status);
        if (!lease) {
          return { count: 0 };
        }

        if (input.data.status) {
          lease.status = input.data.status as LeaseState['status'];
        }
        if (input.data.releasedAt) {
          lease.releasedAt = input.data.releasedAt;
        }
        return { count: 1 };
      }
    },
    officialModelApiKey: {
      async updateMany(input: {
        where: { id?: string; currentConcurrency?: { gt?: number } };
        data: { currentConcurrency?: { decrement?: number }; lastError?: string | null };
      }) {
        const key = keyState.find((item) => item.id === input.where.id);
        if (!key) {
          return { count: 0 };
        }
        if (input.where.currentConcurrency?.gt !== undefined && !(key.currentConcurrency > input.where.currentConcurrency.gt)) {
          return { count: 0 };
        }

        key.currentConcurrency -= input.data.currentConcurrency?.decrement ?? 0;
        if (input.data.lastError !== undefined) {
          key.lastError = input.data.lastError;
        }
        return { count: 1 };
      }
    }
  };

  const releasedCount = await reapExpiredOfficialModelApiKeyLeases(
    prisma as OfficialModelApiKeyLeaseCleanupPrisma,
    'official-image-1',
    now
  );

  assert.equal(releasedCount, 101);
  assert.equal(keyState[0].currentConcurrency, 1);
  assert.equal(keyState[0].lastError, 'Official route lease expired before release.');
  assert.equal(leaseState.filter((lease) => lease.status === 'EXPIRED').length, 101);
  assert.equal(leaseState.find((lease) => lease.id === 'lease-future')?.status, 'ACTIVE');
});

test('force releases active leases and pauses the API key', async () => {
  const now = new Date('2026-08-18T01:00:00.000Z');
  const key = {
    id: 'key-1',
    status: 'ACTIVE',
    currentConcurrency: 2,
    lastError: null as string | null
  };
  const leases = [
    { id: 'lease-1', apiKeyId: 'key-1', status: 'ACTIVE' as LeaseState['status'] },
    { id: 'lease-2', apiKeyId: 'key-1', status: 'ACTIVE' as LeaseState['status'] },
    { id: 'lease-3', apiKeyId: 'key-2', status: 'ACTIVE' as LeaseState['status'] }
  ];

  const prisma = {
    officialModelApiKey: {
      async update(input: { where: { id: string }; data: { status: string; currentConcurrency: number; lastError: string } }) {
        assert.equal(input.where.id, 'key-1');
        key.status = input.data.status;
        key.currentConcurrency = input.data.currentConcurrency;
        key.lastError = input.data.lastError;
        return key;
      }
    },
    officialModelApiKeyLease: {
      async updateMany(input: {
        where: { apiKeyId: string; status: string };
        data: { status: string; releasedAt: Date };
      }) {
        const matches = leases.filter(
          (lease) => lease.apiKeyId === input.where.apiKeyId && lease.status === input.where.status
        );
        for (const lease of matches) {
          lease.status = input.data.status as LeaseState['status'];
        }
        assert.equal(input.data.releasedAt, now);
        return { count: matches.length };
      }
    }
  };

  const result = await forceReleaseOfficialModelApiKeyLeases(
    prisma as OfficialModelApiKeyForceReleasePrisma,
    'key-1',
    now,
    'admin-1'
  );

  assert.equal(result.releasedLeaseCount, 2);
  assert.equal(result.key.status, 'DISABLED');
  assert.equal(result.key.currentConcurrency, 0);
  assert.equal(leases.filter((lease) => lease.status === 'FORCE_RELEASED').length, 2);
  assert.equal(leases.find((lease) => lease.id === 'lease-3')?.status, 'ACTIVE');
});
