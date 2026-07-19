import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createApplication } from './main';

test('server application initializes without parser registration conflicts', async () => {
  const app = await createApplication();
  app.useLogger(false);

  await app.init();
  await app.close();

  assert.ok(true);
});
