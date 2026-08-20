import type { FastifyRequest } from 'fastify';
import { isIP } from 'node:net';

export function readTrustedClientIpAddress(request: FastifyRequest): string | undefined {
  const directIp = normalizeIpAddress(request.ip);
  if (!directIp) {
    return readForwardedClientIpAddress(request);
  }

  if (!isTrustedProxyAddress(directIp)) {
    return directIp;
  }

  return readForwardedClientIpAddress(request) ?? directIp;
}

function readForwardedClientIpAddress(request: FastifyRequest): string | undefined {
  const forwardedRealIp = normalizeIpAddress(readHeaderValue(request.headers['x-real-ip']));
  if (forwardedRealIp) {
    return forwardedRealIp;
  }

  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  if (!forwardedValue) {
    return undefined;
  }

  const forwardedIps = forwardedValue
    .split(',')
    .map((value) => normalizeIpAddress(value))
    .filter((value): value is string => Boolean(value));

  return forwardedIps.at(-1);
}

function readHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeIpAddress(value: string | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : undefined;
}

function isTrustedProxyAddress(value: string): boolean {
  if (value.startsWith('::ffff:')) {
    return isTrustedProxyAddress(value.slice('::ffff:'.length));
  }

  if (value === '127.0.0.1' || value === '::1') {
    return true;
  }

  if (isPrivateIpv4Address(value)) {
    return true;
  }

  return isPrivateIpv6Address(value);
}

function isPrivateIpv4Address(value: string): boolean {
  const octets = value.split('.');
  if (octets.length !== 4) {
    return false;
  }

  const [first, second] = octets.map((segment) => Number(segment));
  if (!Number.isInteger(first) || !Number.isInteger(second)) {
    return false;
  }

  return (
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function isPrivateIpv6Address(value: string): boolean {
  const normalized = value.toLowerCase();
  return (
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe80')
  );
}
