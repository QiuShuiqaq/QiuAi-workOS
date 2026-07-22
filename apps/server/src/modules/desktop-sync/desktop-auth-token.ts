import { createHash, randomBytes } from 'node:crypto';

export function createDesktopBindingCode(): string {
  return `QIU-${createReadableTokenPart()}-${createReadableTokenPart()}`;
}

export function createDesktopDeviceToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashDesktopToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function normalizeDesktopBindingCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function createReadableTokenPart(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = randomBytes(4);
  let value = '';

  for (const byte of bytes) {
    value += alphabet[byte % alphabet.length];
  }

  return value;
}
