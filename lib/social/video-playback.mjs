/** Playback policy is independent of a transcode attempt. A missing binary must not hide the original video. */
export function shouldRequestVideoVariant({src,postId,enabled=false}={}) {
  return enabled === true && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(postId||'') &&
    typeof src === 'string' && /^https:\/\/[^/?#]+\//i.test(src) &&
    src.includes('/storage/v1/object/public/') && !/-stream-v1\.mp4(?:\?|$)/i.test(src);
}
export function playbackSource({near=false,original,variant}={}) {
  if (!near) return undefined;
  return (typeof variant === 'string' && variant.startsWith('https://')) ? variant : original;
}
export function nextVideoVariant(cache,src,url,limit=128){
 if(typeof src!=='string'||typeof url!=='string'||!/^https:\/\//.test(url)||!Number.isSafeInteger(limit)||limit<1)return false;
 if(cache.has(src))cache.delete(src);
 cache.set(src,url);
 while(cache.size>limit)cache.delete(cache.keys().next().value);
 return true;
}

/** Optimization links must stay in the original public bucket and origin. */
export function samePublicVideoBucket(original,variant){
 try {
  const a=new URL(original),b=new URL(variant);
  const bucket=a.pathname.match(/^\/storage\/v1\/object\/public\/([^/]+)\//);
  return Boolean(a.protocol==='https:'&&b.protocol==='https:'&&a.origin===b.origin&&bucket&&
   b.pathname.startsWith('/storage/v1/object/public/'+bucket[1]+'/')&& !b.username&&!b.password);
 }catch{return false;}
}
