import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAccountPlanStatus,
  resolveDisplayedAccountStatus
} from './account-status';

test('account plan status maps the current desktop authorization plan', () => {
  assert.equal(resolveAccountPlanStatus(undefined, true), 'unregistered');
  assert.equal(resolveAccountPlanStatus('PERSONAL_FREE', false), 'free');
  assert.equal(resolveAccountPlanStatus('PERSONAL_MEMBER_MONTHLY', false), 'member');
  assert.equal(resolveAccountPlanStatus('ENTERPRISE_BASIC_MONTHLY', false), 'enterprise');
});

test('a freshly synced non-free catalog status wins over stale referral data', () => {
  assert.equal(
    resolveDisplayedAccountStatus('PERSONAL_MEMBER_MONTHLY', false, 'free', 'server'),
    'member'
  );
  assert.equal(
    resolveDisplayedAccountStatus('ENTERPRISE_BASIC_MONTHLY', false, 'free', 'server'),
    'enterprise'
  );
});

test('a synced free catalog status wins over stale member referral data', () => {
  assert.equal(
    resolveDisplayedAccountStatus('PERSONAL_FREE', false, 'member', 'server'),
    'free'
  );
});

test('referral status remains a fallback while the catalog is unavailable', () => {
  assert.equal(resolveDisplayedAccountStatus('PERSONAL_FREE', false, 'member', 'local_fallback'), 'member');
  assert.equal(resolveDisplayedAccountStatus(undefined, false, 'enterprise'), 'enterprise');
  assert.equal(resolveDisplayedAccountStatus('PERSONAL_FREE', false), 'free');
});
