export type WorkosPersistenceMode = 'mock' | 'database';

export function getWorkosPersistenceMode(): WorkosPersistenceMode {
  return process.env.WORKOS_PERSISTENCE_MODE === 'database' ? 'database' : 'mock';
}

export function isDatabasePersistenceEnabled(): boolean {
  return getWorkosPersistenceMode() === 'database';
}

export function isLocalDevelopmentEnvironment(): boolean {
  return (
    process.env.WORKOS_DEPLOY_TARGET === 'local' &&
    process.env.APP_ENV === 'local' &&
    process.env.NODE_ENV !== 'production'
  );
}
