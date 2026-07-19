import { createHash, randomBytes } from 'crypto';

export const WORKOS_SESSION_COOKIE_NAME = 'qiuai_workos_session';

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readCookie(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) {
    return undefined;
  }

  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .map((part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return undefined;
      }

      return {
        name: part.slice(0, separatorIndex),
        value: part.slice(separatorIndex + 1)
      };
    })
    .find((cookie) => cookie?.name === cookieName)?.value;
}

export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  const attributes = [
    `${WORKOS_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];

  if (process.env.NODE_ENV === 'production' || process.env.WORKOS_COOKIE_SECURE === 'true') {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function serializeExpiredSessionCookie(): string {
  const attributes = [
    `${WORKOS_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];

  if (process.env.NODE_ENV === 'production' || process.env.WORKOS_COOKIE_SECURE === 'true') {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}
