export interface OfficialModelApiKeyLeaseCleanupPrisma {
  officialModelApiKeyLease: {
    findMany(input: any): Promise<Array<{ id: string; apiKeyId: string }>>;
    updateMany(input: any): Promise<{ count: number }>;
  };
  officialModelApiKey: {
    updateMany(input: any): Promise<{ count: number }>;
  };
}

interface LeaseCleanupFilter {
  routeKey?: string;
  apiKeyId?: string;
}

async function reapExpiredOfficialModelApiKeyLeasesWithFilter(
  prisma: OfficialModelApiKeyLeaseCleanupPrisma,
  filter: LeaseCleanupFilter,
  now: Date
): Promise<number> {
  let releasedLeaseCount = 0;

  for (;;) {
    const expiredLeases = await prisma.officialModelApiKeyLease.findMany({
      where: {
        ...filter,
        status: 'ACTIVE',
        expiresAt: {
          lt: now
        }
      },
      select: {
        id: true,
        apiKeyId: true
      },
      orderBy: [
        {
          expiresAt: 'asc'
        },
        {
          acquiredAt: 'asc'
        }
      ],
      take: 100
    });

    if (expiredLeases.length === 0) {
      return releasedLeaseCount;
    }

    for (const lease of expiredLeases) {
      const updatedLease = await prisma.officialModelApiKeyLease.updateMany({
        where: {
          id: lease.id,
          status: 'ACTIVE'
        },
        data: {
          status: 'EXPIRED',
          releasedAt: now
        }
      });

      if (updatedLease.count === 0) {
        continue;
      }

      releasedLeaseCount += 1;
      await prisma.officialModelApiKey.updateMany({
        where: {
          id: lease.apiKeyId,
          currentConcurrency: {
            gt: 0
          }
        },
        data: {
          currentConcurrency: {
            decrement: 1
          },
          lastError: 'Official route lease expired before release.'
        }
      });
    }

    if (expiredLeases.length < 100) {
      return releasedLeaseCount;
    }
  }
}

export async function reapExpiredOfficialModelApiKeyLeases(
  prisma: OfficialModelApiKeyLeaseCleanupPrisma,
  routeKey?: string,
  now = new Date()
): Promise<number> {
  return reapExpiredOfficialModelApiKeyLeasesWithFilter(prisma, routeKey ? { routeKey } : {}, now);
}

export async function reapExpiredOfficialModelApiKeyLeasesForKey(
  prisma: OfficialModelApiKeyLeaseCleanupPrisma,
  apiKeyId: string,
  now = new Date()
): Promise<number> {
  return reapExpiredOfficialModelApiKeyLeasesWithFilter(prisma, { apiKeyId }, now);
}

export interface OfficialModelApiKeyForceReleasePrisma {
  officialModelApiKey: {
    update(input: any): Promise<{ id: string; status: string; currentConcurrency: number; lastError: string | null }>;
  };
  officialModelApiKeyLease: {
    updateMany(input: any): Promise<{ count: number }>;
  };
}

export async function forceReleaseOfficialModelApiKeyLeases(
  prisma: OfficialModelApiKeyForceReleasePrisma,
  apiKeyId: string,
  now = new Date(),
  operatorAccountId?: string
): Promise<{
  key: { id: string; status: string; currentConcurrency: number; lastError: string | null };
  releasedLeaseCount: number;
}> {
  const key = await prisma.officialModelApiKey.update({
    where: {
      id: apiKeyId
    },
    data: {
      status: 'DISABLED',
      currentConcurrency: 0,
      cooldownUntil: null,
      lastError: 'Key was force released and paused by an administrator.'
    }
  });

  const releasedLeases = await prisma.officialModelApiKeyLease.updateMany({
    where: {
      apiKeyId,
      status: 'ACTIVE'
    },
    data: {
      status: 'FORCE_RELEASED',
      releasedAt: now,
      metadata: {
        source: 'official-route',
        releaseReason: 'force-release',
        ...(operatorAccountId ? { operatorAccountId } : {})
      }
    }
  });

  return {
    key,
    releasedLeaseCount: releasedLeases.count
  };
}
