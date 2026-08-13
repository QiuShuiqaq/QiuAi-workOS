import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isWatchExecutionProfile,
  resolveRoleExecutionModeMeta
} from './role-execution-mode.js';

test('digital factory hybrid mode is batch production, not watch', () => {
  const profile = { mode: 'hybrid' as const };

  assert.equal(isWatchExecutionProfile(profile, 'digital_factory'), false);
  assert.deepEqual(resolveRoleExecutionModeMeta(profile, 'digital_factory'), {
    label: '批量生产式',
    color: 'cyan'
  });
});

test('digital employee watch modes remain watch', () => {
  assert.equal(isWatchExecutionProfile({ mode: 'watch' }, 'digital_employee'), true);
  assert.equal(isWatchExecutionProfile({ mode: 'hybrid' }, 'digital_employee'), true);
  assert.equal(isWatchExecutionProfile({ mode: 'conversation' }, 'digital_employee'), false);
  assert.deepEqual(resolveRoleExecutionModeMeta({ mode: 'hybrid' }, 'digital_employee'), {
    label: '值守式',
    color: 'gold'
  });
});
