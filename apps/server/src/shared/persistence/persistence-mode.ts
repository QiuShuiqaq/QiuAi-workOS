export type WorkosPersistenceMode = 'mock' | 'database';

export function getWorkosPersistenceMode(): WorkosPersistenceMode {
  return process.env.WORKOS_PERSISTENCE_MODE === 'database' ? 'database' : 'mock';
}

export function isDatabasePersistenceEnabled(): boolean {
  return getWorkosPersistenceMode() === 'database';
}

