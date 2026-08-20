import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { FastifyRequest } from 'fastify';

import { readTrustedClientIpAddress } from './client-ip';

function createRequest(
  ip: string,
  headers: Record<string, string | string[] | undefined> = {}
): FastifyRequest {
  return {
    ip,
    headers
  } as unknown as FastifyRequest;
}

test('returns the direct client IP when the request does not come from a trusted proxy', () => {
  const request = createRequest('198.51.100.7', {
    'x-forwarded-for': '1.2.3.4',
    'x-real-ip': '1.2.3.4'
  });

  assert.equal(readTrustedClientIpAddress(request), '198.51.100.7');
});

test('prefers x-real-ip behind a trusted proxy', () => {
  const request = createRequest('127.0.0.1', {
    'x-forwarded-for': '198.51.100.1, 203.0.113.42',
    'x-real-ip': '203.0.113.42'
  });

  assert.equal(readTrustedClientIpAddress(request), '203.0.113.42');
});

test('uses the last valid forwarded IP behind a trusted proxy', () => {
  const request = createRequest('127.0.0.1', {
    'x-forwarded-for': '198.51.100.1, 203.0.113.42'
  });

  assert.equal(readTrustedClientIpAddress(request), '203.0.113.42');
});
