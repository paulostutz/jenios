// Pure helper for stable keyset pagination. Request one extra row to determine hasMore.
export function paginatePosts(rows, limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('INVALID_LIMIT');
  if (!Array.isArray(rows)) throw new TypeError('INVALID_ROWS');
  const posts = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const last = hasMore ? posts.at(-1) : null;
  if (hasMore && (!last?.created_at || !last?.id)) throw new TypeError('INVALID_CURSOR_ROW');
  return { posts, nextBefore: last?.created_at ?? null, nextBeforeId: last?.id ?? null };
}
