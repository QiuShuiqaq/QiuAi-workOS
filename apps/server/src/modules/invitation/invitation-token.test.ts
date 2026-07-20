import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { buildInvitationUrl, createInvitationToken, hashInvitationToken } from './invitation-token';

describe('invitation token helpers', () => {
  test('creates opaque tokens and stable hashes', () => {
    const token = createInvitationToken();

    assert.equal(token.length > 20, true);
    assert.equal(hashInvitationToken(token).length, 64);
    assert.notEqual(hashInvitationToken(token), token);
  });

  test('builds an invitation url from the public base url', () => {
    const previous = process.env.WORKOS_PUBLIC_BASE_URL;
    process.env.WORKOS_PUBLIC_BASE_URL = 'https://workos.qiuaihub.com/';

    assert.equal(
      buildInvitationUrl('token-123'),
      'https://workos.qiuaihub.com/invitations/token-123'
    );

    if (previous === undefined) {
      delete process.env.WORKOS_PUBLIC_BASE_URL;
    } else {
      process.env.WORKOS_PUBLIC_BASE_URL = previous;
    }
  });
});
