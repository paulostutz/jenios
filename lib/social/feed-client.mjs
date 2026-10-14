// Cliente de feed multiusuário: não persiste tokens e não faz fallback silencioso para IndexedDB.
export class SocialFeedError extends Error {
  constructor(code, status) { super(code); this.name = 'SocialFeedError'; this.code = code; this.status = status; }
}
export function createSocialFeedClient({ getAccessToken, fetchImpl = fetch, baseUrl = '' }) {
  if (typeof getAccessToken !== 'function' || typeof fetchImpl !== 'function') throw new TypeError('INVALID_CLIENT_CONFIG');
  async function request(path, options = {}) {
    const token = await getAccessToken();
    if (!token || typeof token !== 'string') throw new SocialFeedError('AUTH_REQUIRED', 401);
    const response = await fetchImpl(`${baseUrl}/api/social/${path}`, {
      ...options,
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      cache: 'no-store',
    });
    let payload;
    try { payload = await response.json(); } catch { throw new SocialFeedError('INVALID_SERVER_RESPONSE', response.status); }
    if (!response.ok) throw new SocialFeedError(payload?.error || 'REQUEST_FAILED', response.status);
    return payload;
  }
  return {
    listPosts({ limit = 20, cursor = null } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new TypeError('INVALID_LIMIT');
      const params = new URLSearchParams({ limit: String(limit) });
      if (cursor) {
        if (!cursor.before || !cursor.beforeId) throw new TypeError('INVALID_CURSOR');
        params.set('before', cursor.before); params.set('beforeId', cursor.beforeId);
      }
      return request(`posts?${params}`);
    },
    createPost({ body = '', media = [] }) { return request('posts', { method: 'POST', body: JSON.stringify({ body, media }) }); },
    deletePost(id) { if (typeof id !== 'string' || !id) throw new TypeError('INVALID_POST_ID'); return request(`posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); },
    getLikes(postId) { if (typeof postId !== 'string' || !postId) throw new TypeError('INVALID_POST_ID'); return request(`likes?postId=${encodeURIComponent(postId)}`); },
    likePost(postId) { if (typeof postId !== 'string' || !postId) throw new TypeError('INVALID_POST_ID'); return request('likes', { method: 'POST', body: JSON.stringify({ postId }) }); },
    unlikePost(postId) { if (typeof postId !== 'string' || !postId) throw new TypeError('INVALID_POST_ID'); return request(`likes?postId=${encodeURIComponent(postId)}`, { method: 'DELETE' }); },
    listComments(postId) { if (typeof postId !== 'string' || !postId) throw new TypeError('INVALID_POST_ID'); return request(`comments?postId=${encodeURIComponent(postId)}`); },
    createComment({ postId, body, parentId = null }) {
      if (typeof postId !== 'string' || !postId || typeof body !== 'string' || !body.trim()) throw new TypeError('INVALID_COMMENT');
      return request('comments', { method: 'POST', body: JSON.stringify({ postId, body: body.trim(), parentId }) });
    },
    deleteComment(id) { if (typeof id !== 'string' || !id) throw new TypeError('INVALID_COMMENT_ID'); return request(`comments?id=${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  };
}
