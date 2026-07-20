import { createHash, randomBytes } from 'node:crypto';

export function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function buildInvitationUrl(token: string): string {
  const baseUrl = (process.env.WORKOS_PUBLIC_BASE_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
  return `${baseUrl}/invitations/${encodeURIComponent(token)}`;
}
