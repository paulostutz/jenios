/**
 * JENIOS Reels — a view over authorized Social posts, not a second media store.
 * Public-post data comes from the existing /api/social/posts RLS-protected endpoint.
 */
const POST_ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function safeVideoUrl(raw){
 if(typeof raw!=='string'||raw.length>2048)return null;
 try{
  const url=new URL(raw);
  if(url.protocol!=='https:'||!url.hostname||url.username||url.password)return null;
  return url.href;
 }catch{return null;}
}
export function videoReelsFromPosts(posts=[]){
 if(!Array.isArray(posts))return [];
 const output=[],seen=new Set();
 for(const post of posts){
  if(!post||!POST_ID.test(post.id||'')||post.archived_at||!Array.isArray(post.media))continue;
  for(let i=0;i<post.media.length;i++){
   const item=post.media[i];
   if(item?.type!=='video')continue;
   const src=safeVideoUrl(item.url||item.src);
   const id=post.id+':'+i;
   if(!src||seen.has(id))continue;
   seen.add(id);
   output.push({
    id,postId:post.id,src,
    caption:typeof post.body==='string'?post.body.slice(0,2000):'',
    createdAt:typeof post.created_at==='string'?post.created_at:null
   });
  }
 }
 return output;
}
export function appendUniqueVideoReels(before=[],after=[]){
 const rows=new Map();
 for(const r of [...before,...after])if(r?.id&&!rows.has(r.id))rows.set(r.id,r);
 return [...rows.values()];
}
