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
    lives(offset=0){return request('lives?offset='+offset);},
    createLive(data){return request('lives',{method:'POST',body:JSON.stringify(data)});},
    deleteLive(id){return request('lives?id='+encodeURIComponent(id),{method:'DELETE'});},
    reportLive(targetId,reason,details){return request('reports',{method:'POST',body:JSON.stringify({targetType:'live',targetId,reason,details})});},
    blocks(offset=0){return request('blocks?offset='+offset);},
    block(id){return request('blocks',{method:'POST',body:JSON.stringify({id})});},
    unblock(id){return request('blocks?id='+encodeURIComponent(id),{method:'DELETE'});},
    likeComment(commentId){return request('comment-likes',{method:'POST',body:JSON.stringify({commentId})});},
    unlikeComment(commentId){return request('comment-likes?commentId='+encodeURIComponent(commentId),{method:'DELETE'});},
    report(postId,reason,details){return request('reports',{method:'POST',body:JSON.stringify({postId,reason,details})});},
    stories(offset=0){return request('stories?offset='+offset);},
    createStory(media){return request('stories',{method:'POST',body:JSON.stringify(media)});},
    deleteStory(id){return request('stories?id='+encodeURIComponent(id),{method:'DELETE'});},
    listArchived(offset=0){return request('archive?offset='+offset);},
    archive(postId,archived=true){return request('archive',{method:'PATCH',body:JSON.stringify({postId,archived})});},
    savedState(ids){return ids.length?request('saved?ids='+encodeURIComponent(ids.join(','))):Promise.resolve({ids:[]});},
    listSaved(offset=0){return request('saved?offset='+offset);},
    save(postId){return request('saved',{method:'POST',body:JSON.stringify({postId})});},
    unsave(postId){return request('saved?postId='+encodeURIComponent(postId),{method:'DELETE'});},
    follows(id){return request('follows?id='+encodeURIComponent(id));},
    followList(id,list,offset=0){return request('follows?'+new URLSearchParams({id,list,offset:String(offset)}));},
    follow(id){return request('follows',{method:'POST',body:JSON.stringify({id})});},
    unfollow(id){return request('follows?id='+encodeURIComponent(id),{method:'DELETE'});},
    profile({id,handle},offset=0){return request('profiles?'+new URLSearchParams({...id?{id}:{handle:handle.replace(/^@/,'')},offset:String(offset)}));},
    getPost(id) { if (typeof id !== 'string' || !id) throw new TypeError('INVALID_POST_ID'); return request(`posts?id=${encodeURIComponent(id)}`); },
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
    likesBatch(ids){return ids.length?request('likes?ids='+encodeURIComponent(ids.join(','))):Promise.resolve({stats:[]});},
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
