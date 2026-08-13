const loopbackHosts = new Set(['127.0.0.1', 'localhost', '::1']);

/**
 * Enables unrestricted template testing only for a server that is explicitly
 * configured as a local development process bound to loopback.
 */
export function isLocalDevelopmentUnlimitedEnabled(): boolean {
  const serverHost = (process.env.SERVER_HOST ?? '127.0.0.1').trim().toLowerCase();

  return (
    process.env.WORKOS_LOCAL_DEV_UNLIMITED === 'true' &&
    process.env.APP_ENV === 'local' &&
    process.env.WORKOS_DEPLOY_TARGET === 'local' &&
    process.env.NODE_ENV === 'development' &&
    loopbackHosts.has(serverHost)
  );
}
