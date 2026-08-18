import assert from 'node:assert/strict';
import test from 'node:test';

import { readMediaUrlFromUnknown } from './ai-points.service';

test('reads opaque provider image URLs from explicit and nested result fields', () => {
  const explicitUrl = 'https://cdn.example.test/object/7f3a9d?token=opaque';
  const nestedUrl = 'https://cdn.example.test/object/8c1e22?token=opaque';

  assert.equal(
    readMediaUrlFromUnknown({ url: explicitUrl, status: 'succeeded' }, 'image'),
    explicitUrl
  );
  assert.equal(
    readMediaUrlFromUnknown({ status: 'succeeded', data: { results: [nestedUrl] } }, 'image'),
    nestedUrl
  );
});
