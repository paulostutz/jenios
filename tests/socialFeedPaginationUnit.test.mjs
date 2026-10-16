import test from 'node:test';
import assert from 'node:assert/strict';
import { paginatePosts } from '../lib/social/feed-pagination.mjs';
const row = n => ({ id: String(n), created_at: '2026-10-14T10:00:00Z' });
test('full page without extra row has no next cursor', () => {
  assert.equal(paginatePosts([row(1), row(2)], 2).nextBefore, null);
});
test('extra row creates stable cursor', () => {
  const result = paginatePosts([row(1), row(2), row(3)], 2);
  assert.equal(result.posts.length, 2);
  assert.equal(result.nextBeforeId, '2');
});
test('empty page terminates', () => {
  assert.equal(paginatePosts([], 2).nextBefore, null);
});
test('invalid limits and cursor rows fail closed', () => {
  assert.throws(() => paginatePosts([], 0));
  assert.throws(() => paginatePosts([{}, {}], 1));
});
