import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultPromptSnippets, promptSnippetCategories } from './prompt-snippet-catalog';

test('default prompt snippet catalog keeps a large unique categorized set', () => {
  assert.ok(defaultPromptSnippets.length >= 100);
  assert.equal(new Set(defaultPromptSnippets.map((snippet) => snippet.id)).size, defaultPromptSnippets.length);
  assert.equal(new Set(defaultPromptSnippets.map((snippet) => snippet.content)).size, defaultPromptSnippets.length);

  for (const category of promptSnippetCategories) {
    assert.ok(defaultPromptSnippets.some((snippet) => snippet.category === category));
  }

  for (const snippet of defaultPromptSnippets) {
    assert.ok(snippet.title.trim());
    assert.ok(snippet.content.trim());
    assert.ok(snippet.content.trim().length >= 80);
  }
});
