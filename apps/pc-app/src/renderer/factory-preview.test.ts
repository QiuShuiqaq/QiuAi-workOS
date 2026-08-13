import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getFactoryPreviewRemoteSrc,
  hasFactoryPreviewSource,
  isFactoryPreviewRemoteUrl
} from './factory-preview';

test('factory preview keeps a remote URL as a fallback source', () => {
  assert.equal(isFactoryPreviewRemoteUrl('https://cdn.example.test/image.png'), true);
  assert.equal(isFactoryPreviewRemoteUrl('C:\\QiuAI\\assets\\image.png'), false);
  assert.equal(
    getFactoryPreviewRemoteSrc({
      thumbnailPath: 'C:\\QiuAI\\assets\\image.png',
      remoteUrl: 'https://cdn.example.test/image.png'
    }),
    'https://cdn.example.test/image.png'
  );
});

test('factory preview accepts a locally saved file before the renderer resolves its URL', () => {
  assert.equal(
    hasFactoryPreviewSource({
      localPath: 'C:\\QiuAI\\assets\\image.png',
      thumbnailPath: undefined,
      remoteUrl: undefined
    }),
    true
  );
  assert.equal(
    hasFactoryPreviewSource({
      localPath: undefined,
      thumbnailPath: undefined,
      remoteUrl: undefined
    }),
    false
  );
});
